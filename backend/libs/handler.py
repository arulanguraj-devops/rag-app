# Importing the necessary packages
import logging 
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
        logging.info("Custom handler initialized")  # Log initialization

    # On the arrival of the new token, we are adding the new token to the queue  
    def on_llm_new_token(self, token: str, **kwargs) -> None:  
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
        self._queue.put(self._stop_signal)