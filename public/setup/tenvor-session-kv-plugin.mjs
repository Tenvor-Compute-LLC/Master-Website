// Tenvor OpenCode V1 session cache plugin. Source: scripts/opencode/*.mjs.
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const SCOPE = /^[0-9a-f]{64}$/;
const LEASE = /^[A-Za-z0-9_-]{43}$/;
const MAX_EVENT_BYTES = 4 << 20;
const MAX_STREAM_BYTES = 16 << 20;
const MAX_REQUEST_BYTES = 16 << 20;
const MAX_DEFERRED_CHUNKS = 8192;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const positiveInteger = (n) => Number.isSafeInteger(n) && n > 0;
const count = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 65_536;

// Exclude only transport/output/sampling options and the thinking level.
// Everything else (including model, tools, tool_choice, parallel_tool_calls,
// chat_template_kwargs, response_format and future prompt controls) must
// match: it can change what is rendered before or around the messages. The
// thinking level (thinking, reasoning_effort, reasoning) changes only the
// generation prompt at the end of the rendered request, so the retained prefix
// stays valid when it changes.
const NON_RENDERING_FIELDS = new Set([
  'messages', 'stream', 'stream_options', 'max_tokens', 'max_completion_tokens',
  'temperature', 'top_p', 'top_k', 'min_p', 'seed', 'stop', 'frequency_penalty',
  'presence_penalty', 'logit_bias', 'logprobs', 'top_logprobs', 'n',
  'thinking', 'reasoning_effort', 'reasoning',
]);
const canonical = (value) => JSON.stringify(value, (_, part) =>
  part && typeof part === 'object' && !Array.isArray(part)
    ? Object.fromEntries(Object.keys(part).sort().map((key) => [key, part[key]])) : part);

function promptFingerprint(body, previous) {
  if (!Array.isArray(body.messages)) return { prompt: undefined, extendsPrevious: false };
  const rendering = hash(canonical(Object.fromEntries(Object.entries(body)
    .filter(([key]) => !NON_RENDERING_FIELDS.has(key)))));
  // A digest of the complete ordered prefix plus its message count suffices.
  // Hash each framed message incrementally; retain no text or per-message array,
  // even for a very long list. The existing request byte bound still applies.
  const digest = createHash('sha256');
  let prefix;
  if (previous?.count === 0) prefix = digest.copy().digest('hex');
  for (let i = 0; i < body.messages.length; i++) {
    digest.update(canonical(body.messages[i])).update('\n');
    if (i + 1 === previous?.count) prefix = digest.copy().digest('hex');
  }
  return {
    prompt: { rendering, messages: digest.digest('hex'), count: body.messages.length },
    extendsPrevious: !!previous && previous.rendering === rendering && previous.messages === prefix,
  };
}

