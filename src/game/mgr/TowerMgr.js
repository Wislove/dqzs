import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import PalaceMgr from "#game/mgr/PalaceMgr.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";

export default class TowerMgr {
    constructor() {
        this.isSyncing = false;
        this.isProcessing = false;
        this.data = {};
        this.hasReward = false;
        this.challenge = global.account.switch.challenge;
        this.showResult = global.account.switch.showResult || false;
        this.challengeSuccessReset = global.account.switch.challengeSuccessReset || false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new TowerMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    SyncData(t) {
        this.isSyncing = true;
        this.data = t || {};
        if (this.data.curPassId !== 0) {
            logger.info("[镇妖塔管理] 一键选择!!!");
            GameNetMgr.inst.sendPbMsg(Protocol.S_TOWER_SELECT_BUFF, { index: 0, isOneKey: true });
        }
        this.isSyncing = false;
    }

    challengeResult(t) {
        const currentStage = t.towerDataSync.curPassId % 10 === 0 ? 10 : t.towerDataSync.curPassId % 10;
        const isWinText =
            t.allBattleRecord.isWin == true ? `${global.colors.red}成功${global.colors.reset}` : `${global.colors.yellow}失败${global.colors.reset}`;

        if (this.showResult) {
            logger.info(`[镇妖塔管理] ${isWinText} ${Math.ceil(t.towerDataSync.curPassId / 10)}层${currentStage}关 剩余次数:${this.challenge}`);
        }

        if (currentStage == 10 && t.allBattleRecord.isWin == true) {
            logger.info("[镇妖塔管理] 一键选择!!!");
            GameNetMgr.inst.sendPbMsg(Protocol.S_TOWER_SELECT_BUFF, { index: 0, isOneKey: true });
        }

        if (t.ret === 0) {
            if (t.allBattleRecord.isWin) {
                if (this.challengeSuccessReset) {
                    this.challenge = global.account.switch.challenge;
                }
            }
        }
    }

    processReward() {
        if (this.data.curPassId == 0) {
            if (SystemUnlockMgr.PALACE) {
                if (!PalaceMgr.inst.checkIsMiracle) {
                    return;
                }
            }
            logger.info("[镇妖塔管理] 开始领取镇妖塔奖励");
            // 1017增伤 1018减伤 1023强灵 1001攻击 第五个为空
            GameNetMgr.inst.sendPbMsg(Protocol.S_TOWER_VIEW_SAVE_SELECT, {
                markPreference: [
                    { priority: 1, skillType: 1017 },
                    { priority: 2, skillType: 1018 },
                    { priority: 3, skillType: 1023 },
                    { priority: 4, skillType: 1001 },
                    { priority: 5, skillType: 0 },
                ],
            });
            GameNetMgr.inst.sendPbMsg(Protocol.S_TOWER_QUICK_CHANLLENGE, {});
            GameNetMgr.inst.sendPbMsg(Protocol.S_TOWER_SELECT_BUFF, { index: 0, isOneKey: true });
            this.hasReward = true;
        }
    }

    async loopUpdate() {
        if (!this.hasReward) this.processReward();
        if (!WorkFlowMgr.inst.canExecute("Challenge")) return;
        if (this.isProcessing || this.isSyncing) return;
        this.isProcessing = true;

        try {
            if (this.challenge == 0) {
                this.clear();
                logger.info("[镇妖塔管理] 任务完成停止循环");
                // 任务完成后切换为默认分身
                PlayerAttributeMgr.inst.switchToDefaultSeparation();
            } else {
                // 切换到分身
                const idx = global.account.switch.challengeIndex || 0;
                PlayerAttributeMgr.inst.setSeparationIdx(idx);
                // 挑战
                GameNetMgr.inst.sendPbMsg(Protocol.S_TOWER_CHALLENGE, { index: 0, isOneKey: true });
                this.challenge--;
                await new Promise((resolve) => setTimeout(resolve, 1000 * 10));
            }
        } catch (error) {
            logger.error(`[镇妖塔管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
