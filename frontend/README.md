# Sherlock_Sky_3DSim

3D 설비 배열 시각화 시스템

## 📁 프로젝트 구조

```
SHERLOCK_SKY_3DSIM/
├── frontend/
│   └── threejs-viewer/          # Three.js 3D 뷰어
│       ├── src/
│       │   ├── main.js          # 메인 진입점
│       │   ├── scene/           # 씬 관련
│       │   │   ├── SceneManager.js
│       │   │   ├── EquipmentLoader.js
│       │   │   └── Lighting.js
│       │   ├── controls/        # 컨트롤 관련
│       │   │   ├── CameraControls.js
│       │   │   └── InteractionHandler.js
│       │   ├── visualization/   # 시각화 관련
│       │   │   ├── StatusVisualizer.js
│       │   │   └── DataOverlay.js
│       │   ├── api/             # API 통신
│       │   │   ├── ApiClient.js
│       │   │   └── WebSocketClient.js
│       │   └── utils/           # 유틸리티
│       │       ├── Config.js
│       │       └── Helpers.js
│       ├── public/
│       │   ├── index.html
│       │   └── models/          # 모델 파일
│       │       └── equipment1.js
│       └── package.json
```

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:8080` 접속

## 🎮 사용법

### 마우스 조작
- **좌클릭 + 드래그**: 카메라 회전
- **휠**: 줌 인/아웃
- **우클릭 + 드래그**: 카메라 이동
- **설비 클릭**: 설비 정보 패널 표시

### 키보드 단축키
- **H**: 헬퍼 표시/숨김 토글
- **R**: 카메라 초기 위치로 리셋
- **D**: 디버그 패널 토글
- **ESC**: 설비 정보 패널 닫기

### 디버그 콘솔 명령어

F12로 콘솔을 열고 다음 명령어를 사용할 수 있습니다:

```javascript
// 도움말
debugHelp()

// 씬 정보 출력
debugScene()

// 카메라 이동
moveCameraTo(x, y, z)

// 특정 설비에 포커스
focusEquipment(row, col)  // 예: focusEquipment(1, 1)

// 헬퍼 토글
toggleHelpers()

// 렌더러 정보
debugRenderer()

// 성능 측정 (기본 5초)
measurePerformance(5000)
```

## 📊 설비 배열 구성

- **배열 크기**: 26행 × 6열 (총 156개 위치)
- **실제 설비**: 117대 (제외 위치 39개)
- **설비 크기**: 1.5m × 2.2m × 2.0m (W × H × D)
- **기본 간격**: 0.1m (10cm)
- **복도 위치**: 
  - 열 방향: 1열, 3열, 5열 뒤 (폭 1.2m)
  - 행 방향: 13행 뒤 (폭 2.0m)

### 제외 위치 상세
```javascript
// col:4, row 4~13 (10개) - 중앙 통로
// col:5, row 1~13 (13개) - 우측 영역
// col:6, row 1~13 (13개) - 우측 영역
// col:5, row 15~16 (2개) - 우측 영역
// col:5, row 22 (1개) - 우측 영역
// 총 39개 제외 → 실제 설비 117대
```

### 배치 구조
```
     열 1    열 2    복도    열 3    열 4    복도    열 5    열 6
행 1  [설비] [설비]  1.2m   [설비]  [설비]  1.2m   [제외]  [제외]
행 2  [설비] [설비]         [설비]  [설비]         [제외]  [제외]
...
행 13 [설비] [설비]         [설비]  [설비]         [제외]  [제외]
      ────────────────── 2.0m 복도 ──────────────────
행 14 [설비] [설비]         [설비]  [설비]         [설비]  [설비]
...
행 26 [설비] [설비]         [설비]  [설비]         [설비]  [설비]
```

## 🎨 모델 관리

### 기본 모델 사용
현재 `public/models/equipment1.js`의 Three.js 지오메트리 기반 모델 사용

### 외부 모델 추가 (향후 지원)

```javascript
// OBJ 모델
import { loadOBJModel } from './public/models/equipment1.js';
const model = await loadOBJModel('path/to/model.obj');

// STL 모델
import { loadSTLModel } from './public/models/equipment1.js';
const model = await loadSTLModel('path/to/model.stl');

// GLTF 모델
import { loadGLTFModel } from './public/models/equipment1.js';
const model = await loadGLTFModel('path/to/model.gltf');
```

## ⚙️ 설정 변경

`src/utils/Config.js`에서 다음 설정을 변경할 수 있습니다:

- 디버그 모드 활성화/비활성화
- 카메라 초기 위치
- 설비 배열 크기 및 간격
- 조명 설정
- 씬 배경색 등

## 🔌 API 통합 (예정)

### REST API
```javascript
import { ApiClient } from './src/api/ApiClient.js';

