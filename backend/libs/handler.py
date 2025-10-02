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
        """Extract citation numbers that are actually used in the response"""
        # Find all citation patterns like [1], [2], [3], etc.
        citation_pattern = r'\[(\d+)\]'
        used_citation_numbers = set()
        
        logging.debug(f"Analyzing response text for citations: {response_text[:200]}...")
        
        for match in re.finditer(citation_pattern, response_text):
            citation_num = int(match.group(1))
            used_citation_numbers.add(citation_num)
        
        # Filter citations to only include the ones used in the response
        used_citations = []
        for citation_num in sorted(used_citation_numbers):
            # Citation numbers are 1-indexed, but array is 0-indexed
            if 1 <= citation_num <= len(self._citations):
                citation = self._citations[citation_num - 1].copy()
                # Update the citation ID to match the order it appears in the response
                citation['id'] = f"ref_{citation_num}"
                used_citations.append(citation)
                logging.debug(f"Including citation {citation_num}: {citation['title']}")
        
        logging.info(f"Response contains {len(used_citation_numbers)} unique citations: {sorted(used_citation_numbers)}")
        logging.info(f"Filtered to {len(used_citations)} used citations from {len(self._citations)} total citations")
        
        return used_citations

    # On the arrival of the new token, we are adding the new token to the queue  
    def on_llm_new_token(self, token: str, **kwargs) -> None:  
        # Collect the complete response for citation analysis
        self._complete_response += token
        self._queue.put(token)
        logging.debug(f"New token received: {token}")  # Log the received token

    # On starting or initializing, we log a starting message  
    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:  
        """Run when LLM starts running."""  
        logging.info("LLM generation started")  # Log when generation starts

    # On receiving the last token, we add the stop signal, which determines the end of the generation  
    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:  
        """Run when LLM ends running."""  
        logging.info("LLM generation concluded")  # Log when generation ends
        
        # Extract only the citations that were actually used in the response
        if self._citations and self._complete_response:
            used_citations = self.extract_used_citations(self._complete_response)
            
            if used_citations:
                import json
                citation_data = {
                    "type": "citations",
                    "data": used_citations
                }
                logging.info(f"Sending {len(used_citations)} used citations to frontend (filtered from {len(self._citations)} total)")
                # Send the citation data object directly, not as JSON string
                self._queue.put(citation_data)
            else:
                logging.info("No citations were used in the response")
        else:
            logging.warning("No citations available or no response generated")
        
        self._queue.put(self._stop_signal)