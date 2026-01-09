# 🏭 Cleanroom UI Migration Package

SHERLOCK_SKY_3DSim 프로젝트를 위한 새로운 Cleanroom UI 시스템입니다.

## 📦 패키지 구조

```
cleanroom-ui-migration/
├── MIGRATION_PLAN.md           # 마이그레이션 계획서
├── README.md                   # 이 파일
│
├── src/ui/
│   ├── icons/
│   │   ├── index.js            # 아이콘 모듈 진입점
│   │   └── IconRegistry.js     # SVG 아이콘 레지스트리
│   │
│   └── sidebar/
│       ├── index.js            # 사이드바 모듈 진입점
│       ├── Sidebar.js          # 사이드바 메인 컴포넌트
│       ├── SidebarButton.js    # 아이콘 버튼 컴포넌트
│       └── StatusBar.js        # 하단 상태바 컴포넌트
│
├── styles/components/
│   ├── _sidebar.css            # 사이드바 스타일
│   └── _status-bar.css         # 상태바 스타일
│
├── templates/
│   └── index_cleanroom.html    # 새 index.html 템플릿
│
└── tests/
    ├── test_sidebar_standalone.html   # 단독 테스트
    ├── test_sidebar_integration.html  # 통합 테스트
    └── test_icon_registry.html        # 아이콘 테스트
```

## 🚀 빠른 시작

### 1. 테스트 실행

```bash
# 프로젝트 루트에서
cd frontend/threejs_viewer

# 테스트 파일을 tests/ui/ 에 복사
cp cleanroom-ui-migration/tests/*.html tests/ui/

# http-server 실행
npx http-server -p 8080

# 브라우저에서 테스트 페이지 열기
# http://localhost:8080/tests/ui/test_sidebar_standalone.html
```

### 2. CSS 통합

`styles/main.css`에 다음 import 추가:

```css
/* Cleanroom UI 컴포넌트 */
@import './components/_sidebar.css';
@import './components/_status-bar.css';
```

### 3. JavaScript 모듈 사용

```javascript
// 아이콘 사용
import { iconRegistry } from './ui/icons/index.js';

const icon = iconRegistry.createIcon('monitoring', { size: 28 });
document.body.appendChild(icon);

// 사이드바 사용
import { Sidebar, StatusBar } from './ui/sidebar/index.js';

const sidebar = new Sidebar(document.body, {
    initialMode: 'connection'
});

sidebar.on('modeChange', (mode) => {
    console.log(`Mode: ${mode}`);
});
```

## 🎨 디자인 시스템

### 색상 팔레트

| 변수 | 값 | 용도 |
|------|-----|------|
| `--cleanroom-bg-sidebar` | `#0F172A` | 사이드바 배경 |
| `--cleanroom-icon-normal` | `#E2E8F0` | 기본 아이콘 |
| `--cleanroom-icon-selected` | `#06B6D4` | 선택된 아이콘 (Cyan) |
| `--cleanroom-icon-disabled` | `#334155` | 비활성 아이콘 |

### 모드별 색상

| 모드 | 색상 | 변수 |
|------|------|------|
| Connection | 파랑 | `--mode-connection: #2196F3` |
| Edit | 주황 | `--mode-edit: #FF9800` |
| Monitoring | 초록 | `--mode-monitoring: #4CAF50` |
| Layout | 보라 | `--mode-layout: #9C27B0` |

## ⌨️ 키보드 단축키

| 키 | 동작 |
|----|------|
| `Ctrl+K` | Connection 모드 |
| `M` | Monitoring 모드 |
| `E` | Edit 모드 |
| `P` | Preview 모드 |
| `D` | Debug 패널 |
| `ESC` | 모달/패널 닫기 |

## 📋 체크리스트

### 테스트 완료
- [ ] test_sidebar_standalone.html - 모든 테스트 통과
- [ ] test_sidebar_integration.html - 통합 테스트 통과
- [ ] test_icon_registry.html - 아이콘 테스트 통과

### 통합 완료
- [ ] CSS 파일 복사 및 import 추가
- [ ] JavaScript 모듈 복사
- [ ] index.html 교체 또는 병합
- [ ] 기존 floating-btn 코드 제거
- [ ] 모드 전환 함수 연결

## 🔧 커스터마이징

### 새 아이콘 추가

```javascript
import { iconRegistry } from './ui/icons/index.js';

iconRegistry.registerIcon('custom', {
    name: 'Custom Icon',
    shortcut: 'X',
    paths: '<circle cx="12" cy="12" r="8"/>'
});
```

### 새 버튼 추가

```javascript
import { Sidebar } from './ui/sidebar/index.js';

const sidebar = new Sidebar(container, {
    buttons: [
        ...DEFAULT_BUTTONS,
        { id: 'custom', icon: 'custom', mode: 'custom', group: 'utility' }
    ]
});
```

## 📝 변경 이력

### v1.0.0 (2026-01-10)
- 초기 릴리스
- Cleanroom 사이드바 UI
- SVG 아이콘 레지스트리
- 하단 상태바
- 테스트 파일 3종

## 🤝 기여

1. 테스트 파일로 변경사항 검증
2. CSS 변수 시스템 유지
3. 기존 기능과의 호환성 확인
4. PR 전 모든 테스트 통과 확인

---

**SHERLOCK SKY 3DSim Team** | 2026
