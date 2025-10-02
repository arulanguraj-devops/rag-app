import React from 'react';
import { Menu } from 'lucide-react';

const Header = ({ 
  appConfig, 
  userInfo, 
  isSidebarCollapsed, 
  onToggleSidebar 
}) => {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
      {/* Left side: Logo and Company Name */}
      <div className="flex items-center space-x-3">
        {/* Menu Toggle - visible on both mobile and desktop */}
        <button 
          onClick={() => onToggleSidebar(!isSidebarCollapsed)}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Menu size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
        
        {/* Logo */}
        {appConfig?.app?.company_logo_url && (
          <img 
            src={appConfig.app.company_logo_url} 
            alt="Company Logo" 
            className="w-8 h-8 object-contain"
            onError={(e) => {e.target.style.display = 'none'}}
          />
        )}
        
        {/* Company Name */}
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {appConfig?.app?.company || 'QurHealth'}
        </h1>
      </div>
      
      {/* Right side: User Info */}
      <div>
        {userInfo && (
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
            {userInfo.username || 'User'}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;