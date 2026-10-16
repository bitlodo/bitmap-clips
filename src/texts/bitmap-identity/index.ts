import {z} from 'zod';
import {defineText} from '../types';
export const bitmapIdentity=defineText({
 id:'bitmap-identity',version:1,name:'Bitmap identity',description:'Bitmap number, Bitcoin label and source hash around the frame.',glyph:'⌗',layout:'frame',duration:{min:15,default:150},
 schema:z.object({}),controls:[],supportedProperties:['Bitmap name','Block hash'],
 build(context,_settings,common){return {common,summary:`${context.data.height}.bitmap · BITCOIN · ${context.data.hash.slice(-10)}`,titles:[],identity:true};},
});
