import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";

/**
 * 灵兽内丹：
 * 
 * 免费领取内丹
 */
export default class PetKernelMgr {
    constructor() {
        this.FREE_NUM = 2; // 免费内胆上限
        this.initialized = false;

        this.isProcessing = false;
    }

    static get inst() {
        if (!SystemUnlockMgr.PET_KERNEL) {
            logger.warn("[灵兽内丹] 灵兽内丹未解锁");
            return null;
        }

        if (!this._instance) {
            this._instance = new PetKernelMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 同步灵兽内丹数据:来自PetMgr
    syncPetKernelMsg(t) {
        this.isProcessing = true;
        logger.debug(`[灵兽内丹]内丹数据初始化,初始化数据次数,freeDrawTimes: ${t.freeDrawTimes}, drawCount: ${t.drawCount}`);
        
        // 内丹
        this.freeDrawTimes = t?.freeDrawTimes??2;
        this.initialized = true;
        
        this.isProcessing = false;
    }

    // 抽取免费内丹
    processReward() {
        if (this.freeDrawTimes < this.FREE_NUM) {
            logger.info(`[灵兽内丹] 还剩 ${this.FREE_NUM - this.freeDrawTimes} 次免费次数`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_PET_KERNEL_DRAW, { isTen: false });
            this.freeDrawTimes++;
        }
    }

    async loopUpdate() {
        if (!this.initialized) return;
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 暂停一下再处理（第一次同步数量是2，后续同步是0，所以简单暂停，等待数据同步）
            await new Promise(resovle => setTimeout(resovle, 6 * 1000));

            if (this.freeDrawTimes == 2) {
                logger.info(`[灵兽内丹] 达到每日最大领取次数，停止奖励领取`);
                this.clear();
                return;
            } else {
                this.processReward();
            }
        } catch (error) {
            logger.error(`[灵兽内丹] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
