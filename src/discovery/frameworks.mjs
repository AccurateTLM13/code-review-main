// Framework / stack detection from dependency manifests and config files.
// Best-effort and heuristic: presence + dependency names, with evidence strings.

const NPM_CATALOG = {
  react: 'React', 'react-dom': 'React', next: 'Next.js', vue: 'Vue', nuxt: 'Nuxt',
  svelte: 'Svelte', astro: 'Astro', '@angular/core': 'Angular', solid_js: null,
  express: 'Express', fastify: 'Fastify', '@nestjs/core': 'NestJS', koa: 'Koa',
  'hono': 'Hono', electron: 'Electron', prisma: 'Prisma', '@prisma/client': 'Prisma',
  drizzle: 'prisma-orm', typeorm: 'TypeORM', mongoose: 'Mongoose', sequelize: 'Sequelize',
  'apollo-server': 'Apollo GraphQL', '@apollo/server': 'Apollo GraphQL', graphql: 'GraphQL',
  jest: 'Jest', vitest: 'Vitest', mocha: 'Mocha', cypress: 'Cypress', playwright: 'Playwright',
  tailwindcss: 'Tailwind CSS', '@mui/material': 'Material UI', 'antd': 'Ant Design',
  'bootstrap': 'Bootstrap', redux: 'Redux', '@reduxjs/toolkit': 'Redux Toolkit',
  zustand: 'Zustand', 'react-query': 'React Query', '@tanstack/react-query': 'TanStack Query',
  'socket.io': 'Socket.IO', ws: 'WebSocket (ws)', 'ioredis': 'Redis (ioredis)',
  'bullmq': 'BullMQ', 'esbuild': 'esbuild', webpack: 'Webpack', vite: 'Vite',
  '@nestjs/microservices': 'NestJS Microservices', commander: 'Commander CLI', yargs: 'Yargs CLI',
  'inquirer': 'Inquirer CLI', discord_js: null, 'fabric-network': null,
  'aws-sdk': 'AWS SDK', '@aws-sdk/client-s3': 'AWS SDK v3', 'azure-storage': 'Azure SDK',
  typegraphql: 'TypeGraphQL', 'zod': 'Zod', axios: 'Axios', 'node-cron': 'node-cron',
};
const PY_CATALOG = {
  django: 'Django', flask: 'Flask', fastapi: 'FastAPI', 'flask-restful': 'Flask-RESTful',
  tornado: 'Tornado', sqlalchemy: 'SQLAlchemy', 'django-rest-framework': 'DRF',
  celery: 'Celery', numpy: 'NumPy', pandas: 'pandas', torch: 'PyTorch',
  tensorflow: 'TensorFlow', scikit_learn: 'scikit-learn', pytest: 'pytest',
  'uvicorn': 'Uvicorn', gunicorn: 'Gunicorn', 'pydantic': 'Pydantic', requests: 'requests',
  boto3: 'Boto3 (AWS)', click: 'Click CLI', 'aiohttp': 'aioHTTP',
};
const GO_CATALOG = {
  'github.com/gin-gonic/gin': 'Gin', 'github.com/labstack/echo': 'Echo',
  'github.com/gofiber/fiber': 'Fiber', 'github.com/gorilla/mux': 'Gorilla Mux',
  'gorm.io/gorm': 'GORM', 'github.com/jackc/pgx': 'pgx', 'database/sql': 'Go database/sql',
};
const RUBY_CATALOG = { rails: 'Ruby on Rails', sinatra: 'Sinatra', rspec: 'RSpec' };
const PHP_CATALOG = { laravel: 'Laravel', 'symfony/framework-bundle': 'Symfony' };
const MVN_CATALOG = {
  'org.springframework.boot': 'Spring Boot', 'org.springframework': 'Spring',
  'io.quarkus': 'Quarkus', 'org.junit.jupiter': 'JUnit 5',
};
const CARGO_CATALOG = {
  axum: 'Axum', actix_web: 'Actix Web', warp: 'Warp', rocket: 'Rocket',
  tokio: 'Tokio', serde: 'Serde', bevy: 'Bevy', sqlx: 'sqlx',
};

/**
 * Detect stacks. fileSet: Map rel->entry; content(rel) reader.
 * Returns { stacks: [{name, evidence, kind}], manifests: [{file, manager, deps, devDeps}] }
 */
