module.exports = {
  // 테스트 환경
  testEnvironment: 'jsdom',
  
  // 테스트 파일 패턴
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // 커버리지 수집 대상
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js'
  ],
  
  // 커버리지 디렉토리
  coverageDirectory: 'coverage',
  
  // 커버리지 리포터
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // 모듈 경로 매핑
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js'
  },
  
  // 설정 파일
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // 변환 설정
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // 무시할 경로
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // 타임아웃
  testTimeout: 10000
};