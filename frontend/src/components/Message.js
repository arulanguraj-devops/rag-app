import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Message = ({ message, isTyping = false }) => {
  const isUser = message.type === 'user';
  
  if (isTyping) {
    return (
      <div className="flex items-start space-x-3 animate-fade-in">
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-semibold">
          AI
        </div>
        <div className="message-bubble bot-message">
          <div className="typing-indicator">
            <div className="typing-dot" style={{ animationDelay: '0ms' }}></div>
            <div className="typing-dot" style={{ animationDelay: '150ms' }}></div>
            <div className="typing-dot" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start space-x-3 animate-fade-in ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
        isUser ? 'bg-gray-600' : 'bg-primary-500'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`message-bubble ${isUser ? 'user-message' : 'bot-message'}`}>
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="markdown-content text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.timestamp && (
          <div className={`text-xs mt-2 opacity-70 ${isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
