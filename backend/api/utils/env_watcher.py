# backend/api/utils/env_watcher.py
"""
환경 변수 파일 변경 감지 및 자동 리로드
"""

import os
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import logging

logger = logging.getLogger(__name__)


class EnvFileHandler(FileSystemEventHandler):
    """환경 변수 파일 변경 감지 핸들러"""
    
    def __init__(self, reload_callback):
        self.reload_callback = reload_callback
        self.last_modified = time.time()
    
    def on_modified(self, event):
        if event.src_path.endswith('.env'):
            # 중복 이벤트 방지 (1초 이내)
            current_time = time.time()
            if current_time - self.last_modified < 1:
                return
            
            self.last_modified = current_time
            
            logger.info(f".env 파일 변경 감지: {event.src_path}")
            
            try:
                self.reload_callback()
                logger.info("설정 리로드 완료")
            except Exception as e:
                logger.error(f"설정 리로드 실패: {e}")


class EnvWatcher:
    """환경 변수 파일 감시자"""
    
    def __init__(self, project_root: Path, reload_callback):
        self.project_root = project_root
        self.reload_callback = reload_callback
        self.observer = None
    
    def start(self):
        """감시 시작"""
        event_handler = EnvFileHandler(self.reload_callback)
        self.observer = Observer()
        self.observer.schedule(
            event_handler, 
            str(self.project_root), 
            recursive=False
        )
        self.observer.start()
        logger.info("환경 변수 파일 감시 시작")
    
    def stop(self):
        """감시 중지"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            logger.info("환경 변수 파일 감시 중지")