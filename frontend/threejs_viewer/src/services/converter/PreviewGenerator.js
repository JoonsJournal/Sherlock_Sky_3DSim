/**
 * PreviewGenerator.js
 * ====================
 * 
 * 3D Preview 기능을 위한 독립적인 Three.js Scene 생성 및 관리
 * 
 * @version 1.0.0 - Phase 4.5: 3D Preview 기능
 * 
 * 주요 기능:
 * 1. Modal 내부에 독립적인 Three.js Scene 생성
 * 2. Layout 데이터를 간소화된 3D로 빠르게 렌더링
 * 3. OrbitControls로 회전/줌 지원
 * 4. dispose()로 메모리 완전 정리
 * 
 * 위치: frontend/threejs_viewer/src/services/converter/PreviewGenerator.js
 */

// Three.js는 전역으로 로드되어 있다고 가정 (import map 사용 시)
// import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class PreviewGenerator {
    constructor(options = {}) {
        // 설정
        this.config = {
            canvasWidth: options.canvasWidth || 800,
            canvasHeight: options.canvasHeight || 500,
            backgroundColor: options.backgroundColor || 0x1a1a2e,
            floorColor: options.floorColor || 0x2d2d44,
            wallColor: options.wallColor || 0x4a4a6a,
            equipmentColor: options.equipmentColor || 0x4a90e2,
            officeColor: options.officeColor || 0x3498db,
            gridColor: options.gridColor || 0x444466,
            ambientLightIntensity: options.ambientLightIntensity || 0.6,
            directionalLightIntensity: options.directionalLightIntensity || 0.8
        };
        
        // Three.js 객체
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationId = null;
        
        // 생성된 객체 추적 (dispose용)
        this.meshes = [];
        this.materials = [];
        this.geometries = [];
        
        // 상태
        this.isActive = false;
        this.currentLayout = null;
        
        console.log('[PreviewGenerator] ✅ 초기화 완료 (v1.0.0)');
    }
    
    /**
     * Preview 생성
     * @param {Object} layoutData - Layout JSON 데이터
     * @param {string} canvasId - Canvas 요소 ID
     * @returns {boolean} 성공 여부
     */
    createPreview(layoutData, canvasId) {
        console.log('[PreviewGenerator] Creating preview...');
        
        if (!layoutData) {
            console.error('[PreviewGenerator] layoutData가 없습니다');
            return false;
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[PreviewGenerator] Canvas "${canvasId}"를 찾을 수 없습니다`);
            return false;
        }
        
        try {
            // 기존 Preview 정리
            if (this.isActive) {
                this.dispose();
            }
            
            this.currentLayout = layoutData;
            
            // 1. Scene 설정
            this.setupScene();
            
            // 2. Camera 설정
            this.setupCamera(layoutData);
            
            // 3. Renderer 설정
            this.setupRenderer(canvas);
            
            // 4. Controls 설정
            this.setupControls();
            
            // 5. Lighting 설정
            this.setupLighting();
            
            // 6. Grid Helper 추가
            this.addGridHelper(layoutData);
            
            // 7. Room 렌더링 (바닥, 벽)
            this.renderRoom(layoutData);
            
            // 8. Equipment 렌더링
            this.renderEquipment(layoutData);
            
            // 9. Office 렌더링 (있는 경우)
            if (layoutData.office) {
                this.renderOffice(layoutData);
            }
            
            // 10. 애니메이션 루프 시작
            this.startRenderLoop();
            
            this.isActive = true;
            console.log('[PreviewGenerator] ✅ Preview 생성 완료');
            
            return true;
            
        } catch (error) {
            console.error('[PreviewGenerator] Preview 생성 실패:', error);
            this.dispose();
            return false;
        }
    }
    
    /**
     * Scene 설정
     */
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.backgroundColor);
        
        // 안개 효과 (깊이감)
        this.scene.fog = new THREE.Fog(this.config.backgroundColor, 50, 150);
        
        console.log('[PreviewGenerator] Scene 설정 완료');
    }
    
    /**
     * Camera 설정
     * @param {Object} layoutData - Layout 데이터
     */
    setupCamera(layoutData) {
        const aspect = this.config.canvasWidth / this.config.canvasHeight;
        
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        
        // Room 크기에 따라 카메라 위치 조정
        const roomWidth = layoutData.room?.width || 40;
        const roomDepth = layoutData.room?.depth || 60;
        const maxDimension = Math.max(roomWidth, roomDepth);
        
        // 대각선 뷰로 초기 위치 설정
        const distance = maxDimension * 0.8;
        this.camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
        this.camera.lookAt(0, 0, 0);
        
        console.log('[PreviewGenerator] Camera 설정 완료');
    }
    
    /**
     * Renderer 설정
     * @param {HTMLCanvasElement} canvas - Canvas 요소
     */
    setupRenderer(canvas) {
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: false
        });
        
        this.renderer.setSize(this.config.canvasWidth, this.config.canvasHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = false; // 성능 우선
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        console.log('[PreviewGenerator] Renderer 설정 완료');
    }
    
    /**
     * OrbitControls 설정
     */
    setupControls() {
        // OrbitControls가 전역으로 로드되어 있는지 확인
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        } else if (window.OrbitControls) {
            this.controls = new window.OrbitControls(this.camera, this.renderer.domElement);
        } else {
            console.warn('[PreviewGenerator] OrbitControls를 찾을 수 없습니다. 기본 컨트롤 사용.');
            return;
        }
        
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 200;
        this.controls.maxPolarAngle = Math.PI / 2;  // 바닥 아래로 못 가게
        
        console.log('[PreviewGenerator] Controls 설정 완료');
    }
    
    /**
     * Lighting 설정 (최소화 - 성능 우선)
     */
    setupLighting() {
        // Ambient Light
        const ambientLight = new THREE.AmbientLight(
            0xffffff, 
            this.config.ambientLightIntensity
        );
        this.scene.add(ambientLight);
        
        // Directional Light
        const directionalLight = new THREE.DirectionalLight(
            0xffffff, 
            this.config.directionalLightIntensity
        );
        directionalLight.position.set(30, 50, 30);
        this.scene.add(directionalLight);
        
        // Hemisphere Light (자연스러운 조명)
        const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3);
        this.scene.add(hemisphereLight);
        
        console.log('[PreviewGenerator] Lighting 설정 완료');
    }
    
    /**
     * Grid Helper 추가
     * @param {Object} layoutData - Layout 데이터
     */
    addGridHelper(layoutData) {
        const roomWidth = layoutData.room?.width || 40;
        const roomDepth = layoutData.room?.depth || 60;
        const gridSize = Math.max(roomWidth, roomDepth) + 20;
        
        const gridHelper = new THREE.GridHelper(gridSize, gridSize / 2, 
            this.config.gridColor, this.config.gridColor);
        gridHelper.position.y = 0.01;  // 바닥 위에 살짝
        
        this.scene.add(gridHelper);
        this.meshes.push(gridHelper);
    }
    
    /**
     * Room 렌더링 (바닥, 벽)
     * @param {Object} layoutData - Layout 데이터
     */
    renderRoom(layoutData) {
        const roomWidth = layoutData.room?.width || 40;
        const roomDepth = layoutData.room?.depth || 60;
        const wallHeight = layoutData.room?.wallHeight || 4;
        const wallThickness = layoutData.room?.wallThickness || 0.2;
        
        // 1. 바닥
        const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: this.config.floorColor,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = false;
        
        this.scene.add(floor);
        this.meshes.push(floor);
        this.geometries.push(floorGeometry);
        this.materials.push(floorMaterial);
        
        // 2. 벽 (4면)
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: this.config.wallColor,
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.7
        });
        this.materials.push(wallMaterial);
        
        // 벽 위치 및 크기
        const walls = [
            // 뒤쪽 벽 (Z-)
            { 
                width: roomWidth, height: wallHeight, depth: wallThickness,
                position: { x: 0, y: wallHeight / 2, z: -roomDepth / 2 }
            },
            // 앞쪽 벽 (Z+)
            { 
                width: roomWidth, height: wallHeight, depth: wallThickness,
                position: { x: 0, y: wallHeight / 2, z: roomDepth / 2 }
            },
            // 왼쪽 벽 (X-)
            { 
                width: wallThickness, height: wallHeight, depth: roomDepth,
                position: { x: -roomWidth / 2, y: wallHeight / 2, z: 0 }
            },
            // 오른쪽 벽 (X+)
            { 
                width: wallThickness, height: wallHeight, depth: roomDepth,
                position: { x: roomWidth / 2, y: wallHeight / 2, z: 0 }
            }
        ];
        
        walls.forEach(wallConfig => {
            const geometry = new THREE.BoxGeometry(
                wallConfig.width, 
                wallConfig.height, 
                wallConfig.depth
            );
            const wall = new THREE.Mesh(geometry, wallMaterial);
            wall.position.set(
                wallConfig.position.x,
                wallConfig.position.y,
                wallConfig.position.z
            );
            
            this.scene.add(wall);
            this.meshes.push(wall);
            this.geometries.push(geometry);
        });
        
        console.log('[PreviewGenerator] Room 렌더링 완료');
    }
    
    /**
     * Equipment 렌더링 (Box 형태로 간소화)
     * @param {Object} layoutData - Layout 데이터
     */
    renderEquipment(layoutData) {
        const equipmentArrays = layoutData.equipmentArrays || [];
        const scale = layoutData.canvas?.scale || 10;
        const canvasWidth = layoutData.canvas?.width || 1200;
        const canvasHeight = layoutData.canvas?.height || 800;
        
        // Canvas 중심점
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        let equipmentCount = 0;
        
        // Equipment Material (공유)
        const equipmentMaterial = new THREE.MeshStandardMaterial({
            color: this.config.equipmentColor,
            roughness: 0.5,
            metalness: 0.3
        });
        this.materials.push(equipmentMaterial);
        
        equipmentArrays.forEach((arrayConfig, arrayIndex) => {
            const equipments = arrayConfig.equipments || [];
            
            equipments.forEach((eq, eqIndex) => {
                // Canvas 좌표 → 3D 좌표 변환
                const x = (eq.x - centerX) / scale;
                const z = (eq.y - centerY) / scale;
                const width = eq.width / scale;
                const depth = eq.height / scale;
                const height = 2;  // 고정 높이
                
                // Box Geometry
                const geometry = new THREE.BoxGeometry(width, height, depth);
                const mesh = new THREE.Mesh(geometry, equipmentMaterial);
                
                mesh.position.set(x, height / 2, z);
                
                // 회전 적용
                if (eq.rotation) {
                    mesh.rotation.y = -eq.rotation * Math.PI / 180;
                }
                
                this.scene.add(mesh);
                this.meshes.push(mesh);
                this.geometries.push(geometry);
                
                equipmentCount++;
            });
        });
        
        // 개별 equipments 배열도 처리
        const individualEquipments = layoutData.equipments || [];
        individualEquipments.forEach(eq => {
            const x = (eq.x - centerX) / scale;
            const z = (eq.y - centerY) / scale;
            const width = (eq.width || 15) / scale;
            const depth = (eq.height || 30) / scale;
            const height = 2;
            
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const mesh = new THREE.Mesh(geometry, equipmentMaterial);
            
            mesh.position.set(x, height / 2, z);
            
            if (eq.rotation) {
                mesh.rotation.y = -eq.rotation * Math.PI / 180;
            }
            
            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.geometries.push(geometry);
            
            equipmentCount++;
        });
        
        console.log(`[PreviewGenerator] Equipment 렌더링 완료: ${equipmentCount}개`);
    }
    
    /**
     * Office 렌더링
     * @param {Object} layoutData - Layout 데이터
     */
    renderOffice(layoutData) {
        const office = layoutData.office;
        if (!office) return;
        
        const scale = layoutData.canvas?.scale || 10;
        const canvasWidth = layoutData.canvas?.width || 1200;
        const canvasHeight = layoutData.canvas?.height || 800;
        
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        // Canvas 좌표 → 3D 좌표 변환
        const x = (office.x - centerX) / scale;
        const z = (office.y - centerY) / scale;
        const width = office.width / scale;
        const depth = office.height / scale;
        const height = 3;  // Office 높이
        
        // Office Material
        const officeMaterial = new THREE.MeshStandardMaterial({
            color: this.config.officeColor,
            roughness: 0.6,
            metalness: 0.2,
            transparent: true,
            opacity: 0.8
        });
        this.materials.push(officeMaterial);
        
        // Office Box
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geometry, officeMaterial);
        
        // Office는 보통 중심이 아닌 모서리 기준이므로 위치 조정
        mesh.position.set(x + width / 2, height / 2, z + depth / 2);
        
        this.scene.add(mesh);
        this.meshes.push(mesh);
        this.geometries.push(geometry);
        
        console.log('[PreviewGenerator] Office 렌더링 완료');
    }
    
    /**
     * 애니메이션 루프 시작
     */
    startRenderLoop() {
        const animate = () => {
            if (!this.isActive) return;
            
            this.animationId = requestAnimationFrame(animate);
            
            if (this.controls) {
                this.controls.update();
            }
            
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        
        this.isActive = true;
        animate();
        
        console.log('[PreviewGenerator] 애니메이션 루프 시작');
    }
    
    /**
     * 애니메이션 루프 중지
     */
    stopRenderLoop() {
        this.isActive = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('[PreviewGenerator] 애니메이션 루프 중지');
    }
    
    /**
     * 카메라 뷰 변경
     * @param {string} viewType - 'perspective', 'top', 'front', 'side'
     */
    setView(viewType) {
        if (!this.camera || !this.currentLayout) return;
        
        const roomWidth = this.currentLayout.room?.width || 40;
        const roomDepth = this.currentLayout.room?.depth || 60;
        const maxDimension = Math.max(roomWidth, roomDepth);
        const distance = maxDimension * 0.8;
        
        switch (viewType) {
            case 'top':
                this.camera.position.set(0, distance, 0.1);
                break;
            case 'front':
                this.camera.position.set(0, distance * 0.3, distance);
                break;
            case 'side':
                this.camera.position.set(distance, distance * 0.3, 0);
                break;
            case 'perspective':
            default:
                this.camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
                break;
        }
        
        this.camera.lookAt(0, 0, 0);
        
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        
        console.log(`[PreviewGenerator] View 변경: ${viewType}`);
    }
    
    /**
     * 리소스 정리 및 해제
     */
    dispose() {
        console.log('[PreviewGenerator] Disposing resources...');
        
        // 1. 애니메이션 중지
        this.stopRenderLoop();
        
        // 2. Controls 정리
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        
        // 3. Geometries 정리
        this.geometries.forEach(geometry => {
            if (geometry && geometry.dispose) {
                geometry.dispose();
            }
        });
        this.geometries = [];
        
        // 4. Materials 정리
        this.materials.forEach(material => {
            if (material && material.dispose) {
                material.dispose();
            }
        });
        this.materials = [];
        
        // 5. Meshes 정리
        this.meshes.forEach(mesh => {
            if (mesh) {
                if (mesh.parent) {
                    mesh.parent.remove(mesh);
                }
            }
        });
        this.meshes = [];
        
        // 6. Scene 정리
        if (this.scene) {
            // Scene의 모든 자식 제거
            while (this.scene.children.length > 0) {
                const child = this.scene.children[0];
                this.scene.remove(child);
            }
            this.scene = null;
        }
        
        // 7. Renderer 정리
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            this.renderer = null;
        }
        
        // 8. Camera 정리
        this.camera = null;
        
        // 9. 상태 초기화
        this.isActive = false;
        this.currentLayout = null;
        
        console.log('[PreviewGenerator] ✅ 리소스 정리 완료');
    }
    
    /**
     * Canvas 크기 변경
     * @param {number} width - 새 너비
     * @param {number} height - 새 높이
     */
    resize(width, height) {
        if (!this.renderer || !this.camera) return;
        
        this.config.canvasWidth = width;
        this.config.canvasHeight = height;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        
        console.log(`[PreviewGenerator] Canvas 크기 변경: ${width}x${height}`);
    }
    
    /**
     * Layout 요약 정보 생성
     * @param {Object} layoutData - Layout 데이터
     * @returns {Object} 요약 정보
     */
    static getLayoutSummary(layoutData) {
        if (!layoutData) return null;
        
        let equipmentCount = 0;
        
        // equipmentArrays 카운트
        const arrays = layoutData.equipmentArrays || [];
        arrays.forEach(arr => {
            equipmentCount += (arr.equipments || []).length;
        });
        
        // 개별 equipments 카운트
        equipmentCount += (layoutData.equipments || []).length;
        
        // 벽 카운트
        const wallCount = (layoutData.walls || []).length;
        
        return {
            siteId: layoutData.site_id || 'Unknown',
            templateName: layoutData.template_name || 'Custom',
            roomWidth: layoutData.room?.width || 40,
            roomDepth: layoutData.room?.depth || 60,
            wallHeight: layoutData.room?.wallHeight || 4,
            equipmentCount: equipmentCount,
            wallCount: wallCount,
            hasOffice: !!layoutData.office,
            version: layoutData.version || '1.0'
        };
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.log('[PreviewGenerator] Debug Info:', {
            isActive: this.isActive,
            hasScene: !!this.scene,
            hasCamera: !!this.camera,
            hasRenderer: !!this.renderer,
            hasControls: !!this.controls,
            meshCount: this.meshes.length,
            materialCount: this.materials.length,
            geometryCount: this.geometries.length,
            currentLayout: this.currentLayout ? 'loaded' : 'none'
        });
    }
}

// 전역 객체로 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
    window.PreviewGenerator = PreviewGenerator;
}

// ES Module export
// export { PreviewGenerator };
// export default PreviewGenerator;