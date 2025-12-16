"""
로깅 설정
"""
import logging
import logging.handlers
import os
import sys
from pathlib import Path
from datetime import datetime


def setup_logging(
    log_level: str = "INFO",
    log_dir: str = "logs",
    app_name: str = "sherlock_sky_api"
):
    """
    애플리케이션 로깅 설정
    
    Args:
        log_level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_dir: 로그 파일 저장 디렉토리
        app_name: 애플리케이션 이름
    """
    # 로그 디렉토리 생성
    log_path = Path(log_dir)
    log_path.mkdir(exist_ok=True)
    
    # 로그 레벨 설정
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # 루트 로거 설정
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # 기존 핸들러 제거
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # ========================================
    # 포맷터 설정
    # ========================================
    
    # 상세 포맷 (파일용)
    detailed_formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - '
            '[%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 간단한 포맷 (콘솔용)
    simple_formatter = logging.Formatter(
        fmt='%(levelname)s: %(message)s'
    )
    
    # JSON 포맷 (구조화 로그용 - 선택사항)
    json_formatter = logging.Formatter(
        fmt='{"timestamp":"%(asctime)s","level":"%(levelname)s",'
            '"logger":"%(name)s","message":"%(message)s",'
            '"file":"%(filename)s","line":%(lineno)d}',
        datefmt='%Y-%m-%dT%H:%M:%S'
    )
    
    # ========================================
    # 콘솔 핸들러
    # ========================================
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(simple_formatter)
    root_logger.addHandler(console_handler)
    
    # ========================================
    # 파일 핸들러 (일반 로그)
    # ========================================
    file_handler = logging.handlers.RotatingFileHandler(
        filename=log_path / f"{app_name}.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(file_handler)
    
    # ========================================
    # 에러 전용 파일 핸들러
    # ========================================
    error_handler = logging.handlers.RotatingFileHandler(
        filename=log_path / f"{app_name}_errors.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=10,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(error_handler)
    
    # ========================================
    # 날짜별 로그 핸들러 (선택사항)
    # ========================================
    daily_handler = logging.handlers.TimedRotatingFileHandler(
        filename=log_path / f"{app_name}_daily.log",
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    daily_handler.setLevel(logging.INFO)
    daily_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(daily_handler)
    
    # ========================================
    # 외부 라이브러리 로그 레벨 조정
    # ========================================
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    
    # ========================================
    # 시작 로그
    # ========================================
    logger = logging.getLogger(__name__)
    logger.info("="*60)
    logger.info(f"로깅 시스템 초기화 완료")
    logger.info(f"로그 레벨: {log_level}")
    logger.info(f"로그 디렉토리: {log_path.absolute()}")
    logger.info("="*60)


def get_logger(name: str) -> logging.Logger:
    """
    모듈별 로거 가져오기
    
    Usage:
        from api.utils.logging_config import get_logger
        logger = get_logger(__name__)
    """
    return logging.getLogger(name)