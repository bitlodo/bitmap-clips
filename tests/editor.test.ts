import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {activeShot,btc,createProject,dimensions,infoBlocks,largestParcel,moveClip,parseProject,retime,titleAlpha,type SceneData} from '../src/editor-model';
import {synthesizeTechno} from '../src/techno';
const data=snapshot as SceneData;
test('snapshot real mantém identidade dos lotes e soma exata das saídas',()=>{
 expect(data.height).toBe(970170);expect(data.txCount).toBe(3509);
 expect(data.layout.parcels).toHaveLength(data.txCount);
 expect(data.totalSats).toBe(data.layout.parcels.reduce((sum,p)=>sum+BigInt(p.totalSats),0n).toString());
 expect(data.layout.parcels.map(p=>p.txIndex)).toEqual(Array.from({length:data.txCount},(_,i)=>i));
 expect(data.hash).toBe('0000000000000000000054edf9c138c57ed5948585e6afd8d32daa22bea49a96');
});
test('presets cobrem o filme, focam uma transação real e sobrevivem a save/import',()=>{
 for(const preset of ['monument','data-city','terminal','editorial'] as const){for(const duration of [5,10,20,60]){
  const p=createProject(data,preset,duration);expect(p.shots[0]?.start).toBe(0);const last=p.shots.at(-1)!;expect(last.start+last.duration).toBeCloseTo(duration);
  expect(p.shots.find(s=>s.kind==='focus')?.txIndex).toBe(largestParcel(data));
  expect(parseProject(JSON.parse(JSON.stringify({project:p,data}))).project).toEqual(p);
  for(let t=0;t<duration;t+=.2)expect(p.shots).toContain(activeShot(p,t));
 }}
});
test('reduzir um filme com clips curtos conserva um projeto válido e dentro dos limites',()=>{
 const p=createProject(data,'monument',60);p.titles.push({...p.titles[0]!,id:crypto.randomUUID(),start:59.7,duration:.3});
 retime(p,5);expect(p.duration).toBe(5);expect(parseProject({project:p,data}).project).toBe(p);
 for(const c of [...p.shots,...p.titles]){expect(c.start+c.duration).toBeLessThanOrEqual(5.001);expect(c.duration).toBeGreaterThanOrEqual(1/30);}
});
test('editor limita deslocamento e resize ao intervalo do filme',()=>{
 const clip={start:0,duration:3};moveClip(clip,-10,100,20);expect(clip).toEqual({start:0,duration:20});
 moveClip(clip,25,2,20);expect(clip).toEqual({start:18,duration:2});
 moveClip(clip,0,0,20);expect(clip.duration).toBe(.3);
});
test('fade dos títulos respeita o intervalo e seeking determinístico',()=>{
 const c=createProject(data).titles[0]!;expect(titleAlpha(c,c.start-.01)).toBe(0);expect(titleAlpha(c,c.start+c.duration)).toBe(0);
 expect(titleAlpha(c,c.start+c.duration/2)).toBe(1);expect(titleAlpha(c,c.start+.1)).toBeGreaterThan(0);expect(titleAlpha(c,c.start+.1)).toBeLessThan(1);
});
test('dados indisponíveis não inventam taxas e a moeda não perde precisão',()=>{
 expect(infoBlocks({...data,fees:null},0).some(b=>b.key==='fees')).toBe(false);
 expect(btc('9007199254740993123',8)).toBe('90,071,992,547.40993123');
 expect(btc('1',8)).toBe('0.00000001');
});
test('projetos inválidos não chegam ao renderer ou aos controles',()=>{
 for(const mutate of [(p:any)=>p.project.duration=Infinity,(p:any)=>p.project.accent='javascript:alert(1)',(p:any)=>p.data.layout.parcels[0].size=50000,(p:any)=>p.project.shots[0].txIndex=99999,(p:any)=>p.project.shots=[],(p:any)=>p.project.titles[0].text='a'.repeat(501)]){
  const input=structuredClone({project:createProject(data),data});mutate(input);expect(()=>parseProject(input)).toThrow();
 }
});
test('saídas têm pixels pares e proporções corretas nos dois níveis',()=>{
 for(const q of ['720','1080'] as const){for(const [aspect,ratio] of [['16:9',16/9],['1:1',1],['9:16',9/16]] as const){const [w,h]=dimensions(aspect,q);expect(w/h).toBeCloseTo(ratio);expect(w%2+h%2).toBe(0);}}
});
test('trilha techno é finita, reproduzível, com fades e energia de áudio',()=>{
 const a=synthesizeTechno(2,8000),b=synthesizeTechno(2,8000);expect(a.length).toBe(16000);expect(a).toEqual(b);
 expect(Math.abs(a[0]!)).toBe(0);expect(Math.abs(a.at(-1)!)).toBeLessThan(.001);
 let energy=0;expect(a.every(Number.isFinite)).toBe(true);for(const sample of a)energy+=sample*sample;
 expect(Math.sqrt(energy/a.length)).toBeGreaterThan(.05);expect(Math.max(...a)).toBeLessThan(1);
});

