import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";

/**
 * 征战诸天的每日任务奖励，是在TaskMgr里面
 * type为: TASK_TYPE_12:  210001,210002,210003
 */
export default class SkyWarMgr {
    constructor() {
        this.isProcessing = false;
        this.enabled = global.account.switch.skywar || false;
        this.skywarIndex = global.account.switch.skywarIndex || 0;
        // 最大挑战和最大免费刷新
        this.maxFightNum = 5;
        this.maxFreeRefreshTimes = 5;

        this.battleTimes = 5; //还可以挑战次数
        this.fightNums = 0; // 可以挑战次数
        this.refreshTimes = 5; //可以免费刷新次数
        this.worship = false;  //是否膜拜
        this.enemyData = [];
        // 是否同步数据
        this.initialized = false;

        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!SystemUnlockMgr.SKY_WAR) {
            logger.warn(`[征战诸天] ${global.colors.red}系统未解锁${global.colors.reset}`);
            return null;
        }

        if (!this._instance) {
            this._instance = new SkyWarMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 数据同步
    SkyWarDataSync(t) {
        this.isProcessing = true;

        this.myScore = t.myScore;
        this.myGroupRank = t.myGroupRank;
        this.enemyData = t.enemyData;

        this.isProcessing = false;
    }

    // 进入征战诸天
    SkyWarEnterReq() {
        GameNetMgr.inst.sendPbMsg(Protocol.S_SKY_WAR_ENTER, { playerId: UserMgr.playerId });
    }

    // 征战诸天数据同步
    SkyWarEnterRsp(t) {
        this.isProcessing = true;
        if (t.ret === 0) {
            this.myScore = t.myScore;
            this.refreshTimes = t.refreshTimes;
            this.enemyData = t.enemyData;
            this.battleTimes = t.battleTimes;

            this.initialized = true;
        }

        this.isProcessing = false;
    }

    // 征战诸天膜拜
    SkyWarSkyRankRsp(t) {
        if (t.ret === 0) {
            this.worship = t.worship
            // 如果没有膜拜,进行膜拜
            if (!this.worship) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_SKY_WAR_WORSHIP, { playerId: UserMgr.playerId });
            }
        }
    }

    completeTask() {
        logger.info(`[征战诸天] 任务完成`);
        PlayerAttributeMgr.inst.switchToDefaultSeparation(); // 切换到默认分身
        this.clear();
        WorkFlowMgr.inst.remove("SkyWar");

        // 自动领取征战诸天任务奖励
        if (this.battleTimes == 0) {
            GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [210001, 210002, 210003] });
        }
    }

    SkyWarRefreshEnemyReq() {
        if (this.refreshTimes < this.maxFreeRefreshTimes) {
            this.refreshCallback = false;
            GameNetMgr.inst.sendPbMsg(Protocol.S_SKY_WAR_REFRESH_ENEMY, { playerId: UserMgr.playerId });
        }
    }

    // 刷新对手返回结果
    SkyWarRefreshEnemyRsp(t) {
        this.refreshTimes = t.refreshTimes;
        this.enemyData = t.enemyData;
    }

    // 挑战后结果处理
    SkyWarFightRsp(t) {
        if (t.ret === 0) {
            this.battleTimes = t.battleTimes;
            logger.info(`[征战诸天] 征战诸天剩余次数:${t.battleTimes}`);
        }

        this.initialized = true;
    }

    // 处理征战
    handleFight() {
        // 敌人信息，默认自己妖力大于对方，能获胜
        const enemyInfoArray = this.enemyData.map((element, index) => {
            return {
                winScore: element.winScore || 0,
                enemyFightValue: Number(element.playerData.playerBaseDataMsg.fightValue),
                enemyPlayerId: element.playerData.playerBaseDataMsg.playerId,
                enemyServerId: element.playerData.playerBaseDataMsg.serverId,
                nickName: element.playerData.playerBaseDataMsg.nickName,
                position: index,
                canWin: Number(PlayerAttributeMgr.fightValue) > Number(element.playerData.playerBaseDataMsg.fightValue)
            };
        });

        // 挑选出来的能赢且分数最高的敌人
        let selectFightEnemy;
        const canWinEnemyArray = enemyInfoArray.filter(item => item.canWin);
        if (canWinEnemyArray.length > 0) {
            selectFightEnemy = canWinEnemyArray.reduce((max, current) => {
                return max.winScore > current.winScore ? max : current;
            });
        }

        // 如果没有挑选出能赢的,则有刷新就刷新一次
        if (!selectFightEnemy) {
            // 如果还有免费刷新次数,就刷新一次
            if (this.refreshTimes < this.maxFreeRefreshTimes) {
                this.SkyWarRefreshEnemyReq();
                setTimeout(() => logger.info(`[征战诸天] 未找到能赢的对手,刷新对手,刷新次数,第${this.refreshTimes}次`));
                return;
            }

            // 刷新次数用完还是找不到,只能挑选战力最低的打
            selectFightEnemy = enemyInfoArray.reduce((min, current) => {
                return min.enemyFightValue < current.enemyFightValue ? min : current;
            });
        }

        // 挑选出的对手
        if (selectFightEnemy) {
            this.initialized = false;
            logger.info(`[征战诸天] 征战诸天对手：${selectFightEnemy.nickName}, 对手妖力:${selectFightEnemy.enemyFightValue}, 获胜积分:${selectFightEnemy.winScore}`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_SKY_WAR_FIGHT, {
                playerId: UserMgr.playerId,
                targetPlayerId: selectFightEnemy.enemyPlayerId,
                targetServerId: selectFightEnemy.enemyServerId,
                position: selectFightEnemy.position
            });

            this.fightNums++;
        }
    }

    async loopUpdate() {
        if (!WorkFlowMgr.inst.canExecute("SkyWar") || !this.enabled || this.isProcessing) return;

        this.isProcessing = true;
        try {
            if (!this.initialized) {
                logger.debug("[征战诸天] 初始化");
                this.SkyWarEnterReq();
                return;
            }

            // 处理征战诸天自动膜拜功能
            if (!this.worship) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_SKY_WAR_SKY_RANK, { playerId: UserMgr.playerId });
            }

            // 如果达到最大挑战次数，任务完成
            if (this.fightNums >= this.maxFightNum || this.battleTimes == 0) {
                this.completeTask();
                return;
            }
            logger.info(`[征战诸天] 当前次数: ${this.fightNums}`);

            // 切换到分身
            PlayerAttributeMgr.inst.setSeparationIdx(this.skywarIndex);
            // 处理征战
            this.handleFight();
        } catch (error) {
            logger.error(`[征战诸天] SkyWarMsg error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}