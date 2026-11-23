// Text of https://tenvor.io/checkout?plan=lite|plus|max (captured 2026-11-20 from the rendered page), word for word.
// Card payments are not open there, so this has no payment form: the plan switcher is links, Sign up / Sign in go to the Console.
import type { SitePage } from "./types";

export const plans = {
  lite: { name: "Lite", price: "$6", week: "$1.75", tokens: "12.8M", month: "$7.00", msgs: "250", more: "16%" },
  plus: { name: "Plus", price: "$12.50", week: "$3.75", tokens: "27.3M", month: "$15.00", msgs: "600", more: "20%" },
  max: { name: "Max", price: "$19", week: "$5.75", tokens: "41.9M", month: "$23.00", msgs: "900", more: "21%" },
};
export type PlanId = keyof typeof plans;
export const isPlan = (p: unknown): p is PlanId => typeof p === "string" && Object.hasOwn(plans, p);

const console_ = "https://tenvor.io/console";

export function checkoutPage(id: PlanId): SitePage {
  const p = plans[id];
  const tabs = (Object.keys(plans) as PlanId[])
    .map(k => `<li><a href="/checkout?plan=${k}"${k === id ? ' aria-current="page"' : ""}>${plans[k].name}</a></li>`).join("");
  return {
    path: "/checkout",
    metaTitle: "Checkout",
    kicker: "Checkout",
    title: "Review your plan.",
    intro: "Choose a plan and see exactly what it includes: the price, the allowance each week, how the weeks and the rollover work, and when it renews. Card payments are not open yet.",
    toc: [],
    html: `<div class="s-ck">
<section class="s-card" aria-labelledby="ck-sum"><h2 id="ck-sum">Order summary</h2>
<ul class="s-tags s-ck-tabs" aria-label="Plan">${tabs}</ul>
<dl>
<div><dt>Plan</dt><dd>${p.name}</dd></div>
<div><dt>Price</dt><dd>${p.price} a month</dd></div>
<div><dt>Allowance each week</dt><dd>${p.week} of usage<span>(≈ ${p.tokens} tokens*)</span></dd></div>
<div><dt>Each month, at API prices</dt><dd>${p.month}</dd></div>
<div><dt>Included chat messages</dt><dd>${p.msgs} a week*</dd></div>
</dl>
<p><b>${p.more} more usage than pay-as-you-go</b></p>
<small>*Usage at API prices, as a fresh $1.75 (Lite), $3.75 (Plus) or $5.75 (Max) each week: about 12.8M, 27.3M or 41.9M tokens at a typical coding-agent mix. An included chat message carries up to the last 8,000 tokens of the conversation and replies with up to 1,000 tokens.</small>
<ul>
<li>Your billing month is split into four equal parts. Each one starts with a fresh ${p.week}, and you can see exactly when the next one starts, in your own time zone.</li>
<li>When a week ends, half of what you did not use is added to your account as rollover credit. Rollover credit expires 90 days after it is added and has no cash value.</li>
<li>Your allowance covers every API key on your account, so it works in any app or coding agent that takes an OpenAI-compatible API, and in Work. Usage takes the week's allowance first, then rollover credit, then credit you have bought.</li>
<li>${p.name} includes ${p.msgs} chat messages a week with Tenvor-35B in Chat &amp; Work, and they do not use your allowance. After those, chat uses the allowance, like everything else.</li>
</ul>
<dl>
<div><dt>Renews</dt><dd>every month, on the day you start<span>until you cancel</span></dd></div>
<div><dt>Total today</dt><dd><b>${p.price}</b></dd></div>
</dl>
<p><label><input type="checkbox" disabled> I agree to the <a href="/legal/terms">Terms</a> and the <a href="/legal/service-credits">refund policy</a>, and I understand the plan renews every month until I cancel.</label></p>
<p><b>Card payments are not open yet.</b></p>
<p><b>Alpha money-back guarantee.</b> If you are not satisfied, ask for a refund of the unused part of this month's plan, returned to the card you paid with. <a href="/legal/service-credits">Details</a></p>
</section>
<section class="s-card" aria-labelledby="ck-pay"><h2 id="ck-pay">Payment</h2>
<p><b>Card payments are not open yet.</b> When they are, you pay here, on Stripe's secure payment form, and your plan starts as soon as the payment is confirmed.</p>
<div class="s-row"><a class="s-btn s-btn--accent" href="${console_}">Sign up</a><a class="s-btn" href="${console_}">Sign in</a></div>
<p><a href="/pricing">Back to the plans</a></p>
<p class="s-k">We accept</p>
<small>Card payments are processed by Stripe. You enter your card details on Stripe's secure payment form, and Tenvor never sees or stores your card number. Visa, Mastercard, Discover and American Express are accepted.</small>
</section>
</div>`,
  };
}
