// Configuration API utilities

// Use the REACT_APP_API_URL from .env file
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
console.log('Config loading from API Base URL:', API_BASE_URL);

export class ConfigError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ConfigError';
    this.status = status;
  }
}

export const fetchAppConfig = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new ConfigError(
        `Failed to fetch configuration: ${response.status}`,
        response.status
      );
    }

    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Configuration fetch error:', error);
    
    // Return default configuration if fetch fails
    return {
      app: {
        name: "QurHealth Assistant",
        description: "AI-powered healthcare assistant ready to help",
        welcome_title: "Welcome to QurHealth Assistant",
        welcome_message: "Ask me anything about healthcare, medical information, or health-related topics. I'm here to help with evidence-based information.",
        company: "QurHealth"
      },
      features: {
        settings_enabled: true,
        api_key_required: true,
        datastore_selection_enabled: false,
        chat_history_enabled: true,
        conversation_management_enabled: true,
        theme_selection_enabled: true
      },
      defaults: {
        datastore_key: "test",
        theme: "light",
        max_conversations: 50,
        max_chat_history: 10
      },
      ui: {
        sidebar_collapsible: true,
        show_conversation_timestamps: true,
        show_message_timestamps: false,
        auto_scroll: true
      }
    };
  }
};