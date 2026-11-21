import type { CSSProperties, ReactNode } from "react";

// Card visuals for Guides and Use cases: one isometric scene per card, drawn in SVG on a 140x140 deck.
// Light comes from the top left (top faces lightest, front-left faces darkest). Base styles are the final frame
// (what prefers-reduced-motion shows); .art.on (set by PageEffects while in view) plays the motion, hover replays it.
export type Art = "request" | "setup" | "receipt" | "agent" | "failover" | "node";

const at = (t: number) => ({ "--t": `${t}s` }) as CSSProperties;

// isometric projection of deck point (x, y, z) into the SVG viewBox
const P = (x: number, y: number, z: number) => `${(170 + (x - y) * 0.866).toFixed(1)},${(78 + (x + y) * 0.5 - z).toFixed(1)}`;
const path = (pts: [number, number, number][]) => "M" + pts.map(p => P(...p)).join("L");
const ring = (cx: number, cy: number, z: number, r: number) => Array.from({ length: 24 }, (_, i) => P(cx + r * Math.cos(i * Math.PI / 12), cy + r * Math.sin(i * Math.PI / 12), z)).join(" ");
// text drawn flat on a front-left face (the plane y = const) or on a top face (z = const), from point (x, y, z)
const onFace = (x: number, y: number, z: number) => `matrix(.866 .5 0 1 ${P(x, y, z).replace(",", " ")})`;
const onTop = (x: number, y: number, z: number) => `matrix(.866 .5 -.866 .5 ${P(x, y, z).replace(",", " ")})`;

function Box({ x, y, z, w, d, h, c = "" }: { x: number; y: number; z: number; w: number; d: number; h: number; c?: string }) {
  const t = z + h;
  return <g className={`iso__box ${c}`}>
    <polygon className="iso__r" points={[P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, t), P(x + w, y, t)].join(" ")} />
    <polygon className="iso__l" points={[P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, t), P(x, y + d, t)].join(" ")} />
    <polygon className="iso__t" points={[P(x, y, t), P(x + w, y, t), P(x + w, y + d, t), P(x, y + d, t)].join(" ")} />
  </g>;
}

// a glowing light trail with one bright pulse running along it
function Trail({ d, t = 0, c = "" }: { d: string; t?: number; c?: string }) {
  return <g className={c}><path d={d} className="iso__trail iso__trail--blur" filter="url(#iso-glow)" /><path d={d} className="iso__trail" /><path d={d} pathLength={1} className="iso__run" style={at(t)} /></g>;
}

function Lbl({ s, p: [x, y, z], c = "" }: { s: string; p: [number, number, number]; c?: string }) {
  return <g className={`iso__lbl ${c}`} transform={`translate(${P(x, y, z)})`}><rect x={-s.length * 2.4 - 6} y="-7" width={s.length * 4.8 + 12} height="13" rx="6.5" /><text textAnchor="middle" y="2.4">{s}</text></g>;
}

const Fans = ({ xs, y, z, r = 11 }: { xs: number[]; y: number; z: number; r?: number }) =>
  <>{xs.map(cx => <g key={cx}><polygon className="iso__fan" points={ring(cx, y, z, r)} /><polygon className="iso__hub" points={ring(cx, y, z, r * 0.32)} /></g>)}</>;

// a laptop: base w x 26 at (x, y), screen standing at its back with up to three lines of text
function Laptop({ x, y, w, lines }: { x: number; y: number; w: number; lines: ReactNode[] }) {
  return <>
    <Box x={x} y={y} z={6} w={w} d={26} h={3} />
    <Box x={x} y={y} z={9} w={w} d={3} h={28} c="iso__scr" />
    <g transform={onFace(x + 3, y + 3, 33)} className="iso__txt">{lines.map((l, i) => <text key={i} y={i * 7.5}>{l}</text>)}</g>
  </>;
}

