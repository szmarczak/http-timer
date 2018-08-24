'use strict';

module.exports = request => {
	const timings = {
		start: Date.now(),
		socket: null,
		lookup: null,
		connect: null,
		response: null,
		end: null,
		phases: {
			wait: null,
			dns: null,
			firstByte: null,
			download: null,
			total: null
		}
	};

	const onSocketConnect = () => {
		timings.connect = Date.now();
		timings.phases.tcp = timings.connect - timings.socket;

		/* istanbul ignore next: hard to test */
		if (!timings.lookup) {
			timings.lookup = timings.connect;
			timings.phases.dns = timings.lookup - timings.socket;
		}
	};

	request.on('socket', socket => {
		timings.socket = Date.now();
		timings.phases.wait = timings.socket - timings.start;

		/* istanbul ignore next: hard to test */
		if (socket.connecting) {
			socket.once('connect', () => onSocketConnect(socket));
			socket.once('lookup', () => {
				timings.lookup = Date.now();
				timings.phases.dns = timings.lookup - timings.socket;
			});
		} else {
			onSocketConnect(socket);
		}
	});

	request.on('response', response => {
		timings.response = Date.now();
		timings.phases.firstByte = timings.response - timings.connect;

		response.on('end', () => {
			timings.end = Date.now();
			timings.phases.download = timings.end - timings.response;
			timings.phases.total = timings.end - timings.start;
		});
	});

	return timings;
};
