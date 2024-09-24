import logger from "#utils/logger.js";

class RegistMgr {
    constructor() {
        this.list = [];
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new RegistMgr();
        }
        return this._instance;
    }

    add(mgr) {
        if (this.list.indexOf(mgr) === -1) {
            this.list.push(mgr);
        }
    }

    clear() {
        this.list = [];
    }

    reset() {
        this.list.forEach(mgr => {
            if (mgr && typeof mgr.reset === 'function') {
                logger.debug(`[RegistMgr] ${mgr.constructor.name} 已重置`);
                mgr.reset();
            } else {
                logger.warn(`[RegistMgr] ${mgr.constructor.name} 不支持 reset 方法`);
            }
        });
    }
}

export default RegistMgr;
