// Minimal OpenAI-compatible mock server for testing the model adapters
// (native HTTP client and Vercel AI SDK) without any real provider.
//
//   node test/mock-server.mjs            (listens on 8765, or MOCK_PORT)
//
// Behaviors:
//  - No tools in request  -> replies with a JSON audit report citing a real file
//  - Tools in request     -> step 1: calls get_summary; step 2: calls submit_findings
//                            with findings citing files read from the prompt; then stops.
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8765);
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  if (!req.url.includes('/chat/completions')) {
    res.writeHead(404).end('{}');
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    if (DELAY_MS > 0) await sleep(DELAY_MS); // simulate a slow provider (cancellation tests)
    let payload;
    try { payload = JSON.parse(body); } catch { res.writeHead(400).end('{}'); return; }
    const messages = payload.messages ?? [];
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const userText = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content ?? '');
    const tools = payload.tools ?? [];
    const hasToolResult = messages.some((m) => m.role === 'tool');

    let message;
    if (tools.length && !hasToolResult) {
      message = {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_summary', arguments: '{}' } }],
      };
    } else if (tools.length) {
      const file = extractExcerpt(userText)?.file ?? 'src/utils.js';
      message = {
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: 'call_2', type: 'function',
          function: {
            name: 'submit_findings',
            arguments: JSON.stringify({
              findings: [{
                title: 'Mock-server finding: centralize error handling',
                category: 'refactoring', severity: 'low', confidence: 0.6,
                file, lines: [1, 10], snippet: null,
                description: 'Served by the local mock OpenAI-compatible server to exercise the adapter path end to end.',
                suggestion: 'Extract a shared error helper.', benefit: 'Consistency.', risk: 'Low.',
              }],
              notes: 'Mock server autonomous result.',
            }),
          },
        }],
      };
    } else {
      const ex = extractExcerpt(userText);
      const file = ex?.file ?? 'src/utils.js';
      const findingId = userText.match(/^- \[[A-Z]+\] (.+?) — /m)?.[1] ?? null; // ids may contain redaction placeholders
      message = {
        role: 'assistant',
        content: '```json\n' + JSON.stringify({
          verdicts: findingId ? [{ id: findingId, action: 'confirm', severity: 'medium', confidence: 0.8, reason: 'Consistent with the excerpt.' }] : [],
          findings: [{
            title: 'Mock-server finding: unify response handling',
            category: 'refactoring', severity: 'low', confidence: 0.55,
            file, lines: [1, 1], snippet: ex?.firstLine ?? null,
            description: 'Served by the local mock OpenAI-compatible server; evidence points at a real excerpt line.',
            suggestion: 'Introduce one response helper.', benefit: 'Less duplication.', risk: 'Low.',
          }],
          notes: 'Mock structured evaluation.',
        }, null, 2) + '\n```',
      };
    }

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'chatcmpl-mock', object: 'chat.completion', created: Date.now() / 1000 | 0,
      model: payload.model ?? 'mock-model',
      choices: [{ index: 0, message, finish_reason: tools.length && !hasToolResult ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: 128, completion_tokens: 64, total_tokens: 192 },
    }));
  });
});

function extractExcerpt(text) {
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^# --- (.+?) --- /);
    if (m) {
      const file = m[1].replace(/\\/g, '/');
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
        const t = lines[j].trim();
        if (t && !t.startsWith('#') && !t.startsWith('===')) return { file, firstLine: t };
      }
      return { file, firstLine: null };
    }
  }
  return null;
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock OpenAI-compatible server on http://127.0.0.1:${PORT}/v1 (ctrl-c to stop)`);
});
