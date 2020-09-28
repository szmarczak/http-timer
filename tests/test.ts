import {EventEmitter} from 'events';
import http = require('http');
import {ClientRequest, IncomingMessage} from 'http';
import https = require('https');
import {AddressInfo} from 'net';
import util = require('util');
import pEvent from 'p-event';
import test from 'ava';
import timer, {Timings, ClientRequestWithTimings, IncomingMessageWithTimings} from '../source';

let server: http.Server & {
	url?: string;
	listenAsync?: any;
	closeAsync?: any;
};

test.before('setup', async () => {
	server = http.createServer((_request, response) => {
		response.write('o');

		setTimeout(() => response.end('k'), 200);
	});

	server.listenAsync = util.promisify(server.listen.bind(server));
	server.closeAsync = util.promisify(server.close.bind(server));

	await server.listenAsync();
	server.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.after('cleanup', async () => {
	await server.closeAsync();
});

const nodejsMajorVersion = Number(process.versions.node.split('.')[0]);

const error = 'Simple error';

const makeRequest = (url = 'https://httpbin.org/anything', options: http.RequestOptions = {}): {request: ClientRequest; timings: Timings} => {
	const {protocol} = new URL(url);
	const fn = protocol === 'http:' ? http : https;

	const request = fn.get(url, {agent: false, ...options});
	const timings = timer(request);

	return {request, timings};
};

test('by default everything is set to undefined', t => {
	const {timings} = makeRequest();

	t.is(typeof timings, 'object');
	t.is(typeof timings.start, 'number');
	t.is(timings.socket, undefined);
	t.is(timings.lookup, undefined);
	t.is(timings.connect, undefined);
	t.is(timings.secureConnect, undefined);
	t.is(timings.response, undefined);
	t.is(timings.end, undefined);
	t.is(timings.error, undefined);
	t.is(timings.abort, undefined);

	t.deepEqual(timings.phases, {
		wait: undefined,
		dns: undefined,
		tcp: undefined,
		tls: undefined,
		request: undefined,
		firstByte: undefined,
		download: undefined,
		total: undefined
	});
});

test('timings (socket reuse)', async t => {
	const agent = new http.Agent({keepAlive: true});

	{
		const {request} = makeRequest(server.url, {agent});
		const response = await pEvent(request, 'response');
		response.resume();
		await pEvent(response, 'end');
	}

	{
		const {request} = makeRequest(server.url, {agent});
		await pEvent(request, 'socket');
		const timings = timer(request);

		const response = await pEvent(request, 'response');
		response.resume();
		await pEvent(response, 'end');

		t.true(timings.phases.wait! <= 1);
		t.true(timings.phases.dns! <= 1);
		t.true(timings.phases.tcp! <= 1);
		t.true(timings.phases.request! <= 1);
	}

	agent.destroy();

	t.pass();
});

test('timings', async t => {
	const {request, timings} = makeRequest();
	const response = await pEvent(request, 'response');
	response.resume();
	await pEvent(response, 'end');

	t.is(typeof timings, 'object');
	t.is(typeof timings.start, 'number');
	t.is(typeof timings.socket, 'number');
	t.is(typeof timings.lookup, 'number');
	t.is(typeof timings.connect, 'number');
	t.is(typeof timings.secureConnect, 'number');
	t.is(typeof timings.upload, 'number');
	t.is(typeof timings.response, 'number');
	t.is(typeof timings.end, 'number');
});

test('phases', async t => {
	const {request, timings} = makeRequest();
	const response = await pEvent(request, 'response');
	response.resume();
	await pEvent(response, 'end');

	t.is(typeof timings.phases, 'object');
	t.is(typeof timings.phases.wait, 'number');
	t.is(typeof timings.phases.dns, 'number');
	t.is(typeof timings.phases.tcp, 'number');
	t.is(typeof timings.phases.tls, 'number');
	t.is(typeof timings.phases.firstByte, 'number');
	t.is(typeof timings.phases.download, 'number');
	t.is(typeof timings.phases.total, 'number');

	t.is(timings.phases.wait, timings.socket! - timings.start);
	t.is(timings.phases.dns, timings.lookup! - timings.socket!);
	t.is(timings.phases.tcp, timings.connect! - timings.lookup!);
	t.is(timings.phases.tls, timings.secureConnect! - timings.connect!);
	t.is(timings.phases.request, timings.upload! - timings.secureConnect!);
	t.is(timings.phases.firstByte, timings.response! - timings.upload!);
	t.is(timings.phases.download, timings.end! - timings.response!);
	t.is(timings.phases.total, timings.end! - timings.start);
});

test('no memory leak (`lookup` event)', async t => {
	const {request} = makeRequest();

	await pEvent(request, 'finish');

	t.is(request.socket.listenerCount('lookup'), 0);
});

test('sets `total` on request error', async t => {
	const request = http.get(server.url!, {
		timeout: 1
	});
	request.on('timeout', () => {
		request.abort();
	});

	const timings = timer(request);

	const err: Error = await pEvent(request, 'error');
	t.is(err.message, 'socket hang up');

	t.is(typeof timings.error, 'number');
	t.is(timings.phases.total, timings.error! - timings.start);
});

test('sets `total` on response error', async t => {
	const request = http.get(server.url!, (response: IncomingMessage) => {
		setImmediate(() => {
			response.emit('error', new Error(error));
		});
	});
	const timings = timer(request);

	const response = await pEvent(request, 'response');
	const err: Error = await pEvent(response, 'error');

	t.is(err.message, error);
	t.is(typeof timings.error, 'number');
	t.is(timings.phases.total, timings.error! - timings.start);
});

test.cb('sets `total` on abort', t => {
	const request = http.get(server.url!);
	request.abort();

	const timings = timer(request);

	process.nextTick(() => {
		t.is(typeof timings.abort, 'number');
		t.is(timings.phases.total, timings.abort! - timings.start);
		t.falsy((request as any).res);

		t.end();
	});
});

test.cb('sets `total` on abort - after `response` event', t => {
	const request = http.get(server.url!);
	const timings = timer(request);

	request.once('response', response => {
		request.abort();

		if (nodejsMajorVersion >= 13) {
			process.nextTick(() => {
				t.is(typeof timings.abort, 'number');
				t.is(timings.phases.total, timings.abort! - timings.start);
				t.truthy((request as any).res);

				t.end();
			});
		} else {
			response.once('end', () => {
				t.is(typeof timings.abort, 'number');
				t.is(timings.phases.total, timings.end! - timings.start);
				t.truthy((request as any).res);

				t.end();
			});
		}
	});
});

test('doesn\'t throw when someone used `.prependOnceListener()`', t => {
	const emitter = new EventEmitter();
	timer(emitter as ClientRequest);
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	emitter.prependOnceListener('error', () => {});

	t.notThrows(() => emitter.emit('error', new Error(error)));
});

test('sensible timings', async t => {
	const {timings, request} = makeRequest('https://google.com');
	const now = Date.now();

	const response = await pEvent(request, 'response');
	response.resume();
	await pEvent(response, 'end');

	t.true(timings.socket! >= now);
	t.true(timings.lookup! >= now);
	t.true(timings.connect! >= now);
	t.true(timings.secureConnect! >= now);
	t.true(timings.response! >= now);
	t.true(timings.end! >= now);
	t.is(timings.error, undefined);
	t.is(timings.abort, undefined);
	t.true(timings.phases.wait! < 1000);
	t.true(timings.phases.dns! < 1000);
	t.true(timings.phases.tcp! < 1000);
	t.true(timings.phases.tls! < 1000);
	t.true(timings.phases.request! < 1000);
	t.true(timings.phases.firstByte! < 1000);
	t.true(timings.phases.download! < 1000);
	t.true(timings.phases.total! < 1000);
});

test('prepends once listeners', async t => {
	const request = https.get('https://google.com');

	const promise = new Promise(resolve => {
		request.once('response', () => {
			t.true(typeof timings.response === 'number');

			resolve();
		});

		const timings = timer(request);
	});

	await promise;
	request.abort();
});

test('`tls` phase for https requests', async t => {
	const {request, timings} = makeRequest('https://google.com');

	const response = await pEvent(request, 'response');
	response.resume();
	await pEvent(response, 'end');

	t.is(typeof timings.secureConnect, 'number');
	t.is(typeof timings.phases.tls, 'number');
});

test('no `tls` phase for http requests', async t => {
	const {request, timings} = makeRequest(server.url);

	const response = await pEvent(request, 'response');
	response.resume();
	await pEvent(response, 'end');

	t.is(timings.secureConnect, undefined);
	t.is(timings.phases.tls, undefined);
});

test('timings are accessible via `request.timings`', t => {
	const {request, timings} = makeRequest('https://google.com');
	request.abort();

	const typedRequest = request as ClientRequestWithTimings;

	t.is(typedRequest.timings, timings);
});

test('timings are accessible via `response.timings`', async t => {
	const {request, timings} = makeRequest('https://google.com');

	const response: IncomingMessage = await pEvent(request, 'response');
	const typedResponse = response as IncomingMessageWithTimings;

	t.is(typedResponse.timings, timings);

	response.resume();
	await pEvent(response, 'end');
});

test('can extend `http.IncomingMessage`', t => {
	interface Response extends IncomingMessage {
		timings: boolean;
	}

	0 as unknown as Response;

	t.pass();
});
