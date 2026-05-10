import Anthropic from "@anthropic-ai/sdk";

if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
  );
}

export const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});
