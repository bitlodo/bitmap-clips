import {fontOptions,type TextStyle} from './text-style';
export function textStyleFields(style:TextStyle,prefix:string){
 return `<label for="${prefix}-font">Font</label><select id="${prefix}-font" data-text-style="font">${fontOptions.map(o=>`<option value="${o.value}"${o.value===style.font?' selected':''}>${o.label}</option>`).join('')}</select>`+
 (['color','secondaryColor','accent','panelColor'] as const).map(key=>`<label for="${prefix}-${key}">${{color:'Text color',secondaryColor:'Secondary color',accent:'Accent color',panelColor:'Panel color'}[key]}</label><input id="${prefix}-${key}" data-text-style="${key}" type="color" value="${style[key]}">`).join('');
}
