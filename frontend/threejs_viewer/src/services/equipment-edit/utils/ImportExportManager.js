/**
 * ImportExportManager.js - JSON Import/Export 유틸리티
 * @version 1.1.0
 * 📁 위치: frontend/threejs_viewer/src/services/equipment-edit/utils/ImportExportManager.js
 */

import { debugLog } from '../../../core/utils/Config.js';

export class ImportExportManager {
    static exportToJson(mappings, options = {}) {
        return JSON.stringify({
            version: options.version || '2.0.0',
            exported_at: new Date().toISOString(),
            edit_mode: options.editModeEnabled || false,
            mapping_count: Object.keys(mappings).length,
            mappings
        }, null, 2);
    }

    static importFromJson(jsonStr, validateFn = null) {
        try {
            const data = JSON.parse(jsonStr);
            if (!data.mappings) {
                return { success: false, error: 'No mappings found in JSON' };
            }
            if (validateFn && !validateFn(data.mappings)) {
                return { success: false, error: 'Invalid mapping data format' };
            }
            debugLog(`📥 Mappings imported from JSON: ${Object.keys(data.mappings).length}개`);
            return { success: true, data: data.mappings, version: data.version };
        } catch (error) {
            console.error('Failed to import JSON:', error);
            return { success: false, error: error.message };
        }
    }

    static exportToFile(mappings, options = {}) {
        const json = this.exportToJson(mappings, options);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `equipment-mappings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        debugLog('📁 Mappings exported to file');
    }

    static toServerFormat(mappings) {
        return Object.values(mappings);
    }

    static fromServerFormat(serverArray) {
        const result = {};
        serverArray.forEach(item => {
            if (item.frontend_id) {
                result[item.frontend_id] = item;
            }
        });
        return result;
    }
}