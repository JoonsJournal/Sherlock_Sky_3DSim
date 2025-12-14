/**
 * FactoryEnvironment.js
 * 공장 환경 요소 생성 및 관리
 * - 공장 바닥 (콘크리트 질감)
 * - 벽면 및 기둥
 * - 안전 라인 (노란색 경계선)
 * - 작업 영역 표시
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class FactoryEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
    }

    /**
     * 전체 공장 환경 생성
     */
    createEnvironment() {
        this.createFactoryFloor();
        this.createWalls();
        this.createPillars();
        this.createSafetyLines();
        this.createWorkZoneMarkers();
        this.createOverheadStructure();
        
        debugLog('🏭 공장 환경 생성 완료');
    }

    /**
     * 공장 바닥 생성 (콘크리트 질감)
     */
    createFactoryFloor() {
        const floorSize = CONFIG.SCENE.FLOOR_SIZE;
        
        // 메인 바닥 (콘크리트)
        const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.FACTORY.FLOOR.COLOR,
            roughness: CONFIG.FACTORY.FLOOR.ROUGHNESS,
            metalness: CONFIG.FACTORY.FLOOR.METALNESS
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.position.y = 0;
        this.group.add(floor);

        // 그리드 라인 (바닥 타일 느낌)
        const gridSize = floorSize;
        const divisions = 40;
        const gridHelper = new THREE.GridHelper(
            gridSize,
            divisions,
            CONFIG.FACTORY.FLOOR.GRID_COLOR,
            CONFIG.FACTORY.FLOOR.GRID_COLOR_SECONDARY
        );
        gridHelper.position.y = 0.01; // 바닥 위로 살짝
        this.group.add(gridHelper);

        debugLog('   ✅ 공장 바닥 생성');
    }

    /**
     * 공장 벽면 생성
     */
    createWalls() {
        const wallHeight = CONFIG.FACTORY.WALL.HEIGHT;
        const wallThickness = CONFIG.FACTORY.WALL.THICKNESS;
        const floorSize = CONFIG.SCENE.FLOOR_SIZE;
        const halfSize = floorSize / 2;

        const wallMaterial = new THREE.MeshStandardMaterial({
            color: CONFIG.FACTORY.WALL.COLOR,
            roughness: 0.8,
            metalness: 0.1
        });

        // 뒷벽
        const backWall = this.createWall(
            floorSize, wallHeight, wallThickness,
            0, wallHeight / 2, -halfSize,
            wallMaterial
        );
        this.group.add(backWall);

        // 좌측벽
        const leftWall = this.createWall(
            wallThickness, wallHeight, floorSize,
            -halfSize, wallHeight / 2, 0,
            wallMaterial
        );
        this.group.add(leftWall);

        // 우측벽 (부분적으로만)
        const rightWall = this.createWall(
            wallThickness, wallHeight, floorSize * 0.6,
            halfSize, wallHeight / 2, -floorSize * 0.2,
            wallMaterial
        );
        this.group.add(rightWall);

        debugLog('   ✅ 벽면 생성');
    }

    /**
     * 벽 생성 헬퍼 함수
     */
    createWall(width, height, depth, x, y, z, material) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, y, z);
        wall.receiveShadow = true;
        wall.castShadow = true;
        return wall;
    }

    /**
     * 기둥 생성
     */
    createPillars() {
        const pillarConfig = CONFIG.FACTORY.PILLAR;
        const positions = [
            { x: -20, z: -20 },
            { x: -20, z: 0 },
            { x: -20, z: 20 },
            { x: 20, z: -20 },
            { x: 20, z: 0 },
            { x: 20, z: 20 }
        ];

        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: pillarConfig.COLOR,
            roughness: 0.7,
            metalness: 0.3
        });

        positions.forEach(pos => {
            const pillar = this.createPillar(
                pillarConfig.WIDTH,
                pillarConfig.HEIGHT,
                pos.x,
                pos.z,
                pillarMaterial
            );
            this.group.add(pillar);
        });

        debugLog('   ✅ 기둥 생성');
    }

    /**
     * 기둥 생성 헬퍼 함수
     */
    createPillar(width, height, x, z, material) {
        const geometry = new THREE.BoxGeometry(width, height, width);
        const pillar = new THREE.Mesh(geometry, material);
        pillar.position.set(x, height / 2, z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        return pillar;
    }

    /**
     * 안전 라인 생성 (노란색 경계선)
     */
    createSafetyLines() {
        const lineConfig = CONFIG.FACTORY.SAFETY_LINE;
        const lineMaterial = new THREE.MeshBasicMaterial({
            color: lineConfig.COLOR
        });

        // 주요 복도 경계선
        const corridorLines = [
            // 중앙 복도 좌측
            { x: -8, z: 0, width: 40, depth: lineConfig.WIDTH, rotation: 0 },
            // 중앙 복도 우측
            { x: 8, z: 0, width: 40, depth: lineConfig.WIDTH, rotation: 0 },
            // 하단 복도 상단
            { x: 0, z: -13, width: lineConfig.WIDTH, depth: 30, rotation: 0 },
            // 하단 복도 하단
            { x: 0, z: 13, width: lineConfig.WIDTH, depth: 30, rotation: 0 }
        ];

        corridorLines.forEach(line => {
            const geometry = new THREE.PlaneGeometry(line.width, line.depth);
            const mesh = new THREE.Mesh(geometry, lineMaterial);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(line.x, 0.02, line.z);
            this.group.add(mesh);
        });

        debugLog('   ✅ 안전 라인 생성');
    }

    /**
     * 작업 영역 마커 생성
     */
    createWorkZoneMarkers() {
        const markerConfig = CONFIG.FACTORY.WORK_ZONE;
        
        // 작업 영역 표시 (투명한 바닥 마킹)
        const zones = [
            { x: -15, z: -10, width: 20, depth: 15, label: 'Zone A' },
            { x: 15, z: -10, width: 20, depth: 15, label: 'Zone B' },
            { x: -15, z: 10, width: 20, depth: 15, label: 'Zone C' },
            { x: 15, z: 10, width: 20, depth: 15, label: 'Zone D' }
        ];

        zones.forEach(zone => {
            const geometry = new THREE.PlaneGeometry(zone.width, zone.depth);
            const material = new THREE.MeshBasicMaterial({
                color: markerConfig.COLOR,
                transparent: true,
                opacity: markerConfig.OPACITY,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(zone.x, 0.03, zone.z);
            this.group.add(mesh);
        });

        debugLog('   ✅ 작업 영역 마커 생성');
    }

    /**
     * 천장 구조물 (빔과 트러스)
     */
    createOverheadStructure() {
        const beamConfig = CONFIG.FACTORY.OVERHEAD_BEAM;
        const beamMaterial = new THREE.MeshStandardMaterial({
            color: beamConfig.COLOR,
            roughness: 0.8,
            metalness: 0.5
        });

        // 가로 빔
        const beamPositions = [
            { x: 0, z: -20 },
            { x: 0, z: 0 },
            { x: 0, z: 20 }
        ];

        beamPositions.forEach(pos => {
            const geometry = new THREE.BoxGeometry(
                45,
                beamConfig.HEIGHT,
                beamConfig.WIDTH
            );
            const beam = new THREE.Mesh(geometry, beamMaterial);
            beam.position.set(pos.x, beamConfig.POSITION_Y, pos.z);
            beam.castShadow = true;
            this.group.add(beam);
        });

        // 세로 빔
        const verticalBeams = [
            { x: -20, z: 0 },
            { x: 20, z: 0 }
        ];

        verticalBeams.forEach(pos => {
            const geometry = new THREE.BoxGeometry(
                beamConfig.WIDTH,
                beamConfig.HEIGHT,
                45
            );
            const beam = new THREE.Mesh(geometry, beamMaterial);
            beam.position.set(pos.x, beamConfig.POSITION_Y, pos.z);
            beam.castShadow = true;
            this.group.add(beam);
        });

        debugLog('   ✅ 천장 구조물 생성');
    }

    /**
     * 환경 그룹 반환
     */
    getGroup() {
        return this.group;
    }

    /**
     * 환경 표시/숨김
     */
    setVisible(visible) {
        this.group.visible = visible;
    }
}