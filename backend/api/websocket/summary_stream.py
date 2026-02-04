"""
summary_stream.py
Site Summary 데이터 스트리밍 서비스

@version 1.0.0
@changelog
- v1.0.0: Phase 3 - WebSocket Pool Manager Backend 구현 (2026-02-04)
          - Summary/Full 데이터 스트리밍
          - Timer 기반 주기적 전송
          - Delta Update 계산
          - ⚠️ 호환성: 기존 status_watcher.py 패턴 유지

@dependencies
- ../database/multi_connection_manager.py (MultiConnectionManager)
- ../services/uds/uds_service.py (UDSService)
- ./multi_site_handler.py (MultiSiteWebSocketHandler)

작성일: 2026-02-04
수정일: 2026-02-04
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timezone
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


# ============================================
# Data Classes
# ============================================

@dataclass
class SiteSummaryData:
    """Site 요약 데이터"""
    site_id: str
    status: str  # "ready", "setup_required", "error"
    has_layout: bool
    has_mapping: bool
    process: Optional[str] = None
    stats: Optional[Dict[str, int]] = None
    production: int = 0
    alarms: int = 0
    critical_equipments: List[Dict] = field(default_factory=list)
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        return {
            "site_id": self.site_id,
            "status": self.status,
            "has_layout": self.has_layout,
            "has_mapping": self.has_mapping,
            "process": self.process,
            "stats": self.stats or {"total": 0, "run": 0, "idle": 0, "stop": 0, "disc": 0},
            "production": self.production,
            "alarms": self.alarms,
            "critical_equipments": self.critical_equipments,
            "last_updated": self.last_updated.isoformat()
        }


@dataclass
class EquipmentDelta:
    """설비 상태 변경 (Delta)"""
    frontend_id: str
    equipment_id: int
    changes: Dict[str, Any]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        return {
            "frontend_id": self.frontend_id,
            "equipment_id": self.equipment_id,
            "changes": self.changes,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class SiteFullData:
    """Site Full 데이터 (Delta Update)"""
    site_id: str
    updates: List[EquipmentDelta] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리 변환"""
        return {
            "type": "delta",
            "site_id": self.site_id,
            "timestamp": self.timestamp.isoformat(),
            "data": {
                "updates": [u.to_dict() for u in self.updates]
            }
        }


# ============================================
# SiteDataCache
# ============================================

class SiteDataCache:
    """
    Site 데이터 캐시
    
    이전 상태를 저장하여 Delta 계산에 활용
    """
    
    def __init__(self, site_id: str):
        self.site_id = site_id
        self._previous_state: Dict[int, Dict[str, Any]] = {}
        self._last_summary: Optional[SiteSummaryData] = None
        self._last_update: Optional[datetime] = None
    
    def update_state(self, current_state: Dict[int, Dict[str, Any]]) -> List[EquipmentDelta]:
        """
        상태 업데이트 및 Delta 계산
        
        Args:
            current_state: 현재 설비 상태 (equipment_id -> data)
        
        Returns:
            List[EquipmentDelta]: 변경된 항목들
        """
        deltas = []
        
        for eq_id, current in current_state.items():
            previous = self._previous_state.get(eq_id)
            
            if previous is None:
                # 새로운 설비
                deltas.append(EquipmentDelta(
                    frontend_id=current.get("frontend_id", f"EQ-{eq_id}"),
                    equipment_id=eq_id,
                    changes=current
                ))
            else:
                # 변경 확인
                changes = self._detect_changes(previous, current)
                if changes:
                    deltas.append(EquipmentDelta(
                        frontend_id=current.get("frontend_id", f"EQ-{eq_id}"),
                        equipment_id=eq_id,
                        changes=changes
                    ))
        
        # 상태 저장
        self._previous_state = current_state.copy()
        self._last_update = datetime.now(timezone.utc)
        
        return deltas
    
    def _detect_changes(
        self,
        previous: Dict[str, Any],
        current: Dict[str, Any]
    ) -> Dict[str, Any]:
        """변경 항목 감지"""
        changes = {}
        
        # 비교할 필드들
        compare_fields = [
            "status", "alarm_code", "cpu", "memory",
            "production_count", "tact_time", "lot_code"
        ]
        
        for field in compare_fields:
            prev_val = previous.get(field)
            curr_val = current.get(field)
            
            if prev_val != curr_val:
                changes[field] = curr_val
        
        return changes
    
    def set_summary(self, summary: SiteSummaryData):
        """Summary 데이터 설정"""
        self._last_summary = summary
    
    def get_last_summary(self) -> Optional[SiteSummaryData]:
        """마지막 Summary 반환"""
        return self._last_summary
    
    def clear(self):
        """캐시 초기화"""
        self._previous_state.clear()
        self._last_summary = None
        self._last_update = None


