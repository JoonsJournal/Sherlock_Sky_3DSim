"""
스트림 데이터 처리
- 실시간 데이터 변환
- 데이터 압축
- 배치 처리
"""

from typing import List, Dict
import json
from datetime import datetime


class StreamHandler:
    def __init__(self):
        self.batch_size = 10
        self.batch_buffer: Dict[str, List] = {}
    
    def format_equipment_status(self, data: dict) -> dict:
        """
        장비 상태 데이터 포맷 (Phase 1: Monitoring용 확장)
        
        기존 기능 유지 + Monitoring 필드 추가
        
        Args:
            data: 원본 상태 데이터
                - equipment_id: int
                - frontend_id: str (optional, Phase 1 추가)
                - status: str (RUN/IDLE/STOP)
                - previous_status: str (optional, Phase 1 추가)
                - temperature: float (optional)
                - pressure: float (optional)
                - timestamp: str (optional)
        
        Returns:
            dict: 포맷된 상태 데이터
        """
        # 기본 필드 (기존 기능)
        formatted = {
            "type": "equipment_status",
            "equipment_id": data.get("equipment_id"),
            "status": data.get("status"),
            "timestamp": data.get("timestamp", datetime.now().isoformat())
        }
        
        # ⭐ Phase 1: Monitoring용 추가 필드
        if "frontend_id" in data:
            formatted["frontend_id"] = data.get("frontend_id")
        
        if "previous_status" in data:
            formatted["previous_status"] = data.get("previous_status")
        
        # 센서 데이터 (기존 기능)
        if "temperature" in data:
            formatted["temperature"] = data.get("temperature")
        
        if "pressure" in data:
            formatted["pressure"] = data.get("pressure")
        
        return formatted
    
    def format_production_data(self, data: dict) -> dict:
        """생산 데이터 포맷"""
        return {
            "type": "production",
            "equipment_id": data.get("equipment_id"),
            "product_count": data.get("product_count"),
            "good_count": data.get("good_count"),
            "defect_count": data.get("defect_count"),
            "timestamp": data.get("timestamp", datetime.now().isoformat())
        }
    
    def format_alarm(self, data: dict) -> dict:
        """알람 데이터 포맷"""
        return {
            "type": "alarm",
            "equipment_id": data.get("equipment_id"),
            "alarm_code": data.get("alarm_code"),
            "severity": data.get("severity", "WARNING"),
            "message": data.get("message"),
            "timestamp": data.get("timestamp", datetime.now().isoformat())
        }
    
    def add_to_batch(self, equipment_id: str, data: dict):
        """배치 버퍼에 데이터 추가"""
        if equipment_id not in self.batch_buffer:
            self.batch_buffer[equipment_id] = []
        
        self.batch_buffer[equipment_id].append(data)
    
    def get_batch(self, equipment_id: str) -> List[dict]:
        """배치 데이터 가져오기"""
        if equipment_id in self.batch_buffer:
            if len(self.batch_buffer[equipment_id]) >= self.batch_size:
                batch = self.batch_buffer[equipment_id][:self.batch_size]
                self.batch_buffer[equipment_id] = self.batch_buffer[equipment_id][self.batch_size:]
                return batch
        return []
    
    def clear_batch(self, equipment_id: str):
        """배치 버퍼 클리어"""
        if equipment_id in self.batch_buffer:
            del self.batch_buffer[equipment_id]
    
    def compress_data(self, data_list: List[dict]) -> dict:
        """데이터 압축 (여러 데이터를 하나로)"""
        if not data_list:
            return {}
        
        return {
            "type": "batch",
            "count": len(data_list),
            "data": data_list,
            "compressed_at": datetime.now().isoformat()
        }