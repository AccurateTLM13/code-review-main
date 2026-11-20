// Tiny logger with quiet/verbose/color control. No dependencies.

const W = process.stdout.isTTY && process.platform !== 'win32' ? true : true; // ANSI works on Win10+ terminals
const supportsColor = (() => {
  if (process.env.NO_COLOR || process.env.CODE_AUDIT_NO_COLOR) return false;
  if (!process.stdout.isTTY) return false;
  return true;
})();

const c = (code) => (supportsColor ? `\x1b[${code}m` : '');
export const colors = {
  red: c('31;1'), green: c('32'), yellow: c('33;1'), blue: c('34'),
  magenta: c('35'), cyan: c('36;1'), dim: c('2'), bold: c('1'), reset: c('0'),
};

export function createLogger({ verbose = false, quiet = false } = {}) {
  const t0 = Date.now();
  const elapsed = () => `${colors.dim}+${((Date.now() - t0) / 1000).toFixed(1)}s${colors.reset}`;
  return {
    verbose,
    quiet,
    colors,
    debug(msg) {
      if (verbose && !quiet) console.error(`${colors.dim}[debug]${colors.reset} ${msg}`);
    },
    info(msg) {
      if (!quiet) console.error(`${colors.cyan}›${colors.reset} ${msg}`);
    },
    phase(msg) {
      if (!quiet) console.error(`${colors.blue}==${colors.reset} ${colors.bold}${msg}${colors.reset} ${elapsed()}`);
    },
    ok(msg) {
      if (!quiet) console.error(`${colors.green}✓${colors.reset} ${msg}`);
    },
    warn(msg) {
      if (!quiet) console.error(`${colors.yellow}!${colors.reset} ${msg}`);
    },
    error(msg) {
      console.error(`${colors.red}✗${colors.reset} ${msg}`);
    },
    out(msg) {
      console.log(msg);
    },
  };
}
