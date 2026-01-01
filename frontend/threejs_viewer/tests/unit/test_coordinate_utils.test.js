/**
 * test_coordinate_utils.test.js
 * CoordinateUtils 단위 테스트
 * 
 * @version 1.0.0 - Phase 4.1
 * 
 * 테스트 항목:
 * 1. 2D → 3D 좌표 변환 정확성
 * 2. 3D → 2D 역변환 정확성
 * 3. 스케일 적용 정확성
 * 4. 벽 변환 정확성
 * 5. Equipment Array 변환 정확성
 */

// Jest 환경이 아닌 경우를 위한 간단한 테스트 프레임워크
const TestRunner = {
    tests: [],
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
    }
};

// 전역으로 노출
const { describe, it, expect } = {
    describe: TestRunner.describe.bind(TestRunner),
    it: TestRunner.it.bind(TestRunner),
    expect: TestRunner.expect.bind(TestRunner)
};

/**
 * CoordinateUtils 테스트 실행
 */
function runCoordinateUtilsTests() {
    console.log('\n🧪 CoordinateUtils 테스트 시작\n');
    
    // CoordinateUtils 인스턴스 가져오기
    const coordUtils = window.coordinateUtils || window.CoordinateUtils && new window.CoordinateUtils();
    
    if (!coordUtils) {
        console.error('❌ CoordinateUtils를 찾을 수 없습니다. 모듈이 로드되었는지 확인하세요.');
        return false;
    }
    
    // =========================================================
    // 테스트 1: 기본 설정 확인
    // =========================================================
    describe('1. 기본 설정 확인', () => {
        it('기본 스케일은 10이어야 함 (1m = 10px)', () => {
            expect(coordUtils.scale).toBe(10);
        });
        
        it('기본 Canvas 크기는 1200x800이어야 함', () => {
            expect(coordUtils.canvasSize.width).toBe(1200);
            expect(coordUtils.canvasSize.height).toBe(800);
        });
        
        it('기본 Room 크기는 40x60이어야 함', () => {
            expect(coordUtils.roomSize.width).toBe(40);
            expect(coordUtils.roomSize.depth).toBe(60);
        });
        
        it('Canvas 중심점이 올바르게 계산되어야 함', () => {
            expect(coordUtils.canvasCenter.x).toBe(600);
            expect(coordUtils.canvasCenter.y).toBe(400);
        });
    });
    
    // =========================================================
    // 테스트 2: 2D → 3D 좌표 변환
    // =========================================================
    describe('2. 2D → 3D 좌표 변환', () => {
        it('Canvas 중심 (600, 400) → 3D 원점 (0, 0)', () => {
            const result = coordUtils.canvas2DToWorld3D(600, 400);
            expect(result.x).toBeCloseTo(0, 1);
            expect(result.z).toBeCloseTo(0, 1);
        });
        
        it('Canvas 좌상단 (0, 0) → 3D (-60, -40)', () => {
            const result = coordUtils.canvas2DToWorld3D(0, 0);
            expect(result.x).toBeCloseTo(-60, 1);
            expect(result.z).toBeCloseTo(-40, 1);
        });
        
        it('Canvas 우하단 (1200, 800) → 3D (60, 40)', () => {
            const result = coordUtils.canvas2DToWorld3D(1200, 800);
            expect(result.x).toBeCloseTo(60, 1);
            expect(result.z).toBeCloseTo(40, 1);
        });
        
        it('임의의 점 (300, 200) 변환 확인', () => {
            // 300px = 30m, 200px = 20m
            // 중심 기준: 30 - 60 = -30, 20 - 40 = -20
            const result = coordUtils.canvas2DToWorld3D(300, 200);
            expect(result.x).toBeCloseTo(-30, 1);
            expect(result.z).toBeCloseTo(-20, 1);
        });
    });
    
    // =========================================================
    // 테스트 3: 3D → 2D 역변환
    // =========================================================
    describe('3. 3D → 2D 역변환', () => {
        it('3D 원점 (0, 0) → Canvas 중심 (600, 400)', () => {
            const result = coordUtils.world3DToCanvas2D(0, 0);
            expect(result.x).toBeCloseTo(600, 1);
            expect(result.y).toBeCloseTo(400, 1);
        });
        
        it('3D (-60, -40) → Canvas 좌상단 (0, 0)', () => {
            const result = coordUtils.world3DToCanvas2D(-60, -40);
            expect(result.x).toBeCloseTo(0, 1);
            expect(result.y).toBeCloseTo(0, 1);
        });
        
        it('왕복 변환 정확성: 2D → 3D → 2D', () => {
            const original = { x: 450, y: 350 };
            const to3D = coordUtils.canvas2DToWorld3D(original.x, original.y);
            const backTo2D = coordUtils.world3DToCanvas2D(to3D.x, to3D.z);
            
            expect(backTo2D.x).toBeCloseTo(original.x, 1);
            expect(backTo2D.y).toBeCloseTo(original.y, 1);
        });
    });
    
    // =========================================================
    // 테스트 4: 크기 변환
    // =========================================================
    describe('4. 크기 변환', () => {
        it('2D 크기 (100px, 200px) → 3D (10m, 20m)', () => {
            const result = coordUtils.canvas2DSizeToWorld3D(100, 200);
            expect(result.width).toBeCloseTo(10, 1);
            expect(result.depth).toBeCloseTo(20, 1);
        });
        
        it('3D 크기 (15m, 30m) → 2D (150px, 300px)', () => {
            const result = coordUtils.world3DSizeToCanvas2D(15, 30);
            expect(result.width).toBeCloseTo(150, 1);
            expect(result.height).toBeCloseTo(300, 1);
        });
    });
    
    // =========================================================
    // 테스트 5: 사각형 변환
    // =========================================================
    describe('5. 사각형 변환', () => {
        it('2D Rect → 3D Rect 변환', () => {
            const rect2D = { x: 500, y: 300, width: 200, height: 100 };
            const result = coordUtils.canvas2DRectToWorld3D(rect2D);
            
            // 중심점: (500+100, 300+50) = (600, 350) → (0, -5)
            expect(result.x).toBeCloseTo(0, 1);
            expect(result.z).toBeCloseTo(-5, 1);
            
            // 크기: 200/10 = 20m, 100/10 = 10m
            expect(result.width).toBeCloseTo(20, 1);
            expect(result.depth).toBeCloseTo(10, 1);
        });
    });
    
    // =========================================================
    // 테스트 6: 벽 변환
    // =========================================================
    describe('6. 벽 변환', () => {
        it('수평 벽 (가로) 변환 - rotation.y ≈ 0', () => {
            const wall2D = {
                startX: 400, startY: 400,
                endX: 800, endY: 400,
                thickness: 2
            };
            const result = coordUtils.convertWall2DTo3D(wall2D, 4);
            
            // 길이: 400px / 10 = 40m
            expect(result.size.width).toBeCloseTo(40, 1);
            expect(result.size.height).toBe(4);
            
            // 두께: 2/10 = 0.2m
            expect(result.size.depth).toBeCloseTo(0.2, 2);
            
            // 회전: 수평 벽(X축 방향)은 rotation.y ≈ 0
            // atan2(dz, dx) = atan2(0, 40) = 0
            expect(Math.abs(result.rotation.y)).toBeLessThan(0.1);
        });
        
        it('수직 벽 (세로) 변환 - rotation.y ≈ ±π/2', () => {
            const wall2D = {
                startX: 600, startY: 200,
                endX: 600, endY: 600,
                thickness: 2
            };
            const result = coordUtils.convertWall2DTo3D(wall2D, 4);
            
            // 길이: 400px / 10 = 40m
            expect(result.size.width).toBeCloseTo(40, 1);
            
            // 회전: 수직 벽(Z축 방향)은 rotation.y ≈ ±π/2
            // atan2(dz, dx) = atan2(40, 0) = π/2
            const absRotation = Math.abs(result.rotation.y);
            const expectedRotation = Math.PI / 2;
            expect(Math.abs(absRotation - expectedRotation)).toBeLessThan(0.1);
        });
    });
    
    // =========================================================
    // 테스트 7: Equipment Array 변환
    // =========================================================
    describe('7. Equipment Array 변환', () => {
        it('Equipment Array 2D → 3D CONFIG 변환', () => {
            const array2D = {
                rows: 26,
                cols: 6,
                equipmentSize: { width: 15, height: 20 },  // px
                spacing: {
                    default: 1,
                    corridorCols: [1, 3, 5],
                    corridorColWidth: 12,
                    corridorRows: [13],
                    corridorRowWidth: 20
                }
            };
            
            const result = coordUtils.convertEquipmentArray2DTo3D(array2D);
            
            expect(result.ROWS).toBe(26);
            expect(result.COLS).toBe(6);
            
            // 크기: 15/10 = 1.5m, 20/10 = 2.0m
            expect(result.SIZE.WIDTH).toBeCloseTo(1.5, 2);
            expect(result.SIZE.DEPTH).toBeCloseTo(2.0, 2);
            
            // 간격: 1/10 = 0.1m
            expect(result.SPACING.DEFAULT).toBeCloseTo(0.1, 2);
            expect(result.SPACING.CORRIDOR_COL_WIDTH).toBeCloseTo(1.2, 2);
            expect(result.SPACING.CORRIDOR_ROW_WIDTH).toBeCloseTo(2.0, 2);
        });
    });
    
    // =========================================================
    // 테스트 8: 설정 업데이트
    // =========================================================
    describe('8. 설정 업데이트', () => {
        it('스케일 변경 후 변환 확인', () => {
            // 스케일을 20으로 변경 (1m = 20px)
            coordUtils.updateSettings({ scale: 20 });
            
            const result = coordUtils.canvas2DSizeToWorld3D(200, 200);
            expect(result.width).toBeCloseTo(10, 1);  // 200/20 = 10m
            
            // 원래대로 복원
            coordUtils.updateSettings({ scale: 10 });
        });
    });
    
    // =========================================================
    // 테스트 9: 범위 검증
    // =========================================================
    describe('9. 범위 검증', () => {
        it('Room 내부 좌표 검증 - 내부', () => {
            const isInside = coordUtils.isWithinRoom(10, 20);
            expect(isInside).toBeTruthy();
        });
        
        it('Room 내부 좌표 검증 - 외부', () => {
            const isOutside = coordUtils.isWithinRoom(100, 100);
            expect(isOutside).toBeFalsy();
        });
        
        it('Room 경계 좌표 검증', () => {
            const onBoundary = coordUtils.isWithinRoom(20, 30);  // 정확히 경계
            expect(onBoundary).toBeTruthy();
        });
    });
    
    return TestRunner.summary();
}

// 전역 함수로 노출
window.runCoordinateUtilsTests = runCoordinateUtilsTests;

// 자동 실행 (모듈 로드 시)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('💡 CoordinateUtils 테스트 실행: runCoordinateUtilsTests()');
    });
}