"use client";
import { useRef } from "react";
import { example } from "@/content/pricing";
import { clamp, useTick } from "@/components/useTick";

const END = 3600;

/** The pricing page's own example request, itemised the way a receipt is: tokens in, tokens out, then the charge. Counts up once when seen. */
export default function PriceReceipt() {
  const ref = useRef<HTMLDivElement>(null);
  const e = useTick(ref, END);
  return (
    <div ref={ref} className="prc reveal" aria-label="Example request, estimated cost">
      <p className="mono prc__k">Example request</p>
      <ol className="prc__rows">
        {example.rows.map(([k, v], i) => {
          const on = e >= i * 800;
          const p = clamp((e - i * 800) / 700);
          const m = v.match(/^\$([\d.,]+)$/), dp = m?.[1].split(".")[1]?.length ?? 0;
          const shown = m ? "$" + (parseFloat(m[1].replace(/,/g, "")) * p).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }) : v;
          return <li key={k} className={`mono${on ? " on" : ""}${i === 2 ? " prc__sum" : ""}`}><span>{k}</span><b>{shown}</b></li>;
        })}
      </ol>
      <p className="mono prc__note">{example.note}</p>
    </div>
  );
}
