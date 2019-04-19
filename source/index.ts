import {EventEmitter} from 'events';
import {Socket} from 'net';
import {ClientRequest, IncomingMessage} from 'http';
// @ts-ignore
import deferToConnect from 'defer-to-connect';

export interface Timings {
	start: number;
	socket?: number;
	lookup?: number;
	connect?: number;
	upload?: number;
	response?: number;
	end?: number;
	error?: number;
	phases: {
		wait?: number;
		dns?: number;
		tcp?: number;
		request?: number;
		firstByte?: number;
		download?: number;
		total?: number;
	};
}

const timer = (request: ClientRequest): Timings => {
	const timings: Timings = {
		start: Date.now(),
		socket: undefined,
		lookup: undefined,
		connect: undefined,
		upload: undefined,
		response: undefined,
		end: undefined,
		error: undefined,
		phases: {
			wait: undefined,
			dns: undefined,
			tcp: undefined,
			request: undefined,
			firstByte: undefined,
			download: undefined,
			total: undefined
		}
	};

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

	let uploadFinished = false;
	const onUpload = (): void => {
		timings.upload = Date.now();
		timings.phases.request = timings.upload - timings.connect!;
	};

	handleError(request);

	request.once('socket', (socket: Socket): void => {
		timings.socket = Date.now();
		timings.phases.wait = timings.socket - timings.start;

		const lookupListener = (): void => {
			timings.lookup = Date.now();
			timings.phases.dns = timings.lookup - timings.socket!;
		};

		socket.once('lookup', lookupListener);

		deferToConnect(socket, () => {
			timings.connect = Date.now();

			if (timings.lookup === undefined) {
				socket.removeListener('lookup', lookupListener);
				timings.lookup = timings.connect;
				timings.phases.dns = timings.lookup - timings.socket!;
			}

			timings.phases.tcp = timings.connect - timings.lookup;

			if (uploadFinished && !timings.upload) {
				onUpload();
			}
		});
	});

	request.once('finish', () => {
		uploadFinished = true;

		if (timings.connect) {
			onUpload();
		}
	});

	request.once('response', (response: IncomingMessage): void => {
		timings.response = Date.now();
		timings.phases.firstByte = timings.response - timings.upload!;

		handleError(response);

		response.once('end', () => {
			timings.end = Date.now();
			timings.phases.download = timings.end - timings.response!;
			timings.phases.total = timings.end - timings.start;
		});
	});

	return timings;
};

export = timer;
