import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";
import LoopMgr from "#game/common/LoopMgr.js";
import DBMgr from "#game/common/DBMgr.js";
import BagMgr from "#game/mgr/BagMgr.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr.js";
import UnionMgr from "#game/mgr/UnionMgr.js";
import RegistMgr from "#game/common/RegistMgr.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";

class Attribute {
    static Chop(times = 1) {
        logger.debug(`[砍树] 砍树 ${times} 次`);

        const separation = global.account.chopTree.separation;
        let attr = separation.strictMode
            ? [...new Set(separation.strictConditions.flatMap(condition => [...condition.primaryAttribute, ...condition.secondaryAttribute]))]
            : separation.condition.flat();

        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_DREAM_MSG, { auto: true, attr: attr, times: times });
    }

    static CheckUnfinishedEquipment() {
        logger.debug(`查看掉落装备`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_GET_UNDEAL_EQUIPMENT_MSG, {});
    }

    static FetchSeparation() {
        logger.debug(`获取分身数据`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_GET_SEPARATION_DATAA_MSG_LIST_REQ, {});
    }

    static SwitchSeparation(idx) {
        logger.debug(`切换分身 ${idx}`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_SWITCH_SEPARATION_REQ, { separationIdx: idx });
    }

    static DealEquipmentEnum_Resolve(idList) {
        logger.debug(`粉碎装备`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_EQUIPMENT_DEAL_MSG, { type: 1, idList: idList });
    }

    static DealEquipmentEnum_EquipAndResolveOld(id) {
        logger.debug(`佩戴装备 & 分解旧装备`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_ATTRIBUTE_EQUIPMENT_DEAL_MSG, { type: 2, idList: [id] });
    }

    static RandomTalentReq(times) {
        logger.debug(`[灵脉] 随机灵脉 ${times} 次`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_TALENT_RANDOM_TALENT, { randomTimes: times });
    }

    static CheckUnfinishedTalent() {
        logger.debug(`查看掉落灵脉`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_TALENT_GET_UNDEAL_TALENT_MSG, {});
    }

    // static DealTalentEnum_Equip() {
    //     logger.debug(`给当前分身装备灵脉`);
    //     return GameNetMgr.inst.sendPbMsg(Protocol.S_TALENT_DEAL_TALENT, { dealData: [{ index: 0, type: 0 }] });
    // }

    static DealTalentEnum_Resolve() {
        logger.debug(`粉碎灵脉`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_TALENT_DEAL_TALENT, { dealData: [{ index: 0, type: 1 }] });
    }

    static DealTalentEnum_EquipAndResolveOld() {
        logger.debug(`佩戴灵脉 & 分解旧灵脉`);
        return GameNetMgr.inst.sendPbMsg(Protocol.S_TALENT_DEAL_TALENT, { dealData: [{ index: 0, type: 2 }] });
    }
}

export default class PlayerAttributeMgr {
    constructor() {
        this.AD_REWARD_DAILY_MAX_NUM = 8;                           // 每日最大领取次数
        this.AD_REWARD_CD = 30 * 60 * 1000;                         // 每次间隔时间 (30分钟)
        this.separation = false;                                    // 是否有分身
        this.separationNames = {
            0: "元体",
            1: "阳神",
            2: "阴身"
        };
        this.useSeparationIdx = null;                               // 使用的分身

        // 仙树及砍树
        this.treeInitialized = false;                               // 树是否初始化

        this.equipmentData = { 0: [], 1: [], 2: [] };
        this.treeLevel = 1;                                         // 树等级
        this.chopTimes = 1;                                         // 根据树等级计算砍树次数

        this.unDealEquipmentDataMsg = [];                           // 未处理装备数据
        this.chopEnabled = global.account.switch.chopTree || false; // 是否开启砍树
        this.previousPeachNum = 0;                                  // 用于存储上一次的桃子数量
        this.initPeachNum = -1;                                     // 用于存储初始桃子数量
        this.doneUnionTask = false;                                 // 是否开启妖盟任务

        // 灵脉
        this.talentData = { 0: [], 1: [], 2: [] };                  // 灵脉数据
        this.talentCreateLevel = 1;                                 // 灵脉等级
        this.talentCreateTimes = 1;                                 // 砍灵脉次数

        this.unDealTalentDataMsg = [];                              // 未处理灵脉数据
        this.talentEnabled = global.account.switch.talent || false; // 是否开启砍灵脉
        this.previousFlowerNum = 0;                                 // 用于存储上一次的灵脉花数量
        this.initFlowerNum = -1;                                    // 初灵脉花数量

        // 🔒储存状态防止出现问题
        this.isProcessing = false;

        LoopMgr.inst.add(this);
        RegistMgr.inst.add(this);
    }

