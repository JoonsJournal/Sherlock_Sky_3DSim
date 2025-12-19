# 성능 최적화 적용 가이드

## 📊 최적화 전/후 비교

### Before (기존)
- **FPS**: 7 fps
- **Draw Calls**: 938
- **조명 개수**: 70개 (PointLight 64개 + DirectionalLight 4개 + 기타 2개)
- **Frame Time**: 151ms
- **Triangles**: 34,400

### After (최적화 후 예상)
- **FPS**: 30~50 fps (3~7배 향상)
- **Draw Calls**: 100~150 (85% 감소)
- **조명 개수**: 6개 (91% 감소)
- **Frame Time**: 20~33ms (67~78% 개선)
- **Triangles**: 34,400 (유지)

---

## 🔧 적용 방법

### 1️⃣ 조명 최적화 적용 (최우선)

**파일 교체: `Lighting.js` → `Lighting.optimized.js`**

```bash
# frontend/threejs_viewer/src/scene/ 디렉토리에서
mv Lighting.js Lighting.js.backup
mv Lighting.optimized.js Lighting.js
```

또는 `main.js`에서 import 경로 변경:

```javascript
// Before
import { Lighting } from './scene/Lighting.js';

// After
import { Lighting } from './scene/Lighting.optimized.js';
```

**효과:**
- ✅ PointLight 64개 제거
- ✅ 조명 개수: 70개 → 6개 (91% 감소)
- ✅ 예상 FPS 향상: 3~5배

---

### 2️⃣ 설비 모델 최적화 적용

**파일 교체: `equipment1.js` → `equipment1.optimized.js`**

```bash
# frontend/threejs_viewer/public/models/equipments/ 디렉토리에서
mv equipment1.js equipment1.js.backup
mv equipment1.optimized.js equipment1.js
```

또는 `EquipmentLoader.js`에서 import 경로 변경:

```javascript
// Before
import { createEquipmentModel } from '../../public/models/equipments/equipment1.js';

// After
import { createEquipmentModel } from '../../public/models/equipments/equipment1.optimized.js';
```

**효과:**
- ✅ Geometry/Material 공유로 메모리 사용량 대폭 감소
- ✅ Draw Calls: 938 → 100~150 (85% 감소)
- ✅ 실린더 segments 감소 (16 → 8)

---

### 3️⃣ 렌더러 최적화 적용

**파일 교체: `SceneManager.js` → `SceneManager.optimized.js`**

```bash
# frontend/threejs_viewer/src/scene/ 디렉토리에서
mv SceneManager.js SceneManager.js.backup
mv SceneManager.optimized.js SceneManager.js
```

**효과:**
- ✅ PixelRatio 최대값 제한 (디바이스 값 → 최대 2)
- ✅ 고성능 모드 설정 (powerPreference)
- ✅ Stencil 버퍼 비활성화
- ✅ 예상 FPS 향상: 10~20%

---

## 🚀 빠른 적용 (권장)

**모든 최적화를 한 번에 적용:**

```bash
# 1. 브랜치 체크아웃
git checkout feature/performance-optimization

# 2. 백업 생성 (선택)
cd frontend/threejs_viewer/src/scene
cp Lighting.js Lighting.js.backup
cp SceneManager.js SceneManager.js.backup

cd ../../public/models/equipments
cp equipment1.js equipment1.js.backup

# 3. 최적화 파일로 교체
cd ~/frontend/threejs_viewer/src/scene
mv Lighting.optimized.js Lighting.js
mv SceneManager.optimized.js SceneManager.js

cd ../../public/models/equipments
mv equipment1.optimized.js equipment1.js

# 4. 브라우저 새로고침 (Ctrl + Shift + R로 캐시 클리어)
```

---

## 📈 성능 측정

최적화 적용 후 콘솔에서 성능 확인:

```javascript
// 실시간 모니터링 시작
startMonitoring()

// 성능 리포트 출력
getPerformanceReport()

// 시스템 정보 확인
getSystemInfo()
```

