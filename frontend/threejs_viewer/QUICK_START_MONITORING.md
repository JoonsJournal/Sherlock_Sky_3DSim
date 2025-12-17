# 🚀 빠른 성능 모니터링 시작하기

다른 PC에서 웹 접속 시 1~2FPS로 느린 문제를 진단하고 해결하는 방법입니다.

## ⚡ 3분 안에 문제 진단하기

### 1️⃣ 페이지 접속 후 개발자 도구 열기
```
F12 (Windows/Linux) 또는 Cmd+Option+I (Mac)
```

### 2️⃣ Console 탭에서 실시간 모니터링 시작
```javascript
startMonitoring()
```

### 3️⃣ 1분 대기 후 분석 리포트 확인
```javascript
getPerformanceReport()
```

---

## 📊 리포트 읽는 법

### 🔴 Critical (즉시 해결 필요)
```
🔴 매우 낮은 FPS: 8 (목표: 60fps)
🔴 매우 높은 Draw Calls: 1500 (권장: <300)
🔴 네트워크 연결 끊김
```

### 🟡 Warning (최적화 권장)
```
🟡 낮은 FPS: 25 (목표: 60fps)
🟡 높은 Draw Calls: 650 (권장: <300)
🟡 느린 네트워크: 2g
```

### 🟢 Good (정상)
```
🟢 FPS: 58 (평균: 60)
```

---

## 🔧 일반적인 문제와 즉각 해결

### 문제 1: "매우 낮은 FPS" 🔴
```javascript
// 원인 확인
getPerformanceStats()
// Draw Calls: 1200 <- 문제!

// ✅ 해결: 77개 설비를 Instancing으로 변경
// → Draw Calls가 1200 → 50개로 감소
```

### 문제 2: "느린 네트워크" 🔴
```javascript
// 네트워크 확인
getNetworkInfo()
// 🔴 Network: 2g (0.5 Mbps, 500ms RTT)

// ✅ 해결: 
// 1. WiFi/LAN으로 변경
// 2. 로컬 네트워크에서 서버 실행
```

### 문제 3: "높은 GPU 메모리" 🟡
```javascript
// 메모리 확인
getMemoryInfo()
// 🔴 GPU Memory: ~1200MB

// ✅ 해결:
// 1. 텍스처 크기 축소
// 2. LOD 시스템 적용
```

---

## 💻 시스템 요구사항 확인

```javascript
getSystemInfo()
```

**최소 요구사항:**
- ✅ WebGL 2.0 지원 GPU
- ✅ 4GB+ RAM
- ✅ 듀얼코어+ CPU
- ✅ Chrome 90+

**네트워크 요구사항:**
- ✅ 5+ Mbps 다운로드
- ✅ <100ms 레이턴시
- ✅ 3G 이상

---

## 🎯 목표 성능 지표

| 메트릭 | 최소 | 권장 | 이상적 |
|--------|------|------|--------|
| **FPS** | 15 | 30 | **60** ✨ |
| **Frame Time** | <66ms | <33ms | **<16ms** ✨ |
| **Draw Calls** | <1000 | <500 | **<300** ✨ |
| **GPU Memory** | <1GB | <512MB | **<256MB** ✨ |

---

## 📱 명령어 치트시트

```javascript
// 🔍 진단
startMonitoring()           // 실시간 모니터링 시작
getPerformanceReport()      // 상세 분석 리포트
getSystemInfo()             // 하드웨어 정보
getNetworkInfo()            // 네트워크 상태

// ⏸️ 제어
stopMonitoring()            // 모니터링 중지

// ❓ 도움말
debugHelp()                 // 모든 명령어 보기
```

---

## 🆘 긴급 문제 해결

### 접속은 되는데 화면이 안보여요
```javascript
// 렌더러 확인
debugRenderer()

// 씬 확인
debugScene()
```

### FPS가 5 이하로 떨어져요
```javascript
// 즉시 통계 확인
getPerformanceStats()

// Draw Calls > 1000 → Instancing 필요
// Triangles > 2M → Geometry 단순화 필요
// GPU Memory > 1GB → 텍스처 최적화 필요
```

### 다른 PC에서만 느려요
```javascript
// 시스템 비교
getSystemInfo()

// 통합 GPU (Intel UHD)? → 성능 제한
// 저사양 RAM? → 브라우저 탭 줄이기
// 저속 네트워크? → 로컬 서버 사용
```

---

## 📖 더 자세한 가이드

전체 가이드: [`PERFORMANCE_GUIDE.md`](./PERFORMANCE_GUIDE.md)

---

## 💡 Tip: 자동 모니터링

`index.html`에 추가하면 페이지 로드 시 자동으로 모니터링 시작:

```html
<script>
window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.startMonitoring) {
            startMonitoring();
            console.log('✅ 자동 모니터링 시작됨');
        }
    }, 3000);
});
</script>
```