// This adapter observes negotiated terminal metadata before the AI SDK parses
// it. Neither SDK preservation of unknown fields nor early response headers is
// relied on. Leases and conversation scopes stay in process memory only.
export function createSessionKVClient({
  baseURL, fetchImpl = globalThis.fetch, now = Date.now,
  maxSessions = 64, maxRequests = 128, allowLoopback = false,
} = {}) {
  const base = new URL(baseURL);
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash ||
      (base.protocol !== 'https:' && !(allowLoopback && loopback && base.protocol === 'http:'))) {
    throw new Error('Tenvor cache requires an exact HTTPS endpoint');
  }
  if (!positiveInteger(maxSessions) || maxSessions > 64 ||
      !positiveInteger(maxRequests) || maxRequests > 128) throw new Error('Invalid client bounds');
  const endpoint = base.origin + base.pathname.replace(/\/$/, '') + '/chat/completions';
  const sessions = new Map();
  const scopes = new Map();
  const requests = new Map();

  function forget(entry) {
    entry.lease = undefined;
    scopes.delete(entry.scope);
    for (const [key, request] of requests) if (request.entry === entry) requests.delete(key);
  }
  function clearSession(sessionID) {
    const entry = sessions.get(sessionID);
    if (entry) forget(entry);
    sessions.delete(sessionID);
  }
  function session(sessionID) {
    if (typeof sessionID !== 'string' || !sessionID || sessionID.length > 256) {
      throw new Error('Invalid client session');
    }
    let entry = sessions.get(sessionID);
    if (!entry) {
      if (sessions.size >= maxSessions) clearSession(sessions.keys().next().value);
      entry = { scope: randomBytes(32).toString('hex'), sequence: 0 };
      sessions.set(sessionID, entry);
      scopes.set(entry.scope, entry);
    }
    return entry;
  }
  function headersFor(sessionID) {
    const entry = session(sessionID);
    return {
      'X-Tenvor-Session-KV': 'v1',
      'X-Tenvor-Session-Scope': entry.scope,
      // One model invocation, including its transport retries, shares this ID.
      // The next invocation (including an automatic tool turn) gets a new ID.
      'Idempotency-Key': 'tenvor-kv-' + randomUUID(),
    };
  }
  function metadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid cache terminal');
    const required = ['version', 'disposition', 'status', 'reused_input_tokens', 'evaluated_input_tokens'];
    const allowed = new Set([...required, 'lease', 'idle_expires_at_unix_ms', 'absolute_expires_at_unix_ms']);
    if (required.some((key) => !(key in value)) || Object.keys(value).some((key) => !allowed.has(key)) ||
        value.version !== 1 || !['retained', 'erased', 'quarantined'].includes(value.disposition) ||
        !['cold', 'reused', 'fallback'].includes(value.status) ||
        !count(value.reused_input_tokens) || !count(value.evaluated_input_tokens) ||
        value.reused_input_tokens + value.evaluated_input_tokens > 65_536 ||
        (value.status !== 'reused' && value.reused_input_tokens !== 0) ||
        (value.status === 'reused' && value.reused_input_tokens === 0)) throw new Error('Invalid cache terminal');
    if (value.disposition === 'retained') {
      if (!LEASE.test(value.lease) || !positiveInteger(value.idle_expires_at_unix_ms) ||
          !positiveInteger(value.absolute_expires_at_unix_ms) ||
          value.idle_expires_at_unix_ms > value.absolute_expires_at_unix_ms) throw new Error('Invalid cache lease');
    } else if ('lease' in value || 'idle_expires_at_unix_ms' in value || 'absolute_expires_at_unix_ms' in value) {
      throw new Error('Unexpected cache lease');
    }
    return value;
  }
  function clearRequest(request) {
    if (request.entry.sequence === request.sequence) request.entry.lease = undefined;
    // A harness retry keeps the invocation identity, but must not resend a
    // refused/spent lease saved on that invocation. We never create a retry or a
    // new key: the server may replay the canceled job for the original key.
    request.lease = undefined;
    request.prompt = undefined;
    request.failed = true;
  }
  function commit(request, value) {
    // Replayed terminal metadata cannot extend either deadline or resurrect a
    // lease. A delayed older request cannot replace a newer invocation's state.
    if (request.completed || request.failed) return;
    request.completed = true;
    if (request.entry.sequence !== request.sequence) return;
    request.entry.lease = undefined;
    if (!value || value.disposition !== 'retained' ||
        value.idle_expires_at_unix_ms <= now() || value.absolute_expires_at_unix_ms <= now()) return;
    if (value.status === 'reused' && (!request.lease || value.absolute_expires_at_unix_ms > request.lease.absolute)) {
      throw new Error('Cache absolute origin moved');
    }
    request.entry.lease = {
      token: value.lease, idle: value.idle_expires_at_unix_ms, absolute: value.absolute_expires_at_unix_ms,
      prompt: request.prompt,
    };
  }
  async function fetchWithKV(input, init) {
    const original = new Request(input, init);
    if (original.url !== endpoint || original.method !== 'POST') {
      throw new Error('Tenvor cache transport endpoint mismatch');
    }
    const headers = new Headers(original.headers);
    const scope = headers.get('X-Tenvor-Session-Scope');
    const entry = scopes.get(scope);
    if (headers.get('X-Tenvor-Session-KV') !== 'v1' || !SCOPE.test(scope ?? '') || !entry) {
      throw new Error('Missing Tenvor client session');
    }
    const identity = headers.get('Idempotency-Key');
    if (!identity || identity.length > 128) throw new Error('Missing invocation identity');
    const credential = headers.get('Authorization');
    if (!credential?.startsWith('Bearer ') || credential.length > 8192) throw new Error('Missing provider authentication');
    const credentialDigest = hash(credential);
    if (entry.credential && entry.credential !== credentialDigest) {
      forget(entry);
      entry.scope = randomBytes(32).toString('hex');
      scopes.set(entry.scope, entry);
      headers.set('X-Tenvor-Session-Scope', entry.scope);
    }
    entry.credential = credentialDigest;
    const raw = await original.text();
    if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) throw new Error('Client request exceeds bound');
    const body = JSON.parse(raw);
    if (body.model !== 'chat-35b-moe' || body.stream !== true) throw new Error('Unsupported cache request');
    const fingerprint = hash(raw);
    const key = entry.scope + ':' + identity;
    let request = requests.get(key);
    if (request && (request.fingerprint !== fingerprint || request.credential !== credentialDigest)) {
      throw new Error('Invocation identity reused for different request');
    }
    if (!request) {
      if (requests.size >= maxRequests) requests.delete(requests.keys().next().value);
      const { prompt, extendsPrevious } = promptFingerprint(body, entry.lease?.prompt);
      const lease = extendsPrevious && entry.lease.idle > now() && entry.lease.absolute > now() ? entry.lease : undefined;
      request = { entry, sequence: ++entry.sequence, fingerprint, credential: credentialDigest, lease, prompt };
      requests.set(key, request);
      entry.lease = undefined;
    }
    headers.delete('X-Tenvor-Session-Lease');
    if (request.lease) headers.set('X-Tenvor-Session-Lease', request.lease.token);
    body.stream_options = { ...body.stream_options, include_usage: true };
    let response;
    try {
      response = await fetchImpl(original.url, {
        method: 'POST', headers, body: JSON.stringify(body), signal: original.signal, redirect: 'error',
      });
    } catch (error) { clearRequest(request); throw error; }
    if (!response.ok || !response.body ||
        response.headers.get('content-type')?.split(';')[0].trim() !== 'text/event-stream') {
      clearRequest(request);
      return response;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let pending = '', eventLines = [], eventBytes = 0, totalBytes = 0;
    let terminal, finished = false, done = false, finishReason;
    let holdingToolStream = false;
    const deferredChunks = [];
    const toolCalls = new Map();
    function checkToolCalls(reason) {
      if (!toolCalls.size) return;
      if (reason === 'length') throw new Error('Tenvor tool call was cut off by the output limit; the model turn may have been charged, but no tool should be executed');
      if (reason !== 'tool_calls') throw new Error('Tenvor tool call ended without tool completion; the model turn may have been charged');
      for (const call of toolCalls.values()) {
        if (!call.id || !call.name) throw new Error('Tenvor tool call identity is incomplete; the model turn may have been charged');
        let args;
        try { args = JSON.parse(call.arguments); } catch {
          throw new Error('Tenvor tool call arguments are incomplete; the model turn may have been charged, but no tool should be executed');
        }
        if (!args || typeof args !== 'object' || Array.isArray(args)) {
          throw new Error('Tenvor tool call arguments are not a JSON object; the model turn may have been charged');
        }
      }
    }
    function consumeEvent() {
      const data = eventLines.join('\n');
      eventLines = [];
      eventBytes = 0;
      if (!data) return;
      if (done) throw new Error('Data after stream completion');
      if (data === '[DONE]') {
        if (!finished) throw new Error('Missing successful terminal');
        checkToolCalls(finishReason);
        done = true;
        commit(request, terminal);
        return;
      }
      const event = JSON.parse(data);
      if (event.error) throw new Error('Upstream stream error');
      if ('tenvor_session_kv' in event) {
        if (terminal) throw new Error('Duplicate cache terminal');
        terminal = metadata(event.tenvor_session_kv);
      }
      if (finished && event.choices?.length) throw new Error('Choice data after successful terminal');
      for (const choice of event.choices ?? []) {
        if (choice.index !== 0) throw new Error('Invalid choice index');
        for (const delta of choice.delta?.tool_calls ?? []) {
          // A streamed tool call is provisional until its full JSON and the
          // authoritative terminal have arrived. Keep its bytes out of the SDK
          // so a failed turn cannot leave a pending tool part in the session.
          holdingToolStream = true;
          if (!Number.isSafeInteger(choice.index) || !Number.isSafeInteger(delta.index) || delta.index < 0) {
            throw new Error('Invalid tool call index');
          }
          const key = `${choice.index}:${delta.index}`;
          if (!toolCalls.has(key) && toolCalls.size >= 128) throw new Error('Too many tool calls');
          let call = toolCalls.get(key);
          if (!call) {
            if (typeof delta.id !== 'string' || !delta.id || delta.type !== 'function') {
              throw new Error('Invalid tool call start');
            }
            call = { id: delta.id, name: '', arguments: '' };
          } else if (delta.id !== undefined || delta.type !== undefined) {
            throw new Error('Duplicate tool call identity');
          }
          if (delta.function?.name !== undefined) {
            if (typeof delta.function.name !== 'string') throw new Error('Invalid tool call name');
            call.name += delta.function.name;
            if (call.name.length > 64) throw new Error('Tool call name exceeds bound');
          }
          if (delta.function?.arguments !== undefined) {
            if (typeof delta.function.arguments !== 'string') throw new Error('Invalid tool call arguments');
            call.arguments += delta.function.arguments;
            if (Buffer.byteLength(call.arguments) > MAX_EVENT_BYTES) throw new Error('Tool call arguments exceed bound');
          }
          toolCalls.set(key, call);
        }
        if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
          if (!['stop', 'tool_calls', 'length'].includes(choice.finish_reason)) throw new Error('Unsuccessful terminal');
          if (choice.finish_reason === 'tool_calls' && !toolCalls.size) throw new Error('Tool terminal without a tool call');
          checkToolCalls(choice.finish_reason);
          finishReason = choice.finish_reason;
          finished = true;
        }
      }
    }
    function consumeText(text) {
      pending += text;
      for (;;) {
        const pos = pending.indexOf('\n');
        if (pos < 0) break;
        const line = pending.slice(0, pos).replace(/\r$/, '');
        pending = pending.slice(pos + 1);
        eventBytes += Buffer.byteLength(line) + 1;
        if (eventBytes > MAX_EVENT_BYTES) throw new Error('Stream event exceeds bound');
        if (!line) consumeEvent();
        else if (line.startsWith('data:')) eventLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (Buffer.byteLength(pending) + eventBytes > MAX_EVENT_BYTES) throw new Error('Stream event exceeds bound');
    }
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) {
              consumeText(decoder.decode());
              if (!done || pending || eventLines.length) throw new Error('Incomplete upstream stream');
              for (const held of deferredChunks) controller.enqueue(held);
              controller.close();
              return;
            }
            totalBytes += chunk.value.byteLength;
            if (totalBytes > MAX_STREAM_BYTES) throw new Error('Stream exceeds bound');
            consumeText(decoder.decode(chunk.value, { stream: true }));
            if (holdingToolStream) {
              if (deferredChunks.length >= MAX_DEFERRED_CHUNKS) throw new Error('Tool stream is too fragmented');
              deferredChunks.push(chunk.value.slice());
              continue;
            }
            controller.enqueue(chunk.value);
            return;
          }
        } catch (error) {
          clearRequest(request);
          await reader.cancel().catch(() => {});
          controller.error(error);
        }
      },
      async cancel(reason) { clearRequest(request); await reader.cancel(reason); },
    });
    return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  return { headersFor, fetch: fetchWithKV, clearSession, clear: () => {
    for (const entry of sessions.values()) forget(entry);
    sessions.clear(); requests.clear();
  } };
}


