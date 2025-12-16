"""
실시간 모니터링 API
- 현재 장비 상태
- 알람 조회
- 실시간 통계
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
from ..database.connection import get_db_connection, return_db_connection, get_redis
import json

router = APIRouter()


@router.get("/current-status")
async def get_current_status():
    """전체 장비 현재 상태 (Redis 캐시)"""
    try:
        redis_client = get_redis()
        
        # Redis에서 모든 장비 상태 가져오기
        equipment_keys = await redis_client.keys("equipment:*:status")
        
        current_status = []
        for key in equipment_keys:
            data = await redis_client.get(key)
            if data:
                status = json.loads(data)
                current_status.append(status)
        
        return {
            "equipment_status": current_status,
            "count": len(current_status),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"현재 상태 조회 실패: {str(e)}")


@router.get("/alarms")
async def get_active_alarms(
    severity: Optional[str] = Query(None, regex="^(CRITICAL|WARNING|INFO)$"),
    limit: int = Query(default=50, le=500)
):
    """활성 알람 조회"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT equipment_id, alarm_code, severity, message, timestamp
            FROM alarms_ts
            WHERE timestamp > NOW() - INTERVAL '24 hours'
        """
        params = []
        
        if severity:
            query += " AND severity = %s"
            params.append(severity)
        
        query += " ORDER BY timestamp DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        
        alarms = []
        for row in cursor.fetchall():
            alarms.append({
                "equipment_id": row[0],
                "alarm_code": row[1],
                "severity": row[2],
                "message": row[3],
                "timestamp": row[4].isoformat()
            })
        
        cursor.close()
        
        return {
            "alarms": alarms,
            "count": len(alarms),
            "filter": {"severity": severity} if severity else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알람 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/statistics")
async def get_real_time_statistics():
    """실시간 통계"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 장비 상태별 카운트
        cursor.execute("""
            SELECT current_status, COUNT(*)
            FROM equipment
            GROUP BY current_status
        """)
        
        status_counts = {}
        for row in cursor.fetchall():
            status_counts[row[0]] = row[1]
        
        # 최근 1시간 알람 수
        cursor.execute("""
            SELECT COUNT(*)
            FROM alarms_ts
            WHERE timestamp > NOW() - INTERVAL '1 hour'
        """)
        recent_alarms = cursor.fetchone()[0]
        
        # 최근 1시간 생산량
        cursor.execute("""
            SELECT SUM(good_count), SUM(defect_count)
            FROM production_ts
            WHERE timestamp > NOW() - INTERVAL '1 hour'
        """)
        production = cursor.fetchone()
        
        cursor.close()
        
        return {
            "equipment_status": status_counts,
            "recent_alarms": recent_alarms,
            "production_last_hour": {
                "good": production[0] or 0,
                "defect": production[1] or 0,
                "total": (production[0] or 0) + (production[1] or 0)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/equipment/{equipment_id}/live")
async def get_equipment_live_data(equipment_id: str):
    """특정 장비 실시간 데이터 (Redis)"""
    try:
        redis_client = get_redis()
        
        # Redis에서 최신 데이터 가져오기
        status_key = f"equipment:{equipment_id}:status"
        production_key = f"equipment:{equipment_id}:production"
        
        status_data = await redis_client.get(status_key)
        production_data = await redis_client.get(production_key)
        
        result = {
            "equipment_id": equipment_id,
            "timestamp": datetime.now().isoformat()
        }
        
        if status_data:
            result["status"] = json.loads(status_data)
        
        if production_data:
            result["production"] = json.loads(production_data)
        
        if not status_data and not production_data:
            raise HTTPException(status_code=404, detail="실시간 데이터 없음")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"실시간 데이터 조회 실패: {str(e)}")