// a GPU node: a tower with fans on top and status lights on its front
function Node({ x, y, w, d, h, c = "" }: { x: number; y: number; w: number; d: number; h: number; c?: string }) {
  return <g className={c}>
    <Box x={x} y={y} z={6} w={w} d={d} h={h} c="iso__pc" />
    <Fans xs={[x + w * 0.3, x + w * 0.7]} y={y + d / 2} z={6 + h} r={Math.min(w, d) * 0.2} />
    {[0.35, 0.6].map(f => <path key={f} className="iso__led" d={path([[x + 4, y + d, 6 + h * f], [x + w - 4, y + d, 6 + h * f]])} style={at(f * 2)} />)}
  </g>;
}

function Scene({ children }: { children: ReactNode }) {
  return (
    <div className="iso" aria-hidden>
      <svg viewBox="40 -6 280 232">
        <defs><filter id="iso-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.6" /></filter></defs>
        <Box x={0} y={0} z={0} w={140} d={140} h={6} c="iso__deck" />
        {[20, 40, 60, 80, 100, 120].map(n => <g key={n} className="iso__grid"><path d={path([[n, 0, 6], [n, 140, 6]])} /><path d={path([[0, n, 6], [140, n, 6]])} /></g>)}
        {children}
      </svg>
    </div>
  );
}

const NODE_TRAILS = [
  path([[4, 140, 6], [4, 104, 6], [78, 104, 6], [78, 78, 6]]),
  path([[140, 128, 6], [108, 128, 6], [108, 78, 6]]),
  path([[140, 20, 6], [96, 20, 6], [96, 30, 6]]),
  path([[58, 52, 22], [66, 52, 22]]),
];

