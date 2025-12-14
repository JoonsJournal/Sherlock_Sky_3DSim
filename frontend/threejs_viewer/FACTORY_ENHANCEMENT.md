# 🏭 Factory Scene Enhancement

## 개요
공장(Plant) 시뮬레이션 화면처럼 보이도록 Scene을 개선한 기능 브랜치입니다.

## 🎨 주요 변경사항

### 1. **Config.js** - 공장 스타일 설정 추가
- **배경색**: 어두운 남색(0x1a1a2e) → 라이트 스틸 블루(0xb0c4de) - 공장 창문으로 보이는 하늘
- **바닥색**: 어두운 회색(0x2d3436) → 콘크리트 회색(0x8c8c8c)
- **조명 강도**: 더 밝고 산업적인 조명으로 개선
  - Ambient: 0.6 → 0.7
  - Directional: 0.8 → 1.0
  - Point: 따뜻한 흰색(0xffffcc) 추가
  - **NEW**: HemisphereLight 추가 (하늘과 지면 반사광)
- **공장 환경 설정** 추가:
  - 벽 (WALLS)
  - 기둥 (PILLARS)
  - 천장 트러스 (CEILING_TRUSS)
  - 파이프/배관 (PIPES)
  - 안전 표시 (SAFETY_SIGNS)

### 2. **SceneManager.js** - 바닥 및 환경 개선
- **콘크리트 바닥**: MeshStandardMaterial로 거친 표면 질감 추가 (roughness: 0.9)
- **안개 효과**: 공장 분위기를 위한 Fog 추가 (40m ~ 80m)
- **안전선**: 노란색 경계선 추가 (공장 안전 구역 표시)
- **그림자**: PCFSoftShadowMap으로 부드러운 그림자 효과

### 3. **Lighting.js** - 공장 조명 시스템
- **HemisphereLight**: 하늘과 지면 반사광 시뮬레이션
- **4개의 SpotLight**: 천장 조명 시뮬레이션 (12m 높이, 4방향)
- **그림자 설정**: 모든 조명에 그림자 활성화
- **비상등 효과**: 선택적 비상등 기능 추가 (깜빡임)

### 4. **FactoryEnvironment.js** - 공장 환경 요소 (신규)
#### 벽 (Walls)
- 4방향 벽 생성 (높이: 8m, 두께: 0.3m)
- 밝은 회색(0xcccccc) 머티리얼
- 입구 표시 (어두운 영역)

#### 기둥 (Pillars)
- 격자 패턴 배치 (10m 간격)
- 어두운 회색(0x999999)
- 금속 질감 (metalness: 0.3)

#### 천장 트러스 (Ceiling Truss)
- 가로/세로 빔 구조 (높이: 7.5m)
- 공장 천장 구조물 시뮬레이션
- 6개씩 교차 배치

#### 파이프/배관 (Pipes)
- 벽을 따라 배치 (높이: 6m)
- 금속 파이프 질감 (metalness: 0.7)
- CylinderGeometry로 실린더 형태

### 5. **main.js** - 모듈 통합
- `FactoryEnvironment` 모듈 import 추가
- 초기화 시퀀스에 공장 환경 요소 추가
- 디버그 메시지에 "FACTORY SIMULATION 모드" 표시

## 🎯 시각적 개선 효과

### Before (기존)
- ❌ 어두운 배경 (0x1a1a2e)
- ❌ 단순한 바닥과 그리드
- ❌ 기본적인 조명 (3개)
- ❌ 빈 공간

### After (개선)
- ✅ 밝은 공장 배경 (0xb0c4de)
- ✅ 콘크리트 바닥 + 안전선
- ✅ 다층 조명 시스템 (6개+)
- ✅ 벽, 기둥, 천장, 파이프
- ✅ 안개 효과로 깊이감
- ✅ 공장 특유의 산업적 분위기

## 📊 성능 영향

### 추가된 객체 수
- 벽: 5개 (4방향 + 입구)
- 기둥: ~25개 (10m 간격)
- 천장 트러스: 12개 (가로 6 + 세로 6)
- 파이프: 2개
- 천장 조명: 4개 (SpotLight)
- 안전선: 4개

**총 추가 객체**: ~52개

### 최적화
- 모든 환경 요소는 CONFIG에서 ON/OFF 가능
- 필요 없는 요소는 비활성화하여 성능 조절 가능

## 🔧 사용 방법

### 환경 요소 활성화/비활성화
`Config.js`에서 다음 설정 변경:

```javascript
FACTORY_ENVIRONMENT: {
    WALLS: { ENABLED: true },        // 벽
    PILLARS: { ENABLED: true },      // 기둥
    CEILING_TRUSS: { ENABLED: true }, // 천장
    PIPES: { ENABLED: true },        // 파이프
    SAFETY_SIGNS: { ENABLED: true }  // 안전선
}
```

### 색상 커스터마이징
```javascript
SCENE: {
    BACKGROUND_COLOR: 0xb0c4de,  // 배경색
    FLOOR_COLOR: 0x8c8c8c,       // 바닥색
    FLOOR_ROUGHNESS: 0.9         // 바닥 거칠기
}
```

### 조명 조절
```javascript
LIGHTING: {
    AMBIENT: { INTENSITY: 0.7 },      // 주변광
    DIRECTIONAL: { INTENSITY: 1.0 },  // 방향광
    HEMISPHERE: { INTENSITY: 0.5 }    // 반구광
}
```

## 🚀 테스트

### 로컬 테스트
```bash
cd frontend/threejs_viewer
http-server -p 8080 --cache=0 --cors
```

브라우저에서 `http://localhost:8080` 접속

### 디버그 모드
콘솔에서 다음 명령어 사용:
- `debugScene()` - 씬 정보 확인
- `debugRenderer()` - 렌더러 정보
- `debugHelp()` - 도움말

## 📝 추가 개선 가능 사항

1. **텍스처 추가**
   - 콘크리트 바닥 텍스처 이미지
   - 벽 텍스처 (페인트 질감)
   - 금속 파이프 텍스처

2. **동적 효과**
   - 조명 깜빡임 애니메이션
   - 비상등 효과
   - 안전선 깜빡임

3. **추가 환경 요소**
   - 창문 (자연광 효과)
   - 작업대/테이블
   - 안전 표지판 (3D 텍스트)
   - 소화기/비상구 표시

4. **LOD (Level of Detail)**
   - 멀리 있는 객체 단순화
   - 성능 최적화

## 🐛 알려진 이슈

없음 (현재까지)

## 📜 변경 이력

- 2024-12-14: 공장 Scene 개선 기능 구현
  - Config 색상 및 조명 설정
  - SceneManager 바닥 및 안개 효과
  - Lighting 공장 조명 시스템
  - FactoryEnvironment 모듈 신규 생성
  - main.js 통합

## 👥 기여자

- 이동준 (Dongjoon Lee)

## 📄 라이선스

MIT License