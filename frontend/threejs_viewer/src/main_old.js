import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// 다른 loader가 있다면 모두 three/addons/로 변경

// ============================================
// 디버그 모드 설정
// ============================================

const DEBUG_MODE = true;  // false로 설정하면 디버깅 기능 비활성화

function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

// ============================================
// 1. 기본 설정
// ============================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(20, 20, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

debugLog('✅ Three.js 초기화 완료');
debugLog('📷 초기 카메라 위치:', camera.position);

// ============================================
// 클릭 감지를 위한 Raycaster 설정
// ============================================

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedEquipment = null;
const equipmentArray = [];

// ============================================
// 2. 조명 추가
// ============================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(20, 30, 20);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(-20, 20, -20);
scene.add(pointLight);

debugLog('💡 조명 추가 완료');

// ============================================
// 3. 바닥 만들기
// ============================================

const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2d3436,
    roughness: 0.8
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
scene.add(gridHelper);

debugLog('🏗️ 바닥 및 그리드 생성 완료');

// ============================================
// 디버깅용 헬퍼들
// ============================================

if (DEBUG_MODE) {
    // 축 헬퍼 추가 (X:빨강, Y:초록, Z:파랑)
    const axesHelper = new THREE.AxesHelper(10);
    scene.add(axesHelper);
    debugLog('📐 축 헬퍼 추가 (X:빨강, Y:초록, Z:파랑)');
    
    // 원점에 작은 구체 추가
    const originMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    originMarker.position.set(0, 0, 0);
    scene.add(originMarker);
    debugLog('🎯 원점 마커 추가 (노란 구체)');
    
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
    debugLog('🧪 테스트 큐브 추가 (빨간 박스, 위치: 0, 1, 0)');
    
    // 테스트 큐브 경계 박스 추가
    const boxHelper = new THREE.BoxHelper(testCube, 0x00ff00);
    scene.add(boxHelper);
}

// ============================================
// 로딩 상태 UI
// ============================================

function updateLoadingStatus(message, isError = false) {
    const statusDiv = document.getElementById('loadingStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? '#e74c3c' : '#2ecc71';
    }
    debugLog(isError ? '❌' : '✅', message);
}

// ============================================
// 4. 설비 모델 생성 함수
// ============================================

function createEquipmentModel() {
    debugLog('🔧 설비 모델 생성 시작...');
    
    // --- 설비 모델링 시작 ---
    const machineGroup = new THREE.Group(); // 전체 설비를 담을 그룹

    // 공통 재질
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080, 
        roughness: 0.4, 
        metalness: 0.3 
    }); // 회색 금속
    
    const darkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222 
    }); // 검은색 플라스틱

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

    // --- 설비 모델링 끝 ---

    debugLog('✅ 설비 모델 생성 완료');
    debugLog('📦 Group children:', machineGroup.children.length);

    // 모델 크기 확인
    const box = new THREE.Box3().setFromObject(machineGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = new THREE.Vector3();
    box.getCenter(center);

    debugLog('📏 원본 모델 크기:');
    debugLog(`   - X: ${size.x.toFixed(2)}m`);
    debugLog(`   - Y: ${size.y.toFixed(2)}m`);
    debugLog(`   - Z: ${size.z.toFixed(2)}m`);
    debugLog('📍 원본 중심:', center);

    // 중심을 원점으로 이동
    machineGroup.position.sub(center);
    debugLog('📍 중심 조정 후 위치:', machineGroup.position);

    // 크기 조정 (높이를 2.2m로)
    const targetHeight = 2.2;
    const scale = targetHeight / size.y;
    machineGroup.scale.set(scale, scale, scale);

    debugLog('📐 스케일 조정:');
    debugLog(`   - 비율: ${scale.toFixed(4)}`);
    debugLog(`   - 조정 후 높이: ${(size.y * scale).toFixed(2)}m`);

    return machineGroup;
}

// ============================================
// 5. 설비 데이터 생성 함수
// ============================================

function generateEquipmentData(row, col) {
    const statuses = ['running', 'idle', 'error'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
        id: `EQUIP-${String(row + 1).padStart(2, '0')}-${String(col + 1).padStart(2, '0')}`,
        name: `설비 #${row * 7 + col + 1}`,
        row: row + 1,
        col: col + 1,
        position: {
            row: `Row ${row + 1}`,
            col: `Col ${col + 1}`
        },
        status: randomStatus,
        temperature: (20 + Math.random() * 30).toFixed(1) + '°C',
        runtime: Math.floor(Math.random() * 10000) + ' 시간',
        lastMaintenance: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR'),
        efficiency: (70 + Math.random() * 30).toFixed(1) + '%',
        output: Math.floor(Math.random() * 1000) + ' units/hr',
        powerConsumption: (50 + Math.random() * 150).toFixed(1) + ' kW'
    };
}

