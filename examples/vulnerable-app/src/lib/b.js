// Fixture: other half of the import cycle (a.js ↔ b.js).
const { validate } = require('./a.js');

function shared() {
  return { cycle: true, note: 'b.js imports a.js which imports b.js' };
}

function checkOnce() {
  return validate({ mode: 'once' });
}

module.exports = { shared, checkOnce };
