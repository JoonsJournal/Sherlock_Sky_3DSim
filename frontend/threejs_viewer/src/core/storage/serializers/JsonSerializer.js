/**
 * JsonSerializer.js
 * 
 * JSON 직렬화/역직렬화 유틸리티
 * 안전한 JSON 처리 및 메타데이터 관리
 * 
 * @version 1.0.0
 * @location frontend/threejs_viewer/src/core/storage/serializers/JsonSerializer.js
 */

/**
 * JSON 직렬화 결과
 * @typedef {Object} SerializeResult
 * @property {boolean} success - 성공 여부
 * @property {string|null} data - 직렬화된 문자열
 * @property {Error|null} error - 에러 (실패 시)
 */

/**
 * JSON 역직렬화 결과
 * @typedef {Object} DeserializeResult
 * @property {boolean} success - 성공 여부
 * @property {Object|null} data - 파싱된 객체
 * @property {Error|null} error - 에러 (실패 시)
 */

class JsonSerializer {
    /**
     * @param {Object} options - 설정 옵션
     * @param {boolean} options.prettyPrint - 들여쓰기 여부 (기본: false)
     * @param {boolean} options.addMetadata - 메타데이터 추가 여부 (기본: true)
     * @param {string} options.version - 데이터 버전 (기본: '1.0.0')
     */
    constructor(options = {}) {
        this._options = {
            prettyPrint: options.prettyPrint ?? false,
            addMetadata: options.addMetadata ?? true,
            version: options.version || '1.0.0'
        };
    }

    /**
     * 객체를 JSON 문자열로 직렬화
     * @param {Object} data - 직렬화할 데이터
     * @param {Object} options - 추가 옵션
     * @param {boolean} options.addMetadata - 메타데이터 추가 여부
     * @param {Object} options.metadata - 추가 메타데이터
     * @returns {SerializeResult}
     */
    serialize(data, options = {}) {
        try {
            if (data === undefined) {
                throw new Error('Cannot serialize undefined');
            }

            let dataToSerialize = data;
            const addMeta = options.addMetadata ?? this._options.addMetadata;

            // 메타데이터 추가
            if (addMeta && typeof data === 'object' && data !== null) {
                dataToSerialize = {
                    ...data,
                    _meta: {
                        version: this._options.version,
                        serializedAt: new Date().toISOString(),
                        serializer: 'JsonSerializer',
                        ...options.metadata
                    }
                };
            }

            const jsonString = this._options.prettyPrint
                ? JSON.stringify(dataToSerialize, null, 2)
                : JSON.stringify(dataToSerialize);

            return {
                success: true,
                data: jsonString,
                error: null
            };

        } catch (error) {
            console.error('[JsonSerializer] 직렬화 실패:', error);
            return {
                success: false,
                data: null,
                error
            };
        }
    }

    /**
     * JSON 문자열을 객체로 역직렬화
     * @param {string} jsonString - JSON 문자열
     * @param {Object} options - 추가 옵션
     * @param {boolean} options.stripMetadata - 메타데이터 제거 여부 (기본: false)
     * @param {Function} options.reviver - JSON.parse reviver 함수
     * @returns {DeserializeResult}
     */
    deserialize(jsonString, options = {}) {
        try {
            if (!jsonString || typeof jsonString !== 'string') {
                throw new Error('Invalid JSON string');
            }

            let parsed = JSON.parse(jsonString, options.reviver);

            // 메타데이터 제거 옵션
            if (options.stripMetadata && parsed && typeof parsed === 'object') {
                const { _meta, ...rest } = parsed;
                parsed = rest;
            }

            return {
                success: true,
                data: parsed,
                error: null
            };

        } catch (error) {
            console.error('[JsonSerializer] 역직렬화 실패:', error);
            return {
                success: false,
                data: null,
                error
            };
        }
    }

    /**
     * 메타데이터만 추출
     * @param {string} jsonString - JSON 문자열
     * @returns {Object|null} 메타데이터 객체
     */
    extractMetadata(jsonString) {
        const result = this.deserialize(jsonString);
        if (result.success && result.data?._meta) {
            return result.data._meta;
        }
        return null;
    }

    /**
     * JSON 유효성 검사
     * @param {string} jsonString - 검사할 JSON 문자열
     * @returns {boolean}
     */
    isValid(jsonString) {
        try {
            JSON.parse(jsonString);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 두 JSON 객체 병합
     * @param {Object} target - 대상 객체
     * @param {Object} source - 소스 객체
     * @param {boolean} deep - 깊은 병합 여부
     * @returns {Object}
     */
    merge(target, source, deep = true) {
        if (!deep) {
            return { ...target, ...source };
        }

        const result = { ...target };
        
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.merge(result[key] || {}, source[key], true);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * 객체 깊은 복사
     * @param {Object} obj - 복사할 객체
     * @returns {Object}
     */
    clone(obj) {
        const serialized = this.serialize(obj, { addMetadata: false });
        if (!serialized.success) {
            throw serialized.error;
        }
        const deserialized = this.deserialize(serialized.data);
        if (!deserialized.success) {
            throw deserialized.error;
        }
        return deserialized.data;
    }

    /**
     * 데이터 크기 계산 (bytes)
     * @param {Object} data - 데이터 객체
     * @returns {number}
     */
    calculateSize(data) {
        const result = this.serialize(data, { addMetadata: false });
        if (result.success) {
            return new Blob([result.data]).size;
        }
        return 0;
    }

    /**
     * 압축을 위한 최소화
     * @param {Object} data - 데이터 객체
     * @returns {string}
     */
    minify(data) {
        const result = this.serialize(data, { addMetadata: false });
        return result.success ? result.data : '';
    }

    /**
     * 읽기 쉬운 형태로 포맷팅
     * @param {string} jsonString - JSON 문자열
     * @returns {string}
     */
    prettify(jsonString) {
        const result = this.deserialize(jsonString);
        if (result.success) {
            return JSON.stringify(result.data, null, 2);
        }
        return jsonString;
    }
}

// 싱글톤 인스턴스
const jsonSerializer = new JsonSerializer();

// Named exports
export { JsonSerializer, jsonSerializer };

// Default export
export default jsonSerializer;

// 전역 등록
if (typeof window !== 'undefined') {
    window.JsonSerializer = JsonSerializer;
    window.jsonSerializer = jsonSerializer;
}

console.log('✅ JsonSerializer.js v1.0.0 로드 완료');