    static isMonthCardVip = false;  // 月卡
    static isYearCardVip = false;   // 终身卡
    static level = 0;               // 玩家等级
    static littleType = 0;          // 小境界
    static bigType = 0;             // 大境界 
    static fightValue = 0;          // 妖力

    static get inst() {
        if (!this._instance) {
            this._instance = new PlayerAttributeMgr();
        }
        return this._instance;
    }

    reset() {
        this._instance = null;
    }

    clear() {
        LoopMgr.inst.remove(this);
    }

    // 新增方法：手动设置分身
    setSeparationIdx(index) {
        if (this.useSeparationIdx !== index) {
            logger.info(`[分身切换器] 至 ${this.separationNames[index]}`);
            Attribute.SwitchSeparation(index);
        }
    }

    switchToDefaultSeparation() {
        const defaultIdx = global.account.switch.defaultIndex || 0;
        PlayerAttributeMgr.inst.setSeparationIdx(defaultIdx);
    }

    // 201 玩家属性信息同步
    SyncAttribute(t) {
        const realms = DBMgr.inst.getRealms(t.realmsId);
        PlayerAttributeMgr.littleType = realms.littleType;
        PlayerAttributeMgr.bigType = realms.bigType;
        PlayerAttributeMgr.level = t.realmsId;
        PlayerAttributeMgr.fightValue = t.fightValue;
        if (t.useSeparationIdx !== null) {
            this.useSeparationIdx = t.useSeparationIdx;
        }
        logger.info(`[属性管理] 当前分身: ${this.separationNames[this.useSeparationIdx]} 等级: ${PlayerAttributeMgr.level} 境界: ${DBMgr.inst.getLanguageWord(realms.name)} 妖力: ${PlayerAttributeMgr.fightValue}`);
    }

    // 215 同步分身数据
    checkSeparation(t) {
        if (t.ret === 0 && Array.isArray(t.useSeparationDataMsg) && t.useSeparationDataMsg.length === 3) {
            logger.debug("[属性管理] 有分身数据");
            this.separation = true;

            logger.debug("[属性管理] 更新分身数据");
            t.useSeparationDataMsg.forEach((data) => {
                if (data.hasOwnProperty("index")) {
                    this.equipmentData[data.index] = data.equipmentList || [];
                    this.talentData[data.index] = data.talentData || [];
                }
            });
        }
    }

    // 209 处理装备
    async handlerEquipment(t) {
        if (t.ret === 0) {
            if (this.isProcessing) {
                logger.debug(`[砍树] 忙碌中，跳过处理`);
                return;
            }

            this.isProcessing = true;
            this.unDealEquipmentDataMsg = t.undDealEquipmentDataMsg; // 就是这样写的...

            const listResolve = [];

            for (let i = 0; i < this.unDealEquipmentDataMsg.length; i++) {
                const equipment = this.unDealEquipmentDataMsg[i];
                const u = equipment.unDealEquipmentData; // 该装备的未处理数据
                const id = u.id; // 该装备的id
                const quality = u.quality; // 该装备的品质
                const level = u.level; // 该装备的等级
                const attributeList = this.processAttributes(u.attributeList); // 使用转换后的属性列表
                const equipmentId = u.equipmentId; // 该装备的装备id
                const equipmentData = DBMgr.inst.getEquipment(equipmentId);
                const equipmentName = equipmentData.name;
                const equipmentType = equipmentData.type - 1;

                let processed = await this.processEquipment(quality, level, attributeList, equipmentType, id, equipmentId);

                if (!processed) {
                    logger.debug(`[装备] 分解 ${id} ${DBMgr.inst.getEquipmentQuality(quality)} ${equipmentName}`);
                    listResolve.push(id);
                }
            }

            if (listResolve.length > 0) {
                Attribute.DealEquipmentEnum_Resolve(listResolve);
            }
            this.isProcessing = false;
        }
    }

