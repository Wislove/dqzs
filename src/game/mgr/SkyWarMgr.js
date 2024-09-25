import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import LoopMgr from "#game/common/LoopMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";


export default class SkyWarMgr {
    constructor() {
        this.isProcessing = false;
        this.enabled = global.account.switch.skywar || false;
        this.skywarIndex = global.account.switch.skywarIndex || 0;
        // 最大挑战和最大免费刷新
        this.maxFightNum = 5;
        this.maxFreeRefreshTimes = 5;


        this.fightNums = 0; //已经挑战次数
        this.refreshTimes = 0; //已经刷新次数
        this.worship = false;  //是否膜拜
        this.enemyData = [];
        // 是否同步数据
        this.initialized = false;

        LoopMgr.inst.add(this);
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
        if (t.ret === 0) {
            this.myScore = t.myScore;
            this.refreshTimes = t.refreshTimes;
            this.enemyData = t.enemyData;
            this.fightNums = t.battleTimes;

            this.initialized = true;
        }
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
    }

    // 刷新对手
    SkyWarRefreshEnemyRsp(t) {
        this.refreshTimes = t.refreshTimes;
        this.enemyData = t.enemyData;
    }

    // 挑战后结果处理
    SkyWarFightRsp(t) {
        logger.info(`[征战诸天] 征战诸天结果:${t.ret}`);
        if (t.ret === 0) {
            this.fightNums = t.battleTimes;
        } else {
            // 刷新列表
            if (this.refreshTimes < 5) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_SKY_WAR_REFRESH_ENEMY, { playerId: UserMgr.playerId });
            }
        }
    }

    // 处理征战
    handleFight() {
        // 敌人信息，默认自己妖力大于对方，能获胜
        const enemyInfoArray = this.enemyData.map((element, index) => {
            return {
                winScore: element.winScore,
                enemyFightValue: element.playerData.playerBaseDataMsg.fightValue.low,
                enemyPlayerId: element.playerData.playerBaseDataMsg.playerId,
                enemyServerId: element.playerData.playerBaseDataMsg.serverId,
                nickName: element.playerData.playerBaseDataMsg.nickName,
                position: index,
                canWin: PlayerAttributeMgr.fightValue.low > element.playerData.playerBaseDataMsg.fightValue.low
            };
        });

        // 挑选出来的能赢且分数最高的敌人
        let selectFightEnemy;
        selectFightEnemy = enemyInfoArray.filter(item => item.canWin).reduce((max, current) => {
            return (max.winScore || 0) > current.winScore ? max : current;
        });

        // 如果没有挑选出能赢的,则挑选战力最低的
        if (!selectFightEnemy) {
            selectFightEnemy = enemyInfoArray.reduce((min, current) => {
                return min.enemyFightValue < current.enemyFightValue ? min : current;
            });
        }

        // 挑选出的对手
        if (selectFightEnemy) {
            logger.info(`[征战诸天] 征战诸天对手：${selectFightEnemy.nickName}, 对手妖力:${selectFightEnemy.enemyFightValue}, 获胜积分:${selectFightEnemy.winScore}`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_SKY_WAR_FIGHT, {
                playerId: UserMgr.playerId,
                targetPlayerId: selectFightEnemy.enemyPlayerId,
                targetServerId: selectFightEnemy.enemyServerId,
                position: selectFightEnemy.position
            });
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

            if (this.fightNums >= this.maxFightNum) {
                this.completeTask(); // 如果达到最大挑战次数，任务完成
                return;
            }
            logger.info(`[征战诸天] 当前次数: ${this.fightNums}`);

            // 切换到分身
            PlayerAttributeMgr.inst.setSeparationIdx(this.skywarIndex);
            // 处理征战
            this.handleFight();

            this.fightNums++;
        } catch (error) {
            logger.error(`[征战诸天] SkyWarMsg error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}