// content-script.js

// 注入 AndroidBridge
function injectAndroidBridge() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected_bridge.js');
    document.documentElement.appendChild(script);
    console.log('AndroidBridge injected into page context.');
}

// 执行 JS 文件
function executeFixedJs(jsFileName) {
    const existingScript = document.querySelector(`script[src="${chrome.runtime.getURL(jsFileName)}"]`);
    if (existingScript) {
        existingScript.remove();
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(jsFileName);
    document.documentElement.appendChild(script);
    console.log(`${jsFileName} loaded and executed in page context.`);
    chrome.runtime.sendMessage({ type: 'JS_EXECUTION_STATUS', success: true, message: `${jsFileName} 执行成功！请查看F12控制台。` });
}

// 待处理的验证请求
const pendingValidationRequests = new Map();

// --- 内联对话框模块 START ---

// 显示内联对话框
function showInlineDialog(dialogType, args, messageId) {
    return new Promise((resolve, reject) => {
        const existingOverlay = document.getElementById('android-bridge-dialog-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'android-bridge-dialog-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 99999;
        `;

        const dialogContainer = document.createElement('div');
        dialogContainer.id = 'android-bridge-dialog-container';
        dialogContainer.style.cssText = `
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            max-width: 400px;
            width: 90%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 15px;
        `;

        let titleText = '';
        let contentText = '';
        let confirmText = '确定';
        let cancelText = '取消';
        let defaultValue = '';
        let validatorFnName = '';
        let options = [];
        let selectedOptionIndex = -1;

        if (dialogType === 'alert') {
            titleText = args[0] || '提示';
            contentText = args[1] || '';
            confirmText = args[2] || '确定';
        } else if (dialogType === 'prompt') {
            titleText = args[0] || '输入';
            contentText = args[1] || '';
            defaultValue = args[2] || '';
            validatorFnName = args[3] || '';
        } else if (dialogType === 'singleselection') {
            titleText = args[0] || '请选择';
            try {
                options = JSON.parse(args[1] || '[]');
                if (!Array.isArray(options)) {
                    throw new Error("Parsed options is not an array.");
                }
            } catch (e) {
                console.error("Error parsing options for single selection dialog:", e, "Raw arg:", args[1]);
                options = [];
            }
            const defaultIndex = args[2] !== undefined ? parseInt(args[2], 10) : -1;
            selectedOptionIndex = defaultIndex;
            contentText = '';
        }

        const titleElem = document.createElement('h3');
        titleElem.style.cssText = `
            margin: 0;
            color: #333;
            font-size: 1.2em;
            text-align: center;
        `;
        titleElem.innerText = titleText;

        const messageElem = document.createElement('p');
        messageElem.style.cssText = `
            margin: 0;
            color: #555;
            font-size: 0.9em;
            text-align: center;
        `;
        messageElem.innerText = contentText;

        const errorElem = document.createElement('p');
        errorElem.style.cssText = `
            margin: 0;
            color: red;
            font-size: 0.8em;
            text-align: center;
            display: none;
        `;

        dialogContainer.appendChild(titleElem);
        dialogContainer.appendChild(messageElem);
        dialogContainer.appendChild(errorElem);

        let inputElem = null;
        let optionsListElem = null;

        if (dialogType === 'prompt') {
            inputElem = document.createElement('input');
            inputElem.type = 'text';
            inputElem.value = defaultValue;
            inputElem.placeholder = contentText;
            inputElem.style.cssText = `
                width: calc(100% - 20px);
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
                font-size: 0.9em;
            `;
            dialogContainer.appendChild(inputElem);
        } else if (dialogType === 'singleselection') {
            optionsListElem = document.createElement('div');
            optionsListElem.style.cssText = `
                max-height: 150px;
                overflow-y: auto;
                border: 1px solid #eee;
                border-radius: 4px;
                padding: 5px;
                background-color: #f9f9f9;
            `;

            options.forEach((optionText, index) => {
                const optionItem = document.createElement('div');
                optionItem.innerText = optionText;
                optionItem.style.cssText = `
                    padding: 8px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                    font-size: 0.9em;
                `;
                if (index === options.length - 1) {
                    optionItem.style.borderBottom = 'none';
                }
                optionItem.addEventListener('click', () => {
                    Array.from(optionsListElem.children).forEach(item => {
                        item.style.backgroundColor = '';
                        item.style.fontWeight = 'normal';
                    });
                    optionItem.style.backgroundColor = '#e0f7fa';
                    optionItem.style.fontWeight = 'bold';
                    selectedOptionIndex = index;
                });
                optionsListElem.appendChild(optionItem);
            });

            if (selectedOptionIndex !== -1 && optionsListElem.children[selectedOptionIndex]) {
                const defaultSelectedItem = optionsListElem.children[selectedOptionIndex];
                defaultSelectedItem.style.backgroundColor = '#e0f7fa';
                defaultSelectedItem.style.fontWeight = 'bold';
            }

            dialogContainer.appendChild(optionsListElem);
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 10px;
        `;

        if (dialogType !== 'alert') {
            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = cancelText;
            cancelBtn.style.cssText = `
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
                background-color: #f44336;
                color: white;
            `;
            cancelBtn.addEventListener('click', () => {
                sendResultToBackground(null);
                overlay.parentNode.removeChild(overlay);
                resolve(null);
            });
            buttonContainer.appendChild(cancelBtn);
        }

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = confirmText;
        confirmBtn.style.cssText = `
            padding: 8px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            background-color: #007bff;
            color: white;
        `;
        confirmBtn.addEventListener('click', () => {
            let result = null;
            if (dialogType === 'prompt') {
                const inputValue = inputElem.value;

                if (validatorFnName) {
                    const validationRequestId = generatePromiseId();
                    const validationPromise = new Promise((resolveValidation, rejectValidation) => {
                        pendingValidationRequests.set(validationRequestId, { resolveValidation, rejectValidation });
                    });

                    window.postMessage({
                        type: 'VALIDATE_PROMPT_INPUT',
                        validatorFnName: validatorFnName,
                        inputValue: inputValue,
                        requestId: validationRequestId
                    }, window.location.origin);

                    validationPromise.then(validationError => {
                        if (validationError) {
                            errorElem.innerText = validationError;
                            errorElem.style.display = 'block';
                            inputElem.focus();
                        } else {
                            errorElem.style.display = 'none';
                            sendResultToBackground(inputValue);
                            overlay.parentNode.removeChild(overlay);
                            resolve(inputValue);
                        }
                    }).catch(error => {
                        console.error('Validation communication error:', error);
                        errorElem.innerText = '内部错误：验证失败。';
                        errorElem.style.display = 'block';
                        inputElem.focus();
                    });
                    return;
                } else {
                    result = inputValue;
                }
            } else if (dialogType === 'singleselection') {
                result = selectedOptionIndex !== -1 ? selectedOptionIndex : null;
            } else if (dialogType === 'alert') {
                result = true;
            }

            if (!(dialogType === 'prompt' && validatorFnName)) {
                sendResultToBackground(result);
                overlay.parentNode.removeChild(overlay);
                resolve(result);
            }
        });
        buttonContainer.appendChild(confirmBtn);

        dialogContainer.appendChild(buttonContainer);

        overlay.appendChild(dialogContainer);
        document.body.appendChild(overlay);

        if (inputElem) {
            inputElem.focus();
        }

        function sendResultToBackground(value) {
            chrome.runtime.sendMessage({
                type: 'INLINE_DIALOG_RESULT',
                dialogType: dialogType,
                messageId: messageId,
                value: value
            }).catch(e => console.error("Error sending inline dialog result to background:", e));
        }

        const escKeyListener = (e) => {
            if (e.key === 'Escape' && dialogType !== 'alert') {
                sendResultToBackground(null);
                overlay.parentNode.removeChild(overlay);
                resolve(null);
                document.removeEventListener('keydown', escKeyListener);
            }
        };
        document.addEventListener('keydown', escKeyListener);

        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && Array.from(mutation.removedNodes).includes(overlay)) {
                    sendResultToBackground(null);
                    resolve(null);
                    observer.disconnect();
                    document.removeEventListener('keydown', escKeyListener);
                    console.warn(`Inline dialog (ID: ${messageId}) was unexpectedly removed.`);
                }
            }
        });
        observer.observe(document.body, { childList: true });
    });
}

