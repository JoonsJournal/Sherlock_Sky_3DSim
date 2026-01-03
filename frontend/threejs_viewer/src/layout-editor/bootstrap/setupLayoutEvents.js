/**
 * setupLayoutEvents.js
 * =====================
 * Layout Editor 이벤트 리스너 설정
 * 
 * main.js bootstrap 패턴 적용
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/bootstrap/setupLayoutEvents.js
 */

/**
 * 키보드 액션 등록
 */
function registerKeyboardActions(services, handlers = {}) {
    const { keyboardService, toolService, componentService } = services;
    const { uiService } = services;
    
    if (!keyboardService) {
        console.warn('⚠️ KeyboardService 없음 - 키보드 액션 등록 스킵');
        return;
    }
    
    // 기본 핸들러와 커스텀 핸들러 병합
    const defaultHandlers = {
        // Undo/Redo
        undo: handlers.undo || (() => {}),
        redo: handlers.redo || (() => {}),
        
        // 선택
        selectAll: handlers.selectAll || (() => {}),
        deleteSelected: () => {
            const count = componentService?.deleteSelected() || 0;
            if (count > 0) uiService?.showToast(`${count}개 삭제됨`, 'success');
            else uiService?.showToast('선택된 객체 없음', 'info');
        },
        
        // 도구
        selectTool: () => toolService?.activateTool('select'),
        wallTool: () => toolService?.activateTool('wall'),
        
        // 토글
        toggleComponentSubmenu: () => uiService?.toggleComponentSubmenu(),
        toggleGrid: () => toolService?.toggleGrid(),
        toggleSnap: () => toolService?.toggleSnap(),
        toggleMICESnap: () => toolService?.toggleMICESnap(),
        toggleSmartGuides: () => toolService?.toggleSmartGuides(),
        toggleAlignPopup: () => uiService?.toggleAlignPopup(),
        toggleShortcutsHelp: () => uiService?.toggleShortcutsHelp(),
        
        // 줌
        zoomIn: () => toolService?.zoomIn(),
        zoomOut: () => toolService?.zoomOut(),
        resetZoom: () => toolService?.resetZoom(),
        
        // 회전
        rotateCW: () => toolService?.rotateCW(),
        rotateCCW: () => toolService?.rotateCCW(),
        
        // 레이어 순서
        bringForward: () => toolService?.bringForward(),
        sendBackward: () => toolService?.sendBackward(),
        bringToFront: () => toolService?.bringToFront(),
        sendToBack: () => toolService?.sendToBack(),
        
        // 그룹
        group: () => toolService?.groupSelected(),
        ungroup: () => toolService?.ungroupSelected(),
        
        // 복제
        duplicate: () => {
            const shapes = componentService?.duplicateSelected() || [];
            if (shapes.length > 0) uiService?.showToast(`${shapes.length}개 복제됨`, 'success');
            else uiService?.showToast('선택된 객체 없음', 'info');
        },
        
        // 저장
        save: handlers.save || (() => {}),
        
        // Equipment Array
        showEquipmentArrayModal: () => uiService?.showEquipmentArrayModal(),
        
        // Escape
        escape: () => uiService?.handleEscape()
    };
    
    // 커스텀 핸들러로 오버라이드
    const mergedHandlers = { ...defaultHandlers, ...handlers };
    
    keyboardService.registerActions(mergedHandlers);
    console.log('  ✓ Keyboard Actions 등록');
}

/**
 * 키보드 서비스 활성화
 */
function activateKeyboard(keyboardService) {
    if (keyboardService) {
        keyboardService.activate();
        console.log('  ✓ Keyboard Service 활성화');
    }
}

/**
 * 툴바 버튼 바인딩
 */
