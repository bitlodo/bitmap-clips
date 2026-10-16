import { mkdir, copyFile, cp } from "node:fs/promises";
import { resolve } from "node:path";

import {generateTemplateCatalog} from "./template-catalog";

export async function buildFrontend(directory = resolve(import.meta.dir, "../dist")) {
  await generateTemplateCatalog();
  await mkdir(directory, { recursive: true });
  const result = await Bun.build({
    entrypoints: ["client.ts", "worker.ts", "physics-worker.ts"].map(name=>resolve(import.meta.dir,"../src",name)),
    outdir: directory,
    target: "browser",
    minify: true,
    sourcemap: "external",
  });
  if (!result.success) {
    throw new AggregateError(result.logs, "Frontend build failed.");
  }
  await cp(resolve(import.meta.dir,"../public/fonts"),resolve(directory,"fonts"),{recursive:true});
  await Promise.all(
    ["index.html", "styles.css", "favicon.svg"].map((name) =>
      copyFile(resolve(import.meta.dir,"../public",name), resolve(directory,name)),
    ),
  );
}

if (import.meta.main) {
  await buildFrontend();
  console.log("Interface built in dist/");
}
