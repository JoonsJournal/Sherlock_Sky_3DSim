/**
 * services/index.js
 * ==================
 * Layout Editor 서비스 모듈 통합 export
 * 
 * main.js 패턴 적용 - 서비스 통합 관리
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/services/index.js
 */

// =====================================================
// 서비스 존재 확인
// =====================================================
function checkServices() {
    const services = {
        'ComponentService': window.ComponentService,
        'KeyboardService': window.KeyboardService,
        'ToolService': window.ToolService,
        'UIService': window.UIService
    };
    
    const loaded = [];
    const missing = [];
    
    Object.entries(services).forEach(([name, service]) => {
        if (typeof service === 'function') {
            loaded.push(name);
        } else {
            missing.push(name);
        }
    });
    
    if (missing.length > 0) {
        console.warn('⚠️ 누락된 서비스:', missing.join(', '));
    }
    
    console.log(`📦 서비스 로드 현황: ${loaded.length}/4 (${loaded.join(', ')})`);
    
    return { loaded, missing, allLoaded: missing.length === 0 };
}

// =====================================================
// 서비스 팩토리 함수
// =====================================================

/**
 * 모든 서비스 인스턴스 생성
 */
function createAllServices(canvas, commandManager, options = {}) {
    const services = {};
    
    // ToolService
    if (typeof ToolService === 'function') {
        services.toolService = new ToolService(canvas, {
            state: options.state || window.layoutEditorState,
            onToolChanged: options.onToolChanged,
            onToast: options.onToast
        });
        services.toolService.initAllTools();
    }
    
    // ComponentService
    if (typeof ComponentService === 'function') {
        services.componentService = new ComponentService(canvas, commandManager, {
            selectionTool: services.toolService?.getTool('selection'),
            onComponentCreated: options.onComponentCreated,
            onStatusUpdate: options.onStatusUpdate
        });
    }
    
    // KeyboardService
    if (typeof KeyboardService === 'function') {
        services.keyboardService = new KeyboardService({
            canvas,
            commandManager,
            state: options.state || window.layoutEditorState
        });
    }
    
    // UIService
    if (typeof UIService === 'function') {
        services.uiService = new UIService({
            canvas,
            state: options.state || window.layoutEditorState,
            toolService: services.toolService,
            componentService: services.componentService
        });
    }
    
    return services;
}

/**
 * 개별 서비스 생성 헬퍼
 */
const ServiceFactory = {
    createToolService: (canvas, options = {}) => {
        if (typeof ToolService !== 'function') return null;
        const service = new ToolService(canvas, options);
        service.initAllTools();
        return service;
    },
    
    createComponentService: (canvas, commandManager, options = {}) => {
        if (typeof ComponentService !== 'function') return null;
        return new ComponentService(canvas, commandManager, options);
    },
    
    createKeyboardService: (canvas, commandManager, options = {}) => {
        if (typeof KeyboardService !== 'function') return null;
        return new KeyboardService({ canvas, commandManager, ...options });
    },
    
    createUIService: (canvas, options = {}) => {
        if (typeof UIService !== 'function') return null;
        return new UIService({ canvas, ...options });
    }
};

// =====================================================
// 전역 노출
// =====================================================
if (typeof window !== 'undefined') {
    window.LayoutEditorServices = {
        // 확인 함수
        checkServices,
        
        // 팩토리
        createAllServices,
        ServiceFactory,
        
        // 개별 서비스 클래스 참조
        ComponentService: window.ComponentService,
        KeyboardService: window.KeyboardService,
        ToolService: window.ToolService,
        UIService: window.UIService
    };
    
    // 서비스 로드 상태 출력
    checkServices();
}

console.log('✅ services/index.js 로드 완료');