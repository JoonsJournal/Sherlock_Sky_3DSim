/**
 * StatisticsCalculator.js - 통계 계산 유틸리티
 * @version 1.1.0
 * 📁 위치: frontend/threejs_viewer/src/services/equipment-edit/utils/StatisticsCalculator.js
 */

export class StatisticsCalculator {
    static getCompletionRate(mappings, totalEquipment = 117) {
        const mapped = Object.keys(mappings).length;
        return Math.round((mapped / totalEquipment) * 100);
    }

    static getUnmappedIds(mappings, allFrontendIds) {
        return allFrontendIds.filter(id => !(id in mappings));
    }

    static getStatistics(mappings) {
        const values = Object.values(mappings);
        
        // Line별 통계
        const lineStats = {};
        values.forEach(m => {
            const lineName = m.line_name || 'Unknown';
            lineStats[lineName] = (lineStats[lineName] || 0) + 1;
        });

        return {
            total: values.length,
            hasTimestamp: values.filter(m => m.mapped_at).length,
            hasLineName: values.filter(m => m.line_name).length,
            lineStats,
            oldestMapping: values.reduce((oldest, m) => {
                if (!oldest || (m.mapped_at && m.mapped_at < oldest)) return m.mapped_at;
                return oldest;
            }, null),
            newestMapping: values.reduce((newest, m) => {
                if (!newest || (m.mapped_at && m.mapped_at > newest)) return m.mapped_at;
                return newest;
            }, null)
        };
    }

    static getSummary(mappings, totalEquipment = 117) {
        const count = Object.keys(mappings).length;
        return {
            mapped: count,
            total: totalEquipment,
            unmapped: totalEquipment - count,
            rate: this.getCompletionRate(mappings, totalEquipment)
        };
    }
}