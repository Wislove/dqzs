import winston from 'winston';

const loglevel = process.env.LOGLEVEL || 'info';

const customLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const customColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'cyan',
};

winston.addColors(customColors);

function createLogFormat() {
    const colorizer = winston.format.colorize();
    const timestamp = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' });
    const logFormat = winston.format.printf((info) => {
        const levelWithoutColor = info.level.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
        const space = ' '.repeat(6 - levelWithoutColor.length);
        return `${info.timestamp} ${info.level}${space} ${info.message}`;
    });

    return winston.format.combine(colorizer, timestamp, logFormat);
}

// Create a single logger instance
const logger = winston.createLogger({
    level: loglevel,
    levels: customLevels,
    format: createLogFormat(),
    transports: [
        new winston.transports.Console({}),
    ],
    exitOnError: false,
});

export default logger;