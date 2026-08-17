'use strict';

// Smoke-test the dsh server manager without Electron:
//   node scripts/smoke-server.js
// Expects SMOKE_READY <url> then SMOKE_STOPPED.

const path = require('path');
const { DshServer } = require('../src/server');

async function main() {
  const home = process.env.SMOKE_HOME || path.join(__dirname, '..', '.test-home');
  const server = new DshServer({
    host: '127.0.0.1',
    port: Number(process.env.SMOKE_PORT) || 0,
    dshHome: home,
  });
  server.on('stdout', (l) => process.stdout.write('[dsh] ' + l));
  server.on('stderr', (l) => process.stderr.write('[dsh-err] ' + l));
  const url = await server.start();
  console.log('SMOKE_READY ' + url);
  setTimeout(() => {
    server.stop();
    console.log('SMOKE_STOPPED');
    process.exit(0);
  }, 2500);
}

main().catch((err) => {
  console.error('SMOKE_FAIL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
