// Fixture: orphan module — nothing imports it.
function legacyTax(amount) {
  // XXX: pre-2019 tax table, kept "just in case"
  if (amount < 0) throw new Error('negative amount');
  return Math.round(amount * 1.22 * 100) / 100;
}

module.exports = { legacyTax };
