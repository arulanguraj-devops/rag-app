import React, { useState } from 'react';
import { MessageCircle, Plus, Trash2, Settings, X, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = ({ 
  conversations, 
  currentConversation, 
  onSelectConversation, 
  onNewConversation, 
  onDeleteConversation, 
  onOpenSettings, 
  onOpenHelp,
  isCollapsed, 
  onToggleCollapsed,
  appConfig,
  userInfo
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleDeleteClick = (e, conversationId) => {
    e.stopPropagation();
    setDeleteConfirm(conversationId);
  };

  const handleConfirmDelete = (e, conversationId) => {
    e.stopPropagation();
    onDeleteConversation(conversationId);
    setDeleteConfirm(null);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirm(null);
  };

  const formatDate = (dateString) => {
    // Handle cases where dateString is undefined or invalid
    if (!dateString) {
      return 'Today';
    }
    
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Today';
    }
    
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Mobile Overlay - only on mobile when sidebar is expanded */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => onToggleCollapsed(true)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:relative top-0 bottom-0 left-0 z-40 pt-0 
        ${isCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'} 
        ${isCollapsed ? 'lg:w-16' : 'w-80 lg:w-80'}
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300
      `}>
        {/* Sidebar Title and Controls */}
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {/* When expanded: Show title and collapse button */}
          {!isCollapsed && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  Conversations
                </h2>
              </div>
              <button
                onClick={() => onToggleCollapsed(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          )}
          
          {/* When collapsed: Show expand button */}
          {isCollapsed && (
            <button
              onClick={() => onToggleCollapsed(false)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-6"
              title="Expand sidebar"
            >
              <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
          
          {/* New Chat Button */}
          {isCollapsed ? (
            <button
              onClick={onNewConversation}
              className="w-10 h-10 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center justify-center transition-colors mb-6"
              title="New chat"
            >
              <Plus size={20} />
            </button>
          ) : (
            <button
              onClick={onNewConversation}
              className="w-full mt-3 bg-primary-500 hover:bg-primary-600 text-white px-4 py-3 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus size={18} />
              <span>New Chat</span>
            </button>
          )}
          
          {/* History Button (only shown when collapsed) */}
          {isCollapsed && (
            <button
              onClick={() => onToggleCollapsed(false)} 
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-6"
              title="View conversation history"
            >
              <span className="font-bold text-gray-700 dark:text-gray-300 text-lg">H</span>
            </button>
          )}
        </div>

        {/* Conversations List - Only shown when expanded */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">No conversations yet</p>
                <p className="text-gray-400 text-xs mt-1">Start a new chat to get started</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                  className={`
                    sidebar-button cursor-pointer group relative
                    ${currentConversation?.id === conversation.id ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700 border' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={`
                        text-sm font-medium truncate
                        ${currentConversation?.id === conversation.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100'}
                      `}>
                        {conversation.title}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {conversation.messages.length} messages
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(conversation.updatedAt || conversation.timestamp)}
                        </p>
                      </div>
                    </div>
                    
                    {deleteConfirm === conversation.id ? (
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={(e) => handleConfirmDelete(e, conversation.id)}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Confirm delete"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={handleCancelDelete}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleDeleteClick(e, conversation.id)}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-2"
                        title="Delete conversation"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Settings Button */}
        {appConfig?.features?.settings_enabled && (
          <div className={`p-4 border-t border-gray-200 dark:border-gray-700 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            <button
              onClick={onOpenSettings}
              className={`
                ${isCollapsed 
                  ? 'w-10 h-10 flex items-center justify-center' 
                  : 'w-full flex items-center space-x-2 px-4 py-3 justify-start'
                }
                rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300
              `}
              title="Settings"
            >
              <Settings size={isCollapsed ? 20 : 18} />
              {!isCollapsed && <span>Settings</span>}
            </button>
            
            {/* Help Button */}
            <button
              onClick={onOpenHelp}
              className={`
                ${isCollapsed 
                  ? 'w-10 h-10 flex items-center justify-center mt-3' 
                  : 'w-full flex items-center space-x-2 px-4 py-3 justify-start mt-2'
                }
                rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300
              `}
              title="Help"
            >
              {isCollapsed ? (
                <div className="flex items-center justify-center w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">?</span>
                </div>
              ) : (
                <span className="font-bold text-lg">?</span>
              )}
              {!isCollapsed && <span>Help</span>}
            </button>
          </div>
        )}
      </div>

      {/* We don't need this button anymore since it's in the header now */}
    </>
  );
};

export default Sidebar;