const api = new ApiClient('http://localhost:8000/api');
const equipment = await api.getEquipment('EQ-01-01');
```

### WebSocket
```javascript
import { WebSocketClient } from './src/api/WebSocketClient.js';

const ws = new WebSocketClient('ws://localhost:8000/ws');
ws.connect();
ws.onEquipmentStatusUpdate((data) => {
    console.log('설비 상태 업데이트:', data);
});
```

## ⚙️ 환경 설정

### 개발 환경

1. `.env.example`을 `.env.development`로 복사:
```bash
cp .env.example .env.development
```

2. 필요에 따라 값 수정:
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
VITE_DEBUG_MODE=true
```

3. 개발 서버 실행:
```bash
npm run dev
```

### 프로덕션 배포

#### 방법 1: 환경 변수 파일 사용

1. `.env.production` 파일 생성:
```env
VITE_API_BASE_URL=https://api.your-domain.com/api
VITE_WS_URL=wss://api.your-domain.com/ws
VITE_DEBUG_MODE=false
MODE=production
```

2. 빌드:
```bash
npm run build
```

#### 방법 2: 런타임 환경 변수 (Docker/Kubernetes)

`public/env-config.js` 파일의 템플릿 변수를 실제 값으로 치환:
```bash
# 환경 변수 설정
export API_BASE_URL="https://api.production.com/api"
export WS_URL="wss://api.production.com/ws"
export DEBUG_MODE="false"
export ENVIRONMENT="production"

# env-config.js 파일 생성
envsubst < public/env-config.js.template > public/env-config.js

# 빌드
npm run build
```

#### Docker 예제
```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# 환경 변수로 빌드 (빌드 시점)
ARG VITE_API_BASE_URL
ARG VITE_WS_URL
ARG VITE_DEBUG_MODE=false

RUN npm run build

# Nginx로 서빙
FROM nginx:alpine

# 빌드된 파일 복사
COPY --from=build /app/dist /usr/share/nginx/html

# env-config.js 템플릿 복사
COPY public/env-config.js /usr/share/nginx/html/public/

# 런타임에 환경 변수 주입
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/public/env-config.js > /usr/share/nginx/html/public/env-config.js.tmp && mv /usr/share/nginx/html/public/env-config.js.tmp /usr/share/nginx/html/public/env-config.js && nginx -g 'daemon off;'"]
```

### 환경별 설정 확인

브라우저 콘솔에서:
```javascript
// 현재 환경 설정 확인
window.getEnvironment()

// 환경 정보 출력
window.printEnvironmentInfo()
```

### 환경 변수 목록

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `VITE_API_BASE_URL` | API 서버 주소 | `http://localhost:8000/api` |
| `VITE_WS_URL` | WebSocket 서버 주소 | `ws://localhost:8000/ws` |
| `VITE_DEBUG_MODE` | 디버그 모드 활성화 | `true` (개발), `false` (프로덕션) |
| `MODE` | 환경 이름 | `development` |
| `VITE_MAX_RECONNECT_ATTEMPTS` | 최대 재연결 시도 | `10` |
| `VITE_RECONNECT_INTERVAL` | 재연결 간격 (ms) | `5000` |

## 📝 개발 가이드

### 새로운 모델 추가
1. `public/models/` 폴더에 모델 파일 추가
2. 로더 함수 작성 또는 기존 함수 활용
3. `EquipmentLoader.js`에서 모델 로드 로직 수정

### 새로운 시각화 추가
1. `src/visualization/` 폴더에 새 모듈 생성
2. `main.js`에서 import 및 초기화

### 새로운 API 엔드포인트 추가
1. `src/api/ApiClient.js`에 메서드 추가
2. 필요한 곳에서 호출

## 🐛 디버깅

### 디버그 모드
`src/utils/Config.js`에서 `DEBUG_MODE: true` 설정 시:
- 콘솔에 상세 로그 출력
- 축 헬퍼, 원점 마커, 테스트 큐브 표시
- 디버그 명령어 사용 가능

### 성능 모니터링
```javascript
measurePerformance(5000)  // 5초 동안 FPS 측정
debugRenderer()           // 렌더러 메모리/성능 정보
```

## 📚 기술 스택

- **Three.js** 0.160.0 - 3D 렌더링
- **OrbitControls** - 카메라 조작
- **ES6 Modules** - 모듈화
- **HTTP Server** - 개발 서버

## 🔄 향후 계획

- [ ] SimPy 시뮬레이션 엔진 통합
- [ ] Dash/Plotly 대시보드 연동
- [ ] PostgreSQL + TimescaleDB 연동
- [ ] FastAPI 백엔드 구축
- [ ] 실시간 알람 로그 분석
- [ ] MTBF/MTTR 통계 표시
- [ ] OBJ/STL/GLTF 모델 로더 구현

## 📄 라이선스

MIT License

## 👨‍💻 개발자

이동준