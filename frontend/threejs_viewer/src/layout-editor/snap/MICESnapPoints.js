/**
 * MICESnapPoints.js
 * ===================
 * 
 * MICE(회의/전시) 환경 특화 스냅 포인트 관리
 * 
 * @version 1.0.0 - Phase 1.5
 * @module MICESnapPoints
 * 
 * 역할:
 * 1. 통로 스냅 포인트 (Corridor/Aisle)
 * 2. Equipment Array 정렬 포인트
 * 3. 벽면 스냅 포인트
 * 4. 출입구/비상구 스냅 포인트
 * 5. 기준선 스냅 (Baseline)
 * 
 * MICE: Meetings, Incentives, Conferences, Exhibitions
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/snap/MICESnapPoints.js
 */

class MICESnapPoints {
    /**
     * @param {Object} options - 옵션
     */
    constructor(options = {}) {
        // 설정
        this.config = {
            // 활성화
            enabled: options.enabled !== false,
            
            // 스냅 threshold
            threshold: options.threshold || 15,
            
            // 스냅 포인트 타입별 활성화
            corridorSnapEnabled: options.corridorSnapEnabled !== false,
            wallSnapEnabled: options.wallSnapEnabled !== false,
            doorSnapEnabled: options.doorSnapEnabled !== false,
            baselineSnapEnabled: options.baselineSnapEnabled !== false,
            arraySnapEnabled: options.arraySnapEnabled !== false,
            
            // 기본 통로 너비
            defaultCorridorWidth: options.defaultCorridorWidth || 120, // 1.2m
            
            // 벽 오프셋 (벽에서 떨어진 거리)
            wallOffset: options.wallOffset || 50, // 0.5m
            
            // 스케일 (픽셀/미터)
            scale: options.scale || 10
        };
        
        // 스냅 포인트 저장소
        this.snapPoints = {
            corridor: [],      // 통로 라인
            wall: [],          // 벽면 포인트
            door: [],          // 출입구 포인트
            baseline: [],      // 기준선
            array: [],         // 배열 정렬 포인트
            custom: []         // 사용자 정의 포인트
        };
        
        // Room 정보
        this.roomRect = null;
        
        // Equipment Array 정보
        this.equipmentArrays = [];
        
        // UI 레이어 참조 (시각화용)
        this.uiLayer = null;
        
        // 시각화 요소
        this.visualElements = [];
        this.showVisualization = options.showVisualization || false;
        
        console.log('[MICESnapPoints] 초기화 완료 v1.0.0');
    }
    
    // =====================================================
    // Room 설정
    // =====================================================
    
    /**
     * Room 정보 설정 및 기본 스냅 포인트 생성
     * @param {Object} roomRect - { x, y, width, height }
     */
    setRoom(roomRect) {
        this.roomRect = roomRect;
        
        // 벽면 스냅 포인트 자동 생성
        if (this.config.wallSnapEnabled) {
            this._generateWallSnapPoints();
        }
        
        console.log('[MICESnapPoints] Room 설정:', roomRect);
    }
    
    /**
     * 벽면 스냅 포인트 생성
     * @private
     */
    _generateWallSnapPoints() {
        if (!this.roomRect) return;
        
        const r = this.roomRect;
        const offset = this.config.wallOffset;
        
        this.snapPoints.wall = [
            // 벽에서 offset 만큼 떨어진 내부 라인
            { x: r.x + offset, y: r.y + offset, type: 'wall-inner-tl', label: '좌상단' },
            { x: r.x + r.width - offset, y: r.y + offset, type: 'wall-inner-tr', label: '우상단' },
            { x: r.x + offset, y: r.y + r.height - offset, type: 'wall-inner-bl', label: '좌하단' },
            { x: r.x + r.width - offset, y: r.y + r.height - offset, type: 'wall-inner-br', label: '우하단' },
            
            // 벽 중앙점
            { x: r.x + r.width / 2, y: r.y + offset, type: 'wall-top-center', label: '상단 중앙' },
            { x: r.x + r.width / 2, y: r.y + r.height - offset, type: 'wall-bottom-center', label: '하단 중앙' },
            { x: r.x + offset, y: r.y + r.height / 2, type: 'wall-left-center', label: '좌측 중앙' },
            { x: r.x + r.width - offset, y: r.y + r.height / 2, type: 'wall-right-center', label: '우측 중앙' }
        ];
    }
    
