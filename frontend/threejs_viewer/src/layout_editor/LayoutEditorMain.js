/**
 * LayoutEditorMain.js
 * Phase 1.5: Layout Editor 시스템의 진입점이자 메인 컨트롤러
 * Phase 2.6: ComponentPalette 통합
 * Phase 3.2: LayoutValidator 통합 ✨ NEW
 * 
 * 주요 역할:
 * 1. Site 선택 시 Layout 파일 존재 여부 확인
 * 2. 기존 Layout 로드 또는 Template 선택 분기
 * 3. Editor/Viewer 모드 전환 제어
 * 4. UI 컴포넌트 표시/숨김 관리
 * 5. ComponentPalette 초기화 및 관리 (✨ Phase 2.6)
 * 6. Layout 저장 전 검증 (✨ Phase 3.2)
 * 
 * 의존성:
 * - LayoutFileManager (Phase 1.2)
 * - LayoutEditorState (Phase 1.4)
 * - ComponentPalette (Phase 2.6)
 * - LayoutValidator (Phase 3.2) ✨ NEW
 */

import { LayoutFileManager } from '../services/layout/LayoutFileManager.js';
import { layoutEditorState } from '../stores/LayoutEditorState.js';
import { ComponentPalette } from './components/ComponentPalette.js';

// ✨ Phase 3.2: LayoutValidator import
import { LayoutValidator } from '../services/validation/index.js';

export class LayoutEditorMain {
    constructor() {
        this.fileManager = new LayoutFileManager();
        this.state = layoutEditorState;
        
        // ✨ Phase 2.6: ComponentPalette 참조
        this.componentPalette = null;
        this.canvas2DEditor = null;
        
        // ✨ Phase 3.2: LayoutValidator 인스턴스
        this.validator = new LayoutValidator();
        
        // ✨ Phase 3.2: PropertyPanel 참조 (검증 에러 표시용)
        this.propertyPanel = null;
        
        // UI 요소 참조
        this.elements = {
            siteSelector: null,
            editorContainer: null,
            viewerContainer: null,
            templateModal: null,
            recoveryModal: null
        };
        
        // Template 목록
        this.availableTemplates = [
            {
                id: 'standard_26x6',
                name: 'Standard 26×6 Layout (권장)',
                description: '26 rows × 6 cols, 복도 포함, Office 공간',
                filename: 'standard_26x6.json'
            },
            {
                id: 'compact_13x4',
                name: 'Compact 13×4 Layout',
                description: '13 rows × 4 cols, 소형 공장용',
                filename: 'compact_13x4.json'
            },
            {
                id: 'default',
                name: '기본 Template',
                description: '최소 구성',
                filename: 'default_template.json'
            }
        ];
        
        console.log('[LayoutEditorMain] 초기화 완료 (Phase 3.2 - Validator 통합)');
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
        
        if (!this.elements.siteSelector) {
            console.error('[LayoutEditorMain] Site Selector 요소를 찾을 수 없습니다');
            return;
        }
        
        // Site 선택 이벤트 리스너
        this.elements.siteSelector.addEventListener('change', (e) => {
            const siteId = e.target.value;
            if (siteId) {
                this.onSiteSelected(siteId);
            }
        });
        
        // 상태 변화 구독
        this.state.subscribe('mode', (newMode) => {
            this.onModeChanged(newMode);
        });
        
        console.log('[LayoutEditorMain] 초기화 완료');
    }
    
    /**
     * Site 선택 시 메인 처리 로직
     * @param {string} siteId - 선택된 Site ID (예: 'korea_site1_line1')
     */
    async onSiteSelected(siteId) {
        console.log(`[LayoutEditorMain] Site 선택됨: ${siteId}`);
        
        try {
            // 1. Layout 파일 존재 여부 확인
            const exists = await this.fileManager.checkLayout(siteId);
            console.log(`[LayoutEditorMain] Layout 파일 존재: ${exists}`);
            
            if (exists) {
                // 2-A. 기존 파일 로드
                await this.loadExistingLayout(siteId);
            } else {
                // 2-B. Template 선택 후 신규 생성
                await this.showTemplateSelection(siteId);
            }
        } catch (error) {
            console.error('[LayoutEditorMain] Site 선택 처리 중 오류:', error);
            this.showError('Site 선택 중 오류가 발생했습니다.');
        }
    }
    
