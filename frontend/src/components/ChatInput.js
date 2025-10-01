import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

const ChatInput = ({ onSendMessage, isLoading, disabled }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask QurHealth Assistant anything..."
            className="chat-input"
            disabled={disabled}
            rows="1"
            style={{ maxHeight: '120px', overflow: 'auto' }}
          />
        </div>
        <button
          type="submit"
          disabled={!message.trim() || isLoading || disabled}
          className="send-button flex items-center space-x-2"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
      {disabled && (
        <div className="mt-2 text-sm text-red-600 text-center">
          Please configure your API key in settings to start chatting.
        </div>
      )}
    </div>
  );
};

export default ChatInput;
