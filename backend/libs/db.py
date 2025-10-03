import sqlite3
import os
import json
import uuid
import logging
from datetime import datetime
from .config import config_manager

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Manages SQLite database operations for chat history storage
    """
    def __init__(self):
        self.db_config = config_manager.get_config().get("storage", {}).get("sqlite", {})
        self.db_path = self.db_config.get("db_path", "data/history.db")
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Initialize database
        self._init_database()
    
    def _init_database(self):
        """Initialize database tables if they don't exist"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create users table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                api_key TEXT,
                user_identity TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # Create conversations table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                title TEXT,
                timestamp TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            ''')
            
            # Create messages table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                content TEXT,
                role TEXT,
                timestamp TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            )
            ''')
            
            conn.commit()
            conn.close()
            logger.info(f"Database initialized: {self.db_path}")
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
    
    def get_or_create_user(self, api_key=None, user_identity=None):
        """
        Get existing user or create a new one
        
        Args:
            api_key (str): API key for authentication
            user_identity (str): User identity from AWS ALB
            
        Returns:
            str: User ID
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        user_id = None
        
        try:
            # First try to find existing user
            if user_identity:
                cursor.execute("SELECT id FROM users WHERE user_identity = ?", (user_identity,))
                result = cursor.fetchone()
                if result:
                    user_id = result[0]
            elif api_key:
                cursor.execute("SELECT id FROM users WHERE api_key = ?", (api_key,))
                result = cursor.fetchone()
                if result:
                    user_id = result[0]
            
            # If user not found, create new one
            if not user_id:
                prefix = self.db_config.get("user_id_prefix", "user_")
                user_id = f"{prefix}{str(uuid.uuid4())}"
                cursor.execute(
                    "INSERT INTO users (id, api_key, user_identity) VALUES (?, ?, ?)",
                    (user_id, api_key, user_identity)
                )
                conn.commit()
                logger.info(f"Created new user: {user_id}")
            
            return user_id
        except Exception as e:
            logger.error(f"Error in get_or_create_user: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def save_conversation(self, conversation, user_id):
        """
        Save a conversation to the database
        
        Args:
            conversation (dict): Conversation data
            user_id (str): User ID
            
        Returns:
            bool: Success or failure
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        try:
            # Check if conversation exists
            cursor.execute("SELECT id FROM conversations WHERE id = ?", (conversation['id'],))
            exists = cursor.fetchone()
            
            if exists:
                # Update existing conversation
                cursor.execute(
                    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                    (conversation['title'], now, conversation['id'])
                )
                
                # Delete existing messages
                cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation['id'],))
            else:
                # Create new conversation
                cursor.execute(
                    "INSERT INTO conversations (id, user_id, title, timestamp, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (conversation['id'], user_id, conversation['title'], conversation.get('timestamp', now), now)
                )
            
            # Insert messages
            for message in conversation.get('messages', []):
                msg_id = message.get('id', str(uuid.uuid4()))
                cursor.execute(
                    "INSERT INTO messages (id, conversation_id, content, role, timestamp) VALUES (?, ?, ?, ?, ?)",
                    (msg_id, conversation['id'], message['content'], message['role'], message.get('timestamp', now))
                )
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error saving conversation: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def get_conversations(self, user_id, limit=50):
        """
        Get conversations for a specific user
        
        Args:
            user_id (str): User ID
            limit (int): Maximum number of conversations to retrieve
            
        Returns:
            list: List of conversations
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT id, title, timestamp, updated_at FROM conversations "
                "WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
                (user_id, limit)
            )
            
            conversations = []
            for row in cursor.fetchall():
                conv = dict(row)
                # Get messages for this conversation
                msg_cursor = conn.cursor()
                msg_cursor.execute(
                    "SELECT id, content, role, timestamp FROM messages "
                    "WHERE conversation_id = ? ORDER BY timestamp",
                    (conv['id'],)
                )
                
                conv['messages'] = [dict(msg) for msg in msg_cursor.fetchall()]
                conversations.append(conv)
            
            return conversations
        except Exception as e:
            logger.error(f"Error getting conversations: {e}")
            return []
        finally:
            conn.close()
    
    def get_conversation(self, conversation_id, user_id):
        """
        Get a specific conversation
        
        Args:
            conversation_id (str): Conversation ID
            user_id (str): User ID for validation
            
        Returns:
            dict: Conversation data or None
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT id, title, timestamp, updated_at FROM conversations "
                "WHERE id = ? AND user_id = ?",
                (conversation_id, user_id)
            )
            
            row = cursor.fetchone()
            if not row:
                return None
            
            conversation = dict(row)
            
            # Get messages
            msg_cursor = conn.cursor()
            msg_cursor.execute(
                "SELECT id, content, role, timestamp FROM messages "
                "WHERE conversation_id = ? ORDER BY timestamp",
                (conversation_id,)
            )
            
            conversation['messages'] = [dict(msg) for msg in msg_cursor.fetchall()]
            return conversation
        except Exception as e:
            logger.error(f"Error getting conversation {conversation_id}: {e}")
            return None
        finally:
            conn.close()
    
    def delete_conversation(self, conversation_id, user_id):
        """
        Delete a conversation and its messages
        
        Args:
            conversation_id (str): Conversation ID
            user_id (str): User ID for validation
            
        Returns:
            bool: Success or failure
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # First check if conversation belongs to user
            cursor.execute(
                "SELECT id FROM conversations WHERE id = ? AND user_id = ?", 
                (conversation_id, user_id)
            )
            if not cursor.fetchone():
                logger.warning(f"Unauthorized deletion attempt for conversation {conversation_id}")
                return False
            
            # Delete messages first
            cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
            
            # Delete conversation
            cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def clear_all_conversations(self, user_id):
        """
        Delete all conversations for a user
        
        Args:
            user_id (str): User ID
            
        Returns:
            bool: Success or failure
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get all conversation IDs for this user
            cursor.execute("SELECT id FROM conversations WHERE user_id = ?", (user_id,))
            conversation_ids = [row[0] for row in cursor.fetchall()]
            
            # Delete messages for all conversations
            if conversation_ids:
                placeholder = ', '.join(['?'] * len(conversation_ids))
                cursor.execute(f"DELETE FROM messages WHERE conversation_id IN ({placeholder})", conversation_ids)
            
            # Delete all conversations
            cursor.execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error clearing conversations for user {user_id}: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

# Create a singleton instance
db_manager = DatabaseManager()