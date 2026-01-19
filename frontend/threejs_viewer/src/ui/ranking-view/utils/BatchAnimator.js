/**
 * BatchAnimator.js
 * ================
 * 일괄 애니메이션 실행 유틸리티
 * 
 * @version 1.1.0
 * @description
 * - Web Animations API 기반 애니메이션
 * - 다중 요소 동시 애니메이션
 * - 애니메이션 큐 관리
 * - 일시정지/재개/취소 기능
 * - 🆕 v1.1.0: 스태거/순차 애니메이션 확장
 * 
 * @changelog
 * - v1.1.0 (2026-01-19): 가이드라인 준수 + 추가 기능 통합
 *   - 🆕 static UTIL 추가 (가이드라인 준수)
 *   - 🆕 runStaggered() - setTimeout 기반 스태거 애니메이션
 *   - 🆕 runSequential() - 완전 순차 애니메이션
 *   - 🆕 runBatch() - animateBatch 별칭 (호환성)
 *   - 🆕 _delay() - 딜레이 유틸리티
 *   - 🆕 get isRunning - getter 형식 속성
 *   - 🆕 get activeCount - getter 형식 속성
 *   - 🆕 default export 추가
 *   - ⚠️ 호환성: v1.0.0의 모든 기능/메서드/필드 100% 유지
 * - v1.0.0: 초기 구현
 *   - Web Animations API 래퍼
 *   - 배치 애니메이션 실행
 *   - 애니메이션 상태 관리
 *   - ⚠️ 호환성: 신규 파일
 * 
 * @dependencies
 * - 없음 (Pure utility)
 * 
 * @exports
 * - BatchAnimator
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/ranking-view/utils/BatchAnimator.js
 * 작성일: 2026-01-17
 * 수정일: 2026-01-19
 */

/**
 * BatchAnimator - 일괄 애니메이션 실행 유틸리티
 * 
 * 주요 기능:
 * 1. Web Animations API 기반 애니메이션 실행
 * 2. 다중 요소 동시 애니메이션
 * 3. 애니메이션 큐 관리
 * 4. 일시정지/재개/취소 지원
 * 5. 🆕 v1.1.0: 스태거/순차 애니메이션 확장
 */
export class BatchAnimator {
    // ─────────────────────────────────────────────────────────────
    // Static Constants
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 기본 설정
     */
    static DEFAULTS = {
        DURATION: 300,
        EASING: 'ease-out',
        FILL: 'forwards'
    };
    
    /**
     * 애니메이션 상태
     */
    static STATE = {
        IDLE: 'idle',
        RUNNING: 'running',
        PAUSED: 'paused',
        FINISHED: 'finished',
        CANCELLED: 'cancelled'
    };
    
    /**
     * 🆕 v1.1.0: Utility 클래스 상수 (가이드라인 준수)
     */
    static UTIL = {
        HIDDEN: 'u-hidden',
        FLEX: 'u-flex'
    };
    
    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────
    
    /**
     * BatchAnimator 생성자
     * @param {Object} options - 설정 옵션
     * @param {Function} options.onAnimationStart - 애니메이션 시작 콜백
     * @param {Function} options.onAnimationComplete - 애니메이션 완료 콜백
     * @param {Function} options.onAnimationCancel - 애니메이션 취소 콜백
     */
    constructor(options = {}) {
        // 콜백
        this._onAnimationStart = options.onAnimationStart || null;
        this._onAnimationComplete = options.onAnimationComplete || null;
        this._onAnimationCancel = options.onAnimationCancel || null;
        
        // 활성 애니메이션 관리
        this._activeAnimations = new Map(); // id → Animation
        this._animationCounter = 0;
        
        // 🆕 v1.1.0: 실행 상태 추적
        this._isRunning = false;
        
        this._init();
    }
    
    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 초기화
     * @private
     */
    _init() {
        console.log('[BatchAnimator] 🎬 Initializing v1.1.0...');
        
        // Web Animations API 지원 확인
        if (!this._isWebAnimationsSupported()) {
            console.warn('[BatchAnimator] ⚠️ Web Animations API not fully supported, using fallback');
        }
    }
    
