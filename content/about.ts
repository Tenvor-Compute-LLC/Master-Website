// All About-section text lives here so it can be edited without touching the component.
export type StoryStep = { title: string; body: string };
export type Member = {
  name: string;
  role: string;
  line: string;
  initials: string;
  /** Path under /public, e.g. "/img/team-benjamin-bean.jpg". Empty shows the initials placeholder. */
  photo: string;
  /** Full LinkedIn URL. Empty hides the button. */
  linkedin: string;
  /** Full X (Twitter) URL. Empty hides the button. */
  x: string;
  /** Optional short quote in the person's own words. Empty hides it; only fill with a quote they approved. */
  quote: string;
};

export const about = {
  num: "07",
  eyebrow: "About",
  title: "Open models, on the GPUs the world already has.",
  side: "Why we are building Tenvor, and the people building it.",
  storyLabel: "Our story",
  story: [
    { title: "The gap", body: "Across the world, capable GPUs sit idle in gaming PCs and workstations, while teams pay a premium and wait in line for scarce cloud capacity." },
    { title: "The shift", body: "Open models are now good enough for real work. The hard part is no longer the model. It is finding the compute and running it safely." },
    { title: "The layer", body: "Tenvor is one orchestration layer that runs open models across distributed GPUs, each job in a sealed container, so anyone can start free with no card." },
  ] as StoryStep[],
  teamLabel: "The team",
  teamLead: "A small founding team building the orchestration layer for open models.",
  team: [
    { name: "Benjamin Lean", role: "Founder", line: "Sets the vision and direction for Tenvor.", initials: "BL", photo: "/img/team-benjamin-lean.jpg", linkedin: "https://www.linkedin.com/in/benjamin-lean", x: "", quote: "" },
    { name: "Vishva Patel", role: "CTO & CISO", line: "Leads the platform, engineering and security.", initials: "VP", photo: "/img/team-vishva-patel.jpg", linkedin: "https://www.linkedin.com/in/vishva-vp", x: "", quote: "" },
  ] as Member[],
};
