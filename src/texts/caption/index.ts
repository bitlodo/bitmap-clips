import {z} from 'zod';
import {defineText} from '../types';
import {title} from '../shared';

export const caption=defineText({
  id:'caption',version:1,name:'Text badge',description:'A compact message with one text field.',glyph:'[ T ]',layout:'screen',duration:{min:15,default:90},
  supportedProperties:['Custom text'],
  schema:z.object({text:z.string().max(500).default('Your message here')}),
  controls:[{key:'text',label:'Message',kind:'textarea',maxLength:500}],
  build(_context,s,c){return {common:c,summary:s.text,titles:[title(c,'caption',s.text)]};},
});
