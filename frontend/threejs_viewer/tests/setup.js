/**
 * Jest 테스트 설정 파일
 */

import '@testing-library/jest-dom';

// 전역 모킹
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// window.ENV 모킹
global.window = {
  ...global.window,
  ENV: {
    API_BASE_URL: 'http://localhost:8008/api',
    WS_URL: 'ws://localhost:8008/ws',
    DEBUG_MODE: false,
    ENVIRONMENT: 'test'
  }
};

// fetch 모킹
global.fetch = jest.fn();

// WebSocket 모킹
global.WebSocket = class WebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }
  
  send(data) {
    if (this.onmessage) {
      setTimeout(() => {
        this.onmessage({ data });
      }, 0);
    }
  }
  
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
};