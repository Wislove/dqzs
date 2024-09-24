import Protocol from '#game/net/Protocol.js';
import Stream from '#game/net/Stream.js';
import ProtobufMgr from '#game/net/ProtobufMgr.js';
import { NetSocket, NetState } from '#game/net/NetSocket.js';

import logger from "#utils/logger.js";
import AuthService from "#services/authService.js";
import MsgRecvMgr from '#game/common/MsgRecvMgr.js';
import LoopMgr from '#game/common/LoopMgr.js';
import RegistMgr from '#game/common/RegistMgr.js';
import WorkFlowMgr from '#game/common/WorkFlowMgr.js';

class GameNetMgr {
    constructor() {
        this.token = null;
        this.playerId = null;
        // Server
        this.net = new NetSocket();
        this.isLogined = false;
        this.isReConnectting = false;
        // handlers
        this.handlers = {};
        // Msg
        this.sendMsgLength = 0;
        // Retry parameters
        this.maxRetries = (typeof global.account.maxRetries === 'string' && global.account.maxRetries.toLowerCase() === 'infinity') ? Infinity : (global.account.maxRetries || 10); // 默认最大重连次数
        this.retryCount = 0;    // 当前重连次数

        this.messageQueue = []; // 创建消息队列
        this.isSending = false; // 标记是否正在发送消息
    }

    static get inst() {
        if (this._instance == null) {
            this._instance = new GameNetMgr();
        }
        return this._instance;
    }

    connectGameServer(url, playerId, token) {
        this.playerId = playerId;
        this.token = token;

        this.net.initWithUrl(url);
        this.net.addHandler(this.ping.bind(this), this.parseArrayBuffMsg.bind(this));

        this.net.connect(this.netStateChangeHandler.bind(this));
        this.isLogined = true;

        logger.debug("[WebSocket] 开始心跳");
        GameNetMgr.inst.net.heartbeatStart();
        logger.debug("[LoopMgr] 开始循环任务");
        setTimeout(() => {LoopMgr.inst.start();}, 2000);//延迟启动定时任务2s
        // LoopMgr.inst.start()
        WorkFlowMgr.inst.start()
    }

    netStateChangeHandler(state) {
        this.netConnState = state;

        switch (this.netConnState) {
            case NetState.NET_CONNECT:
                this.netConnectHandler();
                break;
            case NetState.NET_CLOSE:
                this.netCloseHandler();
                break;
            case NetState.NET_ERROR:
                this.netErrorHandler();
                break;
        }
    }

    netConnectHandler() {
        this.login();
        logger.info("[WebSocket] 连接成功");
    }

