// Text of https://tenvor.io/chat (captured 2026-11-20), word for word, split by section.
export const CONSOLE = "https://tenvor.io/console";

export const hero = {
  title: "Chat that can do the work.",
  start: "Live now. No card needed. $0.25 of free credit to start.",
};

/** The sample conversation the source shows as a picture (described in its caption). */
export const sample = {
  ask: "Explain a graphics card to a ten-year-old.",
  model: "Tenvor-35B",
  reply: "A graphics card is the part of a computer that draws the picture. It does lots of small sums at the same time. An AI needs the same kind of sums, so a PC with a good graphics card can run one.",
  receipt: [["charge", "$0.000196"], ["prompt", "1,224 tokens"], ["completion", "52 tokens"]],
  note: "You pay per token (roughly, pieces of words): about 5,100 replies like this for $1.",
};

export const modes = {
  side: "One workspace. You pick the mode when you start a conversation.",
  cards: [
    { id: "mode-chat", name: "Chat", tag: "For questions", lead: "A conversation that is saved.", points: ["It can search the web and read public pages.", "You can attach text files."] },
    { id: "mode-work", name: "Work", tag: "For files and code", lead: "Everything in Chat, plus a throwaway sandbox.", points: ["It can run Python or shell commands on files you upload.", "It gives you back the files it makes."] },
  ],
};

export const cost = {
  text: "Monthly plans and card payments are not open yet. On a plan, chat comes with its own weekly messages. New accounts start with $0.25.",
  rows: [
    ["A short message", "about $0.0002"],
    ["A web search", "about $0.007"],
    ["Sandbox time", "$0.000046 per second"],
    ["Spend cap per task", "$0.10 on free credit, $0.25 otherwise; you can change it in Work"],
  ],
};

export const limits = {
  title: "You stay in control of each task.",
  text: "A task stops at its spend cap or after 10 minutes, whichever comes first. As it nears a limit, it is asked for a final answer without using tools.",
  items: [["10", "minutes"], ["20", "web lookups"], ["30", "commands of 60 seconds each"]],
};

export const model = {
  title: "Tenvor-35B, routed to the best machine.",
  text: "Tenvor-35B is Qwen 3.6 35B, an open model (one anyone can download). A node is a GPU machine on the network, tested and enrolled before it gets work.",
  data: "Requests are not yet encrypted on the node that runs them, so keep sensitive material out during the alpha.",
};

export const close = {
  title: "Bring a question, or a file.",
  text: "Chat & Work, a workspace in your browser. Ask questions, search the web, or hand it files to work on.",
};
