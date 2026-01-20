"""
uds_queries.py
UDS SQL 쿼리 모음 (MSSQL WITH NOLOCK 필수 적용)

@version 2.0.0
@description
- 배치 쿼리: 전체 설비 초기 로드 (117개)
- 단일 쿼리: 개별 설비 조회
- 생산량 쿼리: CycleTime 기반 생산 카운트
- Tact Time 쿼리: 최근 2개 CycleTime 간격 계산
- Diff 감지용 스냅샷 쿼리

⚠️ CRITICAL: 모든 SELECT 쿼리에 WITH (NOLOCK) 필수 적용!
   - Factory DB (MSSQL) 트랜잭션 차단 방지
   - 실시간 모니터링 성능 보장
   - Dirty Read 허용 (모니터링 용도 적합)

@changelog
- v2.0.0: 🔧 core.EquipmentMapping 테이블 제거 (2026-01-21)
          - ⚠️ 해당 테이블은 DB에 존재하지 않음!
          - 매핑 정보는 JSON 파일에서 관리
          - 모든 쿼리에서 em.FrontendId, em.GridRow, em.GridCol 제거
          - EquipmentId 기반 조회 후 UDSService에서 매핑 병합
          - ORDER BY e.EquipmentId로 변경 (GridRow/GridCol 없음)
- v1.0.0: 초기 버전
          - BATCH_EQUIPMENT_QUERY: 전체 설비 + 상태 + Lot + PC Info JOIN
          - SINGLE_EQUIPMENT_QUERY: frontend_id 기반 단일 조회
          - PRODUCTION_COUNT_QUERY: Lot 시작 이후 CycleTime COUNT
          - TACT_TIME_QUERY: 최근 2개 CycleTime 시간 간격
          - STATUS_SNAPSHOT_QUERY: Diff 감지용 경량 스냅샷
          - ⚠️ 모든 쿼리 WITH (NOLOCK) 적용 완료

@dependencies
- sqlalchemy.text (파라미터 바인딩)

📁 위치: backend/api/services/uds/uds_queries.py
작성일: 2026-01-20
수정일: 2026-01-21
"""

# =============================================================================
# 📌 쿼리 사용 가이드
# =============================================================================
#
# 1. SQLAlchemy text() 사용:
#    from sqlalchemy import text
#    result = session.execute(text(BATCH_EQUIPMENT_QUERY), {"site_id": 1, "line_id": 1})
#
# 2. 파라미터 바인딩:
#    :site_id, :line_id → 딕셔너리로 전달
#    IN 절은 별도 동적 생성 필요 (SQLAlchemy 제약)
#
# 3. 결과 컬럼 인덱스:
#    각 쿼리 주석에 row[N] 인덱스 문서화됨
#
# 4. 🔧 v2.0.0 중요 변경:
#    - FrontendId, GridRow, GridCol은 SQL에서 조회하지 않음
#    - UDSService에서 JSON 매핑 파일 로드 후 병합
#    - 매핑 파일: config/site_mappings/equipment_mapping_{site_id}.json
#
# =============================================================================


