import { OrdinalsClient, OrdinalsError } from "./ordinals";

export const OCI_LIMIT = 942000;
export const OCI_PAGES = [
  "01bba6c58af39d7f199aa2bceeaaba1ba91b23d2663bc4ef079a4b5e442dbf74i0",
  "bb01dfa977a5cd0ee6e900f1d1f896b5ec4b1e3c7b18f09c952f25af6591809fi0",
  "bb02e94f3062facf6aa2e47eeed348d017fd31c97614170dddb58fc59da304efi0",
  "bb037ec98e6700e8415f95d1f5ca1fe1ba23a3f0c5cb7284d877e9ac418d0d32i0",
  "bb9438f4345f223c6f4f92adf6db12a82c45d1724019ecd7b6af4fcc3f5786cei0",
  "bb0542d4606a9e7eb4f31051e91f7696040db06ca1383dff98505618c34d7df7i0",
  "bb06a4dffba42b6b513ddee452b40a67688562be4a1345127e4d57269e6b2ab6i0",
  "bb076934c1c22007b315dd1dc0f8c4a2f9d52f348320cfbadc7c0bd99eaa5e18i0",
  "bb986a1208380ec7db8df55a01c88c73a581069a51b5a2eb2734b41ba10b65c2i0",
  "b907b51a239e3a37f29f8222fb274f828c6ebf7b93ce501a55b7171daaa75758i0",
  "b942b6477c7da9090edb9751429ba9c3ba01b39ab972fc888d481f528e3e03c3i0",
] as const;
const SAT_INDICES: Record<number, number> = {
  92871: 1,
  92970: 1,
  123132: 1,
  365518: 1,
  700181: 1,
  826151: 1,
  827151: 1,
  828151: 1,
  828239: 1,
  828661: 1,
  829151: 1,
  830151: 1,
  832104: 2,
  832249: 2,
  832252: 2,
  832385: 4,
  833067: 1,
  833101: 3,
  833105: 4,
  833109: 4,
  833121: 8,
  834030: 2,
  834036: 2,
  834051: 17,
  834073: 4,
  836151: 1,
  837115: 2,
  837120: 2,
  837151: 1,
  837183: 3,
  837188: 2,
  838058: 5,
  838068: 2,
  838076: 2,
  838096: 1,
  838151: 1,
  838821: 1,
  839151: 1,
  839377: 1,
  839378: 2,
  839382: 2,
  839397: 1,
};
interface IndexPage {
  sats: number[];
  indices: Record<string, number>;
}
const invalid = () =>
  new OrdinalsError("The OCI index page has an invalid format.");

export function decodePage(raw: string, page: number): IndexPage {
  let data: unknown;
  try {
    data = page === 2 || page === 3 ? JSON.parse(`[${raw}]`) : JSON.parse(raw);
    // Some pages were inscribed as JSON inside a JSON string.
    for (let i = 0; i < 2 && typeof data === "string"; i++)
      data = JSON.parse(data);
  } catch {
    throw invalid();
  }
  let deltas: unknown[];
  let order: unknown[] | undefined;
  let indices: Record<string, number> = {};
  if (page >= 9) {
    const object = data as {
      deltaEncodedSats?: unknown;
      satIndexMap?: Record<string, number>;
    } | null;
    if (!object || !Array.isArray(object.deltaEncodedSats)) throw invalid();
    deltas = object.deltaEncodedSats;
    indices = object.satIndexMap ?? {};
  } else {
    if (!Array.isArray(data)) throw invalid();
    if (page === 2 || page === 3) {
      if (data.length !== 200000) throw invalid();
      // The original module omits the last item in each half. Preserve all 100000.
      deltas = data.slice(0, 100000);
      order = data.slice(100000);
    } else {
      if (!Array.isArray(data[0]) || !Array.isArray(data[1])) throw invalid();
      deltas = data[0];
      order = data[1];
    }
  }
  let total = 0;
  const full = deltas.map((delta) => {
    const n =
      typeof delta === "string" && /^-?\d+$/.test(delta)
        ? Number(delta)
        : delta;
    if (typeof n !== "number" || !Number.isSafeInteger(n)) throw invalid();
    total += n;
    if (!Number.isSafeInteger(total) || total < 0) throw invalid();
    return total;
  });
  if (!order) return { sats: full, indices };
  if (order.length !== full.length) throw invalid();
  const sats = new Array<number>(full.length);
  order.forEach((offset, i) => {
    if (
      typeof offset !== "number" ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset >= full.length ||
      sats[offset] !== undefined
    )
      throw invalid();
    sats[offset] = full[i]!;
  });
  return { sats, indices };
}

export class BitmapIndex {
  private pages = new Map<number, IndexPage>();
  constructor(private client: OrdinalsClient) {}

  async lookup(bitmap: number, signal?: AbortSignal): Promise<string> {
    const page =
      bitmap >= 907000
        ? 10
        : bitmap >= 840000
          ? 9
          : Math.floor(bitmap / 100000);
    let decoded = this.pages.get(page);
    if (!decoded) {
      const id = OCI_PAGES[page];
      if (!id) throw invalid();
      decoded = decodePage(
        await this.client.text(`/content/${id}`, signal),
        page,
      );
      this.pages.set(page, decoded);
    }
    const offset =
      bitmap >= 907000
        ? bitmap - 907000
        : bitmap >= 840000
          ? bitmap - 840000
          : bitmap % 100000;
    const sat = decoded.sats[offset];
    if (sat === undefined)
      throw new OrdinalsError(`The OCI index does not contain ${bitmap}.bitmap.`);
    const index =
      bitmap >= 840000
        ? (decoded.indices[String(bitmap)] ?? 0)
        : (SAT_INDICES[bitmap] ?? 0);
    if (!Number.isSafeInteger(index) || index < 0) throw invalid();
    const result = await this.client.json<{ id: string | null }>(
      `/r/sat/${sat}/at/${index}`,
      signal,
    );
    if (!result.id || !/^[a-f0-9]{64}i\d+$/.test(result.id))
      throw new OrdinalsError(
        `The indexed sat did not return an inscription for ${bitmap}.bitmap.`,
      );
    return result.id;
  }
}
