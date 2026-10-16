import { createHandler } from "./http";

const server = Bun.serve({
  hostname: Bun.env.HOST ?? "127.0.0.1",
  port: Number(Bun.env.PORT ?? 3001),
  fetch: createHandler(),
});
console.log(`Bitmap Studio: ${server.url}`);
