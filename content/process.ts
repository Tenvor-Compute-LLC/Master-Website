export type Step = { when: string; title: string; body: string };

export const steps: Step[] = [
  { when: "No card", title: "Sign up", body: "No card is needed, and a new account starts with $0.25 of free credit." },
  { when: "Console", title: "Get a key", body: "Create an API key on the API keys page in the Console. The key is shown once." },
  { when: "OpenAI SDK", title: "Change the base URL", body: "Point your SDK at orchestrator.tenvor.io/v1, then send one request." },
  { when: "Every request", title: "Get a receipt", body: "Tenvor routes it to a tested node, runs it in a sealed container and returns an itemised receipt." },
];
