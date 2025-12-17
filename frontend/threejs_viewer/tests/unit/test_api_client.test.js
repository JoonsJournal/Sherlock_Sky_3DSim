/**
 * API 클라이언트 테스트
 */

describe('ApiClient', () => {
  let apiClient;
  
  // Mock ApiClient 클래스
  class MockApiClient {
    constructor(baseURL = 'http://localhost:8000/api') {
      this.baseURL = baseURL;
    }
    
    async get(endpoint) {
      const response = await fetch(`${this.baseURL}${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    }
    
    async post(endpoint, data) {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    }
    
    async getAllEquipment() {
      return await this.get('/equipment');
    }
    
    async getEquipment(equipmentId) {
      return await this.get(`/equipment/${equipmentId}`);
    }
  }
  
  beforeEach(() => {
    apiClient = new MockApiClient();
    fetch.mockClear();
  });
  
  test('ApiClient가 올바른 baseURL로 초기화됨', () => {
    expect(apiClient.baseURL).toBe('http://localhost:8000/api');
  });
  
  test('GET 요청이 성공적으로 수행됨', async () => {
    const mockData = { equipment: [] };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });
    
    const result = await apiClient.get('/equipment');
    
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/equipment');
    expect(result).toEqual(mockData);
  });
  
  test('GET 요청 실패 시 에러 발생', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });
    
    await expect(apiClient.get('/equipment/invalid')).rejects.toThrow('HTTP error! status: 404');
  });
  
  test('POST 요청이 성공적으로 수행됨', async () => {
    const mockData = { success: true };
    const postData = { equipment_id: 'EQ-01-01', status: 'RUNNING' };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });
    
    const result = await apiClient.post('/equipment/update', postData);
    
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/equipment/update',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      })
    );
    expect(result).toEqual(mockData);
  });
  
  test('getAllEquipment 메서드가 올바르게 동작', async () => {
    const mockEquipment = {
      equipment: [
        { id: 'EQ-01-01', status: 'RUNNING' },
        { id: 'EQ-01-02', status: 'IDLE' }
      ]
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEquipment
    });
    
    const result = await apiClient.getAllEquipment();
    
    expect(result).toEqual(mockEquipment);
    expect(result.equipment).toHaveLength(2);
  });
  
  test('getEquipment 메서드가 특정 설비를 조회', async () => {
    const mockEquipment = { id: 'EQ-01-01', status: 'RUNNING' };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEquipment
    });
    
    const result = await apiClient.getEquipment('EQ-01-01');
    
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/equipment/EQ-01-01');
    expect(result.id).toBe('EQ-01-01');
  });
});