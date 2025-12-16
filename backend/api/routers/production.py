"""
생산 관리 API
- 생산량 조회
- 불량률 분석
- 생산 통계
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
from ..database.connection import get_db_connection, return_db_connection

router = APIRouter()


@router.get("/summary")
async def get_production_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """생산 요약 정보"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 기본값: 최근 24시간
        if not start_date:
            start_date = (datetime.now() - timedelta(hours=24)).isoformat()
        if not end_date:
            end_date = datetime.now().isoformat()
        
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT equipment_id) as active_equipment,
                SUM(good_count) as total_good,
                SUM(defect_count) as total_defect,
                SUM(good_count + defect_count) as total_production
            FROM production_ts
            WHERE timestamp BETWEEN %s AND %s
        """, (start_date, end_date))
        
        row = cursor.fetchone()
        cursor.close()
        
        if row:
            total_production = row[3] or 0
            defect_rate = (row[2] / total_production * 100) if total_production > 0 else 0
            
            return {
                "period": {
                    "start": start_date,
                    "end": end_date
                },
                "active_equipment": row[0] or 0,
                "total_good": row[1] or 0,
                "total_defect": row[2] or 0,
                "total_production": total_production,
                "defect_rate": round(defect_rate, 2),
                "yield_rate": round(100 - defect_rate, 2)
            }
        
        return {
            "error": "데이터 없음",
            "period": {"start": start_date, "end": end_date}
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"생산 요약 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/by-equipment")
async def get_production_by_equipment(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(default=77, le=100)
):
    """장비별 생산량"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if not start_date:
            start_date = (datetime.now() - timedelta(hours=24)).isoformat()
        if not end_date:
            end_date = datetime.now().isoformat()
        
        cursor.execute("""
            SELECT 
                equipment_id,
                SUM(good_count) as good,
                SUM(defect_count) as defect,
                SUM(good_count + defect_count) as total
            FROM production_ts
            WHERE timestamp BETWEEN %s AND %s
            GROUP BY equipment_id
            ORDER BY total DESC
            LIMIT %s
        """, (start_date, end_date, limit))
        
        equipment_production = []
        for row in cursor.fetchall():
            total = row[3] or 0
            defect_rate = (row[2] / total * 100) if total > 0 else 0
            
            equipment_production.append({
                "equipment_id": row[0],
                "good_count": row[1] or 0,
                "defect_count": row[2] or 0,
                "total_count": total,
                "defect_rate": round(defect_rate, 2)
            })
        
        cursor.close()
        
        return {
            "period": {"start": start_date, "end": end_date},
            "equipment_production": equipment_production,
            "count": len(equipment_production)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비별 생산량 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/timeline/{equipment_id}")
async def get_production_timeline(
    equipment_id: str,
    interval: str = Query(default="1hour", regex="^(1min|5min|1hour|1day)$"),
    limit: int = Query(default=100, le=1000)
):
    """장비별 생산 타임라인"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 간격에 따른 그룹화
        interval_map = {
            "1min": "1 minute",
            "5min": "5 minutes",
            "1hour": "1 hour",
            "1day": "1 day"
        }
        
        cursor.execute(f"""
            SELECT 
                time_bucket('{interval_map[interval]}', timestamp) as bucket,
                SUM(good_count) as good,
                SUM(defect_count) as defect
            FROM production_ts
            WHERE equipment_id = %s
            GROUP BY bucket
            ORDER BY bucket DESC
            LIMIT %s
        """, (equipment_id, limit))
        
        timeline = []
        for row in cursor.fetchall():
            timeline.append({
                "timestamp": row[0].isoformat(),
                "good_count": row[1] or 0,
                "defect_count": row[2] or 0,
                "total": (row[1] or 0) + (row[2] or 0)
            })
        
        cursor.close()
        
        return {
            "equipment_id": equipment_id,
            "interval": interval,
            "timeline": timeline,
            "count": len(timeline)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"생산 타임라인 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)