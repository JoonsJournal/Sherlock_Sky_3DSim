/**
 * LayoutEditorMain.js
 * Layout Editor 시스템의 진입점이자 메인 컨트롤러
 * 
 * @version 1.4.0 - Phase 3.4: Template Manager 통합
 * 
 * 주요 역할:
 * 1. Site 선택 시 Layout 파일 존재 여부 확인
 * 2. 기존 Layout 로드 또는 Template 선택 분기
 * 3. Editor/Viewer 모드 전환 제어
 * 4. UI 컴포넌트 표시/숨김 관리
 * 5. ComponentPalette 초기화 및 관리 (Phase 2.6)
 * 6. Layout 저장 전 검증 (Phase 3.2)
 * 7. 저장 프로세스 통합 (Phase 3.3)
 * 8. ✨ Template 저장 기능 (Phase 3.4) - NEW
 * 
 * ✨ v1.4.0 신규 기능:
 * - TemplateDialog 통합
 * - saveAsTemplate() 메서드
 * - showSaveTemplateDialog() 메서드
 * - Template 목록 갱신 (커스텀 포함)
 */

// ES Module imports (환경에 따라 조정 필요)
// import { LayoutFileManager } from '../services/layout/LayoutFileManager.js';
// import { layoutEditorState } from '../stores/LayoutEditorState.js';
// import { ComponentPalette } from './components/ComponentPalette.js';
// import { LayoutValidator } from '../services/validation/index.js';
// import { ValidationErrorDialog } from '../components/dialogs/ValidationErrorDialog.js';
// import { SaveSuccessDialog } from '../components/dialogs/SaveSuccessDialog.js';
// import { BackupManager } from '../services/layout/BackupManager.js';
// import { TemplateDialog } from './components/TemplateDialog.js';
// import { templateManager } from '../services/layout/TemplateManager.js';

class LayoutEditorMain {
    constructor() {
        // 서비스 인스턴스
        this.fileManager = window.LayoutFileManager ? new window.LayoutFileManager() : null;
        this.state = window.layoutEditorState || null;
        this.validator = window.LayoutValidator ? new window.LayoutValidator() : null;
        
        // ✨ v1.3.0: 백업 매니저
        this.backupManager = window.backupManager || null;
        
        // ✨ v1.4.0: Template 매니저
        this.templateManager = window.templateManager || null;
        
        // UI 컴포넌트
        this.componentPalette = null;
        this.canvas2DEditor = null;
        this.propertyPanel = null;
        
        // ✨ v1.3.0: Dialogs
        this.validationErrorDialog = null;
        this.saveSuccessDialog = null;
        
        // ✨ v1.4.0: Template Dialog
        this.templateDialog = null;
        
        // UI 요소 참조
        this.elements = {
            siteSelector: null,
            editorContainer: null,
            viewerContainer: null,
            templateModal: null,
            recoveryModal: null,
            saveButton: null,
            saveTemplateButton: null  // ✨ v1.4.0: NEW
        };
        
        // Template 목록 (기본)
        this.availableTemplates = [
            {
                id: 'standard_26x6',
                name: 'Standard 26×6 Layout (권장)',
                description: '26 rows × 6 cols, 복도 포함, Office 공간',
                filename: 'standard_26x6.json',
                isDefault: true
            },
            {
                id: 'compact_13x4',
                name: 'Compact 13×4 Layout',
                description: '13 rows × 4 cols, 소형 공장용',
                filename: 'compact_13x4.json',
                isDefault: true
            },
            {
                id: 'default',
                name: '기본 Template',
                description: '최소 구성',
                filename: 'default_template.json',
                isDefault: true
            }
        ];
        
        console.log('[LayoutEditorMain] ✅ 초기화 완료 (v1.4.0 - Template Manager 통합)');
    }
    
