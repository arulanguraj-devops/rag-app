import os
from langchain_chroma import Chroma
from libs.vectordb import initialize_documents
from libs.custom_logger import setup_logger
from dotenv import load_dotenv

# Initialize logging
logging = setup_logger()

load_dotenv()
API_KEY=os.getenv('API_KEY')

#initialize documents vectorizing
initialize_documents()