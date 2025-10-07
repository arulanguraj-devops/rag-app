# Importing the necessary packages
import logging 
import re
from langchain.callbacks.base import BaseCallbackHandler  
from langchain.schema.messages import BaseMessage  
from langchain.schema import LLMResult  
from typing import Dict, List, Any

# Creating the custom callback handler class  
class SteamCustomHandler(BaseCallbackHandler):  
    def __init__(self, queue) -> None:  
        super().__init__()  
        # We will be providing the streamer queue as an input  
        self._queue = queue  
        # Defining the stop signal that needs to be added to the queue in case of the last token  
        self._stop_signal = None  
        # Store citations to be sent at the end - initialize as empty for each request
        self._citations = []
        # Store the complete response to analyze citation usage
        self._complete_response = ""
        # Buffer for handling title extraction during streaming
        self._token_buffer = ""
        self._title_processed = False
        self._buffering = True  # Start buffering until we know if there's a title
        logging.info("Custom handler initialized with empty citations")  # Log initialization
        
    def set_citations(self, citations):
        """Set citations to be sent after LLM response"""
        self._citations = citations or []  # Ensure it's always a list
        logging.info(f"Handler citations set: {len(self._citations)} citations")
        
    def clear_citations(self):
        """Clear citations (useful for request isolation)"""
        self._citations = []
        self._complete_response = ""
        self._token_buffer = ""
        self._title_processed = False
        self._buffering = True
        logging.info("Handler citations cleared")
    
    def extract_title_from_response(self, response_text):
        """Extract title from LLM response and return cleaned response"""
        try:
            if not response_text:
                return None, response_text
                
            # Check if response starts with title format
            if response_text.startswith('TITLE: '):
                lines = response_text.split('\n', 1)
                title_line = lines[0]
                title = title_line[7:].strip()  # Remove "TITLE: " prefix
                
                # Get the remaining response (everything after the title line)
                clean_response = lines[1].strip() if len(lines) > 1 else ""
                
                logging.info(f"Extracted title: '{title}'")
                return title, clean_response
            else:
                # No title found, return original response
                return None, response_text
        except Exception as e:
            logging.warning(f"Error extracting title from response: {e}")
            return None, response_text
    
    def extract_used_citations(self, response_text):
        """Extract all citations that match the available citation range"""
        if not self._citations:
            return []
        
        # Find all citation numbers in the response
        citation_pattern = r'\[(\d+)\]'
        used_citation_numbers = set()
        
        logging.debug(f"Analyzing response text for citations: {response_text[:200]}...")
        logging.info(f"Full response text: {response_text}")
        
        all_matches = []
        for match in re.finditer(citation_pattern, response_text):
            citation_num = int(match.group(1))
            used_citation_numbers.add(citation_num)
            all_matches.append(citation_num)
        
        logging.info(f"All citation numbers found in response: {all_matches}")
        
        # If no citation numbers found, return empty list
        if not all_matches:
            return []
            
        logging.info(f"Available citations range: 1 to {len(self._citations)}")
        
        # Return ALL available citations only when citations are referenced in the response
        # because the LLM was given access to all of them
        logging.info(f"Returning all {len(self._citations)} available citations (LLM had access to all)")
        
        return self._citations

    # On the arrival of the new token, we are adding the new token to the queue  
    def on_llm_new_token(self, token: str, **kwargs) -> None:  
        # Collect the complete response for citation analysis
        self._complete_response += token
        
        if self._buffering and not self._title_processed:
            # Buffer tokens until we can determine if there's a title
            self._token_buffer += token
            
            # Check if we have enough content to determine if there's a title
            # Wait for at least one newline AND some content after it, or buffer is getting long
            if (('\n' in self._token_buffer and len(self._token_buffer.split('\n', 1)) > 1 and 
                 len(self._token_buffer.split('\n', 1)[1].strip()) > 0) or 
                len(self._token_buffer) > 100):
                
                # Process the buffer to check for title
                title, clean_content = self.extract_title_from_response(self._token_buffer)
                
                if title:
                    # Found title - send it separately and start streaming clean content
                    logging.info(f"Title detected during streaming: '{title}'")
                    title_data = {
                        "type": "title",
                        "data": title
                    }
                    logging.info(f"Sending title data to queue: {title_data}")
                    self._queue.put(title_data)
                    
                    # Stream the clean content (after title line)
                    if clean_content:
                        logging.info(f"Sending clean content: '{clean_content[:50]}...'")
                        self._queue.put(clean_content)
                    
                    self._title_processed = True
                    self._buffering = False
                    self._token_buffer = ""
                else:
                    # No title found - stream the buffered content and continue normal streaming
                    self._queue.put(self._token_buffer)
                    self._title_processed = True
                    self._buffering = False
                    self._token_buffer = ""
                    self._buffering = False
                    self._token_buffer = ""
        else:
            # Normal streaming after title processing is complete
            self._queue.put(token)
        
        logging.debug(f"New token received: {token}")  # Log the received token
    
    def clean_invalid_citations_from_complete_response(self, response_text):
        """Remove invalid citation numbers from complete response text"""
        if not self._citations:
            return response_text
            
        max_citation = len(self._citations)
        
        def replace_invalid_citation(match):
            citation_num = int(match.group(1))
            if 1 <= citation_num <= max_citation:
                return match.group(0)  # Keep valid citations
            else:
                logging.warning(f"Removing invalid citation [{citation_num}] from response (max: {max_citation})")
                return ""  # Remove invalid citations
        
        # Remove invalid citations like [6], [7], [8], etc. if we only have 5 citations
        citation_pattern = r'\[(\d+)\]'
        cleaned_text = re.sub(citation_pattern, replace_invalid_citation, response_text)
        
        return cleaned_text

    def renumber_citations_in_response(self, response_text):
        """Renumber citations in response text to match the filtered citation list"""
        if not hasattr(self, '_citation_mapping') or not self._citation_mapping:
            return response_text
            
        def replace_citation(match):
            original_num = int(match.group(1))
            if original_num in self._citation_mapping:
                new_num = self._citation_mapping[original_num]
                logging.debug(f"Renumbering citation [{original_num}] -> [{new_num}]")
                return f"[{new_num}]"
            else:
                # This should have been removed by clean_invalid_citations_from_complete_response
                logging.warning(f"Found unmapped citation [{original_num}] during renumbering")
                return ""  # Remove unmapped citations
        
        citation_pattern = r'\[(\d+)\]'
        renumbered_text = re.sub(citation_pattern, replace_citation, response_text)
        
        return renumbered_text

    def clean_invalid_citations(self, text):
        """Remove invalid citation numbers from text as it streams"""
        if not self._citations:
            return text
            
        max_citation = len(self._citations)
        
        def replace_invalid_citation(match):
            citation_num = int(match.group(1))
            if 1 <= citation_num <= max_citation:
                return match.group(0)  # Keep valid citations
            else:
                logging.warning(f"Removing invalid citation [{citation_num}] from response (max: {max_citation})")
                return ""  # Remove invalid citations
        
        # Remove invalid citations like [6], [7], [8], etc. if we only have 5 citations
        citation_pattern = r'\[(\d+)\]'
        cleaned_text = re.sub(citation_pattern, replace_invalid_citation, text)
        
        return cleaned_text

    # On starting or initializing, we log a starting message  
    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:  
        """Run when LLM starts running."""  
        logging.info("LLM generation started")  # Log when generation starts

    # On receiving the last token, we add the stop signal, which determines the end of the generation  
    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:  
        """Run when LLM ends running."""  
        logging.info("LLM generation concluded")  # Log when generation ends
        
        # Clean invalid citations from the complete response before processing
        if self._complete_response and self._citations:
            original_response = self._complete_response
            cleaned_response = self.clean_invalid_citations_from_complete_response(self._complete_response)
            
            if cleaned_response != original_response:
                logging.info("Cleaned invalid citations from response")
                # Update the stored response with the cleaned version
                self._complete_response = cleaned_response
        
        # Extract title from response (only if not already processed during streaming)
        if self._complete_response and not self._title_processed:
            title, clean_response = self.extract_title_from_response(self._complete_response)
            if title:
                # Update the stored response without the title line
                self._complete_response = clean_response
                
                # Send title to frontend
                title_data = {
                    "type": "title",
                    "data": title
                }
                logging.info(f"Sending conversation title at end: '{title}'")
                self._queue.put(title_data)
        elif self._title_processed:
            logging.info("Title already processed during streaming, skipping duplicate send")
        
        # Extract all available citations (no filtering)
        if self._citations and self._complete_response:
            # First check if any citations are actually referenced in the response
            citation_pattern = r'\[(\d+)\]'
            all_matches = [int(match.group(1)) for match in re.finditer(citation_pattern, self._complete_response)]
            
            # Only send citations if at least one citation number was found in the response
            if all_matches:
                available_citations = self.extract_used_citations(self._complete_response)
                
                if available_citations:
                    import json
                    citation_data = {
                        "type": "citations",
                        "data": available_citations
                    }
                    logging.info(f"Sending {len(available_citations)} citations to frontend")
                    # Send the citation data object directly, not as JSON string
                    self._queue.put(citation_data)
                else:
                    logging.info("No citations available")
            else:
                logging.info("No citation numbers found in response, not sending any citations")
        else:
            logging.warning("No citations available or no response generated")
        
        self._queue.put(self._stop_signal)