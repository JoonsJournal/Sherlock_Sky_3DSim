/**
 * PerformanceMonitor.js
 * =====================
 * 렌더링 성능 모니터링 서비스
 * 
 * @version 1.0.0
 * @description
 * - FPS 측정
 * - Memory 사용량
 * - Draw Calls
 * - Frame Time
 * - Triangles 수
 * - 임계값 기반 경고 생성
 * 
 * @changelog
 * - v1.0.0: 초기 버전 (2026-01-21)
 *   - FPS, Memory, Draw Calls, Frame Time 측정
 *   - 임계값 기반 Warning/Critical 판정
 *   - EventBus를 통한 메트릭스 갱신 이벤트 발행
 * 
 * @dependencies
 * - three.js (WebGLRenderer)
 * - core/managers/EventBus.js
 * 
 * @exports
 * - PerformanceMonitor (class)
 * - performanceMonitor (singleton)
 * 
 * 📁 위치: frontend/threejs_viewer/src/services/performance/PerformanceMonitor.js
 * 작성일: 2026-01-21
 * 수정일: 2026-01-21
 */

import { eventBus } from '../../core/managers/EventBus.js';

export class PerformanceMonitor {
    // =========================================================================
    // Static Constants
    // =========================================================================
    
    /**
     * EventBus 이벤트 상수
     * 
     * @example
     * eventBus.on(PerformanceMonitor.EVENTS.METRICS_UPDATED, (data) => { ... });
     */
    static EVENTS = {
        /** 메트릭스 갱신: { metrics: { fps, memory, drawCalls, ... } } */
        METRICS_UPDATED: 'performance:metrics:updated',
        
        /** Warning 레벨 경고: { metric, value, threshold } */
        WARNING: 'performance:warning',
        
        /** Critical 레벨 경고: { metric, value, threshold } */
        CRITICAL: 'performance:critical'
    };
    
    /**
     * 임계값 설정
     * - warning: 경고 임계값
     * - critical: 심각 임계값
     */
    static THRESHOLDS = {
        FPS: { 
            warning: 50,    // FPS < 50: warning
            critical: 30    // FPS < 30: critical
        },
        MEMORY: { 
            warning: 200,   // MB > 200: warning
            critical: 400   // MB > 400: critical
        },
        FRAME_TIME: { 
            warning: 20,    // ms > 20: warning (~50fps)
            critical: 33    // ms > 33: critical (~30fps)
        },
        DRAW_CALLS: { 
            warning: 300,   // draw calls > 300: warning
            critical: 500   // draw calls > 500: critical
        }
    };
    
    // =========================================================================
    // Constructor
    // =========================================================================
    
    /**
     * PerformanceMonitor 생성자
     * 
     * @param {THREE.WebGLRenderer} [renderer=null] - Three.js WebGLRenderer 인스턴스
     *        renderer를 제공하면 draw calls, triangles 등을 측정 가능
     *        제공하지 않으면 FPS, Memory만 측정
     */
    constructor(renderer = null) {
        /** @type {THREE.WebGLRenderer|null} */
        this._renderer = renderer;
        
        // FPS 측정용 변수
        /** @type {number} 현재 프레임 카운트 (1초 단위 리셋) */
        this._frameCount = 0;
        
        /** @type {number} 마지막 FPS 계산 시간 */
        this._lastFPSTime = performance.now();
        
        /** @type {number} 현재 FPS */
        this._fps = 60;
        
        // 메트릭스 저장
        /** @type {Object} 현재 성능 메트릭스 */
        this._metrics = {
            fps: 60,
            memory: 0,
            drawCalls: 0,
            frameTime: 0,
            triangles: 0,
            geometries: 0,
            textures: 0
        };
        
        // 경고 카운트
        /** @type {number} Warning 레벨 임계값 초과 카운트 */
        this._warnings = 0;
        
        /** @type {number} Critical 레벨 임계값 초과 카운트 */
        this._errors = 0;
        
        // 초기 로드 시간 (외부에서 기록)
        /** @type {number|null} 초기 로드 시간 (ms) */
        this._initialLoadTime = null;
        
        /** @type {number} 로드된 설비 수 */
        this._equipmentCount = 0;
        
        // 성능 히스토리 (최근 60초)
        /** @type {Array<Object>} FPS 히스토리 */
        this._fpsHistory = [];
        
        /** @type {number} 히스토리 최대 길이 (60초) */
        this._maxHistoryLength = 60;
        
        // 캐시 통계 (NetworkStatsMonitor와 연계)
        /** @type {number} 캐시 히트 카운트 */
        this._cacheHits = 0;
        
        /** @type {number} 캐시 미스 카운트 */
        this._cacheMisses = 0;
        
        // 상태 플래그
        /** @type {boolean} 모니터링 활성화 여부 */
        this._enabled = true;
        
        console.log('🚀 [PerformanceMonitor] 생성됨');
        if (renderer) {
            console.log('   └─ WebGLRenderer 연결됨');
        } else {
            console.log('   └─ WebGLRenderer 미연결 (나중에 setRenderer로 설정 가능)');
        }
    }
    
