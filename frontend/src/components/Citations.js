import React, { useState } from 'react';
import React from 'react';
import { FileText, X, Eye } from 'lucide-react';

const CitationItem = ({ citation, onViewDocument }) => {
  const getFileIcon = (source) => {
    const extension = source.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'csv':
        return '📊';
      case 'txt':
        return '📄';
      default:
        return '📁';
    }
  };

  const formatScore = (score) => {
    return `${Math.round((1 - score) * 100)}% relevant`;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getFileIcon(citation.source)}</span>
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {citation.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatScore(citation.relevance_score)}
              {citation.page && ` • Page ${citation.page}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => onViewDocument(citation)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          title="View document"
        >
          <Eye size={16} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-3">
        {citation.content_preview}
      </p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {citation.id}
        </span>
      </div>
    </div>
  );
};

const DocumentViewer = ({ citation, isOpen, onClose }) => {
  if (!isOpen || !citation) return null;

  const getViewerUrl = (source, page) => {
    if (!source) return null;
    
    const extension = source.split('.').pop()?.toLowerCase();
    
    // For PDFs served by our backend, we can add page parameter
    if (extension === 'pdf') {
      return page ? `${source}#page=${page}` : source;
    }
    
    // For other file types served by our backend, return as-is
    // Our backend endpoint will handle the appropriate content-type
    return source;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-3">
            <FileText size={20} className="text-gray-600 dark:text-gray-400" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {citation.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {citation.page && `Page ${citation.page} • `}
                Reference: {citation.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Document Content */}
        <div className="flex-1 p-4">
          <iframe
            src={getViewerUrl(citation.source, citation.page)}
            className="w-full h-full border border-gray-200 dark:border-gray-600 rounded-lg"
            title={`Document: ${citation.title}`}
            onError={(e) => {
              console.error('Failed to load document:', e);
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          
          {/* Fallback content */}
          <div className="hidden w-full h-full flex items-center justify-center border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
            <div className="text-center">
              <FileText size={48} className="text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Cannot preview this document
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This document type cannot be previewed in the browser.
              </p>
            </div>
          </div>
        </div>

        {/* Citation Preview */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Relevant Content Preview:
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded border italic">
            "{citation.content_preview}"
          </p>
        </div>
      </div>
    </div>
  );
};

const Citations = ({ citations, className = "" }) => {
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleViewDocument = (citation) => {
    setSelectedCitation(citation);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setSelectedCitation(null);
  };

  if (!citations || citations.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 mb-3">
          <FileText size={16} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Sources & References ({citations.length})
          </h3>
        </div>
        
        <div className="space-y-3">
          {citations.map((citation) => (
            <CitationItem
              key={citation.id}
              citation={citation}
              onViewDocument={handleViewDocument}
            />
          ))}
        </div>
        
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 italic">
          Click the eye icon to preview documents or the "Open" link to view in a new tab.
        </p>
      </div>

      <DocumentViewer
        citation={selectedCitation}
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
      />
    </>
  );
};

export default Citations;