// Install explicitly in the OpenCode project config. Once installed, this plugin
// opts matching Tenvor sessions in by default; enabled: false opts out. The
// provider's normal API key stays managed by OpenCode.
export const TenvorSessionKVPlugin = async (_input, options = {}) => {
  if (options.enabled === false) return {};
  const transport = createSessionKVClient({ baseURL: options.baseURL, allowLoopback: options.allowLoopback === true });
  let configured = false;
  return {
    // OpenCode only calls auth.loader when it has an auth.json entry. The
    // installer uses provider.options.apiKey={file:tenvor-api-key}, so attach
    // the same guarded transport to that provider before its SDK is created.
    config: async (config) => {
      configured = false;
      const provider = config.provider?.tenvor;
      if (!provider) return;
      if (provider.npm !== '@ai-sdk/openai-compatible' ||
          provider.options?.baseURL !== options.baseURL ||
          (provider.options.fetch && provider.options.fetch !== transport.fetch)) {
        throw new Error('Tenvor cache provider configuration differs from the reviewed endpoint');
      }
      provider.options.fetch = transport.fetch;
      configured = true;
    },
    auth: { provider: 'tenvor', methods: [], loader: async () => ({ fetch: transport.fetch }) },
    'chat.headers': async (input, output) => {
      if (input.model.providerID !== 'tenvor' || input.model.id !== 'chat-35b-moe') return;
      if (!configured) throw new Error('Tenvor guarded transport was not installed');
      Object.assign(output.headers, transport.headersFor(input.sessionID));
    },
    event: async ({ event }) => {
      if (event.type === 'session.deleted') transport.clearSession(event.properties.info.id);
    },
    dispose: async () => transport.clear(),
  };
};
