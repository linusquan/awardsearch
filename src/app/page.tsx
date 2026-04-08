"use client";

import { useState, useCallback } from "react";
import { AwardInput } from "@/components/award-input";
import { ResultsTable } from "@/components/results-table";
import { LogPanel } from "@/components/log-panel";
import type { AwardResult, ResearchEvent, LogEntry } from "@/lib/types";

function parseAwardList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function classifyLog(message: string): LogEntry["level"] {
  if (message.startsWith("[tool_call]")) return "tool";
  if (message.startsWith("[tool_result]")) return "result";
  if (message.startsWith("[assistant]")) return "assistant";
  if (message.startsWith("[tokens]")) return "tokens";
  if (message.startsWith("[system]")) return "system";
  return "system";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<AwardResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit = useCallback(async () => {
    const awards = parseAwardList(input);
    if (awards.length === 0) return;

    setIsLoading(true);
    setStatusMessage("");
    setLogs([]);

    // Initialize results with pending status
    setResults(
      awards.map((name) => ({
        awardShow: name,
        earlyBirdDeadline: "",
        submissionDeadline: "",
        category: "",
        entryCost: "",
        website: "",
        ceremonyDetails: "",
        notes: "",
        status: "pending" as const,
      }))
    );

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awards }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6)) as ResearchEvent;

            if (event.type === "done") {
              setStatusMessage("Research complete");
              break;
            }

            if (event.type === "log") {
              setLogs((prev) => [
                ...prev,
                {
                  timestamp: new Date().toLocaleTimeString(),
                  awardIndex: event.awardIndex,
                  awardName: event.awardName,
                  level: classifyLog(event.message || ""),
                  message: event.message || "",
                },
              ]);
            }

            if (event.type === "status") {
              setStatusMessage(event.message || "");
              setResults((prev) =>
                prev.map((r, i) =>
                  i === event.awardIndex
                    ? { ...r, status: "researching" as const }
                    : r
                )
              );
            }

            if (event.type === "result" && event.result) {
              setResults((prev) =>
                prev.map((r, i) =>
                  i === event.awardIndex ? event.result! : r
                )
              );
            }

            if (event.type === "error") {
              setResults((prev) =>
                prev.map((r, i) =>
                  i === event.awardIndex
                    ? {
                        ...r,
                        status: "error" as const,
                        error: event.message,
                      }
                    : r
                )
              );
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } catch (err) {
      setStatusMessage(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [input]);

  const handleExport = useCallback(async () => {
    const completedResults = results.filter((r) => r.status === "done");
    if (completedResults.length === 0) return;

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: completedResults }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "award-research.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [results]);

  const handleExportCsv = useCallback(() => {
    const completedResults = results.filter((r) => r.status === "done");
    if (completedResults.length === 0) return;

    const headers = [
      "Award Show",
      "Submission Earlybird Entry",
      "Submission DEADLINE",
      "General category (PR/Social/Influencer)",
      "per category entry cost (ex. GST)",
      "Website",
      "Awards Ceremony details",
      "Notes",
    ];

    const escape = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = completedResults.map((r) =>
      [
        r.awardShow,
        r.earlyBirdDeadline,
        r.submissionDeadline,
        r.category,
        r.entryCost,
        r.website,
        r.ceremonyDetails,
        r.notes,
      ]
        .map(escape)
        .join(",")
    );

    const csv = [headers.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "award-research.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Award Search
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Research award show deadlines, costs, and categories using AI
          </p>
        </div>

        <AwardInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />

        {statusMessage && (
          <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {statusMessage}
          </div>
        )}

        <ResultsTable results={results} onExport={handleExport} onExportCsv={handleExportCsv} />

        {(logs.length > 0 || isLoading) && (
          <LogPanel
            logs={logs}
            isVisible={showLogs}
            onToggle={() => setShowLogs((v) => !v)}
          />
        )}
      </div>
    </main>
  );
}
