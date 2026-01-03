/**
 * commands/index.js
 * ===================
 * 
 * Commands 모듈 export 정리
 * 
 * @version 1.0.0 - Phase 1.5
 * 
 * 위치: frontend/threejs_viewer/src/layout_editor/commands/index.js
 */

// ES Module exports
export { CommandManager } from './CommandManager.js';
export {
    Command,
    MoveCommand,
    ResizeCommand,
    RotateCommand,
    CreateCommand,
    DeleteCommand,
    PropertyChangeCommand,
    MultiPropertyChangeCommand,
    GroupCommand,
    ZIndexCommand
} from './Command.js';

// 브라우저 환경에서 window 객체에 등록
if (typeof window !== 'undefined') {
    window.CommandModules = {
        CommandManager: window.CommandManager,
        Command: window.Command,
        MoveCommand: window.MoveCommand,
        ResizeCommand: window.ResizeCommand,
        RotateCommand: window.RotateCommand,
        CreateCommand: window.CreateCommand,
        DeleteCommand: window.DeleteCommand,
        PropertyChangeCommand: window.PropertyChangeCommand,
        MultiPropertyChangeCommand: window.MultiPropertyChangeCommand,
        GroupCommand: window.GroupCommand,
        ZIndexCommand: window.ZIndexCommand
    };
    
    console.log('[commands/index.js] Commands 모듈 export 완료');
}