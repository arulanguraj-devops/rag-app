import React, { useState, useEffect, useRef } from 'react';
import Message from './Message';
import ChatInput from './ChatInput';
import { streamChatResponse, APIError } from '../utils/api';
import { addMessageToConversation } from '../utils/storage';
import { AlertCircle } from 'lucide-react';

const ChatArea = ({ 
  conversation, 
  onUpdateConversation, 
  apiKey, 
  isApiKeyValid,
  datastoreKey,
  appConfig,
  onCitationClick 
}) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentCitations, setCurrentCitations] = useState([]);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation?.messages) {
      console.log('Loading messages:', conversation.messages.map(m => ({ 
        id: m.id, 
        type: m.type, 
        citationsCount: m.citations ? m.citations.length : 0 
      })));
      setMessages(conversation.messages);
      setError(null);
    } else {
      setMessages([]);
    }
  }, [conversation?.id, conversation?.messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (appConfig?.ui?.auto_scroll !== false) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, currentResponse, appConfig]);

  const handleSendMessage = async (messageText) => {
    if (!apiKey || !isApiKeyValid || !conversation) {
      setError('Please configure a valid API key first.');
      return;
    }

    setError(null);
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    // Add user message immediately
    const updatedConversation = addMessageToConversation(conversation.id, userMessage);
    if (updatedConversation) {
      setMessages(updatedConversation.messages);
      onUpdateConversation(updatedConversation);
    }

    setIsLoading(true);
    setIsTyping(true);
    setCurrentResponse('');
    setCurrentCitations([]);

    // Prepare chat history for API (configurable length)
    const maxChatHistory = appConfig?.defaults?.max_chat_history || 10;
    const chatHistory = messages.slice(-maxChatHistory).map(msg => ({
      user: msg.type === 'user' ? msg.content : '',
      bot: msg.type === 'bot' ? msg.content : ''
    })).filter(item => item.user || item.bot);

    let botResponseContent = '';
    let collectedCitations = [];

    try {
      await streamChatResponse(
        messageText,
        datastoreKey || appConfig?.defaults?.datastore_key || 'test',
        chatHistory,
        apiKey,
        // onMessage
        (chunk) => {
          botResponseContent += chunk;
          setCurrentResponse(botResponseContent);
        },
        // onComplete
        () => {
          setIsTyping(false);
          setIsLoading(false);
          
          if (botResponseContent.trim()) {
            const botMessage = {
              id: Date.now() + 1,
              type: 'bot',
              content: botResponseContent.trim(),
              citations: collectedCitations,
              timestamp: new Date().toISOString()
            };

            console.log('Saving bot message with citations:', botMessage);

            const finalConversation = addMessageToConversation(conversation.id, botMessage);
            if (finalConversation) {
              setMessages(finalConversation.messages);
              onUpdateConversation(finalConversation);
            }
          }
          
          // Clear temporary state
          setCurrentResponse('');
          setCurrentCitations([]);
        },
        // onError
        (error) => {
          setIsTyping(false);
          setIsLoading(false);
          setCurrentResponse('');
          setCurrentCitations([]);
          
          let errorMessage = 'An unexpected error occurred. Please try again.';
          
          if (error instanceof APIError) {
            if (error.status === 403) {
              errorMessage = 'Invalid API key. Please check your settings.';
            } else if (error.status === 429) {
              errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
            } else if (error.status >= 500) {
              errorMessage = 'Server error. Please try again later.';
            }
          }
          
          setError(errorMessage);
          
          setTimeout(() => {
            setError(null);
          }, 5000);
        },
        // onCitations
        (citations) => {
          console.log('Received citations:', citations);
          collectedCitations = citations;
          setCurrentCitations(citations);
        }
      );
    } catch (error) {
      setIsTyping(false);
      setIsLoading(false);
      setCurrentResponse('');
      setCurrentCitations([]);
      setError('Failed to send message. Please try again.');
      console.error('Chat error:', error);
    }
  };

  const displayMessages = [...messages];
  
  // Add typing indicator with current response
  if (isTyping) {
    if (currentResponse) {
      displayMessages.push({
        id: 'typing',
        type: 'bot',
        content: currentResponse,
        citations: currentCitations, // Include current citations in typing indicator
        timestamp: new Date().toISOString()
      });
    } else {
      displayMessages.push({ id: 'typing', type: 'typing' });
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
          {conversation?.title || appConfig?.app?.name || 'QurHealth Assistant'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {appConfig?.app?.description || 'AI-powered healthcare assistant ready to help'}
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {displayMessages.length === 0 && !isTyping && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              {appConfig?.app?.chatbot_logo_url ? (
                <img 
                  src={appConfig.app.chatbot_logo_url} 
                  alt="Chatbot Logo" 
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = '<span class="text-2xl">🤖</span>';
                  }}
                />
              ) : (
                <span className="text-2xl">🤖</span>
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {appConfig?.app?.welcome_title || 'Welcome to QurHealth Assistant'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {appConfig?.app?.welcome_message || 'Ask me anything about healthcare, medical information, or health-related topics. I\'m here to help with evidence-based information.'}
            </p>
          </div>
        )}

        {displayMessages.map((message) => (
          <Message 
            key={message.id} 
            message={message} 
            isTyping={message.type === 'typing'}
            onCitationClick={onCitationClick}
          />
        ))}

        {error && (
          <div className="flex items-start space-x-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white">
              <AlertCircle size={16} />
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex-1">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        disabled={!apiKey || !isApiKeyValid || !conversation}
      />
    </div>
  );
};

export default ChatArea;
