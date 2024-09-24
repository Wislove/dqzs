import logger from "#utils/logger.js";
import Protocol from "#game/net/Protocol.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import CustomMgr from "#game/mgr/CustomMgr.js";
import BagMgr from "#game/mgr/BagMgr.js";
import FrogMgr from "#game/mgr/FrogMgr.js";
import DestinyMgr from "#game/mgr/DestinyMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";
import SpiritMgr from "#game/mgr/SpiritMgr.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import PalaceMgr from "#game/mgr/PalaceMgr.js";
import MagicMgr from "#game/mgr/MagicMgr.js";
import MagicTreasureMgr from "#game/mgr/MagicTreasureMgr.js";
import PupilMgr from '#game/mgr/PupilMgr.js';
import GatherEnergyMgr from "#game/mgr/GatherEnergyMgr.js";
import WildBossMgr from "#game/mgr/WildBossMgr.js";
import TowerMgr from "#game/mgr/TowerMgr.js";
import ChapterMgr from "#game/mgr/ChapterMgr.js";
import SecretTowerMgr from "#game/mgr/SecretTowerMgr.js";
import HeroRankMgr from "#game/mgr/HeroRankMgr.js";
import ActivityMgr from "#game/mgr/ActivityMgr.js";
import UnionMgr from "#game/mgr/UnionMgr.js";
import HomelandMgr from "#game/mgr/HomelandMgr.js";
import InvadeMgr from "#game/mgr/InvadeMgr.js";
import StarTrialMgr from "#game/mgr/StarTrialMgr.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";
import RuleTrialMgr from "#game/mgr/RuleTrialMgr.js";
import PetsMgr from "#game/mgr/PetsMgr.js";
import UniverseMgr from "#game/mgr/UniverseMgr.js";
import YueBaoMgr from "#game/mgr/YueBaoMgr.js";
import YardDpbMgr from "#game/mgr/YardDpbMgr.js";
import UnionTreasureMgr from "#game/mgr/UnionTreasureMgr.js";
import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
import UnionBountyMgr from "#game/mgr/UnionBountyMgr.js";
import DBMgr from "#game/common/DBMgr.js";

class MsgRecvMgr {
    constructor() {}

    // 101 用户信息同步
    static PlayerDataMsg(t) {
        UserMgr.nickName = t.nickName;
        UserMgr.playerId = t.playerId;
        UserMgr.roleId = t.roleId;
        UserMgr.serverId = Number(t.serverId);
    }

    // 102 系统解锁同步
    static SystemUnlockSync(t) {
        logger.debug("[MsgRecvMgr] 同步系统解锁");
        SystemUnlockMgr.inst.SyncData(t);
    }

    // 104 同步特权卡数据
    static PrivilegeCardDataMsg(t) {
        logger.debug("[MsgRecvMgr] 同步特权卡数据");
        PlayerAttributeMgr.inst.SyncVip(t);
        AdRewardMgr.inst.SyncVip(PlayerAttributeMgr.isMonthCardVip || PlayerAttributeMgr.isYearCardVip);
    }

    // 201 玩家属性信息同步
    static PlayerAttributeDataMsg(t) {
        logger.debug("[MsgRecvMgr] 玩家属性信息同步");
        PlayerAttributeMgr.inst.SyncAttribute(t);
    }

    // 207 树状态
    static DreamDataMsg(t) {
        logger.debug("[MsgRecvMgr] 树状态同步");
        PlayerAttributeMgr.inst.SyncTree(t);
        // 初始化完成后 自定义管理器初始化
        CustomMgr.inst.init();
    }

    // 209 获取未处理装备数据
    static GetUnDealEquipmentMsgResp(t) {
        logger.debug("[MsgRecvMgr] 获取未处理装备数据");
        PlayerAttributeMgr.inst.handlerEquipment(t);
    }

    // 210 青蛙
    static PlayerAdRewardDataMsg(t) {
        logger.debug("[MsgRecvMgr] 青蛙数据同步");
        FrogMgr.inst.checkReward(t);
    }

