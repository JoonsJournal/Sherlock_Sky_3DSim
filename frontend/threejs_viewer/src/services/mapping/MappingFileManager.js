/**
 * MappingFileManager.js
 * 
 * Equipment 매핑 파일 관리자
 * - JSON 파일 Export/Import
 * - 버전 호환성 체크
 * - 파일 검증
 * - 드래그앤드롭 지원
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/services/mapping/MappingFileManager.js
 */

import { eventBus } from '../../core/managers/EventBus.js';
import { storageService } from '../../core/storage/index.js';

/**
 * 파일 형식 버전
 */
const FILE_FORMAT_VERSION = '1.0.0';

/**
 * 지원하는 버전 목록 (하위 호환성)
 */
const SUPPORTED_VERSIONS = ['1.0.0'];

/**
 * 파일 형식 스키마
 * @typedef {Object} MappingFileSchema
 * @property {string} version - 파일 형식 버전
 * @property {Object} meta - 메타데이터
 * @property {string} meta.createdAt - 생성 시간
 * @property {string} meta.modifiedAt - 수정 시간
 * @property {string} meta.siteId - 사이트 ID
 * @property {string} meta.siteName - 사이트 이름
 * @property {number} meta.totalEquipment - 전체 설비 수
 * @property {number} meta.mappedCount - 매핑된 설비 수
 * @property {string} meta.exportedBy - 내보내기 수행자 (선택)
 * @property {string} meta.description - 설명 (선택)
 * @property {Object} mappings - 매핑 데이터
 */

/**
 * 검증 결과
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 유효 여부
 * @property {string[]} errors - 오류 목록
 * @property {string[]} warnings - 경고 목록
 * @property {Object} fileInfo - 파일 정보
 */

/**
 * MappingFileManager
 * 
 * Equipment 매핑 데이터의 파일 기반 관리
 */
class MappingFileManager {
    /**
     * @param {Object} options - 설정 옵션
     * @param {Object} options.equipmentEditState - EquipmentEditState 인스턴스
     * @param {string} options.defaultSiteId - 기본 사이트 ID
     * @param {string} options.defaultSiteName - 기본 사이트 이름
     */
    constructor(options = {}) {
        this._editState = options.equipmentEditState || null;
        this._defaultSiteId = options.defaultSiteId || 'default_site';
        this._defaultSiteName = options.defaultSiteName || 'Default Site';
        
        // 최근 파일 기록
        this._recentFiles = [];
        this._maxRecentFiles = 5;
        
        // LocalStorage 키
        this._recentFilesKey = 'sherlock_recent_mapping_files';
        
        // 최근 파일 로드
        this._loadRecentFiles();
        
        console.log('✅ MappingFileManager initialized');
    }

    // =========================================================================
    // Export (다운로드)
    // =========================================================================

    /**
     * 현재 매핑 데이터를 JSON 파일로 내보내기
     * @param {Object} options - 내보내기 옵션
     * @param {string} options.siteId - 사이트 ID
     * @param {string} options.siteName - 사이트 이름
     * @param {string} options.description - 설명
     * @param {string} options.exportedBy - 내보내기 수행자
     * @param {string} options.filename - 파일명 (확장자 제외)
     * @returns {Object} 내보내기 결과
     */
    export(options = {}) {
        if (!this._editState) {
            throw new Error('EquipmentEditState가 설정되지 않았습니다.');
        }

        const mappings = this._editState.getAllMappings();
        const mappingCount = Object.keys(mappings).length;

        // 파일 데이터 생성
        const fileData = this._createFileData(mappings, {
            siteId: options.siteId || this._defaultSiteId,
            siteName: options.siteName || this._defaultSiteName,
            description: options.description || '',
            exportedBy: options.exportedBy || ''
        });

        // 파일명 생성
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = options.filename || 
            `equipment-mapping_${fileData.meta.siteId}_${timestamp}`;

        // JSON 문자열 변환
        const jsonString = JSON.stringify(fileData, null, 2);

        // 다운로드 실행
        this._downloadFile(jsonString, `${filename}.json`, 'application/json');

        // 최근 파일 기록 추가
        this._addRecentFile({
            filename: `${filename}.json`,
            action: 'export',
            timestamp: new Date().toISOString(),
            siteId: fileData.meta.siteId,
            mappingCount
        });

        // 이벤트 발행
        eventBus.emit('mapping:file-exported', {
            filename: `${filename}.json`,
            siteId: fileData.meta.siteId,
            mappingCount,
            timestamp: new Date().toISOString()
        });

        console.log(`📁 매핑 데이터 내보내기 완료: ${filename}.json (${mappingCount}개)`);

        return {
            success: true,
            filename: `${filename}.json`,
            mappingCount,
            fileSize: jsonString.length
        };
    }

