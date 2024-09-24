import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";
import BagMgr from "#game/mgr/BagMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class UnionMgr {
    constructor() {
        this.unionId = null;            // 妖盟ID
        this.memberNum = null;          // 妖盟成员数量
        this.memberList = null;         // 妖盟成员列表
        this.lastCheckTime = 0;         // 上次检查时间
        this.CHECK_CD = 1000 * 60 * 10; // 每次间隔时间
        this.initialized = false;       // 是否同步妖盟数据
        this.buyUnionGoodLists = global.account.buyUnionGoodLists || [230000011, 230000001, 230000002, 230000005, 230000006, 230000013, 230000014];
        this.buyUnionGoodListsDict = {
            230000001: "小仙桃",
            230000002: "大仙桃",
            230000003: "小灵兽果",
            230000004: "大灵兽果",
            230000005: "小净瓶水",
            230000006: "大净瓶水",
            230000007: "道书",
            230000008: "传说随机精怪碎片",
            230000009: "灵石",
            230000010: "传说精怪碎片",
            230000011: "免费仙桃",
            230000012: "腾蛇信物",
            230000013: "小玄黄果",
            230000014: "大玄黄果",
        };
        this.unionBargainNum = global.account.unionBargainNum || 0;
        this.unionBargainPrice = global.account.unionBargainPrice || 0;
        this.isProcessing = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new UnionMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    inUnion() {
        return this.unionId !== null; // 是否在妖盟中
    }

    collectPlayerData(data) {
        return data.map((member) => ({
            userId: member.playerData.playerId,
            nickName: member.playerData.nickName,
        }));
    }

    // 推送妖盟数据
    pushMyUnionDataBroadcast(t) {
        this.unionId = t.baseData.unionId || null;
        this.memberNum = t.baseData.memberNum || null;
        this.memberList = this.collectPlayerData(t.memberList) || [];

        if (this.inUnion()) {
            logger.info("[妖盟管理] 妖盟广告");
            GameNetMgr.inst.sendPbMsg(Protocol.S_WATCH_AD_TASK, { activityId: 0, conditionId: 120006, isUseADTime: false });
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120001] });
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120002] });
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120003] });
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120004] });
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120005] });
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120006] });
            //购买妖盟商店的商品~
            for (const goodsId of this.buyUnionGoodLists) {
                const name = this.buyUnionGoodListsDict[goodsId] ? this.buyUnionGoodListsDict[goodsId] : "未知商品";
                if (BagMgr.inst.isMallCountZero(goodsId)) {
                    logger.info(`[自动买买买] 妖盟商店 ${name}`);
                    GameNetMgr.inst.sendPbMsg(Protocol.S_MALL_BUY_GOODS, { mallId: goodsId, count: 1, activityId: 0 });
                    BagMgr.inst.setMallCount(goodsId, 1);
                }
            }
        }
        this.initialized = true;
    }

    // 砍价
    cutPriceSyncData(t) {
        if (t) {
            if (t.status == 0) {
                logger.info(`[妖盟管理] ${UserMgr.nickName} 开始砍价`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_CUT_PRICE_BARGAIN, { bussinessId: t.bussinessId });
            }

            if (t.status == 1 && t.bargainPrice.toNumber() >= 2888 - this.unionBargainPrice && t.bargainTimes == t.bargainNum - this.unionBargainNum) {
                logger.info(`[妖盟管理] 砍到最低价，开始购买`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_CUT_PRICE_BUY, { bussinessId: t.bussinessId });
            }
        }
    }

    SyncUnionBossMsg(t) {
        // 检查当前时间是否在允许刷新时间段
        const now = new Date();
        const hours = now.getHours();

        // 一般是晚上0点到2点，中午11点到13点, 进行妖盟讨伐
        const isBattleAllowed = (hours >= 0 && hours < 2) || (hours >= 11 && hours < 13);

        if (isBattleAllowed && t.addBuffCount < 1) {
            logger.info("[妖盟管理] 妖盟讨伐 妖盟布阵");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_ARRAYING, {});
        }

        if (t.buff.overlay == 20 && t.battleCount < 1) {
            logger.info("[妖盟管理] 妖盟讨伐 已满20人开始战斗");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_BATTLE, {});
        } else if (hours >= 21 && t.battleCount < 1) {
            logger.info(`[妖盟管理] 妖盟讨伐 当前${t.buff.overlay}人布阵,${hours}时, 强制开始战斗`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_BATTLE, {});
        }

        if (t.battleCount == 1) {
            logger.info("[妖盟管理] 妖盟讨伐 领取成就奖励");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_RECEIVE_ACHIEVE_REWARD, { taskId: 180001 });
        }
    }

    BossReward(t) {
        // 如果t.rewards非空，则表示有奖励可以领取
        if (t.rewards) {
            logger.debug("[妖盟管理] 妖盟讨伐 妖盟领奖");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_RECEIVE_REWARD, {});
        }
    }

    //请战
    UnionFightApplyDataSync(t) {
        if (true == t.isApply && false == t.isRequest && true == t.isOpen) {
            try {
                logger.info("[妖盟管理] 妖盟请战");
                GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_FIGHT_REQUEST, { unionId: this.unionId });
            } catch {
                logger.info("[妖盟管理] 妖盟请战失败");
            }
        }
    }

    checkDailyTask(t) {
        const actions = [
            { threshold: 150, index: 0 },
            { threshold: 250, index: 1 },
            { threshold: 500, index: 2 },
            { threshold: 750, index: 3 },
            { threshold: 1000, index: 4 },
        ];

        for (const action of actions) {
            if (t.progress >= action.threshold) {
                logger.info(`[妖盟管理] 领取任务收益`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_GETDAILYTASK, { actIndex: action.index });
            }
        }
    }

    LoopCheck() {
        const now = Date.now();
        if (now - this.lastCheckTime >= this.CHECK_CD) {
            // 日常任务
            logger.debug("[妖盟管理] 妖盟日常任务");
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_DAILYTASK, {});

            // 非周末才执行讨伐任务
            if (new Date().getDay() !== 6 && new Date().getDay() !== 0) {
                logger.debug("[妖盟管理] 妖盟讨伐 请求砍价数据");
                GameNetMgr.inst.sendPbMsg(Protocol.S_CUT_PRICE_SYNC, {});
                logger.debug("[妖盟管理] 妖盟讨伐 主动请求妖盟讨伐");
                GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_ENTER, {});
                logger.debug("[妖盟管理] 妖盟讨伐 领取妖盟讨伐奖励");
                GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOSS_GET_REWARD_INFO, {});
            }

            this.lastCheckTime = now;
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        if (!this.initialized) return;
        this.isProcessing = true;

        try {
            if (!this.unionId) {
                logger.info("[妖盟管理] 未加入妖盟");
                this.clear();
                return;
            } else {
                this.LoopCheck();
            }
        } catch (error) {
            logger.error(`[妖盟管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