    haveUnDealEquipment() {
        return this.unDealEquipmentDataMsg.length > 0
    }

    async processEquipment(quality, level, attributeList, equipmentType, id, equipmentId) {
        // 不支持未分身
        if (!this.separation) return false;

        const showResult = global.account.chopTree.showResult || false;
        const rule = global.account.chopTree.separation;
        const attackType = attributeList.attack.type;
        const defenseType = attributeList.defense.type;
        let originalEquipmentDesc;
        const newEquipmentDesc = `${DBMgr.inst.getEquipmentQuality(quality)} ${DBMgr.inst.getEquipmentName(equipmentId)} ${DBMgr.inst.getAttribute(attackType)}:${attributeList.attack.value / 10} ${DBMgr.inst.getAttribute(defenseType)}:${attributeList.defense.value / 10}`;

        // 判断使用的条件类型
        const conditions = rule.strictMode ? rule.strictConditions : rule.condition;
        const { result, index } = this.checkMultipleConditions(attackType, [attackType, defenseType], conditions, rule.strictMode);

        // 过滤掉不符合需求的装备
        if (!result) return false;

        let betterAttributes = false;
        let existingAttributeList = null;
        let existingExist = true;

        // 如果分身没装备就直接穿上
        if (!this.equipmentData[index][equipmentType]) {
            betterAttributes = true;
            existingExist = false;
            logger.warn(`[装备] 分身${this.separationNames[index]} 无原装备`);
            logger.warn(`${JSON.stringify(this.equipmentData[index])}`);
        } else {
            // 分身装备属性转换
            existingAttributeList = this.processAttributes(this.equipmentData[index][equipmentType].attributeList);
            originalEquipmentDesc = `${DBMgr.inst.getEquipmentQuality(this.equipmentData[index][equipmentType].quality)} ${DBMgr.inst.getEquipmentName(this.equipmentData[index][equipmentType].equipmentId)} ${DBMgr.inst.getAttribute(existingAttributeList.attack.type)}:${existingAttributeList.attack.value / 10} ${DBMgr.inst.getAttribute(existingAttributeList.defense.type)}:${existingAttributeList.defense.value / 10}`;
            if (quality >= rule.quality && showResult) {
                logger.info(`[装备] ${newEquipmentDesc} 等级${level} 与原装备对比 ${originalEquipmentDesc} 等级${this.equipmentData[index][equipmentType].level}`);
            }
        }

        // 装备属性和等级判断
        if (!betterAttributes && quality >= rule.quality) {
            // 在 levelDiff 在 0 - levelOffset 范围内时进行线性插值计算，而在 levelDiff > levelOffset 时进行平方处理
            const levelOffset = rule.levelOffset || 5;
            const levelDiff = level - this.equipmentData[index][equipmentType].level;
            const lvLow = levelDiff > levelOffset;
            const probOffsetlow = rule.probOffsetLowLv || rule.probOffset;
            const tempOffset = (lvLow ? probOffsetlow : rule.probOffset) / 4;
            const lowerBoundMultiplier = 1 - Math.pow(1 - tempOffset, 2);

            let offsetMultiplier = 1;
            if (levelDiff > 0 && levelDiff <= levelOffset) {
                offsetMultiplier = 1 - (lowerBoundMultiplier / levelOffset * levelDiff);
            } else if (lvLow) {
                offsetMultiplier = Math.pow(1 - tempOffset, 2);
            }
            
            // 确保 offsetMultiplier 不会超过 1
            offsetMultiplier = Math.min(offsetMultiplier, 1);

            logger.info(`[装备] ${attributeList.attack.value} 大于 ${existingAttributeList.attack.value} * ${offsetMultiplier} = ${existingAttributeList.attack.value * offsetMultiplier}`)
            if (level >= (this.equipmentData[index][equipmentType].level - 1) && parseFloat(attributeList.attack.value) >= parseFloat(existingAttributeList.attack.value) * offsetMultiplier) {
                if (showResult) logger.error(`[装备] ${newEquipmentDesc} 等级${level} 大于 分身${this.separationNames[index]} ${this.equipmentData[index][equipmentType].level} 且攻击属性 ${attributeList.attack.value} 大于 ${existingAttributeList.attack.value} * ${offsetMultiplier} = ${existingAttributeList.attack.value * offsetMultiplier}`);
                betterAttributes = true;
            }

            // 去掉当前身上不符合条件的装备
            const primaryMatch = rule.strictMode ? conditions[index].primaryAttribute.includes(existingAttributeList.attack.type) : conditions[index].includes(existingAttributeList.attack.type);
            const secondaryMatch = rule.strictMode ? conditions[index].secondaryAttribute.includes(existingAttributeList.defense.type) : true; // 非严格模式下忽略副属性
            if (!(primaryMatch && secondaryMatch)) {
                if (showResult) logger.error(`[装备] 分身${this.separationNames[index]} 已装备的主属性或副属性不符合期望`);
                betterAttributes = true;
            }
        }

        // 无视品质 属性高于概率偏移值
        if (existingExist && parseFloat(attributeList.attack.value) >= parseFloat(existingAttributeList.attack.value) * (1 + rule.probOffset)) {
            if (showResult) logger.error(`[装备] ${newEquipmentDesc} 攻击属性 ${attributeList.attack.value} 大于 分身${this.separationNames[index]} ${existingAttributeList.attack.value} * ${1 + rule.probOffset} = ${existingAttributeList.attack.value * (1 + rule.probOffset)}`);
            betterAttributes = true;
        }

        if (betterAttributes) {
            if (existingExist) {
                logger.info(`[装备] 分身${this.separationNames[index]} 原装备 ${originalEquipmentDesc}`);
            }
            logger.warn(`[装备] 分身${this.separationNames[index]} 新装备 ${newEquipmentDesc}`);

            // 切换分身
            this.setSeparationIdx(index)
            Attribute.DealEquipmentEnum_EquipAndResolveOld(id);
            Attribute.FetchSeparation();
            return true;
        }
    }