    // 215 同步分身数据
    static GetSeparationDataMsgListResp(t) {
        logger.debug("[MsgRecvMgr] 同步分身数据");
        PlayerAttributeMgr.inst.checkSeparation(t);
    }

    // 301 同步背包数据
    static SyncBagMsg(t) {
        logger.debug("[MsgRecvMgr] 背包数据同步");
        BagMgr.inst.SyncBagMsg(t);
    }

    // 621 同步灵脉数据
    static TalentPlayerDataMsg(t) {
        logger.debug("[MsgRecvMgr] 灵脉数据同步");
        PlayerAttributeMgr.inst.handlerTalentInit(t);
    }

    // 625 获取未处理灵脉数据
    static GetUnDealTalentMsgResp(t) {
        logger.debug("[MsgRecvMgr] 获取未处理灵脉数据")
        PlayerAttributeMgr.inst.handlerTalent(t);
    }

    // 651 游历数据同步
    static DestinyData(t) {
        logger.debug("[MsgRecvMgr] 游历数据同步");
        DestinyMgr.inst.SyncData(t);
    }

    // 821 同步玩家精怪数据
    static SpiritPlayerDataMsg(t) {
        logger.debug("[MsgRecvMgr] 精怪数据同步");
        // TODO: SpiritMgr.inst.syncSpiritPlayerDataMsg(t);
        SpiritMgr.inst.checkReward(t);
    }

    // 2117 妖盟数据 同步妖盟任务
    static RspUnionDailyTask(t) {
        logger.debug("[MsgRecvMgr] 同步妖盟任务");
        UnionMgr.inst.checkDailyTask(t);
    }

    // 2124 妖盟数据 推送我的妖盟数据更新
    static MyUnionData(t) {
        logger.debug("[MsgRecvMgr] 妖盟数据同步");
        UnionMgr.inst.pushMyUnionDataBroadcast(t);
        UnionTreasureMgr.inst.pushMyUnionDataBroadcast(t);
        UnionBountyMgr.inst.pushMyUnionDataBroadcast(t);
    }

    // 2165 妖盟砍价数据同步
    static CutPriceDataMsg(t) {
        logger.debug("[MsgRecvMgr] 妖盟砍价数据同步");
        UnionMgr.inst.cutPriceSyncData(t);
    }

    // 5801 主动请求布阵信息 满20层开打
    static UnionBossInfoRespMsg(t) {
        logger.debug("[MsgRecvMgr] 妖盟讨伐boss信息同步");
        UnionMgr.inst.SyncUnionBossMsg(t);
    }

    // 5803 妖盟讨伐boss战斗 是否可以领奖
    static UnionBossRewardRespMsg(t) {
        logger.debug("[MsgRecvMgr] 妖盟讨伐boss战斗结果");
        UnionMgr.inst.BossReward(t);
    }

    //6730 妖盟夺位战数据同步
    static UnionFightApplyDataSync(t) {
        logger.debug("[MsgRecvMgr] 妖盟请战");
        UnionMgr.inst.UnionFightApplyDataSync(t);
    }

    // 4802 仙宫点赞同步
    static PalaceWorshipRsp(t) {
        logger.debug("[MsgRecvMgr] 仙宫点赞同步");
        PalaceMgr.inst.PalaceWorshipRsp(t);
    }

    // 4803 仙宫外部数据请求
    static EnterPalaceRsp(t) {
        logger.debug("[MsgRecvMgr] 仙宫外部数据请求");
        PalaceMgr.inst.checkWorship(t);
    }

    // 4808 仙宫送福数据同步
    static SendGiftSyncMsg(t) {
        logger.debug("[MsgRecvMgr] 仙宫送福数据同步");
        PalaceMgr.inst.checkReward(t);
    }

    // 4809 仙宫神迹同步
    static PalaceMiracleDataMsg(t) {
        logger.debug("[MsgRecvMgr] 仙宫神迹同步");
        PalaceMgr.inst.checkMiracle(t);
    }

