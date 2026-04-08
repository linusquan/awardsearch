import Anthropic from "@anthropic-ai/sdk";
import { parseAgentResponse } from "./parse-results";
import type { ResearchEvent } from "./types";

const SKILL_PROMPT = `# Award Search Agent

You are an awards research agent. Given a list of award shows, research each one and produce a single markdown table with verified information.

## Output Format

Output a markdown table followed by a **Notes** section. Use these exact columns:

| Award Show | Submission Earlybird Entry | Submission DEADLINE | General category (PR/Social/Influencer) | per category entry cost (ex. GST) | Website | Awards Ceremony details |
|---|---|---|---|---|---|---|

### Column Definitions

- **Award Show** — Name of the award as provided by the user
- **Submission Earlybird Entry** — Early bird submission date if one exists, otherwise leave blank
- **Submission DEADLINE** — The earliest standard close date (i.e. "On-Time Entries Close" or equivalent). Do NOT use extended or late deadlines here — those belong in Notes along with any late fees
- **General category (PR/Social/Influencer)** — Classify into exactly ONE of: PR / Social / Influencer / Advertising / Media / Effectiveness / Digital / Events / People / Multi-discipline
- **per category entry cost (ex. GST)** — Cost per category entry in AUD excluding GST. Note the original currency if not AUD. Use "Free", "TBC", or "Contact for pricing" where applicable
- **Website** — Official awards entry URL
- **Awards Ceremony details** — Date, venue, and location of the ceremony if known

### Notes Section

After the table, output a \`## Notes\` section containing:
- **Extended/late deadlines and fees** — if the award has extended or late entry deadlines beyond the standard close, list them here with any additional fees (e.g. "Extended deadline: 18 May 2026, Late deadline: 1 Jun 2026 (+$100 late fee)")
- A summary of the research steps taken (which sites were searched, which pages were fetched)
- Links to any PDF files found during research (e.g. entry guidelines, call for entries booklets)
- Any caveats, such as dates from a previous year flagged with ⚠️
- Source URLs used to verify the data

## Research Strategy

Use web_search and web_fetch tools to find the information:

1. **Web search** — Search for \`[Award Name] [current year] entry deadline cost\`. This is usually enough to find dates and pricing from the official site or industry press coverage.

2. **Fetch the official site** — Go to the official awards website and check pages like \`/enter\`, \`/key-dates\`, \`/submissions\`, or \`/fees\`. These pages typically have the structured information you need.

## Important Rules

- **Accuracy over completeness** — only record dates and costs you can verify from an authoritative source. Never guess or infer dates.
- **Year handling** — always find the most recent edition's dates, even if they are in the past. If the current year's dates are not yet published, use the most recent year's dates and flag with ⚠️ (e.g., "15 Mar 2025 ⚠️"). Never skip an award just because its deadline has passed.
- **Login-gated pricing** — if a site requires login or registration to see pricing, note "Contact for pricing" rather than trying to access gated content.
- **Currency** — default assumption is AUD. If the award lists pricing in another currency (USD, GBP, EUR, etc.), note it in parentheses, e.g., "$500 (USD)".`;

function makeLog(
  awardIndex: number,
  awardName: string,
  message: string
): ResearchEvent {
  return { type: "log", awardIndex, awardName, message };
}

export async function* researchAward(
  awardName: string,
  awardIndex: number
): AsyncGenerator<ResearchEvent> {
  const client = new Anthropic();

  yield {
    type: "status",
    awardIndex,
    awardName,
    message: `Researching ${awardName}...`,
  };

  yield makeLog(awardIndex, awardName, `Starting research for "${awardName}"`);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;
  let turnCount = 0;
  const maxTurns = 25;

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Research the following award show and produce the markdown table as specified:\n\n${awardName}`,
      },
    ];

    while (turnCount < maxTurns) {
      turnCount++;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SKILL_PROMPT,
        messages,
        tools: [
          { type: "web_search_20260209", name: "web_search" },
          { type: "web_fetch_20260209", name: "web_fetch" },
        ],
      });

      // Track token usage
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
      const usage = response.usage as unknown as Record<string, number>;
      if (usage.cache_read_input_tokens) {
        totalCacheReadTokens += usage.cache_read_input_tokens;
      }
      if (usage.cache_creation_input_tokens) {
        totalCacheWriteTokens += usage.cache_creation_input_tokens;
      }

      yield makeLog(
        awardIndex,
        awardName,
        `[system] Turn ${turnCount} | stop_reason: ${response.stop_reason} | tokens: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`
      );

      // Log content blocks
      for (const block of response.content) {
        if (block.type === "text" && block.text) {
          yield makeLog(
            awardIndex,
            awardName,
            `[assistant] ${block.text.slice(0, 300)}`
          );
        } else if (block.type === "tool_use") {
          yield makeLog(
            awardIndex,
            awardName,
            `[tool_call] ${block.name}(${JSON.stringify(block.input).slice(0, 200)})`
          );
        } else if (block.type === "server_tool_use") {
          yield makeLog(
            awardIndex,
            awardName,
            `[tool_call] ${block.name}(${JSON.stringify(block.input).slice(0, 200)})`
          );
        }
      }

      // Check if done
      if (response.stop_reason === "end_turn") {
        const textBlocks = response.content.filter(
          (b): b is Anthropic.TextBlock => b.type === "text"
        );
        const resultText = textBlocks.map((b) => b.text).join("\n");

        // Log token totals
        yield makeLog(
          awardIndex,
          awardName,
          `[tokens] Total: input=${totalInputTokens} output=${totalOutputTokens} cache_read=${totalCacheReadTokens} cache_write=${totalCacheWriteTokens} turns=${turnCount}`
        );

        if (!resultText) {
          yield {
            type: "error",
            awardIndex,
            awardName,
            message: "No result returned from agent",
          };
          return;
        }

        const parsed = parseAgentResponse(awardName, resultText);
        yield {
          type: "result",
          awardIndex,
          awardName,
          result: parsed,
        };
        return;
      }

      // Handle pause_turn (server-side tool loop hit limit) — re-send to continue
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        yield makeLog(awardIndex, awardName, `[system] pause_turn — continuing server-side tool execution`);
        continue;
      }

      // Append assistant response to conversation
      messages.push({ role: "assistant", content: response.content });

      // If there are server_tool_use blocks, just continue — results come back automatically
      // For regular tool_use, we'd need to handle them (but web_search/web_fetch are server-side)
      messages.push({ role: "user", content: [{ type: "text", text: "Continue." }] });
    }

    // Exceeded max turns
    yield makeLog(
      awardIndex,
      awardName,
      `[tokens] Total: input=${totalInputTokens} output=${totalOutputTokens} cache_read=${totalCacheReadTokens} cache_write=${totalCacheWriteTokens} turns=${turnCount}`
    );
    yield {
      type: "error",
      awardIndex,
      awardName,
      message: `Exceeded max turns (${maxTurns})`,
    };
  } catch (err) {
    // Log token totals even on error
    yield makeLog(
      awardIndex,
      awardName,
      `[tokens] Total: input=${totalInputTokens} output=${totalOutputTokens} cache_read=${totalCacheReadTokens} cache_write=${totalCacheWriteTokens} turns=${turnCount}`
    );
    yield {
      type: "error",
      awardIndex,
      awardName,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
