"""
uds_service.py
UDS 비즈니스 로직 서비스
MSSQL 직접 연결 + In-Memory 상태 캐시 (Diff용)

@version 1.0.0
@description
- fetch_all_equipments: 배치 쿼리로 전체 설비 조회 (117개)
- fetch_equipment_by_frontend_id: 단일 설비 조회
- compute_diff: 이전 상태와 현재 상태 비교하여 Delta 생성
- calculate_stats: 상태별 통계 계산

@changelog
- v1.0.0: 초기 버전
          - MSSQL 직접 연결 (SQLAlchemy sync session)
          - In-Memory 캐시로 Diff 비교
          - 배치/단일 쿼리 지원
          - ⚠️ WITH (NOLOCK) 모든 쿼리에 적용됨

@dependencies
- sqlalchemy
- models/uds/uds_models.py
- services/uds/uds_queries.py
- database/multi_connection_manager.py

📁 위치: backend/api/services/uds/uds_service.py
작성일: 2026-01-20
수정일: 2026-01-20
"""

from typing import List, Optional, Dict, Any, Tuple
import logging
from datetime import datetime
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.orm import Session

# UDS 모델 Import
from ...models.uds.uds_models import (
    EquipmentData,
    EquipmentStatus,
    StatusStats,
    DeltaUpdate,
    EquipmentSnapshot,
    compute_status_stats,
    compute_delta
)

# UDS 쿼리 Import
from .uds_queries import (
    BATCH_EQUIPMENT_QUERY,
    SINGLE_EQUIPMENT_QUERY,
    PRODUCTION_COUNT_QUERY,
    BATCH_TACT_TIME_QUERY,
    STATUS_SNAPSHOT_QUERY,
    calculate_memory_usage_percent,
    calculate_disk_usage_percent
)

# DB 연결 Import
from ...database.multi_connection_manager import connection_manager

logger = logging.getLogger(__name__)


