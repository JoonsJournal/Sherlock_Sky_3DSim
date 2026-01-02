/**
 * AdaptivePerformance.js
 * 적응형 성능 관리 (쉽게 ON/OFF 가능)
 */

import * as THREE from 'three';
import { debugLog } from './Config.js';

// ===== Feature Flag =====
const ENABLE_ADAPTIVE_PERFORMANCE = true; // ✅ false로 변경하면 완전히 비활성화

export class AdaptivePerformance {
    constructor(renderer, scene, camera, performanceMonitor) {
        // Feature Flag 체크
        if (!ENABLE_ADAPTIVE_PERFORMANCE) {
            console.log('⚠️ AdaptivePerformance 비활성화됨 (ENABLE_ADAPTIVE_PERFORMANCE = false)');
            this.enabled = false;
            return;
        }
        
        this.enabled = true;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.performanceMonitor = performanceMonitor;
        
        // 목표 설정
        this.targetFPS = 60;
        this.minAcceptableFPS = 30;
        
        // 품질 레벨
        this.qualityLevel = 2; // 기본값: 중간
        this.maxQualityLevel = 4;
        
        // 조정 설정
        this.adjustmentEnabled = false; // 기본: OFF
        this.adjustmentCooldown = 3000; // 3초
        this.lastAdjustment = 0;
        
        // ===== 성능 비교 데이터 =====
        this.comparisonData = {
            beforeAdaptive: {
                averageFPS: 0,
                minFPS: 0,
                drawCalls: 0,
                memory: 0,
                samples: 0
            },
            afterAdaptive: {
                averageFPS: 0,
                minFPS: 0,
                drawCalls: 0,
                memory: 0,
                samples: 0
            },
            isComparing: false,
            comparisonStartTime: 0
        };
        
        // 품질 프리셋
        this.qualityPresets = {
            0: { name: '최저', pixelRatio: 0.5, shadows: false, maxLights: 2 },
            1: { name: '낮음', pixelRatio: 0.75, shadows: false, maxLights: 4 },
            2: { name: '중간', pixelRatio: 1.0, shadows: true, maxLights: 6 },
            3: { name: '높음', pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadows: true, maxLights: 8 },
            4: { name: '최고', pixelRatio: Math.min(window.devicePixelRatio, 2), shadows: true, maxLights: 10 }
        };
        
        // 초기 품질 감지
        this.detectInitialQuality();
        
        debugLog('🎮 AdaptivePerformance 초기화 완료 (비활성화 상태)');
    }
    
    /**
     * ===== 초기 품질 감지 =====
     */
    detectInitialQuality() {
        if (!this.enabled) return;
        
        const gpu = this.performanceMonitor.systemInfo.gpu.toLowerCase();
        
        if (gpu.includes('nvidia rtx') || gpu.includes('amd rx 6')) {
            this.qualityLevel = 4;
        } else if (gpu.includes('nvidia gtx') || gpu.includes('amd radeon')) {
            this.qualityLevel = 3;
        } else if (gpu.includes('intel')) {
            this.qualityLevel = 1;
        } else {
            this.qualityLevel = 2;
        }
        
        this.applyQualityLevel(this.qualityLevel);
        debugLog(`🎯 초기 품질: ${this.qualityLevel} (${this.qualityPresets[this.qualityLevel].name})`);
    }
    