    // =========================================================================
    // Public Methods - Configuration
    // =========================================================================
    
    /**
     * Renderer 설정 (생성자에서 전달하지 않은 경우 나중에 설정)
     * 
     * @param {THREE.WebGLRenderer} renderer - WebGLRenderer 인스턴스
     */
    setRenderer(renderer) {
        this._renderer = renderer;
        console.log('✅ [PerformanceMonitor] WebGLRenderer 설정됨');
    }
    
    /**
     * 모니터링 활성화/비활성화
     * 
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        console.log(`${enabled ? '✅' : '⏸️'} [PerformanceMonitor] 모니터링 ${enabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * 임계값 업데이트
     * 
     * @param {string} metric - 메트릭 이름 (FPS, MEMORY, FRAME_TIME, DRAW_CALLS)
     * @param {Object} thresholds - { warning: number, critical: number }
     */
    setThreshold(metric, thresholds) {
        const upperMetric = metric.toUpperCase();
        if (PerformanceMonitor.THRESHOLDS[upperMetric]) {
            PerformanceMonitor.THRESHOLDS[upperMetric] = {
                ...PerformanceMonitor.THRESHOLDS[upperMetric],
                ...thresholds
            };
            console.log(`📊 [PerformanceMonitor] ${metric} 임계값 업데이트:`, thresholds);
        } else {
            console.warn(`⚠️ [PerformanceMonitor] 알 수 없는 메트릭: ${metric}`);
        }
    }
    
    // =========================================================================
    // Public Methods - Update (매 프레임 호출)
    // =========================================================================
    
    /**
     * 매 프레임 호출 - FPS 계산 및 메트릭스 갱신
     * 애니메이션 루프에서 호출해야 함
     * 
     * @example
     * function animate() {
     *     requestAnimationFrame(animate);
     *     performanceMonitor.update();
     *     sceneManager.render();
     * }
     */
    update() {
        if (!this._enabled) return;
        
        this._frameCount++;
        
        const now = performance.now();
        const elapsed = now - this._lastFPSTime;
        
        // 1초마다 FPS 계산
        if (elapsed >= 1000) {
            this._fps = Math.round((this._frameCount * 1000) / elapsed);
            this._frameCount = 0;
            this._lastFPSTime = now;
            
            // 전체 메트릭스 갱신
            this._updateMetrics();
            
            // FPS 히스토리 기록
            this._recordHistory();
            
            // 이벤트 발행
            eventBus.emit(PerformanceMonitor.EVENTS.METRICS_UPDATED, {
                metrics: this.getMetrics(),
                timestamp: Date.now()
            });
        }
    }
    
    // =========================================================================
    // Public Methods - Metrics Access
    // =========================================================================
    
    /**
     * 현재 메트릭스 반환 (복사본)
     * 
     * @returns {Object} { fps, memory, drawCalls, frameTime, triangles, ... }
     */
    getMetrics() {
        return { ...this._metrics };
    }
    
    /**
     * 현재 FPS 반환
     * 
     * @returns {number}
     */
    getFPS() {
        return this._fps;
    }
    
    /**
     * 현재 Memory 사용량 반환 (MB)
     * 
     * @returns {number}
     */
    getMemory() {
        return this._metrics.memory;
    }
    
    /**
     * 현재 Draw Calls 반환
     * 
     * @returns {number}
     */
    getDrawCalls() {
        return this._metrics.drawCalls;
    }
    
    /**
     * Warning 개수 반환
     * 
     * @returns {number}
     */
    getWarningCount() {
        return this._warnings;
    }
    
    /**
     * Error (Critical) 개수 반환
     * 
     * @returns {number}
     */
    getErrorCount() {
        return this._errors;
    }
    
    /**
     * 초기 로드 시간 반환
     * 
     * @returns {number|null} ms
     */
    getInitialLoadTime() {
        return this._initialLoadTime;
    }
    
