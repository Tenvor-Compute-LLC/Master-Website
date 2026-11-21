export type Integration = { name: string; logo: string };

const list: [string, string][] = [
  ["Slack", "slack"], ["HubSpot", "hubspot"], ["Salesforce", "salesforce"], ["Notion", "notion"],
  ["Google Sheets", "google-sheets"], ["OpenAI", "openai"], ["Anthropic", "anthropic"], ["Zapier", "zapier"],
  ["n8n", "n8n"], ["Airtable", "airtable"], ["Stripe", "stripe"], ["Shopify", "shopify"],
  ["Intercom", "intercom"], ["Zendesk", "zendesk"], ["Teams", "teams"], ["WhatsApp", "whatsapp"],
];

export const integrations: Integration[] = list.map(([name, file]) => ({ name, logo: `/logos/${file}.svg` }));
