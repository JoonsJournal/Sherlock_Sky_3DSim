/**
 * 환경 설정 테스트
 */

describe('Environment Configuration', () => {
  let ENV, isDevelopment, isProduction, buildApiUrl, buildWsUrl;
  
  beforeEach(() => {
    // 모듈 import (dynamic import 필요 시)
    window.ENV = {
      API_BASE_URL: 'http://localhost:8000/api',
      WS_URL: 'ws://localhost:8000/ws',
      DEBUG_MODE: true,
      ENVIRONMENT: 'test'
    };
  });
  
  test('ENV 객체가 올바르게 로드됨', () => {
    expect(window.ENV).toBeDefined();
    expect(window.ENV.API_BASE_URL).toBe('http://localhost:8000/api');
    expect(window.ENV.WS_URL).toBe('ws://localhost:8000/ws');
  });
  
  test('API URL 빌더가 올바르게 동작', () => {
    const buildApiUrl = (endpoint) => {
      const cleanBase = window.ENV.API_BASE_URL.replace(/\/+$/, '');
      const cleanEndpoint = endpoint.replace(/^\/+/, '');
      return `${cleanBase}/${cleanEndpoint}`;
    };
    
    expect(buildApiUrl('/equipment')).toBe('http://localhost:8000/api/equipment');
    expect(buildApiUrl('equipment')).toBe('http://localhost:8000/api/equipment');
    expect(buildApiUrl('/equipment/')).toBe('http://localhost:8000/api/equipment/');
  });
  
  test('WebSocket URL 빌더가 올바르게 동작', () => {
    const buildWsUrl = (path = '') => {
      const cleanBase = window.ENV.WS_URL.replace(/\/+$/, '');
      const cleanPath = path.replace(/^\/+/, '');
      return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
    };
    
    expect(buildWsUrl()).toBe('ws://localhost:8000/ws');
    expect(buildWsUrl('/live')).toBe('ws://localhost:8000/ws/live');
    expect(buildWsUrl('live')).toBe('ws://localhost:8000/ws/live');
  });
  
  test('환경 검증 함수', () => {
    const validateEnvironment = () => {
      const errors = [];
      
      if (!window.ENV.API_BASE_URL) {
        errors.push('API_BASE_URL이 설정되지 않았습니다');
      }
      
      if (!window.ENV.WS_URL) {
        errors.push('WS_URL이 설정되지 않았습니다');
      }
      
      try {
        new URL(window.ENV.API_BASE_URL);
      } catch (e) {
        errors.push(`잘못된 API_BASE_URL 형식: ${window.ENV.API_BASE_URL}`);
      }
      
      return errors.length === 0;
    };
    
    expect(validateEnvironment()).toBe(true);
    
    // 잘못된 설정
    window.ENV.API_BASE_URL = 'invalid-url';
    expect(validateEnvironment()).toBe(false);
  });
});