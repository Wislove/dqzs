import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class PetsMgr {
    constructor() {
        this.FREE_NUM = 2; // 免费内胆上限
        this.initialized = false;

        this.isProcessing = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new PetsMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 同步玩家灵兽数据
    SyncPlayerPetDataMsg(t) {
        this.isProcessing = true;
        if (!this.initialized) {
            // 内丹
            this.freeDrawTimes = t && t.kernelData ? t.kernelData.freeDrawTimes : 2;
            this.initialized = true;
        }
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
            if (SystemUnlockMgr.PET_KERNEL) {
                if (this.freeDrawTimes == 2) {
                    logger.info(`[灵兽内丹] 达到每日最大领取次数，停止奖励领取`);
                    this.clear();
                    return;
                } else {
                    this.processReward();
                }
            }
        } catch (error) {
            logger.error(`[灵兽内丹] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