    // 11801 进入宗门系统
    static EnterPupilSystemResp(t) {
        logger.debug("[MsgRecvMgr] 进入宗门系统");
        PupilMgr.inst.checkReward(t);
        PupilMgr.inst.checkGraduatation(t);
    }

    // 4400 神通数据同步
    static PlayerMagicDataMsg(t) {
        logger.debug("[MsgRecvMgr] 神通数据同步");
        // TODO: MagicMgr.inst.syncMagicDataMsg(t);
        MagicMgr.inst.checkReward(t);
    }

    // 6301 玩家法宝数据同步
    static MagicTreasurePlayerDataMsg(t) {
        logger.debug("[MsgRecvMgr] 法宝数据同步");
        MagicTreasureMgr.inst.checkReward(t);
    }

    // 7001 聚灵阵状态
    static GatherEnergyEnterNewResp(t) {
        logger.debug("[MsgRecvMgr] 聚灵阵状态同步");
        GatherEnergyMgr.inst.checkReward(t);
    }

    // 207020 打开聚灵阵一级列表界面（参与人数）
    static GatherEnergyFirstListViewResp(t) {
        logger.debug("[MsgRecvMgr] 聚灵阵状态同步");
        GatherEnergyMgr.inst.GatherEnergyFirstListViewResp(t);
    }

    // 402 关卡挑战
    static ChallengeRspMsg(t) {
        logger.debug("[MsgRecvMgr] 关卡挑战");
        ChapterMgr.inst.challengeResult(t);
    }

    // 403 同步冒险关卡数据
    static PlayerStageData(t) {
        logger.debug("[MsgRecvMgr] 冒险关卡数据同步");
        ChapterMgr.inst.SyncData(t);
    }

    // 551 邮件列表数据同步
    static MailListMsg(t) {
        logger.debug("[MsgRecvMgr] 一键领取邮件奖励");
        GameNetMgr.inst.sendPbMsg(Protocol.S_MAIL_GET_ALL_REWARD, {});
    }

    // 602 是否能购买物品
    static MallBuyCountListMsg(t) {
        logger.debug("[MsgRecvMgr] 是否能购买物品");
        BagMgr.inst.checkBuyGoods(t);
    }

    // 731 妖王数据同步
    static WildBossDataSync(t) {
        logger.debug("[MsgRecvMgr] 妖王数据同步");
        WildBossMgr.inst.checkReward(t);
    }

    // 732 妖王挑战结果
    static WildBossChallengeResp(t) {
        logger.debug("[MsgRecvMgr] 妖王挑战结果");
        WildBossMgr.inst.challengeResult(t);
    }

    // 761 镇妖塔数据同步
    static TowerDataMsg(t) {
        logger.debug("[MsgRecvMgr] 同步镇妖塔数据");
        TowerMgr.inst.SyncData(t);
    }

    // 762 镇妖塔挑战结果
    static TowerChallengeResp(t) {
        logger.debug("[MsgRecvMgr] 镇妖塔挑战结果");
        TowerMgr.inst.challengeResult(t);
    }

    // 5602 真火秘境战斗结果
    static SecretTowerFightResp(t) {
        logger.debug("[MsgRecvMgr] 真火秘境战斗结果");
        SecretTowerMgr.inst.challengeResult(t);
    }

    // 5605 真火秘境 秘境数据同步
    static SynSecretTowerInfo(t) {
        logger.debug("[MsgRecvMgr] 真火秘境数据同步");
        SecretTowerMgr.inst.SyncData(t);
    }

    // 3701 群英榜 同步玩家信息
    static SynHeroRankPlayerInfo(t) {
        logger.debug("[MsgRecvMgr] 群英榜 同步玩家信息");
        HeroRankMgr.inst.SyncData(t.playerInfo);
    }

    // 3702 群英榜 同步玩家排行榜
    static RspHeroRankFightPlayerList(t) {
        logger.debug("[MsgRecvMgr] 群英榜 同步玩家排行榜");
        HeroRankMgr.inst.getFightList(t);
    }

