import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';
import { renderToStaticMarkup } from 'react-dom/server';
import References from './References';

// Azure-style parseAnswerToHtml function - EXACT implementation from Azure demo
function parseAnswerToHtml(content, citations = [], isStreaming = false, onCitationClicked) {
  const possibleCitations = citations || [];
  const usedCitations = [];

  // Trim any whitespace from the end of the answer
  let parsedAnswer = content.trim();

  // Omit a citation that is still being typed during streaming
  if (isStreaming) {
    let lastIndex = parsedAnswer.length;
    for (let i = parsedAnswer.length - 1; i >= 0; i--) {
      if (parsedAnswer[i] === "]") {
        break;
      } else if (parsedAnswer[i] === "[") {
        lastIndex = i;
        break;
      }
    }
    const truncatedAnswer = parsedAnswer.substring(0, lastIndex);
    parsedAnswer = truncatedAnswer;
  }

  const parts = parsedAnswer.split(/\[([^\]]+)\]/g);

  const fragments = parts.map((part, index) => {
    if (index % 2 === 0) {
      return part;
    } else {
      let citationIndex;
      
      // Check if this is a simple number citation like "1", "2", etc.
      const isNumericCitation = /^\d+$/.test(part);
      
      if (isNumericCitation) {
        // For numeric citations like [1], [2], use the number directly
        citationIndex = parseInt(part);
        const citation = possibleCitations[citationIndex - 1]; // Array is 0-indexed
        
        if (!citation) {
          return `[${part}]`;
        }

        if (usedCitations.indexOf(part) === -1) {
          usedCitations.push(part);
        }

        return renderToStaticMarkup(
          <button 
            type="button"
            className="citation-link" 
            title={citation?.title || part}
            data-citation-index={citationIndex - 1}
            style={{ cursor: 'pointer', textDecoration: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
          >
            <sup>{citationIndex}</sup>
          </button>
        );
      } else {
        // For text-based citations, check if any citation title contains this text
        const isValidCitation = possibleCitations.some(citation => {
          return citation.title && citation.title.includes(part);
        });

        if (!isValidCitation) {
          return `[${part}]`;
        }

        if (usedCitations.indexOf(part) !== -1) {
          citationIndex = usedCitations.indexOf(part) + 1;
        } else {
          usedCitations.push(part);
          citationIndex = usedCitations.length;
        }

        const citation = possibleCitations.find(c => c.title && c.title.includes(part));
        
        return renderToStaticMarkup(
          <button 
            type="button"
            className="citation-link" 
            title={citation?.title || part}
            data-citation-text={part}
            style={{ cursor: 'pointer', textDecoration: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit' }}
          >
            <sup>{citationIndex}</sup>
          </button>
        );
      }
    }
  });

  return {
    answerHtml: fragments.join(""),
    citations: usedCitations
  };
}

const MessageContent = ({ content, citations, onCitationClick }) => {
  const parsedAnswer = useMemo(() => 
    parseAnswerToHtml(content, citations, false, onCitationClick), 
    [content, citations, onCitationClick]
  );
  
  const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);

  // Add click event listener for citations after component mounts
  React.useEffect(() => {
    const handleCitationClick = (e) => {
      const citationButton = e.target.closest('.citation-link');
      if (citationButton && onCitationClick) {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if this is a numeric citation
        const citationIndex = citationButton.getAttribute('data-citation-index');
        if (citationIndex !== null) {
          const citation = citations[parseInt(citationIndex)];
          if (citation) {
            console.log('Numeric citation clicked:', citation);
            onCitationClick(citation);
          }
        } else {
          // Handle text-based citations
          const citationText = citationButton.getAttribute('data-citation-text');
          if (citationText) {
            const citation = citations?.find(c => c.title && c.title.includes(citationText));
            if (citation) {
              console.log('Text citation clicked:', citation);
              onCitationClick(citation);
            }
          }
        }
      }
    };

    document.addEventListener('click', handleCitationClick);
    return () => document.removeEventListener('click', handleCitationClick);
  }, [onCitationClick, citations]);

  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
    >
      {sanitizedAnswerHtml}
    </ReactMarkdown>
  );
};

const Message = ({ message, isTyping = false, onCitationClick }) => {
  const isUser = message.type === 'user';

  // Handle citation clicks
  const handleCitationClick = async (citation) => {
    console.log('=== CITATION CLICK DEBUG (Azure Approach) ===');
    console.log('Full citation object:', JSON.stringify(citation, null, 2));
    console.log('Citation source URL:', citation?.source);
    
    if (!citation?.source) {
      console.error('No source URL for citation:', citation);
      alert('No document source available');
      return;
    }

    try {
      // Azure approach: Fetch the file as blob and create object URL
      console.log('Fetching citation as blob...');
      
      // Get hash from the URL as it may contain #page=N
      // which helps browser PDF renderer jump to correct page N
      const originalHash = citation.source.indexOf("#") ? citation.source.split("#")[1] : "";
      const baseUrl = citation.source.split("#")[0]; // Remove any existing hash
      
      console.log('Base URL:', baseUrl);
      console.log('Original hash:', originalHash);
      
      const response = await fetch(baseUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
        mode: 'cors'
      });
      
      console.log('Fetch response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        ok: response.ok
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Get the file as blob
      const citationBlob = await response.blob();
      console.log('Blob created:', {
        size: citationBlob.size,
        type: citationBlob.type
      });
      
      // Create object URL from blob
      let citationObjectUrl = URL.createObjectURL(citationBlob);
      console.log('Object URL created:', citationObjectUrl);
      
      // Add hash back to the new blob URL for page navigation
      if (originalHash) {
        citationObjectUrl += "#" + originalHash;
        console.log('Object URL with hash:', citationObjectUrl);
      } else if (citation.page) {
        // If no hash but we have page number, add it
        citationObjectUrl += "#page=" + citation.page;
        console.log('Object URL with page:', citationObjectUrl);
      }
      
      // Set the document with the object URL
      const documentData = {
        ...citation,
        viewerUrl: citationObjectUrl,
        isTextFile: false,
        isBlob: true
      };
      
      console.log('Notifying parent component with document data');
      
      // Pass document to parent component for sidebar display
      if (onCitationClick) {
        onCitationClick(documentData);
      }
      
      console.log('Document data passed to parent component');
      
    } catch (error) {
      console.error('=== FETCH ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
      
      alert(`Error loading document: ${error.message}\n\nTrying to open in new tab...`);
      // Fallback: open in new tab
      window.open(citation.source, '_blank', 'noopener,noreferrer');
    }
  };

  // Typing indicator
  if (isTyping) {
    return (
      <div className="flex items-start space-x-3 animate-fade-in">
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-semibold">
          AI
        </div>
        <div className="message-bubble bot-message">
          <div className="typing-indicator">
            <div className="typing-dot" style={{ animationDelay: '0ms' }}></div>
            <div className="typing-dot" style={{ animationDelay: '150ms' }}></div>
            <div className="typing-dot" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`flex items-start space-x-3 animate-fade-in ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
          isUser ? 'bg-gray-600' : 'bg-primary-500'
        }`}>
          {isUser ? 'U' : 'AI'}
        </div>
        <div className={`message-bubble ${isUser ? 'user-message' : 'bot-message'}`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="space-y-3">
              <div className="markdown-content text-sm">
                <MessageContent 
                  content={message.content} 
                  citations={message.citations || []}
                  onCitationClick={handleCitationClick}
                />
              </div>
              
              {/* Show references if available */}
              {message.citations && message.citations.length > 0 && (
                <References 
                  citations={message.citations}
                  onViewDocument={handleCitationClick}
                />
              )}
            </div>
          )}
          {message.timestamp && (
            <div className={`text-xs mt-2 opacity-70 ${isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer Modal */}
    </>
  );
};

export default Message;
