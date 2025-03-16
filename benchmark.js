import { execSync } from "child_process";

function measureTime(command, iterations) {
  let totalTime = 0;
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime();
    execSync(command, { stdio: "ignore" });
    const end = process.hrtime(start);
    totalTime += end[0] * 1000 + end[1] / 1e6; // Convert to milliseconds
  }
  return totalTime / iterations; // Average time in ms
}

const iterations = 100;

console.log("Running benchmarks...");

const pnpmTime = measureTime("pnpm typecheck", iterations);
console.log(`pnpm typecheck average time: ${pnpmTime.toFixed(3)} ms`);

const tsgoTime = measureTime("tsgo --noEmit", iterations);
console.log(`tsgo --noEmit average time: ${tsgoTime.toFixed(3)} ms`);
