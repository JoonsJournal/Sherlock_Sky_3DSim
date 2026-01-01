/**
 * BackupManager.js
 * 
 * Layout 파일 백업 관리 시스템
 * 저장 전 기존 파일 백업, 오래된 백업 정리
 * 
 * @module BackupManager
 * @version 1.0.0 - Phase 3.3: 저장 프로세스 통합
 * 
 * 위치: frontend/threejs_viewer/src/services/layout/BackupManager.js
 * 
 * 백업 파일 명명 규칙:
 * - {siteId}.backup_{YYYY-MM-DDTHH-mm}.json
 * - 예: korea_site1_line1.backup_2025-01-20T14-45.json
 */

class BackupManager {
    constructor() {
        this.basePath = '/layouts/';
        this.maxBackups = 5;  // 사이트당 최대 백업 수
        this.backupPrefix = '.backup_';
        
        console.log('[BackupManager] ✅ Initialized v1.0.0');
    }

    /**
     * 백업 파일 이름 생성
     * @param {string} siteId - Site ID
     * @param {Date} timestamp - 백업 시각 (기본: 현재 시각)
     * @returns {string} 백업 파일 이름
     */
    generateBackupFilename(siteId, timestamp = new Date()) {
        const dateStr = timestamp.toISOString()
            .replace(/:/g, '-')      // : → -
            .replace(/\.\d{3}Z$/, '') // .000Z 제거
            .replace('T', 'T');       // T 유지
        
        return `${siteId}${this.backupPrefix}${dateStr}.json`;
    }

    /**
     * 백업 타임스탬프 파싱
     * @param {string} filename - 백업 파일 이름
     * @returns {Date|null} 백업 시각 또는 null
     */
    parseBackupTimestamp(filename) {
        const match = filename.match(/\.backup_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.json$/);
        if (!match) return null;
        
        const dateStr = match[1].replace(/-(\d{2})-(\d{2})$/, ':$1:$2');
        return new Date(dateStr);
    }

