import logger from "#utils/logger.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";

/**
 * 邮件奖励
 */
export default class MailRewardMgr {

    constructor() {
        this.isProcessing = false;
        this.mailList = [];
        this.AD_CD = 5 * 60 * 1000;
        this.lastRewardTime = 0;
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new MailRewardMgr();
        }
        return this._instance;
    }

    // 邮件数据同步
    MailListMsg(t) {
        this.isProcessing = true;
        this.mailList = t.mailList;
        this.isProcessing = false;
    }

    processReward() {
        const isGetReward = this.mailList.some(item => item.isGetReward);
        
        // 如果有奖励,就执行一键领取
        if (isGetReward) {
            GameNetMgr.inst.sendPbMsg(Protocol.S_MAIL_GET_ALL_REWARD, {});
        }
    }


    async loopUpdate() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const now = Date.now();
            if (now - this.lastRewardTime >= this.AD_CD) {
                this.processReward();
                this.lastRewardTime = now;
            }
        } catch (error) {
            logger.error(`[邮件管理] loopUpdate error: ${error}`);
        } finally {
            this.isProcessing = false;
        }
    }
}