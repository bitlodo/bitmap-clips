/** Rune data from the original parser may contain BigInt values. */
export function stringifyData(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    2,
  );
}