    /**
     * 시스템 초기화 및 UI 바인딩
     */
    init() {
        console.log('[LayoutEditorMain] 시스템 초기화 시작');
        
        // UI 요소 찾기
        this.elements.siteSelector = document.getElementById('site-selector');
        this.elements.editorContainer = document.getElementById('layout-editor-container');
        this.elements.viewerContainer = document.getElementById('viewer-container');
        this.elements.saveButton = document.getElementById('btn-save-layout');
        this.elements.saveTemplateButton = document.getElementById('btn-save-template');  // ✨ v1.4.0
        
        // Site 선택 이벤트 리스너
        if (this.elements.siteSelector) {
            this.elements.siteSelector.addEventListener('change', (e) => {
                const siteId = e.target.value;
                if (siteId) {
                    this.onSiteSelected(siteId);
                }
            });
        }
        
        // ✨ v1.3.0: Save 버튼 이벤트 리스너
        if (this.elements.saveButton) {
            this.elements.saveButton.addEventListener('click', () => {
                this.saveLayout();
            });
        }
        
        // ✨ v1.4.0: Save as Template 버튼 이벤트 리스너
        if (this.elements.saveTemplateButton) {
            this.elements.saveTemplateButton.addEventListener('click', () => {
                this.showSaveTemplateDialog();
            });
        }
        
        // 상태 변화 구독
        if (this.state) {
            this.state.subscribe('mode', (newMode) => {
                this.onModeChanged(newMode);
            });
        }
        
        // ✨ v1.3.0: Dialogs 초기화
        this.initDialogs();
        
        // ✨ v1.4.0: Template Dialog 초기화
        this.initTemplateDialog();
        
        // ✨ v1.4.0: Template 목록 갱신
        this.refreshTemplateList();
        
        console.log('[LayoutEditorMain] 초기화 완료');
    }
    
    /**
     * ✨ v1.3.0: Dialogs 초기화
     */
    initDialogs() {
        // ValidationErrorDialog
        if (window.ValidationErrorDialog) {
            this.validationErrorDialog = new window.ValidationErrorDialog({
                onFocusError: (error, index) => this.focusOnError(error),
                onAutoFix: (error, index) => this.autoFixError(error, index),
                onAutoFixAll: (errors) => this.autoFixAllErrors(errors),
                onClose: (action) => this.onValidationDialogClose(action),
                onRetry: () => this.saveLayout()
            });
            this.validationErrorDialog.init();
            console.log('[LayoutEditorMain] ValidationErrorDialog initialized');
        }
        
        // SaveSuccessDialog
        if (window.SaveSuccessDialog) {
            this.saveSuccessDialog = new window.SaveSuccessDialog({
                onGoTo3DViewer: () => this.goTo3DViewer(),
                onContinueEdit: () => this.continueEditing(),
                onViewChanges: () => this.viewChanges(),
                onClose: () => console.log('[LayoutEditorMain] Save dialog closed')
            });
            this.saveSuccessDialog.init();
            console.log('[LayoutEditorMain] SaveSuccessDialog initialized');
        }
    }
    
    /**
     * ✨ v1.4.0: Template Dialog 초기화
     */
    initTemplateDialog() {
        if (window.TemplateDialog) {
            this.templateDialog = new window.TemplateDialog({
                onSave: (name, description, options) => {
                    this.saveAsTemplate(name, description, options);
                },
                onCancel: () => {
                    console.log('[LayoutEditorMain] Template dialog cancelled');
                }
            });
            this.templateDialog.init();
            console.log('[LayoutEditorMain] TemplateDialog initialized');
        } else {
            console.warn('[LayoutEditorMain] TemplateDialog not available');
        }
    }
    
    /**
     * ✨ v1.4.0: Template 목록 갱신 (커스텀 포함)
     */
    refreshTemplateList() {
        if (this.templateManager) {
            const allTemplates = this.templateManager.getAllTemplates();
            
            // 기본 Template 유지 + 커스텀 추가
            const customTemplates = allTemplates.filter(t => !t.isDefault);
            
            customTemplates.forEach(t => {
                // 중복 확인
                const exists = this.availableTemplates.some(at => at.id === t.id);
                if (!exists) {
                    this.availableTemplates.push({
                        id: t.id,
                        name: t.name,
                        description: t.description || '',
                        filename: t.filename,
                        isDefault: false
                    });
                }
            });
            
            console.log(`[LayoutEditorMain] Template list refreshed: ${this.availableTemplates.length} templates`);
        }
    }
    
    /**
     * Site 선택 시 메인 처리 로직
     */
    async onSiteSelected(siteId) {
        console.log(`[LayoutEditorMain] Site 선택됨: ${siteId}`);
        
        try {
            if (!this.fileManager) {
                throw new Error('LayoutFileManager not initialized');
            }
            
            const exists = await this.fileManager.checkLayout(siteId);
            console.log(`[LayoutEditorMain] Layout 파일 존재: ${exists}`);
            
            if (exists) {
                await this.loadExistingLayout(siteId);
            } else {
                await this.showTemplateSelection(siteId);
            }
        } catch (error) {
            console.error('[LayoutEditorMain] Site 선택 처리 중 오류:', error);
            this.showError('Site 선택 중 오류가 발생했습니다.');
        }
    }
    
