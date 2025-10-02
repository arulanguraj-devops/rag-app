# Ventech Assistant RAG Application

A complete RAG (Retrieval-Augmented Generation) application consisting of a FastAPI backend and a modern React frontend for HR and IT policy assistance.

## 🏗️ Architecture

```
rag-app/
├── backend/           # FastAPI backend with RAG implementation
│   ├── ask.py        # Main API endpoint
│   ├── process_documents.py
│   ├── config.json   # Centralized configuration (not in git)
│   ├── config.json.example # Configuration template
│   ├── requirements.txt
│   ├── data/         # Document storage
│   └── libs/         # Custom libraries
├── frontend/         # React chat interface
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── README.md
├── rag-venv/         # Python virtual environment
└── start.sh          # Startup script
```

## ✨ Features

### Backend
- 🤖 **RAG Pipeline**: Retrieval-augmented generation using OpenAI and ChromaDB
- ⚙️ **Centralized Configuration**: Single config.json for all settings
- 📄 **Document Processing**: Support for various document formats
- 🔄 **Streaming Responses**: Real-time response streaming via SSE
- 🔐 **API Security**: Dual API key system (internal + OpenAI)
- 📊 **Logging**: Comprehensive logging system
- 🔧 **Configurable Models**: Easy model switching through configuration

### Frontend
- 💬 **Modern Chat UI**: Sleek, responsive chat interface
- 📱 **Mobile Responsive**: Works on all device sizes
- 💾 **Local Storage**: Conversation history stored locally
- 🎨 **Markdown Support**: Rich text rendering for AI responses
- ⚙️ **Easy Configuration**: Simple settings management
- 🔄 **Real-time Updates**: Live streaming of AI responses

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### One-Command Setup
```bash
./start.sh
```

This script will:
1. Check all prerequisites
2. Install frontend dependencies
3. Start the backend server
4. Start the frontend development server
5. Open the application in your browser

### Manual Setup

#### 1. Backend Setup
```bash
# Activate virtual environment
source rag-venv/bin/activate

# Install dependencies (if not already done)
cd backend
pip install -r requirements.txt

# Create configuration file
cp config.json.example config.json
# Edit config.json with your API keys and settings

# Start backend
python ask.py
```

#### 2. Frontend Setup
```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm start
```

### 3. Configuration

1. **Configure Backend**: Copy `backend/config.json.example` to `backend/config.json` and update:
   - `api.api_key`: Your internal API key for FastAPI authentication
   - `api.openai_api_key`: Your OpenAI API key
   - `models`: Configure chat and embedding models
   - Other settings as needed

2. **Open the application**: Navigate to `http://localhost:3000`
3. **Enter API Key**: Use the internal API key from config.json in frontend settings
4. **Test Connection**: Use the "Test Connection" button to verify setup
5. **Start Chatting**: Begin your conversation with Ventech Assistant

## 🔧 Configuration

### Backend Configuration (`config.json`)
```json
{
  "api": {
    "api_key": "your-internal-api-key-here",
    "openai_api_key": "your-openai-api-key-here",
    "cors_origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
    "max_query_length": 1000,
    "rate_limit_enabled": false
  },
  "models": {
    "chat_model": {
      "provider": "openai",
      "model_name": "gpt-4o-mini",
      "temperature": 0.5,
      "streaming": true
    },
    "embedding_model": {
      "provider": "openai",
      "model_name": "text-embedding-ada-002"
    }
  },
  "defaults": {
    "datastore_key": "test",
    "max_citations": 5,
    "relevance_threshold": 0.50
  },
  "logging": {
    "level": "INFO"
  }
}
```

### Configuration Features
- **Centralized Settings**: All configuration in one file
- **API Key Separation**: Internal and OpenAI keys are separate
- **Model Configuration**: Easy model switching and parameter tuning
- **Security**: config.json is in .gitignore for security
- **Environment Agnostic**: No environment variables needed

### Frontend Configuration (`.env`)
```env
REACT_APP_API_URL=http://127.0.0.1:8000
```

## 📚 Usage

### Adding Documents
1. Place documents in `backend/data/`
2. Run document processing:
   ```bash
   cd backend
   python process_documents.py
   ```

### Chat Interface
1. **New Conversation**: Click "New Chat" to start fresh
2. **Message Input**: Type your question and press Enter
3. **Streaming Response**: Watch the AI response appear in real-time
4. **History Management**: All conversations are saved locally
5. **Settings**: Configure API keys and preferences

