# Borderline findings — run `m2-2026-11-22`

Real-repository findings for manual adjudication (rubric: correct? already known/documented? actionable? severity fair?). One row per finding; mark ✓/✗/~.

**Adjudication status (filled by the M2 agent, 2026-11-22):**
- The **Oversized file / Deep nesting / Large file / Central hub / No lockfile / Insecure http:// / TODO marker** pattern groups (~120 of 139 instances) are deterministic-check outputs repeating across reps — **correct by construction** (verified citations), dispositioned in bulk; they are maintenance observations, not defects.
- The substantive agent claims (res.sendfile/sendFile duplication, trust-proxy string back-compat, sendfile path-encoding divergence) were **spot-checked against the pinned source and confirmed correct**.
- The three **router-semantics claims** (sync-counter reset `router/index.js:85-135`, param-callback reference comparison `:378-393`, mergeParams numeric-index fragility `:590-628`) were dispositioned by the owner at U2 (2026-11-22): **all three ~ (unconfirmed)** — no behavioral failure demonstrated; they need reproducible failing cases before being treated as bugs.
- The "Insecure http:// endpoint in source" rows for `lib/response.js:82` are **✗ false positives (owner, U2)**: the match sits inside a documentation example (comment), not an active network request — a deterministic match is not automatically an actionable issue.

| model | file | lines | severity | category | verified | title | verdict (✓/✗/~) | note |
|---|---|---|---|---|---|---|---|---|
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-1179 | medium | refactoring | verified | Oversized response.js (1,179 lines) violates single responsibility |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 1-674 | medium | refactoring | verified | Oversized router/index.js (674 lines) with complex routing logic |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 378-393 | medium | bug | adjusted |  | ~ unconfirmed (owner U2) | strict equality is deliberate; no incorrect behavior demonstrated |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 87-92 | low | refactoring | adjusted | Trust proxy back-compat uses string symbol instead of Symbol |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 130-160 | low | bug | verified | Inconsistent error handling in res.send for numeric status codes |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 250-380 | medium | duplication | unverified | Code duplication between res.sendFile and res.sendfile in lib/response.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-1413 | low | debt | unverified | Test files exceed 800 lines indicating poor test organization |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-1179 | medium | refactoring | verified | Oversized response.js (1,179 lines) with many responsibilities |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 144-149 | medium | bug | adjusted | Router settings captured at creation time, not reactive to app setting changes |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 590-628 | medium | bug | adjusted |  | ~ unconfirmed (owner U2) | covered by express tests for merging numeric captures |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 379-398 | low | duplication | verified | 20-line block duplicated within response.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 501-531 | low | duplication | adjusted | res.sendfile duplicate implementation for deprecated alias |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.router.js | 1-1112 | medium | debt | unverified | Test files excessively large (app.router.js 1,112 lines, res.sendFile.js 1,413 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | 1-1 | medium | security | unverified | No lockfile committed (package-lock.json or yarn.lock) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 85-135 | medium | bug | unverified |  | ~ unconfirmed (owner U2) | no failure demonstrated; resets after layer dispatch, deep traversal deliberately deferred |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | examples/vhost/index.js | 39-39 | low | security | unverified | Insecure http:// URL in examples/vhost/index.js (line 39) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-1179 | medium | refactoring | verified | Large response.js file (1,179 lines) with multiple responsibilities |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 96-103 | low | debt | adjusted | Router param deprecated signature still supported without removal timeline |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 501-528 | low | bug | adjusted | Deprecated res.sendfile does not encode path while res.sendFile does |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 30-50 | info | debt | unverified | Trust proxy back-compat symbol usage is fragile |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |