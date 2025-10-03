import React, { useState, useEffect } from 'react';
import { X, Save, TestTube, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { getSettings, saveSettings, clearAllConversations, initializeStorageProvider } from '../utils/storageProvider';
import { testApiConnection } from '../utils/api';

const SettingsModal = ({ isOpen, onClose, onSettingsUpdate, appConfig }) => {
  const [settings, setSettings] = useState({
    apiKey: '',
    theme: 'light'
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentSettings = getSettings();
      const mergedSettings = {
        apiKey: currentSettings.apiKey || '',
        theme: currentSettings.theme || appConfig?.defaults?.theme || 'light'
      };
      setSettings(mergedSettings);
      setConnectionStatus(null);
    }
  }, [isOpen, appConfig]);

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear connection status when API key changes
    if (field === 'apiKey') {
      setConnectionStatus(null);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.apiKey.trim()) {
      setConnectionStatus({
        success: false,
        message: 'Please enter an API key first'
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await testApiConnection(settings.apiKey.trim());
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: 'Connection test failed'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const trimmedApiKey = settings.apiKey.trim();
      const success = saveSettings({
        ...settings,
        apiKey: trimmedApiKey
      });
      
      if (success) {
        // Reinitialize storage provider with new API key
        if (appConfig) {
          const baseUrl = appConfig.api?.base_url || 'http://localhost:8000';
          await initializeStorageProvider(appConfig, trimmedApiKey, baseUrl);
        }
        
        onSettingsUpdate(settings);
        onClose();
      } else {
        alert('Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearHistory = () => {
    try {
      const success = clearAllConversations();
      if (success) {
        setShowClearConfirm(false);
        // Force a page reload to reset the conversation state
        window.location.reload();
      } else {
        alert('Failed to clear chat history. Please try again.');
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
      alert('Failed to clear chat history. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key *
            </label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => handleInputChange('apiKey', e.target.value)}
              placeholder="Enter your API key"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Required to authenticate with the QurHealth backend
            </p>
            
            {/* Connection Test */}
            <div className="mt-3 flex items-center space-x-3">
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection || !settings.apiKey.trim()}
                className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTestingConnection ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <TestTube size={16} />
                )}
                <span>Test Connection</span>
              </button>
              
              {connectionStatus && (
                <div className="flex items-center space-x-1">
                  {connectionStatus.success ? (
                    <>
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-sm text-green-600">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} className="text-red-500" />
                      <span className="text-sm text-red-600">Failed</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {connectionStatus && !connectionStatus.success && (
              <p className="text-xs text-red-600 mt-1">
                {connectionStatus.message}
              </p>
            )}
          </div>

          {/* Theme */}
          {appConfig?.features?.theme_selection_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme
              </label>
              <select
                value={settings.theme}
                onChange={(e) => handleInputChange('theme', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Choose your preferred theme
              </p>
            </div>
          )}

          {/* Chat History Management */}
          {appConfig?.features?.chat_history_enabled && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Chat History</h3>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Trash2 size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      Clear All Chat History
                    </h4>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                      This will permanently delete all conversations and messages. This action cannot be undone.
                    </p>
                    
                    {!showClearConfirm ? (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="px-3 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                      >
                        Clear All History
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Are you sure? This cannot be undone.
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={handleClearHistory}
                            className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          >
                            Yes, Clear All
                          </button>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-3 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Backend Information */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Backend Information</h3>
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <p><strong>API URL:</strong> http://127.0.0.1:8000</p>
              <p><strong>Endpoint:</strong> POST /ask</p>
              <p><strong>Protocol:</strong> Server-Sent Events (SSE)</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !settings.apiKey.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
