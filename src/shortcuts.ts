export interface ShortcutKey {key:string;code?:string;ctrlKey?:boolean;metaKey?:boolean;shiftKey?:boolean;altKey?:boolean;isComposing?:boolean;}
export function shortcutCommand(event:ShortcutKey,mode:'timeline'|'style',canvasFocused=false,buttonFocused=false):string|null {
 if(event.isComposing||event.altKey)return null;
 const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
 if(mod){if(key==='z')return event.shiftKey?'redo':'undo';if(key==='y'&&!event.shiftKey)return 'redo';if(mode==='timeline'&&!event.shiftKey)return ({c:'copy',x:'cut',v:'paste',d:'duplicate'} as Record<string,string>)[key]??null;return null;}
 if(event.key==='?')return 'help';
 if(mode==='style'){
  if(!canvasFocused)return null;
  return ({ArrowLeft:'view-left',ArrowRight:'view-right',ArrowUp:'view-up',ArrowDown:'view-down','+':'view-in','=':'view-in','-':'view-out',r:'view-reset',f:'view-fit','1':'view-front','2':'view-top','3':'view-iso'} as Record<string,string>)[event.key]??({r:'view-reset',f:'view-fit'} as Record<string,string>)[key]??null;
 }
 if(event.key==='Delete'||event.key==='Backspace')return 'delete';
 if(key==='p'&&!event.shiftKey)return 'play-selected-once';
 if(buttonFocused)return null;
 if(event.code==='Space'||event.key===' ')return 'play';
 if(event.key==='ArrowLeft')return event.shiftKey?'seek-back-ten':'seek-back';
 if(event.key==='ArrowRight')return event.shiftKey?'seek-forward-ten':'seek-forward';
 if(event.key==='Home')return 'seek-start';if(event.key==='End')return 'seek-end';return null;
}
export function repeatableCommand(id:string){return id.startsWith('seek-')||['view-left','view-right','view-up','view-down','view-in','view-out'].includes(id);}
export function editingTarget(target:Element|null){return !!target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');}
