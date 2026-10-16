import { watch } from "node:fs";
import { resolve } from "node:path";
import { buildFrontend } from "./build";
import { createHandler } from "../src/http";

// External script respects the same CSP as the production app.
export const reloadScript = `(() => {
  let version;
  const check = async () => {
    try {
      const response = await fetch('/__dev/version', { cache: 'no-store' });
      if (!response.ok) return;
      const next = await response.text();
      if (version !== undefined && version !== next) { location.reload(); return; }
      version = next;
    } catch { /* Retry while the development server restarts. */ }
    finally { setTimeout(check, 500); }
  };
  void check();
})();`;

export function createDevHandler(directory:string, version:()=>string) {
  const handle=createHandler(directory);
  return async (request:Request):Promise<Response> => {
    const path=new URL(request.url).pathname;
    if(request.method==='GET'&&path==='/__dev/version')return new Response(version(),{headers:{'Cache-Control':'no-store'}});
    if(request.method==='GET'&&path==='/__dev/reload.js')return new Response(reloadScript,{headers:{'Content-Type':'text/javascript','Cache-Control':'no-store'}});
    const response=await handle(request);
    if(request.method==='GET'&&(path==='/'||path==='/index.html')&&response.status===200){
      return new HTMLRewriter().on('body',{element(element){element.append('<script src="/__dev/reload.js" defer></script>',{html:true});}}).transform(response);
    }
    return response;
  };
}

/** Debounce editor saves and serialize builds, including changes during a build. */
export function watchFrontend(directories:string[],build:()=>Promise<void>,updated:()=>void,onError:(error:unknown)=>void,delay=100) {
  let timer:ReturnType<typeof setTimeout>|undefined,running=false,pending=false,closed=false;
  const rebuild=async()=>{
    if(running||closed)return;
    running=true;
    try {
      while(pending&&!closed){
        pending=false;
        try{await build();if(!closed)updated();}catch(error){if(!closed)onError(error);}
      }
    } finally { running=false; }
  };
  const watchers=directories.map(directory=>watch(directory,{recursive:true},()=>{
    pending=true;clearTimeout(timer);timer=setTimeout(()=>void rebuild(),delay);
  }));
  for(const watcher of watchers)watcher.on('error',onError);
  return ()=>{closed=true;clearTimeout(timer);for(const watcher of watchers)watcher.close();};
}

if(import.meta.main){
  const root=resolve(import.meta.dir,'..'),directory=resolve(root,'.tmp/dev-dist');
  await buildFrontend(directory);
  const session=crypto.randomUUID();let revision=0;
  const server=Bun.serve({hostname:Bun.env.HOST??'127.0.0.1',port:Number(Bun.env.PORT??3001),fetch:createDevHandler(directory,()=>session+':'+revision)});
  const stopWatching=watchFrontend([resolve(root,'src'),resolve(root,'public')],()=>buildFrontend(directory),()=>{revision++;console.log('Frontend rebuilt. Browser will reload.');},error=>console.error('Build failed; waiting for the next edit.',error));
  const stop=()=>{stopWatching();server.stop(true);process.exit(0);};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  console.log(`Bitmap Studio dev: ${server.url} · automatic rebuild and browser reload`);
}
