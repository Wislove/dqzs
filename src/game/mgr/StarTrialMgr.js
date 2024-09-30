import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";

export default class StarTrialMgr {
    constructor() {
        this.isProcessing = false;
        this.enabled = global.account.switch.starTrial || false;
        this.challengeTimes = 30;
        this.rewardState = 0;
        this.lastBossId = 0;

        this.fightLock = true;
        this.initialized = false;
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

    StarTrialDataMsg(t) {
        this.challengeTimes = t.challengeTimes
        this.bossId = t.bossId
        this.rewardState = t.rewardState;

        this.initialized = true;
        this.fightLock = false;
    }

    StarTrialChallengeResp(t) {
        if (t.ret === 0) {
            logger.info(`[星宿试炼] 挑战星宿结果:${t.allBattleRecord.isWin ? '成功' : '失败'}`);
        }

        this.fightLock = false;
    }

    StarTrialChallenge() {
        if (this.fightLock) {
            logger.debug(`[星宿试炼] 挑战星宿数据暂未同步,或上一次挑战结果未返回`);
            return;
        }

        this.initialized = false;
        this.fightLock = true;
        // 开始战斗
        this.lastBossId = this.bossId
        logger.info(`[星宿试炼] 挑战星宿`)
        GameNetMgr.inst.sendPbMsg(Protocol.S_STARTRIAL_Fight, { BossId: this.bossId });
        this.challengeTimes--;
        //开始领奖
        if (this.rewardState == 0) {
            logger.info(`[星宿试炼] 领取每日奖励奖`)
            GameNetMgr.inst.sendPbMsg(Protocol.S_STARTRIAL_GetDailyFightReward, {});
        }
    }

    async loopUpdate() {
        if (!this.enabled || !this.initialized) return;
        if (this.isProcessing) return;
        this.isProcessing = true;
        try {
            if (this.challengeTimes <= 20) {
                logger.info(`[星宿试炼] 任务完成,停止循环`)
                this.clear();
                return
            }
            if (this.lastBossId == this.bossId) {
                logger.info(`[星宿试炼] 无法杀死星宿,任务终止`)
                this.clear();
                return
            }

            // 开始挑战
            this.StarTrialChallenge();
        } catch (error) {
            logger.error(`[星宿试炼] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false
        }
    }
}
