import {z} from 'zod';
const color=z.string().regex(/^#[a-f\d]{6}$/i);
export const fontOptions=[{value:'sans',label:'Sans · Arial'},{value:'modern',label:'Modern · Segoe UI'},{value:'serif',label:'Serif · Georgia'},{value:'mono',label:'Mono · Consolas'},{value:'classic',label:'Classic · Times New Roman'},{value:'bitmap',label:'Bitmap · Silkscreen'}] as const;
export const fontFamilies={bitmap:'Silkscreen, monospace',sans:'Arial, sans-serif',modern:"'Segoe UI', Arial, sans-serif",serif:'Georgia, serif',mono:'Consolas, monospace',classic:"'Times New Roman', serif"};
export const textStyleSchema=z.object({font:z.enum(['sans','modern','serif','mono','classic','bitmap']).default('modern'),color:color.default('#f2f5f5'),secondaryColor:color.default('#bbced4'),accent:color.default('#ffac4b'),panelColor:color.default('#111e28')});
export const textStyleOverrideSchema=z.object({font:z.enum(['sans','modern','serif','mono','classic','bitmap']).optional(),color:color.optional(),secondaryColor:color.optional(),accent:color.optional(),panelColor:color.optional()});
export type TextStyle=z.infer<typeof textStyleSchema>;
export const textThemes=[
 {id:'amber',name:'Amber',style:{font:'modern',color:'#f2f5f5',secondaryColor:'#bbced4',accent:'#ffac4b',panelColor:'#111e28'}},
 {id:'mint',name:'Mint',style:{font:'sans',color:'#e5fff4',secondaryColor:'#a4cfc0',accent:'#85dbc0',panelColor:'#10251f'}},
 {id:'editorial',name:'Editorial',style:{font:'serif',color:'#20212a',secondaryColor:'#555e67',accent:'#be5d26',panelColor:'#f9f6f0'}},
 {id:'terminal',name:'Terminal',style:{font:'mono',color:'#d0ffe2',secondaryColor:'#89bfa0',accent:'#62ef9c',panelColor:'#071810'}},
 {id:'bitmap',name:'Bitmap',style:{font:'bitmap',color:'#f2f5f5',secondaryColor:'#a6bec5',accent:'#ffac4b',panelColor:'#101820'}},
 {id:'classic',name:'Classic',style:{font:'classic',color:'#fff1cf',secondaryColor:'#d4c6a6',accent:'#e2bc6b',panelColor:'#251f17'}},
] as const satisfies readonly {id:string;name:string;style:TextStyle}[];
