/// <reference types="node" />
import { ClientRequest } from 'http';
interface Timings {
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
declare const timer: (request: ClientRequest) => Timings;
export = timer;