    /**
     * 백업 생성 (브라우저 환경 - 다운로드 트리거)
     * @param {string} siteId - Site ID
     * @param {Object} layoutData - 백업할 Layout 데이터
     * @returns {Object} 백업 정보 { success, filename, timestamp }
     */
    createBackup(siteId, layoutData) {
        try {
            console.log(`[BackupManager] 📦 Creating backup for: ${siteId}`);
            
            const timestamp = new Date();
            const filename = this.generateBackupFilename(siteId, timestamp);
            
            // 백업 메타데이터 추가
            const backupData = {
                ...layoutData,
                _backup_info: {
                    original_site_id: siteId,
                    backup_timestamp: timestamp.toISOString(),
                    backup_filename: filename,
                    is_backup: true
                }
            };
            
            // JSON 직렬화
            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // 다운로드 트리거 (브라우저 환경)
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`[BackupManager] ✅ Backup created: ${filename}`);
            console.log(`[BackupManager] 📁 Save to: threejs_viewer/public/layouts/`);
            console.log(`[BackupManager] Size: ${(blob.size / 1024).toFixed(2)} KB`);
            
            return {
                success: true,
                filename: filename,
                timestamp: timestamp,
                size: blob.size
            };
            
        } catch (error) {
            console.error('[BackupManager] ❌ Error creating backup:', error);
            return {
                success: false,
                filename: null,
                timestamp: null,
                error: error.message
            };
        }
    }

    /**
     * 백업에서 복원 (다운로드된 백업 파일 로드)
     * @param {File} backupFile - 백업 파일
     * @returns {Promise<Object>} 복원된 Layout 데이터
     */
    async restoreFromBackup(backupFile) {
        return new Promise((resolve, reject) => {
            console.log(`[BackupManager] 📂 Restoring from backup: ${backupFile.name}`);
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const layoutData = JSON.parse(e.target.result);
                    
                    // 백업 메타데이터 제거
                    if (layoutData._backup_info) {
                        console.log('[BackupManager] Backup info:', layoutData._backup_info);
                        delete layoutData._backup_info;
                    }
                    
                    // 복원 시각 추가
                    layoutData.restored_at = new Date().toISOString();
                    layoutData.restored_from = backupFile.name;
                    
                    console.log('[BackupManager] ✅ Backup restored successfully');
                    resolve(layoutData);
                    
                } catch (error) {
                    console.error('[BackupManager] ❌ Error parsing backup:', error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('[BackupManager] ❌ Error reading backup file:', error);
                reject(error);
            };
            
            reader.readAsText(backupFile);
        });
    }

    /**
     * 백업 목록 조회 (LocalStorage 기반)
     * 실제 파일 시스템 접근 불가하므로 메타데이터만 관리
     * @param {string} siteId - Site ID
     * @returns {Array} 백업 목록
     */
    getBackupList(siteId) {
        try {
            const storageKey = `backup_list_${siteId}`;
            const stored = localStorage.getItem(storageKey);
            
            if (!stored) return [];
            
            const backups = JSON.parse(stored);
            console.log(`[BackupManager] 📋 Found ${backups.length} backups for ${siteId}`);
            
            return backups;
            
        } catch (error) {
            console.error('[BackupManager] Error getting backup list:', error);
            return [];
        }
    }

    /**
     * 백업 목록에 추가 (LocalStorage)
     * @param {string} siteId - Site ID
     * @param {Object} backupInfo - 백업 정보
     */
    addToBackupList(siteId, backupInfo) {
        try {
            const storageKey = `backup_list_${siteId}`;
            const backups = this.getBackupList(siteId);
            
            // 새 백업 추가
            backups.unshift({
                filename: backupInfo.filename,
                timestamp: backupInfo.timestamp.toISOString(),
                size: backupInfo.size
            });
            
            // 최대 개수 유지
            if (backups.length > this.maxBackups) {
                const removed = backups.splice(this.maxBackups);
                console.log(`[BackupManager] 🗑️ Removed ${removed.length} old backup records`);
            }
            
            localStorage.setItem(storageKey, JSON.stringify(backups));
            console.log(`[BackupManager] 📝 Backup list updated for ${siteId}`);
            
        } catch (error) {
            console.error('[BackupManager] Error updating backup list:', error);
        }
    }

    /**
     * 백업 필요 여부 확인
     * @param {Object} layoutData - 현재 Layout 데이터
     * @param {string} siteId - Site ID
     * @returns {boolean} 백업 필요 여부
     */
    shouldCreateBackup(layoutData, siteId) {
        // 신규 Layout인 경우 백업 불필요
        if (layoutData.is_new || layoutData.layout_version === 1) {
            console.log('[BackupManager] Skip backup: New layout');
            return false;
        }
        
        // 버전이 있는 경우 백업 필요
        if (layoutData.layout_version && layoutData.layout_version > 1) {
            console.log('[BackupManager] Backup required: Version > 1');
            return true;
        }
        
        // 마지막 수정 시각이 있는 경우 백업 필요
        if (layoutData.last_modified || layoutData.updated_at) {
            console.log('[BackupManager] Backup required: Previously modified');
            return true;
        }
        
        return false;
    }

    /**
     * 백업 정보 포맷팅 (UI 표시용)
     * @param {Object} backupInfo - 백업 정보
     * @returns {string} 포맷된 문자열
     */
    formatBackupInfo(backupInfo) {
        const date = new Date(backupInfo.timestamp);
        const dateStr = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const sizeKB = (backupInfo.size / 1024).toFixed(1);
        
        return `${dateStr} (${sizeKB} KB)`;
    }

    /**
     * 디버그 정보 출력
     */
    debug() {
        console.log('[BackupManager] Debug Info:', {
            basePath: this.basePath,
            maxBackups: this.maxBackups,
            backupPrefix: this.backupPrefix
        });
    }
}

// Singleton 인스턴스 생성
const backupManager = new BackupManager();

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.backupManager = backupManager;
}

// ES Module export
export default backupManager;
export { BackupManager };