    doChopTree() {
        const peachNum = BagMgr.inst.getGoodsNum(100004);
    
        // 记录初始数量
        if (this.initPeachNum == -1) {
            this.initPeachNum = peachNum;
        }

        // 停止砍树的桃子数量
        const stopNum = global.account.chopTree?.stop?.num ?? 50;
        // 停止砍树的玩家等级
        const stopLevel = (typeof global.account.chopTree?.stop?.level === 'string' && global.account.chopTree.stop.level.toLowerCase() === 'infinity') ? Infinity : (global.account.chopTree?.stop?.level || Infinity);
        // 默认为不限制执行次数, 砍多少次就停
        const doNum = (typeof global.account.chopTree?.stop?.doNum === 'string' && global.account.chopTree.stop.doNum.toLowerCase() === 'infinity') ? Infinity : (global.account.chopTree?.stop?.doNum || Infinity);

        // 已经完成的砍树次数
        const hasDoNum = this.initPeachNum - peachNum;

        // 判断是否停止任务
        if (peachNum <= stopNum || this.level <= stopLevel || hasDoNum >= doNum) {
            logger.warn(`[砍树] 停止任务, 还剩余 ${peachNum} 桃子`);
            this.chopEnabled = false;

            // 任务完成后切换为默认分身
            this.switchToDefaultSeparation();
            WorkFlowMgr.inst.remove("ChopTree");
            return;
        }

        // 更新上一次数量
        if (peachNum !== this.previousPeachNum) {
            logger.info(`[砍树] 还剩 ${peachNum} 桃子`);
            this.previousPeachNum = peachNum;
        }
        Attribute.Chop(this.chopTimes);
        Attribute.CheckUnfinishedEquipment();

        // 当加入妖盟且砍了350颗桃后
        if (UnionMgr.inst.inUnion && !this.doneUnionTask) {
            if (peachNum - this.initPeachNum >= 350) {
                GameNetMgr.inst.sendPbMsg(Protocol.S_TASK_GET_REWARD, { taskId: [120001, 120002, 120003, 120004, 120005] });
                this.doneUnionTask = true;
            }
        }
    }

