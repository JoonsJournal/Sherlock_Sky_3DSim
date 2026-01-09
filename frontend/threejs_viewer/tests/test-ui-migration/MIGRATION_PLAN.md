# 🏭 Cleanroom UI Migration Plan

## 📋 개요

새로운 Cleanroom UI 사이드바 시스템을 기존 SHERLOCK_SKY_3DSIM 프로젝트에 통합하기 위한 종합 계획서입니다.

---

## 🎯 목표

1. **기존 floating-btn 시스템** → **사이드바 기반 UI**로 전환
2. **SVG 아이콘 모듈화** - 별도 폴더/파일로 관리
3. **CSS 변수 통합** - 기존 `_variables.css`와 새 테마 병합
4. **점진적 마이그레이션** - 기존 기능 유지하면서 UI 업그레이드

---

## 📁 제안 폴더 구조

```
frontend/threejs_viewer/
├── src/
│   ├── ui/
│   │   ├── sidebar/                    # 🆕 새 사이드바 시스템
│   │   │   ├── Sidebar.js              # 사이드바 컴포넌트
│   │   │   ├── SidebarButton.js        # 아이콘 버튼 컴포넌트
│   │   │   └── StatusBar.js            # 하단 상태바 컴포넌트
│   │   └── icons/                      # 🆕 SVG 아이콘 모듈
│   │       ├── index.js                # 아이콘 export 집합
│   │       ├── IconRegistry.js         # 아이콘 레지스트리
│   │       ├── connection.svg          # DB 연결 아이콘
│   │       ├── mapping.svg             # 데이터 매핑 아이콘
│   │       ├── monitoring.svg          # 시스템 모니터링 아이콘
│   │       ├── edit.svg                # 편집 모드 아이콘
│   │       ├── viewer.svg              # 3D 뷰어 아이콘
│   │       ├── layout.svg              # 레이아웃 에디터 아이콘
│   │       ├── settings.svg            # 설정 아이콘
│   │       ├── warning.svg             # 경고 아이콘
│   │       └── error.svg               # 에러 아이콘
│   │
├── styles/
│   ├── base/
│   │   └── _variables.css              # ✏️ 새 변수 추가
│   ├── components/
│   │   ├── _sidebar.css                # 🆕 사이드바 스타일
│   │   ├── _status-bar.css             # 🆕 상태바 스타일
│   │   └── _icon-buttons.css           # 🆕 아이콘 버튼 스타일
│   └── main.css                        # ✏️ 새 import 추가
│
├── tests/
│   └── ui/
│       ├── test_sidebar_standalone.html    # 🆕 단독 테스트
│       ├── test_sidebar_integration.html   # 🆕 통합 테스트
│       └── test_icon_registry.html         # 🆕 아이콘 테스트
```

---

## 🧪 테스트 전략

### Phase 1: 단독 테스트 (Standalone)
- 새 UI 컴포넌트만 격리하여 테스트
- 기존 코드와 완전 분리
- CSS 변수 충돌 검증

### Phase 2: 통합 테스트 (Integration)
- 기존 `main.css` import하여 호환성 검증
- 모드 전환 시 사이드바 상태 변경 테스트
- 3D 씬과 함께 렌더링 테스트

### Phase 3: 기능 테스트 (Functional)
- 클릭 이벤트 핸들링
- 상태 업데이트 (연결 상태, 알람 등)
- 반응형 동작

### Phase 4: 성능 테스트
- 애니메이션 FPS 측정
- 메모리 사용량 모니터링
- 렌더링 성능 영향 분석

---

## 📝 CSS 변수 매핑

### 기존 변수 → 새 Cleanroom 테마 매핑

| 새 변수 (Cleanroom) | 기존 변수 | 용도 |
|---------------------|-----------|------|
| `--bg-sidebar` | `--overlay-bg-primary` | 사이드바 배경 |
| `--icon-normal` | `--overlay-text-secondary` | 기본 아이콘 색상 |
| `--icon-selected` | `--mode-connection` | 선택된 아이콘 (Cyan) |
| `--icon-disabled` | `--overlay-text-muted` | 비활성 아이콘 |
| `--text-normal` | `--overlay-text-muted` | 일반 텍스트 |
| `--text-warning` | `--status-warning` | 경고 텍스트 |
| `--text-alarm` | `--status-error` | 알람 텍스트 |

### 새로 추가할 변수

```css
:root {
    /* Cleanroom Sidebar Theme */
    --sidebar-width: 80px;
    --sidebar-width-expanded: 200px;
    --sidebar-bg: #0F172A;
    
    --icon-btn-size: 50px;
    --icon-size: 28px;
    --icon-stroke-normal: 2px;
    --icon-stroke-hover: 3px;
    
    --status-bar-height: 36px;
    
    /* Neon Cyan for Selection */
    --neon-cyan: #06B6D4;
    --neon-cyan-glow: 0 0 8px #06B6D4;
}
```

---

## 🔄 마이그레이션 단계

### Step 1: 기반 구축 (1-2일)
- [ ] 새 폴더 구조 생성
- [ ] CSS 변수 추가
- [ ] 기본 테스트 파일 작성

### Step 2: SVG 아이콘 모듈화 (1일)
- [ ] 개별 SVG 파일 생성
- [ ] IconRegistry.js 구현
- [ ] 아이콘 로딩 테스트

### Step 3: 사이드바 컴포넌트 (2-3일)
- [ ] Sidebar.js 구현
- [ ] SidebarButton.js 구현
- [ ] CSS 스타일 작성
- [ ] 단독 테스트 통과

### Step 4: 상태바 컴포넌트 (1-2일)
- [ ] StatusBar.js 구현
- [ ] 상태 업데이트 로직 연결
- [ ] 애니메이션 구현

### Step 5: 통합 (2-3일)
- [ ] index.html 교체
- [ ] 기존 floating-btn 제거
- [ ] 모드 전환 연결
- [ ] 회귀 테스트

### Step 6: 최적화 (1-2일)
- [ ] 성능 최적화
- [ ] 접근성 개선
- [ ] 문서화

---

## ⚠️ 주의사항

1. **기존 기능 유지**: 모든 버튼 기능(Connection, Edit, Monitoring 등)이 동일하게 작동해야 함
2. **CSS 변수 충돌 방지**: 새 변수는 `--cleanroom-` 접두사 고려
3. **점진적 전환**: Feature Flag로 신/구 UI 전환 가능하게
4. **테스트 우선**: 각 단계별 테스트 통과 후 다음 단계 진행

---

## 📊 성공 기준

- [ ] 모든 기존 기능 정상 작동
- [ ] 애니메이션 60fps 유지
- [ ] CSS 변수 100% 통합
- [ ] 테스트 커버리지 90% 이상
- [ ] 코드 리뷰 통과
