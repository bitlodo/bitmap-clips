/** Contrato das funções usadas do parser original de boppleton. */
export interface ParsedInscription {
  id: string;
  bodyHex: string;
  complete: boolean;
  contentEncoding: string | null;
  delegate: string | null;
  hasContentEncoding?: boolean;
  hasDelegate?: boolean;
  contentType?: string | null;
  bodyLength?: number;
  text?: string | null;
  [key: string]: unknown;
}
export interface ParsedInput {
  index: number;
  txid: string;
  vout: number;
  sequence: number;
  scriptSig: string;
  witness: {
    items: string[];
    type?: string;
    inscriptions?: ParsedInscription[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}
export interface ParsedOutput {
  index: number;
  value: number;
  script: string;
  scriptType: string;
  address: string | null;
}
export interface ParsedTransaction {
  index: number;
  txid: string;
  isCoinbase: boolean;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  vsize: number;
  inputs: ParsedInput[];
  outputs: ParsedOutput[];
  kind?: string;
  summary?: string;
  fee?: number | null;
  feeRate?: number | null;
  [key: string]: unknown;
}
export interface ParsedBlock {
  hash: string;
  height: number | null;
  version: number;
  prevHash: string;
  merkleRoot: string;
  time: number;
  bits: number;
  nonce: number;
  size: number;
  txCount: number;
  txs: ParsedTransaction[];
  [key: string]: unknown;
}
export function parseBlock(
  hex: string,
  options: { height?: number; classify: boolean; locate: false },
): Promise<ParsedBlock>;
export function listInscriptions(block: ParsedBlock): ParsedInscription[];
export function toHex(bytes: Uint8Array): string;
