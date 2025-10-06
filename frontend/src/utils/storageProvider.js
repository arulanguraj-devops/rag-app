/**
 * Storage provider abstraction for chat history
 * Provides a unified interface for both local storage and server-based storage
 */

import { fetchWithTimeout } from './api';

// The current storage provider (local or server)
let currentProvider = 'local';

// Storage Provider Interface
class StorageProvider {
  /**
   * Initialize the storage provider
   */
  async init() {
    throw new Error('Not implemented');
  }

  /**
   * Get all conversations
   */
  async getConversations() {
    throw new Error('Not implemented');
  }

  /**
   * Get a specific conversation
   */
  async getConversation(id) {
    throw new Error('Not implemented');
  }

  /**
   * Save a conversation
   */
  async saveConversation(conversation) {
    throw new Error('Not implemented');
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id) {
    throw new Error('Not implemented');
  }

  /**
   * Clear all conversations
   */
  async clearAllConversations() {
    throw new Error('Not implemented');
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(id, title) {
    throw new Error('Not implemented');
  }
}

// Local Storage Provider
class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    this.STORAGE_KEY = 'chat_history';
    this.CONVERSATIONS_KEY = 'conversations';
    this.userId = null;
  }

  async init() {
    // Generate a user ID if not present
    this.userId = localStorage.getItem('user_id') || this.generateUserId();
    localStorage.setItem('user_id', this.userId);
    return this.userId;
  }

  generateUserId() {
    return `local_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getConversations() {
    try {
      const stored = localStorage.getItem(this.CONVERSATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading conversations from local storage:', error);
      return [];
    }
  }

  async getConversation(id) {
    try {
      const conversations = await this.getConversations();
      return conversations.find(conv => conv.id === id) || null;
    } catch (error) {
      console.error('Error loading conversation from local storage:', error);
      return null;
    }
  }

  async saveConversation(conversation) {
    try {
      const conversations = await this.getConversations();
      const existingIndex = conversations.findIndex(conv => conv.id === conversation.id);
      
      if (existingIndex !== -1) {
        conversations[existingIndex] = conversation;
      } else {
        conversations.unshift(conversation);
      }
      
      // Keep only the last 50 conversations
      const limitedConversations = conversations.slice(0, 50);
      localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(limitedConversations));
      
      return true;
    } catch (error) {
      console.error('Error saving conversation to local storage:', error);
      return false;
    }
  }

  async deleteConversation(id) {
    try {
      const conversations = await this.getConversations();
      const filtered = conversations.filter(conv => conv.id !== id);
      localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting conversation from local storage:', error);
      return false;
    }
  }

  async clearAllConversations() {
    try {
      localStorage.removeItem(this.CONVERSATIONS_KEY);
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing conversations from local storage:', error);
      return false;
    }
  }

  async updateConversationTitle(id, title) {
    try {
      const conversations = await this.getConversations();
      const conversation = conversations.find(conv => conv.id === id);
      
      if (conversation) {
        conversation.title = title;
        conversation.updatedAt = new Date().toISOString();
        localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(conversations));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating conversation title in local storage:', error);
      return false;
    }
  }
}

// Server Storage Provider
class ServerStorageProvider extends StorageProvider {
  constructor(apiKey, baseUrl) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.userId = null;
  }

  async init() {
    try {
      // Try to get user ID from local storage
      this.userId = localStorage.getItem('server_user_id');

      // Check if we're using ALB authentication
      let isAlbAuthenticated = false;
      try {
        const { getUserInfo } = await import('./api');
        const userInfoResponse = await getUserInfo();
        if (userInfoResponse.success && userInfoResponse.data?.authenticated && 
            userInfoResponse.data?.auth_method === 'aws_alb_oidc') {
          isAlbAuthenticated = true;
          console.log('Using AWS ALB OIDC authentication');
        }
      } catch (error) {
        console.error('Error checking ALB authentication:', error);
      }

      // Always check with the server to verify centralized history is enabled
      console.log('Checking centralized history with server...');
      const response = await this.fetchFromServer('/user-id', {
        method: 'POST',
        body: JSON.stringify({
          client_user_id: this.userId || null
        })
      });
      
      console.log('Server response for user-id:', response);

      // If centralized history is not enabled, throw an error to fall back to local storage
      if (!response.centralized_history_enabled) {
        throw new Error('Centralized history not enabled on server');
      }

      // If we need authentication but don't have it yet
      if (response.needs_authentication && !isAlbAuthenticated && !this.apiKey) {
        // We'll fall back to local storage until authenticated
        throw new Error('Authentication required for centralized history');
      }

      // If we have a user ID from the server, use it
      if (response.success && response.user_id) {
        this.userId = response.user_id;
        localStorage.setItem('server_user_id', this.userId);
        console.log('Using server-provided user ID:', this.userId);
      } else if (!this.userId) {
        // No user ID provided or available
        throw new Error('No user ID available');
      }

      console.log('Successfully initialized server storage with user ID:', this.userId);
      return this.userId;
    } catch (error) {
      console.error('Error initializing server storage:', error);
      throw error;
    }
  }

  async fetchFromServer(endpoint, options = {}) {
    // Initialize headers with Content-Type
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Only add API key if available
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    // Log the full URL for debugging
    const fullUrl = `${this.baseUrl}${endpoint}`;
    console.log(`Making request to: ${fullUrl}`);
    
    // Make the request with credentials included (important for ALB auth cookies)
    const response = await fetchWithTimeout(fullUrl, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      },
      credentials: 'include', // Important: Include credentials for ALB auth cookies
    });

    // Log detailed debug info for troubleshooting
    console.log(`Server request to ${endpoint}: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Server error (${response.status}): ${errorText}`);
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async getConversations() {
    try {
      if (!this.userId) await this.init();

      const response = await this.fetchFromServer(`/history/conversations?client_user_id=${this.userId}`);
      
      if (response.success && response.conversations) {
        // Transform all conversations from server format to frontend format
        return response.conversations.map(serverConv => {
          // Transform messages for each conversation
          const transformedMessages = (serverConv.messages || []).map(msg => {
            // Determine the correct type based on role
            // Default to 'bot' if role is 'assistant' or anything other than 'user'
            const messageType = msg.role === 'user' ? 'user' : 'bot';
            
            return {
              id: msg.id || String(Date.now()),
              type: messageType,
              content: msg.content,
              timestamp: msg.timestamp,
              // Preserve any citations that might be present
              ...(msg.citations && { citations: msg.citations })
            };
          });

          // Return the formatted conversation
          return {
            id: serverConv.id,
            title: serverConv.title,
            timestamp: serverConv.timestamp,
            updatedAt: serverConv.updated_at || serverConv.timestamp,
            messages: transformedMessages
          };
        });
      } else {
        console.error('Error fetching conversations:', response.error || 'No conversations returned');
        return [];
      }
    } catch (error) {
      console.error('Error loading conversations from server:', error);
      return [];
    }
  }

  async getConversation(id) {
    try {
      if (!this.userId) await this.init();

      const response = await this.fetchFromServer(`/history/conversation/${id}?client_user_id=${this.userId}`);
      
      if (response.success && response.conversation) {
        // Transform the server conversation format back to frontend format
        const serverConv = response.conversation;
        
          // Transform messages from server format to frontend format
        const transformedMessages = serverConv.messages.map(msg => {
          // Determine the correct type based on role
          // Default to 'bot' if role is 'assistant' or anything other than 'user'
          const messageType = msg.role === 'user' ? 'user' : 'bot';
          
          return {
            id: msg.id || String(Date.now()),
            type: messageType,
            content: msg.content,
            timestamp: msg.timestamp,
            // Preserve any citations that might be present
            ...(msg.citations && { citations: msg.citations })
          };
        });        // Format the conversation object to match frontend expectations
        return {
          id: serverConv.id,
          title: serverConv.title,
          timestamp: serverConv.timestamp,
          updatedAt: serverConv.updated_at || serverConv.timestamp,
          messages: transformedMessages
        };
      } else {
        console.error('Error fetching conversation:', response.error || 'No conversation returned');
        return null;
      }
    } catch (error) {
      console.error('Error loading conversation from server:', error);
      return null;
    }
  }

  async saveConversation(conversation) {
    try {
      if (!this.userId) await this.init();

      console.log('Original conversation from frontend:', JSON.stringify(conversation, null, 2));

      // Transform the frontend conversation format to match the backend API expectations
      const transformedMessages = conversation.messages.map(msg => {
        // Convert type to role: 'user' stays 'user', everything else becomes 'assistant'
        const role = msg.type === 'user' ? 'user' : 'assistant';
        
        const transformed = {
          id: msg.id?.toString() || String(Date.now()),
          content: msg.content,
          role: role,
          timestamp: msg.timestamp
        };
        
        // Include citations if they exist
        if (msg.citations && Array.isArray(msg.citations)) {
          transformed.citations = msg.citations;
          console.log(`Preserving ${msg.citations.length} citations for message ${transformed.id}`);
        }
        
        return transformed;
      });

      const formattedConversation = {
        id: conversation.id,
        title: conversation.title,
        timestamp: conversation.timestamp,
        updated_at: conversation.updatedAt || new Date().toISOString(),
        messages: transformedMessages
      };

      console.log('Sending formatted conversation to server:', JSON.stringify({
        conversation: formattedConversation,
        client_user_id: this.userId
      }, null, 2));

      const response = await this.fetchFromServer('/history/conversation', {
        method: 'POST',
        body: JSON.stringify({
          conversation: formattedConversation,
          client_user_id: this.userId
        })
      });
      
      console.log('Server response:', JSON.stringify(response, null, 2));
      return response.success === true;
    } catch (error) {
      console.error('Error saving conversation to server:', error);
      console.error('Error details:', error.message);
      return false;
    }
  }

  async deleteConversation(id) {
    try {
      if (!this.userId) await this.init();

      const response = await this.fetchFromServer(`/history/conversation/${id}?client_user_id=${this.userId}`, {
        method: 'DELETE'
      });
      
      return response.success === true;
    } catch (error) {
      console.error('Error deleting conversation from server:', error);
      return false;
    }
  }

  async clearAllConversations() {
    try {
      if (!this.userId) await this.init();

      const response = await this.fetchFromServer(`/history/conversations?client_user_id=${this.userId}`, {
        method: 'DELETE'
      });
      
      return response.success === true;
    } catch (error) {
      console.error('Error clearing conversations from server:', error);
      return false;
    }
  }

  async updateConversationTitle(id, title) {
    try {
      if (!this.userId) await this.init();
      
      // First get the conversation
      const conversation = await this.getConversation(id);
      
      if (!conversation) {
        return false;
      }
      
      // Update the title
      conversation.title = title;
      conversation.updated_at = new Date().toISOString();
      
      // Save the updated conversation
      return await this.saveConversation(conversation);
    } catch (error) {
      console.error('Error updating conversation title on server:', error);
      return false;
    }
  }
}

// Storage Provider Factory
let storageProvider = null;

export const initializeStorageProvider = async (appConfig, apiKey, baseUrl) => {
  const useCentralizedHistory = appConfig?.features?.centralized_history === true;
  
  // Get the user info to check if ALB authentication is available
  let isAlbAuthenticated = false;
  try {
    const { getUserInfo } = await import('./api');
    const userInfoResponse = await getUserInfo();
    if (userInfoResponse.success && userInfoResponse.data?.authenticated && 
        userInfoResponse.data?.auth_method === 'aws_alb_oidc') {
      isAlbAuthenticated = true;
    }
  } catch (error) {
    console.error('Error checking ALB authentication:', error);
  }
  
  // If centralized history is enabled and we have either API key OR ALB auth, use server storage
  if (useCentralizedHistory && (apiKey || isAlbAuthenticated)) {
    console.log(`Centralized history enabled with ${apiKey ? 'API key' : 'ALB'} authentication, using server storage`);
    currentProvider = 'server';
    storageProvider = new ServerStorageProvider(apiKey, baseUrl);
  } else if (useCentralizedHistory && !apiKey && !isAlbAuthenticated) {
    console.log('Centralized history enabled but no authentication available, falling back to local storage');
    currentProvider = 'local';
    storageProvider = new LocalStorageProvider();
  } else {
    console.log('Using local storage (centralized history disabled)');
    currentProvider = 'local';
    storageProvider = new LocalStorageProvider();
  }
  
  // Initialize the provider
  try {
    await storageProvider.init();
    console.log(`Initialized ${currentProvider} storage provider`);
    return true;
  } catch (error) {
    console.error(`Failed to initialize ${currentProvider} storage provider:`, error);
    
    // Fall back to local storage on failure
    if (currentProvider === 'server') {
      console.log('Falling back to local storage');
      currentProvider = 'local';
      storageProvider = new LocalStorageProvider();
      await storageProvider.init();
    }
    
    return false;
  }
};

// Function to get current provider
export const getCurrentProvider = () => currentProvider;

// Storage functions
export const saveConversation = async (conversation) => {
  if (!storageProvider) {
    storageProvider = new LocalStorageProvider();
    await storageProvider.init();
  }
  return await storageProvider.saveConversation(conversation);
};

export const getConversations = async () => {
  if (!storageProvider) {
    storageProvider = new LocalStorageProvider();
    await storageProvider.init();
  }
  return await storageProvider.getConversations();
};

export const getConversation = async (id) => {
  if (!storageProvider) {
    storageProvider = new LocalStorageProvider();
    await storageProvider.init();
  }
  return await storageProvider.getConversation(id);
};

export const deleteConversation = async (id) => {
  if (!storageProvider) {
    storageProvider = new LocalStorageProvider();
    await storageProvider.init();
  }
  return await storageProvider.deleteConversation(id);
};

export const clearAllConversations = async () => {
  if (!storageProvider) {
    storageProvider = new LocalStorageProvider();
    await storageProvider.init();
  }
  return await storageProvider.clearAllConversations();
};

export const updateConversationTitle = async (id, title) => {
  if (!storageProvider) {
    storageProvider = new LocalStorageProvider();
    await storageProvider.init();
  }
  return await storageProvider.updateConversationTitle(id, title);
};

export const generateConversationId = () => {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const createNewConversation = (title = null, datastoreKey = null) => {
  return {
    id: generateConversationId(),
    title: title || 'New Conversation',
    timestamp: new Date().toISOString(),
    messages: []
  };
};

export const addMessageToConversation = async (conversationId, message) => {
  try {
    // This is a proxy for the function in chatUtils.js
    // Import dynamically to avoid circular imports
    const { addMessageToConversation: realAddMessageFn } = await import('./chatUtils');
    return await realAddMessageFn(conversationId, message);
  } catch (error) {
    console.error('Error in addMessageToConversation proxy:', error);
    throw error; // Re-throw the error to allow proper handling
  }
};

// Settings storage (kept in local storage regardless of provider)
export const saveSettings = (settings) => {
  try {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

export const getSettings = () => {
  try {
    const settings = localStorage.getItem('app_settings');
    return settings ? JSON.parse(settings) : { apiKey: '', theme: 'light' };
  } catch (error) {
    console.error('Error loading settings:', error);
    return { apiKey: '', theme: 'light' };
  }
};