import { makeShot, moveScene, snapTime, titleContent, textTemplates } from '../src/editor-model';
import { sampleCamera, shotPose } from '../src/camera-motion';
import { ProjectHistory } from '../src/history';
test('direções têm visuais, templates, ritmos e percursos distintos',()=>{
 const projects=['monument','data-city','terminal','editorial'].map(p=>createProject(data,p as any));
 expect(new Set(projects.map(p=>JSON.stringify([p.material,p.background,p.bloom,p.grid,p.shadows]))).size).toBe(4);
 expect(new Set(projects.map(p=>p.score)).size).toBe(4);expect(new Set(projects.map(p=>p.shots.map(s=>s.kind).join(','))).size).toBe(4);
 expect(new Set(projects.map(p=>p.titles[0]!.template)).size).toBe(4);
 for(const p of projects){const focus=p.shots.find(s=>s.kind==='focus')!;expect(p.models.find(m=>m.txIndex===focus.txIndex&&['isolate','highlight'].includes(m.kind))?.kind).toBe(p.preset==='terminal'?'isolate':'highlight');expect('context' in focus.camera).toBe(false);}
});
test('template e alvo do texto são locais e independentes da câmera',()=>{
 const p=createProject(data),title=p.titles.find(t=>t.binding==='transaction')!,shot=p.shots.find(s=>s.kind==='focus')!,original=titleContent(title,p,data);
 for(const key of Object.keys(textTemplates)){title.template=key as any;expect(titleContent(title,p,data)).toEqual(original);}
 shot.txIndex=0;expect(titleContent(title,p,data)).toEqual(original);
 title.txIndex=0;expect(titleContent(title,p,data).kicker).toContain('#0');expect(titleContent(title,p,data).text).toContain(btc(data.layout.parcels[0]!.totalSats));
 title.binding=null;title.text='Texto do usuário';title.txIndex=1;expect(titleContent(title,p,data).text).toBe('Texto do usuário');
});
test('reordenar e aparar câmeras conserva textos e a sequência exclusiva',()=>{
 const p=createProject(data),shot=p.shots[1]!,titles=structuredClone(p.titles);moveScene(p,shot,shot.start+1,shot.duration/2);
 expect(p.titles).toEqual(titles);let end=0;for(const s of p.shots){expect(s.start).toBeCloseTo(end);end+=s.duration;}expect(end).toBeCloseTo(p.duration);expect(parseProject({project:p,data}).project).toBe(p);
});
test('snapping usa bordas e ignora o próprio clip',()=>{
 const p=createProject(data),s=p.shots[0]!,next=p.shots[1]!;expect(snapTime(next.start+.03,p,s.id,.05)).toBeCloseTo(next.start);
 const t=p.titles[0]!;expect(snapTime(t.start+.003,p,s.id,.01)).toBeCloseTo(t.start);
});
test('undo agrupado volta ao estado anterior e uma nova edição descarta redo',()=>{
 const p=createProject(data),h=new ProjectHistory(p),original=p.accent;
 p.accent='#112233';h.record(p,'accent',1000);p.accent='#223344';h.record(p,'accent',1200);
 expect(h.undo()!.accent).toBe(original);expect(h.redo()!.accent).toBe('#223344');
 h.undo();p.accent='#334455';h.record(p);expect(h.canRedo).toBe(false);
});
test('câmeras são finitas, determinísticas e contínuas em transições blend',()=>{
 for(const preset of ['monument','data-city','terminal','editorial'] as const){const p=createProject(data,preset);
  for(const aspect of [16/9,1,9/16])for(let t=0;t<p.duration;t+=.2){const pose=sampleCamera(data,p,t,aspect);expect([...pose.position.toArray(),...pose.target.toArray(),pose.fov].every(Number.isFinite)).toBe(true);expect(sampleCamera(data,p,t,aspect).position.toArray()).toEqual(pose.position.toArray());}
  for(const shot of p.shots.slice(1)){if(shot.camera.transition==='cut')continue;const before=sampleCamera(data,p,shot.start-1e-5,16/9),after=sampleCamera(data,p,shot.start+1e-5,16/9);expect(before.position.distanceTo(after.position)).toBeLessThan(.01);}
 }
});
test('movimentos adicionais respondem aos parâmetros e cenas esparsas evitam voos urbanos',()=>{
 for(const kind of ['push-in','dolly','truck','flyover','street'] as const){const s=makeShot(kind,0,4,0,'data-city'),first=shotPose(data,s,0,16/9),last=shotPose(data,s,4,16/9);expect(first.position.distanceTo(last.position)).toBeGreaterThan(.1);}
 const sparse={...data,txCount:1,layout:{...data.layout,parcels:[{...data.layout.parcels[0]!,txIndex:0}]}};
 expect(createProject(sparse,'data-city').shots.some(s=>s.kind==='street'||s.kind==='flyover')).toBe(false);
});
test('projetos v1 preservam textos personalizados ao migrar para o editor v4',()=>{
 const p=createProject(data);const old:any={...p,version:1,preset:'signal',shots:p.shots.map(({camera,...s})=>s),titles:p.titles.map(({template,binding,shotId,...t})=>({...t,style:'caption',text:'Meu texto original'}))};
 const restored=parseProject({project:old,data}).project;expect(restored.version).toBe(4);expect(restored.preset).toBe('monument');expect(restored.titles[0]!.text).toBe('Meu texto original');expect(restored.titles[0]!.binding).toBeNull();
});
test('movimentos, vínculos e templates inválidos são rejeitados',()=>{
 for(const mutate of [(p:any)=>p.shots[0].camera.fov=NaN,(p:any)=>p.shots[0].camera.travel=Infinity,(p:any)=>p.titles[0].shotId='missing',(p:any)=>p.titles[0].template='javascript',(p:any)=>p.material='unknown']){const p=createProject(data);mutate(p);expect(()=>parseProject({project:p,data})).toThrow();}
});
test('identidades sonoras produzem sinais distintos sem alterar sua duração',()=>{
 const signals=['deep','jazz','acid','ambient'].map(s=>synthesizeTechno(1,8000,s as any));expect(signals.every(s=>s.length===8000)).toBe(true);
 expect(new Set(signals.map(s=>Array.from(s.slice(1500,1510)).join(','))).size).toBe(4);
});
test('títulos e suas animações não modificam o percurso da câmera',()=>{
 const p=createProject(data),time=2.5,reference=sampleCamera(data,p,time,1),copy=structuredClone(p);
 copy.titles=[];copy.textScale=1.6;expect(sampleCamera(data,copy,time,1)).toEqual(reference);
 copy.titles=[{...p.titles[0]!,template:'counter',position:'top',start:time-.1,duration:2,text:'Novo texto',binding:null}];
 expect(sampleCamera(data,copy,time,1)).toEqual(reference);
});
test('projetos antigos sem escala de texto recebem o padrão sem perder a edição',()=>{
 const p:any=createProject(data);p.version=2;p.shots=p.shots.map((s:any)=>({...s,camera:{...s.camera,context:'keep'}}));delete p.models;delete p.fades;delete p.textScale;p.titles[0].binding=null;p.titles[0].text='Minha edição';
 const restored=parseProject({project:p,data}).project;expect(restored.textScale).toBe(1);expect(restored.titles[0]!.text).toBe('Minha edição');
});
