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
        logging.info("Custom handler initialized with empty citations")  # Log initialization
        
    def set_citations(self, citations):
        """Set citations to be sent after LLM response"""
        self._citations = citations or []  # Ensure it's always a list
        logging.info(f"Handler citations set: {len(self._citations)} citations")
        
    def clear_citations(self):
        """Clear citations (useful for request isolation)"""
        self._citations = []
        self._complete_response = ""
        logging.info("Handler citations cleared")
    
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
        # Send token as-is - we'll handle invalid citations in the extraction phase
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