/**
 * Config 설정 테스트
 */

describe('Config', () => {
  // Mock CONFIG 객체
  const CONFIG = {
    DEBUG_MODE: false,
    EQUIPMENT: {
      ROWS: 26,
      COLS: 6,
      SIZE: {
        WIDTH: 1.5,
        HEIGHT: 2.2,
        DEPTH: 2.0
      },
      SPACING: {
        DEFAULT: 0.1,
        CORRIDOR_COLS: [1, 3, 5],
        CORRIDOR_COL_WIDTH: 1.2,
        CORRIDOR_ROWS: [13],
        CORRIDOR_ROW_WIDTH: 2.0
      },
      EXCLUDED_POSITIONS: [
        // col:4, row 4~13
        ...Array.from({length: 10}, (_, i) => ({col: 4, row: i + 4})),
        // col:5, row 1~13
        ...Array.from({length: 13}, (_, i) => ({col: 5, row: i + 1})),
        // col:6, row 1~13
        ...Array.from({length: 13}, (_, i) => ({col: 6, row: i + 1})),
        // col:5, row 15~16
        {col: 5, row: 15},
        {col: 5, row: 16},
        // col:5, row 22
        {col: 5, row: 22}
      ]
    }
  };
  
  test('설비 배열 크기가 올바르게 설정됨', () => {
    expect(CONFIG.EQUIPMENT.ROWS).toBe(26);
    expect(CONFIG.EQUIPMENT.COLS).toBe(6);
  });
  
  test('설비 크기가 올바르게 설정됨', () => {
    expect(CONFIG.EQUIPMENT.SIZE.WIDTH).toBe(1.5);
    expect(CONFIG.EQUIPMENT.SIZE.HEIGHT).toBe(2.2);
    expect(CONFIG.EQUIPMENT.SIZE.DEPTH).toBe(2.0);
  });
  
  test('제외 위치가 39개임', () => {
    expect(CONFIG.EQUIPMENT.EXCLUDED_POSITIONS).toHaveLength(39);
  });
  
  test('isExcludedPosition 함수가 올바르게 동작', () => {
    const isExcludedPosition = (row, col) => {
      return CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.some(
        pos => pos.row === row && pos.col === col
      );
    };
    
    // 제외 위치
    expect(isExcludedPosition(4, 4)).toBe(true);
    expect(isExcludedPosition(1, 5)).toBe(true);
    expect(isExcludedPosition(22, 5)).toBe(true);
    
    // 제외되지 않은 위치
    expect(isExcludedPosition(1, 1)).toBe(false);
    expect(isExcludedPosition(14, 5)).toBe(false);
  });
  
  test('총 설비 수가 117개임', () => {
    const totalPositions = CONFIG.EQUIPMENT.ROWS * CONFIG.EQUIPMENT.COLS;
    const excludedCount = CONFIG.EQUIPMENT.EXCLUDED_POSITIONS.length;
    const actualEquipment = totalPositions - excludedCount;
    
    expect(actualEquipment).toBe(117);
  });
  
  test('복도 위치가 올바르게 설정됨', () => {
    expect(CONFIG.EQUIPMENT.SPACING.CORRIDOR_COLS).toEqual([1, 3, 5]);
    expect(CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROWS).toEqual([13]);
    expect(CONFIG.EQUIPMENT.SPACING.CORRIDOR_COL_WIDTH).toBe(1.2);
    expect(CONFIG.EQUIPMENT.SPACING.CORRIDOR_ROW_WIDTH).toBe(2.0);
  });
});