// ============================================
// 6. 설비 배치 함수
// ============================================

function createEquipmentArray() {
    debugLog('🏗️ ========================================');
    debugLog('🏗️ 설비 배치 프로세스 시작');
    debugLog('🏗️ ========================================');
    
    updateLoadingStatus('설비 모델 생성 중...');
    
    // 기본 설비 모델 생성
    const equipmentModel = createEquipmentModel();
    
    updateLoadingStatus('설비 배치 중...');
    
    const cols = 7;
    const rows = 11;
    
    const equipWidth = 1.5;
    const equipDepth = 2.0;
    const equipHeight = 2.2;
    
    const normalGap = 0.3;
    const corridorGap = 1.2;
    
    // 컬럼 위치 계산
    const columnPositions = [];
    columnPositions[0] = 0;
    columnPositions[1] = columnPositions[0] + equipWidth + corridorGap;
    columnPositions[2] = columnPositions[1] + equipWidth + normalGap;
    columnPositions[3] = columnPositions[2] + equipWidth + corridorGap;
    columnPositions[4] = columnPositions[3] + equipWidth + normalGap;
    columnPositions[5] = columnPositions[4] + equipWidth + corridorGap;
    columnPositions[6] = columnPositions[5] + equipWidth + normalGap;
    
    const totalWidth = columnPositions[6] + equipWidth;
    const totalDepth = rows * (equipDepth + normalGap);
    
    const offsetX = -totalWidth / 2;
    const offsetZ = -totalDepth / 2;
    
    debugLog('📐 배치 영역:');
    debugLog(`   - 전체 너비: ${totalWidth.toFixed(2)}m`);
    debugLog(`   - 전체 깊이: ${totalDepth.toFixed(2)}m`);
    debugLog(`   - 시작 오프셋: X=${offsetX.toFixed(2)}, Z=${offsetZ.toFixed(2)}`);
    
    // 디버깅: 테스트 모델 추가
    if (DEBUG_MODE) {
        debugLog('🧪 디버그 모드: 테스트 모델을 원점 근처에 배치');
        const testModel = equipmentModel.clone();
        testModel.position.set(8, equipHeight/2, 0);  // 테스트 큐브 옆
        scene.add(testModel);
        debugLog('🧪 테스트 모델 위치:', testModel.position);
        
        // 테스트 모델 경계 박스
        const modelBoxHelper = new THREE.Box3Helper(
            new THREE.Box3().setFromObject(testModel),
            0x00ffff
        );
        scene.add(modelBoxHelper);
        debugLog('🧪 테스트 모델 경계 박스 추가 (청록색)');
    }
    
    let placedCount = 0;
    const startTime = performance.now();
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = offsetX + columnPositions[col] + equipWidth/2;
            const z = offsetZ + row * (equipDepth + normalGap) + equipDepth/2;
            const y = equipHeight / 2;
            
            // 설비 모델 복제
            const equipment = equipmentModel.clone();
            equipment.position.set(x, y, z);
            
            if (placedCount === 0) {
                debugLog(`🔷 첫 번째 설비: 위치 (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
                debugLog(`   - Children: ${equipment.children.length}`);
                
                // 첫 번째 설비에 경계 박스 추가 (디버그 모드)
                if (DEBUG_MODE) {
                    const firstEquipBoxHelper = new THREE.Box3Helper(
                        new THREE.Box3().setFromObject(equipment),
                        0xff00ff
                    );
                    scene.add(firstEquipBoxHelper);
                    debugLog('   - 경계 박스 추가 (자홍색)');
                }
            }
            
            // 그림자 설정
            equipment.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // 설비 데이터 저장
            equipment.userData = generateEquipmentData(row, col);
            equipment.userData.originalColor = 0x808080; // 회색
            
            scene.add(equipment);
            equipmentArray.push(equipment);
            placedCount++;
        }
    }
    
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    
    // 복도 추가
    addCorridors(offsetX, offsetZ, columnPositions, totalDepth, equipWidth, corridorGap);
    
    debugLog('🏗️ ========================================');
    debugLog(`✅ 설비 배치 완료!`);
    debugLog(`   - 배치된 설비: ${placedCount}개`);
    debugLog(`   - 소요 시간: ${duration}ms`);
    debugLog(`   - Scene 총 객체: ${scene.children.length}개`);
    debugLog(`   - equipmentArray 크기: ${equipmentArray.length}개`);
    debugLog('🏗️ ========================================');
    
    updateLoadingStatus(`✅ 완료! ${placedCount}개 설비 배치됨`);
    
    // 배치 후 카메라 자동 포커스 (옵션)
    if (DEBUG_MODE) {
        focusCameraOnEquipment();
    }
}

function addCorridors(offsetX, offsetZ, columnPositions, totalDepth, equipWidth, corridorGap) {
    const corridorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x95a5a6,
        transparent: true,
        opacity: 0.3
    });
    
    const corridorPositions = [
        columnPositions[0] + equipWidth/2 + corridorGap/2,
        columnPositions[2] + equipWidth/2 + corridorGap/2,
        columnPositions[4] + equipWidth/2 + corridorGap/2
    ];
    
    corridorPositions.forEach((xPos, index) => {
        const corridor = new THREE.Mesh(
            new THREE.PlaneGeometry(corridorGap, totalDepth + 2.0),
            corridorMaterial
        );
        corridor.rotation.x = -Math.PI / 2;
        corridor.position.set(offsetX + xPos, 0.01, 0);
        scene.add(corridor);
    });
    
    debugLog('🛤️ 복도 3개 추가 완료');
}

// ============================================
// 카메라 자동 포커스 함수
// ============================================

function focusCameraOnEquipment() {
    if (equipmentArray.length === 0) return;
    
    // 전체 설비의 경계 박스 계산
    const overallBox = new THREE.Box3();
    equipmentArray.forEach(equip => {
        const box = new THREE.Box3().setFromObject(equip);
        overallBox.union(box);
    });
    
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    overallBox.getCenter(center);
    overallBox.getSize(size);
    
    // 카메라 거리 계산
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // 여유 공간
    
    const cameraPos = new THREE.Vector3(
        center.x + cameraZ * 0.7,
        center.y + cameraZ * 0.7,
        center.z + cameraZ
    );
    
    camera.position.copy(cameraPos);
    camera.lookAt(center);
    controls.target.copy(center);
    
    debugLog('📷 카메라 자동 포커스:');
    debugLog('   - 중심:', center);
    debugLog('   - 카메라 위치:', cameraPos);
    debugLog('   - 영역 크기:', size);
}

// ============================================
// 7. 클릭 이벤트 처리
// ============================================

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(equipmentArray, true);
    
    if (intersects.length > 0) {
        let clickedEquipment = intersects[0].object;
        
        // 부모 찾기
        while (clickedEquipment.parent && !clickedEquipment.userData.id) {
            clickedEquipment = clickedEquipment.parent;
        }
        
        debugLog('🖱️ 클릭된 설비:', clickedEquipment.userData.id);
        
        // 이전 선택 해제
        if (selectedEquipment) {
            selectedEquipment.traverse((child) => {
                if (child.isMesh && child.material) {
                    // 원래 색상으로 복원
                    if (child.material.color) {
                        // 캐비닛은 회색으로
                        if (child.geometry.type === 'BoxGeometry' && 
                            Math.abs(child.geometry.parameters.width - 1.0) < 0.01) {
                            child.material.color.setHex(0x808080);
                        }
                    }
                    child.material.emissive.setHex(0x000000);
                }
            });
        }
        
        // 새로운 선택
        selectedEquipment = clickedEquipment;
        
        selectedEquipment.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.emissive.setHex(0x555555);
                // 메인 캐비닛만 색상 변경
                if (child.geometry.type === 'BoxGeometry' && 
                    Math.abs(child.geometry.parameters.width - 1.0) < 0.01) {
                    child.material.color.setHex(0x2ecc71);  // 초록색
                }
            }
        });
        
        displayEquipmentInfo(selectedEquipment.userData);
    }
}

// ============================================
// 8. 정보 패널 표시 함수
// ============================================

function displayEquipmentInfo(data) {
    const panel = document.getElementById('equipmentInfo');
    const nameElement = document.getElementById('equipName');
    const detailsElement = document.getElementById('equipDetails');
    
    nameElement.textContent = data.name;
    
    let statusClass = 'status-running';
    let statusText = '정상 가동';
    
    if (data.status === 'idle') {
        statusClass = 'status-idle';
        statusText = '대기';
    } else if (data.status === 'error') {
        statusClass = 'status-error';
        statusText = '오류';
    }
    
    detailsElement.innerHTML = `
        <div class="info-row">
            <span class="info-label">설비 ID:</span>
            <span class="info-value">${data.id}</span>
        </div>
        <div class="info-row">
            <span class="info-label">위치:</span>
            <span class="info-value">${data.position.row}, ${data.position.col}</span>
        </div>
        <div class="info-row">
            <span class="info-label">상태:</span>
            <span class="status-indicator ${statusClass}"></span>
            <span class="info-value">${statusText}</span>
        </div>
        <div class="info-row">
            <span class="info-label">온도:</span>
            <span class="info-value">${data.temperature}</span>
        </div>
        <div class="info-row">
            <span class="info-label">가동 시간:</span>
            <span class="info-value">${data.runtime}</span>
        </div>
        <div class="info-row">
            <span class="info-label">효율:</span>
            <span class="info-value">${data.efficiency}</span>
        </div>
        <div class="info-row">
            <span class="info-label">생산량:</span>
            <span class="info-value">${data.output}</span>
        </div>
        <div class="info-row">
            <span class="info-label">소비 전력:</span>
            <span class="info-value">${data.powerConsumption}</span>
        </div>
        <div class="info-row">
            <span class="info-label">마지막 점검:</span>
            <span class="info-value">${data.lastMaintenance}</span>
        </div>
    `;
    
    panel.classList.add('active');
}

window.closeEquipmentInfo = function() {
    const panel = document.getElementById('equipmentInfo');
    panel.classList.remove('active');
    
    if (selectedEquipment) {
        selectedEquipment.traverse((child) => {
            if (child.isMesh && child.material) {
                // 원래 색상으로 복원
                if (child.material.color) {
                    if (child.geometry.type === 'BoxGeometry' && 
                        Math.abs(child.geometry.parameters.width - 1.0) < 0.01) {
                        child.material.color.setHex(0x808080);
                    }
                }
                child.material.emissive.setHex(0x000000);
            }
        });
        selectedEquipment = null;
    }
};

window.addEventListener('click', onMouseClick, false);

// ============================================
// 9. 창 크기 변경 대응
// ============================================

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    debugLog('📱 창 크기 변경:', window.innerWidth, 'x', window.innerHeight);
});

// ============================================
// 10. 애니메이션 루프
// ============================================

let frameCount = 0;
let fpsLastTime = performance.now();
let fpsFrameCount = 0;

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    
    frameCount++;
    fpsFrameCount++;
    
    // 초기 프레임 로그
    if (frameCount === 1) {
        debugLog('🎬 첫 프레임 렌더링 완료');
        debugLog('📷 현재 카메라:', camera.position);
        debugLog('🎯 카메라 방향:', camera.getWorldDirection(new THREE.Vector3()));
    }
    
    // FPS 계산 (1초마다)
    const currentTime = performance.now();
    if (currentTime >= fpsLastTime + 1000) {
        const fps = Math.round((fpsFrameCount * 1000) / (currentTime - fpsLastTime));
        if (DEBUG_MODE && frameCount % 300 === 0) { // 5초마다 한 번
            debugLog('⚡ FPS:', fps);
        }
        fpsFrameCount = 0;
        fpsLastTime = currentTime;
    }
}

// ============================================
// 디버깅 헬퍼 함수들
// ============================================

// 씬 정보 출력
window.debugScene = function() {
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
};

// 카메라 이동
window.moveCameraTo = function(x, y, z) {
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    console.log('📷 카메라 이동:', camera.position);
};

// 특정 설비로 카메라 이동
window.focusEquipment = function(row, col) {
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
};

// 모든 헬퍼 토글
window.toggleHelpers = function() {
    scene.traverse((child) => {
        if (child instanceof THREE.AxesHelper || 
            child instanceof THREE.BoxHelper || 
            child instanceof THREE.Box3Helper) {
            child.visible = !child.visible;
        }
    });
    console.log('🔄 헬퍼 표시 토글');
};

// 렌더러 정보
window.debugRenderer = function() {
    console.log('═══════════════════════════════════════');
    console.log('🎨 RENDERER INFO');
    console.log('═══════════════════════════════════════');
    console.log('Renderer:', renderer.info.render);
    console.log('Memory:', renderer.info.memory);
    console.log('Programs:', renderer.info.programs?.length);
    console.log('═══════════════════════════════════════');
};

// 성능 측정
window.measurePerformance = function(duration = 5000) {
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
};

// 도움말 출력
window.debugHelp = function() {
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
};

// ============================================
// 초기화 및 시작
// ============================================

// 초기 도움말 출력
if (DEBUG_MODE) {
    console.log('');
    console.log('🔧 디버그 모드 활성화');
    console.log('💡 도움말을 보려면 debugHelp()를 입력하세요');
    console.log('');
}

// 설비 배치 시작
updateLoadingStatus('초기화 중...');
createEquipmentArray();

// 애니메이션 시작
animate();