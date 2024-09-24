import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class StarTrialMgr {
    constructor() {
        this.isProcessing = false;
        this.enabled = global.account.switch.starTrial || false;
        this.challengeTimes = 30
        this.rewardState = 0
        this.lastBossId = 0
        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.STARTRIAL) {
            logger.warn(`[星宿试炼] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new StarTrialMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    SyncStarTrialData(t) {
        this.challengeTimes = t.challengeTimes
        this.bossId = t.bossId
        this.rewardState = t.rewardState
    }

    StarTrialChallenge() {
        // 开始战斗
        this.lastBossId = this.bossId
        logger.info(`[星宿试炼] 挑战星宿`)
        GameNetMgr.inst.sendPbMsg(Protocol.S_STARTRIAL_Fight, { BossId: this.bossId });
        this.challengeTimes--
        //开始领奖
        if (this.rewardState == 0) {
            logger.info(`[星宿试炼] 领取每日奖励奖`)
            GameNetMgr.inst.sendPbMsg(Protocol.S_STARTRIAL_GetDailyFightReward, {});
        }
    }

    async loopUpdate() {
        if (!this.enabled) return
        if (this.isProcessing) return
        this.isProcessing = true
        try {
            if (this.challengeTimes <= 20) {
                logger.info(`[星宿试炼] 任务完成,停止循环`)
                this.clear()
                return
            }
            if (this.lastBossId == this.bossId) {
                logger.info(`[星宿试炼] 无法杀死星宿,任务终止`)
                this.clear()
                return
            }
            this.StarTrialChallenge()
            //防止执行过快
            await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
            logger.error(`[星宿试炼] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false
        }
    }
}
