import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from '#game/common/RegistMgr.js';
import UnionMgr from '#game/mgr/UnionMgr.js';

export default class UnionBountyMgr {
    constructor() {
        this.unionId = null;                // 妖盟ID
        this.bountyTimes = 0;               // 悬赏时间
        this.helpTimes = 0;                 // 协助时间
        this.cartList = [];                 // 运镖车辆
        this.monsterList = null;            // 怪兽列表
        this.worshipRedPoint = false;       // 崇拜红点
        this.repointRedPoint = false;       // 是否领取悬赏奖励
        this.groupType = 0;                 // 押送类型1:普通，怪兽不知道呢
        this.myCart = null;                 // 自己的押送车
        this.CHECK_CD = 1000 * 60 * 10;     // 每次间隔时间
        this.lastCheckTime = 0;             // 上次检查时间
        this.initialized = false            // 是否同步妖盟数据

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new UnionBountyMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 推送妖盟数据
    pushMyUnionDataBroadcast(t) {
        this.unionId = t.baseData.unionId || null;
    }

    // 进入悬赏地图
    UnionBountyEnterMapReq() {
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_ENTRY_MAP, {});
    }

    // 获取悬赏信息
    UnionBountyEnterMapResp(t) {
        this.bountyTimes = t.playerData.bountyTimes;
        this.helpTimes = t.playerData.helpTimes;
        this.cartList = t.cartList;
        this.monsterList = t.monsterList || null;
        this.myCart = t.myCart || null;
        this.worshipRedPoint = t.worshipRedPoint;
        this.repointRedPoint = t.repointRedPoint;
        this.groupType = t.groupType
        this.initialized = true;
    }

    // 排行榜膜拜
    UnionBountyWorshipReq() {
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_WORSHIP, {});
        this.worshipRedPoint = true;
        logger.info(`[妖盟悬赏] 排行榜膜拜已完成`)
    }

    // 押镖界面
    UnionBountyOpenBountyEventReq() {
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_OPEN_BOUNTY_EVENT, {});
    }

    // 押镖界面返回&启动押镖
    UnionBountyOpenBountyEventResp(t) {
        // TODO: 只做了普通押送，怪兽没有抓到数据需要等~
        curConfigId = t.bountyInfo.curConfigId;
        logger.info(`[妖盟悬赏] 开始押送悬赏`)
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_DEAL_BOUNTY, { curConfigId: curConfigId, type: this.groupType });
        this.repointRedPoint = true;
        this.bountyTimes += 1;
    }


    // 领取悬赏奖励
    UnionBountyGetRewardEscortReq() {
        logger.info(`[妖盟悬赏] 领取悬赏奖励`)
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_GET_REWARD_ESCORT, {});
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        const now = Date.now();
        if (now - this.lastCheckTime < this.CHECK_CD) return;
        this.lastCheckTime = now
        this.isProcessing = true;
        try {
            let inUnion = UnionMgr.inst.inUnion()
            if (!inUnion) {
                logger.info("[妖盟悬赏] 未加入妖盟");
                this.clear();
                return;
            }
            if (!this.initialized) {
                // 未初始化悬赏信息，进入悬赏地图
                this.UnionBountyEnterMapReq();
                return;
            }
            logger.info(`[妖盟悬赏] 开始检查悬赏进度`)

            // 排行榜膜拜
            if (this.worshipRedPoint) {
                this.UnionBountyWorshipReq()
            }
            // 押镖
            if (this.myCart == null && this.bountyTimes < 2) {
                this.UnionBountyOpenBountyEventReq()
            }
            // 领取悬赏奖励
            if (this.repointRedPoint) {
                this.UnionBountyGetRewardEscortReq()
            }
            // 加入悬赏队伍，可遇不可求~
            if (null != this.monsterList) {
                // TODO: 加入悬赏队伍，可遇不可求
            }
        } catch (error) {
            logger.error(`[妖盟悬赏] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
