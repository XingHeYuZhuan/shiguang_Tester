// injected_bridge.js

// Promise ID 生成器
function generatePromiseId() {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

// 待处理 Promise 存储
const pendingPromises = new Map();

// AndroidBridge 同步方法模拟
window.AndroidBridge = {
    showToast: (message) => {
        console.log('[模拟Toast]:', message);
        window.postMessage({ type: 'ANDROID_BRIDGE_CALL', method: 'showToast', args: [message] }, window.location.origin);
    },
    // 统一的收尾信号
    notifyTaskCompletion: () => {
        console.log('[模拟Completion]: 收到任务完成通知');
        window.postMessage({ type: 'ANDROID_BRIDGE_CALL', method: 'notifyTaskCompletion', args: [] }, window.location.origin);
    }
};

/**
 * 验证单个课程数据是否包含所有必需字段。
 * @param {object} course 待验证的课程对象
 * @returns {string|null} 如果验证失败返回错误消息，否则返回 null
 */
function validateCourseData(course) {
    if (!course) {
        return "课程数据必须是一个有效的对象。";
    }
    const requiredFields = ['name', 'teacher', 'position', 'day', 'weeks'];
    // If isCustomTime is true, customStartTime and customEndTime are required
    if (course.isCustomTime) {
        if (!course.customStartTime) return "自定义时间课程缺少 customStartTime 字段。";
        if (!course.customEndTime) return "自定义时间课程缺少 customEndTime 字段。";
    } else {
        // If not custom time, startSection and endSection are required
        if (course.startSection === undefined || course.startSection === null) {
            return `课程数据缺少必需字段: 'startSection'。`;
        }
        if (course.endSection === undefined || course.endSection === null) {
            return `课程数据缺少必需字段: 'endSection'。`;
        }
    }
    for (const field of requiredFields) {
        if (course[field] === undefined || course[field] === null) {
            return `课程数据缺少必需字段: '${field}'。`;
        }
    }
    // 额外的非空字符串检查
    if (typeof course.name === 'string' && course.name.trim() === '') {
        return "课程名称不能为空。";
    }
    return null;
}

/**
 * 验证单个时间段数据是否包含所有必需字段。
 * @param {object} timeSlot 待验证的时间段对象
 * @returns {string|null} 如果验证失败返回错误消息，否则返回 null
 */
function validateTimeSlotData(timeSlot) {
    if (!timeSlot) {
        return "时间段数据必须是一个有效的对象。";
    }
    const requiredFields = ['number', 'startTime', 'endTime'];
    for (const field of requiredFields) {
        if (timeSlot[field] === undefined || timeSlot[field] === null) {
            return `时间段数据缺少必需字段: '${field}'。`;
        }
    }
    // 额外的非空字符串检查
    if (typeof timeSlot.startTime === 'string' && timeSlot.startTime.trim() === '') {
        return "开始时间不能为空。";
    }
    if (typeof timeSlot.endTime === 'string' && timeSlot.endTime.trim() === '') {
        return "结束时间不能为空。";
    }
    return null;
}

/**
 * 验证并清洗课表配置数据，应用默认值并忽略多余字段。
 *
 * 实现了以下逻辑:
 * 1. 确保是有效的 JSON 对象。
 * 2. 忽略未在模型中定义的字段。
 * 3. 对缺失的字段应用模型中定义的默认值。
 * 4. 对数字字段进行基本类型检查。
 *
 * @param {string} jsonString 待验证的配置 JSON 字符串
 * @returns {string} 清洗和补全默认值后的 JSON 字符串
 */
function validateCourseConfigData(jsonString) {
    let config;
    try {
        config = JSON.parse(jsonString);
    } catch (e) {
        throw new Error(`配置数据 JSON 解析失败: ${e.message}`);
    }

    if (typeof config !== 'object' || config === null) {
        throw new Error("传入的配置数据不是一个有效的JSON对象。");
    }

    // 预期模型的字段及其默认值 (基于 CourseConfigJsonModel)
    const defaults = {
        semesterStartDate: null, // String? = null
        semesterTotalWeeks: 20, // Int = 20
        defaultClassDuration: 45, // Int = 45
        defaultBreakDuration: 10, // Int = 10
        firstDayOfWeek: 1 // Int = 1
    };

    const cleanedConfig = {};
    let errorMsg = null;

    // 清洗和应用默认值
    for (const key in defaults) {
        const defaultValue = defaults[key];

        if (config.hasOwnProperty(key)) {
            let value = config[key];

            // 针对 Int 类型的字段进行类型检查和转换 (除了 null 值的 semesterStartDate)
            if (typeof defaultValue === 'number') {
                // 尝试转换为整数
                let numValue = parseInt(value);
                if (isNaN(numValue) || numValue < 0) {
                    errorMsg = `'${key}' 必须是有效的非负整数。`;
                    break;
                }
                cleanedConfig[key] = numValue;
            } else if (key === 'semesterStartDate') {
                // 确保是字符串或 null
                if (value !== null && typeof value !== 'string') {
                     errorMsg = `'${key}' 必须是字符串或 null。`;
                     break;
                }
                cleanedConfig[key] = value;
            } else {
                // 对于其他类型（理论上不应该有），直接使用值
                cleanedConfig[key] = value;
            }
        } else {
            // 字段缺失，应用默认值
            cleanedConfig[key] = defaultValue;
        }
    }
    
    if (errorMsg) {
        throw new Error(`配置数据验证失败: ${errorMsg}`);
    }

    // 返回清洗和补全后的 JSON 字符串
    return JSON.stringify(cleanedConfig);
}


// AndroidBridgePromise 异步方法模拟
window.AndroidBridgePromise = {
    showAlert: (titleText, contentText, confirmText) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟Alert]:', { titleText, contentText, confirmText, promiseId });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showAlert',
                args: [titleText, contentText, confirmText, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    showPrompt: (titleText, contentText, defaultValue, validatorFnName) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟Prompt]:', { titleText, contentText, defaultValue, validatorFnName });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showPrompt',
                args: [titleText, contentText, defaultValue, validatorFnName, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    showSingleSelection: (titleText, items, selectedIndex) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SingleSelection]:', { titleText, items, selectedIndex, promiseId });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showSingleSelection',
                args: [titleText, items, selectedIndex],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    saveImportedCourses: (jsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SaveImportedCourses]:', { jsonString });
            try {
                const courses = JSON.parse(jsonString);
                if (!Array.isArray(courses)) {
                    throw new Error("传入的JSON不是一个课程数组。");
                }
                for (const course of courses) {
                    const validationError = validateCourseData(course);
                    if (validationError) {
                        throw new Error(`课程数据验证失败: ${validationError}`);
                    }
                }
            } catch (e) {
                console.error('[数据验证失败]:', e.message);
                pendingPromises.delete(promiseId);
                return reject(e);
            }

            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'saveImportedCourses',
                args: [jsonString, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    savePresetTimeSlots: (jsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SavePresetTimeSlots]:', { jsonString });
            try {
                const timeSlots = JSON.parse(jsonString);
                if (!Array.isArray(timeSlots)) {
                    throw new Error("传入的JSON不是一个时间段数组。");
                }
                for (const timeSlot of timeSlots) {
                    const validationError = validateTimeSlotData(timeSlot);
                    if (validationError) {
                        throw new Error(`时间段数据验证失败: ${validationError}`);
                    }
                }
            } catch (e) {
                console.error('[数据验证失败]:', e.message);
                pendingPromises.delete(promiseId);
                return reject(e);
            }

            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'savePresetTimeSlots',
                args: [jsonString, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    saveCourseConfig: (jsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SaveCourseConfig]:', { jsonString });
            
            let cleanedJsonString = jsonString;

            try {
                cleanedJsonString = validateCourseConfigData(jsonString);
            } catch (e) {
                console.error('[配置数据校验失败]:', e.message);
                pendingPromises.delete(promiseId);
                return reject(e);
            }

            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'saveCourseConfig',
                args: [cleanedJsonString, promiseId], 
                messageId: promiseId
            }, window.location.origin);
        });
    }
};