    processAttributes(attributeList) {
        const attributes = {
            basic: {
                1: null,
                2: null,
                3: null,
                4: null,
            },
            attack: null,
            defense: null,
        };

        for (const attr of attributeList) {
            if (attr.type >= 1 && attr.type <= 4) {
                attributes.basic[attr.type] = parseFloat(attr.value);
            } else if (attr.type >= 5 && attr.type <= 10) {
                attributes.attack = { type: attr.type, value: parseFloat(attr.value) };
            } else if (attr.type >= 11 && attr.type <= 16) {
                attributes.defense = { type: attr.type, value: parseFloat(attr.value) };
            }
        }

        return attributes;
    }

    checkCondition(input, condition, strictMode = false) {
        for (let i = 0; i < condition.length; i++) {
            if (strictMode) {
                // 严格模式下的条件
                const primary = condition[i].primaryAttribute || [];
                const secondary = condition[i].secondaryAttribute || [];

                // 检查主属性和副属性是否在要求范围内
                const primaryMatches = primary.includes(input.primary);
                const secondaryMatches = input.secondary.some(attr => secondary.includes(attr));

                if (primaryMatches && secondaryMatches) {
                    return { result: true, index: i };
                }
            } else {
                // 非严格模式下的条件判断
                for (let j = 0; j < condition[i].length; j++) {
                    const element = condition[i][j];
                    if (Array.isArray(element) && Array.isArray(input) && input.length === element.length && input.every((val, index) => val === element[index])) {
                        return { result: true, index: i };
                    } else if (element === input) {
                        return { result: true, index: i };
                    }
                }
            }
        }
        return { result: false, index: -1 };
    }

    checkMultipleConditions(primaryType, attributeTypes, condition, strictMode = false) {
        const input = strictMode ? {
            primary: primaryType,
            secondary: attributeTypes
        } : primaryType;

        let result = this.checkCondition(input, condition, strictMode);
        if (result.result) {
            return result;
        }

        if (!strictMode) {
            result = this.checkCondition(attributeTypes, condition);
        }

        return result;
    }

    // 621 灵脉数据初始化
    handlerTalentInit(body) {
        logger.debug("[灵脉] 初始化灵脉数据");
        this.talentCreateLevel = body.talentCreateLevel || 1;
        this.calculateTalentMultiplier(this.talentCreateLevel);
    }

    calculateTalentMultiplier(level) {
        // level 大于40 为3次 20-39为2次 0-19为1次
        if (level >= 40) {
            this.talentCreateTimes = 3;
        } else if (level >= 20) {
            this.talentCreateTimes = 2;
        } else {
            this.talentCreateTimes = 1;
        }
    }

    // 625 处理灵脉
    async handlerTalent(t) {
        if (t.ret === 0) {
            if (t.unDealTalentDataMsg.length === 0) {
                logger.debug(`[灵脉] 无未处理灵脉数据`);
                return;
            }

            if (this.isProcessing) {
                logger.debug(`[灵脉] 忙碌中，跳过处理`);
                return;
            }

            this.isProcessing = true;

            this.unDealTalentDataMsg = t.unDealTalentDataMsg;

            for (let i = 0; i < this.unDealTalentDataMsg.length; i++) {

                const u = this.unDealTalentDataMsg[i].talentData; // 该灵脉的未处理数据
                const name = DBMgr.inst.getLanguageWord(`Talent_Name-${u.talentId}`);  // 灵脉名称

                let processed = await this.processTalent(u, name);

                if (!processed) {
                    logger.debug(`[灵脉] 分解 ${name}`);
                    Attribute.DealTalentEnum_Resolve()
                }
            }

            this.isProcessing = false;
        }
    }

