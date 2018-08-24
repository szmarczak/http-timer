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

// { start: 1535137471536,
//   socket: 1535137471537,
//   lookup: 1535137471537,
//   connect: 1535137471582,
//   response: 1535137472284,
//   end: 1535137472285,
//   phases:
//    { wait: 1,
//      dns: 0,
//      firstByte: 702,
//      download: 1,
//      total: 749,
//      tcp: 45 } }
```

## License

MIT
