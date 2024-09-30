import FrogMgr from "#game/mgr/FrogMgr.js";
import GatherEnergyMgr from "#game/mgr/GatherEnergyMgr.js";
import HomelandMgr from "#game/mgr/HomelandMgr.js";
import InvadeMgr from "#game/mgr/InvadeMgr.js";
import MagicMgr from "#game/mgr/MagicMgr.js";
import MagicTreasureMgr from "#game/mgr/MagicTreasureMgr.js";
import PalaceMgr from "#game/mgr/PalaceMgr.js";
import PetKernelMgr from "#game/mgr/PetKernelMgr.js";
import PetMgr from "#game/mgr/PetMgr.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import PupilMgr from "#game/mgr/PupilMgr.js";
import RuleTrialMgr from "#game/mgr/RuleTrialMgr.js";
import SkyWarMgr from "#game/mgr/SkyWarMgr.js";
import SpiritMgr from "#game/mgr/SpiritMgr.js";
import StarTrialMgr from "#game/mgr/StarTrialMgr.js";
import UnionBountyMgr from "#game/mgr/UnionBountyMgr.js";
import UnionMgr from "#game/mgr/UnionMgr.js";
import UnionTreasureMgr from "#game/mgr/UnionTreasureMgr.js";
import UniverseMgr from "#game/mgr/UniverseMgr.js";
import WildBossMgr from "#game/mgr/WildBossMgr.js";
import YueBaoMgr from "#game/mgr/YueBaoMgr.js";
import logger from "#utils/logger.js";
import WorkFlowMgr from "#game/common/WorkFlowMgr.js";
import AdRewardMgr from "#game/mgr/AdRewardMgr";

class LoopMgr {

    constructor() {
        this.intervalTimeId = null;
        this.nextDayTime = 0;

        // 日常循环task,通常几分钟检查执行一次,如：福地,邮件,仙居，余额宝等
        this.loopTaskList = [];
        // 日常单次执行任务,循环后,任务完成就移除, 如: 砍树,灵脉,灵兽刷新,异兽等等。为了感觉更像人操作，都顺序操作
        this.onceTaskList = [];
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new LoopMgr();
            this._instance.init();
        }
        return this._instance;
    }

    init() {
        // 一次性任务
        this.add(PalaceMgr.inst);
        this.add(FrogMgr.inst);
        this.add(MagicMgr.inst);
        this.add(MagicTreasureMgr.inst);
        this.add(SpiritMgr.inst);
        this.add(PetMgr.inst);
        this.add(PetKernelMgr.inst);
        this.add(InvadeMgr.inst);
        this.add(SkyWarMgr.inst);
        this.add(StarTrialMgr.inst);
        this.add(RuleTrialMgr.inst);
        this.add(UnionTreasureMgr.inst);
        this.add(WildBossMgr.inst);
        // 砍树,灵脉
        this.add(PlayerAttributeMgr.inst);

        // 日常循环任务
        this.add(HomelandMgr.inst, true);
        this.add(YueBaoMgr.inst, true);
        this.add(PupilMgr.inst, true);
        this.add(GatherEnergyMgr.inst, true);
        this.add(UniverseMgr.inst, true);
        this.add(UnionMgr.inst, true);
        this.add(UnionBountyMgr.inst, true);
        this.add(AdRewardMgr.inst, true);
    }

    start() {
        this.end();
        WorkFlowMgr.inst.start();
        this.intervalTimeId = setInterval(() => {
            this.loopUpdate();
        }, 1000);
    }

    end() {
        clearInterval(this.intervalTimeId);
    }

    add(loopable, daliy = false) {
        if (daliy) {
            if (this.loopTaskList.indexOf(loopable) === -1) {
                this.loopTaskList.push(loopable);
            }
        } else {
            if (this.onceTaskList.indexOf(loopable) === -1) {
                this.onceTaskList.push(loopable);
            }
        }
    }

    remove(loopable) {
        logger.info(`[任务执行器] 任务移除, 移除任务:${loopable.constructor.name}`);
        if (this.onceTaskList.indexOf(loopable) !== -1) {
            this.onceTaskList.splice(this.onceTaskList.indexOf(loopable), 1);
        }

        if (this.loopTaskList.indexOf(loopable) !== -1) {
            this.loopTaskList.splice(this.loopTaskList.indexOf(loopable), 1);
        }
    }

    loopUpdate() {
        const now = Math.floor(Date.now() / 1000);
        this.loopTaskList.forEach(item => {
            if (item && typeof item.loopUpdate === 'function') {
                item.loopUpdate();
            }
        });

        if (this.onceTaskList) {
            this.onceTaskList.forEach(item => {
                if (item && typeof item.loopUpdate === 'function') {
                    item.loopUpdate();
                }
            });
        }

        if (this.nextDayTime && now > this.nextDayTime) {
            this.refreshNextDayTime();
        }
    }

    refreshNextDayTime() {
        this.nextDayTime = this.getCurZeroTime() + 86400;
    }

    getCurZeroTime() {
        const utcOffset = 8; // 东八区
        const now = new Date();

        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const localTime = new Date(utcTime + (utcOffset * 3600000));

        localTime.setHours(0, 0, 0, 0);

        return localTime.getTime() / 1000;
    }

    resumeLoginIn() {
        this.loopUpdate();
    }
}

export default LoopMgr;