# =============================================================================
# 🔹 BATCH_EQUIPMENT_QUERY (v2.0.0 수정)
# =============================================================================
# 전체 설비 초기 로드 배치 쿼리
# 
# 용도: GET /api/uds/initial
# 호출 시점: Frontend 앱 시작 시 1회
# 예상 결과: 117개 설비 전체 데이터
#
# 🔧 v2.0.0 변경사항:
#   - core.EquipmentMapping JOIN 제거 (테이블 없음)
#   - GridRow, GridCol, FrontendId 컬럼 제거
#   - ORDER BY e.EquipmentId로 변경
#   - UDSService에서 JSON 매핑과 병합
#
# JOIN 구조 (v2.0.0):
# ┌──────────────────────┐
# │ core.Equipment (e)   │ ← 메인 테이블
# ├──────────────────────┤
# │ log.EquipmentState   │ ← 최신 상태 (ROW_NUMBER)
# │ log.Lotinfo          │ ← 최신 Lot (IsStart=1)
# │ log.EquipmentPCInfo  │ ← 최신 PC Info (ROW_NUMBER)
# └──────────────────────┘
#   ❌ core.EquipmentMapping 제거됨!
#
# 컬럼 인덱스 (row[N]) - v2.0.0:
#  0: EquipmentId         (int)
#  1: EquipmentName       (str)
#  2: LineName            (str)
#  3: Status              (str) - RUN/IDLE/STOP/SUDDENSTOP
#  4: StatusChangedAt     (datetime)
#  5: ProductModel        (str or NULL)
#  6: LotId               (str or NULL)
#  7: LotStartTime        (datetime or NULL)
#  8: CpuUsagePercent     (float or NULL)
#  9: MemoryTotalMb       (float or NULL)
# 10: MemoryUsedMb        (float or NULL)
# 11: DisksTotalGb        (float or NULL) - C 드라이브
# 12: DisksUsedGb         (float or NULL) - C 드라이브
#
# ❌ 제거됨 (v2.0.0):
# 13: GridRow             → JSON 매핑에서 가져옴
# 14: GridCol             → JSON 매핑에서 가져옴
# 15: FrontendId          → JSON 매핑에서 가져옴
#
# =============================================================================
BATCH_EQUIPMENT_QUERY = """
SELECT 
    e.EquipmentId,
    e.EquipmentName,
    e.LineName,
    es.Status,
    es.OccurredAtUtc AS StatusChangedAt,
    li.ProductModel,
    li.LotId,
    li.OccurredAtUtc AS LotStartTime,
    pc.CPUUsagePercent AS CpuUsagePercent,
    pc.MemoryTotalMb,
    pc.MemoryUsedMb,
    pc.DisksTotalGb,
    pc.DisksUsedGb
FROM core.Equipment e WITH (NOLOCK)
-- 최신 상태 (ROW_NUMBER로 각 설비의 최신 1건만)
LEFT JOIN (
    SELECT 
        EquipmentId, 
        Status, 
        OccurredAtUtc,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId 
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.EquipmentState WITH (NOLOCK)
) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
-- 최신 Lot 정보 (IsStart=1인 것 중 최신)
LEFT JOIN (
    SELECT 
        EquipmentId, 
        ProductModel, 
        LotId,
        OccurredAtUtc,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId 
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.Lotinfo WITH (NOLOCK)
    WHERE IsStart = 1
) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
-- 최신 PC 정보
LEFT JOIN (
    SELECT
        EquipmentId,
        CPUUsagePercent,
        MemoryTotalMb,
        MemoryUsedMb,
        DisksTotalGb,
        DisksUsedGb,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.EquipmentPCInfo WITH (NOLOCK)
) pc ON e.EquipmentId = pc.EquipmentId AND pc.rn = 1
WHERE e.SiteId = :site_id 
  AND e.LineId = :line_id
  AND e.IsActive = 1
ORDER BY e.EquipmentId
"""


