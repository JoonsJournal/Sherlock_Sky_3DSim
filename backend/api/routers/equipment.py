"""
장비 관리 API
- 장비 목록 조회
- 장비 상세 정보
- 장비 상태 업데이트
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Optional
from datetime import datetime
import logging

from ..database.connection import get_db_connection, return_db_connection
from ..utils.errors import (
    DatabaseError,
    NotFoundError,
    ValidationError,
    handle_errors,
    handle_db_error,
    validate_equipment_id
)

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
@handle_errors
async def get_all_equipment():
    """전체 장비 목록 조회"""
    logger.info("전체 장비 목록 조회 요청")
    conn = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, row_position, col_position, 
                   equipment_type, status, created_at
            FROM equipment
            ORDER BY row_position, col_position
        """)
        
        equipment_list = []
        for row in cursor.fetchall():
            equipment_list.append({
                "id": row[0],
                "position": {
                    "row": row[1],
                    "col": row[2]
                },
                "type": row[3],
                "status": row[4],
                "created_at": row[5].isoformat() if row[5] else None
            })
        
        cursor.close()
        
        logger.info(f"장비 목록 조회 성공: {len(equipment_list)}개")
        
        return {
            "equipment": equipment_list,
            "count": len(equipment_list),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        handle_db_error(e, "장비 목록 조회")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/{equipment_id}")
@handle_errors
async def get_equipment_detail(equipment_id: str):
    """특정 장비 상세 정보"""
    logger.info(f"장비 상세 조회 요청: {equipment_id}")
    
    # ID 형식 검증
    validate_equipment_id(equipment_id)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, row_position, col_position, equipment_type,
                   status, created_at, updated_at
            FROM equipment
            WHERE id = %s
        """, (equipment_id,))
        
        row = cursor.fetchone()
        cursor.close()
        
        if not row:
            logger.warning(f"장비를 찾을 수 없음: {equipment_id}")
            raise NotFoundError("장비", equipment_id)
        
        equipment = {
            "id": row[0],
            "position": {
                "row": row[1],
                "col": row[2]
            },
            "type": row[3],
            "status": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
            "updated_at": row[6].isoformat() if row[6] else None
        }
        
        logger.info(f"장비 상세 조회 성공: {equipment_id}")
        return equipment
        
    except (NotFoundError, ValidationError):
        raise
    except Exception as e:
        handle_db_error(e, f"장비 상세 조회: {equipment_id}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/{equipment_id}/status")
@handle_errors
async def get_equipment_status(
    equipment_id: str, 
    limit: int = Query(default=100, ge=1, le=1000)
):
    """장비 상태 이력 조회"""
    logger.info(f"장비 상태 이력 조회: {equipment_id}, limit={limit}")
    
    # ID 형식 검증
    validate_equipment_id(equipment_id)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 장비 존재 여부 먼저 확인
        cursor.execute("SELECT 1 FROM equipment WHERE id = %s", (equipment_id,))
        if not cursor.fetchone():
            raise NotFoundError("장비", equipment_id)
        
        cursor.execute("""
            SELECT time, status, temperature, vibration, 
                   current, voltage
            FROM equipment_status_ts
            WHERE equipment_id = %s
            ORDER BY time DESC
            LIMIT %s
        """, (equipment_id, limit))
        
        status_history = []
        for row in cursor.fetchall():
            status_history.append({
                "timestamp": row[0].isoformat(),
                "status": row[1],
                "temperature": float(row[2]) if row[2] else None,
                "vibration": float(row[3]) if row[3] else None,
                "current": float(row[4]) if row[4] else None,
                "voltage": float(row[5]) if row[5] else None
            })
        
        cursor.close()
        
        logger.info(f"상태 이력 조회 성공: {equipment_id}, {len(status_history)}건")
        
        return {
            "equipment_id": equipment_id,
            "status_history": status_history,
            "count": len(status_history)
        }
        
    except (NotFoundError, ValidationError):
        raise
    except Exception as e:
        handle_db_error(e, f"상태 이력 조회: {equipment_id}")
    
    finally:
        if conn:
            return_db_connection(conn)


@router.get("/grid/layout")
@handle_errors
async def get_grid_layout():
    """설비 배열 그리드 레이아웃 조회"""
    logger.info("그리드 레이아웃 조회 요청")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, row_position, col_position, status
            FROM equipment
            ORDER BY row_position, col_position
        """)
        
        # 그리드 초기화 (실제 설비 배열 크기로 조정 필요)
        # Config.js의 ROWS, COLS 값과 일치시켜야 함
        ROWS = 26
        COLS = 6
        grid = [[None for _ in range(COLS)] for _ in range(ROWS)]
        
        equipment_count = 0
        for row in cursor.fetchall():
            eq_id, row_pos, col_pos, status = row
            
            # 인덱스 범위 검증
            if 0 <= row_pos < ROWS and 0 <= col_pos < COLS:
                grid[row_pos][col_pos] = {
                    "id": eq_id,
                    "status": status
                }
                equipment_count += 1
            else:
                logger.warning(
                    f"유효하지 않은 위치: {eq_id} at ({row_pos}, {col_pos})"
                )
        
        cursor.close()
        
        logger.info(f"그리드 레이아웃 조회 성공: {equipment_count}개 설비")
        
        return {
            "grid": grid,
            "rows": ROWS,
            "cols": COLS,
            "equipment_count": equipment_count,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        handle_db_error(e, "그리드 레이아웃 조회")
    
    finally:
        if conn:
            return_db_connection(conn)

@router.get("/grid/layout")
@handle_errors
async def get_grid_layout():
    """설비 배열 그리드 레이아웃 조회 (26행 × 6열)"""
    logger.info("그리드 레이아웃 조회 요청")
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, row_position, col_position, status
            FROM equipment
            ORDER BY row_position, col_position
        """)
        
        # Config.js와 동일한 그리드 크기
        ROWS = 26
        COLS = 6
        
        # 그리드 초기화 (None으로)
        grid = [[None for _ in range(COLS)] for _ in range(ROWS)]
        
        equipment_count = 0
        for row in cursor.fetchall():
            eq_id, row_pos, col_pos, status = row
            
            # 1-based index를 0-based로 변환
            grid_row = row_pos - 1
            grid_col = col_pos - 1
            
            # 인덱스 범위 검증
            if 0 <= grid_row < ROWS and 0 <= grid_col < COLS:
                grid[grid_row][grid_col] = {
                    "id": eq_id,
                    "status": status,
                    "position": {
                        "row": row_pos,
                        "col": col_pos
                    }
                }
                equipment_count += 1
            else:
                logger.warning(
                    f"유효하지 않은 위치: {eq_id} at ({row_pos}, {col_pos})"
                )
        
        cursor.close()
        
        # 제외 위치 계산
        total_positions = ROWS * COLS
        excluded_count = total_positions - equipment_count
        
        logger.info(
            f"그리드 레이아웃 조회 완료: {equipment_count}개 설비 "
            f"({ROWS}행 × {COLS}열 - {excluded_count}개 제외)"
        )
        
        return {
            "grid": grid,
            "layout": {
                "rows": ROWS,
                "cols": COLS,
                "total_positions": total_positions,
                "equipment_count": equipment_count,
                "excluded_count": excluded_count
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        handle_db_error(e, "그리드 레이아웃 조회")
    
    finally:
        if conn:
            return_db_connection(conn)