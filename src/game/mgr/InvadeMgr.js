import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import PlayerAttributeMgr from "./PlayerAttributeMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";

export default class InvadeMgr {
    constructor() {
        this.isProcessing = false;
        this.enabled = global.account.switch.invade || false;
        this.maxCount = 5;
        this.battleNum = 0;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.INVADE) {
            logger.warn(`[异兽入侵] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new InvadeMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    InvadeDataMsg(t) {
        this.battleNum = t.count;
        this.curInvadeId = t.curInvadeId;
    }

    InvadeChallengeResp(t) {
        if (t.ret == 0) {
            logger.info(`[异兽入侵] 挑战成功`);
        }
    }

    completeTask() {
        logger.info(`[异兽入侵] 任务完成`);
        PlayerAttributeMgr.inst.switchToDefaultSeparation(); // 切换到默认分身
        this.clear();
        WorkFlowMgr.inst.remove("Invade");
    }

    async loopUpdate() {
        if (!WorkFlowMgr.inst.canExecute("Invade") || !this.enabled || this.isProcessing) return;

        this.isProcessing = true;
        try {
            if (this.battleNum >= this.maxCount) {
                this.completeTask(); // 如果达到最大挑战次数，任务完成
                return;
            }

            logger.debug("[异兽入侵] 初始化");
            logger.info(`[异兽入侵] 当前次数: ${this.battleNum}`);

            // 切换到分身
            const idx = global.account.switch.invadeIndex || 0;
            PlayerAttributeMgr.inst.setSeparationIdx(idx);

            // 挑战
            GameNetMgr.inst.sendPbMsg(Protocol.S_INVADE_CHALLENGE, {});
            this.battleNum++;
        } catch (error) {
            logger.error(`[异兽入侵] InvadeDataMsg error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
