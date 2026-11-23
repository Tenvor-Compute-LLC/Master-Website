import { getStatus } from "@/lib/uptime";

/** Polled by the status page every minute; the server fetches Uptime Kuma so the browser never talks to it directly. */
export async function GET() {
  return Response.json(await getStatus());
}
