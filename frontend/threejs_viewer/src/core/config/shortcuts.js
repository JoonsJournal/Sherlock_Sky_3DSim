/**
 * shortcuts.js
 * 키보드 단축키 정의
 * 
 * @version 1.0.0
 * @description 컨텍스트별 단축키 매핑
 */

import { KEYBOARD_CONTEXT } from './constants.js';

// =====================================================
// 전역 단축키 (CONTEXT_GLOBAL)
// =====================================================

export const SHORTCUTS_GLOBAL = Object.freeze({
    // 파일 작업
    'ctrl+n': { action: 'file:new', description: '새로 만들기' },
    'ctrl+o': { action: 'file:open', description: '열기' },
    'ctrl+s': { action: 'file:save', description: '저장' },
    'ctrl+shift+s': { action: 'file:saveAs', description: '다른 이름으로 저장' },
    
    // 모달/UI
    'ctrl+k': { action: 'modal:connection', description: 'Connection Modal 토글' },
    'escape': { action: 'ui:cancel', description: '취소/모달 닫기' },
    'f1': { action: 'ui:help', description: '도움말' },
    'f11': { action: 'ui:fullscreen', description: '전체 화면' }
});

// =====================================================
// 3D Viewer 단축키 (CONTEXT_VIEWER_3D)
// =====================================================

export const SHORTCUTS_VIEWER_3D = Object.freeze({
    // 뷰 프리셋
    'ctrl+1': { action: 'view:front', description: '정면 뷰' },
    'ctrl+2': { action: 'view:top', description: '상단 뷰' },
    'ctrl+3': { action: 'view:right', description: '우측 뷰' },
    'ctrl+4': { action: 'view:isometric', description: '등각 뷰' },
    'ctrl+5': { action: 'view:back', description: '후면 뷰' },
    'ctrl+6': { action: 'view:bottom', description: '하단 뷰' },
    'ctrl+7': { action: 'view:left', description: '좌측 뷰' },
    
    // 카메라
    'f': { action: 'camera:fitAll', description: '전체 보기' },
    'home': { action: 'camera:reset', description: '카메라 리셋' },
    
    // 표시 토글
    'h': { action: 'toggle:helpers', description: '헬퍼 표시 토글' },
    'g': { action: 'toggle:grid', description: '그리드 표시 토글' },
    'd': { action: 'toggle:debug', description: '디버그 패널 토글' },
    
    // 모드 전환
    'tab': { action: 'mode:toggle', description: '모드 전환 (Viewer ↔ Monitoring)' }
});

// =====================================================
// 2D Editor 단축키 (CONTEXT_EDITOR_2D)
// =====================================================

export const SHORTCUTS_EDITOR_2D = Object.freeze({
    // 편집
    'ctrl+z': { action: 'edit:undo', description: '실행 취소' },
    'ctrl+y': { action: 'edit:redo', description: '다시 실행' },
    'ctrl+shift+z': { action: 'edit:redo', description: '다시 실행 (대체)' },
    
    // 선택
    'ctrl+a': { action: 'select:all', description: '전체 선택' },
    'escape': { action: 'select:clear', description: '선택 해제' },
    
    // 객체 조작
    'ctrl+d': { action: 'object:duplicate', description: '복제' },
    'ctrl+g': { action: 'object:group', description: '그룹화' },
    'ctrl+shift+g': { action: 'object:ungroup', description: '그룹 해제' },
    'delete': { action: 'object:delete', description: '선택 삭제' },
    'backspace': { action: 'object:delete', description: '선택 삭제 (대체)' },
    
    // 도구 선택
    'v': { action: 'tool:select', description: 'Selection Tool' },
    'w': { action: 'tool:wall', description: 'Wall Draw Tool' },
    'a': { action: 'tool:array', description: 'Equipment Array Tool' },
    'l': { action: 'tool:align', description: 'Alignment Tool' },
    
    // 변환
    'r': { action: 'transform:rotate90', description: '90° 회전' },
    'shift+r': { action: 'transform:rotate-90', description: '-90° 회전' },
    
    // 이동 (Arrow Keys)
    'arrowup': { action: 'move:up', description: '위로 이동 (1px)', param: 1 },
    'arrowdown': { action: 'move:down', description: '아래로 이동 (1px)', param: 1 },
    'arrowleft': { action: 'move:left', description: '왼쪽으로 이동 (1px)', param: 1 },
    'arrowright': { action: 'move:right', description: '오른쪽으로 이동 (1px)', param: 1 },
    'shift+arrowup': { action: 'move:up', description: '위로 이동 (10px)', param: 10 },
    'shift+arrowdown': { action: 'move:down', description: '아래로 이동 (10px)', param: 10 },
    'shift+arrowleft': { action: 'move:left', description: '왼쪽으로 이동 (10px)', param: 10 },
    'shift+arrowright': { action: 'move:right', description: '오른쪽으로 이동 (10px)', param: 10 },
    
    // 레이어
    '[': { action: 'layer:back', description: '레이어 뒤로' },
    ']': { action: 'layer:front', description: '레이어 앞으로' },
    
    // 줌
    'ctrl+=': { action: 'zoom:in', description: '확대' },
    'ctrl+-': { action: 'zoom:out', description: '축소' },
    'ctrl+0': { action: 'zoom:fit', description: '화면에 맞추기' }
});

