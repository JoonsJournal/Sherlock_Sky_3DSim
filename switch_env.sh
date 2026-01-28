#!/bin/bash
# =============================================================================
# SHERLOCK_SKY_3DSIM - 환경 전환 스크립트
# =============================================================================
# 사용법:
#   ./switch_env.sh docker     - Docker 가상 공장 환경으로 전환
#   ./switch_env.sh production - 실제 공장 환경으로 전환
#   ./switch_env.sh status     - 현재 환경 확인
# =============================================================================

# 스크립트 위치 기준으로 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"
DOCKER_DIR="$SCRIPT_DIR/docker-virtual-factory"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수: 현재 환경 확인
check_current_env() {
    if [ -f "$CONFIG_DIR/databases.json" ]; then
        # localhost가 포함되어 있으면 Docker 환경
        if grep -q '"host": "localhost"' "$CONFIG_DIR/databases.json"; then
            echo "docker"
        else
            echo "production"
        fi
    else
        echo "unknown"
    fi
}

# 함수: 백업 생성
create_backup() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$CONFIG_DIR/databases.backup_${timestamp}.json"
    
    if [ -f "$CONFIG_DIR/databases.json" ]; then
        cp "$CONFIG_DIR/databases.json" "$backup_file"
        echo -e "${BLUE}📦 백업 생성: $backup_file${NC}"
    fi
}

# 메인 로직
case "$1" in
    "docker")
        echo -e "${YELLOW}🐳 Docker 가상 공장 환경으로 전환 중...${NC}"
        
        # 백업 생성
        create_backup
        
        # Docker 설정으로 교체
        if [ -f "$DOCKER_DIR/databases.docker.json" ]; then
            cp "$DOCKER_DIR/databases.docker.json" "$CONFIG_DIR/databases.json"
            echo -e "${GREEN}✅ Docker 환경으로 전환 완료!${NC}"
            echo ""
            echo "📍 연결 정보:"
            echo "   🇨🇳 중국 공장: localhost:1433"
            echo "   🇻🇳 베트남 공장: localhost:1434"
            echo "   🇰🇷 한국 공장: localhost:1435"
            echo ""
            echo -e "${YELLOW}💡 Docker 시작: cd docker-virtual-factory && docker compose up -d${NC}"
        else
            echo -e "${RED}❌ 오류: $DOCKER_DIR/databases.docker.json 파일을 찾을 수 없습니다.${NC}"
            exit 1
        fi
        ;;
        
    "production")
        echo -e "${YELLOW}🏭 실제 공장 환경으로 전환 중...${NC}"
        
        # 백업 생성
        create_backup
        
        # Production 설정으로 교체
        if [ -f "$CONFIG_DIR/environments/databases.production.json" ]; then
            cp "$CONFIG_DIR/environments/databases.production.json" "$CONFIG_DIR/databases.json"
            echo -e "${GREEN}✅ Production 환경으로 전환 완료!${NC}"
        else
            echo -e "${RED}❌ 오류: $CONFIG_DIR/environments/databases.production.json 파일을 찾을 수 없습니다.${NC}"
            echo -e "${YELLOW}💡 먼저 현재 databases.json을 백업하세요:${NC}"
            echo "   mkdir -p $CONFIG_DIR/environments"
            echo "   cp $CONFIG_DIR/databases.json $CONFIG_DIR/environments/databases.production.json"
            exit 1
        fi
        ;;
        
    "status")
        current=$(check_current_env)
        echo -e "${BLUE}📊 현재 환경 상태${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        case "$current" in
            "docker")
                echo -e "   현재 환경: ${GREEN}🐳 Docker (가상 공장)${NC}"
                ;;
            "production")
                echo -e "   현재 환경: ${YELLOW}🏭 Production (실제 공장)${NC}"
                ;;
            *)
                echo -e "   현재 환경: ${RED}❓ 알 수 없음${NC}"
                ;;
        esac
        echo ""
        
        # Docker 컨테이너 상태 확인
        echo -e "${BLUE}🐳 Docker 컨테이너 상태${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        if command -v docker &> /dev/null; then
            docker ps --filter "name=factory-" --format "   {{.Names}}: {{.Status}}" 2>/dev/null || echo "   (컨테이너 없음)"
        else
            echo "   Docker가 설치되지 않았습니다."
        fi
        ;;
        
    *)
        echo "SHERLOCK_SKY_3DSIM 환경 전환 스크립트"
        echo ""
        echo "사용법: $0 {docker|production|status}"
        echo ""
        echo "  docker     - Docker 가상 공장 환경으로 전환"
        echo "  production - 실제 공장 환경으로 전환"
        echo "  status     - 현재 환경 상태 확인"
        echo ""
        exit 1
        ;;
esac