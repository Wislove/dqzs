import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import DBMgr from "#game/common/DBMgr.js";

const actNameMap = {
    10132651: "仙域商途",
    10139629: "涂山续缘",
    10115407: "秘境探宝",
    450016: "精怪轮回",
    450017: "玄决轮回",
    450018: "神通轮回",
    450019: "仙居建筑轮回",
    9788734: "仙缘-礼包",
    9788712: "仙途共聚",
    250032: "运势-灵兽运势",
    250033: "运势-精怪运势",
    250034: "运势-神通运势",
    9788790: "超值礼包-超值礼包",
    9788786: "超值礼包-自选礼包",
    10129151: "超值礼包-累充",
    10083438: "玄尘忆梦",
    10144293: "妖盟攻城战",
    10143166: "炼器大会",
    10146633: "飞剑夺宝",
    10145312: "修罗战场",
    10150771: "蓬莱仙岛"
}

/**
 * 通用活动
 */
export default class ActivityMgr {
    constructor() {
        // 存储已激活的活动 ID
        this.activatedActivities = new Set();
        this.blackActId = [9788692, 9788784, 9788754];

        // 活动主数据map
        this.actMainConfigMap = {};
        // 活动通用数据map
        this.actCommonDataMap = {};
        // ActivityCommonData.detailConfig
        this.actDetailConfigMap = {};
        this.actConditionDataMap = {};
        this.actMallBuyCountDataMap = {};

        this.isProcessing = false;
        this.LOOP_CHECK_CD = 15 * 60 * 1000;
        this.lastLoopCheckTime = 0;
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new ActivityMgr();
        }
        return this._instance;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    reset() {
        this._instance = null;
    }

    // 接收活动下发数据
    async SyncData(t) {
        this.isProcessing = true;

        t.mainConfig.forEach(item => {
            this.actMainConfigMap[item.activityId] = item;
        });

        this.isProcessing = false;
    }

    // 活动通用数据同步
    async ActivityCommonDataListSync(t) {
        this.isProcessing = true;

        // 通用活动同步
        t.activityDataList.forEach(item => {
            this.actCommonDataMap[item.activityId] = item;
            this.actDetailConfigMap[item.activityId] = item.detailConfig;
            this.actConditionDataMap[item.activityId] = item.conditionDataList;
            this.actMallBuyCountDataMap[item.activityId] = item.mallBuyCountList;
        });

        this.isProcessing = false;
    }

    // 活动详情同步
    async RspGetActivityDetail(t) {
        const activitCommonData = t.activity;

        // 同步活动数据
        this.actCommonDataMap[activitCommonData.activityId] = activitCommonData;
        this.actDetailConfigMap[activitCommonData.activityId] = activitCommonData.detailConfig;
        this.actConditionDataMap[activitCommonData.activityId] = activitCommonData.conditionDataList;
        this.actMallBuyCountDataMap[activitCommonData.activityId] = activitCommonData.mallBuyCountList;

        // 处理免费奖励
        this.processFreeAndAdReward(activitCommonData.activityId);
        // 处理满足条件奖励
        this.processConditionReward(activitCommonData.activityId);
    }

    // 检测活动是否能够处理，返回true代表能，false不能
    async checkActIsCanHandle(activityId) {

        if (this.blackActId.includes(Number(activityId))) {
            return false;
        }

        const actMainConfig = this.actMainConfigMap[activityId];
        // 先判断活动是否开始和结束
        const now = Date.now();
        const notBegin = now < Number(actMainConfig.beginTime);
        const hasEnd = now > Number(actMainConfig.endTime);
        if (notBegin || hasEnd) {
            logger.debug(`[活动管理] 活动: ${activityId} 名称: ${actNameMap[activityId] ?? "活动名称未知"} 未开始或已经结束`);
            return false;
        }

        return true;
    }

