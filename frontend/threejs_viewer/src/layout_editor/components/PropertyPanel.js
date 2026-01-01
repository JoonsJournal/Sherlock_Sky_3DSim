/**
 * PropertyPanel.js v2.0.0
 * ========================
 * 
 * 선택된 객체의 속성을 표시하고 편집할 수 있는 패널
 * 
 * ✨ v2.0.0 신규 기능 (Phase 3.2):
 * - ✅ showValidationErrors() - 검증 에러 목록 표시
 * - ✅ hideValidationErrors() - 에러 섹션 숨김
 * - ✅ 에러 클릭 시 Canvas 하이라이트 및 스크롤
 * 
 * 📝 v1.0 기능 유지:
 * - ✅ 객체 타입별 속성 표시 (벽, 설비, Room 등)
 * - ✅ 값 변경 → 실시간 Canvas 업데이트
 * - ✅ 다중 선택 시 공통 속성 표시
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
        
        // ✨ v2.0.0: 현재 표시 중인 검증 에러
        this.currentValidationErrors = [];
        
        // ✨ v2.0.0: LayoutEditorMain 참조 (에러 클릭 시 사용)
        this.layoutEditorMain = null;
        
        // 패널 초기 HTML
        this.initPanel();
        
        console.log('[PropertyPanel] 초기화 완료 v2.0.0');
    }
    
    /**
     * 패널 초기화
     */
    initPanel() {
        this.container.innerHTML = `
            <!-- ✨ v2.0.0: 검증 에러 섹션 (NEW) -->
            <div class="validation-errors-section" id="validation-errors-section" style="display: none;">
                <div class="validation-errors-header">
                    <h3 style="margin: 0; color: #e74c3c; display: flex; align-items: center; gap: 8px;">
                        <span>🔴</span> Validation Errors
                    </h3>
                    <button class="validation-close-btn" onclick="propertyPanel.hideValidationErrors()">✕</button>
                </div>
                <div class="validation-errors-summary" id="validation-errors-summary"></div>
                <div class="validation-errors-list" id="validation-errors-list"></div>
            </div>
            
            <!-- 기존: 속성 패널 (변경 없음) -->
            <div class="property-panel-content" style="padding: 20px; display: none;">
                <h3 style="margin: 0 0 20px 0; color: #2c3e50; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                    Properties
                </h3>
                <div id="property-fields"></div>
            </div>
            
            <!-- 기존: 빈 상태 (변경 없음) -->
            <div class="property-panel-empty" style="padding: 20px; text-align: center; color: #95a5a6;">
                <p style="margin: 100px 0;">객체를 선택하세요</p>
                <p style="font-size: 12px;">👆 Canvas에서 객체를 클릭</p>
            </div>
        `;
        
        // ✨ v2.0.0: CSS 스타일 추가
        this.addValidationStyles();
    }
    
    /**
     * ✨ v2.0.0: LayoutEditorMain 참조 설정
     * @param {LayoutEditorMain} main - LayoutEditorMain 인스턴스
     */
    setLayoutEditorMain(main) {
        this.layoutEditorMain = main;
        console.log('[PropertyPanel] LayoutEditorMain 참조 설정됨');
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
        if (shapeName === 'wall' || shapeName.includes('wall')) {
            html += this.getWallProperties(shape);
        } else if (shapeName === 'equipment' || shapeName.includes('equipment')) {
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
        
        let length = 0;
        if (wall.points) {
            const points = wall.points();
            if (points && points.length >= 4) {
                length = Math.sqrt(
                    Math.pow(points[2] - points[0], 2) + 
                    Math.pow(points[3] - points[1], 2)
                ) / this.canvas.config.scale;
            }
        }
        
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
            
            if (shape.name() === 'equipment' || shape.name().includes('equipment')) {
                this.canvas.equipmentShapes.delete(id);
            } else if (shape.name() === 'wall' || shape.name().includes('wall')) {
                this.canvas.wallShapes.delete(id);
            } else {
                this.canvas.componentShapes.delete(id);
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
        if (!rgb) return '#888888';
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
    
    // =====================================================
    // ✨ v2.0.0 Phase 3.2: 검증 에러 표시 메서드들
    // =====================================================
    
    /**
     * ✨ v2.0.0: 검증 에러 목록 표시
     * @param {Array} errors - 에러 배열
     */
    showValidationErrors(errors) {
        if (!errors || errors.length === 0) {
            this.hideValidationErrors();
            return;
        }
        
        console.log('[PropertyPanel] 🔴 Showing validation errors:', errors.length);
        
        this.currentValidationErrors = errors;
        
        // 에러 섹션 표시
        const section = this.container.querySelector('#validation-errors-section');
        section.style.display = 'block';
        
        // 속성 패널, 빈 상태 숨김
        this.container.querySelector('.property-panel-content').style.display = 'none';
        this.container.querySelector('.property-panel-empty').style.display = 'none';
        
        // 요약 표시
        const summaryEl = this.container.querySelector('#validation-errors-summary');
        const errorCount = errors.filter(e => e.severity === 'error').length;
        const warningCount = errors.filter(e => e.severity === 'warning').length;
        
        summaryEl.innerHTML = `
            <div class="validation-summary-stats">
                ${errorCount > 0 ? `<span class="stat-error">❌ ${errorCount} 에러</span>` : ''}
                ${warningCount > 0 ? `<span class="stat-warning">⚠️ ${warningCount} 경고</span>` : ''}
            </div>
            <div class="validation-summary-message">
                저장하려면 모든 에러를 수정하세요
            </div>
        `;
        
        // 에러 목록 표시
        const listEl = this.container.querySelector('#validation-errors-list');
        listEl.innerHTML = errors.map((error, index) => this.renderErrorItem(error, index)).join('');
        
        // 에러 아이템 클릭 이벤트 등록
        this.attachValidationErrorEvents();
    }
    
    /**
     * ✨ v2.0.0: 단일 에러 아이템 렌더링
     */
    renderErrorItem(error, index) {
        const icon = error.severity === 'error' ? '❌' : '⚠️';
        const severityClass = error.severity === 'error' ? 'error' : 'warning';
        
        return `
            <div class="validation-error-item ${severityClass}" 
                 data-error-index="${index}"
                 data-error-id="${error.id || ''}"
                 data-equipment-id="${error.equipmentId || ''}"
                 data-wall-id="${error.wallId || ''}">
                <div class="error-item-header">
                    <span class="error-icon">${icon}</span>
                    <span class="error-type">${this.formatErrorType(error.type)}</span>
                </div>
                <div class="error-message">${error.message}</div>
                ${error.fix ? `<div class="error-fix">💡 ${error.fix}</div>` : ''}
                <div class="error-actions">
                    <button class="error-action-btn focus-btn" data-action="focus" data-index="${index}">
                        🔍 위치 보기
                    </button>
                    ${error.equipmentId ? `
                        <button class="error-action-btn select-btn" data-action="select" data-index="${index}">
                            ✋ 선택
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * ✨ v2.0.0: 에러 타입 포맷팅
     */
    formatErrorType(type) {
        if (!type) return 'Unknown';
        
        // EQUIPMENT_OUT_OF_BOUNDS → Equipment Out Of Bounds
        return type
            .split('_')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }
    
    /**
     * ✨ v2.0.0: 검증 에러 이벤트 등록
     */
    attachValidationErrorEvents() {
        const listEl = this.container.querySelector('#validation-errors-list');
        
        // 에러 아이템 클릭 (하이라이트)
        listEl.querySelectorAll('.validation-error-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 버튼 클릭은 제외
                if (e.target.closest('.error-action-btn')) return;
                
                const index = parseInt(item.dataset.errorIndex);
                this.onErrorItemClick(index);
            });
        });
        
        // 액션 버튼 클릭
        listEl.querySelectorAll('.error-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);
                
                if (action === 'focus') {
                    this.onErrorFocus(index);
                } else if (action === 'select') {
                    this.onErrorSelect(index);
                }
            });
        });
    }
    
    /**
     * ✨ v2.0.0: 에러 아이템 클릭 처리
     */
    onErrorItemClick(index) {
        const error = this.currentValidationErrors[index];
        if (!error) return;
        
        console.log('[PropertyPanel] Error item clicked:', index, error);
        
        // Canvas에서 해당 에러 하이라이트
        if (this.canvas && this.canvas.highlightValidationErrors) {
            this.canvas.highlightValidationErrors([error]);
        }
    }
    
    /**
     * ✨ v2.0.0: 에러 위치로 이동
     */
    onErrorFocus(index) {
        const error = this.currentValidationErrors[index];
        if (!error) return;
        
        console.log('[PropertyPanel] Focusing on error:', index);
        
        // Canvas에서 해당 위치로 스크롤
        if (this.canvas && this.canvas.scrollToError) {
            this.canvas.scrollToError(error);
        }
        
        // LayoutEditorMain을 통해 처리
        if (this.layoutEditorMain && this.layoutEditorMain.focusOnError) {
            this.layoutEditorMain.focusOnError(error);
        }
    }
    
    /**
     * ✨ v2.0.0: 에러 객체 선택
     */
    onErrorSelect(index) {
        const error = this.currentValidationErrors[index];
        if (!error) return;
        
        console.log('[PropertyPanel] Selecting error shape:', index);
        
        // Canvas에서 해당 객체 선택
        if (this.canvas && this.canvas.selectErrorShape) {
            this.canvas.selectErrorShape(error);
        }
    }
    
    /**
     * ✨ v2.0.0: 검증 에러 섹션 숨기기
     */
    hideValidationErrors() {
        console.log('[PropertyPanel] Hiding validation errors');
        
        this.currentValidationErrors = [];
        
        const section = this.container.querySelector('#validation-errors-section');
        if (section) {
            section.style.display = 'none';
        }
        
        // 빈 상태 표시
        this.container.querySelector('.property-panel-content').style.display = 'none';
        this.container.querySelector('.property-panel-empty').style.display = 'block';
        
        // Canvas 하이라이트 제거
        if (this.canvas && this.canvas.clearValidationHighlights) {
            this.canvas.clearValidationHighlights();
        }
    }
    
    /**
     * ✨ v2.0.0: 검증 스타일 추가
     */
    addValidationStyles() {
        // 이미 추가되었는지 확인
        if (document.getElementById('property-panel-validation-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'property-panel-validation-styles';
        style.textContent = `
            /* 검증 에러 섹션 */
            .validation-errors-section {
                padding: 15px;
                background: #fff5f5;
                border-left: 4px solid #e74c3c;
                max-height: 100%;
                overflow-y: auto;
            }
            
            .validation-errors-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #f5c6cb;
            }
            
            .validation-close-btn {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #95a5a6;
                padding: 5px;
                transition: color 0.3s;
            }
            
            .validation-close-btn:hover {
                color: #e74c3c;
            }
            
            /* 요약 */
            .validation-errors-summary {
                margin-bottom: 15px;
                padding: 10px;
                background: white;
                border-radius: 6px;
            }
            
            .validation-summary-stats {
                display: flex;
                gap: 15px;
                margin-bottom: 8px;
            }
            
            .stat-error {
                color: #e74c3c;
                font-weight: 600;
            }
            
            .stat-warning {
                color: #f39c12;
                font-weight: 600;
            }
            
            .validation-summary-message {
                font-size: 12px;
                color: #666;
            }
            
            /* 에러 목록 */
            .validation-errors-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .validation-error-item {
                padding: 12px;
                background: white;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
                border-left: 4px solid transparent;
            }
            
            .validation-error-item.error {
                border-left-color: #e74c3c;
            }
            
            .validation-error-item.warning {
                border-left-color: #f39c12;
            }
            
            .validation-error-item:hover {
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transform: translateX(3px);
            }
            
            .error-item-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .error-icon {
                font-size: 16px;
            }
            
            .error-type {
                font-size: 11px;
                font-weight: 600;
                color: #7f8c8d;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .error-message {
                font-size: 13px;
                color: #2c3e50;
                margin-bottom: 8px;
                line-height: 1.4;
            }
            
            .error-fix {
                font-size: 12px;
                color: #27ae60;
                background: #e8f8f0;
                padding: 6px 10px;
                border-radius: 4px;
                margin-bottom: 8px;
            }
            
            .error-actions {
                display: flex;
                gap: 8px;
            }
            
            .error-action-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .focus-btn {
                background: #3498db;
                color: white;
            }
            
            .focus-btn:hover {
                background: #2980b9;
            }
            
            .select-btn {
                background: #9b59b6;
                color: white;
            }
            
            .select-btn:hover {
                background: #8e44ad;
            }
        `;
        
        document.head.appendChild(style);
    }
}

// CSS 스타일 추가 (기존 v1.0 스타일)
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