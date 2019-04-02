import https from 'https';
import {expectType} from 'tsd';
import timer from '.';

const request = https.get('https://httpbin.org/anything');
const timings = timer(request);

type pending = number | undefined;

expectType<number>(timings.start);
expectType<pending>(timings.socket);
expectType<pending>(timings.lookup);
expectType<pending>(timings.connect);
expectType<pending>(timings.upload);
expectType<pending>(timings.response);
expectType<pending>(timings.end);
expectType<pending>(timings.error);
expectType<pending>(timings.phases.wait);
expectType<pending>(timings.phases.dns);
expectType<pending>(timings.phases.tcp);
expectType<pending>(timings.phases.request);
expectType<pending>(timings.phases.firstByte);
expectType<pending>(timings.phases.download);
expectType<pending>(timings.phases.total);
