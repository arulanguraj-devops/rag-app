import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getBackendVersion } from '../utils/api';
import { getAppVersion } from '../utils/version';

const HelpModal = ({ isOpen, onClose, appConfig }) => {
  const frontendVersion = getAppVersion();
  const [backendInfo, setBackendInfo] = useState({
    version: appConfig?.app?.version || 'Unknown',
    support_email: appConfig?.app?.support_email || 'support@example.com',
    about: appConfig?.app?.about || ''
  });
  useEffect(() => {
    if (isOpen) {
      // Fetch backend version when the modal opens
      getBackendVersion()
        .then(result => {
          if (result.success && result.data) {
            setBackendInfo(prevInfo => ({
              version: result.data.version || prevInfo.version,
              support_email: result.data.support_email || prevInfo.support_email,
              about: result.data.about || prevInfo.about,
              version_mismatch: result.data.version_mismatch || false,
              config_version: result.data.config_version
            }));
          }
        })
        .catch(error => {
          console.error("Failed to fetch backend version:", error);
        });
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  const backendVersion = backendInfo.version;
  const supportEmail = backendInfo.support_email || appConfig?.app?.support_email || 'support@example.com';
  const companyName = appConfig?.app?.company || 'Company';
  const aboutContent = backendInfo.about || appConfig?.app?.about || appConfig?.app?.description || 'AI-powered assistant';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Help &amp; Support</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">About</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {aboutContent}
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Version Information</h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Frontend:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{frontendVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700 dark:text-gray-300">Backend:</span>
                <div className="flex items-center">
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{backendVersion}</span>
                  {backendInfo.version_mismatch && (
                    <div className="ml-2 flex items-center" title="Version mismatch detected between code and config">
                      <span className="text-amber-500 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Mismatch
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {backendInfo.version_mismatch && backendInfo.config_version && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-700 dark:text-gray-300">Config Version:</span>
                  <span className="text-amber-600 dark:text-amber-400">{backendInfo.config_version}</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Need Help?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              If you need any assistance, please contact our support team:
            </p>
            <a 
              href={`mailto:${supportEmail}`} 
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {supportEmail}
            </a>
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;