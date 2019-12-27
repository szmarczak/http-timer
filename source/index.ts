import {EventEmitter} from 'events';
import {Socket} from 'net';
import {ClientRequest, IncomingMessage} from 'http';
import deferToConnect from 'defer-to-connect';

export interface Timings {
	start: number;
	socket?: number;
	lookup?: number;
	connect?: number;
	secureConnect?: number;
	upload?: number;
	response?: number;
	end?: number;
	error?: number;
	abort?: number;
	phases: {
		wait?: number;
		dns?: number;
		tcp?: number;
		tls?: number;
		request?: number;
		firstByte?: number;
		download?: number;
		total?: number;
	};
}

export interface ClientRequestWithTimings extends ClientRequest {
	timings?: Timings;
}

export interface IncomingMessageWithTimings extends IncomingMessage {
	timings?: Timings;
}

const timer = (request: ClientRequestWithTimings): Timings => {
	const timings: Timings = {
		start: Date.now(),
		socket: undefined,
		lookup: undefined,
		connect: undefined,
		secureConnect: undefined,
		upload: undefined,
		response: undefined,
		end: undefined,
		error: undefined,
		abort: undefined,
		phases: {
			wait: undefined,
			dns: undefined,
			tcp: undefined,
			tls: undefined,
			request: undefined,
			firstByte: undefined,
			download: undefined,
			total: undefined
		}
	};

	request.timings = timings;

	const handleError = (origin: EventEmitter): void => {
		const emit = origin.emit.bind(origin);
		origin.emit = (event, ...args) => {
			// Catches the `error` event
			if (event === 'error') {
				timings.error = Date.now();
				timings.phases.total = timings.error - timings.start;

				origin.emit = emit;
			}

			// Saves the original behavior
			return emit(event, ...args);
		};
	};

	handleError(request);

	request.prependOnceListener('abort', (): void => {
		timings.abort = Date.now();
		timings.phases.total = Date.now() - timings.start;
	});

	request.prependOnceListener('socket', (socket: Socket): void => {
		timings.socket = Date.now();
		timings.phases.wait = timings.socket - timings.start;

		const lookupListener = (): void => {
			timings.lookup = Date.now();
			timings.phases.dns = timings.lookup - timings.socket!;
		};

		socket.prependOnceListener('lookup', lookupListener);

		deferToConnect(socket, {
			connect: () => {
				timings.connect = Date.now();

				if (timings.lookup === undefined) {
					socket.removeListener('lookup', lookupListener);
					timings.lookup = timings.connect;
					timings.phases.dns = timings.lookup - timings.socket!;
				}

				timings.phases.tcp = timings.connect - timings.lookup;

				// This callback is called before flushing any data,
				// so we don't need to set `timings.phases.request` here.
			},
			secureConnect: () => {
				timings.secureConnect = Date.now();
				timings.phases.tls = timings.secureConnect - timings.connect!;
			}
		});
	});

	request.prependOnceListener('finish', () => {
		timings.upload = Date.now();
		timings.phases.request = timings.upload - (timings.secureConnect || timings.connect!);
	});

	request.prependOnceListener('response', (response: IncomingMessageWithTimings): void => {
		timings.response = Date.now();
		timings.phases.firstByte = timings.response - timings.upload!;

		response.timings = timings;

		handleError(response);

		response.prependOnceListener('end', () => {
			timings.end = Date.now();
			timings.phases.download = timings.end - timings.response!;
			timings.phases.total = timings.end - timings.start;
		});
	});

	return timings;
};

export default timer;

// For CommonJS default export support
module.exports = timer;
module.exports.default = timer;
