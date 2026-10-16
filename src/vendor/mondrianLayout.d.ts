export interface MondrianSlot {
  position: { x: number; y: number };
  size: number;
}
export default class MondrianLayout {
  constructor(txList?: number[]);
  slots: MondrianSlot[];
  width: number;
  height: number;
  getSize(): { width: number; height: number };
}