# =============================================================================
# 🔹 SINGLE_EQUIPMENT_QUERY (v2.0.0 수정)
# =============================================================================
# 단일 설비 조회 쿼리
#
# 🔧 v2.0.0 변경사항:
#   - equipment_id 기반 조회로 변경 (기존: frontend_id)
#   - core.EquipmentMapping JOIN 제거
#   - UDSService에서 JSON 매핑과 병합
#
# 용도: GET /api/uds/equipment/{equipment_id}
# 호출 시점: 캐시 미스 시 (거의 사용 안 됨)
#
# 컬럼 인덱스: BATCH_EQUIPMENT_QUERY와 동일 (v2.0.0)
#
# =============================================================================
SINGLE_EQUIPMENT_QUERY = """
SELECT 
    e.EquipmentId,
    e.EquipmentName,
    e.LineName,
    es.Status,
    es.OccurredAtUtc AS StatusChangedAt,
    li.ProductModel,
    li.LotId,
    li.OccurredAtUtc AS LotStartTime,
    pc.CPUUsagePercent AS CpuUsagePercent,
    pc.MemoryTotalMb,
    pc.MemoryUsedMb,
    pc.DisksTotalGb,
    pc.DisksUsedGb
FROM core.Equipment e WITH (NOLOCK)
LEFT JOIN (
    SELECT 
        EquipmentId, 
        Status, 
        OccurredAtUtc,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId 
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.EquipmentState WITH (NOLOCK)
) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
LEFT JOIN (
    SELECT 
        EquipmentId, 
        ProductModel, 
        LotId,
        OccurredAtUtc,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId 
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.Lotinfo WITH (NOLOCK)
    WHERE IsStart = 1
) li ON e.EquipmentId = li.EquipmentId AND li.rn = 1
LEFT JOIN (
    SELECT
        EquipmentId,
        CPUUsagePercent,
        MemoryTotalMb,
        MemoryUsedMb,
        DisksTotalGb,
        DisksUsedGb,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.EquipmentPCInfo WITH (NOLOCK)
) pc ON e.EquipmentId = pc.EquipmentId AND pc.rn = 1
WHERE e.EquipmentId = :equipment_id
"""


# =============================================================================
# 🔹 SINGLE_EQUIPMENT_QUERY_BY_FRONTEND_ID (v2.0.0 신규)
# =============================================================================
# Frontend ID로 단일 설비 조회 (레거시 호환용)
#
# 🆕 v2.0.0 신규: 기존 frontend_id 기반 API 호환을 위해 추가
#
# 사용법:
#   1. UDSService에서 frontend_id → equipment_id 변환 (JSON 매핑 사용)
#   2. SINGLE_EQUIPMENT_QUERY 실행
#   3. 결과에 매핑 정보 병합
#
# 이 쿼리는 직접 사용하지 않음 - 레거시 호환 문서화 용도
# =============================================================================
# ⚠️ 이 쿼리는 제거됨 - UDSService에서 JSON 매핑으로 equipment_id 조회 후
#    SINGLE_EQUIPMENT_QUERY 사용


# =============================================================================
# 🔹 PRODUCTION_COUNT_QUERY (v2.0.0 수정)
# =============================================================================
# 생산량 조회 (CycleTime 카운트)
#
# 🔧 v2.0.0 변경사항:
#   - core.EquipmentMapping JOIN 제거
#   - EquipmentId만 반환 (FrontendId 제거)
#   - UDSService에서 JSON 매핑과 병합
#
# 용도: 배치 쿼리 보완 (생산량 집계)
# 계산: 현재 Lot 시작 이후 CycleTime 레코드 수
#
# 컬럼 인덱스 (v2.0.0):
#  0: EquipmentId     (int)
#  1: ProductionCount (int)
#
# ❌ 제거됨 (v2.0.0):
#  1: FrontendId      → EquipmentId로 대체
#
# 로직:
#  1. 각 설비의 최신 LotStartTime 조회 (IsStart=1)
#  2. LotStartTime 이후의 CycleTime 레코드 COUNT
#  3. GROUP BY로 설비별 집계
#
# =============================================================================
PRODUCTION_COUNT_QUERY = """
SELECT 
    e.EquipmentId,
    COUNT(ct.CycleTimeId) AS ProductionCount
FROM core.Equipment e WITH (NOLOCK)
LEFT JOIN log.CycleTime ct WITH (NOLOCK)
    ON e.EquipmentId = ct.EquipmentId
    AND ct.StartTime >= (
        SELECT TOP 1 OccurredAtUtc 
        FROM log.Lotinfo WITH (NOLOCK)
        WHERE EquipmentId = e.EquipmentId
          AND IsStart = 1
        ORDER BY OccurredAtUtc DESC
    )
WHERE e.SiteId = :site_id 
  AND e.LineId = :line_id
  AND e.IsActive = 1
GROUP BY e.EquipmentId
"""