    // =====================================================
    // 통로 (Corridor) 스냅 포인트
    // =====================================================
    
    /**
     * 수평 통로 추가
     * @param {number} y - Y 좌표
     * @param {number} width - 통로 너비
     * @param {string} label - 라벨
     */
    addHorizontalCorridor(y, width = null, label = '') {
        const corridorWidth = width || this.config.defaultCorridorWidth;
        
        this.snapPoints.corridor.push({
            type: 'horizontal',
            y: y,
            yTop: y - corridorWidth / 2,
            yBottom: y + corridorWidth / 2,
            width: corridorWidth,
            label: label || `수평 통로 (Y: ${y})`
        });
        
        console.log(`[MICESnapPoints] 수평 통로 추가: Y=${y}, 너비=${corridorWidth}`);
    }
    
    /**
     * 수직 통로 추가
     * @param {number} x - X 좌표
     * @param {number} width - 통로 너비
     * @param {string} label - 라벨
     */
    addVerticalCorridor(x, width = null, label = '') {
        const corridorWidth = width || this.config.defaultCorridorWidth;
        
        this.snapPoints.corridor.push({
            type: 'vertical',
            x: x,
            xLeft: x - corridorWidth / 2,
            xRight: x + corridorWidth / 2,
            width: corridorWidth,
            label: label || `수직 통로 (X: ${x})`
        });
        
        console.log(`[MICESnapPoints] 수직 통로 추가: X=${x}, 너비=${corridorWidth}`);
    }
    
    /**
     * Equipment Array에서 통로 자동 생성
     * @param {Object} arrayConfig - { rows, cols, unitWidth, unitHeight, corridorAfterRow, corridorWidth }
     * @param {number} startX - 시작 X
     * @param {number} startY - 시작 Y
     */
    generateCorridorsFromArray(arrayConfig, startX, startY) {
        const { rows, cols, unitWidth, unitHeight, corridorAfterRow, corridorWidth } = arrayConfig;
        
        const actualCorridorWidth = corridorWidth || this.config.defaultCorridorWidth;
        
        let currentY = startY;
        
        for (let row = 0; row < rows; row++) {
            currentY += unitHeight;
            
            // 통로 행인 경우
            if (corridorAfterRow && (row + 1) % corridorAfterRow === 0 && row < rows - 1) {
                this.addHorizontalCorridor(
                    currentY + actualCorridorWidth / 2,
                    actualCorridorWidth,
                    `통로 (Row ${row + 1} 이후)`
                );
                currentY += actualCorridorWidth;
            }
        }
        
        console.log('[MICESnapPoints] Array 기반 통로 생성 완료');
    }
    
    // =====================================================
    // 출입구 스냅 포인트
    // =====================================================
    
    /**
     * 출입구 스냅 포인트 추가
     * @param {number} x
     * @param {number} y
     * @param {string} doorType - 'entrance', 'exit', 'emergency'
     * @param {string} label
     */
    addDoorSnapPoint(x, y, doorType = 'entrance', label = '') {
        this.snapPoints.door.push({
            x: x,
            y: y,
            doorType: doorType,
            label: label || `${doorType} (${x}, ${y})`
        });
        
        console.log(`[MICESnapPoints] 출입구 추가: ${doorType} at (${x}, ${y})`);
    }
    
    /**
     * 벽면 출입구 자동 추가
     * @param {string} wall - 'top', 'bottom', 'left', 'right'
     * @param {number} position - 0~1 사이 비율
     * @param {string} doorType
     */
    addDoorOnWall(wall, position = 0.5, doorType = 'entrance') {
        if (!this.roomRect) {
            console.warn('[MICESnapPoints] Room이 설정되지 않았습니다');
            return;
        }
        
        const r = this.roomRect;
        let x, y;
        
        switch (wall) {
            case 'top':
                x = r.x + r.width * position;
                y = r.y;
                break;
            case 'bottom':
                x = r.x + r.width * position;
                y = r.y + r.height;
                break;
            case 'left':
                x = r.x;
                y = r.y + r.height * position;
                break;
            case 'right':
                x = r.x + r.width;
                y = r.y + r.height * position;
                break;
        }
        
        this.addDoorSnapPoint(x, y, doorType, `${wall} ${doorType}`);
    }
    