// =====================================================
// MICE 스냅 키 (2D Editor에서 Hold 방식)
// =====================================================

export const MICE_SNAP_KEYS = Object.freeze({
    'm': { type: 'midpoint', description: '중점 스냅', icon: '◇', color: '#00FFFF' },
    'i': { type: 'intersection', description: '교차점 스냅', icon: '✕', color: '#FFFF00' },
    'c': { type: 'center', description: '중심 스냅', icon: '○', color: '#FF00FF' },
    'e': { type: 'endpoint', description: '끝점 스냅', icon: '■', color: '#00FF00' }
});

// =====================================================
// 마우스 조작 정의
// =====================================================

export const MOUSE_ACTIONS = Object.freeze({
    // 3D Viewer
    VIEWER_3D: {
        'click': { action: 'select:single', description: '단일 선택' },
        'dblclick': { action: 'camera:focus', description: '카메라 포커스' },
        'ctrl+click': { action: 'select:multi', description: '다중 선택' },
        'middle+drag': { action: 'camera:orbit', description: '카메라 회전' },
        'shift+middle+drag': { action: 'camera:pan', description: '카메라 팬' },
        'wheel': { action: 'camera:zoom', description: '줌 인/아웃' }
    },
    
    // 2D Editor
    EDITOR_2D: {
        'click': { action: 'select:single', description: '단일 선택' },
        'ctrl+click': { action: 'select:toggle', description: '선택 추가/제거' },
        'shift+click': { action: 'select:range', description: '범위 선택' },
        'dblclick': { action: 'object:edit', description: '편집 모드' },
        'drag': { action: 'object:move', description: '객체 이동' },
        'shift+drag': { action: 'select:box', description: '박스 선택' },
        'drag:left-to-right': { action: 'select:window', description: 'Window 선택' },
        'drag:right-to-left': { action: 'select:crossing', description: 'Crossing 선택' }
    }
});

// =====================================================
// 컨텍스트별 단축키 맵 통합
// =====================================================

export const SHORTCUTS_MAP = Object.freeze({
    [KEYBOARD_CONTEXT.GLOBAL]: SHORTCUTS_GLOBAL,
    [KEYBOARD_CONTEXT.VIEWER_3D]: SHORTCUTS_VIEWER_3D,
    [KEYBOARD_CONTEXT.EDITOR_2D]: SHORTCUTS_EDITOR_2D
});

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 키 이벤트를 단축키 문자열로 변환
 * @param {KeyboardEvent} event - 키보드 이벤트
 * @returns {string} 단축키 문자열 (예: 'ctrl+s')
 */
export function eventToShortcut(event) {
    const parts = [];
    
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    
    // 특수 키 처리
    const key = event.key.toLowerCase();
    if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
        parts.push(key);
    }
    
    return parts.join('+');
}

/**
 * 특정 컨텍스트의 단축키 찾기
 * @param {string} context - 컨텍스트 (KEYBOARD_CONTEXT)
 * @param {string} shortcut - 단축키 문자열
 * @returns {Object|null} 단축키 정보
 */
export function findShortcut(context, shortcut) {
    const contextMap = SHORTCUTS_MAP[context];
    if (!contextMap) return null;
    return contextMap[shortcut] || null;
}

/**
 * 모든 단축키 목록 가져오기 (도움말용)
 * @param {string} context - 컨텍스트 (선택적)
 * @returns {Array} 단축키 목록
 */
export function getAllShortcuts(context = null) {
    const result = [];
    
    const contexts = context 
        ? { [context]: SHORTCUTS_MAP[context] }
        : SHORTCUTS_MAP;
    
    Object.entries(contexts).forEach(([ctx, shortcuts]) => {
        Object.entries(shortcuts).forEach(([key, info]) => {
            result.push({
                context: ctx,
                shortcut: key,
                ...info
            });
        });
    });
    
    return result;
}