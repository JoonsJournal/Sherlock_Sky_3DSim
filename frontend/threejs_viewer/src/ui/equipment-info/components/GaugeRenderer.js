/**
 * GaugeRenderer.js
 * ================
 * Gauge 렌더링 컴포넌트
 * 
 * @version 1.0.0
 * @description
 * - CPU, Memory, Disk 사용율 Gauge 렌더링
 * - 색상 결정 (green/yellow/red/gray)
 * - 다양한 값 포맷 지원 (%, GB/GB, N/A)
 * - Single Selection / Multi Selection 공통 사용
 * 
 * @example
 * // CPU Gauge (퍼센트)
 * GaugeRenderer.render('CPU', 45.5, { type: 'percent' });
 * 
 * // Memory Gauge (Used/Total GB)
 * GaugeRenderer.render('Mem', 62, { type: 'usage', used: 8.5, total: 16, unit: 'GB' });
 * 
 * // Disk D N/A
 * GaugeRenderer.renderNA('D:');
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/components/GaugeRenderer.js
 * 작성일: 2026-01-09 1
 */

/**
 * Gauge 렌더링 클래스 (정적 메서드만 포함)
 */
export class GaugeRenderer {
    
    // =========================================================================
    // 색상 결정
    // =========================================================================
    
    /**
     * Gauge 색상 결정
     * @param {number|null} percent - 퍼센트 값 (0-100)
     * @returns {string} CSS 클래스명 ('gauge-green' | 'gauge-yellow' | 'gauge-red' | 'gauge-gray')
     * 
     * @example
     * GaugeRenderer.getColor(45);   // 'gauge-green'
     * GaugeRenderer.getColor(65);   // 'gauge-yellow'
     * GaugeRenderer.getColor(85);   // 'gauge-red'
     * GaugeRenderer.getColor(null); // 'gauge-gray'
     */
    static getColor(percent) {
        if (percent === null || percent === undefined) return 'gauge-gray';
        if (percent < 50) return 'gauge-green';
        if (percent < 80) return 'gauge-yellow';
        return 'gauge-red';
    }
    
    /**
     * Gauge 색상 결정 (임계값 커스텀)
     * @param {number|null} percent - 퍼센트 값
     * @param {Object} thresholds - 임계값 설정
     * @param {number} thresholds.warning - 경고 임계값 (기본: 50)
     * @param {number} thresholds.danger - 위험 임계값 (기본: 80)
     * @returns {string} CSS 클래스명
     */
    static getColorWithThresholds(percent, thresholds = {}) {
        const { warning = 50, danger = 80 } = thresholds;
        
        if (percent === null || percent === undefined) return 'gauge-gray';
        if (percent < warning) return 'gauge-green';
        if (percent < danger) return 'gauge-yellow';
        return 'gauge-red';
    }
    
    // =========================================================================
    // Gauge 렌더링
    // =========================================================================
    
