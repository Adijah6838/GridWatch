import { parentPort } from 'worker_threads';

// Simulate a heavy CPU task
function runHeavyComputation() {
  console.log('Worker started calculating heavy stats...');
  let sum = 0;
  for (let i = 0; i < 500000000; i++) {
    sum += Math.sqrt(i);
  }
  return sum;
}

if (parentPort) {
  const result = runHeavyComputation();
  parentPort.postMessage({ success: true, result });
}