    async processTalent(u, name) {
        const showResult = global.account.talent.showResult || false;
        const separation = global.account.talent.separation;

        const quality = u.quality;       // 灵脉品质
        const talentType = u.type - 1;   // 灵脉类型 就是孔位 对应身体实际的需要减1
        let originalTalentDesc;
        const newTalentDesc = `${DBMgr.inst.getEquipmentQuality(quality)} ${u.attributeData.map(attr => `${DBMgr.inst.getAttribute(attr.type)}: ${attr.value}`).join(', ')}`;

        // 判断是否为特殊灵脉
        let isSpecial = false;
        if ([2, 4, 8, 10].includes(talentType)) {

            let skillIds = [...new Set(separation.condition.flatMap(condition => [...condition.skillId]))]
            if (!skillIds.includes(u.skillId)) {
                logger.warn(`[灵脉] ${name} 特殊灵脉为${DBMgr.inst.getAttribute(u.skillId)} 不匹配`);
                return false
            }
            isSpecial = true;
        }

        let betterAttributes = false;
        let existingExist = true;
        let index;

        if (quality >= separation.quality) {
            if (showResult) logger.info("[灵脉] 灵脉品质符合");

            // 符合哪个分身的条件
            index = this.checkTalentCondition(u, separation.condition, isSpecial);
            if (index == -1) {
                if (showResult) logger.info(`[灵脉] 粗筛不符合条件`);
                return false;
            }

            // 如果分身没装备就直接穿上
            if (!this.talentData[index][talentType]) {
                betterAttributes = true;
                existingExist = false;
                logger.warn(`[灵脉] 分身${this.separationNames[index]} 未装备灵脉`);
            }

            if (existingExist) {
                if (showResult) logger.info("[灵脉] 分身已装备灵脉, 比较详细数值");
                originalTalentDesc = `${DBMgr.inst.getEquipmentQuality(this.talentData[index][talentType].quality)} ${this.talentData[index][talentType].attributeData.map(attr => `${DBMgr.inst.getAttribute(attr.type)}: ${attr.value}`).join(', ')}`;

                // 已装备的灵脉不符合条件 直接换新
                const talentAttributes = this.talentData[index][talentType].attributeData.map(attr => parseInt(attr.type));
                const requiredAttributes = separation.condition[index].attribute;
                const isMatching = requiredAttributes.every(attr => talentAttributes.includes(attr));
                if (!isMatching) {
                    if (showResult) logger.info("[灵脉] 已装备的灵脉不符合条件 直接换新");
                    betterAttributes = true;
                }

                // 打分制比较需要比较的属性值
                if (!betterAttributes) {
                    betterAttributes = this.detailedCompareTalent(this.talentData[index][talentType].attributeData, u.attributeData, separation.condition[index].attribute);
                }
            }
        }

        if (betterAttributes) {
            if (existingExist) {
                logger.info(`[灵脉] 分身${this.separationNames[index]} ${name} 原灵脉 ${originalTalentDesc}`);
            }
            logger.error(`[灵脉] 分身${this.separationNames[index]} ${name} 新灵脉 ${newTalentDesc}`);

            // 切换分身
            this.setSeparationIdx(index)
            Attribute.DealTalentEnum_EquipAndResolveOld();
            Attribute.FetchSeparation();
            return true;
        }

        return false;
    }

    detailedCompareTalent(oldAttr, newAttr, condition) {
        let totalDifference = 0;
    
        condition.forEach(attrType => {
            const oldAttribute = oldAttr.find(attr => attr.type === attrType);
            const newAttribute = newAttr.find(attr => attr.type === attrType);
    
            const oldValue = oldAttribute ? parseInt(oldAttribute.value) : 0;
            const newValue = newAttribute ? parseInt(newAttribute.value) : 0;
    
            let weight = 1;  // 默认权重

            if (oldValue > 0) {
                let difference = (newValue - oldValue) / oldValue;
    
                if (difference >= 0 && attrType === 4) {
                    weight = 1.05;  // 太大会影响平衡
                }
    
                totalDifference += difference * weight;
            }
        });
    
        // 返回累加差值是否大于 0，表示新值整体是否优于旧值
        return totalDifference > 0;
    }

