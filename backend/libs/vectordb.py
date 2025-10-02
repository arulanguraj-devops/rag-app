import os
import sys
import logging
import hashlib
import json
from pathlib import Path
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import (
    PyPDFLoader,
    CSVLoader,
    UnstructuredWordDocumentLoader,
    UnstructuredHTMLLoader,
    JSONLoader,
    TextLoader,
)

data_directory = "data"

def get_loader(file_extension: str, file_path: str):
    """Return the appropriate LangChain document loader based on the file extension."""
    if file_extension.lower() == ".csv":
        # For CSV files, use custom settings for better formatting
        return CSVLoader(file_path, csv_args={
            'delimiter': ',',
            'quotechar': '"',
            'fieldnames': None  # Use first row as headers
        })
    
    loaders = {
        ".pdf": PyPDFLoader,
        ".docx": UnstructuredWordDocumentLoader,
        ".html": UnstructuredHTMLLoader,
        ".json": JSONLoader,
        ".txt": TextLoader,
    }

    loader_class = loaders.get(file_extension.lower())
    if not loader_class:
        logging.error(f"Unsupported file format: {file_extension}")
        raise ValueError(f"Unsupported file format: {file_extension}")

    return loader_class(file_path)

def load_file_hashes(hash_store_path: str) -> dict:
    """Load the stored file hashes from the JSON file."""
    if os.path.exists(hash_store_path):
        with open(hash_store_path, "r") as f:
            return json.load(f)
    return {}

def save_file_hashes(file_hashes: dict, hash_store_path: str):
    """Save the file hashes to the JSON file."""
    with open(hash_store_path, "w") as f:
        json.dump(file_hashes, f, indent=4)

def get_file_hash(file_path: str) -> str:
    """Generate a hash for the file content."""
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

def upload_document(file_path: str, brain_folder: str):
    logging.info(f"Uploading document: {file_path}")
    file_extension = Path(file_path).suffix.lower()

    # Select the appropriate loader
    loader = get_loader(file_extension, file_path)

    # Load and split documents
    documents = loader.load()
    
    # For CSV files, combine all rows into a single document to avoid multiple references
    if file_extension.lower() == ".csv":
        if len(documents) > 1:
            # Combine all CSV rows into a single document
            combined_content = "\n".join([doc.page_content for doc in documents])
            # Create a single document with combined content
            from langchain.schema import Document
            combined_doc = Document(
                page_content=combined_content,
                metadata=documents[0].metadata  # Use metadata from first document
            )
            documents = [combined_doc]
        split_docs = documents  # Don't split CSV files
    else:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, 
            chunk_overlap=100,
            length_function=len,
            separators=["\n\n", "\n", ",", " ", ""]
        )
        split_docs = text_splitter.split_documents(documents)

    # Enhanced metadata for each document chunk
    for i, doc in enumerate(split_docs):
        # Get the filename for title
        filename = os.path.basename(file_path)
        title = os.path.splitext(filename)[0]
        
        # Add comprehensive metadata
        doc.metadata.update({
            "source": file_path,
            "title": title,
            "filename": filename,
            "file_extension": file_extension,
            "chunk_index": i,
            "brain_folder": brain_folder
        })
        
        # Add page number for PDFs if available
        if file_extension.lower() == ".pdf" and hasattr(doc, 'metadata') and 'page' in doc.metadata:
            # PyPDFLoader already provides page metadata (0-based indexing)
            # We'll adjust this later when creating citations for PDF viewers
            pass
        elif file_extension.lower() == ".pdf":
            # Estimate page number based on chunk size (rough approximation)
            estimated_page = (i // 3) + 1  # Assuming ~3 chunks per page
            doc.metadata["page"] = estimated_page
        
        # For CSV files, don't assign page numbers
        elif file_extension.lower() == ".csv":
            # CSV files don't have pages, remove any page metadata
            if 'page' in doc.metadata:
                del doc.metadata['page']
            if 'row' in doc.metadata:
                del doc.metadata['row']
        
        # For other file types, use chunk index as page reference
        else:
            doc.metadata["page"] = i + 1

    # Initialize Chroma vector store
    persist_dir = "chroma_data"
    datastore_path = os.path.join(persist_dir, brain_folder)
    os.makedirs(datastore_path, exist_ok=True)
    embeddings = OpenAIEmbeddings()
    vectorstore = Chroma(embedding_function=embeddings, persist_directory=datastore_path)

    # Load file hashes
    hash_store_path = os.path.join(data_directory, f"{brain_folder}_hashes.json")
    file_hashes = load_file_hashes(hash_store_path)
    current_file_hash = get_file_hash(file_path)
    stored_hash = file_hashes.get(file_path)

    # Check for existing document
    if stored_hash == current_file_hash:
        logging.info(f"Skipping file {file_path}, already indexed.")
        return
    elif stored_hash:
        logging.error(f"The file hash has changed for {file_path}. Please delete the ChromaDB folder {datastore_path} and {hash_store_path}, then try again.")
        sys.exit("Exiting the application due to hash change.")

    # Add documents to vector store with enhanced metadata
    vectorstore.add_documents(documents=split_docs)

    # Save updated hash
    file_hashes[file_path] = current_file_hash
    save_file_hashes(file_hashes, hash_store_path)
    logging.info(f"File {file_path} has been uploaded and indexed.")

# Preload documents from "data" directory
def initialize_documents():
    """Preload documents from the 'data' directory."""
    for brain_folder in os.listdir(data_directory):
        brain_folder_path = os.path.join(data_directory, brain_folder)
        if os.path.isdir(brain_folder_path):
            for file in os.listdir(brain_folder_path):
                file_path = os.path.join(brain_folder_path, file)
                if file.endswith((".pdf", ".csv", ".docx", ".html", ".json", ".txt")):
                    upload_document(file_path, brain_folder)
