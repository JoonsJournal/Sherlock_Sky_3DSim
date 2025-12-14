/**
 * FactoryEnvironment.js
 * 공장 환경 요소 생성 및 관리 (벽, 기둥, 천장, 파이프 등)
 */

import * as THREE from 'three';
import { CONFIG, debugLog } from '../utils/Config.js';

export class FactoryEnvironment {
    /**
     * 모든 공장 환경 요소 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addAllElements(scene) {
        if (CONFIG.FACTORY_ENVIRONMENT.WALLS.ENABLED) {
            this.addWalls(scene);
        }
        
        if (CONFIG.FACTORY_ENVIRONMENT.PILLARS.ENABLED) {
            this.addPillars(scene);
        }
        
        if (CONFIG.FACTORY_ENVIRONMENT.CEILING_TRUSS.ENABLED) {
            this.addCeilingTruss(scene);
        }
        
        if (CONFIG.FACTORY_ENVIRONMENT.PIPES.ENABLED) {
            this.addPipes(scene);
        }
        
        debugLog('🏭 공장 환경 요소 추가 완료');
    }
    
    /**
     * 공장 벽 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addWalls(scene) {
        const wallConfig = CONFIG.FACTORY_ENVIRONMENT.WALLS;
        const floorSize = CONFIG.SCENE.FLOOR_SIZE;
        
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: wallConfig.COLOR,
            roughness: wallConfig.ROUGHNESS,
            metalness: 0.1
        });
        
        // 4개의 벽 생성
        const walls = [
            // 뒷벽
            {
                width: floorSize,
                height: wallConfig.HEIGHT,
                position: { x: 0, y: wallConfig.HEIGHT / 2, z: -floorSize / 2 },
                rotation: { x: 0, y: 0, z: 0 }
            },
            // 왼쪽 벽
            {
                width: floorSize,
                height: wallConfig.HEIGHT,
                position: { x: -floorSize / 2, y: wallConfig.HEIGHT / 2, z: 0 },
                rotation: { x: 0, y: Math.PI / 2, z: 0 }
            },
            // 오른쪽 벽
            {
                width: floorSize,
                height: wallConfig.HEIGHT,
                position: { x: floorSize / 2, y: wallConfig.HEIGHT / 2, z: 0 },
                rotation: { x: 0, y: Math.PI / 2, z: 0 }
            },
            // 앞벽 (입구가 있는 벽)
            {
                width: floorSize,
                height: wallConfig.HEIGHT,
                position: { x: 0, y: wallConfig.HEIGHT / 2, z: floorSize / 2 },
                rotation: { x: 0, y: 0, z: 0 }
            }
        ];
        
        walls.forEach((wallData, index) => {
            const wallGeometry = new THREE.BoxGeometry(
                wallData.width,
                wallData.height,
                wallConfig.THICKNESS
            );
            
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(wallData.position.x, wallData.position.y, wallData.position.z);
            wall.rotation.set(wallData.rotation.x, wallData.rotation.y, wallData.rotation.z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            
            scene.add(wall);
        });
        
        // 입구 표시 (앞벽에 어두운 영역)
        const doorGeometry = new THREE.BoxGeometry(4, 5, wallConfig.THICKNESS + 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.5
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(-10, 2.5, floorSize / 2);
        scene.add(door);
        
        debugLog('🧱 공장 벽 추가 완료');
    }
    
    /**
     * 공장 기둥 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addPillars(scene) {
        const pillarConfig = CONFIG.FACTORY_ENVIRONMENT.PILLARS;
        const floorSize = CONFIG.SCENE.FLOOR_SIZE;
        
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: pillarConfig.COLOR,
            roughness: 0.7,
            metalness: 0.3
        });
        
        const pillarGeometry = new THREE.BoxGeometry(
            pillarConfig.WIDTH,
            pillarConfig.HEIGHT,
            pillarConfig.WIDTH
        );
        
        // 기둥 배치 (격자 패턴)
        const spacing = pillarConfig.SPACING;
        const positions = [];
        
        for (let x = -floorSize / 2 + spacing; x < floorSize / 2; x += spacing) {
            for (let z = -floorSize / 2 + spacing; z < floorSize / 2; z += spacing) {
                positions.push({ x, z });
            }
        }
        
        positions.forEach(pos => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(pos.x, pillarConfig.HEIGHT / 2, pos.z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            scene.add(pillar);
        });
        
        debugLog('🏛️ 공장 기둥 추가 완료:', positions.length, '개');
    }
    
    /**
     * 천장 트러스 (공장 천장 구조물) 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addCeilingTruss(scene) {
        const trussConfig = CONFIG.FACTORY_ENVIRONMENT.CEILING_TRUSS;
        const floorSize = CONFIG.SCENE.FLOOR_SIZE;
        
        const trussMaterial = new THREE.MeshStandardMaterial({
            color: trussConfig.COLOR,
            roughness: 0.6,
            metalness: 0.5
        });
        
        // 가로 빔
        const beamCount = 6;
        const spacing = floorSize / beamCount;
        
        for (let i = 0; i < beamCount; i++) {
            const beamGeometry = new THREE.BoxGeometry(
                floorSize * 0.9,
                trussConfig.BEAM_SIZE,
                trussConfig.BEAM_SIZE
            );
            
            const beam = new THREE.Mesh(beamGeometry, trussMaterial);
            beam.position.set(
                0,
                trussConfig.HEIGHT,
                -floorSize / 2 + spacing * i
            );
            beam.castShadow = true;
            scene.add(beam);
        }
        
        // 세로 빔
        for (let i = 0; i < beamCount; i++) {
            const beamGeometry = new THREE.BoxGeometry(
                trussConfig.BEAM_SIZE,
                trussConfig.BEAM_SIZE,
                floorSize * 0.9
            );
            
            const beam = new THREE.Mesh(beamGeometry, trussMaterial);
            beam.position.set(
                -floorSize / 2 + spacing * i,
                trussConfig.HEIGHT,
                0
            );
            beam.castShadow = true;
            scene.add(beam);
        }
        
        debugLog('🏗️ 천장 트러스 추가 완료');
    }
    
    /**
     * 파이프/배관 추가
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addPipes(scene) {
        const pipeConfig = CONFIG.FACTORY_ENVIRONMENT.PIPES;
        const floorSize = CONFIG.SCENE.FLOOR_SIZE;
        
        const pipeMaterial = new THREE.MeshStandardMaterial({
            color: pipeConfig.COLOR,
            roughness: 0.5,
            metalness: 0.7
        });
        
        // 벽을 따라 파이프 배치
        const pipePositions = [
            // 뒷벽 파이프
            { start: { x: -floorSize / 2, y: pipeConfig.HEIGHT, z: -floorSize / 2 + 1 },
              end: { x: floorSize / 2, y: pipeConfig.HEIGHT, z: -floorSize / 2 + 1 } },
            
            // 왼쪽 벽 파이프
            { start: { x: -floorSize / 2 + 1, y: pipeConfig.HEIGHT, z: -floorSize / 2 },
              end: { x: -floorSize / 2 + 1, y: pipeConfig.HEIGHT, z: floorSize / 2 } }
        ];
        
        pipePositions.forEach(pos => {
            const length = Math.sqrt(
                Math.pow(pos.end.x - pos.start.x, 2) +
                Math.pow(pos.end.z - pos.start.z, 2)
            );
            
            const pipeGeometry = new THREE.CylinderGeometry(
                pipeConfig.RADIUS,
                pipeConfig.RADIUS,
                length,
                16
            );
            
            const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
            
            // 파이프 위치 및 회전 계산
            const midX = (pos.start.x + pos.end.x) / 2;
            const midZ = (pos.start.z + pos.end.z) / 2;
            pipe.position.set(midX, pos.start.y, midZ);
            
            // 파이프 방향에 따라 회전
            if (pos.end.x !== pos.start.x) {
                pipe.rotation.z = Math.PI / 2;
            } else {
                pipe.rotation.x = Math.PI / 2;
            }
            
            pipe.castShadow = true;
            scene.add(pipe);
        });
        
        debugLog('🔧 파이프 추가 완료');
    }
    
    /**
     * 안전 사인 추가 (옵션)
     * @param {THREE.Scene} scene - Three.js 씬
     */
    static addSafetySigns(scene) {
        const signGeometry = new THREE.PlaneGeometry(2, 1);
        const signMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide
        });
        
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(-10, 4, -CONFIG.SCENE.FLOOR_SIZE / 2 + 0.5);
        scene.add(sign);
        
        debugLog('⚠️ 안전 사인 추가 완료');
    }
}