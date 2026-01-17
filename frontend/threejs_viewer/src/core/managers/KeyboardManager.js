/**
 * KeyboardManager.js
 * 키보드 단축키 관리
 * 
 * @version 1.1.0
 * @description 컨텍스트별 단축키 처리
 * 
 * @changelog
 * - v1.1.0: Phase 5 - Ranking View 키보드 단축키 추가
 *   - RANKING_VIEW 컨텍스트 지원
 *   - 1-6 키로 레인 포커스 이동
 *   - 방향키로 카드/레인 네비게이션
 *   - Enter로 선택 카드 상세 표시
 *   - Esc로 3D View 복귀
 *   - _isRankingViewActive() 메서드 추가
 *   - _handleRankingViewKeys() 메서드 추가
 *   - ⚠️ 호환성: 기존 모든 기능 100% 유지
 * - v1.0.0: 초기 버전
 * 
 * 📁 위치: frontend/threejs_viewer/src/core/managers/KeyboardManager.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-17
 */

import { KEYBOARD_CONTEXT } from '../config/constants.js';
import { 
    SHORTCUTS_MAP, 
    MICE_SNAP_KEYS,
    eventToShortcut, 
    findShortcut 
} from '../config/shortcuts.js';
import { eventBus } from './EventBus.js';
import { logger } from './Logger.js';

class KeyboardManagerClass {
    constructor() {
        this._currentContext = KEYBOARD_CONTEXT.GLOBAL;
        this._contextStack = [];
        this._customHandlers = new Map();
        this._enabled = true;
        this._heldKeys = new Set();
        
        // 🆕 v1.1.0: Ranking View 관련 상태
        this._rankingViewActive = false;
        this._laneManager = null;  // LaneManager 참조
        
        // 로거 설정
        this._logger = logger.child('Keyboard');
        
        // 이벤트 바인딩
        this._handleKeyDown = this._onKeyDown.bind(this);
        this._handleKeyUp = this._onKeyUp.bind(this);
        
        this._logger.info('초기화 완료');
    }
    
    /**
     * 키보드 매니저 시작
     */
    start() {
        window.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('keyup', this._handleKeyUp);
        this._logger.debug('키보드 리스너 등록');
    }
    
