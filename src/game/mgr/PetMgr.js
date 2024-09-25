import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import DBMgr from "#game/common/DBMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import PetKernelMgr from "#game/mgr/PetKernelMgr.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";

/**
 * 灵兽：灵兽自动刷新和捕捉
 */
export default class PetMgr {

    constructor() {
        this.MAX_FREE_REFRESH_NUM = 4; // 免费刷新次数
        this.AD_REWARD_CD = 10 * 1000; // 刷新cd，默认10秒

        this.freeRefreshTimes = 0; //已经免费刷新的次数
        this.petPoolData = []; //用于存放刷新出来的灵兽池子, [{isGet=false, petId=11401},{isGet=false, petId=11401},{isGet=false, petId=11401}]

        // 灵兽刷新愿望池子(默认为:应龙，鸾鸟和五大神话)
        this.wishPets = [114001, 114007, 115001, 115002, 115003, 115004, 115005];
        this.lastAdRewardTime = 0;

        this.isProcessing = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.PET) {
            logger.warn("[灵兽管理] 灵兽系统未解锁");
            return null;
        }

        if (!this._instance) {
            this._instance = new PetMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 同步玩家灵兽数据
    SyncPlayerPetDataMsg(t) {
        this.isProcessing = true;

        // 同步内丹数据
        if (t.kernelData) {
            PetKernelMgr.inst.syncPetKernelMsg(t.kernelData);
        }

        // 灵兽池子
        this.petPoolData = t.petPoolData;
        // 免费灵兽刷新次数
        this.freeRefreshTimes = t.freeRefreshTimes;

        this.isProcessing = false;
    }

    // 刷新灵兽返回结果
    RefreshPetPoolResp(t) {
        if (t.ret === 0) {
            this.petPoolData = t.petPoolData;
            logger.info(`[灵兽管理] 本次灵兽刷新结果: ${this.petPoolData.map(item => DBMgr.inst.getLanguageWord(`Items-${item.petId}`)).join(',')}`);
        }
    }

    processReward() {
        // 判断灵兽池子里是否有希望的灵兽
        if (!this.petPoolData) {
            logger.debug("[灵兽管理] 灵兽数据暂未同步,本次不执行");
            return;
        }

        const now = Date.now();
        if (this.freeRefreshTimes < this.MAX_FREE_REFRESH_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD) {
            const logContent = `[灵兽管理] 还剩 ${this.MAX_FREE_REFRESH_NUM - this.freeRefreshTimes} 次免费刷新`;
            AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_PET_REFRESH_POOL, data: { isUseADTime: false, isFree: 1 }, logStr: logContent });
            this.lastAdRewardTime = now;
            this.freeRefreshTimes++;
        }
    }

    // 定时执行方法
    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            if (this.freeRefreshTimes >= this.MAX_FREE_REFRESH_NUM) {
                this.clear();
                logger.info("[灵兽管理] 灵兽刷新达到每日最大领取次数，停止刷新");
                return;
            }

            // 如果有希望灵兽,则不刷新
            // TODO 有希望灵兽,自动抓捕
            const hasWishPets = this.petPoolData.forEach(item => {
                if (this.wishPets.includes(item.petId) && !item.isGet) {
                    logger.info(`[灵兽管理] 有期望灵兽未抓捕，不执行免费刷新, 期望灵兽: ${DBMgr.inst.getLanguageWord(`Items-${item.petId}`)}`);
                    return true;
                }
            });

            if (hasWishPets) {   
                this.clear();
                return;
            }

            this.processReward();
        } catch (error) {
            logger.error(`[灵兽管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}