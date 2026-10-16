import { parseBlock, type ParsedBlock } from "../vendor/block-parser.js";
import { OrdinalsClient, OrdinalsError } from "./ordinals";
import type { Progress } from "./types";
import { createBitmapLayout, type BitmapLayout } from "./bitmap-layout";

export interface BlockInfo {
  height: number;
  hash: string;
  timestamp?: number;
  confirmations?: number;
  transaction_count?: number;
  total_size?: number;
  total_weight?: number;
  total_fee?: number;
  difficulty?: number;
  subsidy?: number;
  [key: string]: unknown;
}
export interface BlockResult {
  rawHex?: string;
  height: number;
  info: BlockInfo;
  block: ParsedBlock;
  weight: number;
  layout: BitmapLayout;
  warnings: string[];
  checkedAt: string;
}

export async function lookupBlock(
  height: number,
  client = new OrdinalsClient(),
  progress: (p: Progress) => void = () => {},
  signal?: AbortSignal,
): Promise<BlockResult> {
  if (!Number.isSafeInteger(height) || height < 0)
    throw new Error("Invalid block number.");
  progress({
    message: `Loading block ${height.toLocaleString("en-US")} and its transactions…`,
  });
  const warnings: string[] = [];
  const [hex, remoteInfo] = await Promise.all([
    client.json<string>(`/r/block/${height}`, signal),
    client.json<BlockInfo>(`/r/blockinfo/${height}`, signal).catch((error) => {
      if (
        !(error instanceof OrdinalsError) ||
        ![404, 406].includes(error.status ?? 0)
      )
        throw error;
      warnings.push(
        "Server summary unavailable. Showing data parsed from the block; confirmations and difficulty were not queried.",
      );
      return null;
    }),
  ]);
  if (
    typeof hex !== "string" ||
    hex.length < 160 ||
    hex.length % 2 ||
    !/^[a-fA-F0-9]+$/.test(hex)
  )
    throw new Error("The server returned an invalid block.");
  signal?.throwIfAborted();
  progress({ message: "Parsing all block transactions…" });
  const block = await parseBlock(hex, {
    height,
    classify: true,
    locate: false,
  });
  if (
    remoteInfo &&
    (remoteInfo.height !== height ||
      remoteInfo.hash !== block.hash ||
      remoteInfo.transaction_count !== block.txCount)
  ) {
    throw new Error(
      "The server summary does not match the received block. Try again.",
    );
  }
  const overhead = block.size - block.txs.reduce((sum, tx) => sum + tx.size, 0);
  const info: BlockInfo = remoteInfo ?? {
    height,
    hash: block.hash,
    timestamp: block.time,
    transaction_count: block.txCount,
    total_size: block.size,
    total_weight:
      overhead * 4 + block.txs.reduce((sum, tx) => sum + tx.weight, 0),
    ...(typeof block.totalFees === "number"
      ? { total_fee: block.totalFees }
      : {}),
    ...(typeof block.subsidy === "number" ? { subsidy: block.subsidy } : {}),
  };
  const weight =
    overhead * 4 + block.txs.reduce((sum, tx) => sum + tx.weight, 0);
  progress({ message: "Computing the bitmap’s Mondrian layout…" });
  const layout = createBitmapLayout(block.txs);
  return {
    rawHex: hex,
    height,
    info,
    block,
    weight,
    layout,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}
