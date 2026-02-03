"""
커스텀 예외 클래스 및 에러 핸들러
"""
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from typing import Callable, Any
import logging
import traceback
from functools import wraps

logger = logging.getLogger(__name__)


# ============================================================================
# 커스텀 예외 클래스
# ============================================================================

class BaseAPIException(Exception):
    """기본 API 예외 클래스"""
    def __init__(
        self, 
        message: str, 
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        details: dict = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class DatabaseError(BaseAPIException):
    """데이터베이스 에러"""
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            message=message,
            status_code=500,
            error_code="DATABASE_ERROR",
            details=details
        )


class NotFoundError(BaseAPIException):
    """리소스를 찾을 수 없음"""
    def __init__(self, resource: str, identifier: str = None):
        message = f"{resource}를 찾을 수 없습니다"
        if identifier:
            message += f": {identifier}"
        super().__init__(
            message=message,
            status_code=404,
            error_code="NOT_FOUND",
            details={"resource": resource, "identifier": identifier}
        )


class ValidationError(BaseAPIException):
    """입력 검증 에러"""
    def __init__(self, message: str, field: str = None):
        super().__init__(
            message=message,
            status_code=400,
            error_code="VALIDATION_ERROR",
            details={"field": field} if field else {}
        )


class RedisError(BaseAPIException):
    """Redis 연결/조회 에러"""
    def __init__(self, message: str):
        super().__init__(
            message=message,
            status_code=503,
            error_code="REDIS_ERROR",
            details={}
        )


class ExternalServiceError(BaseAPIException):
    """외부 서비스 에러"""
    def __init__(self, service: str, message: str):
        super().__init__(
            message=f"{service} 서비스 에러: {message}",
            status_code=503,
            error_code="EXTERNAL_SERVICE_ERROR",
            details={"service": service}
        )


# ============================================================================
# 전역 에러 핸들러
# ============================================================================

async def api_exception_handler(request: Request, exc: BaseAPIException):
    """커스텀 예외 핸들러"""
    logger.error(
        f"API Error: {exc.error_code} - {exc.message}",
        extra={
            "error_code": exc.error_code,
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method,
            "details": exc.details
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details
            },
            "path": request.url.path,
            "method": request.method
        }
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """일반 예외 핸들러"""
    # 프로덕션에서는 상세 에러 정보를 숨김
    logger.error(
        f"Unhandled Exception: {str(exc)}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "traceback": traceback.format_exc()
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "서버 내부 오류가 발생했습니다",
                "details": {}
            },
            "path": request.url.path,
            "method": request.method
        }
    )


# ============================================================================
# 데코레이터를 통한 에러 처리
# ============================================================================

def handle_errors(func: Callable) -> Callable:
    """
    라우터 함수에 적용할 에러 처리 데코레이터
    
    사용 예시:
        @router.get("/equipment/{equipment_id}")
        @handle_errors
        async def get_equipment(equipment_id: str):
            ...
    """
    @wraps(func)
    async def wrapper(*args, **kwargs) -> Any:
        try:
            return await func(*args, **kwargs)
        
        except BaseAPIException:
            # 커스텀 예외는 그대로 전파
            raise
        
        except HTTPException:
            # FastAPI HTTPException도 그대로 전파
            raise
        
        except Exception as e:
            # 예상하지 못한 에러 로깅
            logger.error(
                f"Unexpected error in {func.__name__}: {str(e)}",
                exc_info=True
            )
            raise BaseAPIException(
                message="예상치 못한 오류가 발생했습니다",
                status_code=500,
                error_code="UNEXPECTED_ERROR"
            )
    
    return wrapper


# ============================================================================
# 데이터베이스 에러 처리 헬퍼
# ============================================================================

def handle_db_error(error: Exception, operation: str = "데이터베이스 작업"):
    """
    데이터베이스 에러를 적절한 예외로 변환
    
    Args:
        error: 원본 에러
        operation: 수행 중이던 작업 설명
    """
    import psycopg2
    
    error_msg = str(error)
    
    # PostgreSQL 특정 에러 처리
    if isinstance(error, psycopg2.Error):
        if isinstance(error, psycopg2.IntegrityError):
            raise ValidationError(
                message=f"데이터 무결성 위반: {operation}",
                field="database"
            )
        elif isinstance(error, psycopg2.OperationalError):
            raise DatabaseError(
                message=f"데이터베이스 연결 실패: {operation}",
                details={"error": error_msg}
            )
        else:
            raise DatabaseError(
                message=f"{operation} 실패",
                details={"error": error_msg}
            )
    
    # 기타 에러
    raise DatabaseError(
        message=f"{operation} 중 오류 발생",
        details={"error": error_msg}
    )


# ============================================================================
# Redis 에러 처리 헬퍼
# ============================================================================

def handle_redis_error(error: Exception, operation: str = "Redis 작업"):
    """
    Redis 에러를 적절한 예외로 변환
    
    Args:
        error: 원본 에러
        operation: 수행 중이던 작업 설명
    """
    error_msg = str(error)
    
    logger.error(f"Redis error during {operation}: {error_msg}")
    
    raise RedisError(
        message=f"{operation} 실패: Redis 연결 문제"
    )


# ============================================================================
# 유틸리티 함수
# ============================================================================

def validate_date_range(start_date: str, end_date: str):
    """날짜 범위 검증"""
    from datetime import datetime
    
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        if start > end:
            raise ValidationError(
                message="시작 날짜가 종료 날짜보다 늦을 수 없습니다",
                field="date_range"
            )
        
        return start, end
    
    except ValueError as e:
        raise ValidationError(
            message=f"잘못된 날짜 형식: {str(e)}",
            field="date_format"
        )


def validate_equipment_id(equipment_id: str):
    """설비 ID 형식 검증"""
    import re
    
    # EQ-01-01 형식 검증
    pattern = r'^EQ-\d{2}-\d{2}$'
    if not re.match(pattern, equipment_id):
        raise ValidationError(
            message=f"잘못된 설비 ID 형식: {equipment_id} (예: EQ-01-01)",
            field="equipment_id"
        )