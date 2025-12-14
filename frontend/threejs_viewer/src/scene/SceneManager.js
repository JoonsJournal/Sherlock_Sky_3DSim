/**
 * SceneManager.js
 * Three.js 씬, 카메라, 렌더러 초기화 및 관리
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
        this.scene.background = new THREE.Color(CONFIG.SCENE.BACKGROUND_COLOR);
        
        // 안개 효과 추가 (공장 분위기)
        this.scene.fog = new THREE.Fog(
            CONFIG.SCENE.BACKGROUND_COLOR, 
            40,  // 안개 시작 거리
            80   // 안개 끝 거리
        );
        
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
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자
        document.body.appendChild(this.renderer.domElement);
        
        debugLog('✅ Three.js 초기화 완료');
        debugLog('📷 초기 카메라 위치:', this.camera.position);
        
        // 창 크기 변경 이벤트 리스너
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    /**
     * 바닥 및 그리드 추가 - 공장 스타일
     */
    addFloor() {
        // 콘크리트 바닥 생성
        const floorGeometry = new THREE.PlaneGeometry(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.FLOOR_SIZE
        );
        
        // 콘크리트 텍스처 느낌의 머티리얼
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: CONFIG.SCENE.FLOOR_COLOR,
            roughness: CONFIG.SCENE.FLOOR_ROUGHNESS,
            metalness: 0.1
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // 그리드 헬퍼 - 공장 바닥 라인
        const gridHelper = new THREE.GridHelper(
            CONFIG.SCENE.FLOOR_SIZE, 
            CONFIG.SCENE.GRID_DIVISIONS, 
            CONFIG.SCENE.GRID_COLOR1, 
            CONFIG.SCENE.GRID_COLOR2
        );
        gridHelper.position.y = 0.01; // 바닥 위에 약간 띄워서 z-fighting 방지
        this.scene.add(gridHelper);
        
        // 안전선 추가 (노란색 경계선)
        this.addSafetyLines();
        
        debugLog('🏗️ 공장 바닥 및 그리드 생성 완료');
    }
    
    /**
     * 안전선 추가 (공장 안전 구역 표시)
     */
    addSafetyLines() {
        if (!CONFIG.FACTORY_ENVIRONMENT.SAFETY_SIGNS.ENABLED) return;
        
        const safetyLineGeometry = new THREE.PlaneGeometry(
            CONFIG.SCENE.FLOOR_SIZE * 0.9, 
            0.1
        );
        const safetyLineMaterial = new THREE.MeshBasicMaterial({ 
            color: CONFIG.FACTORY_ENVIRONMENT.SAFETY_SIGNS.COLOR,
            side: THREE.DoubleSide
        });
        
        // 4방향 안전선
        const positions = [
            { x: 0, z: CONFIG.SCENE.FLOOR_SIZE * 0.45, rotation: 0 },
            { x: 0, z: -CONFIG.SCENE.FLOOR_SIZE * 0.45, rotation: 0 },
            { x: CONFIG.SCENE.FLOOR_SIZE * 0.45, z: 0, rotation: Math.PI / 2 },
            { x: -CONFIG.SCENE.FLOOR_SIZE * 0.45, z: 0, rotation: Math.PI / 2 }
        ];
        
        positions.forEach(pos => {
            const safetyLine = new THREE.Mesh(safetyLineGeometry, safetyLineMaterial);
            safetyLine.rotation.x = -Math.PI / 2;
            safetyLine.rotation.z = pos.rotation;
            safetyLine.position.set(pos.x, 0.02, pos.z);
            this.scene.add(safetyLine);
        });
        
        debugLog('⚠️ 안전선 추가 완료');
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