    // =====================================================
    // 기준선 (Baseline) 스냅 포인트
    // =====================================================
    
    /**
     * 수평 기준선 추가
     * @param {number} y
     * @param {string} label
     */
    addHorizontalBaseline(y, label = '') {
        this.snapPoints.baseline.push({
            type: 'horizontal',
            y: y,
            label: label || `기준선 Y=${y}`
        });
    }
    
    /**
     * 수직 기준선 추가
     * @param {number} x
     * @param {string} label
     */
    addVerticalBaseline(x, label = '') {
        this.snapPoints.baseline.push({
            type: 'vertical',
            x: x,
            label: label || `기준선 X=${x}`
        });
    }
    
    /**
     * Room 중앙선 추가
     */
    addRoomCenterlines() {
        if (!this.roomRect) return;
        
        const r = this.roomRect;
        
        this.addHorizontalBaseline(r.y + r.height / 2, 'Room 수평 중앙');
        this.addVerticalBaseline(r.x + r.width / 2, 'Room 수직 중앙');
    }
    
    // =====================================================
    // Array 정렬 스냅 포인트
    // =====================================================
    
    /**
     * Equipment Array 정렬 포인트 추가
     * @param {Object} arrayInfo - { x, y, rows, cols, unitWidth, unitHeight }
     */
    addArraySnapPoints(arrayInfo) {
        const { x, y, rows, cols, unitWidth, unitHeight } = arrayInfo;
        
        // 배열 경계
        this.snapPoints.array.push(
            { x: x, y: y, type: 'array-tl', label: 'Array 좌상단' },
            { x: x + cols * unitWidth, y: y, type: 'array-tr', label: 'Array 우상단' },
            { x: x, y: y + rows * unitHeight, type: 'array-bl', label: 'Array 좌하단' },
            { x: x + cols * unitWidth, y: y + rows * unitHeight, type: 'array-br', label: 'Array 우하단' }
        );
        
        // 배열 중앙
        this.snapPoints.array.push({
            x: x + cols * unitWidth / 2,
            y: y + rows * unitHeight / 2,
            type: 'array-center',
            label: 'Array 중앙'
        });
        
        this.equipmentArrays.push(arrayInfo);
        
        console.log('[MICESnapPoints] Array 스냅 포인트 추가');
    }
    
    // =====================================================
    // 사용자 정의 스냅 포인트
    // =====================================================
    
    /**
     * 사용자 정의 스냅 포인트 추가
     * @param {number} x
     * @param {number} y
     * @param {string} label
     */
    addCustomSnapPoint(x, y, label = '') {
        this.snapPoints.custom.push({
            x: x,
            y: y,
            type: 'custom',
            label: label || `Custom (${x}, ${y})`
        });
    }
    
    /**
     * 사용자 정의 스냅 포인트 제거
     * @param {number} x
     * @param {number} y
     * @param {number} tolerance
     */
    removeCustomSnapPoint(x, y, tolerance = 5) {
        this.snapPoints.custom = this.snapPoints.custom.filter(point => {
            const distance = Math.hypot(point.x - x, point.y - y);
            return distance > tolerance;
        });
    }
    
    // =====================================================
    // 스냅 계산
    // =====================================================
    