# ============================================
# SummaryStreamService
# ============================================

class SummaryStreamService:
    """
    Summary 데이터 스트리밍 서비스
    
    주기적으로 Site 데이터를 수집하여 WebSocket으로 브로드캐스트
    
    Usage:
        service = SummaryStreamService()
        
        # 스트림 시작
        await service.start_stream("CN_AAAA", "summary", 30000)
        
        # 스트림 중지
        await service.stop_stream("CN_AAAA")
    """
    
    def __init__(self, ws_handler=None, connection_manager=None):
        """
        Args:
            ws_handler: MultiSiteWebSocketHandler 인스턴스
            connection_manager: MultiConnectionManager 인스턴스
        """
        self._ws_handler = ws_handler
        self._connection_manager = connection_manager
        
        # Site별 캐시
        self._caches: Dict[str, SiteDataCache] = {}
        
        # 스트리밍 작업
        self._stream_tasks: Dict[str, asyncio.Task] = {}
        
        # 활성 Site
        self._active_sites: Set[str] = set()
        
        # 실행 중 플래그
        self._running = False
        
        logger.info("📡 SummaryStreamService 초기화됨")
    
    # ============================================
    # 캐시 관리
    # ============================================
    
    def _get_cache(self, site_id: str) -> SiteDataCache:
        """Site 캐시 조회 또는 생성"""
        if site_id not in self._caches:
            self._caches[site_id] = SiteDataCache(site_id)
        return self._caches[site_id]
    
    def _clear_cache(self, site_id: str):
        """Site 캐시 삭제"""
        if site_id in self._caches:
            self._caches[site_id].clear()
            del self._caches[site_id]
    
    # ============================================
    # 스트림 관리
    # ============================================
    
    async def start_stream(
        self,
        site_id: str,
        stream_type: str,
        interval_ms: int
    ):
        """
        스트림 시작
        
        Args:
            site_id: Site ID
            stream_type: "summary" 또는 "full"
            interval_ms: 간격 (밀리초)
        """
        task_key = f"{site_id}:{stream_type}"
        
        # 기존 작업이 있으면 중지
        await self.stop_stream(site_id, stream_type)
        
        # 새 작업 시작
        if stream_type == "summary":
            task = asyncio.create_task(
                self._summary_stream_loop(site_id, interval_ms)
            )
        else:
            task = asyncio.create_task(
                self._full_stream_loop(site_id, interval_ms)
            )
        
        self._stream_tasks[task_key] = task
        self._active_sites.add(site_id)
        
        logger.info(f"▶️ 스트림 시작: {task_key} ({interval_ms}ms)")
    
    async def stop_stream(self, site_id: str, stream_type: Optional[str] = None):
        """
        스트림 중지
        
        Args:
            site_id: Site ID
            stream_type: "summary", "full" 또는 None (전체)
        """
        if stream_type:
            task_keys = [f"{site_id}:{stream_type}"]
        else:
            task_keys = [f"{site_id}:summary", f"{site_id}:full"]
        
        for task_key in task_keys:
            task = self._stream_tasks.pop(task_key, None)
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                logger.info(f"⏹️ 스트림 중지: {task_key}")
        
        # 더 이상 해당 Site의 스트림이 없으면 제거
        if not any(k.startswith(site_id) for k in self._stream_tasks):
            self._active_sites.discard(site_id)
    
    async def stop_all_streams(self):
        """모든 스트림 중지"""
        for task_key, task in list(self._stream_tasks.items()):
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        self._stream_tasks.clear()
        self._active_sites.clear()
        logger.info("⏹️ 모든 스트림 중지됨")
    
    # ============================================
    # 스트림 루프
    # ============================================
    
    async def _summary_stream_loop(self, site_id: str, interval_ms: int):
        """Summary 스트림 루프"""
        interval_sec = interval_ms / 1000
        
        while True:
            try:
                # Summary 데이터 수집
                summary = await self._fetch_site_summary(site_id)
                
                if summary and self._ws_handler:
                    # WebSocket 브로드캐스트
                    message = {
                        "type": "summary",
                        **summary.to_dict()
                    }
                    
                    from .multi_site_handler import SubscriptionType
                    await self._ws_handler.broadcast_to_room(
                        site_id, message, SubscriptionType.SUMMARY
                    )
                
                await asyncio.sleep(interval_sec)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Summary 스트림 에러 ({site_id}): {e}")
                await asyncio.sleep(5)  # 에러 시 5초 대기
    
    async def _full_stream_loop(self, site_id: str, interval_ms: int):
        """Full (Delta) 스트림 루프"""
        interval_sec = interval_ms / 1000
        cache = self._get_cache(site_id)
        
        while True:
            try:
                # Full 데이터 수집
                current_state = await self._fetch_site_full_data(site_id)
                
                if current_state:
                    # Delta 계산
                    deltas = cache.update_state(current_state)
                    
                    if deltas and self._ws_handler:
                        # WebSocket 브로드캐스트
                        full_data = SiteFullData(
                            site_id=site_id,
                            updates=deltas
                        )
                        
                        from .multi_site_handler import SubscriptionType
                        await self._ws_handler.broadcast_to_room(
                            site_id, full_data.to_dict(), SubscriptionType.FULL
                        )
                
                await asyncio.sleep(interval_sec)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Full 스트림 에러 ({site_id}): {e}")
                await asyncio.sleep(5)  # 에러 시 5초 대기
    
    # ============================================
    # 데이터 수집
    # ============================================
    
    async def _fetch_site_summary(self, site_id: str) -> Optional[SiteSummaryData]:
        """
        Site Summary 데이터 수집
        
        Args:
            site_id: Site ID
        
        Returns:
            SiteSummaryData: Summary 데이터 (실패 시 None)
        """
        try:
            # TODO: 실제 DB 조회 구현
            # connection_manager를 통해 Site DB에서 데이터 조회
            
            # Mock 데이터 (개발용)
            import random
            
            summary = SiteSummaryData(
                site_id=site_id,
                status="ready",
                has_layout=True,
                has_mapping=True,
                process="Cutting" if "Cutting" in site_id else "Stacking",
                stats={
                    "total": 117,
                    "run": random.randint(80, 100),
                    "idle": random.randint(10, 25),
                    "stop": random.randint(2, 10),
                    "disc": random.randint(0, 5)
                },
                production=random.randint(10000, 20000),
                alarms=random.randint(0, 5),
                critical_equipments=[]
            )
            
            cache = self._get_cache(site_id)
            cache.set_summary(summary)
            
            return summary
            
        except Exception as e:
            logger.error(f"❌ Summary 수집 실패 ({site_id}): {e}")
            return None
    
    async def _fetch_site_full_data(self, site_id: str) -> Optional[Dict[int, Dict[str, Any]]]:
        """
        Site Full 데이터 수집
        
        Args:
            site_id: Site ID
        
        Returns:
            Dict[equipment_id, data]: 설비별 데이터
        """
        try:
            # TODO: 실제 DB 조회 구현
            # UDS Service를 통해 데이터 조회
            
            # Mock 데이터 (개발용)
            import random
            
            equipment_count = 117
            data = {}
            
            for eq_id in range(1, equipment_count + 1):
                statuses = ["RUN", "IDLE", "STOP", "DISC"]
                weights = [0.7, 0.15, 0.1, 0.05]
                
                data[eq_id] = {
                    "equipment_id": eq_id,
                    "frontend_id": f"EQ-{(eq_id - 1) // 6 + 1:02d}-{(eq_id - 1) % 6 + 1:02d}",
                    "status": random.choices(statuses, weights=weights)[0],
                    "cpu": round(random.uniform(20, 80), 1),
                    "memory": round(random.uniform(40, 90), 1),
                    "production_count": random.randint(100, 500),
                    "tact_time": round(random.uniform(8, 15), 2)
                }
            
            return data
            
        except Exception as e:
            logger.error(f"❌ Full 데이터 수집 실패 ({site_id}): {e}")
            return None
    
    # ============================================
    # 상태 조회
    # ============================================
    
    def get_status(self) -> Dict[str, Any]:
        """서비스 상태 조회"""
        return {
            "active_sites": list(self._active_sites),
            "active_streams": list(self._stream_tasks.keys()),
            "cache_count": len(self._caches),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def is_streaming(self, site_id: str, stream_type: Optional[str] = None) -> bool:
        """스트리밍 중인지 확인"""
        if stream_type:
            return f"{site_id}:{stream_type}" in self._stream_tasks
        return any(k.startswith(site_id) for k in self._stream_tasks)


# ============================================
# 싱글톤 인스턴스
# ============================================

_stream_service: Optional[SummaryStreamService] = None


def get_summary_stream_service(
    ws_handler=None,
    connection_manager=None
) -> SummaryStreamService:
    """SummaryStreamService 싱글톤 반환"""
    global _stream_service
    
    if _stream_service is None:
        _stream_service = SummaryStreamService(ws_handler, connection_manager)
    
    return _stream_service


# ============================================
# 편의 함수
# ============================================

async def start_site_stream(
    site_id: str,
    stream_type: str = "summary",
    interval_ms: int = 30000
):
    """Site 스트림 시작 (편의 함수)"""
    service = get_summary_stream_service()
    await service.start_stream(site_id, stream_type, interval_ms)


async def stop_site_stream(site_id: str, stream_type: Optional[str] = None):
    """Site 스트림 중지 (편의 함수)"""
    service = get_summary_stream_service()
    await service.stop_stream(site_id, stream_type)
