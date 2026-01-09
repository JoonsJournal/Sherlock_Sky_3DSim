/**
 * StatusBar.js
 * ============
 * SHERLOCK SKY 3DSim - Cleanroom Status Bar 컴포넌트
 * 
 * 하단 상태바 UI 컴포넌트
 * 서버 연결 상태, 시스템 로드, 알람 표시
 * 
 * @version 1.0.0
 * @created 2026-01-10
 */

import { iconRegistry } from '../icons/IconRegistry.js';

/**
 * 상태 타입 정의
 */
export const STATUS_TYPES = {
    NORMAL: 'normal',
    SUCCESS: 'success',
    WARNING: 'warning',
    ALARM: 'alarm',
    ERROR: 'error'
};

/**
 * StatusBar 클래스
 */
export class StatusBar {
    /**
     * @param {HTMLElement} container - 상태바를 렌더링할 컨테이너
     * @param {Object} config - 설정 옵션
     */
    constructor(container, config = {}) {
        this.container = container;
        this.config = {
            showServerStatus: true,
            showUserInfo: true,
            showLoadIndicator: true,
            showAlarms: true,
            showTimestamp: false,
            ...config
        };
        
        this.element = null;
        this.leftGroup = null;
        this.rightGroup = null;
        this.statusItems = new Map();
        
        this._init();
    }
    
    /**
     * 초기화
     * @private
     */
    _init() {
        this._createElement();
        this._renderDefaultItems();
    }
    
    /**
     * 상태바 요소 생성
     * @private
     */
    _createElement() {
        this.element = document.createElement('footer');
        this.element.className = 'cleanroom-status-bar';
        this.element.setAttribute('role', 'status');
        this.element.setAttribute('aria-live', 'polite');
        
        // 왼쪽 그룹
        this.leftGroup = document.createElement('div');
        this.leftGroup.className = 'cleanroom-status-group';
        this.element.appendChild(this.leftGroup);
        
        // 오른쪽 그룹
        this.rightGroup = document.createElement('div');
        this.rightGroup.className = 'cleanroom-status-group';
        this.element.appendChild(this.rightGroup);
        
        this.container.appendChild(this.element);
    }
    
    /**
     * 기본 상태 아이템 렌더링
     * @private
     */
    _renderDefaultItems() {
        // 서버 상태
        if (this.config.showServerStatus) {
            this.addItem('server', {
                group: 'left',
                type: STATUS_TYPES.NORMAL,
                icon: 'dot',
                label: 'Server:',
                value: 'Disconnected'
            });
        }
        
        // 사용자 정보
        if (this.config.showUserInfo) {
            this.addItem('user', {
                group: 'left',
                type: STATUS_TYPES.NORMAL,
                label: 'User:',
                value: this.config.username || 'Guest'
            });
        }
        
        // 로드 표시기 (초기 숨김)
        if (this.config.showLoadIndicator) {
            this.addItem('load', {
                group: 'right',
                type: STATUS_TYPES.WARNING,
                icon: 'warning',
                label: 'Load:',
                value: '0%',
                hidden: true
            });
        }
        
        // 알람 표시 (초기 숨김)
        if (this.config.showAlarms) {
            this.addItem('alarm', {
                group: 'right',
                type: STATUS_TYPES.ALARM,
                icon: 'error',
                value: 'No Alarms',
                hidden: true
            });
        }
        
        // 타임스탬프
        if (this.config.showTimestamp) {
            this.addItem('time', {
                group: 'right',
                type: STATUS_TYPES.NORMAL,
                value: this._getCurrentTime(),
                className: 'cleanroom-status-time'
            });
            
            // 1초마다 업데이트
            setInterval(() => {
                this.updateItem('time', { value: this._getCurrentTime() });
            }, 1000);
        }
    }
    
