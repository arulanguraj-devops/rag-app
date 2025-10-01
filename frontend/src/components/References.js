import React, { useState } from 'react';
import { ExternalLink, FileText, Eye, X, Download, Book } from 'lucide-react';

const References = ({ citations = [] }) => {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  if (!citations || citations.length === 0) {
    return null;
  }

  const handleViewDocument = (citation) => {
    if (citation.source) {
      setSelectedDocument(citation);
      setIsViewerOpen(true);
    }
  };

  const closeViewer = () => {
    setIsViewerOpen(false);
    setSelectedDocument(null);
  };

  const getFileExtension = (source) => {
    if (!source) return 'unknown';
    return source.split('.').pop()?.toLowerCase() || 'unknown';
  };

  const getIconForFileType = (source) => {
    const ext = getFileExtension(source);
    switch (ext) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'txt':
        return <FileText className="w-4 h-4 text-gray-500" />;
      case 'csv':
        return <Book className="w-4 h-4 text-green-500" />;
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  const getViewerUrl = (source) => {
    if (!source) return null;
    const ext = getFileExtension(source);
    
    if (ext === 'pdf') {
      return `${source}#toolbar=1`;
    } else if (['txt', 'csv', 'md'].includes(ext)) {
      return source;
    }
    return source;
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
        <Book className="w-4 h-4 mr-2" />
        References
      </h4>
      
      <div className="space-y-2">
        {citations.map((citation, index) => (
          <div
            key={citation.id || index}
            className="flex items-start justify-between p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
          >
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-xs font-semibold">
                {index + 1}
              </span>
              
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {getIconForFileType(citation.local_path)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {citation.title}
                  </div>
                  {/* Only show page number for non-CSV files */}
                  {citation.page && !citation.local_path?.toLowerCase().endsWith('.csv') && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Page {citation.page}
                    </div>
                  )}
                  {citation.content_preview && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                      {citation.content_preview}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 ml-3">
              {citation.source && (
                <button
                  onClick={() => handleViewDocument(citation)}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
                  title="View document"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              
              {citation.source && (
                <a
                  href={citation.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Document Viewer Modal */}
      {isViewerOpen && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full h-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                {getIconForFileType(selectedDocument.local_path)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedDocument.title}
                  </h3>
                  {/* Only show page number for non-CSV files */}
                  {selectedDocument.page && !selectedDocument.local_path?.toLowerCase().endsWith('.csv') && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Page {selectedDocument.page}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={selectedDocument.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={closeViewer}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <iframe
                src={getViewerUrl(selectedDocument.source)}
                className="w-full h-full border-0"
                title={selectedDocument.title}
                sandbox="allow-same-origin allow-scripts allow-downloads"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default References;