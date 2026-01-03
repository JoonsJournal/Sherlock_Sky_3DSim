/**
 * WallDrawTool.js v2.1.0
 * ======================
 * 
 * 벽을 직선으로 그릴 수 있는 도구
 * 
 * ✨ v2.1.0 수정 (Phase 5.2 - CoordinateTransformer 통합):
 * - ✅ CoordinateTransformer 사용으로 좌표 변환 통일
 * - ✅ getCanvasPos() → coordinateTransformer.getCanvasPosition() 교체
 * - ✅ _initCoordinateTransformer() 메서드 추가
 * 
 * ✨ v2.0.0 수정 (Phase 5.1 - Tool-Command 통합):
 * - ✅ CommandManager 참조 추가
 * - ✅ setCommandManager() 메서드 추가
 * - ✅ getCommandManager() 메서드 추가
 * - ✅ 벽 생성 시 CreateCommand 사용
 * - ✅ Undo 시 벽 자동 삭제
 * 
 * @version 2.1.0
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/tools/WallDrawTool.js
 */

class WallDrawTool {
    constructor(canvas2DEditor) {
        this.canvas = canvas2DEditor;
        this.isActive = false;
        this.isDrawing = false;
        
        // ✨ v2.0.0: CommandManager 참조
        this.commandManager = null;
        
        // ✨ v2.1.0: CoordinateTransformer 초기화
        this.coordinateTransformer = null;
        this._initCoordinateTransformer();
        
        // 그리기 상태
        this.startPoint = null;
        this.tempLine = null;
        
        // 기본 벽 설정
        this.wallConfig = {
            thickness: 0.2,  // 20cm
            height: 3,       // 3m
            color: '#888888',
            rotation: 0
        };
        
        // 이벤트 핸들러 바인딩
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        
        console.log('[WallDrawTool] 초기화 완료 v2.1.0 (CoordinateTransformer 통합)');
    }
    
    // =====================================================
    // ✨ v2.1.0: CoordinateTransformer 초기화
    // =====================================================
    
    /**
     * CoordinateTransformer 초기화
     * @private
     */
    _initCoordinateTransformer() {
        const TransformerClass = window.CoordinateTransformer || 
            (typeof CoordinateTransformer !== 'undefined' ? CoordinateTransformer : null);
        
        if (TransformerClass && this.canvas?.stage) {
            this.coordinateTransformer = new TransformerClass(this.canvas.stage);
            console.log('[WallDrawTool] CoordinateTransformer 초기화 완료');
        } else {
            console.warn('[WallDrawTool] CoordinateTransformer를 찾을 수 없습니다. 기본 좌표 변환 사용.');
        }
    }
    
    // =====================================================
    // ✨ v2.0.0: CommandManager 연동
    // =====================================================
    
    /**
     * ✨ v2.0.0: CommandManager 설정
     * @param {CommandManager} commandManager
     */
    setCommandManager(commandManager) {
        this.commandManager = commandManager;
        console.log('[WallDrawTool] CommandManager 설정 완료');
    }
    
    /**
     * ✨ v2.0.0: CommandManager 가져오기 (여러 소스에서 시도)
     * @returns {CommandManager|null}
     */
    getCommandManager() {
        if (this.commandManager) {
            return this.commandManager;
        }
        if (this.canvas && this.canvas.commandManager) {
            return this.canvas.commandManager;
        }
        if (typeof window !== 'undefined' && window.commandManager) {
            return window.commandManager;
        }
        return null;
    }
    
    // =====================================================
    // 도구 활성화/비활성화
    // =====================================================
    
