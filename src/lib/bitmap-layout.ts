import MondrianLayout from "../vendor/mondrianLayout.js";
import type { ParsedTransaction } from "../vendor/block-parser.js";

export interface BitmapParcel {
  txIndex: number;
  txid: string;
  totalSats: string;
  x: number;
  y: number;
  size: number;
}
export interface BitmapLayout {
  width: number;
  height: number;
  parcels: BitmapParcel[];
}

/** max(1, ceil(log10(totalSats)) - 5), with exact thresholds at powers of ten. */
export function parcelSize(totalSats: bigint): number {
  if (totalSats < 0n) throw new Error("Invalid transaction value.");
  let size = 1,
    threshold = 1_000_000n;
  while (totalSats > threshold) {
    size++;
    threshold *= 10n;
  }
  return size;
}

export function createBitmapLayout(txs: ParsedTransaction[]): BitmapLayout {
  const values = txs.map((tx) =>
    tx.outputs.reduce((sum, output) => {
      if (!Number.isSafeInteger(output.value) || output.value < 0)
        throw new Error("Invalid output value for the layout.");
      return sum + BigInt(output.value);
    }, 0n),
  );
  // Never sort: the parcel index must retain its position in the Bitcoin block.
  const sizes = values.map(parcelSize);
  const mondrian = new MondrianLayout(sizes);
  return {
    ...mondrian.getSize(),
    parcels: mondrian.slots.map((slot, i) => ({
      txIndex: txs[i]!.index,
      txid: txs[i]!.txid,
      totalSats: values[i]!.toString(),
      x: slot.position.x,
      y: slot.position.y,
      size: slot.size,
    })),
  };
}
