import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import HelpModal from './components/HelpModal';
import DocumentViewer from './components/DocumentViewer';
import Header from './components/Header';
import { 
  getConversations, 
  createNewConversation, 
  deleteConversation, 
  getSettings,
  saveConversation,
  initializeStorageProvider
} from './utils/storageProvider';
import { testApiConnection, getUserInfo } from './utils/api';
import { fetchAppConfig } from './utils/config';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [settings, setSettings] = useState({ apiKey: '', theme: 'light' });
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  // Set sidebar collapsed by default (true) regardless of screen size
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [appConfig, setAppConfig] = useState(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load configuration first
        setIsConfigLoading(true);
        const config = await fetchAppConfig();
        setAppConfig(config);
        
        // Fetch user info from ALB authentication
        const userInfoResponse = await getUserInfo();
        let isAlbAuthenticated = false;
        if (userInfoResponse.success && userInfoResponse.data) {
          setUserInfo(userInfoResponse.data);
          isAlbAuthenticated = userInfoResponse.data.authenticated && 
            userInfoResponse.data.auth_method === 'aws_alb_oidc';
        }
        
        // Load settings with config defaults
        const savedSettings = getSettings();
        const mergedSettings = {
          apiKey: savedSettings.apiKey || '',
          theme: savedSettings.theme || config.defaults.theme
        };
        setSettings(mergedSettings);
        
        console.log('User info from ALB:', userInfoResponse?.data);
        console.log('Centralized history setting:', config.features?.centralized_history);
        
        // Initialize storage provider based on config and authentication status
        // Use the same API_BASE_URL from the environment that the rest of the app uses
        const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
        // Only use config.api.base_url as a fallback if it exists and API_BASE_URL is not set
        const baseUrl = apiBaseUrl || config.api?.base_url || 'http://127.0.0.1:8000';
        console.log('Using API base URL for storage provider:', baseUrl);
        
        const storageInitResult = await initializeStorageProvider(
          config, 
          mergedSettings.apiKey, 
          baseUrl
        );
        
        console.log('Storage provider initialized:', storageInitResult);
        
        // Load conversations from selected storage provider
        const savedConversations = await getConversations();
        setConversations(savedConversations);
        
        // If no conversations exist, create a default one
        if (savedConversations.length === 0) {
          const newConv = createNewConversation(null, null);
          await saveConversation(newConv);
          setConversations([newConv]);
          setCurrentConversation(newConv);
        } else {
          setCurrentConversation(savedConversations[0]);
        }
        
        // Test connection - either with API key or ALB authentication
        try {
          // Try with API key first if available
          if (mergedSettings.apiKey) {
            const result = await testApiConnection(mergedSettings.apiKey);
            setIsApiKeyValid(result.success);
          } 
          // If ALB authenticated, test connection without API key
          else if (isAlbAuthenticated) {
            const result = await testApiConnection();
            setIsApiKeyValid(result.success);
          }
        } catch (error) {
          setIsApiKeyValid(false);
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

  // Auto-open settings if no API key is configured, no ALB auth is available, and settings are enabled
  useEffect(() => {
    if (appConfig && !settings.apiKey && !userInfo?.authenticated && conversations.length > 0 && appConfig.features.settings_enabled) {
      setIsSettingsOpen(true);
    }
  }, [settings.apiKey, conversations.length, appConfig, userInfo]);

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

  const handleNewConversation = async () => {
    const newConv = createNewConversation(null, null);
    
    try {
      await saveConversation(newConv);
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversation(newConv);
      
      // Close sidebar on mobile after creating new conversation
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    } catch (error) {
      console.error('Error saving new conversation:', error);
      alert('Failed to create new conversation. Please try again.');
    }
  };

  const handleSelectConversation = (conversation) => {
    setCurrentConversation(conversation);
    
    // Close sidebar on mobile after selecting conversation
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    try {
      await deleteConversation(conversationId);
      const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
      setConversations(updatedConversations);
      
      // If we deleted the current conversation, select another one or create new
      if (currentConversation?.id === conversationId) {
        if (updatedConversations.length > 0) {
          setCurrentConversation(updatedConversations[0]);
        } else {
          await handleNewConversation();
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    }
  };

  const handleUpdateConversation = async (updatedConversation) => {
    try {
      console.log('Updating conversation in App.js:', updatedConversation);
      
      // First update UI state to ensure immediate feedback
      setConversations(prev => {
        const updated = prev.map(conv => 
          conv.id === updatedConversation.id ? updatedConversation : conv
        );
        
        // If conversation wasn't found, add it to the beginning
        if (!prev.find(conv => conv.id === updatedConversation.id)) {
          return [updatedConversation, ...prev];
        }
        
        return updated;
      });
      
      // Update current conversation reference
      setCurrentConversation(updatedConversation);
      
      // Then save to storage (after UI is updated)
      await saveConversation(updatedConversation);
    } catch (error) {
      console.error('Error updating conversation:', error);
      // UI is already updated, even if storage fails
    }
  };

  const handleSettingsUpdate = async (newSettings) => {
    setSettings(newSettings);
    
    // Test the new API key
    if (newSettings.apiKey) {
      try {
        const result = await testApiConnection(newSettings.apiKey);
        setIsApiKeyValid(result.success);
        
        // If API key is valid and we have app config, reinitialize storage provider
        if (result.success && appConfig) {
          const baseUrl = appConfig.api?.base_url || 'http://localhost:8000';
          await initializeStorageProvider(appConfig, newSettings.apiKey, baseUrl);
          
          // Reload conversations after storage provider change
          const savedConversations = await getConversations();
          setConversations(savedConversations);
          
          if (savedConversations.length > 0) {
            setCurrentConversation(savedConversations[0]);
          } else {
            const newConv = createNewConversation();
            await saveConversation(newConv);
            setConversations([newConv]);
            setCurrentConversation(newConv);
          }
        }
      } catch (error) {
        console.error('Error testing connection:', error);
        setIsApiKeyValid(false);
      }
    } else {
      setIsApiKeyValid(false);
    }
  };

    const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Handle citation clicks from messages
  const handleCitationClick = (documentData) => {
    console.log('App received citation click:', documentData);
    setSelectedDocument(documentData);
  };

  // Close document viewer
  const handleCloseDocument = () => {
    // Clean up blob URL if it exists to prevent memory leaks
    if (selectedDocument?.isBlob && selectedDocument?.viewerUrl) {
      console.log('Cleaning up blob URL:', selectedDocument.viewerUrl);
      URL.revokeObjectURL(selectedDocument.viewerUrl);
    }
    setSelectedDocument(null);
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
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      {/* Top Header */}
      <Header
        appConfig={appConfig}
        userInfo={userInfo}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
      />
      
      {/* Main Content Area with Sidebar and Chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {appConfig.ui.sidebar_collapsible && (
          <Sidebar
            conversations={conversations}
            currentConversation={currentConversation}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            onOpenSettings={() => appConfig.features.settings_enabled && setIsSettingsOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapsed={handleToggleSidebar}
            appConfig={appConfig}
            userInfo={userInfo}
          />
        )}
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatArea
            conversation={currentConversation}
            onUpdateConversation={handleUpdateConversation}
            apiKey={settings.apiKey}
            isApiKeyValid={isApiKeyValid}
            appConfig={appConfig}
            onCitationClick={handleCitationClick}
            userInfo={userInfo}
          />
        </div>
        
        {/* Right Document Viewer Sidebar */}
        {selectedDocument && (
          <DocumentViewer
            document={selectedDocument}
            onClose={handleCloseDocument}
          />
        )}
      </div>
      
      {appConfig.features.settings_enabled && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSettingsUpdate={handleSettingsUpdate}
          appConfig={appConfig}
        />
      )}
      
      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        appConfig={appConfig}
      />
    </div>
  );
}

export default App;
