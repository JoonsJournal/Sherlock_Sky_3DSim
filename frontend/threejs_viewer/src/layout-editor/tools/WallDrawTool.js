/**
 * WallDrawTool.js
 * ===============
 * 
 * 벽을 직선으로 그릴 수 있는 도구
 * 
 * @version 1.2.0 - Zoom/Pan 좌표 변환 수정
 * 
 * 위치: frontend/threejs_viewer/src/layout-editor/tools/WallDrawTool.js
 */

class WallDrawTool {
    constructor(canvas2DEditor) {
        this.canvas = canvas2DEditor;
        this.isActive = false;
        this.isDrawing = false;
        
        // 그리기 상태
        this.startPoint = null;
        this.tempLine = null;
        
        // 기본 벽 설정
        this.wallConfig = {
            thickness: 0.2,  // 20cm
            height: 3,       // 3m
            color: '#888888',
            rotation: 0      // ✨ Phase 3.1: 기본 rotation
        };
        
        // 이벤트 핸들러 바인딩
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        
        console.log('[WallDrawTool] 초기화 완료 v1.2.0');
    }
    
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
    
    /**
     * 마우스 다운 이벤트 - 시작점 기록
     */
    onMouseDown(e) {
        if (!this.isActive) return;
        
        // Stage 클릭인지 확인 (객체 클릭 제외)
        if (e.target !== this.canvas.stage) {
            return;
        }
        
        // ✅ 수정: Zoom/Pan이 적용된 캔버스 좌표 가져오기
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
        
        // ✅ 수정: Zoom/Pan이 적용된 캔버스 좌표 가져오기
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
        
        // ✅ 수정: Zoom/Pan이 적용된 캔버스 좌표 가져오기
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
        
        // 실제 벽 생성
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
    
    /**
     * 실제 벽 생성
     */
    createWall(start, end) {
        const wallId = `wall_${Date.now()}`;
        
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
            
            // ✨ Phase 3.1: rotation 추가
            rotation: this.wallConfig.rotation || 0,
            
            // 메타데이터 저장
            wallType: 'partition',  // 파티션 (내부 벽)
            wallHeight: this.wallConfig.height,
            wallThickness: this.wallConfig.thickness,
            
            // 원본 스타일 저장 (선택 해제 시 복원용)
            originalStroke: this.wallConfig.color,
            originalStrokeWidth: 4
        });
        
        // 클릭 이벤트 (선택)
        wall.on('click', (e) => {
            console.log('[WallDrawTool] Wall 클릭:', wallId);
            
            // Ctrl+클릭: 다중 선택
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
        
        // Room 레이어에 추가
        this.canvas.layers.room.add(wall);
        this.canvas.layers.room.batchDraw();
        
        // wallShapes Map에 추가
        this.canvas.wallShapes.set(wallId, wall);
        
        console.log('[WallDrawTool] ✅ 벽 생성 완료:', wallId);
    }
    
    /**
     * ✅ 수정: 캔버스 좌표 가져오기 (Zoom/Pan 변환 적용)
     * 
     * 스크린 좌표를 캔버스 좌표로 변환합니다.
     * Stage의 scale(zoom)과 position(pan)을 역변환하여 실제 캔버스 위치를 계산합니다.
     */
    getCanvasPos() {
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
     * 하위 호환성을 위해 유지
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
        // ✨ Phase 3.1: rotation 업데이트
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
}

// 전역 객체 등록 (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.WallDrawTool = WallDrawTool;
}