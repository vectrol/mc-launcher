// Minimal test framework (no dependencies)
let passed = 0, failed = 0;
const failures = [];
const queue = [];

function test(name, fn) {
  queue.push({ name, fn });
}

async function runAll() {
  for (const { name, fn } of queue) {
    try {
      await fn();
      passed++;
      console.log(`  OK  ${name}`);
    } catch (e) {
      failed++;
      failures.push({ name, error: e.message || String(e) });
      console.log(`FAIL  ${name}: ${e.message}`);
    }
  }
  const { passed: p, failed: f, failures: fl } = summary();
  console.log(`\n${p} passed, ${f} failed`);
  if (f > 0) {
    console.log('\nFailures:');
    for (const x of fl) console.log(`  - ${x.name}: ${x.error}`);
    process.exit(1);
  }
  process.exit(0);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'assertEq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function summary() { return { passed, failed, failures }; }

module.exports = { test, assert, assertEq, summary, runAll };
