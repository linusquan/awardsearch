import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { parseAgentResponse } from "./parse-results";
import type { ResearchEvent } from "./types";

const PROJECT_ROOT = join(process.cwd());

function loadSkillPrompt(): string {
  const skillPath = join(PROJECT_ROOT, ".claude/skills/award-search/SKILL.md");
  const content = readFileSync(skillPath, "utf-8");
  // Strip frontmatter
  const match = content.match(/^---[\s\S]*?---\n([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

function loadMcpConfig(): Record<string, { command: string; args: string[] }> {
  try {
    const mcpPath = join(PROJECT_ROOT, ".mcp.json");
    const config = JSON.parse(readFileSync(mcpPath, "utf-8"));
    return config.mcpServers || {};
  } catch {
    return {};
  }
}

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
  const skillPrompt = loadSkillPrompt();
  const mcpServers = loadMcpConfig();

  yield {
    type: "status",
    awardIndex,
    awardName,
    message: `Researching ${awardName}...`,
  };

  yield makeLog(awardIndex, awardName, `Starting research for "${awardName}"`);
  yield makeLog(
    awardIndex,
    awardName,
    `MCP servers: ${JSON.stringify(Object.keys(mcpServers))}`
  );

  try {
    let resultText = "";
    let lastUsage: { input_tokens?: number; output_tokens?: number; cache_read_tokens?: number; cache_write_tokens?: number } = {};

    for await (const message of query({
      prompt: `Research the following award show and produce the markdown table as specified:\n\n${awardName}`,
      options: {
        systemPrompt: skillPrompt,
        allowedTools: [
          "WebSearch",
          "WebFetch",
          "Read",
          "Bash",
          "Glob",
          "Grep",
          "mcp__playwright__*",
        ],
        mcpServers,
        model: "claude-sonnet-4-6",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 50,
        cwd: PROJECT_ROOT,
        agentProgressSummaries: true,
      },
    })) {
      if ("result" in message) {
        resultText = message.result;
        yield makeLog(awardIndex, awardName, `Research complete`);
      } else if (message.type === "system") {
        // Capture usage from any system message that carries it
        const msg = message as Record<string, unknown>;
        if (msg.usage && typeof msg.usage === "object") {
          const u = msg.usage as Record<string, number>;
          lastUsage = {
            input_tokens: u.input_tokens || lastUsage.input_tokens,
            output_tokens: u.output_tokens || lastUsage.output_tokens,
            cache_read_tokens: u.cache_read_input_tokens || lastUsage.cache_read_tokens,
            cache_write_tokens: u.cache_creation_input_tokens || lastUsage.cache_write_tokens,
          };
        }
        yield makeLog(
          awardIndex,
          awardName,
          `[system] ${message.subtype}${msg.usage ? ` | tokens: ${JSON.stringify(msg.usage)}` : ""}`
        );
        continue;
      } else if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            yield makeLog(
              awardIndex,
              awardName,
              `[assistant] ${block.text.slice(0, 300)}`
            );
          } else if (block.type === "tool_use") {
            const inputStr = JSON.stringify(block.input).slice(0, 200);
            yield makeLog(
              awardIndex,
              awardName,
              `[tool_call] ${block.name}(${inputStr})`
            );
          }
        }
      } else if (message.type === "user") {
        for (const block of message.message.content) {
          if (
            typeof block === "object" &&
            "type" in block &&
            block.type === "tool_result"
          ) {
            const content =
              typeof block.content === "string"
                ? block.content.slice(0, 300)
                : JSON.stringify(block.content).slice(0, 300);
            yield makeLog(
              awardIndex,
              awardName,
              `[tool_result] ${content}`
            );
          }
        }
      }
    }

    // Build token usage summary
    const tokenSummary = lastUsage.input_tokens
      ? `Token usage: input=${lastUsage.input_tokens} output=${lastUsage.output_tokens ?? 0} cache_read=${lastUsage.cache_read_tokens ?? 0} cache_write=${lastUsage.cache_write_tokens ?? 0}`
      : "";

    if (tokenSummary) {
      yield makeLog(awardIndex, awardName, `[tokens] ${tokenSummary}`);
    }

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
    // Append token usage to notes
    if (tokenSummary) {
      parsed.notes = parsed.notes
        ? `${parsed.notes}\n\n${tokenSummary}`
        : tokenSummary;
    }
    yield {
      type: "result",
      awardIndex,
      awardName,
      result: parsed,
    };
  } catch (err) {
    yield {
      type: "error",
      awardIndex,
      awardName,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
