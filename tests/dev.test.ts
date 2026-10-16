import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createDevHandler, reloadScript, watchFrontend } from '../scripts/dev';
import { createHandler } from '../src/http';

test('dev injects external reload script; production and non-HTML assets stay unchanged',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'bitmap-dev-http-'));
  try{
    await writeFile(join(directory,'index.html'),'<html><body>Editor</body></html>');
    await writeFile(join(directory,'worker.js'),'postMessage("ready")');
    let version='session:0';const handle=createDevHandler(directory,()=>version);
    const response=await handle(new Request('http://localhost/'));
    expect(await response.text()).toContain('<script src="/__dev/reload.js" defer></script>');
    expect(response.status).toBe(200);
    expect(await (await handle(new Request('http://localhost/worker.js'))).text()).toBe('postMessage("ready")');
    version='session:1';expect(await (await handle(new Request('http://localhost/__dev/version'))).text()).toBe(version);
    const script=await handle(new Request('http://localhost/__dev/reload.js'));expect(script.headers.get('Content-Type')).toBe('text/javascript');expect(await script.text()).toBe(reloadScript);
    const production=createHandler(directory);
    expect(await (await production(new Request('http://localhost/'))).text()).not.toContain('__dev');
    expect((await production(new Request('http://localhost/__dev/version'))).status).toBe(404);
    expect((await handle(new Request('http://localhost/__dev/version',{method:'POST'}))).status).toBe(405);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('browser reload waits for a changed version and retries failed requests',async()=>{
  let next:string|Error='session:0',reloads=0,check:(()=>Promise<void>)|undefined;
  const fetcher=async()=>{if(next instanceof Error)throw next;return new Response(next);};
  runInNewContext(reloadScript,{fetch:fetcher,location:{reload(){reloads++;}},setTimeout(callback:()=>Promise<void>){check=callback;}});
  await Bun.sleep(10);expect(reloads).toBe(0);expect(check).toBeDefined();
  await check!();expect(reloads).toBe(0);
  next=new Error('restarting');await check!();expect(reloads).toBe(0);
  next='session:1';await check!();expect(reloads).toBe(1);
});

test('recursive watcher rebuilds nested files, recovers from failure and serializes edits during builds',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'bitmap-dev-watch-')),nested=join(directory,'clips');await mkdir(nested);
  const filename=join(nested,'clip.ts');await writeFile(filename,'initial');
  let updates=0,failures=0,active=0,maxActive=0,block=false;
  let release:(()=>void)|undefined;
  const until=async(predicate:()=>boolean)=>{const deadline=Date.now()+3000;while(!predicate()){if(Date.now()>deadline)throw Error('Watcher timed out');await Bun.sleep(10);}};
  const close=watchFrontend([directory],async()=>{
    active++;maxActive=Math.max(maxActive,active);
    try{if(block){block=false;await new Promise<void>(resolve=>release=resolve);}
      if(await Bun.file(filename).text()==='invalid')throw Error('invalid source');
    }finally{active--;}
  },()=>updates++,()=>failures++,20);
  try{
    await writeFile(filename,'edited');await until(()=>updates>=1);
    await writeFile(filename,'invalid');await until(()=>failures>=1);const previous=updates;
    await writeFile(filename,'fixed');await until(()=>updates>previous);
    block=true;await writeFile(filename,'building');await until(()=>release!==undefined);
    const before=updates;await writeFile(filename,'edited while building');await Bun.sleep(60);release!();await until(()=>updates>=before+2);
    expect(maxActive).toBe(1);
    close();const stopped=updates;await writeFile(filename,'closed');await Bun.sleep(60);expect(updates).toBe(stopped);
  }finally{release?.();close();await rm(directory,{recursive:true,force:true});}
});
