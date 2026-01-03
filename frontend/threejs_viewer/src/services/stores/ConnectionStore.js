/**
 * Connection Store
 * 연결 상태 전역 관리 (LocalStorage 지원)
 */

export class ConnectionStore {
    constructor() {
        this.STORAGE_KEY = 'sherlock_sky_connections';
        this.state = this.loadState();
        this.listeners = [];
    }

    /**
     * 상태 로드 (LocalStorage)
     */
    loadState() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load connection state:', error);
        }

        // 기본 상태
        return {
            lastConnectedSites: [],
            autoConnect: false,
            selectedSites: [],
            connectedSites: {},
            preferences: {
                showAllTables: true,
                sortBy: 'lastConnected',
                retryAttempts: 3,
                retryDelay: 5000
            }
        };
    }

    /**
     * 상태 저장 (LocalStorage)
     */
    saveState() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to save connection state:', error);
        }
    }

    /**
     * 상태 변경 리스너 등록
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * 리스너에게 알림
     */
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }

    /**
     * 마지막 연결 사이트 업데이트
     */
    updateLastConnected(siteId) {
        if (!this.state.lastConnectedSites.includes(siteId)) {
            this.state.lastConnectedSites.unshift(siteId);
            // 최대 5개까지만 저장
            if (this.state.lastConnectedSites.length > 5) {
                this.state.lastConnectedSites.pop();
            }
        } else {
            // 이미 있으면 맨 앞으로 이동
            this.state.lastConnectedSites = [
                siteId,
                ...this.state.lastConnectedSites.filter(id => id !== siteId)
            ];
        }
        this.saveState();
    }

    /**
     * 연결된 사이트 정보 업데이트
     */
    updateConnectedSite(siteId, info) {
        this.state.connectedSites[siteId] = {
            ...info,
            connectedAt: new Date().toISOString()
        };
        this.updateLastConnected(siteId);
        this.saveState();
    }

    /**
     * 사이트 연결 해제
     */
    removeConnectedSite(siteId) {
        delete this.state.connectedSites[siteId];
        this.saveState();
    }

    /**
     * 자동 연결 설정
     */
    setAutoConnect(enabled) {
        this.state.autoConnect = enabled;
        this.saveState();
    }

    /**
     * 선택된 사이트 업데이트
     */
    setSelectedSites(siteIds) {
        this.state.selectedSites = siteIds;
        this.saveState();
    }

    /**
     * 환경설정 업데이트
     */
    updatePreferences(prefs) {
        this.state.preferences = {
            ...this.state.preferences,
            ...prefs
        };
        this.saveState();
    }

    /**
     * 전체 상태 초기화
     */
    reset() {
        this.state = {
            lastConnectedSites: [],
            autoConnect: false,
            selectedSites: [],
            connectedSites: {},
            preferences: {
                showAllTables: true,
                sortBy: 'lastConnected',
                retryAttempts: 3,
                retryDelay: 5000
            }
        };
        this.saveState();
    }

    /**
     * 현재 상태 가져오기
     */
    getState() {
        return { ...this.state };
    }
}

// 싱글톤 인스턴스
export const connectionStore = new ConnectionStore();