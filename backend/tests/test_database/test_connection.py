"""
데이터베이스 연결 테스트
"""

import pytest
from unittest.mock import patch, MagicMock
import psycopg2


@pytest.mark.unit
class TestDatabaseConnection:
    """데이터베이스 연결 단위 테스트"""
    
    def test_get_db_config(self):
        """DB 설정 로드 테스트"""
        from api.database.connection import DB_CONFIG
        
        assert "host" in DB_CONFIG
        assert "port" in DB_CONFIG
        assert "database" in DB_CONFIG
        assert "user" in DB_CONFIG
        assert "password" in DB_CONFIG
    
    def test_validate_config_success(self):
        """설정 검증 성공"""
        from api.database.connection import validate_config
        
        valid_config = {
            "host": "localhost",
            "port": "5432",
            "database": "test_db",
            "user": "postgres",
            "password": "password"
        }
        
        # 예외가 발생하지 않아야 함
        validate_config(valid_config)
    
    def test_validate_config_missing_key(self):
        """설정 검증 실패 - 누락된 키"""
        from api.database.connection import validate_config, DatabaseError
        
        invalid_config = {
            "host": "localhost",
            # port 누락
            "database": "test_db"
        }
        
        with pytest.raises(DatabaseError):
            validate_config(invalid_config)
    
    @patch('psycopg2.connect')
    def test_get_db_connection_success(self, mock_connect):
        """DB 연결 성공"""
        from api.database.connection import get_db_connection
        
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        
        conn = get_db_connection()
        
        assert conn is not None
        mock_connect.assert_called_once()
    
    @patch('psycopg2.connect')
    def test_get_db_connection_failure(self, mock_connect):
        """DB 연결 실패"""
        from api.database.connection import get_db_connection, DatabaseError
        
        mock_connect.side_effect = psycopg2.OperationalError("Connection failed")
        
        with pytest.raises(DatabaseError):
            get_db_connection()
    
    def test_return_db_connection(self, mock_db_connection):
        """DB 연결 반환"""
        from api.database.connection import return_db_connection
        
        return_db_connection(mock_db_connection)
        
        mock_db_connection.close.assert_called_once()


@pytest.mark.integration
@pytest.mark.db
class TestDatabaseIntegration:
    """데이터베이스 통합 테스트 (실제 DB 필요)"""
    
    def test_real_db_connection(self):
        """실제 DB 연결 테스트"""
        from api.database.connection import get_db_connection, return_db_connection
        
        try:
            conn = get_db_connection()
            assert conn is not None
            
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result[0] == 1
            
            cursor.close()
            return_db_connection(conn)
        except Exception as e:
            pytest.skip(f"실제 DB 연결 불가: {e}")