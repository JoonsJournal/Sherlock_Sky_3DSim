/**
 * LayoutFileManager.js
 * Layout 파일의 생명주기를 관리하는 핵심 클래스
 * 
 * 파일 위치: threejs_viewer/src/services/layout/LayoutFileManager.js
 * 
 * 주요 기능:
 * 1. checkLayout(siteId): 파일 존재 여부 확인
 * 2. loadLayout(siteId): Layout 파일 로드
 * 3. saveLayout(siteId, layoutData): Layout 파일 저장
 * 4. loadTemplate(templateName): Template 로드
 * 
 * 웹 서버 루트: threejs_viewer/public/
 * Layout 파일 위치: /public/layouts/*.json
 * Template 위치: /public/layouts/templates/*.json
 */

(function() {
    'use strict';
    
    class LayoutFileManager {
        constructor() {
            // public/ 디렉토리가 웹 루트이므로 /layouts/로 접근
            this.basePath = '/layouts/';
            this.templatePath = '/layouts/templates/';
            this.backupSuffix = '.backup';
            this.autoSaveSuffix = '.autosave';
            
            console.log('[LayoutFileManager] ✅ Instance created');
            console.log('[LayoutFileManager] Base path:', this.basePath);
            console.log('[LayoutFileManager] Template path:', this.templatePath);
        }

        /**
         * 1. checkLayout(siteId): 파일 존재 여부 확인
         * @param {string} siteId - Site ID (예: "korea_site1_line1")
         * @returns {Promise<boolean>} - 파일 존재 여부
         */
        async checkLayout(siteId) {
            try {
                console.log(`[LayoutFileManager] 🔍 Checking layout: ${siteId}`);
                
                const filePath = `${this.basePath}${siteId}.json`;
                console.log(`[LayoutFileManager] Full path: ${filePath}`);
                
                const response = await fetch(filePath);
                
                if (response.ok) {
                    console.log(`[LayoutFileManager] ✅ Layout exists: ${filePath}`);
                    console.log(`[LayoutFileManager] Response status: ${response.status}`);
                    return true;
                } else {
                    console.log(`[LayoutFileManager] ❌ Layout not found: ${filePath}`);
                    console.log(`[LayoutFileManager] Response status: ${response.status}`);
                    return false;
                }
            } catch (error) {
                console.error(`[LayoutFileManager] ❌ Error checking layout:`, error);
                return false;
            }
        }

        /**
         * 2. loadLayout(siteId): Layout 파일 로드
         * @param {string} siteId - Site ID
         * @returns {Promise<Object|null>} - Layout JSON 객체 또는 null
         */
        async loadLayout(siteId) {
            try {
                console.log(`[LayoutFileManager] 📂 Loading layout: ${siteId}`);
                
                // 메인 파일 시도
                const mainPath = `${this.basePath}${siteId}.json`;
                console.log(`[LayoutFileManager] Trying main path: ${mainPath}`);
                
                let response = await fetch(mainPath);
                
                if (response.ok) {
                    const layoutData = await response.json();
                    console.log(`[LayoutFileManager] ✅ Layout loaded from: ${mainPath}`);
                    console.log(`[LayoutFileManager] Version: ${layoutData.version || 'N/A'}`);
                    console.log(`[LayoutFileManager] Equipment arrays: ${layoutData.equipmentArrays?.length || 0}`);
                    return layoutData;
                }
                
                // 백업 파일 시도
                console.log(`[LayoutFileManager] Main file failed, trying backup...`);
                const backupPath = `${this.basePath}${siteId}${this.backupSuffix}.json`;
                console.log(`[LayoutFileManager] Trying backup path: ${backupPath}`);
                
                response = await fetch(backupPath);
                
                if (response.ok) {
                    const layoutData = await response.json();
                    console.log(`[LayoutFileManager] ⚠️ Layout loaded from backup: ${backupPath}`);
                    console.warn(`[LayoutFileManager] Consider restoring from backup`);
                    return layoutData;
                }
                
                // 모두 실패
                console.error(`[LayoutFileManager] ❌ Failed to load: ${siteId}`);
                console.error(`[LayoutFileManager] Tried: ${mainPath}, ${backupPath}`);
                return null;
                
            } catch (error) {
                console.error(`[LayoutFileManager] ❌ Error loading layout:`, error);
                console.error(`[LayoutFileManager] Site ID: ${siteId}`);
                return null;
            }
        }

        /**
         * 3. saveLayout(siteId, layoutData): Layout 파일 저장
         * @param {string} siteId - Site ID
         * @param {Object} layoutData - Layout 객체
         * @returns {Promise<boolean>} - 성공 여부
         */
        async saveLayout(siteId, layoutData) {
            try {
                console.log(`[LayoutFileManager] 💾 Saving layout: ${siteId}`);
                
                // 메타데이터 추가
                const dataToSave = {
                    ...layoutData,
                    site_id: siteId,
                    last_modified: new Date().toISOString(),
                    version: (layoutData.version || 0) + 1
                };
                
                // JSON 직렬화
                const jsonString = JSON.stringify(dataToSave, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                
                // 다운로드 트리거
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${siteId}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`[LayoutFileManager] ✅ Download triggered: ${siteId}.json`);
                console.log(`[LayoutFileManager] 📁 Save to: threejs_viewer/public/layouts/`);
                console.log(`[LayoutFileManager] Version: ${dataToSave.version}`);
                console.log(`[LayoutFileManager] Size: ${(blob.size / 1024).toFixed(2)} KB`);
                
                return true;
                
            } catch (error) {
                console.error(`[LayoutFileManager] ❌ Error saving:`, error);
                return false;
            }
        }

        /**
         * 4. loadTemplate(templateName): Template 로드
         * @param {string} templateName - Template 이름 (예: "standard_26x6")
         * @returns {Promise<Object|null>} - Template JSON 객체 또는 null
         */
        async loadTemplate(templateName) {
            try {
                console.log(`[LayoutFileManager] 📑 Loading template: ${templateName}`);
                
                const filePath = `${this.templatePath}${templateName}.json`;
                console.log(`[LayoutFileManager] Template path: ${filePath}`);
                
                const response = await fetch(filePath);
                
                if (!response.ok) {
                    console.error(`[LayoutFileManager] ❌ Template not found: ${filePath}`);
                    console.error(`[LayoutFileManager] Response status: ${response.status}`);
                    return null;
                }
                
                const templateData = await response.json();
                console.log(`[LayoutFileManager] ✅ Template loaded: ${templateName}`);
                console.log(`[LayoutFileManager] Name: ${templateData.template_name || 'N/A'}`);
                console.log(`[LayoutFileManager] Room: ${templateData.room?.width || '?'}m × ${templateData.room?.depth || '?'}m`);
                console.log(`[LayoutFileManager] Equipment arrays: ${templateData.equipmentArrays?.length || 0}`);
                
                return templateData;
                
            } catch (error) {
                console.error(`[LayoutFileManager] ❌ Error loading template:`, error);
                console.error(`[LayoutFileManager] Template name: ${templateName}`);
                return null;
            }
        }

        /**
         * 헬퍼: Auto-save 파일 확인
         */
        async checkAutoSave(siteId) {
            try {
                const filePath = `${this.basePath}${siteId}${this.autoSaveSuffix}.json`;
                const response = await fetch(filePath);
                return response.ok;
            } catch (error) {
                return false;
            }
        }

        /**
         * 헬퍼: Auto-save 파일 로드
         */
        async loadAutoSave(siteId) {
            try {
                console.log(`[LayoutFileManager] 💾 Loading auto-save: ${siteId}`);
                
                const filePath = `${this.basePath}${siteId}${this.autoSaveSuffix}.json`;
                const response = await fetch(filePath);
                
                if (!response.ok) {
                    return null;
                }
                
                const layoutData = await response.json();
                console.log(`[LayoutFileManager] ✅ Auto-save loaded: ${filePath}`);
                return layoutData;
                
            } catch (error) {
                console.error(`[LayoutFileManager] Error loading auto-save:`, error);
                return null;
            }
        }

        /**
         * 헬퍼: Templates 목록
         */
        async listTemplates() {
            const knownTemplates = [
                'standard_26x6',
                'compact_13x4',
                'default_template'
            ];
            
            console.log(`[LayoutFileManager] 📋 Available templates:`, knownTemplates);
            return knownTemplates;
        }

        /**
         * 헬퍼: Layout 검증
         */
        validateLayout(layoutData) {
            try {
                const requiredFields = ['version', 'site_id', 'room', 'equipmentArrays'];
                
                for (const field of requiredFields) {
                    if (!(field in layoutData)) {
                        console.error(`[LayoutFileManager] ❌ Missing field: ${field}`);
                        return false;
                    }
                }
                
                if (!layoutData.room.width || !layoutData.room.depth) {
                    console.error(`[LayoutFileManager] ❌ Invalid room dimensions`);
                    return false;
                }
                
                if (!Array.isArray(layoutData.equipmentArrays)) {
                    console.error(`[LayoutFileManager] ❌ equipmentArrays not array`);
                    return false;
                }
                
                console.log(`[LayoutFileManager] ✅ Validation passed`);
                return true;
                
            } catch (error) {
                console.error(`[LayoutFileManager] ❌ Validation error:`, error);
                return false;
            }
        }
    }

    // Export for modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LayoutFileManager;
    }

    // Global export for browser
    if (typeof window !== 'undefined') {
        window.LayoutFileManager = LayoutFileManager;
        console.log('[LayoutFileManager] ✅ Class loaded globally');
    }
    
})();