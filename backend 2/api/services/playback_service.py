"""
히스토리 재생 서비스
- 과거 데이터 조회 및 스트리밍
- 배속 조절 (2x, 10x, 20x)
"""

from datetime import datetime, timedelta
from typing import List, Dict
import asyncio
import numpy as np
from sqlalchemy import select
from ..database.connection import get_db
from ..routers.playback import PlaybackSession, PlaybackSpeed

class PlaybackService:
    """히스토리 재생 서비스"""
    
    def __init__(self):
        self.active_sessions: Dict[str, PlaybackSession] = {}
        
    async def create_session(
        self,
        start_time: datetime,
        end_time: datetime,
        equipment_ids: List[str] = None,
        speed: PlaybackSpeed = PlaybackSpeed.NORMAL
    ) -> str:
        """재생 세션 생성"""
        
        session_id = f"session_{datetime.now().timestamp()}"
        
        # 데이터 로드
        data = await self._load_historical_data(
            start_time, end_time, equipment_ids
        )
        
        session = PlaybackSession(
            id=session_id,
            start_time=start_time,
            end_time=end_time,
            equipment_ids=equipment_ids or [],
            speed=speed,
            data=data,
            current_position=start_time,
            status="ready"
        )
        
        self.active_sessions[session_id] = session
        
        return session_id
        
    async def _load_historical_data(
        self,
        start_time: datetime,
        end_time: datetime,
        equipment_ids: List[str] = None
    ) -> Dict:
        """히스토리 데이터 로드"""
        
        # TimescaleDB에서 집계된 데이터 조회
        async with get_db() as db:
            # 1분 집계 데이터 사용
            query = """
                SELECT 
                    bucket as timestamp,
                    equipment_id,
                    avg_temperature,
                    avg_oee,
                    sample_count
                FROM equipment_status_1min
                WHERE bucket BETWEEN $1 AND $2
            """
            
            if equipment_ids:
                query += " AND equipment_id = ANY($3)"
                params = [start_time, end_time, equipment_ids]
            else:
                params = [start_time, end_time]
                
            query += " ORDER BY bucket ASC"
            
            result = await db.fetch(query, *params)
            
        # 데이터 구조화
        data = {}
        for row in result:
            eq_id = row['equipment_id']
            if eq_id not in data:
                data[eq_id] = []
                
            data[eq_id].append({
                'timestamp': row['timestamp'].isoformat(),
                'temperature': float(row['avg_temperature']),
                'oee': float(row['avg_oee']),
                'sample_count': int(row['sample_count'])
            })
            
        return data
        
    async def play(self, session_id: str, websocket):
        """재생 시작"""
        
        session = self.active_sessions.get(session_id)
        if not session:
            raise ValueError("세션을 찾을 수 없습니다")
            
        session.status = "playing"
        
        # 재생 루프
        while session.current_position < session.end_time and session.status == "playing":
            # 현재 시간의 데이터 전송
            data_to_send = self._get_data_at_position(session)
            
            if data_to_send:
                await websocket.send_json({
                    "type": "playback_data",
                    "session_id": session_id,
                    "timestamp": session.current_position.isoformat(),
                    "data": data_to_send,
                    "progress": self._calculate_progress(session)
                })
            
            # 다음 위치로 이동 (1분씩)
            session.current_position += timedelta(minutes=1)
            
            # 배속에 따른 대기 시간
            # 1분 데이터를 speed배로 재생
            # Normal(1x): 60초 대기 (실제 시간)
            # Fast2x: 30초 대기
            # Fast10x: 6초 대기
            # Fast20x: 3초 대기
            wait_time = 60 / session.speed.value
            await asyncio.sleep(wait_time)
            
        session.status = "completed"
        
    def _get_data_at_position(self, session: PlaybackSession) -> Dict:
        """특정 시간의 데이터 추출"""
        result = {}
        
        for eq_id, data_points in session.data.items():
            # 현재 위치에 가장 가까운 데이터 찾기
            target_time = session.current_position
            
            # 이진 검색으로 효율적으로 찾기
            closest_point = min(
                data_points,
                key=lambda x: abs(
                    datetime.fromisoformat(x['timestamp']) - target_time
                )
            )
            
            result[eq_id] = closest_point
            
        return result
        
    def _calculate_progress(self, session: PlaybackSession) -> float:
        """재생 진행률 계산"""
        total_duration = (session.end_time - session.start_time).total_seconds()
        elapsed = (session.current_position - session.start_time).total_seconds()
        return round((elapsed / total_duration) * 100, 2)
        
    async def pause(self, session_id: str):
        """재생 일시 정지"""
        session = self.active_sessions.get(session_id)
        if session:
            session.status = "paused"
            
    async def resume(self, session_id: str):
        """재생 재개"""
        session = self.active_sessions.get(session_id)
        if session:
            session.status = "playing"
            
    async def stop(self, session_id: str):
        """재생 중지 및 세션 삭제"""
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            
    async def set_speed(self, session_id: str, speed: PlaybackSpeed):
        """재생 속도 변경"""
        session = self.active_sessions.get(session_id)
        if session:
            session.speed = speed