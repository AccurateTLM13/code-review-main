# Borderline findings — run `m3-quality-1`

Real-repository findings for manual adjudication (rubric: correct? already known/documented? actionable? severity fair?). One row per finding; mark ✓/✗/borderline.

| model | file | lines | severity | category | verified | title | verdict (✓/✗/~) | note |
|---|---|---|---|---|---|---|---|---|
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 501-531 | medium | duplication | adjusted | Deprecated res.sendfile duplicates res.sendFile logic |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 206-210 | medium | performance | adjusted | Hardcoded synchronous iteration limit (100) in router handle |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 580-595 | medium | bug | verified | matchLayer catches and returns errors as match results |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 120-144 | low | debt | adjusted | res.send handles deprecated status/body argument permutations |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 87-92 | low | refactoring | adjusted | Trust proxy back-compat uses fragile symbol-like property |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-1413 | medium | refactoring | unverified | Test files exceed size/complexity thresholds (multiple files >800 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/utils.js | 30-55 | low | debt | unverified | utils.flatten and utils.contentDisposition deprecated but still used internally |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-1179 | medium | refactoring | verified | Oversized response.js god object (1,179 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 206-261 | medium | refactoring | adjusted | Complex control flow with sync stack limit in router handle() |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 223-246 | medium | bug | adjusted | Mounted app prototype mutation in app.use |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | 1-1 | medium | security | unverified | No lockfile committed (package-lock.json / yarn.lock) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 250-400 | medium | duplication | unverified | Duplicated implementation in res.sendFile and res.sendfile |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 300-380 | low | refactoring | unverified | Complex async parameter processing with recursive callbacks in process_params |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| nvidia/nemotron-3-ultra-550b-a55b/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
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
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 501-516 | medium | security | adjusted | Deprecated res.sendfile skips the path validation that res.sendFile enforces |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/application.js | 196-213 | low | duplication | verified | app.use and router.use duplicate the mount-path disambiguation block verbatim |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 448-458 | low | duplication | adjusted | res.sendFile and res.sendfile duplicate the sendfile() transfer and error-routing block |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1184-1195 | low | duplication | adjusted | test/res.sendFile.js duplicates the option matrix for the deprecated .sendfile() API |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 42-50 | low | refactoring | adjusted | lib/response.js concentrates six unrelated responsibilities in one exported prototype |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 253-265 | low | duplication | adjusted | res.send/res.json/res.jsonp each re-implement the legacy (status, body) argument shuffle |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.urlencoded.js | 346-350 | low | duplication | adjusted | test/express.urlencoded.js duplicates whole matrices for extended:true/false |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 333-335 | low | security | adjusted | res.jsonp reflects a user-controlled callback name into a text/javascript body |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.sendFile.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 824-829 | low | bug | adjusted | res.clearCookie silently defaults path to '/' and cannot clear cookies set with other attributes |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.param.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in app.param.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.download.js | 1-80 | low | refactoring | verified | Deep nesting (≈8 levels) in res.download.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.format.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.format.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.render.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.render.js |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.status.js | 1-80 | low | refactoring | verified | Deep nesting (≈7 levels) in res.status.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/router/index.js | 616-619 | low | bug | adjusted | mergeParams mutates the layer's own params object while shifting numeric indices |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 588-591 | low | bug | adjusted | res.download clones caller options with Object.create(opts) instead of a shallow copy |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/router/index.js | 445-457 | low | bug | adjusted | use() treats any non-function first argument as a mount path without validating its type |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/application.js | 1-40 | info | refactoring | verified | Large file worth watching: application.js (662 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/router/index.js | 1-40 | info | refactoring | verified | Large file worth watching: index.js (674 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | test/support/utils.js | — | info | refactoring | verified | Central hub module: utils.js imported by 8 files |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 82-82 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 1-40 | info | refactoring | verified | Large file worth watching: request.js (526 lines) |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 186-197 | info | refactoring | adjusted | res.send Content-Length/ETag branch silently changes chunk to a Buffer |  |  |
| baidu/ernie-5.5-flash-preview/free | examples/vhost/index.js | 39-39 | low | security | verified | Insecure http:// endpoint in source |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/router/index.js | 206-210 | info | refactoring | adjusted | Router dispatch stack-safety relies on a magic sync counter reset in a different function |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/application.js | 166-172 | info | refactoring | verified | Unhandled errors are printed to console.error with no interception hook |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 379-398 | medium | duplication | verified | 20-line block duplicated within response.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 1-60 | medium | refactoring | verified | Oversized file: response.js is 1,179 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/app.router.js | 1-60 | medium | refactoring | verified | Oversized file: app.router.js is 1,112 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.static.js | 1-60 | medium | refactoring | verified | Oversized file: express.static.js is 815 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.urlencoded.js | 1-60 | medium | refactoring | verified | Oversized file: express.urlencoded.js is 867 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | test/res.sendFile.js | 1-60 | medium | refactoring | verified | Oversized file: res.sendFile.js is 1,413 lines |  |  |
| baidu/ernie-5.5-flash-preview/free | package.json | — | medium | debt | verified | No lockfile committed next to package.json |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/request.js | 452-452 | low | debt | verified | 1 TODO marker in request.js |  |  |
| baidu/ernie-5.5-flash-preview/free | lib/response.js | 448-458 | low | duplication | adjusted | File-transfer callback logic duplicated between res.sendFile and res.sendfile |  |  |
| baidu/ernie-5.5-flash-preview/free | test/express.urlencoded.js | 859-866 | low | duplication | adjusted | tryRequire test helper duplicated across multiple test files |  |  |
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