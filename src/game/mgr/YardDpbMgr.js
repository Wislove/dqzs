import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class YardDpbMgr {
    constructor() {
        this.pieceShopOpen = false;
        this.grassNum = 0;
        this.freeDrawTimes = 0;                 // 免费次数
        this.FREE_NUM = 1;                      // 免费次数上限
        this.adCount = 0;                       // 广告次数
        this.AD_REWARD_DAILY_MAX_NUM = 2;       // 广告次数上限
        this.danNum = 0;                        // 丹数
        this.YardCropMsg = [];                  // 灵池
        this.buildingMsg = [];                  // 要收取的
        this.GainRewardCD = 60 * 1000 * 10;     // 每次间隔时间
        this.lastGainRewardTime = 0;            // 上次领取时间

        this.isProcessing = false;
        this.retLock = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.YARD) {
            logger.warn(`[仙居管理] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new YardDpbMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 仙居登录同步
    YardLoginSync(t) {
        this.grassNum = t.grassNum;
        this.pieceShopOpen = t.pieceShopOpen;
    }

    // 进入仙居结果
    YardEnterResp(t) {
        this.freeDrawTimes = t.drawData.freeDrawTimes || 0;
        this.adCount = t.drawData.adCount || 0;
        this.buildingMsg = t.areaInfo.reduce((acc, area) => acc.concat(area.buildingMsg || []), []);
        this.retLock = true;
    }

    // 仙居管理广告
    processReward() {
        if (!this.retLock) return;
        if (this.adCount < this.AD_REWARD_DAILY_MAX_NUM) {
            const logContent = `[仙居管理] 还剩 ${this.AD_REWARD_DAILY_MAX_NUM - this.adCount} 次广告激励`;
            AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_YARDPB_BUILD_DRAW, data: { isTen: false, isUseADTime: false, isADType: true }, logStr: logContent });
            this.adCount++;
        }
        if (this.freeDrawTimes < this.FREE_NUM) {
            logger.info(`[仙居管理] 还剩 ${this.FREE_NUM - this.freeDrawTimes} 次免费次数`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_YARDPB_BUILD_DRAW, { isTen: false, isUseADTime: false, isADType: false, poolId: 0 });
            this.freeDrawTimes++;
        }
    }

    // 生产数量同步
    YardMakeMsgSync(t) {
        this.danNum = t.danNum
        this.grassNum = t.grassNum
        this.YardCropMsg = t.YardCropMsg
    }

    // 收菜
    YardBuildGainReward() {
        if (!this.retLock) return;
        const now = Date.now();
        const whileDic = {1001:'采药', 1002:'收丹药', 1003:'收桃子', 1004:'收孕育'};

        if (this.lastGainRewardTime == 0 || now - this.lastGainRewardTime >= this.GainRewardCD) {
            if (this.buildingMsg.length > 0) {
                for (const i of this.buildingMsg) {
                    const uniqueId = i.yardCellMsg.uniqueId;
                    const buildId = i.yardCellMsg.buildId;
                    const buildName = whileDic[buildId] ?? '';
                    if (buildName.length > 0) { // 过滤特定的 buildId
                        logger.info(`[仙居管理] 开始收菜：${buildName}`);
                        GameNetMgr.inst.sendPbMsg(Protocol.S_YARDPB_BUILD_GAIN_REWARD, { uniqueId: uniqueId, buildId: buildId });
                    }
                    if (buildId == 1002 && i.yardBuildDetailMsg.status == 0) {  // 炼丹 grassNum / 500
                        const num = Math.floor(this.grassNum / 500);
                        GameNetMgr.inst.sendPbMsg(Protocol.S_YARDPB_BUILD_MAKE, { uniqueId: uniqueId, buildId: buildId, num: num, isCancel: false });
                    }
                    if (buildId == 1004 && i.yardBuildDetailMsg.status == 0) {  // 孕育。只孕育最后一个
                        const crop = this.YardCropMsg[this.YardCropMsg.length - 1]
                        const cropNum = 48 + (12 * i.yardBuildDetailMsg.level)
                        GameNetMgr.inst.sendPbMsg(Protocol.S_YARDPB_BUILD_MAKE, { uniqueId: uniqueId, buildId: buildId, productId: crop.itemId, num: cropNum, isCancel: false });
                    }
                }
                this.lastGainRewardTime = now;
            }
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        try {
            if (!this.retLock) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_YARDPB_ENTER, { targetPlayerId: UserMgr.playerId });
            }
            // 抽奖
            this.processReward();
            // 收菜
            this.YardBuildGainReward();

        } catch (error) {
            logger.error(`[仙居管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
