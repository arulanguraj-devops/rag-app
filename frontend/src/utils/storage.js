// Local storage utilities for chat history management

const STORAGE_KEY = 'qurhealth_chat_history';
const CONVERSATIONS_KEY = 'qurhealth_conversations';

export const generateConversationId = () => {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const saveConversation = (conversation) => {
  try {
    const conversations = getConversations();
    const existingIndex = conversations.findIndex(conv => conv.id === conversation.id);
    
    if (existingIndex !== -1) {
      conversations[existingIndex] = conversation;
    } else {
      conversations.unshift(conversation);
    }
    
    // Keep only the last 50 conversations
    const limitedConversations = conversations.slice(0, 50);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(limitedConversations));
    
    return true;
  } catch (error) {
    console.error('Error saving conversation:', error);
    return false;
  }
};

export const getConversations = () => {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
};

export const getConversation = (conversationId) => {
  try {
    const conversations = getConversations();
    return conversations.find(conv => conv.id === conversationId) || null;
  } catch (error) {
    console.error('Error loading conversation:', error);
    return null;
  }
};

export const deleteConversation = (conversationId) => {
  try {
    const conversations = getConversations();
    const filtered = conversations.filter(conv => conv.id !== conversationId);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }
};

export const clearAllConversations = () => {
  try {
    localStorage.removeItem(CONVERSATIONS_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing conversations:', error);
    return false;
  }
};

export const createNewConversation = (title = null, datastoreKey = 'test') => {
  const now = new Date();
  return {
    id: generateConversationId(),
    title: title || `New Chat ${now.toLocaleDateString()}`,
    messages: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    datastore_key: datastoreKey // configurable datastore
  };
};

export const updateConversationTitle = (conversationId, title) => {
  try {
    const conversations = getConversations();
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = new Date().toISOString();
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating conversation title:', error);
    return false;
  }
};

export const addMessageToConversation = (conversationId, message) => {
  try {
    const conversations = getConversations();
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (conversation) {
      conversation.messages.push({
        ...message,
        timestamp: new Date().toISOString()
      });
      conversation.updatedAt = new Date().toISOString();
      
      // Auto-generate title from first user message
      if (conversation.messages.length === 1 && message.type === 'user') {
        const title = message.content.length > 50 
          ? message.content.substring(0, 50) + '...' 
          : message.content;
        conversation.title = title;
      }
      
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
      return conversation;
    }
    return null;
  } catch (error) {
    console.error('Error adding message to conversation:', error);
    return null;
  }
};

// Settings management
export const getSettings = () => {
  try {
    const stored = localStorage.getItem('qurhealth_settings');
    return stored ? JSON.parse(stored) : {
      apiKey: '',
      datastore_key: 'qurhealth',
      theme: 'light'
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      apiKey: '',
      datastore_key: 'qurhealth',
      theme: 'light'
    };
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem('qurhealth_settings', JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};