    /**
     * Unified Gauge 렌더링 (메인 메서드)
     * @param {string} label - 라벨 (예: 'CPU', 'Mem', 'C:', 'D:')
     * @param {number|null} percent - 퍼센트 값 (0-100)
     * @param {Object} options - 렌더링 옵션
     * @param {string} [options.type='percent'] - 값 타입 ('percent' | 'usage')
     * @param {number} [options.used] - 사용량 (type='usage'일 때)
     * @param {number} [options.total] - 전체량 (type='usage'일 때)
     * @param {string} [options.unit='GB'] - 단위 (type='usage'일 때)
     * @param {number} [options.decimals=1] - 소수점 자리수
     * @param {number} [options.usedDecimals] - 사용량 소수점 (기본: decimals)
     * @param {number} [options.totalDecimals] - 전체량 소수점 (기본: 0)
     * @returns {string} HTML 문자열
     * 
     * @example
     * // CPU: 45.5%
     * GaugeRenderer.render('CPU', 45.5, { type: 'percent' });
     * 
     * // Memory: 8.5/16 GB
     * GaugeRenderer.render('Mem', 53, { type: 'usage', used: 8.5, total: 16, unit: 'GB' });
     * 
     * // Disk C: 120/256 GB (정수)
     * GaugeRenderer.render('C:', 47, { type: 'usage', used: 120, total: 256, unit: 'GB', usedDecimals: 0 });
     */
    static render(label, percent, options = {}) {
        const {
            type = 'percent',
            used = null,
            total = null,
            unit = 'GB',
            decimals = 1,
            usedDecimals = decimals,
            totalDecimals = 0
        } = options;
        
        const colorClass = GaugeRenderer.getColor(percent);
        const widthPercent = percent ?? 0;
        
        // 값 포맷팅
        let valueDisplay;
        if (type === 'usage' && used !== null && total !== null) {
            // Usage 타입: "8.5/16 GB" 형식
            const usedStr = used !== null ? used.toFixed(usedDecimals) : '-';
            const totalStr = total !== null ? total.toFixed(totalDecimals) : '-';
            valueDisplay = `${usedStr}/${totalStr} ${unit}`;
        } else {
            // Percent 타입: "45.5%" 형식
            valueDisplay = percent !== null && percent !== undefined 
                ? `${percent.toFixed(decimals)}%` 
                : '-';
        }
        
        return `
            <div class="unified-gauge-row">
                <span class="unified-gauge-label">${label}</span>
                <div class="unified-gauge-container">
                    <div class="unified-gauge-bar">
                        <div class="unified-gauge-fill ${colorClass}" style="width: ${widthPercent}%"></div>
                    </div>
                    <span class="unified-gauge-value">${valueDisplay}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * N/A Gauge 렌더링 (Disk D 없는 경우 등)
     * @param {string} label - 라벨
     * @param {string} [message='N/A'] - 표시 메시지
     * @returns {string} HTML 문자열
     * 
     * @example
     * GaugeRenderer.renderNA('D:');
     * GaugeRenderer.renderNA('D:', 'N/A (일부 D: 없음)');
     */
    static renderNA(label, message = 'N/A') {
        return `
            <div class="unified-gauge-row">
                <span class="unified-gauge-label">${label}</span>
                <span class="unified-gauge-na">${message}</span>
            </div>
        `;
    }
    
    // =========================================================================
    // 특화 렌더링 메서드 (편의성)
    // =========================================================================
    
    /**
     * CPU Gauge 렌더링
     * @param {number|null} percent - CPU 사용율 (%)
     * @param {Object} [options] - 추가 옵션
     * @returns {string} HTML 문자열
     */
    static renderCPU(percent, options = {}) {
        return GaugeRenderer.render('CPU', percent, {
            type: 'percent',
            decimals: 1,
            ...options
        });
    }
    
    /**
     * Memory Gauge 렌더링
     * @param {number|null} usedGb - 사용 중인 메모리 (GB)
     * @param {number|null} totalGb - 전체 메모리 (GB)
     * @param {Object} [options] - 추가 옵션
     * @returns {string} HTML 문자열
     */
    static renderMemory(usedGb, totalGb, options = {}) {
        const percent = (totalGb && usedGb) 
            ? Math.round((usedGb / totalGb) * 100) 
            : null;
        
        return GaugeRenderer.render('Mem', percent, {
            type: 'usage',
            used: usedGb,
            total: totalGb,
            unit: 'GB',
            usedDecimals: 1,
            totalDecimals: 0,
            ...options
        });
    }
    
    /**
     * Disk Gauge 렌더링
     * @param {string} label - 드라이브 라벨 ('C:' | 'D:')
     * @param {number|null} usedGb - 사용 중인 용량 (GB)
     * @param {number|null} totalGb - 전체 용량 (GB)
     * @param {Object} [options] - 추가 옵션
     * @param {boolean} [options.showNA=false] - N/A 표시 여부 (total이 없을 때)
     * @param {string} [options.naMessage='N/A'] - N/A 메시지
     * @returns {string} HTML 문자열
     */
    static renderDisk(label, usedGb, totalGb, options = {}) {
        const { showNA = false, naMessage = 'N/A', ...restOptions } = options;
        
        // Disk가 없는 경우 (totalGb가 null이거나 0)
        const hasDisk = totalGb !== null && totalGb > 0;
        
        if (!hasDisk && showNA) {
            return GaugeRenderer.renderNA(label, naMessage);
        }
        
        const percent = (totalGb && usedGb) 
            ? Math.round((usedGb / totalGb) * 100) 
            : null;
        
        return GaugeRenderer.render(label, percent, {
            type: 'usage',
            used: usedGb,
            total: totalGb,
            unit: 'GB',
            usedDecimals: 0,
            totalDecimals: 0,
            ...restOptions
        });
    }
    
    /**
     * 평균 Gauge 렌더링 (Multi Selection용)
     * @param {string} label - 라벨
     * @param {number|null} avgPercent - 평균 퍼센트
     * @param {Object} [options] - 추가 옵션
     * @returns {string} HTML 문자열
     */
    static renderAverage(label, avgPercent, options = {}) {
        return GaugeRenderer.render(label, avgPercent, {
            type: 'percent',
            decimals: 1,
            ...options
        });
    }
    
    // =========================================================================
    // Gauge Section 렌더링
    // =========================================================================
    
    /**
     * Gauge Section 전체 렌더링 (Single Selection)
     * @param {Object} data - 설비 데이터
     * @param {string} [title='Resource Usage'] - 섹션 타이틀
     * @returns {string} HTML 문자열
     */
    static renderSection(data, title = 'Resource Usage') {
        const {
            cpu_usage_percent,
            memory_used_gb,
            memory_total_gb,
            disk_c_used_gb,
            disk_c_total_gb,
            disk_d_used_gb,
            disk_d_total_gb
        } = data;
        
        const hasDiskD = disk_d_total_gb !== null && disk_d_total_gb > 0;
        
        return `
            <div class="gauge-section">
                <div class="gauge-section-title">${title}</div>
                ${GaugeRenderer.renderCPU(cpu_usage_percent)}
                ${GaugeRenderer.renderMemory(memory_used_gb, memory_total_gb)}
                ${GaugeRenderer.renderDisk('C:', disk_c_used_gb, disk_c_total_gb)}
                ${hasDiskD 
                    ? GaugeRenderer.renderDisk('D:', disk_d_used_gb, disk_d_total_gb)
                    : GaugeRenderer.renderNA('D:')
                }
            </div>
        `;
    }
    
    /**
     * Gauge Section 전체 렌더링 (Multi Selection - 평균)
     * @param {Object} data - 집계 데이터
     * @param {string} [title='Avg Resource Usage'] - 섹션 타이틀
     * @returns {string} HTML 문자열
     */
    static renderSectionMulti(data, title = 'Avg Resource Usage') {
        const {
            avg_cpu_usage_percent,
            avg_memory_usage_percent,
            avg_disk_c_usage_percent,
            avg_disk_d_usage_percent
        } = data;
        
        const hasDiskD = avg_disk_d_usage_percent !== null && avg_disk_d_usage_percent !== undefined;
        
        return `
            <div class="gauge-section">
                <div class="gauge-section-title">${title}</div>
                ${GaugeRenderer.renderAverage('CPU', avg_cpu_usage_percent)}
                ${GaugeRenderer.renderAverage('Mem', avg_memory_usage_percent)}
                ${GaugeRenderer.renderAverage('C:', avg_disk_c_usage_percent)}
                ${hasDiskD 
                    ? GaugeRenderer.renderAverage('D:', avg_disk_d_usage_percent)
                    : GaugeRenderer.renderNA('D:', 'N/A (일부 D: 없음)')
                }
            </div>
        `;
    }
}

// 기본 내보내기
export default GaugeRenderer;