from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse
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

# Generate function with Chroma retrieval
def generate(query, datastore_key, chat_history):  
    logging.debug(f"Starting generation for query: {query} with datastore_key: {datastore_key}")
    vectorstore = get_vectorstore(datastore_key)
    
    # Retrieve similar documents using similarity_search
    similar_documents = vectorstore.similarity_search(query, k=5)
    logging.debug(f"Found {len(similar_documents)} similar documents")
    
    # Log the content of retrieved documents for debugging
    for i, doc in enumerate(similar_documents):
        logging.debug(f"Document {i+1} content preview: {doc.page_content[:200]}...")

    if not similar_documents:
        # Handle case where no documents are found
        logging.warning("No relevant documents found.")
        streamer_queue.put("No relevant documents found.")
        return
    
    # Prepare context for LLM
    context = "\n".join(doc.page_content for doc in similar_documents)
    
    # Create the prompt including chat history
    chat_context = "\n".join(f"User: {msg['user']}\nBot: {msg['bot']}" for msg in chat_history)
    prompt = f"""You are QurHealth Assistant, a helpful AI healthcare assistant. 

IMPORTANT INSTRUCTIONS:
- If you don't know the answer, say "I regret to inform you that I am unable to provide a specific answer at this time, as this information is not available to me."
- Format your response clearly using markdown for better readability
- For holiday lists or date information, create a well-formatted table with columns like: Holiday Name, Date, Day, Location
- For lists, use proper bullet points or numbered lists
- Be concise and well-organized in your responses
- Focus on the most relevant information from the context
- If showing holiday information, format dates clearly (DD.MM.YYYY format)

CONTEXT:
{context}

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
        response_data = {
            "data": value
        }  
        yield f"data: {json.dumps(response_data)}\n\n"  
        streamer_queue.task_done()
        await asyncio.sleep(0.1)

class QueryRequest(BaseModel):
    query: str
    datastore_key: str
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

@app.post('/ask', dependencies=[Depends(verify_api_key)]) 
async def stream(query_request: QueryRequest):  
    logging.info(f'Query received: {query_request.query}')
    
    # Use configured default datastore if not provided
    if not query_request.datastore_key:
        query_request.datastore_key = config_manager.get_value("defaults", "datastore_key", "test")
    
    # Limit query length based on configuration
    max_query_length = config_manager.get_value("api", "max_query_length", 1000)
    if len(query_request.query) > max_query_length:
        raise HTTPException(status_code=400, detail=f"Query too long. Maximum length is {max_query_length} characters.")
    
    query_request.chat_history = []
    return StreamingResponse(response_generator(query_request.query, query_request.datastore_key, query_request.chat_history), media_type='text/event-stream')

if __name__ == "__main__":
    import uvicorn
    logging.info("Starting FastAPI application.")
    uvicorn.run(app, host="127.0.0.1", port=8000)
