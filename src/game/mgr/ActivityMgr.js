import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";

export default class ActivityMgr {
    constructor() {
        // 存储已激活的活动 ID
        this.activatedActivities = new Set();
        this.pushActivityList = [];
        this.activityCommonDataList = [];
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new ActivityMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    // 接收活动下发数据
    async SyncData(t) {
        this.pushActivityList = t;
        logger.info(`[活动管理] 活动数据下发`)
    }

    // 活动通用数据同步
    ActivityCommonDataListSync(t) {
        logger.info(`[活动管理] 活动通用数据同步`)
        this.activityCommonDataList = t;
    }

    // t.activity.detailConfig.commonConfig.mainConfig
    // {
    //     "activityId": 10012081,
    //     "type": 131,
    //     "childType": 1,
    //     "beginShowTime": "1726070400000",
    //     "endShowTime": "1726502400000",
    //     "beginTime": "1726070400000",
    //     "endTime": "1726408800000",
    //     "serverId": Array[32],
    //     "groupType": 0
    // },
    // 1002 1007, 获取任务详情,包含了领东西的逻辑
    RspGetActivityDetail(t) {
        const activityMgrEnabled = global.account.switch.activity || false;
        if (!activityMgrEnabled) {
            logger.debug(`[活动管理] 未开启`);
            return;
        }

        const acts = t.activity.conditionDataList;
        if (acts) {
            const activityId = t.activity.activityId;

            // 黑名单会跳过
            const blackList = []
            if (blackList.includes(activityId)) {
                logger.debug(`[活动管理] ${activityId} 被跳过`);
                return;
            }

            for (const i of acts) {
                if (!i.isGetReward && i.completeTime.toString() !== "0") {
                    logger.debug(`[活动管理] ${activityId} 满足条件领取奖励: ${i.conditionId}`);
                    GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_GET_CONDITION_REWARD, { activityId: activityId, conditionId: i.conditionId });
                }
            }
        }
        this.buyFree({ "activityDataList": [t.activity] })
    }

    // 1003
    buyFree(t) {
        const acts = t.activityDataList;
        if (!acts) return;

        acts.forEach(i => {
            const mallConfig = i.detailConfig?.commonConfig?.mallConfig || [];
            mallConfig.filter(item => item.mallTempMsg.price === "100000=0").forEach(item => {
                const activityId = item.activityId;
                const { id, buyLimit, name } = item.mallTempMsg;

                // 黑名单会跳过
                const blackList = [9655276, 9712892, 9655196]
                if (blackList.includes(activityId)) {
                    logger.debug(`[活动管理] ${activityId} 被跳过`);
                    return;
                }

                // 检查活动是否已经激活过
                if (!this.activatedActivities.has(activityId)) {
                    GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_MESSAGE_LIST, { activityId: activityId });
                    this.activatedActivities.add(activityId);
                    logger.debug(`[活动管理] 活动 ${activityId} 激活成功`);


                    const logAndBuy = (remaining) => {
                        logger.debug(`[活动管理] ${activityId} 购买 ${name} ${remaining}次`);
                        for (let i = 0; i < remaining; i++) {
                            const logContent = `[活动管理] ${activityId} 购买 ${name} 第 ${i + 1}/${remaining}次`;
                            AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_ACTIVITY_BUY_MALL_GOODS, data: { activityId: activityId, mallId: id, count: 1 }, logStr: logContent });
                        }
                    };

                    if (!i.mallBuyCountList || i.mallBuyCountList.length === 0) {
                        logAndBuy(buyLimit);
                    } else {
                        const boughtItem = i.mallBuyCountList.find(j => j.mallId === id);
                        const boughtCount = boughtItem ? boughtItem.count.toNumber() : 0;
                        if (boughtCount < buyLimit) {
                            logAndBuy(buyLimit - boughtCount);
                        }
                    }
                }
            });
        });
    }
}
