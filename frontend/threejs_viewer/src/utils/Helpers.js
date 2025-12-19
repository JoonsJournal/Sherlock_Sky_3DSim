/**
 * Helpers.js
 * 디버깅 및 유틸리티 헬퍼 함수들
 */

import * as THREE from 'three';

/**
 * 씬에 디버깅 헬퍼들 추가
 * @param {THREE.Scene} scene - Three.js 씬
 */
export function addDebugHelpers(scene) {
    // 축 헬퍼 추가 (X:빨강, Y:초록, Z:파랑)
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);
    console.log('📐 축 헬퍼 추가 (X:빨강, Y:초록, Z:파랑)');
    
    // 원점에 작은 구체 추가
    const originMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    originMarker.position.set(0, 0, 0);
    scene.add(originMarker);
    console.log('🎯 원점 마커 추가 (노란 구체)');
    
    // 테스트 큐브 추가
    const testCube = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            wireframe: false
        })
    );
    testCube.position.set(0, 1, 0);
    scene.add(testCube);
    console.log('🧪 테스트 큐브 추가 (빨간 박스, 위치: 0, 1, 0)');
    
    // 테스트 큐브 경계 박스 추가
    const boxHelper = new THREE.BoxHelper(testCube, 0x00ff00);
    scene.add(boxHelper);
}

/**
 * 씬 정보 출력
 * @param {THREE.Scene} scene - Three.js 씬
 * @param {THREE.Camera} camera - 카메라
 * @param {OrbitControls} controls - 카메라 컨트롤
 * @param {Array} equipmentArray - 설비 배열
 */
export function debugScene(scene, camera, controls, equipmentArray) {
    console.log('═══════════════════════════════════════');
    console.log('🔍 SCENE DEBUG INFO');
    console.log('═══════════════════════════════════════');
    console.log('📦 총 객체 수:', scene.children.length);
    console.log('📷 카메라 위치:', camera.position);
    console.log('🎯 카메라 타겟:', controls.target);
    console.log('📊 equipmentArray 크기:', equipmentArray.length);
    console.log('───────────────────────────────────────');
    console.log('객체 목록:');
    scene.children.forEach((child, index) => {
        const pos = `(${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)})`;
        console.log(`  [${index}] ${child.type}: ${child.name || 'unnamed'} @ ${pos}`);
        if (child.children && child.children.length > 0) {
            console.log(`       └─ children: ${child.children.length}`);
        }
    });
    console.log('═══════════════════════════════════════');
}

/**
 * 카메라를 특정 위치로 이동
 * @param {THREE.Camera} camera - 카메라
 * @param {OrbitControls} controls - 카메라 컨트롤
 * @param {number} x - X 좌표
 * @param {number} y - Y 좌표
 * @param {number} z - Z 좌표
 */
export function moveCameraTo(camera, controls, x, y, z) {
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    console.log('📷 카메라 이동:', camera.position);
}

/**
 * 특정 설비로 카메라 포커스
 * @param {THREE.Camera} camera - 카메라
 * @param {OrbitControls} controls - 카메라 컨트롤
 * @param {Array} equipmentArray - 설비 배열
 * @param {number} row - 행 번호 (1-based)
 * @param {number} col - 열 번호 (1-based)
 */
export function focusEquipment(camera, controls, equipmentArray, row, col) {
    const index = (row - 1) * 7 + (col - 1);
    if (index >= 0 && index < equipmentArray.length) {
        const equipment = equipmentArray[index];
        const pos = equipment.position;
        camera.position.set(pos.x + 5, pos.y + 5, pos.z + 5);
        camera.lookAt(pos);
        controls.target.copy(pos);
        console.log('📷 설비에 포커스:', equipment.userData.id, pos);
    } else {
        console.error('❌ 유효하지 않은 위치:', row, col);
    }
}

/**
 * 모든 헬퍼 표시 토글
 * @param {THREE.Scene} scene - Three.js 씬
 */
export function toggleHelpers(scene) {
    scene.traverse((child) => {
        if (child instanceof THREE.AxesHelper || 
            child instanceof THREE.BoxHelper || 
            child instanceof THREE.Box3Helper) {
            child.visible = !child.visible;
        }
    });
    console.log('🔄 헬퍼 표시 토글');
}

/**
 * 렌더러 정보 출력
 * @param {THREE.WebGLRenderer} renderer - 렌더러
 */
export function debugRenderer(renderer) {
    console.log('═══════════════════════════════════════');
    console.log('🎨 RENDERER INFO');
    console.log('═══════════════════════════════════════');
    console.log('Renderer:', renderer.info.render);
    console.log('Memory:', renderer.info.memory);
    console.log('Programs:', renderer.info.programs?.length);
    console.log('═══════════════════════════════════════');
}

/**
 * 성능 측정
 * @param {number} duration - 측정 시간 (ms)
 */
export function measurePerformance(duration = 5000) {
    console.log(`⏱️ ${duration}ms 동안 성능 측정 시작...`);
    const startTime = performance.now();
    let frames = 0;
    
    const measure = () => {
        frames++;
        const elapsed = performance.now() - startTime;
        if (elapsed < duration) {
            requestAnimationFrame(measure);
        } else {
            const fps = (frames / elapsed) * 1000;
            console.log('═══════════════════════════════════════');
            console.log('📊 PERFORMANCE REPORT');
            console.log('═══════════════════════════════════════');
            console.log(`⚡ 평균 FPS: ${fps.toFixed(2)}`);
            console.log(`🎬 총 프레임: ${frames}`);
            console.log(`⏱️ 측정 시간: ${(elapsed/1000).toFixed(2)}초`);
            console.log('═══════════════════════════════════════');
        }
    };
    
    requestAnimationFrame(measure);
}

/**
 * 도움말 출력
 */
export function debugHelp() {
    console.log('═══════════════════════════════════════');
    console.log('💡 디버깅 명령어 목록');
    console.log('═══════════════════════════════════════');
    console.log('debugScene()                 - 씬 정보 출력');
    console.log('moveCameraTo(x, y, z)        - 카메라 이동');
    console.log('focusEquipment(row, col)     - 특정 설비로 포커스');
    console.log('toggleHelpers()              - 헬퍼 표시/숨김');
    console.log('debugRenderer()              - 렌더러 정보');
    console.log('measurePerformance(ms)       - 성능 측정');
    console.log('debugHelp()                  - 이 도움말');
    console.log('═══════════════════════════════════════');
    console.log('📷 카메라 네비게이션:');
    console.log('  setCameraView(0~7) - 특정 방향으로 카메라 이동');
    console.log('  rotateCameraView() - 90도 시계방향 회전');
    console.log('  toggleCameraNavigator() - 네비게이터 표시/숨김');
}