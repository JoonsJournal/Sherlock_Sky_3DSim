"""
스트림 데이터 처리
- 실시간 데이터 변환
- 데이터 압축
- 배치 처리

@version 2.0.0
@changelog
- v2.0.0: Equipment Detail Panel용 확장 필드 추가
          - lot_start_time, cpu_usage_percent
          - product_model, lot_id, equipment_name, line_name
          - format_equipment_detail_status() 신규 메서드 추가
- v1.1.0: Phase 1 Monitoring용 frontend_id, previous_status 추가
- v1.0.0: 초기 버전

작성일: 2026-01-08
"""

from typing import List, Dict, Optional
import json
from datetime import datetime


class StreamHandler:
    def __init__(self):
        self.batch_size = 10
        self.batch_buffer: Dict[str, List] = {}
    
    def format_equipment_status(self, data: dict) -> dict:
        """
        장비 상태 데이터 포맷 (기본 버전 - 기존 호환성 유지)
        
        ⭐ v2.0.0: 확장 필드 추가 (하위 호환성 유지)
        - 기존 필드: equipment_id, status, timestamp, frontend_id, previous_status
        - 확장 필드: lot_start_time, cpu_usage_percent, product_model, lot_id, 
                    equipment_name, line_name
        
        Args:
            data: 원본 상태 데이터
                - equipment_id: int
                - frontend_id: str (optional)
                - status: str (RUN/IDLE/STOP/SUDDENSTOP/DISCONNECTED)
                - previous_status: str (optional)
                - temperature: float (optional)
                - pressure: float (optional)
                - timestamp: str (optional)
                # 🆕 v2.0.0: Equipment Detail Panel용 확장 필드
                - equipment_name: str (optional)
                - line_name: str (optional)
                - product_model: str (optional)
                - lot_id: str (optional)
                - lot_start_time: str (optional, ISO format)
                - cpu_usage_percent: float (optional)
        
        Returns:
            dict: 포맷된 상태 데이터
        """
        # ============================================
        # 기본 필드 (기존 기능 - 호환성 유지)
        # ============================================
        formatted = {
            "type": "equipment_status",
            "equipment_id": data.get("equipment_id"),
            "status": data.get("status"),
            "timestamp": data.get("timestamp", datetime.now().isoformat())
        }
        
        # ============================================
        # Phase 1 Monitoring용 필드 (v1.1.0)
        # ============================================
        if "frontend_id" in data:
            formatted["frontend_id"] = data.get("frontend_id")
        
        if "previous_status" in data:
            formatted["previous_status"] = data.get("previous_status")
        
        # 센서 데이터 (기존 기능)
        if "temperature" in data:
            formatted["temperature"] = data.get("temperature")
        
        if "pressure" in data:
            formatted["pressure"] = data.get("pressure")
        
        # ============================================
        # 🆕 v2.0.0: Equipment Detail Panel용 확장 필드
        # ============================================
        
        # 설비 기본 정보
        if "equipment_name" in data:
            formatted["equipment_name"] = data.get("equipment_name")
        
        if "line_name" in data:
            formatted["line_name"] = data.get("line_name")
        
        # Lot 정보
        if "product_model" in data:
            formatted["product_model"] = data.get("product_model")
        
        if "lot_id" in data:
            formatted["lot_id"] = data.get("lot_id")
        
        # 🆕 v2.0.0: Lot 시작 시간 (Duration Timer용)
        if "lot_start_time" in data:
            formatted["lot_start_time"] = data.get("lot_start_time")
        
        # 🆕 v2.0.0: CPU 사용율 (PC Info Tab용)
        if "cpu_usage_percent" in data:
            cpu_val = data.get("cpu_usage_percent")
            # float 변환 (None이 아닌 경우)
            if cpu_val is not None:
                try:
                    formatted["cpu_usage_percent"] = float(cpu_val)
                except (ValueError, TypeError):
                    formatted["cpu_usage_percent"] = None
            else:
                formatted["cpu_usage_percent"] = None
        
        return formatted
    
    def format_equipment_detail_status(self, data: dict) -> dict:
        """
        🆕 v2.0.0: Equipment Detail Panel 전용 포맷
        
        모든 필드를 명시적으로 포함하여 Frontend의 EquipmentInfoPanel에 전달
        
        Args:
            data: 원본 상태 데이터 (DB 조회 결과)
                - equipment_id: int
                - equipment_name: str
                - line_name: str
                - status: str
                - product_model: str
                - lot_id: str
                - lot_start_time: str (ISO format)
                - cpu_usage_percent: float
                - timestamp: str
        
        Returns:
            dict: Equipment Detail Panel용 포맷된 데이터
        """
        return {
            "type": "equipment_detail_status",
            
            # 식별자
            "equipment_id": data.get("equipment_id"),
            "frontend_id": data.get("frontend_id"),
            
            # 설비 기본 정보
            "equipment_name": data.get("equipment_name"),
            "line_name": data.get("line_name"),
            
            # 상태 정보
            "status": data.get("status"),
            "previous_status": data.get("previous_status"),
            
            # Lot 정보
            "product_model": data.get("product_model"),
            "lot_id": data.get("lot_id"),
            "lot_start_time": data.get("lot_start_time"),
            
            # PC Info (실시간)
            "cpu_usage_percent": self._safe_float(data.get("cpu_usage_percent")),
            
            # 타임스탬프
            "timestamp": data.get("timestamp", datetime.now().isoformat()),
            "last_updated": data.get("last_updated", datetime.now().isoformat())
        }
    
    def _safe_float(self, value) -> Optional[float]:
        """
        🆕 v2.0.0: 안전한 float 변환
        """
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
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
    
    # =========================================================================
    # 🆕 v2.0.0: PC Info 전용 메시지 포맷
    # =========================================================================
    
    def format_pc_info_update(self, data: dict) -> dict:
        """
        🆕 v2.0.0: PC Info 실시간 업데이트 전용 포맷
        
        CPU 사용율 등 PC 관련 실시간 데이터만 전송할 때 사용
        
        Args:
            data: PC 정보 데이터
                - equipment_id: int
                - cpu_usage_percent: float
                - timestamp: str
        
        Returns:
            dict: PC Info 업데이트 포맷
        """
        return {
            "type": "pc_info_update",
            "equipment_id": data.get("equipment_id"),
            "frontend_id": data.get("frontend_id"),
            "cpu_usage_percent": self._safe_float(data.get("cpu_usage_percent")),
            "timestamp": data.get("timestamp", datetime.now().isoformat())
        }
    
    # =========================================================================
    # 🆕 v2.0.0: Lot 변경 전용 메시지 포맷
    # =========================================================================
    
    def format_lot_change(self, data: dict) -> dict:
        """
        🆕 v2.0.0: Lot 변경 알림 포맷
        
        새 Lot이 시작되었을 때 Duration Timer 리셋을 위해 사용
        
        Args:
            data: Lot 변경 데이터
                - equipment_id: int
                - lot_id: str
                - product_model: str
                - lot_start_time: str (ISO format)
        
        Returns:
            dict: Lot 변경 알림 포맷
        """
        return {
            "type": "lot_change",
            "equipment_id": data.get("equipment_id"),
            "frontend_id": data.get("frontend_id"),
            "lot_id": data.get("lot_id"),
            "product_model": data.get("product_model"),
            "lot_start_time": data.get("lot_start_time"),
            "timestamp": data.get("timestamp", datetime.now().isoformat())
        }
    
    # =========================================================================
    # 배치 처리 (기존 기능 유지)
    # =========================================================================
    
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