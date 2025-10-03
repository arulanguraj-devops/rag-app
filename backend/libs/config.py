import json
import os
from typing import Dict, Any
from libs.custom_logger import setup_logger

# Initialize logging
logging = setup_logger()

class ConfigManager:
    """Manages application configuration loaded from config.json"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config_path = config_path
        self._config = None
        self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
                logging.info(f"Configuration loaded from {self.config_path}")
            else:
                logging.warning(f"Configuration file {self.config_path} not found, using defaults")
                self._config = self._get_default_config()
        except Exception as e:
            logging.error(f"Error loading configuration: {e}")
            self._config = self._get_default_config()
        
        return self._config
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default configuration if file is not found"""
        return {
            "app": {
                "name": "QurHealth Assistant",
                "description": "AI-powered healthcare assistant ready to help",
                "welcome_title": "Welcome to QurHealth Assistant",
                "welcome_message": "Ask me anything about healthcare, medical information, or health-related topics.",
                "company": "QurHealth"
            },
            "features": {
                "settings_enabled": True,
                "api_key_required": True,
                "datastore_selection_enabled": False,
                "chat_history_enabled": True,
                "conversation_management_enabled": True,
                "theme_selection_enabled": True
            },
            "defaults": {
                "datastore_key": "test",
                "theme": "light",
                "max_conversations": 50,
                "max_chat_history": 10,
                "max_citations": 5,
                "relevance_threshold": 0.50
            },
            "ui": {
                "sidebar_collapsible": True,
                "show_conversation_timestamps": True,
                "show_message_timestamps": False,
                "auto_scroll": True
            },
            "api": {
                "api_key": "",
                "openai_api_key": "",
                "cors_origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
                "max_query_length": 1000,
                "rate_limit_enabled": False
            },
            "models": {
                "chat_model": {
                    "provider": "openai",
                    "model_name": "gpt-4o-mini",
                    "temperature": 0.5,
                    "streaming": True
                },
                "embedding_model": {
                    "provider": "openai",
                    "model_name": "text-embedding-ada-002"
                }
            },
            "logging": {
                "level": "INFO"
            },
            "storage": {
                "type": "local",
                "sqlite": {
                    "db_path": "data/history.db",
                    "user_id_prefix": "user_"
                }
            }
        }
    
    def get_config(self) -> Dict[str, Any]:
        """Get the current configuration"""
        if self._config is None:
            self.load_config()
        return self._config
    
    def get_section(self, section: str) -> Dict[str, Any]:
        """Get a specific section of the configuration"""
        config = self.get_config()
        return config.get(section, {})
    
    def get_value(self, section: str, key: str, default: Any = None) -> Any:
        """Get a specific configuration value with default fallback"""
        if self._config is None:
            self.load_config()
        
        if section in self._config and key in self._config[section]:
            return self._config[section][key]
        return default
        
    def get_domain_config(self, host: str) -> Dict[str, Any]:
        """Get domain-specific configuration for the given host
        
        Args:
            host (str): The host domain from the request (e.g., ask.example.com)
            
        Returns:
            Dict[str, Any]: Dictionary with domain-specific configuration or None
        """
        if self._config is None:
            self.load_config()
            
        domain_mapping = self._config.get("domain_mapping", {})
        return domain_mapping.get(host, None)
    
    def get_api_key(self) -> str:
        """Get the internal API key from configuration"""
        return self.get_value("api", "api_key", "")
    
    def get_openai_api_key(self) -> str:
        """Get the OpenAI API key from configuration"""
        return self.get_value("api", "openai_api_key", "")
    
    def get_chat_model_config(self) -> Dict[str, Any]:
        """Get chat model configuration"""
        return self.get_section("models").get("chat_model", {
            "provider": "openai",
            "model_name": "gpt-4o-mini",
            "temperature": 0.5,
            "streaming": True
        })
    
    def get_embedding_model_config(self) -> Dict[str, Any]:
        """Get embedding model configuration"""
        return self.get_section("models").get("embedding_model", {
            "provider": "openai",
            "model_name": "text-embedding-ada-002"
        })
    
    def get_log_level(self) -> str:
        """Get logging level from configuration"""
        return self.get_value("logging", "level", "INFO")
    
    def get_storage_type(self):
        """Get the storage type from configuration"""
        storage = self.get_section("storage")
        return storage.get("type", "local")
    
    def is_centralized_history_enabled(self):
        """Check if centralized history is enabled"""
        features = self.get_section("features")
        return features.get("centralized_history", False)
    
    def get_sqlite_config(self):
        """Get the SQLite database configuration"""
        storage = self.get_section("storage")
        return storage.get("sqlite", {"db_path": "data/history.db"})
    
    def reload_config(self):
        """Reload configuration from file"""
        self.load_config()
        logging.info("Configuration reloaded")

# Global config manager instance
config_manager = ConfigManager()