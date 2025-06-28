// background.js

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab ? sender.tab.id : null;

    // 处理页面发来的桥接调用
    if (message.type === 'BRIDGE_CALL_FROM_PAGE') {
        const { method, args, messageId } = message;

        switch (method) {
            // Toast 消息
            case 'showToast':
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: '模拟Toast',
                    message: args[0],
                    silent: true
                });
                sendResponse({ success: true });
                break;

            // 内联对话框消息
            case 'showAlert':
            case 'showPrompt':
            case 'showSingleSelection':
                const dialogPromiseId = args[args.length - 1];
                chrome.tabs.sendMessage(tabId, {
                    type: 'SHOW_INLINE_DIALOG',
                    dialogType: method.replace('show', '').toLowerCase(),
                    args: args,
                    messageId: dialogPromiseId
                }).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error("Error sending SHOW_INLINE_DIALOG to content script:", error);
                    sendResponse({ success: false, message: error.message });
                });
                return true;

            // 课程保存操作 (*** 这是被修改的部分 ***)
            case 'saveImportedCourses':
                const coursesJsonString = args[0];
                const savePromiseId = args[1];

                const isSaveSuccess = Math.random() > 0.5;
                let saveResultValue;

                if (isSaveSuccess) {
                    saveResultValue = true;
                } else {
                    saveResultValue = '保存失败，请重试！';
                }

                chrome.tabs.sendMessage(tabId, {
                    type: 'RESOLVE_PROMISE_IN_PAGE',
                    messageId: savePromiseId,
                    value: saveResultValue,
                    isError: !isSaveSuccess
                }).then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error("Error resolving saveImportedCourses promise:", error);
                    sendResponse({ success: false, message: error.message });
                });
                return true;

            default:
                console.warn('Unknown AndroidBridge method:', method);
                sendResponse({ success: false, message: 'Unknown AndroidBridge method' });
                break;
        }
    }

    // 处理内联对话框结果
    if (message.type === 'INLINE_DIALOG_RESULT') {
        const { value, messageId } = message;

        let processedValue = value;

        if (typeof processedValue === 'string' && processedValue.length >= 2) {
            const firstChar = processedValue.charAt(0);
            const lastChar = processedValue.charAt(processedValue.length - 1);
            if ((firstChar === "'" && lastChar === "'") || (firstChar === '"' && lastChar === '"')) {
                processedValue = processedValue.substring(1, processedValue.length - 1);
            }
        }

        if (processedValue === 'true') {
            processedValue = true;
        } else if (processedValue === 'false') {
            processedValue = false;
        } else if (processedValue === 'null') {
            processedValue = null;
        } else if (typeof processedValue === 'string' && processedValue.length > 0) {
            const num = Number(processedValue);
            if (!isNaN(num) && (String(num) === processedValue || (parsedInt = parseInt(processedValue, 10)) && String(parsedInt) === processedValue)) {
                if (processedValue.includes('.') || processedValue.includes('e') || (processedValue.length > 1 && processedValue.startsWith('0') && processedValue !== '0')) {
                    processedValue = num;
                } else {
                    processedValue = parseInt(processedValue, 10);
                }
            }
        }

        chrome.tabs.sendMessage(tabId, {
            type: 'RESOLVE_PROMISE_IN_PAGE',
            messageId: messageId,
            value: processedValue,
            isError: false
        }).then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            console.error("Error sending RESOLVE_PROMISE_IN_PAGE for inline dialog:", error);
            sendResponse({ success: false, message: error.message });
        });
        return true;
    }

    // JS 执行状态更新
    if (message.type === 'JS_EXECUTION_STATUS') {
        chrome.runtime.sendMessage(message)
            .then(() => sendResponse({ success: true }))
            .catch(error => {
                console.error("Error forwarding JS_EXECUTION_STATUS to popup:", error);
                sendResponse({ success: false, message: error.message });
            });
        return true;
    }

    // 重新加载并执行 JS 请求
    if (message.type === 'RELOAD_AND_EXECUTE_JS_REQUEST') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const activeTab = tabs[0];
                if (activeTab.id && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('about:')) {
                    chrome.tabs.sendMessage(activeTab.id, { type: 'RELOAD_AND_EXECUTE_JS' })
                        .then(response => {
                            sendResponse(response);
                        })
                        .catch(error => {
                            console.error("Error sending RELOAD_AND_EXECUTE_JS to content script:", error);
                            sendResponse({ success: false, message: `无法向当前页面发送命令: ${error.message}` });
                        });
                } else {
                    sendResponse({ success: false, message: '当前激活的标签页无法执行脚本（例如，Chrome内部页面）。请切换到普通网页。' });
                }
            } else {
                sendResponse({ success: false, message: '当前没有活动的有效页面可供执行脚本。' });
            }
        });
        return true;
    }
});