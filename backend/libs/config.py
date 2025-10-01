import json
import os
from typing import Dict, Any
from libs.custom_logger import setup_logger

# Initialize logging
logging = setup_logger()

class ConfigManager:
    """Manages application configuration loaded from config.json"""
    
    def __init__(self, config_path: str = "config.json"):
        self.config_path = config_path
        self._config = None
        self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
                logging.info(f"Configuration loaded from {self.config_path}")
            else:
                logging.warning(f"Configuration file {self.config_path} not found, using defaults")
                self._config = self._get_default_config()
        except Exception as e:
            logging.error(f"Error loading configuration: {e}")
            self._config = self._get_default_config()
        
        return self._config
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default configuration if file is not found"""
        return {
            "app": {
                "name": "QurHealth Assistant",
                "description": "AI-powered healthcare assistant ready to help",
                "welcome_title": "Welcome to QurHealth Assistant",
                "welcome_message": "Ask me anything about healthcare, medical information, or health-related topics.",
                "company": "QurHealth"
            },
            "features": {
                "settings_enabled": True,
                "api_key_required": True,
                "datastore_selection_enabled": False,
                "chat_history_enabled": True,
                "conversation_management_enabled": True,
                "theme_selection_enabled": True
            },
            "defaults": {
                "datastore_key": "test",
                "theme": "light",
                "max_conversations": 50,
                "max_chat_history": 10
            },
            "ui": {
                "sidebar_collapsible": True,
                "show_conversation_timestamps": True,
                "show_message_timestamps": False,
                "auto_scroll": True
            },
            "api": {
                "cors_origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
                "max_query_length": 1000,
                "rate_limit_enabled": False
            }
        }
    
    def get_config(self) -> Dict[str, Any]:
        """Get the current configuration"""
        if self._config is None:
            self.load_config()
        return self._config
    
    def get_section(self, section: str) -> Dict[str, Any]:
        """Get a specific section of the configuration"""
        config = self.get_config()
        return config.get(section, {})
    
    def get_value(self, section: str, key: str, default=None):
        """Get a specific value from the configuration"""
        section_config = self.get_section(section)
        return section_config.get(key, default)
    
    def reload_config(self):
        """Reload configuration from file"""
        self.load_config()
        logging.info("Configuration reloaded")

# Global config manager instance
config_manager = ConfigManager()