---

## ⚠️ 주의사항

### 1. 조명 최적화 후 밝기 조정

PointLight 64개를 제거했기 때문에, 환경광과 방향광의 강도를 높였습니다.
만약 너무 밝거나 어둡다면, `Lighting.optimized.js`에서 강도 조정:

```javascript
const ambientLight = new THREE.AmbientLight(
    0xffffff,
    2.5  // 👈 이 값을 조정 (1.5 ~ 3.0 권장)
);

const hemisphereLight = new THREE.HemisphereLight(
    0xffffff,
    0xf5f5f5,
    1.8  // 👈 이 값을 조정 (1.0 ~ 2.5 권장)
);
```

### 2. 설비 모델 공유 리소스

모든 설비가 동일한 Geometry와 Material을 공유하므로:
- ✅ 메모리 사용량 대폭 감소
- ⚠️ 개별 설비의 색상 변경이 모든 설비에 영향
- 💡 개별 색상이 필요하면 `userData`를 활용한 색상 시스템 구현 필요

### 3. 그림자 품질

그림자 맵 해상도를 낮췄으므로 (2048 → 1024), 그림자가 약간 거칠어질 수 있습니다.
필요시 `SceneManager.optimized.js`에서 조정:

```javascript
mainDirectionalLight.shadow.mapSize.width = 2048;  // 1024 → 2048
mainDirectionalLight.shadow.mapSize.height = 2048; // 1024 → 2048
```

---

## 🎯 추가 최적화 옵션 (선택)

### A. LOD (Level of Detail) 시스템

카메라 거리에 따라 모델 디테일 조정:

```javascript
// EquipmentLOD.js 파일이 이미 존재하지만 사용되지 않음
// 필요시 EquipmentLoader.js에서 LOD 적용 가능
```

### B. Frustum Culling

화면 밖 객체 렌더링 제외 (Three.js 기본 활성화):

```javascript
object.frustumCulled = true; // 기본값
```

### C. Occlusion Culling

가려진 객체 렌더링 제외 (복잡한 씬에서 유용):

```javascript
// 커스텀 구현 필요
```

### D. 동적 그림자 비활성화

정적 씬에서는 그림자를 고정하여 성능 향상:

```javascript
renderer.shadowMap.autoUpdate = false;  // 그림자 업데이트 중지
renderer.shadowMap.needsUpdate = true;   // 필요시에만 업데이트
```

---

## 🔍 트러블슈팅

### 1. FPS가 여전히 낮은 경우 (< 30 fps)

**진단:**
```javascript
getPerformanceReport()
```

**원인별 해결책:**
- **Draw Calls가 여전히 높음**: 설비 모델 최적화 적용 확인
- **조명이 여전히 많음**: Lighting 최적화 적용 확인
- **GPU 메모리 부족**: 텍스처 해상도 낮추기

### 2. 조명이 너무 어두운 경우

```javascript
// Lighting.optimized.js에서 강도 증가
ambientLight.intensity = 3.0;  // 2.5 → 3.0
hemisphereLight.intensity = 2.2;  // 1.8 → 2.2
```

### 3. 그림자가 보이지 않는 경우

```javascript
// SceneManager.optimized.js 확인
renderer.shadowMap.enabled = true;  // 그림자 활성화 확인
```

---

## 📞 지원

문제가 지속되면 이슈를 남겨주세요:
- 성능 리포트 결과 (`getPerformanceReport()`)
- 시스템 정보 (`getSystemInfo()`)
- 브라우저 콘솔 로그
- 예상 동작 vs 실제 동작

---

## 📝 변경 이력

### v1.0.0 - 2025-12-19
- 조명 최적화: PointLight 64개 제거
- 설비 모델 최적화: Geometry/Material 공유
- 렌더러 최적화: PixelRatio 제한, powerPreference 설정
- 예상 FPS 향상: 3~7배
