/**
 * DataFormatter.js
 * ================
 * 데이터 포맷팅 유틸리티
 * 
 * @version 2.1.0
 * @changelog
 * - v2.1.0: Production Count, Tact Time 포맷 함수 추가
 *           - formatTactTime(): Tact Time 초 → "MM:SS" 또는 "SS.X sec" 형식
 *           - formatProductionCount(): 생산 개수 → "N pcs" 형식
 *           - 기존 기능 100% 호환 유지
 * - v1.0.0: 초기 버전
 * 
 * @description
 * - 날짜/시간 포맷팅
 * - Boot Duration 포맷팅
 * - 리스트 "외 N개" 포맷팅
 * - CPU 이름 축약
 * - 🆕 Tact Time 포맷팅
 * - 🆕 Production Count 포맷팅
 * 
 * 📁 위치: frontend/threejs_viewer/src/ui/equipment-info/utils/DataFormatter.js
 * 작성일: 2026-01-09
 * 수정일: 2026-01-16
 */

/**
 * 데이터 포맷팅 유틸리티 객체
 */
export const DataFormatter = {
    
    // =========================================================================
    // 날짜/시간 포맷팅
    // =========================================================================
    
    /**
     * ISO 날짜 문자열을 한국어 형식으로 포맷
     * @param {string} isoString - ISO 8601 형식 문자열
     * @param {Object} [options] - 포맷 옵션
     * @param {boolean} [options.includeSeconds=false] - 초 포함 여부
     * @returns {string} 포맷된 날짜 문자열 (예: "2026. 01. 09. 14:30")
     * 
     * @example
     * DataFormatter.formatDateTime('2026-01-09T14:30:00Z');
     * // => "2026. 01. 09. 14:30"
     */
    formatDateTime(isoString, options = {}) {
        if (!isoString) return '-';
        
        try {
            const date = new Date(isoString);
            
            // Invalid Date 체크
            if (isNaN(date.getTime())) {
                return isoString;
            }
            
            const formatOptions = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };
            
            if (options.includeSeconds) {
                formatOptions.second = '2-digit';
            }
            
            return date.toLocaleString('ko-KR', formatOptions);
        } catch (e) {
            console.error('DataFormatter.formatDateTime error:', e);
            return isoString;
        }
    },
    
    /**
     * 날짜만 포맷 (시간 제외)
     * @param {string} isoString - ISO 8601 형식 문자열
     * @returns {string} 포맷된 날짜 문자열 (예: "2026. 01. 09")
     */
    formatDate(isoString) {
        if (!isoString) return '-';
        
        try {
            const date = new Date(isoString);
            
            if (isNaN(date.getTime())) {
                return isoString;
            }
            
            return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    },
    
    /**
     * 시간만 포맷 (날짜 제외)
     * @param {string} isoString - ISO 8601 형식 문자열
     * @returns {string} 포맷된 시간 문자열 (예: "14:30:00")
     */
    formatTime(isoString) {
        if (!isoString) return '-';
        
        try {
            const date = new Date(isoString);
            
            if (isNaN(date.getTime())) {
                return isoString;
            }
            
            return date.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    },
    
    // =========================================================================
    // Boot Duration 포맷팅
    // =========================================================================
    
    /**
     * Boot Duration 포맷 (PC 가동 시간)
     * @param {string} lastBootTime - 마지막 부팅 시간 (ISO 형식)
     * @returns {string} 포맷된 가동 시간 (예: "5d 12h 30m", "12h 30m", "30m")
     * 
     * @example
     * DataFormatter.formatBootDuration('2026-01-04T10:00:00Z');
     * // => "5d 12h 30m" (5일 12시간 30분 전에 부팅)
     */
    formatBootDuration(lastBootTime) {
        if (!lastBootTime) return '-';
        
        try {
            const bootTime = new Date(lastBootTime);
            const now = new Date();
            
            // Invalid Date 체크
            if (isNaN(bootTime.getTime())) {
                return '-';
            }
            
            let diffMs = now - bootTime;
            if (diffMs < 0) diffMs = 0;
            
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (days > 0) {
                return `${days}d ${hours}h ${minutes}m`;
            } else if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        } catch (e) {
            console.error('DataFormatter.formatBootDuration error:', e);
            return '-';
        }
    },
    
    /**
     * Boot Duration 경고 클래스 반환
     * @param {string} lastBootTime - 마지막 부팅 시간 (ISO 형식)
     * @returns {string} CSS 클래스 ('danger' | 'warning' | '')
     * 
     * @example
     * DataFormatter.getBootDurationClass('2025-12-01T10:00:00Z');
     * // => "danger" (30일 이상)
     */
    getBootDurationClass(lastBootTime) {
        if (!lastBootTime) return '';
        
        try {
            const bootTime = new Date(lastBootTime);
            const now = new Date();
            
            if (isNaN(bootTime.getTime())) {
                return '';
            }
            
            const diffDays = (now - bootTime) / (1000 * 60 * 60 * 24);
            
            if (diffDays >= 30) return 'danger';   // 30일 이상: 위험
            if (diffDays >= 14) return 'warning';  // 14일 이상: 경고
            return '';
        } catch (e) {
            return '';
        }
    },
    
    /**
     * Boot Duration 경과 일수 반환
     * @param {string} lastBootTime - 마지막 부팅 시간
     * @returns {number} 경과 일수 (소수점 포함)
     */
    getBootDurationDays(lastBootTime) {
        if (!lastBootTime) return 0;
        
        try {
            const bootTime = new Date(lastBootTime);
            const now = new Date();
            
            if (isNaN(bootTime.getTime())) {
                return 0;
            }
            
            return (now - bootTime) / (1000 * 60 * 60 * 24);
        } catch (e) {
            return 0;
        }
    },
    
    // =========================================================================
    // 🆕 v2.1.0: Tact Time 포맷팅
    // =========================================================================
    
    /**
     * Tact Time 포맷팅 (초 → 시간 형식)
     * @param {number|null} seconds - 초 단위 Tact Time
     * @param {string} [suffix] - 접미사 (예: '평균')
     * @returns {string} 포맷된 Tact Time
     * 
     * @example
     * DataFormatter.formatTactTime(72.5);        // "01:12"
     * DataFormatter.formatTactTime(45.3);        // "45.3 sec"
     * DataFormatter.formatTactTime(125.0);       // "02:05"
     * DataFormatter.formatTactTime(68.3, '평균'); // "01:08 (평균)"
     * DataFormatter.formatTactTime(null);        // "-"
     */
    formatTactTime(seconds, suffix = null) {
        if (seconds == null || isNaN(seconds)) {
            return '-';
        }
        
        let formatted;
        
        if (seconds < 60) {
            // 60초 미만: "SS.X sec" 형식
            formatted = `${seconds.toFixed(1)} sec`;
        } else {
            // 60초 이상: "MM:SS" 형식
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            formatted = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        // 접미사 추가
        if (suffix) {
            formatted += ` (${suffix})`;
        }
        
        return formatted;
    },
    
    /**
     * Tact Time 경고 클래스 반환
     * @param {number|null} seconds - 초 단위 Tact Time
     * @param {number} [warningThreshold=120] - 경고 임계값 (초)
     * @param {number} [dangerThreshold=180] - 위험 임계값 (초)
     * @returns {string} CSS 클래스 ('danger' | 'warning' | '')
     * 
     * @example
     * DataFormatter.getTactTimeClass(150);  // "warning"
     * DataFormatter.getTactTimeClass(200);  // "danger"
     */
    getTactTimeClass(seconds, warningThreshold = 120, dangerThreshold = 180) {
        if (seconds == null || isNaN(seconds)) {
            return '';
        }
        
        if (seconds >= dangerThreshold) return 'danger';
        if (seconds >= warningThreshold) return 'warning';
        return '';
    },
    
    // =========================================================================
    // 🆕 v2.1.0: Production Count 포맷팅
    // =========================================================================
    
    /**
     * Production Count 포맷팅
     * @param {number|null} count - 생산 개수
     * @param {string} [suffix] - 접미사 (예: '합계')
     * @returns {string} 포맷된 Production Count (예: "127 pcs", "1,234 pcs (합계)")
     * 
     * @example
     * DataFormatter.formatProductionCount(127);          // "127 pcs"
     * DataFormatter.formatProductionCount(1234);         // "1,234 pcs"
     * DataFormatter.formatProductionCount(1234, '합계'); // "1,234 pcs (합계)"
     * DataFormatter.formatProductionCount(null);         // "-"
     */
    formatProductionCount(count, suffix = null) {
        if (count == null || isNaN(count)) {
            return '-';
        }
        
        // 천 단위 구분자 추가
        const formatted = count.toLocaleString('ko-KR');
        let result = `${formatted} pcs`;
        
        // 접미사 추가
        if (suffix) {
            result += ` (${suffix})`;
        }
        
        return result;
    },
    
    /**
     * Production Count 경고 클래스 반환 (저생산 경고)
     * @param {number|null} count - 생산 개수
     * @param {number} [lowThreshold=10] - 저생산 임계값
     * @returns {string} CSS 클래스 ('warning' | '')
     */
    getProductionCountClass(count, lowThreshold = 10) {
        if (count == null || isNaN(count)) {
            return '';
        }
        
        if (count < lowThreshold) return 'warning';
        return '';
    },
    
    // =========================================================================
    // 리스트 포맷팅
    // =========================================================================
    
    /**
     * 리스트를 "외 N개" 형식으로 포맷
     * @param {Array} items - 아이템 배열
     * @param {boolean|number} [hasMore] - 추가 항목 존재 여부 또는 총 개수
     * @param {number} [maxDisplay=3] - 최대 표시 개수
     * @returns {string} 포맷된 문자열 (HTML 포함 가능)
     * 
     * @example
     * DataFormatter.formatListWithMore(['A', 'B', 'C', 'D', 'E'], true);
     * // => "A, B, C <span class="more-count">외 2개</span>"
     * 
     * DataFormatter.formatListWithMore(['A', 'B'], false);
     * // => "A, B"
     */
    formatListWithMore(items, hasMore = false, maxDisplay = 3) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return '-';
        }
        
        // 최대 표시 개수만큼 자르기
        const displayItems = items.slice(0, maxDisplay);
        let result = displayItems.join(', ');
        
        // "외 N개" 추가 조건 확인
        const remainingCount = items.length - maxDisplay;
        
        if (hasMore || remainingCount > 0) {
            const moreCount = remainingCount > 0 ? remainingCount : '...';
            result += ` <span class="more-count">외 ${moreCount}개</span>`;
        }
        
        return result;
    },
    
    /**
     * 리스트를 간단한 텍스트로 포맷 (HTML 없음)
     * @param {Array} items - 아이템 배열
     * @param {number} [maxDisplay=3] - 최대 표시 개수
     * @returns {string} 포맷된 문자열
     * 
     * @example
     * DataFormatter.formatListSimple(['A', 'B', 'C', 'D'], 3);
     * // => "A, B, C 외 1개"
     */
    formatListSimple(items, maxDisplay = 3) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return '-';
        }
        
        const displayItems = items.slice(0, maxDisplay);
        let result = displayItems.join(', ');
        
        const remainingCount = items.length - maxDisplay;
        if (remainingCount > 0) {
            result += ` 외 ${remainingCount}개`;
        }
        
        return result;
    },
    
    // =========================================================================
    // CPU/하드웨어 이름 포맷팅
    // =========================================================================
    
    /**
     * CPU 이름 축약
     * @param {string} cpuName - 전체 CPU 이름
     * @returns {string} 축약된 CPU 이름
     * 
     * @example
     * DataFormatter.shortenCpuName('Intel(R) Core(TM) i7-12700K CPU @ 3.60GHz');
     * // => "i7-12700K"
     * 
     * DataFormatter.shortenCpuName('AMD Ryzen 9 5900X 12-Core Processor');
     * // => "Ryzen 9 5900X"
     */
    shortenCpuName(cpuName) {
        if (!cpuName) return '-';
        
        // Intel: "Intel(R) Core(TM) i7-12700K CPU @ 3.60GHz" -> "i7-12700K"
        const intelMatch = cpuName.match(/i[3579]-\d{4,5}[A-Z]*/i);
        if (intelMatch) {
            return intelMatch[0];
        }
        
        // AMD: "AMD Ryzen 9 5900X 12-Core Processor" -> "Ryzen 9 5900X"
        const amdMatch = cpuName.match(/Ryzen\s+\d+\s+\d{4}[A-Z]*/i);
        if (amdMatch) {
            return amdMatch[0];
        }
        
        // Xeon: "Intel(R) Xeon(R) E5-2680 v4 @ 2.40GHz" -> "Xeon E5-2680"
        const xeonMatch = cpuName.match(/Xeon.*?([A-Z]\d+-\d+)/i);
        if (xeonMatch) {
            return `Xeon ${xeonMatch[1]}`;
        }
        
        // 기타: @ 이전까지만
        let short = cpuName;
        if (cpuName.includes('@')) {
            short = cpuName.split('@')[0].trim();
        }
        
        // (R), (TM) 제거
        short = short.replace(/\(R\)/gi, '').replace(/\(TM\)/gi, '').trim();
        
        // 너무 길면 자르기
        if (short.length > 20) {
            short = short.substring(0, 20) + '...';
        }
        
        return short;
    },
    
    /**
     * GPU 이름 축약
     * @param {string} gpuName - 전체 GPU 이름
     * @returns {string} 축약된 GPU 이름
     * 
     * @example
     * DataFormatter.shortenGpuName('NVIDIA GeForce RTX 3080 Ti');
     * // => "RTX 3080 Ti"
     */
    shortenGpuName(gpuName) {
        if (!gpuName) return '-';
        
        // NVIDIA: "NVIDIA GeForce RTX 3080 Ti" -> "RTX 3080 Ti"
        const rtxMatch = gpuName.match(/RTX\s+\d{4}\s*(Ti|Super)?/i);
        if (rtxMatch) {
            return rtxMatch[0];
        }
        
        const gtxMatch = gpuName.match(/GTX\s+\d{4}\s*(Ti|Super)?/i);
        if (gtxMatch) {
            return gtxMatch[0];
        }
        
        // AMD: "AMD Radeon RX 6800 XT" -> "RX 6800 XT"
        const rxMatch = gpuName.match(/RX\s+\d{4}\s*(XT)?/i);
        if (rxMatch) {
            return rxMatch[0];
        }
        
        // Intel: "Intel UHD Graphics 630" -> "UHD 630"
        const uhdMatch = gpuName.match(/UHD\s*(Graphics\s*)?\d+/i);
        if (uhdMatch) {
            return uhdMatch[0].replace('Graphics ', '');
        }
        
        // 너무 길면 자르기
        if (gpuName.length > 25) {
            return gpuName.substring(0, 25) + '...';
        }
        
        return gpuName;
    },
    
    // =========================================================================
    // 숫자 포맷팅
    // =========================================================================
    
    /**
     * 바이트를 읽기 쉬운 형식으로 변환
     * @param {number} bytes - 바이트 수
     * @param {number} [decimals=1] - 소수점 자리수
     * @returns {string} 포맷된 문자열 (예: "1.5 GB")
     */
    formatBytes(bytes, decimals = 1) {
        if (bytes === null || bytes === undefined) return '-';
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },
    
    /**
     * 퍼센트 포맷팅
     * @param {number} value - 값
     * @param {number} [decimals=1] - 소수점 자리수
     * @returns {string} 포맷된 문자열 (예: "45.5%")
     */
    formatPercent(value, decimals = 1) {
        if (value === null || value === undefined) return '-';
        return value.toFixed(decimals) + '%';
    },
    
    /**
     * GB 값 포맷팅
     * @param {number} used - 사용량 (GB)
     * @param {number} total - 전체 (GB)
     * @param {number} [decimals=0] - 소수점 자리수
     * @returns {string} 포맷된 문자열 (예: "45/128 GB")
     */
    formatGbUsage(used, total, decimals = 0) {
        const usedStr = used !== null && used !== undefined ? used.toFixed(decimals) : '-';
        const totalStr = total !== null && total !== undefined ? total.toFixed(decimals) : '-';
        return `${usedStr}/${totalStr} GB`;
    }
};

// 기본 내보내기
export default DataFormatter;