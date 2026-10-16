import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createProject,makeShot,makeModel,insertCamera,moveScene,removeCamera,resizeFilm,retime,parseProject,normalizeCameras,titleAlpha,titleContent,type SceneData} from '../src/editor-model';
import {modelState} from '../src/model-motion';
import {sampleCamera,shotPose} from '../src/camera-motion';
const data=snapshot as SceneData;
function checkSequence(p:ReturnType<typeof createProject>){let end=0;for(const s of p.shots){expect(s.start).toBeCloseTo(end);expect(s.duration).toBeGreaterThanOrEqual(1/30-.00001);end=s.start+s.duration;}expect(end).toBeCloseTo(p.duration);expect(parseProject({project:p,data}).project).toBe(p);}
test('inserir um plano divide a câmera e não cria ou modifica texto/modelo',()=>{
 const p=createProject(data),before=structuredClone({models:p.models,titles:p.titles}),camera=makeShot('orbit',2,1,0,p.preset);insertCamera(p,camera,2);
 checkSequence(p);expect(p.shots).toContain(camera);expect(p.models).toEqual(before.models);expect(p.titles).toEqual(before.titles);expect(camera.start).toBe(2);
});
test('reordenação, resize e remoção mantêm cobertura sem sobreposição',()=>{
 const p=createProject(data),c=p.shots[2]!;moveScene(p,c,0,c.duration);expect(p.shots[0]).toBe(c);checkSequence(p);
 moveScene(p,c,c.start,30);checkSequence(p);expect(p.shots[1]!.duration).toBeCloseTo(.3);removeCamera(p,c);checkSequence(p);
});
test('migrar câmeras sobrepostas preserva textos e dá sequência explícita',()=>{
 const p=createProject(data),titles=structuredClone(p.titles);p.shots.push(makeShot('truck',2,2,0,p.preset));normalizeCameras(p);checkSequence(p);expect(p.titles).toEqual(titles);
});
test('estender duração preserva o ritmo; redistribuir é uma operação diferente',()=>{
 const p=createProject(data),original=structuredClone(p),textStart=p.titles[1]!.start;resizeFilm(p,30);expect(p.titles).toEqual(original.titles);expect(p.models).toEqual(original.models);expect(p.shots[0]!.duration).toBe(original.shots[0]!.duration);checkSequence(p);
 retime(original,30);expect(original.titles[1]!.start).toBeCloseTo(textStart*1.5);checkSequence(original);resizeFilm(p,5);checkSequence(p);
});
test('override local herda campos e restaura estilo ao fim do clip',()=>{
 const p=createProject(data);p.models=[];const c=makeModel('hold',1,2,0);c.style={material:'wireframe',opacity:.5};p.models=[c];
 expect(modelState(p,0).material).toBe(p.material);const local=modelState(p,2);expect(local.material).toBe('wireframe');expect(local.accent).toBe(p.accent);expect(local.opacity).toBe(.5);
 p.accent='#123456';expect(modelState(p,2).accent).toBe('#123456');expect(modelState(p,4).material).toBe(p.material);c.end='hold';expect(modelState(p,4).material).toBe('wireframe');
});
test('override e fade do modelo não alteram texto ou câmera',()=>{
 const p=createProject(data),before=sampleCamera(data,p,2,1),text=titleContent(p.titles[0]!,p,data),c=makeModel('hold',1,4,0);c.style={material:'hologram',accent:'#ff0000',opacity:.4};c.fadeIn=2;p.models.push(c);
 expect(sampleCamera(data,p,2,1)).toEqual(before);expect(titleContent(p.titles[0]!,p,data)).toEqual(text);expect(modelState(p,2).opacity).toBeCloseTo(.2);
});
test('restaurar estado anterior não deixa a desconstrução ativa',()=>{
 const p=createProject(data);p.models=[makeModel('build',0,1,0),makeModel('destroy',1,2,0)];p.models[1]!.end='restore';expect(modelState(p,2).transform?.kind).toBe('destroy');expect(modelState(p,4).transform?.kind).toBe('build');
});
test('texto aceita fades locais e alvo explícito sem alterar outras informações',()=>{
 const p=createProject(data),t=p.titles[0]!;t.start=1;t.duration=4;t.fadeIn=1;t.fadeOut=1;
 expect(titleAlpha(t,1)).toBe(0);expect(titleAlpha(t,1.5)).toBeCloseTo(.5);expect(titleAlpha(t,3)).toBe(1);expect(titleAlpha(t,4.5)).toBeCloseTo(.5);
 const target=p.titles.find(t=>t.binding==='transaction')!,other=structuredClone(p.titles[0]!);target.txIndex=0;expect(titleContent(target,p,data).txIndex).toBe(0);expect(p.titles[0]).toEqual(other);
});
test('enquadramento do fluxo é explícito e captura fim tem elevação própria',()=>{
 const p=createProject(data),c=p.shots[0]!;c.camera.target='flow';c.camera.elevationEnd=80;const first=shotPose(data,c,c.start,1),last=shotPose(data,c,c.start+c.duration,1);expect(first.target.y).toBeGreaterThan(1);expect(last.position.distanceTo(first.position)).toBeGreaterThan(1);expect([...first.position.toArray(),...last.position.toArray()].every(Number.isFinite)).toBe(true);
});
test('import valida overrides, alvos e envelopes novos',()=>{
 for(const change of [(p:any)=>p.models[0].style={opacity:NaN},(p:any)=>p.models[0].style={material:'invalid'},(p:any)=>p.models[0].end='unknown',(p:any)=>p.titles[0].txIndex=99999,(p:any)=>p.titles[0].animation='unknown',(p:any)=>p.titles[0].fadeOut=-1,(p:any)=>p.shots[0].camera.elevationEnd=0,(p:any)=>p.shots[1].start=1]){const p=createProject(data);change(p);expect(()=>parseProject({project:p,data})).toThrow();}
});
test('montagem que herda estilo interrompe override mantido anteriormente',()=>{
 const p=createProject(data);p.models=[];const local=makeModel('hold',0,1,0);local.end='hold';local.style={material:'wireframe'};const inherited=makeModel('build',2,2,0);p.models=[local,inherited];expect(modelState(p,1.5).material).toBe('wireframe');expect(modelState(p,2.5).material).toBe(p.material);
});
