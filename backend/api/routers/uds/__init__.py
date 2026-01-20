"""
UDS Routers Package
UDS API 라우터 모듈 패키지

@version 1.0.0
@description
- UDS Router: REST API + WebSocket 엔드포인트

API Endpoints:
- GET  /api/uds/health      : 서비스 상태 확인
- GET  /api/uds/initial     : 전체 설비 초기 데이터
- GET  /api/uds/equipment/{frontend_id} : 단일 설비 상세
- GET  /api/uds/stats       : 캐시 통계
- WS   /api/uds/stream      : Delta Update 스트림
- POST /api/uds/refresh     : 강제 갱신

@exports
- router (FastAPI APIRouter)
- broadcast_delta (WebSocket 브로드캐스트)
- get_connected_clients_count (연결 수)
- connected_clients (연결된 클라이언트 Set)

📁 위치: backend/api/routers/uds/__init__.py
작성일: 2026-01-20
수정일: 2026-01-20
"""

from .uds import (
    router,
    broadcast_delta,
    get_connected_clients_count,
    connected_clients
)

__all__ = [
    'router',
    'broadcast_delta',
    'get_connected_clients_count',
    'connected_clients'
]