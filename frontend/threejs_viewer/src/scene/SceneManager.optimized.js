/**
 * SceneManager.optimized.js
 * 최적화된 Three.js 씬, 카메라, 렌더러 관리
 * 
 * 최적화 내용:
 * - 그림자 맵 해상도 축소 (2048 → 1024)
 * - 선택적 그림자 활성화
 * - 렌더러 설정 최적화
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.frameCount = 0;
        this.fpsLastTime = performance.now();
        this.fpsFrameCount = 0;
        this.currentFps = 60;
    }
    
    /**
     * 씬, 카메라, 렌더러 초기화
     */
    init() {
        // 씬 생성
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8f8f8);
        
        // 카메라 생성
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            CONFIG.CAMERA.NEAR,
            CONFIG.CAMERA.FAR
        );
        this.camera.position.set(
            CONFIG.CAMERA.INITIAL_POSITION.x,
            CONFIG.CAMERA.INITIAL_POSITION.y,
            CONFIG.CAMERA.INITIAL_POSITION.z
        );
        
        // ⭐ 최적화된 렌더러 설정
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: CONFIG.RENDERER.ANTIALIAS,
            powerPreference: 'high-performance',  // ⭐ 고성능 모드
            stencil: false,  // ⭐ Stencil 버퍼 비활성화 (사용하지 않음)
            depth: true,
            logarithmicDepthBuffer: false  // ⭐ 기본값 유지
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // ⭐ PixelRatio 최적화 (고해상도 디스플레이에서 성능 향상)
        const pixelRatio = Math.min(window.devicePixelRatio, 2);  // 최대 2로 제한
        this.renderer.setPixelRatio(pixelRatio);
        debugLog(`🖥️ Pixel Ratio: ${pixelRatio} (디바이스: ${window.devicePixelRatio})`);
        
        // ⭐ 그림자 최적화
        this.renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;  // 필요시 false로 변경
        
        // 톤 매핑
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.3;
        
        // 색 공간 설정
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // DOM에 추가
        document.body.appendChild(this.renderer.domElement);
        
        debugLog('✅ Three.js 초기화 완료 (최적화 모드)');
        debugLog('📷 초기 카메라 위치:', this.camera.position);
        debugLog('🎨 Renderer domElement:', this.renderer.domElement);
        
        // 바닥 추가
        this.addCleanRoomFloor();
        
        // 창 크기 변경 이벤트 리스너
        window.addEventListener('resize', () => this.onWindowResize());
        
        return true;
    }
    
    /**
     * 클린룸 스타일 바닥 및 그리드 추가
     */
    addCleanRoomFloor() {
        const floorGeometry = new THREE.PlaneGeometry(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.FLOOR_SIZE
        );
        
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf5f5f5,
            roughness: 0.15,
            metalness: 0.05,
            envMapIntensity: 0.3,
            side: THREE.DoubleSide
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.name = 'cleanroom-floor';
        this.scene.add(floor);
        
        // 그리드
        const gridHelper = new THREE.GridHelper(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.GRID_DIVISIONS,
            0xe5e5e5,
            0xf0f0f0
        );
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        gridHelper.name = 'cleanroom-grid';
        this.scene.add(gridHelper);
        
        debugLog('🏗️ 클린룸 스타일 바닥 생성 완료');
    }
    
    /**
     * 창 크기 변경 핸들러
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        debugLog('📱 창 크기 변경:', window.innerWidth, 'x', window.innerHeight);
    }
    
    /**
     * 렌더링
     */
    render() {
        this.frameCount++;
        this.fpsFrameCount++;
        
        if (this.frameCount === 1) {
            debugLog('🎬 첫 프레임 렌더링 완료');
        }
        
        // FPS 계산
        const currentTime = performance.now();
        if (currentTime >= this.fpsLastTime + 1000) {
            this.currentFps = Math.round((this.fpsFrameCount * 1000) / (currentTime - this.fpsLastTime));
            
            if (CONFIG.DEBUG_MODE && this.frameCount % CONFIG.UI.FPS_LOG_INTERVAL === 0) {
                debugLog('⚡ FPS:', this.currentFps);
            }
            
            this.fpsFrameCount = 0;
            this.fpsLastTime = currentTime;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * 성능 통계 반환
     */
    getStats() {
        const info = this.renderer.info;
        
        return {
            fps: this.currentFps,
            frameTime: this.currentFps > 0 ? 1000 / this.currentFps : 0,
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures
        };
    }
    
    getScene() {
        return this.scene;
    }
    
    getCamera() {
        return this.camera;
    }
    
    getRenderer() {
        return this.renderer;
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        window.removeEventListener('resize', () => this.onWindowResize());
        
        debugLog('🗑️ SceneManager 정리 완료');
    }
}
