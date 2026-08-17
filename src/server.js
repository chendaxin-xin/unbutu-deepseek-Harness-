'use strict';

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const net = require('net');
const http = require('http');
const path = require('path');
const fs = require('fs');

function resolveDshBin() {
  try {
    const pkgJson = require.resolve('@deepseek-ai/dsh/package.json');
    const manifest = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    const rel = manifest && manifest.bin && manifest.bin.dsh;
    if (rel) return path.join(path.dirname(pkgJson), rel);
  } catch (_) {}
  return null;
}

function findOnPath(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    try { fs.accessSync(candidate, fs.constants.X_OK); return candidate; } catch (_) {}
  }
  return null;
}

function resolveRunner() {
  // --expose-internals lets dsh's HMR service reach Node internals without the
  // node-addon-require-builtin native addon (which does not work under Electron).
  const nodeArgs = ['--expose-internals'];
  if (process.env.DSH_NODE) return { command: process.env.DSH_NODE, env: {}, nodeArgs };
  const node = findOnPath('node');
  if (node) return { command: node, env: {}, nodeArgs };
  return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' }, nodeArgs };
}

function findFreePort(host) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, host, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function waitForHttp(url, timeoutMs, intervalMs) {
  timeoutMs = timeoutMs || 45000;
  intervalMs = intervalMs || 250;
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (Date.now() - started >= timeoutMs) return resolve(false);
      const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode < 500); });
      req.on('error', () => setTimeout(tick, intervalMs));
      req.setTimeout(1000, () => { req.destroy(); setTimeout(tick, intervalMs); });
    };
    tick();
  });
}

class DshServer extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.host = options.host || '127.0.0.1';
    this.port = Number(options.port) || 0;
    this.dshHome = options.dshHome || '';
    this.child = null;
    this.url = null;
  }
  async start() {
    if (this.child) return this.url;
    const bin = resolveDshBin();
    if (!bin) throw new Error('DeepSeek Harness CLI (@deepseek-ai/dsh) not found.');
    let port = Number(this.port) || 0;
    if (port === 0) port = await findFreePort(this.host);
    const runner = resolveRunner();
    const args = runner.nodeArgs.concat([bin, 'web', '--host', this.host, '--port', String(port)]);
    const env = Object.assign({}, process.env, runner.env, { NO_COLOR: '1', FORCE_COLOR: '0' });
    if (this.dshHome) env.DSH_HOME = this.dshHome;
    this.child = spawn(runner.command, args, { env, stdio: ['ignore', 'pipe', 'pipe'], cwd: path.dirname(bin) });
    this.url = 'http://' + this.host + ':' + port;
    this._attach();
    const ready = await waitForHttp(this.url);
    if (!ready) {
      this.stop();
      throw new Error('DeepSeek Harness server did not become ready at ' + this.url);
    }
    this.emit('ready', this.url);
    return this.url;
  }
  _attach() {
    const c = this.child;
    if (!c) return;
    c.stdout.on('data', (d) => this.emit('stdout', d.toString()));
    c.stderr.on('data', (d) => this.emit('stderr', d.toString()));
    c.on('error', (err) => this.emit('error', err));
    c.on('exit', (code, signal) => {
      const wasCurrent = this.child === c;
      this.child = null;
      if (wasCurrent) this.emit('exit', { code: code, signal: signal });
    });
  }
  stop() {
    const child = this.child;
    if (!child) return;
    this.child = null;
    try { child.kill('SIGTERM'); } catch (_) {}
    const killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 3000);
    killTimer.unref();
  }
}

module.exports = { DshServer, resolveDshBin, resolveRunner, findFreePort, waitForHttp };
