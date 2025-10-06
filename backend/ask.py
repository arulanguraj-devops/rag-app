import re
from fastapi import FastAPI, HTTPException, Header, Depends, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os
import logging
import asyncio
import json
import uuid
from queue import Queue
from threading import Thread
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.schema.messages import HumanMessage
from langchain_chroma import Chroma

#local libs
from libs.handler import SteamCustomHandler
from libs.config import config_manager
from libs.db import db_manager
#from libs.vectordb import initialize_documents
from libs.custom_logger import setup_logger

# Initialize logging
logging = setup_logger()

#initialize documents vectorizing
#initialize_documents()

# Load API keys from configuration
API_KEY = config_manager.get_api_key()  # Internal API key for FastAPI authentication
OPENAI_API_KEY = config_manager.get_openai_api_key()  # OpenAI API key

# Validate API keys are configured
if not API_KEY:
    logging.error("Internal API key not configured. Please set 'api.api_key' in config.json")
    raise ValueError("Internal API key not configured in config.json")

if not OPENAI_API_KEY or OPENAI_API_KEY == "your-openai-api-key-here":
    logging.error("OpenAI API key not configured. Please set 'api.openai_api_key' in config.json")
    raise ValueError("OpenAI API key not configured in config.json")

# Set OpenAI API key as environment variable for the OpenAI client
os.environ['OPENAI_API_KEY'] = OPENAI_API_KEY

# Initialize embeddings with configuration
embedding_config = config_manager.get_embedding_model_config()
embeddings = OpenAIEmbeddings(model=embedding_config.get("model_name", "text-embedding-ada-002"))

# Initialize FastAPI app
app = FastAPI()

# Load configuration
config = config_manager.get_config()

