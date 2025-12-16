"""
통합 로깅 설정 모듈
- API, 시뮬레이터, 스크립트 등 모든 모듈에서 사용 가능
"""

import logging
import os
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
from datetime import datetime


def setup_logging(
    name: str = "sherlock_sky",
    level: str = "INFO",
    log_dir: str = "logs",
    console: bool = True,
    file: bool = True,
    error_file: bool = True,
    daily: bool = False,
    max_bytes: int = 10485760,  # 10MB
    backup_count: int = 5
) -> logging.Logger:
    """
    통합 로깅 시스템 설정
    
    Args:
        name: 로거 이름 (예: 'api', 'simulator', 'database_script')
        level: 로그 레벨 ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')
        log_dir: 로그 파일 저장 디렉토리
        console: 콘솔 출력 여부
        file: 파일 로깅 여부
        error_file: 에러 전용 파일 로깅 여부
        daily: 일별 로그 파일 생성 여부
        max_bytes: 로그 파일 최대 크기 (bytes)
        backup_count: 백업 파일 개수
    
    Returns:
        설정된 Logger 객체
    """
    # 로거 생성
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # 기존 핸들러 제거 (중복 방지)
    logger.handlers.clear()
    
    # 로그 디렉토리 생성
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    # 포맷터 설정
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - '
        '[%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # 1. 콘솔 핸들러
    if console:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(simple_formatter)
        logger.addHandler(console_handler)
    
    # 2. 파일 핸들러 (회전)
    if file:
        file_handler = RotatingFileHandler(
            log_path / f"{name}.log",
            maxBytes=max_bytes,
            backupCount=backup_count
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(detailed_formatter)
        logger.addHandler(file_handler)
    
    # 3. 에러 전용 파일 핸들러
    if error_file:
        error_handler = RotatingFileHandler(
            log_path / f"{name}_errors.log",
            maxBytes=max_bytes,
            backupCount=backup_count
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(detailed_formatter)
        logger.addHandler(error_handler)
    
    # 4. 일별 로그 파일 (선택)
    if daily:
        daily_handler = TimedRotatingFileHandler(
            log_path / f"{name}_daily.log",
            when='midnight',
            interval=1,
            backupCount=30
        )
        daily_handler.setLevel(logging.INFO)
        daily_handler.setFormatter(detailed_formatter)
        logger.addHandler(daily_handler)
    
    logger.info(f"로깅 시스템 초기화 완료: {name} (레벨: {level})")
    
    return logger


def get_logger(name: str, level: str = "INFO") -> logging.Logger:
    """
    간편한 로거 가져오기 (기본 설정 사용)
    
    Args:
        name: 로거 이름
        level: 로그 레벨
    
    Returns:
        Logger 객체
    """
    # 로거가 이미 설정되어 있으면 반환
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        # 설정되지 않은 경우 기본 설정 적용
        logger = setup_logging(name=name, level=level)
    
    return logger


# ============================================================================
# 사전 정의된 로거들
# ============================================================================

def get_api_logger(level: str = "INFO") -> logging.Logger:
    """API 서버용 로거"""
    return setup_logging(
        name="sherlock_sky_api",
        level=level,
        log_dir="logs/api",
        console=True,
        file=True,
        error_file=True,
        daily=True
    )


def get_simulator_logger(level: str = "INFO") -> logging.Logger:
    """시뮬레이터용 로거"""
    return setup_logging(
        name="simulator",
        level=level,
        log_dir="logs/simulator",
        console=True,
        file=True,
        error_file=True,
        daily=False
    )


def get_script_logger(name: str, level: str = "INFO") -> logging.Logger:
    """스크립트용 로거"""
    return setup_logging(
        name=name,
        level=level,
        log_dir="logs/scripts",
        console=True,
        file=True,
        error_file=True,
        daily=False,
        backup_count=10
    )


# ============================================================================
# 로그 레벨 헬퍼 함수
# ============================================================================

def set_log_level(logger: logging.Logger, level: str):
    """로그 레벨 동적 변경"""
    logger.setLevel(getattr(logging, level.upper()))
    for handler in logger.handlers:
        handler.setLevel(getattr(logging, level.upper()))


def log_exception(logger: logging.Logger, message: str, exc_info=True):
    """예외 정보와 함께 로그 기록"""
    logger.error(message, exc_info=exc_info)


# ============================================================================
# 로그 파일 관리
# ============================================================================

def cleanup_old_logs(log_dir: str = "logs", days: int = 30):
    """오래된 로그 파일 정리"""
    import time
    
    log_path = Path(log_dir)
    if not log_path.exists():
        return
    
    cutoff_time = time.time() - (days * 86400)
    deleted_count = 0
    
    for log_file in log_path.rglob("*.log*"):
        if log_file.stat().st_mtime < cutoff_time:
            log_file.unlink()
            deleted_count += 1
    
    if deleted_count > 0:
        print(f"정리된 로그 파일: {deleted_count}개")


def get_log_files(log_dir: str = "logs") -> list:
    """현재 로그 파일 목록 조회"""
    log_path = Path(log_dir)
    if not log_path.exists():
        return []
    
    return [str(f) for f in log_path.rglob("*.log*")]