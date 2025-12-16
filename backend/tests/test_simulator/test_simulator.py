"""
시뮬레이터 테스트
"""

import pytest
from unittest.mock import patch, MagicMock
import simpy


@pytest.mark.unit
class TestEquipmentConfig:
    """설비 설정 테스트"""
    
    def test_equipment_config_creation(self):
        """설비 설정 생성"""
        from simulator.main import EquipmentConfig
        
        config = EquipmentConfig(
            id="EQ-01-01",
            row=1,
            col=1,
            mtbf=150.0,
            mttr=2.0,
            cycle_time=45.0
        )
        
        assert config.id == "EQ-01-01"
        assert config.row == 1
        assert config.col == 1
        assert config.mtbf == 150.0


@pytest.mark.unit
class TestEquipment:
    """설비 클래스 테스트"""
    
    def test_equipment_initialization(self, simpy_env, equipment_config):
        """설비 초기화"""
        from simulator.main import Equipment
        
        equipment = Equipment(simpy_env, equipment_config)
        
        assert equipment.config.id == "EQ-01-01"
        assert equipment.status == "running"
        assert equipment.production_count == 0
    
    def test_equipment_calculate_oee(self, simpy_env, equipment_config):
        """OEE 계산"""
        from simulator.main import Equipment
        
        equipment = Equipment(simpy_env, equipment_config)
        
        # 초기 OEE는 0
        oee = equipment.calculate_oee()
        assert oee == 0.0
        
        # 가동 시간 설정 후
        equipment.runtime_hours = 10.0
        oee = equipment.calculate_oee()
        assert 0 <= oee <= 100


@pytest.mark.unit
class TestEquipmentLayout:
    """설비 배열 테스트"""
    
    def test_get_excluded_positions(self):
        """제외 위치 생성"""
        from simulator.main import get_excluded_positions
        
        excluded = get_excluded_positions()
        
        assert len(excluded) == 39
        assert (4, 4) in excluded  # col:4, row 4
        assert (13, 4) in excluded  # col:4, row 13
    
    def test_create_equipment_layout(self):
        """설비 배열 생성"""
        from simulator.main import create_equipment_layout
        
        configs = create_equipment_layout()
        
        # 117대 설비 생성 확인
        assert len(configs) == 117
        
        # 첫 번째 설비 확인
        assert configs[0].id == "EQ-01-01"
        assert configs[0].row == 1
        assert configs[0].col == 1
        
        # 제외 위치 확인
        excluded_ids = [c.id for c in configs]
        assert "EQ-04-04" not in excluded_ids  # 제외 위치
        assert "EQ-01-05" not in excluded_ids  # 제외 위치


@pytest.mark.unit
class TestProductionSimulator:
    """생산 시뮬레이터 테스트"""
    
    def test_simulator_initialization(self):
        """시뮬레이터 초기화"""
        from simulator.main import ProductionSimulator, create_equipment_layout
        
        configs = create_equipment_layout()
        simulator = ProductionSimulator(configs)
        
        assert len(simulator.equipment_list) == 117
    
    @pytest.mark.slow
    def test_simulator_run_duration(self):
        """시뮬레이터 실행 (제한 시간)"""
        from simulator.main import ProductionSimulator, EquipmentConfig
        
        # 테스트용 단일 설비
        config = EquipmentConfig(
            id="EQ-TEST-01",
            row=1,
            col=1,
            mtbf=100.0,
            mttr=1.0,
            cycle_time=10.0
        )
        
        simulator = ProductionSimulator([config])
        
        # 1시간 시뮬레이션
        simulator.run(duration_hours=1.0)
        
        # 생산이 일어났는지 확인
        equipment = simulator.equipment_list[0]
        assert equipment.production_count > 0