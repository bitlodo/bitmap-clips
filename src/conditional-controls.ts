export interface ConditionalControl {key:string;when?:{key:string;value:unknown};}
/** Render dependencies directly beneath their controlling field, including nested groups. */
export function conditionalControls<T extends ConditionalControl>(controls:readonly T[],settings:Record<string,unknown>,render:(control:T)=>string):string{
 const active=(c:T,path=new Set<string>()):boolean=>{
  if(!c.when)return true;if(path.has(c.key)||settings[c.when.key]!==c.when.value)return false;
  const parents=controls.filter(parent=>parent.key===c.when!.key);
  return !parents.length||parents.some(parent=>active(parent,new Set(path).add(c.key)));
 };
 const visible=controls.filter(c=>active(c));
 const renderNode=(control:T,path:Set<string>):string=>{
  const own=render(control);if(!own)return '';
  const children=visible.filter(c=>c.when?.key===control.key&&!path.has(c.key));
  if(!children.length)return own;
  const next=new Set(path).add(control.key);
  return `<div class="conditional-group">${own}<div class="conditional-fields">${children.map(c=>renderNode(c,next)).join('')}</div></div>`;
 };
 return visible.filter(c=>!c.when||!visible.some(parent=>parent.key===c.when!.key)).map(c=>renderNode(c,new Set())).join('');
}
