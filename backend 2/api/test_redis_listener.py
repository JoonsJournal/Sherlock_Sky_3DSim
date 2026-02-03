import redis
import json

def listen_to_redis():
    """Redis 메시지 수신 테스트"""
    r = redis.Redis(host='localhost', port=6379)
    pubsub = r.pubsub()
    pubsub.subscribe('equipment_data')
    
    print("Redis 리스너 시작... (Ctrl+C로 종료)")
    
    for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            print(f"수신: {data}")

if __name__ == "__main__":
    listen_to_redis()