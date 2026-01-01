/**
 * test_integration_phase4.test.js
 * Phase 4 통합 테스트
 * 
 * @version 1.0.0 - Phase 4.1
 * 
 * 테스트 항목:
 * 1. 전체 파이프라인: Layout JSON → Converter → Scene 적용
 * 2. SceneManager.applyLayout 동작
 * 3. RoomEnvironment.updateDimensions 동작
 * 4. EquipmentLoader.applyDynamicConfig 동작 (있는 경우)
 * 5. 이벤트 발생 확인
 */

const TestRunner4 = {
    passed: 0,
    failed: 0,
    
    describe(name, fn) {
        console.group(`📦 ${name}`);
        fn();
        console.groupEnd();
    },
    
    it(name, fn) {
        try {
            fn();
            this.passed++;
            console.log(`  ✅ ${name}`);
        } catch (error) {
            this.failed++;
            console.error(`  ❌ ${name}`);
            console.error(`     Error: ${error.message}`);
        }
    },
    
    expect(actual) {
        return {
            toBe(expected) {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected}, but got ${actual}`);
                }
            },
            toBeTruthy() {
                if (!actual) throw new Error(`Expected truthy, got ${actual}`);
            },
            toBeGreaterThan(expected) {
                if (actual <= expected) {
                    throw new Error(`Expected ${actual} > ${expected}`);
                }
            }
        };
    },
    
    async asyncIt(name, fn) {
        try {
            await fn();
            this.passed++;
            console.log(`  ✅ ${name}`);
        } catch (error) {
            this.failed++;
            console.error(`  ❌ ${name}`);
            console.error(`     Error: ${error.message}`);
        }
    },
    
    summary() {
        console.log('\n' + '='.repeat(50));
        console.log(`📊 테스트 결과: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(50));
        return this.failed === 0;
    },
    
    reset() {
        this.passed = 0;
        this.failed = 0;
    }
};

/**
 * 테스트용 소형 Layout
 */
const testSmallLayout = {
    version: "1.0",
    template_name: "test_small",
    site_id: "integration_test",
    canvas: { width: 800, height: 600, scale: 10 },
    room: { width: 30, depth: 40, wallHeight: 3.5, wallThickness: 0.15 },
    equipmentArrays: [{
        rows: 10,
        cols: 4,
        equipmentSize: { width: 12, height: 18 },
        spacing: { default: 1, corridorCols: [2], corridorColWidth: 10 }
    }],
    walls: [],
    partitions: [],
    office: null
};

/**
 * Phase 4 통합 테스트 실행
 */