    /**
     * 도구 활성화
     */
    activate() {
        console.log('[WallDrawTool] 도구 활성화');
        this.isActive = true;
        
        // 이벤트 리스너 등록
        this.canvas.stage.on('mousedown', this.onMouseDown);
        this.canvas.stage.on('mousemove', this.onMouseMove);
        this.canvas.stage.on('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);
        
        // 커서 변경
        this.canvas.stage.container().style.cursor = 'crosshair';
        
        console.log('[WallDrawTool] 이벤트 리스너 등록 완료');
    }
    
    /**
     * 도구 비활성화
     */
    deactivate() {
        console.log('[WallDrawTool] 도구 비활성화');
        this.isActive = false;
        this.isDrawing = false;
        
        // 임시 라인 제거
        if (this.tempLine) {
            this.tempLine.destroy();
            this.tempLine = null;
        }
        
        // 이벤트 리스너 제거
        this.canvas.stage.off('mousedown', this.onMouseDown);
        this.canvas.stage.off('mousemove', this.onMouseMove);
        this.canvas.stage.off('mouseup', this.onMouseUp);
        document.removeEventListener('keydown', this.onKeyDown);
        
        // 커서 복원
        this.canvas.stage.container().style.cursor = 'default';
        
        console.log('[WallDrawTool] 이벤트 리스너 제거 완료');
    }
    
    // =====================================================
    // 마우스 이벤트 핸들러
    // =====================================================
    
    /**
     * 마우스 다운 이벤트 - 시작점 기록
     */
    onMouseDown(e) {
        if (!this.isActive) return;
        
        // Stage 클릭인지 확인 (객체 클릭 제외)
        if (e.target !== this.canvas.stage) {
            return;
        }
        
        // ✨ v2.1.0: CoordinateTransformer 사용
        const pos = this.getCanvasPos();
        
        // Snap to Grid 적용
        if (this.canvas.config.snapToGrid) {
            pos.x = this.snapToGrid(pos.x);
            pos.y = this.snapToGrid(pos.y);
        }
        
        this.startPoint = pos;
        this.isDrawing = true;
        
        console.log('[WallDrawTool] 그리기 시작:', pos);
        
        // 임시 라인 생성 (점선)
        this.tempLine = new Konva.Line({
            points: [pos.x, pos.y, pos.x, pos.y],
            stroke: '#667eea',
            strokeWidth: 3,
            dash: [10, 5],
            lineCap: 'round',
            listening: false
        });
        
        this.canvas.layers.ui.add(this.tempLine);
        this.canvas.layers.ui.batchDraw();
        
        // 선택 해제
        this.canvas.deselectAll();
    }
    
    /**
     * 마우스 이동 이벤트 - 임시 라인 업데이트
     */
    onMouseMove(e) {
        if (!this.isActive || !this.isDrawing || !this.tempLine) return;
        
        // ✨ v2.1.0: CoordinateTransformer 사용
        const currentPos = this.getCanvasPos();
        
        // Snap to Grid 적용
        if (this.canvas.config.snapToGrid) {
            currentPos.x = this.snapToGrid(currentPos.x);
            currentPos.y = this.snapToGrid(currentPos.y);
        }
        
        // 임시 라인 업데이트
        this.tempLine.points([
            this.startPoint.x,
            this.startPoint.y,
            currentPos.x,
            currentPos.y
        ]);
        
        this.canvas.layers.ui.batchDraw();
    }
    
    /**
     * 마우스 업 이벤트 - 벽 생성
     */
    onMouseUp(e) {
        if (!this.isActive || !this.isDrawing) return;
        
        // ✨ v2.1.0: CoordinateTransformer 사용
        const endPoint = this.getCanvasPos();
        
        // Snap to Grid 적용
        if (this.canvas.config.snapToGrid) {
            endPoint.x = this.snapToGrid(endPoint.x);
            endPoint.y = this.snapToGrid(endPoint.y);
        }
        
        // 최소 길이 체크 (10px 이상)
        const dx = endPoint.x - this.startPoint.x;
        const dy = endPoint.y - this.startPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 10) {
            console.log('[WallDrawTool] 벽이 너무 짧습니다 (최소 10px)');
            this.cancelDrawing();
            return;
        }
        
        // 임시 라인 제거
        if (this.tempLine) {
            this.tempLine.destroy();
            this.tempLine = null;
        }
        
        // ✨ v2.0.0: 실제 벽 생성 (Command 사용)
        this.createWall(this.startPoint, endPoint);
        
        // 상태 초기화
        this.isDrawing = false;
        this.startPoint = null;
        
        console.log('[WallDrawTool] 벽 생성 완료');
    }
    
    /**
     * 키보드 이벤트 - ESC로 취소
     */
    onKeyDown(e) {
        if (!this.isActive) return;
        
        if (e.key === 'Escape' && this.isDrawing) {
            console.log('[WallDrawTool] 그리기 취소');
            this.cancelDrawing();
        }
    }
    
    /**
     * 그리기 취소
     */
    cancelDrawing() {
        this.isDrawing = false;
        this.startPoint = null;
        
        if (this.tempLine) {
            this.tempLine.destroy();
            this.tempLine = null;
        }
        
        this.canvas.layers.ui.batchDraw();
    }
    
    // =====================================================
    // ✨ v2.0.0: 벽 생성 (Command 통합)
    // =====================================================
    