class UDSService:
    """
    Unified Data Store 서비스
    
    [주요 기능]
    1. 전체 설비 배치 조회 (초기 로드)
    2. 단일 설비 조회 (캐시 미스 시)
    3. Diff 감지 및 Delta 생성 (10초 주기)
    4. 상태별 통계 계산
    
    [In-Memory 캐시]
    - _previous_state: Dict[frontend_id, EquipmentSnapshot]
    - Diff 비교용으로만 사용 (Frontend가 메인 캐시)
    
    [DB 연결]
    - MultiConnectionManager 사용 (Site DB 동적 연결)
    - 모든 쿼리 WITH (NOLOCK) 적용
    """
    
    def __init__(self):
        """서비스 초기화"""
        # Diff 비교용 In-Memory 상태 캐시
        self._previous_state: Dict[str, EquipmentSnapshot] = {}
        
        # 마지막 조회 시간 (디버깅용)
        self._last_fetch_time: Optional[datetime] = None
        
        logger.info("🚀 UDSService initialized")
    
    # ========================================================================
    # Context Manager: DB Session
    # ========================================================================
    
    @contextmanager
    def _get_session(self, site_id: str = None, db_name: str = None):
        """
        DB Session Context Manager
        
        Args:
            site_id: Site ID (None이면 기본값)
            db_name: DB 이름 (None이면 기본값)
            
        Yields:
            Session: SQLAlchemy 세션
        """
        session = connection_manager.get_session(site_id, db_name)
        try:
            yield session
        finally:
            session.close()
    
    # ========================================================================
    # 배치 조회: 전체 설비 초기 로드
    # ========================================================================
    
    def fetch_all_equipments(
        self,
        site_id: int = 1,
        line_id: int = 1,
        db_site: str = None,
        db_name: str = None
    ) -> List[EquipmentData]:
        """
        전체 설비 배치 조회 (초기 로드)
        
        GET /api/uds/initial 엔드포인트에서 호출.
        117개 설비 데이터를 한 번의 배치 쿼리로 조회.
        
        Args:
            site_id: Factory Site ID (WHERE 조건)
            line_id: Factory Line ID (WHERE 조건)
            db_site: MultiConnectionManager Site 키 (기본값 사용)
            db_name: DB 이름 (기본값 사용)
            
        Returns:
            List[EquipmentData]: 전체 설비 데이터 목록
            
        Raises:
            Exception: DB 연결 또는 쿼리 실패 시
        """
        logger.info(f"📡 Fetching all equipments (site_id={site_id}, line_id={line_id})")
        start_time = datetime.utcnow()
        
        with self._get_session(db_site, db_name) as session:
            try:
                # =============================================================
                # Step 1: 기본 설비 정보 배치 조회
                # BATCH_EQUIPMENT_QUERY: 4-table JOIN (Equipment, EquipmentState, 
                #                        EquipmentPCInfo, EquipmentMapping)
                # =============================================================
                result = session.execute(
                    text(BATCH_EQUIPMENT_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                rows = result.fetchall()
                columns = result.keys()
                
                logger.info(f"  → 기본 쿼리: {len(rows)}건 조회")
                
                # =============================================================
                # Step 2: 생산량 배치 조회
                # PRODUCTION_COUNT_QUERY: CycleTime COUNT since Lot start
                # =============================================================
                prod_result = session.execute(
                    text(PRODUCTION_COUNT_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                prod_rows = prod_result.fetchall()
                
                # Column Index: [0] EquipmentId, [1] FrontendId, [2] ProductionCount
                prod_map = {row[1]: row[2] for row in prod_rows if row[1]}
                
                logger.info(f"  → 생산량 쿼리: {len(prod_map)}건 조회")
                
                # =============================================================
                # Step 3: Tact Time 배치 조회
                # BATCH_TACT_TIME_QUERY: DATEDIFF between recent 2 CycleTimes
                # =============================================================
                tact_result = session.execute(
                    text(BATCH_TACT_TIME_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                tact_rows = tact_result.fetchall()
                
                # Column Index: [0] EquipmentId, [1] FrontendId, [2] TactTimeSeconds
                tact_map = {row[1]: row[2] for row in tact_rows if row[1]}
                
                logger.info(f"  → Tact Time 쿼리: {len(tact_map)}건 조회")
                
                # =============================================================
                # Step 4: EquipmentData 변환
                # =============================================================
                equipments = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    equipment = self._row_to_equipment_data(
                        row_dict, 
                        prod_map, 
                        tact_map
                    )
                    equipments.append(equipment)
                    
                    # In-Memory 캐시 업데이트 (Diff용)
                    self._update_previous_state(equipment)
                
                # 조회 시간 기록
                self._last_fetch_time = datetime.utcnow()
                elapsed_ms = (self._last_fetch_time - start_time).total_seconds() * 1000
                
                logger.info(f"✅ Loaded {len(equipments)} equipments in {elapsed_ms:.1f}ms")
                return equipments
                
            except Exception as e:
                logger.error(f"❌ Failed to fetch equipments: {e}", exc_info=True)
                raise
    
    # ========================================================================
    # 단일 조회: Frontend ID로 설비 조회
    # ========================================================================
    
    def fetch_equipment_by_frontend_id(
        self,
        frontend_id: str,
        db_site: str = None,
        db_name: str = None
    ) -> Optional[EquipmentData]:
        """
        단일 설비 조회
        
        GET /api/uds/equipment/{frontend_id} 엔드포인트에서 호출.
        ⚠️ Frontend는 UDS 캐시를 먼저 확인하고, 캐시 미스 시에만 호출해야 함.
        
        Args:
            frontend_id: Frontend ID (예: EQ-17-03)
            db_site: MultiConnectionManager Site 키
            db_name: DB 이름
            
        Returns:
            EquipmentData or None: 설비 데이터 (없으면 None)
        """
        logger.info(f"📡 Fetching equipment: {frontend_id}")
        
        with self._get_session(db_site, db_name) as session:
            try:
                result = session.execute(
                    text(SINGLE_EQUIPMENT_QUERY),
                    {"frontend_id": frontend_id}
                )
                row = result.fetchone()
                
                if not row:
                    logger.warning(f"⚠️ Equipment not found: {frontend_id}")
                    return None
                
                columns = result.keys()
                row_dict = dict(zip(columns, row))
                
                # 생산량, Tact Time은 단일 조회 시 미포함 (캐시 사용 권장)
                equipment = self._row_to_equipment_data(row_dict, {}, {})
                
                logger.info(f"✅ Equipment fetched: {frontend_id} -> {equipment.status}")
                return equipment
                
            except Exception as e:
                logger.error(f"❌ Failed to fetch equipment {frontend_id}: {e}")
                raise
    
    # ========================================================================
    # Diff 계산: 변경 감지
    # ========================================================================
    
    def compute_diff(
        self,
        site_id: int = 1,
        line_id: int = 1,
        db_site: str = None,
        db_name: str = None
    ) -> List[DeltaUpdate]:
        """
        이전 상태와 현재 상태 비교하여 Delta 생성
        
        Status Watcher가 10초마다 호출.
        변경된 설비만 Delta로 추출하여 WebSocket 전송.
        
        Args:
            site_id: Factory Site ID
            line_id: Factory Line ID
            db_site: DB Site 키
            db_name: DB 이름
            
        Returns:
            List[DeltaUpdate]: 변경된 설비 Delta 목록 (변경 없으면 빈 리스트)
        """
        if not self._previous_state:
            logger.warning("⚠️ No previous state for diff (run fetch_all first)")
            return []
        
        with self._get_session(db_site, db_name) as session:
            try:
                # 현재 스냅샷 조회 (경량 쿼리)
                result = session.execute(
                    text(STATUS_SNAPSHOT_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                
                deltas = []
                timestamp = datetime.utcnow()
                
                # =============================================================
                # STATUS_SNAPSHOT_QUERY Column Index:
                #  [0] FrontendId
                #  [1] Status
                #  [2] StatusChangedAt
                #  [3] CpuUsagePercent
                #  [4] MemoryUsedMb
                #  [5] MemoryTotalMb
                # =============================================================
                for row in result.fetchall():
                    frontend_id = row[0]
                    if not frontend_id:
                        continue
                    
                    # 현재 스냅샷 생성
                    current = EquipmentSnapshot(
                        frontend_id=frontend_id,
                        status=row[1],
                        status_changed_at=row[2],
                        cpu_usage_percent=row[3],
                        memory_usage_percent=calculate_memory_usage_percent(
                            row[4], row[5]  # MemoryUsedMb, MemoryTotalMb
                        ) if row[4] and row[5] else None
                    )
                    
                    # 이전 스냅샷 조회
                    previous = self._previous_state.get(frontend_id)
                    
                    if previous:
                        # Diff 계산
                        changes = compute_delta(previous, current)
                        
                        if changes:
                            deltas.append(DeltaUpdate(
                                frontend_id=frontend_id,
                                changes=changes,
                                timestamp=timestamp
                            ))
                    
                    # 이전 상태 업데이트
                    self._previous_state[frontend_id] = current
                
                if deltas:
                    logger.info(f"🔄 Detected {len(deltas)} changes")
                
                return deltas
                
            except Exception as e:
                logger.error(f"❌ Failed to compute diff: {e}")
                return []
    
    # ========================================================================
    # 통계 계산
    # ========================================================================
    
    def calculate_stats(self, equipments: List[EquipmentData]) -> StatusStats:
        """
        설비 목록에서 상태별 통계 계산
        
        Args:
            equipments: EquipmentData 목록
            
        Returns:
            StatusStats: 상태별 카운트
        """
        return compute_status_stats(equipments)
    
    # ========================================================================
    # 캐시 관리
    # ========================================================================
    
    def clear_cache(self):
        """In-Memory 캐시 초기화 (테스트/리셋용)"""
        self._previous_state.clear()
        self._last_fetch_time = None
        logger.info("🗑️ UDS cache cleared")
    
    def get_cache_info(self) -> Dict[str, Any]:
        """캐시 상태 정보"""
        return {
            "cached_count": len(self._previous_state),
            "last_fetch_time": self._last_fetch_time.isoformat() if self._last_fetch_time else None,
            "frontend_ids_sample": list(self._previous_state.keys())[:10]  # 샘플 10개
        }
    
    # ========================================================================
    # Private 헬퍼 메서드
    # ========================================================================
    
    def _row_to_equipment_data(
        self,
        row: Dict[str, Any],
        prod_map: Dict[str, int],
        tact_map: Dict[str, float]
    ) -> EquipmentData:
        """
        DB Row → EquipmentData 변환
        
        BATCH_EQUIPMENT_QUERY 컬럼 인덱스:
        ─────────────────────────────────────
         0: EquipmentId      (core.Equipment)
         1: EquipmentName    (core.Equipment)
         2: LineName         (core.Equipment)
         3: Status           (log.EquipmentState)
         4: StatusChangedAt  (log.EquipmentState)
         5: ProductModel     (log.Lotinfo)
         6: LotId            (log.Lotinfo)
         7: LotStartTime     (log.Lotinfo)
         8: CpuUsagePercent  (log.EquipmentPCInfo)
         9: MemoryTotalMb    (log.EquipmentPCInfo)
        10: MemoryUsedMb     (log.EquipmentPCInfo)
        11: DisksTotalGb     (log.EquipmentPCInfo)
        12: DisksUsedGb      (log.EquipmentPCInfo)
        13: GridRow          (core.EquipmentMapping)
        14: GridCol          (core.EquipmentMapping)
        15: FrontendId       (core.EquipmentMapping)
        """
        # FrontendId 결정 (없으면 Grid 기반 생성)
        frontend_id = row.get('FrontendId')
        if not frontend_id:
            grid_row = row.get('GridRow', 0) or 0
            grid_col = row.get('GridCol', 0) or 0
            frontend_id = f"EQ-{grid_row:02d}-{grid_col:02d}"
        
        # Status Enum 변환
        status_str = row.get('Status') or 'DISCONNECTED'
        try:
            status = EquipmentStatus(status_str)
        except ValueError:
            status = EquipmentStatus.DISCONNECTED
        
        # Memory/Disk 사용율 계산
        memory_usage = None
        if row.get('MemoryTotalMb') and row.get('MemoryUsedMb'):
            memory_usage = calculate_memory_usage_percent(
                row['MemoryUsedMb'],
                row['MemoryTotalMb']
            )
        
        disk_usage = None
        if row.get('DisksTotalGb') and row.get('DisksUsedGb'):
            disk_usage = calculate_disk_usage_percent(
                row['DisksUsedGb'],
                row['DisksTotalGb']
            )
        
        return EquipmentData(
            equipment_id=row['EquipmentId'],
            frontend_id=frontend_id,
            equipment_name=row.get('EquipmentName', ''),
            line_name=row.get('LineName', ''),
            status=status,
            status_changed_at=row.get('StatusChangedAt'),
            product_model=row.get('ProductModel'),
            lot_id=row.get('LotId'),
            lot_start_time=row.get('LotStartTime'),
            production_count=prod_map.get(frontend_id, 0),
            tact_time_seconds=tact_map.get(frontend_id),
            cpu_usage_percent=row.get('CpuUsagePercent'),
            memory_usage_percent=memory_usage,
            disk_usage_percent=disk_usage,
            grid_row=row.get('GridRow', 0) or 0,
            grid_col=row.get('GridCol', 0) or 0
        )
    
    def _update_previous_state(self, equipment: EquipmentData):
        """Diff 비교용 이전 상태 업데이트"""
        self._previous_state[equipment.frontend_id] = EquipmentSnapshot(
            frontend_id=equipment.frontend_id,
            status=equipment.status.value if hasattr(equipment.status, 'value') else equipment.status,
            status_changed_at=equipment.status_changed_at,
            cpu_usage_percent=equipment.cpu_usage_percent,
            memory_usage_percent=equipment.memory_usage_percent,
            production_count=equipment.production_count,
            tact_time_seconds=equipment.tact_time_seconds
        )


# =============================================================================
# 싱글톤 인스턴스
# =============================================================================
# 앱 전역에서 동일 인스턴스 사용 (In-Memory 캐시 공유)
uds_service = UDSService()