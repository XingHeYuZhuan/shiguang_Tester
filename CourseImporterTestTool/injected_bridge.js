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
    const requiredFields = ['name', 'teacher', 'position', 'day', 'startSection', 'endSection', 'weeks'];
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