# =============================================================================
# 🔹 TACT_TIME_QUERY
# =============================================================================
# Tact Time 조회 (최근 2개 CycleTime 간격)
#
# 용도: 단일 설비 Tact Time 계산
# 계산: 최근 1번째 CycleTime과 2번째 CycleTime의 StartTime 차이 (초)
#
# 컬럼 인덱스:
#  0: TactTimeSeconds (int) - DATEDIFF 결과 (초)
#
# 로직:
#  1. CTE로 최근 2개 CycleTime 추출 (ROW_NUMBER)
#  2. rn=1 (최신)과 rn=2 (이전) 조인
#  3. DATEDIFF(SECOND, ...) 계산
#
# ⚠️ 결과 없음: CycleTime 레코드가 2개 미만인 경우
#
# =============================================================================
TACT_TIME_QUERY = """
WITH RecentCycles AS (
    SELECT 
        ct.EquipmentId,
        ct.StartTime,
        ROW_NUMBER() OVER (
            PARTITION BY ct.EquipmentId 
            ORDER BY ct.StartTime DESC
        ) AS rn
    FROM log.CycleTime ct WITH (NOLOCK)
    WHERE ct.EquipmentId = :equipment_id
)
SELECT 
    DATEDIFF(SECOND, rc2.StartTime, rc1.StartTime) AS TactTimeSeconds
FROM RecentCycles rc1
JOIN RecentCycles rc2 ON rc1.EquipmentId = rc2.EquipmentId
WHERE rc1.rn = 1 AND rc2.rn = 2
"""


# =============================================================================
# 🔹 BATCH_TACT_TIME_QUERY (v2.0.0 수정)
# =============================================================================
# 배치 Tact Time 조회 (모든 설비)
#
# 🔧 v2.0.0 변경사항:
#   - core.EquipmentMapping JOIN 제거
#   - EquipmentId만 반환 (FrontendId 제거)
#   - UDSService에서 JSON 매핑과 병합
#
# 용도: 초기 로드 시 전체 설비 Tact Time 일괄 계산
# PRODUCTION_COUNT_QUERY와 함께 사용
#
# 컬럼 인덱스 (v2.0.0):
#  0: EquipmentId     (int)
#  1: TactTimeSeconds (int or NULL)
#
# ❌ 제거됨 (v2.0.0):
#  1: FrontendId      → EquipmentId로 대체
#
# =============================================================================
BATCH_TACT_TIME_QUERY = """
WITH RecentCycles AS (
    SELECT 
        ct.EquipmentId,
        ct.StartTime,
        ROW_NUMBER() OVER (
            PARTITION BY ct.EquipmentId 
            ORDER BY ct.StartTime DESC
        ) AS rn
    FROM log.CycleTime ct WITH (NOLOCK)
    JOIN core.Equipment e WITH (NOLOCK) ON ct.EquipmentId = e.EquipmentId
    WHERE e.SiteId = :site_id 
      AND e.LineId = :line_id
      AND e.IsActive = 1
)
SELECT 
    rc1.EquipmentId,
    DATEDIFF(SECOND, rc2.StartTime, rc1.StartTime) AS TactTimeSeconds
FROM RecentCycles rc1
JOIN RecentCycles rc2 
    ON rc1.EquipmentId = rc2.EquipmentId 
    AND rc1.rn = 1 
    AND rc2.rn = 2
"""


