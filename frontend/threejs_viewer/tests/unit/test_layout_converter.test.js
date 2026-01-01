/**
 * test_layout_converter.test.js
 * Layout2DTo3DConverter 단위 테스트
 * 
 * @version 1.0.0 - Phase 4.1
 * 
 * 테스트 항목:
 * 1. 전체 변환 기능 (convert)
 * 2. Room 파라미터 변환
 * 3. Equipment CONFIG 변환
 * 4. 벽 변환
 * 5. 파티션 변환
 * 6. Office 변환
 * 7. 검증 기능
 */

// TestRunner 재사용 (test_coordinate_utils.test.js에서 정의)
const TestRunner2 = {
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
                const actualRounded = Math.round(actual * multiplier) / multiplier;
                const expectedRounded = Math.round(expected * multiplier) / multiplier;
                if (actualRounded !== expectedRounded) {
                    throw new Error(`Expected ${expected} (±${1/multiplier}), but got ${actual}`);
                }
            },
            toEqual(expected) {
                const actualStr = JSON.stringify(actual);
                const expectedStr = JSON.stringify(expected);
                if (actualStr !== expectedStr) {
                    throw new Error(`Expected ${expectedStr}, but got ${actualStr}`);
                }
            },
            toBeTruthy() {
                if (!actual) {
                    throw new Error(`Expected truthy value, but got ${actual}`);
                }
            },
            toBeFalsy() {
                if (actual) {
                    throw new Error(`Expected falsy value, but got ${actual}`);
                }
            },
            toBeNull() {
                if (actual !== null) {
                    throw new Error(`Expected null, but got ${actual}`);
                }
            },
            toHaveProperty(prop) {
                if (!(prop in actual)) {
                    throw new Error(`Expected object to have property "${prop}"`);
                }
            },
            toBeGreaterThan(expected) {
                if (actual <= expected) {
                    throw new Error(`Expected ${actual} to be greater than ${expected}`);
                }
            },
            toBeLessThan(expected) {
                if (actual >= expected) {
                    throw new Error(`Expected ${actual} to be less than ${expected}`);
                }
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
 * 테스트용 Layout 데이터
 */
const mockLayoutData = {
    version: "1.0",
    template_name: "standard_26x6",
    site_id: "test_site_001",
    
    canvas: {
        width: 1200,
        height: 800,
        scale: 10
    },
    
    room: {
        width: 40,
        depth: 60,
        wallHeight: 4,
        wallThickness: 0.2
    },
    
    walls: [
        // 북쪽 벽 (수평)
        { type: 'line', startX: 100, startY: 100, endX: 1100, endY: 100, thickness: 2 },
        // 남쪽 벽 (수평)
        { type: 'line', startX: 100, startY: 700, endX: 1100, endY: 700, thickness: 2 },
        // 동쪽 벽 (수직)
        { type: 'line', startX: 1100, startY: 100, endX: 1100, endY: 700, thickness: 2 },
        // 서쪽 벽 (수직)
        { type: 'line', startX: 100, startY: 100, endX: 100, endY: 700, thickness: 2 }
    ],
    
    equipmentArrays: [
        {
            id: 'main_array',
            rows: 26,
            cols: 6,
            equipmentSize: { width: 15, height: 20 },
            spacing: {
                default: 1,
                corridorCols: [1, 3, 5],
                corridorColWidth: 12,
                corridorRows: [13],
                corridorRowWidth: 20
            },
            excludedPositions: [
                { col: 4, row: 4 },
                { col: 4, row: 5 },
                { col: 5, row: 1 },
                { col: 5, row: 2 }
            ],
            position: { x: 150, y: 150 }
        }
    ],
    
    partitions: [
        {
            id: 'partition_1',
            x: 800,
            y: 200,
            width: 50,
            height: 5,
            type: 'glass',
            partitionHeight: 2.5
        }
    ],
    
    office: {
        x: 850,
        y: 150,
        width: 120,
        height: 200,
        hasEntrance: true,
        entranceWidth: 30
    }
};

/**
 * Layout2DTo3DConverter 테스트 실행
 */
function runLayoutConverterTests() {
    console.log('\n🧪 Layout2DTo3DConverter 테스트 시작\n');
    
    TestRunner2.reset();
    
    const { describe, it, expect } = {
        describe: TestRunner2.describe.bind(TestRunner2),
        it: TestRunner2.it.bind(TestRunner2),
        expect: TestRunner2.expect.bind(TestRunner2)
    };
    
    // Converter 인스턴스 가져오기
    const converter = window.layout2DTo3DConverter || 
                     (window.Layout2DTo3DConverter && new window.Layout2DTo3DConverter());
    
    if (!converter) {
        console.error('❌ Layout2DTo3DConverter를 찾을 수 없습니다. 모듈이 로드되었는지 확인하세요.');
        return false;
    }
    
    // =========================================================
    // 테스트 1: 전체 변환 기능
    // =========================================================
    describe('1. 전체 변환 기능 (convert)', () => {
        const result = converter.convert(mockLayoutData);
        
        it('변환 결과가 null이 아니어야 함', () => {
            expect(result).toBeTruthy();
        });
        
        it('meta 정보가 포함되어야 함', () => {
            expect(result).toHaveProperty('meta');
            expect(result.meta.siteId).toBe('test_site_001');
            expect(result.meta.templateName).toBe('standard_26x6');
        });
        
        it('roomParams가 포함되어야 함', () => {
            expect(result).toHaveProperty('roomParams');
        });
        
        it('equipmentConfig가 포함되어야 함', () => {
            expect(result).toHaveProperty('equipmentConfig');
        });
        
        it('wallParams가 포함되어야 함', () => {
            expect(result).toHaveProperty('wallParams');
        });
        
        it('partitionParams가 포함되어야 함', () => {
            expect(result).toHaveProperty('partitionParams');
        });
        
        it('officeParams가 포함되어야 함', () => {
            expect(result).toHaveProperty('officeParams');
        });
    });
    
    // =========================================================
    // 테스트 2: Room 파라미터 변환
    // =========================================================
    describe('2. Room 파라미터 변환', () => {
        const result = converter.convert(mockLayoutData);
        const roomParams = result.roomParams;
        
        it('roomWidth가 40m이어야 함', () => {
            expect(roomParams.roomWidth).toBe(40);
        });
        
        it('roomDepth가 60m이어야 함', () => {
            expect(roomParams.roomDepth).toBe(60);
        });
        
        it('wallHeight가 4m이어야 함', () => {
            expect(roomParams.wallHeight).toBe(4);
        });
        
        it('wallThickness가 0.2m이어야 함', () => {
            expect(roomParams.wallThickness).toBe(0.2);
        });
        
        it('floorSize가 적절히 계산되어야 함 (max + 20)', () => {
            expect(roomParams.floorSize).toBe(80);  // max(40, 60) + 20
        });
    });
    
    // =========================================================
    // 테스트 3: Equipment CONFIG 변환
    // =========================================================
    describe('3. Equipment CONFIG 변환', () => {
        const result = converter.convert(mockLayoutData);
        const equipConfig = result.equipmentConfig;
        
        it('ROWS가 26이어야 함', () => {
            expect(equipConfig.ROWS).toBe(26);
        });
        
        it('COLS가 6이어야 함', () => {
            expect(equipConfig.COLS).toBe(6);
        });
        
        it('SIZE.WIDTH가 1.5m이어야 함 (15px / 10)', () => {
            expect(equipConfig.SIZE.WIDTH).toBeCloseTo(1.5, 2);
        });
        
        it('SIZE.DEPTH가 2.0m이어야 함 (20px / 10)', () => {
            expect(equipConfig.SIZE.DEPTH).toBeCloseTo(2.0, 2);
        });
        
        it('SPACING.DEFAULT가 0.1m이어야 함 (1px / 10)', () => {
            expect(equipConfig.SPACING.DEFAULT).toBeCloseTo(0.1, 2);
        });
        
        it('SPACING.CORRIDOR_COLS가 [1, 3, 5]이어야 함', () => {
            expect(JSON.stringify(equipConfig.SPACING.CORRIDOR_COLS)).toBe('[1,3,5]');
        });
        
        it('SPACING.CORRIDOR_COL_WIDTH가 1.2m이어야 함', () => {
            expect(equipConfig.SPACING.CORRIDOR_COL_WIDTH).toBeCloseTo(1.2, 2);
        });
        
        it('EXCLUDED_POSITIONS가 4개이어야 함', () => {
            expect(equipConfig.EXCLUDED_POSITIONS.length).toBe(4);
        });
        
        it('실제 설비 수가 올바르게 계산되어야 함', () => {
            // 26 * 6 = 156, 제외 4개 = 152개
            expect(equipConfig._actualCount).toBe(152);
        });
    });
    
    // =========================================================
    // 테스트 4: 벽 변환
    // =========================================================
    describe('4. 벽 변환', () => {
        const result = converter.convert(mockLayoutData);
        const wallParams = result.wallParams;
        
        it('4개의 벽이 변환되어야 함', () => {
            expect(wallParams.length).toBe(4);
        });
        
        it('각 벽에 position이 있어야 함', () => {
            wallParams.forEach(wall => {
                expect(wall).toHaveProperty('position');
                expect(wall.position).toHaveProperty('x');
                expect(wall.position).toHaveProperty('y');
                expect(wall.position).toHaveProperty('z');
            });
        });
        
        it('각 벽에 size가 있어야 함', () => {
            wallParams.forEach(wall => {
                expect(wall).toHaveProperty('size');
                expect(wall.size).toHaveProperty('width');
                expect(wall.size).toHaveProperty('height');
                expect(wall.size).toHaveProperty('depth');
            });
        });
        
        it('벽 높이가 4m이어야 함', () => {
            wallParams.forEach(wall => {
                expect(wall.size.height).toBe(4);
            });
        });
        
        it('첫 번째 벽(북쪽)이 수평이어야 함', () => {
            const northWall = wallParams[0];
            // 수평 벽은 rotation.y가 0에 가까움
            expect(Math.abs(northWall.rotation.y)).toBeLessThan(0.2);
        });
    });
    
    // =========================================================
    // 테스트 5: 파티션 변환
    // =========================================================
    describe('5. 파티션 변환', () => {
        const result = converter.convert(mockLayoutData);
        const partitionParams = result.partitionParams;
        
        it('1개의 파티션이 변환되어야 함', () => {
            expect(partitionParams.length).toBe(1);
        });
        
        it('파티션 타입이 glass이어야 함', () => {
            expect(partitionParams[0].type).toBe('glass');
        });
        
        it('파티션 높이가 2.5m이어야 함', () => {
            expect(partitionParams[0].size.height).toBe(2.5);
        });
        
        it('파티션에 hasFrame이 true이어야 함', () => {
            expect(partitionParams[0].hasFrame).toBeTruthy();
        });
    });
    
    // =========================================================
    // 테스트 6: Office 변환
    // =========================================================
    describe('6. Office 변환', () => {
        const result = converter.convert(mockLayoutData);
        const officeParams = result.officeParams;
        
        it('Office 파라미터가 존재해야 함', () => {
            expect(officeParams).toBeTruthy();
        });
        
        it('Office 크기가 올바르게 변환되어야 함', () => {
            expect(officeParams.size.width).toBeCloseTo(12, 1);   // 120/10
            expect(officeParams.size.depth).toBeCloseTo(20, 1);   // 200/10
        });
        
        it('hasEntrance가 true이어야 함', () => {
            expect(officeParams.hasEntrance).toBeTruthy();
        });
        
        it('entranceWidth가 3m이어야 함 (30px / 10)', () => {
            expect(officeParams.entranceWidth).toBeCloseTo(3, 1);
        });
    });
    
    // =========================================================
    // 테스트 7: 검증 기능
    // =========================================================
    describe('7. 검증 기능', () => {
        it('유효한 결과의 검증 통과', () => {
            const result = converter.convert(mockLayoutData);
            const validation = converter.validate(result);
            expect(validation.valid).toBeTruthy();
            expect(validation.errors.length).toBe(0);
        });
        
        it('null 입력 시 검증 실패', () => {
            const validation = converter.validate(null);
            expect(validation.valid).toBeFalsy();
        });
        
        it('빈 Layout 변환 시 기본값 사용', () => {
            const emptyLayout = { version: "1.0", site_id: "empty" };
            const result = converter.convert(emptyLayout);
            
            // 기본값이 적용되어야 함
            expect(result.roomParams.roomWidth).toBe(40);
            expect(result.equipmentConfig.ROWS).toBe(26);
        });
    });
    
    // =========================================================
    // 테스트 8: 에러 처리
    // =========================================================
    describe('8. 에러 처리', () => {
        it('null Layout 입력 시 null 반환', () => {
            const result = converter.convert(null);
            expect(result).toBeNull();
        });
        
        it('undefined Layout 입력 시 null 반환', () => {
            const result = converter.convert(undefined);
            expect(result).toBeNull();
        });
    });
    
    // =========================================================
    // 테스트 9: 캐시 기능
    // =========================================================
    describe('9. 캐시 기능', () => {
        it('마지막 변환 결과가 저장되어야 함', () => {
            converter.convert(mockLayoutData);
            const lastResult = converter.getLastResult();
            expect(lastResult).toBeTruthy();
            expect(lastResult.meta.siteId).toBe('test_site_001');
        });
    });
    
    return TestRunner2.summary();
}

// 전역 함수로 노출
window.runLayoutConverterTests = runLayoutConverterTests;
window.mockLayoutData = mockLayoutData;

// 자동 실행 안내
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('💡 Layout2DTo3DConverter 테스트 실행: runLayoutConverterTests()');
    });
}