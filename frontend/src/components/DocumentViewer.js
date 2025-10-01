import React from 'react';

// Document viewer sidebar component (Azure-style)
const DocumentViewer = ({ document, onClose }) => {
  if (!document) return null;

  console.log('=== DOCUMENT VIEWER SIDEBAR DEBUG ===');
  console.log('Document viewer rendering with document:', JSON.stringify(document, null, 2));
  
  const getFileIcon = () => {
    const ext = document.local_path?.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'pdf':
        return '📄';
      case 'txt':
        return '📝';
      case 'csv':
        return '📊';
      default:
        return '📁';
    }
  };

  const renderContent = () => {
    if (document.isTextFile && document.content) {
      console.log('Rendering text content, length:', document.content.length);
      return (
        <div className="w-full h-full overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
          <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 font-mono leading-relaxed">
            {document.content}
          </pre>
        </div>
      );
    } else if (document.isTextFile) {
      console.log('Text file but no content - showing loading...');
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <p className="text-gray-500">Loading content...</p>
        </div>
      );
    } else {
      // Azure approach: Use iframe with blob URL or direct URL
      const viewerUrl = document.viewerUrl || document.source;
      console.log('Rendering document with viewer URL:', viewerUrl);
      
      const fileExtension = document.local_path?.split('.').pop()?.toLowerCase() || '';
      
      // For different file types, use appropriate rendering
      if (fileExtension === 'png' || fileExtension === 'jpg' || fileExtension === 'jpeg') {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <img 
              src={viewerUrl} 
              alt={document.title || 'Document'} 
              className="max-w-full max-h-full object-contain"
              onLoad={() => console.log('Image loaded successfully')}
              onError={(e) => console.error('Image error:', e)}
            />
          </div>
        );
      } else {
        // Default: Use iframe for PDFs and other documents
        return (
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0"
            title={document.title}
            onLoad={() => console.log('Document iframe loaded successfully')}
            onError={(e) => console.error('Document iframe error:', e)}
          />
        );
      }
    }
  };

  return (
    <div className="w-[600px] h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center space-x-3">
          <span className="text-xl">{getFileIcon()}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {document.title}
            </h3>
            {document.page && !document.local_path?.toLowerCase().endsWith('.csv') && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Page {document.page}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <a
            href={document.source}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Open in new tab"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default DocumentViewer;