    // 3703 群英榜 请求挑战玩家
    static RspHeroRankFight(t) {
        logger.debug("[MsgRecvMgr] 群英榜 请求挑战玩家");
        HeroRankMgr.inst.doFight(t);
    }

    // 1001 活动通用数据同步
    static PushActivityList(t) {
        logger.debug("[MsgRecvMgr] 活动通用数据同步");
        ActivityMgr.inst.SyncData(t);
    }

    // // 1002 同步活动详细配置
    static ActivityCommonDataListSync(t) {
        ActivityMgr.inst.buyFree(t);
        //     logger.debug("[MsgRecvMgr] 同步活动详细配置");
        //     for (const i of t.activityDataList) {
        //         const activityId = i.activityId;
        //         // 如果 i.detailConfig.commonConfig 中包含mallConfig
        //         if (i.detailConfig.commonConfig.mallConfig) {
        //             GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_GET_DATA, { activityId: activityId });
        //         }
        //     }
        //     // ActivityMgr.inst.getReward(t); // 有问题
    }

    // // 1007 活动 增量同步活动数据 
    // static ActivityConditionDataListSync(t) {
    //     logger.debug("[MsgRecvMgr] 增量同步数据");
    //     for (const i of t.activityConditionDataList) {
    //         GameNetMgr.inst.sendPbMsg(Protocol.S_ACTIVITY_GET_DATA, { activityId: i.activityId });
    //     }
    // }

    // // 1003 活动 全量同步活动数据(领取东西逻辑放到这里)
    static RspGetActivityDetail(t) {
        logger.debug("[MsgRecvMgr] 全量同步数据");
        const activityMgrEnabled = global.account.switch.activity || false;
        if (!activityMgrEnabled) {
            logger.debug(`[活动管理] 未开启`);
        } else {
            ActivityMgr.inst.getReward(t);
        }
    }

    //解析活动奖励返回
    static RspGetActivityConditionReward(t) {
        logger.debug("[MsgRecvMgr] 解析活动奖励返回");
        if (t.ret == 0) {
            const rewardsArray = t.rewards.split('|');
            rewardsArray.forEach(reward => {
                const [key, value] = reward.split('=');
                const rewardName = DBMgr.inst.getLanguageWord(`Items-${key}`)
                logger.info(`[活动管理] 获得: ${rewardName} 数量: ${value} `);
            });
        }
    }

    // 1051 同步福地鼠宝数据
    static SyncHomelandMsg(t) {
        logger.debug("[MsgRecvMgr] 同步福地鼠宝数据");
        HomelandMgr.inst.doInit(t);
    }

    // 1052 进入福地
    static HomelandEnterResp(t) {
        logger.debug("[MsgRecvMgr] 进入福地");
        HomelandMgr.inst.doEnter(t);
    }

    // 1053 福地管理界面
    static HomelandManageResp(t) {
        logger.debug("[MsgRecvMgr] 同步福地鼠宝数据");
        HomelandMgr.inst.doManage(t);
    }

    // 1058 福地探寻
    static HomelandExploreResp(t) {
        logger.debug("[MsgRecvMgr] 福地探寻");
        HomelandMgr.inst.doExplore(t);
    }

    // 1402 异兽入侵数据同步
    static InvadeDataMsg(t) {
        logger.debug("[MsgRecvMgr] 异兽入侵挑战");
        InvadeMgr.inst.InvadeDataMsg(t);
    }

    // 1401 异兽入侵挑战结果

    static InvadeChallengeResp(t) {
        logger.debug("[MsgRecvMgr] 异兽入侵用户数据同步");
        InvadeMgr.inst.InvadeChallengeResp(t);
    }

    // 206901星宿试炼数据同步
    static StarTrialDataMsg(t) {
        logger.debug("[MsgRecvMgr] 星宿试炼数据同步");
        StarTrialMgr.inst.SyncStarTrialData(t)
    }

    // 9105 法则试练速战数据同步
    static RuleTrialDataSync(t) {
        logger.debug("[MsgRecvMgr] 法则试练速战数据同步");
        RuleTrialMgr.inst.RuleTrialDataSync(t)
    }

