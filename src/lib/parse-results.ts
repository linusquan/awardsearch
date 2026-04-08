import { AwardResult } from "./types";

/**
 * Parse Claude's markdown table output + notes section into an AwardResult.
 * Expects a single-row table (one award per query) followed by a Notes section.
 */
export function parseAgentResponse(
  awardName: string,
  responseText: string
): AwardResult {
  const lines = responseText.split("\n");

  // Find table data rows (lines starting with |, skip header and separator)
  const tableLines = lines.filter(
    (l) =>
      l.trim().startsWith("|") &&
      !l.trim().startsWith("|--") &&
      !l.includes("---|")
  );

  // Skip the header row (first table line with column names)
  const dataRows = tableLines.filter(
    (l) =>
      !l.toLowerCase().includes("award show") ||
      !l.toLowerCase().includes("deadline")
  );

  // Extract notes section (everything after ## Notes or non-table text)
  const notesStartIndex = lines.findIndex((l) =>
    /^#{1,3}\s*notes/i.test(l.trim())
  );
  let notes = "";
  if (notesStartIndex >= 0) {
    notes = lines
      .slice(notesStartIndex + 1)
      .join("\n")
      .trim();
  } else {
    // Fallback: grab non-table, non-heading text
    notes = lines
      .filter(
        (l) =>
          !l.trim().startsWith("|") &&
          l.trim().length > 0 &&
          !l.trim().startsWith("#")
      )
      .join("\n")
      .trim();
  }

  if (dataRows.length > 0) {
    const cells = dataRows[0]
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    return {
      awardShow: cells[0] || awardName,
      earlyBirdDeadline: cells[1] || "",
      submissionDeadline: cells[2] || "",
      category: cells[3] || "",
      entryCost: cells[4] || "",
      website: cleanUrl(cells[5] || ""),
      ceremonyDetails: cells[6] || "",
      notes,
      status: "done",
    };
  }

  // Fallback: no table found, return the full text as notes
  return {
    awardShow: awardName,
    earlyBirdDeadline: "",
    submissionDeadline: "",
    category: "",
    entryCost: "",
    website: "",
    ceremonyDetails: "",
    notes: responseText.trim(),
    status: "done",
  };
}

function cleanUrl(text: string): string {
  // Extract URL from markdown link format [text](url)
  const match = text.match(/\[.*?\]\((.*?)\)/);
  if (match) return match[1];
  return text;
}
