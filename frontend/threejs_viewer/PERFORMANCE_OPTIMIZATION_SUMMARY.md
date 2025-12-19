# 🚀 성능 최적화 요약

## 📊 성능 문제 진단

### 초기 상태
```
FPS: 7 fps (목표: 60 fps)
Draw Calls: 938 (권장: <300)
Frame Time: 151ms
Triangles: 34,400
조명 개수: 70개
```

### 주요 병목 지점
1. **PointLight 64개** - 실시간 조명 과다 (가장 심각)
2. **Draw Calls 938개** - 메시 병합 없음, Geometry 공유 없음
3. **그림자 설정** - 모든 메시에 그림자, 2048x2048 shadow map

---

## 🔧 최적화 내용

### 1️⃣ 조명 시스템 최적화 (최우선)

**변경 사항:**
```
Before: PointLight 64개 + DirectionalLight 4개 + 기타 2개 = 총 70개
After:  DirectionalLight 4개 + AmbientLight 1개 + HemisphereLight 1개 = 총 6개
```

**파일:**
- `src/scene/Lighting.optimized.js`

**효과:**
- ✅ 조명 개수 91% 감소 (70개 → 6개)
- ✅ 예상 FPS 향상: 3~5배
- ✅ GPU 부하 대폭 감소

**적용 방법:**
```javascript
// main.js에서
import { Lighting } from './scene/Lighting.optimized.js';
```

---

### 2️⃣ 설비 모델 최적화

**변경 사항:**
- 모든 설비가 동일한 Geometry 인스턴스 공유
- 모든 설비가 동일한 Material 인스턴스 공유
- 실린더 segments 감소 (16 → 8)
- 작은 객체 그림자 비활성화

**파일:**
- `public/models/equipments/equipment1.optimized.js`

**효과:**
- ✅ Draw Calls 85% 감소 (938 → 100~150)
- ✅ GPU 메모리 사용량 대폭 감소
- ✅ Triangle 수 약간 감소

**적용 방법:**
```javascript
// EquipmentLoader.js에서
import { createEquipmentModel } from '../../public/models/equipments/equipment1.optimized.js';
```

---

### 3️⃣ 렌더러 최적화

**변경 사항:**
- PixelRatio 최대값 제한 (devicePixelRatio → max 2)
- powerPreference: 'high-performance'
- Stencil 버퍼 비활성화
- 그림자 맵 해상도 축소 (2048 → 1024)

**파일:**
- `src/scene/SceneManager.optimized.js`

**효과:**
- ✅ 고해상도 디스플레이 성능 향상
- ✅ GPU 고성능 모드 활성화
- ✅ 예상 FPS 향상: 10~20%

**적용 방법:**
```javascript
// main.js에서
import { SceneManager } from './scene/SceneManager.optimized.js';
```

---

## 📈 예상 최적화 결과

### After (최적화 후)
```
FPS: 30~50 fps (3~7배 향상) ✅
Draw Calls: 100~150 (85% 감소) ✅
Frame Time: 20~33ms (67~78% 개선) ✅
조명 개수: 6개 (91% 감소) ✅
Triangles: 34,400 (유지)
```

### 성능 향상 요약
- **FPS**: 7 → 30~50 (3~7배 향상)
- **Draw Calls**: 938 → 100~150 (85% 감소)
- **조명**: 70개 → 6개 (91% 감소)
- **Frame Time**: 151ms → 20~33ms (67~78% 개선)

---

## 🚀 빠른 적용

### 자동 적용 스크립트

```bash
#!/bin/bash
cd frontend/threejs_viewer

# 백업
cp src/scene/Lighting.js src/scene/Lighting.js.backup
cp src/scene/SceneManager.js src/scene/SceneManager.js.backup
cp public/models/equipments/equipment1.js public/models/equipments/equipment1.js.backup

# 최적화 파일로 교체
cp src/scene/Lighting.optimized.js src/scene/Lighting.js
cp src/scene/SceneManager.optimized.js src/scene/SceneManager.js
cp public/models/equipments/equipment1.optimized.js public/models/equipments/equipment1.js

echo "✅ 최적화 적용 완료!"
echo "브라우저를 새로고침하세요 (Ctrl + Shift + R)"
```

### 수동 적용

1. **조명 최적화** (필수)
   ```bash
   mv src/scene/Lighting.optimized.js src/scene/Lighting.js
   ```

2. **설비 모델 최적화** (권장)
   ```bash
   mv public/models/equipments/equipment1.optimized.js public/models/equipments/equipment1.js
   ```

3. **렌더러 최적화** (권장)
   ```bash
   mv src/scene/SceneManager.optimized.js src/scene/SceneManager.js
   ```

---

## 📝 파일 목록

### 최적화 파일
```
frontend/threejs_viewer/
├── src/scene/
│   ├── Lighting.optimized.js          (조명 최적화)
│   └── SceneManager.optimized.js      (렌더러 최적화)
├── public/models/equipments/
│   └── equipment1.optimized.js        (설비 모델 최적화)
└── PERFORMANCE_OPTIMIZATION_GUIDE.md  (상세 가이드)
```

### 원본 파일 (백업 권장)
```
frontend/threejs_viewer/
├── src/scene/
│   ├── Lighting.js          → Lighting.js.backup
│   └── SceneManager.js      → SceneManager.js.backup
└── public/models/equipments/
    └── equipment1.js        → equipment1.js.backup
```

---

## 🎯 우선순위별 적용

### 단계 1: 조명 최적화만 적용 (최우선)
→ **FPS 향상: 3~5배**

### 단계 2: 조명 + 설비 모델 최적화
→ **FPS 향상: 5~7배**

### 단계 3: 모든 최적화 적용
→ **FPS 향상: 최대 7~10배**

---

## ⚠️ 알려진 제약사항

1. **개별 설비 색상 변경**
   - 모든 설비가 Material을 공유하므로, 색상 변경 시 모든 설비에 영향
   - 해결: userData 기반 색상 시스템 구현 필요

2. **그림자 품질**
   - Shadow map 해상도 감소 (2048 → 1024)
   - 필요시 해상도 다시 증가 가능 (성능 trade-off)

3. **조명 밝기**
   - PointLight 제거로 환경광 강도 증가
   - 필요시 `Lighting.optimized.js`에서 강도 조정

---

## 📚 참고 문서

- [상세 적용 가이드](PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [Three.js 성능 최적화 베스트 프랙티스](https://threejs.org/manual/#en/optimize)
- [WebGL 성능 최적화](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

---

## 🔍 성능 측정

최적화 전후 성능을 측정하려면:

```javascript
// 콘솔에서 실행
getPerformanceReport()  // 상세 성능 리포트
startMonitoring()        // 실시간 모니터링 시작
stopMonitoring()         // 모니터링 중지
```

---

**작성일**: 2025-12-19  
**버전**: 1.0.0  
**작성자**: Claude (Anthropic)
