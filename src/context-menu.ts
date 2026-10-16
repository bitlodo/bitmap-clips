import {CommandRegistry,type CommandContext} from './commands';
export class ContextMenu {
 private origin:(()=>HTMLElement|null)|undefined;
 get isOpen(){return !this.root.hidden;}
 constructor(private root:HTMLElement,private commands:CommandRegistry){
  root.addEventListener('keydown',event=>{
   const items=Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')),index=items.indexOf(document.activeElement as HTMLButtonElement);
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}
   else if(event.key==='Escape'||event.key==='Tab'){event.preventDefault();event.stopPropagation();this.close();}
  });
  document.addEventListener('pointerdown',event=>{if(this.isOpen&&!root.contains(event.target as Node))this.close(false);},true);
  document.addEventListener('scroll',event=>{if(this.isOpen&&!root.contains(event.target as Node))this.close(false);},true);
  window.addEventListener('resize',()=>this.close(false));window.addEventListener('blur',()=>this.close(false));
 }
 open(x:number,y:number,ids:string[],context:CommandContext={},origin:()=>HTMLElement|null=()=>null){
  this.close(false);this.origin=origin;this.root.replaceChildren();this.root.setAttribute('aria-label','Editor actions');
  for(const id of ids){const command=this.commands.get(id),button=document.createElement('button'),label=document.createElement('span'),shortcut=document.createElement('kbd');
   button.type='button';button.setAttribute('role','menuitem');button.dataset.command=id;button.tabIndex=-1;button.setAttribute('aria-disabled',String(!this.commands.available(id,context)));label.textContent=command.label;shortcut.textContent=command.shortcut??'';button.append(label,shortcut);if(id==='delete'||id==='cut')button.classList.add('destructive');
   button.onpointerenter=()=>{if(this.commands.available(id,context))button.focus({preventScroll:true});};
   button.onclick=()=>{if(!this.commands.available(id,context))return;this.close();this.commands.execute(id,context);};this.root.append(button);
  }
  this.root.hidden=false;this.root.style.left='0px';this.root.style.top='0px';const bounds=this.root.getBoundingClientRect();
  const left=x+bounds.width<=innerWidth-8?x:x-bounds.width,top=y+bounds.height<=innerHeight-8?y:y-bounds.height;
  this.root.style.left=Math.max(8,Math.min(left,innerWidth-bounds.width-8))+'px';this.root.style.top=Math.max(8,Math.min(top,innerHeight-bounds.height-8))+'px';this.root.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
 }
 close(restoreFocus=true){if(!this.isOpen)return;this.root.hidden=true;if(restoreFocus)this.origin?.()?.focus({preventScroll:true});this.origin=undefined;}
}
