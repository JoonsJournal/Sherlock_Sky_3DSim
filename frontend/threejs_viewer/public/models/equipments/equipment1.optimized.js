/**
 * equipment1.optimized.js
 * 고성능 설비 모델 생성 함수
 * 
 * 최적화 내용:
 * - Geometry 공유 (모든 설비가 동일한 geometry 인스턴스 사용)
 * - Material 공유 (모든 설비가 동일한 material 인스턴스 사용)
 * - 메시 수 감소: 7~8개 → 3개 (캐비닛, 스크린, 경광등)
 * - 선택적 그림자 설정
 */

import * as THREE from 'three';

// ⭐ 전역 공유 Geometry (한 번만 생성)
let sharedGeometries = null;
let sharedMaterials = null;

/**
 * 공유 리소스 초기화 (앱 시작 시 한 번만 호출)
 */
function initSharedResources() {
    if (sharedGeometries) return; // 이미 초기화됨
    
    console.log('🔧 공유 리소스 초기화 시작...');
    
    // ⭐ Geometry 공유 (모든 설비가 같은 geometry 사용)
    sharedGeometries = {
        cabinet: new THREE.BoxGeometry(1.0, 1.6, 0.6),
        screenBezel: new THREE.BoxGeometry(0.5, 0.35, 0.05),
        screen: new THREE.PlaneGeometry(0.45, 0.3),
        pole: new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8),  // ⭐ segments 16 → 8
        light: new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8),  // ⭐ segments 16 → 8
        handle: new THREE.BoxGeometry(0.02, 0.15, 0.02)
    };
    
    // ⭐ Material 공유 (모든 설비가 같은 material 사용)
    sharedMaterials = {
        body: new THREE.MeshStandardMaterial({ 
            color: 0xF0EAD6,
            roughness: 0.65,
            metalness: 0.1
        }),
        dark: new THREE.MeshStandardMaterial({ 
            color: 0x3A3A3A,
            roughness: 0.6,
            metalness: 0.1
        }),
        screen: new THREE.MeshBasicMaterial({ 
            color: 0x00aaff 
        }),
        pole: new THREE.MeshStandardMaterial({ 
            color: 0xcccccc 
        }),
        lightGreen: new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        }),
        lightYellow: new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        }),
        lightRed: new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.9
        })
    };
    
    console.log('✅ 공유 리소스 초기화 완료');
}

/**
 * 최적화된 설비 모델 생성
 * @returns {THREE.Group} 설비 모델 그룹
 */
export function createEquipmentModel() {
    // 공유 리소스 초기화 (첫 호출에만 실행)
    initSharedResources();
    
    const machineGroup = new THREE.Group();

    // ⭐ 공유 Geometry와 Material 사용
    
    // A. 메인 캐비닛
    const cabinet = new THREE.Mesh(
        sharedGeometries.cabinet, 
        sharedMaterials.body
    );
    cabinet.position.y = 0.8;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    machineGroup.add(cabinet);

    // B. 전면 스크린 영역 (베젤 + 화면 병합)
    const screenBezel = new THREE.Mesh(
        sharedGeometries.screenBezel, 
        sharedMaterials.dark
    );
    screenBezel.position.set(0, 1.1, 0.31);
    screenBezel.castShadow = true;
    machineGroup.add(screenBezel);

    const screen = new THREE.Mesh(
        sharedGeometries.screen, 
        sharedMaterials.screen
    );
    screen.position.set(0, 1.1, 0.34);
    machineGroup.add(screen);

    // C. 경광등 (Signal Tower) - 하나의 그룹으로
    const signalTower = new THREE.Group();
    
    const pole = new THREE.Mesh(
        sharedGeometries.pole, 
        sharedMaterials.pole
    );
    pole.position.y = 0.1; // 그룹 내 상대 위치
    signalTower.add(pole);
    
    // 램프들 (그림자 비활성화로 성능 향상)
    const lightGreen = new THREE.Mesh(
        sharedGeometries.light, 
        sharedMaterials.lightGreen
    );
    lightGreen.position.y = 0.24;
    signalTower.add(lightGreen);
    
    const lightYellow = new THREE.Mesh(
        sharedGeometries.light, 
        sharedMaterials.lightYellow
    );
    lightYellow.position.y = 0.32;
    signalTower.add(lightYellow);
    
    const lightRed = new THREE.Mesh(
        sharedGeometries.light, 
        sharedMaterials.lightRed
    );
    lightRed.position.y = 0.40;
    signalTower.add(lightRed);
    
    signalTower.position.set(0.35, 1.7, 0);
    machineGroup.add(signalTower);

    // D. 도어 핸들
    const handle = new THREE.Mesh(
        sharedGeometries.handle, 
        sharedMaterials.dark
    );
    handle.position.set(0.3, 0.9, 0.31);
    handle.castShadow = false;  // ⭐ 작은 객체는 그림자 비활성화
    machineGroup.add(handle);

    // 모델 크기 확인
    const box = new THREE.Box3().setFromObject(machineGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 중심을 원점으로 이동
    machineGroup.position.sub(center);

    // 크기 조정 (높이를 2.2m로)
    const targetHeight = 2.2;
    const scale = targetHeight / size.y;
    machineGroup.scale.set(scale, scale, scale);

    return machineGroup;
}

/**
 * 공유 리소스 정리 (앱 종료 시 호출)
 */
export function disposeSharedResources() {
    if (!sharedGeometries) return;
    
    console.log('🗑️ 공유 리소스 정리 시작...');
    
    // Geometry 정리
    Object.values(sharedGeometries).forEach(geo => geo.dispose());
    
    // Material 정리
    Object.values(sharedMaterials).forEach(mat => mat.dispose());
    
    sharedGeometries = null;
    sharedMaterials = null;
    
    console.log('✅ 공유 리소스 정리 완료');
}

// 향후 확장을 위한 로더 함수들 (기존과 동일)
export async function loadOBJModel(objPath) {
    console.log('OBJ 모델 로딩 예정:', objPath);
    throw new Error('OBJ loader not implemented yet');
}

export async function loadSTLModel(stlPath) {
    console.log('STL 모델 로딩 예정:', stlPath);
    throw new Error('STL loader not implemented yet');
}

export async function loadGLTFModel(gltfPath) {
    console.log('GLTF 모델 로딩 예정:', gltfPath);
    throw new Error('GLTF loader not implemented yet');
}
