/**
 * RotateHandle.js
 * =================
 * 
 * 회전 핸들 커스터마이징 및 관리
 * 
 * @version 1.0.0 - Phase 1.5
 * @module RotateHandle
 * 
 * 역할:
 * 1. 커스텀 회전 핸들 생성
 * 2. 회전 스냅 (45도, 90도 등)
 * 3. 회전 각도 제한
 * 4. 회전 중심점 설정
 * 5. 회전 각도 표시
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/handles/RotateHandle.js
 */

class RotateHandle {
    /**
     * @param {Object} options - 옵션
     */
    constructor(options = {}) {
        // CSS 색상
        this.cssColors = options.cssColors || {
            handleFill: '#667eea',
            handleStroke: '#5a6fd6',
            lineFill: '#667eea',
            angleTextFill: '#667eea',
            angleTextBg: 'rgba(255, 255, 255, 0.9)'
        };
        
        // 핸들 설정
        this.config = {
            // 활성화
            enabled: options.enabled !== false,
            
            // 핸들 스타일
            handleSize: options.handleSize || 12,
            handleOffset: options.handleOffset || 40,
            lineVisible: options.lineVisible !== false,
            lineWidth: options.lineWidth || 1,
            
            // 스냅 설정
            snapEnabled: options.snapEnabled || false,
            snapAngles: options.snapAngles || [0, 45, 90, 135, 180, 225, 270, 315],
            snapTolerance: options.snapTolerance || 5,
            
            // 각도 제한
            minAngle: options.minAngle || -Infinity,
            maxAngle: options.maxAngle || Infinity,
            
            // 각도 표시
            showAngle: options.showAngle !== false,
            angleFormat: options.angleFormat || 'degrees', // 'degrees' or 'radians'
            
            // 회전 중심
            rotateAnchorPosition: options.rotateAnchorPosition || 'top' // 'top', 'bottom', 'left', 'right'
        };
        
        // 콜백
        this.callbacks = {
            onRotateStart: options.onRotateStart || null,
            onRotate: options.onRotate || null,
            onRotateEnd: options.onRotateEnd || null
        };
        
        // 상태
        this.currentAngle = 0;
        this.startAngle = 0;
        this.isRotating = false;
        
        // 각도 표시 라벨 (Konva.Label)
        this.angleLabel = null;
        
        console.log('[RotateHandle] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // Transformer 설정 생성
    // =====================================================
    
    /**
     * Konva.Transformer용 설정 객체 생성
     * @returns {Object}
     */
    getTransformerConfig() {
        return {
            rotateEnabled: this.config.enabled,
            rotationSnaps: this.config.snapEnabled ? this.config.snapAngles : [],
            rotationSnapTolerance: this.config.snapTolerance,
            rotateAnchorOffset: this.config.handleOffset,
            rotateLineVisible: this.config.lineVisible
        };
    }
    
    // =====================================================
    // 회전 활성화/비활성화
    // =====================================================
    
    /**
     * 회전 활성화
     */
    enable() {
        this.config.enabled = true;
    }
    
    /**
     * 회전 비활성화
     */
    disable() {
        this.config.enabled = false;
    }
    
    /**
     * 회전 토글
     * @returns {boolean} 현재 상태
     */
    toggle() {
        this.config.enabled = !this.config.enabled;
        return this.config.enabled;
    }
    
    /**
     * 활성화 상태 확인
     * @returns {boolean}
     */
    isEnabled() {
        return this.config.enabled;
    }
    
    // =====================================================
    // 스냅 설정
    // =====================================================
    
    /**
     * 스냅 활성화
     * @param {Array<number>} angles - 스냅 각도 배열
     * @param {number} tolerance - 허용 오차
     */
    enableSnap(angles = null, tolerance = 5) {
        this.config.snapEnabled = true;
        if (angles) {
            this.config.snapAngles = angles;
        }
        this.config.snapTolerance = tolerance;
    }
    
    /**
     * 스냅 비활성화
     */
    disableSnap() {
        this.config.snapEnabled = false;
    }
    
    /**
     * 스냅 각도 설정
     * @param {Array<number>} angles
     */
    setSnapAngles(angles) {
        this.config.snapAngles = angles;
    }
    
    /**
     * 90도 스냅 프리셋
     */
    setSnap90() {
        this.config.snapAngles = [0, 90, 180, 270];
        this.config.snapEnabled = true;
    }
    
    /**
     * 45도 스냅 프리셋
     */
    setSnap45() {
        this.config.snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
        this.config.snapEnabled = true;
    }
    
    /**
     * 15도 스냅 프리셋
     */
    setSnap15() {
        const angles = [];
        for (let i = 0; i < 360; i += 15) {
            angles.push(i);
        }
        this.config.snapAngles = angles;
        this.config.snapEnabled = true;
    }
    
    /**
     * 각도를 스냅 각도로 변환
     * @param {number} angle - 원본 각도
     * @returns {number} 스냅된 각도
     */
    snapAngle(angle) {
        if (!this.config.snapEnabled) return angle;
        
        // 0-360 범위로 정규화
        let normalizedAngle = ((angle % 360) + 360) % 360;
        
        for (const snapAngle of this.config.snapAngles) {
            const diff = Math.abs(normalizedAngle - snapAngle);
            if (diff <= this.config.snapTolerance || diff >= 360 - this.config.snapTolerance) {
                return snapAngle;
            }
        }
        
        return angle;
    }
    
    // =====================================================
    // 각도 제한
    // =====================================================
    
    /**
     * 각도 제한 설정
     * @param {number} min - 최소 각도
     * @param {number} max - 최대 각도
     */
    setAngleLimits(min, max) {
        this.config.minAngle = min;
        this.config.maxAngle = max;
    }
    
    /**
     * 각도 제한 해제
     */
    clearAngleLimits() {
        this.config.minAngle = -Infinity;
        this.config.maxAngle = Infinity;
    }
    
    /**
     * 각도를 제한 범위 내로 조정
     * @param {number} angle
     * @returns {number}
     */
    clampAngle(angle) {
        return Math.max(this.config.minAngle, Math.min(this.config.maxAngle, angle));
    }
    
    /**
     * 각도가 유효한지 확인
     * @param {number} angle
     * @returns {boolean}
     */
    isAngleValid(angle) {
        return angle >= this.config.minAngle && angle <= this.config.maxAngle;
    }
    
    // =====================================================
    // 각도 표시
    // =====================================================
    
    /**
     * 각도 표시 라벨 생성
     * @param {Konva.Layer} layer - 라벨을 추가할 레이어
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} angle - 각도
     */
    showAngleLabel(layer, x, y, angle) {
        this.hideAngleLabel();
        
        if (!this.config.showAngle || !layer) return;
        
        const text = this.formatAngle(angle);
        
        this.angleLabel = new Konva.Label({
            x: x,
            y: y - 30,
            listening: false
        });
        
        this.angleLabel.add(new Konva.Tag({
            fill: this.cssColors.angleTextBg,
            cornerRadius: 4,
            shadowColor: 'black',
            shadowBlur: 5,
            shadowOffset: { x: 2, y: 2 },
            shadowOpacity: 0.2
        }));
        
        this.angleLabel.add(new Konva.Text({
            text: text,
            fontSize: 12,
            fontFamily: 'Arial, sans-serif',
            padding: 5,
            fill: this.cssColors.angleTextFill,
            fontStyle: 'bold'
        }));
        
        layer.add(this.angleLabel);
        layer.batchDraw();
    }
    
    /**
     * 각도 표시 라벨 업데이트
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} angle - 각도
     */
    updateAngleLabel(x, y, angle) {
        if (!this.angleLabel) return;
        
        this.angleLabel.x(x);
        this.angleLabel.y(y - 30);
        
        const textNode = this.angleLabel.findOne('Text');
        if (textNode) {
            textNode.text(this.formatAngle(angle));
        }
        
        const layer = this.angleLabel.getLayer();
        if (layer) {
            layer.batchDraw();
        }
    }
    
    /**
     * 각도 표시 라벨 숨김
     */
    hideAngleLabel() {
        if (this.angleLabel) {
            this.angleLabel.destroy();
            this.angleLabel = null;
        }
    }
    
    /**
     * 각도 포맷팅
     * @param {number} angle
     * @returns {string}
     */
    formatAngle(angle) {
        if (this.config.angleFormat === 'radians') {
            return `${(angle * Math.PI / 180).toFixed(2)} rad`;
        }
        return `${Math.round(angle)}°`;
    }
    
    // =====================================================
    // 회전 이벤트 처리
    // =====================================================
    
    /**
     * 회전 시작
     * @param {number} angle - 시작 각도
     */
    startRotation(angle) {
        this.isRotating = true;
        this.startAngle = angle;
        this.currentAngle = angle;
        
        if (this.callbacks.onRotateStart) {
            this.callbacks.onRotateStart({
                angle: angle,
                startAngle: this.startAngle
            });
        }
    }
    
    /**
     * 회전 중
     * @param {number} angle - 현재 각도
     */
    updateRotation(angle) {
        if (!this.isRotating) return;
        
        // 스냅 적용
        let processedAngle = this.snapAngle(angle);
        
        // 제한 적용
        processedAngle = this.clampAngle(processedAngle);
        
        this.currentAngle = processedAngle;
        
        if (this.callbacks.onRotate) {
            this.callbacks.onRotate({
                angle: processedAngle,
                startAngle: this.startAngle,
                delta: processedAngle - this.startAngle
            });
        }
        
        return processedAngle;
    }
    
    /**
     * 회전 종료
     * @param {number} angle - 최종 각도
     */
    endRotation(angle) {
        this.isRotating = false;
        
        // 스냅 및 제한 적용
        let finalAngle = this.snapAngle(angle);
        finalAngle = this.clampAngle(finalAngle);
        
        this.currentAngle = finalAngle;
        
        if (this.callbacks.onRotateEnd) {
            this.callbacks.onRotateEnd({
                angle: finalAngle,
                startAngle: this.startAngle,
                delta: finalAngle - this.startAngle
            });
        }
        
        this.hideAngleLabel();
        
        return finalAngle;
    }
    
    // =====================================================
    // 스타일 설정
    // =====================================================
    
    /**
     * 핸들 크기 설정
     * @param {number} size
     */
    setHandleSize(size) {
        this.config.handleSize = size;
    }
    
    /**
     * 핸들 오프셋 설정 (객체로부터의 거리)
     * @param {number} offset
     */
    setHandleOffset(offset) {
        this.config.handleOffset = offset;
    }
    
    /**
     * 연결선 표시 여부
     * @param {boolean} visible
     */
    setLineVisible(visible) {
        this.config.lineVisible = visible;
    }
    
    /**
     * 색상 설정
     * @param {Object} colors
     */
    setColors(colors) {
        this.cssColors = { ...this.cssColors, ...colors };
    }
    
    // =====================================================
    // 유틸리티
    // =====================================================
    
    /**
     * 도(degree)를 라디안으로 변환
     * @param {number} degrees
     * @returns {number}
     */
    degreesToRadians(degrees) {
        return degrees * Math.PI / 180;
    }
    
    /**
     * 라디안을 도(degree)로 변환
     * @param {number} radians
     * @returns {number}
     */
    radiansToDegrees(radians) {
        return radians * 180 / Math.PI;
    }
    
    /**
     * 각도 정규화 (0-360)
     * @param {number} angle
     * @returns {number}
     */
    normalizeAngle(angle) {
        return ((angle % 360) + 360) % 360;
    }
    
    /**
     * 두 각도 사이의 최소 차이
     * @param {number} angle1
     * @param {number} angle2
     * @returns {number}
     */
    angleDifference(angle1, angle2) {
        const diff = this.normalizeAngle(angle1 - angle2);
        return diff > 180 ? diff - 360 : diff;
    }
    
    /**
     * 현재 설정 반환
     * @returns {Object}
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * 현재 각도 반환
     * @returns {number}
     */
    getCurrentAngle() {
        return this.currentAngle;
    }
    
    /**
     * 회전 중인지 확인
     * @returns {boolean}
     */
    isRotatingNow() {
        return this.isRotating;
    }
    
    // =====================================================
    // 프리셋
    // =====================================================
    
    /**
     * Equipment 프리셋 (자유 회전)
     */
    setEquipmentPreset() {
        this.enable();
        this.disableSnap();
        this.clearAngleLimits();
    }
    
    /**
     * Wall 프리셋 (45도 스냅)
     */
    setWallPreset() {
        this.enable();
        this.setSnap45();
    }
    
    /**
     * Room 프리셋 (회전 불가)
     */
    setRoomPreset() {
        this.disable();
    }
    
    /**
     * 정밀 프리셋 (15도 스냅)
     */
    setPrecisionPreset() {
        this.enable();
        this.setSnap15();
    }
    
    // =====================================================
    // 콜백
    // =====================================================
    
    /**
     * 콜백 설정
     * @param {string} name
     * @param {Function} callback
     */
    setCallback(name, callback) {
        if (this.callbacks.hasOwnProperty(name)) {
            this.callbacks[name] = callback;
        }
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 초기화
     */
    reset() {
        this.config.enabled = true;
        this.config.snapEnabled = false;
        this.clearAngleLimits();
        this.currentAngle = 0;
        this.startAngle = 0;
        this.isRotating = false;
        this.hideAngleLabel();
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.hideAngleLabel();
        this.callbacks = {};
        console.log('[RotateHandle] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined') {
    window.RotateHandle = RotateHandle;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RotateHandle;
}

export { RotateHandle };