# =============================================================================
# 🔹 STATUS_SNAPSHOT_QUERY (v2.0.0 수정)
# =============================================================================
# Diff 감지용 상태 스냅샷
#
# 🔧 v2.0.0 변경사항:
#   - core.EquipmentMapping JOIN 제거
#   - EquipmentId 기반 조회로 변경 (FrontendId 제거)
#   - UDSService에서 JSON 매핑과 병합
#
# 용도: Status Watcher 10초 주기 Diff 비교
# 특징: 경량 쿼리 (변경 가능성 높은 필드만)
#
# 컬럼 인덱스 (v2.0.0):
#  0: EquipmentId        (int)
#  1: Status             (str)
#  2: StatusChangedAt    (datetime)
#  3: CpuUsagePercent    (float or NULL)
#  4: MemoryUsedMb       (float or NULL)
#  5: MemoryTotalMb      (float or NULL)
#
# ❌ 제거됨 (v2.0.0):
#  0: FrontendId         → EquipmentId로 대체
#
# 비교 대상 필드:
#  - status: 상태 변경
#  - status_changed_at: 상태 변경 시간
#  - cpu_usage_percent: CPU 사용율 변화
#  - memory_usage_percent: 메모리 사용율 변화 (UsedMb / TotalMb * 100 계산)
#
# =============================================================================
STATUS_SNAPSHOT_QUERY = """
SELECT 
    e.EquipmentId,
    es.Status,
    es.OccurredAtUtc AS StatusChangedAt,
    pc.CPUUsagePercent AS CpuUsagePercent,
    pc.MemoryUsedMb,
    pc.MemoryTotalMb
FROM core.Equipment e WITH (NOLOCK)
LEFT JOIN (
    SELECT 
        EquipmentId, 
        Status, 
        OccurredAtUtc,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId 
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.EquipmentState WITH (NOLOCK)
) es ON e.EquipmentId = es.EquipmentId AND es.rn = 1
LEFT JOIN (
    SELECT
        EquipmentId,
        CPUUsagePercent,
        MemoryUsedMb,
        MemoryTotalMb,
        ROW_NUMBER() OVER (
            PARTITION BY EquipmentId
            ORDER BY OccurredAtUtc DESC
        ) AS rn
    FROM log.EquipmentPCInfo WITH (NOLOCK)
) pc ON e.EquipmentId = pc.EquipmentId AND pc.rn = 1
WHERE e.SiteId = :site_id 
  AND e.LineId = :line_id
  AND e.IsActive = 1
"""


# =============================================================================
# 🔹 PRODUCTION_SNAPSHOT_QUERY (v2.0.0 수정)
# =============================================================================
# 생산량 변경 감지용 스냅샷
#
# 🔧 v2.0.0 변경사항:
#   - core.EquipmentMapping JOIN 제거
#   - EquipmentId 기반 조회로 변경 (FrontendId 제거)
#   - UDSService에서 JSON 매핑과 병합
#
# 용도: Status Watcher 생산량 Diff 비교 (선택적 사용)
# 특징: CycleTime 기반 카운트
#
# 컬럼 인덱스 (v2.0.0):
#  0: EquipmentId     (int)
#  1: ProductionCount (int)
#
# ❌ 제거됨 (v2.0.0):
#  0: FrontendId      → EquipmentId로 대체
#
# =============================================================================
PRODUCTION_SNAPSHOT_QUERY = """
SELECT 
    e.EquipmentId,
    COUNT(ct.CycleTimeId) AS ProductionCount
FROM core.Equipment e WITH (NOLOCK)
LEFT JOIN log.CycleTime ct WITH (NOLOCK)
    ON e.EquipmentId = ct.EquipmentId
    AND ct.StartTime >= (
        SELECT TOP 1 OccurredAtUtc 
        FROM log.Lotinfo WITH (NOLOCK)
        WHERE EquipmentId = e.EquipmentId
          AND IsStart = 1
        ORDER BY OccurredAtUtc DESC
    )
WHERE e.SiteId = :site_id 
  AND e.LineId = :line_id
  AND e.IsActive = 1
GROUP BY e.EquipmentId
"""


# =============================================================================
# 🔹 EQUIPMENT_MAPPING_QUERY (v2.0.0 제거됨)
# =============================================================================
# ❌ v2.0.0에서 제거됨
# 이유: core.EquipmentMapping 테이블이 DB에 존재하지 않음
# 대안: config/site_mappings/equipment_mapping_{site_id}.json 파일 사용
#
# 매핑 조회는 UDSService._load_mapping_config() 사용
# =============================================================================
# EQUIPMENT_MAPPING_QUERY = """..."""  # ❌ 제거됨


