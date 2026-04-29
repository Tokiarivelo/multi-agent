import logging
import os
import datetime

class NestFormatter(logging.Formatter):
    COLOR_RESET = "\033[0m"
    COLOR_RED = "\033[31m"
    COLOR_GREEN = "\033[32m"
    COLOR_YELLOW = "\033[33m"
    COLOR_BLUE = "\033[34m"
    COLOR_PURPLE = "\033[35m"
    COLOR_CYAN = "\033[36m"

    def format(self, record):
        now = datetime.datetime.fromtimestamp(record.created).strftime("%m/%d/%Y, %I:%M:%S %p")
        pid = os.getpid()
        
        level_color = self.COLOR_GREEN
        level_name = "LOG"
        
        if record.levelno >= logging.ERROR:
            level_color = self.COLOR_RED
            level_name = "ERROR"
        elif record.levelno >= logging.WARNING:
            level_color = self.COLOR_YELLOW
            level_name = "WARN"
        elif record.levelno == logging.DEBUG:
            level_color = self.COLOR_PURPLE
            level_name = "DEBUG"

        context = record.name
        if context in ("uvicorn.access", "uvicorn.error", "uvicorn"):
            context = "HTTP"

        msg = super().format(record)
        return f"{self.COLOR_GREEN}[Nest] {pid}  - {now}     {level_name} {self.COLOR_YELLOW}[{context}]{level_color} {msg}{self.COLOR_RESET}"

def get_nest_log_config():
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "nest": {
                "()": "logger.NestFormatter",
            },
        },
        "handlers": {
            "console": {
                "formatter": "nest",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "": {
                "handlers": ["console"],
                "level": "INFO",
            },
            "uvicorn": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.error": {
                "level": "INFO",
                "propagate": True,
            },
            "uvicorn.access": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            }
        },
    }

def get_logger(name="DocumentService"):
    return logging.getLogger(name)
