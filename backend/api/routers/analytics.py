"""
분석 API
- OEE 계산
- MTBF/MTTR
- Pareto 분석
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
from ..database.connection import get_db_connection, return_db_connection

router = APIRouter()


@router.get("/oee")
async def calculate_oee(
    equipment_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """OEE (Overall Equipment Effectiveness) 계산"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if not start_date:
            start_date = (datetime.now() - timedelta(days=7)).isoformat()
        if not end_date:
            end_date = datetime.now().isoformat()
        
        if equipment_id:
            # 특정 장비 OEE
            cursor.execute("""
                SELECT 
                    SUM(good_count) as good,
                    SUM(defect_count) as defect,
                    COUNT(*) as data_points
                FROM production_ts
                WHERE equipment_id = %s
                    AND timestamp BETWEEN %s AND %s
            """, (equipment_id, start_date, end_date))
            
            row = cursor.fetchone()
            good = row[0] or 0
            defect = row[1] or 0
            total = good + defect
            
            # 간단한 OEE 계산 (실제로는 더 복잡)
            availability = 0.85  # 예시값
            performance = 0.90   # 예시값
            quality = (good / total) if total > 0 else 0
            oee = availability * performance * quality
            
            result = {
                "equipment_id": equipment_id,
                "oee": round(oee * 100, 2),
                "availability": round(availability * 100, 2),
                "performance": round(performance * 100, 2),
                "quality": round(quality * 100, 2),
                "good_count": good,
                "defect_count": defect
            }
        else:
            # 전체 장비 평균 OEE
            cursor.execute("""
                SELECT 
                    equipment_id,
                    SUM(good_count) as good,
                    SUM(defect_count) as defect
                FROM production_ts
                WHERE timestamp BETWEEN %s AND %s
                GROUP BY equipment_id
            """, (start_date, end_date))
            
            equipment_oees = []
            for row in cursor.fetchall():
                eq_id, good, defect = row
                total = (good or 0) + (defect or 0)
                quality = (good / total) if total > 0 else 0
                oee = 0.85 * 0.90 * quality  # 간단 계산
                
                equipment_oees.append({
                    "equipment_id": eq_id,
                    "oee": round(oee * 100, 2),
                    "quality": round(quality * 100, 2)
                })
            
            avg_oee = sum(e["oee"] for e in equipment_oees) / len(equipment_oees) if equipment_oees else 0
            
            result = {
                "average_oee": round(avg_oee, 2),
                "equipment_count": len(equipment_oees),
                "equipment_oees": equipment_oees
            }
        
        cursor.close()
        
        result["period"] = {"start": start_date, "end": end_date}
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OEE 계산 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/mtbf-mttr")
async def calculate_mtbf_mttr(
    equipment_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """MTBF (Mean Time Between Failures) / MTTR (Mean Time To Repair)"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = datetime.now().isoformat()
        
        if equipment_id:
            # 특정 장비
            cursor.execute("""
                SELECT COUNT(*) as failure_count
                FROM alarms_ts
                WHERE equipment_id = %s
                    AND severity = 'CRITICAL'
                    AND timestamp BETWEEN %s AND %s
            """, (equipment_id, start_date, end_date))
            
            failure_count = cursor.fetchone()[0]
            
            # 기간 (시간)
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
            period_hours = (end_dt - start_dt).total_seconds() / 3600
            
            mtbf = period_hours / failure_count if failure_count > 0 else 0
            mttr = 2.5  # 예시값 (실제로는 복구 시간 계산 필요)
            
            result = {
                "equipment_id": equipment_id,
                "mtbf_hours": round(mtbf, 2),
                "mttr_hours": round(mttr, 2),
                "failure_count": failure_count,
                "availability": round((mtbf / (mtbf + mttr)) * 100, 2) if mtbf > 0 else 0
            }
        else:
            # 전체 장비 평균
            cursor.execute("""
                SELECT 
                    equipment_id,
                    COUNT(*) as failure_count
                FROM alarms_ts
                WHERE severity = 'CRITICAL'
                    AND timestamp BETWEEN %s AND %s
                GROUP BY equipment_id
            """, (start_date, end_date))
            
            equipment_stats = []
            for row in cursor.fetchall():
                eq_id, failures = row
                
                start_dt = datetime.fromisoformat(start_date)
                end_dt = datetime.fromisoformat(end_date)
                period_hours = (end_dt - start_dt).total_seconds() / 3600
                
                mtbf = period_hours / failures if failures > 0 else period_hours
                
                equipment_stats.append({
                    "equipment_id": eq_id,
                    "mtbf_hours": round(mtbf, 2),
                    "failure_count": failures
                })
            
            avg_mtbf = sum(e["mtbf_hours"] for e in equipment_stats) / len(equipment_stats) if equipment_stats else 0
            
            result = {
                "average_mtbf_hours": round(avg_mtbf, 2),
                "equipment_count": len(equipment_stats),
                "equipment_stats": equipment_stats
            }
        
        cursor.close()
        
        result["period"] = {"start": start_date, "end": end_date}
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MTBF/MTTR 계산 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/pareto")
async def pareto_analysis(
    analysis_type: str = Query(default="alarm", regex="^(alarm|defect)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    top_n: int = Query(default=10, le=50)
):
    """Pareto 분석 (80/20 법칙)"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = datetime.now().isoformat()
        
        if analysis_type == "alarm":
            # 알람 코드별 발생 빈도
            cursor.execute("""
                SELECT 
                    alarm_code,
                    COUNT(*) as count
                FROM alarms_ts
                WHERE timestamp BETWEEN %s AND %s
                GROUP BY alarm_code
                ORDER BY count DESC
                LIMIT %s
            """, (start_date, end_date, top_n))
            
            items = []
            total_count = 0
            for row in cursor.fetchall():
                count = row[1]
                total_count += count
                items.append({
                    "code": row[0],
                    "count": count
                })
            
            # 누적 비율 계산
            cumulative = 0
            for item in items:
                cumulative += item["count"]
                item["percentage"] = round((item["count"] / total_count) * 100, 2)
                item["cumulative_percentage"] = round((cumulative / total_count) * 100, 2)
            
        else:  # defect
            # 장비별 불량 발생
            cursor.execute("""
                SELECT 
                    equipment_id,
                    SUM(defect_count) as total_defects
                FROM production_ts
                WHERE timestamp BETWEEN %s AND %s
                GROUP BY equipment_id
                ORDER BY total_defects DESC
                LIMIT %s
            """, (start_date, end_date, top_n))
            
            items = []
            total_defects = 0
            for row in cursor.fetchall():
                defects = row[1]
                total_defects += defects
                items.append({
                    "equipment_id": row[0],
                    "count": defects
                })
            
            # 누적 비율 계산
            cumulative = 0
            for item in items:
                cumulative += item["count"]
                item["percentage"] = round((item["count"] / total_defects) * 100, 2)
                item["cumulative_percentage"] = round((cumulative / total_defects) * 100, 2)
        
        cursor.close()
        
        return {
            "analysis_type": analysis_type,
            "period": {"start": start_date, "end": end_date},
            "items": items,
            "total_count": total_count if analysis_type == "alarm" else total_defects
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pareto 분석 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/trends")
async def get_trends(
    metric: str = Query(default="production", regex="^(production|defect|alarm)$"),
    interval: str = Query(default="1day", regex="^(1hour|1day|1week)$"),
    limit: int = Query(default=30, le=365)
):
    """트렌드 분석"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        interval_map = {
            "1hour": "1 hour",
            "1day": "1 day",
            "1week": "1 week"
        }
        
        if metric == "production":
            cursor.execute(f"""
                SELECT 
                    time_bucket('{interval_map[interval]}', timestamp) as bucket,
                    SUM(good_count) as good,
                    SUM(defect_count) as defect
                FROM production_ts
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT %s
            """, (limit,))
            
            trends = []
            for row in cursor.fetchall():
                trends.append({
                    "timestamp": row[0].isoformat(),
                    "good": row[1] or 0,
                    "defect": row[2] or 0,
                    "total": (row[1] or 0) + (row[2] or 0)
                })
        
        elif metric == "alarm":
            cursor.execute(f"""
                SELECT 
                    time_bucket('{interval_map[interval]}', timestamp) as bucket,
                    COUNT(*) as alarm_count
                FROM alarms_ts
                GROUP BY bucket
                ORDER BY bucket DESC
                LIMIT %s
            """, (limit,))
            
            trends = []
            for row in cursor.fetchall():
                trends.append({
                    "timestamp": row[0].isoformat(),
                    "alarm_count": row[1]
                })
        
        cursor.close()
        
        return {
            "metric": metric,
            "interval": interval,
            "trends": list(reversed(trends)),
            "count": len(trends)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"트렌드 분석 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)