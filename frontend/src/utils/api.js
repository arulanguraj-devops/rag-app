// API utilities for communicating with the RAG backend

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

export const streamChatResponse = async (query, datastore_key, chat_history, apiKey, onMessage, onComplete, onError) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        query,
        datastore_key,
        chat_history
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the incomplete line in the buffer
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.data) {
                onMessage(data.data);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }
      
      onComplete();
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error('Stream error:', error);
    onError(error);
  }
};

export const testApiConnection = async (apiKey, datastoreKey = 'test') => {
  try {
    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        query: 'test',
        datastore_key: datastoreKey,
        chat_history: []
      })
    });

    return {
      success: response.ok,
      status: response.status,
      message: response.ok ? 'Connection successful' : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      success: false,
      status: null,
      message: error.message
    };
  }
};
