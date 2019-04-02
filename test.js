import http from 'http';
import https from 'https';
import util from 'util';
import {URL, parse as parseUrl} from 'url';
import EventEmitter from 'events';
import test from 'ava';
import pEvent from 'p-event';
import timer from '.';

let s;
test.before('setup', async () => {
	s = http.createServer((request, response) => {
		if (request.url === '/delayed-response') {
			response.write('o');

			setTimeout(() => response.end('k'), 200);
		} else {
			response.end('ok');
		}
	});

	s.listen = util.promisify(s.listen.bind(s));
	s.close = util.promisify(s.close.bind(s));

	await s.listen();
	s.url = `http://127.0.0.1:${s.address().port}`;
});

test.after('cleanup', async () => {
	await s.close();
});

const error = 'Simple error';

const makeRequest = (url = 'https://httpbin.org/anything') => {
	const {protocol} = new URL(url);
	const fn = protocol === 'http:' ? http : https;

	const request = fn.get(url);
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
	t.is(timings.response, undefined);
	t.is(timings.end, undefined);
	t.is(timings.error, undefined);
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
	t.is(typeof timings.phases.firstByte, 'number');
	t.is(typeof timings.phases.download, 'number');
	t.is(typeof timings.phases.total, 'number');

	t.is(timings.phases.wait, timings.socket - timings.start);
	t.is(timings.phases.dns, timings.lookup - timings.socket);
	t.is(timings.phases.tcp, timings.connect - timings.lookup);
	t.is(timings.phases.request, timings.upload - timings.connect);
	t.is(timings.phases.firstByte, timings.response - timings.upload);
	t.is(timings.phases.download, timings.end - timings.response);
	t.is(timings.phases.total, timings.end - timings.start);
});

test('no memory leak (`lookup` event)', async t => {
	const {request} = makeRequest();

	await pEvent(request, 'finish');

	t.is(request.socket.listenerCount('lookup'), 0);
});

test('sets `total` on request error', async t => {
	const request = http.get({
		...parseUrl(`${s.url}/delayed-response`),
		timeout: 1
	});
	request.on('timeout', () => {
		request.abort();
	});

	const timings = timer(request);

	const err = await pEvent(request, 'error');
	t.is(err.message, 'socket hang up');

	t.is(typeof timings.error, 'number');
	t.is(timings.phases.total, timings.error - timings.start);
});

test('sets `total` on response error', async t => {
	const request = http.get(`${s.url}/delayed-response`, response => {
		setImmediate(() => {
			response.emit('error', new Error(error));
		});
	});
	const timings = timer(request);

	const response = await pEvent(request, 'response');
	const err = await pEvent(response, 'error');

	t.is(err.message, error);
	t.is(typeof timings.error, 'number');
	t.is(timings.phases.total, timings.error - timings.start);
});

test('doesn\'t throw when someone used `.prependOnceListener()`', async t => {
	const emitter = new EventEmitter();
	timer(emitter);
	emitter.prependOnceListener('error', () => {});

	await t.notThrows(() => emitter.emit('error', new Error(error)));
});

test('sensible timings', async t => {
	const {timings, request} = makeRequest('http://google.com');
	const now = Date.now();

	const response = await pEvent(request, 'response');
	response.resume();
	await pEvent(response, 'end');

	t.true(timings.socket >= now);
	t.true(timings.lookup >= now);
	t.true(timings.connect >= now);
	t.true(timings.response >= now);
	t.true(timings.end >= now);
	t.is(timings.error, undefined);
	t.true(timings.phases.wait < 1000);
	t.true(timings.phases.dns < 1000);
	t.true(timings.phases.tcp < 1000);
	t.true(timings.phases.request < 1000);
	t.true(timings.phases.firstByte < 1000);
	t.true(timings.phases.download < 1000);
	t.true(timings.phases.total < 1000);
});
