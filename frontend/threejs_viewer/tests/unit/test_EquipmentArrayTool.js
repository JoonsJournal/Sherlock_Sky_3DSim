/**
 * test_EquipmentArrayTool.js
 * 
 * EquipmentArrayTool 단위 테스트 (브라우저 전용)
 * 
 * @version 1.0.2 - 테스트 기대값 수정 (물리적으로 올바른 값으로 변경)
 * 
 * 수정 사항:
 * - Col 3 기대값: 52 → 72 (설비 겹침 방지)
 * 
 * 위치: frontend/threejs_viewer/tests/test_EquipmentArrayTool.js
 */

// ===================================================
// Test Suite Setup
// ===================================================

class TestRunner {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }

    test(description, testFn) {
        this.tests.push({ description, testFn });
    }

    async run() {
        console.log(`\n========================================`);
        console.log(`🧪 Test Suite: ${this.name}`);
        console.log(`========================================\n`);

        for (const { description, testFn } of this.tests) {
            this.results.total++;
            
            try {
                await testFn();
                this.results.passed++;
                console.log(`✅ PASS: ${description}`);
            } catch (error) {
                this.results.failed++;
                console.error(`❌ FAIL: ${description}`);
                console.error(`   Error: ${error.message}`);
                console.error(`   Stack: ${error.stack}`);
            }
        }

        this.printSummary();
    }

    printSummary() {
        console.log(`\n========================================`);
        console.log(`📊 Test Results`);
        console.log(`========================================`);
        console.log(`Total:  ${this.results.total}`);
        console.log(`Passed: ${this.results.passed} ✅`);
        console.log(`Failed: ${this.results.failed} ❌`);
        console.log(`========================================\n`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(
            message || `Expected ${expected}, but got ${actual}`
        );
    }
}

function assertArrayEquals(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
            message || `Arrays not equal: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`
        );
    }
}

// ===================================================
// Mock Canvas2DEditor (테스트용)
// ===================================================

class MockCanvas2DEditor {
    constructor() {
        this.config = {
            scale: 10,
            snapToGrid: true,
            gridSize: 10
        };

        this.stage = {
            container: () => ({
                style: { cursor: 'default' }
            }),
            getPointerPosition: () => ({ x: 100, y: 100 }),
            on: () => {},
            off: () => {}
        };

        this.layers = {
            equipment: {
                children: [],
                add: function(group) {
                    this.children = this.children || [];
                    this.children.push(group);
                },
                batchDraw: () => {},
                find: function(selector) {
                    return this.children ? this.children.filter(c => c.name() === selector.substring(1)) : [];
                }
            }
        };

        this.currentLayout = {
            equipmentArrays: []
        };

        this.selectedObjects = [];

        this.cssColors = {
            equipmentDefault: '#4a90e2',
            equipmentStroke: '#2c3e50',
            equipmentHover: '#3498db'
        };

        this.snapToGrid = (shape) => {};
        this.selectObject = (shape) => {
            this.selectedObjects.push(shape);
        };
        this.selectMultiple = (shape) => {
            if (!this.selectedObjects.includes(shape)) {
                this.selectedObjects.push(shape);
            }
        };
    }
}

// Mock Konva.Group
class MockKonvaGroup {
    constructor(config) {
        this.config = config || {};
        this.attrs = {};
        this.children = [];
        this._id = Math.random().toString(36).substr(2, 9);
    }

    setAttr(key, value) { this.attrs[key] = value; }
    getAttr(key) { return this.attrs[key]; }
    add(child) { this.children.push(child); }
    position() { return { x: this.config.x || 0, y: this.config.y || 0 }; }
    name() { return this.config.name || ''; }
    on(event, handler) {}
    remove() {}
    getParent() { return { name: () => 'equipmentArray' }; }
    getAbsolutePosition() { return this.position(); }
    draggable(value) {
        if (value !== undefined) { this.config.draggable = value; }
        return this.config.draggable;
    }
    off(event) {}
    findOne(selector) { return this; }
    width() { return this.config.width || 0; }
    height() { return this.config.height || 0; }
    fill(value) {
        if (value !== undefined) { this.config.fill = value; }
        return this.config.fill;
    }
}