    netCloseHandler() {
        logger.error("[WebSocket] 已断开连接");
        this.close();

        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            logger.warn(`[GameNetMgr] 第 ${this.retryCount} 次重连中...`);

            if (!this.isLogined && !this.isReConnectting) {
                this.reconnect();
            }
        } else {
            logger.error(`[GameNetMgr] 已达到最大重连次数 ${this.maxRetries}，停止重连。`);
            process.exit(1);
        }
    }

    netErrorHandler() {
        logger.error("[WebSocket] 连接错误");
        this.close();
    }

    login() {
        const loginData = {
            token: this.token,
            language: "zh_cn"
        };
        this.sendPbMsg(Protocol.S_PLAYER_LOGIN, loginData);
    }

    ping() {
        this.sendPbMsg(Protocol.S_PLAYER_PING, null);
    }

    addHandler(msgId, handler) {
        this.handlers[msgId] = (data) => {
            if (msgId !== "disconnect" && typeof data === "string") {
                data = JSON.parse(data);
            }
            handler(data);
        };
    }

    sendPbMsg(msgId, msgData, directSend = false) { 
        if (!this.net.isConnected()) {
            return;
        }

        // Create a new message stream
        const stream = new Stream();
        stream.init(msgId, +this.playerId, NetSocket.BYTES_OF_MSG_HEADER + NetSocket.MSG_DATA_LENGTH, true);
        stream.writeShort(NetSocket.HEADER);
        stream.writeInt(50);
        stream.writeInt(msgId);
        stream.writeLong(this.playerId);

        try {
            const body = stream.pbMsg.encode(msgData).finish();
            stream.writeBytes(body, 18);
        } catch (err) {
            // TODO 重写一下sendPbMsg逻辑
            if (msgData && Object.keys(msgData).length > 0) {
                logger.debug(`msgId: ${msgId}, msgData: ${JSON.stringify(msgData)}`);
            }
        }

        stream.writeInt(stream.offset, 2);
        // parseSendData
        const t = new Uint8Array(stream.offset);
        t.set(stream.buff.subarray(0, stream.offset));
        stream.buff = t;
        stream.streamsize = stream.offset;
        
        if (directSend) {
            this.net.send(stream.buff);
        } else {
            this.messageQueue.push({ msgId, msgData });
            this.startSending();
        }
    }

    startSending() {
        if (this.isSending || this.messageQueue.length === 0) {
            return;
        }

        this.isSending = true;

        const sendNextMessage = () => {
            if (this.messageQueue.length > 0) {
                const { msgId, msgData} = this.messageQueue.shift();
                this.sendPbMsg(msgId, msgData, true);
                setTimeout(sendNextMessage, global.messageDelay);
            } else {
                this.isSending = false;
            }
        };

        sendNextMessage();
    }

    parseArrayBuffMsg(arrayBuffer) {
        try {
            const stream = new Stream();
            stream.initByBuff(arrayBuffer, NetSocket.BYTES_OF_MSG_HEADER);
            stream.readShort();
            const length = stream.readInt();
            const msgId = stream.readInt();

            const protoMsg = ProtobufMgr.inst.getMsg(msgId, false);
            const msgBody = new Uint8Array(arrayBuffer.subarray(NetSocket.BYTES_OF_MSG_HEADER, length));

            if (protoMsg) {
                const parsedMsg = protoMsg.decode(msgBody);
                // logger.info(`msgId: ${msgId} ${JSON.stringify(parsedMsg)}`);
                this.resvHandler(msgId, parsedMsg);
            }
        } catch (error) {
            logger.debug(`[未知协议] ${this.toHexString(new Uint8Array(arrayBuffer))}`);
        }
    }

    toHexString = (bytes) => {
        let hex = [];
        for (let i = 0; i < bytes.length; i++) {
            let current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
            hex.push((current >>> 4).toString(16));
            hex.push((current & 0xf).toString(16));
        }
        return hex.join("");
    };

    resvHandler(msgId, msgData) {
        if (msgData) {
            const protoCmd = ProtobufMgr.inst.resvCmdList[msgId].smMethod.split(".");
            const method = protoCmd[protoCmd.length - 1];
            if (MsgRecvMgr[method]) {
                logger.debug(`[Handler] 找到处理函数: ${method} msgId: ${msgId} ${JSON.stringify(msgData)}`);
                MsgRecvMgr[method](msgData, msgId);
            } else {
                logger.debug(`[Handler] 未找到处理函数: ${method}`);
            }
        }
    }

    async countdown(reconnectInterval) {
        let remainingTime = reconnectInterval / 1000;
    
        const printCountdown = () => {
            if (remainingTime <= 10) {
                logger.info(`剩余时间: ${remainingTime} 秒`);
                remainingTime--;
                return 1000; // 每秒更新
            } else if (remainingTime <= 60) {
                logger.info(`剩余时间: ${remainingTime} 秒`);
                remainingTime -= 10;
                return 10000; // 每10秒更新
            } else {
                logger.info(`剩余时间: ${remainingTime} 秒`);
                remainingTime -= 30;
                return 30000; // 每30秒更新
            }
        };
    
        // 开始倒计时
        while (remainingTime > 0) {
            const interval = printCountdown();
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        logger.info('倒计时结束');
    }

    async reconnect(resetInterval = null) {
        logger.info("[GameNetMgr] 重连中...");
        this.isReConnectting = true;
        this.close();
        LoopMgr.inst.end();
        RegistMgr.inst.reset();

        const reconnectInterval = resetInterval || global.account.reconnectInterval || 5000;
        await this.countdown(reconnectInterval);

        const { wsAddress, playerId, token } = await this.doLogin();
        this.connectGameServer(wsAddress, playerId, token);

        this.isReConnectting = false;
    }

    close() {
        if (this.net) {
            this.net.close(true);
        };

        this.isLogined = false;
        this.handlers = {};
    }

    async doLogin() {
        const authServiceInstance = new AuthService();
        const { serverId, token, uid, username, password } = global.account;

        try {
            // Login first, and then fetch the wsAddress and token
            let response;
    
            try {
                if (token && uid) {
                    logger.info("[Login] 尝试使用token登录...");
                    response = await authServiceInstance.LoginWithToken(serverId, token, uid, username, password);
                } else {
                    throw new Error("[Login] token登陆信息不完整, 尝试使用用户名密码登录...");
                }
            } catch (error) {
                logger.warn("[Login] token登录失败, 尝试使用用户名密码登录...");
                response = await authServiceInstance.Login(username, password, serverId);
            }
    
            return response;
        } catch (error) {
            logger.error(error.message || error);
        }
    }
}


export default GameNetMgr;
