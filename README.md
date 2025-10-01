# QurHealth RAG Application

A complete RAG (Retrieval-Augmented Generation) application consisting of a FastAPI backend and a modern React frontend for healthcare-focused AI assistance.

## 🏗️ Architecture

```
rag-app/
├── backend/           # FastAPI backend with RAG implementation
│   ├── ask.py        # Main API endpoint
│   ├── process_documents.py
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
- 📄 **Document Processing**: Support for various document formats
- 🔄 **Streaming Responses**: Real-time response streaming via SSE
- 🔐 **API Security**: API key authentication
- 📊 **Logging**: Comprehensive logging system

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

# Create environment file
cp .env.example .env
# Edit .env with your API keys

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

1. **Open the application**: Navigate to `http://localhost:3000`
2. **Configure API Key**: Click "Settings" and enter your API key
3. **Test Connection**: Use the "Test Connection" button to verify setup
4. **Start Chatting**: Begin your conversation with QurHealth Assistant

## 🔧 Configuration

### Backend Configuration (`.env`)
```env
API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

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
  -H "X-API-Key: your_api_key" \
  -d '{
    "query": "What is QurHealth?",
    "datastore_key": "qurhealth",
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
  "datastore_key": "qurhealth",
  "chat_history": []
}
```

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
├── requirements.txt       # Python dependencies
├── data/                  # Document storage
│   ├── test_hashes.json
│   └── test/
└── libs/                  # Custom libraries
    ├── custom_logger.py
    ├── handler.py
    └── vectordb.py
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
   - Ensure .env file exists with correct API keys

2. **Frontend can't connect to backend**
   - Verify backend is running on port 8000
   - Check API key configuration
   - Ensure CORS settings are correct

3. **No documents found**
   - Run `python process_documents.py` to process documents
   - Check if documents are in the `backend/data/` directory

4. **API key issues**
   - Verify API key in backend .env file
   - Test API key in frontend settings
   - Ensure API key has proper permissions

### Logs
- **Backend logs**: Check console output where `ask.py` is running
- **Frontend logs**: Check browser developer console
- **Network issues**: Check browser network tab for failed requests

## 🔒 Security Notes

- API keys are stored locally and transmitted securely
- No conversation data is sent to external services
- CORS is configured for local development
- Consider additional security measures for production deployment

## 📈 Performance Tips

- **Backend**: Adjust `k` parameter in similarity search for retrieval performance
- **Frontend**: Conversations are limited to 50 for optimal performance
- **Documents**: Larger document sets may require indexing optimization

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
