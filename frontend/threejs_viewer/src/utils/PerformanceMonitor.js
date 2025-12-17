/**
 * PerformanceMonitor.js
 * 실시간 성능 모니터링 및 분석
 * - FPS, Frame Time, GPU 메모리, 네트워크 상태 등 추적
 * - 브라우저 콘솔에서 실시간 확인 가능
 */

import { CONFIG } from './Config.js';

export class PerformanceMonitor {
    constructor(renderer) {
        this.renderer = renderer;
        
        // 성능 메트릭
        this.metrics = {
            fps: 0,
            frameTime: 0,
            drawCalls: 0,
            triangles: 0,
            gpuMemory: 0,
            cpuUsage: 0,
            networkLatency: 0
        };
        
        // FPS 계산용
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsHistory = [];
        this.maxHistoryLength = 60; // 1초치 (60fps 기준)
        
        // 경고 임계값
        this.thresholds = {
            fps: {
                critical: 15,
                warning: 30,
                good: 50
            },
            frameTime: {
                critical: 66, // ~15fps
                warning: 33,  // ~30fps
                good: 16      // ~60fps
            },
            drawCalls: {
                critical: 1000,
                warning: 500,
                good: 300
            },
            triangles: {
                critical: 2000000,
                warning: 1000000,
                good: 500000
            },
            gpuMemory: {
                critical: 1024, // MB
                warning: 512,
                good: 256
            }
        };
        
        // 모니터링 상태
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.updateInterval = 1000; // 1초마다 업데이트
        
        // 성능 이슈 로그
        this.performanceIssues = [];
        this.maxIssuesLog = 10;
        
        // 네트워크 모니터링
        this.networkStats = {
            online: navigator.onLine,
            effectiveType: null,
            downlink: null,
            rtt: null
        };
        
        // 시스템 정보
        this.systemInfo = this.getSystemInfo();
        
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        console.log('🔍 PerformanceMonitor 초기화');
        
        // 네트워크 상태 모니터링
        this.setupNetworkMonitoring();
        
        // 브라우저 탭 가시성 모니터링
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('⏸️ 탭이 비활성화됨 - 모니터링 일시중지');
            } else {
                console.log('▶️ 탭이 활성화됨 - 모니터링 재개');
            }
        });
    }
    
    /**
     * 모니터링 시작
     */
    start() {
        if (this.isMonitoring) {
            console.warn('⚠️ 이미 모니터링 중입니다');
            return;
        }
        
        this.isMonitoring = true;
        console.log('▶️ 성능 모니터링 시작');
        
        // 주기적 업데이트
        this.monitoringInterval = setInterval(() => {
            this.logPerformanceMetrics();
        }, this.updateInterval);
    }
    
    /**
     * 모니터링 중지
     */
    stop() {
        if (!this.isMonitoring) {
            console.warn('⚠️ 모니터링이 실행 중이지 않습니다');
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        console.log('⏸️ 성능 모니터링 중지');
    }
    
    /**
     * 프레임마다 호출 (애니메이션 루프에서)
     */
    update() {
        const now = performance.now();
        const deltaTime = now - this.lastTime;
        
        this.frameCount++;
        
        // 1초마다 FPS 계산
        if (deltaTime >= 1000) {
            this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.metrics.frameTime = deltaTime / this.frameCount;
            
            // FPS 히스토리 업데이트
            this.fpsHistory.push(this.metrics.fps);
            if (this.fpsHistory.length > this.maxHistoryLength) {
                this.fpsHistory.shift();
            }
            
            this.frameCount = 0;
            this.lastTime = now;
            
            // 성능 이슈 체크
            this.checkPerformanceIssues();
        }
        
        // 렌더러 정보 업데이트
        if (this.renderer) {
            const info = this.renderer.info;
            this.metrics.drawCalls = info.render.calls;
            this.metrics.triangles = info.render.triangles;
            this.metrics.gpuMemory = this.estimateGPUMemory();
        }
    }
    
    /**
     * GPU 메모리 추정
     */
    estimateGPUMemory() {
        if (!this.renderer) return 0;
        
        const info = this.renderer.info;
        
        // 대략적인 메모리 계산 (MB)
        const geometryMemory = info.memory.geometries * 0.1; // 기하학당 ~100KB
        const textureMemory = info.memory.textures * 2; // 텍스처당 ~2MB
        
        return Math.round(geometryMemory + textureMemory);
    }
    
    /**
     * 시스템 정보 수집
     */
    getSystemInfo() {
        const info = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
            deviceMemory: navigator.deviceMemory || 'Unknown',
            maxTouchPoints: navigator.maxTouchPoints || 0,
            screen: {
                width: window.screen.width,
                height: window.screen.height,
                colorDepth: window.screen.colorDepth,
                pixelRatio: window.devicePixelRatio
            }
        };
        
        // WebGL 정보
        if (this.renderer) {
            const gl = this.renderer.getContext();
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            
            if (debugInfo) {
                info.gpu = {
                    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                };
            }
            
            info.webgl = {
                version: gl.getParameter(gl.VERSION),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
            };
        }
        
        return info;
    }
    
    /**
     * 네트워크 모니터링 설정
     */
    setupNetworkMonitoring() {
        // Network Information API (지원하는 브라우저만)
        if ('connection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            if (connection) {
                this.updateNetworkInfo(connection);
                
                connection.addEventListener('change', () => {
                    this.updateNetworkInfo(connection);
                });
            }
        }
        
        // 온라인/오프라인 이벤트
        window.addEventListener('online', () => {
            this.networkStats.online = true;
            console.log('🌐 네트워크 연결됨');
        });
        
        window.addEventListener('offline', () => {
            this.networkStats.online = false;
            console.warn('📡 네트워크 연결 끊김');
        });
    }
    
    /**
     * 네트워크 정보 업데이트
     */
    updateNetworkInfo(connection) {
        this.networkStats.effectiveType = connection.effectiveType;
        this.networkStats.downlink = connection.downlink;
        this.networkStats.rtt = connection.rtt;
        
        console.log('📶 네트워크 정보 업데이트:', {
            type: this.networkStats.effectiveType,
            downlink: `${this.networkStats.downlink} Mbps`,
            rtt: `${this.networkStats.rtt} ms`
        });
    }
    
    /**
     * 성능 이슈 체크
     */
    checkPerformanceIssues() {
        const issues = [];
        
        // FPS 체크
        if (this.metrics.fps < this.thresholds.fps.critical) {
            issues.push({
                severity: 'critical',
                type: 'fps',
                message: `매우 낮은 FPS: ${this.metrics.fps} (목표: 60fps)`,
                value: this.metrics.fps,
                threshold: this.thresholds.fps.critical
            });
        } else if (this.metrics.fps < this.thresholds.fps.warning) {
            issues.push({
                severity: 'warning',
                type: 'fps',
                message: `낮은 FPS: ${this.metrics.fps} (목표: 60fps)`,
                value: this.metrics.fps,
                threshold: this.thresholds.fps.warning
            });
        }
        
        // Draw Calls 체크
        if (this.metrics.drawCalls > this.thresholds.drawCalls.critical) {
            issues.push({
                severity: 'critical',
                type: 'drawCalls',
                message: `매우 높은 Draw Calls: ${this.metrics.drawCalls} (권장: <300)`,
                value: this.metrics.drawCalls,
                threshold: this.thresholds.drawCalls.critical
            });
        } else if (this.metrics.drawCalls > this.thresholds.drawCalls.warning) {
            issues.push({
                severity: 'warning',
                type: 'drawCalls',
                message: `높은 Draw Calls: ${this.metrics.drawCalls} (권장: <300)`,
                value: this.metrics.drawCalls,
                threshold: this.thresholds.drawCalls.warning
            });
        }
        
        // Triangles 체크
        if (this.metrics.triangles > this.thresholds.triangles.critical) {
            issues.push({
                severity: 'critical',
                type: 'triangles',
                message: `매우 많은 Triangles: ${this.metrics.triangles.toLocaleString()} (권장: <1M)`,
                value: this.metrics.triangles,
                threshold: this.thresholds.triangles.critical
            });
        } else if (this.metrics.triangles > this.thresholds.triangles.warning) {
            issues.push({
                severity: 'warning',
                type: 'triangles',
                message: `많은 Triangles: ${this.metrics.triangles.toLocaleString()} (권장: <1M)`,
                value: this.metrics.triangles,
                threshold: this.thresholds.triangles.warning
            });
        }
        
        // GPU 메모리 체크
        if (this.metrics.gpuMemory > this.thresholds.gpuMemory.critical) {
            issues.push({
                severity: 'critical',
                type: 'gpuMemory',
                message: `매우 높은 GPU 메모리: ${this.metrics.gpuMemory}MB (권장: <512MB)`,
                value: this.metrics.gpuMemory,
                threshold: this.thresholds.gpuMemory.critical
            });
        } else if (this.metrics.gpuMemory > this.thresholds.gpuMemory.warning) {
            issues.push({
                severity: 'warning',
                type: 'gpuMemory',
                message: `높은 GPU 메모리: ${this.metrics.gpuMemory}MB (권장: <512MB)`,
                value: this.metrics.gpuMemory,
                threshold: this.thresholds.gpuMemory.warning
            });
        }
        
        // 네트워크 체크
        if (!this.networkStats.online) {
            issues.push({
                severity: 'critical',
                type: 'network',
                message: '네트워크 연결 끊김',
                value: false,
                threshold: true
            });
        } else if (this.networkStats.effectiveType === 'slow-2g' || this.networkStats.effectiveType === '2g') {
            issues.push({
                severity: 'warning',
                type: 'network',
                message: `느린 네트워크: ${this.networkStats.effectiveType}`,
                value: this.networkStats.effectiveType,
                threshold: '4g'
            });
        }
        
        // 이슈가 발견되면 로그에 추가
        if (issues.length > 0) {
            issues.forEach(issue => {
                this.performanceIssues.push({
                    timestamp: Date.now(),
                    ...issue
                });
            });
            
            // 최대 로그 크기 유지
            if (this.performanceIssues.length > this.maxIssuesLog) {
                this.performanceIssues = this.performanceIssues.slice(-this.maxIssuesLog);
            }
        }
        
        return issues;
    }
    
    /**
     * 성능 메트릭 로그 출력
     */
    logPerformanceMetrics() {
        if (!this.isMonitoring) return;
        
        const avgFps = this.fpsHistory.length > 0 
            ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
            : this.metrics.fps;
        
        console.group('📊 실시간 성능 모니터링');
        
        // FPS 상태에 따른 아이콘
        const fpsIcon = this.metrics.fps >= this.thresholds.fps.good ? '🟢' 
            : this.metrics.fps >= this.thresholds.fps.warning ? '🟡' : '🔴';
        
        console.log(`${fpsIcon} FPS: ${this.metrics.fps} (평균: ${avgFps})`);
        console.log(`⏱️ Frame Time: ${this.metrics.frameTime.toFixed(2)}ms`);
        console.log(`🎨 Draw Calls: ${this.metrics.drawCalls}`);
        console.log(`🔺 Triangles: ${this.metrics.triangles.toLocaleString()}`);
        console.log(`💾 GPU Memory: ~${this.metrics.gpuMemory}MB`);
        
        // 네트워크 상태
        if (this.networkStats.online) {
            const networkIcon = this.networkStats.effectiveType === '4g' ? '🟢' 
                : this.networkStats.effectiveType === '3g' ? '🟡' : '🔴';
            
            console.log(`${networkIcon} Network: ${this.networkStats.effectiveType || 'Unknown'} ` +
                `(${this.networkStats.downlink || 'N/A'} Mbps, ${this.networkStats.rtt || 'N/A'}ms RTT)`);
        } else {
            console.log('🔴 Network: Offline');
        }
        
        console.groupEnd();
        
        // 성능 이슈가 있으면 별도로 경고
        const currentIssues = this.checkPerformanceIssues();
        if (currentIssues.length > 0) {
            console.group('⚠️ 성능 이슈 감지');
            currentIssues.forEach(issue => {
                const icon = issue.severity === 'critical' ? '🔴' : '🟡';
                console.warn(`${icon} ${issue.message}`);
            });
            console.groupEnd();
        }
    }
    
    /**
     * 전체 리포트 생성
     */
    generateReport() {
        const avgFps = this.fpsHistory.length > 0 
            ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
            : this.metrics.fps;
        
        const report = {
            timestamp: new Date().toISOString(),
            performance: {
                current: { ...this.metrics },
                average: {
                    fps: avgFps,
                    fpsHistory: [...this.fpsHistory]
                }
            },
            system: { ...this.systemInfo },
            network: { ...this.networkStats },
            issues: [...this.performanceIssues],
            recommendations: this.generateRecommendations()
        };
        
        return report;
    }
    
    /**
     * 최적화 권장사항 생성
     */
    generateRecommendations() {
        const recommendations = [];
        
        // FPS가 낮은 경우
        if (this.metrics.fps < this.thresholds.fps.warning) {
            recommendations.push({
                priority: 'high',
                category: 'rendering',
                issue: '낮은 FPS',
                solution: [
                    'LOD(Level of Detail) 시스템 적용',
                    'Frustum Culling 활성화',
                    '복잡한 재질(Material) 단순화',
                    '그림자(Shadow) 품질 낮추기'
                ]
            });
        }
        
        // Draw Calls가 많은 경우
        if (this.metrics.drawCalls > this.thresholds.drawCalls.warning) {
            recommendations.push({
                priority: 'high',
                category: 'optimization',
                issue: '높은 Draw Calls',
                solution: [
                    'Geometry Instancing 사용',
                    '동일한 재질의 메시 병합',
                    'BufferGeometry 사용',
                    '불필요한 객체 제거'
                ]
            });
        }
        
        // GPU 메모리가 많은 경우
        if (this.metrics.gpuMemory > this.thresholds.gpuMemory.warning) {
            recommendations.push({
                priority: 'medium',
                category: 'memory',
                issue: '높은 GPU 메모리 사용',
                solution: [
                    '텍스처 압축 사용',
                    '텍스처 크기 최적화',
                    'Geometry 재사용',
                    '사용하지 않는 리소스 dispose()'
                ]
            });
        }
        
        // 네트워크가 느린 경우
        if (this.networkStats.effectiveType === 'slow-2g' || this.networkStats.effectiveType === '2g') {
            recommendations.push({
                priority: 'high',
                category: 'network',
                issue: '느린 네트워크',
                solution: [
                    '더 나은 네트워크 환경에서 접속',
                    'Three.js 라이브러리 로컬 호스팅',
                    '초기 로딩 데이터 최소화',
                    'Lazy Loading 적용'
                ]
            });
        }
        
        return recommendations;
    }
    
    /**
     * 리포트 콘솔 출력
     */
    printReport() {
        const report = this.generateReport();
        
        console.group('📋 성능 분석 리포트');
        console.log('생성 시간:', report.timestamp);
        
        console.group('⚡ 성능 메트릭');
        console.table({
            'FPS (현재)': report.performance.current.fps,
            'FPS (평균)': report.performance.average.fps,
            'Frame Time': `${report.performance.current.frameTime.toFixed(2)}ms`,
            'Draw Calls': report.performance.current.drawCalls,
            'Triangles': report.performance.current.triangles.toLocaleString(),
            'GPU Memory': `~${report.performance.current.gpuMemory}MB`
        });
        console.groupEnd();
        
        console.group('💻 시스템 정보');
        console.log('Platform:', report.system.platform);
        console.log('CPU Cores:', report.system.hardwareConcurrency);
        console.log('Device Memory:', report.system.deviceMemory);
        console.log('Screen:', `${report.system.screen.width}x${report.system.screen.height}`);
        console.log('Pixel Ratio:', report.system.screen.pixelRatio);
        if (report.system.gpu) {
            console.log('GPU Vendor:', report.system.gpu.vendor);
            console.log('GPU Renderer:', report.system.gpu.renderer);
        }
        console.groupEnd();
        
        console.group('🌐 네트워크 정보');
        console.log('상태:', report.network.online ? '연결됨' : '연결 끊김');
        console.log('타입:', report.network.effectiveType || 'Unknown');
        console.log('다운링크:', report.network.downlink ? `${report.network.downlink} Mbps` : 'N/A');
        console.log('RTT:', report.network.rtt ? `${report.network.rtt} ms` : 'N/A');
        console.groupEnd();
        
        if (report.recommendations.length > 0) {
            console.group('💡 최적화 권장사항');
            report.recommendations.forEach((rec, index) => {
                console.group(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.issue}`);
                rec.solution.forEach(sol => console.log(`  • ${sol}`));
                console.groupEnd();
            });
            console.groupEnd();
        }
        
        if (report.issues.length > 0) {
            console.group('⚠️ 최근 성능 이슈');
            report.issues.slice(-5).forEach(issue => {
                const time = new Date(issue.timestamp).toLocaleTimeString();
                console.warn(`[${time}] ${issue.message}`);
            });
            console.groupEnd();
        }
        
        console.groupEnd();
        
        return report;
    }
    
    /**
     * 정리
     */
    dispose() {
        this.stop();
        console.log('🗑️ PerformanceMonitor 정리 완료');
    }
}

// 전역 함수로 내보내기 (콘솔에서 사용)
export function createPerformanceMonitor(renderer) {
    return new PerformanceMonitor(renderer);
}
