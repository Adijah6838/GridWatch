"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
// Simulate a heavy CPU task
function runHeavyComputation() {
    console.log('Worker started calculating heavy stats...');
    let sum = 0;
    for (let i = 0; i < 500000000; i++) {
        sum += Math.sqrt(i);
    }
    return sum;
}
if (worker_threads_1.parentPort) {
    const result = runHeavyComputation();
    worker_threads_1.parentPort.postMessage({ success: true, result });
}
