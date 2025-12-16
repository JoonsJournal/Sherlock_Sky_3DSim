/**
 * SceneManager.js
 * Three.js 씬, 카메라, 렌더러 초기화 및 관리
 * 클린룸 스타일 적용
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
        
        this.init();
    }
    
    /**
     * 씬, 카메라, 렌더러 초기화
     */
    init() {
        // 씬 생성
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.SCENE.BACKGROUND_COLOR);  // CONFIG에서 배경 색상 가져오기
        
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
            antialias: CONFIG.RENDERER.ANTIALIAS 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // 부드러운 그림자
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;  // 현실적인 톤매핑
        this.renderer.toneMappingExposure = 1.2;  // 밝기 조정
        document.body.appendChild(this.renderer.domElement);
        
        debugLog('✅ Three.js 초기화 완료 (클린룸 모드)');
        debugLog('📷 초기 카메라 위치:', this.camera.position);
        
        // 창 크기 변경 이벤트 리스너
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    /**
     * 바닥 및 그리드 추가 (클린룸 스타일)
     */
    addFloor() {
        const floorGeometry = new THREE.PlaneGeometry(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.FLOOR_SIZE
        );
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: CONFIG.SCENE.FLOOR_COLOR,  // CONFIG에서 색상 가져오기
            roughness: 0.3,   // 약간의 반사감
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // 클린룸 스타일: 미세한 그리드만 표시
        const gridHelper = new THREE.GridHelper(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.GRID_DIVISIONS,  // CONFIG에서 분할 수 가져오기
            CONFIG.SCENE.GRID_COLOR1,     // CONFIG에서 색상1 가져오기
            CONFIG.SCENE.GRID_COLOR2      // CONFIG에서 색상2 가져오기
        );
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
        
        debugLog('🏗️ 클린룸 스타일 바닥 생성 완료');
        debugLog(`📐 바닥 크기: ${CONFIG.SCENE.FLOOR_SIZE}m × ${CONFIG.SCENE.FLOOR_SIZE}m`);
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
     * 렌더링 루프 (controls와 함께 호출)
     * @param {OrbitControls} controls - 카메라 컨트롤
     */
    render(controls) {
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
            const fps = Math.round((this.fpsFrameCount * 1000) / (currentTime - this.fpsLastTime));
            if (CONFIG.DEBUG_MODE && this.frameCount % CONFIG.UI.FPS_LOG_INTERVAL === 0) {
                debugLog('⚡ FPS:', fps);
            }
            this.fpsFrameCount = 0;
            this.fpsLastTime = currentTime;
        }
        
        controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * 씬 반환
     * @returns {THREE.Scene}
     */
    getScene() {
        return this.scene;
    }
    
    /**
     * 카메라 반환
     * @returns {THREE.Camera}
     */
    getCamera() {
        return this.camera;
    }
    
    /**
     * 렌더러 반환
     * @returns {THREE.WebGLRenderer}
     */
    getRenderer() {
        return this.renderer;
    }
}