    /**
     * 기존 Layout 파일 로드
     */
    async loadExistingLayout(siteId) {
        console.log(`[LayoutEditorMain] 기존 Layout 로드 시작: ${siteId}`);
        
        try {
            const layoutData = await this.fileManager.loadLayout(siteId);
            
            if (layoutData) {
                console.log('[LayoutEditorMain] Layout 로드 성공:', layoutData);
                
                if (this.state) {
                    this.state.enterViewerMode(siteId, layoutData);
                }
                
                this.showSuccess(`Layout "${siteId}" 로드 완료 (v${layoutData.layout_version || 1})`);
                
            } else {
                throw new Error('Layout 데이터가 null입니다');
            }
            
        } catch (error) {
            console.error('[LayoutEditorMain] Layout 로드 실패:', error);
            await this.showRecoveryDialog(siteId);
        }
    }
    
    /**
     * Template 선택 UI 표시 (✨ v1.4.0: 커스텀 Template 포함)
     */
    async showTemplateSelection(siteId) {
        console.log(`[LayoutEditorMain] Template 선택 UI 표시: ${siteId}`);
        
        // Template 목록 갱신
        this.refreshTemplateList();
        
        const templateOptions = this.availableTemplates
            .map((t, idx) => {
                const badge = t.isDefault ? '' : ' [Custom]';
                return `${idx + 1}. ${t.name}${badge}\n   ${t.description}`;
            })
            .join('\n\n');
        
        const message = `🏗️ 새로운 Layout 생성 - ${siteId}\n\nLayout Template을 선택하세요:\n\n${templateOptions}\n\n번호를 입력하세요 (1-${this.availableTemplates.length}):`;
        
        const selection = prompt(message);
        
        if (selection) {
            const index = parseInt(selection) - 1;
            
            if (index >= 0 && index < this.availableTemplates.length) {
                const selectedTemplate = this.availableTemplates[index];
                console.log('[LayoutEditorMain] Template 선택됨:', selectedTemplate.name);
                
                await this.createNewLayout(siteId, selectedTemplate);
            } else {
                console.warn('[LayoutEditorMain] 잘못된 선택:', selection);
                alert('잘못된 선택입니다. 다시 시도해주세요.');
            }
        } else {
            console.log('[LayoutEditorMain] Template 선택 취소');
        }
    }
    
    /**
     * 신규 Layout 생성 (Template 기반)
     */
    async createNewLayout(siteId, templateInfo) {
        console.log(`[LayoutEditorMain] 신규 Layout 생성: ${siteId}, Template: ${templateInfo.name}`);
        
        try {
            const templateData = await this.fileManager.loadTemplate(templateInfo.filename);
            
            if (!templateData) {
                throw new Error(`Template 로드 실패: ${templateInfo.filename}`);
            }
            
            console.log('[LayoutEditorMain] Template 로드 성공:', templateData);
            
            // Site ID 교체 및 메타데이터 추가
            const newLayout = {
                ...templateData,
                site_id: siteId,
                template_source: templateInfo.id,
                created_at: new Date().toISOString(),
                layout_version: 1,
                change_log: [{
                    version: 1,
                    timestamp: new Date().toISOString(),
                    changes: '초기 생성'
                }],
                is_new: true
            };
            
            console.log('[LayoutEditorMain] 신규 Layout 데이터:', newLayout);
            
            if (this.state) {
                this.state.enterEditorMode(siteId, newLayout);
            }
            
            this.showSuccess(`신규 Layout 생성됨: ${siteId} (Template: ${templateInfo.name})`);
            
        } catch (error) {
            console.error('[LayoutEditorMain] Layout 생성 실패:', error);
            this.showError(`Layout 생성 실패: ${error.message}`);
        }
    }

    // =====================================================
    // ✨ v1.4.0: Template 저장 기능
    // =====================================================