    /**
     * ===== 업데이트 (애니메이션 루프) =====
     */
    update() {
        if (!this.enabled || !this.adjustmentEnabled) return;
        
        const currentTime = performance.now();
        if (currentTime - this.lastAdjustment < this.adjustmentCooldown) return;
        
        const fps = this.performanceMonitor.metrics.currentFPS;
        const avgFPS = this.performanceMonitor.metrics.averageFPS;
        
        // 품질 하향 (FPS 낮음)
        if (avgFPS < this.minAcceptableFPS && this.qualityLevel > 0) {
            this.qualityLevel--;
            this.applyQualityLevel(this.qualityLevel);
            console.warn(`⬇️ 품질 낮춤: ${this.qualityPresets[this.qualityLevel].name} (FPS: ${avgFPS})`);
            this.lastAdjustment = currentTime;
        }
        // 품질 상향 (FPS 높음)
        else if (avgFPS > this.targetFPS * 0.9 && fps > this.targetFPS * 0.95 && this.qualityLevel < this.maxQualityLevel) {
            if (this.performanceMonitor.metrics.minFPS > this.targetFPS * 0.8) {
                this.qualityLevel++;
                this.applyQualityLevel(this.qualityLevel);
                console.log(`⬆️ 품질 향상: ${this.qualityPresets[this.qualityLevel].name} (FPS: ${avgFPS})`);
                this.lastAdjustment = currentTime;
            }
        }
        
        // 비교 데이터 수집
        if (this.comparisonData.isComparing) {
            this.collectComparisonData();
        }
    }
    
    /**
     * ===== 품질 적용 =====
     */
    applyQualityLevel(level) {
        if (!this.enabled) return;
        
        const preset = this.qualityPresets[level];
        if (!preset) return;
        
        this.renderer.setPixelRatio(preset.pixelRatio);
        this.renderer.shadowMap.enabled = preset.shadows;
        
        debugLog(`✅ 품질: ${preset.name} (레벨 ${level})`);
    }
    
    /**
     * ===== 적응형 성능 활성화/비활성화 =====
     */
    setEnabled(enabled) {
        if (!this.enabled) {
            console.warn('⚠️ AdaptivePerformance가 Feature Flag로 비활성화되어 있습니다');
            return;
        }
        
        this.adjustmentEnabled = enabled;
        
        if (enabled) {
            console.log('✅ 적응형 성능 활성화');
            this.startComparison();
        } else {
            console.log('🛑 적응형 성능 비활성화');
            this.stopComparison();
        }
    }
    
    /**
     * ===== 성능 비교 시작 =====
     */
    startComparison() {
        this.comparisonData.isComparing = true;
        this.comparisonData.comparisonStartTime = performance.now();
        
        // BEFORE 데이터 초기화
        this.comparisonData.beforeAdaptive = {
            averageFPS: this.performanceMonitor.metrics.averageFPS,
            minFPS: this.performanceMonitor.metrics.minFPS,
            drawCalls: this.performanceMonitor.metrics.drawCalls,
            memory: this.performanceMonitor.metrics.memoryUsagePercent,
            samples: 0
        };
        
        // AFTER 데이터 초기화
        this.comparisonData.afterAdaptive = {
            averageFPS: 0,
            minFPS: 999,
            drawCalls: 0,
            memory: 0,
            samples: 0
        };
        
        console.log('📊 성능 비교 시작...');
    }
    
    /**
     * ===== 성능 비교 중지 =====
     */
    stopComparison() {
        if (!this.comparisonData.isComparing) return;
        
        this.comparisonData.isComparing = false;
        
        // 최종 평균 계산
        if (this.comparisonData.afterAdaptive.samples > 0) {
            this.comparisonData.afterAdaptive.averageFPS /= this.comparisonData.afterAdaptive.samples;
            this.comparisonData.afterAdaptive.drawCalls /= this.comparisonData.afterAdaptive.samples;
            this.comparisonData.afterAdaptive.memory /= this.comparisonData.afterAdaptive.samples;
        }
        
        console.log('📊 성능 비교 완료');
    }
    
    /**
     * ===== 비교 데이터 수집 =====
     */
    collectComparisonData() {
        const metrics = this.performanceMonitor.metrics;
        const after = this.comparisonData.afterAdaptive;
        
        after.averageFPS += metrics.currentFPS;
        after.minFPS = Math.min(after.minFPS, metrics.currentFPS);
        after.drawCalls += metrics.drawCalls;
        after.memory += metrics.memoryUsagePercent;
        after.samples++;
    }
    
