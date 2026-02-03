# backend/api/utils/logging_config.py
"""
통합 로깅 설정 모듈
- 파일 로깅 (전체, 에러)
- 콘솔 출력
- 로그 로테이션
"""

import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from typing import Optional


class ColoredFormatter(logging.Formatter):
    """컬러 출력을 지원하는 로그 포맷터"""
    
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m'       # Reset
    }
    
    def format(self, record):
        # 레벨에 따라 색상 추가
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.COLORS['RESET']}"
        
        return super().format(record)


def setup_logging(
    log_level: str = 'INFO',
    log_dir: str = 'logs',
    app_name: str = 'app',
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    console_output: bool = True,
    colored_console: bool = True
) -> logging.Logger:
    """
    애플리케이션 로깅 설정
    
    Args:
        log_level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: 로그 파일 저장 디렉토리
        app_name: 애플리케이션 이름
        max_bytes: 로그 파일 최대 크기
        backup_count: 백업 파일 개수
        console_output: 콘솔 출력 여부
        colored_console: 컬러 콘솔 출력 여부
    
    Returns:
        설정된 루트 로거
    """
    
    # 로그 레벨 매핑
    level_map = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL
    }
    
    log_level_value = level_map.get(log_level.upper(), logging.INFO)
    
    # 로그 디렉토리 생성
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    # 포맷터 설정
    detailed_formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    simple_formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 컬러 포맷터
    colored_formatter = ColoredFormatter(
        fmt='%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 루트 로거 설정
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level_value)
    root_logger.handlers.clear()
    
    # === 핸들러 추가 ===
    
    # 1. 전체 로그 파일 (Rotating)
    all_log_file = log_path / f"{app_name}_all.log"
    file_handler_all = RotatingFileHandler(
        all_log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding='utf-8'
    )
    file_handler_all.setLevel(logging.DEBUG)
    file_handler_all.setFormatter(detailed_formatter)
    root_logger.addHandler(file_handler_all)
    
    # 2. 에러 로그 파일 (Daily)
    error_log_file = log_path / f"{app_name}_error.log"
    file_handler_error = TimedRotatingFileHandler(
        error_log_file,
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    file_handler_error.setLevel(logging.ERROR)
    file_handler_error.setFormatter(detailed_formatter)
    root_logger.addHandler(file_handler_error)
    
    # 3. 콘솔 핸들러
    if console_output:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level_value)
        
        # 컬러 출력 여부에 따라 포맷터 선택
        if colored_console and sys.stdout.isatty():
            console_handler.setFormatter(colored_formatter)
        else:
            console_handler.setFormatter(simple_formatter)
        
        root_logger.addHandler(console_handler)
    
    # === 외부 라이브러리 로그 레벨 조정 ===
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.error').setLevel(logging.INFO)
    logging.getLogger('fastapi').setLevel(logging.INFO)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('websockets').setLevel(logging.WARNING)
    
    # 설정 완료 메시지
    root_logger.info("=" * 60)
    root_logger.info(f"🔧 로깅 시스템 초기화 완료")
    root_logger.info(f"📊 로그 레벨: {log_level}")
    root_logger.info(f"📁 로그 디렉토리: {log_path.absolute()}")
    root_logger.info(f"📝 전체 로그: {all_log_file.name}")
    root_logger.info(f"❌ 에러 로그: {error_log_file.name}")
    root_logger.info("=" * 60)
    
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """
    모듈별 로거 생성
    
    Args:
        name: 로거 이름 (일반적으로 __name__ 사용)
    
    Returns:
        설정된 로거 인스턴스
    
    Example:
        >>> logger = get_logger(__name__)
        >>> logger.info("Hello World")
    """
    return logging.getLogger(name)


def set_log_level(level: str, logger_name: Optional[str] = None):
    """
    런타임에 로그 레벨 변경
    
    Args:
        level: 새로운 로그 레벨
        logger_name: 특정 로거 이름 (None이면 루트 로거)
    """
    level_map = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL
    }
    
    new_level = level_map.get(level.upper(), logging.INFO)
    
    if logger_name:
        logging.getLogger(logger_name).setLevel(new_level)
    else:
        logging.getLogger().setLevel(new_level)