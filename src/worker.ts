import { BitmapExplorer } from "./lib/bitmap";
import { lookupBlock } from "./lib/block";
import type { WorkerMessage } from "./lib/types";

import {OrdinalsClient} from "./lib/ordinals";
const send = (message: WorkerMessage) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<{ bitmap: number; refetch?:boolean }>) => {
  const client=new OrdinalsClient(undefined,fetch,event.data.refetch?"no-store":"default");
  const explorer=new BitmapExplorer(client);
  const inscriptionTask = async () => {
    try {
      const result = await explorer.lookup(event.data.bitmap, (progress) =>
        send({ type: "progress", scope: "inscription", progress }),
      );
      send({ type: "result", result });
    } catch (error) {
      send({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not complete the lookup.",
      });
    }
  };
  const blockTask = async () => {
    try {
      const result = await lookupBlock(
        event.data.bitmap,
        client,
        (progress) => send({ type: "progress", scope: "block", progress }),
      );
      send({ type: "block-result", result });
    } catch (error) {
      send({
        type: "block-error",
        message:
          error instanceof Error
            ? error.message
            : "Could not load the block.",
      });
    }
  };
  await Promise.all([inscriptionTask(), blockTask()]);
};