# Configure CORS with configurable origins
cors_origins = config_manager.get_value("api", "cors_origins", ["http://localhost:3000", "http://127.0.0.1:3000"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a Streamer queue
streamer_queue = Queue()
# Note: stream_handler will be created per request to avoid citation accumulation

# Function to get the vectorstore for retrieval
def get_vectorstore(datastore_key: str):
    logging.info(f"Getting vectorstore for datastore: {datastore_key}")
    persist_dir = "chroma_data"
    datastore_path = os.path.join(persist_dir, datastore_key)
    return Chroma(embedding_function=embeddings, persist_directory=datastore_path)

def generate(query, datastore_key, chat_history):  
    logging.debug(f"Starting generation for query: {query} with datastore_key: {datastore_key}")
    
    # Create a fresh handler for this request to avoid citation accumulation
    stream_handler = SteamCustomHandler(streamer_queue)
    
    # Get chat model configuration
    chat_model_config = config_manager.get_chat_model_config()
    llm = ChatOpenAI(
        model=chat_model_config.get("model_name", "gpt-4o-mini"),
        streaming=chat_model_config.get("streaming", True),
        callbacks=[stream_handler],
        temperature=chat_model_config.get("temperature", 0.5)
    )
    
    vectorstore = get_vectorstore(datastore_key)
    
    # Retrieve more documents initially, then filter by relevance
    k_value = 10  # Get more results initially for better filtering
    
    # Retrieve similar documents using similarity_search_with_score for better relevance
    similar_documents_with_scores = vectorstore.similarity_search_with_score(query, k=k_value)
    similar_documents = [doc for doc, score in similar_documents_with_scores]
    logging.debug(f"Found {len(similar_documents)} similar documents")
    
    # Collect citation information
    citations = []
    max_citations = config_manager.get_value("defaults", "max_citations", 5)  # Configurable limit
    relevance_threshold = config_manager.get_value("defaults", "relevance_threshold", 0.4)  # Configurable threshold
    
    logging.info(f"Processing {len(similar_documents_with_scores)} documents from vector search")
    logging.info(f"Using relevance threshold: {relevance_threshold}, max citations: {max_citations}")
    
    for i, (doc, score) in enumerate(similar_documents_with_scores):
        # Stop if we've reached the maximum number of citations
        if len(citations) >= max_citations:
            logging.info(f"Reached maximum citations limit ({max_citations}), stopping processing")
            break
            
        # Use a more selective relevance threshold to filter out irrelevant documents
        # Lower scores are better (closer similarity) - be more selective
        
        logging.debug(f"Document {i+1}: Score {score:.3f}, Title: {doc.metadata.get('title', 'Unknown')}")
        
        # Skip documents that are not relevant enough
        if score > relevance_threshold:
            logging.info(f"Skipping irrelevant document: {doc.metadata.get('title', 'Unknown')} (Score: {score:.3f}) - above threshold {relevance_threshold}")
            continue
            
        logging.info(f"Including document: {doc.metadata.get('title', 'Unknown')} (Score: {score:.3f}) - below threshold {relevance_threshold}")
        
        # Handle both old and new metadata formats
        source = doc.metadata.get('source', doc.metadata.get('file_path', 'Unknown'))
        title = doc.metadata.get('title', os.path.basename(source) if source != 'Unknown' else 'Unknown Document')
        page = doc.metadata.get('page', None)
        
        # Debug logging for page numbers
        logging.debug(f"Document metadata: {doc.metadata}")
        logging.debug(f"Page number from metadata: {page} (type: {type(page)})")
        
        # Fix page numbering: PyPDFLoader uses 0-based indexing, but PDF viewers expect 1-based
        if page is not None and isinstance(page, int) and source.lower().endswith('.pdf'):
            page = page + 1  # Convert from 0-based to 1-based for PDF viewers
            logging.debug(f"Adjusted page number for PDF viewer: {page}")
        
        # Clean up the source path for display
        if source.startswith('./') or source.startswith('.\\'):
            source = source[2:]
        
        # For CSV files, don't show page numbers as they don't have pages
        if source.lower().endswith('.csv'):
            page = None
        
        # Create the document URL for the frontend using the configured base URL
        base_url = config_manager.get_value("api", "base_url", "http://127.0.0.1:8000")
        document_url = f"{base_url}/documents/{source}" if source != 'Unknown' else None
        
        citation = {
            "id": f"ref_{len(citations)+1}",  # Use actual citation count
            "source": document_url,
            "local_path": source,  # Keep the local path for reference
            "page": page,
            "title": title,
            "relevance_score": float(score),
            "content_preview": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content
        }
        citations.append(citation)
    
    # Filter similar_documents to match the filtered citations - MUST use same limit
    filtered_documents = []
    for i, (doc, score) in enumerate(similar_documents_with_scores):
        # Stop if we've reached the same limit as citations
        if len(filtered_documents) >= max_citations:
            break
            
        # Use same relevance threshold as citations
        if score <= relevance_threshold:
            filtered_documents.append(doc)
    
    # Ensure we have the same number of documents as citations
    if len(filtered_documents) != len(citations):
        logging.warning(f"Mismatch: {len(citations)} citations but {len(filtered_documents)} documents")
        # Adjust to match - this should not happen with the fix above
        min_count = min(len(citations), len(filtered_documents))
        citations = citations[:min_count]
        filtered_documents = filtered_documents[:min_count]
        logging.info(f"Adjusted to {len(citations)} citations and {len(filtered_documents)} documents")
    
    # Set citations in the stream handler
    stream_handler.set_citations(citations)
    
    # Debug: Log the citations being sent
    logging.info(f"Generated {len(citations)} citations:")
    for citation in citations:
        logging.info(f"  Citation: {citation['id']} - {citation['title']} (Score: {citation['relevance_score']:.3f})")
    
    # Log the content of retrieved documents for debugging
    for i, doc in enumerate(similar_documents):
        logging.debug(f"Document {i+1} content preview: {doc.page_content[:200]}...")
        logging.debug(f"Document {i+1} metadata: {doc.metadata}")

    if not similar_documents:
        # Handle case where no documents are found
        logging.warning("No relevant documents found.")
        streamer_queue.put("No relevant documents found.")
        return
    
    # Prepare context for LLM with numbered references
    context_with_citations = ""
    for i, doc in enumerate(filtered_documents):
        context_with_citations += f"[{i+1}] {doc.page_content}\n\n"
    
    # Create the prompt including chat history
    chat_context = "\n".join(f"User: {msg['user']}\nBot: {msg['bot']}" for msg in chat_history)
    num_references = len(filtered_documents)
    available_citations = ", ".join([f"[{i+1}]" for i in range(num_references)])
    
    prompt = f"""You are AI Assistant, 

CRITICAL CITATION RULES - FOLLOW EXACTLY:
- You have EXACTLY {num_references} references available: {available_citations}
- DO NOT USE any citation numbers higher than [{num_references}]
- NEVER use citations like [{num_references+1}], [{num_references+2}], etc. - THEY DON'T EXIST
- If you need to cite information, use ONLY: {available_citations}
- Any citation outside this range will cause errors

RESPONSE INSTRUCTIONS:
- Use the provided numbered references to cite information immediately after relevant content
- Example: "The holiday is on 14.01.2025 [1] and falls on Tuesday [2]."
- Format your response clearly using markdown for better readability
- You may use basic conversational greetings (e.g., "Hi", "Hello", "Thank you") even if they are not in the documents.
- For all other content, do not use outside knowledge or assumptions. Only use the provided references {available_citations} to answer.
- If you don't know the answer, say "I regret to inform you that I am unable to provide a specific answer at this time, as this information is not available to me."
- Do not generate or assume any information that is not explicitly present in the provided references.
- Be concise and well-organized in your responses
- Focus on the most relevant information from the context

NUMBERED REFERENCES (CITATIONS {available_citations} ONLY):
{context_with_citations}

CHAT HISTORY:
{chat_context}

QUESTION: {query}

ANSWER:"""
    
    # Invoke the LLM with the constructed prompt
    response = llm.invoke([HumanMessage(content=prompt)])
    logging.debug(f"Response generated: {response}")

def start_generation(query, datastore_key, chat_history):  
    logging.info(f"Starting generation in a new thread for query: {query}")
    thread = Thread(target=generate, kwargs={"query": query, "datastore_key": datastore_key, "chat_history": chat_history})  
    thread.start()

async def response_generator(query, datastore_key, chat_history):  
    logging.info(f"Response generator started for query: {query}")
    
    # Clear any remaining items in the queue from previous requests
    while not streamer_queue.empty():
        try:
            streamer_queue.get_nowait()
        except:
            break
    
    start_generation(query, datastore_key, chat_history)  
    while True:  
        value = await asyncio.to_thread(streamer_queue.get)
        if value is None:  
            break
        
        # Handle citations separately
        if isinstance(value, dict) and value.get("type") == "citations":
            # Citation data is already in the correct format
            yield f"data: {json.dumps(value)}\n\n"
        elif isinstance(value, str):
            # Regular text token
            response_data = {
                "type": "token",
                "data": value
            }  
            yield f"data: {json.dumps(response_data)}\n\n"
            
        streamer_queue.task_done()
        await asyncio.sleep(0.1)

class QueryRequest(BaseModel):
    query: str
    chat_history: list

class Message(BaseModel):
    id: Optional[str] = None
    content: str
    role: str  # 'user' or 'assistant'
    timestamp: Optional[str] = None
    citations: Optional[List[Dict[str, Any]]] = None

class Conversation(BaseModel):
    id: str
    title: str
    timestamp: str
    updated_at: Optional[str] = None
    messages: List[Message]

class ConversationRequest(BaseModel):
    conversation: Conversation
    client_user_id: Optional[str] = None

class UserIdRequest(BaseModel):
    client_user_id: Optional[str] = None

async def verify_api_key(
    x_api_key: str = Header(None),
    x_amzn_oidc_data: str = Header(None),
    x_amzn_oidc_identity: str = Header(None),
    x_amzn_oidc_accesstoken: str = Header(None)
):
    # Check if request came through AWS ALB with OIDC authentication
    is_aws_alb_authenticated = all([
        x_amzn_oidc_data,
        x_amzn_oidc_identity,
        x_amzn_oidc_accesstoken
    ])
    
    # If AWS ALB OIDC auth headers are present, we're authenticated
    if is_aws_alb_authenticated:
        logging.debug("Request authenticated via AWS ALB OIDC")
        return
        
    # Fall back to API key validation if no ALB headers
    if not x_api_key or x_api_key != API_KEY:
        logging.warning("Invalid or missing API key")
        raise HTTPException(status_code=403, detail="Forbidden: Invalid API Key")

@app.get('/health')
async def health_check(
    x_amzn_oidc_data: str = Header(None),
    x_amzn_oidc_identity: str = Header(None),
    x_api_key: str = Header(None)
):
    """Enhanced health check endpoint that works with both API key and ALB auth"""
    
    # Check for ALB authentication headers
    is_alb_auth = x_amzn_oidc_data is not None and x_amzn_oidc_identity is not None
    is_api_key_valid = x_api_key == API_KEY if x_api_key else False
    
    response = {
        "status": "healthy",
        "message": "API is working",
        "auth_method": "unknown"
    }
    
    if is_alb_auth:
        response["auth_method"] = "aws_alb_oidc"
    elif is_api_key_valid:
        response["auth_method"] = "api_key"
    
    # Check if centralized history is enabled
    response["centralized_history_enabled"] = config_manager.is_centralized_history_enabled()
    
    return response

@app.get('/user-info')
async def get_user_info(
    x_amzn_oidc_data: str = Header(None),
    x_amzn_oidc_identity: str = Header(None),
    x_amzn_oidc_accesstoken: str = Header(None)
):
    """Get authenticated user information"""
    try:
        # Check if request is coming through AWS ALB with OIDC
        if all([x_amzn_oidc_data, x_amzn_oidc_identity]):
            # Extract user info from the ALB headers
            # The x_amzn_oidc_identity typically contains user info in JWT format
            user_info = {
                "authenticated": True,
                "auth_method": "aws_alb_oidc",
                "user_identity": x_amzn_oidc_identity
            }
            
            # Try to extract username from JWT claims if available
            try:
                # JWT data is Base64 encoded with 3 parts: header.payload.signature
                import base64
                import json
                
                # x_amzn_oidc_data is a JWT, extract the payload part (second part)
                jwt_parts = x_amzn_oidc_data.split('.')
                if len(jwt_parts) >= 2:
                    # Add padding if needed
                    payload = jwt_parts[1]
                    payload += '=' * ((4 - len(payload) % 4) % 4)
                    
                    # Decode the payload
                    decoded_payload = base64.b64decode(payload)
                    claims = json.loads(decoded_payload)
                    
                    # Extract common user identifier fields (adjust based on your OIDC provider)
                    username = claims.get('name') or claims.get('preferred_username') or claims.get('email') or claims.get('sub')
                    user_info["username"] = username
                    user_info["email"] = claims.get('email')
                    user_info["claims"] = claims
            except Exception as e:
                logging.warning(f"Failed to parse JWT claims: {e}")
                user_info["username"] = "Authenticated User"
                
            return user_info
        else:
            # API key authentication doesn't provide user info
            return {
                "authenticated": True,
                "auth_method": "api_key",
                "username": "API User"
            }
    except Exception as e:
        logging.error(f"Error retrieving user info: {e}")
        return {
            "authenticated": False,
            "auth_method": "unknown",
            "error": str(e)
        }

@app.post('/user-id')
async def get_or_create_user_id(
    request: UserIdRequest,
    x_api_key: str = Header(None),
    x_amzn_oidc_identity: str = Header(None)
):
    """
    This endpoint needs to be available without prior authentication 
    to allow the initial check of centralized history status
    """
    try:
        # Check if centralized history is enabled
        if not config_manager.is_centralized_history_enabled():
            return {
                "success": True,
                "centralized_history_enabled": False,
                "client_user_id": request.client_user_id or str(uuid.uuid4())
            }
        
        # Return info about centralized history, but require auth for actual user_id
        if not x_api_key and not x_amzn_oidc_identity:
            return {
                "success": True,
                "centralized_history_enabled": True,
                "needs_authentication": True,
                "message": "Authentication required for centralized history"
            }
        
        # Verify API key if provided
        if x_api_key and x_api_key != API_KEY:
            return {
                "success": False,
                "centralized_history_enabled": True,
                "error": "Invalid API key"
            }
            
        # Determine user identifier based on auth method
        user_id = None
        
        # If ALB authenticated, use the ALB identity
        if x_amzn_oidc_identity:
            user_id = db_manager.get_or_create_user(
                api_key=None, 
                user_identity=x_amzn_oidc_identity
            )
        # Otherwise use the API key
        elif x_api_key:
            user_id = db_manager.get_or_create_user(
                api_key=x_api_key,
                user_identity=None
            )
            
        return {
            "success": True,
            "centralized_history_enabled": True,
            "user_id": user_id
        }
    except Exception as e:
        logging.error(f"Error creating/retrieving user ID: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get('/history/conversations', dependencies=[Depends(verify_api_key)])
async def get_conversations(
    client_user_id: str = Query(None),
    limit: int = Query(50),
    x_api_key: str = Header(None),
    x_amzn_oidc_identity: str = Header(None)
):
    """Get conversations for the current user"""
    try:
        # Check if centralized history is enabled
        if not config_manager.is_centralized_history_enabled():
            return {
                "success": True,
                "centralized_history_enabled": False,
                "conversations": []
            }
        
        # Determine user ID based on auth method
        user_id = None
        if x_amzn_oidc_identity:
            user_id = db_manager.get_or_create_user(
                api_key=None, 
                user_identity=x_amzn_oidc_identity
            )
        elif x_api_key and client_user_id:
            user_id = client_user_id
        else:
            raise HTTPException(status_code=400, detail="Missing client_user_id")
            
        # Get conversations for this user
        conversations = db_manager.get_conversations(user_id, limit)
        
        return {
            "success": True,
            "centralized_history_enabled": True,
            "conversations": conversations
        }
    except Exception as e:
        logging.error(f"Error retrieving conversations: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get('/history/conversation/{conversation_id}', dependencies=[Depends(verify_api_key)])
async def get_conversation(
    conversation_id: str,
    client_user_id: str = Query(None),
    x_api_key: str = Header(None),
    x_amzn_oidc_identity: str = Header(None)
):
    """Get a specific conversation by ID"""
    try:
        # Check if centralized history is enabled
        if not config_manager.is_centralized_history_enabled():
            return {
                "success": True,
                "centralized_history_enabled": False,
                "conversation": None
            }
        
        # Determine user ID based on auth method
        user_id = None
        if x_amzn_oidc_identity:
            user_id = db_manager.get_or_create_user(
                api_key=None, 
                user_identity=x_amzn_oidc_identity
            )
        elif x_api_key and client_user_id:
            user_id = client_user_id
        else:
            raise HTTPException(status_code=400, detail="Missing client_user_id")
            
        # Get the conversation
        conversation = db_manager.get_conversation(conversation_id, user_id)
        
        if not conversation:
            return {
                "success": False,
                "error": "Conversation not found"
            }
        
        return {
            "success": True,
            "conversation": conversation
        }
    except Exception as e:
        logging.error(f"Error retrieving conversation: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post('/history/conversation', dependencies=[Depends(verify_api_key)])
async def save_conversation(
    request: ConversationRequest,
    x_api_key: str = Header(None),
    x_amzn_oidc_identity: str = Header(None)
):
    """Save or update a conversation"""
    try:
        # Check if centralized history is enabled
        if not config_manager.is_centralized_history_enabled():
            return {
                "success": True,
                "centralized_history_enabled": False
            }
        
        # Determine user ID based on auth method
        user_id = None
        if x_amzn_oidc_identity:
            user_id = db_manager.get_or_create_user(
                api_key=None, 
                user_identity=x_amzn_oidc_identity
            )
        elif x_api_key and request.client_user_id:
            user_id = request.client_user_id
        else:
            raise HTTPException(status_code=400, detail="Missing client_user_id")
            
        # Save the conversation
        success = db_manager.save_conversation(
            request.conversation.model_dump(),  # Updated from dict() to model_dump()
            user_id
        )
        
        return {
            "success": success
        }
    except Exception as e:
        logging.error(f"Error saving conversation: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.delete('/history/conversation/{conversation_id}', dependencies=[Depends(verify_api_key)])
async def delete_conversation(
    conversation_id: str,
    client_user_id: str = Query(None),
    x_api_key: str = Header(None),
    x_amzn_oidc_identity: str = Header(None)
):
    """Delete a conversation"""
    try:
        # Check if centralized history is enabled
        if not config_manager.is_centralized_history_enabled():
            return {
                "success": True,
                "centralized_history_enabled": False
            }
        
        # Determine user ID based on auth method
        user_id = None
        if x_amzn_oidc_identity:
            user_id = db_manager.get_or_create_user(
                api_key=None, 
                user_identity=x_amzn_oidc_identity
            )
        elif x_api_key and client_user_id:
            user_id = client_user_id
        else:
            raise HTTPException(status_code=400, detail="Missing client_user_id")
            
        # Delete the conversation
        success = db_manager.delete_conversation(conversation_id, user_id)
        
        return {
            "success": success
        }
    except Exception as e:
        logging.error(f"Error deleting conversation: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.delete('/history/conversations', dependencies=[Depends(verify_api_key)])
async def clear_all_conversations(
    client_user_id: str = Query(None),
    x_api_key: str = Header(None),
    x_amzn_oidc_identity: str = Header(None)
):
    """Clear all conversations for the current user"""
    try:
        # Check if centralized history is enabled
        if not config_manager.is_centralized_history_enabled():
            return {
                "success": True,
                "centralized_history_enabled": False
            }
        
        # Determine user ID based on auth method
        user_id = None
        if x_amzn_oidc_identity:
            user_id = db_manager.get_or_create_user(
                api_key=None, 
                user_identity=x_amzn_oidc_identity
            )
        elif x_api_key and client_user_id:
            user_id = client_user_id
        else:
            raise HTTPException(status_code=400, detail="Missing client_user_id")
            
        # Clear all conversations
        success = db_manager.clear_all_conversations(user_id)
        
        return {
            "success": success
        }
    except Exception as e:
        logging.error(f"Error clearing conversations: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post('/test-connection', dependencies=[Depends(verify_api_key)])
async def test_connection(
    x_amzn_oidc_identity: str = Header(None)
):
    """Test API connection without triggering full RAG pipeline"""
    try:
        auth_method = "API Key"
        if x_amzn_oidc_identity:
            auth_method = "AWS ALB OIDC"
            
        return {
            "status": "success", 
            "message": f"Connection successful using {auth_method} authentication",
            "auth_method": auth_method
        }
    except Exception as e:
        logging.error(f"Test connection error: {e}")
        raise HTTPException(status_code=500, detail="Connection test failed")

@app.get('/config')
async def get_config():
    """Get application configuration for frontend"""
    try:
        # Return frontend-specific configuration
        frontend_config = {
            "app": config_manager.get_section("app"),
            "features": config_manager.get_section("features"),
            "defaults": config_manager.get_section("defaults"),
            "ui": config_manager.get_section("ui")
        }
        return frontend_config
    except Exception as e:
        logging.error(f"Error retrieving configuration: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving configuration")

@app.get('/documents/{file_path:path}')
async def serve_document(file_path: str):
    """Serve documents for citation viewing"""
    try:
        # Ensure the file path is safe and within the data directory
        safe_path = os.path.normpath(file_path)
        
        # Remove any leading slashes or dots to prevent directory traversal
        safe_path = safe_path.lstrip('./')
        
        # Construct the full path
        full_path = os.path.join(os.getcwd(), safe_path)
        
        # Verify the file exists and is within allowed directories
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Security check: ensure the file is within the data directory
        data_dir = os.path.join(os.getcwd(), "data")
        if not os.path.commonpath([full_path, data_dir]) == data_dir:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Determine the media type based on file extension
        file_extension = os.path.splitext(full_path)[1].lower()
        media_type_map = {
            '.pdf': 'application/pdf',
            '.csv': 'text/csv',
            '.txt': 'text/plain',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.html': 'text/html',
            '.json': 'application/json'
        }
        
        media_type = media_type_map.get(file_extension, 'application/octet-stream')
        
        return FileResponse(
            path=full_path,
            media_type=media_type,
            filename=os.path.basename(full_path)
        )
        
    except Exception as e:
        logging.error(f"Error serving document {file_path}: {e}")
        raise HTTPException(status_code=500, detail="Error serving document")

# Import version information
from __version__ import get_version_info

@app.get("/version", dependencies=[])
async def get_version():
    """Return version information about the backend."""
    return get_version_info(config_manager)

@app.post('/ask', dependencies=[Depends(verify_api_key)]) 
async def stream(
    query_request: QueryRequest,
    x_amzn_oidc_identity: str = Header(None)
):  
    user_identifier = "API User"
    if x_amzn_oidc_identity:
        # Log the identity of the authenticated user from ALB
        user_identifier = x_amzn_oidc_identity
        
    logging.info(f'Query received from {user_identifier}: {query_request.query}')
    
    # Get datastore_key from configuration
    datastore_key = config_manager.get_value("defaults", "datastore_key", "test")
    
    # Limit query length based on configuration
    max_query_length = config_manager.get_value("api", "max_query_length", 1000)
    if len(query_request.query) > max_query_length:
        raise HTTPException(status_code=400, detail=f"Query too long. Maximum length is {max_query_length} characters.")
    
    query_request.chat_history = []
    return StreamingResponse(response_generator(query_request.query, datastore_key, query_request.chat_history), media_type='text/event-stream')

if __name__ == "__main__":
    import uvicorn
    logging.info("Starting FastAPI application.")
    uvicorn.run(app, host="127.0.0.1", port=8000)