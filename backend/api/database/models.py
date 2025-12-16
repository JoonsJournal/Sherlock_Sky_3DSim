"""
데이터베이스 모델 정의
- 테이블 스키마
- 데이터 검증
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class Equipment(BaseModel):
    """장비 기본 정보"""
    equipment_id: str = Field(..., description="장비 ID (예: EQ-00-00)")
    name: str = Field(..., description="장비명")
    type: str = Field(default="PRODUCTION", description="장비 유형")
    row_position: int = Field(..., ge=0, le=6, description="행 위치 (0-6)")
    col_position: int = Field(..., ge=0, le=10, description="열 위치 (0-10)")
    current_status: str = Field(default="IDLE", description="현재 상태")
    
    class Config:
        json_schema_extra = {
            "example": {
                "equipment_id": "EQ-00-00",
                "name": "Equipment 0-0",
                "type": "PRODUCTION",
                "row_position": 0,
                "col_position": 0,
                "current_status": "IDLE"
            }
        }


class EquipmentStatus(BaseModel):
    """장비 상태 (시계열)"""
    equipment_id: str
    status: str = Field(..., description="상태: IDLE, RUNNING, ERROR, MAINTENANCE")
    temperature: Optional[float] = Field(None, ge=0, le=200, description="온도 (°C)")
    pressure: Optional[float] = Field(None, ge=0, le=10, description="압력 (bar)")
    vibration: Optional[float] = Field(None, ge=0, le=100, description="진동 (mm/s)")
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_schema_extra = {
            "example": {
                "equipment_id": "EQ-00-00",
                "status": "RUNNING",
                "temperature": 75.5,
                "pressure": 5.2,
                "vibration": 12.3,
                "timestamp": "2025-01-15T10:30:00"
            }
        }


class ProductionData(BaseModel):
    """생산 데이터 (시계열)"""
    equipment_id: str
    good_count: int = Field(..., ge=0, description="양품 수")
    defect_count: int = Field(..., ge=0, description="불량품 수")
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_schema_extra = {
            "example": {
                "equipment_id": "EQ-00-00",
                "good_count": 95,
                "defect_count": 5,
                "timestamp": "2025-01-15T10:30:00"
            }
        }


class AlarmData(BaseModel):
    """알람 데이터 (시계열)"""
    equipment_id: str
    alarm_code: str = Field(..., description="알람 코드")
    severity: str = Field(..., description="심각도: INFO, WARNING, CRITICAL")
    message: str = Field(..., description="알람 메시지")
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_schema_extra = {
            "example": {
                "equipment_id": "EQ-00-00",
                "alarm_code": "TEMP_HIGH",
                "severity": "WARNING",
                "message": "Temperature above threshold",
                "timestamp": "2025-01-15T10:30:00"
            }
        }


class PlaybackConfig(BaseModel):
    """재생 설정"""
    start_time: datetime
    end_time: datetime
    speed: int = Field(default=1, ge=1, le=100, description="재생 속도 (1x ~ 100x)")
    equipment_ids: Optional[list[str]] = Field(None, description="특정 장비만 재생")
    
    class Config:
        json_schema_extra = {
            "example": {
                "start_time": "2025-01-15T00:00:00",
                "end_time": "2025-01-15T23:59:59",
                "speed": 10,
                "equipment_ids": ["EQ-00-00", "EQ-00-01"]
            }
        }


class AnalyticsRequest(BaseModel):
    """분석 요청"""
    analysis_type: str = Field(..., description="분석 유형: oee, mtbf, pareto, trend")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    equipment_id: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "analysis_type": "oee",
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-01-15T23:59:59",
                "equipment_id": "EQ-00-00"
            }
        }


# 상태 코드 상수
class StatusCode:
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    ERROR = "ERROR"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE = "OFFLINE"


# 알람 심각도 상수
class Severity:
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


# 장비 타입 상수
class EquipmentType:
    PRODUCTION = "PRODUCTION"
    ASSEMBLY = "ASSEMBLY"
    INSPECTION = "INSPECTION"
    PACKAGING = "PACKAGING"