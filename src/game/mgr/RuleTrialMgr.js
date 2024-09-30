import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";

export default class RuleTrialMgr {
    constructor() {
        this.isProcessing = false;
        this.isRepeated = false;

        this.initialized = false;
    }

    static get inst() {
        if (!SystemUnlockMgr.RULE_TRIAL) {
            logger.warn(`[法则试练] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new RuleTrialMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    RuleTrialDataSync(t) {
        this.isRepeated = t.isRepeated;
        this.initialized = true;
    }

    async loopUpdate() {
        if (this.isProcessing || !this.initialized) return;
        this.isProcessing = true;
        try {
            if (this.isRepeated) {
                logger.info(`[法则试练] 速战已完成,终止任务`);
                this.clear();
                return;
            }
            logger.info(`[法则试练] 速战开始`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_RULE_ONE_KEY_TRIAL_REPEAT, {});
        } catch (error) {
            logger.error(`[法则试练] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
