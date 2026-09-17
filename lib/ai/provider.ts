/**
 * AI adapter.
 *
 * AI handles language only: what the customer is asking, a summary, and a draft
 * in their preferred language. It never decides a status, a permission or a
 * promise — those come from lib/domain and are passed IN as facts it must not
 * contradict.
 */

import type { Case, Customer, Intent } from "@/lib/types";
import type { Evaluation } from "@/lib/domain/rules";

export type AnalyzeInput = {
  text: string;
  channel: string;
  customer?: Customer;
  caseRecord?: Case;
  evaluation?: Evaluation;
  dealershipPhone: string;
  /** Prior messages on the same case, oldest first. */
  history: { channel: string; text: string }[];
};

export type AnalyzeOutput = {
  intent: Intent;
  confidence: number;
  summary: string;
  language: string;
  draft?: string;
  error?: string;
  /** Set when the live provider failed and the deterministic mock stood in. */
  fellBackFrom?: string;
};

export interface AiProvider {
  readonly name: string;
  analyze(input: AnalyzeInput): Promise<AnalyzeOutput>;
}

async function mock() {
  const { mockProvider } = await import("@/lib/ai/mock");
  return mockProvider;
}

async function liveProvider(choice: string): Promise<AiProvider | null> {
  if (choice === "deepseek") {
    const { deepseekProvider } = await import("@/lib/ai/deepseek");
    return deepseekProvider;
  }
  return null;
}

/**
 * Returns the configured provider wrapped so that a live failure degrades to
 * the deterministic mock instead of killing the demonstration. The fallback is
 * always disclosed on screen — it never pretends the model answered.
 */
export async function getProvider(): Promise<AiProvider> {
  const choice = (process.env.AI_PROVIDER || "deepseek").toLowerCase();
  if (choice === "mock") return mock();

  const live = await liveProvider(choice);
  if (!live) return mock();

  const fallback = process.env.AI_FALLBACK !== "false";

  return {
    name: live.name,
    async analyze(input) {
      const result = await live.analyze(input);
      if (!result.error) return result;
      if (!fallback) return result;

      const backup = await mock();
      const viaMock = await backup.analyze(input);
      return {
        ...viaMock,
        fellBackFrom: live.name,
        error: viaMock.error
          ? `${live.name} failed (${result.error}) and the rule-based fallback could not help either.`
          : undefined,
      };
    },
  };
}
