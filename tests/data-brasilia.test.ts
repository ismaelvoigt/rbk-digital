import { expect, it } from "vitest";
import { dataISOBrasilia } from "../src/lib/datas/brasilia";
it.each([
  ["2026-11-02T01:25:21.512Z", "2026-11-01"],
  ["2026-11-02T02:59:59.999Z", "2026-11-01"],
  ["2026-11-02T03:00:00.000Z", "2026-11-02"],
  ["2027-01-01T01:00:00.000Z", "2026-12-31"],
  ["2024-03-01T01:00:00.000Z", "2024-02-29"],
])("usa o dia de Brasília para %s", (instant, expected) =>
  expect(dataISOBrasilia(new Date(instant))).toBe(expected),
);
