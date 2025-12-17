# 🔍 성능 모니터링 가이드

## 📋 목차
1. [요구사항](#요구사항)
2. [성능 모니터링 사용법](#성능-모니터링-사용법)
3. [성능 이슈 해결 가이드](#성능-이슈-해결-가이드)
4. [최적화 체크리스트](#최적화-체크리스트)

---

## 🎯 요구사항

### 네트워크 요구사항
| 항목 | 최소 | 권장 | 설명 |
|------|------|------|------|
| 대역폭 | 5 Mbps | 10+ Mbps | Three.js CDN 로딩 및 실시간 데이터 |
| 레이턴시 | < 200ms | < 100ms | 웹소켓 실시간 통신 |
| 네트워크 타입 | 3G | 4G/LTE | 안정적인 연결 |

### 클라이언트 하드웨어 요구사항
| 항목 | 최소 | 권장 | 설명 |
|------|------|------|------|
| GPU | WebGL 2.0 지원 | 전용 GPU | 하드웨어 가속 필수 |
| RAM | 4GB | 8GB+ | 3D 렌더링 메모리 |
| CPU | 듀얼코어 | 쿼드코어+ | 다중 스레드 처리 |
| 브라우저 | Chrome 90+ | Chrome 최신 | WebGL 2.0 지원 |

### 렌더링 성능 목표
| 메트릭 | 최소 | 권장 | 이상적 |
|--------|------|------|--------|
| FPS | 15 fps | 30 fps | 60 fps |
| Frame Time | < 66ms | < 33ms | < 16ms |
| Draw Calls | < 1000 | < 500 | < 300 |
| Triangles | < 2M | < 1M | < 500K |
| GPU Memory | < 1GB | < 512MB | < 256MB |

---

## 🔧 성능 모니터링 사용법

### 1. 기본 사용법

#### 브라우저 개발자 도구 열기
```
F12 (Windows/Linux)
Cmd+Option+I (Mac)
```

#### 콘솔에서 명령어 실행

**📊 실시간 모니터링 시작**
```javascript
startMonitoring()
// ▶️ 성능 모니터링 시작
// 1초마다 다음 정보 출력:
// - FPS (프레임/초)
// - Frame Time (ms)
// - Draw Calls
// - Triangles
// - GPU Memory
// - Network Status
```

**⏸️ 모니터링 중지**
```javascript
stopMonitoring()
```

**📋 상세 분석 리포트**
```javascript
getPerformanceReport()
// 출력 내용:
// - 성능 메트릭 (현재 + 평균)
// - 시스템 정보 (CPU, GPU, 메모리)
// - 네트워크 정보
// - 성능 이슈 목록
// - 최적화 권장사항
```

### 2. 개별 정보 확인

**💻 시스템 정보**
```javascript
getSystemInfo()
// 하드웨어 스펙 확인:
// - CPU 코어 수
// - 디바이스 메모리
// - GPU 정보
// - 화면 해상도
// - Pixel Ratio
```

**🌐 네트워크 정보**
```javascript
getNetworkInfo()
// 네트워크 상태:
// - 연결 상태 (온라인/오프라인)
// - 네트워크 타입 (4G/3G/2G)
// - 다운링크 속도 (Mbps)
// - RTT 레이턴시 (ms)
```

**⚡ 현재 성능 통계**
```javascript
getPerformanceStats()
// 실시간 성능:
// - FPS
// - Frame Time
// - Draw Calls
// - Triangles
```

**💾 메모리 정보**
```javascript
getMemoryInfo()
// GPU 메모리 사용량:
// - Geometries
// - Textures
// - Programs
```

### 3. 도움말
```javascript
debugHelp()
// 사용 가능한 모든 명령어 표시
```

---

## ⚠️ 성능 이슈 해결 가이드

### 문제 1: 낮은 FPS (< 30fps)

#### 🔍 진단
```javascript
startMonitoring()
// 1초 후 FPS 확인
// 🔴 FPS: 15 (평균: 12) <- 문제!
```

#### 💡 해결 방법

**A. Draw Calls 줄이기**
```javascript
getPerformanceStats()
// Draw Calls: 1500 <- 너무 많음!

// 해결:
// 1. Geometry Instancing 적용
// 2. 동일 재질 메시 병합
// 3. LOD (Level of Detail) 시스템 적용
```

**B. Triangles 줄이기**
```javascript
getPerformanceStats()
// Triangles: 2,500,000 <- 과다!

// 해결:
// 1. 복잡한 geometry 단순화
// 2. Frustum Culling 활성화
// 3. 멀리 있는 객체 숨김
```

**C. GPU 메모리 최적화**
```javascript
getMemoryInfo()
// GPU Memory: ~1200MB <- 높음!

// 해결:
// 1. 텍스처 크기 축소
// 2. 텍스처 압축 사용
// 3. 사용하지 않는 리소스 dispose()
```

---

### 문제 2: 느린 네트워크 (1~2fps 업데이트)

#### 🔍 진단
```javascript
getNetworkInfo()
// 🔴 Network: 2g (0.5 Mbps, 500ms RTT) <- 매우 느림!
```

#### 💡 해결 방법

**A. 네트워크 환경 개선**
- 더 빠른 인터넷 연결 사용 (4G/LTE, WiFi)
- 라우터와 가까운 위치에서 접속
- VPN 끄기 (레이턴시 증가 원인)

**B. 서버 측 최적화**
```bash
# 로컬 네트워크에서 http-server 실행
cd frontend/threejs_viewer
npm run dev

# 다른 PC에서 접속:
# http://[서버IP]:8080
```

**C. Three.js 로컬 호스팅**
```html
<!-- CDN 대신 로컬 파일 사용 -->
<script type="module" src="/libs/three.module.js"></script>
```

---

### 문제 3: 높은 Draw Calls (> 500)

#### 🔍 진단
```javascript
getPerformanceStats()
// 🟡 Draw Calls: 750 <- 최적화 필요
```

#### 💡 해결 방법

**Geometry Instancing 적용**
```javascript
// EquipmentLoader.js 수정 예시
import { InstancedMesh } from 'three';

// 동일한 설비를 Instancing으로 렌더링
const instancedMesh = new InstancedMesh(geometry, material, count);
```

**메시 병합**
```javascript
// 동일 재질의 여러 메시를 하나로 병합
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';

const merged = BufferGeometryUtils.mergeBufferGeometries(geometries);
```

---

### 문제 4: GPU 메모리 부족

#### 🔍 진단
```javascript
getSystemInfo()
// GPU Renderer: Intel UHD Graphics 620 <- 통합 GPU

getMemoryInfo()
// 🔴 GPU Memory: ~1500MB <- 과다 사용!
```

#### 💡 해결 방법

**텍스처 최적화**
```javascript
// 텍스처 크기 축소
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.generateMipmaps = false;

// 압축 텍스처 사용 (DDS, KTX)
```

**Geometry 재사용**
```javascript
// 동일한 geometry는 공유
const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
const mesh1 = new THREE.Mesh(sharedGeometry, material1);
const mesh2 = new THREE.Mesh(sharedGeometry, material2);
```

**리소스 정리**
```javascript
// 사용하지 않는 리소스 해제
geometry.dispose();
material.dispose();
texture.dispose();
```

---

## ✅ 최적화 체크리스트

### 렌더링 최적화
- [ ] LOD (Level of Detail) 시스템 적용
- [ ] Frustum Culling 활성화
- [ ] Occlusion Culling 구현
- [ ] Geometry Instancing 사용
- [ ] 동일 재질 메시 병합
- [ ] Shadow Map 해상도 최적화

### 메모리 최적화
- [ ] 텍스처 크기 최소화
- [ ] 텍스처 압축 사용
- [ ] Geometry 재사용
- [ ] 사용하지 않는 리소스 dispose()
- [ ] BufferGeometry 사용

### 네트워크 최적화
- [ ] Three.js 라이브러리 로컬 호스팅
- [ ] 초기 로딩 데이터 최소화
- [ ] WebSocket 압축 활성화
- [ ] Lazy Loading 적용

### 코드 최적화
- [ ] 애니메이션 루프 최적화
- [ ] 불필요한 업데이트 제거
- [ ] requestAnimationFrame 사용
- [ ] 계산 캐싱

---

## 📊 성능 측정 예시

### 1. 초기 상태 확인
```javascript
// 페이지 로드 후 5초 대기
setTimeout(() => {
    startMonitoring();
}, 5000);

// 30초 후 리포트 생성
setTimeout(() => {
    const report = getPerformanceReport();
    console.log('초기 성능 리포트:', report);
}, 35000);
```

### 2. 네트워크 변화 모니터링
```javascript
// 네트워크 정보 주기적 확인
setInterval(() => {
    getNetworkInfo();
}, 5000);
```

### 3. 시스템 정보 로그
```javascript
// 시스템 스펙 확인 및 저장
const sysInfo = getSystemInfo();
console.log('클라이언트 시스템:', {
    platform: sysInfo.platform,
    cpuCores: sysInfo.hardwareConcurrency,
    deviceMemory: sysInfo.deviceMemory,
    gpu: sysInfo.gpu?.renderer,
    screen: `${sysInfo.screen.width}x${sysInfo.screen.height}`,
    pixelRatio: sysInfo.screen.pixelRatio
});
```

---

## 🚨 성능 경고 임계값

PerformanceMonitor는 다음 임계값을 사용하여 자동으로 성능 이슈를 감지합니다:

| 메트릭 | 🔴 Critical | 🟡 Warning | 🟢 Good |
|--------|-------------|------------|---------|
| FPS | < 15 | < 30 | ≥ 50 |
| Frame Time | > 66ms | > 33ms | ≤ 16ms |
| Draw Calls | > 1000 | > 500 | ≤ 300 |
| Triangles | > 2M | > 1M | ≤ 500K |
| GPU Memory | > 1GB | > 512MB | ≤ 256MB |
| Network | 2G/Offline | 3G | 4G |

---

## 💡 추가 팁

### 1. 개발 중 상시 모니터링
```javascript
// index.html의 <script> 태그에 추가
window.addEventListener('load', () => {
    setTimeout(() => {
        startMonitoring();
    }, 3000);
});
```

### 2. 성능 로그 저장
```javascript
// 리포트를 JSON으로 저장
const report = getPerformanceReport();
const json = JSON.stringify(report, null, 2);
console.log('리포트 JSON:', json);

// 또는 로컬 스토리지에 저장
localStorage.setItem('performanceReport', json);
```

### 3. 비교 분석
```javascript
// 최적화 전 측정
const before = getPerformanceReport();

// ... 최적화 작업 ...

// 최적화 후 측정
const after = getPerformanceReport();

// 비교
console.log('FPS 개선:', after.performance.current.fps - before.performance.current.fps);
console.log('Draw Calls 감소:', before.performance.current.drawCalls - after.performance.current.drawCalls);
```

---

## 📞 문제 해결이 안될 때

1. **브라우저 호환성 확인**
   - Chrome 90 이상 사용
   - WebGL 2.0 지원 확인: https://get.webgl.org/webgl2/

2. **하드웨어 가속 활성화**
   - Chrome 설정 → 시스템 → "하드웨어 가속 사용(가능한 경우)" 체크

3. **GPU 드라이버 업데이트**
   - 최신 그래픽 드라이버 설치

4. **성능 리포트 공유**
   ```javascript
   const report = getPerformanceReport();
   // 리포트를 개발자에게 공유
   ```

---

## 📚 참고 자료

- [Three.js 성능 최적화 가이드](https://threejs.org/manual/#en/optimize-lots-of-objects)
- [WebGL 성능 모범 사례](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [Chrome DevTools 성능 분석](https://developer.chrome.com/docs/devtools/performance/)
