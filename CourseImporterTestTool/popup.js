// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const startTestButton = document.getElementById('startTestButton');
    const statusMessage = document.getElementById('statusMessage');

    // 初始状态提示
    statusMessage.innerText = '请先打开教务系统并登录，然后点击开始测试。';
    statusMessage.className = 'info';

    startTestButton.addEventListener('click', () => {
        statusMessage.innerText = '正在发送命令，请查看页面控制台...';
        statusMessage.className = 'info';

        // 发送消息到 background script，请求重新执行 JS
        // background script 会将此请求转发给当前活动的 content script
        chrome.runtime.sendMessage({ type: 'RELOAD_AND_EXECUTE_JS_REQUEST' })
            .then(response => {
                if (response.success) {
                    statusMessage.className = 'success';
                    statusMessage.innerText = response.message;
                } else {
                    statusMessage.className = 'error';
                    statusMessage.innerText = `操作失败: ${response.message}`;
                }
            })
            .catch(error => {
                statusMessage.className = 'error';
                statusMessage.innerText = `与后台通信失败: ${error.message}`;
            });
    });

    // 监听来自 Background Script 的 JS 执行状态更新
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'JS_EXECUTION_STATUS') {
            if (request.success) {
                statusMessage.className = 'success';
                statusMessage.innerText = request.message;
            } else {
                statusMessage.className = 'error';
                statusMessage.innerText = request.message;
            }
            sendResponse(true); // 确认收到消息
        }
    });
});