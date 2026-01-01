/**
 * LayoutFileManager.js
 * Layout 파일의 생명주기를 관리하는 핵심 클래스
 * 
 * 파일 위치: threejs_viewer/src/services/layout/LayoutFileManager.js
 * 
 * @version 1.1.0 - Phase 3.3: 백업 및 버전 관리 통합
 * 
 * 주요 기능:
 * 1. checkLayout(siteId): 파일 존재 여부 확인
 * 2. loadLayout(siteId): Layout 파일 로드
 * 3. saveLayout(siteId, layoutData, options): Layout 파일 저장 (✨ 확장)
 * 4. loadTemplate(templateName): Template 로드
 * 
 * ✨ v1.1.0 신규 기능:
 * - 저장 전 자동 백업
 * - 버전 관리 통합
 * - Auto-save 파일 삭제
 * - Change Log 메타데이터
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
            
            // ✨ v1.1.0: 버전 관리 설정
            this.maxBackups = 5;
            this.enableAutoBackup = true;
            
            console.log('[LayoutFileManager] ✅ Instance created v1.1.0');
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
                    console.log(`[LayoutFileManager] Version: ${layoutData.layout_version || layoutData.version || 'N/A'}`);
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
         * ✨ v1.1.0: 3. saveLayout(siteId, layoutData, options): Layout 파일 저장 (확장)
         * @param {string} siteId - Site ID
         * @param {Object} layoutData - Layout 객체
         * @param {Object} options - 저장 옵션 (✨ NEW)
         * @param {boolean} options.createBackup - 백업 생성 여부 (기본: true)
         * @param {boolean} options.deleteAutoSave - Auto-save 삭제 여부 (기본: true)
         * @param {Object} options.previousLayout - 이전 Layout (백업용)
         * @returns {Promise<Object>} - 저장 결과 { success, filename, backupFilename, version }
         */
        async saveLayout(siteId, layoutData, options = {}) {
            const {
                createBackup = this.enableAutoBackup,
                deleteAutoSave = true,
                previousLayout = null
            } = options;
            
            const result = {
                success: false,
                filename: `${siteId}.json`,
                backupFilename: null,
                version: layoutData.layout_version || 1,
                timestamp: new Date().toISOString()
            };
            
            try {
                console.log(`[LayoutFileManager] 💾 Saving layout: ${siteId}`);
                console.log(`[LayoutFileManager] Options:`, { createBackup, deleteAutoSave });
                
                // =====================================================
                // ✨ v1.1.0: 백업 생성 (기존 파일이 있는 경우)
                // =====================================================
                if (createBackup && previousLayout) {
                    const backupResult = await this.createBackup(siteId, previousLayout);
                    if (backupResult.success) {
                        result.backupFilename = backupResult.filename;
                        console.log(`[LayoutFileManager] 📦 Backup created: ${backupResult.filename}`);
                    }
                } else if (createBackup && layoutData.layout_version > 1) {
                    // 이전 Layout이 없지만 버전이 1보다 크면, 현재 저장 전에 기존 파일 백업 시도
                    console.log(`[LayoutFileManager] ⚠️ No previous layout for backup, version: ${layoutData.layout_version}`);
                }
                
                // =====================================================
                // 메타데이터 추가
                // =====================================================
                const dataToSave = {
                    ...layoutData,
                    site_id: siteId,
                    updated_at: new Date().toISOString(),
                    // 버전은 layoutData에서 이미 관리됨 (LayoutSerializer에서 설정)
                };
                
                // created_at이 없으면 추가
                if (!dataToSave.created_at) {
                    dataToSave.created_at = dataToSave.updated_at;
                }
                
                // =====================================================
                // JSON 직렬화 및 다운로드 트리거
                // =====================================================
                const jsonString = JSON.stringify(dataToSave, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                
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
                console.log(`[LayoutFileManager] Version: ${dataToSave.layout_version || 1}`);
                console.log(`[LayoutFileManager] Size: ${(blob.size / 1024).toFixed(2)} KB`);
                
                // =====================================================
                // ✨ v1.1.0: Auto-save 파일 삭제 알림
                // =====================================================
                if (deleteAutoSave) {
                    this.notifyAutoSaveDelete(siteId);
                }
                
                // =====================================================
                // ✨ v1.1.0: 백업 목록 업데이트 (LocalStorage)
                // =====================================================
                if (result.backupFilename) {
                    this.updateBackupList(siteId, {
                        filename: result.backupFilename,
                        timestamp: new Date(),
                        version: (layoutData.layout_version || 1) - 1
                    });
                }
                
                result.success = true;
                result.size = blob.size;
                
                console.log(`[LayoutFileManager] ✅ Save complete:`, result);
                return result;
                
            } catch (error) {
                console.error(`[LayoutFileManager] ❌ Error saving:`, error);
                result.error = error.message;
                return result;
            }
        }

        /**
         * ✨ v1.1.0: 백업 파일 생성
         * @param {string} siteId - Site ID
         * @param {Object} layoutData - 백업할 Layout 데이터
         * @returns {Object} 백업 결과
         */
        async createBackup(siteId, layoutData) {
            const result = {
                success: false,
                filename: null,
                timestamp: null
            };
            
            try {
                const timestamp = new Date();
                const dateStr = timestamp.toISOString()
                    .replace(/:/g, '-')
                    .replace(/\.\d{3}Z$/, '');
                
                const backupFilename = `${siteId}.backup_${dateStr}.json`;
                
                // 백업 메타데이터 추가
                const backupData = {
                    ...layoutData,
                    _backup_info: {
                        original_site_id: siteId,
                        backup_timestamp: timestamp.toISOString(),
                        is_backup: true
                    }
                };
                
                // JSON 직렬화
                const jsonString = JSON.stringify(backupData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                
                // 다운로드 트리거
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = backupFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                result.success = true;
                result.filename = backupFilename;
                result.timestamp = timestamp;
                result.size = blob.size;
                
                console.log(`[LayoutFileManager] 📦 Backup created: ${backupFilename}`);
                
            } catch (error) {
                console.error(`[LayoutFileManager] ❌ Error creating backup:`, error);
                result.error = error.message;
            }
            
            return result;
        }

        /**
         * ✨ v1.1.0: Auto-save 삭제 알림
         * @param {string} siteId - Site ID
         */
        notifyAutoSaveDelete(siteId) {
            const autoSaveFilename = `${siteId}${this.autoSaveSuffix}.json`;
            console.log(`[LayoutFileManager] 🗑️ Auto-save can be deleted: ${autoSaveFilename}`);
            
            // LocalStorage에서 auto-save 플래그 제거
            try {
                localStorage.removeItem(`autosave_${siteId}`);
                console.log(`[LayoutFileManager] Auto-save flag removed from localStorage`);
            } catch (error) {
                // LocalStorage 접근 실패 시 무시
            }
        }

        /**
         * ✨ v1.1.0: 백업 목록 업데이트 (LocalStorage)
         * @param {string} siteId - Site ID
         * @param {Object} backupInfo - 백업 정보
         */
        updateBackupList(siteId, backupInfo) {
            try {
                const storageKey = `backup_list_${siteId}`;
                let backups = [];
                
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    backups = JSON.parse(stored);
                }
                
                // 새 백업 추가
                backups.unshift({
                    filename: backupInfo.filename,
                    timestamp: backupInfo.timestamp.toISOString(),
                    version: backupInfo.version
                });
                
                // 최대 개수 유지
                if (backups.length > this.maxBackups) {
                    backups = backups.slice(0, this.maxBackups);
                }
                
                localStorage.setItem(storageKey, JSON.stringify(backups));
                console.log(`[LayoutFileManager] Backup list updated: ${backups.length} backups`);
                
            } catch (error) {
                console.error(`[LayoutFileManager] Error updating backup list:`, error);
            }
        }

        /**
         * ✨ v1.1.0: 백업 목록 조회
         * @param {string} siteId - Site ID
         * @returns {Array} 백업 목록
         */
        getBackupList(siteId) {
            try {
                const storageKey = `backup_list_${siteId}`;
                const stored = localStorage.getItem(storageKey);
                
                if (!stored) return [];
                
                return JSON.parse(stored);
                
            } catch (error) {
                console.error(`[LayoutFileManager] Error getting backup list:`, error);
                return [];
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
                
                // .json 확장자 처리
                const filename = templateName.endsWith('.json') 
                    ? templateName 
                    : `${templateName}.json`;
                
                const filePath = `${this.templatePath}${filename}`;
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
                const requiredFields = ['site_id', 'room', 'equipmentArrays'];
                
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

        /**
         * ✨ v1.1.0: 디버그 정보 출력
         */
        debug() {
            console.log('[LayoutFileManager] Debug Info:', {
                basePath: this.basePath,
                templatePath: this.templatePath,
                backupSuffix: this.backupSuffix,
                autoSaveSuffix: this.autoSaveSuffix,
                maxBackups: this.maxBackups,
                enableAutoBackup: this.enableAutoBackup
            });
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