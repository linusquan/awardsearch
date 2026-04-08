import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import type { AwardResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { results } = (await request.json()) as { results: AwardResult[] };

  if (!results || !Array.isArray(results) || results.length === 0) {
    return new Response(JSON.stringify({ error: "No results provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Award Research");

  sheet.columns = [
    { header: "Award Show", key: "awardShow", width: 30 },
    { header: "Submission Earlybird Entry", key: "earlyBirdDeadline", width: 24 },
    { header: "Submission DEADLINE", key: "submissionDeadline", width: 22 },
    { header: "General category (PR/Social/Influencer)", key: "category", width: 20 },
    { header: "per category entry cost\n(ex. GST)", key: "entryCost", width: 25 },
    { header: "Website", key: "website", width: 40 },
    { header: "Awards Ceremony details", key: "ceremonyDetails", width: 35 },
    { header: "Notes", key: "notes", width: 60 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  headerRow.alignment = { wrapText: true, vertical: "middle" };

  for (const result of results) {
    sheet.addRow({
      awardShow: result.awardShow,
      earlyBirdDeadline: result.earlyBirdDeadline,
      submissionDeadline: result.submissionDeadline,
      category: result.category,
      entryCost: result.entryCost,
      website: result.website,
      ceremonyDetails: result.ceremonyDetails,
      notes: result.notes,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="award-research.xlsx"',
    },
  });
}
