import GameNetMgr from "#game/net/GameNetMgr.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class AdRewardMgr {
    constructor() {
        this.isProcessing = false;
        this.INTERVAL = 1000 * 12;
        this.lastExecuteTime = 0;
        this.taskList = [];
        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new AdRewardMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    SyncVip(isVip) {
        logger.info(`[广告管理] 同步VIP状态 ${isVip}`);
        this.INTERVAL = isVip ? 1000 : 30000;
        global.messageDelay = isVip ? 0 : 20; // Vip可以不需要延迟
    }

    AddAdRewardTask(adTask) {
        logger.debug(`[广告管理] 增加待执行任务 ${adTask.protoId}  ${adTask.logStr}`);
        this.taskList.push(adTask);
    }

    async RunAdRewardTask() {
        if (this.taskList.length > 0) {
            let firstTask = this.taskList[0];
            if (firstTask.protoId && firstTask.data) {
                logger.info(`[广告管理] 执行任务 ${firstTask.logStr}`);
                try {
                    GameNetMgr.inst.sendPbMsg(firstTask.protoId, firstTask.data);
                    this.taskList.splice(0, 1); // 确保在任务执行后移除任务
                } catch (error) {
                    logger.error(`[广告管理] 执行任务失败: ${error}`);
                }
            }
        }
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const now = Date.now();
            if (now - this.lastExecuteTime >= this.INTERVAL) {
                this.lastExecuteTime = now;
                await this.RunAdRewardTask();
            }
        } catch (error) {
            logger.error(`[广告管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false; // 确保无论如何都重置 isProcessing
        }
    }
}
