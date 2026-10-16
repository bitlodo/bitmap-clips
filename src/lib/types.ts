export interface InscriptionInfo {
  id: string;
  number?: number;
  address?: string | null;
  sat?: number | null;
  satpoint?: string;
  height?: number;
  timestamp?: number;
  content_type?: string | null;
  content_length?: number;
  fee?: number;
  value?: number;
  [key: string]: unknown;
}
export interface BitmapResult {
  bitmap: number;
  id: string;
  content: string;
  info: InscriptionInfo;
  recursiveInfo: Record<string, unknown>;
  source: "oci" | "blocks";
  tip: number;
  checkedAt: string;
  warnings: string[];
}
export interface Progress {
  message: string;
  height?: number;
  tip?: number;
}
export type WorkerMessage =
  | { type: "progress"; scope: "inscription" | "block"; progress: Progress }
  | { type: "result"; result: BitmapResult | null }
  | { type: "error"; message: string }
  | { type: "block-result"; result: import("./block").BlockResult }
  | { type: "block-error"; message: string };
