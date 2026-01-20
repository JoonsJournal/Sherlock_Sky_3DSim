"""
status_watcher.py
설비 상태 변경 감지 백그라운드 서비스

@version 1.0.0
@description
- 10초 주기로 MSSQL 쿼리 실행
- 이전 상태와 비교하여 변경 감지
- 변경 시 WebSocket으로 Delta 브로드캐스트

@changelog
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
수정일: 2026-01-20
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
        poll_interval: Optional[int] = None,
        site_id: int = 1,
        line_id: int = 1
    ):
        """
        StatusWatcher 초기화
        
        Args:
            poll_interval: 감지 주기 (초), None이면 환경변수 사용
            site_id: 대상 Site ID (기본값: 1)
            line_id: 대상 Line ID (기본값: 1)
        """
        self.poll_interval = poll_interval or UDS_POLL_INTERVAL
        self.site_id = site_id
        self.line_id = line_id
        
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._broadcast_func: Optional[Callable[[list], Awaitable[None]]] = None
        
        # 통계
        self._check_count = 0
        self._broadcast_count = 0
        self._error_count = 0
        self._last_check_time: Optional[datetime] = None
        self._last_broadcast_time: Optional[datetime] = None
        
        logger.info(
            f"🚀 StatusWatcher initialized "
            f"(interval={self.poll_interval}s, site={site_id}, line={line_id})"
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
        """
        self._check_count += 1
        self._last_check_time = datetime.utcnow()
        
        try:
            # Diff 계산 (UDSService에서 수행)
            deltas = uds_service.compute_diff(
                self.site_id, 
                self.line_id
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
        
        Returns:
            통계 딕셔너리
        """
        return {
            "running": self._running,
            "poll_interval_seconds": self.poll_interval,
            "site_id": self.site_id,
            "line_id": self.line_id,
            "check_count": self._check_count,
            "broadcast_count": self._broadcast_count,
            "error_count": self._error_count,
            "last_check_time": self._last_check_time.isoformat() if self._last_check_time else None,
            "last_broadcast_time": self._last_broadcast_time.isoformat() if self._last_broadcast_time else None,
            "uds_enabled": UDS_ENABLED
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
        site_id: Optional[int] = None,
        line_id: Optional[int] = None,
        poll_interval: Optional[int] = None
    ):
        """
        런타임 설정 변경
        
        Args:
            site_id: 새 Site ID
            line_id: 새 Line ID
            poll_interval: 새 감시 주기
        """
        if site_id is not None:
            self.site_id = site_id
        if line_id is not None:
            self.line_id = line_id
        if poll_interval is not None:
            self.poll_interval = poll_interval
        
        logger.info(
            f"⚙️ Config updated: site={self.site_id}, line={self.line_id}, "
            f"interval={self.poll_interval}s"
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