    /**
     * 캐시 히트율 반환
     * 
     * @returns {number} 0~100 (%)
     */
    getCacheHitRate() {
        const total = this._cacheHits + this._cacheMisses;
        if (total === 0) return 100;
        return Math.round((this._cacheHits / total) * 100);
    }
    
    /**
     * 평균 FPS 반환 (히스토리 기반)
     * 
     * @returns {number}
     */
    getAverageFPS() {
        if (this._fpsHistory.length === 0) return this._fps;
        
        const sum = this._fpsHistory.reduce((acc, entry) => acc + entry.fps, 0);
        return Math.round(sum / this._fpsHistory.length);
    }
    
    /**
     * 최저 FPS 반환 (히스토리 기반)
     * 
     * @returns {number}
     */
    getMinFPS() {
        if (this._fpsHistory.length === 0) return this._fps;
        return Math.min(...this._fpsHistory.map(entry => entry.fps));
    }
    
    /**
     * 성능 상태 등급 반환
     * 
     * @returns {string} 'good' | 'warning' | 'critical'
     */
    getPerformanceGrade() {
        if (this._errors > 0) return 'critical';
        if (this._warnings > 0) return 'warning';
        return 'good';
    }
    
    // =========================================================================
    // Public Methods - Recording
    // =========================================================================
    
    /**
     * 초기 로드 시간 기록
     * 
     * @param {number} loadTime - 로드 소요 시간 (ms)
     * @param {number} equipmentCount - 로드된 설비 수
     */
    recordInitialLoad(loadTime, equipmentCount) {
        this._initialLoadTime = loadTime;
        this._equipmentCount = equipmentCount;
        
        console.log(`📊 [PerformanceMonitor] 초기 로드 기록`);
        console.log(`   └─ 소요 시간: ${loadTime.toFixed(2)}ms`);
        console.log(`   └─ 설비 수: ${equipmentCount}개`);
    }
    
    /**
     * 캐시 히트 기록
     */
    recordCacheHit() {
        this._cacheHits++;
    }
    
    /**
     * 캐시 미스 기록
     */
    recordCacheMiss() {
        this._cacheMisses++;
        this._warnings++;
    }
    
    /**
     * 경고 레벨 직접 기록 (외부 모듈에서 사용)
     * 
     * @param {string} type - 경고 타입 ('warning' | 'error')
     */
    recordAlert(type) {
        if (type === 'error' || type === 'critical') {
            this._errors++;
        } else if (type === 'warning') {
            this._warnings++;
        }
    }
    
    /**
     * 경고 카운트 리셋
     */
    resetAlerts() {
        this._warnings = 0;
        this._errors = 0;
    }
    
    // =========================================================================
    // Private Methods
    // =========================================================================
    
    /**
     * 전체 메트릭스 갱신
     * @private
     */
    _updateMetrics() {
        // FPS
        this._metrics.fps = this._fps;
        
        // Frame Time (1000 / FPS)
        this._metrics.frameTime = this._fps > 0 ? Math.round(1000 / this._fps) : 0;
        
        // Memory (Chrome 전용)
        if (performance.memory) {
            this._metrics.memory = Math.round(
                performance.memory.usedJSHeapSize / (1024 * 1024)
            );
        }
        
        // Renderer 정보 (WebGLRenderer 연결된 경우)
        if (this._renderer && this._renderer.info) {
            const info = this._renderer.info;
            
            // 렌더링 통계
            this._metrics.drawCalls = info.render.calls || 0;
            this._metrics.triangles = info.render.triangles || 0;
            
            // 메모리 통계
            this._metrics.geometries = info.memory.geometries || 0;
            this._metrics.textures = info.memory.textures || 0;
        }
        
        // 임계값 체크
        this._checkThresholds();
    }
    