// --- 内联对话框模块 END ---

// 页面初始化
injectAndroidBridge();

// 监听来自页面的消息
window.addEventListener('message', function(event) {
    if (event.source === window && event.data && event.data.type === 'ANDROID_BRIDGE_CALL') {
        chrome.runtime.sendMessage({
            type: 'BRIDGE_CALL_FROM_PAGE',
            method: event.data.method,
            args: event.data.args,
            messageId: event.data.messageId
        }).catch(e => console.error("Error sending BRIDGE_CALL_FROM_PAGE to background:", e));
    }
    if (event.source === window && event.data && event.data.type === 'VALIDATION_RESULT') {
        const { requestId, validationError } = event.data;
        const validationCallbacks = pendingValidationRequests.get(requestId);
        if (validationCallbacks) {
            validationCallbacks.resolveValidation(validationError);
            pendingValidationRequests.delete(requestId);
        } else {
            console.warn('Content Script: Received VALIDATION_RESULT for unknown request ID:', requestId);
        }
    }
});

// 监听来自 Background Script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'RELOAD_AND_EXECUTE_JS') {
        console.log('Received request to reload and execute JS from background...');
        executeFixedJs('school.js');
        sendResponse({ success: true, message: 'JS执行完成，请查看页面控制台。' });
        return true;
    } else if (request.type === 'SHOW_INLINE_DIALOG') {
        console.log(`Content Script received SHOW_INLINE_DIALOG for type: ${request.dialogType}`);
        showInlineDialog(request.dialogType, request.args, request.messageId)
            .then(result => {
                console.log(`Inline dialog ${request.dialogType} (ID: ${request.messageId}) resolved with:`, result);
            })
            .catch(error => {
                console.error(`Inline dialog ${request.dialogType} (ID: ${request.messageId}) rejected with:`, error);
            });
        sendResponse({ success: true });
        return true;
    } else if (request.type === 'RESOLVE_PROMISE_IN_PAGE') {
        console.log(`Content Script received RESOLVE_PROMISE_IN_PAGE for ID: ${request.messageId}, isError: ${request.isError}`);
        window.postMessage({
            type: 'ANDROID_BRIDGE_PROMISE_RESPONSE',
            messageId: request.messageId,
            value: request.value,
            isError: request.isError
        }, window.location.origin);
        sendResponse({ success: true });
        return true;
    } else if (request.type === 'JS_EXECUTION_STATUS') {
        console.warn('Content Script received its own JS_EXECUTION_STATUS. This might indicate a message loop or is for forwarding.', request);
        sendResponse({ success: true });
        return true;
    }
});

// 生成唯一ID
function generatePromiseId() {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}