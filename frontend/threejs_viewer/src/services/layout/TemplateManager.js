/**
 * TemplateManager.js
 * Template 생명주기 관리 클래스
 * 
 * 파일 위치: frontend/threejs_viewer/src/services/layout/TemplateManager.js
 * 
 * @version 1.0.0 - Phase 3.4: Template Manager 구현
 * 
 * 주요 기능:
 * 1. saveAsTemplate(layoutData, templateName, description) - 현재 Layout을 Template으로 저장
 * 2. getCustomTemplateList() - 사용자 생성 Template 목록 조회
 * 3. getAllTemplates() - 기본 + 커스텀 통합 목록
 * 4. deleteCustomTemplate(templateName) - 커스텀 Template 삭제
 * 5. validateTemplateName(name) - 이름 유효성 검사
 * 
 * 저장 위치: /public/layouts/templates/
 * 메타데이터 저장: localStorage
 */

(function() {
    'use strict';

    class TemplateManager {
        constructor() {
            // 경로 설정
            this.templatePath = '/layouts/templates/';
            
            // LocalStorage 키
            this.STORAGE_KEY = 'custom_templates';
            
            // 기본 Template 목록 (수정 불가)
            this.defaultTemplates = [
                {
                    id: 'standard_26x6',
                    name: 'Standard 26×6 Layout',
                    description: '26행 × 6열, 복도 포함, Office 공간 (권장)',
                    filename: 'standard_26x6.json',
                    isDefault: true,
                    createdAt: null
                },
                {
                    id: 'compact_13x4',
                    name: 'Compact 13×4 Layout',
                    description: '13행 × 4열, 소형 공장용',
                    filename: 'compact_13x4.json',
                    isDefault: true,
                    createdAt: null
                },
                {
                    id: 'default',
                    name: '기본 Template',
                    description: '최소 구성',
                    filename: 'default_template.json',
                    isDefault: true,
                    createdAt: null
                }
            ];
            
            // 이름 유효성 검사 규칙
            this.nameRules = {
                minLength: 2,
                maxLength: 50,
                invalidChars: /[<>:"\/\\|?*\x00-\x1f]/g,  // 파일명에 사용 불가한 문자
                reservedNames: ['default', 'standard_26x6', 'compact_13x4', 'template', 'backup']
            };
            
            console.log('[TemplateManager] ✅ Instance created v1.0.0');
        }

        /**
         * 1. 현재 Layout을 Template으로 저장
         * @param {Object} layoutData - Layout 데이터
         * @param {string} templateName - Template 이름
         * @param {string} description - Template 설명
         * @param {Object} options - 추가 옵션
         * @returns {Promise<Object>} 저장 결과
         */
        async saveAsTemplate(layoutData, templateName, description = '', options = {}) {
            const result = {
                success: false,
                filename: null,
                templateId: null,
                error: null
            };
            
            try {
                console.log('[TemplateManager] 📋 Saving as template:', templateName);
                
                // 1. 이름 유효성 검사
                const validation = this.validateTemplateName(templateName);
                if (!validation.valid) {
                    throw new Error(validation.message);
                }
                
                // 2. 중복 확인
                const exists = this.checkTemplateExists(templateName);
                if (exists && !options.overwrite) {
                    throw new Error(`Template "${templateName}" already exists. Use overwrite option to replace.`);
                }
                
                // 3. Template ID 생성 (소문자, 공백→언더스코어)
                const templateId = this.generateTemplateId(templateName);
                const filename = `${templateId}.json`;
                
                // 4. Template 메타데이터 생성
                const templateData = this.createTemplateData(layoutData, {
                    templateName: templateName,
                    templateId: templateId,
                    description: description,
                    basedOn: layoutData.template_source || layoutData.site_id || 'custom',
                    createdBy: options.createdBy || 'user'
                });
                
                // 5. 파일 저장 (다운로드 트리거)
                const saveResult = await this.saveTemplateFile(templateId, templateData);
                
                if (!saveResult.success) {
                    throw new Error(saveResult.error || 'Failed to save template file');
                }
                
                // 6. 커스텀 Template 목록에 추가
                this.addToCustomList({
                    id: templateId,
                    name: templateName,
                    description: description,
                    filename: filename,
                    isDefault: false,
                    createdAt: new Date().toISOString(),
                    basedOn: templateData.based_on,
                    equipmentCount: templateData.statistics?.totalEquipment || 0
                });
                
                result.success = true;
                result.filename = filename;
                result.templateId = templateId;
                result.templateData = templateData;
                
                console.log('[TemplateManager] ✅ Template saved:', result);
                
            } catch (error) {
                console.error('[TemplateManager] ❌ Error saving template:', error);
                result.error = error.message;
            }
            
            return result;
        }

        /**
         * Template 메타데이터 생성
         * @private
         */
        createTemplateData(layoutData, meta) {
            const now = new Date().toISOString();
            
            // 기존 Layout 데이터 복사 후 Template 메타데이터 추가
            const templateData = {
                // 버전 정보
                version: '1.0',
                layout_version: 1,
                
                // Template 메타데이터
                template_name: meta.templateName,
                template_id: meta.templateId,
                description: meta.description,
                based_on: meta.basedOn,
                created_by: meta.createdBy,
                created_at: now,
                updated_at: now,
                
                // Site ID는 'template'으로 설정 (실제 Site에 적용 시 변경됨)
                site_id: 'template',
                is_template: true,
                
                // Layout 데이터 복사 (site_id 관련 필드 제외)
                canvas: layoutData.canvas,
                room: layoutData.room,
                walls: layoutData.walls || [],
                office: layoutData.office,
                partitions: layoutData.partitions || [],
                equipmentArrays: layoutData.equipmentArrays || [],
                
                // 통계
                statistics: layoutData.statistics || this.calculateStatistics(layoutData),
                
                // Change Log 초기화
                change_log: [{
                    version: 1,
                    timestamp: now,
                    changes: `Template created from "${meta.basedOn}"`
                }]
            };
            
            return templateData;
        }

        /**
         * Template 파일 저장 (다운로드 트리거)
         * @private
         */
        async saveTemplateFile(templateId, templateData) {
            const result = {
                success: false,
                filename: null,
                size: 0
            };
            
            try {
                const filename = `${templateId}.json`;
                const jsonString = JSON.stringify(templateData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                
                // 다운로드 트리거
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                result.success = true;
                result.filename = filename;
                result.size = blob.size;
                
                console.log(`[TemplateManager] 💾 Template file download triggered: ${filename}`);
                console.log(`[TemplateManager] 📁 Save to: public/layouts/templates/`);
                console.log(`[TemplateManager] Size: ${(blob.size / 1024).toFixed(2)} KB`);
                
            } catch (error) {
                console.error('[TemplateManager] Error saving template file:', error);
                result.error = error.message;
            }
            
            return result;
        }

        /**
         * 2. 사용자 생성 Template 목록 조회
         * @returns {Array} 커스텀 Template 목록
         */
        getCustomTemplateList() {
            try {
                const stored = localStorage.getItem(this.STORAGE_KEY);
                if (!stored) return [];
                
                const list = JSON.parse(stored);
                console.log(`[TemplateManager] Custom templates: ${list.length}`);
                return list;
                
            } catch (error) {
                console.error('[TemplateManager] Error getting custom list:', error);
                return [];
            }
        }

        /**
         * 3. 기본 + 커스텀 통합 목록
         * @returns {Array} 전체 Template 목록
         */
        getAllTemplates() {
            const customTemplates = this.getCustomTemplateList();
            const allTemplates = [
                ...this.defaultTemplates,
                ...customTemplates
            ];
            
            console.log(`[TemplateManager] All templates: ${allTemplates.length} (default: ${this.defaultTemplates.length}, custom: ${customTemplates.length})`);
            return allTemplates;
        }

        /**
         * 4. 커스텀 Template 삭제
         * @param {string} templateId - Template ID
         * @returns {boolean} 삭제 성공 여부
         */
        deleteCustomTemplate(templateId) {
            try {
                // 기본 Template은 삭제 불가
                const isDefault = this.defaultTemplates.some(t => t.id === templateId);
                if (isDefault) {
                    console.warn('[TemplateManager] Cannot delete default template:', templateId);
                    return false;
                }
                
                const customList = this.getCustomTemplateList();
                const filtered = customList.filter(t => t.id !== templateId);
                
                if (filtered.length === customList.length) {
                    console.warn('[TemplateManager] Template not found:', templateId);
                    return false;
                }
                
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
                console.log('[TemplateManager] Template deleted:', templateId);
                
                return true;
                
            } catch (error) {
                console.error('[TemplateManager] Error deleting template:', error);
                return false;
            }
        }

        /**
         * 5. 이름 유효성 검사
         * @param {string} name - Template 이름
         * @returns {Object} { valid: boolean, message: string }
         */
        validateTemplateName(name) {
            // 빈 문자열 체크
            if (!name || typeof name !== 'string') {
                return { valid: false, message: 'Template name is required' };
            }
            
            const trimmed = name.trim();
            
            // 길이 체크
            if (trimmed.length < this.nameRules.minLength) {
                return { 
                    valid: false, 
                    message: `Template name must be at least ${this.nameRules.minLength} characters` 
                };
            }
            
            if (trimmed.length > this.nameRules.maxLength) {
                return { 
                    valid: false, 
                    message: `Template name must be ${this.nameRules.maxLength} characters or less` 
                };
            }
            
            // 특수문자 체크
            if (this.nameRules.invalidChars.test(trimmed)) {
                return { 
                    valid: false, 
                    message: 'Template name contains invalid characters' 
                };
            }
            
            // 예약어 체크
            const lowered = trimmed.toLowerCase();
            if (this.nameRules.reservedNames.includes(lowered)) {
                return { 
                    valid: false, 
                    message: `"${trimmed}" is a reserved name` 
                };
            }
            
            return { valid: true, message: 'Valid' };
        }

        /**
         * Template ID 생성
         * @private
         */
        generateTemplateId(name) {
            return name
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '_')           // 공백 → 언더스코어
                .replace(/[^a-z0-9_]/g, '')     // 영문, 숫자, 언더스코어만
                .substring(0, 30);              // 최대 30자
        }

        /**
         * Template 존재 여부 확인
         * @private
         */
        checkTemplateExists(name) {
            const templateId = this.generateTemplateId(name);
            
            // 기본 Template 확인
            const isDefault = this.defaultTemplates.some(t => t.id === templateId);
            if (isDefault) return true;
            
            // 커스텀 Template 확인
            const customList = this.getCustomTemplateList();
            return customList.some(t => t.id === templateId);
        }

        /**
         * 커스텀 목록에 추가
         * @private
         */
        addToCustomList(templateInfo) {
            try {
                const customList = this.getCustomTemplateList();
                
                // 중복 제거 (덮어쓰기)
                const filtered = customList.filter(t => t.id !== templateInfo.id);
                filtered.unshift(templateInfo);  // 최신 항목을 앞에
                
                // 최대 50개 유지
                if (filtered.length > 50) {
                    filtered.splice(50);
                }
                
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
                console.log('[TemplateManager] Custom list updated:', filtered.length);
                
            } catch (error) {
                console.error('[TemplateManager] Error updating custom list:', error);
            }
        }

        /**
         * 통계 계산
         * @private
         */
        calculateStatistics(layoutData) {
            let totalEquipment = 0;
            
            if (layoutData.equipmentArrays) {
                layoutData.equipmentArrays.forEach(array => {
                    const rows = array.rows || 26;
                    const cols = array.cols || 6;
                    const excluded = array.excludedPositions?.length || 0;
                    totalEquipment += (rows * cols) - excluded;
                });
            }
            
            return {
                totalEquipment: totalEquipment,
                wallCount: layoutData.walls?.length || 0,
                hasOffice: !!(layoutData.office?.enabled)
            };
        }

        /**
         * Template 상세 정보 조회
         * @param {string} templateId - Template ID
         * @returns {Object|null} Template 정보
         */
        getTemplateInfo(templateId) {
            // 기본 Template 확인
            const defaultTemplate = this.defaultTemplates.find(t => t.id === templateId);
            if (defaultTemplate) return defaultTemplate;
            
            // 커스텀 Template 확인
            const customList = this.getCustomTemplateList();
            return customList.find(t => t.id === templateId) || null;
        }

        /**
         * 디버그 정보 출력
         */
        debug() {
            console.log('[TemplateManager] Debug Info:', {
                templatePath: this.templatePath,
                storageKey: this.STORAGE_KEY,
                defaultTemplates: this.defaultTemplates.length,
                customTemplates: this.getCustomTemplateList().length,
                nameRules: this.nameRules
            });
            
            console.log('[TemplateManager] All Templates:');
            this.getAllTemplates().forEach((t, i) => {
                console.log(`  ${i + 1}. ${t.name} (${t.id}) ${t.isDefault ? '[DEFAULT]' : '[CUSTOM]'}`);
            });
        }
    }

    // Singleton 인스턴스
    const templateManager = new TemplateManager();

    // Export for modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { TemplateManager, templateManager };
    }

    // Global export for browser
    if (typeof window !== 'undefined') {
        window.TemplateManager = TemplateManager;
        window.templateManager = templateManager;
        console.log('[TemplateManager] ✅ Class loaded globally');
    }

})();