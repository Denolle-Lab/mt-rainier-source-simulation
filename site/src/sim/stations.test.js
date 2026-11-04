import { describe, expect, it } from "vitest";
import { paintRange, sortRows } from "./stations.js";
import { tickStep, ticks } from "./model.js";

const rows = [
  { i: 0, net: "Z5", sta: "110", dist: 3.2, key: "Z5.110" },
  { i: 1, net: "UW", sta: "STAR", dist: 5.0, key: "UW.STAR" },
  { i: 2, net: "Z5", sta: "12", dist: 1.1, key: "Z5.12" },
  { i: 3, net: "CC", sta: "OBSR", dist: 5.0, key: "CC.OBSR" },
];

describe("station table", () => {
  it("sorts by distance, network and station (numeric), ties by distance", () => {
    expect(sortRows(rows, "dist", 1).map(r => r.i)).toEqual([2, 0, 1, 3]);
    expect(sortRows(rows, "dist", -1).map(r => r.i)[0]).not.toBe(2);
    expect(sortRows(rows, "net", 1).map(r => r.net)).toEqual(["CC", "UW", "Z5", "Z5"]);
    expect(sortRows(rows, "net", 1).slice(2).map(r => r.i)).toEqual([2, 0]);
    expect(sortRows(rows, "sta", 1).map(r => r.sta)).toEqual(["12", "110", "OBSR", "STAR"]);
  });
  it("sets a run of rows in either drag direction, from the state before the drag", () => {
    const keys = ["a", "b", "c", "d", "e"], before = new Set(["b"]);
    expect([...paintRange(before, keys, 1, 3, false)].sort()).toEqual(["b", "c", "d"]);
    expect([...paintRange(before, keys, 3, 0, false)].sort()).toEqual(["a", "b", "c", "d"]);
    // back toward the start: rows left behind keep their state from before the drag
    expect([...paintRange(before, keys, 3, 3, false)].sort()).toEqual(["b", "d"]);
    expect([...paintRange(before, keys, 0, 2, true)]).toEqual([]);
    expect([...before]).toEqual(["b"]);
  });
});

describe("time ticks", () => {
  it("chooses the spacing from the window and the width", () => {
    expect(tickStep(17, 209)).toBe(2);
    expect(tickStep(17, 120)).toBe(5);
    expect(tickStep(2, 209)).toBe(0.5);
    expect(ticks(-1, 15.975, 2)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(ticks(1.3, 2.05, 0.2)).toEqual([1.4, 1.6, 1.8, 2]);
  });
});
