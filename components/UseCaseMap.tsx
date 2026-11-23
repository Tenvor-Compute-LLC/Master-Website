/** Isometric "network board" for the coding-agent Use Case card: requests ride lanes to the Tenvor API and on to GPU nodes.
 *  Plain SVG; motion is SMIL (packets) + CSS (lanes, LEDs, build-in). Reduced motion shows the still frame. */
const S = 22, C = 0.866, N = 12;
type V = [number, number, number?];
const P = ([x, y, z = 0]: V) => [(x - y) * C * S, (x + y) * 0.5 * S - z * S] as const;
const xy = (v: V) => P(v).map(n => n.toFixed(1)).join(",");
const pts = (vs: V[]) => vs.map(xy).join(" ");
const path = (vs: V[]) => "M" + vs.map(xy).join("L");

function Box({ x, y, z = 0, w, d, h, cls }: { x: number; y: number; z?: number; w: number; d: number; h: number; cls: string }) {
  return (
    <g className={cls}>
      <polygon className="l" points={pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} />
      <polygon className="r" points={pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} />
      <polygon className="t" points={pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])} />
    </g>
  );
}

// One choreographed loop of T seconds; every moment below is a fraction of T.
//   0-.18 request leaves the desk  .18-.32 waits at the Allow/Deny gate  .32-.55 rides to the GPU node
//   .55-.62 node works  .62-.93 three reply tokens stream back  then the screen shows the answer.
const T = 6.4;
const ROUTE: V[] = [[3.6, 8], [6, 8], [6, 6], [9.4, 6], [9.4, 3.5]]; // axis-aligned, so length in grid units
const LEN = ROUTE.slice(1).reduce((n, v, i) => n + Math.abs(v[0] - ROUTE[i][0]) + Math.abs(v[1] - ROUTE[i][1]), 0);
const G = 1 / LEN;           // gate sits 1 unit along the route
const HUBAT = 4.4 / LEN;     // hub sits 4.4 units along
const tReqHub = 0.32 + (HUBAT - G) / (1 - G) * 0.23, tRepHub = 0.62 + (1 - HUBAT) * 0.28;
const kt = (...n: number[]) => n.map(v => +v.toFixed(3)).join(";");
const loop = { dur: `${T}s`, repeatCount: "indefinite" } as const;

function Desk({ x, y }: { x: number; y: number }) {
  const [fx, fy] = P([x + 0.35, y + 0.22, 1.47]);
  // terminal lines on the screen face: [width, colour class, appear at, typed by]
  const lines: [number, string, number, number][] = [
    [20, "tl tl--o", 0.0, 0.08], [26, "tl", 0.05, 0.15], [14, "tl tl--a", 0.18, 0.2],
    [24, "tl", 0.66, 0.78], [18, "tl", 0.72, 0.86], [10, "tl tl--g", 0.9, 0.92],
  ];
  return (
    <>
      <Box x={x} y={y} w={2} d={1} h={0.45} cls="desk" />
      <Box x={x + 0.25} y={y + 0.1} z={0.45} w={1.5} d={0.12} h={1.1} cls="screen" />
      <g transform={`translate(${fx.toFixed(1)} ${fy.toFixed(1)}) matrix(${C} 0.5 0 1 0 0)`}>
        {lines.map(([w, c, a, b], i) => (
          <rect key={i} className={c} x={0} y={i * 3.6} height={1.8} width={0}>
            <animate attributeName="width" values={`0;0;${w};${w};0`} keyTimes={kt(0, a, b, 0.97, 1)} {...loop} />
          </rect>
        ))}
      </g>
      <Box x={x + 0.65} y={y + 1.45} w={0.7} d={0.7} h={0.7} cls="cube" />
    </>
  );
}

