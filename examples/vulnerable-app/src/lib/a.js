// Fixture: half of an import cycle (a.js ↔ b.js).
const { shared } = require('./b.js');

function validate(config) {
  if (!config || typeof config !== 'object') {
    return { ok: false, reason: 'invalid config' };
  }
  return { ok: true, via: 'a', shared: shared() };
}

module.exports = { validate };
