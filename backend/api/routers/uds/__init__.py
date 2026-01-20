"""
backend/api/routers/uds/__init__.py
UDS 라우터 패키지 초기화

@version 1.1.0
@changelog
- v1.1.0: Day 3 - broadcast_delta, get_connected_clients_count export 추가
          - Status Watcher에서 브로드캐스트 함수 사용
          - ⚠️ 호환성: 기존 router, connected_clients export 100% 유지
- v1.0.0: 초기 버전 (router, connected_clients export)

작성일: 2026-01-20
수정일: 2026-01-20
"""

from .uds import (
    router,
    connected_clients,
    broadcast_delta,
    get_connected_clients_count,
    ws_manager,
)

__all__ = [
    # Router
    'router',
    
    # WebSocket 관련
    'connected_clients',
    'ws_manager',
    
    # Broadcast 함수 (Status Watcher에서 사용)
    'broadcast_delta',
    'get_connected_clients_count',
]