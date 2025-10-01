# QurHealth Chat Frontend

A modern React-based chat interface for the QurHealth RAG (Retrieval-Augmented Generation) API. This frontend provides a sleek, responsive chat experience with local conversation history storage.

## Features

- 🤖 **Real-time Chat**: Stream responses from the QurHealth AI assistant
- 💾 **Local Storage**: Conversation history saved locally in your browser
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- 🎨 **Modern UI**: Clean, intuitive interface built with Tailwind CSS
- ⚙️ **Configurable**: Easy API key and datastore configuration
- 📝 **Markdown Support**: Rich text rendering for AI responses
- 🔒 **Secure**: API key stored locally and transmitted securely

## Prerequisites

- Node.js 16 or higher
- npm or yarn
- QurHealth RAG backend running on `http://127.0.0.1:8000`

## Installation

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Configuration

### Backend API
Make sure your backend is running on `http://127.0.0.1:8000`. If your backend is running on a different port or host, update the `REACT_APP_API_URL` in the `.env` file.

### API Key Setup
1. Click the **Settings** button in the sidebar
2. Enter your API key (the one configured in your backend's `.env` file)
3. Optionally configure the datastore key (default: "qurhealth")
4. Test the connection to ensure everything is working
5. Save your settings

## Usage

### Starting a Conversation
1. Click **"New Chat"** to create a new conversation
2. Type your question in the chat input
3. Press Enter or click Send to submit
4. Watch the AI response stream in real-time

### Managing Conversations
- **View History**: All conversations are listed in the sidebar
- **Switch Conversations**: Click any conversation to switch to it
- **Delete Conversations**: Hover over a conversation and click the trash icon
- **Auto-naming**: Conversations are automatically named based on the first message

### Features in Detail

#### Real-time Streaming
The chat uses Server-Sent Events (SSE) to stream responses from the backend, providing a natural conversational experience.

#### Local Storage
- Conversations are stored in your browser's localStorage
- History persists between sessions
- No data is sent to external servers
- Maximum of 50 conversations stored (oldest automatically removed)

#### Responsive Design
- **Desktop**: Full sidebar with conversation list
- **Tablet/Mobile**: Collapsible sidebar with overlay
- **Touch-friendly**: Large touch targets for mobile interaction

## Architecture

### Component Structure
```
src/
├── components/
│   ├── ChatArea.js      # Main chat interface
│   ├── ChatInput.js     # Message input component
│   ├── Message.js       # Individual message display
│   ├── Sidebar.js       # Conversation sidebar
│   └── SettingsModal.js # Configuration modal
├── utils/
│   ├── api.js           # API communication utilities
│   └── storage.js       # Local storage management
├── App.js               # Main application component
└── index.js             # Application entry point
```

### Data Flow
1. User types message in `ChatInput`
2. `ChatArea` sends message to backend via `api.js`
3. Response streams back and updates the UI
4. Conversation saved to localStorage via `storage.js`
5. Sidebar updates with latest conversation info

## Customization

### Styling
The application uses Tailwind CSS for styling. You can customize:
- Colors in `tailwind.config.js`
- Component styles in `src/index.css`
- Individual component styling in respective files

### API Configuration
Update the backend URL in `.env`:
```env
REACT_APP_API_URL=http://your-backend-url:port
```

## Troubleshooting

### Common Issues

1. **Cannot connect to backend**
   - Ensure backend is running on `http://127.0.0.1:8000`
   - Check API key configuration
   - Verify CORS settings in backend

2. **API key invalid**
   - Verify the API key matches your backend configuration
   - Test connection in Settings modal

3. **Conversations not saving**
   - Check browser localStorage availability
   - Ensure sufficient storage space

4. **Streaming not working**
   - Verify backend supports Server-Sent Events
   - Check network connectivity
   - Look for CORS issues

### Development

To run in development mode:
```bash
npm start
```

To build for production:
```bash
npm run build
```

To run tests:
```bash
npm test
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security Notes

- API keys are stored in localStorage (not sessionStorage)
- No data is transmitted to third-party services
- All communication with backend uses HTTPS in production
- Consider implementing additional security measures for production use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
