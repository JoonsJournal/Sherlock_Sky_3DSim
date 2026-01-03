/**
 * MemoryManager.js
 * Three.js 메모리 관리
 */

import { debugLog } from './Config.js';

export class MemoryManager {
    constructor() {
        this.disposedObjects = 0;
        this.disposedMaterials = 0;
        this.disposedGeometries = 0;
        this.disposedTextures = 0;
    }
    
    /**
     * 객체 정리
     * 
     * @param {THREE.Object3D} object - 정리할 객체
     */
    disposeObject(object) {
        if (!object) return;
        
        // Geometry 정리
        if (object.geometry) {
            object.geometry.dispose();
            this.disposedGeometries++;
        }
        
        // Material 정리
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    this.disposeMaterial(material);
                });
            } else {
                this.disposeMaterial(object.material);
            }
        }
        
        // 텍스처 정리
        if (object.texture) {
            object.texture.dispose();
            this.disposedTextures++;
        }
        
        this.disposedObjects++;
    }
    
    /**
     * Material 정리
     */
    disposeMaterial(material) {
        if (!material) return;
        
        // 텍스처 정리
        Object.keys(material).forEach(key => {
            const value = material[key];
            if (value && typeof value.dispose === 'function') {
                value.dispose();
                this.disposedTextures++;
            }
        });
        
        material.dispose();
        this.disposedMaterials++;
    }
    
    /**
     * 씬 전체 정리
     * 
     * @param {THREE.Scene} scene - 씬 객체
     */
    disposeScene(scene) {
        debugLog('씬 메모리 정리 시작...');
        
        const startTime = performance.now();
        
        scene.traverse(object => {
            this.disposeObject(object);
        });
        
        const elapsed = performance.now() - startTime;
        
        debugLog(`✓ 씬 정리 완료 (${elapsed.toFixed(2)}ms)`);
        debugLog(`  객체: ${this.disposedObjects}개`);
        debugLog(`  Material: ${this.disposedMaterials}개`);
        debugLog(`  Geometry: ${this.disposedGeometries}개`);
        debugLog(`  Texture: ${this.disposedTextures}개`);
    }
    
    /**
     * 메모리 사용량 조회
     * 
     * @param {THREE.WebGLRenderer} renderer - 렌더러
     * @returns {Object} 메모리 정보
     */
    getMemoryInfo(renderer) {
        const info = renderer.info;
        
        return {
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs.length,
            render: {
                calls: info.render.calls,
                triangles: info.render.triangles,
                points: info.render.points,
                lines: info.render.lines
            }
        };
    }
    
    /**
     * 메모리 정보 로그
     */
    logMemoryInfo(renderer) {
        const info = this.getMemoryInfo(renderer);
        
        console.group('🧠 메모리 사용량');
        console.log('Geometries:', info.geometries);
        console.log('Textures:', info.textures);
        console.log('Programs:', info.programs);
        console.log('Draw Calls:', info.render.calls);
        console.log('Triangles:', info.render.triangles);
        console.groupEnd();
    }
    
    /**
     * 통계 초기화
     */
    resetStats() {
        this.disposedObjects = 0;
        this.disposedMaterials = 0;
        this.disposedGeometries = 0;
        this.disposedTextures = 0;
    }
}

// 싱글톤 인스턴스
export const memoryManager = new MemoryManager();