# =============================================================================
# 🔹 Helper Functions
# =============================================================================

def build_in_clause_params(ids: list, prefix: str = "id") -> tuple:
    """
    IN 절용 파라미터 생성 (SQLAlchemy text() 제약 우회)
    
    Args:
        ids: ID 목록 [1, 2, 3]
        prefix: 파라미터 이름 접두사
        
    Returns:
        (placeholders, params)
        - placeholders: ":id_0, :id_1, :id_2"
        - params: {"id_0": 1, "id_1": 2, "id_2": 3}
    
    Example:
        >>> placeholders, params = build_in_clause_params([1, 2, 3], "eq")
        >>> query = f"SELECT * FROM Equipment WHERE EquipmentId IN ({placeholders})"
        >>> session.execute(text(query), params)
    """
    if not ids:
        return "", {}
    
    placeholders = ", ".join([f":{prefix}_{i}" for i in range(len(ids))])
    params = {f"{prefix}_{i}": id_val for i, id_val in enumerate(ids)}
    
    return placeholders, params


def calculate_memory_usage_percent(used_mb: float, total_mb: float) -> float:
    """
    메모리 사용율 계산
    
    Args:
        used_mb: 사용 중인 메모리 (MB)
        total_mb: 전체 메모리 (MB)
        
    Returns:
        사용율 % (소수점 1자리)
    
    Example:
        >>> calculate_memory_usage_percent(8192, 16384)
        50.0
    """
    if not total_mb or total_mb <= 0:
        return 0.0
    return round((used_mb / total_mb) * 100, 1)


def calculate_disk_usage_percent(used_gb: float, total_gb: float) -> float:
    """
    디스크 사용율 계산
    
    Args:
        used_gb: 사용 중인 용량 (GB)
        total_gb: 전체 용량 (GB)
        
    Returns:
        사용율 % (소수점 1자리)
    
    Example:
        >>> calculate_disk_usage_percent(120, 500)
        24.0
    """
    if not total_gb or total_gb <= 0:
        return 0.0
    return round((used_gb / total_gb) * 100, 1)


# =============================================================================
# 🆕 v2.0.0: FrontendId 파싱 헬퍼
# =============================================================================

def parse_frontend_id(frontend_id: str) -> tuple:
    """
    FrontendId에서 GridRow, GridCol 추출
    
    🆕 v2.0.0: JSON 매핑에서 로드한 FrontendId를 파싱하여
               GridRow, GridCol 계산
    
    Args:
        frontend_id: "EQ-17-03" 형식의 문자열
        
    Returns:
        (grid_row, grid_col): (17, 3)
        
    Raises:
        ValueError: 형식이 잘못된 경우
        
    Example:
        >>> parse_frontend_id("EQ-17-03")
        (17, 3)
        >>> parse_frontend_id("EQ-01-01")
        (1, 1)
    """
    if not frontend_id or not isinstance(frontend_id, str):
        return (0, 0)
    
    try:
        # "EQ-17-03" → ["EQ", "17", "03"]
        parts = frontend_id.split("-")
        if len(parts) != 3 or parts[0] != "EQ":
            return (0, 0)
        
        grid_row = int(parts[1])
        grid_col = int(parts[2])
        
        return (grid_row, grid_col)
        
    except (ValueError, IndexError):
        return (0, 0)


def generate_frontend_id(grid_row: int, grid_col: int) -> str:
    """
    GridRow, GridCol에서 FrontendId 생성
    
    🆕 v2.0.0: 매핑이 없는 경우 Grid 위치 기반으로 FrontendId 생성
    
    Args:
        grid_row: Grid 행 번호 (1-26)
        grid_col: Grid 열 번호 (1-6)
        
    Returns:
        "EQ-{row:02d}-{col:02d}" 형식의 문자열
        
    Example:
        >>> generate_frontend_id(17, 3)
        "EQ-17-03"
        >>> generate_frontend_id(1, 1)
        "EQ-01-01"
    """
    return f"EQ-{grid_row:02d}-{grid_col:02d}"