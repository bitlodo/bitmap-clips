import {resolve} from 'node:path';

/** Optional local static preview server. The deployed app needs no API backend. */
export function createHandler(directory=resolve(import.meta.dir,'../dist')){
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const path=new URL(request.url).pathname;
  const file=path==='/'?'index.html':path.slice(1);
  if(!['index.html','client.js','worker.js','physics-worker.js','styles.css','favicon.svg','fonts/silkscreen/Silkscreen-Regular.ttf','fonts/silkscreen/OFL.txt'].includes(file))return new Response('Not found',{status:404});
  const asset=Bun.file(resolve(directory,file));
  if(!await asset.exists())return new Response('Run bun run build before starting.',{status:503});
  return new Response(request.method==='HEAD'?null:asset,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 };
}
