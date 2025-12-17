/**
 * EquipmentLOD.js
 * Level of Detail 구현
 * 거리에 따라 상세도 조절로 성능 향상
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';

export class EquipmentLOD {
    /**
     * LOD가 적용된 설비 메시 생성
     * 
     * @param {Object} config - 설비 설정
     * @param {string} config.id - 설비 ID
     * @param {number} config.width - 폭
     * @param {number} config.height - 높이
     * @param {number} config.depth - 깊이
     * @returns {THREE.LOD} LOD 객체
     */
    static createEquipmentWithLOD(config) {
        const lod = new THREE.LOD();
        
        // LOD Level 0: 가까운 거리 (0-20m) - 상세한 모델
        const detailedMesh = this.createDetailedMesh(config);
        lod.addLevel(detailedMesh, 0);
        
        // LOD Level 1: 중간 거리 (20-50m) - 중간 상세도
        const mediumMesh = this.createMediumMesh(config);
        lod.addLevel(mediumMesh, 20);
        
        // LOD Level 2: 먼 거리 (50m+) - 단순한 박스
        const simpleMesh = this.createSimpleMesh(config);
        lod.addLevel(simpleMesh, 50);
        
        // LOD Level 3: 매우 먼 거리 (100m+) - 점 또는 아예 안 보임
        const pointMesh = this.createPointMesh(config);
        lod.addLevel(pointMesh, 100);
        
        // 메타데이터 저장
        lod.userData = {
            equipmentId: config.id,
            type: 'equipment',
            hasLOD: true
        };
        
        debugLog(`LOD 생성: ${config.id}`);
        
        return lod;
    }
    
    /**
     * Level 0: 상세한 메시 (근거리)
     */
    static createDetailedMesh(config) {
        const group = new THREE.Group();
        
        // 메인 본체
        const bodyGeometry = new THREE.BoxGeometry(
            config.width,
            config.height,
            config.depth
        );
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a90e2,
            metalness: 0.6,
            roughness: 0.4
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        // 상단 패널 (디테일)
        const panelGeometry = new THREE.BoxGeometry(
            config.width * 0.8,
            0.1,
            config.depth * 0.8
        );
        const panelMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c3e50,
            metalness: 0.7,
            roughness: 0.3
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.y = config.height / 2 + 0.05;
        group.add(panel);
        
        // 신호등 (디테일)
        const signalTower = this.createSignalTower(config);
        signalTower.position.set(
            config.width / 2 - 0.15,
            config.height / 2 + 0.3,
            config.depth / 2 - 0.15
        );
        group.add(signalTower);
        
        // 엣지 강조 (선)
        const edges = new THREE.EdgesGeometry(bodyGeometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
        const lineSegments = new THREE.LineSegments(edges, lineMaterial);
        group.add(lineSegments);
        
        return group;
    }
    
    /**
     * Level 1: 중간 상세도 메시 (중거리)
     */
    static createMediumMesh(config) {
        const group = new THREE.Group();
        
        // 메인 본체만 (패널 제외)
        const bodyGeometry = new THREE.BoxGeometry(
            config.width,
            config.height,
            config.depth
        );
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: 0x4a90e2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);
        
        // 신호등만 유지
        const signalTower = this.createSimpleSignalTower(config);
        signalTower.position.set(
            config.width / 2 - 0.15,
            config.height / 2 + 0.2,
            config.depth / 2 - 0.15
        );
        group.add(signalTower);
        
        return group;
    }
    
    /**
     * Level 2: 단순한 메시 (원거리)
     */
    static createSimpleMesh(config) {
        // 단순한 박스만
        const geometry = new THREE.BoxGeometry(
            config.width,
            config.height,
            config.depth
        );
        const material = new THREE.MeshBasicMaterial({
            color: 0x4a90e2
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        return mesh;
    }
    
    /**
     * Level 3: 포인트 메시 (매우 원거리)
     */
    static createPointMesh(config) {
        // 작은 점으로 표시
        const geometry = new THREE.SphereGeometry(0.2, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0x4a90e2
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        return mesh;
    }
    
    /**
     * 상세한 신호등 생성
     */
    static createSignalTower(config) {
        const tower = new THREE.Group();
        
        const lights = [
            { color: 0xff0000, y: 0.2 },  // Red
            { color: 0xffff00, y: 0.1 },  // Yellow
            { color: 0x00ff00, y: 0.0 }   // Green
        ];
        
        lights.forEach(light => {
            const geometry = new THREE.SphereGeometry(0.05, 8, 8);
            const material = new THREE.MeshStandardMaterial({
                color: light.color,
                emissive: light.color,
                emissiveIntensity: 0.5
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.y = light.y;
            tower.add(sphere);
        });
        
        return tower;
    }
    
    /**
     * 단순한 신호등 생성 (중거리용)
     */
    static createSimpleSignalTower(config) {
        // 하나의 구로 통합
        const geometry = new THREE.SphereGeometry(0.08, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        return mesh;
    }
    
    /**
     * LOD 거리 동적 조정
     * 
     * @param {THREE.LOD} lod - LOD 객체
     * @param {number} factor - 거리 배율 (1.0 = 기본, 2.0 = 2배)
     */
    static adjustLODDistances(lod, factor = 1.0) {
        const levels = lod.levels;
        
        levels.forEach((level, index) => {
            if (index > 0) {
                levels[index].distance *= factor;
            }
        });
        
        debugLog(`LOD 거리 조정: ${factor}x`);
    }
}