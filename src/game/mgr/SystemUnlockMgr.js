import logger from "#utils/logger.js";
import DBMgr from "#game/common/DBMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";

export default class SystemUnlockMgr {
    constructor() {
        this.systemUnlockInfo = "";

        RegistMgr.inst.add(this);
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new SystemUnlockMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {}

    // 妖途状态 默认未解锁
    static SCORERANK = false;              // 斗法
    static WILDBOSS = false;               // 挑战妖王
    static PET = false;                    // 灵兽
    static TOWER = false;                  // 镇妖塔
    static CLOUD = false;                  // 座驾
    static SPIRIT = false;                 // 精怪
    static TALENT = false;                 // 先天灵脉
    static HOMELAND = false;               // 福地
    static UNION = false;                  // 妖盟
    static FRIENDS = false;                // 仙友
    static INVADE = false;                 // 异兽入侵
    static HERORANK = false;               // 群英榜
    static MAGIC = false;                  // 神通
    static PALACE = false;                 // 仙宫
    static EQUIPMENT_ADVANCE = false;      // 装备精炼
    static SECRETTOWER = false;            // 六道秘境
    static MAGIC_TREASURE = false;         // 法宝
    static STARTRIAL = false;              // 星宿试炼
    static GATHERENERGY = false;           // 聚灵阵
    static SOARING = false;                // 登天
    static SKY_WAR = false;                // 征战诸天
    static WORLD_RULE = false;             // 天地法则
    static RULE_TRIAL = false;             // 法则试炼
    static PET_KERNEL = false;             // 灵兽内丹
    static PUPIL = false;                  // 宗门
    static CLOUD_REFINE = false;           // 座驾注灵
    static FAIRY_LAND = false;             // 飞升仙界
    static UNIVERSE = false;               // 小世界
    static YARD = false;                   // 仙居
    static PLANES_TRIAL = false;           // 三界征途
    static UNION_TREASURE = false;         // 妖盟寻宝
    static YUE_BAO = false;                // 余额宝

    // 创建一个映射关系
    static systemMapping = {
        5: "SCORERANK",              // 斗法
        6: "WILDBOSS",               // 挑战妖王
        7: "PET",                    // 灵兽
        9: "TOWER",                  // 镇妖塔
        10: "CLOUD",                 // 座驾
        11: "SPIRIT",                // 精怪
        12: "TALENT",                // 先天灵脉
        15: "HOMELAND",              // 福地
        16: "UNION",                 // 妖盟
        17: "FRIENDS",               // 仙友
        19: "INVADE",                // 异兽入侵
        37: "HERORANK",              // 群英榜
        44: "MAGIC",                 // 神通
        54: "PALACE",                // 仙宫
        55: "EQUIPMENT_ADVANCE",     // 装备精炼
        56: "SECRETTOWER",           // 六道秘境
        63: "MAGIC_TREASURE",        // 法宝
        69: "STARTRIAL",             // 星宿试炼
        70: "GATHERENERGY",          // 聚灵阵
        76: "SOARING",               // 登天
        84: "SKY_WAR",               // 征战诸天
        90: "WORLD_RULE",            // 天地法则
        91: "RULE_TRIAL",            // 法则试炼
        117: "PET_KERNEL",           // 灵兽内丹
        118: "PUPIL",                // 宗门
        129: "CLOUD_REFINE",         // 座驾注灵
        142: "FAIRY_LAND",           // 飞升仙界
        143: "UNIVERSE",             // 小世界
        158: "YARD",                 // 仙居
        160: "PLANES_TRIAL",         // 三界征途
        162: "UNION_TREASURE",       // 妖盟寻宝
        170: "YUE_BAO"               // 余额宝        
    };

    // 102
    SyncData(t) {
        logger.info("[系统解锁] 同步信息...");
        // 转换为二进制
        this.systemUnlockInfo = BigInt(t.unlockInfo).toString(2);

        // const SystemIdList = DBMgr.inst.getPreviewSystemIdList();
        const SystemIdList = Object.keys(SystemUnlockMgr.systemMapping).map(Number);

        SystemIdList.forEach(systemId => {
            const isUnlocked = this.checkUnlockStateBySystemId(systemId);
            const systemKey = SystemUnlockMgr.systemMapping[systemId];

            if (systemKey) {
                SystemUnlockMgr[systemKey] = isUnlocked;
                const systemName = DBMgr.inst.getLanguageWord(`SystemName-${systemId}`);
                logger.info(`[系统解锁] ${isUnlocked ? `${global.colors.green}已解锁${global.colors.reset}` : `${global.colors.red}未解锁${global.colors.reset}`} ${systemName}`);
            } else {
                logger.warn(`[系统解锁] 未知 ${systemId}`);
            }
        });
    }

    checkUnlockStateBySystemId(systemId) {
        let isUnlocked = false;
        const index = this.systemUnlockInfo.length - systemId - 1;

        // 如果系统ID对应的索引合法并且该系统为开启状态，设置 isUnlocked 为 true
        if (index >= 0 && this.systemUnlockInfo[index] === "1") {
            isUnlocked = true;
        }

        return isUnlocked;
    }
}

// 1 = "EQUIPMENT",
// 2 = "GIFT",
// 3 = "SHOP",
// 4 = "PAYGIFT",
// 5 = "SCORERANK",
// 6 = "WILDBOSS",
// 7 = "PET",
// 8 = "FIRSTCHARGE",
// 9 = "TOWER",
// 10 = "CLOUD",
// 11 = "SPIRIT",
// 12 = "TALENT",
// 13 = "SIGNIN",
// 14 = "BALLGVG",
// 15 = "HOMELAND",
// 16 = "UNION",
// 17 = "FRIENDS",
// 18 = "FUND",
// 19 = "INVADE",
// 20 = "RUSH_RANK_ACTIVITY",
// 21 = "XYFUND",
// 22 = "CEREMONY_ACTIVITY",
// 23 = "CHAPTER",
// 24 = "SHARE_FRIEND",
// 25 = "LUCKYDRAW_ACTIVITY",
// 26 = "OPTIONAL_ACTIVITY",
// 28 = "PROP_BAG",
// 29 = "QUESTIONNAIRE",
// 30 = "GAMECLUB",
// 31 = "RECHARGE",
// 32 = "CHAT",
// 33 = "ADVERT",
// 34 = "PRIVILEGE_CARD",
// 35 = "PREVIEW",
// 36 = "TREE",
// 37 = "HERORANK",
// 38 = "UNION_SAME_NAME",
// 39 = "UNION_RECHARGE",
// 41 = "PETDREAMLAND",
// 42 = "SPIRIT_TRIAL",
// 43 = "TALENT_EMPOWER",
// 45 = "WEEK_ACTIVITY",
// 44 = "MAGIC",
// 46 = "ACCUMULATE_RECHARGE",
// 47 = "DAILY_RECHARGE",
// 48 = "CHARA",
// 50 = "MAN_HUANG",
// 49 = "SHOPKEEPER_ACTIVITY",
// 51 = "PETASSISTANT",
// 52 = "HOMELAND_GATHER",
// 55 = "EQUIPMENT_ADVANCE",
// 56 = "SECRETTOWER",
// 53 = "UNION_BATTLE",
// 54 = "PALACE",
// 57 = "PETSOULSHAPE",
// 58 = "UNION_BOSS",
// 59 = "ASK_DING",
// 60 = "UNION_AREA_WAR",
// 61 = "ASK_WAY",
// 62 = "PET_REFRESH_SKILL",
// 63 = "MAGIC_TREASURE",
// 64 = "SEEK_TREASURE",
// 65 = "POSTER",
// 66 = "TREASURE_PARTY",
// 67 = "UNION_FIGHT",
// 68 = "IMMORTAL_ISLAND",
// 69 = "STARTRIAL",
// 70 = "GATHERENERGY",
// 71 = "FAIRY_RABBIT",
// 78 = "MONSTER_SUMMER_SIGN",
// 79 = "MONSTER_SUMMER_RECHARGE",
// 82 = "PRIVILEGEACT",
// 89 = "MONSTER_SUMMER_DAILY_RECHARGE",
// 72 = "QQ_ADD_TICKET",
// 73 = "QQ_ADD_DESKTOP",
// 74 = "DY_ADD_DESKTOP",
// 75 = "DY_ADD_SIDEBAR",
// 76 = "SOARING",
// 80 = "GOD_BODY",
// 81 = "HOLIDAY_PRESENT",
// 83 = "HOMELAND_MANAGER",
// 84 = "SKY_WAR",
// 85 = "UNION_DUEL",
// 90 = "WORLD_RULE",
// 115 = "NEW_YEAR_BAG",
// 93 = "RULE_PARTY",
// 91 = "RULE_TRIAL",
// 95 = "HOLY_LAND",
// 94 = "DOURO",
// 97 = "MOUNTAIN_SEA",
// 98 = "SOULLIQUID",
// 99 = "TREASURE_BOWL",
// 100 = "REGRESSION",
// 101 = "RECALL",
// 102 = "RENEW",
// 103 = "SKY_PRESENT",
// 107 = "GOOD_FORTUNE",
// 108 = "DRAGON_HOME",
// 105 = "AUSPICIOUS_BLESS",
// 114 = "SDK_BACK",
// 92 = "KILL_TIME_ITEM",
// 104 = "SMALL_PRESENT",
// 96 = "SIGN_FUND",
// 110 = "FESTIVAL_CELEBRATIONS",
// 109 = "WEST_TRAVEL",
// 111 = "DOUBLE_DEMONS",
// 112 = "ZFB_REVISIT",
// 113 = "ZFB_SETHOME",
// 116 = "DEMONTOWER",
// 119 = "CASTSWORD",
// 118 = "PUPIL",
// 117 = "PET_KERNEL",
// 120 = "LIMIT_TIME_GROUP_BUY",
// 121 = "UNION_ASSEMBLE",
// 122 = "CHAOTIC_PET",
// 123 = "INNER_ALCHEMY",
// 124 = "OPENING_CEREMONY",
// 125 = "MAGIC_PRESET",
// 126 = "WECHAT_RANK",
// 127 = "WELFARE_ACTIVITY_STORAGE",
// 129 = "CLOUD_REFINE",
// 130 = "COMPOSE_BALL",
// 131 = "MONOPOLY",
// 132 = "SUPPRESS_DEMON",
// 133 = "FANREN_FUND",
// 134 = "FAN_REN",
// 135 = "PEACH_BANQUET",
// 136 = "UNION_BOUNTY",
// 137 = "HAO_LUCKYDRAW_ACTIVITY",
// 138 = "PUPIL_RANK",
// 139 = "BLOOD_FORBIDDEN",
// 140 = "PUPIL_FRIEND",
// 145 = "GOD_DEMON_BATTLE",
// 142 = "FAIRY_LAND",
// 143 = "UNIVERSE",
// 144 = "MAIL_SUBS",
// 146 = "PAINTING_FAIRYLAND",
// 141 = "HW_ADD_DESKTOP",
// 147 = "DY_ADD_DESKTOP_SEVEN",
// 154 = "MAGIC_SHOP",
// 151 = "UNIVERSE_PARTY",
// 153 = "ACCUMULATE_DAYS",
// 149 = "WISH_POOL",
// 150 = "SKY_TRADE",
// 152 = "AD_GIFT",
// 158 = "YARD",
// 159 = "SHURA_BATTLE",
// 155 = "KIDDING_SEA",
// 157 = "ALIPAY_GAMECLUB",
// 166 = "YARD_CEREMONY",
// 163 = "YELLOW_MOUNTAIN",
// 162 = "UNION_TREASURE",
// 160 = "PLANES_TRIAL",
// 161 = "VALENTINES_DAY",
// 170 = "YUE_BAO",
// 164 = "GAMECENTER",
// 174 = "MEMORY_COLLECT",
// 171 = "SWORD_TREASURE",
// 165 = "GoldPeach",
// 167 = "MEITUAN_SUBSCRIBE",
// 168 = "MEITUAN_DAILY",
// 172 = "REBORN_TRIAL",
// 173 = "GUARD_FAIRY_TREE",
// 169 = "MATCH_3",
// 177 = "LIVE_SHOW"