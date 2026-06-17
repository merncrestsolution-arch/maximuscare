import { describe, it, expect } from "vitest";
import { rowsToCsv, rowsToExcelBuffer } from "./exportService";

describe("exportService", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "amount", label: "Amount" },
  ];
  const rows = [
    { name: "Test, User", amount: 100 },
    { name: "Another", amount: 200 },
  ];

  it("rowsToCsv escapes commas and quotes", () => {
    const csv = rowsToCsv(columns, rows);
    expect(csv).toContain('"Test, User"');
    expect(csv.split("\n").length).toBe(3);
  });

  it("rowsToExcelBuffer returns a buffer", async () => {
    const buf = await rowsToExcelBuffer(columns, rows, "Test");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });
});