    /**
     * Web Animations API 지원 확인
     * @private
     */
    _isWebAnimationsSupported() {
        return typeof Element.prototype.animate === 'function';
    }
    
    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 단일 애니메이션 실행
     * @param {HTMLElement} element - 애니메이션 대상 요소
     * @param {Object} options - 애니메이션 옵션
     * @param {Array} options.keyframes - 키프레임 배열
     * @param {number} options.duration - 지속 시간 (ms)
     * @param {string} options.easing - Easing 함수
     * @param {number} options.delay - 딜레이 (ms)
     * @param {string} options.fill - Fill 모드
     * @returns {Promise} 애니메이션 완료 Promise
     */
    animate(element, options = {}) {
        if (!element) {
            return Promise.resolve();
        }
        
        const {
            keyframes = [],
            duration = BatchAnimator.DEFAULTS.DURATION,
            easing = BatchAnimator.DEFAULTS.EASING,
            delay = 0,
            fill = BatchAnimator.DEFAULTS.FILL,
            iterations = 1
        } = options;
        
        // 고유 ID 생성
        const animationId = this._generateId();
        
        return new Promise((resolve, reject) => {
            try {
                // Web Animations API 사용
                if (this._isWebAnimationsSupported()) {
                    const animation = element.animate(keyframes, {
                        duration,
                        easing,
                        delay,
                        fill,
                        iterations
                    });
                    
                    // 활성 애니메이션에 추가
                    this._activeAnimations.set(animationId, {
                        animation,
                        element,
                        state: BatchAnimator.STATE.RUNNING
                    });
                    
                    // 콜백 호출
                    this._onAnimationStart?.(element, animationId);
                    
                    // 완료 핸들러
                    animation.onfinish = () => {
                        this._activeAnimations.delete(animationId);
                        this._onAnimationComplete?.(element, animationId);
                        resolve();
                    };
                    
                    // 취소 핸들러
                    animation.oncancel = () => {
                        this._activeAnimations.delete(animationId);
                        this._onAnimationCancel?.(element, animationId);
                        resolve();
                    };
                    
                } else {
                    // Fallback: CSS Transition 사용
                    this._animateWithCSS(element, keyframes, duration, easing, delay)
                        .then(resolve)
                        .catch(reject);
                }
                
            } catch (error) {
                console.error('[BatchAnimator] ❌ Animation error:', error);
                reject(error);
            }
        });
    }
    
    /**
     * 다중 요소 동시 애니메이션
     * @param {Array} animations - 애니메이션 배열 [{ element, options }]
     * @returns {Promise} 모든 애니메이션 완료 Promise
     */
    animateBatch(animations) {
        if (!Array.isArray(animations) || animations.length === 0) {
            return Promise.resolve();
        }
        
        console.log(`[BatchAnimator] 🎬 Starting batch animation (${animations.length} items)`);
        
        this._isRunning = true;
        
        const promises = animations.map(({ element, options }) => 
            this.animate(element, options)
        );
        
        return Promise.all(promises).finally(() => {
            this._isRunning = false;
        });
    }
    
    /**
     * 🆕 v1.1.0: animateBatch 별칭 (호환성)
     * @param {Array} animations - 애니메이션 배열
     * @returns {Promise}
     */
    runBatch(animations) {
        // 내부 형식 변환 (keyframes 분리 형식 → options 포함 형식)
        const converted = animations.map(({ element, keyframes, options = {} }) => ({
            element,
            options: { ...options, keyframes }
        }));
        
        return this.animateBatch(converted);
    }
    
    /**
     * 순차 애니메이션 실행 (stagger delay 기반)
     * @param {Array} animations - 애니메이션 배열
     * @param {number} staggerDelay - 순차 딜레이 (ms)
     * @returns {Promise}
     */
    animateSequence(animations, staggerDelay = 50) {
        if (!Array.isArray(animations) || animations.length === 0) {
            return Promise.resolve();
        }
        
        this._isRunning = true;
        
        const promises = animations.map(({ element, options }, index) => {
            const delay = (options.delay || 0) + (index * staggerDelay);
            return this.animate(element, { ...options, delay });
        });
        
        return Promise.all(promises).finally(() => {
            this._isRunning = false;
        });
    }
    
    /**
     * 🆕 v1.1.0: 완전 순차 애니메이션 (하나씩 순서대로)
     * @param {Array} animations - 애니메이션 배열
     * @param {number} [delay=0] - 각 애니메이션 사이 딜레이 (ms)
     * @returns {Promise<void>}
     */
    async runSequential(animations, delay = 0) {
        if (!Array.isArray(animations) || animations.length === 0) {
            return;
        }
        
        this._isRunning = true;
        
        for (const { element, keyframes, options = {} } of animations) {
            if (!element) continue;
            
            await this.animate(element, { ...options, keyframes });
            
            if (delay > 0) {
                await this._delay(delay);
            }
        }
        
        this._isRunning = false;
    }
    
