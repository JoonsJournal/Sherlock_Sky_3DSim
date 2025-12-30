/**
 * PropertyPanel.js
 * ================
 * 
 * 선택된 객체의 속성을 표시하고 편집할 수 있는 패널
 * 
 * 주요 기능:
 * 1. 객체 타입별 속성 표시 (벽, 설비, Room 등)
 * 2. 값 변경 → 실시간 Canvas 업데이트
 * 3. 다중 선택 시 공통 속성 표시
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/components/PropertyPanel.js
 */

export class PropertyPanel {
    constructor(containerId, canvas2DEditor) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.canvas = canvas2DEditor;
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        
        // 현재 선택된 객체들
        this.selectedObjects = [];
        
        // 패널 초기 HTML
        this.initPanel();
        
        console.log('[PropertyPanel] 초기화 완료');
    }
    
    /**
     * 패널 초기화
     */
    initPanel() {
        this.container.innerHTML = `
            <div class="property-panel-content" style="padding: 20px; display: none;">
                <h3 style="margin: 0 0 20px 0; color: #2c3e50; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                    Properties
                </h3>
                <div id="property-fields"></div>
            </div>
            <div class="property-panel-empty" style="padding: 20px; text-align: center; color: #95a5a6;">
                <p style="margin: 100px 0;">객체를 선택하세요</p>
                <p style="font-size: 12px;">👆 Canvas에서 객체를 클릭</p>
            </div>
        `;
    }
    
    /**
     * 선택된 객체 표시
     * @param {Array} objects - Konva.Shape 배열
     */
    show(objects) {
        if (!objects || objects.length === 0) {
            this.hide();
            return;
        }
        
        this.selectedObjects = objects;
        
        console.log('[PropertyPanel] 객체 표시:', objects.length, '개');
        
        // 패널 표시
        this.container.querySelector('.property-panel-content').style.display = 'block';
        this.container.querySelector('.property-panel-empty').style.display = 'none';
        
        // 객체 타입 판별
        if (objects.length === 1) {
            // 단일 선택
            this.showSingleObjectProperties(objects[0]);
        } else {
            // 다중 선택
            this.showMultipleObjectsProperties(objects);
        }
    }
    
    /**
     * 패널 숨기기
     */
    hide() {
        this.selectedObjects = [];
        this.container.querySelector('.property-panel-content').style.display = 'none';
        this.container.querySelector('.property-panel-empty').style.display = 'block';
    }
    
    /**
     * 단일 객체 속성 표시
     */
    showSingleObjectProperties(shape) {
        const fieldsContainer = this.container.querySelector('#property-fields');
        const shapeName = shape.name();
        const shapeId = shape.id();
        
        console.log('[PropertyPanel] 단일 객체:', shapeName, shapeId);
        
        let html = '';
        
        // 1. 기본 정보
        html += `<div class="property-section">
            <div class="property-label">ID</div>
            <div class="property-value">${shapeId}</div>
        </div>`;
        
        html += `<div class="property-section">
            <div class="property-label">Type</div>
            <div class="property-value">${shapeName}</div>
        </div>`;
        
        // 2. 타입별 속성
        if (shapeName === 'wall') {
            html += this.getWallProperties(shape);
        } else if (shapeName === 'equipment') {
            html += this.getEquipmentProperties(shape);
        } else {
            html += `<div class="property-section">
                <p style="color: #95a5a6; font-size: 12px;">이 객체의 속성은 지원되지 않습니다</p>
            </div>`;
        }
        
        // 3. 위치 정보
        html += this.getPositionProperties(shape);
        
        // 4. 액션 버튼
        html += `<div class="property-actions" style="margin-top: 20px;">
            <button class="property-btn property-btn-danger" onclick="propertyPanel.deleteSelected()">
                🗑️ 삭제
            </button>
        </div>`;
        
        fieldsContainer.innerHTML = html;
        
        // 이벤트 리스너 등록
        this.attachEventListeners(shape);
    }
    
    /**
     * 다중 객체 속성 표시
     */
    showMultipleObjectsProperties(shapes) {
        const fieldsContainer = this.container.querySelector('#property-fields');
        
        console.log('[PropertyPanel] 다중 객체:', shapes.length, '개');
        
        let html = `<div class="property-section" style="background: #e3f2fd; border-left: 4px solid #2196F3;">
            <div class="property-label">선택된 객체</div>
            <div class="property-value"><strong>${shapes.length}개</strong></div>
        </div>`;
        
        // 공통 속성 (타입별)
        const types = [...new Set(shapes.map(s => s.name()))];
        html += `<div class="property-section">
            <div class="property-label">타입</div>
            <div class="property-value">${types.join(', ')}</div>
        </div>`;
        
        // 액션 버튼
        html += `<div class="property-actions" style="margin-top: 20px;">
            <button class="property-btn property-btn-danger" onclick="propertyPanel.deleteSelected()">
                🗑️ 선택된 객체 삭제 (${shapes.length}개)
            </button>
        </div>`;
        
        fieldsContainer.innerHTML = html;
    }
    
    /**
     * 벽 속성 HTML
     */
    getWallProperties(wall) {
        const wallType = wall.getAttr('wallType') || 'unknown';
        const wallHeight = wall.getAttr('wallHeight') || 3;
        const wallThickness = wall.getAttr('wallThickness') || 0.2;
        const points = wall.points();
        const length = Math.sqrt(
            Math.pow(points[2] - points[0], 2) + 
            Math.pow(points[3] - points[1], 2)
        ) / this.canvas.config.scale;
        
        return `
            <div class="property-section">
                <div class="property-label">Wall Type</div>
                <div class="property-value">${wallType === 'room_boundary' ? '외벽' : '파티션'}</div>
            </div>
            
            <div class="property-section">
                <div class="property-label">Length</div>
                <div class="property-value">${length.toFixed(2)} m</div>
            </div>
            
            <div class="property-section">
                <div class="property-label">Height (m)</div>
                <input type="number" 
                       class="property-input" 
                       id="wall-height"
                       value="${wallHeight}" 
                       min="2" 
                       max="10" 
                       step="0.1">
            </div>
            
            <div class="property-section">
                <div class="property-label">Thickness (m)</div>
                <input type="number" 
                       class="property-input" 
                       id="wall-thickness"
                       value="${wallThickness}" 
                       min="0.1" 
                       max="1" 
                       step="0.05">
            </div>
            
            <div class="property-section">
                <div class="property-label">Color</div>
                <input type="color" 
                       class="property-input" 
                       id="wall-color"
                       value="${this.rgbToHex(wall.stroke())}">
            </div>
        `;
    }
    
    /**
     * 설비 속성 HTML
     */
    getEquipmentProperties(equipment) {
        const equipmentName = equipment.getAttr('equipmentName') || 'Unknown';
        const width = equipment.width() / this.canvas.config.scale;
        const depth = equipment.height() / this.canvas.config.scale;
        
        return `
            <div class="property-section">
                <div class="property-label">Equipment Name</div>
                <input type="text" 
                       class="property-input" 
                       id="equipment-name"
                       value="${equipmentName}">
            </div>
            
            <div class="property-section">
                <div class="property-label">Width (m)</div>
                <input type="number" 
                       class="property-input" 
                       id="equipment-width"
                       value="${width.toFixed(2)}" 
                       min="0.5" 
                       step="0.1">
            </div>
            
            <div class="property-section">
                <div class="property-label">Depth (m)</div>
                <input type="number" 
                       class="property-input" 
                       id="equipment-depth"
                       value="${depth.toFixed(2)}" 
                       min="0.5" 
                       step="0.1">
            </div>
        `;
    }
    
    /**
     * 위치 속성 HTML
     */
    getPositionProperties(shape) {
        const x = (shape.x() / this.canvas.config.scale).toFixed(2);
        const y = (shape.y() / this.canvas.config.scale).toFixed(2);
        
        return `
            <div class="property-section">
                <div class="property-label">Position X (m)</div>
                <input type="number" 
                       class="property-input" 
                       id="shape-x"
                       value="${x}" 
                       step="0.1">
            </div>
            
            <div class="property-section">
                <div class="property-label">Position Y (m)</div>
                <input type="number" 
                       class="property-input" 
                       id="shape-y"
                       value="${y}" 
                       step="0.1">
            </div>
        `;
    }
    
    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners(shape) {
        // Wall 속성
        const wallHeight = this.container.querySelector('#wall-height');
        const wallThickness = this.container.querySelector('#wall-thickness');
        const wallColor = this.container.querySelector('#wall-color');
        
        if (wallHeight) {
            wallHeight.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                shape.setAttr('wallHeight', value);
                console.log('[PropertyPanel] Wall 높이 변경:', value);
            });
        }
        
        if (wallThickness) {
            wallThickness.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                shape.setAttr('wallThickness', value);
                console.log('[PropertyPanel] Wall 두께 변경:', value);
            });
        }
        
        if (wallColor) {
            wallColor.addEventListener('change', (e) => {
                const color = e.target.value;
                shape.stroke(color);
                shape.setAttr('originalStroke', color);
                this.canvas.layers.room.batchDraw();
                console.log('[PropertyPanel] Wall 색상 변경:', color);
            });
        }
        
        // 위치 속성
        const shapeX = this.container.querySelector('#shape-x');
        const shapeY = this.container.querySelector('#shape-y');
        
        if (shapeX) {
            shapeX.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value) * this.canvas.config.scale;
                shape.x(value);
                shape.getLayer().batchDraw();
                console.log('[PropertyPanel] X 위치 변경:', value);
            });
        }
        
        if (shapeY) {
            shapeY.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value) * this.canvas.config.scale;
                shape.y(value);
                shape.getLayer().batchDraw();
                console.log('[PropertyPanel] Y 위치 변경:', value);
            });
        }
    }
    
    /**
     * 선택된 객체 삭제
     */
    deleteSelected() {
        if (this.selectedObjects.length === 0) return;
        
        console.log('[PropertyPanel] 선택된 객체 삭제:', this.selectedObjects.length, '개');
        
        this.selectedObjects.forEach(shape => {
            const id = shape.id();
            
            if (shape.name() === 'equipment') {
                this.canvas.equipmentShapes.delete(id);
            } else if (shape.name() === 'wall') {
                this.canvas.wallShapes.delete(id);
            }
            
            shape.destroy();
        });
        
        this.canvas.deselectAll();
        this.canvas.stage.batchDraw();
        this.hide();
        
        console.log('[PropertyPanel] ✅ 삭제 완료');
    }
    
    /**
     * RGB to HEX 변환
     */
    rgbToHex(rgb) {
        if (rgb.startsWith('#')) return rgb;
        
        const match = rgb.match(/\d+/g);
        if (!match) return '#888888';
        
        const r = parseInt(match[0]);
        const g = parseInt(match[1]);
        const b = parseInt(match[2]);
        
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
}

// CSS 스타일 추가
const style = document.createElement('style');
style.textContent = `
    .property-section {
        margin: 15px 0;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
    }
    
    .property-label {
        font-size: 12px;
        font-weight: 600;
        color: #555;
        margin-bottom: 5px;
    }
    
    .property-value {
        font-size: 14px;
        color: #2c3e50;
    }
    
    .property-input {
        width: 100%;
        padding: 8px;
        border: 2px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        transition: border-color 0.3s;
    }
    
    .property-input:focus {
        outline: none;
        border-color: #667eea;
    }
    
    .property-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .property-btn {
        width: 100%;
        padding: 10px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
    }
    
    .property-btn-danger {
        background: #e74c3c;
        color: white;
    }
    
    .property-btn-danger:hover {
        background: #c0392b;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
    }
`;
document.head.appendChild(style);