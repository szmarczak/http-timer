# http-timer
> Timings for HTTP requests

[![Build Status](https://travis-ci.org/szmarczak/http-timer.svg?branch=master)](https://travis-ci.org/szmarczak/http-timer)
[![Coverage Status](https://coveralls.io/repos/github/szmarczak/http-timer/badge.svg?branch=master)](https://coveralls.io/github/szmarczak/http-timer?branch=master)
[![install size](https://packagephobia.now.sh/badge?p=@szmarczak/http-timer)](https://packagephobia.now.sh/result?p=@szmarczak/http-timer)

Inspired by the [`request` package](https://github.com/request/request).

## Installation

NPM:

> `npm install @szmarczak/http-timer`

Yarn:

> `yarn add @szmarczak/http-timer`

## Usage
```js
const https = require('https');
const timer = require('@szmarczak/http-timer');

const request = https.get('https://httpbin.org/anything');
const timings = timer(request);

request.on('response', response => {
	response.on('data', () => {}); // Consume the data somehow
	response.on('end', () => {
		console.log(timings);
	});
});

// {
//   start: 1572712180361,
//   socket: 1572712180362,
//   lookup: 1572712180415,
//   connect: 1572712180571,
//   upload: 1572712180884,
//   response: 1572712181037,
//   end: 1572712181039,
//   error: null,
//   phases: {
//     wait: 1,
//     dns: 53,
//     tcp: 156,
//     request: 313,
//     firstByte: 153,
//     download: 2,
//     total: 678
//   }
// }
```

## API

### timer(request)

Returns: `Object`

- `start` - Time when the request started.
- `socket` - Time when a socket was assigned to the request.
- `lookup` - Time when the DNS lookup finished.
- `connect` - Time when the socket successfully connected.
- `secureConnect` - Time when the socket securely connected.
- `upload` - Time when the request finished uploading.
- `response` - Time when the request fired the `response` event.
- `end` - Time when the response fired the `end` event.
- `error` - Time when the request fired the `error` event.
- `phases`
	- `wait` - `timings.socket - timings.start`
	- `dns` - `timings.lookup - timings.socket`
	- `tcp` - `timings.connect - timings.lookup`
	- `tls` - `timings.secureConnect - timings.connect`
	- `request` - `timings.upload - (timings.secureConnect || timings.connect)`
	- `firstByte` - `timings.response - timings.upload`
	- `download` - `timings.end - timings.response`
	- `total` - `timings.end - timings.start` or `timings.error - timings.start`

If something has not been measured yet, it will be `undefined`.

**Note**: The time is a `number` representing the milliseconds elapsed since the UNIX epoch.

You can also access the timings through `request.timings` or `response.timings`:

```js
const https = require('https');
const timer = require('@szmarczak/http-timer');

const request = https.get('https://httpbin.org/anything');
const timings = timer(request);

console.log(request.timings === timings);
// => true

request.on('response', response => {
	response.on('data', () => {}); // Consume the data somehow
	response.on('end', () => {
		console.log(response.timings === timings);
		// => true
	});
});
```

## License

MIT