function Rack({ x, y, h, hot }: { x: number; y: number; h: number; hot?: boolean }) {
  const w = 1.8, d = 1.8;
  return (
    <g>
      <Box x={x} y={y} w={w} d={d} h={h} cls="rack" />
      {Array.from({ length: Math.floor(h / 0.55) - 1 }, (_, i) => {
        const z = 0.5 + i * 0.55, [lx, ly] = P([x + w - 0.3, y + d, z]);
        return (
          <g key={i}>
            <path className="slot" d={path([[x + 0.2, y + d, z], [x + w - 0.55, y + d, z]])} />
            <path className="slot" d={path([[x + w, y + 0.2, z], [x + w, y + d - 0.2, z]])} />
            <circle className="led" cx={lx} cy={ly} r={2} style={{ animationDelay: `${(i * 0.37 + x) % 2.4}s` }} />
          </g>
        );
      })}
      {hot && (<>
        <polygon className="rack-glow" opacity="0" points={pts([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]])}>
          <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={kt(0, 0.54, 0.57, 0.64, 0.75, 1)} {...loop} />
        </polygon>
        {[0, 1, 2].map(i => { const [hx, hy] = P([x + 0.5 + i * 0.4, y + 0.6 + i * 0.3, h]); return <circle key={i} className="heat" cx={hx} cy={hy} r={1.6} style={{ animationDelay: `${i * 0.6}s` }} />; })}
      </>)}
    </g>
  );
}

function Sign({ at, label, dir = "x", hot, lift = 2 }: { at: V; label: string; dir?: "x" | "y"; hot?: boolean; lift?: number }) {
  const [px, py] = P(at), top = py - lift * S, w = label.length * 8.9 + 16;
  return (
    <g className={"sign" + (hot ? " sign--hot" : "")}>
      <line x1={px} y1={py} x2={px} y2={top} />
      <circle cx={px} cy={py} r={3} />
      <g transform={`translate(${px.toFixed(1)} ${top.toFixed(1)}) matrix(${C} ${dir === "x" ? 0.5 : -0.5} 0 1 0 0)`}>
        <rect x={-w / 2} y={-22} width={w} height={22} rx={3} />
        <text x={0} y={-7} textAnchor="middle">{label}</text>
      </g>
    </g>
  );
}

const cube = (cls: string) => <Box x={-0.28} y={-0.28} w={0.56} d={0.56} h={0.56} cls={cls} />;
const D = path(ROUTE);

function Request() {
  return (
    <g className="pkt" opacity="0">
      {cube("cube")}
      <animateMotion path={D} calcMode="linear" keyPoints={kt(0, 0, G, G, 1, 1)} keyTimes={kt(0, 0.02, 0.18, 0.32, 0.55, 1)} {...loop} />
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes={kt(0, 0.03, 0.53, 0.56, 1)} {...loop} />
    </g>
  );
}

function Reply({ i }: { i: number }) {
  const d = i * 0.03;
  return (
    <g className="pkt" opacity="0">
      {cube("tok")}
      <animateMotion path={D} calcMode="linear" keyPoints="1;1;0;0" keyTimes={kt(0, 0.62 + d, 0.9 + d, 1)} {...loop} />
      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={kt(0, 0.61 + d, 0.63 + d, 0.88 + d, 0.9 + d, 1)} {...loop} />
    </g>
  );
}

// a bright streak on the lane that rides with the packets (dash on a path of length 1)
const Comets = () => (
  <>
    <path className="comet" d={D} pathLength={1} strokeDasharray="0.07 2" strokeDashoffset={0.07}>
      <animate attributeName="stroke-dashoffset" values={kt(0.07, 0.07, 0.07 - G, 0.07 - G, -0.93, -1, -1)} keyTimes={kt(0, 0.02, 0.18, 0.32, 0.55, 0.56, 1)} {...loop} />
    </path>
    <path className="comet comet--back" d={D} pathLength={1} strokeDasharray="0.1 2" strokeDashoffset={-1.2}>
      <animate attributeName="stroke-dashoffset" values="-1.2;-1.2;-1;0;0.2;0.2" keyTimes={kt(0, 0.619, 0.62, 0.96, 0.961, 1)} {...loop} />
    </path>
  </>
);

