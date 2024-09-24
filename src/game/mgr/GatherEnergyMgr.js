import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";
import BagMgr from "#game/mgr/BagMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";

export default class GatherEnergyMgr {
    constructor() {
        this.AD_REWARD_DAILY_MAX_NUM = 3;   // 每日最大领取次数
        this.AD_REWARD_CD = 1000;           // 每次间隔时间
        this.getAdRewardTimes = 0;          // 已领取次数, 默认为0, 防止夜间不work
        this.lastAdRewardTime = 0;          // 上次领取时间
        this.openNum = 0;                   // 聚灵阵开启数量
        this.attendNum = 0;                 // 聚灵阵参加数量
        this.num = 0;                       // 腾蛇信物数量
        this.lock = false;                  // 锁一下，避免拿不到
        this.enabled = global.account.switch.gatherEnergy || false;  // 是否可以开启自己的聚灵阵
        this.isProcessing = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.GATHERENERGY) {
            logger.warn(`[聚灵阵管理] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new GatherEnergyMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // "gatherEnergy": {
    //     "state": 0,
    //     "openNum": 0,
    //     "attendNum": 0,
    //     "hadLike": false,
    //     "getTimes": 0
    // }
    checkReward(t) {
        this.isProcessing = true;
        logger.info(`[聚灵阵管理] 检查聚灵阵奖励`);
        this.getAdRewardTimes = t.gatherEnergy.getTimes || 0;

        this.openNum = t.gatherEnergy.openNum || 0;
        if (this.openNum > 0) {
            logger.info(`[聚灵阵管理] 已开启聚灵阵`);
        }
        this.attendNum = t.gatherEnergy.attendNum || 0;
        if (this.attendNum > 0) {
            logger.info(`[聚灵阵管理] 已加入聚灵阵`);
        }
        this.num = BagMgr.inst.getGoodsNum(105044)
        if (this.num > 0) {
            logger.info(`[聚灵阵管理] 还有 ${this.num} 螣蛇信物`);
        }
        this.lock = true

        this.isProcessing = false;
    }

    //开启聚灵阵
    openGatherEnergy() {
        if (this.openNum > 0 || this.num == 0) {
            return;
        }
        let num = this.num;
        if (this.num >= 5) {
            num = 5;
        }
        logger.info(`[聚灵阵管理] 开启聚灵阵${num * 2}小时`);
        GameNetMgr.inst.sendPbMsg(Protocol.S_GATHER_ENERGY_OPEN, { num: num });

        // 防止启动过多
        this.lock = false;
        // 手动赋值
        this.openNum = 1;
        // 再发一次消息
        GameNetMgr.inst.sendPbMsg(Protocol.S_GATHER_ENERGY_ENTER_NEW, {});
    }

    processReward() {
        const now = Date.now();
        if (this.getAdRewardTimes < this.AD_REWARD_DAILY_MAX_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD) {
            const logContent = `[聚灵阵] 还剩 ${this.AD_REWARD_DAILY_MAX_NUM - this.getAdRewardTimes} 次广告激励`;
            AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_GATHER_ENERGY_GET_AD_AWARD, data: { isUseADTime: false }, logStr: logContent });

            this.getAdRewardTimes++;
            this.lastAdRewardTime = now;
        }
    }



    // 聚灵阵列表
    // 规则: 21点30 开始检查聚灵阵,聚灵阵开启时长大于第二天10点小于21点30,且产能最高
    GatherEnergyFirstListViewResp(t) {
        const filteredData = t.list.filter(item => item.openerMsg.playerId !== UserMgr.playerId);
        const now = new Date();
        const nextDay = new Date(now);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        nextDay.setUTCHours(0, 0, 0, 0);
        const nextDay10amMs = new Date(nextDay).setUTCHours(10, 0, 0, 0);
        const nextDay2130pmMs = new Date(nextDay).setUTCHours(21, 30, 0, 0);
        let maxIncome = 0;
        let maxIncomeObj = null;
        
        filteredData.forEach(item => {
            const endTimeMs = parseInt(item.energyBaseMsg.endTime, 10);
            const income = parseInt(item.energyBaseMsg.income, 10);
            if (endTimeMs >= nextDay10amMs && endTimeMs < nextDay2130pmMs && income > maxIncome) {
                maxIncome = income;
                maxIncomeObj = item;
            }
        });

        if (maxIncomeObj == null) {
            logger.error("[聚灵阵管理] 当前无符合的聚灵阵");
            return
        }

        //入阵坐下
        logger.error(`[聚灵阵管理] 进入 ${maxIncomeObj.openerMsg.nickName} 聚灵阵 产能:${maxIncomeObj.energyBaseMsg.income} 结束时间 ${new Date(maxIncomeObj.energyBaseMsg.endTime)}`);
        GameNetMgr.inst.sendPbMsg(Protocol.S_GATHER_ENERGY_ATTEND_NEW, { id: maxIncomeObj.openerMsg.playerId });// 请求聚灵阵列表
        this.attendNum += 1;
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.getAdRewardTimes >= this.AD_REWARD_DAILY_MAX_NUM) {
                // this.clear();
                logger.debug("[聚灵阵管理] 达到每日最大领取次数，停止奖励领取");
            } else {
                this.processReward();
            }
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            if ((currentHour == 20 || currentHour == 10) && this.lock && this.enabled) {
                this.openGatherEnergy()
            }

            // TODO 自动开启聚灵阵 21:30-22:00有高级聚灵阵 自动进入
            if (currentHour == 21 && currentMinute >= 30 && this.attendNum == 0) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_GATHER_ENERGY_FIRST_LIST_VIEW, { offset: 0, filterType: 1 });// 请求聚灵阵列表
            }

        } catch (error) {
            logger.error(`[聚灵阵管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
