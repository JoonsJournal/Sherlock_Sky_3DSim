/**
 * RoomSizeManager.js
 * ===================
 * 
 * Room 크기 설정 및 외벽 4개 자동 생성 기능
 * 
 * 주요 기능:
 * 1. Room 크기 설정 (width, depth, height)
 * 2. 외벽 4개 자동 생성
 * 3. 기존 외벽 업데이트
 * 4. Canvas2DEditor와 통합
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/managers/RoomSizeManager.js
 */

class RoomSizeManager {
    constructor(canvas2DEditor) {
        this.canvas = canvas2DEditor;
        
        // 현재 Room 설정
        this.currentRoom = {
            width: 130,  // 기본 130m
            depth: 90,   // 기본 90m
            wallHeight: 3,  // 기본 3m
            wallThickness: 0.2  // 기본 0.2m
        };
        
        // 외벽 ID들 (나중에 업데이트 시 사용)
        this.wallIds = {
            north: null,
            south: null,
            east: null,
            west: null
        };
        
        console.log('[RoomSizeManager] 초기화 완료');
    }
    
    /**
     * Room 크기 업데이트 및 외벽 자동 생성
     * @param {number} width - Room 너비 (m)
     * @param {number} depth - Room 깊이 (m)
     * @param {number} wallHeight - 벽 높이 (m)
     */
    updateRoomSize(width, depth, wallHeight = 3) {
        console.log(`[RoomSizeManager] Room 크기 업데이트: ${width}m × ${depth}m, 높이: ${wallHeight}m`);
        
        // 유효성 검증
        if (width < 10 || depth < 10) {
            console.error('[RoomSizeManager] Room 크기는 최소 10m 이상이어야 합니다');
            return false;
        }
        
        // 현재 설정 업데이트
        this.currentRoom.width = width;
        this.currentRoom.depth = depth;
        this.currentRoom.wallHeight = wallHeight;
        
        // 기존 외벽 제거
        this.removeExistingWalls();
        
        // 새 외벽 생성
        this.createWalls();
        
        // Canvas 레이어 업데이트
        this.canvas.layers.room.batchDraw();
        
        console.log('[RoomSizeManager] Room 업데이트 완료');
        return true;
    }
    
    /**
     * 기존 외벽 제거
     */
    removeExistingWalls() {
        Object.values(this.wallIds).forEach(wallId => {
            if (wallId) {
                const wall = this.canvas.stage.findOne(`#${wallId}`);
                if (wall) {
                    wall.destroy();
                    console.log(`[RoomSizeManager] 기존 벽 제거: ${wallId}`);
                }
            }
        });
        
        // ID 초기화
        this.wallIds = {
            north: null,
            south: null,
            east: null,
            west: null
        };
    }
    
    /**
     * 외벽 4개 생성
     */
    createWalls() {
        const scale = this.canvas.config.scale;  // 1m = 10px
        const wallThickness = this.currentRoom.wallThickness * scale;
        
        // Canvas 중앙 기준 좌표 계산
        const canvasWidth = this.canvas.config.width;
        const canvasHeight = this.canvas.config.height;
        const roomWidthPx = this.currentRoom.width * scale;
        const roomDepthPx = this.currentRoom.depth * scale;
        
        // Room 중앙 정렬
        const offsetX = (canvasWidth - roomWidthPx) / 2;
        const offsetY = (canvasHeight - roomDepthPx) / 2;
        
        console.log('[RoomSizeManager] Wall 생성 시작...');
        console.log(`  - Room 크기 (px): ${roomWidthPx} × ${roomDepthPx}`);
        console.log(`  - Canvas 크기 (px): ${canvasWidth} × ${canvasHeight}`);
        console.log(`  - Offset: (${offsetX}, ${offsetY})`);
        
        // 1. 북쪽 벽 (상단)
        this.wallIds.north = this.createWall(
            offsetX,
            offsetY,
            offsetX + roomWidthPx,
            offsetY,
            'north'
        );
        
        // 2. 남쪽 벽 (하단)
        this.wallIds.south = this.createWall(
            offsetX,
            offsetY + roomDepthPx,
            offsetX + roomWidthPx,
            offsetY + roomDepthPx,
            'south'
        );
        
        // 3. 서쪽 벽 (왼쪽)
        this.wallIds.west = this.createWall(
            offsetX,
            offsetY,
            offsetX,
            offsetY + roomDepthPx,
            'west'
        );
        
        // 4. 동쪽 벽 (오른쪽)
        this.wallIds.east = this.createWall(
            offsetX + roomWidthPx,
            offsetY,
            offsetX + roomWidthPx,
            offsetY + roomDepthPx,
            'east'
        );
        
        console.log('[RoomSizeManager] Wall 4개 생성 완료:', this.wallIds);
    }
    
