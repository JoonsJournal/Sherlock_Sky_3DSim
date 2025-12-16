"""
FastAPI 메인 애플리케이션
- REST API 엔드포인트
- WebSocket 서버
- 데이터베이스 연결
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from typing import List
import json
from datetime import datetime

from .routers import equipment, production, monitoring, playback, analytics
from .websocket.connection_manager import ConnectionManager
from .websocket.stream_handler import StreamHandler
from .database.connection import init_db, close_db

# WebSocket 연결 관리자 (전역)
connection_manager = ConnectionManager()
stream_handler = StreamHandler()

# 라이프사이클 관리
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시
    await init_db()
    await connection_manager.start_redis_listener()
    print("✓ 데이터베이스 연결 완료")
    print("✓ Redis 리스너 시작")
    
    yield
    
    # 종료 시
    await connection_manager.stop_redis_listener()
    await close_db()
    print("✓ 리소스 정리 완료")

# FastAPI 앱 생성
app = FastAPI(
    title="SHERLOCK_SKY_3DSIM API",
    description="생산 시스템 모니터링 및 시뮬레이션 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(equipment.router, prefix="/api/equipment", tags=["Equipment"])
app.include_router(production.router, prefix="/api/production", tags=["Production"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(playback.router, prefix="/api/playback", tags=["Playback"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])


# WebSocket 엔드포인트
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """실시간 데이터 스트리밍"""
    await connection_manager.connect(websocket)
    
    try:
        while True:
            # 클라이언트로부터 메시지 수신
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 메시지 타입에 따라 처리
            if message["type"] == "subscribe":
                # 특정 설비 구독
                equipment_ids = message.get("equipment_ids", [])
                await connection_manager.subscribe(websocket, equipment_ids)
                
            elif message["type"] == "unsubscribe":
                equipment_ids = message.get("equipment_ids", [])
                await connection_manager.unsubscribe(websocket, equipment_ids)
                
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
        print(f"클라이언트 연결 종료")


# 헬스체크
@app.get("/health")
async def health_check():
    """서버 상태 확인"""
    return {
        "status": "healthy",
        "active_connections": len(connection_manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }


# 루트
@app.get("/")
async def root():
    """API 정보"""
    return {
        "name": "SHERLOCK_SKY_3DSIM API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }