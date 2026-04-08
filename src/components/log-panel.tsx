"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/lib/types";

interface LogPanelProps {
  logs: LogEntry[];
  isVisible: boolean;
  onToggle: () => void;
}

export function LogPanel({ logs, isVisible, onToggle }: LogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, isVisible]);

  return (
    <div className="w-full mt-6">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isVisible ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
        Agent Logs ({logs.length})
      </button>

      {isVisible && (
        <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-950 text-gray-300 font-mono text-xs p-3">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="py-0.5">
                <span className="text-gray-600">{log.timestamp}</span>{" "}
                <span className={levelColor(log.level)}>[{log.level}]</span>{" "}
                <span className="text-blue-400">
                  [{log.awardName}]
                </span>{" "}
                <span className="text-gray-300 break-all">{log.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

function levelColor(level: LogEntry["level"]): string {
  switch (level) {
    case "tool":
      return "text-yellow-400";
    case "result":
      return "text-green-400";
    case "assistant":
      return "text-cyan-400";
    case "system":
      return "text-purple-400";
    case "tokens":
      return "text-orange-400 font-bold";
    case "error":
      return "text-red-400";
  }
}
