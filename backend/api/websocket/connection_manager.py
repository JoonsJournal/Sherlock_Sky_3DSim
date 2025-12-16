"""
WebSocket 연결 관리
- 클라이언트 연결 관리
- Redis Pub/Sub 리스너
- 실시간 데이터 브로드캐스트
"""

from fastapi import WebSocket
from typing import List, Dict, Set
import json
import asyncio
from ..database.connection import get_redis


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        self.redis_listener_task = None
        
    async def connect(self, websocket: WebSocket):
        """클라이언트 연결"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()
        print(f"✓ WebSocket 연결: {len(self.active_connections)}개 활성")
        
    def disconnect(self, websocket: WebSocket):
        """클라이언트 연결 해제"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        print(f"✓ WebSocket 연결 해제: {len(self.active_connections)}개 활성")
        
    async def subscribe(self, websocket: WebSocket, equipment_ids: List[str]):
        """특정 장비 구독"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(equipment_ids)
            await websocket.send_json({
                "type": "subscribed",
                "equipment_ids": equipment_ids,
                "message": f"{len(equipment_ids)}개 장비 구독 완료"
            })
        
    async def unsubscribe(self, websocket: WebSocket, equipment_ids: List[str]):
        """특정 장비 구독 해제"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].difference_update(equipment_ids)
            await websocket.send_json({
                "type": "unsubscribed",
                "equipment_ids": equipment_ids
            })
    
    async def broadcast(self, message: dict):
        """모든 연결된 클라이언트에게 메시지 전송"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"✗ 브로드캐스트 실패: {e}")
                disconnected.append(connection)
        
        # 연결 끊긴 클라이언트 제거
        for connection in disconnected:
            self.disconnect(connection)
    
    async def send_to_subscribed(self, equipment_id: str, message: dict):
        """특정 장비를 구독한 클라이언트에게만 전송"""
        disconnected = []
        for connection in self.active_connections:
            if equipment_id in self.subscriptions.get(connection, set()):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"✗ 전송 실패: {e}")
                    disconnected.append(connection)
        
        # 연결 끊긴 클라이언트 제거
        for connection in disconnected:
            self.disconnect(connection)
    
    async def start_redis_listener(self):
        """Redis Pub/Sub 리스너 시작"""
        self.redis_listener_task = asyncio.create_task(self._redis_listener())
        print("✓ Redis 리스너 시작")
    
    async def stop_redis_listener(self):
        """Redis 리스너 중지"""
        if self.redis_listener_task:
            self.redis_listener_task.cancel()
            try:
                await self.redis_listener_task
            except asyncio.CancelledError:
                pass
        print("✓ Redis 리스너 중지")
    
    async def _redis_listener(self):
        """Redis로부터 실시간 데이터 수신"""
        try:
            redis_client = get_redis()
            pubsub = redis_client.pubsub()
            await pubsub.subscribe('equipment_updates')
            
            print("✓ Redis 채널 'equipment_updates' 구독 시작")
            
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        equipment_id = data.get('equipment_id')
                        
                        # 해당 장비를 구독한 클라이언트에게 전송
                        if equipment_id:
                            await self.send_to_subscribed(equipment_id, data)
                        else:
                            # 장비 ID가 없으면 모든 클라이언트에게 전송
                            await self.broadcast(data)
                            
                    except json.JSONDecodeError:
                        print("✗ JSON 파싱 실패")
                    except Exception as e:
                        print(f"✗ 메시지 처리 실패: {e}")
                        
        except asyncio.CancelledError:
            print("✓ Redis 리스너 취소됨")
        except Exception as e:
            print(f"✗ Redis 리스너 오류: {e}")s