const scenes: Record<Art, ReactNode> = {
  // your PC as a node: tower with a glass side, GPU in a sealed container, network cut
  node: <>
    {NODE_TRAILS.map((d, i) => <Trail key={i} d={d} t={i * 0.7} />)}
    <Box x={16} y={14} z={6} w={30} d={66} h={88} c="iso__pc" />
    <polygon className="iso__glass" points={[P(46, 22, 22), P(46, 72, 22), P(46, 72, 86), P(46, 22, 86)].join(" ")} />
    {[30, 42, 54].map(z => <path key={z} className="iso__led" d={path([[46, 28, z + 8], [46, 66, z + 8]])} style={at(z / 40)} />)}
    <path className="iso__led" d={path([[16, 80, 12], [46, 80, 12]])} />
    <Box x={66} y={30} z={6} w={64} d={46} h={30} c="iso__seal" />
    <Box x={72} y={38} z={6} w={52} d={30} h={9} c="iso__gpu" />
    <path className="iso__led" d={path([[72, 68, 11], [124, 68, 11]])} />
    <Fans xs={[85, 111]} y={53} z={15} />
    <path className="iso__net" d={path([[130, 53, 22], [160, 53, 22]])} />
    <Lbl s="your PC" p={[2, 72, 120]} />
    <Lbl s="NVIDIA GPU" p={[120, 100, 6]} />
    <Lbl s="sealed container" p={[128, 8, 46]} c="is-on" />
    <Lbl s="network: none" p={[168, 72, 8]} c="is-on" />
    <path className="iso__x" d={`M${P(147, 53, 27)}L${P(143, 53, 17)}M${P(143, 53, 27)}L${P(147, 53, 17)}`} />
  </>,

  // coding agent: a monitor running tenvor-agent, every tool call passes an approval gate on its way to the node
  agent: <>
    <Trail d={path([[46, 62, 6], [46, 84, 6], [116, 84, 6], [116, 58, 6]])} />
    <Trail d={path([[132, 40, 6], [138, 40, 6], [138, 116, 6], [22, 116, 6], [22, 62, 6]])} t={1.4} c="iso__dim" />
    <Box x={34} y={30} z={6} w={12} d={6} h={14} />
    <Box x={2} y={26} z={20} w={74} d={5} h={50} c="iso__scr" />
    <g transform={onFace(6, 31, 64)} className="iso__txt">
      <text><tspan className="a">$ </tspan>opencode --agent</text>
      <text y="7.5">  tenvor-agent</text>
      <text y="16" className="iso__in" style={at(0.6)}><tspan className="a">&gt; </tspan>make reply() stream</text>
      <text y="24" className="iso__in" style={at(1.2)}>edit src/api.ts?</text>
      <g className="iso__in iso__btn" style={at(1.8)}><rect y="28" width="22" height="9" rx="2" /><text x="11" y="34.4" textAnchor="middle">Allow</text></g>
      <text x="28" y="34.4" className="iso__in" style={at(1.8)}>Deny</text>
    </g>
    <Box x={12} y={42} z={6} w={56} d={18} h={3} />
    {[48, 54].map(y => <path key={y} className="iso__key" d={path([[16, y, 9], [64, y, 9]])} />)}
    <Node x={100} y={16} w={32} d={42} h={44} />
    <Box x={74} y={78} z={6} w={14} d={12} h={16} c="iso__gate" />
    <path className="iso__ok" d={path([[77, 90, 15], [80, 90, 12], [85, 90, 19]])} />
    <Lbl s="tenvor-agent" p={[40, 26, 84]} />
    <Lbl s="asks before every tool call" p={[81, 84, 34]} c="is-on" />
    <Lbl s="chat-35b-moe" p={[116, 37, 66]} />
    <Lbl s="cached input $0.063 / 1M" p={[80, 116, 6]} />
  </>,

  // OpenCode setup: one command in a terminal, the OpenCode package lands on the deck
  setup: <>
    <Trail d={path([[48, 46, 6], [48, 94, 6], [96, 94, 6]])} t={0.8} />
    <Box x={4} y={40} z={6} w={90} d={6} h={62} c="iso__scr" />
    <g transform={onFace(9, 46, 61)} className="iso__txt">
      <text><tspan className="a">$ </tspan>curl -fsS …/opencode.sh \</text>
      <text y="8">  -o tenvor-opencode.sh &amp;&amp; \</text>
      <text y="16">  bash tenvor-opencode.sh</text>
      <text y="27" className="iso__in" style={at(1)}><tspan className="ok">✓ </tspan>installed OpenCode 1.19.0</text>
      <text y="35" className="iso__in" style={at(1.5)}><tspan className="ok">✓ </tspan>added provider tenvor</text>
      <text y="43" className="iso__in" style={at(2)}><tspan className="ok">✓ </tspan>added agent tenvor-agent</text>
    </g>
    <g className="iso__drop" style={at(0.4)}>
      <Box x={96} y={78} z={6} w={32} d={32} h={28} c="iso__pkg" />
      <path className="iso__tape" d={path([[112, 78, 34], [112, 110, 34]])} />
      <path className="iso__tape" d={path([[112, 110, 34], [112, 110, 22]])} />
    </g>
    <Lbl s="one command" p={[48, 40, 82]} c="is-on" />
    <Lbl s="OpenCode 1.19.0" p={[112, 94, 50]} />
    <Lbl s="asks before every tool call" p={[52, 126, 6]} />
  </>,

  // chat app failover: the request drops on one node, is retried once on a free node; the failed try costs $0.00
  failover: <>
    <Trail d={path([[48, 70, 6], [70, 70, 6], [70, 23, 6], [96, 23, 6]])} c="iso__bad" />
    <Trail d={path([[70, 70, 6], [70, 111, 6], [96, 111, 6]])} t={1.1} />
    <Laptop x={4} y={58} w={44} lines={[<><tspan key="a" className="a">POST </tspan>/v1/chat</>, "stream: true"]} />
    <Node x={96} y={6} w={34} d={34} h={34} c="iso__dead" />
    <path className="iso__x" d={`M${P(108, 23, 60)}L${P(118, 23, 50)}M${P(108, 23, 50)}L${P(118, 23, 60)}`} />
    <Node x={96} y={94} w={34} d={34} h={34} />
    <Lbl s="your app" p={[26, 58, 52]} />
    <Lbl s="dropped, no output" p={[113, 23, 62]} c="is-bad" />
    <Lbl s="failed try $0.00" p={[84, 40, 6]} c="is-on" />
    <Lbl s="retried once on a free node" p={[140, 111, 6]} />
  </>,

  // quickstart: five steps lead one request to one node, the reply ends in a receipt
  request: <>
    <Trail d={path([[50, 74, 6], [84, 74, 6], [84, 33, 6], [100, 33, 6]])} />
    <Trail d={path([[116, 56, 6], [116, 96, 6]])} t={1.4} />
    <Laptop x={4} y={62} w={46} lines={[<><tspan key="a" className="a">POST </tspan>/v1/chat</>, "chat-35b-moe"]} />
    {([[60, 74], [74, 74], [84, 62], [84, 48], [94, 33]] as const).map(([x, y], i) => <g key={i} className="iso__step" style={at(i * 0.5)}>
      <Box x={x - 4.5} y={y - 4.5} z={6} w={9} d={9} h={2} />
      <text transform={onTop(x, y, 8)} textAnchor="middle" y="2">{i + 1}</text>
    </g>)}
    <Node x={100} y={14} w={32} d={42} h={40} />
    <Box x={100} y={96} z={6} w={36} d={1} h={48} c="iso__paper" />
    <g transform={onFace(103, 97, 47)} className="iso__txt iso__txt--ink">
      <text className="b">Receipt</text>
      <text y="9">tokens in</text><text x="30" y="9" textAnchor="end">14</text>
      <text y="17">tokens out</text><text x="30" y="17" textAnchor="end">9</text>
      <text y="29" className="a">≈ $0.000009</text>
    </g>
    <Lbl s="5 steps" p={[78, 92, 6]} c="is-on" />
    <Lbl s="chat-35b-moe" p={[116, 35, 62]} />
    <Lbl s="receipt" p={[118, 110, 6]} />
  </>,

  // billing: an itemised receipt prints from the request, one receipt per request
  receipt: <>
    <Trail d={path([[140, 30, 6], [104, 30, 6], [104, 56, 6], [86, 56, 6]])} t={0.2} />
    {[0, 1, 2].map(i => <Box key={i} x={98 + i * 2} y={70 + i * 3} z={6 + i * 2} w={30} d={40} h={1} c="iso__paper" />)}
    <Box x={12} y={44} z={6} w={74} d={40} h={22} c="iso__pc" />
    <path className="iso__slot" d={path([[18, 64, 28], [80, 64, 28]])} />
    <Box x={19} y={63} z={28} w={60} d={1} h={84} c="iso__paper" />
    <g transform={onFace(23, 64, 108)} className="iso__txt iso__txt--ink">
      <text className="b">Receipt</text><text x="53" textAnchor="end" className="s">chat-35b-moe</text>
      {[["input 14", "$0.0000018"], ["cached 0", "$0.0000000"], ["output 9", "$0.0000073"], ["failed try", "$0.00"]].map(([k, c], i) =>
        <g key={k} className="iso__in" style={at(0.3 + i * 0.45)}><text y={12 + i * 9}>{k}</text><text x="53" y={12 + i * 9} textAnchor="end">{c}</text></g>)}
      <path className="iso__rule" d="M0 47.5H53" />
      <g className="iso__in" style={at(2.2)}><text y="58">charged</text><text x="53" y="58" textAnchor="end" className="a">≈ 9 µUSD</text></g>
    </g>
    <Lbl s="$0.126 / 1M in" p={[120, 14, 24]} />
    <Lbl s="failed try $0.00" p={[16, 110, 40]} c="is-on" />
    <Lbl s="one per request" p={[113, 92, 30]} />
    <Lbl s="1M micro-USD = $1" p={[60, 128, 6]} />
  </>,
};

export default function CardArt({ art, alt }: { art: Art; alt: string }) {
  return (
    <div className="art" data-k={art} role="img" aria-label={alt}>
      <Scene>{scenes[art]}</Scene>
    </div>
  );
}
