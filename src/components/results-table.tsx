"use client";

import { useState } from "react";
import type { AwardResult } from "@/lib/types";

interface ResultsTableProps {
  results: AwardResult[];
  onExport: () => void;
}

export function ResultsTable({ results, onExport }: ResultsTableProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  if (results.length === 0) return null;

  const toggleNotes = (index: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const completedResults = results.filter((r) => r.status === "done");

  return (
    <div className="w-full mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Results ({completedResults.length} of {results.length})
        </h2>
        {completedResults.length > 0 && (
          <button
            onClick={onExport}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors cursor-pointer"
          >
            Download XLSX
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">Award Show</th>
              <th className="px-4 py-3 text-left font-medium">
                Submission Earlybird Entry
              </th>
              <th className="px-4 py-3 text-left font-medium">
                Submission DEADLINE
              </th>
              <th className="px-4 py-3 text-left font-medium">
                General category
              </th>
              <th className="px-4 py-3 text-left font-medium">
                per category entry cost (ex. GST)
              </th>
              <th className="px-4 py-3 text-left font-medium">Website</th>
              <th className="px-4 py-3 text-left font-medium">
                Awards Ceremony details
              </th>
              <th className="px-4 py-3 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result, i) => (
              <tr
                key={i}
                className={
                  result.status === "error"
                    ? "bg-red-50 dark:bg-red-900/20"
                    : result.status === "researching"
                      ? "bg-yellow-50 dark:bg-yellow-900/10"
                      : "bg-white dark:bg-gray-900"
                }
              >
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {i + 1}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {result.awardShow}
                  {result.status === "researching" && (
                    <span className="ml-2 inline-block animate-pulse text-yellow-500">
                      ...
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {result.earlyBirdDeadline || "—"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {result.submissionDeadline || "—"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {result.category || "—"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {result.entryCost || "—"}
                </td>
                <td className="px-4 py-3">
                  {result.website ? (
                    <a
                      href={result.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      Link
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {result.ceremonyDetails || "—"}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-md">
                  {result.status === "error" ? (
                    <span className="text-red-600 dark:text-red-400">
                      {result.error || "Research failed"}
                    </span>
                  ) : result.notes ? (
                    <div>
                      <div
                        className={
                          expandedNotes.has(i)
                            ? "whitespace-pre-wrap"
                            : "line-clamp-2"
                        }
                      >
                        {renderNotes(result.notes)}
                      </div>
                      {result.notes.length > 100 && (
                        <button
                          onClick={() => toggleNotes(i)}
                          className="text-blue-600 dark:text-blue-400 text-xs mt-1 hover:underline cursor-pointer"
                        >
                          {expandedNotes.has(i) ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Render notes text, converting URLs into clickable links */
function renderNotes(text: string) {
  // Split on URLs and render them as links
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset lastIndex since we reuse the regex
      urlRegex.lastIndex = 0;
      const isPdf = part.toLowerCase().endsWith(".pdf");
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {isPdf ? `[PDF: ${part.split("/").pop()}]` : part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
