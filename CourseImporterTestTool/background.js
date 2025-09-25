// 文件: background.js

// 临时数据缓存，用于在执行结束后合并下载
let cachedCourses = null;
let cachedTimeSlots = null;

// 合并下载
function tryMergeAndExport() {
    console.log("收到脚本完成信号，正在触发合并下载...");

    const exportData = {
        // 即使是 null，也会被 JSON.stringify 序列化为 null
        courses: cachedCourses,
        timeSlots: cachedTimeSlots
    };
    // 强制转换为 JSON 字符串，即使数据为 null，输出也会是 {"courses": null, "timeSlots": null}
    const exportJsonString = JSON.stringify(exportData, null, 2); 

    // 如果数据都为 null，日志中会显示“合并下载未能启动”，但下载操作本身会被尝试。
    if (cachedCourses === null && cachedTimeSlots === null) {
        console.warn("注意：脚本完成时课程和时间段数据都为空 (null)，将下载空文件。");
    }

    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(exportJsonString);

    chrome.downloads.download({
        url: dataUrl,
        filename: 'CourseTableExport.json',
        saveAs: true
    }, (downloadId) => {
        // 下载启动后，重置缓存以便下次使用
        cachedCourses = null;
        cachedTimeSlots = null;
        if (downloadId) {
            console.log(`合并下载已启动，ID: ${downloadId}`);
        } else {
            console.error("合并下载未能启动。", chrome.runtime.lastError);
        }
    });
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab ? sender.tab.id : null;

    // 处理页面发来的桥接调用
    if (message.type === 'BRIDGE_CALL_FROM_PAGE') {
        const { method, args, messageId } = message;

        switch (method) {
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

            case 'showAlert':
            case 'showPrompt':
            case 'showSingleSelection':
                const dialogPromiseId = messageId; 
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

            case 'saveImportedCourses':
                const coursesJsonString = args[0];
                const savePromiseId = args[1];

                try {
                    cachedCourses = JSON.parse(coursesJsonString);
                    console.log("课程数据已缓存。等待 'notifyTaskCompletion' 触发下载。");
                    
                    chrome.tabs.sendMessage(tabId, {
                        type: 'RESOLVE_PROMISE_IN_PAGE',
                        messageId: savePromiseId,
                        value: true,
                        isError: false
                    });
                } catch (e) {
                    console.error("解析课程数据时出错:", e);
                    chrome.tabs.sendMessage(tabId, {
                        type: 'RESOLVE_PROMISE_IN_PAGE',
                        messageId: savePromiseId,
                        value: `解析课程数据时出错: ${e.message}`,
                        isError: true
                    });
                }
                
                sendResponse({ success: true });
                return true;
                
            case 'savePresetTimeSlots':
                const timeSlotsJsonString = args[0];
                const timeSlotsPromiseId = args[1];

                try {
                    cachedTimeSlots = JSON.parse(timeSlotsJsonString);
                    console.log("时间段数据已缓存。等待 'notifyTaskCompletion' 触发下载。");
                    
                    chrome.tabs.sendMessage(tabId, {
                        type: 'RESOLVE_PROMISE_IN_PAGE',
                        messageId: timeSlotsPromiseId,
                        value: true,
                        isError: false
                    });
                } catch (e) {
                    console.error("解析时间段数据时出错:", e);
                    chrome.tabs.sendMessage(tabId, {
                        type: 'RESOLVE_PROMISE_IN_PAGE',
                        messageId: timeSlotsPromiseId,
                        value: `解析时间段数据时出错: ${e.message}`,
                        isError: true
                    });
                }

                sendResponse({ success: true });
                return true;
                
            case 'notifyTaskCompletion':
                console.log("接收到 notifyTaskCompletion 信号，触发数据导出。");
                tryMergeAndExport(); // 此时触发下载
                sendResponse({ success: true });
                break; // 这是一个 fire-and-forget 的同步桥接调用

            default:
                console.warn('Unknown AndroidBridge method:', method);
                sendResponse({ success: false, message: 'Unknown AndroidBridge method' });
                break;
        }
    }
    if (message.type === 'EXPORT_DATA_REQUEST') {
        console.log("收到 EXPORT_DATA_REQUEST，正在尝试触发下载...");
        tryMergeAndExport();
        sendResponse({ success: true });
        return true;
    }

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