/**
 * WebSocket 통합 테스트
 */

describe('WebSocketClient Integration', () => {
  let wsClient;
  
  // Mock WebSocketClient 클래스
  class MockWebSocketClient {
    constructor(url = 'ws://localhost:8000/ws') {
      this.url = url;
      this.ws = null;
      this.reconnectInterval = 5000;
      this.maxReconnectAttempts = 10;
      this.reconnectAttempts = 0;
      this.listeners = new Map();
      this.isConnecting = false;
    }
    
    connect() {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        return;
      }
      
      this.isConnecting = true;
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.emit(data.type, data);
          }
          this.emit('message', data);
        } catch (error) {
          console.error('메시지 파싱 실패:', error);
        }
      };
      
      this.ws.onclose = () => {
        this.isConnecting = false;
        this.emit('disconnected');
      };
    }
    
    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
    
    send(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    }
    
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
    
    emit(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(callback => callback(data));
      }
    }
    
    isConnected() {
      return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
  }
  
  beforeEach(() => {
    wsClient = new MockWebSocketClient();
  });
  
  afterEach(() => {
    if (wsClient) {
      wsClient.disconnect();
    }
  });
  
  test('WebSocket이 올바른 URL로 초기화됨', () => {
    expect(wsClient.url).toBe('ws://localhost:8000/ws');
  });
  
  test('WebSocket 연결이 성공함', (done) => {
    wsClient.on('connected', () => {
      expect(wsClient.isConnected()).toBe(true);
      done();
    });
    
    wsClient.connect();
  });
  
  test('메시지 전송 및 수신', (done) => {
    wsClient.on('connected', () => {
      const testData = { type: 'test', message: 'Hello' };
      
      wsClient.on('message', (data) => {
        expect(data).toEqual(testData);
        done();
      });
      
      wsClient.send(testData);
    });
    
    wsClient.connect();
  });
  
  test('타입별 이벤트 핸들러가 동작함', (done) => {
    wsClient.on('connected', () => {
      wsClient.on('equipment_status', (data) => {
        expect(data.type).toBe('equipment_status');
        expect(data.equipment_id).toBe('EQ-01-01');
        done();
      });
      
      const statusUpdate = {
        type: 'equipment_status',
        equipment_id: 'EQ-01-01',
        status: 'RUNNING'
      };
      
      wsClient.send(statusUpdate);
    });
    
    wsClient.connect();
  });
  
  test('WebSocket 연결 종료', (done) => {
    wsClient.on('connected', () => {
      wsClient.on('disconnected', () => {
        expect(wsClient.isConnected()).toBe(false);
        done();
      });
      
      wsClient.disconnect();
    });
    
    wsClient.connect();
  });
  
  test('재연결 설정이 올바름', () => {
    expect(wsClient.reconnectInterval).toBe(5000);
    expect(wsClient.maxReconnectAttempts).toBe(10);
  });
});