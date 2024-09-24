import dependencyInjectorLoader from "#loaders/dependencyInjector.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import logger from '#utils/logger.js';

export default async () => {
    await dependencyInjectorLoader();

    try {
        // Initialize WebSocket
        const { wsAddress, playerId, token } = await GameNetMgr.inst.doLogin();
        GameNetMgr.inst.connectGameServer(wsAddress, playerId, token);

        // Default restart schedule
        const defaultSchedule = [
            { hour: 22, minute: 0, second: 0, delay: 0 },     // 22:00 No delay
            { hour: 23, minute: 59, second: 0, delay: 90000 } // 23:59 Delay 90s
        ];

        // Calculate the time until the next target time
        function getNextTimeout({ hour, minute, second }) {
            const now = new Date();
            const target = new Date();
            target.setHours(hour, minute, second, 0);

            if (target <= now) {
                target.setDate(now.getDate() + 1); // Move to next day if the target is already passed
            }

            return target - now;
        }

        // Schedule the next task
        function scheduleTask({ hour, minute, second, delay }) {
            const timeout = getNextTimeout({ hour, minute, second });
            logger.info(`计划在 ${hour}:${minute}:${second} 进行重启，延迟 ${delay} 毫秒，${(timeout / 1000 / 60).toFixed(2)} 分钟后执行`);

            setTimeout(() => {
                GameNetMgr.inst.reconnect(delay); // Trigger reconnect with the specified delay
                
                scheduleTask({ hour, minute, second, delay }); // Schedule the next execution
            }, timeout);
        }

        // Schedule all tasks based on the default schedule
        defaultSchedule.forEach(scheduleTask);
    } catch (error) {
        logger.error(error.message || error);
    }
};