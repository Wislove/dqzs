import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class UniverseMgr {
    constructor() {
        this.isProcessing = false;
        this.stoneNum = 0;                                  // 造化石数量
        this.stoneNumMax = 10;                              // 免费造化石数量上限
        this.freeDrawTimes = 0;                             // 免费抽玄决次数
        this.AD_REWARD_DAILY_DRAW_MAX_NUM = 2;              // 免费玄决上限
        this.drawTwiceStatus = 0;                           // 天地轮盘抽奖类型1:普通，2:观察,3:连线
        this.pos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 天地轮盘：连线坐标
        this.cachePos = [];                                 // 已使用过的连线坐标
        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.UNIVERSE) {
            logger.warn(`[小世界管理] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new UniverseMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 14302 小世界信息同步
    UniverseDataMsgSync(t) {
        this.stoneNum = t.universeDataMsg.stoneNum;
        this.freeDrawTimes = t.universeDataMsg.freeDrawTimes;
        if (t.universeDataMsg.drawTwiceData) {
            this.drawTwiceStatus = t.universeDataMsg.drawTwiceData.drawStatus;
        }
    }

    // 天地轮盘抽奖
    UniverseDrawReq() {
        const logContent = `[天地轮盘] 还剩 ${this.stoneNum} 个免费造化石`;
        AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_UNIVERSE_DRAW, data: { bei: this.stoneNum }, logStr: logContent });
    }

    // 14304 天地轮盘抽奖结果
    UniverseDrawResp(t) {
        this.drawTwiceStatus = t.type;
    }

    // 天地轮盘二次抽奖
    UniverseDrawTwiceReq() {
        if (this.drawTwiceStatus == 2) {
            // 观察
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNIVERSE_DRAW_TWICE, { pos: 1 });
            return;
        }
        // 连线
        GameNetMgr.inst.sendPbMsg(Protocol.S_UNIVERSE_DRAW_TWICE, { pos: this.selectPos() });
    }

    // 随机选择坐标
    selectPos() {
        let selectedPos;
        do {
            const randomIndex = Math.floor(Math.random() * this.pos.length);
            selectedPos = this.pos[randomIndex];
        } while (this.cachePos.includes(selectedPos));

        this.cachePos.push(selectedPos);
        return selectedPos;
    }

    // 天地轮盘二次抽奖结果
    UniverseDrawTwiceResp(t) {
        if (t.rewards) {
            this.drawTwiceStatus = 0;
            this.cachePos = [];
        }
    }

    // 洞察天机抽取
    UniverseSkillDrawReq() {
        const logContent = `[洞察天机] 还剩 ${this.AD_REWARD_DAILY_DRAW_MAX_NUM - this.freeDrawTimes} 次广告激励`;
        AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_UNIVERSE_SKILL_DRAW, data: { times: 1 }, logStr: logContent });
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        try {
            if (this.stoneNum != 0) {
                // 天地轮盘造化石不为0就抽取
                this.UniverseDrawReq();
                this.stoneNum = 0;
            }
            if (this.freeDrawTimes < 2) {
                // 免费洞察天机抽取
                this.UniverseSkillDrawReq();
                this.freeDrawTimes++;
            }
            if (this.drawTwiceStatus > 1) {
                // 天地轮盘二次抽奖
                this.UniverseDrawTwiceReq();
            }
        } catch (error) {
            logger.error(`[小世界] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
