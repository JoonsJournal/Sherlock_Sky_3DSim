/**
 * 🔍 Monitoring Mode 실제 앱 진단 스크립트
 * ==========================================
 * 
 * 사용법:
 * 1. index.html 로드 (http://127.0.0.1:8080/)
 * 2. Dev Mode ON
 * 3. Monitoring 버튼 클릭 (3D View 선택)
 * 4. 브라우저 콘솔(F12)에서 이 스크립트 전체를 붙여넣기
 * 
 * 또는:
 * 1. 이 파일을 tests/diagnose_monitoring.js로 저장
 * 2. 브라우저 콘솔에서: fetch('/tests/diagnose_monitoring.js').then(r=>r.text()).then(eval)
 */

(function diagnoseMonitoringMode() {
    console.clear();
    console.log('='.repeat(60));
    console.log('🔍 Monitoring Mode 실시간 진단 시작');
    console.log('='.repeat(60));
    
    const results = {
        errors: [],
        warnings: [],
        success: []
    };
    
    // 1. AppModeManager 체크
    console.log('\n📍 [1/6] AppModeManager 체크');
    const appModeManager = window.appModeManager;
    if (appModeManager) {
        const currentMode = appModeManager.getCurrentMode();
        console.log(`   현재 모드: ${currentMode}`);
        
        if (currentMode === 'monitoring') {
            results.success.push('현재 Monitoring 모드 활성화됨');
            console.log('   ✅ Monitoring 모드 활성화됨');
        } else {
            results.warnings.push(`현재 모드가 monitoring이 아님: ${currentMode}`);
            console.warn(`   ⚠️ 현재 모드: ${currentMode} (monitoring이 아님)`);
        }
    } else {
        results.errors.push('AppModeManager를 찾을 수 없음');
        console.error('   ❌ AppModeManager를 찾을 수 없습니다!');
    }
    
    // 2. MonitoringService 체크
    console.log('\n📍 [2/6] MonitoringService 체크');
    const monitoringService = window.monitoringService || window.services?.monitoring?.monitoringService;
    if (monitoringService) {
        console.log(`   MonitoringService 존재: ✅`);
        console.log(`   isActive: ${monitoringService.isActive}`);
        
        if (monitoringService.isActive) {
            results.success.push('MonitoringService가 활성화됨');
            console.log('   ✅ MonitoringService 활성화됨!');
        } else {
            results.errors.push('MonitoringService가 비활성화 상태');
            console.error('   ❌ MonitoringService가 비활성화 상태입니다!');
        }
    } else {
        results.errors.push('MonitoringService를 찾을 수 없음');
        console.error('   ❌ MonitoringService를 찾을 수 없습니다!');
    }
    
    // 3. SignalTowerManager 체크
    console.log('\n📍 [3/6] SignalTowerManager 체크');
    const signalTowerManager = window.signalTowerManager || window.services?.monitoring?.signalTowerManager;
    if (signalTowerManager) {
        console.log(`   SignalTowerManager 존재: ✅`);
        
        // Signal Tower 개수 확인
        const towerCount = signalTowerManager.signalTowers?.size || 0;
        console.log(`   등록된 Signal Tower: ${towerCount}개`);
        
        if (towerCount > 0) {
            results.success.push(`${towerCount}개 Signal Tower 등록됨`);
        } else {
            results.warnings.push('등록된 Signal Tower가 없음');
            console.warn('   ⚠️ 등록된 Signal Tower가 없습니다');
        }
    } else {
        results.errors.push('SignalTowerManager를 찾을 수 없음');
        console.error('   ❌ SignalTowerManager를 찾을 수 없습니다!');
    }
    
    // 4. ModeHandler 서비스 연결 체크
    console.log('\n📍 [4/6] ModeHandler 서비스 연결 체크');
    if (appModeManager?._modeHandlers) {
        const monitoringHandler = appModeManager._modeHandlers.get('monitoring');
        if (monitoringHandler) {
            console.log('   Monitoring Handler 존재: ✅');
            console.log(`   _monitoringService: ${monitoringHandler._monitoringService ? 'SET ✅' : 'NULL ❌'}`);
            console.log(`   _signalTowerManager: ${monitoringHandler._signalTowerManager ? 'SET ✅' : 'NULL ❌'}`);
            
            if (monitoringHandler._monitoringService) {
                results.success.push('ModeHandler에 MonitoringService 연결됨');
            } else {
                results.errors.push('ModeHandler에 MonitoringService 연결 안 됨');
            }
            
            if (monitoringHandler._signalTowerManager) {
                results.success.push('ModeHandler에 SignalTowerManager 연결됨');
            } else {
                results.warnings.push('ModeHandler에 SignalTowerManager 연결 안 됨');
            }
        } else {
            results.errors.push('Monitoring ModeHandler를 찾을 수 없음');
            console.error('   ❌ Monitoring Handler를 찾을 수 없습니다!');
        }
    }
    
    // 5. viewManager 상태 체크
    console.log('\n📍 [5/6] viewManager 상태 체크');
    const viewManager = window.viewManager;
    if (viewManager) {
        console.log(`   threejsInitialized: ${viewManager.threejsInitialized}`);
        console.log(`   animationRunning: ${viewManager.animationRunning}`);
        
        if (viewManager.threejsInitialized) {
            results.success.push('Three.js 초기화 완료됨');
        } else {
            results.warnings.push('Three.js가 아직 초기화되지 않음');
        }
    } else {
        results.errors.push('viewManager를 찾을 수 없음');
    }
    
    // 6. services 객체 체크
    console.log('\n📍 [6/6] services 객체 체크');
    const services = window.services;
    if (services) {
        console.log(`   services.scene: ${services.scene ? 'SET ✅' : 'NULL'}`);
        console.log(`   services.ui: ${services.ui ? 'SET ✅' : 'NULL'}`);
        console.log(`   services.monitoring: ${services.monitoring ? 'SET ✅' : 'NULL'}`);
        
        if (services.monitoring?.monitoringService) {
            console.log(`   services.monitoring.monitoringService.isActive: ${services.monitoring.monitoringService.isActive}`);
        }
    } else {
        results.warnings.push('window.services가 없음');
    }
    
    // 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📋 진단 결과 요약');
    console.log('='.repeat(60));
    
    if (results.errors.length === 0) {
        console.log('\n✅ 모든 진단 통과!');
        console.log('   SignalTower Lamp가 정상적으로 켜져야 합니다.');
    } else {
        console.log('\n❌ 오류 발견:');
        results.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    if (results.warnings.length > 0) {
        console.log('\n⚠️ 경고:');
        results.warnings.forEach(warn => console.log(`   - ${warn}`));
    }
    
    if (results.success.length > 0) {
        console.log('\n✅ 성공 항목:');
        results.success.forEach(s => console.log(`   - ${s}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    // 수동 테스트 가이드
    if (results.errors.length > 0) {
        console.log('\n💡 수동 수정 시도:');
        
        if (results.errors.includes('MonitoringService가 비활성화 상태')) {
            console.log('\n🔧 MonitoringService 수동 시작:');
            console.log('   window.services.monitoring.monitoringService.start()');
        }
        
        if (results.errors.includes('ModeHandler에 MonitoringService 연결 안 됨')) {
            console.log('\n🔧 ModeHandler에 서비스 수동 연결:');
            console.log(`   const handler = window.appModeManager._modeHandlers.get('monitoring');`);
            console.log('   handler._monitoringService = window.services.monitoring.monitoringService;');
            console.log('   handler._signalTowerManager = window.services.monitoring.signalTowerManager;');
        }
    }
    
    return results;
})();