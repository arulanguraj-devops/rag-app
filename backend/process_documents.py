import os
import shutil
from langchain_chroma import Chroma
from libs.vectordb import initialize_documents
from libs.custom_logger import setup_logger
from libs.config import config_manager

# Initialize logging
logging = setup_logger()

# Load OpenAI API key from configuration
OPENAI_API_KEY = config_manager.get_openai_api_key()

# Set OpenAI API key as environment variable for the OpenAI client
if OPENAI_API_KEY and OPENAI_API_KEY != "your-openai-api-key-here":
    os.environ['OPENAI_API_KEY'] = OPENAI_API_KEY

def cleanup_and_rebuild():
    """Clean up existing vector database and rebuild with enhanced metadata"""
    
    print("🔄 Cleaning up and rebuilding vector database with citation metadata...")
    
    # Remove existing chroma_data directory
    chroma_dir = "chroma_data"
    if os.path.exists(chroma_dir):
        print(f"🗑️  Removing existing vector database: {chroma_dir}")
        shutil.rmtree(chroma_dir)
    
    # Remove old hash files to force re-indexing
    data_dir = "data"
    if os.path.exists(data_dir):
        print("🔨 Removing old hash files to force re-indexing...")
        for file in os.listdir(data_dir):
            if file.endswith("_hashes.json"):
                hash_file_path = os.path.join(data_dir, file)
                if os.path.exists(hash_file_path):
                    os.remove(hash_file_path)
                    print(f"   Removed: {hash_file_path}")
    
    # Rebuild with new metadata
    print("🚀 Rebuilding vector database with enhanced metadata...")
    initialize_documents()
    print("✅ Vector database rebuilt successfully with citation support!")

if __name__ == "__main__":
    cleanup_and_rebuild()