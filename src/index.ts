import * as winston from 'winston';
import * as Transport from 'winston-transport';
import { Format, TransformableInfo } from 'logform';
import * as util from 'util';
import TransportStackdriver from './transports/stackdriver';

const { format } = winston;
const { levels, colors } = winston.config.syslog;

winston.addColors(colors);

interface Options {
  console: boolean;
  stackdriver?: {
    projectId: string;
    logName: string;
  };
}

export function createLogger(options: Options): winston.Logger {
  return winston.createLogger({
    levels,
    transports: getTransports(options),
    format: getFormat(),
    level: 'debug',
    exitOnError: false,
  });
}

function getFormat(): Format {
  return format.combine(
    format.splat(),
    format(preserveLevel)(),
    format.colorize(),
    format.timestamp(),
    format.printf(formatPrint)
  );
}

function getTransports({
  console: consoleOutput,
  stackdriver,
}: Options): Transport[] {
  const transports: Transport[] = [];
  const config: Transport.TransportStreamOptions = { handleExceptions: true };
  if (consoleOutput) {
    transports.push(new winston.transports.Console(config));
  }

  if (stackdriver) {
    transports.push(new TransportStackdriver(config, stackdriver));
  }

  return transports;
}

function preserveLevel(info: TransformableInfo): TransformableInfo {
  info.noncolorizedLevel = info.level;
  return info;
}

function formatPrint(info: TransformableInfo): string {
  const { level, message, timestamp, stack, meta } = info;
  const msg = typeof message === 'object' ? util.inspect(message) : message;
  const additionalArguments = formatAdditionalArguments(meta);
  return `${timestamp} ${level} ${stack || msg}${additionalArguments}`;
}

function formatAdditionalArguments(meta: []) {
  if (!meta || !meta.length) {
    return '';
  }

  const additionalArguments = meta.map(<T>(arg: T) => {
    if (arg instanceof Error) {
      return arg.stack;
    }

    if (typeof arg === 'object') {
      return JSON.stringify(arg, getCircularReplacer());
    }

    if (!arg) {
      return String(arg);
    }

    return arg;
  });

  return ` ${additionalArguments.join(' ')}`;
}

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (_key: string, value: object) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
};
