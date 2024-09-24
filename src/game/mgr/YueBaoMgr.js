import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import BagMgr from "#game/mgr/BagMgr.js";
import DBMgr from "#game/common/DBMgr.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class YueBaoMgr {
    constructor() {
        this._model = {
            minDeposit: 100,
            maxDeposit: -200,
            lowParam: 0,
            highParam: 400,
            levelLine: 0,
            limitLevel: 22,
        };

        this.INTERVAL = 1000 * 30;
        this.lastExecuteTime = 0;
        this.isProcessing = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.YUE_BAO) {
            logger.warn(`[余额宝管理] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new YueBaoMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    calculateDepositNum() {
        const realmsId = PlayerAttributeMgr.level;
        const realmConfig = DBMgr.inst.getRealms(realmsId);
        const level = Math.min(realmConfig.type, this._model.limitLevel);
        const depositIncrement = realmConfig.type <= this._model.levelLine ? level * this._model.lowParam : Math.floor((level - 1) / 3 + 1) * this._model.highParam;

        return this._model.maxDeposit + depositIncrement;
    }

    calculateReward(depositNum) {
        return Math.ceil(depositNum * Math.pow(1 + 80 / 1000, 1)) - depositNum;
    }

    // 处理消息，判定取款或存钱
    checkStatus(t) {
        // 计算利率
        const depositNum = this.calculateDepositNum();
        const rewardNum = this.calculateReward(depositNum);

        if (t.ret == 0) {
            const playerData = t.playerData;

            if (playerData) {
                const currentTime = Date.now();
                const endTime = parseInt(playerData.endTime);

                // 当前时间大于结束时间且 endTime 不为0，执行取款操作
                if (endTime > 0 && currentTime > endTime) {
                    logger.info("[余额宝管理] 执行取款操作");
                    GameNetMgr.inst.sendPbMsg(Protocol.S_YUE_BAO_INTERACTE, { activityId: 10004986 });
                }

                // 当 recordList 为空且仙玉大于 depositNum 时，执行存钱操作
                const xianYu = BagMgr.inst.getGoodsNum(100000) || 0;

                if (playerData.depositNum == 0 && playerData.endTime == "0" && xianYu > depositNum) {
                    logger.info(`[余额宝管理] 执行存款操作 存款: ${global.colors.green}${depositNum}${global.colors.reset} 利息: ${global.colors.red}${rewardNum}${global.colors.reset}`);
                    GameNetMgr.inst.sendPbMsg(Protocol.S_YUE_BAO_DEPOSIT, { activityId: 10004986, index: 1, depositNum: depositNum });
                }
            }
        }
    }

    async loopUpdate() {
        if (this.isProcessing || Date.now() - this.lastExecuteTime < this.INTERVAL) return;
        this.isProcessing = true;
        this.lastExecuteTime = Date.now();
        
        try {
            GameNetMgr.inst.sendPbMsg(Protocol.S_YUE_BAO_ENTER, { activityId: 10004986 });
        } catch (error) {
            logger.error(`[余额宝管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }    
}
