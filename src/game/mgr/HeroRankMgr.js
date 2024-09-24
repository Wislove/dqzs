import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";

export default class HeroRankMgr {
    constructor() {
        this.isProcessing = false;
        // 是否开启光速群英榜
        this.enabled = global.account.switch.herorank || false;
        // 是否每天自动打群英榜，默认为false
        this.autoFightDaily = global.account.switch.herorankFightDaily || false;
        this.buyNumDaily = 0;   // 当天已买数量
        this.energy = 0;        // 当前剩余体力
        this.rank = null;       // 当前排名
        this.lock = false;      // 加锁加锁请求太快了~
        this.BattleErr = 0;      // 战斗失败次数     
        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.HERORANK) {
            logger.warn(`[群英榜管理] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new HeroRankMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    getBuyNumMax() {
        const dayIndex = new Date().getDay();
        const herorankBuyNumMax = global.account?.switch?.herorankBuyNumMax;
        const configNum = Array.isArray(herorankBuyNumMax) ? (herorankBuyNumMax[dayIndex] ?? 0) : 0;
        // 限制为10以内
        return Math.max(Math.min(parseInt(configNum), 10), 0);
    }

    SyncData(t) {
        try {
            logger.debug("[群英榜管理] 初始化");
            this.energy = t.energy || 0;
            this.buyNumDaily = t.buyNumDaily || 0;

            const buyNumMax = this.getBuyNumMax();
            if (this.enabled && this.buyNumDaily < buyNumMax && this.energy <= 50) {
                const num = buyNumMax - this.buyNumDaily;
                logger.info(`[群英榜管理] 购买体力 ${num}次`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_BUY_ENERGY, { num: num });
                this.buyNumDaily = buyNumMax;
            }
        } catch (error) {
            logger.error(`[群英榜管理] SyncData error: ${error}`);
        }
    }

    findFirstHeroRankPlayer(body) {
        try {
            return (
                body.fightPlayerList.canFightPlayerInfoList.find((player) => player.showInfo.nickName.startsWith("HeroRank_Name")) ||
                body.fightPlayerList.canFightPlayerInfoList[0]
            );
        } catch (error) {
            logger.error(`[群英榜管理] findFirstHeroRankPlayer error: ${error}`);
            return null;
        }
    }

    findRandomPlayer(t) {
        const playerList = t.fightPlayerList.canFightPlayerInfoList;
        const splitIndex = playerList.findIndex((player) => player.showInfo.playerId == UserMgr.playerId);
        const beforeSplit = playerList.slice(0, splitIndex - 1);
        return beforeSplit.find((player) => player.showInfo.nickName.startsWith("HeroRank_Name")) || beforeSplit[Math.floor(Math.random() * beforeSplit.length)];
    }

    getFightList(t) {
        this.isProcessing = true;
        try {
            logger.debug(`[群英榜管理] 收到群英榜列表${JSON.stringify(t, null, 2)}`);
            if (t.ret === 0) {
                this.rank = t.rank || null;

                // 即使排名是1，如果开启了autoFightDaily且有体力，也需要继续战斗
                if (t.rank === 1 && !this.autoFightDaily) {
                    logger.info("[群英榜管理] 当前排名第一, 不需要再打了");
                    return;
                }

                // 如果autoFightDaily开启，则随机选择一个玩家进行挑战
                const player =
                    this.autoFightDaily && this.energy > 0
                        ? this.findRandomPlayer(t) // 随机选择玩家
                        : this.findFirstHeroRankPlayer(t); // 正常选择

                if (player) {
                    logger.info(`[群英榜管理] 找到玩家 ${player.showInfo.nickName} 准备攻击...`);
                    const fight={//真人
                        targetId:player.showInfo.playerId,
                        targetRank: player.rank,
                        masterId: 0,
                        masterLv: 0,
                        appearanceId:0,
                        cloudId:0,
                    }
                    if(player.masterId){ //人机
                        fight.masterId=player.masterId
                        fight.masterLv=player.masterLv
                        fight.appearanceId= player.showInfo.appearanceId
                        fight.cloudId= player.showInfo.equipCloudId
                    }
                    GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_FIGHT, fight);
                    this.energy--;
                }
            }
        } catch (error) {
            logger.error(`[群英榜管理] getFightList error: ${error}`);
        } finally {
            this.lock = false;
            this.isProcessing = false;
        }
    }

    async doFight(t) {
        this.isProcessing = true;
        try {
            logger.debug(`[群英榜] 收到群英榜战斗结果${JSON.stringify(t, null, 2)}`);
            if (t.ret === 0) {
                this.energy = t.playerInfo.energy;
                if (t.allBattleRecord.isWin) {
                    logger.info(`[群英榜] 当前排名: ${t.rank} 战斗胜利, 再次请求列表...`);
                    await new Promise((resolve) => setTimeout(resolve, 2000)); // 延迟 2 秒后继续请求列表
                } else {
                    this.BattleErr += 1;
                }
            }
        } catch (error) {
            logger.error(`[群英榜] doFight error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }

    isLoopActive() {
        // 检查是否启用
        if (!this.enabled && !this.autoFightDaily) {
            logger.info("[群英榜管理] 停止循环。未开启光速群英榜和每日自动战斗");
            this.clear();
            return false;
        }

        // 检查体力
        if (this.energy < 1) {
            logger.info("[群英榜管理] 停止循环。体力不足");
            this.clear();
            return false;
        }
        return true;
    }

    shouldStartFight() {
        const now = new Date();
        const isMonday = now.getDay() === 1;
        const isZeroFive = now.getHours() === 0 && now.getMinutes() >= 5 && now.getMinutes() <= 10;
        return isMonday && isZeroFive && this.energy > 0;
    }

    async loopUpdate() {
        if (this.isProcessing || !this.isLoopActive()) return;
        if (this.lock) return;
        this.isProcessing = true;
        try {
            if (this.shouldStartFight()) {
                logger.info("[群英榜管理] 开始光速群英榜模式...");
                GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_GET_FIGHT_LIST, { type: 0 });
            } else if (this.autoFightDaily && this.BattleErr <= 6) {
                logger.info("[群英榜管理] 开始每日自动打群英榜模式...");
                GameNetMgr.inst.sendPbMsg(Protocol.S_HERORANK_GET_FIGHT_LIST, { type: 0 });
            } else {
                logger.debug("[群英镑管理] 条件不满足");
            }
        } catch (error) {
            logger.error(`[群英榜管理] loopUpdate error: ${error}`);
        } finally {
            this.lock = true;
            this.isProcessing = false;
        }
    }
}
