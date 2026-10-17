import type {SceneStyle} from './scene-style';
export const sceneStyleControls=[
 {key:'cameraType',label:'Camera',options:[['perspective','Perspective'],['isometric','Isometric']]},
 {key:'backgroundColor',label:'Background',kind:'color'},
 {key:'accent',label:'Color',kind:'color'},
 {key:'material',label:'Material',options:[['solid','Solid'],['neon','Neon'],['wireframe','Wireframe'],['hologram','Hologram']]},
 {key:'cubeType',label:'Cube shape',options:[['square','Square corners'],['chamfered','Chamfered corners'],['rounded-small','Small rounded corners'],['rounded-large','Large rounded corners']]},
 {key:'lightIntensity',label:'Key light',max:8},
 {key:'ambientIntensity',label:'Ambient light',max:5},
 {key:'rimIntensity',label:'Rim light',max:8},
 {key:'bloom',label:'Glow',max:.6},
 {key:'lightRotation',label:'Light direction',min:-180,max:180,step:1,unit:'degrees'},
 {key:'shadows',label:'Shadows',kind:'checkbox'},
 {key:'shadowOpacity',label:'Shadow opacity',max:1,step:.01,unit:'percent',when:'shadows'},
 {key:'fog',label:'Fog',kind:'checkbox'},
 {key:'fogNear',label:'Fog near',kind:'number',max:20,step:.1,when:'fog'},
 {key:'fogFar',label:'Fog far',kind:'number',min:.1,max:40,step:.1,when:'fog'},
 {key:'grid',label:'Grid',kind:'checkbox'},
] as const satisfies readonly {key:keyof SceneStyle;label:string;kind?:string;options?:readonly (readonly [string,string])[];min?:number;max?:number;step?:number;unit?:string;when?:keyof SceneStyle}[];
export function sceneStyleFields(values:SceneStyle,prefix:string){
 const renderField=(control:typeof sceneStyleControls[number])=>{
  const c=control as {key:keyof SceneStyle;label:string;kind?:string;options?:readonly (readonly [string,string])[];min?:number;max?:number;step?:number;unit?:string;when?:keyof SceneStyle},value=values[c.key],id=prefix+'-'+c.key;
  const label=`<label for="${id}">${c.label}${c.unit?`<span class="field-value" data-style-value="${c.key}">${styleValue(value,c.unit)}</span>`:''}</label>`;
  const field=c.options?`${label}<select id="${id}" data-style="${c.key}">${c.options.map(([v,l])=>`<option value="${v}"${v===value?' selected':''}>${l}</option>`).join('')}</select>`:
   c.kind==='checkbox'?`<label class="check"><input id="${id}" data-style="${c.key}" type="checkbox"${value?' checked':''}>${c.label}</label>`:
   `${label}<input id="${id}" data-style="${c.key}" type="${c.kind??'range'}"${c.kind==='color'?'':` min="${c.min??0}" max="${c.max}" step="${c.step??.05}"`} value="${value}">`;
  return `<div>${field}</div>`;
 };
 return sceneStyleControls.filter(c=>!('when' in c)).map(c=>{
  const children=sceneStyleControls.filter(child=>'when' in child&&child.when===c.key);
  const field=renderField(c);
  return children.length?`<div class="conditional-group">${field}<div class="conditional-fields" data-style-when="${c.key}"${values[c.key]?'':' hidden'}>${children.map(renderField).join('')}</div></div>`:field;
 }).join('');
}
export function styleValue(value:unknown,unit:string){return unit==='percent'?Math.round(Number(value)*100)+'%':String(value)+'°';}
