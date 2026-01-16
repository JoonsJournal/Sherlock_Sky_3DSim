/**
 * SceneManager.js
 * Three.js 씬, 카메라, 렌더러 초기화 및 관리
 * 10,000 Class 클린룸 스타일 적용 - 최적화 버전
 * 
 * @version 1.5.0 - Equipment Drawer 지원 (컨테이너 기준 리사이즈)
 * 
 * 변경사항 (v1.5.0):
 * - 🆕 onWindowResize() 컨테이너 기준으로 변경
 * - 🆕 init()에서 렌더러를 #threejs-container에 추가
 * - 🆕 _resizeHandler를 인스턴스 메서드로 바인딩 (이벤트 제거 가능)
 * - 🆕 drawer-toggle 커스텀 이벤트 리스너 추가
 * - 🆕 triggerResize() 메서드 추가 (외부에서 리사이즈 요청)
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
import { CONFIG, debugLog, updateSceneConfig, updateEquipmentConfig } from '../../core/utils/Config.js';
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
        
        // 🆕 v1.5.0: 컨테이너 참조
        this._container = null;
        
        // 🆕 v1.5.0: 이벤트 핸들러 바인딩 (이벤트 제거 가능하도록)
        this._resizeHandler = this.onWindowResize.bind(this);
        this._drawerToggleHandler = this._onDrawerToggle.bind(this);
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
        
        // 🆕 v1.5.0: 컨테이너 참조 저장
        this._container = document.getElementById('threejs-container');
        
        // 🆕 v1.5.0: 초기 크기를 컨테이너 기준으로 계산 (폴백: window)
        const initialWidth = this._container?.clientWidth || window.innerWidth;
        const initialHeight = this._container?.clientHeight || window.innerHeight;
        
        // 카메라 생성 (🆕 컨테이너 크기 기준)
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.CAMERA.FOV,
            initialWidth / initialHeight,
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
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
        });
        this.renderer.setSize(initialWidth, initialHeight);  // 🆕 컨테이너 크기 기준
        
        // ⭐ PixelRatio 최적화
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(pixelRatio);
        debugLog(`🖥️ Pixel Ratio: ${pixelRatio} (디바이스: ${window.devicePixelRatio})`);
        
        // 그림자 설정
        this.renderer.shadowMap.enabled = CONFIG.RENDERER.SHADOW_MAP_ENABLED;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 톤 매핑
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.3;
        
        // 색 공간 설정
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // 🆕 v1.5.0: DOM에 추가 (컨테이너 우선, 폴백으로 body)
        if (this._container) {
            this._container.appendChild(this.renderer.domElement);
            debugLog('🎨 Renderer → #threejs-container에 추가됨');
        } else {
            document.body.appendChild(this.renderer.domElement);
            console.warn('⚠️ #threejs-container 없음 - document.body에 추가 (폴백)');
        }
        
        debugLog('✅ Three.js 초기화 완료 (10,000 Class 클린룸 모드 - 최적화)');
        debugLog(`📷 초기 카메라 위치: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z})`);
        debugLog(`📐 초기 렌더러 크기: ${initialWidth} x ${initialHeight}`);
        
        // 바닥 추가
        this.addCleanRoomFloor();
        
        // ⭐ 클린룸 환경 구축
        this.initRoomEnvironment(roomParams);
        
        // 🆕 v1.5.0: 이벤트 리스너 (바인딩된 핸들러 사용)
        window.addEventListener('resize', this._resizeHandler);
        
        // 🆕 v1.5.0: Drawer 토글 이벤트 리스너
        window.addEventListener('drawer-toggle', this._drawerToggleHandler);
        
        return true;
    }
    
    // =========================================================
    // 🆕 v1.5.0: Drawer 토글 이벤트 핸들러
    // =========================================================
    
    /**
     * 🆕 v1.5.0: Drawer 토글 이벤트 핸들러
     * EquipmentInfoPanel에서 drawer-toggle 이벤트 발생 시 호출
     * @param {CustomEvent} event - drawer-toggle 이벤트
     */
    _onDrawerToggle(event) {
        const { isOpen } = event.detail || {};
        debugLog(`🔄 Drawer 토글 감지: ${isOpen ? '열림' : '닫힘'}`);
        
        // CSS 전환 완료 대기 후 리사이즈
        requestAnimationFrame(() => {
            this.onWindowResize();
        });
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
        
        if (this.axesHelper) {
            this.axesHelper.visible = this._helpersVisible;
        }
        
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
        
        if (this.grid) {
            this.grid.visible = this._gridVisible;
        }
        
        this.scene.traverse((object) => {
            if (object.type === 'GridHelper') {
                object.visible = this._gridVisible;
            }
        });
        
        console.log(`🔧 그리드 ${this._gridVisible ? '표시' : '숨김'}`);
        return this._gridVisible;
    }
    
    isHelpersVisible() {
        return this._helpersVisible;
    }
    
    isGridVisible() {
        return this._gridVisible;
    }
    
    // =========================================================
    // ✨ Phase 4.4: EquipmentLoader 연결
    // =========================================================
    
    setEquipmentLoader(loader) {
        if (!loader) {
            console.warn('[SceneManager] setEquipmentLoader: loader가 null입니다');
            return;
        }
        this._equipmentLoader = loader;
        console.log('[SceneManager] ✅ EquipmentLoader 연결 완료');
    }
    
    getEquipmentLoader() {
        return this._equipmentLoader;
    }
    
    // =========================================================
    // ✨ Phase 4.2: RoomEnvironment 초기화 메서드
    // =========================================================
    
    initRoomEnvironment(params = null) {
        if (this.roomEnvironment) {
            this.roomEnvironment.dispose();
            this.roomEnvironment = null;
        }
        
        this.roomEnvironment = new RoomEnvironment(this.scene, params);
        this.roomEnvironment.buildEnvironment();
        this._currentLayoutParams = params;
        
        if (params) {
            console.log('[SceneManager] ✅ RoomEnvironment 초기화 완료 (동적 params 사용)');
        } else {
            debugLog('[SceneManager] RoomEnvironment 초기화 완료 (기본 params)');
        }
        
        return this.roomEnvironment;
    }
    
    reinitRoomEnvironment(params) {
        console.log('[SceneManager] RoomEnvironment 재초기화 시작...');
        return this.initRoomEnvironment(params);
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
        this.floor = floor;
        
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
        this.grid = gridHelper;
        
        const axesHelper = new THREE.AxesHelper(10);
        axesHelper.name = 'axes-helper';
        axesHelper.visible = this._helpersVisible;
        this.scene.add(axesHelper);
        this.axesHelper = axesHelper;
        
        debugLog('🏗️ 클린룸 스타일 바닥 생성 완료');
        debugLog(`📐 바닥 크기: ${CONFIG.SCENE.FLOOR_SIZE}m × ${CONFIG.SCENE.FLOOR_SIZE}m`);
    }
    
    // =========================================================
    // ✨ Phase 4.4: Scene 정리 및 재구축 메서드
    // =========================================================
    
    clearScene() {
        console.log('[SceneManager] Scene 정리 시작...');
        this._isRebuilding = true;
        
        if (this.roomEnvironment) {
            this.roomEnvironment.dispose();
            this.roomEnvironment = null;
            console.log('  - RoomEnvironment 정리 완료');
        }
        
        if (this._equipmentLoader) {
            this._equipmentLoader.dispose();
            console.log('  - EquipmentLoader 정리 완료');
        }
        
        const objectsToRemove = [];
        this.scene.traverse((object) => {
            if (object.name === 'cleanroom-floor' || 
                object.name === 'cleanroom-grid' ||
                object.name === 'axes-helper' ||
                object.isLight) {
                return;
            }
            
            if (object.isMesh || object.isGroup) {
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
    
    rebuildScene(roomParams, equipmentConfig = null, updateStatusCallback = null) {
        console.log('[SceneManager] Scene 재구축 시작...');
        this._isRebuilding = true;
        
        try {
            if (roomParams) {
                this.updateFloor(roomParams);
            }
            
            this.initRoomEnvironment(roomParams);
            
            if (this._equipmentLoader && equipmentConfig) {
                console.log('[SceneManager] Equipment 재배치 시작...');
                
                if (typeof updateEquipmentConfig === 'function') {
                    updateEquipmentConfig(equipmentConfig);
                }
                
                this._equipmentLoader.loadEquipmentArray(updateStatusCallback);
                console.log('[SceneManager] Equipment 재배치 완료');
            }
            
            console.log('[SceneManager] ✅ Scene 재구축 완료');
            
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
    
    applyLayout(convertedLayout, options = {}) {
        if (!convertedLayout) {
            console.error('[SceneManager] applyLayout: convertedLayout이 없습니다');
            return false;
        }
        
        console.log('[SceneManager] Layout 적용 시작...');
        
        try {
            const { roomParams, equipmentConfig, officeParams } = convertedLayout;
            
            if (roomParams) {
                const newFloorSize = Math.max(roomParams.roomWidth, roomParams.roomDepth) + 20;
                updateSceneConfig({ FLOOR_SIZE: newFloorSize });
            }
            
            if (options.updateFloor !== false) {
                this.updateFloor(roomParams);
            }
            
            if (options.updateRoom !== false && this.roomEnvironment) {
                this.roomEnvironment.updateDimensions(roomParams);
                
                if (officeParams) {
                    this.roomEnvironment.updateOfficeParams(officeParams);
                }
                
                if (options.rebuildRoom !== false) {
                    this.roomEnvironment.rebuild();
                }
            }
            
            if (options.updateEquipment !== false && this._equipmentLoader && equipmentConfig) {
                this._equipmentLoader.applyDynamicConfig(equipmentConfig);
            }
            
            console.log('[SceneManager] ✅ Layout 적용 완료');
            
            window.dispatchEvent(new CustomEvent('layout-applied', {
                detail: { convertedLayout, options }
            }));
            
            return true;
            
        } catch (error) {
            console.error('[SceneManager] Layout 적용 실패:', error);
            return false;
        }
    }
    
    applyLayoutWithParams(adaptedParams, options = {}) {
        if (!adaptedParams) {
            console.error('[SceneManager] applyLayoutWithParams: adaptedParams가 없습니다');
            return false;
        }
        
        console.log('[SceneManager] Layout 적용 (params 방식) 시작...');
        
        try {
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
            
            if (options.rebuildRoom !== false) {
                this.reinitRoomEnvironment(adaptedParams);
            }
            
            console.log('[SceneManager] ✅ Layout 적용 완료 (params 방식)');
            
            window.dispatchEvent(new CustomEvent('layout-params-applied', {
                detail: { adaptedParams, options }
            }));
            
            return true;
            
        } catch (error) {
            console.error('[SceneManager] Layout 적용 실패 (params 방식):', error);
            return false;
        }
    }
    
    applyLayoutFull(layoutData, options = {}) {
        if (!layoutData) {
            console.error('[SceneManager] applyLayoutFull: layoutData가 없습니다');
            return false;
        }
        
        console.log('[SceneManager] 전체 Layout 적용 시작 (Room + Equipment)...');
        
        try {
            const converter = window.layout2DTo3DConverter;
            const adapter = window.roomParamsAdapter;
            
            if (!converter) {
                console.error('[SceneManager] layout2DTo3DConverter가 없습니다');
                return false;
            }
            
            const convertedLayout = converter.convert(layoutData);
            if (!convertedLayout) {
                throw new Error('Layout 변환 실패');
            }
            
            let adaptedParams = null;
            if (adapter) {
                adaptedParams = adapter.adapt(convertedLayout);
            } else {
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
            
            if (options.clearFirst !== false) {
                this.clearScene();
            }
            
            this.rebuildScene(
                adaptedParams, 
                convertedLayout.equipmentConfig,
                options.updateStatusCallback || null
            );
            
            this._currentLayoutParams = adaptedParams;
            
            console.log('[SceneManager] ✅ 전체 Layout 적용 완료');
            
            window.dispatchEvent(new CustomEvent('layout-full-applied', {
                detail: { layoutData, convertedLayout, adaptedParams, options }
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
        
        if (this.floor) {
            this.floor.geometry.dispose();
            this.scene.remove(this.floor);
        }
        
        if (this.grid) {
            this.grid.geometry.dispose();
            this.grid.material.dispose();
            this.scene.remove(this.grid);
        }
        
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
        
        this.grid = new THREE.GridHelper(newSize, CONFIG.SCENE.GRID_DIVISIONS, 0xe5e5e5, 0xf0f0f0);
        this.grid.material.opacity = 0.2;
        this.grid.material.transparent = true;
        this.grid.name = 'cleanroom-grid';
        this.grid.visible = this._gridVisible;
        this.scene.add(this.grid);
        
        debugLog(`[SceneManager] Floor 업데이트 완료: ${newSize}m × ${newSize}m`);
    }
    
    /**
     * 🆕 v1.5.0: 창/컨테이너 크기 변경 핸들러
     * - 컨테이너(#threejs-container) 크기 기준으로 리사이즈
     * - 컨테이너가 없으면 window 크기 사용 (폴백, 기존 동작 유지)
     */
    onWindowResize() {
        // 🆕 컨테이너 기준으로 크기 계산
        let width, height;
        
        if (this._container) {
            width = this._container.clientWidth;
            height = this._container.clientHeight;
        } else {
            // 폴백: window 크기 (기존 동작 유지)
            width = window.innerWidth;
            height = window.innerHeight;
        }
        
        // 크기가 0이면 무시 (숨겨진 상태)
        if (width === 0 || height === 0) {
            debugLog('⚠️ 컨테이너 크기가 0 - 리사이즈 스킵');
            return;
        }
        
        // 카메라 업데이트
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // 렌더러 업데이트
        this.renderer.setSize(width, height);
        
        debugLog(`📱 리사이즈: ${width} x ${height} (컨테이너: ${!!this._container})`);
    }
    
    /**
     * 🆕 v1.5.0: 수동 리사이즈 트리거
     * 외부에서 명시적으로 리사이즈를 요청할 때 사용
     */
    triggerResize() {
        this.onWindowResize();
    }
    
    /**
     * 렌더링 (애니메이션 루프에서 호출)
     */
    render() {
        this.frameCount++;
        this.fpsFrameCount++;
        
        if (this.frameCount === 1) {
            debugLog('🎬 첫 프레임 렌더링 완료');
            debugLog('📷 현재 카메라:', this.camera.position);
            debugLog('🎯 카메라 방향:', this.camera.getWorldDirection(new THREE.Vector3()));
        }
        
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
    
    getScene() { return this.scene; }
    getCamera() { return this.camera; }
    getRenderer() { return this.renderer; }
    getContainer() { return this._container; }  // 🆕 v1.5.0
    getRoomEnvironment() { return this.roomEnvironment; }
    getCurrentLayoutParams() { return this._currentLayoutParams; }
    isRebuilding() { return this._isRebuilding; }
    
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
        console.log('Container:', this._container);
        console.log('Renderer size:', this.renderer.getSize(new THREE.Vector2()));
        
        if (this.roomEnvironment) {
            this.roomEnvironment.debug();
        }
        console.groupEnd();
    }
    
    dispose() {
        // 🆕 v1.5.0: 이벤트 리스너 제거 (바인딩된 핸들러 사용)
        window.removeEventListener('resize', this._resizeHandler);
        window.removeEventListener('drawer-toggle', this._drawerToggleHandler);
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.floor) {
            this.floor.geometry.dispose();
            this.floor.material.dispose();
        }
        if (this.grid) {
            this.grid.geometry.dispose();
            this.grid.material.dispose();
        }
        
        if (this.axesHelper) {
            this.axesHelper.dispose();
        }
        
        if (this.roomEnvironment) {
            this.roomEnvironment.dispose();
        }
        
        this._currentLayoutParams = null;
        this._equipmentLoader = null;
        this._container = null;
        
        debugLog('🗑️ SceneManager 정리 완료');
    }
}