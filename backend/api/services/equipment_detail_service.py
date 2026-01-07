"""
Equipment Detail Service
설비 상세 정보 조회 서비스 (Site DB 연동)

테이블 구조:
- core.Equipment: EquipmentId, EquipmentName, LineName
- log.EquipmentState: StateLogId, EquipmentId, Status, OccurredAtUtc
- log.Lotinfo: LotInfoId, EquipmentId, LotId, ProductModel, IsStart, OccurredAtUtc

작성일: 2026-01-06
"""

from typing import Optional, List, Dict, Tuple
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging

from ..models.equipment_detail import (
    EquipmentDetailData,
    EquipmentDetailResponse,
    MultiEquipmentDetailResponse
)

logger = logging.getLogger(__name__)


class EquipmentDetailService:
    """설비 상세 정보 조회 서비스"""
    
    # 최대 표시 개수
    MAX_DISPLAY_ITEMS = 3
    
    def __init__(self, db_session: Session):
        """
        Args:
            db_session: Site DB SQLAlchemy 세션
        """
        self.db = db_session
    
    # ========================================================================
    # Single Equipment Detail
    # ========================================================================
    
    def get_equipment_detail(
        self, 
        equipment_id: int
    ) -> Optional[EquipmentDetailData]:
        """
        단일 설비 상세 정보 조회
        
        Args:
            equipment_id: DB Equipment ID (core.Equipment.EquipmentId)
        
        Returns:
            EquipmentDetailData or None
        """
        logger.info(f"🔍 Fetching equipment detail for ID: {equipment_id}")
        
        # SQL Query: JOIN으로 최신 Status와 Lot 정보 조회
        query = text("""
            SELECT 
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt
            FROM core.Equipment e
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    Status, 
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentState
            ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    ProductModel, 
                    LotId,
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.Lotinfo
                WHERE IsStart = 1
            ) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
            WHERE e.EquipmentId = :equipment_id
        """)
        
        try:
            result = self.db.execute(query, {"equipment_id": equipment_id})
            row = result.fetchone()
            
            if not row:
                logger.warning(f"⚠️ Equipment not found: {equipment_id}")
                return None
            
            data = EquipmentDetailData(
                equipment_id=row.EquipmentId,
                equipment_name=row.EquipmentName,
                line_name=row.LineName,
                status=row.Status,
                status_occurred_at=row.StatusOccurredAt,
                product_model=row.ProductModel,
                lot_id=row.LotId,
                lot_occurred_at=row.LotOccurredAt
            )
            
            logger.info(f"✅ Equipment detail fetched: {equipment_id} -> Status: {data.status}")
            return data
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch equipment detail: {e}")
            raise
    
    def get_equipment_detail_response(
        self,
        frontend_id: str,
        equipment_id: int
    ) -> EquipmentDetailResponse:
        """
        단일 설비 상세 정보 응답 생성
        
        Args:
            frontend_id: Frontend ID (예: 'EQ-17-03')
            equipment_id: DB Equipment ID
        
        Returns:
            EquipmentDetailResponse
        """
        data = self.get_equipment_detail(equipment_id)
        
        if not data:
            # 매핑은 있지만 DB에 데이터가 없는 경우
            return EquipmentDetailResponse(
                frontend_id=frontend_id,
                equipment_id=equipment_id,
                equipment_name=None,
                line_name=None,
                status=None,
                product_model=None,
                lot_id=None,
                last_updated=None
            )
        
        # 마지막 업데이트 시간 결정 (Status와 Lot 중 최신)
        last_updated = None
        if data.status_occurred_at and data.lot_occurred_at:
            last_updated = max(data.status_occurred_at, data.lot_occurred_at)
        elif data.status_occurred_at:
            last_updated = data.status_occurred_at
        elif data.lot_occurred_at:
            last_updated = data.lot_occurred_at
        
        return EquipmentDetailResponse(
            frontend_id=frontend_id,
            equipment_id=data.equipment_id,
            equipment_name=data.equipment_name,
            line_name=data.line_name,
            status=data.status,
            product_model=data.product_model,
            lot_id=data.lot_id,
            last_updated=last_updated
        )
    
    # ========================================================================
    # Multi Equipment Detail (Aggregation)
    # ========================================================================
    
    def get_multi_equipment_detail(
        self,
        equipment_ids: List[int]
    ) -> List[EquipmentDetailData]:
        """
        다중 설비 상세 정보 조회
        
        Args:
            equipment_ids: DB Equipment ID 목록
        
        Returns:
            List[EquipmentDetailData]
        """
        if not equipment_ids:
            return []
        
        logger.info(f"🔍 Fetching multi equipment detail for {len(equipment_ids)} IDs")
        
        # SQL Query: IN 절로 다중 조회
        # 참고: SQLAlchemy text()에서 IN 절은 별도 처리 필요
        placeholders = ", ".join([f":id_{i}" for i in range(len(equipment_ids))])
        
        query = text(f"""
            SELECT 
                e.EquipmentId,
                e.EquipmentName,
                e.LineName,
                es.Status,
                es.OccurredAtUtc AS StatusOccurredAt,
                li.ProductModel,
                li.LotId,
                li.OccurredAtUtc AS LotOccurredAt
            FROM core.Equipment e
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    Status, 
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.EquipmentState
            ) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
            LEFT JOIN (
                SELECT 
                    EquipmentId, 
                    ProductModel, 
                    LotId,
                    OccurredAtUtc,
                    ROW_NUMBER() OVER (
                        PARTITION BY EquipmentId 
                        ORDER BY OccurredAtUtc DESC
                    ) AS rn
                FROM log.Lotinfo
                WHERE IsStart = 1
            ) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
            WHERE e.EquipmentId IN ({placeholders})
        """)
        
        # 파라미터 딕셔너리 생성
        params = {f"id_{i}": eq_id for i, eq_id in enumerate(equipment_ids)}
        
        try:
            result = self.db.execute(query, params)
            rows = result.fetchall()
            
            data_list = []
            for row in rows:
                data_list.append(EquipmentDetailData(
                    equipment_id=row.EquipmentId,
                    equipment_name=row.EquipmentName,
                    line_name=row.LineName,
                    status=row.Status,
                    status_occurred_at=row.StatusOccurredAt,
                    product_model=row.ProductModel,
                    lot_id=row.LotId,
                    lot_occurred_at=row.LotOccurredAt
                ))
            
            logger.info(f"✅ Multi equipment detail fetched: {len(data_list)} records")
            return data_list
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch multi equipment detail: {e}")
            raise
    
    def get_multi_equipment_detail_response(
        self,
        frontend_to_equipment_map: Dict[str, int]
    ) -> MultiEquipmentDetailResponse:
        """
        다중 설비 상세 정보 집계 응답 생성
        
        Args:
            frontend_to_equipment_map: {frontend_id: equipment_id} 매핑
        
        Returns:
            MultiEquipmentDetailResponse (집계 결과)
        """
        equipment_ids = list(frontend_to_equipment_map.values())
        data_list = self.get_multi_equipment_detail(equipment_ids)
        
        # 집계 변수
        lines_set = set()
        status_counter: Dict[str, int] = {}
        products_set = set()
        lot_ids_set = set()
        
        for data in data_list:
            # Line 수집
            if data.line_name:
                lines_set.add(data.line_name)
            
            # Status 카운트
            if data.status:
                status_counter[data.status] = status_counter.get(data.status, 0) + 1
            
            # Product 수집
            if data.product_model:
                products_set.add(data.product_model)
            
            # Lot ID 수집
            if data.lot_id:
                lot_ids_set.add(data.lot_id)
        
        # 리스트 변환 및 최대 3개 제한
        lines = sorted(list(lines_set))
        products = sorted(list(products_set))
        lot_ids = sorted(list(lot_ids_set))
        
        return MultiEquipmentDetailResponse(
            count=len(frontend_to_equipment_map),
            lines=lines[:self.MAX_DISPLAY_ITEMS],
            lines_more=len(lines) > self.MAX_DISPLAY_ITEMS,
            status_counts=status_counter,
            products=products[:self.MAX_DISPLAY_ITEMS],
            products_more=len(products) > self.MAX_DISPLAY_ITEMS,
            lot_ids=lot_ids[:self.MAX_DISPLAY_ITEMS],
            lot_ids_more=len(lot_ids) > self.MAX_DISPLAY_ITEMS
        )
    
    # ========================================================================
    # Utility Methods
    # ========================================================================
    
    def get_equipment_id_by_name(self, equipment_name: str) -> Optional[int]:
        """
        설비명으로 Equipment ID 조회
        
        Args:
            equipment_name: 설비명 (core.Equipment.EquipmentName)
        
        Returns:
            EquipmentId or None
        """
        query = text("""
            SELECT EquipmentId 
            FROM core.Equipment 
            WHERE EquipmentName = :name
        """)
        
        try:
            result = self.db.execute(query, {"name": equipment_name})
            row = result.fetchone()
            return row.EquipmentId if row else None
        except Exception as e:
            logger.error(f"❌ Failed to get equipment ID by name: {e}")
            return None