    // 740 同步玩家灵兽数据
    static PlayerPetDataSync(t) {
        logger.debug("[MsgRecvMgr] 同步玩家灵兽数据");
        PetsMgr.inst.SyncPlayerPetDataMsg(t.playerPetData);
    }

    // 14302 小世界信息同步
    static UniverseDataMsgSync(t) {
        logger.debug("[MsgRecvMgr] 小世界信息同步");
        UniverseMgr.inst.UniverseDataMsgSync(t);
    }

    // 214304 天地轮盘抽奖结果
    static UniverseDrawResp(t) {
        logger.debug("[MsgRecvMgr] 天地轮盘抽奖结果");
        UniverseMgr.inst.UniverseDrawResp(t);
    }

    // 214310 天地轮盘二次抽奖结果
    static UniverseDrawTwiceResp(t) {
        logger.debug("[MsgRecvMgr] 天地轮盘二次抽奖结果");
        UniverseMgr.inst.UniverseDrawTwiceResp(t);
    }


    // 17001 仙玉宝府进入请求
    static YueBaoEnterResp(t) {
        logger.debug("[MsgRecvMgr] 仙玉宝府进入请求");
        YueBaoMgr.inst.checkStatus(t);
    }

    // 216207 妖盟寻宝
    static UnionTreasureEnterResp(t) {
        logger.debug("[MsgRecvMgr] 进入妖盟寻宝");
        UnionTreasureMgr.inst.UnionTreasureEnterResp(t)
    }

    //15843 仙居登录同步 
    static YardLoginSync(t) {
        logger.debug("[MsgRecvMgr] 仙居登录同步");
        YardDpbMgr.inst.YardLoginSync(t)
    }

    //15801 仙居-进入
    static YardEnterResp(t) {
        logger.debug("[MsgRecvMgr] 仙居-进入同步");
        YardDpbMgr.inst.YardEnterResp(t)
    }

    //15849 家园生产信息同步
    static YardMakeMsgSync(t) {
        logger.debug("[MsgRecvMgr] 家园生产信息同步");
        YardDpbMgr.inst.YardMakeMsgSync(t)
    }

    //213602 进入妖盟悬赏返回
    static UnionBountyEnterMapResp(t){
        logger.debug("[MsgRecvMgr] 进入妖盟悬赏同步")
        UnionBountyMgr.inst.UnionBountyEnterMapResp(t);
    }

    //213614 押镖界面
    static UnionBountyOpenBountyEventResp(t){
        logger.debug("[MsgRecvMgr] 押镖界面")
        UnionBountyMgr.inst.UnionBountyOpenBountyEventResp(t);
    }

    // TODO 以下暂时不想写

    // import CommonRedPacketMgr from "#game/mgr/CommonRedPacketMgr.js";
    //     // 140 红包状态同步 TODO 自动领取
    //     static RedPacketStateMsgSync(t) {
    //         logger.debug("[MsgRecvMgr] 红包状态同步");
    //         CommonRedPacketMgr.inst.syncRedPacketState(t);
    //     }

    // import EquipmentAdvanceMgr from "#game/mgr/EquipmentAdvanceMgr.js";
    //     // 5504 装备精炼数据同步
    //     static EquipmentAdvanceDataMsg(t) {
    //         logger.debug("[MsgRecvMgr] 装备精炼数据同步");
    //         EquipmentAdvanceMgr.inst.syncEquipmentData(t);
    //     }

    // import TaskMgr from "#game/mgr/TaskMgr.js";
    //     // 501 玩家登录任务数据下发
    //     static TaskDataListMsg(t, e) {
    //         if (e == Protocol.getProtocalIdRemainder(Protocol.S_TASK_DATA_SEND)) {
    //             logger.debug("[MsgRecvMgr] 任务全量同步");
    //             TaskMgr.inst.initTaskList(t);
    //         } else {
    //             logger.debug("[MsgRecvMgr] 任务增量同步");
    //             TaskMgr.inst.syncTaskList(t);
    //         }
    //     }
}

export default MsgRecvMgr;
