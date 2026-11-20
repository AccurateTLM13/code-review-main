// Lenient JSON extraction from model output: strips code fences, finds the
// first balanced JSON object/array, repairs common slips (trailing commas,
// smart quotes). Small models drift — we recover instead of failing.

export function extractJson(text) {
  if (text == null) return { ok: false, error: 'empty response', data: null };
  let t = String(text).trim();

  // strip ``` fences
  t = t.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  // drop common prose prefixes like "Here is the JSON:" on its own line(s)
  const firstBrace = t.search(/[{[]/);
  if (firstBrace > 0) t = t.slice(firstBrace);

  const direct = tryParse(t);
  if (direct.ok) return direct;

  const scanned = scanBalanced(t);
  if (scanned) {
    const parsed = tryParse(scanned);
    if (parsed.ok) return parsed;
    const repaired = tryParse(repair(scanned));
    if (repaired.ok) return repaired;
  }

  const repairedAll = tryParse(repair(t));
  if (repairedAll.ok) return repairedAll;

  return { ok: false, error: 'no valid JSON found in model output', data: null, raw: String(text).slice(0, 500) };
}

function tryParse(s) {
  try { return { ok: true, data: JSON.parse(s) }; } catch { return { ok: false }; }
}

function scanBalanced(t) {
  const open = t[0];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return t.slice(0, i + 1);
    }
  }
  return null;
}

function repair(s) {
  return s
    // smart quotes used as JSON delimiters
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // trailing commas before } or ]
    .replace(/,\s*([\]}])/g, '$1');
}