    /**
     * 현재 시간 반환
     * @private
     * @returns {string}
     */
    _getCurrentTime() {
        return new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    /**
     * 상태 아이템 추가
     * @param {string} id - 아이템 ID
     * @param {Object} config - 아이템 설정
     */
    addItem(id, config) {
        const item = document.createElement('div');
        item.className = `cleanroom-status-item ${config.type || STATUS_TYPES.NORMAL}`;
        item.id = `status-${id}`;
        
        if (config.className) {
            item.classList.add(config.className);
        }
        
        if (config.hidden) {
            item.classList.add('hidden');
        }
        
        // 아이콘
        if (config.icon) {
            const iconWrapper = document.createElement('span');
            iconWrapper.className = 'cleanroom-status-icon';
            
            if (config.icon === 'dot') {
                const dot = document.createElement('span');
                dot.className = 'cleanroom-status-dot';
                iconWrapper.appendChild(dot);
            } else {
                const iconSvg = iconRegistry.createIcon(config.icon, {
                    size: 14,
                    strokeWidth: 2
                });
                iconWrapper.appendChild(iconSvg);
            }
            
            item.appendChild(iconWrapper);
        }
        
        // 라벨
        if (config.label) {
            const label = document.createElement('span');
            label.className = 'cleanroom-status-label';
            label.textContent = config.label;
            item.appendChild(label);
        }
        
        // 값
        const value = document.createElement('span');
        value.className = 'cleanroom-status-value';
        value.textContent = config.value || '';
        item.appendChild(value);
        
        // 그룹에 추가
        const targetGroup = config.group === 'right' ? this.rightGroup : this.leftGroup;
        targetGroup.appendChild(item);
        
        this.statusItems.set(id, {
            element: item,
            config: config
        });
    }
    
    /**
     * 상태 아이템 업데이트
     * @param {string} id - 아이템 ID
     * @param {Object} updates - 업데이트 내용
     */
    updateItem(id, updates) {
        const item = this.statusItems.get(id);
        if (!item) return;
        
        const { element, config } = item;
        
        // 값 업데이트
        if (updates.value !== undefined) {
            const valueEl = element.querySelector('.cleanroom-status-value');
            if (valueEl) {
                valueEl.textContent = updates.value;
            }
        }
        
        // 타입 업데이트
        if (updates.type) {
            element.classList.remove('normal', 'success', 'warning', 'alarm', 'error');
            element.classList.add(updates.type);
            config.type = updates.type;
        }
        
        // 표시/숨김
        if (updates.hidden !== undefined) {
            element.classList.toggle('hidden', updates.hidden);
            config.hidden = updates.hidden;
        }
        
        // Dot 상태 업데이트
        if (updates.dotStatus) {
            const dot = element.querySelector('.cleanroom-status-dot');
            if (dot) {
                dot.classList.remove('connected', 'disconnected', 'pulse');
                dot.classList.add(updates.dotStatus);
            }
        }
    }
    
    /**
     * 서버 연결 상태 설정
     * @param {boolean} connected - 연결 여부
     * @param {string} serverName - 서버 이름
     */
    setServerStatus(connected, serverName = '') {
        this.updateItem('server', {
            type: connected ? STATUS_TYPES.SUCCESS : STATUS_TYPES.NORMAL,
            value: connected ? `Connected (${serverName})` : 'Disconnected',
            dotStatus: connected ? 'connected' : 'disconnected'
        });
    }
    
    /**
     * 사용자 정보 설정
     * @param {string} username
     */
    setUserInfo(username) {
        this.updateItem('user', {
            value: username
        });
    }
    
    /**
     * 로드 표시기 설정
     * @param {number} percentage - 로드 비율 (0-100)
     */
    setLoadIndicator(percentage) {
        const show = percentage > 50;
        const type = percentage >= 85 ? STATUS_TYPES.ALARM 
            : percentage >= 70 ? STATUS_TYPES.WARNING 
            : STATUS_TYPES.NORMAL;
        
        this.updateItem('load', {
            type: type,
            value: `${percentage}%`,
            hidden: !show
        });
    }
    
    /**
     * 알람 설정
     * @param {boolean} hasAlarm - 알람 존재 여부
     * @param {string} message - 알람 메시지
     */
    setAlarm(hasAlarm, message = 'No Alarms') {
        this.updateItem('alarm', {
            value: message,
            hidden: !hasAlarm
        });
    }
    
    /**
     * 커스텀 상태 추가
     * @param {string} id
     * @param {Object} config
     */
    addCustomStatus(id, config) {
        this.addItem(id, config);
    }
    
    /**
     * 상태 아이템 제거
     * @param {string} id
     */
    removeItem(id) {
        const item = this.statusItems.get(id);
        if (item) {
            item.element.remove();
            this.statusItems.delete(id);
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.statusItems.clear();
    }
}

export default StatusBar;
