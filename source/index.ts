import {errorMonitor} from 'events';
import {types} from 'util';
import type {EventEmitter} from 'events';
import type {Socket} from 'net';
import type {ClientRequest, IncomingMessage} from 'http';
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
	if (request.timings) {
		return request.timings;
	}

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
			total: undefined,
		},
	};

	request.timings = timings;

	const handleError = (origin: EventEmitter): void => {
		origin.once(errorMonitor, () => {
			timings.error = Date.now();
			timings.phases.total = timings.error - timings.start;
		});
	};

	handleError(request);

	const onAbort = (): void => {
		timings.abort = Date.now();
		timings.phases.total = timings.abort - timings.start;
	};

	request.prependOnceListener('abort', onAbort);

	const onSocket = (socket: Socket): void => {
		timings.socket = Date.now();
		timings.phases.wait = timings.socket - timings.start;

		if (types.isProxy(socket)) {
			return;
		}

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
			},
			secureConnect: () => {
				timings.secureConnect = Date.now();
				timings.phases.tls = timings.secureConnect - timings.connect!;
			},
		});
	};

	if (request.socket) {
		onSocket(request.socket);
	} else {
		request.prependOnceListener('socket', onSocket);
	}

	const onUpload = (): void => {
		timings.upload = Date.now();
		timings.phases.request = timings.upload - (timings.secureConnect ?? timings.connect!);
	};

	if (request.writableFinished) {
		onUpload();
	} else {
		request.prependOnceListener('finish', onUpload);
	}

	request.prependOnceListener('response', (response: IncomingMessageWithTimings): void => {
		timings.response = Date.now();
		timings.phases.firstByte = timings.response - timings.upload!;

		response.timings = timings;

		handleError(response);

		response.prependOnceListener('end', () => {
			request.off('abort', onAbort);
			response.off('aborted', onAbort);

			if (timings.phases.total) {
				// Aborted or errored
				return;
			}

			timings.end = Date.now();
			timings.phases.download = timings.end - timings.response!;
			timings.phases.total = timings.end - timings.start;
		});

		response.prependOnceListener('aborted', onAbort);
	});

	return timings;
};

export default timer;
