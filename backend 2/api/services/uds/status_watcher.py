"""
status_watcher.py
설비 상태 변경 감지 백그라운드 서비스

@version 2.0.0
@description
- 10초 주기로 MSSQL 쿼리 실행
- 이전 상태와 비교하여 변경 감지
- 변경 시 WebSocket으로 Delta 브로드캐스트

🆕 v2.0.0: JSON 매핑 통합 호환
- UDSService가 내부적으로 매핑 처리
- Delta에 frontend_id 포함 (기존과 동일)
- 매핑 갱신 트리거 지원

@changelog
- v2.0.0: 🔧 JSON 매핑 통합 호환 (2026-01-21)
          - UDSService v2.0.0 연동
          - compute_diff()가 equipment_id → frontend_id 변환
          - 매핑 갱신 트리거 메서드 추가
          - ⚠️ API 응답 형식 100% 유지 (하위 호환)
- v1.0.0: 초기 버전
          - asyncio 기반 백그라운드 Task
          - UDSService.compute_diff() 활용
          - broadcast_delta() 통한 WebSocket 전송
          - Graceful shutdown 지원
          - ⚠️ 호환성: main.py lifespan에서 start/stop 호출

@dependencies
- asyncio
- services/uds/uds_service.py
- routers/uds/uds.py (broadcast_delta)

📁 위치: backend/api/services/uds/status_watcher.py
작성일: 2026-01-20
수정일: 2026-01-21
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Callable, Awaitable
import os

from .uds_service import uds_service
from ...models.uds.uds_models import BatchDeltaUpdate, DeltaUpdate

logger = logging.getLogger(__name__)


# =============================================================================
# Feature Flag
# =============================================================================
UDS_ENABLED = os.getenv('UDS_ENABLED', 'true').lower() == 'true'
UDS_POLL_INTERVAL = int(os.getenv('UDS_POLL_INTERVAL', '10'))  # 초 단위


class StatusWatcher:
    """
    설비 상태 변경 감지 백그라운드 서비스
    
    [동작 방식]
    ┌──────────────────────────────────────────────────────────────┐
    │ 1. 10초마다 MSSQL 쿼리 실행 (UDSService.compute_diff)        │
    │ 2. 이전 상태와 비교 (In-Memory 캐시)                          │
    │ 3. 변경 감지 시 WebSocket 브로드캐스트                        │
    └──────────────────────────────────────────────────────────────┘
    
    🆕 v2.0.0: JSON 매핑 통합
    ┌──────────────────────────────────────────────────────────────┐
    │ - UDSService 내부에서 equipment_id → frontend_id 변환        │
    │ - Delta 응답에 frontend_id 포함 (기존과 동일)                 │
    │ - Site 변경 시 매핑 자동 갱신 (UDSService 담당)               │
    └──────────────────────────────────────────────────────────────┘
    
    [사용법]
    ```python
    # main.py lifespan에서
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await status_watcher.start()
        yield
        await status_watcher.stop()
    ```
    
    [설정]
    - UDS_POLL_INTERVAL: 감지 주기 (기본 10초)
    - UDS_ENABLED: Feature Flag
    - site_id, line_id: 대상 Site/Line
    """
    
    def __init__(
        self,
        poll_interval: Optional[int] = None
    ):
        """
        StatusWatcher 초기화
        
        Args:
            poll_interval: 감지 주기 (초), None이면 환경변수 사용
        """
        self.poll_interval = poll_interval or UDS_POLL_INTERVAL
        
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._broadcast_func: Optional[Callable[[list], Awaitable[None]]] = None
        
        # 🆕 v2.0.0: DB Site 연결 정보
        self._db_site: Optional[str] = None
        self._db_name: Optional[str] = None
        
        # 통계
        self._check_count = 0
        self._broadcast_count = 0
        self._error_count = 0
        self._last_check_time: Optional[datetime] = None
        self._last_broadcast_time: Optional[datetime] = None
        
        logger.info(
            f"🚀 StatusWatcher initialized (v2.0.0) "
            f"(interval={self.poll_interval}s)"
        )
    
    # =========================================================================
    # Lifecycle Methods
    # =========================================================================
    
    async def start(self):
        """
        Watcher 시작
        
        main.py의 startup 이벤트에서 호출
        """
        if not UDS_ENABLED:
            logger.warning("⚠️ UDS is disabled. StatusWatcher not started.")
            return
        
        if self._running:
            logger.warning("⚠️ StatusWatcher is already running")
            return
        
        self._running = True
        self._task = asyncio.create_task(self._watch_loop())
        logger.info("✅ StatusWatcher started")
    
    async def stop(self):
        """
        Watcher 정지
        
        main.py의 shutdown 이벤트에서 호출
        Graceful shutdown 지원
        """
        if not self._running:
            return
        
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        
        logger.info(
            f"🛑 StatusWatcher stopped "
            f"(checks={self._check_count}, broadcasts={self._broadcast_count}, errors={self._error_count})"
        )
    
    def set_broadcast_func(self, func: Callable[[list], Awaitable[None]]):
        """
        브로드캐스트 함수 설정
        
        Router 모듈의 broadcast_delta 함수를 주입받음
        (순환 import 방지)
        
        Args:
            func: async def broadcast_delta(deltas: list) -> None
        """
        self._broadcast_func = func
        logger.info("✅ Broadcast function registered")
    
    # =========================================================================
    # 🆕 v2.0.0: 연결 설정
    # =========================================================================
    
    def set_connection(self, db_site: str, db_name: str):
        """
        🆕 v2.0.0: DB 연결 정보 설정
        
        Site 연결 시 호출하여 매핑 로드에 필요한 정보 전달
        
        Args:
            db_site: Site 키 (예: "korea_site1")
            db_name: DB 이름 (예: "line1")
        """
        self._db_site = db_site
        self._db_name = db_name
        
        logger.info(f"⚙️ Connection set: {db_site}_{db_name}")
        
        # UDSService 매핑 갱신 트리거
        site_id = f"{db_site}_{db_name}"
        uds_service.reload_mapping(site_id)
    
    def refresh_mapping(self):
        """
        🆕 v2.0.0: 매핑 강제 갱신
        
        외부에서 매핑 변경 시 호출
        """
        if self._db_site and self._db_name:
            site_id = f"{self._db_site}_{self._db_name}"
            uds_service.reload_mapping(site_id)
            logger.info(f"🔄 Mapping refreshed for {site_id}")
    
    # =========================================================================
    # Main Watch Loop
    # =========================================================================
    
    async def _watch_loop(self):
        """
        메인 감시 루프
        
        poll_interval 간격으로 _check_and_broadcast 실행
        에러 발생해도 루프 계속 유지
        """
        logger.info(f"🔄 Watch loop started (interval={self.poll_interval}s)")
        
        # 초기 대기 (서비스 안정화)
        await asyncio.sleep(2)
        
        while self._running:
            try:
                await self._check_and_broadcast()
                await asyncio.sleep(self.poll_interval)
                
            except asyncio.CancelledError:
                logger.info("🔄 Watch loop cancelled")
                break
            except Exception as e:
                self._error_count += 1
                logger.error(f"❌ Watch loop error: {e}", exc_info=True)
                # 에러 발생해도 계속 실행
                await asyncio.sleep(self.poll_interval)
    
    async def _check_and_broadcast(self):
        """
        변경 감지 및 브로드캐스트
        
        1. UDSService.compute_diff() 호출
        2. 변경 있으면 broadcast_delta() 호출
        
        🔧 v2.0.0 변경사항:
          - UDSService가 내부적으로 equipment_id → frontend_id 변환
          - Delta 응답 형식 동일 (하위 호환)
        """
        self._check_count += 1
        self._last_check_time = datetime.utcnow()
        
        try:
            # 🔧 v2.0.0: compute_diff() 내부에서 매핑 처리
            # Diff 계산 (UDSService에서 수행)
            deltas = uds_service.compute_diff(
                self._db_site,  # 🆕 v2.0.0
                self._db_name   # 🆕 v2.0.0
            )
            
            if not deltas:
                return
            
            # 브로드캐스트
            if self._broadcast_func:
                await self._broadcast_func(deltas)
                self._broadcast_count += 1
                self._last_broadcast_time = datetime.utcnow()
                logger.info(f"📤 Broadcasted {len(deltas)} delta updates")
            else:
                logger.warning("⚠️ No broadcast function registered")
                
        except Exception as e:
            self._error_count += 1
            logger.error(f"❌ Check and broadcast failed: {e}")
    
    # =========================================================================
    # Status Methods
    # =========================================================================
    
    @property
    def is_running(self) -> bool:
        """Watcher 실행 상태"""
        return self._running
    
    def get_stats(self) -> dict:
        """
        Watcher 통계 정보
        
        🆕 v2.0.0: 매핑 정보 추가
        
        Returns:
            통계 딕셔너리
        """
        # 🆕 v2.0.0: UDSService 매핑 정보 포함
        mapping_info = uds_service.get_mapping_info()
        
        return {
            "running": self._running,
            "poll_interval_seconds": self.poll_interval,
            "check_count": self._check_count,
            "broadcast_count": self._broadcast_count,
            "error_count": self._error_count,
            "last_check_time": self._last_check_time.isoformat() if self._last_check_time else None,
            "last_broadcast_time": self._last_broadcast_time.isoformat() if self._last_broadcast_time else None,
            "uds_enabled": UDS_ENABLED,
            # 🆕 v2.0.0: 연결 정보
            "db_site": self._db_site,
            "db_name": self._db_name,
            # 🆕 v2.0.0: 매핑 정보
            "mapping": mapping_info
        }
    
    # =========================================================================
    # Manual Trigger (디버깅/테스트용)
    # =========================================================================
    
    async def trigger_check(self):
        """
        수동 체크 트리거 (디버깅용)
        
        즉시 Diff 검사 및 브로드캐스트 수행
        """
        logger.info("🔄 Manual check triggered")
        await self._check_and_broadcast()
    
    def update_config(
        self, 
        poll_interval: Optional[int] = None,
        db_site: Optional[str] = None,  # 🆕 v2.0.0
        db_name: Optional[str] = None   # 🆕 v2.0.0
    ):
        """
        런타임 설정 변경
        
        🆕 v2.0.0: db_site, db_name 파라미터 추가
        
        Args:
            poll_interval: 새 감시 주기
            db_site: 새 DB Site 키 (v2.0.0)
            db_name: 새 DB 이름 (v2.0.0)
        """
        if poll_interval is not None:
            self.poll_interval = poll_interval
        
        # 🆕 v2.0.0: 연결 정보 변경 시 매핑 갱신
        connection_changed = False
        if db_site is not None and db_site != self._db_site:
            self._db_site = db_site
            connection_changed = True
        if db_name is not None and db_name != self._db_name:
            self._db_name = db_name
            connection_changed = True
        
        if connection_changed:
            self.refresh_mapping()
        
        logger.info(
            f"⚙️ Config updated:interval={self.poll_interval}s,"
            f" db={self._db_site}_{self._db_name}"
        )


# =============================================================================
# 싱글톤 인스턴스
# =============================================================================
status_watcher = StatusWatcher()


# =============================================================================
# Helper Functions (외부 모듈에서 사용)
# =============================================================================

def get_watcher_stats() -> dict:
    """StatusWatcher 통계 조회"""
    return status_watcher.get_stats()


def is_watcher_running() -> bool:
    """Watcher 실행 상태 확인"""
    return status_watcher.is_running


def refresh_watcher_mapping():
    """
    🆕 v2.0.0: 외부에서 매핑 갱신 트리거
    
    사용 예:
        # 매핑 수정 후
        from services.uds.status_watcher import refresh_watcher_mapping
        refresh_watcher_mapping()
    """
    status_watcher.refresh_mapping()