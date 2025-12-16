"""
생산 시스템 시뮬레이터
- SimPy를 사용한 이벤트 기반 시뮬레이션
- 77대 설비의 생산, 고장, 유지보수 시뮬레이션
- 실시간 데이터 생성 및 전송
"""

import simpy
import numpy as np
import asyncio
import aioredis
from datetime import datetime
from typing import Dict, List
from dataclasses import dataclass
import json

@dataclass
class EquipmentConfig:
    """설비 설정"""
    id: str
    row: int
    col: int
    mtbf: float = 150.0  # hours
    mttr: float = 2.0    # hours
    cycle_time: float = 45.0  # seconds
    temperature_baseline: float = 70.0  # °C
    
class Equipment:
    """개별 설비 모델"""
    
    def __init__(self, env: simpy.Environment, config: EquipmentConfig):
        self.env = env
        self.config = config
        self.status = "running"
        self.production_count = 0
        self.runtime_hours = 0.0
        self.temperature = config.temperature_baseline
        self.current_batch = None
        
        # 프로세스 시작
        self.process = env.process(self.run())
        self.failure_process = env.process(self.failure_cycle())
        self.monitoring_process = env.process(self.monitor())
        
    def run(self):
        """생산 프로세스"""
        while True:
            if self.status == "running":
                # 생산 사이클 시작
                cycle_start = self.env.now
                
                # 실제 사이클 타임 (변동 ±10%)
                actual_cycle = np.random.normal(
                    self.config.cycle_time, 
                    self.config.cycle_time * 0.1
                )
                
                yield self.env.timeout(actual_cycle / 3600)  # 시간 단위로 변환
                
                # 생산 완료
                self.production_count += 1
                self.runtime_hours += actual_cycle / 3600
                
                # 온도 상승 (작업 중)
                self.temperature += np.random.uniform(0.5, 1.5)
                
                # 불량 확률 (2%)
                is_defect = np.random.random() < 0.02
                
                # 데이터 발행
                self.emit_production_data(is_defect, actual_cycle)
                
            else:
                # idle 또는 down 상태에서는 대기
                yield self.env.timeout(0.1)
                
    def failure_cycle(self):
        """고장 발생 프로세스"""
        while True:
            # MTBF 기반 고장 시간 계산 (지수 분포)
            time_to_failure = np.random.exponential(self.config.mtbf)
            yield self.env.timeout(time_to_failure)
            
            # 고장 발생
            if self.status == "running":
                print(f"[{self.env.now:.2f}h] {self.config.id} - FAILURE")
                self.status = "down"
                self.emit_alarm("EQUIPMENT_DOWN", "critical")
                
                # MTTR 기반 수리 시간
                repair_time = np.random.exponential(self.config.mttr)
                yield self.env.timeout(repair_time)
                
                # 수리 완료
                print(f"[{self.env.now:.2f}h] {self.config.id} - REPAIRED")
                self.status = "running"
                self.temperature = self.config.temperature_baseline
                self.emit_alarm("EQUIPMENT_RESTORED", "info")
                
    def monitor(self):
        """상태 모니터링 프로세스 (1초마다)"""
        while True:
            yield self.env.timeout(1/3600)  # 1초 = 1/3600 시간
            
            # 온도 자연 냉각
            if self.status != "running":
                self.temperature = max(
                    self.temperature - 0.1,
                    self.config.temperature_baseline
                )
            
            # 상태 데이터 발행
            self.emit_status_data()
            
            # 온도 알람 체크
            if self.temperature > 85:
                self.emit_alarm("TEMP_HIGH", "warning")
                
    def emit_status_data(self):
        """상태 데이터 발행"""
        data = {
            "type": "equipment_status",
            "timestamp": datetime.now().isoformat(),
            "equipment_id": self.config.id,
            "data": {
                "row": self.config.row,
                "col": self.config.col,
                "status": self.status,
                "temperature": round(self.temperature, 1),
                "runtime_hours": round(self.runtime_hours, 2),
                "production_count": self.production_count,
                "current_oee": self.calculate_oee()
            }
        }
        # Redis/WebSocket으로 전송 (비동기 큐에 추가)
        asyncio.create_task(publish_data(data))
        
    def emit_production_data(self, is_defect: bool, cycle_time: float):
        """생산 데이터 발행"""
        data = {
            "type": "production",
            "timestamp": datetime.now().isoformat(),
            "equipment_id": self.config.id,
            "data": {
                "quantity_produced": 1,
                "defect_count": 1 if is_defect else 0,
                "cycle_time": round(cycle_time, 1),
                "yield_rate": 0 if is_defect else 100
            }
        }
        asyncio.create_task(publish_data(data))
        
    def emit_alarm(self, code: str, severity: str):
        """알람 발행"""
        data = {
            "type": "alarm",
            "timestamp": datetime.now().isoformat(),
            "equipment_id": self.config.id,
            "data": {
                "code": code,
                "severity": severity,
                "message": f"{code} on {self.config.id}",
                "acknowledged": False
            }
        }
        asyncio.create_task(publish_data(data))
        
    def calculate_oee(self) -> float:
        """OEE 계산 (간단한 버전)"""
        if self.runtime_hours == 0:
            return 0.0
        availability = 1.0 if self.status == "running" else 0.0
        performance = 0.9  # 임시값
        quality = 0.98  # 임시값
        return round(availability * performance * quality * 100, 1)


class ProductionSimulator:
    """전체 생산 시스템 시뮬레이터"""
    
    def __init__(self, equipment_configs: List[EquipmentConfig]):
        self.env = simpy.Environment()
        self.equipment_list = []
        
        # 모든 설비 생성
        for config in equipment_configs:
            equipment = Equipment(self.env, config)
            self.equipment_list.append(equipment)
            
        print(f"시뮬레이터 초기화 완료: {len(self.equipment_list)}대 설비")
        
    def run(self, duration_hours: float = None):
        """시뮬레이션 실행"""
        if duration_hours:
            self.env.run(until=duration_hours)
        else:
            # 무한 실행 (실시간 모드)
            self.env.run()


# 데이터 발행 함수
redis_client = None

async def init_redis():
    """Redis 연결"""
    global redis_client
    redis_client = await aioredis.create_redis_pool('redis://localhost')
    
async def publish_data(data: dict):
    """데이터를 Redis Pub/Sub로 발행"""
    if redis_client:
        channel = f"simulator:{data['type']}"
        await redis_client.publish(channel, json.dumps(data))


# 메인 실행
def create_equipment_layout() -> List[EquipmentConfig]:
    """7x11 설비 배열 생성"""
    configs = []
    for row in range(1, 12):  # 1-11
        for col in range(1, 8):  # 1-7
            config = EquipmentConfig(
                id=f"EQ-{row:02d}-{col:02d}",
                row=row,
                col=col,
                mtbf=np.random.uniform(120, 180),  # 개별 차이
                mttr=np.random.uniform(1.5, 2.5),
                cycle_time=np.random.uniform(40, 50)
            )
            configs.append(config)
    return configs


if __name__ == "__main__":
    # 비동기 이벤트 루프 생성
    loop = asyncio.get_event_loop()
    loop.run_until_complete(init_redis())
    
    # 시뮬레이터 생성 및 실행
    equipment_configs = create_equipment_layout()
    simulator = ProductionSimulator(equipment_configs)
    
    print("시뮬레이션 시작...")
    simulator.run()  # 무한 실행