    /**
     * 가장 가까운 스냅 포인트 찾기
     * @param {number} x
     * @param {number} y
     * @param {number} threshold
     * @returns {Object|null} { x, y, type, label, distance }
     */
    findNearestSnapPoint(x, y, threshold = null) {
        if (!this.config.enabled) return null;
        
        const snapThreshold = threshold || this.config.threshold;
        let nearest = null;
        let minDistance = Infinity;
        
        // 모든 스냅 포인트 타입 순회
        const allPoints = [];
        
        // 통로 스냅
        if (this.config.corridorSnapEnabled) {
            this.snapPoints.corridor.forEach(corridor => {
                if (corridor.type === 'horizontal') {
                    // 통로 상단, 하단, 중앙에 스냅
                    allPoints.push({ x: x, y: corridor.yTop, type: 'corridor-top', label: corridor.label });
                    allPoints.push({ x: x, y: corridor.y, type: 'corridor-center', label: corridor.label });
                    allPoints.push({ x: x, y: corridor.yBottom, type: 'corridor-bottom', label: corridor.label });
                } else {
                    allPoints.push({ x: corridor.xLeft, y: y, type: 'corridor-left', label: corridor.label });
                    allPoints.push({ x: corridor.x, y: y, type: 'corridor-center', label: corridor.label });
                    allPoints.push({ x: corridor.xRight, y: y, type: 'corridor-right', label: corridor.label });
                }
            });
        }
        
        // 벽면 스냅
        if (this.config.wallSnapEnabled) {
            allPoints.push(...this.snapPoints.wall);
        }
        
        // 출입구 스냅
        if (this.config.doorSnapEnabled) {
            allPoints.push(...this.snapPoints.door);
        }
        
        // 기준선 스냅
        if (this.config.baselineSnapEnabled) {
            this.snapPoints.baseline.forEach(baseline => {
                if (baseline.type === 'horizontal') {
                    allPoints.push({ x: x, y: baseline.y, type: 'baseline-h', label: baseline.label });
                } else {
                    allPoints.push({ x: baseline.x, y: y, type: 'baseline-v', label: baseline.label });
                }
            });
        }
        
        // Array 스냅
        if (this.config.arraySnapEnabled) {
            allPoints.push(...this.snapPoints.array);
        }
        
        // 사용자 정의 스냅
        allPoints.push(...this.snapPoints.custom);
        
        // 최근접 포인트 찾기
        for (const point of allPoints) {
            const distance = Math.hypot(point.x - x, point.y - y);
            
            if (distance < snapThreshold && distance < minDistance) {
                minDistance = distance;
                nearest = {
                    x: point.x,
                    y: point.y,
                    type: point.type,
                    label: point.label,
                    distance: distance
                };
            }
        }
        
        return nearest;
    }
    
    /**
     * X축 스냅만 찾기
     * @param {number} x
     * @param {number} threshold
     * @returns {Object|null}
     */
    findNearestSnapX(x, threshold = null) {
        const snapThreshold = threshold || this.config.threshold;
        let nearest = null;
        let minDistance = Infinity;
        
        // 수직 통로, 기준선 등에서 X 스냅
        const xPositions = [];
        
        this.snapPoints.corridor.forEach(c => {
            if (c.type === 'vertical') {
                xPositions.push({ x: c.xLeft, type: 'corridor-left' });
                xPositions.push({ x: c.x, type: 'corridor-center' });
                xPositions.push({ x: c.xRight, type: 'corridor-right' });
            }
        });
        
        this.snapPoints.baseline.forEach(b => {
            if (b.type === 'vertical') {
                xPositions.push({ x: b.x, type: 'baseline' });
            }
        });
        
        for (const pos of xPositions) {
            const distance = Math.abs(pos.x - x);
            if (distance < snapThreshold && distance < minDistance) {
                minDistance = distance;
                nearest = { x: pos.x, type: pos.type, distance };
            }
        }
        
        return nearest;
    }
    
    /**
     * Y축 스냅만 찾기
     * @param {number} y
     * @param {number} threshold
     * @returns {Object|null}
     */
    findNearestSnapY(y, threshold = null) {
        const snapThreshold = threshold || this.config.threshold;
        let nearest = null;
        let minDistance = Infinity;
        
        // 수평 통로, 기준선 등에서 Y 스냅
        const yPositions = [];
        
        this.snapPoints.corridor.forEach(c => {
            if (c.type === 'horizontal') {
                yPositions.push({ y: c.yTop, type: 'corridor-top' });
                yPositions.push({ y: c.y, type: 'corridor-center' });
                yPositions.push({ y: c.yBottom, type: 'corridor-bottom' });
            }
        });
        
        this.snapPoints.baseline.forEach(b => {
            if (b.type === 'horizontal') {
                yPositions.push({ y: b.y, type: 'baseline' });
            }
        });
        
        for (const pos of yPositions) {
            const distance = Math.abs(pos.y - y);
            if (distance < snapThreshold && distance < minDistance) {
                minDistance = distance;
                nearest = { y: pos.y, type: pos.type, distance };
            }
        }
        
        return nearest;
    }
    
    // =====================================================
    // 시각화
    // =====================================================
    
    /**
     * UI 레이어 설정
     * @param {Konva.Layer} layer
     */
    setUILayer(layer) {
        this.uiLayer = layer;
    }
    
