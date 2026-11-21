# Tenvor alpha client checklist

A plain-text copy of the first-request steps and the template for reporting a
problem, for pasting into notes or an email. The guides at
https://tenvor.io/docs are the source. Where this page and a guide differ,
the guide is right.

Tenvor is in alpha. Capacity is limited, and
there is no uptime or latency SLA. Your request runs in a sealed container with
no internet access. That is sandboxing, not encryption: requests are not yet
cryptographically protected on the node that runs them. Use Tenvor for work
that is not sensitive. Requests are never logged or kept.

## First request

1. Sign up on https://tenvor.io. No card is needed, and a new account starts
   with $0.25 of free credit.
2. In the Console (https://tenvor.io/console), open API keys and create a key.
   It starts with `sk-dc-`. It is shown once, and Tenvor cannot show it again.
   Tenvor may ask you to verify it is you again first.
3. Put the key in an environment variable named `TENVOR_API_KEY`. Keep it out of
   source code, URLs, screenshots and chat messages. A key can spend your
   balance.
4. Point your OpenAI client at `https://orchestrator.tenvor.io/v1`, use the
   model `chat-35b-moe`, and send one request:

   ```bash
   curl https://orchestrator.tenvor.io/v1/chat/completions \
     -H "Authorization: Bearer $TENVOR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "chat-35b-moe", "messages": [{"role": "user", "content": "Say hello in one line."}]}'
   ```

   The curl sample is for a Bash shell: macOS, Linux or Git Bash. In Windows
   PowerShell, `curl` is a different command, so use the Python or Node sample
   there.

5. Read the response. `usage` counts tokens, and `billing` is the itemised
   receipt of that request: tokens in, tokens out and the charge. A streamed
   response ends with token usage instead.

## Before you rely on it

- The model, its limits and the prices are on https://tenvor.io/models and
  https://tenvor.io/pricing. They change, so check them there.
- If a request fails on a node before any output is sent, Tenvor may retry it
  once on another node, if one is free. You are not charged for the attempt that
  failed. If a request fails on a node after output has started, you are not
  charged and it is not retried. A request that you cancel, or that stops at
  your own output limit, can be charged for its input and the output it
  generated.
- Prefer streaming for long replies. Without streaming, the server waits up to
  4,100 seconds for the result and then allows 10 seconds to write it. A broken
  connection does not prove failure or no charge. The official OpenAI SDKs retry a
  dropped connection by default, and with no `Idempotency-Key` each retry is a
  new request that is billed too. If you cannot stream, turn retries off
  (`max_retries=0` in Python, `maxRetries: 0` in Node).
- Without an `Idempotency-Key`, each POST is a new, billable request.

## If a request fails

Start with the HTTP status and the error code. Each one is explained at
https://tenvor.io/docs/troubleshooting. The common ones:

- 400 `unknown_parameter`, `invalid_value` and the other 400 codes: the request
  has a field or value the API does not accept, or the messages are out of
  order. `error.param` names the field. Compare your body with the list of what
  works today.
- 401 `missing_api_key`: no `Authorization` header reached Tenvor.
- 401 `invalid_api_key`: the key is wrong, revoked or disabled.
- 402 `insufficient_quota`: the available balance cannot cover the request.
  Check the Billing page of the Console.
- 429 `rate_limit_error`: wait for the `Retry-After` seconds.
- 503 `stream_unavailable`: Tenvor could not take the request just now. A 503
  does not show whether a charge was made: check the Usage page.
- 503 `capacity_queue_expired`: no node was free in time. Wait for `Retry-After`.
- 503 `no_node_available`: no node that can serve the model is online, so the
  request did not reach a node. Wait for `Retry-After`.

Before you send a request again, check the Usage page of the Console. If it
shows a charge, the request ran.

## Keys

If a key leaks, or you no longer need it, revoke it on the API keys page of the
Console and create a new one. A revoked key stops working at once. Do not paste
a key into a message, an issue or a screenshot.

To remove Pi's local Tenvor setup, run `bash tenvor-pi.sh --remove`. To remove
OpenCode's, run `bash tenvor-opencode.sh --remove`.
On Windows, run `& ([scriptblock]::Create((irm https://tenvor.io/setup/pi.ps1))) --remove`
in PowerShell, or `tenvor-pi.cmd --remove` in Command Prompt; for OpenCode, the
same with `opencode` in place of `pi`.
That does not revoke the key on Tenvor. Use the Console for that.

## Sanitized result template

Fill in only these fields when you write to support@tenvor.io. Do not attach
prompts, generated text, tool arguments, files, terminal output, headers, your
key, or screenshots that show any of them.

```text
Date and time (approximate, with your time zone):
Client and version, or SDK:
Model:
HTTP status and error code:
Does the Usage page show a charge for it: yes / no / not sure
What you expected, and what happened:
Short steps to reproduce, with made-up placeholder text only:
```

If a person at Tenvor needs the `X-Request-Id`, they will ask for it.