// 监听来自 content-script 的消息
window.addEventListener('message', (event) => {
    // 确保消息来自我们自己的域并且是我们的类型
    if (event.source === window && event.data && event.data.type) {
        // Promise 响应处理
        if (event.data.type === 'ANDROID_BRIDGE_PROMISE_RESPONSE') {
            const { messageId, value, isError } = event.data;
            const promiseCallbacks = pendingPromises.get(messageId);
            if (promiseCallbacks) {
                if (isError) {
                    console.error('JS: _rejectAndroidPromise via postMessage', messageId, 'Error:', value);
                    promiseCallbacks.reject(new Error(value));
                } else {
                    console.log('JS: _resolveAndroidPromise via postMessage', messageId, 'Result:', value);
                    promiseCallbacks.resolve(value);
                }
                pendingPromises.delete(messageId);
            } else {
                console.warn('JS: ANDROID_BRIDGE_PROMISE_RESPONSE - Promise ID not found or already resolved/rejected:', messageId);
            }
        }
        // 验证请求处理
        else if (event.data.type === 'VALIDATE_PROMPT_INPUT') {
            const { validatorFnName, inputValue, requestId } = event.data;
            let validationError = false;

            if (typeof window[validatorFnName] === 'function') {
                validationError = window[validatorFnName](inputValue);
            } else {
                console.warn(`Validator function '${validatorFnName}' not found or is not a function in page context. Will report an error to content-script.`);
                validationError = '内部错误：验证函数未找到或无法执行。';
            }

            window.postMessage({
                type: 'VALIDATION_RESULT',
                requestId: requestId,
                validationError: validationError
            }, window.location.origin);
        }
    }
});