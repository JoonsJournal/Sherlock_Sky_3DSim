/**
 * SceneManager.js
 * Three.js 씬, 카메라, 렌더러 초기화 및 관리
 * 10,000 Class 클린룸 스타일 적용
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
        // 클린룸 배경 - 매우 밝은 아이보리/연한 회색
        this.scene.background = new THREE.Color(0xf8f8f8);
        
        // 클린룸 환경 시뮬레이션을 위한 Fog (선택적 - 매우 약하게)
        // this.scene.fog = new THREE.Fog(0xf8f8f8, 50, 200);
        
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
        
        // 렌더러 생성
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: CONFIG.RENDERER.ANTIALIAS,
            // 물리 기반 조명 활성화 (더 현실적인 조명)
            physicallyCorrectLights: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // 그림자 설정 - 부드러운 그림자
        this.renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 톤 매핑 - 클린룸의 밝은 조명 환경
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.3; // 더 밝게
        
        // 색 공간 설정
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // DOM에 추가
        document.body.appendChild(this.renderer.domElement);
        
        debugLog('✅ Three.js 초기화 완료 (10,000 Class 클린룸 모드)');
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
     * - 반사되는 광택 바닥
     * - 매우 밝은 아이보리/회색 색상
     */
    addCleanRoomFloor() {
        // 바닥 geometry
        const floorGeometry = new THREE.PlaneGeometry(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.FLOOR_SIZE
        );
        
        // 클린룸 바닥 재질 - 반사가 있는 광택 바닥
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf5f5f5,        // 매우 밝은 회색/아이보리
            roughness: 0.15,        // 낮은 거칠기 (매끄러운 표면)
            metalness: 0.05,        // 약간의 금속성 (반사 효과)
            envMapIntensity: 0.3,   // 환경 맵 반사 강도
            side: THREE.DoubleSide  // 양면 렌더링
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.name = 'cleanroom-floor';
        this.scene.add(floor);
        
        // 매우 미세한 그리드 (클린룸 타일 효과)
        const gridHelper = new THREE.GridHelper(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.GRID_DIVISIONS,
            0xe5e5e5,  // 중앙선 색상 - 밝은 회색
            0xf0f0f0   // 그리드 색상 - 매우 밝은 회색
        );
        gridHelper.material.opacity = 0.2;  // 매우 투명하게
        gridHelper.material.transparent = true;
        gridHelper.name = 'cleanroom-grid';
        this.scene.add(gridHelper);
        
        // 추가: 바닥 반사를 위한 가상의 거울 효과 (선택사항)
        // 실제 반사는 환경 맵이나 Reflector를 사용하지만, 
        // 성능을 위해 간단한 방법 사용
        
        debugLog('🏗️ 클린룸 스타일 바닥 생성 완료');
        debugLog(`📐 바닥 크기: ${CONFIG.SCENE.FLOOR_SIZE}m × ${CONFIG.SCENE.FLOOR_SIZE}m`);
        debugLog(`✨ 바닥 재질: 광택 (roughness: 0.15, metalness: 0.05)`);
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
     * 렌더링 (애니메이션 루프에서 호출)
     */
    render() {
        this.frameCount++;
        this.fpsFrameCount++;
        
        // 초기 프레임 로그
        if (this.frameCount === 1) {
            debugLog('🎬 첫 프레임 렌더링 완료');
            debugLog('📷 현재 카메라:', this.camera.position);
            debugLog('🎯 카메라 방향:', this.camera.getWorldDirection(new THREE.Vector3()));
        }
        
        // FPS 계산 (1초마다)
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
    
    /**
     * 씬 반환
     */
    getScene() {
        return this.scene;
    }
    
    /**
     * 카메라 반환
     */
    getCamera() {
        return this.camera;
    }
    
    /**
     * 렌더러 반환
     */
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