import {z} from 'zod';
import {timelineModules} from '../src/timeline-modules';
import {mkdir,writeFile} from 'node:fs/promises';
import {clips} from '../src/clips/registry';
import {texts} from '../src/texts/registry';
import {timelineSchema,timelineControls} from '../src/timeline-contract';

await mkdir('docs/contracts',{recursive:true});
for(const clip of clips){
 const manifest={format:'bitmap-clip-contract',formatVersion:1,id:clip.id,settingsVersion:clip.version,name:clip.name,category:clip.category,description:clip.description,complexity:clip.complexity,durationFrames:clip.duration,controls:clip.controls,cameraControls:clip.cameraControls,timelineControls,modules:clip.modules.map(m=>m.id),settingsSchema:z.toJSONSchema(clip.settingsSchema,{io:'input'}),commonInstanceSchema:z.toJSONSchema(clip.instanceSchema),implementation:`src/clips/${clip.id}/index.ts`};
 await writeFile(`docs/contracts/${clip.id}.json`,JSON.stringify(manifest,null,2)+'\n');
}
for(const text of texts){
 const manifest={format:'bitmap-text-contract',formatVersion:1,id:text.id,settingsVersion:text.version,name:text.name,description:text.description,layout:text.layout,supportedProperties:text.supportedProperties,durationFrames:text.duration,controls:text.controls,timelineControls,modules:text.modules.map(m=>m.id),settingsSchema:z.toJSONSchema(text.settingsSchema,{io:'input'}),commonInstanceSchema:z.toJSONSchema(text.instanceSchema)};
 await writeFile(`docs/contracts/text-${text.id}.json`,JSON.stringify(manifest,null,2)+'\n');
}
console.log(`${clips.length} clip and ${texts.length} text contracts exported to docs/contracts/`);

await writeFile('docs/contracts/timeline.json',JSON.stringify({format:'bitmap-timeline-contract',formatVersion:1,controls:timelineControls,schema:z.toJSONSchema(timelineSchema)},null,2)+'\n');

for(const module of timelineModules)await writeFile(`docs/contracts/module-${module.id}.json`,JSON.stringify({id:module.id,label:module.label,settingsKeys:module.settingsKeys,instanceKeys:module.instanceKeys,schema:z.toJSONSchema(module.schema,{io:'input'})},null,2)+'\n');
