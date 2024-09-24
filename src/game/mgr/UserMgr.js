import RegistMgr from '#game/common/RegistMgr.js';

export default class UserMgr {
    constructor() {
        RegistMgr.inst.add(this);
    }

    reset() {
        this.nickName = null;
        this.playerId = null;
        this.roleId = null;
        this.serverId = null;
    }
    
    static nickName = null;
    static playerId = null;
    static roleId = null;
    static serverId = null;
}
