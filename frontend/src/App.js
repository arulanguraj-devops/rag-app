import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import { 
  getConversations, 
  createNewConversation, 
  deleteConversation, 
  getSettings,
  saveConversation 
} from './utils/storage';
import { testApiConnection } from './utils/api';
import { fetchAppConfig } from './utils/config';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ apiKey: '', datastore_key: 'test', theme: 'light' });
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [appConfig, setAppConfig] = useState(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load configuration first
        setIsConfigLoading(true);
        const config = await fetchAppConfig();
        setAppConfig(config);
        
        // Load settings with config defaults
        const savedSettings = getSettings();
        const mergedSettings = {
          apiKey: savedSettings.apiKey || '',
          datastore_key: savedSettings.datastore_key || config.defaults.datastore_key,
          theme: savedSettings.theme || config.defaults.theme
        };
        setSettings(mergedSettings);
        
        const savedConversations = getConversations();
        setConversations(savedConversations);
        
        // If no conversations exist, create a default one
        if (savedConversations.length === 0) {
          const newConv = createNewConversation(null, mergedSettings.datastore_key);
          saveConversation(newConv);
          setConversations([newConv]);
          setCurrentConversation(newConv);
        } else {
          setCurrentConversation(savedConversations[0]);
        }
        
        // Test API key if it exists
        if (mergedSettings.apiKey) {
          try {
            const result = await testApiConnection(mergedSettings.apiKey, mergedSettings.datastore_key);
            setIsApiKeyValid(result.success);
          } catch (error) {
            setIsApiKeyValid(false);
          }
        }
      } catch (error) {
        console.error('Error loading application data:', error);
      } finally {
        setIsConfigLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-open settings if no API key is configured and settings are enabled
  useEffect(() => {
    if (appConfig && !settings.apiKey && conversations.length > 0 && appConfig.features.settings_enabled) {
      setIsSettingsOpen(true);
    }
  }, [settings.apiKey, conversations.length, appConfig]);

  // Apply theme when settings change
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (settings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // Update favicon when app config loads
  useEffect(() => {
    if (appConfig?.app?.chatbot_logo_url) {
      const favicon = document.querySelector('link[rel="icon"]') || document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = appConfig.app.chatbot_logo_url;
      
      // If the link doesn't exist in the document, add it
      if (!document.querySelector('link[rel="icon"]')) {
        document.head.appendChild(favicon);
      }
      
      // Also update the title if available
      if (appConfig.app.name) {
        document.title = appConfig.app.name;
      }
    }
  }, [appConfig]);

  const handleNewConversation = () => {
    const datastoreKey = settings.datastore_key || appConfig?.defaults?.datastore_key || 'test';
    const newConv = createNewConversation(null, datastoreKey);
    saveConversation(newConv);
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversation(newConv);
    
    // Close sidebar on mobile after creating new conversation
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }
  };

  const handleSelectConversation = (conversation) => {
    setCurrentConversation(conversation);
    
    // Close sidebar on mobile after selecting conversation
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }
  };

  const handleDeleteConversation = (conversationId) => {
    deleteConversation(conversationId);
    const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
    setConversations(updatedConversations);
    
    // If we deleted the current conversation, select another one or create new
    if (currentConversation?.id === conversationId) {
      if (updatedConversations.length > 0) {
        setCurrentConversation(updatedConversations[0]);
      } else {
        handleNewConversation();
      }
    }
  };

  const handleUpdateConversation = (updatedConversation) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
    setCurrentConversation(updatedConversation);
  };

  const handleSettingsUpdate = async (newSettings) => {
    setSettings(newSettings);
    
    // Test the new API key
    if (newSettings.apiKey) {
      try {
        const result = await testApiConnection(newSettings.apiKey, newSettings.datastore_key);
        setIsApiKeyValid(result.success);
      } catch (error) {
        setIsApiKeyValid(false);
      }
    } else {
      setIsApiKeyValid(false);
    }
  };

  const handleToggleSidebar = (collapsed) => {
    setIsSidebarCollapsed(collapsed);
  };

  // Show loading screen while configuration is loading
  if (isConfigLoading || !appConfig) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      {appConfig.ui.sidebar_collapsible && (
        <Sidebar
          conversations={conversations}
          currentConversation={currentConversation}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onOpenSettings={() => appConfig.features.settings_enabled && setIsSettingsOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={handleToggleSidebar}
          appConfig={appConfig}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea
          conversation={currentConversation}
          onUpdateConversation={handleUpdateConversation}
          apiKey={settings.apiKey}
          isApiKeyValid={isApiKeyValid}
          datastoreKey={settings.datastore_key}
          appConfig={appConfig}
        />
      </div>
      
      {appConfig.features.settings_enabled && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSettingsUpdate={handleSettingsUpdate}
          appConfig={appConfig}
        />
      )}
    </div>
  );
}

export default App;