async function runIntegrationTests() {
    console.log('\n🧪 Phase 4 통합 테스트 시작\n');
    
    TestRunner4.reset();
    
    const { describe, it, expect, asyncIt } = {
        describe: TestRunner4.describe.bind(TestRunner4),
        it: TestRunner4.it.bind(TestRunner4),
        expect: TestRunner4.expect.bind(TestRunner4),
        asyncIt: TestRunner4.asyncIt.bind(TestRunner4)
    };
    
    // 필수 객체 확인
    const converter = window.layout2DTo3DConverter;
    const sceneManager = window.sceneManager;
    const equipmentLoader = window.equipmentLoader;
    
    // =========================================================
    // 테스트 1: 필수 객체 존재 확인
    // =========================================================
    describe('1. 필수 객체 존재 확인', () => {
        it('layout2DTo3DConverter가 존재해야 함', () => {
            expect(converter).toBeTruthy();
        });
        
        it('sceneManager가 존재해야 함', () => {
            expect(sceneManager).toBeTruthy();
        });
        
        it('equipmentLoader가 존재해야 함', () => {
            expect(equipmentLoader).toBeTruthy();
        });
        
        it('coordinateUtils가 존재해야 함', () => {
            expect(window.coordinateUtils).toBeTruthy();
        });
    });
    
    // =========================================================
    // 테스트 2: 전체 파이프라인 테스트
    // =========================================================
    describe('2. 전체 파이프라인 (Layout → Converter → 3D Params)', () => {
        if (!converter) {
            console.warn('⚠️ Converter가 없어 스킵');
            return;
        }
        
        const result = converter.convert(testSmallLayout);
        
        it('변환 결과가 존재해야 함', () => {
            expect(result).toBeTruthy();
        });
        
        it('roomParams.roomWidth가 30m이어야 함', () => {
            expect(result.roomParams.roomWidth).toBe(30);
        });
        
        it('roomParams.roomDepth가 40m이어야 함', () => {
            expect(result.roomParams.roomDepth).toBe(40);
        });
        
        it('equipmentConfig.ROWS가 10이어야 함', () => {
            expect(result.equipmentConfig.ROWS).toBe(10);
        });
        
        it('equipmentConfig.COLS가 4이어야 함', () => {
            expect(result.equipmentConfig.COLS).toBe(4);
        });
    });
    
    // =========================================================
    // 테스트 3: SceneManager.applyLayout 테스트
    // =========================================================
    describe('3. SceneManager.applyLayout 테스트', () => {
        if (!sceneManager || !sceneManager.applyLayout) {
            console.warn('⚠️ SceneManager.applyLayout이 없어 스킵');
            return;
        }
        
        const convertedLayout = converter.convert(testSmallLayout);
        
        it('applyLayout 메서드가 존재해야 함', () => {
            expect(typeof sceneManager.applyLayout).toBe('function');
        });
        
        it('applyLayout 실행 시 true 반환', () => {
            const success = sceneManager.applyLayout(convertedLayout, { 
                rebuildRoom: false  // 테스트에서는 재구축 스킵
            });
            expect(success).toBeTruthy();
        });
    });
    
    // =========================================================
    // 테스트 4: RoomEnvironment.updateDimensions 테스트
    // =========================================================
    describe('4. RoomEnvironment.updateDimensions 테스트', () => {
        const roomEnv = sceneManager?.getRoomEnvironment?.();
        
        if (!roomEnv || !roomEnv.updateDimensions) {
            console.warn('⚠️ RoomEnvironment.updateDimensions가 없어 스킵');
            return;
        }
        
        it('updateDimensions 메서드가 존재해야 함', () => {
            expect(typeof roomEnv.updateDimensions).toBe('function');
        });
        
        it('치수 업데이트 후 값 반영', () => {
            roomEnv.updateDimensions({ roomWidth: 50, roomDepth: 70 });
            const dims = roomEnv.getDimensions();
            expect(dims.roomWidth).toBe(50);
            expect(dims.roomDepth).toBe(70);
        });
        
        // 원래 값으로 복원
        it('원래 치수로 복원', () => {
            roomEnv.updateDimensions({ roomWidth: 40, roomDepth: 60 });
            const dims = roomEnv.getDimensions();
            expect(dims.roomWidth).toBe(40);
        });
    });
    
    // =========================================================
    // 테스트 5: CONFIG 업데이트 연동
    // =========================================================
    describe('5. CONFIG 업데이트 연동', () => {
        if (!window.updateEquipmentConfig) {
            console.warn('⚠️ updateEquipmentConfig가 없어 스킵');
            return;
        }
        
        // 초기화
        window.resetConfig();
        
        // Converter 결과로 CONFIG 업데이트
        const convertedLayout = converter.convert(testSmallLayout);
        window.updateEquipmentConfig(convertedLayout.equipmentConfig);
        
        it('CONFIG.EQUIPMENT.ROWS가 업데이트되어야 함', () => {
            expect(CONFIG.EQUIPMENT.ROWS).toBe(10);
        });
        
        it('CONFIG.EQUIPMENT.COLS가 업데이트되어야 함', () => {
            expect(CONFIG.EQUIPMENT.COLS).toBe(4);
        });
        
        // 복원
        window.resetConfig();
    });
    
    // =========================================================
    // 테스트 6: 이벤트 발생 확인
    // =========================================================
    describe('6. 이벤트 발생 확인', () => {
        let eventFired = false;
        
        const handler = () => { eventFired = true; };
        window.addEventListener('layout-applied', handler);
        
        if (sceneManager?.applyLayout) {
            const convertedLayout = converter.convert(testSmallLayout);
            sceneManager.applyLayout(convertedLayout, { rebuildRoom: false });
            
            it('layout-applied 이벤트가 발생해야 함', () => {
                expect(eventFired).toBeTruthy();
            });
        }
        
        window.removeEventListener('layout-applied', handler);
    });
    
    // =========================================================
    // 테스트 7: 에러 상황 처리
    // =========================================================
    describe('7. 에러 상황 처리', () => {
        it('null Layout 변환 시 null 반환', () => {
            const result = converter.convert(null);
            expect(result === null).toBeTruthy();
        });
        
        it('applyLayout에 null 전달 시 false 반환', () => {
            if (sceneManager?.applyLayout) {
                const success = sceneManager.applyLayout(null);
                expect(success === false).toBeTruthy();
            }
        });
    });
    
    return TestRunner4.summary();
}

// 전역 함수로 노출
window.runIntegrationTests = runIntegrationTests;
window.testSmallLayout = testSmallLayout;