    /**
     * ✨ v1.4.0: Save as Template Dialog 표시
     */
    showSaveTemplateDialog() {
        console.log('[LayoutEditorMain] 📋 showSaveTemplateDialog called');
        
        // 1. Canvas2DEditor 확인
        if (!this.canvas2DEditor) {
            this.showError('Canvas2DEditor가 초기화되지 않았습니다');
            return;
        }
        
        // 2. 현재 Layout 데이터 가져오기
        let layoutData = null;
        
        if (window.layoutSerializer) {
            const siteId = this.state?.state?.currentSiteId || 'template';
            layoutData = window.layoutSerializer.serialize(this.canvas2DEditor, siteId, {
                layoutVersion: this.state?.state?.layoutVersion || 1
            });
        } else if (this.state?.state?.currentLayout) {
            layoutData = this.state.state.currentLayout;
        }
        
        if (!layoutData) {
            this.showError('Layout 데이터를 가져올 수 없습니다');
            return;
        }
        
        // 3. Template Dialog 표시
        if (this.templateDialog) {
            this.templateDialog.show(layoutData);
        } else {
            // Fallback: prompt 사용
            this.showSaveTemplatePrompt(layoutData);
        }
    }

    /**
     * ✨ v1.4.0: Fallback - prompt로 Template 저장
     * @private
     */
    showSaveTemplatePrompt(layoutData) {
        const templateName = prompt('📋 Save as Template\n\nTemplate 이름을 입력하세요:');
        
        if (templateName && templateName.trim()) {
            const description = prompt('Template 설명 (선택사항):') || '';
            this.saveAsTemplate(templateName.trim(), description, {});
        }
    }

