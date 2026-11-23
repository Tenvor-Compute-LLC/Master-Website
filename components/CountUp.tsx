"use client";
import { useRef } from "react";
import { clamp, useTick } from "@/components/useTick";

/** A figure such as "$0.126" or "10 GB+" that counts up from zero once, the first time it is seen; the text is final before JS and with reduced motion. */
export default function CountUp({ value, ms = 1200 }: { value: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const e = useTick(ref, ms);
  const m = value.match(/^(\D*)([\d.,]+)(.*)$/);
  if (!m) return value;
  const n = parseFloat(m[2].replace(/,/g, "")), dp = m[2].split(".")[1]?.length ?? 0;
  const k = 1 - (1 - clamp(e / ms)) ** 3;
  return <span ref={ref}>{m[1]}{(n * k).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}{m[3]}</span>;
}
