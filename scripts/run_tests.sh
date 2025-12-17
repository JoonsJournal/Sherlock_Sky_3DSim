#!/bin/bash

# 테스트 실행 스크립트

echo "================================"
echo "SHERLOCK_SKY_3DSIM 테스트 실행"
echo "================================"
echo

# Backend 테스트
echo "📦 Backend 테스트 실행..."
cd backend

# 가상환경 활성화 (필요 시)
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 테스트 실행
pytest tests/ -v --cov=api --cov=simulator --cov-report=html --cov-report=term

BACKEND_EXIT_CODE=$?

cd ..

echo
echo "================================"
echo

# Frontend 테스트
echo "📦 Frontend 테스트 실행..."
cd frontend/threejs_viewer

# 의존성 확인
if [ ! -d "node_modules" ]; then
    echo "의존성 설치 중..."
    npm install
fi

# 테스트 실행
npm test -- --coverage

FRONTEND_EXIT_CODE=$?

cd ../..

echo
echo "================================"
echo "테스트 결과 요약"
echo "================================"
echo "Backend: $([ $BACKEND_EXIT_CODE -eq 0 ] && echo '✅ 통과' || echo '❌ 실패')"
echo "Frontend: $([ $FRONTEND_EXIT_CODE -eq 0 ] && echo '✅ 통과' || echo '❌ 실패')"
echo

# 종료 코드
if [ $BACKEND_EXIT_CODE -eq 0 ] && [ $FRONTEND_EXIT_CODE -eq 0 ]; then
    exit 0
else
    exit 1
fi