    /**
     * 기존 Layout 파일 로드
     * @param {string} siteId - Site ID
     */
    async loadExistingLayout(siteId) {
        console.log(`[LayoutEditorMain] 기존 Layout 로드 시작: ${siteId}`);
        
        try {
            // Layout 파일 로드
            const layoutData = await this.fileManager.loadLayout(siteId);
            
            if (layoutData) {
                console.log('[LayoutEditorMain] Layout 로드 성공:', layoutData);
                
                // Viewer 모드로 전환
                this.state.enterViewerMode(siteId, layoutData);
                
                // 성공 메시지
                this.showSuccess(`Layout "${siteId}" 로드 완료`);
                
                // TODO: Phase 2에서 3D 렌더링 추가
                console.log('[LayoutEditorMain] TODO: 3D Scene 렌더링 (Phase 2)');
                
            } else {
                throw new Error('Layout 데이터가 null입니다');
            }
            
        } catch (error) {
            console.error('[LayoutEditorMain] Layout 로드 실패:', error);
            
            // 복구 옵션 표시
            await this.showRecoveryDialog(siteId);
        }
    }
    
    /**
     * Template 선택 UI 표시
     * @param {string} siteId - Site ID
     */
    async showTemplateSelection(siteId) {
        console.log(`[LayoutEditorMain] Template 선택 UI 표시: ${siteId}`);
        
        // 임시: prompt 사용 (Phase 2에서 Modal UI로 교체)
        const templateOptions = this.availableTemplates
            .map((t, idx) => `${idx + 1}. ${t.name}\n   ${t.description}`)
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
     * @param {string} siteId - Site ID
     * @param {Object} templateInfo - Template 정보
     */
    async createNewLayout(siteId, templateInfo) {
        console.log(`[LayoutEditorMain] 신규 Layout 생성: ${siteId}, Template: ${templateInfo.name}`);
        
        try {
            // 1. Template 로드
            const templateData = await this.fileManager.loadTemplate(templateInfo.filename);
            
            if (!templateData) {
                throw new Error(`Template 로드 실패: ${templateInfo.filename}`);
            }
            
            console.log('[LayoutEditorMain] Template 로드 성공:', templateData);
            
            // 2. Site ID 교체 및 메타데이터 추가
            const newLayout = {
                ...templateData,
                site_id: siteId,
                template_source: templateInfo.id,
                created_at: new Date().toISOString(),
                layout_version: 1,
                is_new: true // 신규 생성 플래그
            };
            
            console.log('[LayoutEditorMain] 신규 Layout 데이터:', newLayout);
            
            // 3. Editor 모드로 진입
            this.state.enterEditorMode(siteId, newLayout);
            
            // 성공 메시지
            this.showSuccess(`신규 Layout 생성됨: ${siteId} (Template: ${templateInfo.name})`);
            
            // TODO: Phase 2에서 Canvas2DEditor 초기화
            console.log('[LayoutEditorMain] TODO: Canvas2DEditor 초기화 (Phase 2)');
            
        } catch (error) {
            console.error('[LayoutEditorMain] 신규 Layout 생성 실패:', error);
            this.showError(`Layout 생성 중 오류: ${error.message}`);
        }
    }
    
    /**
     * 복구 Dialog 표시
     * @param {string} siteId - Site ID
     */
    async showRecoveryDialog(siteId) {
        console.log(`[LayoutEditorMain] 복구 Dialog 표시: ${siteId}`);
        
        const options = [
            '1. 백업 파일에서 복구 시도',
            '2. Template으로 새로 생성',
            '3. 취소'
        ].join('\n');
        
        const message = `❌ Layout 파일 로드 실패: ${siteId}\n\n복구 방법을 선택하세요:\n\n${options}\n\n번호를 입력하세요:`;
        
        const choice = prompt(message);
        
        switch (choice) {
            case '1':
                // 백업 파일 복구 시도
                console.log('[LayoutEditorMain] 백업 파일 복구 시도');
                const backupData = await this.fileManager.loadBackup(siteId);
                if (backupData) {
                    this.state.enterViewerMode(siteId, backupData);
                    this.showSuccess('백업 파일로 복구 성공');
                } else {
                    this.showError('백업 파일도 손상되었습니다');
                    await this.showTemplateSelection(siteId);
                }
                break;
                
            case '2':
                // Template 선택
                await this.showTemplateSelection(siteId);
                break;
                
            case '3':
            default:
                console.log('[LayoutEditorMain] 복구 취소');
                break;
        }
    }
    
    /**
     * 모드 변경 시 UI 업데이트
     * @param {string} newMode - 'editor' | 'viewer'
     */
    onModeChanged(newMode) {
        console.log(`[LayoutEditorMain] 모드 변경: ${newMode}`);
        
        if (newMode === 'editor') {
            // Editor UI 표시
            if (this.elements.editorContainer) {
                this.elements.editorContainer.style.display = 'block';
            }
            if (this.elements.viewerContainer) {
                this.elements.viewerContainer.style.display = 'none';
            }
            
            console.log('[LayoutEditorMain] Editor UI 표시');
            
        } else if (newMode === 'viewer') {
            // Viewer UI 표시
            if (this.elements.editorContainer) {
                this.elements.editorContainer.style.display = 'none';
            }
            if (this.elements.viewerContainer) {
                this.elements.viewerContainer.style.display = 'block';
            }
            
            console.log('[LayoutEditorMain] Viewer UI 표시');
        }
    }
    
    /**
     * Layout 저장 (Phase 3에서 상세 구현)
     */
    async saveCurrentLayout() {
        const currentLayout = this.state.state.currentLayout;
        const siteId = this.state.state.currentSiteId;
        
        if (!currentLayout || !siteId) {
            this.showError('저장할 Layout이 없습니다');
            return;
        }
        
        console.log(`[LayoutEditorMain] Layout 저장: ${siteId}`);
        
        try {
            // LayoutFileManager를 통해 저장 (브라우저 다운로드)
            await this.fileManager.saveLayout(siteId, currentLayout);
            
            // 상태 업데이트
            this.state.markAsSaved();
            
            this.showSuccess(`Layout 저장 완료: ${siteId}.json`);
            
        } catch (error) {
            console.error('[LayoutEditorMain] Layout 저장 실패:', error);
            this.showError(`저장 중 오류: ${error.message}`);
        }
    }
    
    /**
     * 성공 메시지 표시
     * @param {string} message - 메시지
     */
    showSuccess(message) {
        console.log(`[LayoutEditorMain] ✅ ${message}`);
        // TODO: Phase 2에서 Toast UI로 교체
        alert(`✅ ${message}`);
    }
    
    /**
     * 에러 메시지 표시
     * @param {string} message - 메시지
     */
    showError(message) {
        console.error(`[LayoutEditorMain] ❌ ${message}`);
        // TODO: Phase 2에서 Toast UI로 교체
        alert(`❌ ${message}`);
    }
    
    /**
     * 현재 상태 정보 반환 (디버깅용)
     */
    getDebugInfo() {
        return {
            mode: this.state.state.mode,
            siteId: this.state.state.currentSiteId,
            hasLayout: !!this.state.state.currentLayout,
            isDirty: this.state.state.isDirty,
            availableTemplates: this.availableTemplates.length
        };
    }
    
    // =====================================================
    // ✨ Phase 2.6: ComponentPalette 통합 메서드들
    // =====================================================
    
    /**
     * ✨ Phase 2.6: Canvas2DEditor 설정 (Editor 모드 진입 시 호출)
     * @param {Canvas2DEditor} canvas2DEditor - Canvas2DEditor 인스턴스
     */
    setCanvas2DEditor(canvas2DEditor) {
        if (!canvas2DEditor) {
            console.error('[LayoutEditorMain] Canvas2DEditor 인스턴스가 필요합니다');
            return;
        }
        
        this.canvas2DEditor = canvas2DEditor;
        console.log('[LayoutEditorMain] Canvas2DEditor 설정 완료');
        
        // ComponentPalette 초기화
        this.initComponentPalette();
    }
    
    /**
     * ✨ Phase 3.2: PropertyPanel 설정
     * @param {PropertyPanel} propertyPanel - PropertyPanel 인스턴스
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
     * ✨ Phase 2.6: ComponentPalette 초기화
     */
    initComponentPalette() {
        if (!this.canvas2DEditor) {
            console.error('[LayoutEditorMain] Canvas2DEditor가 설정되지 않았습니다');
            return;
        }
        
        try {
            // ComponentPalette 인스턴스 생성
            this.componentPalette = new ComponentPalette(
                'component-palette',
                this.canvas2DEditor
            );
            
            // Canvas2DEditor Drop Zone 활성화
            this.canvas2DEditor.enableDropZone();
            
            console.log('[LayoutEditorMain] ComponentPalette 초기화 완료');
            
        } catch (error) {
            console.error('[LayoutEditorMain] ComponentPalette 초기화 실패:', error);
        }
    }
    
    /**
     * ✨ Phase 2.6: ComponentPalette 표시
     */
    showComponentPalette() {
        if (this.componentPalette) {
            this.componentPalette.show();
            console.log('[LayoutEditorMain] ComponentPalette 표시');
        }
    }
    
    /**
     * ✨ Phase 2.6: ComponentPalette 숨김
     */
    hideComponentPalette() {
        if (this.componentPalette) {
            this.componentPalette.hide();
            console.log('[LayoutEditorMain] ComponentPalette 숨김');
        }
    }

    // =====================================================
    // ✨ Phase 3.2: LayoutValidator 통합 메서드들
    // =====================================================

    /**
     * ✨ Phase 3.2: Layout 저장 (검증 포함)
     * @returns {Promise<boolean>} 저장 성공 여부
     */
    async saveLayout() {
        console.log('[LayoutEditorMain] 💾 Saving layout with validation...');
        
        try {
            // 1. Canvas2DEditor 확인
            if (!this.canvas2DEditor) {
                throw new Error('Canvas2DEditor not initialized');
            }
            
            // 2. Site ID 확인
            const siteId = this.state.state.currentSiteId;
            if (!siteId) {
                throw new Error('No site selected');
            }
            
            // =====================================================
            // ✨ Phase 3.2: 검증 실행 (NEW)
            // =====================================================
            console.log('[LayoutEditorMain] 🔍 Validating layout...');
            
            const validationResult = this.validator.validate(null, this.canvas2DEditor);
            
            // 검증 실패 시 저장 차단
            if (!validationResult.valid) {
                console.log('[LayoutEditorMain] ❌ Validation failed');
                this.showValidationErrors(validationResult);
                return false;
            }
            
            console.log('[LayoutEditorMain] ✅ Validation passed');
            
            // 검증 하이라이트 제거
            this.clearValidationHighlights();
            
            // =====================================================
            // 기존 저장 로직 (변경 없음)
            // =====================================================
            
            // 3. LayoutSerializer로 직렬화
            const serializer = window.layoutSerializer;
            if (!serializer) {
                throw new Error('LayoutSerializer not available');
            }
            
            const layoutData = serializer.serialize(this.canvas2DEditor, siteId);
            console.log('[LayoutEditorMain] Layout serialized:', layoutData);
            
            // 4. LayoutFileManager로 저장
            const success = await this.fileManager.saveLayout(siteId, layoutData);
            
            // 5. 상태 업데이트
            if (success) {
                this.state.markAsSaved();
                this.showSuccess(`Layout "${siteId}" 저장 완료`);
                console.log('[LayoutEditorMain] ✅ Layout saved successfully');
                
                // PropertyPanel 에러 섹션 숨김
                if (this.propertyPanel && this.propertyPanel.hideValidationErrors) {
                    this.propertyPanel.hideValidationErrors();
                }
            } else {
                throw new Error('Save operation failed');
            }
            
            return success;
            
        } catch (error) {
            console.error('[LayoutEditorMain] ❌ Error saving layout:', error);
            this.showError(`Layout 저장 실패: ${error.message}`);
            return false;
        }
    }
    
    /**
     * ✨ Phase 3.2: 검증 에러 표시
     * @param {Object} validationResult - 검증 결과
     */
    showValidationErrors(validationResult) {
        console.log('[LayoutEditorMain] 🔴 Showing validation errors...');
        
        const { errors, stats, summary } = validationResult;
        
        // 1. Toast/Alert 표시
        this.showError(`Layout 검증 실패: ${summary}`);
        
        // 2. PropertyPanel에 에러 목록 표시
        if (this.propertyPanel && this.propertyPanel.showValidationErrors) {
            this.propertyPanel.showValidationErrors(errors);
        }
        
        // 3. Canvas에 에러 위치 하이라이트
        if (this.canvas2DEditor && this.canvas2DEditor.highlightValidationErrors) {
            this.canvas2DEditor.highlightValidationErrors(errors);
        }
        
        console.log(`[LayoutEditorMain] ${errors.length}개 에러 표시됨`);
    }
    
    /**
     * ✨ Phase 3.2: 검증 하이라이트 제거
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
     * ✨ Phase 3.2: 수동 검증 실행 (Validate 버튼용)
     * @returns {Object} 검증 결과
     */
    validateLayout() {
        console.log('[LayoutEditorMain] 🔍 Manual validation...');
        
        if (!this.canvas2DEditor) {
            this.showError('Canvas2DEditor가 초기화되지 않았습니다');
            return { valid: false, errors: [] };
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
     * ✨ Phase 3.2: 특정 에러 위치로 이동
     * @param {Object} error - 에러 객체
     */
    focusOnError(error) {
        if (!error) return;
        
        console.log('[LayoutEditorMain] 에러 위치로 이동:', error);
        
        // Canvas에서 해당 위치로 스크롤
        if (this.canvas2DEditor && this.canvas2DEditor.scrollToError) {
            this.canvas2DEditor.scrollToError(error);
        }
        
        // 해당 객체 선택
        if (error.equipmentId && this.canvas2DEditor) {
            const shape = this.canvas2DEditor.equipmentShapes.get(error.equipmentId);
            if (shape) {
                this.canvas2DEditor.selectObject(shape, false);
            }
        }
    }
}

// 전역 인스턴스 생성
export const layoutEditorMain = new LayoutEditorMain();