# SHERLOCK_SKY_3DSIM 시스템 분석 및 실행 가이드

## 📋 목차

1. [프로젝트 개요](#%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%EA%B0%9C%EC%9A%94)
2. [전체 폴더/파일 구조](#%EC%A0%84%EC%B2%B4-%ED%8F%B4%EB%8D%94%ED%8C%8C%EC%9D%BC-%EA%B5%AC%EC%A1%B0)
3. [시스템 아키텍처](#%EC%8B%9C%EC%8A%A4%ED%85%9C-%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98)
4. [사전 요구사항](#%EC%82%AC%EC%A0%84-%EC%9A%94%EA%B5%AC%EC%82%AC%ED%95%AD)
5. [전체 시스템 실행 가이드](#%EC%A0%84%EC%B2%B4-%EC%8B%9C%EC%8A%A4%ED%85%9C-%EC%8B%A4%ED%96%89-%EA%B0%80%EC%9D%B4%EB%93%9C)
6. [문제점 및 수정사항](#%EB%AC%B8%EC%A0%9C%EC%A0%90-%EB%B0%8F-%EC%88%98%EC%A0%95%EC%82%AC%ED%95%AD)
7. [개선 제안사항](#%EA%B0%9C%EC%84%A0-%EC%A0%9C%EC%95%88%EC%82%AC%ED%95%AD)

---

## 프로젝트 개요

**SHERLOCK_SKY_3DSIM**은 생산 라인의 77대 설비(26행 × 6열 배열)를 3D로 시각화하고 실시간 모니터링하는 시스템입니다.

### 주요 기능

- 🎮 **3D 실시간 모니터링**: Three.js 기반 설비 배열 시각화
- 📊 **데이터 분석**: OEE, MTBF/MTTR, Pareto 분석
- 🔄 **시뮬레이션**: SimPy 기반 생산 프로세스 시뮬레이션
- 🌐 **실시간 통신**: WebSocket을 통한 실시간 데이터 스트리밍
- 📈 **시계열 데이터**: TimescaleDB를 활용한 이력 데이터 관리

---

## 전체 폴더/파일 구조

```
SHERLOCK_SKY_3DSIM/
│
├── .gitignore                          # Git 무시 파일 설정
│
├── backend/                            # 백엔드 시스템
│   │
│   ├── api/                           # FastAPI 애플리케이션
│   │   ├── database/                  # 데이터베이스 연결 관리
│   │   │   ├── __init__.py           # 
│   │   │   ├── connection.py         # PostgreSQL/Redis 연결 풀
│   │   │   ├── models.py              # 데이터베이스 모델 정의
│   │   │   └── redis_client.py        # 
│   │   │
│   │   ├── routers/                   # API 라우터 (엔드포인트)
│   │   │   ├── __init__.py           # 
│   │   │   ├── analytics.py          # 분석 API (OEE, Pareto 등)
│   │   │   ├── equipment.py          # 설비 정보 API
│   │   │   ├── monitoring.py         # 실시간 모니터링 API
│   │   │   ├── playback.py           # 이력 재생 API
│   │   │   └── production.py         # 생산 데이터 API
│   │   │
│   │   ├── services/                  # 비즈니스 로직
│   │   │   ├── __init__.py           # 
│   │   │   └── playback_service.py   # 이력 재생 서비스
│   │   │
│   │   ├── utils/                    #
│   │   │   ├── __init__.py           # 
│   │   │   ├── errors.py             # 
│   │   │   └── logging_config.py     # 
│   │   │
│   │   ├── websocket/                 # WebSocket 통신
│   │   │   ├── __init__.py           # 
│   │   │   ├── connection_manager.py # WebSocket 연결 관리
│   │   │   └── stream_handler.py     # 실시간 데이터 스트리밍
│   │   │
│   │   ├── __init__.py                # 
│   │   ├── main.py                    # FastAPI 메인 애플리케이션
│   │   └── test_redis_listener.py    # Redis 리스너 테스트
│   │
│   ├── database/
│   │
│   ├── simulator/                     # 시뮬레이션 엔진
│   │   ├── events/
│   │   │   └── __init__.py
│   │   ├── generators/
│   │   │   └── __init__.py
│   │   ├── models/
│   │   │   └── __init__.py
│   │   ├── utils/
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   ├── main.py                    # SimPy 시뮬레이터 메인
│   │   └── simple_equipment.py                    # SimPy 시뮬레이터 메인
│   │
│   ├── tests/
│   │   ├── test_api/
│   │   │   ├── test_analytics.py
│   │   │   ├── test_equipment.py
│   │   │   ├── test_monitoring.py
│   │   │   └── test_production.py
│   │   ├── test_database/
│   │   │   └── test_connection.py
│   │   ├── test_simulator/
│   │   │   └── test_simulation.py
│   │   └── conftest.py
│   │
│   ├── __init__.py
│   ├── environment.yaml                # Conda 환경 설정 (상세)
│   ├── pytest.ini
│   ├── requirements-test.txt        # 
│   ├── requirements.txt             # Python 의존성 (pip)
│   ├── setup_conda_env.bat           # Windows Conda 환경 자동 설정
│   └── test_env.py
│
├── frontend/                          # 프론트엔드 시스템
│   │
│   ├── threejs_viewer/                # Three.js 3D 뷰어
│   │   │
│   │   ├── src/                       # 소스 코드
│   │   │   │
│   │   │   ├── api/                   # API 통신 모듈
│   │   │   │   ├── ApiClient.js      # REST API 클라이언트
│   │   │   │   └── WebSocketClient.js # WebSocket 클라이언트
│   │   │   │
│   │   │   ├── config/                   # 
│   │   │   │   └── environment.js # WebSocket 클라이언트
│   │   │   │
│   │   │   ├── controls/              # 사용자 입력 제어
│   │   │   │   ├── CameraControls.js  # 카메라 조작
│   │   │   │   └── InteractionHandler.js # 마우스/키보드 이벤트
│   │   │   │
│   │   │   ├── scene/                 # 3D 씬 관리
│   │   │   │   ├── SceneManager.js   # 씬 초기화 및 관리
│   │   │   │   ├── EquipmentLoader.js # 설비 모델 로딩
│   │   │   │   ├── EquipmentLOD.js
│   │   │   │   └── Lighting.js       # 조명 설정
│   │   │   │
│   │   │   ├── utils/                 # 유틸리티
│   │   │   │   ├── Config.js         # 전역 설정 (배열, 간격 등)
│   │   │   │   ├── Helpers.js        # 헬퍼 함수
│   │   │   │   └── MemoryManager.js
│   │   │   │
│   │   │   ├── visualization/         # 시각화 모듈
│   │   │   │   ├── DataOverlay.js    # 데이터 오버레이 UI
│   │   │   │   └── StatusVisualizer.js # 상태 시각화 (신호등 등)
│   │   │   │
│   │   │   └── main.js                # 메인 진입점
│   │   │
│   │   ├── public/                    # 정적 파일
│   │   │   ├── models/                # 3D 모델 파일 (현재 비어있음)
│   │   │   │   └── equipments
│   │   │   │       └── equipment1.js. # 설비 모델 파일
│   │   │   └── env-config.js              # 테스트 페이지
│   │   │
│   │   ├── tests/
│   │   │   ├── integration/
│   │   │   │   └── test_websocket.test.js
│   │   │   ├── unit/
│   │   │   │   ├── test_apiclient.test.js
│   │   │   │   ├── test_config.test.js
│   │   │   │   └── test_environment.test.js
│   │   │   └── setup.js
│   │   │ 
│   │   ├── .env.development
│   │   ├── .env.example
│   │   ├── .env.production
│   │   ├── index.html                 # 메인 HTML 페이지
│   │   ├── jest.config.js
│   │   └── package.json               # Node.js 의존성
│   │
│   ├─- .babelrc
│   └── README.md                      # 프론트엔드 상세 가이드
│
└── scripts/
    ├─- optimize_database.py           
    └── setup_database.py              # 데이터베이스 초기화 스크립트
```

### 주요 파일 개수 통계

- **Backend Python 파일**: 개
- **Frontend JavaScript 파일**: 개
- **설정 파일**: 개
- **문서 파일**: 1개

   

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Port 8080)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Three.js 3D Viewer (Browser)               │   │
│  │  - 26x6 설비 배열 시각화                              │   │
│  │  - 실시간 상태 표시 (신호등)                          │   │
│  │  - 인터랙티브 컨트롤                                  │   │
│  └──────────┬──────────────────────────────────────────┘   │
│             │ HTTP + WebSocket                             │
└─────────────┼──────────────────────────────────────────────┘
              │
┌─────────────┼──────────────────────────────────────────────┐
│             ↓          Backend (Port 8000)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            FastAPI Server                            │  │
│  │  ┌────────────────┐  ┌────────────────┐              │  │
│  │  │  REST API      │  │  WebSocket     │              │  │
│  │  │  Routers       │  │  Handlers      │              │  │
│  │  └────────┬───────┘  └────────┬───────┘              │  │
│  └───────────┼──────────────────┼───────────────────────┘  │
│              │                  │                          │
│  ┌───────────┼──────────────────┼──────────────────────┐  │
│  │           ↓                  ↓                      │  │
│  │     Database Layer     WebSocket Manager            │  │
│  └───────────┬──────────────────┬──────────────────────┘  │
│              │                  │                          │
└──────────────┼──────────────────┼──────────────────────────┘
               │                  │
               ↓                  ↓
┌──────────────────────┐  ┌──────────────────────┐
│   PostgreSQL 16      │  │   Redis/Memurai      │
│   + TimescaleDB      │  │   (실시간 캐시)         │
│   (Port 5432)        │  │   (Port 6379)        │
│                      │  │                      │
│  - equipment         │  │  - 실시간 상태          │
│  - equipment_status  │  │  - Pub/Sub 메시징      │
│  - production_ts     │  │  - 세션 관리           │
│  - alarms_ts         │  │                      │
└──────────────────────┘  └──────────────────────┘
               ↑
               │
┌──────────────┴───────────────────────────────────────────┐
│              SimPy Simulator                             │
│  - 생산 프로세스 시뮬레이션                                     │
│  - 실시간 데이터 생성                                         │
│  - Redis로 이벤트 발행                                       │
└──────────────────────────────────────────────────────────┘
```

### 데이터 흐름

1. **실시간 모니터링 흐름**:
    
    ```
    Simulator → PostgreSQL/Redis → FastAPI → WebSocket → Frontend
    ```
    
2. **이력 조회 흐름**:
    
    ```
    Frontend → FastAPI REST API → PostgreSQL → Frontend
    ```
    
3. **분석 흐름**:
    
    ```
    Frontend → FastAPI Analytics API → PostgreSQL/계산 → Frontend
    ```
    

---

## 사전 요구사항

### 1. 시스템 요구사항

- **OS**: Windows 10/11 또는 macOS, Linux
- **RAM**: 최소 8GB (권장 16GB)
- **디스크**: 최소 5GB 여유 공간

### 2. 필수 소프트웨어

#### Backend

|소프트웨어|버전|용도|설치 확인|
|---|---|---|---|
|**Python**|3.10+|백엔드 런타임|`python --version`|
|**Conda**|Latest|환경 관리 (선택)|`conda --version`|
|**PostgreSQL**|16|메인 데이터베이스|`psql --version`|
|**TimescaleDB**|2.x|시계열 확장|PostgreSQL 내 확인|
|**Redis** (Windows: Memurai)|6.x+|캐시/메시징|`redis-cli ping`|

#### Frontend

|소프트웨어|버전|용도|설치 확인|
|---|---|---|---|
|**Node.js**|16+|패키지 관리|`node --version`|
|**npm**|8+|의존성 설치|`npm --version`|

#### 브라우저

- Chrome/Edge 최신 버전 (WebGL 2.0 지원)
- Firefox 최신 버전

### 3. Python 의존성 (requirements.txt)

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
simpy==4.1.1
numpy==1.26.2
asyncpg==0.29.0
psycopg2-binary==2.9.9
aioredis==2.0.1
websockets==12.0
pydantic==2.5.0
pydantic-settings==2.1.0
python-multipart==0.0.6
```

### 4. 데이터베이스 설정 정보

```python
# backend/api/database/connection.py
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'sherlock_sky',
    'user': 'postgres',
    'password': 'password'  # ⚠️ 실제 비밀번호로 변경 필요
}

REDIS_CONFIG = {
    'host': 'localhost',
    'port': 6379,
    'db': 0
}
```

---

## 전체 시스템 실행 가이드

### 📋 실행 순서 요약

```
1. PostgreSQL + Redis 실행 확인
2. 데이터베이스 초기화
3. Backend API 서버 시작
4. (선택) Simulator 시작
5. Frontend 서버 시작
6. 브라우저에서 확인
```

---

### STEP 1: PostgreSQL 및 Redis 실행 확인

#### Windows

```powershell
# PostgreSQL 서비스 확인
sc query postgresql-x64-16

# PostgreSQL 시작 (필요시)
net start postgresql-x64-16

# Memurai (Redis) 확인
sc query Memurai

# Memurai 시작 (필요시)
net start Memurai
```

#### macOS/Linux

```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# PostgreSQL 시작
sudo systemctl start postgresql

# Redis 상태 확인
sudo systemctl status redis

# Redis 시작
sudo systemctl start redis
```

#### 연결 테스트

```bash
# PostgreSQL 테스트
psql -U postgres -h localhost -p 5432

# Redis 테스트
redis-cli ping
# 응답: PONG
```

---

### STEP 2: 데이터베이스 초기화

#### 방법 1: 스크립트 사용 (권장)

```bash
# 저장소 루트에서 실행
python scripts/setup_database.py
```

**실행 결과 예시**:

```
============================================================
  SHERLOCK_SKY_3DSIM Database Setup
  Windows Native Installation
============================================================

Step 1: Creating database...
  ✓ Database 'sherlock_sky' created

Step 2: Enabling TimescaleDB extension...
  ✓ TimescaleDB extension enabled
  ✓ TimescaleDB verified

Step 3: Creating tables...
  ✓ Table 'equipment' created
  ✓ Table 'equipment_status_ts' created
  ✓ Hypertable 'equipment_status_ts' created
  ✓ Table 'production_ts' created
  ✓ Hypertable 'production_ts' created
  ✓ Table 'alarms_ts' created
  ✓ Hypertable 'alarms_ts' created
  ✓ Indexes created

Step 4: Inserting sample equipment data...
  ✓ Inserted 156 equipment records

Step 5: Testing Redis connection...
  ✓ Redis/Memurai connection successful
  ✓ Redis read/write test passed

============================================================
  Database Setup Complete!
============================================================
```

#### 방법 2: 수동 실행

```sql
-- PostgreSQL에 접속
psql -U postgres

-- 데이터베이스 생성
CREATE DATABASE sherlock_sky;

-- 데이터베이스 연결
\c sherlock_sky

-- TimescaleDB 확장 활성화
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 테이블 생성은 scripts/setup_database.py 참조
```

---

### STEP 3: Backend 환경 설정 및 실행

#### 방법 1: Conda 환경 사용 (권장)

##### Windows

```bash
# backend 폴더로 이동
cd backend

# Conda 환경 자동 설정 (bat 파일 사용)
setup_conda_env.bat

# 또는 수동 설정
conda env create -f environment.yml
conda activate sherlockSky3DSimBackend
```

##### macOS/Linux

```bash
cd backend

# Conda 환경 생성
conda env create -f environment.yml

# 환경 활성화
conda activate sherlockSky3DSimBackend
```

#### 방법 2: pip 사용

```bash
cd backend

# 가상환경 생성 (선택)
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

#### 연결 테스트

```bash
# 데이터베이스 연결 테스트
python test_connection.py
```

#### FastAPI 서버 실행

```bash
# backend 폴더에서 실행
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# 또는 간단하게
uvicorn api.main:app --reload
```

**성공 메시지**:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
✓ 데이터베이스 연결 완료
✓ Redis 리스너 시작
INFO:     Application startup complete.
```

#### API 확인

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

---

### STEP 4: (선택) Simulator 실행

**새 터미널에서 실행**:

```bash
# backend 폴더로 이동
cd backend

# Conda 환경 활성화 (환경 사용 시)
conda activate sherlockSky3DSimBackend

# Simulator 실행
python -m simulator.main
```

**Simulator 기능**:

- 77대 설비의 실시간 상태 시뮬레이션
- Redis Pub/Sub를 통한 이벤트 발행
- PostgreSQL에 데이터 저장

---

### STEP 5: Frontend 실행

#### 의존성 설치 (최초 1회)

```bash
# frontend/threejs_viewer 폴더로 이동
cd frontend/threejs_viewer

# 의존성 설치
npm install
```

#### 개발 서버 실행

```bash
# 캐시 비활성화 모드로 실행 (개발 중 권장)
npm run dev

# 또는 일반 모드
npm start
```

**실행 결과**:

```
Starting up http-server, serving .

http-server version: 14.1.1

Available on:
  http://127.0.0.1:8080
  http://192.168.1.100:8080

Hit CTRL-C to stop the server
```

---

### STEP 6: 브라우저에서 확인

#### 접속

```
http://localhost:8080
```

#### 주요 기능 확인

1. **3D 시각화**:
    
    - 26행 × 6열 설비 배열 표시
    - 설비별 신호등 상태 표시
2. **마우스 조작**:
    
    - 좌클릭 + 드래그: 회전
    - 휠: 줌
    - 우클릭 + 드래그: 이동
    - 설비 클릭: 정보 패널
3. **키보드 단축키**:
    
    - `H`: 헬퍼 토글
    - `R`: 카메라 리셋
    - `D`: 디버그 패널
    - `ESC`: 패널 닫기
4. **디버그 콘솔** (F12):
    
    ```javascript
    // 도움말
    debugHelp()
    
    // 씬 정보
    debugScene()
    
    // 카메라 이동
    moveCameraTo(0, 40, 40)
    
    // 설비 포커스
    focusEquipment(1, 1)
    ```
    

---

## 문제점 및 수정사항

### 🔴 Critical (즉시 수정 필요)

#### 1. ❌ 파일명 오타

**문제**: `backend/reauirements.txt` (오타)

**파일 위치**:

```
backend/
├── requirements.txt    ✓ 정상
├── reauirements.txt   ❌ 오타 (삭제 필요)
```

**수정 방법**:

```bash
cd backend
rm reauirements.txt
```

---

#### 2. ❌ 하드코딩된 데이터베이스 비밀번호

**문제**: 소스 코드에 비밀번호가 하드코딩됨

**문제 파일**:

- `backend/api/database/connection.py`
- `scripts/setup_database.py`

**현재 코드**:

```python
DB_CONFIG = {
    'password': 'password'  # ❌ 보안 취약
}
```

**수정 방법**: 환경 변수 사용

```python
# .env 파일 생성
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sherlock_sky
DB_USER=postgres
DB_PASSWORD=your_secure_password
REDIS_HOST=localhost
REDIS_PORT=6379

# connection.py 수정
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'sherlock_sky'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD')
}
```

**추가 필요**:

```bash
# requirements.txt에 추가
python-dotenv==1.0.0
```

---

#### 3. ⚠️ CORS 설정 제한

**문제**: CORS 허용 출처가 하드코딩됨

**현재 코드** (`backend/api/main.py`):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],  # 고정됨
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**수정 방법**:

```python
import os

# 환경 변수로 관리
ALLOWED_ORIGINS = os.getenv(
    'ALLOWED_ORIGINS', 
    'http://localhost:8080,http://127.0.0.1:8080'
).split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

#### 4. ❌ 에러 처리 부족

**문제**: 주요 API 엔드포인트에 예외 처리 미흡

**예시** (router 파일들):

```python
# 현재: 예외 처리 없음
@router.get("/equipment/{equipment_id}")
async def get_equipment(equipment_id: str):
    result = query_database(equipment_id)  # ❌ 실패 시 500 에러
    return result
```

**수정 방법**:

```python
from fastapi import HTTPException

@router.get("/equipment/{equipment_id}")
async def get_equipment(equipment_id: str):
    try:
        result = query_database(equipment_id)
        if not result:
            raise HTTPException(status_code=404, detail="Equipment not found")
        return result
    except Exception as e:
        logger.error(f"Error fetching equipment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

---

### 🟡 Medium (중요)

#### 5. ⚠️ 설비 배열 불일치

**문제**: 코드 전반에 설비 배열 크기가 일관되지 않음

**발견된 불일치**:

|파일|배열 크기|총 설비|
|---|---|---|
|`frontend/README.md`|11행 × 7열|77대|
|`frontend/threejs_viewer/src/utils/Config.js`|26행 × 6열|156대|
|`scripts/setup_database.py`|11행 × 7열|77대|

**실제 요구사항 확인 필요**:

- userMemories: "77대 설비 (7행 × 11열)"
- Config.js: 26행 × 6열 (실제 코드)
- 제외 위치: 39개 → 실제 설비 = 156 - 39 = 117대

**수정 방안**:

1. **요구사항 명확화**: 프로젝트 전체에 일관된 배열 크기 결정
2. **설정 통합**: 단일 설정 파일에서 관리
3. **문서 업데이트**: README와 주석 일괄 수정

---

#### 6. ⚠️ 로깅 시스템 부재

**문제**: `print()` 문 사용, 구조화된 로깅 없음

**현재**:

```python
print("✓ 데이터베이스 연결 완료")  # ❌
print(f"✗ 에러 발생: {e}")  # ❌
```

**수정 방법**:

```python
import logging
from logging.handlers import RotatingFileHandler

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('logs/app.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 사용
logger.info("데이터베이스 연결 완료")
logger.error(f"에러 발생: {e}", exc_info=True)
```

---

#### 7. ⚠️ Frontend 환경 설정 부재

**문제**: API 엔드포인트가 JavaScript에 하드코딩됨

**현재** (`frontend/threejs_viewer/src/api/ApiClient.js`):

```javascript
class ApiClient {
    constructor() {
        this.baseURL = 'http://localhost:8000/api';  // ❌ 하드코딩
        this.wsURL = 'ws://localhost:8000/ws';       // ❌ 하드코딩
    }
}
```

**수정 방법**:

```javascript
// config/environment.js 생성
export const ENV = {
    API_BASE_URL: window.ENV?.API_BASE_URL || 'http://localhost:8000/api',
    WS_URL: window.ENV?.WS_URL || 'ws://localhost:8000/ws',
    DEBUG_MODE: window.ENV?.DEBUG_MODE || false
};

// index.html에 주입
<script>
    window.ENV = {
        API_BASE_URL: 'http://your-production-url.com/api',
        WS_URL: 'wss://your-production-url.com/ws',
        DEBUG_MODE: false
    };
</script>

// ApiClient.js
import { ENV } from '../config/environment.js';

class ApiClient {
    constructor() {
        this.baseURL = ENV.API_BASE_URL;
        this.wsURL = ENV.WS_URL;
    }
}
```

---

### 🟢 Low (개선 권장)

#### 8. 📝 문서화 미흡

**문제**:

- 루트 README.md 파일 없음
- API 엔드포인트 설명 부족
- 설치 가이드 분산

**개선 방안**:

```
프로젝트 루트에 추가:
├── README.md                  # 전체 프로젝트 개요
├── INSTALL.md                 # 상세 설치 가이드
├── API_DOCUMENTATION.md       # API 명세
├── TROUBLESHOOTING.md         # 문제 해결 가이드
└── docs/
    ├── architecture.md        # 아키텍처 문서
    ├── database_schema.md     # DB 스키마
    └── development_guide.md   # 개발 가이드
```

---

#### 9. 📦 의존성 버전 고정 부족

**문제**: 일부 의존성 버전이 느슨하게 지정됨

**현재 requirements.txt**:

```
fastapi==0.104.1  ✓
numpy==1.26.2     ✓
simpy==4.1.1      ✓
...
```

**package.json**:

```json
{
  "dependencies": {
    "three": "^0.160.0"  // ⚠️ ^ 표기는 minor 버전 자동 업데이트
  }
}
```

**권장**:

```json
{
  "dependencies": {
    "three": "0.160.0"  // 정확한 버전 고정
  }
}
```

---

#### 10. 🧪 테스트 코드 부재

**문제**: 단위 테스트/통합 테스트 없음

**권장 구조**:

```
backend/
├── tests/
│   ├── __init__.py
│   ├── test_api/
│   │   ├── test_equipment.py
│   │   ├── test_monitoring.py
│   │   └── test_analytics.py
│   ├── test_database/
│   │   └── test_connection.py
│   └── test_simulator/
│       └── test_main.py
└── pytest.ini

frontend/
└── tests/
    ├── unit/
    │   ├── test_api_client.test.js
    │   └── test_config.test.js
    └── integration/
        └── test_websocket.test.js
```

**필요 패키지**:

```bash
# Backend
pip install pytest pytest-asyncio pytest-cov

# Frontend
npm install --save-dev jest @testing-library/jest-dom
```

---

#### 11. 🐳 Docker 지원 부재

**문제**: 배포 환경 구성 복잡

**권장**: Docker Compose 추가

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_DB: sherlock_sky
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis

  frontend:
    build: ./frontend/threejs_viewer
    ports:
      - "8080:8080"
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

#### 12. 📊 모니터링 도구 부재

**문제**: 프로덕션 환경 모니터링 불가

**권장**:

- **Prometheus**: 메트릭 수집
- **Grafana**: 대시보드
- **Sentry**: 에러 추적

```python
# backend/api/main.py에 추가
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(...)

# Prometheus 메트릭 추가
Instrumentator().instrument(app).expose(app)
```

---

## 개선 제안사항

### 1. 🚀 성능 최적화

#### Backend

```python
# 데이터베이스 연결 풀 최적화
pg_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=5,      # 증가
    maxconn=20,     # 증가
    **DB_CONFIG
)

# Redis 파이프라인 사용
pipe = redis_client.pipeline()
for eq_id in equipment_ids:
    pipe.get(f"equipment:{eq_id}")
results = pipe.execute()
```

#### Frontend

```javascript
// Three.js 렌더링 최적화
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));  // 고해상도 제한

// Frustum Culling 활용 (이미 자동)
camera.updateMatrix();
camera.updateMatrixWorld();

// LOD (Level of Detail) 적용
import { LOD } from 'three';
const lod = new LOD();
lod.addLevel(detailedMesh, 0);
lod.addLevel(simpleMesh, 50);
```

---

### 2. 🔒 보안 강화

#### Backend

```python
# JWT 인증 추가
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.get("/protected")
async def protected_route(token: str = Depends(oauth2_scheme)):
    # 토큰 검증
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
```

#### HTTPS 강제

```python
# Nginx 또는 Traefik 사용
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(HTTPSRedirectMiddleware)
```

---

### 3. 📈 확장성 개선

#### 마이크로서비스 분리

```
현재:
├── FastAPI (단일 서비스)

제안:
├── API Gateway
├── Equipment Service
├── Monitoring Service
├── Analytics Service
└── Simulator Service
```

#### 메시지 큐 도입

```python
# RabbitMQ 또는 Apache Kafka
from aio_pika import connect_robust

async def send_event(event_data):
    connection = await connect_robust("amqp://guest:guest@localhost/")
    channel = await connection.channel()
    await channel.default_exchange.publish(
        Message(body=json.dumps(event_data).encode()),
        routing_key='equipment.status'
    )
```

---

### 4. 🎨 UI/UX 개선

#### 반응형 디자인

```css
/* 현재: 고정 크기 */
canvas { width: 100%; height: 100%; }

/* 제안: 미디어 쿼리 */
@media (max-width: 768px) {
    .info-panel {
        position: fixed;
        bottom: 0;
        width: 100%;
    }
}
```

#### 다크 모드 지원

```javascript
// Config.js에 추가
THEME: {
    LIGHT: {
        BACKGROUND: 0xf5f5f5,
        FLOOR: 0xf0f0f0,
        GRID: 0xdcdcdc
    },
    DARK: {
        BACKGROUND: 0x1a1a1a,
        FLOOR: 0x2a2a2a,
        GRID: 0x3a3a3a
    }
}
```

---

### 5. 📊 데이터 시각화 강화

#### Chart.js 통합

```javascript
import Chart from 'chart.js/auto';

class AnalyticsChart {
    constructor(canvasId) {
        this.chart = new Chart(canvasId, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'OEE %',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                }]
            }
        });
    }
    
    updateData(newData) {
        this.chart.data.datasets[0].data = newData;
        this.chart.update();
    }
}
```

#### 실시간 대시보드

```
추가 페이지:
├── /dashboard          # 전체 현황
├── /equipment/:id      # 개별 설비 상세
├── /analytics          # 분석 페이지
└── /alarms             # 알람 관리
```

---

### 6. 🧩 개발 도구 개선

#### Pre-commit Hooks

```bash
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
  - repo: https://github.com/psf/black
    hooks:
      - id: black
```

#### ESLint + Prettier

```json
// .eslintrc.json
{
  "extends": ["eslint:recommended", "prettier"],
  "env": {
    "browser": true,
    "es2021": true
  },
  "parserOptions": {
    "sourceType": "module"
  }
}
```

---

## 요약 및 우선순위

### 🔴 즉시 수정 (1-2일)

1. ✅ `reauirements.txt` 삭제
2. ✅ 환경 변수 설정 (.env 파일)
3. ✅ 기본 에러 처리 추가

### 🟡 1주일 내 수정

4. ✅ 로깅 시스템 구축
5. ✅ 설비 배열 크기 통일
6. ✅ CORS 설정 개선
7. ✅ Frontend 환경 설정

### 🟢 2-4주 내 개선

8. ✅ 테스트 코드 작성
9. ✅ Docker Compose 구성
10. ✅ 문서화 완성
11. ✅ 성능 최적화

### 💡 장기 계획 (1-3개월)

12. ✅ 마이크로서비스 아키텍처
13. ✅ 모니터링 시스템
14. ✅ CI/CD 파이프라인
15. ✅ 확장 기능 (알람, 예측 등)

---

## 연락처 및 지원

**개발자**: 이동준  
**GitHub**: https://github.com/JoonsJournal/Sherlock_Sky_3DSim

---

**문서 버전**: 1.0.0  
**마지막 업데이트**: 2024년 12월 16일