/**
 * RoomEnvironment.js
 * 클린룸 환경 구축 - 벽, Office, 파티션, 책상
 * 
 * @version 1.1.0 - Phase 4 동적 치수 업데이트 지원
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';

export class RoomEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
        this.partitions = [];
        this.furniture = [];
        
        // 클린룸 치수 (미터 단위)
        this.roomWidth = 40;    // 클린룸 너비
        this.roomDepth = 60;   // 클린룸 깊이
        this.wallHeight = 4;    // 벽 높이
        this.wallThickness = 0.2; // 벽 두께
        
        // Office 치수
        this.officeWidth = 12;
        this.officeDepth = 20;
        this.officeX = 15;      // Office X 위치 (오른쪽 상단)
        this.officeZ = -20;     // Office Z 위치
        
        // ✨ Phase 4: 동적 업데이트 플래그
        this._isBuilt = false;
        
        // 재질
        this.materials = this.createMaterials();
    }
    
    /**
     * 재질 생성
     */
    createMaterials() {
        return {
            // 클린룸 벽 - 밝은 흰색/아이보리
            wall: new THREE.MeshStandardMaterial({
                color: 0xf5f5f5,
                roughness: 0.3,
                metalness: 0.1,
                side: THREE.DoubleSide
            }),
            
            // Office 벽 - 약간 더 밝은 흰색
            officeWall: new THREE.MeshStandardMaterial({
                color: 0xfafafa,
                roughness: 0.25,
                metalness: 0.05,
                side: THREE.DoubleSide
            }),
            
            // 유리 파티션
            glass: new THREE.MeshPhysicalMaterial({
                color: 0xe0f0ff,
                transparent: true,
                opacity: 0.3,
                roughness: 0.1,
                metalness: 0.1,
                transmission: 0.9,
                thickness: 0.5,
                side: THREE.DoubleSide
            }),
            
            // 파티션 프레임
            frame: new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.4,
                metalness: 0.6
            }),
            
            // 책상 - 검은색/다크그레이
            desk: new THREE.MeshStandardMaterial({
                color: 0x2a2a2a,
                roughness: 0.5,
                metalness: 0.3
            })
        };
    }
    
    // =========================================================
    // ✨ Phase 4: 동적 치수 업데이트
    // =========================================================
    
    /**
     * ✨ Phase 4: Room 치수 동적 업데이트
     * @param {Object} roomParams - 새로운 Room 파라미터
     */
    updateDimensions(roomParams) {
        if (!roomParams) {
            console.warn('[RoomEnvironment] updateDimensions: roomParams가 없습니다');
            return;
        }
        
        console.log('[RoomEnvironment] 치수 업데이트 시작...');
        
        // 이전 값 저장
        const previous = {
            roomWidth: this.roomWidth,
            roomDepth: this.roomDepth,
            wallHeight: this.wallHeight
        };
        
        // 새 값 적용
        if (roomParams.roomWidth !== undefined) this.roomWidth = roomParams.roomWidth;
        if (roomParams.roomDepth !== undefined) this.roomDepth = roomParams.roomDepth;
        if (roomParams.wallHeight !== undefined) this.wallHeight = roomParams.wallHeight;
        if (roomParams.wallThickness !== undefined) this.wallThickness = roomParams.wallThickness;
        
        console.log('[RoomEnvironment] 치수 업데이트 완료:', {
            before: `${previous.roomWidth}m × ${previous.roomDepth}m`,
            after: `${this.roomWidth}m × ${this.roomDepth}m`
        });
        
        return this;
    }
    
    /**
     * ✨ Phase 4: Office 치수 동적 업데이트
     * @param {Object} officeParams - 새로운 Office 파라미터
     */
    updateOfficeParams(officeParams) {
        if (!officeParams) return this;
        
        if (officeParams.size) {
            if (officeParams.size.width !== undefined) this.officeWidth = officeParams.size.width;
            if (officeParams.size.depth !== undefined) this.officeDepth = officeParams.size.depth;
        }
        
        if (officeParams.position) {
            if (officeParams.position.x !== undefined) this.officeX = officeParams.position.x;
            if (officeParams.position.z !== undefined) this.officeZ = officeParams.position.z;
        }
        
        console.log('[RoomEnvironment] Office 파라미터 업데이트 완료');
        return this;
    }
    
    /**
     * ✨ Phase 4: 환경 재구축 (기존 제거 후 새로 생성)
     */
    rebuild() {
        console.log('[RoomEnvironment] 환경 재구축 시작...');
        
        // 기존 객체 제거
        this.dispose();
        
        // 배열 초기화
        this.walls = [];
        this.partitions = [];
        this.furniture = [];
        
        // 재구축
        this.buildEnvironment();
        
        console.log('[RoomEnvironment] ✅ 환경 재구축 완료');
    }
    
    /**
     * 전체 환경 구축
     */
    buildEnvironment() {
        debugLog('🏗️ 클린룸 환경 구축 시작...');
        
        // 1. 클린룸 외벽
        this.createCleanRoomWalls();
        
        // 2. Office 공간
        this.createOfficeArea();
        
        // 3. 파티션 (칸막이)
        this.createPartitions();
        
        // 4. 책상
        this.createDesk();
        
        // 5. 기둥 (선택사항)
        // this.createPillars();
        
        this._isBuilt = true;
        
        debugLog('✅ 클린룸 환경 구축 완료');
        debugLog(`   - 벽: ${this.walls.length}개`);
        debugLog(`   - 파티션: ${this.partitions.length}개`);
        debugLog(`   - 가구: ${this.furniture.length}개`);
    }
    
    /**
     * 클린룸 외벽 생성 (4면)
     */
    createCleanRoomWalls() {
        const halfWidth = this.roomWidth / 2;
        const halfDepth = this.roomDepth / 2;
        const halfHeight = this.wallHeight / 2;
        
        // 벽 설정: [x, y, z, width, height, depth, rotationY]
        const wallConfigs = [
            // 북쪽 벽 (앞)
            [0, halfHeight, -halfDepth, this.roomWidth, this.wallHeight, this.wallThickness, 0],
            
            // 남쪽 벽 (뒤)
            [0, halfHeight, halfDepth, this.roomWidth, this.wallHeight, this.wallThickness, 0],
            
            // 동쪽 벽 (오른쪽)
            [halfWidth, halfHeight, 0, this.wallThickness, this.wallHeight, this.roomDepth, 0],
            
            // 서쪽 벽 (왼쪽)
            [-halfWidth, halfHeight, 0, this.wallThickness, this.wallHeight, this.roomDepth, 0]
        ];
        
        wallConfigs.forEach((config, index) => {
            const [x, y, z, width, height, depth] = config;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(geometry, this.materials.wall);
            
            wall.position.set(x, y, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.name = `cleanroom-wall-${index}`;
            
            this.scene.add(wall);
            this.walls.push(wall);
        });
        
        debugLog('🧱 클린룸 외벽 4면 생성 완료');
    }
    
    /**
     * Office 공간 생성 (3면 벽 + 입구)
     */
    createOfficeArea() {
        const halfHeight = this.wallHeight / 2;
        
        // Office 벽 설정
        const officeWallConfigs = [
            // Office 북쪽 벽 (위쪽)
            [
                this.officeX,
                halfHeight,
                this.officeZ - this.officeDepth / 2,
                this.officeWidth,
                this.wallHeight,
                this.wallThickness
            ],
            
            // Office 동쪽 벽 (오른쪽)
            [
                this.officeX + this.officeWidth / 2,
                halfHeight,
                this.officeZ,
                this.wallThickness,
                this.wallHeight,
                this.officeDepth
            ],
            
            // Office 서쪽 벽 (왼쪽) - 입구를 위해 두 부분으로 나눔
            // 위쪽 부분
            [
                this.officeX - this.officeWidth / 2,
                halfHeight,
                this.officeZ - this.officeDepth / 4 - 2,
                this.wallThickness,
                this.wallHeight,
                this.officeDepth / 2 - 4
            ],
            
            // 아래쪽 부분
            [
                this.officeX - this.officeWidth / 2,
                halfHeight,
                this.officeZ + this.officeDepth / 4 + 2,
                this.wallThickness,
                this.wallHeight,
                this.officeDepth / 2 - 4
            ]
        ];
        
        officeWallConfigs.forEach((config, index) => {
            const [x, y, z, width, height, depth] = config;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(geometry, this.materials.officeWall);
            
            wall.position.set(x, y, z);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.name = `office-wall-${index}`;
            
            this.scene.add(wall);
            this.walls.push(wall);
        });
        
        debugLog('🏢 Office 공간 벽 생성 완료');
    }
    
    /**
     * 파티션/칸막이 생성 (Office 입구)
     */
    createPartitions() {
        const partitionX = this.officeX - this.officeWidth / 2;
        const partitionZ = this.officeZ;
        const partitionWidth = 3;
        const partitionHeight = 2.5;
        
        // 파티션 프레임 (알루미늄)
        const frameGeometry = new THREE.BoxGeometry(0.1, partitionHeight, 0.05);
        
        // 왼쪽 프레임
        const leftFrame = new THREE.Mesh(frameGeometry, this.materials.frame);
        leftFrame.position.set(partitionX - 0.5, partitionHeight / 2, partitionZ - partitionWidth / 2);
        leftFrame.castShadow = true;
        this.scene.add(leftFrame);
        this.partitions.push(leftFrame);
        
        // 오른쪽 프레임
        const rightFrame = new THREE.Mesh(frameGeometry, this.materials.frame);
        rightFrame.position.set(partitionX - 0.5, partitionHeight / 2, partitionZ + partitionWidth / 2);
        rightFrame.castShadow = true;
        this.scene.add(rightFrame);
        this.partitions.push(rightFrame);
        
        // 상단 프레임
        const topFrameGeometry = new THREE.BoxGeometry(0.1, 0.05, partitionWidth);
        const topFrame = new THREE.Mesh(topFrameGeometry, this.materials.frame);
        topFrame.position.set(partitionX - 0.5, partitionHeight, partitionZ);
        topFrame.castShadow = true;
        this.scene.add(topFrame);
        this.partitions.push(topFrame);
        
        // 유리 패널
        const glassGeometry = new THREE.BoxGeometry(0.05, partitionHeight - 0.1, partitionWidth - 0.1);
        const glass = new THREE.Mesh(glassGeometry, this.materials.glass);
        glass.position.set(partitionX - 0.5, partitionHeight / 2, partitionZ);
        glass.castShadow = true;
        glass.receiveShadow = true;
        glass.name = 'office-partition-glass';
        this.scene.add(glass);
        this.partitions.push(glass);
        
        debugLog('🚪 파티션 생성 완료 (유리 칸막이)');
    }
    
    /**
     * 책상 생성
     */
    createDesk() {
        const deskX = this.officeX - this.officeWidth / 2 + 1.5;  // 파티션 뒤
        const deskZ = this.officeZ;
        const deskWidth = 1.6;
        const deskDepth = 0.8;
        const deskHeight = 0.75;
        const deskThickness = 0.05;
        
        // 책상 상판
        const topGeometry = new THREE.BoxGeometry(deskWidth, deskThickness, deskDepth);
        const deskTop = new THREE.Mesh(topGeometry, this.materials.desk);
        deskTop.position.set(deskX, deskHeight, deskZ);
        deskTop.castShadow = true;
        deskTop.receiveShadow = true;
        deskTop.name = 'desk-top';
        this.scene.add(deskTop);
        this.furniture.push(deskTop);
        
        // 책상 다리 (4개)
        const legGeometry = new THREE.BoxGeometry(0.05, deskHeight - deskThickness, 0.05);
        const legPositions = [
            [deskX - deskWidth / 2 + 0.1, (deskHeight - deskThickness) / 2, deskZ - deskDepth / 2 + 0.1],
            [deskX + deskWidth / 2 - 0.1, (deskHeight - deskThickness) / 2, deskZ - deskDepth / 2 + 0.1],
            [deskX - deskWidth / 2 + 0.1, (deskHeight - deskThickness) / 2, deskZ + deskDepth / 2 - 0.1],
            [deskX + deskWidth / 2 - 0.1, (deskHeight - deskThickness) / 2, deskZ + deskDepth / 2 - 0.1]
        ];
        
        legPositions.forEach((pos, index) => {
            const leg = new THREE.Mesh(legGeometry, this.materials.desk);
            leg.position.set(...pos);
            leg.castShadow = true;
            leg.receiveShadow = true;
            leg.name = `desk-leg-${index}`;
            this.scene.add(leg);
            this.furniture.push(leg);
        });
        
        debugLog('🪑 책상 생성 완료');
    }
    
    /**
     * 기둥 생성 (선택사항)
     */
    createPillars() {
        const pillarRadius = 0.3;
        const pillarHeight = this.wallHeight;
        const pillarGeometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius, pillarHeight, 12);
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.05
        });
        
        // 기둥 위치 (예: 클린룸 내부에 격자 형태로 배치)
        const pillarPositions = [
            [-20, pillarHeight / 2, -30],
            [-20, pillarHeight / 2, 0],
            [-20, pillarHeight / 2, 30],
            [0, pillarHeight / 2, -30],
            [0, pillarHeight / 2, 30],
            [20, pillarHeight / 2, -30],
            [20, pillarHeight / 2, 0],
            [20, pillarHeight / 2, 30]
        ];
        
        pillarPositions.forEach((pos, index) => {
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(...pos);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            pillar.name = `pillar-${index}`;
            this.scene.add(pillar);
        });
        
        debugLog(`🏛️ 기둥 ${pillarPositions.length}개 생성 완료`);
    }
    
    /**
     * 환경 표시/숨김 토글
     */
    toggleVisibility(visible) {
        [...this.walls, ...this.partitions, ...this.furniture].forEach(obj => {
            obj.visible = visible;
        });
        debugLog(`🔄 클린룸 환경 ${visible ? '표시' : '숨김'}`);
    }
    
    // =========================================================
    // ✨ Phase 4: 추가 유틸리티
    // =========================================================
    
    /**
     * ✨ Phase 4: 현재 치수 반환
     */
    getDimensions() {
        return {
            roomWidth: this.roomWidth,
            roomDepth: this.roomDepth,
            wallHeight: this.wallHeight,
            wallThickness: this.wallThickness,
            officeWidth: this.officeWidth,
            officeDepth: this.officeDepth,
            officeX: this.officeX,
            officeZ: this.officeZ
        };
    }
    
    /**
     * ✨ Phase 4: 디버그 정보 출력
     */
    debug() {
        console.group('[RoomEnvironment] Debug Info');
        console.log('Room 치수:', `${this.roomWidth}m × ${this.roomDepth}m × ${this.wallHeight}m`);
        console.log('Office 치수:', `${this.officeWidth}m × ${this.officeDepth}m`);
        console.log('Office 위치:', `(${this.officeX}, ${this.officeZ})`);
        console.log('벽 개수:', this.walls.length);
        console.log('파티션 개수:', this.partitions.length);
        console.log('가구 개수:', this.furniture.length);
        console.log('구축 완료:', this._isBuilt);
        console.groupEnd();
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        [...this.walls, ...this.partitions, ...this.furniture].forEach(obj => {
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
        
        this.walls = [];
        this.partitions = [];
        this.furniture = [];
        this._isBuilt = false;
        
        debugLog('🗑️ RoomEnvironment 정리 완료');
    }
}