    /**
     * 스냅 포인트 시각화 표시
     */
    showSnapPoints() {
        if (!this.uiLayer) return;
        
        this.hideSnapPoints();
        this.showVisualization = true;
        
        const colors = {
            corridor: '#e74c3c',
            wall: '#3498db',
            door: '#2ecc71',
            baseline: '#9b59b6',
            array: '#f39c12',
            custom: '#667eea'
        };
        
        // 통로 시각화
        this.snapPoints.corridor.forEach(c => {
            if (c.type === 'horizontal') {
                const line = new Konva.Line({
                    points: [0, c.y, 10000, c.y],
                    stroke: colors.corridor,
                    strokeWidth: 1,
                    dash: [10, 5],
                    opacity: 0.5,
                    listening: false,
                    name: 'snap-visual'
                });
                this.visualElements.push(line);
                this.uiLayer.add(line);
            } else {
                const line = new Konva.Line({
                    points: [c.x, 0, c.x, 10000],
                    stroke: colors.corridor,
                    strokeWidth: 1,
                    dash: [10, 5],
                    opacity: 0.5,
                    listening: false,
                    name: 'snap-visual'
                });
                this.visualElements.push(line);
                this.uiLayer.add(line);
            }
        });
        
        // 포인트 시각화 (원형)
        const allPoints = [
            ...this.snapPoints.wall.map(p => ({ ...p, color: colors.wall })),
            ...this.snapPoints.door.map(p => ({ ...p, color: colors.door })),
            ...this.snapPoints.array.map(p => ({ ...p, color: colors.array })),
            ...this.snapPoints.custom.map(p => ({ ...p, color: colors.custom }))
        ];
        
        allPoints.forEach(point => {
            const circle = new Konva.Circle({
                x: point.x,
                y: point.y,
                radius: 5,
                fill: point.color,
                opacity: 0.7,
                listening: false,
                name: 'snap-visual'
            });
            this.visualElements.push(circle);
            this.uiLayer.add(circle);
        });
        
        this.uiLayer.batchDraw();
    }
    
    /**
     * 스냅 포인트 시각화 숨김
     */
    hideSnapPoints() {
        this.showVisualization = false;
        this.visualElements.forEach(el => el.destroy());
        this.visualElements = [];
        
        if (this.uiLayer) {
            this.uiLayer.batchDraw();
        }
    }
    
    /**
     * 시각화 토글
     * @returns {boolean}
     */
    toggleVisualization() {
        if (this.showVisualization) {
            this.hideSnapPoints();
        } else {
            this.showSnapPoints();
        }
        return this.showVisualization;
    }
    
    // =====================================================
    // 설정
    // =====================================================
    
    /**
     * 스냅 타입 활성화/비활성화
     * @param {string} type - 'corridor', 'wall', 'door', 'baseline', 'array'
     * @param {boolean} enabled
     */
    setSnapTypeEnabled(type, enabled) {
        const key = `${type}SnapEnabled`;
        if (this.config.hasOwnProperty(key)) {
            this.config[key] = enabled;
        }
    }
    
    /**
     * threshold 설정
     * @param {number} threshold
     */
    setThreshold(threshold) {
        this.config.threshold = threshold;
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 특정 타입의 스냅 포인트 제거
     * @param {string} type - 'corridor', 'wall', 'door', 'baseline', 'array', 'custom'
     */
    clearSnapPoints(type) {
        if (this.snapPoints.hasOwnProperty(type)) {
            this.snapPoints[type] = [];
        }
    }
    
    /**
     * 모든 스냅 포인트 제거
     */
    clearAllSnapPoints() {
        this.snapPoints = {
            corridor: [],
            wall: [],
            door: [],
            baseline: [],
            array: [],
            custom: []
        };
        this.equipmentArrays = [];
    }
    
    /**
     * 전체 정리
     */
    clear() {
        this.clearAllSnapPoints();
        this.hideSnapPoints();
        this.roomRect = null;
    }
    
    /**
     * 파괴
     */
    destroy() {
        this.clear();
        this.uiLayer = null;
        console.log('[MICESnapPoints] 파괴 완료');
    }
}

// ✅ ES6 모듈 export
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.MICESnapPoints = MICESnapPoints;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MICESnapPoints;
}

