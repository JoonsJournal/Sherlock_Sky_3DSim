/**
 * test_config_dynamic.test.js
 * Config.js 동적 업데이트 기능 테스트
 * 
 * @version 1.0.0 - Phase 4.1
 * 
 * 테스트 항목:
 * 1. updateEquipmentConfig 기능
 * 2. updateSceneConfig 기능
 * 3. resetConfig 기능
 * 4. 부분 업데이트 동작
 * 5. 기존 값 보존
 */

const TestRunner3 = {
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
            toBeCloseTo(expected, precision = 2) {
                const multiplier = Math.pow(10, precision);
                if (Math.round(actual * multiplier) !== Math.round(expected * multiplier)) {
                    throw new Error(`Expected ${expected}, but got ${actual}`);
                }
            },
            toBeTruthy() {
                if (!actual) throw new Error(`Expected truthy, got ${actual}`);
            }
        };
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
 * Config 동적 업데이트 테스트 실행
 */
function runConfigDynamicTests() {
    console.log('\n🧪 Config 동적 업데이트 테스트 시작\n');
    
    TestRunner3.reset();
    
    const { describe, it, expect } = {
        describe: TestRunner3.describe.bind(TestRunner3),
        it: TestRunner3.it.bind(TestRunner3),
        expect: TestRunner3.expect.bind(TestRunner3)
    };
    
    // 전역 함수 확인
    if (!window.updateEquipmentConfig || !window.resetConfig) {
        console.error('❌ Config 동적 업데이트 함수를 찾을 수 없습니다.');
        console.error('   updateEquipmentConfig, resetConfig가 전역으로 노출되어야 합니다.');
        return false;
    }
    
    // CONFIG 객체 가져오기 (테스트 전 초기화)
    window.resetConfig();
    
    // =========================================================
    // 테스트 1: 기본 상태 확인
    // =========================================================
    describe('1. 기본 상태 확인 (reset 후)', () => {
        it('EQUIPMENT.ROWS 기본값은 26', () => {
            expect(CONFIG.EQUIPMENT.ROWS).toBe(26);
        });
        
        it('EQUIPMENT.COLS 기본값은 6', () => {
            expect(CONFIG.EQUIPMENT.COLS).toBe(6);
        });
        
        it('EQUIPMENT.SIZE.WIDTH 기본값은 1.5', () => {
            expect(CONFIG.EQUIPMENT.SIZE.WIDTH).toBeCloseTo(1.5, 2);
        });
        
        it('SCENE.FLOOR_SIZE 기본값은 70', () => {
            expect(CONFIG.SCENE.FLOOR_SIZE).toBe(70);
        });
    });
    
    // =========================================================
    // 테스트 2: updateEquipmentConfig 기능
    // =========================================================
    describe('2. updateEquipmentConfig 기능', () => {
        // 초기화
        window.resetConfig();
        
        it('ROWS 업데이트', () => {
            window.updateEquipmentConfig({ ROWS: 30 });
            expect(CONFIG.EQUIPMENT.ROWS).toBe(30);
        });
        
        it('COLS 업데이트', () => {
            window.updateEquipmentConfig({ COLS: 8 });
            expect(CONFIG.EQUIPMENT.COLS).toBe(8);
        });
        
        it('SIZE 부분 업데이트', () => {
            window.updateEquipmentConfig({ 
                SIZE: { WIDTH: 2.0 }
            });
            expect(CONFIG.EQUIPMENT.SIZE.WIDTH).toBeCloseTo(2.0, 2);
            // 다른 SIZE 속성은 유지되어야 함
            expect(CONFIG.EQUIPMENT.SIZE.HEIGHT).toBeCloseTo(2.2, 2);
        });
        
        it('SPACING 업데이트', () => {
            window.updateEquipmentConfig({
                SPACING: {
                    DEFAULT: 0.2,
                    CORRIDOR_COL_WIDTH: 1.5
                }
            });
            expect(CONFIG.EQUIPMENT.SPACING.DEFAULT).toBeCloseTo(0.2, 2);
            expect(CONFIG.EQUIPMENT.SPACING.CORRIDOR_COL_WIDTH).toBeCloseTo(1.5, 2);
        });
        
        it('EXCLUDED_POSITIONS 업데이트', () => {
            const newExcluded = [{ col: 1, row: 1 }, { col: 2, row: 2 }];
            window.updateEquipmentConfig({ EXCLUDED_POSITIONS: newExcluded });
            expect(CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length).toBe(2);
        });
    });
    
    // =========================================================
    // 테스트 3: updateSceneConfig 기능
    // =========================================================
    describe('3. updateSceneConfig 기능', () => {
        // 초기화
        window.resetConfig();
        
        it('FLOOR_SIZE 업데이트', () => {
            window.updateSceneConfig({ FLOOR_SIZE: 100 });
            expect(CONFIG.SCENE.FLOOR_SIZE).toBe(100);
        });
        
        it('null 입력 시 기존 값 유지', () => {
            const before = CONFIG.SCENE.FLOOR_SIZE;
            window.updateSceneConfig(null);
            expect(CONFIG.SCENE.FLOOR_SIZE).toBe(before);
        });
    });
    
    // =========================================================
    // 테스트 4: resetConfig 기능
    // =========================================================
    describe('4. resetConfig 기능', () => {
        // 값 변경
        window.updateEquipmentConfig({ ROWS: 50, COLS: 10 });
        window.updateSceneConfig({ FLOOR_SIZE: 200 });
        
        // 리셋
        window.resetConfig();
        
        it('ROWS가 기본값 26으로 복원', () => {
            expect(CONFIG.EQUIPMENT.ROWS).toBe(26);
        });
        
        it('COLS가 기본값 6으로 복원', () => {
            expect(CONFIG.EQUIPMENT.COLS).toBe(6);
        });
        
        it('FLOOR_SIZE가 기본값 70으로 복원', () => {
            expect(CONFIG.SCENE.FLOOR_SIZE).toBe(70);
        });
        
        it('EXCLUDED_POSITIONS가 기본값 39개로 복원', () => {
            expect(CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length).toBe(39);
        });
    });
    
    // =========================================================
    // 테스트 5: 복합 업데이트
    // =========================================================
    describe('5. 복합 업데이트', () => {
        window.resetConfig();
        
        it('Layout2DTo3DConverter 출력 형식으로 업데이트', () => {
            // Converter 출력 형식의 CONFIG
            const converterOutput = {
                ROWS: 20,
                COLS: 5,
                SIZE: {
                    WIDTH: 1.8,
                    HEIGHT: 2.5,
                    DEPTH: 2.2
                },
                SPACING: {
                    DEFAULT: 0.15,
                    CORRIDOR_COLS: [1, 3],
                    CORRIDOR_COL_WIDTH: 1.0,
                    CORRIDOR_ROWS: [10],
                    CORRIDOR_ROW_WIDTH: 1.8
                },
                EXCLUDED_POSITIONS: [
                    { col: 1, row: 1 },
                    { col: 5, row: 20 }
                ]
            };
            
            window.updateEquipmentConfig(converterOutput);
            
            expect(CONFIG.EQUIPMENT.ROWS).toBe(20);
            expect(CONFIG.EQUIPMENT.COLS).toBe(5);
            expect(CONFIG.EQUIPMENT.SIZE.WIDTH).toBeCloseTo(1.8, 2);
            expect(CONFIG.EQUIPMENT.SIZE.HEIGHT).toBeCloseTo(2.5, 2);
            expect(CONFIG.EQUIPMENT.SPACING.DEFAULT).toBeCloseTo(0.15, 2);
            expect(CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length).toBe(2);
        });
    });
    
    // 테스트 후 초기화
    window.resetConfig();
    
    return TestRunner3.summary();
}

// 전역 함수로 노출
window.runConfigDynamicTests = runConfigDynamicTests;