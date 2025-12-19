/**
 * CameraNavigator.js
 * 카메라 네비게이션 UI 및 컨트롤
 * 8방향(45도 간격) + 중앙 회전(90도) 기능
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';

export class CameraNavigator {
    constructor(camera, controls, targetPosition = new THREE.Vector3(0, 0, 0)) {
        this.camera = camera;
        this.controls = controls;
        this.targetPosition = targetPosition;  // 카메라가 바라볼 중심점
        
        // 카메라 설정
        this.cameraDistance = 80;  // 중심점으로부터의 거리
        this.cameraHeight = 30;    // 카메라 높이
        
        // 현재 방향 (0~7: 8방향, 각도 0~315도)
        this.currentDirection = 0;
        
        // 애니메이션 설정
        this.isAnimating = false;
        this.animationDuration = 1000;  // 1초
        
        // UI 엘리먼트
        this.navContainer = null;
        
        // 초기화
        this.createNavigationUI();
        this.attachEventListeners();
        
        debugLog('📐 CameraNavigator 초기화 완료');
    }
    
    /**
     * 네비게이션 UI 생성 (8방향 + 중앙)
     */
    createNavigationUI() {
        // 컨테이너
        this.navContainer = document.createElement('div');
        this.navContainer.id = 'camera-navigator';
        this.navContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 250px;
            width: 120px;
            height: 120px;
            z-index: 1000;
            user-select: none;
        `;
        
        // SVG로 네비게이션 버튼 생성
        this.navContainer.innerHTML = `
            <svg width="120" height="120" viewBox="0 0 120 120">
                <!-- 배경 원 -->
                <circle cx="60" cy="60" r="58" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                
                <!-- 8방향 버튼 -->
                <!-- 북(0°) -->
                <path d="M 60 10 L 70 30 L 50 30 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="0" cursor="pointer"/>
                
                <!-- 북동(45°) -->
                <path d="M 90 30 L 85 40 L 80 35 L 90 25 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="1" cursor="pointer"/>
                
                <!-- 동(90°) -->
                <path d="M 110 60 L 90 70 L 90 50 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="2" cursor="pointer"/>
                
                <!-- 남동(135°) -->
                <path d="M 90 90 L 80 85 L 85 80 L 95 90 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="3" cursor="pointer"/>
                
                <!-- 남(180°) -->
                <path d="M 60 110 L 50 90 L 70 90 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="4" cursor="pointer"/>
                
                <!-- 남서(225°) -->
                <path d="M 30 90 L 35 80 L 40 85 L 30 95 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="5" cursor="pointer"/>
                
                <!-- 서(270°) -->
                <path d="M 10 60 L 30 50 L 30 70 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="6" cursor="pointer"/>
                
                <!-- 북서(315°) -->
                <path d="M 30 30 L 40 35 L 35 40 L 25 30 Z" fill="rgba(100,150,255,0.8)" class="nav-btn" data-direction="7" cursor="pointer"/>
                
                <!-- 중앙 회전 버튼 -->
                <circle cx="60" cy="60" r="20" fill="rgba(255,150,100,0.9)" class="nav-center" cursor="pointer"/>
                <path d="M 55 60 L 60 55 L 60 50 L 65 55 L 60 60 L 60 65 Z" fill="white" pointer-events="none"/>
                <text x="60" y="75" text-anchor="middle" fill="white" font-size="10" pointer-events="none">90°</text>
            </svg>
        `;
        
        // 스타일 추가
        const style = document.createElement('style');
        style.textContent = `
            #camera-navigator .nav-btn:hover {
                fill: rgba(100,150,255,1) !important;
                filter: brightness(1.2);
            }
            #camera-navigator .nav-center:hover {
                fill: rgba(255,150,100,1) !important;
                filter: brightness(1.2);
            }
            #camera-navigator .nav-btn.active {
                fill: rgba(50,255,150,0.9) !important;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.navContainer);
        
        debugLog('🎨 네비게이션 UI 생성 완료');
    }
    
    /**
     * 이벤트 리스너 연결
     */
    attachEventListeners() {
        // 8방향 버튼
        const directionButtons = this.navContainer.querySelectorAll('.nav-btn');
        directionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const direction = parseInt(e.target.getAttribute('data-direction'));
                this.moveToDirection(direction);
            });
        });
        
        // 중앙 회전 버튼
        const centerButton = this.navContainer.querySelector('.nav-center');
        centerButton.addEventListener('click', () => {
            this.rotateClockwise90();
        });
        
        debugLog('🔗 이벤트 리스너 연결 완료');
    }
    
    /**
     * 특정 방향으로 카메라 이동 (0~7)
     */
    moveToDirection(direction) {
        if (this.isAnimating) return;
        
        direction = direction % 8;  // 0~7 범위로 제한
        this.currentDirection = direction;
        
        // 각도 계산 (45도 간격)
        const angle = direction * 45 * (Math.PI / 180);
        
        // 새 카메라 위치 계산
        const newX = this.targetPosition.x + Math.sin(angle) * this.cameraDistance;
        const newZ = this.targetPosition.z + Math.cos(angle) * this.cameraDistance;
        const newY = this.cameraHeight;
        
        const newPosition = new THREE.Vector3(newX, newY, newZ);
        
        // 애니메이션
        this.animateCameraTo(newPosition, this.targetPosition);
        
        // 활성 버튼 표시
        this.updateActiveButton(direction);
        
        debugLog(`📷 카메라 이동: 방향 ${direction} (${direction * 45}도)`);
    }
    
    /**
     * 시계방향 90도 회전
     */
    rotateClockwise90() {
        if (this.isAnimating) return;
        
        // 다음 방향 (90도 = 2칸)
        const newDirection = (this.currentDirection + 2) % 8;
        this.moveToDirection(newDirection);
        
        debugLog('🔄 시계방향 90도 회전');
    }
    
    /**
     * 카메라 애니메이션
     */
    animateCameraTo(targetPosition, lookAtPosition) {
        this.isAnimating = true;
        
        const startPosition = this.camera.position.clone();
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.animationDuration, 1);
            
            // Easing 함수 (ease-in-out)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // 위치 보간
            this.camera.position.lerpVectors(startPosition, targetPosition, eased);
            
            // 방향 설정
            this.camera.lookAt(lookAtPosition);
            
            // OrbitControls 업데이트
            if (this.controls && this.controls.target) {
                this.controls.target.copy(lookAtPosition);
                this.controls.update();
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                debugLog('✅ 카메라 애니메이션 완료');
            }
        };
        
        animate();
    }
    
    /**
     * 활성 버튼 업데이트
     */
    updateActiveButton(direction) {
        // 모든 버튼 비활성화
        const allButtons = this.navContainer.querySelectorAll('.nav-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        // 현재 방향 버튼 활성화
        const activeButton = this.navContainer.querySelector(`[data-direction="${direction}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }
    
    /**
     * 중심점 설정
     */
    setTargetPosition(position) {
        this.targetPosition.copy(position);
        debugLog('🎯 타겟 위치 설정:', position);
    }
    
    /**
     * 카메라 거리 설정
     */
    setCameraDistance(distance) {
        this.cameraDistance = distance;
        debugLog(`📏 카메라 거리 설정: ${distance}m`);
    }
    
    /**
     * 카메라 높이 설정
     */
    setCameraHeight(height) {
        this.cameraHeight = height;
        debugLog(`📐 카메라 높이 설정: ${height}m`);
    }
    
    /**
     * 네비게이터 표시/숨김
     */
    setVisible(visible) {
        this.navContainer.style.display = visible ? 'block' : 'none';
    }
    
    /**
     * 리소스 정리
     */
    dispose() {
        if (this.navContainer && this.navContainer.parentNode) {
            this.navContainer.parentNode.removeChild(this.navContainer);
        }
        debugLog('🗑️ CameraNavigator 정리 완료');
    }
}