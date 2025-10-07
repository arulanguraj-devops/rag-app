// API utilities for communicating with the RAG backend

// Use the REACT_APP_API_URL from .env file
// If not available, default to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
console.log('API Base URL:', API_BASE_URL);

// Function to get credentials to include with every request
const getCredentials = () => {
  return {
    credentials: 'include', // Include credentials for CORS requests (cookies)
  };
};

// Fetch with timeout to handle unresponsive API endpoints
export const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      ...getCredentials()
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
};

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

export const streamChatResponse = async (query, chat_history, apiKey, onMessage, onComplete, onError, onCitations = () => {}, onTitle = () => {}) => {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Only add API key if provided (for backward compatibility)
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/ask`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        query,
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
              
              // Handle different types of data
              if (data.type === 'token' && data.data) {
                onMessage(data.data);
              } else if (data.type === 'citations' && data.data) {
                console.log('Received citations from backend:', data.data);
                onCitations(data.data);
              } else if (data.type === 'title' && data.data) {
                console.log('Received title from backend:', data.data);
                onTitle(data.data);
              } else if (data.type === 'correction' && data.data) {
                console.log('Received corrected response from backend');
                // Signal to replace the current response with the corrected one
                onMessage('\n\n--- Response corrected to remove invalid citations ---\n\n' + data.data, true);
              } else if (data.data) {
                // Backward compatibility for old format
                onMessage(data.data);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, 'Line:', line);
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

export const testApiConnection = async (apiKey) => {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Only add API key if provided (for backward compatibility)
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    
    // Try to use the /health endpoint instead of /test-connection 
    // This is more likely to work with ALB auth
    const testEndpoint = '/health';
    console.log(`Testing API connection to ${API_BASE_URL}${testEndpoint}`);
    
    const response = await fetch(`${API_BASE_URL}${testEndpoint}`, {
      method: 'GET',
      headers: headers,
      ...getCredentials()
    });

    console.log(`API test response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('API test data:', data);
      
      // Try to determine if we're using ALB auth or API key
      const userInfoResponse = await getUserInfo();
      const isAlbAuth = userInfoResponse?.data?.auth_method === 'aws_alb_oidc';
      
      return {
        success: true,
        status: response.status,
        message: data.message || 'Connection successful',
        auth_method: isAlbAuth ? 'aws_alb_oidc' : 'api_key'
      };
    } else {
      console.error(`API test failed: HTTP ${response.status}`);
      return {
        success: false,
        status: response.status,
        message: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    console.error('API test error:', error);
    return {
      success: false,
      status: null,
      message: error.message
    };
  }
};

export const getUserInfo = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/user-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      ...getCredentials()
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        data
      };
    } else {
      return {
        success: false,
        status: response.status,
        message: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      status: null,
      message: error.message
    };
  }
};

// Function to get backend version information
export const getBackendVersion = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/version`);
    
    if (response.ok) {
      return {
        success: true,
        data: await response.json()
      };
    } else {
      return {
        success: false,
        status: response.status,
        message: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      status: null,
      message: error.message
    };
  }
};