    /**
     * 단일 벽 생성
     * @param {number} x1 - 시작 X 좌표
     * @param {number} y1 - 시작 Y 좌표
     * @param {number} x2 - 끝 X 좌표
     * @param {number} y2 - 끝 Y 좌표
     * @param {string} direction - 벽 방향 (north, south, east, west)
     * @returns {string} - 생성된 벽의 ID
     */
    createWall(x1, y1, x2, y2, direction) {
        const wallId = `wall_room_${direction}_${Date.now()}`;
        
        // Konva.Line 객체 생성
        const wall = new Konva.Line({
            id: wallId,
            name: 'wall',
            points: [x1, y1, x2, y2],
            stroke: this.canvas.cssColors?.roomStroke || '#666666',
            strokeWidth: 4,
            lineCap: 'round',
            lineJoin: 'round',
            
            // ✅ 중요: 벽은 드래그 불가 (잔상 문제 방지)
            draggable: false,
            
            // ✅ 선택은 가능 (PropertyPanel에서 편집)
            listening: true,
            
            // 메타데이터
            wallType: 'room_boundary',
            direction: direction,
            wallHeight: this.currentRoom.wallHeight,
            wallThickness: this.currentRoom.wallThickness
        });
        
        // 클릭 이벤트 (선택)
        wall.on('click', (e) => {
            console.log(`[RoomSizeManager] Wall 클릭: ${wallId}`);
            
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
                wall.stroke(this.canvas.cssColors?.roomStroke || '#666666');
                this.canvas.layers.room.batchDraw();
            }
            document.body.style.cursor = 'default';
        });
        
        // Room 레이어에 추가
        this.canvas.layers.room.add(wall);
        
        console.log(`[RoomSizeManager] Wall 생성: ${wallId} (${direction})`);
        
        return wallId;
    }
    
    /**
     * 현재 Room 설정 반환
     */
    getCurrentRoom() {
        return { ...this.currentRoom };
    }
    
    /**
     * Wall ID 반환
     */
    getWallIds() {
        return { ...this.wallIds };
    }
    
    /**
     * Layout 데이터로 변환
     */
    toLayoutData() {
        const scale = this.canvas.config.scale;
        const walls = [];
        
        Object.entries(this.wallIds).forEach(([direction, wallId]) => {
            if (wallId) {
                const wall = this.canvas.stage.findOne(`#${wallId}`);
                if (wall) {
                    const points = wall.points();
                    walls.push({
                        id: wallId,
                        type: 'room_boundary',
                        direction: direction,
                        start: {
                            x: points[0] / scale,
                            z: points[1] / scale
                        },
                        end: {
                            x: points[2] / scale,
                            z: points[3] / scale
                        },
                        height: this.currentRoom.wallHeight,
                        thickness: this.currentRoom.wallThickness
                    });
                }
            }
        });
        
        return {
            room: this.currentRoom,
            walls: walls
        };
    }
    
    /**
     * Layout 데이터에서 로드
     */
    fromLayoutData(layoutData) {
        if (layoutData.room) {
            this.updateRoomSize(
                layoutData.room.width,
                layoutData.room.depth,
                layoutData.room.wallHeight || 3
            );
        }
    }
}
// 전역 객체 등록 (브라우저 환경)
if (typeof module === 'undefined' && typeof window !== 'undefined') {
    window.RoomSizeManager = RoomSizeManager;
}
