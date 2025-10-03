/**
 * Add message to conversation function for storageProvider
 * This allows us to update both local and server storage when a message is added
 */

import { getConversation, saveConversation } from './storageProvider';

export const addMessageToConversation = async (conversationId, message) => {
  try {
    console.log(`Adding message to conversation ${conversationId}:`, message);
    
    // Get the conversation
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      console.error(`Conversation ${conversationId} not found`);
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Add the message
    if (!conversation.messages) {
      conversation.messages = [];
    }
    
    // Create a full copy of the message to avoid reference issues
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    // Add the message to the conversation
    conversation.messages.push(messageWithTimestamp);
    
    // Update the conversation timestamp
    conversation.updatedAt = new Date().toISOString();
    
    // Auto-generate title from first user message
    if (conversation.messages.length === 1 && message.type === 'user') {
      const title = message.content.length > 50 
        ? message.content.substring(0, 50) + '...' 
        : message.content;
      conversation.title = title;
    }
    
    console.log(`Saving conversation with ${conversation.messages.length} messages`);
    
    // Save the conversation
    const success = await saveConversation(conversation);
    
    if (success) {
      return conversation;
    } else {
      console.error(`Failed to save conversation ${conversationId}`);
      throw new Error(`Failed to save conversation ${conversationId}`);
    }
  } catch (error) {
    console.error('Error adding message to conversation:', error);
    throw error; // Rethrow to allow proper error handling
  }
};