import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// Every public route; /checkout is left out (noindex).
const routes = ["/", "/about", "/chat", "/contact", "/developers", "/docs", "/docs/api/chat-completions", "/docs/billing", "/docs/integrations/jetbrains", "/docs/integrations/opencode", "/docs/integrations/pi", "/docs/models-and-limits", "/docs/quickstart", "/docs/troubleshooting", "/good", "/legal", "/legal/acceptable-use", "/legal/cookies", "/legal/privacy", "/legal/provider-terms", "/legal/public-alpha-risk", "/legal/security", "/legal/service-credits", "/legal/subprocessors", "/legal/terms", "/models", "/operators", "/pricing", "/products", "/status", "/trust"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(r => ({
    url: SITE + (r === "/" ? "" : r),
    changeFrequency: r.startsWith("/legal") ? "monthly" : "weekly",
    priority: r === "/" ? 1 : r.split("/").length === 2 ? 0.8 : 0.6,
  }));
}