    /**
     * 🆕 v1.1.0: 스태거 애니메이션 (setTimeout 기반 시간차 실행)
     * @param {Array} animations - 애니메이션 배열
     * @param {number} [staggerDelay=50] - 각 애니메이션 시작 간격 (ms)
     * @returns {Promise<void>}
     */
    async runStaggered(animations, staggerDelay = 50) {
        if (!Array.isArray(animations) || animations.length === 0) {
            return;
        }
        
        this._isRunning = true;
        
        const promises = animations.map(({ element, keyframes, options = {} }, index) => {
            return new Promise((resolve) => {
                setTimeout(async () => {
                    if (!element) {
                        resolve();
                        return;
                    }
                    
                    try {
                        await this.animate(element, { ...options, keyframes });
                    } catch (error) {
                        console.warn('[BatchAnimator] 스태거 애니메이션 오류:', error);
                    }
                    
                    resolve();
                }, index * staggerDelay);
            });
        });
        
        await Promise.all(promises);
        
        this._isRunning = false;
    }
    
    /**
     * 특정 애니메이션 일시정지
     * @param {string} animationId - 애니메이션 ID
     */
    pause(animationId) {
        const entry = this._activeAnimations.get(animationId);
        if (entry && entry.animation) {
            entry.animation.pause();
            entry.state = BatchAnimator.STATE.PAUSED;
        }
    }
    
    /**
     * 모든 애니메이션 일시정지
     */
    pauseAll() {
        for (const [id, entry] of this._activeAnimations) {
            if (entry.animation && entry.state === BatchAnimator.STATE.RUNNING) {
                entry.animation.pause();
                entry.state = BatchAnimator.STATE.PAUSED;
            }
        }
        console.log('[BatchAnimator] ⏸️ All animations paused');
    }
    
    /**
     * 특정 애니메이션 재개
     * @param {string} animationId - 애니메이션 ID
     */
    resume(animationId) {
        const entry = this._activeAnimations.get(animationId);
        if (entry && entry.animation) {
            entry.animation.play();
            entry.state = BatchAnimator.STATE.RUNNING;
        }
    }
    
    /**
     * 모든 애니메이션 재개
     */
    resumeAll() {
        for (const [id, entry] of this._activeAnimations) {
            if (entry.animation && entry.state === BatchAnimator.STATE.PAUSED) {
                entry.animation.play();
                entry.state = BatchAnimator.STATE.RUNNING;
            }
        }
        console.log('[BatchAnimator] ▶️ All animations resumed');
    }
    
    /**
     * 특정 애니메이션 취소
     * @param {string} animationId - 애니메이션 ID
     */
    cancel(animationId) {
        const entry = this._activeAnimations.get(animationId);
        if (entry && entry.animation) {
            entry.animation.cancel();
            entry.state = BatchAnimator.STATE.CANCELLED;
            this._activeAnimations.delete(animationId);
        }
    }
    
    /**
     * 모든 애니메이션 취소
     */
    cancelAll() {
        for (const [id, entry] of this._activeAnimations) {
            if (entry.animation) {
                entry.animation.cancel();
                entry.state = BatchAnimator.STATE.CANCELLED;
            }
        }
        this._activeAnimations.clear();
        this._isRunning = false;
        console.log('[BatchAnimator] ❌ All animations cancelled');
    }
    
    /**
     * 활성 애니메이션 수 가져오기
     * @returns {number}
     */
    getActiveCount() {
        return this._activeAnimations.size;
    }
    
    /**
     * 🆕 v1.1.0: Getter 형식 활성 애니메이션 수
     * @returns {number}
     */
    get activeCount() {
        return this._activeAnimations.size;
    }
    
    /**
     * 특정 요소의 애니메이션 상태 확인
     * @param {HTMLElement} element
     * @returns {string|null} 상태 또는 null
     */
    getState(element) {
        for (const [id, entry] of this._activeAnimations) {
            if (entry.element === element) {
                return entry.state;
            }
        }
        return null;
    }
    
    /**
     * 애니메이션 중인지 확인
     * @returns {boolean}
     */
    isAnimating() {
        return this._activeAnimations.size > 0;
    }
    
    /**
     * 🆕 v1.1.0: Getter 형식 실행 상태
     * @returns {boolean}
     */
    get isRunning() {
        return this._isRunning || this._activeAnimations.size > 0;
    }
    
