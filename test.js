import https from 'https';
import test from 'ava';
import pEvent from 'p-event';
import timer from '.';

const makeRequest = () => {
	const request = https.get('https://httpbin.org/anything');
	const timings = timer(request);

	return {request, timings};
};

test('by default everything is set to null', t => {
	const request = https.get('https://httpbin.org/anything');
	const timings = timer(request);

	t.is(typeof timings, 'object');
	t.is(typeof timings.start, 'number');
	t.is(timings.socket, null);
	t.is(timings.lookup, null);
	t.is(timings.connect, null);
	t.is(timings.response, null);
	t.is(timings.end, null);
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
	t.is(typeof timings.phases.firstByte, 'number');
	t.is(typeof timings.phases.download, 'number');
	t.is(typeof timings.phases.tcp, 'number');
	t.is(typeof timings.phases.total, 'number');

	t.is(timings.phases.wait, timings.socket - timings.start);
	t.is(timings.phases.dns, timings.lookup - timings.socket);
	t.is(timings.phases.firstByte, timings.response - timings.connect);
	t.is(timings.phases.download, timings.end - timings.response);
	t.is(timings.phases.tcp, timings.connect - timings.lookup);
	t.is(timings.phases.total, timings.end - timings.start);
});
