import {z} from 'zod';
import {infoBlocks,textTemplates,type TextTemplate} from '../../editor-model';
import {defineText,type TextControl} from '../types';
import {title} from '../shared';

const schema=z.object({
  source:z.enum(['manual','identity','transactions','transaction','volume']).default('manual'),
  text:z.string().max(500).default('Your message here'),kicker:z.string().max(100).default(''),txIndex:z.number().int().min(0).default(0),
});
const controls:readonly TextControl<keyof z.output<typeof schema>>[]=[
  {key:'source',label:'Content source',kind:'select',options:[{value:'manual',label:'Write text'},{value:'identity',label:'Bitmap name'},{value:'transactions',label:'Transaction count'},{value:'volume',label:'Block output value'},{value:'transaction',label:'Transaction output value'}]},
  {key:'txIndex',label:'Transaction index',kind:'number',min:0,step:1,when:{key:'source',value:'transaction'}},
  {key:'kicker',label:'Eyebrow',kind:'text',maxLength:100,when:{key:'source',value:'manual'}},
  {key:'text',label:'Main text',kind:'textarea',maxLength:500,when:{key:'source',value:'manual'}},
];
function classic(id:Exclude<TextTemplate,'caption'>){
  const ownControls=id==='callout'?controls.map(c=>c.key==='txIndex'?{...c,when:undefined}:c):controls;
  return defineText({id,version:1,...textTemplates[id],layout:'screen',duration:{min:15,default:90},schema,controls:ownControls,supportedProperties:['Custom text','Bitmap name','TX count','Output value','TX index','Parcel size'],
    build(context,s,c){
      if((s.source==='transaction'||id==='callout')&&!context.data.layout.parcels.some(p=>p.txIndex===s.txIndex))throw Error('Invalid text transaction.');
      const content=s.source==='manual'?s:infoBlocks(context.data,s.txIndex).find(b=>b.key===s.source)!;
      return {common:c,summary:content.text,titles:[title(c,id,content.text,content.kicker,s.txIndex)]};
    },
  });
}
export const classicTexts=(['cinematic','terminal','counter','card','callout','poster'] as const).map(classic);
