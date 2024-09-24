import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class CustomMgr {
    constructor() {
        this.CUSTOM_INTERVAL = 1000 * 60 * 10; // 每次间隔时间(10分钟)
        this.lastExecuteTime = 0;
        this.initialized = false;

        this.isProcessing = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new CustomMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    init() {
        if (this.initialized) {
            return;
        }
        logger.info("[自定义管理] 已初始化");

        // 检查是否有分身 登天后才有的
        if (SystemUnlockMgr.SOARING) {
            GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_GET_SEPARATION_DATAA_MSG_LIST_REQ, {});
        }
        this.initialized = true;
    }

    customLoop() {
        const now = Date.now();
        if (now - this.lastExecuteTime >= this.CUSTOM_INTERVAL) {
            this.lastExecuteTime = now;
            if (SystemUnlockMgr.PUPIL) {
                // 进入宗门系统
                GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_ENTER, {});
                if (global.account.switch.pupil) {
                    GameNetMgr.inst.sendPbMsg(Protocol.S_PUPIL_TRAIN, { isOneKey: 1 });
                }
            }

            if (SystemUnlockMgr.PALACE) {
                // 仙宫外部数据请求
                GameNetMgr.inst.sendPbMsg(Protocol.S_PALACE_ENTER_OUTER, {});
            }

            if (SystemUnlockMgr.GATHERENERGY) {
                // 进入聚灵阵
                GameNetMgr.inst.sendPbMsg(Protocol.S_GATHER_ENERGY_ENTER_NEW, {});
            }

            // 进入余额宝
            if (SystemUnlockMgr.YUE_BAO) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_YUE_BAO_ENTER, { activityId: 10004986 });
            }

            // 道友一键赠送和领取
            GameNetMgr.inst.sendPbMsg(Protocol.S_FRIEND_ONE_KEY, { type: 1 });
            GameNetMgr.inst.sendPbMsg(Protocol.S_FRIEND_ONE_KEY, { type: 2 });

            // 运势
            GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_SHARE, { activityId: 0, conditionId: 0 });
            GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_BBS, { activityId: 0, conditionId: 0 });
            GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_GAME_CIRCLE, { activityId: 0, conditionId: 0 });

            for (let i = 0; i < 30; i++) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_LUCKY_DRAW, { activityId: 250100, times: 1 }); // 运势抽奖
                GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_LUCKY_DRAW, { activityId: 250101, times: 1 }); // 运势抽奖
                GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_LUCKY_DRAW, { activityId: 250102, times: 1 }); // 运势抽奖
                GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_LUCKY_DRAW, { activityId: 250103, times: 1 }); // 运势抽奖
            }

            // 宝华堂
            GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_BUY_MALL_GOODS, { activityId: 9875533, mallId: 400000003, count: 1 });
            // 福泽签到
            for (let i = 0; i < 8; i++) {
                const conditionId = 10000 + i;
                GameNetMgr.inst.sendPbMsg(Protocol.S_GOOD_FORTUNE_GET_REWARD_REQ, { activityId: 9295167, conditionId: conditionId, type: 1 });
            }
            // 疯狂聚宝盆签到
            GameNetMgr.inst.sendPbMsg(Protocol.S_TREASURE_BOWL_SIGN, { activityId: 9265799, conditionId: 10001, getType: 0 });

            // 福地自动收获
            const homelandGetReward = global.account.switch.homelandGetReward || false;
            if (homelandGetReward) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_HOMELAND_GET_REWARD, {});
            }
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            this.customLoop();
        } catch (error) {
            logger.error(`[自定义管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
