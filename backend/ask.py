from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import logging
import asyncio
import json
from queue import Queue
from threading import Thread
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.schema.messages import HumanMessage
from langchain_chroma import Chroma

#local libs
from libs.handler import SteamCustomHandler
from libs.config import config_manager
#from libs.vectordb import initialize_documents
from libs.custom_logger import setup_logger

# Initialize logging
logging = setup_logger()

#initialize documents vectorizing
#initialize_documents()

# Load environment variables
load_dotenv()
API_KEY=os.getenv('API_KEY')

embeddings = OpenAIEmbeddings()

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
stream_handler = SteamCustomHandler(streamer_queue)
llm = ChatOpenAI(model="gpt-4o-mini", streaming=True, callbacks=[stream_handler], temperature=0.5)

# Function to get the vectorstore for retrieval
def get_vectorstore(datastore_key: str):
    logging.info(f"Getting vectorstore for datastore: {datastore_key}")
    persist_dir = "chroma_data"
    datastore_path = os.path.join(persist_dir, datastore_key)
    return Chroma(embedding_function=embeddings, persist_directory=datastore_path)

def generate(query, datastore_key, chat_history):  
    logging.debug(f"Starting generation for query: {query} with datastore_key: {datastore_key}")
    vectorstore = get_vectorstore(datastore_key)
    
    # Retrieve more documents initially, then filter by relevance
    k_value = 10  # Get more results initially for better filtering
    
    # Retrieve similar documents using similarity_search_with_score for better relevance
    similar_documents_with_scores = vectorstore.similarity_search_with_score(query, k=k_value)
    similar_documents = [doc for doc, score in similar_documents_with_scores]
    logging.debug(f"Found {len(similar_documents)} similar documents")
    
    # Collect citation information
    citations = []
    for i, (doc, score) in enumerate(similar_documents_with_scores):
        # Use a more selective relevance threshold to filter out irrelevant documents
        # Lower scores are better (closer similarity)
        relevance_threshold = 0.55  # More selective threshold
        
        # Skip documents that are not relevant enough
        if score > relevance_threshold:
            logging.info(f"Skipping irrelevant document: {doc.metadata.get('title', 'Unknown')} (Score: {score:.3f})")
            continue
            
        # Handle both old and new metadata formats
        source = doc.metadata.get('source', doc.metadata.get('file_path', 'Unknown'))
        title = doc.metadata.get('title', os.path.basename(source) if source != 'Unknown' else 'Unknown Document')
        page = doc.metadata.get('page', None)
        
        # Clean up the source path for display
        if source.startswith('./') or source.startswith('.\\'):
            source = source[2:]
        
        # For CSV files, don't show page numbers as they don't have pages
        if source.lower().endswith('.csv'):
            page = None
        
        # Create the document URL for the frontend
        document_url = f"http://127.0.0.1:8000/documents/{source}" if source != 'Unknown' else None
        
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
    
    # Filter similar_documents to match the filtered citations
    filtered_documents = [doc for doc, score in similar_documents_with_scores 
                         if score <= 0.55]
    
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
    prompt = f"""You are QurHealth Assistant, a helpful AI healthcare assistant. 

IMPORTANT INSTRUCTIONS:
- Use the provided numbered references [1], [2], [3], etc. in your response to cite information
- CRITICAL: Include citation numbers [1] or [2] IMMEDIATELY after each piece of information from the references
- DO NOT put all citations at the end - place them right after the relevant content
- Example: "The holiday is on 14.01.2025 [1] and falls on Tuesday [2]."
- If you don't know the answer, say "I regret to inform you that I am unable to provide a specific answer at this time, as this information is not available to me."
- Format your response clearly using markdown for better readability
- For tabular data, create well-formatted tables with appropriate columns and include citations for each row
- When asked for complete or full information, include ALL relevant data mentioned in the references
- For lists, use proper bullet points or numbered lists with citations after each item
- Be concise and well-organized in your responses
- Focus on the most relevant information from the context
- Make sure to compile information from ALL relevant references to provide complete answers

NUMBERED REFERENCES:
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

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid API Key")

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

@app.post('/ask', dependencies=[Depends(verify_api_key)]) 
async def stream(query_request: QueryRequest):  
    logging.info(f'Query received: {query_request.query}')
    
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
