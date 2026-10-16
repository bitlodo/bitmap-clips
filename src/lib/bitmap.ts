import {
  parseBlock,
  listInscriptions,
  toHex,
  type ParsedInscription,
} from "../vendor/block-parser.js";
import { BitmapIndex, OCI_LIMIT } from "./oci";
import { OrdinalsClient, OrdinalsError } from "./ordinals";
import type { BitmapResult, InscriptionInfo, Progress } from "./types";

export { parseBitmap } from "./validation";

export function isValidBitmap(
  inscription: ParsedInscription,
  bitmap: number,
): boolean {
  return (
    inscription.complete === true &&
    inscription.bodyHex ===
      toHex(new TextEncoder().encode(`${bitmap}.bitmap`)) &&
    inscription.contentEncoding === null &&
    inscription.delegate === null &&
    !inscription.hasContentEncoding &&
    !inscription.hasDelegate
  );
}

export class BitmapExplorer {
  private index: BitmapIndex;
  constructor(private client = new OrdinalsClient()) {
    this.index = new BitmapIndex(client);
  }

  async lookup(
    bitmap: number,
    progress: (p: Progress) => void = () => {},
    signal?: AbortSignal,
  ): Promise<BitmapResult | null> {
    if (!Number.isSafeInteger(bitmap) || bitmap < 0)
      throw new Error("Invalid bitmap number.");
    progress({ message: "Checking the latest indexed block…" });
    const tip = await this.client.json<number>("/r/blockheight", signal);
    if (!Number.isSafeInteger(tip) || tip < 0)
      throw new OrdinalsError("Ordinals returned an invalid block height.");
    if (bitmap > tip)
      throw new Error(
        `Block ${bitmap} is not indexed yet. Latest available block: ${tip}.`,
      );
    let id: string | null = null;
    const source = bitmap < OCI_LIMIT ? "oci" : "blocks";
    if (source === "oci") {
      progress({
        message: "Reading the on-chain index and locating the inscription…",
      });
      id = await this.index.lookup(bitmap, signal);
    } else {
      for (let height = bitmap; height <= tip; height++) {
        signal?.throwIfAborted();
        progress({
          message: `Checking block ${height.toLocaleString("en-US")} of ${tip.toLocaleString("en-US")}…`,
          height,
          tip,
        });
        // JSON string from the recursive API. Parser order follows block order.
        const hex = await this.client.json<string>(
          `/r/block/${height}`,
          signal,
        );
        if (
          typeof hex !== "string" ||
          hex.length < 160 ||
          hex.length % 2 ||
          !/^[a-fA-F0-9]+$/.test(hex)
        )
          throw new OrdinalsError(`Invalid block ${height}.`);
        const block = await parseBlock(hex, {
          height,
          classify: false,
          locate: false,
        });
        const match = listInscriptions(block).find((item) =>
          isValidBitmap(item, bitmap),
        );
        if (match) {
          id = match.id;
          break;
        }
      }
    }
    if (!id) return null;
    progress({
      message: "Querying data and checking inscription content…",
    });
    const [recursiveInfo, content] = await Promise.all([
      this.client.json<Record<string, unknown>>(`/r/inscription/${id}`, signal),
      this.client.text(`/content/${id}`, signal),
    ]);
    if (content !== `${bitmap}.bitmap`)
      throw new Error(
        `The inscription content differs from ${bitmap}.bitmap. The index result could not be verified.`,
      );
    if (
      recursiveInfo.delegate != null ||
      recursiveInfo.content_encoding != null
    )
      throw new Error(
        "The inscription has a delegate or encoding and does not meet LiveOCI rules.",
      );
    const warnings =
      source === "oci"
        ? [
            "The OCI index below 942000 is experimental and reports discrepancies. Content was verified; this does not prove it is the first valid claim.",
          ]
        : [];
    let info: InscriptionInfo;
    try {
      info = await this.client.json<InscriptionInfo>(
        `/inscription/${id}`,
        signal,
      );
      if (info.id !== id)
        throw new OrdinalsError(
          "The received data does not match the inscription.",
        );
    } catch (error) {
      if (
        !(error instanceof OrdinalsError) ||
        (error.status !== 404 && error.status !== 406)
      )
        throw error;
      info = { ...recursiveInfo, id };
      warnings.push(
        "This server does not expose full JSON details. Showing recursive API data.",
      );
    }
    return {
      bitmap,
      id,
      content,
      info,
      recursiveInfo,
      source,
      tip,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }
}
