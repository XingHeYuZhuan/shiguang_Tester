// 文件: school.js

//显示一个公告信息弹窗
async function demoAlert() {
    try {
        console.log("即将显示公告弹窗...");
        const confirmed = await window.AndroidBridgePromise.showAlert(
            "重要通知",
            "这是一个使用 async/await 的弹窗示例。",
            "好的"
        );
        if (confirmed) {
            console.log("用户点击了确认按钮。Alert Promise Resolved: " + confirmed);
            AndroidBridge.showToast("Alert：用户点击了确认！");
        } else {
            console.log("用户点击了取消按钮或关闭了弹窗。Alert Promise Resolved: " + confirmed);
            AndroidBridge.showToast("Alert：用户取消了！");
        }
    } catch (error) {
        console.error("显示公告弹窗时发生错误:", error);
        AndroidBridge.showToast("Alert：显示弹窗出错！" + error.message);
    }
}

//显示带输入框的弹窗，并进行简单验证
function validateName(name) {
    if (name === null || name.trim().length === 0) {
        return "输入不能为空！";
    }
    if (name.length < 2) {
        return "姓名至少需要2个字符！";
    }
    return false; // 返回 false 表示验证通过
}

async function demoPrompt() {
    try {
        console.log("即将显示输入框弹窗...");
        const name = await window.AndroidBridgePromise.showPrompt(
            "输入你的姓名",
            "请输入至少2个字符",
            "测试用户",
            "validateName" // 传递验证函数的名称字符串，Compose UI 会调用它
        );
        if (name !== null) {
            console.log("用户输入的姓名是: " + name);
            AndroidBridge.showToast("欢迎你，" + name + "！");
        } else {
            console.log("用户取消了输入。");
            AndroidBridge.showToast("Prompt：用户取消了输入！");
        }
    } catch (error) {
        console.error("显示输入框弹窗时发生错误:", error);
        AndroidBridge.showToast("Prompt：显示输入框出错！" + error.message);
    }
}

//显示一个单选列表弹窗
async function demoSingleSelection() {
    const fruits = ["苹果", "香蕉", "橙子", "葡萄", "西瓜", "芒果"];
    try {
        console.log("即将显示单选列表弹窗...");
        const selectedIndex = await window.AndroidBridgePromise.showSingleSelection(
            "选择你喜欢的水果",
            JSON.stringify(fruits), // 必须是 JSON 字符串
            2 // 默认选中索引为 2 的项 (橙子)
        );
        if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < fruits.length) {
            console.log("用户选择了: " + fruits[selectedIndex] + " (索引: " + selectedIndex + ")");
            AndroidBridge.showToast("你选择了 " + fruits[selectedIndex]);
        } else {
            console.log("用户取消了选择。");
            AndroidBridge.showToast("Single Selection：用户取消了选择！");
        }
    } catch (error) {
        console.error("显示单选列表弹窗时发生错误:", error);
        AndroidBridge.showToast("Single Selection：显示列表出错！" + error.message);
    }
}

//显示 Toast 消息 (这个不需要 Promise，因为它不返回结果)
AndroidBridge.showToast("这是一个来自 JS 的 Toast 消息，会很快消失！");


//模拟课程数据的保存操作
async function demoSaveCourses() {
    console.log("正在准备测试课程数据...");

    const testCourses = [
        {
            "name": "高等数学",
            "teacher": "张教授",
            "position": "教101",
            "day": 1, // 星期一
            "timeRange": {
                "start": 1,
                "end": 2
            },
            "weeks": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
        },
        {
            "name": "大学英语",
            "teacher": "李老师",
            "position": "文史楼203",
            "day": 3, // 星期三
            "timeRange": {
                "start": 3,
                "end": 5
            },
            "weeks": [1, 3, 5, 7, 9, 11, 13, 15]
        },
        {
            "name": "数据结构",
            "teacher": "王副教授",
            "position": "信息楼B301",
            "day": 5, // 星期五
            "timeRange": {
                "start": 6,
                "end": 8
            },
            "weeks": [2, 4, 6, 8, 10, 12, 14, 16]
        }
    ];

    try {
        console.log("正在尝试导入课程...");
        const result = await window.AndroidBridgePromise.saveImportedCourses(JSON.stringify(testCourses, null, 2));
        if (result === "true") { // 根据 AndroidBridge.kt 中的 resolveJsPromise("true") 约定
            console.log("课程导入成功！");
            AndroidBridge.showToast("测试课程导入成功！");
        } else {
            console.log("课程导入未成功，结果：" + result);
            AndroidBridge.showToast("测试课程导入失败，请查看日志。");
        }
    } catch (error) {
        console.error("导入课程时发生错误:", error);
        AndroidBridge.showToast("导入课程失败: " + error.message);
    }
}

// 编排这些异步操作，确保它们按顺序执行
async function runAllDemosSequentially() {
    // 首先显示 Toast，因为它不阻塞
    AndroidBridge.showToast("所有演示将按顺序开始...");

    // 顺序执行弹窗演示，每个 await 都会等待用户操作完成
    await demoAlert();
    await demoPrompt();
    await demoSingleSelection();

    console.log("所有弹窗演示已完成。");
    AndroidBridge.showToast("所有弹窗演示已完成！");

    await demoSaveCourses();
}

// 启动所有演示
runAllDemosSequentially();