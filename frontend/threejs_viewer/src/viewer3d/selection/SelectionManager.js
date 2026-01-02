/**
 * SelectionManager.js
 * 선택 상태 관리
 * 
 * @version 1.1.0
 */

export class SelectionManager {
    constructor() {
        this.selectedObjects = [];
        this.lastSelected = null;
        this.onSelectionChangeCallbacks = [];
        this.visualizer = null;
    }
    
    setVisualizer(visualizer) {
        this.visualizer = visualizer;
    }
    
    _syncVisualizerSelection() {
        if (this.visualizer && typeof this.visualizer.syncSelectedObjects === 'function') {
            this.visualizer.syncSelectedObjects(this.selectedObjects);
        }
    }
    
    select(object, addToSelection = false) {
        if (!object) return false;
        if (this.isSelected(object)) return false;
        
        if (!addToSelection) {
            this.clearSelection();
        }
        
        this.selectedObjects.push(object);
        this.lastSelected = object;
        
        this._syncVisualizerSelection();
        
        if (this.visualizer) {
            this.visualizer.applySelectionStyle(object);
        }
        
        this._notifySelectionChange();
        return true;
    }
    
    deselect(object) {
        if (!object) return false;
        
        const index = this.selectedObjects.indexOf(object);
        if (index === -1) return false;
        
        this.selectedObjects.splice(index, 1);
        
        if (this.lastSelected === object) {
            this.lastSelected = this.selectedObjects.length > 0 
                ? this.selectedObjects[this.selectedObjects.length - 1] 
                : null;
        }
        
        this._syncVisualizerSelection();
        
        if (this.visualizer) {
            this.visualizer.removeSelectionStyle(object);
        }
        
        this._notifySelectionChange();
        return true;
    }
    
    toggle(object) {
        if (this.isSelected(object)) {
            this.deselect(object);
            return false;
        } else {
            this.select(object, true);
            return true;
        }
    }
    
    clearSelection() {
        if (this.selectedObjects.length === 0) return;
        
        if (this.visualizer) {
            this.selectedObjects.forEach(object => {
                this.visualizer.removeSelectionStyle(object);
            });
        }
        
        this.selectedObjects = [];
        this.lastSelected = null;
        
        this._syncVisualizerSelection();
        this._notifySelectionChange();
    }
    
    isSelected(object) {
        return this.selectedObjects.includes(object);
    }
    
    getSelected() { return [...this.selectedObjects]; }
    getSelectedData() { return this.selectedObjects.map(obj => obj.userData); }
    getSelectedCount() { return this.selectedObjects.length; }
    getLastSelected() { return this.lastSelected; }
    hasSelection() { return this.selectedObjects.length > 0; }
    
    onSelectionChange(callback) {
        if (typeof callback === 'function') {
            this.onSelectionChangeCallbacks.push(callback);
        }
    }
    
    offSelectionChange(callback) {
        const index = this.onSelectionChangeCallbacks.indexOf(callback);
        if (index > -1) this.onSelectionChangeCallbacks.splice(index, 1);
    }
    
    _notifySelectionChange() {
        this.onSelectionChangeCallbacks.forEach(callback => {
            try { callback(this.selectedObjects, this.lastSelected); }
            catch (error) { console.error('SelectionManager callback error:', error); }
        });
    }
    
    dispose() {
        this.clearSelection();
        this.onSelectionChangeCallbacks = [];
        this.visualizer = null;
    }
}