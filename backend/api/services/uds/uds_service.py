"""
uds_service.py
UDS 비즈니스 로직 서비스
MSSQL 직접 연결 + JSON 매핑 로드 + In-Memory 상태 캐시 (Diff용)

@version 2.1.0
@description
- fetch_all_equipments: 배치 쿼리로 전체 설비 조회 (117개)
- fetch_equipment_by_frontend_id: 단일 설비 조회
- compute_diff: 이전 상태와 현재 상태 비교하여 Delta 생성
- calculate_stats: 상태별 통계 계산

🆕 v2.1.0: 실시간 생산량/Tact Time Delta 업데이트
- compute_diff(): PRODUCTION_SNAPSHOT_QUERY, BATCH_TACT_TIME_QUERY 추가
- EquipmentSnapshot에 production_count, tact_time_seconds 포함
- Delta에 생산량/Tact Time 변경사항 실시간 반영
- ⚠️ 하위 호환: 기존 API 응답 형식 100% 유지

🆕 v2.0.0: JSON 매핑 통합
- _load_mapping_config(): Site별 JSON 매핑 파일 로드
- _merge_with_mapping(): SQL 결과 + JSON 매핑 병합
- _parse_frontend_id(): FrontendId → (GridRow, GridCol) 파싱
- equipment_id ↔ frontend_id 역매핑 테이블 관리

@changelog
- v2.1.0: 🆕 실시간 생산량/Tact Time Delta 업데이트 (2026-01-21)
          - compute_diff()에서 PRODUCTION_SNAPSHOT_QUERY 실행
          - compute_diff()에서 BATCH_TACT_TIME_QUERY 실행
          - EquipmentSnapshot에 production_count, tact_time_seconds 필드 사용
          - Delta에 생산량/Tact Time 변경 시 포함
          - ⚠️ 하위 호환: 기존 API 응답 형식 100% 유지
- v2.0.0: 🔧 JSON 매핑 통합 (2026-01-21)
          - core.EquipmentMapping 테이블 제거 (DB에 없음)
          - JSON 파일에서 매핑 정보 로드
          - SQL 결과와 매핑 병합 로직 추가
          - equipment_id ↔ frontend_id 양방향 매핑
          - Site 변경 시 매핑 캐시 자동 갱신
          - ⚠️ 하위 호환: 기존 API 응답 형식 100% 유지
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
수정일: 2026-01-21
"""

from typing import List, Optional, Dict, Any, Tuple
import logging
import json
import os
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
# 🆕 v2.1.0: PRODUCTION_SNAPSHOT_QUERY 추가
from .uds_queries import (
    BATCH_EQUIPMENT_QUERY,
    SINGLE_EQUIPMENT_QUERY,
    PRODUCTION_COUNT_QUERY,
    PRODUCTION_SNAPSHOT_QUERY,  # 🆕 v2.1.0
    BATCH_TACT_TIME_QUERY,
    STATUS_SNAPSHOT_QUERY,
    calculate_memory_usage_percent,
    calculate_disk_usage_percent,
    parse_frontend_id,  # 🆕 v2.0.0
    generate_frontend_id  # 🆕 v2.0.0
)

# DB 연결 Import
from ...database.multi_connection_manager import connection_manager

logger = logging.getLogger(__name__)


# =============================================================================
# 🆕 v2.0.0: 매핑 관련 상수
# =============================================================================
MAPPING_CONFIG_DIR = "config/site_mappings"
DEFAULT_GRID_ROWS = 26
DEFAULT_GRID_COLS = 6


