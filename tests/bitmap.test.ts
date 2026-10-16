import { describe, expect, test } from "bun:test";
import { BitmapExplorer, parseBitmap } from "../src/lib/bitmap";
import { BitmapIndex, decodePage, OCI_PAGES } from "../src/lib/oci";
import { OrdinalsClient } from "../src/lib/ordinals";
import { parseBlock, listInscriptions } from "../src/vendor/block-parser.js";
import live from "./fixtures/57043-live.json";

function mockClient(
  responses: Record<string, unknown>,
  statuses: Record<string, number> = {},
) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const path = String(input).replace("https://ord.test", "");
    calls.push(path);
    if (!(path in responses)) throw new Error(`Unexpected request ${path}`);
    const data = responses[path];
    return new Response(
      typeof data === "string" ? data : JSON.stringify(data),
      { status: statuses[path] ?? 200 },
    );
  }) as typeof fetch;
  return { client: new OrdinalsClient("https://ord.test", fetcher), calls };
}
const push = (hex: string) =>
  (hex.length / 2).toString(16).padStart(2, "0") + hex;
const hexText = (s: string) => Buffer.from(s).toString("hex");
function envelope(body: string, tags = "", complete = true) {
  return (
    "0063036f7264" + tags + "00" + push(hexText(body)) + (complete ? "68" : "")
  );
}
/** Blocos sintéticos apenas para testar serialização e ordem, sem validade de consenso. */
function blockWithScripts(scripts: string[]) {
  const txs = scripts.map(
    (script, i) =>
      "02000000000101" +
      (i + 1).toString(16).padStart(2, "0").repeat(32) +
      "0000000000ffffffff012202000000000000015102" +
      push(script) +
      push("c0" + "00".repeat(32)) +
      "00000000",
  );
  return (
    "00".repeat(80) +
    scripts.length.toString(16).padStart(2, "0") +
    txs.join("")
  );
}

describe("entrada e páginas OCI", () => {
  test("aceita bloco zero e normaliza zeros à esquerda", () => {
    expect(parseBitmap("0")).toBe(0);
    expect(parseBitmap("0057043")).toBe(57043);
  });
  test("rejeita decimais, sinal, notação exponencial e inteiros inseguros", () => {
    for (const value of [
      "",
      "-1",
      "+1",
      "1.5",
      "1e5",
      "NaN",
      "9007199254740992",
      "57043.bitmap",
    ])
      expect(() => parseBitmap(value)).toThrow();
  });
  test("decodifica JSON dentro de string JSON e permutação", () => {
    expect(
      decodePage(
        JSON.stringify(
          JSON.stringify([
            [100, 3, 5],
            [2, 0, 1],
          ]),
        ),
        0,
      ).sats,
    ).toEqual([103, 108, 100]);
  });
  test("preserva o item 99999 das duas metades das páginas 2 e 3", () => {
    const raw = [
      ...Array.from({ length: 100000 }, (_, i) => (i ? 1 : 100)),
      ...Array.from({ length: 100000 }, (_, i) => i),
    ].join(",");
    for (const page of [2, 3]) {
      const decoded = decodePage(raw, page);
      expect(decoded.sats).toHaveLength(100000);
      expect(decoded.sats[99999]).toBe(100099);
    }
  });
  test("decodifica deltas negativos e índices de reinscrição", () => {
    expect(
      decodePage(
        JSON.stringify({
          deltaEncodedSats: [1000, -5, 2],
          satIndexMap: { "840151": 1 },
        }),
        9,
      ),
    ).toEqual({ sats: [1000, 995, 997], indices: { "840151": 1 } });
  });
  test("rejeita índices duplicados, inválidos e números inseguros", () => {
    for (const data of [
      [
        [100, 2],
        [0, 0],
      ],
      [
        [100, 2],
        [0, 3],
      ],
      [[9007199254740992], [0]],
      [["1x"], [0]],
    ])
      expect(() => decodePage(JSON.stringify(data), 0)).toThrow();
  });
  test("respeita os limites 839999, 840000, 906999, 907000 e 941999", async () => {
    const r = mockClient({
      [`/content/${OCI_PAGES[8]}`]: JSON.stringify([[20], [0]]),
      [`/content/${OCI_PAGES[9]}`]: {
        deltaEncodedSats: Array(67000).fill(1),
        satIndexMap: {},
      },
      [`/content/${OCI_PAGES[10]}`]: {
        deltaEncodedSats: Array(35000).fill(1),
        satIndexMap: {},
      },
      "/r/sat/1/at/0": { id: live.id },
      "/r/sat/67000/at/0": { id: live.id },
      "/r/sat/35000/at/0": { id: live.id },
    });
    const index = new BitmapIndex(r.client);
    for (const n of [840000, 906999, 907000, 941999])
      expect(await index.lookup(n)).toBe(live.id);
    expect(r.calls.filter((p) => p.startsWith("/content/"))).toHaveLength(2);
    await expect(index.lookup(839999)).rejects.toThrow("does not contain");
  });
  test("usa o índice da inscription no sat, inclusive zero como sat válido", async () => {
    const r = mockClient({
      [`/content/${OCI_PAGES[9]}`]: {
        deltaEncodedSats: Array(152).fill(0),
        satIndexMap: { 840151: 1 },
      },
      "/r/sat/0/at/1": { id: live.id },
    });
    expect(await new BitmapIndex(r.client).lookup(840151)).toBe(live.id);
    expect(r.calls.at(-1)).toBe("/r/sat/0/at/1");
  });
});

