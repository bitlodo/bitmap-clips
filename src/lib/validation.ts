export function parseBitmap(value: string): number {
  if (!/^\d+$/.test(value))
    throw new Error(
      "Enter a whole block number greater than or equal to zero.",
    );
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error("The entered number is too large.");
  return number;
}
