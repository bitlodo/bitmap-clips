import {defineClip} from '../types';
import {presentation} from '../presentation';

export const scene=defineClip({
 id:'presentation-radial',version:1,category:'Presentation',name:'Radial',description:'Gather the cubes from a radial spread.',complexity:'simple',glyph:'◒',
 duration:presentation.duration,cameraControls:presentation.cameraControls,
 schema:presentation.settingsSchema.omit({assembly:true,buildOrder:true,bounceBack:true}),
 controls:presentation.controls.filter(control=>control.key!=='assembly'&&(!control.when||control.when.value==='scatter')).map(({when,...control})=>control) as import('../types').Control<Exclude<keyof import('zod').z.output<typeof presentation.settingsSchema>,'assembly'|'buildOrder'|'bounceBack'>>[],
 build(context,settings,common){return presentation.build(context,presentation.schema.parse({...settings,assembly:'scatter'}),common);},
});
