/**
 * CameraControls.js
 * 카메라 컨트롤 설정 및 관리
 */

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG, debugLog } from '../../core/utils/Config.js';

export class CameraControls {
    /**
     * ⭐ 생성자 - domElement만 받도록 수정
     * @param {THREE.Camera} camera - Three.js 카메라
     * @param {HTMLElement} domElement - 렌더러의 DOM 요소
     */
    constructor(camera, domElement) {
        debugLog('🎮 CameraControls 생성자 호출');
        debugLog('  - camera:', camera);
        debugLog('  - domElement:', domElement);
        
        // ⭐ 파라미터 검증
        if (!camera) {
            console.error('❌ Camera가 제공되지 않았습니다!');
            throw new Error('Camera is required');
        }
        
        if (!domElement) {
            console.error('❌ DOM Element가 제공되지 않았습니다!');
            throw new Error('DOM Element is required');
        }
        
        this.camera = camera;
        this.domElement = domElement;
        this.controls = null;
        
        this.init();
    }
    
    /**
     * OrbitControls 초기화
     */
    init() {
        debugLog('🎮 OrbitControls 초기화 시작...');
        
        // ⭐ OrbitControls 생성 - domElement 직접 사용
        this.controls = new OrbitControls(this.camera, this.domElement);
        
        // 설정
        this.controls.enableDamping = CONFIG.CONTROLS.ENABLE_DAMPING;
        this.controls.dampingFactor = CONFIG.CONTROLS.DAMPING_FACTOR;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 500;
        this.controls.maxPolarAngle = Math.PI / 2;
        
        debugLog('✅ 카메라 컨트롤 초기화 완료');
    }
    
    /**
     * 컨트롤 업데이트 (애니메이션 루프에서 호출)
     */
    update() {
        if (this.controls) {
            this.controls.update();
        }
    }
    
    /**
     * OrbitControls 반환
     * @returns {OrbitControls}
     */
    getControls() {
        return this.controls;
    }
    
    /**
     * 카메라를 특정 위치로 이동
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     * @param {number} z - Z 좌표
     */
    moveTo(x, y, z) {
        this.camera.position.set(x, y, z);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        debugLog('📷 카메라 이동:', this.camera.position);
    }
    
    /**
     * 특정 객체로 카메라 포커스
     * @param {THREE.Object3D} object - 포커스할 객체
     * @param {number} distance - 거리 (기본값: 5)
     */
    focusOn(object, distance = 5) {
        const pos = object.position;
        this.camera.position.set(pos.x + distance, pos.y + distance, pos.z + distance);
        this.camera.lookAt(pos);
        this.controls.target.copy(pos);
        this.controls.update();
        debugLog('🎯 객체에 포커스:', object.userData?.id || 'Unknown', pos);
    }
    
    /**
     * 카메라 초기 위치로 리셋
     */
    reset() {
        this.moveTo(
            CONFIG.CAMERA.INITIAL_POSITION.x,
            CONFIG.CAMERA.INITIAL_POSITION.y,
            CONFIG.CAMERA.INITIAL_POSITION.z
        );
    }
    
    /**
     * ⭐ 리소스 정리
     */
    dispose() {
        if (this.controls) {
            this.controls.dispose();
            debugLog('🗑️ CameraControls 정리 완료');
        }
    }
}