import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateTemplateCatalog} from '../scripts/template-catalog';

test('catalog discovers exported JSON templates and removes deleted entries without manual registration',async()=>{
 const root=await mkdtemp(join(tmpdir(),'bitmap-template-catalog-'));
 try{
  await mkdir(join(root,'projects'));
  const project=join(root,'projects','my-project.json'),catalog=join(root,'catalog.generated.ts');
  await writeFile(project,JSON.stringify({name:'My project'}));
  await generateTemplateCatalog(root);
  expect(await readFile(catalog,'utf8')).toContain('defineExportedProjectTemplate("my-project",project0)');
  const before=(await stat(catalog)).mtimeMs;
  await generateTemplateCatalog(root);
  expect((await stat(catalog)).mtimeMs).toBe(before);
  await rm(project);await generateTemplateCatalog(root);
  expect(await readFile(catalog,'utf8')).not.toContain('my-project');
  await writeFile(project,JSON.stringify({film:{}}));
  await expect(generateTemplateCatalog(root)).rejects.toThrow('nonempty project name');
 }finally{await rm(root,{recursive:true,force:true});}
});
