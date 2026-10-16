import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createProject,type SceneData} from '../src/editor-model';
import {makeText,buildText} from '../src/texts/registry';
import {drawTextPlan} from '../src/texts/renderer';
const data=snapshot as SceneData;
test('Bitmap identity renders only within its independent text interval',()=>{
 const item=makeText('bitmap-identity',30,90);item.fadeInFrames=0;item.fadeOutFrames=0;
 const plan=buildText({data,look:'monument'},item),project=createProject(data,'monument'),written:string[]=[];
 const ctx={globalAlpha:1,save(){},restore(){},fillText(text:string){written.push(text);}} as unknown as CanvasRenderingContext2D;
 drawTextPlan(ctx,plan,project,data,.5,{width:720,height:720});expect(written).toEqual([]);
 drawTextPlan(ctx,plan,project,data,2,{width:720,height:720});expect(written).toContain(`${data.height}.bitmap`);expect(written).toContain('BITCOIN');expect(written.some(text=>text.includes(data.hash.slice(-10)))).toBe(true);
 written.length=0;drawTextPlan(ctx,plan,project,data,4,{width:720,height:720});expect(written).toEqual([]);
});