    /**
     * 키보드 매니저 중지
     */
    stop() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('keyup', this._handleKeyUp);
        this._heldKeys.clear();
        this._logger.debug('키보드 리스너 제거');
    }
    
    /**
     * 컨텍스트 설정
     * @param {string} context - KEYBOARD_CONTEXT 값
     */
    setContext(context) {
        if (!Object.values(KEYBOARD_CONTEXT).includes(context)) {
            this._logger.error('유효하지 않은 컨텍스트:', context);
            return;
        }
        
        this._currentContext = context;
        this._logger.debug('컨텍스트 변경:', context);
    }
    
    /**
     * 현재 컨텍스트 조회
     * @returns {string}
     */
    getContext() {
        return this._currentContext;
    }
    
    /**
     * 컨텍스트 푸시 (스택)
     * @param {string} context
     */
    pushContext(context) {
        this._contextStack.push(this._currentContext);
        this.setContext(context);
    }
    
    /**
     * 컨텍스트 팝 (스택)
     * @returns {string} 이전 컨텍스트
     */
    popContext() {
        if (this._contextStack.length > 0) {
            const prevContext = this._currentContext;
            this._currentContext = this._contextStack.pop();
            this._logger.debug('컨텍스트 복원:', this._currentContext);
            return prevContext;
        }
        return this._currentContext;
    }
    
    /**
     * 커스텀 핸들러 등록
     * @param {string} shortcut - 단축키 문자열 (예: 'ctrl+s')
     * @param {Function} handler - 핸들러 함수
     * @param {string} context - 컨텍스트 (기본: GLOBAL)
     */
    registerHandler(shortcut, handler, context = KEYBOARD_CONTEXT.GLOBAL) {
        const key = `${context}:${shortcut}`;
        this._customHandlers.set(key, handler);
        this._logger.debug(`핸들러 등록: ${key}`);
    }
    
    /**
     * 커스텀 핸들러 제거
     * @param {string} shortcut
     * @param {string} context
     */
    unregisterHandler(shortcut, context = KEYBOARD_CONTEXT.GLOBAL) {
        const key = `${context}:${shortcut}`;
        this._customHandlers.delete(key);
        this._logger.debug(`핸들러 제거: ${key}`);
    }
    
    /**
     * 단축키 액션 실행
     * @param {string} action - 액션 이름
     * @param {*} param - 추가 파라미터
     */
    executeAction(action, param = null) {
        eventBus.emit(`shortcut:${action}`, { action, param });
        this._logger.debug('액션 실행:', action, param);
    }
    
    // =========================================
    // 🆕 v1.1.0: Ranking View 관련 메서드
    // =========================================
    
    /**
     * Ranking View 활성화 상태 설정
     * @param {boolean} active
     */
    setRankingViewActive(active) {
        this._rankingViewActive = active;
        this._logger.debug(`Ranking View 활성화: ${active}`);
    }
    
    /**
     * LaneManager 참조 설정
     * @param {LaneManager} laneManager
     */
    setLaneManager(laneManager) {
        this._laneManager = laneManager;
        this._logger.debug('LaneManager 연결됨');
    }
    
    /**
     * Ranking View 활성화 여부 확인
     * @private
     * @returns {boolean}
     */
    _isRankingViewActive() {
        // 방법 1: 직접 플래그 확인
        if (this._rankingViewActive) return true;
        
        // 방법 2: DOM 상태 확인 (폴백)
        const rankingView = document.querySelector('.ranking-view');
        if (rankingView && !rankingView.classList.contains('ranking-view--hidden') &&
            !rankingView.classList.contains('hidden')) {
            return true;
        }
        
        // 방법 3: AppModeManager 상태 확인 (폴백)
        if (window.appModeManager) {
            const currentMode = window.appModeManager.getCurrentMode();
            if (currentMode === 'ranking_view' || currentMode === 'RANKING_VIEW') {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Ranking View 전용 키보드 이벤트 처리
     * @private
     * @param {KeyboardEvent} event
     * @returns {boolean} - 이벤트가 처리되었으면 true
     */
    _handleRankingViewKeys(event) {
        if (!this._isRankingViewActive()) return false;
        
        const key = event.key;
        
        switch (key) {
            // 1-6: 레인 포커스 이동
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                event.preventDefault();
                this._focusLane(parseInt(key) - 1);
                return true;
            
            // 방향키 위: 이전 카드 선택
            case 'ArrowUp':
                event.preventDefault();
                this._selectPreviousCard();
                return true;
            
            // 방향키 아래: 다음 카드 선택
            case 'ArrowDown':
                event.preventDefault();
                this._selectNextCard();
                return true;
            
            // 방향키 좌: 이전 레인으로 이동
            case 'ArrowLeft':
                event.preventDefault();
                this._focusPreviousLane();
                return true;
            
            // 방향키 우: 다음 레인으로 이동
            case 'ArrowRight':
                event.preventDefault();
                this._focusNextLane();
                return true;
            
            // Enter: 선택 카드 상세 표시
            case 'Enter':
                event.preventDefault();
                this._showSelectedCardDetail();
                return true;
            
            // Escape: 3D View 복귀
            case 'Escape':
                event.preventDefault();
                this._returnTo3DView();
                return true;
        }
        
        return false;
    }
    
    /**
     * 레인 포커스 이동
     * @private
     * @param {number} laneIndex - 0-5
     */
    _focusLane(laneIndex) {
        this._logger.debug(`레인 포커스: ${laneIndex + 1}`);
        
        // LaneManager 사용
        if (this._laneManager && this._laneManager.isActive) {
            this._laneManager.focusLane(laneIndex);
            return;
        }
        
        // 폴백: EventBus 이벤트 발행
        eventBus.emit('ranking:lane:focus', { laneIndex });
    }
    
    /**
     * 이전 레인으로 이동
     * @private
     */
    _focusPreviousLane() {
        this._logger.debug('이전 레인');
        
        if (this._laneManager && this._laneManager.isActive) {
            this._laneManager.focusPreviousLane();
            return;
        }
        
        eventBus.emit('ranking:lane:previous');
    }
    
    /**
     * 다음 레인으로 이동
     * @private
     */
    _focusNextLane() {
        this._logger.debug('다음 레인');
        
        if (this._laneManager && this._laneManager.isActive) {
            this._laneManager.focusNextLane();
            return;
        }
        
        eventBus.emit('ranking:lane:next');
    }
    
    /**
     * 이전 카드 선택
     * @private
     */
    _selectPreviousCard() {
        this._logger.debug('이전 카드');
        
        if (this._laneManager && this._laneManager.isActive) {
            this._laneManager.selectPreviousCard();
            return;
        }
        
        eventBus.emit('ranking:card:previous');
    }
    
    /**
     * 다음 카드 선택
     * @private
     */
    _selectNextCard() {
        this._logger.debug('다음 카드');
        
        if (this._laneManager && this._laneManager.isActive) {
            this._laneManager.selectNextCard();
            return;
        }
        
        eventBus.emit('ranking:card:next');
    }
    
    /**
     * 선택 카드 상세 표시
     * @private
     */
    _showSelectedCardDetail() {
        this._logger.debug('카드 상세 표시');
        
        if (this._laneManager && this._laneManager.isActive) {
            this._laneManager.showSelectedCardDetail();
            return;
        }
        
        eventBus.emit('ranking:card:detail');
    }
    
    /**
     * 3D View로 복귀
     * @private
     */
    _returnTo3DView() {
        this._logger.debug('3D View 복귀');
        
        // Ranking View 비활성화
        this._rankingViewActive = false;
        
        // EventBus 이벤트 발행
        eventBus.emit('ranking:escape');
        eventBus.emit('submenu:ranking-view:deactivate');
        eventBus.emit('mode:3d-view');
        
        // AppModeManager가 있으면 직접 호출
        if (window.appModeManager?.setMode) {
            window.appModeManager.setMode('MONITORING');
        }
    }
    
    // =========================================
    // 기존 메서드들 (v1.0.0 호환)
    // =========================================
    
    /**
     * 키 다운 이벤트 처리
     * @param {KeyboardEvent} event
     */
    _onKeyDown(event) {
        if (!this._enabled) return;
        
        // 입력 필드에서는 단축키 무시 (일부 제외)
        if (this._isInputFocused(event) && !this._isAllowedInInput(event)) {
            return;
        }
        
        // 🆕 v1.1.0: Ranking View 키보드 이벤트 먼저 처리
        if (this._handleRankingViewKeys(event)) {
            return;  // 처리되었으면 종료
        }
        
        const shortcut = eventToShortcut(event);
        
        // MICE 스냅 키 처리 (Hold 방식)
        if (MICE_SNAP_KEYS[event.key.toLowerCase()]) {
            this._heldKeys.add(event.key.toLowerCase());
            eventBus.emit('snap:keydown', { 
                key: event.key.toLowerCase(),
                snapType: MICE_SNAP_KEYS[event.key.toLowerCase()]
            });
            return;
        }
        
        // 커스텀 핸들러 우선 확인
        const customKey = `${this._currentContext}:${shortcut}`;
        const globalCustomKey = `${KEYBOARD_CONTEXT.GLOBAL}:${shortcut}`;
        
        if (this._customHandlers.has(customKey)) {
            event.preventDefault();
            this._customHandlers.get(customKey)(event);
            return;
        }
        
        if (this._customHandlers.has(globalCustomKey)) {
            event.preventDefault();
            this._customHandlers.get(globalCustomKey)(event);
            return;
        }
        
        // 컨텍스트별 단축키 확인
        let shortcutInfo = findShortcut(this._currentContext, shortcut);
        
        // 현재 컨텍스트에 없으면 글로벌에서 확인
        if (!shortcutInfo && this._currentContext !== KEYBOARD_CONTEXT.GLOBAL) {
            shortcutInfo = findShortcut(KEYBOARD_CONTEXT.GLOBAL, shortcut);
        }
        
        if (shortcutInfo) {
            event.preventDefault();
            this.executeAction(shortcutInfo.action, shortcutInfo.param);
        }
    }
    
    /**
     * 키 업 이벤트 처리
     * @param {KeyboardEvent} event
     */
    _onKeyUp(event) {
        const key = event.key.toLowerCase();
        
        // MICE 스냅 키 해제
        if (this._heldKeys.has(key)) {
            this._heldKeys.delete(key);
            eventBus.emit('snap:keyup', { key });
        }
    }
    
    /**
     * 입력 필드에 포커스 여부 확인
     * @param {KeyboardEvent} event
     * @returns {boolean}
     */
    _isInputFocused(event) {
        const target = event.target;
        const tagName = target.tagName.toLowerCase();
        
        return (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            target.isContentEditable
        );
    }
    
    /**
     * 입력 필드에서도 허용되는 단축키 확인
     * @param {KeyboardEvent} event
     * @returns {boolean}
     */
    _isAllowedInInput(event) {
        // Escape는 항상 허용
        if (event.key === 'Escape') return true;
        
        // Ctrl+S (저장)는 허용
        if ((event.ctrlKey || event.metaKey) && event.key === 's') return true;
        
        return false;
    }
    
    /**
     * 활성화/비활성화
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        this._logger.debug('키보드 매니저', enabled ? '활성화' : '비활성화');
    }
    
    /**
     * 현재 눌린 키 확인
     * @param {string} key
     * @returns {boolean}
     */
    isKeyHeld(key) {
        return this._heldKeys.has(key.toLowerCase());
    }
    
    /**
     * 현재 눌린 모든 키 조회
     * @returns {Array<string>}
     */
    getHeldKeys() {
        return Array.from(this._heldKeys);
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        this._logger.group('KeyboardManager Debug');
        this._logger.info('현재 컨텍스트:', this._currentContext);
        this._logger.info('컨텍스트 스택:', this._contextStack);
        this._logger.info('활성화 상태:', this._enabled);
        this._logger.info('눌린 키:', this.getHeldKeys());
        this._logger.info('커스텀 핸들러:', Array.from(this._customHandlers.keys()));
        this._logger.info('🆕 Ranking View 활성:', this._rankingViewActive);
        this._logger.info('🆕 LaneManager 연결:', !!this._laneManager);
        this._logger.groupEnd();
    }
}

// 싱글톤 인스턴스
export const keyboardManager = new KeyboardManagerClass();

// 클래스 export
export { KeyboardManagerClass };

// 전역 노출
if (typeof window !== 'undefined') {
    window.keyboardManager = keyboardManager;
}