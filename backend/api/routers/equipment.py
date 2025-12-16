"""
장비 관리 API
- 장비 목록 조회
- 장비 상세 정보
- 장비 상태 업데이트
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict
from datetime import datetime
from ..database.connection import get_db_connection, return_db_connection

router = APIRouter()


@router.get("/")
async def get_all_equipment():
    """전체 장비 목록 조회 (77개)"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT equipment_id, name, type, row_position, col_position, 
                   current_status, created_at
            FROM equipment
            ORDER BY row_position, col_position
        """)
        
        equipment_list = []
        for row in cursor.fetchall():
            equipment_list.append({
                "equipment_id": row[0],
                "name": row[1],
                "type": row[2],
                "position": {
                    "row": row[3],
                    "col": row[4]
                },
                "status": row[5],
                "created_at": row[6].isoformat() if row[6] else None
            })
        
        cursor.close()
        
        return {
            "equipment": equipment_list,
            "count": len(equipment_list),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 목록 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/{equipment_id}")
async def get_equipment_detail(equipment_id: str):
    """특정 장비 상세 정보"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT equipment_id, name, type, row_position, col_position,
                   current_status, total_runtime_hours, last_maintenance_date,
                   created_at
            FROM equipment
            WHERE equipment_id = %s
        """, (equipment_id,))
        
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다")
        
        equipment = {
            "equipment_id": row[0],
            "name": row[1],
            "type": row[2],
            "position": {
                "row": row[3],
                "col": row[4]
            },
            "status": row[5],
            "runtime_hours": float(row[6]) if row[6] else 0,
            "last_maintenance": row[7].isoformat() if row[7] else None,
            "created_at": row[8].isoformat() if row[8] else None
        }
        
        cursor.close()
        return equipment
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"장비 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/{equipment_id}/status")
async def get_equipment_status(equipment_id: str, limit: int = 100):
    """장비 상태 이력 조회"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT timestamp, status, temperature, pressure, vibration
            FROM equipment_status_ts
            WHERE equipment_id = %s
            ORDER BY timestamp DESC
            LIMIT %s
        """, (equipment_id, limit))
        
        status_history = []
        for row in cursor.fetchall():
            status_history.append({
                "timestamp": row[0].isoformat(),
                "status": row[1],
                "temperature": float(row[2]) if row[2] else None,
                "pressure": float(row[3]) if row[3] else None,
                "vibration": float(row[4]) if row[4] else None
            })
        
        cursor.close()
        
        return {
            "equipment_id": equipment_id,
            "status_history": status_history,
            "count": len(status_history)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 이력 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/grid/layout")
async def get_grid_layout():
    """7x11 그리드 레이아웃 조회"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT equipment_id, name, row_position, col_position, current_status
            FROM equipment
            ORDER BY row_position, col_position
        """)
        
        # 7x11 그리드 초기화
        grid = [[None for _ in range(11)] for _ in range(7)]
        
        for row in cursor.fetchall():
            equipment_id, name, row_pos, col_pos, status = row
            grid[row_pos][col_pos] = {
                "equipment_id": equipment_id,
                "name": name,
                "status": status
            }
        
        cursor.close()
        
        return {
            "grid": grid,
            "rows": 7,
            "cols": 11,
            "total_equipment": 77
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"그리드 레이아웃 조회 실패: {str(e)}")
    
    finally:
        if conn:
            return_db_connection(conn)