/**
 * EquipmentEditStateExtension.js
 * EquipmentEditState에 서버 저장 기능 추가
 * 
 * 기존 EquipmentEditState.js의 toServerFormat()을 활용하여
 * 새로운 Mapping V2 API로 저장하는 기능
 * 
 * @version 1.0.0
 */

import { debugLog } from '../core/utils/Config.js';

/**
 * EquipmentEditState에 서버 저장 기능 확장
 * 기존 인스턴스에 메서드 추가
 * 
 * @param {EquipmentEditState} editState - 기존 인스턴스
 * @param {Object} options - 옵션
 */
export function extendWithServerSave(editState, options = {}) {
    const apiBaseUrl = options.apiBaseUrl || detectApiBaseUrl();
    
    /**
     * 현재 연결된 Site ID 가져오기
     * Connection Manager에서 연결 상태 조회
     * 
     * @returns {Promise<string|null>}
     */
    editState.getCurrentSiteId = async function() {
        try {
            const response = await fetch(`${apiBaseUrl}/api/connections/connection-status`);
            if (!response.ok) return null;
            
            const statusList = await response.json();
            
            // 연결된 첫 번째 사이트 찾기
            const connected = statusList.find(s => s.status === 'connected');
            return connected ? connected.site_id : null;
            
        } catch (error) {
            console.error('Failed to get current site:', error);
            return null;
        }
    };
    
    /**
     * 🆕 현재 매핑을 서버에 저장
     * Dev Mode > Equipment Mapping Mode에서 호출
     * 
     * @param {Object} options - 저장 옵션
     * @param {string} options.siteId - Site ID (없으면 현재 연결된 사이트)
     * @param {string} options.createdBy - 작성자
     * @param {string} options.description - 설명
     * @returns {Promise<Object>} 저장 결과
     */
    editState.saveToServer = async function(options = {}) {
        try {
            // 1. Site ID 결정
            let siteId = options.siteId;
            
            if (!siteId) {
                siteId = await this.getCurrentSiteId();
            }
            
            if (!siteId) {
                throw new Error('No site connected. Please connect to a database first.');
            }
            
            debugLog(`💾 Saving mappings to server: ${siteId}`);
            
            // 2. 현재 매핑 데이터 가져오기 (기존 toServerFormat 활용!)
            const mappingsArray = this.toServerFormat();
            
            if (mappingsArray.length === 0) {
                throw new Error('No mappings to save. Please map some equipment first.');
            }
            
            // 3. API 호출
            const response = await fetch(`${apiBaseUrl}/api/mapping/config/${siteId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mappings: mappingsArray,
                    created_by: options.createdBy || 'admin',
                    description: options.description || `${siteId} equipment mapping`
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            debugLog(`✅ Saved ${result.total} mappings to ${siteId}`);
            
            // 4. 이벤트 발행
            this.dispatchEvent('mappings-saved-to-server', {
                siteId,
                count: result.total,
                updatedAt: result.updated_at
            });
            
            return {
                success: true,
                siteId,
                count: result.total,
                message: result.message,
                updatedAt: result.updated_at
            };
            
        } catch (error) {
            console.error('❌ Failed to save to server:', error);
            
            this.dispatchEvent('save-to-server-error', {
                error: error.message
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    };
    
    /**
     * 🆕 서버에서 매핑 로드 (V2 API 사용)
     * 
     * @param {string} siteId - Site ID (없으면 현재 연결된 사이트)
     * @returns {Promise<Object>}
     */
    editState.loadFromServerV2 = async function(siteId = null) {
        try {
            // Site ID 결정
            if (!siteId) {
                siteId = await this.getCurrentSiteId();
            }
            
            if (!siteId) {
                // 현재 연결된 사이트 자동 감지
                const response = await fetch(`${apiBaseUrl}/api/mapping/current`);
                const data = await response.json();
                
                if (!data.connected) {
                    throw new Error('No site connected');
                }
                
                siteId = data.site_id;
            }
            
            debugLog(`📡 Loading mappings from server: ${siteId}`);
            
            // API 호출
            const response = await fetch(`${apiBaseUrl}/api/mapping/config/${siteId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const config = await response.json();
            
            // mappings 변환 및 적용
            const serverMappings = {};
            for (const [frontendId, item] of Object.entries(config.mappings || {})) {
                serverMappings[frontendId] = {
                    frontend_id: frontendId,
                    equipment_id: item.equipment_id,
                    equipment_name: item.equipment_name,
                    equipment_code: item.equipment_code,
                    line_name: item.line_name
                };
            }
            
            // 기존 loadFromServer 메서드 활용
            this.loadFromServer(serverMappings, 'replace');
            
            debugLog(`✅ Loaded ${Object.keys(serverMappings).length} mappings from ${siteId}`);
            
            return {
                success: true,
                siteId,
                count: Object.keys(serverMappings).length,
                displayName: config.display_name
            };
            
        } catch (error) {
            console.error('❌ Failed to load from server:', error);
            return {
                success: false,
                error: error.message
            };
        }
    };
    
    debugLog('🔧 EquipmentEditState extended with server save capability');
}


/**
 * API Base URL 자동 감지
 */
function detectApiBaseUrl() {
    const hostname = window.location.hostname;
    const port = 8000;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://localhost:${port}`;
    }
    
    return `http://${hostname}:${port}`;
}


/**
 * 🆕 서버 저장 버튼 UI 추가
 * Equipment Mapping Mode 툴바에 버튼 추가
 * 
 * @param {EquipmentEditState} editState - EditState 인스턴스
 * @param {HTMLElement} container - 버튼을 추가할 컨테이너
 */
export function addServerSaveButton(editState, container) {
    // 버튼 생성
    const saveBtn = document.createElement('button');
    saveBtn.id = 'btn-save-mapping-to-server';
    saveBtn.className = 'mapping-toolbar-btn';
    saveBtn.innerHTML = `
        <span style="margin-right: 6px;">☁️</span>
        서버에 저장
    `;
    saveBtn.title = '현재 매핑을 서버에 저장 (모든 사용자 공유)';
    saveBtn.style.cssText = `
        padding: 8px 16px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        transition: all 0.2s;
    `;
    
    // 호버 효과
    saveBtn.addEventListener('mouseenter', () => {
        saveBtn.style.transform = 'translateY(-2px)';
        saveBtn.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
    });
    
    saveBtn.addEventListener('mouseleave', () => {
        saveBtn.style.transform = 'translateY(0)';
        saveBtn.style.boxShadow = 'none';
    });
    
    // 클릭 이벤트
    saveBtn.addEventListener('click', async () => {
        const count = editState.getMappingCount();
        
        if (count === 0) {
            alert('저장할 매핑이 없습니다. 먼저 설비를 매핑해주세요.');
            return;
        }
        
        const confirmMsg = `${count}개의 매핑을 서버에 저장하시겠습니까?\n\n` +
                          `저장 후 모든 사용자가 동일한 매핑을 사용합니다.`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        // 버튼 상태 변경
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span>⏳</span> 저장 중...`;
        
        try {
            const result = await editState.saveToServer();
            
            if (result.success) {
                alert(`✅ 저장 완료!\n\n` +
                      `Site: ${result.siteId}\n` +
                      `매핑 수: ${result.count}개`);
            } else {
                alert(`❌ 저장 실패\n\n${result.error}`);
            }
            
        } catch (error) {
            alert(`❌ 오류 발생\n\n${error.message}`);
        } finally {
            // 버튼 복원
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<span style="margin-right: 6px;">☁️</span>서버에 저장`;
        }
    });
    
    // 컨테이너에 추가
    if (container) {
        container.appendChild(saveBtn);
    }
    
    return saveBtn;
}