describe("consulta de inscription", () => {
  function historic(
    content = "57043.bitmap",
    detailStatus = live.responses[
      `/inscription/${live.id}` as keyof typeof live.responses
    ]!.status,
  ) {
    const sats = Array(57044).fill(0);
    sats[57043] = live.sat;
    const responses: Record<string, unknown> = {
      [`/content/${OCI_PAGES[0]}`]: JSON.stringify([
        sats,
        Array.from({ length: 57044 }, (_, i) => i),
      ]),
      [`/r/sat/${live.sat}/at/0`]: { id: live.id },
    };
    for (const [path, response] of Object.entries(live.responses))
      responses[path] = response.body;
    responses[`/content/${live.id}`] = content;
    return mockClient(responses, { [`/inscription/${live.id}`]: detailStatus });
  }
  test("consulta conteúdo e dados reais capturados do Ordinals", async () => {
    const { client } = historic();
    const r = await new BitmapExplorer(client).lookup(57043);
    expect(r?.id).toBe(live.id);
    expect(r?.content).toBe("57043.bitmap");
    expect(r?.info.number).toBe(10699366);
    expect(r?.info.height).toBe(792752);
    expect(r?.warnings).toHaveLength(2);
  });
  test("não confirma índice cujo conteúdo tem espaços ou nova linha", async () => {
    for (const content of ["57043.bitmap\n", "57043.bitmap ", "57044.bitmap"])
      await expect(
        new BitmapExplorer(historic(content).client).lookup(57043),
      ).rejects.toThrow("content differs");
  });
  test("usa dados recursivos se API completa estiver indisponível (406)", async () => {
    const r = await new BitmapExplorer(
      historic("57043.bitmap", 406).client,
    ).lookup(57043);
    expect(r?.info.id).toBe(live.id);
    expect(r?.warnings).toHaveLength(2);
  });
  test("erro HTTP e rate limit não viram bitmap não encontrado", async () => {
    const r = mockClient({ "/r/blockheight": {} }, { "/r/blockheight": 429 });
    await expect(new BitmapExplorer(r.client).lookup(0)).rejects.toThrow("429");
    const h = historic("57043.bitmap", 500);
    await expect(new BitmapExplorer(h.client).lookup(57043)).rejects.toThrow(
      "500",
    );
  });
  test("não percorre blocos futuros", async () => {
    const r = mockClient({ "/r/blockheight": 942000 });
    await expect(new BitmapExplorer(r.client).lookup(942001)).rejects.toThrow(
      "not indexed yet",
    );
    expect(r.calls).toHaveLength(1);
  });
  test("cancelamento interrompe antes de acessar a rede", async () => {
    const c = new AbortController();
    c.abort();
    const r = mockClient({});
    await expect(
      new BitmapExplorer(r.client).lookup(0, () => {}, c.signal),
    ).rejects.toThrow();
    expect(r.calls).toHaveLength(0);
  });
});

describe("busca por blocos recentes", () => {
  test("ignora conteúdo incorreto, incompleto, encoding vazio e delegate inválido; escolhe a primeira válida", async () => {
    const hex = blockWithScripts([
      envelope("942000.bitmap\n"),
      envelope("942000.bitmap", "", false),
      envelope("942000.bitmap", "010900"),
      envelope("942000.bitmap", "010b0100"),
      envelope("942000.bitmap") + envelope("942000.bitmap"),
      envelope("942000.bitmap"),
    ]);
    const parsed = listInscriptions(
      await parseBlock(hex, { height: 942000, classify: false, locate: false }),
    );
    expect(parsed).toHaveLength(7);
    const id = parsed[4]!.id;
    const r = mockClient({
      "/r/blockheight": 942005,
      "/r/block/942000": JSON.stringify(hex),
      [`/r/inscription/${id}`]: { id, delegate: null },
      [`/content/${id}`]: "942000.bitmap",
      [`/inscription/${id}`]: { id },
    });
    expect((await new BitmapExplorer(r.client).lookup(942000))?.id).toBe(id);
    expect(id.endsWith("i0")).toBe(true);
    expect(r.calls).not.toContain("/r/block/942001");
  });
  test("segue para o próximo bloco e diferencia ausência de falha de rede", async () => {
    const empty = blockWithScripts([envelope("outra inscription")]);
    const r = mockClient({
      "/r/blockheight": 942001,
      "/r/block/942000": JSON.stringify(empty),
      "/r/block/942001": JSON.stringify(empty),
    });
    expect(await new BitmapExplorer(r.client).lookup(942000)).toBeNull();
    expect(r.calls).toEqual([
      "/r/blockheight",
      "/r/block/942000",
      "/r/block/942001",
    ]);
    const failure = mockClient(
      { "/r/blockheight": 942001, "/r/block/942000": "error" },
      { "/r/block/942000": 404 },
    );
    await expect(
      new BitmapExplorer(failure.client).lookup(942000),
    ).rejects.toThrow("404");
  });
});
