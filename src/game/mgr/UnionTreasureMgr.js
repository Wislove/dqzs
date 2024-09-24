import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class UnionTreasureMgr {
    constructor() {
        this.unionId = null;
        this.isProcessing = false;
        this.lotteryTimes = null;
        this.lotteryTimesMax = 3;
        this.mapDatas = null;
        this.callback = false;
        this.rewardStatus = false;
        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.UNION_TREASURE) {
            logger.warn(`[妖盟寻宝] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new UnionTreasureMgr();
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

    // 推送妖盟数据
    pushMyUnionDataBroadcast(t) {
        this.unionId = t.baseData.unionId || null;
    }

    // 请求进入寻宝返回
    UnionTreasureEnterResp(t) {
        this.callback = true;
        this.lotteryTimes = t.msg.playerData.lotteryTimes;
        this.mapDatas = t.msg.playerData.mapDatas;
    }

    // 寻宝
    UnionTreasureDrawChip() {
        for (let i = this.lotteryTimes; i < this.lotteryTimesMax; i++) {
            logger.info(`[妖盟寻宝] 第${i}次寻宝`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_TREASURE_DRWA_CHIP, {});
        }
        this.lotteryTimes = this.lotteryTimesMax;
    }

    // 领奖
    getReward() {
        logger.info(`[妖盟寻宝] 开始领奖`);
        for (let i = 290001; i < 290006; i++) {
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [i] });
        }
        this.rewardStatus = true;
    }

    //挖箱子
    UnionTreasureHuntTreasureReq() {
        const treasureHunt = this.mapDatas.find((hunt) => hunt.status == 2)
        if (treasureHunt) {
            logger.info(`[妖盟寻宝] 挖取宝箱:${treasureHunt.pos}`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_TREASURE_HUNT_TREASURE, { pos: treasureHunt.pos });
            this.mapDatas = this.mapDatas.filter((hunt) => hunt.pos !== treasureHunt.pos);
        }
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        if (!this.inUnion) return;
        try {
            if (!this.callback){
                GameNetMgr.inst.sendPbMsg(Protocol.S_UNION_TREASURE_ENTER, {});
                return;
            }
            if (this.lotteryTimes >= this.lotteryTimesMax && this.rewardStatus == false) {
                this.getReward();
                logger.info(`[妖盟寻宝] 寻宝已完成,终止任务`);
            }
            this.UnionTreasureDrawChip(); // 寻宝
            this.UnionTreasureHuntTreasureReq(); //检查挖箱子
        } catch (error) {
            logger.error(`[妖盟寻宝] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