    /**
     * ✨ v1.4.0: Template으로 저장 실행
     * @param {string} templateName - Template 이름
     * @param {string} description - Template 설명
     * @param {Object} options - 옵션 (overwrite 등)
     */
    async saveAsTemplate(templateName, description, options = {}) {
        console.log('[LayoutEditorMain] 📋 ========================================');
        console.log('[LayoutEditorMain] 📋 Save as Template Started');
        console.log('[LayoutEditorMain] 📋 ========================================');
        console.log('[LayoutEditorMain] Template Name:', templateName);
        console.log('[LayoutEditorMain] Description:', description);
        console.log('[LayoutEditorMain] Options:', options);
        
        try {
            // 1. TemplateManager 확인
            if (!this.templateManager && !window.templateManager) {
                throw new Error('TemplateManager not available');
            }
            
            const tm = this.templateManager || window.templateManager;
            
            // 2. 현재 Layout 데이터 가져오기
            let layoutData = null;
            
            if (window.layoutSerializer && this.canvas2DEditor) {
                const siteId = this.state?.state?.currentSiteId || 'template';
                layoutData = window.layoutSerializer.serialize(this.canvas2DEditor, siteId, {
                    layoutVersion: 1  // Template은 항상 버전 1로 시작
                });
            } else if (this.state?.state?.currentLayout) {
                layoutData = { ...this.state.state.currentLayout };
            }
            
            if (!layoutData) {
                throw new Error('Layout data not available');
            }
            
            // 3. Template 저장
            const result = await tm.saveAsTemplate(layoutData, templateName, description, options);
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to save template');
            }
            
            // 4. Template 목록 갱신
            this.refreshTemplateList();
            
            // 5. 성공 메시지
            this.showSuccess(`Template "${templateName}" 저장 완료!`);
            console.log('[LayoutEditorMain] 📋 Template saved successfully:', result);
            
            console.log('[LayoutEditorMain] 📋 ========================================');
            console.log('[LayoutEditorMain] 📋 Save as Template Completed!');
            console.log('[LayoutEditorMain] 📋 ========================================');
            
            return true;
            
        } catch (error) {
            console.error('[LayoutEditorMain] ❌ Error saving template:', error);
            this.showError(`Template 저장 실패: ${error.message}`);
            return false;
        }
    }

    // =====================================================
    // ✨ v1.3.0: 저장 프로세스 통합
    // =====================================================

    /**
     * ✨ v1.3.0: Layout 저장 (전체 프로세스)
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveLayout() {
        console.log('[LayoutEditorMain] 💾 ========================================');
        console.log('[LayoutEditorMain] 💾 Save Layout Process Started');
        console.log('[LayoutEditorMain] 💾 ========================================');
        
        try {
            // 0. 상태 확인
            if (!this.canvas2DEditor) {
                throw new Error('Canvas2DEditor not initialized');
            }
            
            if (!this.state) {
                throw new Error('LayoutEditorState not initialized');
            }
            
            const siteId = this.state.state.currentSiteId;
            if (!siteId) {
                throw new Error('No site selected');
            }
            
            // 저장 시작 표시
            this.state.startSaving();
            
            // =====================================================
            // Step 1: 검증 (Validation)
            // =====================================================
            console.log('[LayoutEditorMain] 🔍 Step 1: Validating layout...');
            
            let validationResult = { valid: true, errors: [] };
            
            if (this.validator) {
                validationResult = this.validator.validate(null, this.canvas2DEditor);
                
                if (!validationResult.valid) {
                    console.log('[LayoutEditorMain] ❌ Validation failed');
                    this.showValidationErrors(validationResult);
                    this.state.finishSaving({ success: false, reason: 'validation_failed' });
                    return false;
                }
                
                console.log('[LayoutEditorMain] ✅ Validation passed');
            } else {
                console.warn('[LayoutEditorMain] ⚠️ Validator not available, skipping validation');
            }
            
            // =====================================================
            // Step 2: 버전 관리 (Version Management)
            // =====================================================
            console.log('[LayoutEditorMain] 📊 Step 2: Managing version...');
            
            const currentVersion = this.state.state.layoutVersion || 1;
            const newVersion = currentVersion + 1;
            const previousLayout = this.state.state.previousLayout;
            const existingChangeLog = this.state.state.changeLog || [];
            
            console.log(`[LayoutEditorMain] Version: ${currentVersion} → ${newVersion}`);
            
            // =====================================================
            // Step 3: 백업 생성 (Backup)
            // =====================================================
            let backupResult = null;
            
            if (previousLayout && currentVersion > 1) {
                console.log('[LayoutEditorMain] 📦 Step 3: Creating backup...');
                
                if (this.backupManager) {
                    backupResult = this.backupManager.createBackup(siteId, previousLayout);
                    
                    if (backupResult.success) {
                        console.log(`[LayoutEditorMain] ✅ Backup created: ${backupResult.filename}`);
                    } else {
                        console.warn('[LayoutEditorMain] ⚠️ Backup creation failed (continuing save)');
                    }
                }
            } else {
                console.log('[LayoutEditorMain] ⏭️ Step 3: Skipping backup (first save or no previous layout)');
            }
            
            // =====================================================
            // Step 4: 변경 설명 생성 (Change Description)
            // =====================================================
            console.log('[LayoutEditorMain] 📝 Step 4: Generating change description...');
            
            let changeDescription = '설정 변경';
            
            if (window.layoutSerializer && previousLayout) {
                const changes = window.layoutSerializer.detectChanges(
                    { statistics: this.calculateCurrentStatistics() },
                    previousLayout
                );
                changeDescription = changes.join(', ');
            }
            
            console.log(`[LayoutEditorMain] Change description: ${changeDescription}`);
            
            // =====================================================
            // Step 5: 직렬화 (Serialization)
            // =====================================================
            console.log('[LayoutEditorMain] 📄 Step 5: Serializing layout...');
            
            const serializer = window.layoutSerializer;
            if (!serializer) {
                throw new Error('LayoutSerializer not available');
            }
            
            const layoutData = serializer.serialize(this.canvas2DEditor, siteId, {
                layoutVersion: newVersion,
                changeLog: existingChangeLog,
                changeDescription: changeDescription,
                createdAt: this.state.state.currentLayout?.created_at
            });
            
            console.log('[LayoutEditorMain] ✅ Layout serialized');
            console.log(`[LayoutEditorMain] Equipment count: ${layoutData.statistics?.totalEquipment || '?'}`);
            
            // =====================================================
            // Step 6: 파일 저장 (File Save)
            // =====================================================
            console.log('[LayoutEditorMain] 💾 Step 6: Saving to file...');
            
            const saveResult = await this.fileManager.saveLayout(siteId, layoutData, {
                createBackup: false,  // 이미 Step 3에서 처리
                deleteAutoSave: true,
                previousLayout: previousLayout
            });
            
            if (!saveResult.success) {
                throw new Error(saveResult.error || 'Save operation failed');
            }
            
            console.log('[LayoutEditorMain] ✅ File save triggered');
            
            // =====================================================
            // Step 7: 상태 업데이트 (State Update)
            // =====================================================
            console.log('[LayoutEditorMain] 🔄 Step 7: Updating state...');
            
            this.state.state.layoutVersion = newVersion;
            this.state.state.changeLog = layoutData.change_log;
            this.state.markAsSaved({
                incrementVersion: false,  // 이미 직접 설정
                changeDescription: changeDescription
            });
            
            // =====================================================
            // Step 8: 성공 Dialog 표시
            // =====================================================
            console.log('[LayoutEditorMain] 🎉 Step 8: Showing success dialog...');
            
            this.state.finishSaving({ success: true });
            
            // 검증 하이라이트 제거
            this.clearValidationHighlights();
            
            // 성공 Dialog 표시
            if (this.saveSuccessDialog) {
                this.saveSuccessDialog.show({
                    siteId: siteId,
                    filename: `${siteId}.json`,
                    version: newVersion,
                    layoutVersion: newVersion,
                    equipmentCount: layoutData.statistics?.totalEquipment || 0,
                    backupFilename: backupResult?.filename || null,
                    changeLog: changeDescription ? [changeDescription] : []
                });
            } else {
                this.showSuccess(`Layout "${siteId}" 저장 완료 (v${newVersion})`);
            }
            
            console.log('[LayoutEditorMain] 💾 ========================================');
            console.log('[LayoutEditorMain] 💾 Save Layout Process Completed!');
            console.log('[LayoutEditorMain] 💾 ========================================');
            
            return true;
            
        } catch (error) {
            console.error('[LayoutEditorMain] ❌ Error saving layout:', error);
            
            if (this.state) {
                this.state.finishSaving({ success: false, error: error.message });
            }
            
            this.showError(`Layout 저장 실패: ${error.message}`);
            return false;
        }
    }

    /**
     * ✨ v1.3.0: 현재 통계 계산
     */
    calculateCurrentStatistics() {
        if (!this.canvas2DEditor) return {};
        
        let totalEquipment = 0;
        
        // Equipment Layer에서 설비 수 계산
        if (this.canvas2DEditor.layers && this.canvas2DEditor.layers.equipment) {
            const equipments = this.canvas2DEditor.layers.equipment.find('.equipment');
            totalEquipment = equipments ? equipments.length : 0;
        }
        
        return {
            totalEquipment: totalEquipment
        };
    }

    /**
     * ✨ v1.3.0: 검증 에러 표시 (Dialog 사용)
     */
    showValidationErrors(validationResult) {
        console.log('[LayoutEditorMain] 🔴 Showing validation errors...');
        
        const { errors, stats, summary } = validationResult;
        
        // Dialog로 표시
        if (this.validationErrorDialog) {
            this.validationErrorDialog.show(errors);
        } else {
            // Fallback: Toast 메시지
            this.showError(`Layout 검증 실패: ${summary || errors.length + '개 오류'}`);
        }
        
        // PropertyPanel에도 표시 (있는 경우)
        if (this.propertyPanel && this.propertyPanel.showValidationErrors) {
            this.propertyPanel.showValidationErrors(errors);
        }
        
        // Canvas에 에러 위치 하이라이트
        if (this.canvas2DEditor && this.canvas2DEditor.highlightValidationErrors) {
            this.canvas2DEditor.highlightValidationErrors(errors);
        }
        
        console.log(`[LayoutEditorMain] ${errors.length}개 에러 표시됨`);
    }
    
    /**
     * ✨ v1.3.0: 검증 하이라이트 제거
     */
    clearValidationHighlights() {
        if (this.canvas2DEditor && this.canvas2DEditor.clearValidationHighlights) {
            this.canvas2DEditor.clearValidationHighlights();
        }
        
        if (this.propertyPanel && this.propertyPanel.hideValidationErrors) {
            this.propertyPanel.hideValidationErrors();
        }
    }
    
    /**
     * ✨ v1.3.0: 특정 에러 위치로 이동
     */
    focusOnError(error) {
        if (!error) return;
        
        console.log('[LayoutEditorMain] 에러 위치로 이동:', error);
        
        // Canvas에서 해당 위치로 스크롤
        if (this.canvas2DEditor && this.canvas2DEditor.scrollToError) {
            this.canvas2DEditor.scrollToError(error);
        }
        
        // 해당 객체 선택
        if (error.equipmentId && this.canvas2DEditor && this.canvas2DEditor.equipmentShapes) {
            const shape = this.canvas2DEditor.equipmentShapes.get(error.equipmentId);
            if (shape && this.canvas2DEditor.selectObject) {
                this.canvas2DEditor.selectObject(shape, false);
            }
        }
    }
    
    /**
     * ✨ v1.3.0: 단일 에러 자동 수정
     */
    autoFixError(error, index) {
        console.log('[LayoutEditorMain] Auto fixing error:', error);
        
        if (this.validator && this.validator.autoFix) {
            const result = this.validator.autoFix(error, this.canvas2DEditor);
            
            if (result.success) {
                this.showSuccess(`에러 수정됨: ${error.rule || error.type}`);
                
                if (this.validationErrorDialog) {
                    this.validationErrorDialog.removeError(index);
                }
            } else {
                this.showError(`자동 수정 실패: ${result.message || '알 수 없는 오류'}`);
            }
        }
    }
    
    /**
     * ✨ v1.3.0: 모든 에러 자동 수정
     */
    autoFixAllErrors(errors) {
        console.log('[LayoutEditorMain] Auto fixing all errors:', errors.length);
        
        let fixedCount = 0;
        let failedCount = 0;
        
        errors.forEach((error, index) => {
            if (this.validator && this.validator.autoFix) {
                const result = this.validator.autoFix(error, this.canvas2DEditor);
                
                if (result.success) {
                    fixedCount++;
                } else {
                    failedCount++;
                }
            }
        });
        
        if (fixedCount > 0) {
            this.showSuccess(`${fixedCount}개 에러 수정됨`);
        }
        
        if (failedCount > 0) {
            this.showError(`${failedCount}개 에러 수정 실패`);
        }
        
        // Dialog 닫고 재검증
        if (this.validationErrorDialog) {
            this.validationErrorDialog.hide();
        }
        
        // 재검증
        setTimeout(() => {
            this.validateLayout();
        }, 500);
    }
    
    /**
     * ✨ v1.3.0: Validation Dialog 닫힘 처리
     */
    onValidationDialogClose(action) {
        console.log('[LayoutEditorMain] Validation dialog closed:', action);
        
        if (action === 'manual') {
            // 직접 수정 모드 - Canvas 포커스
            if (this.canvas2DEditor && this.canvas2DEditor.stage) {
                this.canvas2DEditor.stage.container().focus();
            }
        }
    }
    
    /**
     * ✨ v1.3.0: 수동 검증 실행
     */
    validateLayout() {
        console.log('[LayoutEditorMain] 🔍 Manual validation...');
        
        if (!this.canvas2DEditor) {
            this.showError('Canvas2DEditor가 초기화되지 않았습니다');
            return { valid: false, errors: [] };
        }
        
        if (!this.validator) {
            console.warn('[LayoutEditorMain] Validator not available');
            return { valid: true, errors: [] };
        }
        
        const result = this.validator.validate(null, this.canvas2DEditor);
        
        if (result.valid) {
            this.showSuccess('✅ Layout 검증 통과');
            this.clearValidationHighlights();
        } else {
            this.showValidationErrors(result);
        }
        
        return result;
    }
    
    /**
     * ✨ v1.3.0: 3D Viewer로 이동
     */
    goTo3DViewer() {
        console.log('[LayoutEditorMain] Switching to 3D Viewer...');
        
        if (this.state) {
            const siteId = this.state.state.currentSiteId;
            const layout = this.state.state.currentLayout;
            
            if (siteId && layout) {
                this.state.enterViewerMode(siteId, layout);
            }
        }
        
        // TODO: 실제 3D Viewer 전환 구현
        console.log('[LayoutEditorMain] TODO: Implement 3D Viewer switch');
    }
    
    /**
     * ✨ v1.3.0: 계속 편집
     */
    continueEditing() {
        console.log('[LayoutEditorMain] Continue editing...');
        // Dialog 닫히고 자동으로 Editor 유지
    }
    
    /**
     * ✨ v1.3.0: 변경사항 보기
     */
    viewChanges() {
        console.log('[LayoutEditorMain] View changes...');
        
        if (this.state && this.state.state.changeLog) {
            console.log('Change Log:');
            this.state.state.changeLog.forEach((entry, index) => {
                console.log(`  ${index + 1}. v${entry.version}: ${entry.changes}`);
            });
        }
    }

    // =====================================================
    // 모드 전환 및 UI 관리
    // =====================================================
    
    /**
     * 모드 변경 시 처리
     */
    onModeChanged(newMode) {
        console.log('[LayoutEditorMain] Mode changed to:', newMode);
        
        if (newMode === 'editor') {
            this.showEditorUI();
            this.showComponentPalette();
        } else {
            this.showViewerUI();
            this.hideComponentPalette();
        }
    }
    
    /**
     * Editor UI 표시
     */
    showEditorUI() {
        if (this.elements.editorContainer) {
            this.elements.editorContainer.style.display = 'block';
        }
        if (this.elements.viewerContainer) {
            this.elements.viewerContainer.style.display = 'none';
        }
        console.log('[LayoutEditorMain] Editor UI shown');
    }
    
    /**
     * Viewer UI 표시
     */
    showViewerUI() {
        if (this.elements.editorContainer) {
            this.elements.editorContainer.style.display = 'none';
        }
        if (this.elements.viewerContainer) {
            this.elements.viewerContainer.style.display = 'block';
        }
        console.log('[LayoutEditorMain] Viewer UI shown');
    }
    
    /**
     * 복구 Dialog 표시
     */
    async showRecoveryDialog(siteId) {
        console.log(`[LayoutEditorMain] Showing recovery dialog for: ${siteId}`);
        
        const message = `❌ Layout 파일 로드 실패: ${siteId}\n\n옵션을 선택하세요:\n\n1. 새 Template로 생성\n2. 취소`;
        
        const choice = prompt(message);
        
        if (choice === '1') {
            await this.showTemplateSelection(siteId);
        }
    }

    // =====================================================
    // Canvas2DEditor 및 ComponentPalette 관리
    // =====================================================
    
    /**
     * Canvas2DEditor 설정
     */
    setCanvas2DEditor(canvas2DEditor) {
        if (!canvas2DEditor) {
            console.error('[LayoutEditorMain] Canvas2DEditor 인스턴스가 필요합니다');
            return;
        }
        
        this.canvas2DEditor = canvas2DEditor;
        console.log('[LayoutEditorMain] Canvas2DEditor 설정 완료');
        
        this.initComponentPalette();
    }
    
    /**
     * PropertyPanel 설정
     */
    setPropertyPanel(propertyPanel) {
        if (!propertyPanel) {
            console.error('[LayoutEditorMain] PropertyPanel 인스턴스가 필요합니다');
            return;
        }
        
        this.propertyPanel = propertyPanel;
        console.log('[LayoutEditorMain] PropertyPanel 설정 완료');
    }
    
    /**
     * ComponentPalette 초기화
     */
    initComponentPalette() {
        if (!this.canvas2DEditor) {
            console.error('[LayoutEditorMain] Canvas2DEditor가 설정되지 않았습니다');
            return;
        }
        
        try {
            if (window.ComponentPalette) {
                this.componentPalette = new window.ComponentPalette(
                    'component-palette',
                    this.canvas2DEditor
                );
                
                if (this.canvas2DEditor.enableDropZone) {
                    this.canvas2DEditor.enableDropZone();
                }
                
                console.log('[LayoutEditorMain] ComponentPalette 초기화 완료');
            }
        } catch (error) {
            console.error('[LayoutEditorMain] ComponentPalette 초기화 실패:', error);
        }
    }
    
    /**
     * ComponentPalette 표시
     */
    showComponentPalette() {
        if (this.componentPalette && this.componentPalette.show) {
            this.componentPalette.show();
            console.log('[LayoutEditorMain] ComponentPalette 표시');
        }
    }
    
    /**
     * ComponentPalette 숨김
     */
    hideComponentPalette() {
        if (this.componentPalette && this.componentPalette.hide) {
            this.componentPalette.hide();
            console.log('[LayoutEditorMain] ComponentPalette 숨김');
        }
    }

    // =====================================================
    // 유틸리티 메서드
    // =====================================================
    
    /**
     * 성공 메시지 표시
     */
    showSuccess(message) {
        console.log(`[LayoutEditorMain] ✅ ${message}`);
        
        // Toast 표시 (있는 경우)
        if (window.showToast) {
            window.showToast(message, 'success');
        } else {
            // Fallback
            const toast = document.getElementById('toast-success');
            if (toast) {
                toast.textContent = message;
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 3000);
            }
        }
    }
    
    /**
     * 에러 메시지 표시
     */
    showError(message) {
        console.error(`[LayoutEditorMain] ❌ ${message}`);
        
        // Toast 표시 (있는 경우)
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            // Fallback
            alert(message);
        }
    }

    /**
     * ✨ v1.4.0: 디버그 정보 출력
     */
    debug() {
        console.log('[LayoutEditorMain] Debug Info:', {
            version: '1.4.0',
            hasFileManager: !!this.fileManager,
            hasState: !!this.state,
            hasValidator: !!this.validator,
            hasTemplateManager: !!this.templateManager,
            hasCanvas2DEditor: !!this.canvas2DEditor,
            hasTemplateDialog: !!this.templateDialog,
            availableTemplates: this.availableTemplates.length,
            mode: this.state?.state?.mode,
            currentSiteId: this.state?.state?.currentSiteId
        });
    }
}

// 전역 인스턴스 생성
const layoutEditorMain = new LayoutEditorMain();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.layoutEditorMain = layoutEditorMain;
    window.LayoutEditorMain = LayoutEditorMain;
}

// ES Module export (환경에 따라 조정)
// export { LayoutEditorMain };
// export const layoutEditorMain = new LayoutEditorMain();