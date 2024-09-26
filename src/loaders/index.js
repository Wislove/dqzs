import dependencyInjectorLoader from "#loaders/dependencyInjector.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import logger from '#utils/logger.js';

export default async () => {
    await dependencyInjectorLoader();

    try {
        // Initialize WebSocket
        const { wsAddress, playerId, token } = await GameNetMgr.inst.doLogin();
        GameNetMgr.inst.connectGameServer(wsAddress, playerId, token);
    } catch (error) {
        logger.error(error.message || error);
    }
};