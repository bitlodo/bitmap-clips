import { expect, test } from "bun:test";
import { lookupBlock } from "../src/lib/block";
import { stringifyData } from "../src/lib/json";
import { OrdinalsClient } from "../src/lib/ordinals";
import fixture from "./fixtures/block-57043-live.json";

function client(
  info: unknown = fixture.info,
  status = 200,
  hex: unknown = fixture.hex,
) {
  const paths: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const path = String(input);
    paths.push(path);
    return Response.json(path.endsWith("/r/block/57043") ? hex : info, {
      status: path.endsWith("/r/block/57043") ? 200 : status,
    });
  }) as typeof fetch;
  return { api: new OrdinalsClient("https://ord.test", fetcher), paths };
}

test("exibe o bloco do bitmap e todas as transações em ordem com fixture real", async () => {
  const mock = client();
  const result = await lookupBlock(57043, mock.api);
  expect(result.height).toBe(57043);
  expect(result.block.hash).toBe(fixture.info.hash);
  expect(result.block.txCount).toBe(2);
  expect(result.block.txs).toHaveLength(2);
  expect(result.block.txs[0]?.isCoinbase).toBe(true);
  expect(result.block.txs[1]?.isCoinbase).toBe(false);
  expect(result.block.txs.map((tx) => tx.index)).toEqual([0, 1]);
  expect(result.block.txs[1]?.inputs.length).toBeGreaterThan(0);
  expect(result.block.txs[1]?.outputs[0]?.value).toBeGreaterThan(0);
  // O tamanho bruto inclui header e coinbase, além das transações das estatísticas.
  expect(result.block.size).toBe(fixture.hex.length / 2);
  expect(result.weight).toBe(result.block.size * 4);
  expect(result.block.txs[1]?.fee).toBeNull();
  expect(mock.paths.sort()).toEqual([
    "https://ord.test/r/block/57043",
    "https://ord.test/r/blockinfo/57043",
  ]);
});

test("exibe os dados extraídos se o resumo não estiver disponível", async () => {
  const result = await lookupBlock(57043, client({}, 404).api);
  expect(result.info.hash).toBe(fixture.info.hash);
  expect(result.warnings).toHaveLength(1);
  expect(result.info.confirmations).toBeUndefined();
});

test("rejeita resumo de outro bloco ou contagem divergente", async () => {
  for (const info of [
    { ...fixture.info, height: 792752 },
    { ...fixture.info, hash: "00".repeat(32) },
    { ...fixture.info, transaction_count: 3 },
  ])
    await expect(lookupBlock(57043, client(info).api)).rejects.toThrow(
      "does not match",
    );
});

test("falha de rede no resumo e invalid block não viram resultado parcial silencioso", async () => {
  await expect(lookupBlock(57043, client({}, 429).api)).rejects.toThrow("429");
  await expect(
    lookupBlock(57043, client(fixture.info, 200, "invalid").api),
  ).rejects.toThrow("invalid block");
});

test("cancelamento de bloco não acessa a rede", async () => {
  const c = new AbortController();
  c.abort();
  const mock = client();
  await expect(
    lookupBlock(57043, mock.api, () => {}, c.signal),
  ).rejects.toThrow();
  expect(mock.paths).toHaveLength(0);
});

test("exportação JSON preserva valores BigInt como strings", () => {
  expect(JSON.parse(stringifyData({ rune: 9007199254740993n }))).toEqual({
    rune: "9007199254740993",
  });
});

test("blockinfo is requested directly from Ordinals", async () => {
 const calls:string[]=[];
 const api=new OrdinalsClient(undefined,(async(input)=>{calls.push(String(input));return Response.json(fixture.info);}) as typeof fetch);
 await api.json('/r/blockinfo/57043');
 expect(calls).toEqual(['https://ordinals.com/r/blockinfo/57043']);
});