export function detectStacks(fileSet, content, logger) {
  const stacks = [];
  const manifests = [];
  const seen = new Set();
  const addStack = (name, evidence, kind = 'framework') => {
    const key = `${name}|${kind}`;
    if (name && !seen.has(key)) { seen.add(key); stacks.push({ name, evidence, kind }); }
  };

  // --- Node ---
  for (const rel of [...fileSet.keys()].filter((r) => /(^|\/)package\.json$/.test(r) && !/(^|\/)node_modules\//.test(r))) {
    let pkg;
    try { pkg = JSON.parse(content(rel)); } catch { continue; }
    const deps = { ...pkg.dependencies };
    const devDeps = { ...pkg.devDependencies };
    manifests.push({ file: rel, manager: 'npm', deps, devDeps, raw: pkg });
    for (const dep of Object.keys(deps)) {
      if (NPM_CATALOG[dep]) addStack(NPM_CATALOG[dep], `package.json dependency "${dep}"`);
    }
    for (const dep of Object.keys(devDeps)) {
      if (['vite', 'tailwindcss', 'jest', 'vitest', 'playwright', 'cypress', 'webpack'].includes(dep)) {
        addStack(NPM_CATALOG[dep], `package.json devDependency "${dep}"`, 'tooling');
      }
    }
  }

  // --- Python ---
  const reqRe = /(^|\/)(requirements[a-z0-9_.-]*\.txt|pyproject\.toml|Pipfile)$/;
  for (const rel of [...fileSet.keys()].filter((r) => reqRe.test(r))) {
    const text = content(rel);
    if (text == null) continue;
    const deps = {};
    const manager = rel.endsWith('.toml') ? 'pip (pyproject)' : 'pip';
    if (rel.endsWith('.txt')) {
      for (const line of text.split(/\r?\n/)) {
        const m = line.trim().match(/^([A-Za-z0-9_.\-]+)\s*(?:[<>=!~]=?.*)?$/);
        if (m && !line.trim().startsWith('#') && !line.trim().startsWith('-')) {
          const key = m[1].toLowerCase().replace(/-/g, '_');
          deps[m[1]] = line.trim();
          if (PY_CATALOG[key]) addStack(PY_CATALOG[key], `${rel} dependency "${m[1]}"`);
        }
      }
    } else {
      for (const m of text.matchAll(/^\s*(?:dependencies|)?\s*"?([A-Za-z0-9_.\-]+)"?\s*[=<>~]/gm)) {
        deps[m[1]] = m[0].trim();
        if (PY_CATALOG[m[1].toLowerCase().replace(/-/g, '_')]) addStack(PY_CATALOG[m[1].toLowerCase().replace(/-/g, '_')], `${rel} dependency "${m[1]}"`);
      }
    }
    manifests.push({ file: rel, manager, deps, devDeps: {} });
  }
  const hasManagePy = [...fileSet.keys()].some((r) => /(^|\/)manage\.py$/.test(r));
  if (hasManagePy) addStack('Django', 'manage.py found');

  // --- Go ---
  for (const rel of [...fileSet.keys()].filter((r) => /(^|\/)go\.mod$/.test(r))) {
    const text = content(rel) ?? '';
    const module = text.match(/^module\s+(\S+)/m)?.[1] ?? null;
    const deps = {};
    for (const m of text.matchAll(/^\s*([A-Za-z0-9_.\-\/]+)\s+v[\w.\-]+$/gm)) {
      deps[m[1]] = m[0].trim();
      if (GO_CATALOG[m[1]]) addStack(GO_CATALOG[m[1]], `go.mod dependency "${m[1]}"`);
    }
    manifests.push({ file: rel, manager: 'go modules', deps, devDeps: {}, goModule: module });
  }

  // --- Ruby / PHP / Java / Rust ---
  for (const rel of [...fileSet.keys()]) {
    if (/(^|\/)Gemfile$/.test(rel)) {
      const text = content(rel) ?? '';
      for (const m of text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)) {
        if (RUBY_CATALOG[m[1].toLowerCase()]) addStack(RUBY_CATALOG[m[1].toLowerCase()], `Gemfile gem "${m[1]}"`);
      }
      manifests.push({ file: rel, manager: 'bundler', deps: {}, devDeps: {} });
    }
    if (/(^|\/)composer\.json$/.test(rel)) {
      try {
        const c = JSON.parse(content(rel));
        for (const dep of Object.keys(c.require ?? {})) {
          if (PHP_CATALOG[dep.toLowerCase()]) addStack(PHP_CATALOG[dep.toLowerCase()], `composer.json "${dep}"`);
        }
        manifests.push({ file: rel, manager: 'composer', deps: c.require ?? {}, devDeps: c['require-dev'] ?? {} });
      } catch { /* ignore */ }
    }
    if (/(^|\/)(pom\.xml|build\.gradle|build\.gradle\.kts)$/.test(rel)) {
      const text = content(rel) ?? '';
      for (const key of Object.keys(MVN_CATALOG)) {
        if (text.includes(key)) addStack(MVN_CATALOG[key], `${rel} references ${key}`);
      }
      manifests.push({ file: rel, manager: rel.endsWith('.xml') ? 'maven' : 'gradle', deps: {}, devDeps: {} });
    }
    if (/(^|\/)Cargo\.toml$/.test(rel)) {
      const text = content(rel) ?? '';
      for (const key of Object.keys(CARGO_CATALOG)) {
        const re = new RegExp(`^\\s*${key.replace(/_/g, '[\\-_]')}\\s*=`, 'm');
        if (re.test(text)) addStack(CARGO_CATALOG[key], `Cargo.toml "${key}"`);
      }
      manifests.push({ file: rel, manager: 'cargo', deps: {}, devDeps: {} });
    }
  }

  // --- infra / tooling by file presence ---
  const presence = [
    [/\.github\/workflows\//, 'GitHub Actions CI', 'ci'],
    [/(^|\/)\.gitlab-ci\.yml$/, 'GitLab CI', 'ci'],
    [/(^|\/)Jenkinsfile$/, 'Jenkins CI', 'ci'],
    [/(^|\/)dockerfile$/i, 'Docker', 'infra'],
    [/(^|\/)docker-compose\.ya?ml$/, 'Docker Compose', 'infra'],
    [/(^|\/)k8s\//, 'Kubernetes manifests', 'infra'],
    [/(^|\/)terraform\/|\.tf$/, 'Terraform', 'infra'],
    [/(^|\/)(next\.config\.[a-z]+)$/, 'Next.js', 'framework'],
    [/(^|\/)(vite\.config\.[a-z]+)$/, 'Vite', 'tooling'],
    [/(^|\/)tsconfig\.json$/, 'TypeScript', 'language'],
    [/(^|\/)\.nvmrc$/, 'Node version pinning (.nvmrc)', 'tooling'],
  ];
  for (const [re, name, kind] of presence) {
    for (const rel of fileSet.keys()) {
      if (re.test(rel)) { addStack(name, rel, kind); break; }
    }
  }

  // de-duplicate framework/tooling names
  const unique = new Map();
  for (const s of stacks) unique.set(s.name, s);
  return { stacks: [...unique.values()], manifests };
}
