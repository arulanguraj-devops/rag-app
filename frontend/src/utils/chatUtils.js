/**
 * Add message to conversation function for storageProvider
 * This allows us to update both local and server storage when a message is added
 */

import { getConversation, saveConversation } from './storageProvider';

export const addMessageToConversation = async (conversationId, message, options = {}) => {
  try {
    console.log(`Adding message to conversation ${conversationId}:`, message);
    
    const { expectingLLMTitle = false, currentConversation = null } = options;
    
    // Use the current conversation state if provided, otherwise fetch from storage
    let conversation;
    if (currentConversation && currentConversation.id === conversationId) {
      // Use the current conversation state to avoid stale data
      console.log('Using current conversation state with', currentConversation.messages?.length || 0, 'existing messages');
      conversation = { ...currentConversation }; // Create a copy to avoid mutation
    } else {
      // Fallback to fetching from storage
      console.log('Fetching conversation from storage');
      conversation = await getConversation(conversationId);
      
      // If conversation doesn't exist in storage, create a new one with this ID
      if (!conversation) {
        console.warn(`Conversation ${conversationId} not found in storage, creating it`);
        conversation = {
          id: conversationId,
          title: 'New Conversation',
          timestamp: new Date().toISOString(),
          messages: []
        };
      }
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
    // This ensures conversation has a meaningful title from the first message
    // But we'll delay this for first user message to allow LLM-generated title to take precedence
    const isFirstUserMessage = conversation.messages.length === 1 && message.type === 'user';
    const needsTitle = conversation.title === 'New Conversation';
    const isSecondMessage = conversation.messages.length === 2;
    
    if (needsTitle && message.type === 'user' && !isFirstUserMessage && !expectingLLMTitle) {
      // Auto-generate title for subsequent user messages if no LLM title was received
      const title = message.content.length > 50 
        ? message.content.substring(0, 50) + '...' 
        : message.content;
      conversation.title = title;
      console.log('Generated conversation title (fallback):', title);
    } else if (needsTitle && isSecondMessage && message.type === 'bot' && !expectingLLMTitle) {
      // This is the bot response to the first user message
      // If we still don't have a good title, use the original user message
      const userMessage = conversation.messages.find(m => m.type === 'user');
      if (userMessage && conversation.title === 'New Conversation') {
        const title = userMessage.content.length > 50 
          ? userMessage.content.substring(0, 50) + '...' 
          : userMessage.content;
        conversation.title = title;
        console.log('Generated conversation title (delayed fallback):', title);
      }
    } else if (isFirstUserMessage && expectingLLMTitle) {
      console.log('Skipping auto-title generation for first user message - expecting LLM title');
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