    checkTalentCondition(u, condition, isSpecial) {
        const talentAttributes = u.attributeData.map(attr => parseInt(attr.type));
        const talentValues = u.attributeData.reduce((acc, attr) => {
            acc[attr.type] = parseInt(attr.value);
            return acc;
        }, {});

        let matchedCondition = -1;
        let highestScore = -1;
        let highestPriority = Infinity;

        for (let i = 0; i < condition.length; i++) {
            const c = condition[i];

            // 检查属性是否严格匹配
            const attributesMatch = c.attribute.every(attr => talentAttributes.includes(attr));

            let skillIdMatch = true;
            if (isSpecial) {
                skillIdMatch = c.skillId.includes(u.skillId);
            }

            // 如果属性和技能ID都严格匹配
            if (attributesMatch && skillIdMatch) {
                // 计算当前条件的得分
                let currentScore = 0;
                c.attribute.forEach(attrType => {
                    if (talentValues[attrType] !== undefined) {
                        currentScore += talentValues[attrType];
                    }
                });

                // 如果当前条件的得分更高，或者得分相同但优先级更高
                if ((currentScore > highestScore) || (currentScore === highestScore && c.priority < highestPriority)) {
                    matchedCondition = i;
                    highestScore = currentScore;
                    highestPriority = c.priority;
                }
            }
        }

        return matchedCondition;
    }

    doAutoTalent() {
        const flowerNum = BagMgr.inst.getGoodsNum(100007);

        // 记录初始数量
        if (this.initFlowerNum == -1) {
            this.initFlowerNum = flowerNum;
        }

        // 停止数量
        const stopNum = global.account.talent?.stop?.stopNum ?? this.talentCreateTimes;
        // 默认为不限制执行次数, 砍多少次就停
        const doNum = (typeof global.account.talent?.stop?.doNum === 'string' && global.account.talent.stop.doNum.toLowerCase() === 'infinity') ? Infinity : (global.account.talent?.stop?.doNum || Infinity);
       
        // 已经完成的数量
        const hasDoNum = this.initFlowerNum - flowerNum;
        // 判断是否停止任务
        if (flowerNum <= stopNum || hasDoNum >= doNum) {
                logger.warn(`[灵脉] 停止任务, 还剩余 ${flowerNum} 先天灵草`);
                this.talentEnabled = false;

                // 任务完成后切换为默认分身
                this.switchToDefaultSeparation();
                WorkFlowMgr.inst.remove("Talent");
                return;
        }

        // 更新上一次数量
        if (flowerNum !== this.previousFlowerNum) {
            logger.info(`[灵脉] 还剩 ${flowerNum} 灵脉花`);
            this.previousFlowerNum = flowerNum;
        }
        let times = this.talentCreateTimes
        if (flowerNum < this.talentCreateTimes) {
            times = 1
        }
        Attribute.RandomTalentReq(times);
        Attribute.CheckUnfinishedTalent();
    }

    // 207 仙树初始化以及自动升级
    SyncTree(t) {
        if (!this.treeInitialized) {
            this.getAdRewardTimes = t.freeSpeedUpTimes || 0;
            this.dreamLvUpEndTime = parseInt(t.dreamLvUpEndTime, 10) || 0;
            this.lastAdRewardTime = parseInt(t.freeSpeedUpCdEndTime, 10) || 0;
            this.treeInitialized = true;
        }
        this.treeLevel = t.dreamLv;
        this.calculateMultiplier(this.treeLevel);
    }

    calculateMultiplier(treeLevel) {
        if (treeLevel >= 22) {
            this.chopTimes = 6;
        } else if (treeLevel >= 19) {
            this.chopTimes = 5;
        } else if (treeLevel >= 17) {
            this.chopTimes = 4;
        } else if (treeLevel >= 12) {
            this.chopTimes = 3;
        } else if (treeLevel >= 9) {
            this.chopTimes = 2;
        } else {
            this.chopTimes = 1;
        }
    }