### API Usage
You can also interact with the backend directly:

```bash
curl -X POST "http://127.0.0.1:8000/ask" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_internal_api_key" \
  -d '{
    "query": "What are the IT policies?",
    "chat_history": []
  }'
```

## 🎯 API Endpoints

### POST `/ask`
Stream chat responses from the RAG system.

**Headers:**
- `X-API-Key`: Your API key
- `Content-Type`: application/json

**Body:**
```json
{
  "query": "Your question here",
  "chat_history": []
}
```

### GET `/config`
Get application configuration for frontend.

### POST `/test-connection`
Test API connection without triggering full RAG pipeline.

**Headers:**
- `X-API-Key`: Your internal API key

### GET `/documents/{file_path:path}`
Serve documents for citation viewing.

**Response:** Server-Sent Events stream

## 🛠️ Development

### Backend Development
```bash
cd backend
source ../rag-venv/bin/activate
python ask.py
```

### Frontend Development
```bash
cd frontend
npm start
```

### Building for Production
```bash
cd frontend
npm run build
```

## 📁 Project Structure

### Backend Structure
```
backend/
├── ask.py                 # Main FastAPI application
├── process_documents.py   # Document processing script
├── config.json           # Centralized configuration (not in git)
├── config.json.example   # Configuration template
├── requirements.txt       # Python dependencies
├── data/                  # Document storage
│   ├── test_hashes.json
│   └── test/
├── chroma_data/          # Vector database storage
└── libs/                 # Custom libraries
    ├── config.py         # Configuration manager
    ├── custom_logger.py  # Logging utilities
    ├── handler.py        # Streaming handler
    └── vectordb.py       # Vector database operations
```

### Frontend Structure
```
frontend/src/
├── components/
│   ├── ChatArea.js        # Main chat interface
│   ├── ChatInput.js       # Message input component
│   ├── Message.js         # Message display component
│   ├── Sidebar.js         # Conversation sidebar
│   └── SettingsModal.js   # Settings configuration
├── utils/
│   ├── api.js             # API communication
│   └── storage.js         # Local storage management
├── App.js                 # Main application
└── index.js               # Entry point
```

## 🔍 Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check if virtual environment is activated
   - Verify all dependencies are installed
   - Ensure config.json exists with correct API keys
   - Check if config.json follows the correct JSON format

2. **Frontend can't connect to backend**
   - Verify backend is running on port 8000
   - Check internal API key configuration in config.json
   - Ensure API key matches between config.json and frontend settings
   - Ensure CORS settings are correct

3. **OpenAI API errors (401 Unauthorized)**
   - Verify OpenAI API key in config.json under `api.openai_api_key`
   - Ensure the OpenAI API key is valid and has sufficient credits
   - Check that the API key has the correct permissions

4. **No documents found**
   - Run `python process_documents.py` to process documents
   - Check if documents are in the `backend/data/` directory
   - Ensure OpenAI API key is properly configured for embeddings

5. **Configuration issues**
   - Verify config.json syntax is valid JSON
   - Check that all required fields are present
   - Use config.json.example as a reference

### Logs
- **Backend logs**: Check console output where `ask.py` is running
- **Frontend logs**: Check browser developer console
- **Network issues**: Check browser network tab for failed requests
- **Configuration logs**: Backend will log configuration loading issues

## 🔒 Security Notes

- **Dual API Key System**: Separate internal and OpenAI API keys for enhanced security
- **Configuration Security**: config.json is in .gitignore to prevent API key exposure
- **Local Storage**: No conversation data is sent to external services beyond OpenAI
- **CORS Configuration**: Configurable CORS settings for different environments
- **API Key Template**: Use config.json.example as a secure template
- Consider additional security measures for production deployment

## 📈 Performance Tips

- **Model Configuration**: Adjust model parameters in config.json for optimal performance
- **Retrieval Settings**: Configure `max_citations` and `relevance_threshold` in config.json
- **Backend**: Adjust `k` parameter in similarity search for retrieval performance
- **Frontend**: Conversations are limited to 50 for optimal performance
- **Documents**: Larger document sets may require indexing optimization
- **Logging**: Adjust log level in config.json based on environment needs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Ensure all prerequisites are met
4. Verify configuration settings

## 🔄 Updates

To update dependencies:

**Backend:**
```bash
cd backend
pip install -r requirements.txt --upgrade
```

**Frontend:**
```bash
cd frontend
npm update
```