function bindToolbarButtons(services, handlers = {}) {
    const { toolService, componentService } = services;
    const { uiService } = services;
    
    // 버튼 ID와 액션 매핑
    const buttonActions = {
        // 기본
        'btn-undo': handlers.undo || (() => {}),
        'btn-redo': handlers.redo || (() => {}),
        'btn-help': () => uiService?.toggleShortcutsHelp(),
        'btn-save': handlers.save || (() => {}),
        'btn-export-png': handlers.exportPNG || (() => {}),
        
        // 도구
        'tool-select': () => toolService?.activateTool('select'),
        'tool-room': () => uiService?.showRoomSizeModal(),
        'tool-wall': () => toolService?.activateTool('wall'),
        'component-btn': () => uiService?.toggleComponentSubmenu(),
        'tool-grid': () => toolService?.toggleGrid(),
        'tool-snap': () => toolService?.toggleSnap(),
        
        // 줌
        'tool-zoom-in': () => toolService?.zoomIn(),
        'tool-zoom-out': () => toolService?.zoomOut(),
        'tool-zoom-reset': () => toolService?.resetZoom(),
        
        // 선택/삭제
        'tool-select-all': handlers.selectAll || (() => {}),
        'tool-delete': () => {
            const count = componentService?.deleteSelected() || 0;
            if (count > 0) uiService?.showToast(`${count}개 삭제됨`, 'success');
            else uiService?.showToast('선택된 객체 없음', 'info');
        },
        'tool-deselect': handlers.deselectAll || (() => {}),
        
        // 정렬/회전
        'align-btn': () => uiService?.toggleAlignPopup(),
        'tool-rotate': () => toolService?.rotateCW(),
        'tool-sample': handlers.loadSampleLayout || (() => {}),
        
        // 정렬 팝업 내
        'align-left': () => { toolService?.alignLeft(); uiService?.hideAlignPopup(); },
        'align-right': () => { toolService?.alignRight(); uiService?.hideAlignPopup(); },
        'align-top': () => { toolService?.alignTop(); uiService?.hideAlignPopup(); },
        'align-bottom': () => { toolService?.alignBottom(); uiService?.hideAlignPopup(); },
        'align-center-h': () => { toolService?.alignCenterH(); uiService?.hideAlignPopup(); },
        'align-center-v': () => { toolService?.alignCenterV(); uiService?.hideAlignPopup(); },
        'distribute-h': () => { toolService?.distributeH(); uiService?.hideAlignPopup(); },
        'distribute-v': () => { toolService?.distributeV(); uiService?.hideAlignPopup(); },
        'rotate-cw': () => toolService?.rotateCW(),
        'rotate-ccw': () => toolService?.rotateCCW(),
        'rotate-reset': () => { toolService?.resetRotation(); uiService?.hideAlignPopup(); },
        
        // 모달
        'room-cancel': () => uiService?.closeRoomSizeModal(),
        'room-apply': () => uiService?.applyRoomSize(),
        
        // Equipment Array + 그룹화
        'tool-eq-array': () => uiService?.showEquipmentArrayModal(),
        'tool-group': () => toolService?.groupSelected(),
        'tool-ungroup': () => toolService?.ungroupSelected(),
        'eq-array-cancel': () => uiService?.closeEquipmentArrayModal(),
        'eq-array-apply': () => uiService?.applyEquipmentArray()
    };
    
    // 커스텀 핸들러로 오버라이드
    const mergedActions = { ...buttonActions };
    Object.keys(handlers).forEach(key => {
        if (mergedActions[key] !== undefined) {
            mergedActions[key] = handlers[key];
        }
    });
    
    // 바인딩 실행
    let boundCount = 0;
    Object.entries(mergedActions).forEach(([id, action]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', action);
            boundCount++;
        }
    });
    
    console.log(`  ✓ Toolbar Buttons 바인딩 (${boundCount}개)`);
}

/**
 * 리사이즈 이벤트 설정
 */
function setupResizeHandler(updateCanvasSize) {
    if (updateCanvasSize) {
        window.addEventListener('resize', updateCanvasSize);
        console.log('  ✓ Resize Handler');
    }
}

/**
 * State 이벤트 구독 (옵션)
 */
function subscribeToStateEvents(state, handlers = {}) {
    if (!state?.on) return;
    
    // 도구 변경
    if (handlers.onToolChanged) {
        state.on('tool:changed', handlers.onToolChanged);
    }
    
    // 선택 변경
    if (handlers.onSelectionChanged) {
        state.on('selection:changed', handlers.onSelectionChanged);
    }
    
    // 히스토리 변경
    if (handlers.onHistoryChanged) {
        state.on('history:changed', handlers.onHistoryChanged);
    }
    
    // 줌 변경
    if (handlers.onZoomChanged) {
        state.on('canvas:zoom:changed', handlers.onZoomChanged);
    }
    
    console.log('  ✓ State Events 구독');
}

/**
 * 정리 함수 생성
 */
function createCleanup(services, intervalId) {
    return function cleanup() {
        // 키보드 서비스 비활성화
        services.keyboardService?.deactivate();
        
        // 상태 업데이트 인터벌 정리
        if (intervalId) {
            clearInterval(intervalId);
        }
        
        // Canvas 정리
        services.canvas?.stage?.destroy();
        
        console.log('🧹 Layout Editor 정리 완료');
    };
}

/**
 * 모든 이벤트 설정 (통합)
 */
function setupLayoutEvents(services, ui, handlers = {}) {
    console.log('⚡ Layout Events 설정 시작...');
    
    // services에 uiService 추가
    const allServices = {
        ...services,
        uiService: ui.uiService
    };
    
    // 1. 키보드 액션 등록
    registerKeyboardActions(allServices, handlers);
    
    // 2. 키보드 서비스 활성화
    activateKeyboard(services.keyboardService);
    
    // 3. 툴바 버튼 바인딩
    bindToolbarButtons(allServices, handlers);
    
    // 4. 리사이즈 이벤트 설정
    setupResizeHandler(ui.updateCanvasSize);
    
    // 5. State 이벤트 구독 (옵션)
    subscribeToStateEvents(window.layoutEditorState, handlers.stateHandlers);
    
    // 6. 상태 업데이트 시작
    const intervalId = ui.startStatusUpdater(500);
    
    // 7. 정리 함수 생성
    const cleanup = createCleanup(services, intervalId);
    
    console.log('✅ Layout Events 설정 완료');
    
    return { cleanup };
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.setupLayoutEvents = setupLayoutEvents;
    window.registerKeyboardActions = registerKeyboardActions;
    window.activateKeyboard = activateKeyboard;
    window.bindToolbarButtons = bindToolbarButtons;
    window.setupResizeHandler = setupResizeHandler;
    window.subscribeToStateEvents = subscribeToStateEvents;
    window.createCleanup = createCleanup;
}

console.log('✅ setupLayoutEvents.js 로드 완료');