class UDSService:
    """
    Unified Data Store 서비스
    
    [주요 기능]
    1. 전체 설비 배치 조회 (초기 로드)
    2. 단일 설비 조회 (캐시 미스 시)
    3. Diff 감지 및 Delta 생성 (10초 주기)
    4. 상태별 통계 계산
    
    🆕 v2.1.0: 실시간 생산량/Tact Time Delta
    ┌──────────────────────────────────────────────────────────────┐
    │ compute_diff()에서 3개 쿼리 실행:                             │
    │   1. STATUS_SNAPSHOT_QUERY - 상태/CPU/Memory                 │
    │   2. PRODUCTION_SNAPSHOT_QUERY - 생산량 (오늘 기준)          │
    │   3. BATCH_TACT_TIME_QUERY - Tact Time (최근 사이클)         │
    │                                                              │
    │ Delta에 포함되는 필드:                                        │
    │   - status, status_changed_at                                │
    │   - cpu_usage_percent, memory_usage_percent                  │
    │   - production_count (🆕 v2.1.0)                             │
    │   - tact_time_seconds (🆕 v2.1.0)                            │
    └──────────────────────────────────────────────────────────────┘
    
    🆕 v2.0.0: JSON 매핑 통합
    5. Site별 JSON 매핑 파일 로드
    6. SQL 결과 + 매핑 병합
    7. equipment_id ↔ frontend_id 양방향 조회
    
    [In-Memory 캐시]
    - _previous_state: Dict[frontend_id, EquipmentSnapshot]
    - Diff 비교용으로만 사용 (Frontend가 메인 캐시)
    
    🆕 v2.0.0: 매핑 캐시
    - _mapping_cache: Dict[equipment_id, MappingItem]
    - _reverse_mapping: Dict[frontend_id, equipment_id]
    - _current_site_id: 현재 로드된 Site ID
    
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
        
        # ===================================================================
        # 🆕 v2.0.0: 매핑 캐시
        # ===================================================================
        # equipment_id → {frontend_id, equipment_name, grid_row, grid_col, ...}
        self._mapping_cache: Dict[int, Dict[str, Any]] = {}
        
        # frontend_id → equipment_id (역매핑)
        self._reverse_mapping: Dict[str, int] = {}
        
        # 현재 로드된 Site ID
        self._current_site_id: Optional[str] = None
        
        # 매핑 로드 시간
        self._mapping_loaded_at: Optional[datetime] = None
        
        logger.info("🚀 UDSService initialized (v2.1.0 - Realtime Production/TactTime Delta)")
    
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
    # 🆕 v2.0.0: JSON 매핑 로드
    # ========================================================================
    
    def _get_mapping_file_path(self, site_id: str) -> str:
        """
        Site별 매핑 파일 경로
        
        Args:
            site_id: "korea_site1_line1" 형식
            
        Returns:
            "config/site_mappings/equipment_mapping_korea_site1_line1.json"
        """
        return os.path.join(MAPPING_CONFIG_DIR, f"equipment_mapping_{site_id}.json")
    
    def _load_mapping_config(self, site_id: str, force_reload: bool = False) -> bool:
        """
        Site별 JSON 매핑 파일 로드
        
        🆕 v2.0.0: core.EquipmentMapping 테이블 대신 JSON 파일 사용
        
        Args:
            site_id: Site ID (예: "korea_site1_line1")
            force_reload: 강제 재로드 여부
            
        Returns:
            bool: 로드 성공 여부
            
        Note:
            - 캐시된 Site ID와 동일하면 재로드 안 함 (force_reload=False)
            - 파일 없으면 빈 매핑으로 초기화
        """
        # 이미 로드된 경우 스킵
        if not force_reload and self._current_site_id == site_id:
            return True
        
        file_path = self._get_mapping_file_path(site_id)
        
        logger.info(f"📂 Loading mapping config: {file_path}")
        
        # 캐시 초기화
        self._mapping_cache.clear()
        self._reverse_mapping.clear()
        
        if not os.path.exists(file_path):
            logger.warning(f"⚠️ Mapping file not found: {file_path}")
            self._current_site_id = site_id
            self._mapping_loaded_at = datetime.utcnow()
            return False
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            mappings = data.get("mappings", {})
            
            for frontend_id, item in mappings.items():
                equipment_id = item.get("equipment_id")
                if equipment_id is None:
                    continue
                
                # equipment_id → mapping info
                self._mapping_cache[equipment_id] = {
                    "frontend_id": frontend_id,
                    "equipment_name": item.get("equipment_name", ""),
                    "equipment_code": item.get("equipment_code"),
                    "line_name": item.get("line_name"),
                    "grid_row": None,  # 파싱으로 계산
                    "grid_col": None
                }
                
                # GridRow, GridCol 파싱
                grid_row, grid_col = parse_frontend_id(frontend_id)
                self._mapping_cache[equipment_id]["grid_row"] = grid_row
                self._mapping_cache[equipment_id]["grid_col"] = grid_col
                
                # 역매핑: frontend_id → equipment_id
                self._reverse_mapping[frontend_id] = equipment_id
            
            self._current_site_id = site_id
            self._mapping_loaded_at = datetime.utcnow()
            
            logger.info(f"✅ Loaded {len(self._mapping_cache)} mappings for {site_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load mapping config: {e}", exc_info=True)
            self._current_site_id = site_id
            self._mapping_loaded_at = datetime.utcnow()
            return False
    
    def _get_frontend_id(self, equipment_id: int) -> Optional[str]:
        """
        equipment_id → frontend_id 변환
        
        Args:
            equipment_id: DB Equipment ID
            
        Returns:
            frontend_id 또는 None (매핑 없음)
        """
        mapping = self._mapping_cache.get(equipment_id)
        if mapping:
            return mapping.get("frontend_id")
        return None
    
    def _get_equipment_id(self, frontend_id: str) -> Optional[int]:
        """
        frontend_id → equipment_id 변환
        
        Args:
            frontend_id: Frontend ID (예: "EQ-17-03")
            
        Returns:
            equipment_id 또는 None (매핑 없음)
        """
        return self._reverse_mapping.get(frontend_id)
    
    def _get_mapping_info(self, equipment_id: int) -> Optional[Dict[str, Any]]:
        """
        equipment_id로 전체 매핑 정보 조회
        
        Args:
            equipment_id: DB Equipment ID
            
        Returns:
            매핑 정보 딕셔너리 또는 None
            {
                "frontend_id": "EQ-17-03",
                "equipment_name": "CVDF-001",
                "grid_row": 17,
                "grid_col": 3,
                ...
            }
        """
        return self._mapping_cache.get(equipment_id)
    
    def _derive_site_id_from_connection(self, db_site: str = None, db_name: str = None) -> str:
        """
        연결 정보에서 Site ID 유도
        
        Args:
            db_site: Site 키 (예: "korea_site1")
            db_name: DB 이름 (예: "line1")
            
        Returns:
            Site ID (예: "korea_site1_line1")
        """
        # 기본값 사용
        if not db_site:
            db_site = "korea_site1"  # TODO: connection_manager에서 가져오기
        if not db_name:
            db_name = "line1"  # TODO: connection_manager에서 가져오기
        
        return f"{db_site}_{db_name}"
    
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
        
        🔧 v2.0.0 변경사항:
          - SQL 쿼리에서 core.EquipmentMapping JOIN 제거
          - JSON 매핑 파일 로드 후 SQL 결과와 병합
          - ⚠️ API 응답 형식 100% 유지 (하위 호환)
        
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
        
        # ===================================================================
        # 🆕 v2.0.0: 매핑 파일 로드 (Site 변경 시 자동 갱신)
        # ===================================================================
        mapping_site_id = self._derive_site_id_from_connection(db_site, db_name)
        self._load_mapping_config(mapping_site_id)
        
        with self._get_session(db_site, db_name) as session:
            try:
                # =============================================================
                # Step 1: 기본 설비 정보 배치 조회
                # 🔧 v2.0.0: core.EquipmentMapping JOIN 제거됨
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
                # 🔧 v2.0.0: EquipmentId만 반환 (FrontendId 제거)
                # 🐛 v2.1.0: COUNT(ct.Time) 사용 (CycleTimeId 없음)
                # =============================================================
                prod_result = session.execute(
                    text(PRODUCTION_COUNT_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                prod_rows = prod_result.fetchall()
                
                # 🔧 v2.0.0: equipment_id 기반 맵 (기존: frontend_id)
                # Column Index: [0] EquipmentId, [1] ProductionCount
                prod_map = {row[0]: row[1] for row in prod_rows}
                
                logger.info(f"  → 생산량 쿼리: {len(prod_map)}건 조회")
                
                # =============================================================
                # Step 3: Tact Time 배치 조회
                # 🔧 v2.0.0: EquipmentId만 반환 (FrontendId 제거)
                # 🐛 v2.1.0: ct.Time 사용 (StartTime 없음)
                # =============================================================
                tact_result = session.execute(
                    text(BATCH_TACT_TIME_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                tact_rows = tact_result.fetchall()
                
                # 🔧 v2.0.0: equipment_id 기반 맵 (기존: frontend_id)
                # Column Index: [0] EquipmentId, [1] TactTimeSeconds
                tact_map = {row[0]: row[1] for row in tact_rows}
                
                logger.info(f"  → Tact Time 쿼리: {len(tact_map)}건 조회")
                
                # =============================================================
                # Step 4: EquipmentData 변환 + 매핑 병합
                # 🆕 v2.0.0: SQL 결과 + JSON 매핑 병합
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
        
        🔧 v2.0.0 변경사항:
          - frontend_id → equipment_id 변환 (JSON 매핑 사용)
          - equipment_id 기반 SQL 쿼리 실행
          - 결과에 매핑 정보 병합
        
        Args:
            frontend_id: Frontend ID (예: EQ-17-03)
            db_site: MultiConnectionManager Site 키
            db_name: DB 이름
            
        Returns:
            EquipmentData or None: 설비 데이터 (없으면 None)
        """
        logger.info(f"📡 Fetching equipment: {frontend_id}")
        
        # ===================================================================
        # 🆕 v2.0.0: frontend_id → equipment_id 변환
        # ===================================================================
        mapping_site_id = self._derive_site_id_from_connection(db_site, db_name)
        self._load_mapping_config(mapping_site_id)
        
        equipment_id = self._get_equipment_id(frontend_id)
        
        if equipment_id is None:
            logger.warning(f"⚠️ No mapping found for frontend_id: {frontend_id}")
            return None
        
        with self._get_session(db_site, db_name) as session:
            try:
                # 🔧 v2.0.0: equipment_id 기반 조회
                result = session.execute(
                    text(SINGLE_EQUIPMENT_QUERY),
                    {"equipment_id": equipment_id}
                )
                row = result.fetchone()
                
                if not row:
                    logger.warning(f"⚠️ Equipment not found: {frontend_id} (equipment_id={equipment_id})")
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
    # 🆕 v2.0.0: Equipment ID로 설비 조회 (신규)
    # ========================================================================
    
    def fetch_equipment_by_id(
        self,
        equipment_id: int,
        db_site: str = None,
        db_name: str = None
    ) -> Optional[EquipmentData]:
        """
        Equipment ID로 단일 설비 조회
        
        🆕 v2.0.0 신규: equipment_id 기반 직접 조회
        
        Args:
            equipment_id: DB Equipment ID
            db_site: MultiConnectionManager Site 키
            db_name: DB 이름
            
        Returns:
            EquipmentData or None
        """
        logger.info(f"📡 Fetching equipment by ID: {equipment_id}")
        
        mapping_site_id = self._derive_site_id_from_connection(db_site, db_name)
        self._load_mapping_config(mapping_site_id)
        
        with self._get_session(db_site, db_name) as session:
            try:
                result = session.execute(
                    text(SINGLE_EQUIPMENT_QUERY),
                    {"equipment_id": equipment_id}
                )
                row = result.fetchone()
                
                if not row:
                    logger.warning(f"⚠️ Equipment not found: equipment_id={equipment_id}")
                    return None
                
                columns = result.keys()
                row_dict = dict(zip(columns, row))
                
                equipment = self._row_to_equipment_data(row_dict, {}, {})
                
                logger.info(f"✅ Equipment fetched: {equipment.frontend_id} -> {equipment.status}")
                return equipment
                
            except Exception as e:
                logger.error(f"❌ Failed to fetch equipment {equipment_id}: {e}")
                raise
    
    # ========================================================================
    # 🆕 v2.1.0: Diff 계산 - 생산량/Tact Time 실시간 비교 추가
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
        
        🆕 v2.1.0 변경사항:
          - PRODUCTION_SNAPSHOT_QUERY 실행하여 생산량 조회
          - BATCH_TACT_TIME_QUERY 실행하여 Tact Time 조회
          - EquipmentSnapshot에 production_count, tact_time_seconds 포함
          - Delta에 생산량/Tact Time 변경사항 포함
        
        🔧 v2.0.0 변경사항:
          - STATUS_SNAPSHOT_QUERY가 EquipmentId 반환
          - equipment_id → frontend_id 변환 (JSON 매핑)
          - Delta에 frontend_id 포함
        
        [v2.1.0 쿼리 실행 순서]
        ┌──────────────────────────────────────────────────────────────┐
        │ 1. STATUS_SNAPSHOT_QUERY                                     │
        │    → EquipmentId, Status, StatusChangedAt,                   │
        │      CpuUsagePercent, MemoryUsedMb, MemoryTotalMb            │
        │                                                              │
        │ 2. PRODUCTION_SNAPSHOT_QUERY (🆕 v2.1.0)                     │
        │    → EquipmentId, ProductionCount (오늘 00:00 이후)          │
        │                                                              │
        │ 3. BATCH_TACT_TIME_QUERY (🆕 v2.1.0)                         │
        │    → EquipmentId, TactTimeSeconds (최근 사이클)              │
        └──────────────────────────────────────────────────────────────┘
        
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
        
        # ===================================================================
        # 🆕 v2.0.0: 매핑 로드 확인
        # ===================================================================
        mapping_site_id = self._derive_site_id_from_connection(db_site, db_name)
        self._load_mapping_config(mapping_site_id)
        
        with self._get_session(db_site, db_name) as session:
            try:
                # =============================================================
                # Step 1: 상태 스냅샷 조회 (경량 쿼리)
                # =============================================================
                status_result = session.execute(
                    text(STATUS_SNAPSHOT_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                status_rows = status_result.fetchall()
                
                # equipment_id → status 정보 맵
                # Column Index: [0] EquipmentId, [1] Status, [2] StatusChangedAt,
                #               [3] CpuUsagePercent, [4] MemoryUsedMb, [5] MemoryTotalMb
                status_map = {}
                for row in status_rows:
                    equipment_id = row[0]
                    if equipment_id:
                        status_map[equipment_id] = {
                            'status': row[1],
                            'status_changed_at': row[2],
                            'cpu_usage_percent': row[3],
                            'memory_used_mb': row[4],
                            'memory_total_mb': row[5]
                        }
                
                # =============================================================
                # 🆕 v2.1.0 Step 2: 생산량 스냅샷 조회
                # =============================================================
                prod_result = session.execute(
                    text(PRODUCTION_SNAPSHOT_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                prod_rows = prod_result.fetchall()
                
                # equipment_id → production_count 맵
                # Column Index: [0] EquipmentId, [1] ProductionCount
                prod_map = {row[0]: row[1] for row in prod_rows}
                
                logger.debug(f"  → 생산량 Snapshot: {len(prod_map)}건 조회")
                
                # =============================================================
                # 🆕 v2.1.0 Step 3: Tact Time 조회
                # =============================================================
                tact_result = session.execute(
                    text(BATCH_TACT_TIME_QUERY),
                    {"site_id": site_id, "line_id": line_id}
                )
                tact_rows = tact_result.fetchall()
                
                # equipment_id → tact_time_seconds 맵
                # Column Index: [0] EquipmentId, [1] TactTimeSeconds
                tact_map = {row[0]: row[1] for row in tact_rows}
                
                logger.debug(f"  → Tact Time Snapshot: {len(tact_map)}건 조회")
                
                # =============================================================
                # Step 4: Diff 계산
                # =============================================================
                deltas = []
                timestamp = datetime.utcnow()
                
                for equipment_id, status_info in status_map.items():
                    # 🆕 v2.0.0: equipment_id → frontend_id 변환
                    frontend_id = self._get_frontend_id(equipment_id)
                    if not frontend_id:
                        # 매핑 없으면 스킵
                        continue
                    
                    # 🆕 v2.1.0: 생산량, Tact Time 조회
                    production_count = prod_map.get(equipment_id, 0)
                    tact_time_seconds = tact_map.get(equipment_id)
                    
                    # Memory 사용율 계산
                    memory_usage_percent = None
                    if status_info['memory_used_mb'] and status_info['memory_total_mb']:
                        memory_usage_percent = calculate_memory_usage_percent(
                            status_info['memory_used_mb'],
                            status_info['memory_total_mb']
                        )
                    
                    # 🆕 v2.1.0: 현재 스냅샷 생성 (생산량, Tact Time 포함)
                    current = EquipmentSnapshot(
                        frontend_id=frontend_id,
                        status=status_info['status'],
                        status_changed_at=status_info['status_changed_at'],
                        cpu_usage_percent=status_info['cpu_usage_percent'],
                        memory_usage_percent=memory_usage_percent,
                        production_count=production_count,           # 🆕 v2.1.0
                        tact_time_seconds=tact_time_seconds          # 🆕 v2.1.0
                    )
                    
                    # 이전 스냅샷 조회
                    previous = self._previous_state.get(frontend_id)
                    
                    if previous:
                        # Diff 계산 (production_count, tact_time_seconds 포함됨)
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
                    logger.info(f"🔄 Detected {len(deltas)} changes (including production/tact_time)")
                
                return deltas
                
            except Exception as e:
                logger.error(f"❌ Failed to compute diff: {e}", exc_info=True)
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
        logger.info("🗑️ UDS state cache cleared")
    
    def clear_mapping_cache(self):
        """
        🆕 v2.0.0: 매핑 캐시 초기화
        Site 변경 시 또는 매핑 갱신 시 호출
        """
        self._mapping_cache.clear()
        self._reverse_mapping.clear()
        self._current_site_id = None
        self._mapping_loaded_at = None
        logger.info("🗑️ UDS mapping cache cleared")
    
    def clear_all_caches(self):
        """
        🆕 v2.0.0: 모든 캐시 초기화
        """
        self.clear_cache()
        self.clear_mapping_cache()
        logger.info("🗑️ All UDS caches cleared")
    
    def reload_mapping(self, site_id: str = None):
        """
        🆕 v2.0.0: 매핑 강제 재로드
        
        Args:
            site_id: Site ID (None이면 현재 Site)
        """
        target_site = site_id or self._current_site_id
        if target_site:
            self._load_mapping_config(target_site, force_reload=True)
    
    def get_cache_info(self) -> Dict[str, Any]:
        """캐시 상태 정보"""
        return {
            "cached_count": len(self._previous_state),
            "last_fetch_time": self._last_fetch_time.isoformat() if self._last_fetch_time else None,
            "frontend_ids_sample": list(self._previous_state.keys())[:10],
            # 🆕 v2.0.0: 매핑 캐시 정보
            "mapping_cache_count": len(self._mapping_cache),
            "current_site_id": self._current_site_id,
            "mapping_loaded_at": self._mapping_loaded_at.isoformat() if self._mapping_loaded_at else None
        }
    
    def get_mapping_info(self) -> Dict[str, Any]:
        """
        🆕 v2.0.0: 매핑 상태 정보
        """
        return {
            "site_id": self._current_site_id,
            "total_mappings": len(self._mapping_cache),
            "loaded_at": self._mapping_loaded_at.isoformat() if self._mapping_loaded_at else None,
            "equipment_ids_sample": list(self._mapping_cache.keys())[:10],
            "frontend_ids_sample": list(self._reverse_mapping.keys())[:10]
        }
    
    # ========================================================================
    # Private 헬퍼 메서드
    # ========================================================================
    
    def _row_to_equipment_data(
        self,
        row: Dict[str, Any],
        prod_map: Dict[int, int],  # 🔧 v2.0.0: equipment_id 기반
        tact_map: Dict[int, float]  # 🔧 v2.0.0: equipment_id 기반
    ) -> EquipmentData:
        """
        DB Row → EquipmentData 변환
        
        🔧 v2.0.0 변경사항:
          - SQL 결과에 FrontendId, GridRow, GridCol 없음
          - JSON 매핑에서 가져와서 병합
          - 매핑 없는 경우 기본값 사용
        
        BATCH_EQUIPMENT_QUERY 컬럼 인덱스 (v2.0.0):
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
        
        ❌ 제거됨 (v2.0.0):
        13: GridRow          → JSON 매핑에서 가져옴
        14: GridCol          → JSON 매핑에서 가져옴
        15: FrontendId       → JSON 매핑에서 가져옴
        """
        equipment_id = row['EquipmentId']
        
        # ===================================================================
        # 🆕 v2.0.0: JSON 매핑에서 FrontendId, GridRow, GridCol 가져오기
        # ===================================================================
        mapping_info = self._get_mapping_info(equipment_id)
        
        if mapping_info:
            frontend_id = mapping_info.get('frontend_id')
            grid_row = mapping_info.get('grid_row', 0)
            grid_col = mapping_info.get('grid_col', 0)
        else:
            # 매핑 없는 경우: 기본값 또는 equipment_id 기반 생성
            frontend_id = None
            grid_row = 0
            grid_col = 0
            logger.debug(f"⚠️ No mapping for equipment_id={equipment_id}")
        
        # FrontendId 없으면 equipment_id 기반 임시 ID 생성
        if not frontend_id:
            # 임시 ID: EQ-00-{equipment_id} 형식
            frontend_id = f"EQ-00-{equipment_id:02d}"
        
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
        
        # 🔧 v2.0.0: 생산량/Tact Time은 equipment_id로 조회
        production_count = prod_map.get(equipment_id, 0)
        tact_time = tact_map.get(equipment_id)
        
        return EquipmentData(
            equipment_id=equipment_id,
            frontend_id=frontend_id,
            equipment_name=row.get('EquipmentName', ''),
            line_name=row.get('LineName', ''),
            status=status,
            status_changed_at=row.get('StatusChangedAt'),
            product_model=row.get('ProductModel'),
            lot_id=row.get('LotId'),
            lot_start_time=row.get('LotStartTime'),
            production_count=production_count,
            tact_time_seconds=tact_time,
            cpu_usage_percent=row.get('CpuUsagePercent'),
            memory_usage_percent=memory_usage,
            disk_usage_percent=disk_usage,
            grid_row=grid_row,
            grid_col=grid_col
        )
    
    def _update_previous_state(self, equipment: EquipmentData):
        """
        Diff 비교용 이전 상태 업데이트
        
        🆕 v2.1.0: production_count, tact_time_seconds 포함
        """
        self._previous_state[equipment.frontend_id] = EquipmentSnapshot(
            frontend_id=equipment.frontend_id,
            status=equipment.status.value if hasattr(equipment.status, 'value') else equipment.status,
            status_changed_at=equipment.status_changed_at,
            cpu_usage_percent=equipment.cpu_usage_percent,
            memory_usage_percent=equipment.memory_usage_percent,
            production_count=equipment.production_count,          # 🆕 v2.1.0
            tact_time_seconds=equipment.tact_time_seconds         # 🆕 v2.1.0
        )


# =============================================================================
# 싱글톤 인스턴스
# =============================================================================
# 앱 전역에서 동일 인스턴스 사용 (In-Memory 캐시 공유)
uds_service = UDSService()