    /**
     * 파일 데이터 구조 생성
     * @private
     */
    _createFileData(mappings, meta) {
        const now = new Date().toISOString();
        const mappingCount = Object.keys(mappings).length;

        return {
            version: FILE_FORMAT_VERSION,
            meta: {
                createdAt: now,
                modifiedAt: now,
                siteId: meta.siteId,
                siteName: meta.siteName,
                totalEquipment: 117,  // 기본값
                mappedCount: mappingCount,
                completionRate: Math.round((mappingCount / 117) * 100),
                exportedBy: meta.exportedBy || '',
                description: meta.description || '',
                application: 'Sherlock Sky 3DSim',
                applicationVersion: '1.0.0'
            },
            mappings: mappings
        };
    }

    /**
     * 파일 다운로드 실행
     * @private
     */
    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    // =========================================================================
    // Import (파일 읽기)
    // =========================================================================

    /**
     * 파일 선택 다이얼로그 열기
     * @returns {Promise<Object>} Import 결과
     */
    async openFileDialog() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const result = await this.importFromFile(file);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    resolve({ success: false, message: '파일이 선택되지 않았습니다.' });
                }
            };
            
            input.click();
        });
    }

    /**
     * File 객체에서 매핑 데이터 Import
     * @param {File} file - JSON 파일
     * @param {Object} options - Import 옵션
     * @param {boolean} options.apply - 즉시 적용 여부 (기본: false)
     * @param {string} options.mergeStrategy - 병합 전략 ('replace' | 'merge' | 'keep-local')
     * @returns {Promise<Object>} Import 결과
     */
    async importFromFile(file, options = {}) {
        if (!file) {
            throw new Error('파일이 제공되지 않았습니다.');
        }

        // 파일 타입 검증
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            throw new Error('JSON 파일만 지원됩니다.');
        }

        try {
            // 파일 읽기
            const content = await this._readFile(file);
            
            // JSON 파싱
            let data;
            try {
                data = JSON.parse(content);
            } catch (parseError) {
                throw new Error('유효하지 않은 JSON 형식입니다.');
            }

            // 검증
            const validation = this.validateFileData(data);
            
            if (!validation.valid) {
                return {
                    success: false,
                    validation,
                    message: '파일 검증 실패: ' + validation.errors.join(', ')
                };
            }

            // 결과 객체
            const result = {
                success: true,
                validation,
                fileInfo: validation.fileInfo,
                data: data,
                mappings: data.mappings,
                mappingCount: Object.keys(data.mappings).length
            };

            // 즉시 적용 옵션
            if (options.apply && this._editState) {
                const applyResult = this.applyImportedData(data, {
                    mergeStrategy: options.mergeStrategy || 'replace'
                });
                result.applied = true;
                result.applyResult = applyResult;
            }

            // 최근 파일 기록 추가
            this._addRecentFile({
                filename: file.name,
                action: 'import',
                timestamp: new Date().toISOString(),
                siteId: data.meta?.siteId || 'unknown',
                mappingCount: result.mappingCount
            });

            // 이벤트 발행
            eventBus.emit('mapping:file-imported', {
                filename: file.name,
                siteId: data.meta?.siteId,
                mappingCount: result.mappingCount,
                applied: result.applied || false,
                timestamp: new Date().toISOString()
            });

            console.log(`📁 매핑 데이터 가져오기 완료: ${file.name} (${result.mappingCount}개)`);

            return result;

        } catch (error) {
            console.error('❌ 파일 Import 실패:', error);
            throw error;
        }
    }

    /**
     * 파일 읽기 (Promise)
     * @private
     */
    _readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('파일 읽기 실패'));
            reader.readAsText(file);
        });
    }

    /**
     * Import된 데이터 적용
     * @param {Object} data - 파일 데이터
     * @param {Object} options - 적용 옵션
     * @returns {Object} 적용 결과
     */
    applyImportedData(data, options = {}) {
        if (!this._editState) {
            throw new Error('EquipmentEditState가 설정되지 않았습니다.');
        }

        const { mergeStrategy = 'replace' } = options;
        const mappings = data.mappings;

        if (!mappings || typeof mappings !== 'object') {
            throw new Error('유효하지 않은 매핑 데이터입니다.');
        }

        const beforeCount = this._editState.getMappingCount();

        // 전략에 따라 적용
        switch (mergeStrategy) {
            case 'replace':
                // 기존 데이터 완전 대체
                this._editState.reset(true);  // skipConfirm
                Object.entries(mappings).forEach(([frontendId, mapping]) => {
                    this._editState.mappings[frontendId] = {
                        ...mapping,
                        imported_at: new Date().toISOString()
                    };
                });
                this._editState.isDirty = true;
                this._editState.save();
                break;

            case 'merge':
                // 기존 데이터 유지, 새 데이터 추가/덮어쓰기
                Object.entries(mappings).forEach(([frontendId, mapping]) => {
                    this._editState.mappings[frontendId] = {
                        ...mapping,
                        imported_at: new Date().toISOString()
                    };
                });
                this._editState.isDirty = true;
                this._editState.save();
                break;

            case 'keep-local':
                // 로컬에 없는 것만 추가
                Object.entries(mappings).forEach(([frontendId, mapping]) => {
                    if (!this._editState.mappings[frontendId]) {
                        this._editState.mappings[frontendId] = {
                            ...mapping,
                            imported_at: new Date().toISOString()
                        };
                    }
                });
                this._editState.isDirty = true;
                this._editState.save();
                break;

            default:
                throw new Error(`지원하지 않는 병합 전략: ${mergeStrategy}`);
        }

        const afterCount = this._editState.getMappingCount();

        // 이벤트 발행
        eventBus.emit('mapping:data-applied', {
            strategy: mergeStrategy,
            beforeCount,
            afterCount,
            addedCount: afterCount - beforeCount,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            strategy: mergeStrategy,
            beforeCount,
            afterCount,
            addedCount: afterCount - beforeCount
        };
    }

    // =========================================================================
    // 파일 검증
    // =========================================================================

    /**
     * 파일 데이터 검증
     * @param {Object} data - 파싱된 JSON 데이터
     * @returns {ValidationResult} 검증 결과
     */
    validateFileData(data) {
        const errors = [];
        const warnings = [];
        const fileInfo = {};

        // 1. 기본 구조 검증
        if (!data || typeof data !== 'object') {
            errors.push('유효하지 않은 데이터 형식입니다.');
            return { valid: false, errors, warnings, fileInfo };
        }

        // 2. 버전 검증
        if (!data.version) {
            errors.push('파일 버전 정보가 없습니다.');
        } else if (!this._isVersionSupported(data.version)) {
            errors.push(`지원하지 않는 파일 버전입니다: ${data.version} (지원: ${SUPPORTED_VERSIONS.join(', ')})`);
        } else {
            fileInfo.version = data.version;
            
            // 마이너 버전 차이 경고
            if (data.version !== FILE_FORMAT_VERSION) {
                warnings.push(`파일 버전이 다릅니다: ${data.version} (현재: ${FILE_FORMAT_VERSION})`);
            }
        }

        // 3. 메타데이터 검증
        if (!data.meta) {
            warnings.push('메타데이터가 없습니다.');
        } else {
            fileInfo.siteId = data.meta.siteId || 'unknown';
            fileInfo.siteName = data.meta.siteName || 'Unknown';
            fileInfo.createdAt = data.meta.createdAt;
            fileInfo.mappedCount = data.meta.mappedCount;
            fileInfo.completionRate = data.meta.completionRate;
            fileInfo.description = data.meta.description;

            if (!data.meta.siteId) {
                warnings.push('사이트 ID가 지정되지 않았습니다.');
            }
        }

        // 4. 매핑 데이터 검증
        if (!data.mappings) {
            errors.push('매핑 데이터가 없습니다.');
        } else if (typeof data.mappings !== 'object') {
            errors.push('매핑 데이터 형식이 올바르지 않습니다.');
        } else {
            const mappingCount = Object.keys(data.mappings).length;
            fileInfo.actualMappingCount = mappingCount;

            if (mappingCount === 0) {
                warnings.push('매핑 데이터가 비어있습니다.');
            }

            // 개별 매핑 항목 검증
            let invalidEntries = 0;
            const equipmentIds = new Set();
            const duplicateIds = [];

            for (const [frontendId, mapping] of Object.entries(data.mappings)) {
                // 필수 필드 확인
                if (!mapping.equipment_id) {
                    invalidEntries++;
                    continue;
                }

                if (!mapping.equipment_name) {
                    warnings.push(`${frontendId}: equipment_name이 없습니다.`);
                }

                // 중복 equipment_id 확인
                if (equipmentIds.has(mapping.equipment_id)) {
                    duplicateIds.push(mapping.equipment_id);
                } else {
                    equipmentIds.add(mapping.equipment_id);
                }

                // frontend_id 일관성 확인
                if (mapping.frontend_id && mapping.frontend_id !== frontendId) {
                    warnings.push(`${frontendId}: frontend_id 불일치 (${mapping.frontend_id})`);
                }
            }

            if (invalidEntries > 0) {
                errors.push(`${invalidEntries}개의 유효하지 않은 매핑 항목이 있습니다.`);
            }

            if (duplicateIds.length > 0) {
                warnings.push(`중복된 equipment_id 발견: ${duplicateIds.join(', ')}`);
            }

            fileInfo.invalidEntries = invalidEntries;
            fileInfo.duplicateIds = duplicateIds;
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            fileInfo
        };
    }

    /**
     * 버전 지원 여부 확인
     * @private
     */
    _isVersionSupported(version) {
        // 정확한 버전 매칭
        if (SUPPORTED_VERSIONS.includes(version)) {
            return true;
        }

        // Major 버전만 비교 (1.x.x → 1)
        const majorVersion = version.split('.')[0];
        const supportedMajors = SUPPORTED_VERSIONS.map(v => v.split('.')[0]);
        
        return supportedMajors.includes(majorVersion);
    }

    // =========================================================================
    // 드래그앤드롭 지원
    // =========================================================================

    /**
     * 드래그앤드롭 이벤트 핸들러 생성
     * @param {HTMLElement} dropZone - 드롭 영역 요소
     * @param {Object} options - 옵션
     * @returns {Object} 이벤트 해제 함수들
     */
    setupDropZone(dropZone, options = {}) {
        const {
            onDragEnter = () => {},
            onDragLeave = () => {},
            onDrop = () => {},
            apply = false,
            mergeStrategy = 'replace'
        } = options;

        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDragEnter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
            onDragEnter(e);
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            onDragLeave(e);
        };

        const handleDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) {
                return;
            }

            const file = files[0];
            
            try {
                const result = await this.importFromFile(file, {
                    apply,
                    mergeStrategy
                });
                onDrop(result, file);
            } catch (error) {
                onDrop({ success: false, error: error.message }, file);
            }
        };

        // 이벤트 등록
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragenter', handleDragEnter);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);

        // 해제 함수 반환
        return {
            destroy: () => {
                dropZone.removeEventListener('dragover', handleDragOver);
                dropZone.removeEventListener('dragenter', handleDragEnter);
                dropZone.removeEventListener('dragleave', handleDragLeave);
                dropZone.removeEventListener('drop', handleDrop);
            }
        };
    }

    // =========================================================================
    // 최근 파일 관리
    // =========================================================================

    /**
     * 최근 파일 목록 로드
     * @private
     */
    _loadRecentFiles() {
        try {
            const data = localStorage.getItem(this._recentFilesKey);
            if (data) {
                this._recentFiles = JSON.parse(data);
            }
        } catch (e) {
            console.warn('[MappingFileManager] 최근 파일 목록 로드 실패:', e);
            this._recentFiles = [];
        }
    }

    /**
     * 최근 파일 기록 추가
     * @private
     */
    _addRecentFile(fileInfo) {
        // 중복 제거 (같은 파일명)
        this._recentFiles = this._recentFiles.filter(
            f => f.filename !== fileInfo.filename
        );

        // 맨 앞에 추가
        this._recentFiles.unshift(fileInfo);

        // 최대 개수 유지
        if (this._recentFiles.length > this._maxRecentFiles) {
            this._recentFiles = this._recentFiles.slice(0, this._maxRecentFiles);
        }

        // 저장
        this._saveRecentFiles();
    }

    /**
     * 최근 파일 목록 저장
     * @private
     */
    _saveRecentFiles() {
        try {
            localStorage.setItem(this._recentFilesKey, JSON.stringify(this._recentFiles));
        } catch (e) {
            console.warn('[MappingFileManager] 최근 파일 목록 저장 실패:', e);
        }
    }

    /**
     * 최근 파일 목록 조회
     * @returns {Array} 최근 파일 목록
     */
    getRecentFiles() {
        return [...this._recentFiles];
    }

    /**
     * 최근 파일 목록 초기화
     */
    clearRecentFiles() {
        this._recentFiles = [];
        this._saveRecentFiles();
    }

    // =========================================================================
    // 유틸리티
    // =========================================================================

    /**
     * EquipmentEditState 설정
     * @param {Object} editState - EquipmentEditState 인스턴스
     */
    setEditState(editState) {
        this._editState = editState;
    }

    /**
     * 파일 형식 버전 조회
     * @returns {string}
     */
    getFileFormatVersion() {
        return FILE_FORMAT_VERSION;
    }

    /**
     * 지원 버전 목록 조회
     * @returns {string[]}
     */
    getSupportedVersions() {
        return [...SUPPORTED_VERSIONS];
    }

    /**
     * 빈 파일 템플릿 생성
     * @param {Object} meta - 메타데이터
     * @returns {Object}
     */
    createEmptyTemplate(meta = {}) {
        return this._createFileData({}, {
            siteId: meta.siteId || this._defaultSiteId,
            siteName: meta.siteName || this._defaultSiteName,
            description: meta.description || 'Empty template',
            exportedBy: meta.exportedBy || ''
        });
    }

    /**
     * 파일 미리보기 데이터 생성
     * @param {Object} data - 파일 데이터
     * @returns {Object} 미리보기 정보
     */
    getFilePreview(data) {
        const validation = this.validateFileData(data);
        
        return {
            isValid: validation.valid,
            version: data.version,
            siteId: data.meta?.siteId,
            siteName: data.meta?.siteName,
            mappingCount: Object.keys(data.mappings || {}).length,
            completionRate: data.meta?.completionRate,
            createdAt: data.meta?.createdAt,
            modifiedAt: data.meta?.modifiedAt,
            description: data.meta?.description,
            warnings: validation.warnings,
            errors: validation.errors,
            // 샘플 매핑 (처음 5개)
            sampleMappings: Object.entries(data.mappings || {})
                .slice(0, 5)
                .map(([id, m]) => ({
                    frontendId: id,
                    equipmentId: m.equipment_id,
                    equipmentName: m.equipment_name
                }))
        };
    }
}

// 싱글톤 인스턴스
const mappingFileManager = new MappingFileManager();

// Named exports
export { MappingFileManager, mappingFileManager, FILE_FORMAT_VERSION, SUPPORTED_VERSIONS };

// Default export
export default mappingFileManager;

// 전역 등록
if (typeof window !== 'undefined') {
    window.MappingFileManager = MappingFileManager;
    window.mappingFileManager = mappingFileManager;
}

console.log('✅ MappingFileManager.js v1.0.0 로드 완료');