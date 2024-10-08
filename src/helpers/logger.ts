import { Signale, SignaleOptions } from 'signale';
import path from 'path';
import os from 'os';

function getDetailedCallerInfo(): {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
    functionName: string;
    className: string | undefined;
    methodName: string | undefined;
    timestamp: string;
    hostname: string;
    processId: number;
} {
    const error = new Error();
    const stack = error.stack?.split('\n')[3];
    const match = stack?.match(/at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?)\)?/);
    const fullFunctionName = match ? (match[1] || 'anonymous') : 'anonymous';
    const [className, methodName] = fullFunctionName.includes('.')
        ? fullFunctionName.split('.')
        : [undefined, fullFunctionName];

    return {
        filePath: match ? path.relative(process.cwd(), match[2]) : 'unknown',
        lineNumber: match ? parseInt(match[3], 10) : 0,
        columnNumber: match && match[4] ? parseInt(match[4], 10) : 0,
        functionName: fullFunctionName,
        className,
        methodName,
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
        processId: process.pid
    };
}

// Custom options for our logger
const options: SignaleOptions = {
    disabled: false,
    interactive: false,
    logLevel: 'info',
    secrets: [],
    stream: process.stdout,
    types: {
        log: {
            badge: '📝',
            color: 'white',
            label: 'LOG',
            logLevel: 'info'
        },
        info: {
            badge: 'ℹ️',
            color: 'blue',
            label: 'INFO',
            logLevel: 'info'
        },
        warn: {
            badge: '⚠️',
            color: 'yellow',
            label: 'WARN',
            logLevel: 'warn'
        },
        error: {
            badge: '❌',
            color: 'red',
            label: 'ERROR',
            logLevel: 'error'
        },
        debug: {
            badge: '🔍',
            color: 'magenta',
            label: 'DEBUG',
            logLevel: 'debug'
        },
        success: {
            badge: '✅',
            color: 'green',
            label: 'SUCCESS',
            logLevel: 'info'
        },
        start: {
            badge: '🚀',
            color: 'green',
            label: 'START',
            logLevel: 'info'
        },
        complete: {
            badge: '🏁',
            color: 'cyan',
            label: 'COMPLETE',
            logLevel: 'info'
        },
        pending: {
            badge: '⏳',
            color: 'yellow',
            label: 'PENDING',
            logLevel: 'info'
        },
        note: {
            badge: '📌',
            color: 'blue',
            label: 'NOTE',
            logLevel: 'info'
        },
    }
};

const signale = new Signale(options);

const createLoggerMethod = (method: keyof typeof signale) => {
    return (message: string, ...args: any[]) => {
        if (method === 'error') {
            const {
                filePath,
                lineNumber,
                columnNumber,
                functionName,
                className,
                methodName,
                timestamp,
                hostname,
                processId
            } = getDetailedCallerInfo();

            const callInfo = [
                `\n┌─────────────────────── Call Info ───────────────────────`,
                `│ 🕒 Timestamp: ${timestamp}`,
                `│ 💻 Hostname: ${hostname}`,
                `│ 🔢 Process ID: ${processId}`,
                `│ 📁 File: ${filePath}`,
                `│ 📍 Location: Line ${lineNumber}, Column ${columnNumber}`,
                `│ 🔧 Function: ${functionName}`,
                className ? `│ 🏷️ Class: ${className}` : null,
                methodName ? `│ 🔨 Method: ${methodName}` : null,
                `└────────────────────────────────────────────────────────`,
            ].filter(Boolean).join('\n');

            signale[method](
                `${message}\n${callInfo}`,
                ...args
            );
        } else {
            signale[method](message, ...args);
        }
    };
};

const logger = {
    ...signale,
    log: createLoggerMethod('log'),
    info: createLoggerMethod('info'),
    warn: createLoggerMethod('warn'),
    error: createLoggerMethod('error'),
    debug: createLoggerMethod('debug'),
    success: createLoggerMethod('success'),
    start: createLoggerMethod('start'),
    complete: createLoggerMethod('complete'),
    pending: createLoggerMethod('pending'),
    note: createLoggerMethod('note')
};

// Override console methods
console.log = logger.log;
console.info = logger.info;
console.warn = logger.warn;
console.error = logger.error;
console.debug = logger.debug;
// Export the logger
export default logger;