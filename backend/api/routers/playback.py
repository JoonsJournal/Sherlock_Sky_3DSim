"""
재생 모드 API
- 과거 데이터 재생
- 타임라인 컨트롤
- 배속 재생
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from ..database.connection import get_db_connection, return_db_connection

router = APIRouter()


@router.get("/timeline")
async def get_playback_timeline(
    start_time: str,
    end_time: str,
    equipment_id: Optional[str] = None,
    interval: str = Query(default="1min", regex="^(1min|5min|10min|1hour)$")
):
    """재생 타임라인 데이터"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        interval_map = {
            "1min": "1 minute",
            "5min": "5 minutes",
            "10min": "10 minutes",
            "1hour": "1 hour"
        }
        
        if equipment_id:
            # 특정 장비
            cursor.execute(f"""
                SELECT 
                    time_bucket('{interval_map[interval]}', timestamp) as bucket,
                    equipment_id,
                    AVG(temperature) as avg_temp,
                    AVG(pressure) as avg_pressure,
                    mode() WITHIN GROUP (ORDER BY status) as common_status
                FROM equipment_status_ts
                WHERE equipment_id = %s
                    AND timestamp BETWEEN %s AND %s
                GROUP BY bucket, equipment_id
                ORDER BY bucket
            """, (equipment_id, start_time, end_time))
        else:
            # 전체 장비
            cursor.execute(f"""
                SELECT 
                    time_bucket('{interval_map[interval]}', timestamp) as bucket,
                    equipment_id,
                    AVG(temperature) as avg_temp,
                    AVG(pressure) as avg_pressure,
                    mode() WITHIN GROUP (ORDER BY status) as common_status
                FROM equipment_status_ts
                WHERE timestamp BETWEEN %s AND %s
                GROUP BY bucket, equipment_id
                ORDER BY bucket, equipment_id
            """, (start_time, end_time))
        
        timeline_data = []
        for row in cursor.fetchall():
            timeline_data.append({
                "timestamp": row[0].isoformat(),
                "equipment_id": row[1],
                "temperature": float(row[2]) if row[2] else None,
                "pressure": float(row[3]) if row[3] else None,
                "status": row[4]
            })
        
        cursor.close()
        
        return {
            "timeline": timeline_data,
            "count": len(timeline_data),
            "period": {
                "start": start_time,
                "end": end_time
            },
            "interval": interval
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"타임라인 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/snapshot")
async def get_snapshot_at_time(
    timestamp: str,
    tolerance_seconds: int = Query(default=60, le=300)
):
    """특정 시점 스냅샷 (전체 장비 상태)"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 지정된 시간 전후 tolerance 범위 내 최신 데이터
        cursor.execute("""
            SELECT DISTINCT ON (equipment_id)
                equipment_id,
                status,
                temperature,
                pressure,
                timestamp
            FROM equipment_status_ts
            WHERE timestamp BETWEEN 
                %s::timestamp - INTERVAL '%s seconds' AND
                %s::timestamp + INTERVAL '%s seconds'
            ORDER BY equipment_id, ABS(EXTRACT(EPOCH FROM (timestamp - %s::timestamp)))
        """, (timestamp, tolerance_seconds, timestamp, tolerance_seconds, timestamp))
        
        snapshot = []
        for row in cursor.fetchall():
            snapshot.append({
                "equipment_id": row[0],
                "status": row[1],
                "temperature": float(row[2]) if row[2] else None,
                "pressure": float(row[3]) if row[3] else None,
                "actual_timestamp": row[4].isoformat()
            })
        
        cursor.close()
        
        return {
            "requested_timestamp": timestamp,
            "snapshot": snapshot,
            "count": len(snapshot)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스냅샷 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/events")
async def get_events_in_range(
    start_time: str,
    end_time: str,
    event_types: Optional[str] = Query(None, description="Comma-separated: alarm,status_change,production")
):
    """기간 내 주요 이벤트"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        events = []
        
        # 알람 이벤트
        if not event_types or "alarm" in event_types:
            cursor.execute("""
                SELECT equipment_id, 'alarm' as type, alarm_code as detail, 
                       severity, timestamp
                FROM alarms_ts
                WHERE timestamp BETWEEN %s AND %s
                ORDER BY timestamp
            """, (start_time, end_time))
            
            for row in cursor.fetchall():
                events.append({
                    "equipment_id": row[0],
                    "type": row[1],
                    "detail": row[2],
                    "severity": row[3],
                    "timestamp": row[4].isoformat()
                })
        
        cursor.close()
        
        # 시간 순 정렬
        events.sort(key=lambda x: x["timestamp"])
        
        return {
            "events": events,
            "count": len(events),
            "period": {
                "start": start_time,
                "end": end_time
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이벤트 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/speed-test")
async def test_playback_speed(
    start_time: str,
    duration_minutes: int = Query(default=60, le=1440),
    speed: int = Query(default=10, ge=1, le=100)
):
    """재생 속도 테스트 (메타데이터만)"""
    return {
        "playback_config": {
            "start_time": start_time,
            "duration_minutes": duration_minutes,
            "speed": f"{speed}x",
            "real_time_seconds": duration_minutes * 60 / speed
        },
        "message": f"{duration_minutes}분 데이터를 {speed}배속으로 재생하면 실제 {duration_minutes * 60 / speed:.1f}초 소요"
    }