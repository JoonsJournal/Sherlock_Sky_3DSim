/**
 * initLayoutUI.js
 * ================
 * Layout Editor UI 컴포넌트 초기화
 * 
 * main.js bootstrap 패턴 적용
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/bootstrap/initLayoutUI.js
 */

/**
 * UIService 초기화
 */
function initUIService(services) {
    if (typeof UIService === 'undefined') {
        console.warn('⚠️ UIService 미로드');
        return null;
    }
    
    const uiService = new UIService({
        canvas: services.canvas,
        state: window.layoutEditorState,
        toolService: services.toolService,
        componentService: services.componentService
    });
    
    console.log('  ✓ UIService');
    return uiService;
}

/**
 * 컴포넌트 서브메뉴 설정
 */
function setupComponentSubmenu(uiService) {
    if (!uiService) return;
    uiService.setupComponentSubmenu();
    console.log('  ✓ Component Submenu');
}

/**
 * Drop Zone 활성화
 */
function setupDropZone(componentService) {
    if (!componentService) return;
    componentService.enableDropZone('drop-guide');
    console.log('  ✓ Drop Zone');
}

/**
 * Canvas 크기 업데이터 설정
 */
function setupCanvasSizeUpdater(uiService, canvas, toolService) {
    if (!uiService) return;
    
    const updateCanvasSize = () => {
        const size = window.calculateCanvasSize?.() || { width: 800, height: 600 };
        if (canvas.stage) {
            canvas.stage.width(size.width);
            canvas.stage.height(size.height);
            canvas.config.width = size.width;
            canvas.config.height = size.height;
        }
        toolService?.getZoomController()?.updateGrid?.();
    };
    
    uiService.setCanvasSizeUpdater(updateCanvasSize);
    console.log('  ✓ Canvas Size Updater');
    
    return updateCanvasSize;
}

/**
 * 외부 클릭 핸들러 설정
 */
function setupClickOutsideHandlers(uiService) {
    if (!uiService) return;
    uiService.setupClickOutsideHandlers();
    console.log('  ✓ Click Outside Handlers');
}

/**
 * 로딩 인디케이터 숨기기
 */
function hideLoading(uiService) {
    if (uiService) {
        uiService.hideLoading();
    } else {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'none';
    }
}

/**
 * Toast 표시 헬퍼
 */
function showToast(uiService, message, type = 'info') {
    if (uiService) {
        uiService.showToast(message, type);
    } else {
        // 폴백: 직접 생성
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

/**
 * 상태바 업데이트 시작
 */
function startStatusUpdater(uiService, interval = 500) {
    if (!uiService) return null;
    
    const intervalId = setInterval(() => {
        uiService.updateStatus();
    }, interval);
    
    console.log('  ✓ Status Updater (interval: ' + interval + 'ms)');
    return intervalId;
}

/**
 * 모든 UI 초기화 (통합)
 */
function initLayoutUI(services) {
    console.log('🎨 Layout UI 초기화 시작...');
    
    // 1. UIService 초기화
    const uiService = initUIService(services);
    
    // 2. 컴포넌트 서브메뉴 설정
    setupComponentSubmenu(uiService);
    
    // 3. Drop Zone 활성화
    setupDropZone(services.componentService);
    
    // 4. Canvas 크기 업데이터 설정
    const updateCanvasSize = setupCanvasSizeUpdater(
        uiService, 
        services.canvas, 
        services.toolService
    );
    
    // 5. 외부 클릭 핸들러 설정
    setupClickOutsideHandlers(uiService);
    
    console.log('✅ Layout UI 초기화 완료');
    
    return {
        uiService,
        updateCanvasSize,
        showToast: (msg, type) => showToast(uiService, msg, type),
        hideLoading: () => hideLoading(uiService),
        startStatusUpdater: (interval) => startStatusUpdater(uiService, interval)
    };
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.initLayoutUI = initLayoutUI;
    window.initUIService = initUIService;
    window.setupComponentSubmenu = setupComponentSubmenu;
    window.setupDropZone = setupDropZone;
    window.setupCanvasSizeUpdater = setupCanvasSizeUpdater;
    window.setupClickOutsideHandlers = setupClickOutsideHandlers;
    window.hideLoading = hideLoading;
    window.showToast = showToast;
    window.startStatusUpdater = startStatusUpdater;
}

console.log('✅ initLayoutUI.js 로드 완료');