    // ─────────────────────────────────────────────────────────────
    // Utility Methods
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 스프링 애니메이션 키프레임 생성
     * @param {Object} from - 시작 값
     * @param {Object} to - 종료 값
     * @param {Object} options - 스프링 옵션
     * @returns {Array} 키프레임 배열
     */
    generateSpringKeyframes(from, to, options = {}) {
        const {
            stiffness = 100,
            damping = 10,
            mass = 1,
            steps = 60
        } = options;
        
        const keyframes = [];
        const dt = 1 / steps;
        
        let velocity = 0;
        let position = 0;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            // 스프링 물리
            const springForce = -stiffness * position;
            const dampingForce = -damping * velocity;
            const acceleration = (springForce + dampingForce) / mass;
            
            velocity += acceleration * dt;
            position += velocity * dt;
            
            // 실제 값 계산
            const currentValue = {};
            for (const key of Object.keys(from)) {
                const fromVal = parseFloat(from[key]) || 0;
                const toVal = parseFloat(to[key]) || 0;
                const delta = toVal - fromVal;
                currentValue[key] = fromVal + delta * (1 - position * Math.exp(-i * 0.1));
            }
            
            // transform 문자열 생성
            let transform = '';
            if (currentValue.x !== undefined || currentValue.y !== undefined) {
                const x = currentValue.x || 0;
                const y = currentValue.y || 0;
                transform = `translate(${x}px, ${y}px)`;
            }
            if (currentValue.scale !== undefined) {
                transform += ` scale(${currentValue.scale})`;
            }
            
            keyframes.push({ transform: transform || 'none', offset: t });
        }
        
        return keyframes;
    }
    
    /**
     * 이징 함수 변환
     * @param {string} easing - 이징 이름
     * @returns {string} CSS 이징 함수
     */
    getEasingFunction(easing) {
        const easingMap = {
            'linear': 'linear',
            'ease': 'ease',
            'ease-in': 'ease-in',
            'ease-out': 'ease-out',
            'ease-in-out': 'ease-in-out',
            'ease-out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
            'ease-in-quart': 'cubic-bezier(0.5, 0, 0.75, 0)',
            'ease-out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            'ease-in-back': 'cubic-bezier(0.36, 0, 0.66, -0.56)',
            'spring': 'cubic-bezier(0.5, 0, 0.2, 1.5)'
        };
        
        return easingMap[easing] || easing;
    }
    
    // ─────────────────────────────────────────────────────────────
    // Private Methods
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 고유 ID 생성
     * @private
     */
    _generateId() {
        return `anim_${++this._animationCounter}_${Date.now()}`;
    }
    
    /**
     * 🆕 v1.1.0: 딜레이 유틸리티
     * @private
     * @param {number} ms - 밀리초
     * @returns {Promise<void>}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * CSS Transition Fallback
     * @private
     */
    _animateWithCSS(element, keyframes, duration, easing, delay) {
        return new Promise((resolve) => {
            if (!keyframes || keyframes.length < 2) {
                resolve();
                return;
            }
            
            const startFrame = keyframes[0];
            const endFrame = keyframes[keyframes.length - 1];
            
            // 시작 스타일 적용
            Object.assign(element.style, startFrame);
            
            // Transition 설정
            element.style.transition = `all ${duration}ms ${easing} ${delay}ms`;
            
            // 강제 리플로우
            element.offsetHeight;
            
            // 종료 스타일 적용
            setTimeout(() => {
                Object.assign(element.style, endFrame);
            }, 10);
            
            // 완료 핸들러
            const handleTransitionEnd = () => {
                element.removeEventListener('transitionend', handleTransitionEnd);
                element.style.transition = '';
                resolve();
            };
            
            element.addEventListener('transitionend', handleTransitionEnd);
            
            // 타임아웃 폴백
            setTimeout(() => {
                handleTransitionEnd();
            }, duration + delay + 100);
        });
    }
    
    // ─────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────
    
    /**
     * 리소스 정리
     */
    dispose() {
        console.log('[BatchAnimator] 🗑️ Disposing...');
        
        // 모든 애니메이션 취소
        this.cancelAll();
        
        // 콜백 해제
        this._onAnimationStart = null;
        this._onAnimationComplete = null;
        this._onAnimationCancel = null;
        
        console.log('[BatchAnimator] ✅ Disposed');
    }
}

// =========================================================================
// Default Export
// =========================================================================
export default BatchAnimator;

// 전역 노출 (디버깅용)
if (typeof window !== 'undefined') {
    window.BatchAnimator = BatchAnimator;
}