    processReward() {
        const now = Date.now();
        let canExecuteReward = false;

        if (this.getAdRewardTimes == 0 && this.dreamLvUpEndTime !== 0) {
            canExecuteReward = true;
        } else if (this.getAdRewardTimes < this.AD_REWARD_DAILY_MAX_NUM && now - this.lastAdRewardTime >= this.AD_REWARD_CD && this.dreamLvUpEndTime !== 0) {
            canExecuteReward = true;
        }

        if (canExecuteReward) {
            const logContent = `[仙树管理] 还剩 ${this.AD_REWARD_DAILY_MAX_NUM - this.getAdRewardTimes} 次广告激励`;
            AdRewardMgr.inst.AddAdRewardTask({ protoId: Protocol.S_ATTRIBUTE_DREAM_LV_UP_SPEED_UP, data: { speedUpType: 1, useTimes: 1, isUseADTime: false }, logStr: logContent });
            this.getAdRewardTimes++;
            this.lastAdRewardTime = now;
        }
    }

    // 104 判断是否VIP
    SyncVip(t) {
        const monthlyCardExpired = this.isExpired(t.monthlyCardEndTime);
        const getMonthlyCardRewardToday = this.isToday(t.getMonthlyCardRewardTime);
        const yearCardExpired = this.isYearCardEndTimeNegativeOne(t.yearCardEndTime);
        const getYearCardRewardToday = this.isToday(t.getYearCardRewardTime);

        if (!monthlyCardExpired) {
            logger.info(`[玩家管理] 检测到月卡`);
            PlayerAttributeMgr.isMonthCardVip = true;
            if (!getMonthlyCardRewardToday) {
                logger.info(`[玩家管理] 月卡领取奖励`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_PRIVILEGE_CARD_RECEIVE_REWARD, { type: 1 });
            }
        }

        if (!yearCardExpired) {
            logger.info(`[玩家管理] 检测到年卡`);
            PlayerAttributeMgr.isYearCardVip = true;
            if (!getYearCardRewardToday) {
                logger.info(`[玩家管理] 年卡领取奖励`);
                GameNetMgr.inst.sendPbMsg(Protocol.S_PRIVILEGE_CARD_RECEIVE_REWARD, { type: 2 });
            }
        }
    }

    isExpired(timestamp) {
        const now = Date.now();
        return parseInt(timestamp, 10) < now;
    }

    isToday(timestamp) {
        const date = new Date(parseInt(timestamp, 10));
        const today = new Date();
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }

    isYearCardEndTimeNegativeOne(timestamp) {
        return !(Number(timestamp) !== 0);
    }

    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;
    
        try {
            // 自动升级仙树
            this.processReward();

            // 检查分身是否存在
            if (!this.separationChecked && !this.separation) {
                const retries = 3;
                const delay = 3000;

                for (let attempt = 1; attempt <= retries; attempt++) {
                    try {
                        Attribute.FetchSeparation();
                        await new Promise(resolve => setTimeout(resolve, delay));
                        if (!this.separation) {
                            throw new Error('获取分身失败');
                        } else {
                            logger.info(`[获取分身] ${global.colors.red}获取分身成功${global.colors.reset}`);
                            break;
                        }
                    } catch (error) {
                        logger.warn(`[获取分身] 第 ${attempt}/${retries} 次尝试失败, 等待 ${delay / 1000} 秒后重试...`);
                        if (attempt < retries) {
                            await new Promise(resolve => setTimeout(resolve, delay));
                        } else {
                            logger.error(`[获取分身] 重试 ${retries} 次后仍然失败，跳过分身检查`);
                        }
                    }
                }
                this.separationChecked = true;
            }

            // 分身不存在跳过后续任务
            if (!this.separation) {
                logger.debug(`[获取分身] 未找到分身，跳过任务`);
                WorkFlowMgr.inst.remove("ChopTree");
                WorkFlowMgr.inst.remove("Talent");
                return;
            }
    
            // 自动砍树逻辑
            if (WorkFlowMgr.inst.canExecute("ChopTree")) {
                if (this.chopEnabled) {
                    this.doChopTree();
                } else {
                    WorkFlowMgr.inst.remove("ChopTree");
                    logger.warn(`[砍树] 未执行`);
                }
            }
    
            // 自动砍灵脉逻辑
            if (WorkFlowMgr.inst.canExecute("Talent")) {
                if (this.talentEnabled) {
                    this.doAutoTalent();
                } else {
                    WorkFlowMgr.inst.remove("Talent");
                    logger.warn(`[灵脉] 未执行`);
                }
            }
        } catch (error) {
            logger.error(`[PlayerAttributeMgr] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}
