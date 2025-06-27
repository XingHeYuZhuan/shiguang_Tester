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
    }
};

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
            console.log('[模拟Prompt]:', { titleText, contentText, defaultValue, validatorFnName, promiseId });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showPrompt',
                args: [titleText, contentText, defaultValue, validatorFnName, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    showSingleSelection: (titleText, optionsJsonString, defaultIndex, confirmText, cancelText) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SingleSelection]:', { titleText, optionsJsonString, defaultIndex, confirmText, cancelText, promiseId });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'showSingleSelection',
                args: [titleText, optionsJsonString, defaultIndex, confirmText, cancelText, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    },

    saveImportedCourses: (coursesJsonString) => {
        return new Promise((resolve, reject) => {
            const promiseId = generatePromiseId();
            pendingPromises.set(promiseId, { resolve, reject });
            console.log('[模拟SaveImportedCourses]:', { coursesJsonString, promiseId });
            window.postMessage({
                type: 'ANDROID_BRIDGE_CALL',
                method: 'saveImportedCourses',
                args: [coursesJsonString, promiseId],
                messageId: promiseId
            }, window.location.origin);
        });
    }
};

// 监听消息
window.addEventListener('message', function(event) {
    if (event.source === window && event.data) {
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