import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import UnionMgr from '#game/mgr/UnionMgr.js';
import DBMgr from "#game/common/DBMgr.js";

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

    // 获取悬赏信息（这里会同步多次，数据可能不一致）
    UnionBountyEnterMapResp(t) {
        this.bountyTimes = t.playerData.bountyTimes;
        this.helpTimes = t.playerData.helpTimes;
        this.cartList = t.cartList;
        this.monsterList = t.monsterList || null;
        this.myCart = t.myCart || null;
        this.worshipRedPoint = t.worshipRedPoint;
        this.repointRedPoint = t.repointRedPoint;
        this.groupType = t.groupType;
    }

    // 排行榜膜拜
    UnionBountyWorshipReq() {
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_WORSHIP, {});
        this.worshipRedPoint = true;
        logger.info(`[妖盟悬赏] 排行榜膜拜已完成`)
    }

    // 请求打开悬赏界面
    UnionBountyOpenBountyEventReq() {
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_OPEN_BOUNTY_EVENT, {});
    }

    // 押镖界面返回&启动押镖
    async UnionBountyOpenBountyEventResp(t) {
        // 玩家数据同步
        this.bountyTimes = t.playerData.bountyTimes;
        this.helpTimes = t.playerData.helpTimes;

        //悬赏信息, 只做了普通押送，怪兽没有抓到数据需要等~
        const curConfigId = t.bountyInfo.curConfigId;

        // 判断是否完成，完成了领取奖励，未完成，则判断myCart在地图上有没有，没有就开始押送，有就继续等待完成
        const finishReward = t.bountyInfo.finishReward;
        if (finishReward) {
            const reward = finishReward?.reward.spilt('|');
            logger.info(`[妖盟悬赏] 悬赏完成,奖励领取,奖励内容:${reward.array.map(element => {
                const [key, value] = element.spilt('=');
                return `奖励名称: ${DBMgr.inst.getLanguageWord(`Items-${key}`)}, 数量:${value}`
            })}`);

            // 领取悬赏奖励
            this.UnionBountyGetRewardEscortReq();
            // sleep 1秒钟后继续
        } else {
            if (this.myCart == null && this.bountyTimes < 2) {
                logger.info(`[妖盟悬赏] 开始押送悬赏`)
                GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_DEAL_BOUNTY, { curConfigId: curConfigId, type: this.groupType });
                this.bountyTimes += 1;
            }
        }
    }


    // 领取悬赏奖励
    UnionBountyGetRewardEscortReq() {
        logger.info(`[妖盟悬赏] 领取悬赏奖励`)
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_BOUNTY_GET_REWARD_ESCORT, {});
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        try {
            const inUnion = UnionMgr.inst.inUnion()
            if (!inUnion) {
                logger.info("[妖盟悬赏] 未加入妖盟");
                this.clear();
                return;
            }

            // 检查cd间隔
            const now = new Date();
            if (now.getHours() < 8 || now.getHours() > 22) {
                return;
            }
            if (now - this.lastCheckTime < this.CHECK_CD) {
                return;
            }
            this.lastCheckTime = now;

            logger.info(`[妖盟悬赏] 开始检查妖盟悬赏进度`);
            // 进入悬赏地图（已经10分钟一次了，没必要再初始化标识）
            this.UnionBountyEnterMapReq();
            // sleep 2秒确保同步数据准确
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 排行榜膜拜
            if (this.worshipRedPoint) {
                this.UnionBountyWorshipReq();
                // sleep 0.5秒
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 不管条件，都请求打开悬赏栏
            this.UnionBountyOpenBountyEventReq();
            // sleep 2秒等待悬赏返回结果处理
            await new Promise(resolve => setTimeout(resolve, 2000));


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
