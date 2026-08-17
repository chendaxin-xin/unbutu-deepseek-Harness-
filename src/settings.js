'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  host: '127.0.0.1',
  port: 0,
  dshHome: '',
  closeToTray: true,
  autoStart: false,
};

class Settings {
  constructor(file) {
    this.file = file;
    this.data = Object.assign({}, DEFAULTS);
    this.load();
  }
  load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      this.data = Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (_) {}
  }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[dsh-desktop] failed to save settings:', err);
    }
  }
  get(key) { return this.data[key]; }
  set(key, value) { this.data[key] = value; this.save(); }
  all() { return Object.assign({}, this.data); }
}

module.exports = { Settings, DEFAULTS };