    /**
     * 실제 벽 생성 - CreateCommand 사용
     */
    createWall(start, end) {
        const wallId = `wall_${Date.now()}`;
        const layer = this.canvas.layers.room;
        
        console.log('[WallDrawTool] 벽 생성:', {
            id: wallId,
            start,
            end
        });
        
        // Konva.Line 객체 생성
        const wall = new Konva.Line({
            id: wallId,
            name: 'wall',
            points: [start.x, start.y, end.x, end.y],
            stroke: this.wallConfig.color,
            strokeWidth: 4,
            lineCap: 'round',
            lineJoin: 'round',
            
            // 벽 드래그 가능
            draggable: true,
            listening: true,
            
            // rotation 추가
            rotation: this.wallConfig.rotation || 0,
            
            // 메타데이터 저장
            wallType: 'partition',
            wallHeight: this.wallConfig.height,
            wallThickness: this.wallConfig.thickness,
            
            // 원본 스타일 저장 (선택 해제 시 복원용)
            originalStroke: this.wallConfig.color,
            originalStrokeWidth: 4
        });
        
        // 클릭 이벤트 (선택)
        wall.on('click', (e) => {
            console.log('[WallDrawTool] Wall 클릭:', wallId);
            
            if (e.evt.ctrlKey || e.evt.metaKey) {
                this.canvas.selectMultiple(wall);
            } else {
                this.canvas.selectShape(wall);
            }
        });
        
        // 마우스 호버
        wall.on('mouseenter', () => {
            if (!this.canvas.selectedObjects.includes(wall)) {
                wall.strokeWidth(6);
                wall.stroke('#667eea');
                this.canvas.layers.room.batchDraw();
            }
            document.body.style.cursor = 'pointer';
        });
        
        wall.on('mouseleave', () => {
            if (!this.canvas.selectedObjects.includes(wall)) {
                wall.strokeWidth(4);
                wall.stroke(this.wallConfig.color);
                this.canvas.layers.room.batchDraw();
            }
            document.body.style.cursor = this.isActive ? 'crosshair' : 'default';
        });
        
        // ✨ v2.0.0: CreateCommand 사용
        const cmdManager = this.getCommandManager();
        const CreateCommandClass = window.CreateCommand;
        
        if (cmdManager && CreateCommandClass) {
            // CreateCommand로 벽 추가 (Undo 가능)
            console.log('[WallDrawTool] CreateCommand 사용하여 벽 생성');
            
            const createCommand = new CreateCommandClass(wall, layer);
            cmdManager.execute(createCommand);
            
            // wallShapes Map에 추가 (Command 실행 후)
            this.canvas.wallShapes.set(wallId, wall);
            
            console.log('[WallDrawTool] ✅ CreateCommand 실행 완료:', wallId);
        } else {
            // 폴백: 직접 추가 (Command 없이)
            console.warn('[WallDrawTool] CommandManager 없음 - 직접 추가');
            
            layer.add(wall);
            layer.batchDraw();
            
            // wallShapes Map에 추가
            this.canvas.wallShapes.set(wallId, wall);
            
            console.log('[WallDrawTool] ✅ 벽 직접 생성 완료:', wallId);
        }
        
        return wall;
    }
    
    // =====================================================
    // ✨ v2.1.0: 좌표 변환 (CoordinateTransformer 사용)
    // =====================================================
    
    /**
     * 캔버스 좌표 가져오기 (Zoom/Pan 변환 적용)
     * @returns {Object} { x, y }
     */
    getCanvasPos() {
        // ✨ v2.1.0: CoordinateTransformer 사용
        if (this.coordinateTransformer) {
            return this.coordinateTransformer.getCanvasPosition();
        }
        
        // Static 메서드 사용 (폴백)
        if (window.CoordinateTransformer) {
            return window.CoordinateTransformer.getPointerPosition(this.canvas.stage);
        }
        
        // 최종 폴백: 직접 변환
        const stage = this.canvas.stage;
        const pointerPos = stage.getPointerPosition();
        
        if (!pointerPos) {
            return { x: 0, y: 0 };
        }
        
        // Stage의 현재 transform (zoom/pan) 가져오기
        const transform = stage.getAbsoluteTransform().copy();
        
        // 역변환하여 캔버스 좌표 계산
        transform.invert();
        const canvasPos = transform.point(pointerPos);
        
        return {
            x: canvasPos.x,
            y: canvasPos.y
        };
    }
    
    /**
     * @deprecated getMousePos는 getCanvasPos로 대체됨
     */
    getMousePos(e) {
        return this.getCanvasPos();
    }
    
    /**
     * Snap to Grid
     */
    snapToGrid(value) {
        const gridSize = this.canvas.config.gridSize;
        return Math.round(value / gridSize) * gridSize;
    }
    
    // =====================================================
    // 설정
    // =====================================================
    
    /**
     * 벽 설정 업데이트
     */
    updateWallConfig(config) {
        if (config.thickness !== undefined) {
            this.wallConfig.thickness = config.thickness;
        }
        if (config.height !== undefined) {
            this.wallConfig.height = config.height;
        }
        if (config.color !== undefined) {
            this.wallConfig.color = config.color;
        }
        if (config.rotation !== undefined) {
            this.wallConfig.rotation = config.rotation;
        }
        
        console.log('[WallDrawTool] 벽 설정 업데이트:', this.wallConfig);
    }
    
    /**
     * 현재 설정 반환
     */
    getWallConfig() {
        return { ...this.wallConfig };
    }
    
    // =====================================================
    // 정리
    // =====================================================
    
    /**
     * 파괴
     */
    destroy() {
        this.deactivate();
        
        if (this.coordinateTransformer) {
            this.coordinateTransformer.destroy();
            this.coordinateTransformer = null;
        }
        
        this.commandManager = null;
        this.canvas = null;
        
        console.log('[WallDrawTool] 파괴 완료');
    }
}

// 전역 객체 등록 (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.WallDrawTool = WallDrawTool;
}

// CommonJS export (Node.js 환경)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WallDrawTool;
}

console.log('✅ WallDrawTool.js 로드 완료 v2.1.0 (CoordinateTransformer 통합)');