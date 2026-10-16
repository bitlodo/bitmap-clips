import { expect, test } from "bun:test";
import MondrianLayout from "../src/vendor/mondrianLayout.js";
import { parcelSize, createBitmapLayout } from "../src/lib/bitmap-layout";
import {
  parseBlock,
  type ParsedTransaction,
} from "../src/vendor/block-parser.js";
import fixture from "./fixtures/block-57043-live.json";

test("conversão logarítmica preserva zero e fronteiras exatas em sats", () => {
  expect(parcelSize(0n)).toBe(1);
  expect(parcelSize(1_000_000n)).toBe(1);
  expect(parcelSize(1_000_001n)).toBe(2);
  expect(parcelSize(100_000_000n)).toBe(3);
  expect(parcelSize(100_000_001n)).toBe(4);
  expect(parcelSize(5_000_000_000n)).toBe(5);
  expect(parcelSize(1_000_000_000_000n)).toBe(7);
});

test("usa posições da lib original e preserva a ordem e a identidade das transações", async () => {
  const block = await parseBlock(fixture.hex, {
    height: 57043,
    classify: false,
    locate: false,
  });
  const layout = createBitmapLayout(block.txs);
  expect(layout.parcels.map((p) => p.size)).toEqual([5, 7]);
  expect(layout.parcels.map((p) => p.txIndex)).toEqual([0, 1]);
  expect(layout.parcels.map((p) => p.txid)).toEqual(
    block.txs.map((t) => t.txid),
  );
  const original = new MondrianLayout([5, 7]);
  expect({ width: layout.width, height: layout.height }).toEqual(
    original.getSize(),
  );
  expect(
    layout.parcels.map((p) => ({ position: { x: p.x, y: p.y }, size: p.size })),
  ).toEqual(original.slots);
  expect(layout.parcels[1]?.totalSats).toBe("1000000000000");
});

test("lotes de um bloco denso não se sobrepõem e ficam dentro dos limites", () => {
  const txs = Array.from({ length: 3509 }, (_, i) => ({
    index: i,
    txid: i.toString(16).padStart(64, "0"),
    outputs: [{ value: i % 17 === 0 ? 0 : 10 ** (5 + (i % 8)) }],
  })) as ParsedTransaction[];
  const layout = createBitmapLayout(txs);
  expect(layout.parcels).toHaveLength(3509);
  const occupied = new Set<string>();
  let overlaps = 0,
    outOfBounds = 0;
  for (const parcel of layout.parcels) {
    if (
      parcel.x < 0 ||
      parcel.y < 0 ||
      parcel.x + parcel.size > layout.width ||
      parcel.y + parcel.size > layout.height
    )
      outOfBounds++;
    for (let y = parcel.y; y < parcel.y + parcel.size; y++)
      for (let x = parcel.x; x < parcel.x + parcel.size; x++) {
        const key = `${x},${y}`;
        if (occupied.has(key)) overlaps++;
        occupied.add(key);
      }
  }
  expect(overlaps).toBe(0);
  expect(outOfBounds).toBe(0);
});

test("soma exata das saídas e entradas vazias/zero não omitem transações", () => {
  const txs = [
    {
      index: 0,
      txid: "a".repeat(64),
      outputs: [{ value: 500_000 }, { value: 500_001 }],
    },
    { index: 1, txid: "b".repeat(64), outputs: [] },
  ] as ParsedTransaction[];
  expect(createBitmapLayout(txs).parcels.map((p) => p.size)).toEqual([2, 1]);
  expect(createBitmapLayout([])).toEqual({ width: 0, height: 0, parcels: [] });
  expect(() =>
    createBitmapLayout([
      { ...txs[0]!, outputs: [{ value: -1 }] },
    ] as ParsedTransaction[]),
  ).toThrow();
});
