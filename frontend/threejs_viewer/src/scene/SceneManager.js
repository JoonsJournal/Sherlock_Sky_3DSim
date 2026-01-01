/**
 * SceneManager.js
 * Three.js 씬, 카메라, 렌더러 초기화 및 관리
 * 10,000 Class 클린룸 스타일 적용 - 최적화 버전
 * 
 * @version 1.2.0 - Phase 4.2 RoomEnvironment params 전달 지원
 */

import * as THREE from 'three';
import { CONFIG, debugLog, updateSceneConfig } from '../utils/Config.js';
import { RoomEnvironment } from './RoomEnvironment.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.roomEnvironment = null;
        this.floor = null;  // ✨ Phase 4: Floor 참조 저장
        this.grid = null;   // ✨ Phase 4: Grid 참조 저장
        this.frameCount = 0;
        this.fpsLastTime = performance.now();
        this.fpsFrameCount = 0;
        this.currentFps = 60;
        
        // ✨ Phase 4.2: 현재 적용된 Layout params
        this._currentLayoutParams = null;
    }
    
    /**
     * 씬, 카메라, 렌더러 초기화
     * @param {Object|null} roomParams - RoomEnvironment 초기화 파라미터 (선택적)
     */
    init(roomParams = null) {
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
        
        // ⭐ 최적화된 렌더러 생성
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: CONFIG.RENDERER.ANTIALIAS,
            powerPreference: 'high-performance',  // ⭐ 고성능 모드
            stencil: false,  // ⭐ Stencil 버퍼 비활성화 (사용하지 않음)
            depth: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // ⭐ PixelRatio 최적화 (고해상도 디스플레이에서 성능 향상)
        const pixelRatio = Math.min(window.devicePixelRatio, 2);  // 최대 2로 제한
        this.renderer.setPixelRatio(pixelRatio);
        debugLog(`🖥️ Pixel Ratio: ${pixelRatio} (디바이스: ${window.devicePixelRatio})`);
        
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
        
        debugLog('✅ Three.js 초기화 완료 (10,000 Class 클린룸 모드 - 최적화)');
        debugLog('📷 초기 카메라 위치:', this.camera.position);
        debugLog('🎨 Renderer domElement:', this.renderer.domElement);
        
        // 바닥 추가
        this.addCleanRoomFloor();
        
        // ⭐ 클린룸 환경 구축 (params 전달 지원)
        this.initRoomEnvironment(roomParams);
        
        // 창 크기 변경 이벤트 리스너
        window.addEventListener('resize', () => this.onWindowResize());
        
        return true;
    }
    
    // =========================================================
    // ✨ Phase 4.2: RoomEnvironment 초기화 메서드
    // =========================================================
    
    /**
     * ✨ Phase 4.2: RoomEnvironment 초기화 (params 지원)
     * @param {Object|null} params - RoomEnvironment 파라미터
     * @returns {RoomEnvironment} 생성된 RoomEnvironment 인스턴스
     */
    initRoomEnvironment(params = null) {
        // 기존 RoomEnvironment가 있으면 정리
        if (this.roomEnvironment) {
            this.roomEnvironment.dispose();
            this.roomEnvironment = null;
        }
        
        // ✨ Phase 4.2: params와 함께 RoomEnvironment 생성
        this.roomEnvironment = new RoomEnvironment(this.scene, params);
        this.roomEnvironment.buildEnvironment();
        
        // 현재 params 저장
        this._currentLayoutParams = params;
        
        if (params) {
            console.log('[SceneManager] ✅ RoomEnvironment 초기화 완료 (동적 params 사용)');
        } else {
            debugLog('[SceneManager] RoomEnvironment 초기화 완료 (기본 params)');
        }
        
        return this.roomEnvironment;
    }
    
    /**
     * ✨ Phase 4.2: RoomEnvironment 재초기화 (새 params로)
     * @param {Object} params - 새로운 RoomEnvironment 파라미터
     * @returns {RoomEnvironment} 생성된 RoomEnvironment 인스턴스
     */
    reinitRoomEnvironment(params) {
        console.log('[SceneManager] RoomEnvironment 재초기화 시작...');
        return this.initRoomEnvironment(params);
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
        this.floor = floor;  // ✨ Phase 4: 참조 저장
        
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
        this.grid = gridHelper;  // ✨ Phase 4: 참조 저장
        
        debugLog('🏗️ 클린룸 스타일 바닥 생성 완료');
        debugLog(`📐 바닥 크기: ${CONFIG.SCENE.FLOOR_SIZE}m × ${CONFIG.SCENE.FLOOR_SIZE}m`);
        debugLog(`✨ 바닥 재질: 광택 (roughness: 0.15, metalness: 0.05)`);
    }
    
    // =========================================================
    // ✨ Phase 4: Layout 적용 메서드
    // =========================================================
    
    /**
     * ✨ Phase 4: 변환된 Layout 적용
     * Layout2DTo3DConverter의 출력을 받아 Scene 업데이트
     * 
     * @param {Object} convertedLayout - Layout2DTo3DConverter.convert() 결과
     * @param {Object} options - 적용 옵션
     * @returns {boolean} 성공 여부
     */
    applyLayout(convertedLayout, options = {}) {
        if (!convertedLayout) {
            console.error('[SceneManager] applyLayout: convertedLayout이 없습니다');
            return false;
        }
        
        console.log('[SceneManager] Layout 적용 시작...');
        
        try {
            const { roomParams, equipmentConfig, officeParams } = convertedLayout;
            
            // 1. Scene CONFIG 업데이트 (Floor Size)
            if (roomParams) {
                const newFloorSize = Math.max(roomParams.roomWidth, roomParams.roomDepth) + 20;
                updateSceneConfig({ FLOOR_SIZE: newFloorSize });
            }
            
            // 2. Floor/Grid 업데이트
            if (options.updateFloor !== false) {
                this.updateFloor(roomParams);
            }
            
            // 3. RoomEnvironment 업데이트
            if (options.updateRoom !== false && this.roomEnvironment) {
                this.roomEnvironment.updateDimensions(roomParams);
                
                if (officeParams) {
                    this.roomEnvironment.updateOfficeParams(officeParams);
                }
                
                // 재구축
                if (options.rebuildRoom !== false) {
                    this.roomEnvironment.rebuild();
                }
            }
            
            console.log('[SceneManager] ✅ Layout 적용 완료');
            
            // 적용 완료 이벤트 발생
            window.dispatchEvent(new CustomEvent('layout-applied', {
                detail: { convertedLayout, options }
            }));
            
            return true;
            
        } catch (error) {
            console.error('[SceneManager] Layout 적용 실패:', error);
            return false;
        }
    }
    
    /**
     * ✨ Phase 4.2: RoomParamsAdapter 결과로 Layout 적용
     * @param {Object} adaptedParams - RoomParamsAdapter.adapt() 결과
     * @param {Object} options - 적용 옵션
     * @returns {boolean} 성공 여부
     */
    applyLayoutWithParams(adaptedParams, options = {}) {
        if (!adaptedParams) {
            console.error('[SceneManager] applyLayoutWithParams: adaptedParams가 없습니다');
            return false;
        }
        
        console.log('[SceneManager] Layout 적용 (params 방식) 시작...');
        
        try {
            // 1. Floor 업데이트
            if (options.updateFloor !== false) {
                const newFloorSize = Math.max(
                    adaptedParams.roomWidth || 40, 
                    adaptedParams.roomDepth || 60
                ) + 20;
                updateSceneConfig({ FLOOR_SIZE: newFloorSize });
                this.updateFloor({
                    roomWidth: adaptedParams.roomWidth,
                    roomDepth: adaptedParams.roomDepth
                });
            }
            
            // 2. RoomEnvironment 재초기화 (새 params로)
            if (options.rebuildRoom !== false) {
                this.reinitRoomEnvironment(adaptedParams);
            }
            
            console.log('[SceneManager] ✅ Layout 적용 완료 (params 방식)');
            
            // 적용 완료 이벤트 발생
            window.dispatchEvent(new CustomEvent('layout-params-applied', {
                detail: { adaptedParams, options }
            }));
            
            return true;
            
        } catch (error) {
            console.error('[SceneManager] Layout 적용 실패 (params 방식):', error);
            return false;
        }
    }
    
    /**
     * ✨ Phase 4: Floor 업데이트
     */
    updateFloor(roomParams) {
        if (!roomParams) return;
        
        const newSize = Math.max(roomParams.roomWidth, roomParams.roomDepth) + 20;
        
        // 기존 Floor 제거
        if (this.floor) {
            this.floor.geometry.dispose();
            this.scene.remove(this.floor);
        }
        
        // 기존 Grid 제거
        if (this.grid) {
            this.grid.geometry.dispose();
            this.grid.material.dispose();
            this.scene.remove(this.grid);
        }
        
        // 새 Floor 생성
        const floorGeometry = new THREE.PlaneGeometry(newSize, newSize);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf5f5f5,
            roughness: 0.15,
            metalness: 0.05,
            envMapIntensity: 0.3,
            side: THREE.DoubleSide
        });
        
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.floor.name = 'cleanroom-floor';
        this.scene.add(this.floor);
        
        // 새 Grid 생성
        this.grid = new THREE.GridHelper(newSize, CONFIG.SCENE.GRID_DIVISIONS, 0xe5e5e5, 0xf0f0f0);
        this.grid.material.opacity = 0.2;
        this.grid.material.transparent = true;
        this.grid.name = 'cleanroom-grid';
        this.scene.add(this.grid);
        
        debugLog(`[SceneManager] Floor 업데이트 완료: ${newSize}m × ${newSize}m`);
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
     * ⭐ RoomEnvironment 반환
     */
    getRoomEnvironment() {
        return this.roomEnvironment;
    }
    
    /**
     * ✨ Phase 4.2: 현재 Layout params 반환
     */
    getCurrentLayoutParams() {
        return this._currentLayoutParams;
    }
    
    // =========================================================
    // ✨ Phase 4: 추가 유틸리티
    // =========================================================
    
    /**
     * ✨ Phase 4: 디버그 정보 출력
     */
    debug() {
        console.group('[SceneManager] Debug Info');
        console.log('Scene children:', this.scene.children.length);
        console.log('Floor size:', this.floor?.geometry?.parameters?.width);
        console.log('FPS:', this.currentFps);
        console.log('Draw calls:', this.renderer.info.render.calls);
        console.log('Current Layout Params:', this._currentLayoutParams);
        
        if (this.roomEnvironment) {
            this.roomEnvironment.debug();
        }
        console.groupEnd();
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Floor/Grid 정리
        if (this.floor) {
            this.floor.geometry.dispose();
            this.floor.material.dispose();
        }
        if (this.grid) {
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }
        
        // ⭐ RoomEnvironment 정리
        if (this.roomEnvironment) {
            this.roomEnvironment.dispose();
        }
        
        // 참조 초기화
        this._currentLayoutParams = null;
        
        window.removeEventListener('resize', () => this.onWindowResize());
        
        debugLog('🗑️ SceneManager 정리 완료');
    }
}