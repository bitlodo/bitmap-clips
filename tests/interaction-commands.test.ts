import {test,expect} from 'bun:test';
import {shortcutCommand,repeatableCommand} from '../src/shortcuts';
import {CommandRegistry} from '../src/commands';
import {navigateStyle,defaultStyleView,panStyle} from '../src/style-navigation';
test('commands enforce current availability and carry the frozen insertion time',()=>{
 const registry=new CommandRegistry(),frames:number[]=[];let ready=false;
 registry.register({id:'paste',label:'Paste',enabled:()=>ready,run:context=>frames.push(context.frame!)});
 expect(registry.execute('paste',{frame:120})).toBe(false);ready=true;expect(registry.execute('paste',{frame:120})).toBe(true);
 ready=false;expect(registry.execute('paste',{frame:400})).toBe(false);expect(frames).toEqual([120]);expect(()=>registry.register({id:'paste',label:'Again',run(){}})).toThrow();
});
test('timeline and Scene Style have separate navigation, including focused buttons and modifiers',()=>{
 expect(shortcutCommand({key:'d',ctrlKey:true},'timeline',false,true)).toBe('duplicate');
 expect(shortcutCommand({key:'v',metaKey:true},'timeline')).toBe('paste');expect(shortcutCommand({key:'z',ctrlKey:true,shiftKey:true},'style')).toBe('redo');
 expect(shortcutCommand({key:'d',ctrlKey:true},'style',true)).toBeNull();expect(shortcutCommand({key:'d',ctrlKey:true,isComposing:true},'timeline')).toBeNull();
 expect(shortcutCommand({key:'ArrowRight'},'timeline')).toBe('seek-forward');expect(shortcutCommand({key:'ArrowRight',shiftKey:true},'timeline')).toBe('seek-forward-ten');
 expect(shortcutCommand({key:'ArrowRight'},'style',true)).toBe('view-right');expect(shortcutCommand({key:'ArrowRight'},'style',false)).toBeNull();
 expect(shortcutCommand({key:' ',code:'Space'},'timeline',false,true)).toBeNull();expect(shortcutCommand({key:'ArrowLeft',altKey:true},'timeline')).toBeNull();
 expect(shortcutCommand({key:'R'},'style',true)).toBe('view-reset');expect(repeatableCommand('duplicate')).toBe(false);expect(repeatableCommand('paste')).toBe(false);expect(repeatableCommand('view-right')).toBe(true);
});
test('view navigation remains bounded and reset/fit have distinct scopes',()=>{
 const original={yaw:170,elevation:20,distance:7},before={...original};
 expect(navigateStyle(original,'view-fit')).toEqual({...original,distance:1.15});expect(navigateStyle(original,'view-reset')).toEqual(defaultStyleView);expect(original).toEqual(before);
 let view={...original};for(let i=0;i<100;i++)view=navigateStyle(navigateStyle(view,'view-up'),'view-in');
 expect(view.elevation).toBeLessThanOrEqual(89);expect(view.distance).toBeGreaterThanOrEqual(.6);
 for(let i=0;i<100;i++)view=navigateStyle(navigateStyle(view,'view-down'),'view-out');
 expect(view.elevation).toBeGreaterThanOrEqual(10);expect(view.distance).toBeLessThanOrEqual(8);
});

test('mouse pan stays perpendicular to camera forward and fit clears translation',()=>{
 const view={...defaultStyleView},position=[4,6,8],target=[0,1,0];
 const moved=panStyle(view,position,target,45,600,100,70),pan=moved.pan!;
 const forward=target.map((n,i)=>n-position[i]!);
 expect(pan.reduce((sum,n,i)=>sum+n*forward[i]!,0)).toBeCloseTo(0,10);
 expect(Math.hypot(...pan)).toBeGreaterThan(0);
 expect(view.pan).toBeUndefined();
 expect(navigateStyle(moved,'view-fit').pan).toBeUndefined();
 expect(panStyle(view,position,target,45,600,0,0).pan).toEqual([0,0,0]);
});

test('P plays the selected item once only in timeline, without consuming modified shortcuts',()=>{
 expect(shortcutCommand({key:'p'},'timeline')).toBe('play-selected-once');
 expect(shortcutCommand({key:'P'},'timeline',false,true)).toBe('play-selected-once');
 expect(shortcutCommand({key:'p'},'style',true)).toBeNull();
 expect(shortcutCommand({key:'p',ctrlKey:true},'timeline')).toBeNull();
 expect(repeatableCommand('play-selected-once')).toBe(false);
});
