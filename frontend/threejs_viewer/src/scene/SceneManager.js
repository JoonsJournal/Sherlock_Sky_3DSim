/**
 * SceneManager.js
 * Three.js 씬, 카메라, 렌더러 초기화 및 관리
 * 10,000 Class 클린룸 스타일 적용 - 최적화 버전
 * 
 * @version 1.4.0 - Phase 1.6 헬퍼/그리드 토글 추가
 * 
 * 변경사항 (v1.4.0):
 * - toggleHelpers() 메서드 추가
 * - toggleGrid() 메서드 추가
 * - AxesHelper 추가
 * 
 * 변경사항 (v1.3.0):
 * - setEquipmentLoader() 메서드 추가
 * - clearScene() 메서드 추가
 * - rebuildScene() 메서드 추가
 * - applyLayoutFull() 메서드 추가 (Room + Equipment 동시 적용)
 * - 기존 applyLayout(), applyLayoutWithParams() 유지 (하위 호환성)
 */

import * as THREE from 'three';
import { CONFIG, debugLog, updateSceneConfig, updateEquipmentConfig } from '../utils/Config.js';
import { RoomEnvironment } from './RoomEnvironment.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.roomEnvironment = null;
        this.floor = null;  // ✨ Phase 4: Floor 참조 저장
        this.grid = null;   // ✨ Phase 4: Grid 참조 저장
        this.axesHelper = null;  // ⭐ Phase 1.6: AxesHelper 참조 저장
        this.frameCount = 0;
        this.fpsLastTime = performance.now();
        this.fpsFrameCount = 0;
        this.currentFps = 60;
        
        // ⭐ Phase 1.6: 헬퍼/그리드 표시 상태
        this._helpersVisible = true;
        this._gridVisible = true;
        
        // ✨ Phase 4.2: 현재 적용된 Layout params
        this._currentLayoutParams = null;
        
        // ✨ Phase 4.4: EquipmentLoader 참조
        this._equipmentLoader = null;
        
        // ✨ Phase 4.4: 재구축 상태 플래그
        this._isRebuilding = false;
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
    // ⭐ Phase 1.6: 헬퍼/그리드 토글 메서드
    // =========================================================
    
    /**
     * ⭐ Phase 1.6: 헬퍼 토글 (AxesHelper 등)
     * @returns {boolean} 현재 표시 상태
     */
    toggleHelpers() {
        this._helpersVisible = !this._helpersVisible;
        
        // AxesHelper 토글
        if (this.axesHelper) {
            this.axesHelper.visible = this._helpersVisible;
        }
        
        // 기타 헬퍼들 토글 (이름에 'Helper' 포함)
        this.scene.traverse((object) => {
            if (object.type === 'AxesHelper' || 
                object.name?.toLowerCase().includes('helper')) {
                object.visible = this._helpersVisible;
            }
        });
        
        console.log(`🔧 헬퍼 ${this._helpersVisible ? '표시' : '숨김'}`);
        return this._helpersVisible;
    }
    
    /**
     * ⭐ Phase 1.6: 그리드 토글
     * @returns {boolean} 현재 표시 상태
     */
    toggleGrid() {
        this._gridVisible = !this._gridVisible;
        
        // Grid 토글
        if (this.grid) {
            this.grid.visible = this._gridVisible;
        }
        
        // 다른 GridHelper들도 토글
        this.scene.traverse((object) => {
            if (object.type === 'GridHelper') {
                object.visible = this._gridVisible;
            }
        });
        
        console.log(`🔧 그리드 ${this._gridVisible ? '표시' : '숨김'}`);
        return this._gridVisible;
    }
    
    /**
     * ⭐ Phase 1.6: 헬퍼 표시 상태 반환
     */
    isHelpersVisible() {
        return this._helpersVisible;
    }
    
    /**
     * ⭐ Phase 1.6: 그리드 표시 상태 반환
     */
    isGridVisible() {
        return this._gridVisible;
    }
    
    // =========================================================
    // ✨ Phase 4.4: EquipmentLoader 연결
    // =========================================================
    
    /**
     * ✨ Phase 4.4: EquipmentLoader 참조 설정
     * @param {EquipmentLoader} loader - EquipmentLoader 인스턴스
     */
    setEquipmentLoader(loader) {
        if (!loader) {
            console.warn('[SceneManager] setEquipmentLoader: loader가 null입니다');
            return;
        }
        
        this._equipmentLoader = loader;
        console.log('[SceneManager] ✅ EquipmentLoader 연결 완료');
    }
    
    /**
     * ✨ Phase 4.4: EquipmentLoader 반환
     * @returns {EquipmentLoader|null}
     */
    getEquipmentLoader() {
        return this._equipmentLoader;
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
        
        // ⭐ Phase 1.6: AxesHelper 추가
        const axesHelper = new THREE.AxesHelper(10);  // 10m 크기
        axesHelper.name = 'axes-helper';
        axesHelper.visible = this._helpersVisible;
        this.scene.add(axesHelper);
        this.axesHelper = axesHelper;
        
        debugLog('🏗️ 클린룸 스타일 바닥 생성 완료');
        debugLog(`📐 바닥 크기: ${CONFIG.SCENE.FLOOR_SIZE}m × ${CONFIG.SCENE.FLOOR_SIZE}m`);
        debugLog(`✨ 바닥 재질: 광택 (roughness: 0.15, metalness: 0.05)`);
        debugLog(`🔧 AxesHelper 추가됨 (H키로 토글)`);
    }
    
    // =========================================================
    // ✨ Phase 4.4: Scene 정리 및 재구축 메서드
    // =========================================================
    
    /**
     * ✨ Phase 4.4: Scene 정리 (Floor, Grid 제외)
     * RoomEnvironment와 Equipment만 정리
     */
    clearScene() {
        console.log('[SceneManager] Scene 정리 시작...');
        this._isRebuilding = true;
        
        // 1. RoomEnvironment 정리
        if (this.roomEnvironment) {
            this.roomEnvironment.dispose();
            this.roomEnvironment = null;
            console.log('  - RoomEnvironment 정리 완료');
        }
        
        // 2. EquipmentLoader 정리 (연결된 경우)
        if (this._equipmentLoader) {
            this._equipmentLoader.dispose();
            console.log('  - EquipmentLoader 정리 완료');
        }
        
        // 3. 기타 동적 객체 정리 (Floor, Grid, Lights, AxesHelper 제외)
        const objectsToRemove = [];
        this.scene.traverse((object) => {
            // Floor, Grid, Lights, AxesHelper는 유지
            if (object.name === 'cleanroom-floor' || 
                object.name === 'cleanroom-grid' ||
                object.name === 'axes-helper' ||
                object.isLight) {
                return;
            }
            
            // Mesh, Group 등은 정리 대상
            if (object.isMesh || object.isGroup) {
                // 이미 정리된 RoomEnvironment나 Equipment가 아닌 것들
                if (object.parent === this.scene) {
                    objectsToRemove.push(object);
                }
            }
        });
        
        objectsToRemove.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
            this.scene.remove(obj);
        });
        
        console.log(`[SceneManager] ✅ Scene 정리 완료 (${objectsToRemove.length}개 객체 제거)`);
        this._isRebuilding = false;
    }
    
    /**
     * ✨ Phase 4.4: Scene 재구축
     * @param {Object} roomParams - Room 파라미터
     * @param {Object} equipmentConfig - Equipment CONFIG (선택적)
     * @param {Function} updateStatusCallback - 상태 업데이트 콜백 (선택적)
     */
    rebuildScene(roomParams, equipmentConfig = null, updateStatusCallback = null) {
        console.log('[SceneManager] Scene 재구축 시작...');
        this._isRebuilding = true;
        
        try {
            // 1. Floor 업데이트
            if (roomParams) {
                this.updateFloor(roomParams);
            }
            
            // 2. RoomEnvironment 재생성
            this.initRoomEnvironment(roomParams);
            
            // 3. Equipment 재배치 (EquipmentLoader가 연결된 경우)
            if (this._equipmentLoader && equipmentConfig) {
                console.log('[SceneManager] Equipment 재배치 시작...');
                
                // CONFIG 업데이트
                if (typeof updateEquipmentConfig === 'function') {
                    updateEquipmentConfig(equipmentConfig);
                }
                
                // 설비 재로드
                this._equipmentLoader.loadEquipmentArray(updateStatusCallback);
                console.log('[SceneManager] Equipment 재배치 완료');
            }
            
            console.log('[SceneManager] ✅ Scene 재구축 완료');
            
            // 재구축 완료 이벤트 발생
            window.dispatchEvent(new CustomEvent('scene-rebuilt', {
                detail: { roomParams, equipmentConfig }
            }));
            
        } catch (error) {
            console.error('[SceneManager] Scene 재구축 실패:', error);
            throw error;
        } finally {
            this._isRebuilding = false;
        }
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
            
            // ✨ Phase 4.4: Equipment 재배치 (옵션)
            if (options.updateEquipment !== false && this._equipmentLoader && equipmentConfig) {
                this._equipmentLoader.applyDynamicConfig(equipmentConfig);
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
     * ✨ Phase 4.4: 전체 Layout 적용 (Room + Equipment)
     * LayoutEditorMain.goTo3DViewer()에서 호출
     * 
     * @param {Object} layoutData - Layout JSON 데이터
     * @param {Object} options - 적용 옵션
     * @returns {boolean} 성공 여부
     */
    applyLayoutFull(layoutData, options = {}) {
        if (!layoutData) {
            console.error('[SceneManager] applyLayoutFull: layoutData가 없습니다');
            return false;
        }
        
        console.log('[SceneManager] 전체 Layout 적용 시작 (Room + Equipment)...');
        
        try {
            // Layout2DTo3DConverter가 전역에 있는지 확인
            const converter = window.layout2DTo3DConverter;
            const adapter = window.roomParamsAdapter;
            
            if (!converter) {
                console.error('[SceneManager] layout2DTo3DConverter가 없습니다');
                return false;
            }
            
            // 1. Layout 변환
            const convertedLayout = converter.convert(layoutData);
            if (!convertedLayout) {
                throw new Error('Layout 변환 실패');
            }
            
            // 2. Params 변환 (RoomParamsAdapter 사용)
            let adaptedParams = null;
            if (adapter) {
                adaptedParams = adapter.adapt(convertedLayout);
            } else {
                // Adapter 없으면 직접 추출
                adaptedParams = {
                    roomWidth: convertedLayout.roomParams?.roomWidth || 40,
                    roomDepth: convertedLayout.roomParams?.roomDepth || 60,
                    wallHeight: convertedLayout.roomParams?.wallHeight || 4,
                    wallThickness: convertedLayout.roomParams?.wallThickness || 0.2,
                    hasOffice: !!convertedLayout.officeParams,
                    officeWidth: convertedLayout.officeParams?.size?.width || 12,
                    officeDepth: convertedLayout.officeParams?.size?.depth || 20,
                    officeX: convertedLayout.officeParams?.position?.x || 15,
                    officeZ: convertedLayout.officeParams?.position?.z || -20
                };
            }
            
            // 3. Scene 정리
            if (options.clearFirst !== false) {
                this.clearScene();
            }
            
            // 4. Scene 재구축
            this.rebuildScene(
                adaptedParams, 
                convertedLayout.equipmentConfig,
                options.updateStatusCallback || null
            );
            
            // 5. 현재 Layout 저장
            this._currentLayoutParams = adaptedParams;
            
            console.log('[SceneManager] ✅ 전체 Layout 적용 완료');
            
            // 적용 완료 이벤트 발생
            window.dispatchEvent(new CustomEvent('layout-full-applied', {
                detail: { 
                    layoutData, 
                    convertedLayout,
                    adaptedParams,
                    options 
                }
            }));
            
            return true;
            
        } catch (error) {
            console.error('[SceneManager] 전체 Layout 적용 실패:', error);
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
        this.grid.visible = this._gridVisible;  // ⭐ 현재 표시 상태 유지
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
    
    /**
     * ✨ Phase 4.4: 재구축 중 여부 반환
     */
    isRebuilding() {
        return this._isRebuilding;
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
        console.log('EquipmentLoader connected:', !!this._equipmentLoader);
        console.log('Is Rebuilding:', this._isRebuilding);
        console.log('Helpers visible:', this._helpersVisible);
        console.log('Grid visible:', this._gridVisible);
        
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
        
        // ⭐ AxesHelper 정리
        if (this.axesHelper) {
            this.axesHelper.dispose();
        }
        
        // ⭐ RoomEnvironment 정리
        if (this.roomEnvironment) {
            this.roomEnvironment.dispose();
        }
        
        // 참조 초기화
        this._currentLayoutParams = null;
        this._equipmentLoader = null;
        
        window.removeEventListener('resize', () => this.onWindowResize());
        
        debugLog('🗑️ SceneManager 정리 완료');
    }
}