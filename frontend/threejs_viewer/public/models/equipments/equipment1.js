/**
 * equipment1.js
 * 기본 설비 모델 생성 함수
 * - Three.js 지오메트리를 사용한 직접 모델링
 * - 나중에 OBJ, STL, GLTF 등 외부 모델 추가 가능
 */

import * as THREE from 'three';

/**
 * 기본 설비 모델 생성
 * @returns {THREE.Group} 설비 모델 그룹
 */
export function createEquipmentModel() {
    console.log('🔧 설비 모델 생성 시작...');
    
    // 전체 설비를 담을 그룹
    const machineGroup = new THREE.Group();

    // 공통 재질
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xF0EAD6,      // 밝은 아이보리 (따뜻한 베이지톤)
        roughness: 0.65,      // 분체도장의 약간 거친 표면감
        metalness: 0.1        // 금속성 최소화 (분체도장 특성)
    }); // 아이보리 분체도장
    
    const darkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3A3A3A,      // 다크 그레이 (완전한 검정보다 부드러움)
        roughness: 0.6,
        metalness: 0.1
    }); // 다크 그레이 플라스틱

    // A. 메인 캐비닛 (몸통)
    const cabinetGeo = new THREE.BoxGeometry(1.0, 1.6, 0.6); // 너비, 높이, 깊이
    const cabinet = new THREE.Mesh(cabinetGeo, bodyMaterial);
    cabinet.position.y = 0.8; // 바닥 위에 올라오도록 높이 절반만큼 올림
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    machineGroup.add(cabinet);

    // B. 전면 HMI 스크린 영역
    // B-1. 스크린 베젤
    const screenBezelGeo = new THREE.BoxGeometry(0.5, 0.35, 0.05);
    const screenBezel = new THREE.Mesh(screenBezelGeo, darkMaterial);
    screenBezel.position.set(0, 1.1, 0.31); // 몸통보다 z축으로 살짝 튀어나오게
    screenBezel.castShadow = true;
    machineGroup.add(screenBezel);

    // B-2. 화면 (빛나는 효과)
    const screenGeo = new THREE.PlaneGeometry(0.45, 0.3);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00aaff }); // 파란색
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.1, 0.34); // 베젤보다 살짝 앞
    machineGroup.add(screen);

    // C. 상단 경광등 (Signal Tower)
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0.35, 1.7, 0); // 캐비닛 상단 우측
    pole.castShadow = true;
    machineGroup.add(pole);

    // 경광등 램프 생성 함수
    function createLight(color, yPos) {
        const lightGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16);
        const lightMat = new THREE.MeshStandardMaterial({ 
            color: color, 
            emissive: color, // 자체 발광 느낌
            emissiveIntensity: 0.5,
            transparent: true, 
            opacity: 0.9 
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(0.35, yPos, 0);
        light.castShadow = true;
        return light;
    }

    // 녹색, 황색, 적색 램프 쌓기
    machineGroup.add(createLight(0x00ff00, 1.84)); // Green
    machineGroup.add(createLight(0xffff00, 1.92)); // Yellow
    machineGroup.add(createLight(0xff0000, 2.00)); // Red

    // D. 도어 핸들 (디테일)
    const handleGeo = new THREE.BoxGeometry(0.02, 0.15, 0.02);
    const handle = new THREE.Mesh(handleGeo, darkMaterial);
    handle.position.set(0.3, 0.9, 0.31);
    handle.castShadow = true;
    machineGroup.add(handle);

    console.log('✅ 설비 모델 생성 완료');
    console.log('📦 Group children:', machineGroup.children.length);

    // 모델 크기 확인
    const box = new THREE.Box3().setFromObject(machineGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = new THREE.Vector3();
    box.getCenter(center);

    console.log('📏 원본 모델 크기:');
    console.log(`   - X: ${size.x.toFixed(2)}m`);
    console.log(`   - Y: ${size.y.toFixed(2)}m`);
    console.log(`   - Z: ${size.z.toFixed(2)}m`);
    console.log('📍 원본 중심:', center);

    // 중심을 원점으로 이동
    machineGroup.position.sub(center);
    console.log('📍 중심 조정 후 위치:', machineGroup.position);

    // 크기 조정 (높이를 2.2m로)
    const targetHeight = 2.2;
    const scale = targetHeight / size.y;
    machineGroup.scale.set(scale, scale, scale);

    // 최종 확인
    const finalBox = new THREE.Box3().setFromObject(machineGroup);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    console.log('📐 조정된 모델 크기:');
    console.log(`   - X: ${finalSize.x.toFixed(2)}m`);
    console.log(`   - Y: ${finalSize.y.toFixed(2)}m`);
    console.log(`   - Z: ${finalSize.z.toFixed(2)}m`);

    return machineGroup;
}

/**
 * 향후 OBJ 모델 로더 (예시)
 * @param {string} objPath - OBJ 파일 경로
 * @returns {Promise<THREE.Group>}
 */
export async function loadOBJModel(objPath) {
    // TODO: OBJLoader 구현
    console.log('OBJ 모델 로딩 예정:', objPath);
    throw new Error('OBJ loader not implemented yet');
}

/**
 * 향후 STL 모델 로더 (예시)
 * @param {string} stlPath - STL 파일 경로
 * @returns {Promise<THREE.Group>}
 */
export async function loadSTLModel(stlPath) {
    // TODO: STLLoader 구현
    console.log('STL 모델 로딩 예정:', stlPath);
    throw new Error('STL loader not implemented yet');
}

/**
 * 향후 GLTF 모델 로더 (예시)
 * @param {string} gltfPath - GLTF 파일 경로
 * @returns {Promise<THREE.Group>}
 */
export async function loadGLTFModel(gltfPath) {
    // TODO: GLTFLoader 구현
    console.log('GLTF 모델 로딩 예정:', gltfPath);
    throw new Error('GLTF loader not implemented yet');
}