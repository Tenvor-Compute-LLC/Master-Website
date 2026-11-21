export type Stat = { value: string; label: string; accent?: boolean };

export const stats: Stat[] = [
  { value: "$0.126", label: "Input per 1M tokens", accent: true },
  { value: "$0.00", label: "Billed for failed requests" },
  { value: "35+", label: "Tokens a second, tested" },
  { value: "10 GB+", label: "NVIDIA memory to run a node" },
];
