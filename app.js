import initialize from "#loaders/index.js";
import fs from 'fs';
import path from 'path';
import logger from "#utils/logger.js";

async function start() {
    const configFile = process.argv[2] || './account.json';
    const configPath = path.resolve(configFile);

    if (!fs.existsSync(configPath)) {
        logger.error(`读取account失败:${configFile}`);
        return;
    }
    
    const data = fs.readFileSync(configPath, 'utf8');
    const account = JSON.parse(data);

    global.account = account;   // 设置 global.account
    global.colors = {
        reset: "\x1b[0m",       // 重置颜色

        // 常见前景色
        black: "\x1b[30m",      // 黑色
        red: "\x1b[31m",        // 红色
        green: "\x1b[32m",      // 绿色
        yellow: "\x1b[33m",     // 黄色
        blue: "\x1b[34m",       // 蓝色
        magenta: "\x1b[35m",    // 品红（洋红）
        cyan: "\x1b[36m",       // 青色
        white: "\x1b[37m",      // 白色
    };
    global.configFile = configPath;
    global.messageDelay = 20;   // 默认延迟

    await initialize();
}

start();