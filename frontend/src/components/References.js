import React, { useState } from 'react';
import { ExternalLink, FileText, Eye, Book, ChevronDown, ChevronRight } from 'lucide-react';

const References = ({ citations = [], onViewDocument }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!citations || citations.length === 0) {
    return null;
  }

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

  const handleViewDocument = (citation) => {
    if (onViewDocument) {
      onViewDocument(citation);
    }
  };

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
        type="button"
      >
        <div className="flex items-center space-x-2">
          <Book className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            References ({citations.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      
      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 bg-white dark:bg-gray-900">
          {/* Grid layout: 2-3 references per row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {citations.map((citation, index) => (
              <div
                key={citation.id || index}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-all hover:shadow-sm"
              >
                {/* Reference number and icon */}
                <div className="flex items-center space-x-2 mb-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-xs font-semibold">
                    {index + 1}
                  </span>
                  {getIconForFileType(citation.local_path)}
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {getFileExtension(citation.local_path).toUpperCase()}
                  </div>
                </div>
                
                {/* Title */}
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                  {citation.title}
                </div>
                
                {/* Page info */}
                {citation.page && !citation.local_path?.toLowerCase().endsWith('.csv') && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Page {citation.page}
                  </div>
                )}
                
                {/* Preview content */}
                {citation.content_preview && (
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {citation.content_preview}
                  </div>
                )}
                
                {/* Action buttons */}
                <div className="flex items-center justify-end space-x-2">
                  {citation.source && (
                    <button
                      onClick={() => handleViewDocument(citation)}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
                      title="View document"
                      type="button"
                    >
                      <Eye className="w-3 h-3" />
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
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default References;