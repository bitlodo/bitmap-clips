import {test,expect} from 'bun:test';
import {resolve} from 'node:path';

test('dist contains a self-contained static frontend with subdirectory-safe assets and direct Ordinals requests',async()=>{
 const root=resolve(import.meta.dir,'../dist'),html=await Bun.file(resolve(root,'index.html')).text();
 const base=new URL('https://static.example/bitmap-clips/');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const url=new URL(match[1]!,base);
  expect(url.pathname.startsWith(base.pathname)).toBe(true);
  expect(await Bun.file(resolve(root,url.pathname.slice(base.pathname.length)||'index.html')).exists()).toBe(true);
 }
 expect(html).toContain('http-equiv="Content-Security-Policy"');
 expect(html).toContain("connect-src 'self' https://ordinals.com blob:");
 expect(html).toContain("'wasm-unsafe-eval'");
 for(const name of ['client.js','worker.js','physics-worker.js']){
  const code=await Bun.file(resolve(root,name)).text();
  expect(code).not.toContain('/api/ord');expect(code).not.toContain('/api/config');
 }
 expect(await Bun.file(resolve(root,'worker.js')).text()).toContain('https://ordinals.com');
 const client=await Bun.file(resolve(root,'client.js')).text();
 expect(client).toContain('./worker.js');expect(client).toContain('./physics-worker.js');
 expect(await Bun.file(resolve(root,'styles.css')).text()).toContain("url('./fonts/");
});