/**
 * 🆕 서버에서 로드 버튼 UI 추가
 */
export function addServerLoadButton(editState, container) {
    const loadBtn = document.createElement('button');
    loadBtn.id = 'btn-load-mapping-from-server';
    loadBtn.className = 'mapping-toolbar-btn';
    loadBtn.innerHTML = `
        <span style="margin-right: 6px;">📥</span>
        서버에서 로드
    `;
    loadBtn.title = '서버에서 매핑 불러오기';
    loadBtn.style.cssText = `
        padding: 8px 16px;
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        margin-left: 8px;
        transition: all 0.2s;
    `;
    
    loadBtn.addEventListener('click', async () => {
        if (editState.getMappingCount() > 0) {
            if (!confirm('현재 매핑을 덮어씁니다. 계속하시겠습니까?')) {
                return;
            }
        }
        
        loadBtn.disabled = true;
        loadBtn.innerHTML = `<span>⏳</span> 로드 중...`;
        
        try {
            const result = await editState.loadFromServerV2();
            
            if (result.success) {
                alert(`✅ 로드 완료!\n\n` +
                      `Site: ${result.displayName || result.siteId}\n` +
                      `매핑 수: ${result.count}개`);
            } else {
                alert(`❌ 로드 실패\n\n${result.error}`);
            }
        } finally {
            loadBtn.disabled = false;
            loadBtn.innerHTML = `<span style="margin-right: 6px;">📥</span>서버에서 로드`;
        }
    });
    
    if (container) {
        container.appendChild(loadBtn);
    }
    
    return loadBtn;
}


export default {
    extendWithServerSave,
    addServerSaveButton,
    addServerLoadButton
};