// Text of https://tenvor.io/models (captured 2026-11-20), word for word, split by section.
export const head = {
  kicker: "Models · 1 live",
  title: "Open models, one API.",
  intro: "Call any model below by its id, with the OpenAI SDK you already use. New open models are added as they're released.",
};

export const live = {
  name: "Qwen 3.6 35B",
  id: "chat-35b-moe",
  text: "A mixture-of-experts model: 35 billion parameters, 3 billion of them active for each token.",
  tags: ["64K context", "tools", "reasoning", "streaming", "4-bit · Q4_K_XL", "Apache-2.0"],
  prices: [["$0.126", "Input"], ["$0.063", "Cached input"], ["$0.81", "Output"]],
  per: "per million tokens · minimum $0.000134 a request",
  rows: [["Parameters", "35B · 3B active"], ["In Chat & Work", "Tenvor-35B"]],
};

export const next = {
  name: "Qwen 4 27B",
  status: "Coming at launch",
  text: "The next model on the network, prepared for launch day: Qwen 4 at 27 billion parameters, with a long context and multi-token prediction for speed.",
  specs: [["Weights", "Q4_K_XL", "Unsloth's quantisation"], ["Context", "128K", "tokens"], ["Decoding", "MTP", "multi-token prediction"], ["Speed", "50 tok/s", "baseline"]],
  note: "Its model id and prices are announced at launch.",
};

export const use = {
  title: "Swap the base URL.",
  text: "Point any OpenAI client at Tenvor and pass the model id. Streaming, function tools and reasoning are all supported.",
  file: "hello.py",
  code: [
    "# the OpenAI SDK, pointed at Tenvor",
    "client = OpenAI(base_url=\"https://orchestrator.tenvor.io/v1\",",
    "                api_key=os.environ[\"TENVOR_API_KEY\"])",
    "reply = client.chat.completions.create(",
    "    model=\"chat-35b-moe\",",
    "    messages=[{\"role\": \"user\", \"content\": \"Hello!\"}],",
    ")",
  ],
};
