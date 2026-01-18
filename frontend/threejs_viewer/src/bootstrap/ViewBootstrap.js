/**
 * ViewBootstrap.js
 * ================
 * 
 * View 관리 중앙화 모듈 (ViewManager 패턴)
 * - View 인스턴스 Lazy 생성 및 싱글톤 관리
 * - 의존성 자동 주입 (DI)
 * - 생명주기 관리 (show/hide/destroy)
 * - 모드별 View 그룹화
 * 
 * @version 1.0.0
 * @module ViewBootstrap
 * 
 * @changelog
 * - v1.0.0: 초기 구현
 *   - VIEW_REGISTRY 정의 (Monitoring/Analysis 모드 View 설정)
 *   - ViewManager 클래스 (싱글톤, Lazy 초기화, DI)
 *   - Facade 함수 (getView, showView, hideView, destroyView)
 * 
 * 📁 위치: frontend/threejs_viewer/src/bootstrap/ViewBootstrap.js
 * 작성일: 2026-01-18
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. Import 섹션
// ═══════════════════════════════════════════════════════════════════════════

import { eventBus } from '../core/managers/EventBus.js';
import { logger } from '../core/managers/Logger.js';

// View 클래스 Import
import { RankingView } from '../ui/ranking-view/RankingView.js';

import { BaseView, VIEW_STATE } from '../ui/common/BaseView.js';

// ═══════════════════════════════════════════════════════════════════════════
// 2. VIEW_REGISTRY 상수 정의
// ═══════════════════════════════════════════════════════════════════════════

/**
 * VIEW_REGISTRY
 * 
 * 모든 View의 설정 정보를 중앙 관리
 * 
 * 필드 설명:
 * - id: View 고유 식별자 (submode와 동일하게 사용)
 * - class: View 클래스 (null이면 미구현)
 * - lazy: true면 첫 사용 시 생성, false면 앱 시작 시 생성
 * - singleton: true면 인스턴스 재사용, false면 매번 새로 생성
 * - parentMode: 부모 모드 (monitoring, analysis, simulation)
 * - dependencies: 생성 시 주입할 서비스 이름 배열
 * - defaultOptions: View 생성자에 전달할 기본 옵션
 * - hooks: 생명주기 콜백 (선택)
 * - disabled: true면 View 사용 불가 (Coming Soon)
 */
