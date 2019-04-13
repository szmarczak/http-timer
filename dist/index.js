"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
// @ts-ignore
const defer_to_connect_1 = __importDefault(require("defer-to-connect"));
const timer = (request) => {
    const timings = {
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
    const handleError = (origin) => {
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
    const onUpload = () => {
        timings.upload = Date.now();
        timings.phases.request = timings.upload - timings.connect;
    };
    handleError(request);
    request.once('socket', (socket) => {
        timings.socket = Date.now();
        timings.phases.wait = timings.socket - timings.start;
        const lookupListener = () => {
            timings.lookup = Date.now();
            timings.phases.dns = timings.lookup - timings.socket;
        };
        socket.once('lookup', lookupListener);
        defer_to_connect_1.default(socket, () => {
            timings.connect = Date.now();
            if (timings.lookup === undefined) {
                socket.removeListener('lookup', lookupListener);
                timings.lookup = timings.connect;
                timings.phases.dns = timings.lookup - timings.socket;
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
    request.once('response', (response) => {
        timings.response = Date.now();
        timings.phases.firstByte = timings.response - timings.upload;
        handleError(response);
        response.once('end', () => {
            timings.end = Date.now();
            timings.phases.download = timings.end - timings.response;
            timings.phases.total = timings.end - timings.start;
        });
    });
    return timings;
};
module.exports = timer;
//# sourceMappingURL=index.js.map