const HUB: V = [6, 6];
function Hub() {
  const [cx, cy] = P(HUB), [tx, ty] = P([6, 6, 1]);
  return (
    <>
      <ellipse className="ring" cx={cx} cy={cy} rx={40} ry={23} />
      <ellipse className="hit" cx={cx} cy={cy} rx={20} ry={11.5} opacity="0">
        <animate attributeName="rx" values="20;20;70;20;70;70" keyTimes={kt(0, tReqHub, tReqHub + 0.1, tRepHub, tRepHub + 0.1, 1)} {...loop} />
        <animate attributeName="ry" values="11.5;11.5;40;11.5;40;40" keyTimes={kt(0, tReqHub, tReqHub + 0.1, tRepHub, tRepHub + 0.1, 1)} {...loop} />
        <animate attributeName="opacity" values="0;1;0;1;0;0" keyTimes={kt(0, tReqHub, tReqHub + 0.1, tRepHub, tRepHub + 0.1, 1)} {...loop} />
      </ellipse>
      <Box x={5.3} y={5.3} w={1.4} d={1.4} h={1} cls="hub" />
      <ellipse className="hub-spin" cx={tx} cy={ty} rx={13} ry={7.5} />
    </>
  );
}

// the Allow/Deny gate: amber while the request waits, green with an ALLOW tag when it passes
function Gate() {
  const [px, py] = P([4.9, 8.3, 1.45]);
  const on = { values: "0;0;1;1;0;0", keyTimes: kt(0, 0.17, 0.2, 0.31, 0.35, 1), ...loop };
  return (
    <>
      <Box x={4.6} y={7.6} w={0.25} d={0.8} h={1.3} cls="gate" />
      <g opacity="0"><Box x={4.6} y={7.6} w={0.25} d={0.8} h={1.3} cls="gate gate--ok" /><animate attributeName="opacity" {...on} /></g>
      <g className="ok" opacity="0" transform={`translate(${px.toFixed(1)} ${py.toFixed(1)})`}>
        <g transform={`matrix(${C} -0.5 0 1 0 0)`}><rect x={-34} y={-20} width={68} height={20} rx={3} /><text x={0} y={-6} textAnchor="middle">ALLOW ✓</text></g>
        <animate attributeName="opacity" {...on} />
      </g>
    </>
  );
}

const drop = (i: number) => ({ style: { transitionDelay: `${0.1 + i * 0.12}s` } });
const RAYS: V[][] = [[[-8, 6], [20, 6]], [[6, -8], [6, 20]]];
const GRID = Array.from({ length: N + 1 }, (_, i) => i);

export default function UseCaseMap() {
  return (
    <div className="ucmap reveal" role="img" aria-label="A coding agent at a desk asks Allow or Deny before each tool call; the request goes to the Tenvor API, which routes it to a GPU node serving chat-35b-moe, and the reply streams back token by token">
      <svg viewBox="-250 -45 500 345" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-still={(T * 0.94).toFixed(2)}>
        <defs>
          <radialGradient id="uc-pool"><stop offset="0" stopColor="#ff5a1f" stopOpacity=".28" /><stop offset="1" stopColor="#ff5a1f" stopOpacity="0" /></radialGradient>
        </defs>
        <g className="rays">{RAYS.map((r, i) => <path key={i} d={path(r)} />)}</g>
        <g className="drop" {...drop(0)}>
          <polygon className="slab-ghost" points={pts([[0, 0, -1.1], [N, 0, -1.1], [N, N, -1.1], [0, N, -1.1]])} />
          <Box x={0} y={0} z={-0.5} w={N} d={N} h={0.5} cls="slab" />
          <g className="grid">{GRID.map(i => <path key={i} d={path([[i, 0], [i, N]]) + path([[0, i], [N, i]])} />)}</g>
          <ellipse cx={P(HUB)[0]} cy={P(HUB)[1]} rx={150} ry={86} fill="url(#uc-pool)" />
        </g>
        <g className="drop lanes" {...drop(1)}>
          <path d={D} />
          <path className="flow" d={D} />
          <Comets />
        </g>
        <g className="drop" {...drop(2)}>
          <Desk x={1.5} y={7.5} />
          <Gate />
          <Hub />
          <Rack x={8.5} y={1.6} h={4.4} hot />
          <Request />
          <Rack x={9.6} y={8.6} h={2.8} />
          {[0, 1, 2].map(i => <Reply key={i} i={i} />)}
        </g>
        <g className="drop" {...drop(3)}>
          <Sign at={[2.1, 7.9, 1.55]} label="TENVOR-AGENT" lift={1.5} />
          <Sign at={[6, 6, 1]} label="TENVOR API" hot lift={1.3} />
          <Sign at={[9.4, 2.5, 4.4]} label="CHAT-35B-MOE" lift={1} />
        </g>
      </svg>
    </div>
  );
}
