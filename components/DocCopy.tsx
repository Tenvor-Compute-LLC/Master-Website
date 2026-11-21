"use client";
import { useEffect } from "react";

/** Gives every code block in .docs__body a working Copy button: the source's own hidden buttons are shown, blocks without one get one. */
export default function DocCopy() {
  useEffect(() => {
    const off: (() => void)[] = [];
    document.querySelectorAll<HTMLPreElement>(".docs__body pre").forEach(pre => {
      const box = pre.closest<HTMLElement>("[data-copy-example]");
      let btn = box?.querySelector<HTMLButtonElement>(".d-copy-command");
      if (!btn) {
        btn = Object.assign(document.createElement("button"), { type: "button", className: "d-copy-command d-copy-add", textContent: "Copy" });
        btn.setAttribute("aria-label", `Copy ${pre.getAttribute("aria-label") ?? "code"}`);
        pre.before(btn);
      }
      const b = btn, label = b.textContent;
      const status = box?.querySelector(".d-copy-status");
      b.hidden = false;
      const click = () => navigator.clipboard.writeText(pre.innerText.replace(/\n$/, "")).then(
        () => { b.textContent = "Copied"; if (status) status.textContent = box?.dataset.copied ?? ""; setTimeout(() => { b.textContent = label; }, 1600); },
        () => { if (status) status.textContent = box?.dataset.blocked ?? "Copy was blocked. Select the code and copy it manually."; });
      b.addEventListener("click", click);
      off.push(() => { b.removeEventListener("click", click); if (b.classList.contains("d-copy-add")) b.remove(); });
    });
    return () => off.forEach(f => f());
  }, []);
  return null;
}