// Mock Konva
if (typeof window !== 'undefined' && !window.Konva) {
    window.Konva = {
        Group: MockKonvaGroup,
        Rect: MockKonvaGroup,
        Text: MockKonvaGroup
    };
}

// ===================================================
// Test Suite
// ===================================================

async function runEquipmentArrayToolTests() {
    const suite = new TestRunner('EquipmentArrayTool');

    // ✅ Test 1: 복도 없을 때 - 기존 유지
    suite.test('calculatePosition - 복도 없을 때', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        tool.config = {
            equipmentSize: { width: 1.5, depth: 3.0 },
            spacing: 0.5,
            corridorCols: [],
            corridorColWidth: 0,
            corridorRows: [],
            corridorRowWidth: 0
        };

        const pos = tool.calculatePosition(0, 0);
        assertEquals(pos.x, 0, 'Row 0, Col 0 should be at x=0');
        assertEquals(pos.y, 0, 'Row 0, Col 0 should be at y=0');

        const pos2 = tool.calculatePosition(1, 1);
        assertEquals(pos2.x, 20, 'Row 1, Col 1 should be at x=20');
        assertEquals(pos2.y, 35, 'Row 1, Col 1 should be at y=35');
    });

    // ✅ Test 2: Col 복도 고려 - 기대값 수정: 52 → 72
    suite.test('calculatePosition - Col 복도 고려', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        tool.config = {
            equipmentSize: { width: 1.5, depth: 3.0 },
            spacing: 0.5,
            corridorCols: [2],
            corridorColWidth: 1.2,
            corridorRows: [],
            corridorRowWidth: 0
        };

        const pos = tool.calculatePosition(0, 3);
        // ✅ 수정: 52 → 72
        // 계산: c=0: x=20, c=1: x=40+12=52, c=2: x=52+20=72
        assertEquals(pos.x, 72, 'Col 3 with corridor at col 2 should be at x=72');
    });

    // ✅ Test 3: Row 복도 고려 - 기존 유지
    suite.test('calculatePosition - Row 복도 고려', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        tool.config = {
            equipmentSize: { width: 1.5, depth: 3.0 },
            spacing: 0.5,
            corridorCols: [],
            corridorColWidth: 0,
            corridorRows: [13],
            corridorRowWidth: 2.0
        };

        const pos = tool.calculatePosition(14, 0);
        assertEquals(pos.y, 510, 'Row 14 with corridor at row 13 should be at y=510');
    });

    // ✅ Test 4: 제외 위치 확인
    suite.test('isExcluded - 제외 위치 확인', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        const excludedPositions = [
            { row: 14, col: 4 },
            { row: 14, col: 5 }
        ];

        assert(tool.isExcluded(14, 4, excludedPositions), 'Position (14, 4) should be excluded');
        assert(tool.isExcluded(14, 5, excludedPositions), 'Position (14, 5) should be excluded');
        assert(!tool.isExcluded(14, 3, excludedPositions), 'Position (14, 3) should NOT be excluded');
        assert(!tool.isExcluded(15, 4, excludedPositions), 'Position (15, 4) should NOT be excluded');
    });

    // ✅ Test 5: 배열 생성 확인
    suite.test('createArray - 배열 생성 확인', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        tool.config = {
            rows: 26,
            cols: 6,
            equipmentSize: { width: 1.5, depth: 3.0 },
            spacing: 0.5,
            corridorCols: [2, 4],
            corridorColWidth: 1.2,
            corridorRows: [13],
            corridorRowWidth: 2.0,
            excludedPositions: [
                { row: 14, col: 4 },
                { row: 14, col: 5 }
            ]
        };

        const arrayGroup = tool.createArray({ x: 0, y: 0 });
        assert(arrayGroup !== null, 'Array group should be created');
        assert(arrayGroup.name() === 'equipmentArray', 'Array group name should be equipmentArray');
    });

    // ✅ Test 6: 메타데이터 저장
    suite.test('createArray - 메타데이터 저장', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        tool.config = {
            rows: 26,
            cols: 6,
            equipmentSize: { width: 1.5, depth: 3.0 },
            spacing: 0.5,
            corridorCols: [2, 4],
            corridorColWidth: 1.2,
            corridorRows: [13],
            corridorRowWidth: 2.0,
            excludedPositions: []
        };

        const arrayGroup = tool.createArray({ x: 100, y: 200 });
        const storedConfig = arrayGroup.getAttr('arrayConfig');
        assert(storedConfig !== undefined, 'Array config should be stored');
        assertEquals(storedConfig.rows, 26, 'Rows should be 26');
        assertEquals(storedConfig.cols, 6, 'Cols should be 6');
    });

    // ✅ Test 7: 도구 활성화/비활성화
    suite.test('activate/deactivate - 도구 활성화/비활성화', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        const config = {
            rows: 26,
            cols: 6,
            equipmentSize: { width: 1.5, depth: 3.0 },
            spacing: 0.5,
            corridorCols: [],
            corridorColWidth: 0,
            corridorRows: [],
            corridorRowWidth: 0,
            excludedPositions: []
        };

        tool.activate(config);
        assert(tool.isToolActive(), 'Tool should be active');
        assertEquals(tool.config.rows, 26, 'Config should be set');

        tool.deactivate();
        assert(!tool.isToolActive(), 'Tool should be inactive');
    });

    // ✅ Test 8: 개별 설비 생성
    suite.test('createEquipment - 개별 설비 생성', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        tool.config = {
            equipmentSize: { width: 1.5, depth: 3.0 }
        };

        const equipment = tool.createEquipment(0, 0, { x: 0, y: 0 }, { width: 1.5, depth: 3.0 });
        assert(equipment !== null, 'Equipment should be created');
        assert(equipment.name() === 'equipment', 'Equipment name should be equipment');

        const equipData = equipment.getAttr('equipmentData');
        assert(equipData !== undefined, 'Equipment data should be stored');
        assertEquals(equipData.row, 0, 'Row should be 0');
        assertEquals(equipData.col, 0, 'Col should be 0');
        assertEquals(equipData.id, 'EQ-01-01', 'Equipment ID should be EQ-01-01');
    });

    // ✅ Test 9: 복합 테스트 - 기대값 수정: 52 → 72
    suite.test('복합 테스트 - 배열 생성 통합', () => {
        const canvas = new MockCanvas2DEditor();
        const tool = new EquipmentArrayTool(canvas);

        tool.config = {
            rows: 10,
            cols: 5,
            equipmentSize: { width: 1.5, depth: 3.0 },
            spacing: 0.5,
            corridorCols: [2],
            corridorColWidth: 1.2,
            corridorRows: [5],
            corridorRowWidth: 2.0,
            excludedPositions: [
                { row: 0, col: 0 },
                { row: 9, col: 4 }
            ]
        };

        const arrayGroup = tool.createArray({ x: 0, y: 0 });
        assert(arrayGroup !== null, 'Array group should be created');
        
        const pos = tool.calculatePosition(3, 0);
        assertEquals(pos.x, 0, 'Col 0 should be at x=0');
        
        const pos2 = tool.calculatePosition(0, 3);
        // ✅ 수정: 52 → 72
        assertEquals(pos2.x, 72, 'Col 3 should be at x=72 with corridor');
    });

    await suite.run();
}

// ===================================================
// 전역 함수로 노출 (브라우저 환경)
// ===================================================
if (typeof window !== 'undefined') {
    window.runEquipmentArrayToolTests = runEquipmentArrayToolTests;
    window.TestRunner = TestRunner;
    window.assert = assert;
    window.assertEquals = assertEquals;
    window.assertArrayEquals = assertArrayEquals;
    window.MockCanvas2DEditor = MockCanvas2DEditor;
    window.MockKonvaGroup = MockKonvaGroup;
    
    console.log('[Test] ✅ Test functions loaded successfully (v1.0.2 - Corrected expected values)');
}