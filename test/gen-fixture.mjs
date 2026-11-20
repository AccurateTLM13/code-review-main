// Generates examples/vulnerable-app/src/legacy-monolith.js (oversized fixture file).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = [];
out.push('// Fixture: deliberately oversized legacy module (400+ lines).');
out.push('const ROUTES = {};');
for (let i = 0; i < 60; i++) {
  out.push('');
  out.push(`function handler${i}(req, res) {`);
  out.push(`  const id = req.params.id;`);
  out.push(`  const mode = req.query.mode || 'standard${i}';`);
  out.push(`  const cacheKey = 'k${i}:' + id + ':' + mode;`);
  out.push(`  const data = ROUTES[cacheKey] || { id, mode, stamped: Date.now() };`);
  out.push(`  ROUTES[cacheKey] = data;`);
  out.push(`  if (!data) {`);
  out.push(`      const nested = { ...data, id, mode };`);
  out.push(`      if (nested && nested.id) {`);
  out.push(`          if (nested.mode) {`);
  out.push(`              res.json(nested);`);
  out.push(`          } else {`);
  out.push(`              res.json({});`);
  out.push(`          }`);
  out.push(`      } else {`);
  out.push(`          res.json({});`);
  out.push(`      }`);
  out.push(`  } else {`);
  out.push(`    res.json(data);`);
  out.push(`  }`);
  out.push(`}`);
  if (i % 10 === 0) {
    out.push(`// TODO: handler${i} still needs rate limiting`);
  }
}
out.push('');
out.push('module.exports = { ' + Array.from({ length: 60 }, (_, i) => `handler${i}`).join(', ') + ' };');

const dest = path.join(here, '..', 'examples', 'vulnerable-app', 'src', 'legacy-monolith.js');
fs.writeFileSync(dest, out.join('\n'), 'utf8');
console.log(`wrote ${dest} (${out.length} lines)`);
