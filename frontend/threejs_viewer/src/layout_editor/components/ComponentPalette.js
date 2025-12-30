/**
 * ComponentPalette.js
 * Phase 2.6: 드래그 가능한 컴포넌트 목록 패널
 * 
 * 주요 역할:
 * 1. 5가지 컴포넌트 타입 정의 및 표시 (Partition, Desk, Pillar, Office, Equipment)
 * 2. HTML5 Drag and Drop API를 사용한 드래그 시작 처리
 * 3. Canvas2DEditor와 연동하여 Drop 시 객체 생성
 * 
 * 위치: /frontend/threejs_viewer/src/layout_editor/components/ComponentPalette.js
 */

export class ComponentPalette {
    constructor(containerId, canvas2DEditor) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.canvas2DEditor = canvas2DEditor;
        
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }
        
        if (!this.canvas2DEditor) {
            throw new Error('Canvas2DEditor instance is required');
        }
        
        // 컴포넌트 정의 (크기는 미터 단위)
        this.components = [
            {
                id: 'partition',
                name: 'Partition',
                icon: '🚪',
                width: 3.0,    // 3m
                depth: 2.5,    // 2.5m
                color: '#888888',
                description: '파티션 (3×2.5m)'
            },
            {
                id: 'desk',
                name: 'Desk',
                icon: '🪑',
                width: 1.6,    // 1.6m
                depth: 0.8,    // 0.8m
                color: '#8B4513',
                description: '책상 (1.6×0.8m)'
            },
            {
                id: 'pillar',
                name: 'Pillar',
                icon: '🏛️',
                width: 0.3,    // 0.3m
                depth: 0.3,    // 0.3m
                color: '#333333',
                description: '기둥 (0.3×0.3m)'
            },
            {
                id: 'office',
                name: 'Office',
                icon: '🏢',
                width: 12.0,   // 12m
                depth: 20.0,   // 20m
                color: '#87CEEB',
                description: 'Office 공간 (12×20m)'
            },
            {
                id: 'equipment',
                name: 'Equipment',
                icon: '⚙️',
                width: 1.5,    // 1.5m
                depth: 3.0,    // 3.0m
                color: '#FF8C00',
                description: 'Equipment (1.5×3.0m)'
            }
        ];
        
        console.log('[ComponentPalette] 초기화 완료');
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        console.log('[ComponentPalette] UI 생성 시작');
        this.renderPalette();
        this.setupDragHandlers();
        console.log('[ComponentPalette] 초기화 완료');
    }
    
    /**
     * Palette UI 렌더링
     */
    renderPalette() {
        // 컨테이너 초기화
        this.container.innerHTML = '';
        
        // 헤더
        const header = document.createElement('h3');
        header.textContent = 'Components';
        header.className = 'palette-header';
        this.container.appendChild(header);
        
        // 컴포넌트 아이템들을 담을 컨테이너
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'palette-items';
        
        // 각 컴포넌트 아이템 생성
        this.components.forEach(component => {
            const item = this.createComponentItem(component);
            itemsContainer.appendChild(item);
        });
        
        this.container.appendChild(itemsContainer);
        
        console.log('[ComponentPalette] UI 렌더링 완료');
    }
    
    /**
     * 개별 컴포넌트 아이템 생성
     * @param {Object} component - 컴포넌트 정의
     * @returns {HTMLElement}
     */
    createComponentItem(component) {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.draggable = true;
        item.dataset.componentId = component.id;
        
        // 아이콘
        const icon = document.createElement('span');
        icon.className = 'palette-item-icon';
        icon.textContent = component.icon;
        
        // 이름 및 크기 정보
        const info = document.createElement('div');
        info.className = 'palette-item-info';
        
        const name = document.createElement('div');
        name.className = 'palette-item-name';
        name.textContent = component.name;
        
        const size = document.createElement('div');
        size.className = 'palette-item-size';
        size.textContent = `${component.width}×${component.depth}m`;
        
        info.appendChild(name);
        info.appendChild(size);
        
        item.appendChild(icon);
        item.appendChild(info);
        
        return item;
    }
    
    /**
     * 드래그 이벤트 핸들러 설정
     */
    setupDragHandlers() {
        const items = this.container.querySelectorAll('.palette-item');
        
        items.forEach(item => {
            // 드래그 시작
            item.addEventListener('dragstart', (e) => {
                const componentId = e.target.closest('.palette-item').dataset.componentId;
                const component = this.components.find(c => c.id === componentId);
                
                if (component) {
                    // 드래그 데이터 설정
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', JSON.stringify(component));
                    
                    // 시각적 피드백
                    e.target.classList.add('dragging');
                    
                    console.log('[ComponentPalette] 드래그 시작:', component.name);
                }
            });
            
            // 드래그 종료
            item.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                console.log('[ComponentPalette] 드래그 종료');
            });
            
            // 호버 효과
            item.addEventListener('mouseenter', (e) => {
                e.target.classList.add('hover');
            });
            
            item.addEventListener('mouseleave', (e) => {
                e.target.classList.remove('hover');
            });
        });
        
        console.log('[ComponentPalette] 드래그 핸들러 설정 완료');
    }
    
    /**
     * 컴포넌트 정보 가져오기
     * @param {string} componentId - 컴포넌트 ID
     * @returns {Object|null}
     */
    getComponent(componentId) {
        return this.components.find(c => c.id === componentId) || null;
    }
    
    /**
     * 모든 컴포넌트 목록 가져오기
     * @returns {Array}
     */
    getAllComponents() {
        return [...this.components];
    }
    
    /**
     * 컴포넌트 추가 (확장용)
     * @param {Object} component - 새 컴포넌트 정의
     */
    addComponent(component) {
        if (!component.id || !component.name) {
            console.error('[ComponentPalette] Invalid component:', component);
            return;
        }
        
        // 중복 확인
        if (this.components.find(c => c.id === component.id)) {
            console.warn('[ComponentPalette] Component already exists:', component.id);
            return;
        }
        
        this.components.push(component);
        this.renderPalette();
        this.setupDragHandlers();
        
        console.log('[ComponentPalette] 컴포넌트 추가:', component.name);
    }
    
    /**
     * 컴포넌트 제거 (확장용)
     * @param {string} componentId - 제거할 컴포넌트 ID
     */
    removeComponent(componentId) {
        const index = this.components.findIndex(c => c.id === componentId);
        
        if (index === -1) {
            console.warn('[ComponentPalette] Component not found:', componentId);
            return;
        }
        
        this.components.splice(index, 1);
        this.renderPalette();
        this.setupDragHandlers();
        
        console.log('[ComponentPalette] 컴포넌트 제거:', componentId);
    }
    
    /**
     * Palette 표시
     */
    show() {
        this.container.style.display = 'block';
        console.log('[ComponentPalette] Palette 표시');
    }
    
    /**
     * Palette 숨김
     */
    hide() {
        this.container.style.display = 'none';
        console.log('[ComponentPalette] Palette 숨김');
    }
    
    /**
     * 정리
     */
    destroy() {
        this.container.innerHTML = '';
        console.log('[ComponentPalette] 정리 완료');
    }
}

// ============================================
// 사용 예시
// ============================================
/*
import { ComponentPalette } from './ComponentPalette.js';
import { Canvas2DEditor } from './Canvas2DEditor.js';

// Canvas2DEditor 인스턴스 생성
const canvas = new Canvas2DEditor('canvas-container');

// ComponentPalette 인스턴스 생성
const palette = new ComponentPalette('component-palette', canvas);

// 컴포넌트 추가 (선택사항)
palette.addComponent({
    id: 'custom-shelf',
    name: 'Shelf',
    icon: '📚',
    width: 2.0,
    depth: 0.5,
    color: '#CD853F',
    description: '선반 (2×0.5m)'
});
*/