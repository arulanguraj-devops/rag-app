# custom_logger.py

import logging
import os

# Define ANSI escape codes for coloring and bold text
class ColoredFormatter(logging.Formatter):
    COLOR_RED = "\033[91m"    # Error
    COLOR_GREEN = "\033[92m"  # Info
    COLOR_YELLOW = "\033[93m" # Warning
    COLOR_CYAN = "\033[96m"   # Debug
    COLOR_BOLD = "\033[1m"    # Bold
    COLOR_RESET = "\033[0m"   # Reset color

    def format(self, record):
        # Bold the level name
        if record.levelno == logging.ERROR:
            record.levelname = f"{self.COLOR_BOLD}{self.COLOR_RED}{record.levelname}{self.COLOR_RESET}"
            record.msg = f"{self.COLOR_RED}{record.msg}{self.COLOR_RESET}"
        elif record.levelno == logging.INFO:
            record.levelname = f"{self.COLOR_BOLD}{self.COLOR_GREEN}{record.levelname}{self.COLOR_RESET}"
            record.msg = f"{self.COLOR_GREEN}{record.msg}{self.COLOR_RESET}"
        elif record.levelno == logging.WARNING:
            record.levelname = f"{self.COLOR_BOLD}{self.COLOR_YELLOW}{record.levelname}{self.COLOR_RESET}"
            record.msg = f"{self.COLOR_YELLOW}{record.msg}{self.COLOR_RESET}"
        elif record.levelno == logging.DEBUG:
            record.levelname = f"{self.COLOR_BOLD}{self.COLOR_CYAN}{record.levelname}{self.COLOR_RESET}"
            record.msg = f"{self.COLOR_CYAN}{record.msg}{self.COLOR_RESET}"
        return super().format(record)

# Singleton Logger
logger = None

def setup_logger():
    global logger
    if logger is None:
        logger = logging.getLogger()
        handler = logging.StreamHandler()
        formatter = ColoredFormatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)

        # Get log level from environment variable, default to DEBUG
        log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
        logger.setLevel(getattr(logging, log_level, logging.DEBUG))  # Fallback to DEBUG if invalid level
    return logger