    /**
     * 임계값 체크 및 경고 업데이트
     * @private
     */
    _checkThresholds() {
        const { fps, memory, frameTime, drawCalls } = this._metrics;
        
        let newWarnings = 0;
        let newErrors = 0;
        
        // FPS 체크 (낮을수록 나쁨)
        if (fps < PerformanceMonitor.THRESHOLDS.FPS.critical) {
            newErrors++;
            this._emitAlert('critical', 'FPS', fps, PerformanceMonitor.THRESHOLDS.FPS.critical);
        } else if (fps < PerformanceMonitor.THRESHOLDS.FPS.warning) {
            newWarnings++;
            this._emitAlert('warning', 'FPS', fps, PerformanceMonitor.THRESHOLDS.FPS.warning);
        }
        
        // Memory 체크 (높을수록 나쁨)
        if (memory > PerformanceMonitor.THRESHOLDS.MEMORY.critical) {
            newErrors++;
            this._emitAlert('critical', 'MEMORY', memory, PerformanceMonitor.THRESHOLDS.MEMORY.critical);
        } else if (memory > PerformanceMonitor.THRESHOLDS.MEMORY.warning) {
            newWarnings++;
            this._emitAlert('warning', 'MEMORY', memory, PerformanceMonitor.THRESHOLDS.MEMORY.warning);
        }
        
        // Frame Time 체크 (높을수록 나쁨)
        if (frameTime > PerformanceMonitor.THRESHOLDS.FRAME_TIME.critical) {
            newErrors++;
            this._emitAlert('critical', 'FRAME_TIME', frameTime, PerformanceMonitor.THRESHOLDS.FRAME_TIME.critical);
        } else if (frameTime > PerformanceMonitor.THRESHOLDS.FRAME_TIME.warning) {
            newWarnings++;
            this._emitAlert('warning', 'FRAME_TIME', frameTime, PerformanceMonitor.THRESHOLDS.FRAME_TIME.warning);
        }
        
        // Draw Calls 체크 (높을수록 나쁨)
        if (drawCalls > PerformanceMonitor.THRESHOLDS.DRAW_CALLS.critical) {
            newErrors++;
            this._emitAlert('critical', 'DRAW_CALLS', drawCalls, PerformanceMonitor.THRESHOLDS.DRAW_CALLS.critical);
        } else if (drawCalls > PerformanceMonitor.THRESHOLDS.DRAW_CALLS.warning) {
            newWarnings++;
            this._emitAlert('warning', 'DRAW_CALLS', drawCalls, PerformanceMonitor.THRESHOLDS.DRAW_CALLS.warning);
        }
        
        this._warnings = newWarnings;
        this._errors = newErrors;
    }
    
    /**
     * 경고 이벤트 발행
     * @private
     * @param {string} level - 'warning' | 'critical'
     * @param {string} metric - 메트릭 이름
     * @param {number} value - 현재 값
     * @param {number} threshold - 임계값
     */
    _emitAlert(level, metric, value, threshold) {
        const eventName = level === 'critical' 
            ? PerformanceMonitor.EVENTS.CRITICAL 
            : PerformanceMonitor.EVENTS.WARNING;
        
        eventBus.emit(eventName, {
            metric,
            value,
            threshold,
            timestamp: Date.now()
        });
    }
    
    /**
     * FPS 히스토리 기록
     * @private
     */
    _recordHistory() {
        this._fpsHistory.push({
            fps: this._fps,
            memory: this._metrics.memory,
            timestamp: Date.now()
        });
        
        // 최대 길이 유지
        while (this._fpsHistory.length > this._maxHistoryLength) {
            this._fpsHistory.shift();
        }
    }
    
    // =========================================================================
    // Debug & Cleanup
    // =========================================================================
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('📊 [PerformanceMonitor] Debug Info');
        console.log('활성화 상태:', this._enabled);
        console.log('Renderer 연결:', !!this._renderer);
        console.log('현재 메트릭스:', this._metrics);
        console.log('Warning 카운트:', this._warnings);
        console.log('Error 카운트:', this._errors);
        console.log('성능 등급:', this.getPerformanceGrade());
        console.log('평균 FPS:', this.getAverageFPS());
        console.log('최저 FPS:', this.getMinFPS());
        console.log('초기 로드 시간:', this._initialLoadTime, 'ms');
        console.log('캐시 히트율:', this.getCacheHitRate(), '%');
        console.log('FPS 히스토리 길이:', this._fpsHistory.length);
        console.groupEnd();
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        this._enabled = false;
        this._renderer = null;
        this._fpsHistory = [];
        this._cacheHits = 0;
        this._cacheMisses = 0;
        this._warnings = 0;
        this._errors = 0;
        
        console.log('🗑️ [PerformanceMonitor] 정리 완료');
    }
}

// =========================================================================
// Singleton Export
// =========================================================================

/** @type {PerformanceMonitor} 싱글톤 인스턴스 */
export const performanceMonitor = new PerformanceMonitor();

// 전역 접근 (디버깅용)
if (typeof window !== 'undefined') {
    window.performanceMonitor = performanceMonitor;
    
    // 디버그 명령어
    window.perfDebug = () => performanceMonitor.debug();
}