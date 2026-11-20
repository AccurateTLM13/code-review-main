// Language statistics: file counts and lines of code per language.
import { EXT_LANG, SOURCE_EXTS } from '../util/files.mjs';

/**
 * Compute per-language stats from walked files + a lazy content reader.
 */
export function languageStats(files, readLines) {
  const byLang = new Map();
  let totalLoc = 0, totalSourceFiles = 0, unreadable = 0;

  for (const entry of files) {
    const lang = EXT_LANG[entry.ext];
    if (!lang || !SOURCE_EXTS.has(entry.ext)) continue;
    let loc = 0;
    if (entry.size <= 200_000) {
      const lines = readLines(entry.rel);
      if (lines) loc = lines.length;
      else unreadable++;
    } else loc = 0;
    totalSourceFiles++;
    totalLoc += loc;
    const cur = byLang.get(lang) ?? { language: lang, files: 0, loc: 0 };
    cur.files++; cur.loc += loc;
    byLang.set(lang, cur);
  }

  const languages = [...byLang.values()].sort((a, b) => b.loc - a.loc || b.files - a.files);
  return { languages, totalLoc, totalSourceFiles, unreadable };
}

export function topLanguages(languages, n = 5) {
  return languages.slice(0, n).map((l) => ({
    language: l.language,
    share: l.loc > 0 ? Math.round((l.loc / Math.max(1, l.loc)) * 100) / 100 : 0,
    ...l,
  }));
}
