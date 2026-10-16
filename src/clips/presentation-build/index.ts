import {defineClip} from '../types';
import {presentation} from '../presentation';

export const scene=defineClip({
 id:'presentation-build',version:1,category:'Presentation',name:'Build',description:'Grow the cubes into place, sequentially or randomly.',complexity:'simple',glyph:'◒',
 duration:presentation.duration,cameraControls:presentation.cameraControls,
 schema:presentation.settingsSchema.omit({assembly:true}),
 controls:presentation.controls.filter(control=>control.key!=='assembly'&&(!control.when||control.when.value==='build')).map(({when,...control})=>control) as import('../types').Control<Exclude<keyof import('zod').z.output<typeof presentation.settingsSchema>,'assembly'>>[],
 build(context,settings,common){return presentation.build(context,presentation.schema.parse({...settings,assembly:'build'}),common);},
});
