/**
 * CameraNavigator.js
 * 카메라 네비게이션 UI 및 컨트롤
 * 8방향(45도 간격) + Top/Isometric View 전환
 * Top View: 0°, 90°, 180°, 270°만 활성화 및 회전 가능
 */

import * as THREE from 'three';
import { debugLog } from '../utils/Config.js';

export class CameraNavigator {
    constructor(camera, controls, targetPosition = new THREE.Vector3(0, 0, 0)) {
        this.camera = camera;
        this.controls = controls;
        this.targetPosition = targetPosition;  // 카메라가 바라볼 중심점
        
        // 카메라 설정
        this.cameraDistance = 30;  // Isometric View 거리
        this.cameraHeight = 30;    // Isometric View 높이
        this.topViewHeight = 40;  // Top View 높이
        this.topViewOffset = 0.5;  // Top View 회전을 위한 오프셋
        
        // View 모드 ('top' 또는  'isometric')
        this.viewMode = 'isometric';  // 기본값: Isometric View
        
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
        
        debugLog('📐 CameraNavigator 초기화 완료 (Top/Isometric View 지원)');
    }
    
    /**
     * 네비게이션 UI 생성 (8방향 + 중앙 View 토글)
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
                <!-- 북(0°) - 주요 방향 -->
                <path d="M 60 10 L 70 30 L 50 30 Z" fill="rgba(100,150,255,0.8)" class="nav-btn cardinal" data-direction="0" cursor="pointer"/>
                
                <!-- 북동(45°) - 대각선 -->
                <path d="M 90 30 L 85 40 L 80 35 L 90 25 Z" fill="rgba(100,150,255,0.8)" class="nav-btn diagonal" data-direction="1" cursor="pointer"/>
                
                <!-- 동(90°) - 주요 방향 -->
                <path d="M 110 60 L 90 70 L 90 50 Z" fill="rgba(100,150,255,0.8)" class="nav-btn cardinal" data-direction="2" cursor="pointer"/>
                
                <!-- 남동(135°) - 대각선 -->
                <path d="M 90 90 L 80 85 L 85 80 L 95 90 Z" fill="rgba(100,150,255,0.8)" class="nav-btn diagonal" data-direction="3" cursor="pointer"/>
                
                <!-- 남(180°) - 주요 방향 -->
                <path d="M 60 110 L 50 90 L 70 90 Z" fill="rgba(100,150,255,0.8)" class="nav-btn cardinal" data-direction="4" cursor="pointer"/>
                
                <!-- 남서(225°) - 대각선 -->
                <path d="M 30 90 L 35 80 L 40 85 L 30 95 Z" fill="rgba(100,150,255,0.8)" class="nav-btn diagonal" data-direction="5" cursor="pointer"/>
                
                <!-- 서(270°) - 주요 방향 -->
                <path d="M 10 60 L 30 50 L 30 70 Z" fill="rgba(100,150,255,0.8)" class="nav-btn cardinal" data-direction="6" cursor="pointer"/>
                
                <!-- 북서(315°) - 대각선 -->
                <path d="M 30 30 L 40 35 L 35 40 L 25 30 Z" fill="rgba(100,150,255,0.8)" class="nav-btn diagonal" data-direction="7" cursor="pointer"/>
                
                <!-- 중앙 View 토글 버튼 -->
                <circle cx="60" cy="60" r="20" fill="rgba(255,150,100,0.9)" class="nav-center" cursor="pointer"/>
                <text x="60" y="65" text-anchor="middle" fill="white" font-size="11" font-weight="bold" pointer-events="none" class="view-mode-text">ISO</text>
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
            #camera-navigator .view-mode-text {
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            
            /* 비활성화된 버튼 스타일 */
            #camera-navigator .nav-btn.disabled {
                opacity: 0 !important;
                pointer-events: none !important;
                cursor: default !important;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.navContainer);
        
        debugLog('🎨 네비게이션 UI 생성 완료 (View 토글 버튼 포함)');
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
        
        // 중앙 View 토글 버튼
        const centerButton = this.navContainer.querySelector('.nav-center');
        centerButton.addEventListener('click', () => {
            this.toggleViewMode();
        });
        
        debugLog('🔗 이벤트 리스너 연결 완료');
    }
    
    /**
     * View 모드 토글 (Top ↔ Isometric)
     */
    toggleViewMode() {
        if (this.isAnimating) return;
        
        // 모드 전환
        this.viewMode = this.viewMode === 'isometric' ? 'top' : 'isometric';
        
        // UI 텍스트 업데이트
        const textElement = this.navContainer.querySelector('.view-mode-text');
        textElement.textContent = this.viewMode === 'top' ? 'TOP' : 'ISO';
        
        // 버튼 가시성 업데이트
        this.updateButtonVisibility();
        
        // Top View로 전환 시, 가장 가까운 주요 방향(0, 2, 4, 6)으로 스냅
        if (this.viewMode === 'top') {
            const cardinalDirections = [0, 2, 4, 6];
            const closestDirection = cardinalDirections.reduce((prev, curr) => {
                const prevDiff = Math.min(
                    Math.abs(prev - this.currentDirection),
                    8 - Math.abs(prev - this.currentDirection)
                );
                const currDiff = Math.min(
                    Math.abs(curr - this.currentDirection),
                    8 - Math.abs(curr - this.currentDirection)
                );
                return currDiff < prevDiff ? curr : prev;
            });
            this.currentDirection = closestDirection;
        }
        
        // 현재 방향 유지하면서 View 모드만 변경
        this.moveToDirection(this.currentDirection);
        
        debugLog(`🔄 View 모드 전환: ${this.viewMode.toUpperCase()}`);
    }
    
    /**
     * 버튼 가시성 업데이트 (View 모드에 따라)
     */
    updateButtonVisibility() {
        const diagonalButtons = this.navContainer.querySelectorAll('.nav-btn.diagonal');
        
        if (this.viewMode === 'top') {
            // Top View: 대각선 버튼(1, 3, 5, 7) 숨김
            diagonalButtons.forEach(btn => {
                btn.classList.add('disabled');
            });
            debugLog('🔒 대각선 버튼 비활성화 (Top View)');
        } else {
            // Isometric View: 모든 버튼 표시
            diagonalButtons.forEach(btn => {
                btn.classList.remove('disabled');
            });
            debugLog('🔓 모든 버튼 활성화 (Isometric View)');
        }
    }
    
    /**
     * 특정 방향으로 카메라 이동 (0~7)
     */
    moveToDirection(direction) {
        if (this.isAnimating) return;
        
        direction = direction % 8;  // 0~7 범위로 제한
        
        // Top View에서는 주요 방향(0, 2, 4, 6)만 허용
        if (this.viewMode === 'top') {
            const cardinalDirections = [0, 2, 4, 6];
            if (!cardinalDirections.includes(direction)) {
                debugLog(`⚠️ Top View에서는 방향 ${direction}을 사용할 수 없습니다`);
                return;
            }
        }
        
        this.currentDirection = direction;
        
        // 각도 계산 (45도 간격)
        const angle = direction * 45 * (Math.PI / 180);
        
        let newPosition;
        
        if (this.viewMode === 'top') {
            // Top View: 위에서 내려다보되, 약간 오프셋을 주어 방향성 부여
            // 완전히 수직이면 OrbitControls가 방향을 구분 못하므로 작은 오프셋 추가
            newPosition = new THREE.Vector3(
                this.targetPosition.x + Math.sin(angle) * this.topViewOffset,
                this.topViewHeight,
                this.targetPosition.z + Math.cos(angle) * this.topViewOffset
            );
            
            debugLog(`📷 Top View 회전: ${direction * 45}도 방향`);
        } else {
            // Isometric View: 경사진 각도에서 회전
            const newX = this.targetPosition.x + Math.sin(angle) * this.cameraDistance;
            const newZ = this.targetPosition.z + Math.cos(angle) * this.cameraDistance;
            const newY = this.cameraHeight;
            
            newPosition = new THREE.Vector3(newX, newY, newZ);
        }
        
        // 애니메이션
        this.animateCameraTo(newPosition, this.targetPosition);
        
        // 활성 버튼 표시
        this.updateActiveButton(direction);
        
        debugLog(`📷 카메라 이동: 방향 ${direction} (${direction * 45}도), 모드: ${this.viewMode.toUpperCase()}`);
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
     * 카메라 거리 설정 (Isometric View용)
     */
    setCameraDistance(distance) {
        this.cameraDistance = distance;
        debugLog(`📏 카메라 거리 설정: ${distance}m`);
    }
    
    /**
     * 카메라 높이 설정 (Isometric View용)
     */
    setCameraHeight(height) {
        this.cameraHeight = height;
        debugLog(`📐 카메라 높이 설정 (Isometric): ${height}m`);
    }
    
    /**
     * Top View 높이 설정
     */
    setTopViewHeight(height) {
        this.topViewHeight = height;
        debugLog(`📐 카메라 높이 설정 (Top View): ${height}m`);
    }
    
    /**
     * Top View 오프셋 설정 (회전을 위한)
     */
    setTopViewOffset(offset) {
        this.topViewOffset = offset;
        debugLog(`🔧 Top View 오프셋 설정: ${offset}`);
    }
    
    /**
     * 현재 View 모드 반환
     */
    getViewMode() {
        return this.viewMode;
    }
    
    /**
     * View 모드 강제 설정
     */
    setViewMode(mode) {
        if (mode !== 'top' && mode !== 'isometric') {
            console.error('❌ 잘못된 View 모드:', mode);
            return;
        }
        
        this.viewMode = mode;
        const textElement = this.navContainer.querySelector('.view-mode-text');
        textElement.textContent = this.viewMode === 'top' ? 'TOP' : 'ISO';
        
        // 버튼 가시성 업데이트
        this.updateButtonVisibility();
        
        // Top View로 전환 시 가장 가까운 주요 방향으로 스냅
        if (this.viewMode === 'top') {
            const cardinalDirections = [0, 2, 4, 6];
            const closestDirection = cardinalDirections.reduce((prev, curr) => {
                const prevDiff = Math.min(
                    Math.abs(prev - this.currentDirection),
                    8 - Math.abs(prev - this.currentDirection)
                );
                const currDiff = Math.min(
                    Math.abs(curr - this.currentDirection),
                    8 - Math.abs(curr - this.currentDirection)
                );
                return currDiff < prevDiff ? curr : prev;
            });
            this.currentDirection = closestDirection;
        }
        
        this.moveToDirection(this.currentDirection);
        debugLog(`🎯 View 모드 설정: ${this.viewMode.toUpperCase()}`);
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