    /**
     * ===== 비교 리포트 =====
     */
    getComparisonReport() {
        if (!this.enabled) {
            return { error: 'AdaptivePerformance 비활성화됨' };
        }
        
        const before = this.comparisonData.beforeAdaptive;
        const after = this.comparisonData.afterAdaptive;
        
        if (after.samples === 0) {
            return { error: '비교 데이터 없음 (적응형 성능을 활성화하고 잠시 대기하세요)' };
        }
        
        const improvement = {
            fps: ((after.averageFPS - before.averageFPS) / before.averageFPS * 100).toFixed(1),
            minFPS: ((after.minFPS - before.minFPS) / before.minFPS * 100).toFixed(1),
            drawCalls: ((before.drawCalls - after.drawCalls) / before.drawCalls * 100).toFixed(1),
            memory: ((before.memory - after.memory) / before.memory * 100).toFixed(1)
        };
        
        return {
            before,
            after,
            improvement,
            verdict: this.getVerdict(improvement)
        };
    }
    
    /**
     * ===== 성능 개선 판정 =====
     */
    getVerdict(improvement) {
        const fpsImprovement = parseFloat(improvement.fps);
        
        if (fpsImprovement > 10) return { result: '우수', color: '#00ff00', recommendation: '적응형 성능 유지 권장' };
        if (fpsImprovement > 5) return { result: '양호', color: '#66ff66', recommendation: '적응형 성능 유지' };
        if (fpsImprovement > 0) return { result: '미미', color: '#ffff00', recommendation: '성능 차이가 작으나 유지 가능' };
        return { result: '불필요', color: '#ff9900', recommendation: '적응형 성능 비활성화 권장' };
    }
    
    /**
     * ===== 수동 품질 설정 =====
     */
    setQualityLevel(level) {
        if (!this.enabled) {
            console.warn('⚠️ AdaptivePerformance 비활성화됨');
            return;
        }
        
        if (level < 0 || level > this.maxQualityLevel) {
            console.error(`❌ 유효하지 않은 레벨: ${level} (0-${this.maxQualityLevel})`);
            return;
        }
        
        this.qualityLevel = level;
        this.applyQualityLevel(level);
        console.log(`🎨 품질: ${this.qualityPresets[level].name}`);
    }
    
    /**
     * ===== 전역 명령어 설정 =====
     */
    setupGlobalCommands() {
        window.toggleAdaptivePerformance = () => {
            if (!this.enabled) {
                console.warn('⚠️ AdaptivePerformance는 Feature Flag로 비활성화되어 있습니다');
                console.log('💡 활성화 방법: AdaptivePerformance.js에서 ENABLE_ADAPTIVE_PERFORMANCE = true로 설정');
                return;
            }
            this.setEnabled(!this.adjustmentEnabled);
        };
        
        window.setQualityLevel = (level) => this.setQualityLevel(level);
        
        window.getPerformanceComparison = () => {
            const report = this.getComparisonReport();
            
            if (report.error) {
                console.warn(`⚠️ ${report.error}`);
                return report;
            }
            
            console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #00ff00');
            console.log('%c📊 적응형 성능 비교 리포트', 'color: #00ff00; font-size: 16px; font-weight: bold');
            console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #00ff00');
            
            console.log('\n%c비교 전 (Adaptive OFF):', 'color: #ffff00; font-weight: bold');
            console.table(report.before);
            
            console.log('\n%c비교 후 (Adaptive ON):', 'color: #ffff00; font-weight: bold');
            console.table(report.after);
            
            console.log('\n%c개선율:', 'color: #ffff00; font-weight: bold');
            console.table(report.improvement);
            
            console.log(`\n%c판정: ${report.verdict.result}`, `color: ${report.verdict.color}; font-size: 14px; font-weight: bold`);
            console.log(`%c💡 ${report.verdict.recommendation}`, 'color: #00ff00');
            
            console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #00ff00');
            
            return report;
        };
    }
}

// ===== Feature Flag Export =====
export const ADAPTIVE_PERFORMANCE_ENABLED = ENABLE_ADAPTIVE_PERFORMANCE;