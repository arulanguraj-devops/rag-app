"""
Version information for the RAG application backend

This file centralizes the version information for the backend.
The version should match what's in config.json.
"""

import os
import json
import logging

# Initialize logging if not already done
try:
    from libs.custom_logger import setup_logger
    logging = setup_logger()
except ImportError:
    logging.basicConfig(level=logging.INFO)

__version__ = "1.0.2"  # Version of the backend

def get_config_version():
    """Get version from config.json"""
    try:
        config_path = os.path.join(os.path.dirname(__file__), "config.json")
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                return config.get("app", {}).get("version")
    except Exception as e:
        logging.error(f"Error reading version from config.json: {e}")
    return None

def get_version_info(config_manager=None):
    """
    Get version information combined with configuration values.
    
    Args:
        config_manager: Optional config manager instance to retrieve app values
        
    Returns:
        Dictionary with version information and app details
    """
    version_info = {
        "version": __version__
    }
    
    # Check if versions match
    config_version = None
    if config_manager:
        config_version = config_manager.get_value("app", "version", None)
        version_info.update({
            "app_name": config_manager.get_value("app", "name", "RAG App"),
            "support_email": config_manager.get_value("app", "support_email", "support@example.com"),
            "about": config_manager.get_value("app", "about", "")
        })
    
    # If config_manager not provided, try to read directly
    if config_version is None:
        config_version = get_config_version()
    
    # Add version mismatch warning if applicable
    if config_version and config_version != __version__:
        version_info["version_mismatch"] = True
        version_info["config_version"] = config_version
        logging.warning(f"Version mismatch: __version__={__version__}, config.json version={config_version}")
    
    return version_info

# Check version mismatch at import time for early warning
config_version = get_config_version()
if config_version and config_version != __version__:
    logging.warning(f"⚠️ Version mismatch detected: Backend code version ({__version__}) does not match config.json version ({config_version})")
    logging.warning("To ensure consistency, please update the version in either __version__.py or config.json")