# http-timer
> Timings for HTTP requests

[![Build Status](https://travis-ci.org/szmarczak/http-timer.svg?branch=master)](https://travis-ci.org/szmarczak/http-timer)
[![Coverage Status](https://coveralls.io/repos/github/szmarczak/http-timer/badge.svg?branch=master)](https://coveralls.io/github/szmarczak/http-timer?branch=master)
[![install size](https://packagephobia.now.sh/badge?p=@szmarczak/http-timer)](https://packagephobia.now.sh/result?p=@szmarczak/http-timer)

Inspired by the [`request` package](https://github.com/request/request).

## Usage
```js
'use strict';
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

// { start: 1535183088427,
//   socket: 1535183088429,
//   lookup: 1535183088465,
//   connect: 1535183088602,
//   response: 1535183089049,
//   end: 1535183089050,
//   phases:
//    { wait: 2,
//      dns: 36,
//      firstByte: 447,
//      download: 1,
//      tcp: 137,
//      total: 623 } }
```

## License

MIT