    // 处理活动满足条件的奖励领取
    async processConditionReward(activityId) {
        const activityCanHandle = await this.checkActIsCanHandle(activityId);
        if (!activityCanHandle) {
            return;
        }

        // 处理条件奖励
        const conditionDataList = this.actConditionDataMap[activityId];
        if (conditionDataList) {
            const activityDataList = [];
            conditionDataList.forEach(conditionData => {
                if (!conditionData.isGetReward && Number(conditionData.completeTime) !== 0) {
                    activityDataList.push({ activityId, conditionId: conditionData.conditionId });
                }
            });

            if (activityDataList.length > 0) {
                logger.info(`[活动管理] 处理活动:${activityId}, 活动名称:${actNameMap[activityId]}, 满足任务条件, 领取任务奖励`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_GET_CONDITION_REWARD_BY_ARR, { activityDataList });
            }
        }
    }

    // 处理免费和广告激励奖励领取,一般都是活动详情后处理
    async processFreeAndAdReward(activityId) {
        const activityCanHandle = await this.checkActIsCanHandle(activityId);
        if (!activityCanHandle) {
            return;
        }

        // 活动的已经购买的数据
        const mallBuyCountList = this.actMallBuyCountDataMap[activityId] || [];
        // 详细配置,对象
        const detailConfig = this.actDetailConfigMap[activityId];
        const mallConfig = detailConfig?.commonConfig?.mallConfig || [];


        // 免费福利领取参数
        const rewardParams = [];
        mallConfig.forEach(mallConfigItem => {
            const mallTempMsg = mallConfigItem?.mallTempMsg;
            if (!mallTempMsg) {
                return;
            }

            // 免费礼包处理
            if (mallTempMsg.price === "100000=0") {
                // 购买次数限制
                const buyLimit = mallTempMsg.buyLimit;
                const hasBuyCount = mallBuyCountList.find(item => item.mallId === mallTempMsg.id)?.count || 0;

                const leftTimes = buyLimit - Number(hasBuyCount);
                if (leftTimes > 0) {
                    const [key, value] = mallTempMsg.reward.split('=');
                    const logStr = (`[活动管理] 处理活动免费礼包, 活动ID:${activityId}, 活动名称:${actNameMap[activityId]}, 礼包名称: ${mallTempMsg.name}, 奖励名称: ${DBMgr.inst.getLanguageWord(`Items-${key}`)}, 奖励数量:${value}`);
                    rewardParams.push({ data: { activityId, mallId: mallTempMsg.id, count: 1, isUseADTime: false }, leftTimes, logStr });
                }
            }
        });

        // 真正处理奖励数据
        if (rewardParams.length > 0) {
            rewardParams.forEach(item => {
                while (item.leftTimes > 0) {
                    logger.info(`${item.logStr}, 剩余次数:${item.leftTimes}`);
                    AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_ACTIVITY_BUY_MALL_GOODS, data: item.data, logStr: item.logStr });
                    item.leftTimes--;
                }
            })
        }
    }

    // 循环任务检测，活动数据是否同步完成
    loopProcessReward() {
        this.isProcessing = true;

        // 循环遍历活动
        Object.keys(this.actMainConfigMap).forEach(activityId => {

            // 活动没有详细数据
            if (!this.actCommonDataMap[activityId] && !this.blackActId.includes(activityId)) {
                setTimeout(() => { GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_GET_DATA, { activityId }) }, 1500);
                return;
            }

            // 有详情的活动,处理条件奖励
            this.processConditionReward(activityId);
            // 广告奖励(一般下发了详情的活动，都没有免费和广告奖励)
            this.processFreeAndAdReward(activityId);
        });

        this.isProcessing = false;
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const enable = global.account.switch.activity ?? false;
            if (!enable) {
                this.clear();
                return;
            }

            if (Date.now() - this.lastLoopCheckTime >= this.LOOP_CHECK_CD) {
                this.lastLoopCheckTime = Date.now();

                await new Promise(resovle => setTimeout(resovle, 2000));

                this.loopProcessReward();
            }
        } catch (error) {
            logger.error(`[活动管理] 活动处理异常错误:${error}`)
        } finally {
            this.isProcessing = false;
        }
    }
}