export const VIEW_REGISTRY = {
    
    // ═══════════════════════════════════════════════════════════════════
    // Monitoring 모드 Views
    // ═══════════════════════════════════════════════════════════════════
    
    'ranking-view': {
        id: 'ranking-view',
        class: RankingView,
        lazy: true,
        singleton: true,
        parentMode: 'monitoring',
        dependencies: [
            'eventBus',
            'webSocketClient'
        ],
        defaultOptions: {
            container: () => document.body
        },
        hooks: {
            beforeShow: null,
            afterShow: null,
            beforeHide: null,
            afterHide: null
        },
        disabled: false
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // Analysis 모드 Views (향후 추가)
    // ═══════════════════════════════════════════════════════════════════
    
    'dashboard-view': {
        id: 'dashboard-view',
        class: null,  // 아직 구현 안됨 → Placeholder
        lazy: true,
        singleton: true,
        parentMode: 'analysis',
        dependencies: ['eventBus', 'analyticsService'],
        defaultOptions: {},
        hooks: null,
        disabled: true  // 비활성화 상태
    },
    
    'heatmap-view': {
        id: 'heatmap-view',
        class: null,
        lazy: true,
        singleton: true,
        parentMode: 'analysis',
        dependencies: ['eventBus'],
        defaultOptions: {},
        hooks: null,
        disabled: true
    },
    
    'trend-view': {
        id: 'trend-view',
        class: null,
        lazy: true,
        singleton: true,
        parentMode: 'analysis',
        dependencies: ['eventBus'],
        defaultOptions: {},
        hooks: null,
        disabled: true
    },
    
    // ═══════════════════════════════════════════════════════════════════
    // Simulation 모드 Views (향후 추가)
    // ═══════════════════════════════════════════════════════════════════
    
    'simulation-view': {
        id: 'simulation-view',
        class: null,
        lazy: true,
        singleton: true,
        parentMode: 'simulation',
        dependencies: ['eventBus', 'simulationEngine'],
        defaultOptions: {},
        hooks: null,
        disabled: true
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. ViewManager 클래스 정의
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ViewManager 클래스
 * 
 * View 인스턴스의 생성, 관리, 전환을 담당하는 중앙 관리자
 * - 싱글톤 패턴
 * - Lazy 초기화 지원
 * - 의존성 자동 주입
 * 
 * @class ViewManager
 */
class ViewManager {
    
    // ═══════════════════════════════════════════════════════════════════
    // Private 필드
    // ═══════════════════════════════════════════════════════════════════
    
    /** @type {Map<string, Object>} viewId → View 인스턴스 */
    _instances = new Map();
    
    /** @type {Object} 주입된 서비스들 */
    _services = {};
    
    /** @type {string|null} 현재 활성화된 View ID */
    _currentView = null;
    
    /** @type {boolean} 초기화 완료 여부 */
    _initialized = false;
    
    /** @type {string} 버전 */
    _version = '1.0.0';
    
    // ═══════════════════════════════════════════════════════════════════
    // 초기화 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 생성자
     */
    constructor() {
        console.log(`[ViewManager] 🚀 초기화 (v${this._version})`);
    }
    
    /**
     * 서비스 주입 (main.js에서 호출)
     * @param {Object} services - 주입할 서비스 객체
     * @example
     * viewManager.setServices({
     *     eventBus: eventBus,
     *     webSocketClient: webSocketClient,
     *     analyticsService: analyticsService
     * });
     */
    setServices(services) {
        this._services = { ...this._services, ...services };
        this._initialized = true;
        console.log('[ViewManager] ✅ 서비스 주입 완료:', Object.keys(services));
    }
    
    /**
     * 서비스 추가 (개별 서비스 등록)
     * @param {string} name - 서비스 이름
     * @param {Object} service - 서비스 인스턴스
     */
    addService(name, service) {
        this._services[name] = service;
        console.log(`[ViewManager] ➕ 서비스 추가: ${name}`);
    }
    
    /**
     * Eager 초기화 (lazy: false인 View들 미리 생성)
     * 앱 시작 시 호출하여 즉시 필요한 View들을 미리 생성
     */
    initEagerViews() {
        console.log('[ViewManager] 🔄 Eager View 초기화 시작...');
        
        let count = 0;
        Object.entries(VIEW_REGISTRY).forEach(([id, config]) => {
            if (!config.lazy && !config.disabled && config.class) {
                this._createInstance(id);
                count++;
            }
        });
        
        console.log(`[ViewManager] ✅ Eager View ${count}개 초기화 완료`);
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // View 조회/생성 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * View 인스턴스 조회 (Lazy 생성 포함)
     * @param {string} viewId - View ID
     * @returns {Object|null} View 인스턴스
     */
    get(viewId) {
        // 1. 이미 생성된 인스턴스 확인
        if (this._instances.has(viewId)) {
            return this._instances.get(viewId);
        }
        
        // 2. Registry 확인
        const config = VIEW_REGISTRY[viewId];
        if (!config) {
            console.warn(`[ViewManager] ⚠️ 미등록 View: ${viewId}`);
            return null;
        }
        
        // 3. 비활성화 확인
        if (config.disabled) {
            console.warn(`[ViewManager] ⚠️ 비활성화된 View: ${viewId} (Coming Soon)`);
            return null;
        }
        
        // 4. 클래스 미구현 확인
        if (!config.class) {
            console.warn(`[ViewManager] ⚠️ 미구현 View: ${viewId}`);
            return null;
        }
        
        // 5. Lazy 생성
        return this._createInstance(viewId);
    }
    
    /**
     * View 인스턴스 생성 (내부용)
     * @private
     * @param {string} viewId - View ID
     * @returns {Object|null} 생성된 View 인스턴스
     */
    _createInstance(viewId) {
        const config = VIEW_REGISTRY[viewId];
        if (!config?.class) return null;
        
        console.log(`[ViewManager] 🔨 View 생성: ${viewId}`);
        
        try {
            // 1. 의존성 수집
            const deps = this._resolveDependencies(config.dependencies);
            
            // 2. 옵션 병합
            const options = {
                ...this._resolveDefaultOptions(config.defaultOptions),
                ...deps
            };
            
            // 3. 인스턴스 생성
            const instance = new config.class(options);
            
            // 4. 싱글톤이면 저장
            if (config.singleton) {
                this._instances.set(viewId, instance);
            }
            
            // 5. 전역 노출 (디버깅용)
            if (typeof window !== 'undefined') {
                window[this._toGlobalName(viewId)] = instance;
            }
            
            console.log(`[ViewManager] ✅ View 생성 완료: ${viewId}`);
            return instance;
            
        } catch (error) {
            console.error(`[ViewManager] ❌ View 생성 실패: ${viewId}`, error);
            return null;
        }
    }
    
    /**
     * 의존성 해결
     * @private
     * @param {string[]} depNames - 의존성 이름 배열
     * @returns {Object} 해결된 의존성 객체
     */
    _resolveDependencies(depNames = []) {
        const deps = {};
        
        depNames.forEach(name => {
            if (this._services[name]) {
                deps[name] = this._services[name];
            } else {
                console.warn(`[ViewManager] ⚠️ 미등록 서비스: ${name}`);
            }
        });
        
        return deps;
    }
    
    /**
     * 기본 옵션 해결 (함수인 경우 실행)
     * @private
     * @param {Object} defaultOptions - 기본 옵션 객체
     * @returns {Object} 해결된 옵션 객체
     */
    _resolveDefaultOptions(defaultOptions = {}) {
        const resolved = {};
        
        Object.entries(defaultOptions).forEach(([key, value]) => {
            resolved[key] = typeof value === 'function' ? value() : value;
        });
        
        return resolved;
    }
    
    /**
     * viewId를 전역 변수명으로 변환
     * @private
     * @param {string} viewId - View ID
     * @returns {string} 전역 변수명
     * @example 'ranking-view' → 'rankingView'
     */
    _toGlobalName(viewId) {
        return viewId.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // View 전환 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * View 활성화 (show)
     * @param {string} viewId - 활성화할 View ID
     * @param {Object} options - 추가 옵션
     * @returns {boolean} 성공 여부
     */
    show(viewId, options = {}) {
        console.log(`[ViewManager] 👁️ show: ${viewId}`);
        
        // 1. 이전 View 숨김
        if (this._currentView && this._currentView !== viewId) {
            this.hide(this._currentView);
        }
        
        // 2. View 인스턴스 가져오기 (Lazy 생성)
        const view = this.get(viewId);
        if (!view) {
            console.error(`[ViewManager] ❌ View 없음: ${viewId}`);
            return false;
        }
        
        // 3. beforeShow 훅 실행
        const config = VIEW_REGISTRY[viewId];
        if (config?.hooks?.beforeShow) {
            try {
                config.hooks.beforeShow(view, options);
            } catch (error) {
                console.error(`[ViewManager] ❌ beforeShow 훅 에러: ${viewId}`, error);
            }
        }
        
        // 4. View show 호출
        if (typeof view.show === 'function') {
            view.show(options);
        }
        
        // 5. 현재 View 업데이트
        this._currentView = viewId;
        
        // 6. afterShow 훅 실행
        if (config?.hooks?.afterShow) {
            try {
                config.hooks.afterShow(view, options);
            } catch (error) {
                console.error(`[ViewManager] ❌ afterShow 훅 에러: ${viewId}`, error);
            }
        }
        
        // 7. 이벤트 발행
        if (this._services.eventBus) {
            this._services.eventBus.emit('view:shown', { viewId, options });
        }
        
        console.log(`[ViewManager] ✅ View 활성화: ${viewId}`);
        return true;
    }
    
    /**
     * View 비활성화 (hide)
     * @param {string} viewId - 비활성화할 View ID
     * @returns {boolean} 성공 여부
     */
    hide(viewId) {
        const view = this._instances.get(viewId);
        if (!view) {
            console.warn(`[ViewManager] ⚠️ 숨길 View 없음: ${viewId}`);
            return false;
        }
        
        console.log(`[ViewManager] 🙈 hide: ${viewId}`);
        
        const config = VIEW_REGISTRY[viewId];
        
        // beforeHide 훅
        if (config?.hooks?.beforeHide) {
            try {
                config.hooks.beforeHide(view);
            } catch (error) {
                console.error(`[ViewManager] ❌ beforeHide 훅 에러: ${viewId}`, error);
            }
        }
        
        // View hide 호출
        if (typeof view.hide === 'function') {
            view.hide();
        }
        
        // 현재 View 초기화
        if (this._currentView === viewId) {
            this._currentView = null;
        }
        
        // afterHide 훅
        if (config?.hooks?.afterHide) {
            try {
                config.hooks.afterHide(view);
            } catch (error) {
                console.error(`[ViewManager] ❌ afterHide 훅 에러: ${viewId}`, error);
            }
        }
        
        // 이벤트 발행
        if (this._services.eventBus) {
            this._services.eventBus.emit('view:hidden', { viewId });
        }
        
        console.log(`[ViewManager] ✅ View 비활성화: ${viewId}`);
        return true;
    }
    
    /**
     * View 토글
     * @param {string} viewId - 토글할 View ID
     * @param {Object} options - show 옵션
     * @returns {boolean} 활성화 여부
     */
    toggle(viewId, options = {}) {
        if (this.isActive(viewId)) {
            this.hide(viewId);
            return false;
        } else {
            this.show(viewId, options);
            return true;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 유틸리티 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * View 존재 여부 확인
     * @param {string} viewId - View ID
     * @returns {boolean}
     */
    has(viewId) {
        return Object.prototype.hasOwnProperty.call(VIEW_REGISTRY, viewId);
    }
    
    /**
     * View 활성화 여부 확인
     * @param {string} viewId - View ID
     * @returns {boolean}
     */
    isActive(viewId) {
        return this._currentView === viewId;
    }
    
    /**
     * 현재 활성 View 가져오기
     * @returns {string|null} 현재 View ID
     */
    getCurrentView() {
        return this._currentView;
    }
    
    /**
     * 현재 활성 View 인스턴스 가져오기
     * @returns {Object|null} 현재 View 인스턴스
     */
    getCurrentViewInstance() {
        if (!this._currentView) return null;
        return this._instances.get(this._currentView) || null;
    }
    
    /**
     * 특정 모드의 View 목록 가져오기
     * @param {string} parentMode - 부모 모드 (monitoring, analysis, simulation)
     * @returns {Array<Object>} View 설정 배열
     */
    getViewsByMode(parentMode) {
        return Object.entries(VIEW_REGISTRY)
            .filter(([_, config]) => config.parentMode === parentMode)
            .map(([id, config]) => ({ id, ...config }));
    }
    
    /**
     * 활성화된 View 목록 가져오기
     * @returns {Array<string>} 활성화 가능한 View ID 배열
     */
    getEnabledViews() {
        return Object.entries(VIEW_REGISTRY)
            .filter(([_, config]) => !config.disabled && config.class)
            .map(([id]) => id);
    }
    
    /**
     * 생성된 인스턴스 목록 가져오기
     * @returns {Array<string>} 생성된 View ID 배열
     */
    getCreatedViews() {
        return [...this._instances.keys()];
    }
    
    /**
     * View 인스턴스 정리
     * @param {string} viewId - View ID
     */
    destroy(viewId) {
        const view = this._instances.get(viewId);
        if (view) {
            console.log(`[ViewManager] 🗑️ View 정리: ${viewId}`);
            
            // View dispose 호출
            if (typeof view.dispose === 'function') {
                view.dispose();
            } else if (typeof view.destroy === 'function') {
                view.destroy();
            }
            
            // 인스턴스 제거
            this._instances.delete(viewId);
            
            // 전역 참조 제거
            if (typeof window !== 'undefined') {
                window[this._toGlobalName(viewId)] = null;
            }
            
            // 현재 View면 초기화
            if (this._currentView === viewId) {
                this._currentView = null;
            }
            
            console.log(`[ViewManager] ✅ View 정리 완료: ${viewId}`);
        }
    }
    
    /**
     * 전체 View 정리
     */
    destroyAll() {
        console.log('[ViewManager] 🗑️ 전체 View 정리 시작...');
        
        this._instances.forEach((_, viewId) => this.destroy(viewId));
        this._currentView = null;
        
        console.log('[ViewManager] ✅ 전체 View 정리 완료');
    }
    
    /**
     * View 재생성 (리셋)
     * @param {string} viewId - View ID
     * @returns {Object|null} 새로 생성된 View 인스턴스
     */
    recreate(viewId) {
        console.log(`[ViewManager] 🔄 View 재생성: ${viewId}`);
        
        this.destroy(viewId);
        return this.get(viewId);
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 디버그 메서드
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group(`🔧 ViewManager Debug (v${this._version})`);
        console.log('Initialized:', this._initialized);
        console.log('Registered Views:', Object.keys(VIEW_REGISTRY));
        console.log('Enabled Views:', this.getEnabledViews());
        console.log('Created Instances:', this.getCreatedViews());
        console.log('Current View:', this._currentView);
        console.log('Services:', Object.keys(this._services));
        
        console.log('--- Registry Details ---');
        Object.entries(VIEW_REGISTRY).forEach(([id, config]) => {
            const status = config.disabled ? '❌ Disabled' : 
                          config.class ? '✅ Ready' : '⚠️ Not Implemented';
            console.log(`  ${id}: ${status} (${config.parentMode})`);
        });
        
        console.groupEnd();
    }
    
    /**
     * View 상태 요약
     * @returns {Object} 상태 요약 객체
     */
    getStatus() {
        return {
            version: this._version,
            initialized: this._initialized,
            currentView: this._currentView,
            registeredCount: Object.keys(VIEW_REGISTRY).length,
            enabledCount: this.getEnabledViews().length,
            createdCount: this._instances.size,
            services: Object.keys(this._services)
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. 싱글톤 인스턴스 생성
// ═══════════════════════════════════════════════════════════════════════════

/** @type {ViewManager} ViewManager 싱글톤 인스턴스 */
export const viewManager = new ViewManager();

// ═══════════════════════════════════════════════════════════════════════════
// 5. 편의 함수 (Facade)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * View 인스턴스 조회 (Lazy 생성 포함)
 * @param {string} viewId - View ID
 * @returns {Object|null} View 인스턴스
 */
export function getView(viewId) {
    return viewManager.get(viewId);
}

/**
 * View 활성화
 * @param {string} viewId - View ID
 * @param {Object} options - 추가 옵션
 * @returns {boolean} 성공 여부
 */
export function showView(viewId, options = {}) {
    return viewManager.show(viewId, options);
}

/**
 * View 비활성화
 * @param {string} viewId - View ID
 * @returns {boolean} 성공 여부
 */
export function hideView(viewId) {
    return viewManager.hide(viewId);
}

/**
 * View 토글
 * @param {string} viewId - View ID
 * @param {Object} options - show 옵션
 * @returns {boolean} 활성화 여부
 */
export function toggleView(viewId, options = {}) {
    return viewManager.toggle(viewId, options);
}

/**
 * View 정리
 * @param {string} viewId - View ID
 */
export function destroyView(viewId) {
    viewManager.destroy(viewId);
}

/**
 * ViewManager 초기화 (main.js에서 호출)
 * @param {Object} services - 주입할 서비스 객체
 * @param {Object} options - 초기화 옵션
 * @param {boolean} options.initEager - Eager View 즉시 초기화 여부
 */
export function initViewManager(services = {}, options = {}) {
    console.log('[ViewBootstrap] 🚀 ViewManager 초기화...');
    
    // 기본 서비스 추가 (eventBus는 항상 포함)
    const defaultServices = {
        eventBus: eventBus,
        ...services
    };
    
    viewManager.setServices(defaultServices);
    
    // Eager View 초기화
    if (options.initEager !== false) {
        viewManager.initEagerViews();
    }
    
    // 전역 노출 (디버깅용)
    if (typeof window !== 'undefined') {
        window.viewManager = viewManager;
        window.VIEW_REGISTRY = VIEW_REGISTRY;
    }
    
    console.log('[ViewBootstrap] ✅ ViewManager 초기화 완료');
    return viewManager;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. 전역 노출 (디버깅용)
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
    window.viewManager = viewManager;
    window.VIEW_REGISTRY = VIEW_REGISTRY;
    
    window.BaseView = BaseView;
    window.VIEW_STATE = VIEW_STATE;
}