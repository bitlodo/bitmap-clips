import {scoreInstruments} from './techno';
import {importAudioFile,decodeImportedAudio,importedWaveform} from './imported-audio';
import {applySceneDefaults,applyTextDefaults} from './default-styles';
import {textStyleSchema,textThemes,type TextStyle} from './text-style';
import {textStyleFields} from './text-style-controls';
import {sceneIcon} from './scene-icons';
import {conditionalControls} from './conditional-controls';
import {cameraMotionControls} from './camera-animation-controls';
import {sceneStyleFields,sceneStyleControls,styleValue} from './scene-style-controls';
import {moveTimelinePreview} from './timeline-gestures';
import {withinTimelinePanel} from './timeline-drop';
import {physicsPreviewKey as collisionSettingsKey} from './physics-preview-key';
import {renderItemProcessing} from './item-processing';
import {type TimelineModule} from './timeline-modules';
import {insertLibraryClip} from './clips/library-insert';
import {prepareBitmapReplacement} from './replace-bitmap';
import {projectTemplates,templateFilm,type ProjectTemplateId} from './project-templates';
import {BitmapImport} from './bitmap-import';
import {ProjectLibrary,type StoredBitmap,type LocalProject} from './project-library';
import {playbackBoundary} from './playback-boundary';
import {cameraMode,cameraEditorView,cameraEditorPose,type CameraSetting} from './camera-settings';
import {sampleCamera} from './camera-motion';
import {cameraEditTime,cameraEditSettings} from './camera-edit';
import {CommandRegistry,type CommandContext} from './commands';
import {ContextMenu} from './context-menu';
import {copyTimelineItem,pasteTimelineItem,pasteFrame,insertTimelineItem,clipboardProblem,type TimelineClipboard,type TimelineKind} from './timeline-clipboard';
import {shortcutCommand,repeatableCommand,editingTarget} from './shortcuts';
import {navigateStyle,defaultStyleView,panStyle} from './style-navigation';
import {qualityProfile,type RenderQualityProfile} from './render-quality';
import {previewDimensions} from './render-resolution';
import {styleDefaults,sceneStylePreset,type SceneStyle,type StyleView} from './scene-style';
import {timelineControls,itemFadeFrames,type TimelineCommon} from './timeline-contract';
import snapshot from './demo.json';
import {clips,definition,controlsFor,buildClip,sceneLabel} from './clips/registry';
import {createFilm,validateFilm,clipFrames,totalFrames as filmFrames,previewFrames,clipStart,activeClip,textRange,makeClip,resolvedText,findTextGap,parseDocument,videoProject,type Film,type FilmText} from './clips/film';
import {resizeClipPreview,resizeTextPreview,resizedFrames,fillTimelineGap,snapResizeFrames} from './clips/resize';
import {ClipFilmRenderer} from './clips/renderer';
import {controlVisible,type ClipInstance,type Control} from './clips/types';
import {insertClipPreview} from './clips/move';
import {texts,textDefinition,makeText,buildText} from './texts/registry';
import {textControlVisible,type TextControl} from './texts/types';
import {drawTextPlan} from './texts/renderer';
import {ProjectHistory} from './history';
import {ScorePlayer} from './techno';
import {scoreWaveform,drawWaveform,audioTimelineState} from './audio-waveform';
import {exportMode,renderVideo,type ExportMode} from './export-film';
import {btc,clamp,scores,availableScores,type SceneData} from './editor-model';
import {parseBitmap} from './lib/validation';
import type {WorkerMessage} from './lib/types';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const all=<T extends HTMLElement=HTMLElement>(q:string)=>Array.from(document.querySelectorAll<T>(q));
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function createStarterFilm(data:SceneData){
 const film=createFilm(data);
 return validateFilm(film,data);
}
const storageKey='bitmap-clip-lab-v8';
const audioSelection='@soundtrack';
const renderSelection='@render-settings';
const sceneDefaultsSelection='@scene-defaults',textDefaultsSelection='@text-defaults';
let textDefaultsDraft:TextStyle|undefined;
let physicsPreviewKey='',physicsPreviewEpoch=0,physicsPreviewTimer:number|undefined;
const foldoutState=new Map<string,boolean>();
let libraryDragScale=0;
let libraryDrag:{initial:Film;kind:'clip'|'text';item:ClipInstance|FilmText;width:number;scale:number;preview?:Film}|undefined;
let data=snapshot as SceneData,film=createStarterFilm(data),time=1.8,selected:string|null=null,renderer:ClipFilmRenderer|undefined;
let previewExportQuality=false;
let styleView:StyleView={...defaultStyleView};
let playing=false,playEpoch=0,raf=0,clock=0,offset=0,loop=false,range:{start:number;end:number}|null=null;
let exporting=false,controller:AbortController|undefined,mode:ExportMode|null=null,codecEpoch=0,downloadURL='';
let worker:Worker|undefined,loadEpoch=0,saving:number|undefined,thumbKey='';
let clipDrag:{id:string;active:boolean;colliding:boolean;preview:Film}|null=null;
let cancelClipDrag:(()=>void)|null=null,suppressClipClickUntil=0;
let cancelClipResize:(()=>void)|null=null;
let textDrag:{id:string;active:boolean;colliding:boolean;preview:Film}|null=null,cancelTextDrag:(()=>void)|null=null;
let draft:{id:string;key:string;base:CameraSetting;initial:StyleView;savedTime:number;savedView:StyleView;enteringCustom:boolean}|null=null;
const score=new ScorePlayer(),canvas=$<HTMLCanvasElement>('preview');
let legacyLoaded=false;
try{const stored=(localStorage.getItem(storageKey)??localStorage.getItem('bitmap-clip-lab-v7')??localStorage.getItem('bitmap-clip-lab-v6')??localStorage.getItem('bitmap-clip-lab-v5'));if(stored){const doc=parseDocument(JSON.parse(stored));film=doc.film;data=doc.data;legacyLoaded=true;}}catch{}
const projectLibrary=new ProjectLibrary();
let projectWritable=legacyLoaded,templatePending=false;
let projectId:string=crypto.randomUUID(),projectName=legacyLoaded?`${data.height}.bitmap`:'No project',projectWrites:Promise<void>=Promise.resolve();
try{const active=localStorage.getItem('bitmap-active-project')??(await projectLibrary.list())[0]?.id;if(active){const stored=await projectLibrary.get(active);if(stored){templatePending=stored.templatePending??false;projectWritable=true;projectId=stored.id;projectName=stored.name;film=stored.film;data=stored.data;const recovery=JSON.parse(localStorage.getItem(storageKey)??'null');if(recovery?.projectId===stored.id&&recovery.updatedAt>stored.updatedAt){const doc=parseDocument(recovery);film=doc.film;data=doc.data;projectName=recovery.projectName||stored.name;templatePending=recovery.templatePending??stored.templatePending??false;}}}}catch{}
const history=new ProjectHistory(film);
const commands=new CommandRegistry(),contextMenu=new ContextMenu($('context-menu'),commands);
let timelineClipboard:TimelineClipboard|null=null,feedbackTimer:number|undefined,largeViewStep=false;
function feedback(message:string){note(message);}
function note(message:string,error=false){
 clearTimeout(feedbackTimer);$('status').textContent=message;$('status').style.color=error?'#e5ad89':'';
 document.body.classList.toggle('footer-message-active',!!message);
 if(message&&!error)feedbackTimer=window.setTimeout(()=>{ $('status').textContent='';document.body.classList.remove('footer-message-active'); },5000);
}

function persistProject(){
 if(!projectWritable)return Promise.resolve();
 const record={id:projectId,name:projectName,templatePending,updatedAt:Date.now(),film:structuredClone(film),data:structuredClone(data)};
 projectWrites=projectWrites.catch(()=>{}).then(async()=>{await projectLibrary.save(record);localStorage.setItem('bitmap-active-project',record.id);$('save-state').textContent='Saved on this device';}).catch(()=>{$('save-state').textContent='Save failed · download a backup';throw Error('Unable to save project in this browser.');});
 return projectWrites;
}
function save(){if(!projectWritable)return;clearTimeout(saving);$('save-state').textContent='Saving…';saving=window.setTimeout(()=>{saving=undefined;void persistProject().catch(()=>{});},250);}
async function flushProject(){clearTimeout(saving);saving=undefined;await persistProject();}
function refreshProjectHeader(){
 document.body.classList.toggle('no-project',!projectWritable);document.body.classList.toggle('choosing-template',projectWritable&&templatePending);$('project-template-start').hidden=!projectWritable||!templatePending;$('project-welcome').hidden=projectWritable;$('bitmap-info').hidden=!projectWritable;
 void updateSavedProjectAccess();
 $('project-title').textContent=projectWritable?projectName:'Projects';$('project-bitmap').textContent=`${data.height}.bitmap`;$('project-bitmap').hidden=!projectWritable||projectName.trim()===`${data.height}.bitmap`;
 for(const id of ['open-export','render-settings','save-project'])$<HTMLButtonElement>(id).disabled=!projectWritable||(id!=='save-project'&&templatePending);$<HTMLButtonElement>('open-export').disabled=!projectWritable||templatePending||filmFrames(film)===0;
}

async function updateSavedProjectAccess(){
 try{const hasProjects=(await projectLibrary.list()).length>0;$('welcome-projects').hidden=!hasProjects;$('project-name').hidden=!projectWritable&&!hasProjects;}catch{$('welcome-projects').hidden=true;$('project-name').hidden=!projectWritable;}
}

async function renderProjectList(){
 try{const records=await projectLibrary.list();$('project-list').replaceChildren();
  if(!records.length)$('project-list').textContent='No saved projects yet.';
  for(const record of records){const row=document.createElement('div');row.className='project-list-row';const button=document.createElement('button');button.className='local-project';button.setAttribute('aria-current',String(record.id===projectId));button.innerHTML=`<strong>${escape(record.name)}</strong><span>${record.data.height}.bitmap · ${new Date(record.updatedAt).toLocaleDateString()}${record.id===projectId?' · Current':''}</span>`;button.onclick=()=>void openLocalProject(record.id);
   const remove=document.createElement('button');remove.className='delete-local-project';remove.title=`Delete ${record.name}`;remove.setAttribute('aria-label',remove.title);remove.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';remove.onclick=()=>void deleteLocalProject(record);const clone=document.createElement('button');clone.className='clone-local-project';clone.title=`Clone ${record.name}`;clone.setAttribute('aria-label',clone.title);clone.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/></svg>';clone.onclick=()=>void cloneLocalProject(record);row.append(button,clone,remove);$('project-list').append(row);
  }
 }catch(error){note((error as Error).message,true);}
}
function activateProject(record:LocalProject){templatePending=record.templatePending??false;projectWritable=true;projectId=record.id;projectName=record.name;film=record.film;data=record.data;selected=null;time=Math.max(0,Math.min(1.8,previewFrames(film)/30));styleView={...defaultStyleView};history.reset(film);makeRenderer();source();renderTimeline();reflectFilm();renderInspector();renderLibrary();renderProjectTemplates();draw();}
async function cloneLocalProject(source:LocalProject){
 const dialog=$<HTMLDialogElement>('clone-project-dialog');$('clone-project-message').textContent=`Create “${source.name} Clone” and open it? The original project stays saved.`;
 const confirmed=await new Promise<boolean>(resolve=>{dialog.onclose=()=>resolve(dialog.returnValue==='clone');$('cancel-clone-project').onclick=()=>dialog.close('cancel');$('confirm-clone-project').onclick=()=>dialog.close('clone');dialog.returnValue='cancel';dialog.showModal();});if(!confirmed)return;
 try{pause();closeDraft();await flushProject();const latest=await projectLibrary.get(source.id);if(!latest)throw Error('Project not found.');const copy:LocalProject={...structuredClone(latest),id:crypto.randomUUID(),name:`${latest.name} Clone`,updatedAt:Date.now()};await projectLibrary.save(copy);activateProject(copy);await flushProject();$<HTMLDialogElement>('projects-dialog').close();note('Cloned project opened.');}catch(error){note((error as Error).message,true);}
}

async function deleteLocalProject(record:LocalProject){
 const dialog=$<HTMLDialogElement>('delete-project-dialog');$('delete-project-message').textContent=`Delete “${record.name}” from this browser? This cannot be undone.`;
 const confirmed=await new Promise<boolean>(resolve=>{dialog.onclose=()=>resolve(dialog.returnValue==='delete');$('cancel-delete-project').onclick=()=>dialog.close('cancel');$('confirm-delete-project').onclick=()=>dialog.close('delete');dialog.returnValue='cancel';dialog.showModal();});if(!confirmed)return;
 try{pause();closeDraft();await flushProject();const current=record.id===projectId,others=(await projectLibrary.list()).filter(p=>p.id!==record.id);await projectLibrary.delete(record.id);
  if(current){for(const key of [storageKey,'bitmap-active-project','bitmap-clip-lab-v7','bitmap-clip-lab-v6','bitmap-clip-lab-v5'])localStorage.removeItem(key);
   if(others[0]){activateProject(others[0]);await flushProject();}
   else {projectWritable=false;projectId=crypto.randomUUID();projectName='No project';data=snapshot as SceneData;film=createStarterFilm(data);selected=null;history.reset(film);makeRenderer();reflectFilm();renderTimeline();renderInspector();renderLibrary();draw();$('save-state').textContent='No project open';}
  }
  $<HTMLInputElement>('project-rename').value=projectWritable?projectName:'';$<HTMLInputElement>('project-rename').disabled=!projectWritable;await renderProjectList();note('Project deleted.');
 }catch(error){note((error as Error).message,true);}
}

async function openLocalProject(id:string){
 try{pause();closeDraft();await flushProject();const record=await projectLibrary.get(id);if(!record)throw Error('Project not found.');stopLoad();activateProject(record);save();$<HTMLDialogElement>('projects-dialog').close();}catch(error){note((error as Error).message,true);}
}

let templatePreviewKey='';
function renderProjectTemplates(){
 if(!templatePending||!projectWritable)return;const key=projectId+data.hash;if(key===templatePreviewKey)return;templatePreviewKey=key;
 $('project-template-grid').replaceChildren();
 for(const template of projectTemplates){const card=document.createElement('button');card.className='project-template-card';card.innerHTML=`<div class="template-preview ${template.preview.kind==='empty'?'blank-template-preview':''}">${template.preview.kind==='empty'?'<span class="blank-template-icon" aria-hidden="true">+</span><span class="blank-template-caption">Your timeline starts here</span>':'<canvas width="480" height="270" aria-hidden="true"></canvas>'}</div><div class="template-card-content"><span class="template-tag">${template.tag}</span><h2>${escape(template.name)}</h2><p>${escape(template.description)}</p><span class="template-choose">${escape(template.actionLabel)} →</span></div>`;card.onclick=()=>chooseProjectTemplate(template.id);$('project-template-grid').append(card);
  if(template.preview.kind==='frame'&&renderer){const preview=templateFilm(data,template.id);renderer.render(preview,template.preview.time,480,270);card.querySelector('canvas')!.getContext('2d')!.drawImage(canvas,0,0);}
 }
}
function chooseProjectTemplate(id:ProjectTemplateId){pause();film=templateFilm(data,id);templatePending=false;selected=null;time=previewFrames(film)?1.8:0;history.reset(film);makeRenderer();renderTimeline();reflectFilm();renderInspector();renderLibrary();draw();save();}

function clip(){return film.clips.find(c=>c.id===selected);}
function text(){return film.texts.find(c=>c.id===selected);}
function selectedExists(){if(selected&&selected!==audioSelection&&selected!==renderSelection&&selected!==sceneDefaultsSelection&&selected!==textDefaultsSelection&&!clip()&&!text())selected=null;}
function renderPlaybackButton(active:boolean){$('play').innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${active?'<rect x="6" y="5" width="4" height="14" rx=".5"/><rect x="14" y="5" width="4" height="14" rx=".5"/>':'<path d="M7 4.5v15l12-7.5Z"/>'}</svg>`;$('play').setAttribute('aria-label',active?'Pause':'Play');}
function pause(){playEpoch++;playing=false;cancelAnimationFrame(raf);score.stop();renderPlaybackButton(false);$('playback-status').textContent='PAUSED';}
function togglePlayback(){if(playing||$('playback-status').textContent==='PREPARING')pause();else void play();}
function framingUI(active:boolean){
 const defaults=selected===sceneDefaultsSelection&&!draft,visible=active||defaults,panel=$('camera-editor');
 document.body.classList.toggle('editing-defaults',defaults);
 if(defaults)panel.style.height='auto';
 else if(active){const editor=document.querySelector<HTMLElement>('.editor')!,transport=document.querySelector<HTMLElement>('.transport')!;panel.style.height=`${editor.getBoundingClientRect().bottom-transport.getBoundingClientRect().top}px`;}
 panel.hidden=!visible;
 for(const element of all<HTMLElement>('.library,header,.transport,.timeline-panel,.timeline-foot'))element.inert=visible;
 $('inspector').inert=active;
 $('style-canvas-tools').hidden=true;
 panel.querySelector<HTMLElement>('.eyebrow')!.textContent=defaults?'SCENE DEFAULTS':'CAMERA EDITING';
 $('camera-editor-title').textContent=defaults?'Default Scene Settings':'Position your camera';
 if(defaults)$('camera-editor-context').textContent='Shared appearance for scenes that inherit the defaults.';
 panel.querySelector<HTMLElement>('.camera-editor-intro')!.textContent=defaults?'Edit settings in the right panel. Changes are saved automatically. Drag the preview to inspect the scene.':'Drag the preview to position your camera. Apply to save, or Cancel to discard.';
 panel.querySelector<HTMLElement>('.camera-shortcuts')!.textContent=`R: reset · F: fit scene · 1 / 2 / 3: views · Arrow keys: rotate · Esc: ${defaults?'back to timeline':'cancel'}`;
 panel.querySelector<HTMLElement>('.camera-time-strip')!.hidden=defaults;
 $('defaults-timeline').hidden=!defaults;
 $('cancel-framing').hidden=defaults;$('apply-framing').hidden=defaults;
}

function reflectCameraTime(){
 if(!draft)return;const item=film.clips.find(c=>c.id===draft!.id);if(!item)return;
 const duration=item.durationFrames/30,local=clamp(time-item.startFrame/30,0,duration),input=$<HTMLInputElement>('camera-time');
 input.max=String(duration);input.value=String(local);input.setAttribute('aria-valuetext',`${local.toFixed(2)} of ${duration.toFixed(2)} seconds`);
 $('camera-time-value').textContent=`${local.toFixed(2)} s / ${duration.toFixed(2)} s`;$('camera-time-end').textContent=`${Number(duration.toFixed(2))}s`;
}
$('camera-time').oninput=()=>{if(!draft||!renderer)return;const item=film.clips.find(c=>c.id===draft!.id);if(!item)return;
 const yaw=styleView.yaw-draft.initial.yaw,elevation=styleView.elevation-draft.initial.elevation,distance=styleView.distance/draft.initial.distance,pan=styleView.pan;
 time=cameraEditTime(item.startFrame,item.durationFrames,item.startFrame/30+Number($<HTMLInputElement>('camera-time').value));
 const pose=sampleCamera(data,renderer.plan(film,item).engine,time-item.startFrame/30,canvas.width/canvas.height);
 draft.base={position:pose.position.toArray(),target:pose.target.toArray(),fov:pose.fov};draft.initial=cameraEditorView(draft.base);
 styleView={...draft.initial,yaw:draft.initial.yaw+yaw,elevation:draft.initial.elevation+elevation,distance:draft.initial.distance*distance,pan};draw();};
function closeDraft(){if(!draft)return;time=draft.savedTime;styleView=draft.savedView;draft=null;framingUI(false);document.body.classList.remove('framing');$('frame-hint').hidden=true;$('style-canvas-tools').hidden=selected!==sceneDefaultsSelection;}
function edit(action:(p:Film)=>void,inspect=true,group='',keepPlaying=false){
  if(!projectWritable){$('new-project').click();return false;}
  contextMenu.close(false);if(!keepPlaying)pause();const previous=structuredClone(film),previousSelected=selected;
  try{action(film);film=validateFilm(film,data);history.record(film,group);selectedExists();time=clamp(time,0,Math.max(0,previewFrames(film)/30));save();if(!keepPlaying)renderTimeline();reflectFilm();if(inspect)renderInspector();draw();return true;}
  catch(e){console.error('Project edit failed.',e);film=previous;selected=previousSelected;note((e as Error).message,true);renderTimeline();if(inspect)renderInspector();draw();return false;}
}
function select(id:string|null){if(id===sceneDefaultsSelection||id===textDefaultsSelection)pause();if(id!==textDefaultsSelection)textDefaultsDraft=undefined;closeDraft();selected=id;framingUI(!!draft);renderTimeline();renderInspector();if(id===renderSelection)$('inspector').scrollTop=0;draw();}
function cameraNavigationActive(){return !!draft||selected===sceneDefaultsSelection;}
function selectTab(tab:string){
 contextMenu.close(false);
 all('.library [data-panel]').forEach(e=>e.hidden=e.dataset.panel!==tab);
 all('[data-tab]').forEach(e=>{const active=e.dataset.tab===tab;e.classList.toggle('active',active);e.setAttribute('aria-pressed',String(active));});
}
all('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab!));
function highlightDefaultsPanel(){
 const panel=$('inspector'),content=$('inspector-content'),heading=content.querySelector<HTMLElement>('h1');
 content.scrollTop=0;panel.scrollTop=0;
 if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
 for(const animation of panel.getAnimations())animation.cancel();
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)panel.animate([
  {boxShadow:'inset 0 0 0 2px #85dbc000'},
  {boxShadow:'inset 0 0 0 2px #85dbc0',offset:.2},
  {boxShadow:'inset 0 0 0 2px #85dbc0',offset:.55},
  {boxShadow:'inset 0 0 0 2px #85dbc000'},
 ],{duration:1200,easing:'ease-out'});
}
$('global-scene-style').onclick=()=>{select(sceneDefaultsSelection);highlightDefaultsPanel();};
$('global-text-style').onclick=()=>{textDefaultsDraft=structuredClone(film.textStyle);select(textDefaultsSelection);highlightDefaultsPanel();};
$('render-settings').onclick=()=>{if(exporting)return;select(selected===renderSelection?null:renderSelection);};
function renderQualitySettings(){
 const fields=$('quality-settings');
 $<HTMLInputElement>('preview-export-quality').checked=previewExportQuality;
 fields.innerHTML=(['preview','export'] as const).map(scope=>{
  const stored=film.renderQuality[scope],value=qualityProfile(stored),custom=stored.preset==='custom';
  const select=(key:string,label:string,choices:{value:string;label:string}[],current:string)=>`<label for="quality-${scope}-${key}">${label}</label><select id="quality-${scope}-${key}" data-quality-scope="${scope}" data-quality-key="${key}">${options(choices,current)}</select>`;
  return `<section class="quality-profile"${scope==='preview'&&previewExportQuality?' hidden':''}>${scope==='export'?'<h2>Export</h2>':''}`+
   select('preset','Quality',[{value:'standard',label:'Standard · native resolution'},{value:'high',label:'High · supersampling 2×'},{value:'custom',label:'Custom'}],stored.preset)+
   `<div class="conditional-fields"${custom?'':' hidden'}>`+
   select('antialias','Antialiasing',[{value:'auto',label:'Auto'},{value:'none',label:'None'},{value:'msaa',label:'MSAA'},{value:'fxaa',label:'FXAA'},{value:'msaa-fxaa',label:'MSAA + FXAA'}],value.antialias)+
   select('supersampling','Supersampling',[{value:'1',label:'1× · native'},{value:'1.5',label:'1.5×'},{value:'2',label:'2×'}],String(value.supersampling))+
   select('shadowResolution','Shadow resolution',[{value:'0',label:'Auto'},{value:'1024',label:'1K'},{value:'2048',label:'2K'},{value:'4096',label:'4K'}],String(value.shadowResolution))+`</div><p class="muted small">${scope==='preview'?'Controls editing performance.':'Renders the 3D scene before downscaling. Text stays at final resolution.'}</p></section>`;
 }).join('');
 all<HTMLSelectElement>('[data-quality-scope]').forEach(input=>input.onchange=()=>{
  const scope=input.dataset.qualityScope as 'preview'|'export',key=input.dataset.qualityKey as keyof RenderQualityProfile;
  edit(p=>{const previous=qualityProfile(p.renderQuality[scope]);p.renderQuality[scope]={...previous,[key]:key==='supersampling'||key==='shadowResolution'?Number(input.value):input.value};},false,'render-quality:'+scope+':'+key,true);
  renderQualitySettings();
 });
}
$('preview-export-quality').onchange=()=>{previewExportQuality=$<HTMLInputElement>('preview-export-quality').checked;renderQualitySettings();draw();};
function previewQuality(){return film.renderQuality[previewExportQuality?'export':'preview'];}
function reflectQualityFrame(){
 const values=canvas.dataset;
 if(!values.internalWidth){$('quality-frame-info').textContent='No 3D scene at this frame.';return;}
 const clamped=Number(values.qualityScale)+.01<Number(values.qualityRequestedScale);
 $('quality-frame-info').textContent=`${previewExportQuality?'Export':'Preview'} quality · 3D ${values.internalWidth} × ${values.internalHeight} → ${canvas.width} × ${canvas.height} px · ${Number(values.qualitySamples)?'MSAA '+values.qualitySamples+'×':'No MSAA'}${values.qualityFxaa==='true'?' + FXAA':''} · shadows ${values.qualityShadow} px${clamped?' · internal resolution limited by GPU / buffer budget':''}`;
}
function textPresetOptions(style:TextStyle){
 const match=textThemes.find(p=>Object.entries(p.style).every(([k,v])=>style[k as keyof TextStyle]===v));
 return options([{value:'custom',label:'Custom'},...textThemes.map(p=>({value:p.id,label:p.name}))],match?.id??'custom');
}
function textStyleModuleHTML(item:FilmText){
 const style=textStyleSchema.parse({...film.textStyle,...item.textStyleOverride});
 return `<select id="text-style-mode" aria-label="Text style">${options([{value:'inherit',label:'Inherit Text Style'},{value:'local',label:'Customize this text'}],item.textStyleOverride?'local':'inherit')}</select>${item.textStyleOverride?`<div id="text-style-fields" class="conditional-fields"><label for="item-text-preset">UI Style Preset</label><select id="item-text-preset">${textPresetOptions(style)}</select>${textStyleFields(style,'item-text-style')}<button id="reset-text-style" class="quiet full">Reset to Text Style</button></div>`:''}`;
}
function bindTextStyleFields(root:HTMLElement,id?:string){
 root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-text-style]').forEach(input=>{
  const change=()=>{const key=input.dataset.textStyle as keyof TextStyle;
   if(id)edit(p=>Object.assign(p.texts.find(t=>t.id===id)!.textStyleOverride!,{[key]:input.value}),false,`text-style:${id}:${key}`);
   else {textDefaultsDraft=textStyleSchema.parse({...textDefaultsDraft,[key]:input.value});draw();}
   const preset=root.querySelector<HTMLSelectElement>('select[id$="preset"]')??(!id?document.getElementById('global-style-preset') as HTMLSelectElement|null:null);if(preset)preset.value='custom';
  };
  if(input.type==='color')input.oninput=change;else input.onchange=change;
 });
 const preset=root.querySelector<HTMLSelectElement>('select[id$="preset"]');if(preset)preset.onchange=()=>{
  const value=textThemes.find(p=>p.id===preset.value);if(!value)return;
  if(id)edit(p=>p.texts.find(t=>t.id===id)!.textStyleOverride={...value.style});
  else {textDefaultsDraft={...value.style};renderInspector();draw();}
 };
}
function renderDefaultsPanel(root:HTMLElement){
 const scene=selected===sceneDefaultsSelection;
 if(!scene&&!textDefaultsDraft)textDefaultsDraft=structuredClone(film.textStyle);
 const scenes=[{value:'monument',label:'Monument'},{value:'data-city',label:'Data City'},{value:'terminal',label:'Terminal'},{value:'editorial',label:'Editorial'}];
 const match=scene?scenes.find(p=>{const defaults=sceneStylePreset(data,p.value as Film['look']);return Object.entries(defaults).every(([key,value])=>effectiveStyle(film)[key as keyof SceneStyle]===value);}):undefined;
 root.innerHTML=`<h1>${scene?'Default Scene Settings':'Default Text Style'}</h1><p class="object-description">${scene?'Scenes':'Texts'} inherit these settings unless customized. Presets fill the editable fields below.</p><label for="global-style-preset">${scene?'Scene Preset':'UI Style Preset'}</label><select id="global-style-preset">${scene?options([{value:'custom',label:'Custom'},...scenes],match?.value??'custom'):textPresetOptions(textDefaultsDraft!)}</select><div id="${scene?'global-style-fields':'global-text-fields'}">${scene?sceneStyleFields(effectiveStyle(film),'global-scene'):textStyleFields(textDefaultsDraft!,'global-text')}</div>${scene?'':`<div class="defaults-apply"><label for="defaults-scope">Apply to</label><select id="defaults-scope">${options([{value:'defaults',label:'Global defaults · keep item overrides'},{value:'all',label:'All items · reset item overrides'}],'defaults')}</select><div class="button-row"><button id="cancel-defaults" class="secondary">Cancel</button><button id="apply-defaults" class="primary">Apply style</button></div></div>`}`;
 if(scene){bindStyleFields($('global-style-fields'));$<HTMLSelectElement>('global-style-preset').onchange=()=>{const preset=$<HTMLSelectElement>('global-style-preset').value;if(preset==='custom')return;const look=preset as Film['look'];edit(p=>Object.assign(p,applySceneDefaults(p,look,sceneStylePreset(data,look))));};return;}
 else {const fields=$('global-text-fields');bindTextStyleFields(fields);$<HTMLSelectElement>('global-style-preset').onchange=()=>{const preset=textThemes.find(p=>p.id===$<HTMLSelectElement>('global-style-preset').value);if(preset){textDefaultsDraft={...preset.style};renderInspector();draw();}};}
 $('cancel-defaults').onclick=()=>select(null);
 $('apply-defaults').onclick=()=>{const all=$<HTMLSelectElement>('defaults-scope').value==='all';
  const ok=edit(p=>Object.assign(p,applyTextDefaults(p,textDefaultsDraft!,all)),false);
  if(ok){textDefaultsDraft=undefined;renderLibrary();renderInspector();draw();note('Default text style applied.');}
 };
}
function effectiveStyle(p:Film,id?:string){return {...styleDefaults(data,p.look),...p.sceneStyle,...(id?p.clips.find(c=>c.id===id)?.styleOverride:{})};}
/** One component and change path serve the project style and each scene override. */
function bindStyleFields(root:HTMLElement,id?:string){
 root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-style]').forEach(input=>{
  const change=()=>{
   const value=input instanceof HTMLInputElement?(input.type==='checkbox'?input.checked:['range','number'].includes(input.type)?Number(input.value):input.value):input.value,key=input.dataset.style!;
   const changeStyle=(p:Film)=>{
    const target=id?p.clips.find(c=>c.id===id)!.styleOverride!:p.sceneStyle;
    Object.assign(target,{[key]:value});const effective=effectiveStyle(p,id);
    if(key==='fogNear'&&effective.fogNear>=effective.fogFar)target.fogFar=effective.fogNear+.1;
    if(key==='fogFar'&&effective.fogFar<=effective.fogNear)target.fogNear=Math.max(0,effective.fogFar-.1);
   };
   if(!edit(changeStyle,false,`style:${id??'global'}:${key}`))return;
   if(root.id==='global-style-fields')$<HTMLSelectElement>('global-style-preset').value='custom';
   const values=effectiveStyle(film,id);
   root.querySelectorAll<HTMLElement>('[data-style-when]').forEach(node=>node.hidden=!values[node.dataset.styleWhen as keyof SceneStyle]);
   root.querySelectorAll<HTMLElement>('[data-style-value]').forEach(node=>{const key=node.dataset.styleValue as keyof SceneStyle,control=sceneStyleControls.find(c=>c.key===key)!;node.textContent=styleValue(values[key],'unit' in control?control.unit:'');});
   root.querySelectorAll<HTMLInputElement>('[data-style="fogNear"],[data-style="fogFar"]').forEach(i=>i.value=String(values[i.dataset.style as 'fogNear'|'fogFar']));
  };
  if(input.type==='range'||input.type==='color')input.oninput=change;else input.onchange=change;
 });
}


$('apply-framing').onclick=()=>{if(!draft)return;const current=draft,item=film.clips.find(c=>c.id===current.id)!;
 const appliedTime=cameraEditTime(item.startFrame,item.durationFrames,time),plan=renderer!.plan(film,item);
 const settings=cameraEditSettings(data,plan.engine,appliedTime-item.startFrame/30,canvas.width/canvas.height,current.key,cameraEditorPose(current.base,styleView));
 closeDraft();time=appliedTime;edit(p=>{const target=p.clips.find(x=>x.id===current.id)!.settings;
  if(current.enteringCustom){delete target.cameraA;delete target.cameraB;}
  Object.assign(target,settings,{inheritLastCamera:false});
 });canvas.focus({preventScroll:true});};
$('defaults-timeline').onclick=()=>{select(null);canvas.focus({preventScroll:true});};
$('cancel-framing').onclick=()=>{closeDraft();renderInspector();draw();canvas.focus({preventScroll:true});};
all<HTMLElement>('[data-camera-view]').forEach(button=>button.onclick=()=>commands.execute(button.dataset.cameraView!));
$('style-reset').onclick=()=>commands.execute('view-reset');$('style-fit').onclick=()=>commands.execute('view-fit');$('style-view-preset').onchange=()=>{commands.execute($<HTMLSelectElement>('style-view-preset').value);$<HTMLSelectElement>('style-view-preset').value='';};
$('project-name').onclick=async()=>{pause();try{if(!projectWritable&&!(await projectLibrary.list()).length)return;await flushProject();$<HTMLInputElement>('project-rename').disabled=!projectWritable;$<HTMLInputElement>('project-rename').value=projectName;$('project-current-bitmap').hidden=!projectWritable;$('project-current-bitmap-name').textContent=`${data.height}.bitmap · ${data.txCount.toLocaleString('en-US')} transactions`;$<HTMLDialogElement>('projects-dialog').showModal();await renderProjectList();}catch(error){note((error as Error).message,true);}};
$('welcome-new').onclick=()=>$('new-project').click();
$('welcome-import').onclick=()=>$<HTMLInputElement>('project-file').click();
$('welcome-projects').onclick=()=>$('project-name').click();
$('close-projects').onclick=()=>$<HTMLDialogElement>('projects-dialog').close();
$('project-rename').onchange=async()=>{projectName=$<HTMLInputElement>('project-rename').value.trim()||`${data.height}.bitmap`;refreshProjectHeader();try{await flushProject();await renderProjectList();}catch(error){note((error as Error).message,true);}};
let replacingProjectId:string|undefined;
function openBitmapImport(replace=false){replacingProjectId=replace?projectId:undefined;$('bitmap-dialog-title').textContent=replace?'Replace bitmap':'New project';$('create-bitmap-project').textContent=replace?'Confirm replacement':'Create and open project';$('bitmap-replace-confirmation').hidden=true;pause();closeDraft();stopLoad();pendingBitmap=undefined;$<HTMLDialogElement>('projects-dialog').close();$('bitmap-name-step').hidden=true;$('bitmap-import-step').hidden=false;$('bitmap-terminal').textContent='';$('bitmap-terminal').hidden=true;$<HTMLInputElement>('bitmap').value='840000';$<HTMLDialogElement>('bitmap-dialog').showModal();}
$('new-project').onclick=()=>openBitmapImport();
$('replace-bitmap').onclick=()=>{if(projectWritable)openBitmapImport(true);};
$('open-project-file').onclick=()=>{$<HTMLDialogElement>('projects-dialog').close();$<HTMLInputElement>('project-file').click();};
$('close-bitmap-dialog').onclick=()=>{stopLoad();$<HTMLDialogElement>('bitmap-dialog').close();};
$('bitmap-dialog').addEventListener('cancel',()=>stopLoad());
$('bitmap-back').onclick=()=>{stopLoad();$<HTMLDialogElement>('bitmap-dialog').close();$('project-name').click();};
$('bitmap-step-back').onclick=()=>{pendingBitmap=undefined;$('bitmap-name-step').hidden=true;$('bitmap-import-step').hidden=false;};

function reflectFilm(){document.body.dataset.aspect=film.aspect;all('button[data-aspect]').forEach(b=>{const active=b.dataset.aspect===film.aspect;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});refreshProjectHeader();$('film-duration').textContent=`${film.clips.length} scenes · ${(previewFrames(film)/30).toFixed(1)} s`;$<HTMLButtonElement>('undo').disabled=!history.canUndo;$<HTMLButtonElement>('redo').disabled=!history.canRedo;}
function source(){$<HTMLInputElement>('bitmap').value=String(data.height);}
function makeRenderer(){physicsPreviewEpoch++;physicsPreviewKey='';clearTimeout(physicsPreviewTimer);renderer?.dispose();renderer=undefined;if(!projectWritable)return;try{renderer=new ClipFilmRenderer(canvas,data,m=>note(m,true),()=>{updateProcessingItems();if(!exporting)draw();});thumbKey='';}catch(e){renderer=undefined;note(`3D error: ${(e as Error).message}`,true);}}
function updateProcessingItems(){
 if(!renderer)return;
 all<HTMLElement>('#clip-track .clip-item').forEach(node=>{const item=film.clips.find(c=>c.id===node.dataset.id);if(item)renderItemProcessing(node,renderer!.processing(film,item));});
}
function preparePhysicsPreview(){
 const current=renderer;if(!current)return;
 const key=collisionSettingsKey(film);
 if(key===physicsPreviewKey)return;physicsPreviewKey=key;const epoch=++physicsPreviewEpoch;clearTimeout(physicsPreviewTimer);
 if(key==='[]')return;
 physicsPreviewTimer=window.setTimeout(async()=>{
  const snapshot=structuredClone(film);note('Precalculating cube collisions…');
  try{await current.prepare(snapshot);updateProcessingItems();if(epoch!==physicsPreviewEpoch||current!==renderer)return;note('Cube collisions ready. Scrub the timeline to preview.');draw();}
  catch(error){if(epoch===physicsPreviewEpoch&&current===renderer){updateProcessingItems();note((error as Error).message,true);}}
 },150);
}
function timecode(n:number){const hundredths=Math.floor(n*100);return `${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}.${(hundredths%100).toString().padStart(2,'0')}`;}
function draw(){
 if(templatePending||!projectWritable||!renderer||exporting)return;
 preparePhysicsPreview();
 try{const stage=$('stage');const pad=innerWidth<=650?30:40,ratio=film.aspect==='16:9'?16/9:film.aspect==='9:16'?9/16:1,w=Math.max(100,Math.min(stage.clientWidth-pad,(stage.clientHeight-pad)*ratio)),h=w/ratio;
 $('canvas-wrap').style.width=w+'px';$('canvas-wrap').style.height=h+'px';const [rw,rh]=previewDimensions(w,h,renderer.maxRenderSize,devicePixelRatio);if(selected===sceneDefaultsSelection){renderer.renderStyle(film,styleView,rw,rh,previewQuality());return;}const cameraItem=draft?film.clips.find(c=>c.id===draft!.id):undefined;const previewTime=cameraItem?Math.min(time,(cameraItem.startFrame+cameraItem.durationFrames-1)/30):time;if(selected===textDefaultsSelection){const sample=makeText('cinematic',0,150,{source:'identity'});sample.position='center';sample.fadeInFrames=sample.fadeOutFrames=0;const identity=makeText('bitmap-identity',0,150);identity.fadeInFrames=identity.fadeOutFrames=0;renderer.render({...film,clips:[makeClip('display',150)],texts:[sample,identity],textStyle:textDefaultsDraft??film.textStyle},2,rw,rh,previewQuality());}else renderer.render(film,previewTime,rw,rh,previewQuality(),draft?cameraEditorPose(draft.base,styleView):undefined);if(selected===renderSelection)reflectQualityFrame();updateClock();}
 catch(e){note((e as Error).message,true);pause();}
}
function updateClock(view:Film=film){reflectCameraTime();reflectItemTiming(view);const total=previewFrames(view),active=activeClip(view,Math.max(0,Math.min(total-1,time*30)));$('timecode').textContent=`${timecode(time)} / ${timecode(total/30)}`;$('active-clip-label').textContent=active?definition(active.clip.type).name.toUpperCase():'';$('playhead').style.left=`${time*30/Math.max(1,total)*100}%`;all<HTMLElement>('.clip-item').forEach(e=>e.classList.toggle('active',!!active&&e.dataset.id===active.clip.id));}
function seek(n:number){pause();range=null;closeDraft();time=clamp(n,0,previewFrames(film)/30);draw();}
async function play(start=time,end=previewFrames(film)/30,onlyClip=false,once=false){
 if(templatePending||end<=start&&end===0)return;
 if(!projectWritable||!renderer||exporting)return;pause();closeDraft();time=start>=end-1/30?onlyClip?start:0:start;range=onlyClip?{start,end}:null;const epoch=++playEpoch;
 try{void renderer.prepare(film).catch(error=>{if(epoch===playEpoch)note((error as Error).message,true);});playing=true;offset=time;clock=performance.now();renderPlaybackButton(true);$('playback-status').textContent='PLAYING';if(film.audio.enabled)void score.play(previewFrames(film)/30,time,film.audio.volume,film.audio.score,film.audio.file).catch(()=>note('Audio is unavailable. Visual preview will continue.'));
 const tick=()=>{if(!playing)return;time=offset+(performance.now()-clock)/1000;const limit=range?.end??previewFrames(film)/30;const boundary=playbackBoundary(time,limit,range?.start??0,loop,once);time=boundary.time;if(boundary.restart){offset=time;clock=performance.now();if(film.audio.enabled)void score.play(previewFrames(film)/30,time,film.audio.volume,film.audio.score,film.audio.file);}if(boundary.stop){pause();draw();return;}draw();raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
 }catch(e){pause();note((e as Error).message,true);}
}
function previewSelected(once=false){const c=clip();if(c)void play(clipStart(film,c.id)/30,(clipStart(film,c.id)+c.durationFrames)/30,true,once);else{const t=text();if(t){const r=textRange(film,t);void play(r.start/30,(r.start+r.duration)/30,true,once);}}}
function setPlaybackLoop(value:boolean){loop=value;$<HTMLInputElement>('timeline-loop').checked=loop;}
$('timeline-loop').onchange=()=>setPlaybackLoop($<HTMLInputElement>('timeline-loop').checked);
$('play').onclick=togglePlayback;$('restart').onclick=()=>seek(0);$('mute').onchange=()=>{score.muted=!$<HTMLInputElement>('mute').checked;score.setVolume(film.audio.volume);};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void $('canvas-wrap').requestFullscreen();};
all('button[data-aspect]').forEach(b=>b.onclick=()=>{closeDraft();edit(p=>p.aspect=b.dataset.aspect as Film['aspect']);});
$('audio-bar').onclick=()=>select(audioSelection);
function restoreHistory(direction:'undo'|'redo'){pause();closeDraft();const p=history[direction]();if(!p)return;film=p;selectedExists();time=clamp(time,0,Math.max(0,previewFrames(film)/30));save();renderTimeline();reflectFilm();renderInspector();renderLibrary();if(selected===renderSelection)renderQualitySettings();draw();}
$('undo').onclick=()=>restoreHistory('undo');$('redo').onclick=()=>restoreHistory('redo');$('deselect').onclick=()=>select(null);

function addClip(type:string,start=clipFrames(film),exact=false){closeDraft();const c=makeClip(type);const ok=edit(p=>{Object.assign(p,exact?insertTimelineItem(p,'clip',c,start).film:insertClipPreview(p,c,start));selected=c.id;});if(ok){note('Scene added.');}}
function renderLibrary(){
 renderTextLibrary();
 const key=data.hash+film.look+JSON.stringify(film.sceneStyle);if(key===thumbKey)return;thumbKey=key;const library=$('clip-library');library.replaceChildren();
 for(const d of clips){
  const descriptions:Record<string,string>={reveal:'Build, Wave, Radial, Scale & Rotate, or Gravity.',display:'Keep the bitmap still, pulse, or wave.',transaction:'Highlight or isolate a transaction.'};
  const card=document.createElement('div');card.className='clip-card scene-library-card';card.dataset.type=d.id;card.draggable=true;card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label',d.name+' scene');card.title='Drag onto the timeline or use the actions menu';
  card.innerHTML=`<span class="scene-library-icon">${sceneIcon(d.id)}</span><div class="scene-library-copy"><strong>${d.id==='transaction'?'Transaction':escape(d.name)}</strong><p>${descriptions[d.id]??escape(d.description)}</p></div><button type="button" class="scene-library-menu" aria-label="${escape(d.name)} actions" title="Add scene…" aria-haspopup="menu" draggable="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>`;
  const menu=card.querySelector<HTMLButtonElement>('.scene-library-menu')!;
  const openMenu=()=>{const bounds=menu.getBoundingClientRect();contextMenu.open(bounds.right,bounds.bottom,['template-start','template-here','template-end'],{template:d.id,kind:'clip',frame:Math.round(time*30)},()=>menu);};
  menu.onclick=e=>{e.stopPropagation();openMenu();};menu.onpointerdown=e=>e.stopPropagation();menu.ondragstart=e=>{e.preventDefault();e.stopPropagation();};
  card.onclick=()=>card.focus({preventScroll:true});card.onkeydown=e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openMenu();}};card.ondragstart=e=>{contextMenu.close(false);beginLibraryDrag(e,d.id);};library.append(card);
 }
 draw();
}

function openAdd(frame?:number,kind:TimelineKind='clip'){
 contextMenu.close(false);const root=$('add-options');root.replaceChildren();$('add-dialog').querySelector('h2')!.textContent=kind==='clip'?'Add scene':'Add text';
 let category='';
 for(const d of kind==='clip'?clips:texts){if(kind==='clip'){const group=('category' in d?d.category:undefined)??'Scenes';if(group!==category){category=group;const heading=document.createElement('h3');heading.className='scene-category';heading.textContent=group;root.append(heading);}}const b=document.createElement('button');b.className='add-choice';b.innerHTML=`<strong>${kind==='clip'?`<span class="add-scene-icon">${sceneIcon(d.id)}</span>`:'T'} ${escape(d.name)}</strong><span>${escape(d.description)}</span>`;b.onclick=()=>{$<HTMLDialogElement>('add-dialog').close();if(kind==='clip')addClip(d.id,frame??clipFrames(film),frame!==undefined);else addText(d.id,frame??time*30,true);};root.append(b);}
 $<HTMLDialogElement>('add-dialog').showModal();
}
$('close-add').onclick=()=>$<HTMLDialogElement>('add-dialog').close();
let textThumbKey='';
let textLibraryPreview:HTMLDivElement|undefined;
function hideTextLibraryPreview(){if(textLibraryPreview)textLibraryPreview.hidden=true;}
function showTextLibraryPreview(card:HTMLElement,canvas:HTMLCanvasElement){
 if(!textLibraryPreview){textLibraryPreview=document.createElement('div');textLibraryPreview.className='text-library-preview';textLibraryPreview.setAttribute('aria-hidden','true');document.body.append(textLibraryPreview);}
 textLibraryPreview.replaceChildren(canvas);textLibraryPreview.hidden=false;
 const rect=card.getBoundingClientRect(),width=Math.min(320,innerWidth-24);textLibraryPreview.style.width=width+'px';
 textLibraryPreview.style.left=Math.max(12,Math.min(rect.right+12,innerWidth-width-12))+'px';
 textLibraryPreview.style.top=Math.max(12,Math.min(rect.top,innerHeight-width*.6-12))+'px';
}
window.addEventListener('scroll',hideTextLibraryPreview,true);window.addEventListener('resize',hideTextLibraryPreview);

function renderTextLibrary(){
 const key=data.hash+film.look+JSON.stringify(film.sceneStyle)+JSON.stringify(film.textStyle);if(key===textThumbKey)return;textThumbKey=key;
 hideTextLibraryPreview();const library=$('text-library');library.replaceChildren();const project={...buildClip({data,look:film.look,sceneStyle:film.sceneStyle},makeClip('display')).engine,textStyle:film.textStyle,accent:film.textStyle.accent};
 const parcels=new Map(data.layout.parcels.map(p=>[p.txIndex,p]));
 for(const d of texts){const card=document.createElement('div');card.className='clip-card text-card compact-text-card';card.dataset.textType=d.id;card.draggable=true;card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label',d.name+' text');card.title='Drag onto the timeline or use the actions menu';
  const example=makeText(d.id,0,150,d.layout==='screen'?(d.id==='caption'?{text:`${data.height}.bitmap`}:{source:d.id==='counter'?'transactions':d.id==='callout'?'transaction':'identity',txIndex:data.layout.parcels[0]?.txIndex??0}):{});example.position='center';
  const plan=buildText({data,look:film.look},example);
  card.innerHTML=`<div class="text-library-copy"><strong>${escape(d.name)}</strong><div class="text-property-tags" aria-label="Supported properties">${d.supportedProperties.map(property=>`<span>${escape(property)}</span>`).join('')}</div></div><button type="button" class="scene-library-menu text-library-menu" aria-label="${escape(d.name)} actions" title="Add text…" aria-haspopup="menu" draggable="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`;
  let canvas:HTMLCanvasElement|undefined;
  card.onmouseenter=()=>{
   if(!canvas){canvas=document.createElement('canvas');canvas.width=480;canvas.height=288;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=project.background==='paper'?'#f2ede6':'#101820';ctx.fillRect(0,0,480,288);
    drawTextPlan(ctx,plan,project,data,2,{width:480,height:288,anchor:tx=>{const p=parcels.get(tx);return p?{x:(p.x+p.size/2)/data.layout.width*480,y:(p.y+p.size/2)/data.layout.height*288,visible:true}:{x:0,y:0,visible:false};}});
   }
   showTextLibraryPreview(card,canvas);
  };card.onmouseleave=hideTextLibraryPreview;
  const menu=card.querySelector<HTMLButtonElement>('.text-library-menu')!;
  const openMenu=()=>{const bounds=menu.getBoundingClientRect();contextMenu.open(bounds.right,bounds.bottom,['template-start','template-here','template-end'],{template:d.id,kind:'text',frame:Math.round(time*30)},()=>menu);};
  menu.onclick=e=>{e.stopPropagation();hideTextLibraryPreview();openMenu();};menu.onpointerdown=e=>e.stopPropagation();menu.ondragstart=e=>{e.preventDefault();e.stopPropagation();};
  card.onclick=()=>card.focus({preventScroll:true});card.onkeydown=e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openMenu();}};card.ondragstart=e=>{hideTextLibraryPreview();contextMenu.close(false);beginLibraryDrag(e,d.id,'text');};library.append(card);

 }
}
function addText(type:string,preferred=time*30,exact=false){
 if(exact||previewFrames(film)===0){const item=makeText(type,0,textDefinition(type).duration.default);let insertion:ReturnType<typeof insertTimelineItem>|undefined;if(edit(p=>{insertion=insertTimelineItem(p,'text',item,preferred);Object.assign(p,insertion.film);selected=item.id;})&&insertion)feedback(`Text added at ${(insertion.startFrame/30).toFixed(2)} s.`);return;}
 const d=textDefinition(type),gap=findTextGap(film,preferred,d.duration.default);if(!gap){note('No free interval for text. Shorten a text or add a scene.',true);return;}
 const t=makeText(type,gap.start,gap.duration);if(edit(p=>{p.texts.push(t);selected=t.id;}))note(`${d.name} added. Customize this text template in properties.`);
}

function renderRuler(){
 const ruler=$('ruler'),duration=(libraryDragScale||previewFrames(film)||300)/30,width=ruler.clientWidth;
 const target=duration/Math.max(1,Math.floor(width/85)),step=[.5,1,2,5,10,15,30,60,120,180].find(n=>n>=target)??180;
 ruler.replaceChildren();
 const label=(seconds:number)=>seconds<60?`${Number(seconds.toFixed(1))}s`:`${Math.floor(seconds/60)}:${Math.round(seconds%60).toString().padStart(2,'0')}`;
 const tick=(seconds:number,major:boolean,end=false)=>{const el=document.createElement('span');el.style.left=seconds/duration*100+'%';el.className=end?'end':major?'':'minor';if(major)el.textContent=label(seconds);else el.setAttribute('aria-hidden','true');ruler.append(el);};
 for(let n=0;n<Math.ceil(duration/(step/5));n++){const seconds=n*step/5;if(seconds>=duration)break;const major=n%5===0;if(major&&duration-seconds<step*.65&&n>0)continue;tick(seconds,major);}
 tick(duration,true,true);
}
function renderTimeline(){
 renderRuler();
 renderClipTrack(film);renderTextTrack(film);
 renderAudioWaveform();updateClock();
}
let waveformKey='';let waveformPeaks:Float32Array=new Float32Array();
function renderAudioWaveform(view:Film=film){
 const button=$('audio-bar'),waveform=$<HTMLCanvasElement>('audio-waveform'),empty=$('audio-empty');
 const state=audioTimelineState(view.audio,previewFrames(view));
 waveform.hidden=!state.hasWaveform;empty.hidden=state.hasWaveform;empty.textContent=state.message;button.classList.toggle('selected',selected===audioSelection);
 button.title=state.label;button.setAttribute('aria-label',state.label);button.classList.toggle('disabled',!view.audio.enabled);
 if(!state.hasWaveform)return;
 const key=(view.audio.file?.data??view.audio.score)+':'+previewFrames(view);
 if(key!==waveformKey){
  waveformKey=key;
  if(view.audio.file){
   waveformPeaks=new Float32Array(2048);
   void decodeImportedAudio(view.audio.file).then(buffer=>{if(waveformKey!==key)return;waveformPeaks=importedWaveform(buffer,previewFrames(view)/30);drawWaveform(waveform,waveformPeaks,film.audio.volume);}).catch(error=>{if(waveformKey===key)note((error as Error).message,true);});
  }else waveformPeaks=scoreWaveform(previewFrames(view)/30,view.audio.score);
 }
 drawWaveform(waveform,waveformPeaks,view.audio.volume);
}

function renderClipTrack(view:Film,animate=false,scaleFrames=previewFrames(view),placeholderId?:string){
 const track=$('clip-track'),total=scaleFrames,previous=new Map<string,number>();
 if(animate)track.querySelectorAll<HTMLElement>('.clip-item').forEach(e=>previous.set(e.dataset.id!,e.getBoundingClientRect().left));
 track.replaceChildren();
 for(const c of view.clips){const d=definition(c.type),node=document.createElement('div');
 node.className=(placeholderId===c.id?'clip-drop-placeholder library-clip-placeholder ':'')+'clip-item'+(c.id===selected?' selected':'')+(clipDrag?.id===c.id&&clipDrag.colliding?' clip-drop-placeholder drop-active':'');node.style.left=c.startFrame/total*100+'%';node.style.width=c.durationFrames/total*100+'%';node.dataset.id=c.id;node.dataset.complexity=d.complexity;node.title='Move only this item; stops at collisions';node.draggable=false;node.dataset.previewId=c.id;node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',sceneLabel(c));const label=document.createElement('span');label.className='clip-label';const kind=document.createElement('span'),variant=document.createElement('span');kind.className='scene-kind';variant.className='scene-type';const parts=sceneLabel(c).split(' · ');kind.textContent=c.type==='transaction'?'Transaction':parts[0]!;variant.textContent=c.type==='transaction'?'Spotlight':parts[1]??parts[0]!;label.append(kind,variant);node.append(label);node.onclick=()=>{if(!clipDrag&&performance.now()>suppressClipClickUntil)select(c.id);};node.ondblclick=()=>{select(c.id);previewSelected();};node.onkeydown=e=>{if(e.key==='Enter')select(c.id);};node.onpointerdown=e=>dragTimelineClip(e,c,node);
 if(placeholderId!==c.id)appendFadeShapes(node,c);
 if(!clipDrag&&placeholderId!==c.id){const handle=document.createElement('button');handle.className='clip-resize';handle.innerHTML='<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M6 5v10M10 5v10"/></svg>';handle.title='Drag to resize and snap to the next item; double-click to fill the gap';handle.setAttribute('aria-label','Resize '+d.name+' duration');handle.onclick=e=>e.stopPropagation();handle.ondblclick=e=>{e.stopPropagation();e.preventDefault();fillItemGap(c.id,'clip');};handle.onpointerdown=e=>resizeHandlePointerDown(e,c,'clip');handle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();edit(p=>Object.assign(p,resizeClipPreview(p,c.id,c.durationFrames+(e.key==='ArrowRight'?3:-3),'push')));}};node.append(handle);}
 appendMoveHandle(node,c,'clip');track.append(node);}
 updateProcessingItems();

 if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)track.querySelectorAll<HTMLElement>('.clip-item').forEach(e=>{const before=previous.get(e.dataset.id!);if(before===undefined)return;const delta=before-e.getBoundingClientRect().left;if(Math.abs(delta)>1)e.animate([{transform:`translateX(${delta}px)`},{transform:'translateX(0)'}],{duration:150,easing:'cubic-bezier(.2,.8,.2,1)'});});
}
function renderTextTrack(view:Film,scaleFrames=previewFrames(view),placeholderId?:string){
 const track=$('text-track');track.replaceChildren();
 for(const t of view.texts){const d=textDefinition(t.type),r=textRange(view,t),node=document.createElement('div');node.className='text-item'+(placeholderId===t.id?' text-drop-placeholder library-text-placeholder':'')+(t.id===selected?' selected':'')+(textDrag?.id===t.id&&textDrag.colliding?' text-drop-placeholder'+(textDrag.active?' drop-active':''):'');node.dataset.id=t.id;node.style.left=r.start/scaleFrames*100+'%';node.style.width=r.duration/scaleFrames*100+'%';node.tabIndex=0;node.setAttribute('role','button');
  const resolved=resolvedText(view,data,t),name=document.createElement('span'),content=document.createElement('span');name.className='text-template-name';name.textContent=d.name;content.className='text-main-preview';content.textContent=resolved.text.replace(/\s+/g,' ');node.append(name,content);appendFadeShapes(node,t);node.title=resolved.text;node.setAttribute('aria-label',d.name+' · '+resolved.text);
  node.onclick=()=>{if(!cancelClipResize&&!textDrag&&performance.now()>suppressClipClickUntil)select(t.id);};node.ondblclick=()=>{select(t.id);previewSelected();};node.onkeydown=e=>{if(e.key==='Enter')select(t.id);};node.onpointerdown=e=>dragText(e,t,node);
  if(!textDrag&&placeholderId!==t.id){const handle=document.createElement('button');handle.className='clip-resize';handle.innerHTML='<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M6 5v10M10 5v10"/></svg>';handle.title='Drag to resize and snap to the next item; double-click to fill the gap';handle.setAttribute('aria-label','Resize '+d.name+' duration');handle.onclick=e=>e.stopPropagation();handle.ondblclick=e=>{e.stopPropagation();e.preventDefault();fillItemGap(t.id,'text');};handle.onpointerdown=e=>resizeHandlePointerDown(e,t,'text');handle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();edit(p=>Object.assign(p,resizeTextPreview(p,t.id,t.durationFrames+(e.key==='ArrowRight'?3:-3),'push')));}};node.append(handle);}
  if(placeholderId!==t.id)appendMoveHandle(node,t,'text');track.append(node);
 }
}
function appendMoveHandle(node:HTMLElement,item:ClipInstance|FilmText,kind:'clip'|'text'){
 const handle=document.createElement('button');handle.className='timeline-group-move';
 handle.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="4" r="1"/><circle cx="13" cy="4" r="1"/><circle cx="7" cy="10" r="1"/><circle cx="13" cy="10" r="1"/><circle cx="7" cy="16" r="1"/><circle cx="13" cy="16" r="1"/></svg>';handle.title=kind==='clip'?'Move this scene and following scenes':'Move this text and following texts';handle.setAttribute('aria-label',handle.title);
 handle.onclick=e=>e.stopPropagation();handle.ondblclick=e=>e.stopPropagation();
 handle.onpointerdown=e=>{e.stopPropagation();e.preventDefault();dragTimelineItem(e,item,node,kind,true);};
 handle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();edit(p=>Object.assign(p,moveTimelinePreview(p,item.id,kind,item.startFrame+(e.key==='ArrowRight'?3:-3),true)));}};
 node.append(handle);
}
let lastResizeTap:{id:string;kind:'clip'|'text';time:number;x:number;y:number}|null=null;
function fillItemGap(id:string,kind:'clip'|'text'){
 if(exporting||clipDrag||textDrag)return;cancelClipResize?.();pause();closeDraft();
 edit(p=>Object.assign(p,fillTimelineGap(p,id,kind)));
}
function resizeHandlePointerDown(event:PointerEvent,item:ClipInstance|FilmText,kind:'clip'|'text'){
 if(event.button!==0||!event.isPrimary)return;
 const now=performance.now(),previous=lastResizeTap;
 if(previous&&previous.id===item.id&&previous.kind===kind&&now-previous.time<400&&Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<6){
  event.preventDefault();event.stopPropagation();lastResizeTap=null;fillItemGap(item.id,kind);return;
 }
 lastResizeTap={id:item.id,kind,time:now,x:event.clientX,y:event.clientY};resizeTimelineItem(event,item,kind);
}
function resizeTimelineItem(event:PointerEvent,c:ClipInstance|FilmText,kind:'clip'|'text'){
 event.stopPropagation();event.preventDefault();
 if(event.button!==0||!event.isPrimary||clipDrag||textDrag||cancelClipResize||exporting)return;
 pause();closeDraft();
 const track=$(kind==='clip'?'clip-track':'text-track'),initial=film,total=previewFrames(initial),width=track.clientWidth,origin=event.clientX;
 if(!width)return;
 let preview=initial,conflict:string|null=null,moved=false;
 try{track.setPointerCapture(event.pointerId);}catch{}
 document.body.classList.add('clip-resizing');
 const update=(e:PointerEvent)=>{
  if(e.pointerId!==event.pointerId)return;e.preventDefault();
  if(!moved&&Math.abs(e.clientX-origin)<3)return;moved=true;lastResizeTap=null;
  const frames=snapResizeFrames(initial,c.id,kind,resizedFrames(c.durationFrames,e.clientX-origin,width,total),Math.max(1,Math.round(8/width*total)));
  preview=kind==='clip'?resizeClipPreview(initial,c.id,frames,'push'):resizeTextPreview(initial,c.id,frames,'push');conflict=null;
  try{preview=validateFilm(preview,data);}catch(error){conflict=(error as Error).message;}
  renderClipTrack(preview,false,total);renderTextTrack(preview,total);reflectItemTiming(preview);
  const resized=(kind==='clip'?preview.clips:preview.texts).find(x=>x.id===c.id)!,seconds=resized.durationFrames/30;
  const input=(c.id===selected?document.getElementById('item-durationFrames'):null) as HTMLInputElement|null;if(input)input.value=String(seconds);
  $('film-duration').textContent=`${preview.clips.length} scenes · ${(previewFrames(preview)/30).toFixed(1)} s`;
  track.querySelector<HTMLElement>(`[data-id="${c.id}"] .clip-resize`)?.classList.toggle('invalid',!!conflict);
  note(conflict??`${kind==='clip'?definition(c.type).name:textDefinition(c.type).name} · ${seconds.toFixed(2)} s`,!!conflict);
 };
 const cleanup=()=>{
  window.removeEventListener('pointermove',update);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);
  cancelClipResize=null;document.body.classList.remove('clip-resizing');suppressClipClickUntil=performance.now()+250;
  try{if(track.hasPointerCapture(event.pointerId))track.releasePointerCapture(event.pointerId);}catch{}
 };
 const restore=()=>{renderTimeline();reflectFilm();renderInspector();draw();};
 const finish=(e:PointerEvent)=>{
  if(e.pointerId!==event.pointerId)return;update(e);cleanup();
  if(!moved){restore();return;}
  if(conflict){restore();note(conflict,true);return;}
  const seconds=(kind==='clip'?preview.clips:preview.texts).find(x=>x.id===c.id)!.durationFrames/30;
  if(edit(p=>Object.assign(p,preview)))note(`${kind==='clip'?'Scene':'Text'} duration set to ${seconds.toFixed(2)} s.`);
 };
 const cancel=(e?:Event)=>{if(e instanceof PointerEvent&&e.pointerId!==event.pointerId)return;cleanup();restore();note('Resize canceled.');};
 cancelClipResize=cancel;window.addEventListener('pointermove',update,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
}
function insideTimeline(track:HTMLElement,event:PointerEvent){
 const rect=track.closest('.timeline-scroll')!.getBoundingClientRect();
 return event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
}
function dragTimelineClip(event:PointerEvent,c:ClipInstance,node:HTMLElement){dragTimelineItem(event,c,node,'clip');}
function dragText(event:PointerEvent,t:FilmText,node:HTMLElement){dragTimelineItem(event,t,node,'text');}
function dragTimelineItem(event:PointerEvent,t:FilmText|ClipInstance,node:HTMLElement,kind:'clip'|'text',group=false){
 const isClip=kind==='clip',dragClass=isClip?'clip-dragging':'text-dragging';
 if(event.button!==0||!event.isPrimary||clipDrag||textDrag||cancelClipResize||exporting||(event.target as Element).closest('.clip-resize')||!group&&(event.target as Element).closest('.timeline-group-move'))return;
 const track=$(isClip?'clip-track':'text-track'),initial=film,total=previewFrames(initial),width=track.clientWidth,origin={x:event.clientX,y:event.clientY},box=node.getBoundingClientRect();if(!width)return;
 let started=false,ghost:HTMLElement|null=null;
 const update=(e:PointerEvent)=>{
  if(e.pointerId!==event.pointerId)return;
  if(!insideTimeline(track,e)){cancel(e);return;}
  if(!started&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<5)return;
  if(!started){started=true;pause();closeDraft();selected=t.id;renderInspector();
   ghost=node.cloneNode(true) as HTMLElement;ghost.className=isClip?'clip-drag-ghost':'text-drag-ghost';ghost.removeAttribute('data-id');ghost.querySelector('.clip-resize')?.remove();ghost.style.left='0';ghost.style.top='0';ghost.style.width=box.width+'px';ghost.style.height=box.height+'px';ghost.setAttribute('aria-hidden','true');document.body.append(ghost);document.body.classList.add(dragClass);
   const state={id:t.id,active:false,colliding:false,preview:initial};if(isClip)clipDrag=state;else textDrag=state;try{track.setPointerCapture(event.pointerId);}catch{}
  }
  e.preventDefault();ghost!.style.transform=`translate3d(${e.clientX-(origin.x-box.left)}px,${e.clientY-(origin.y-box.top)}px,0)`;
  const active=true,wanted=t.startFrame+Math.round((e.clientX-origin.x)/width*total);
  const colliding=false;
  ghost!.hidden=true;document.body.classList.remove(dragClass);document.body.classList.add('text-sliding');
  const preview=moveTimelinePreview(initial,t.id,kind,wanted,group);
  const state={id:t.id,active,colliding,preview};if(isClip)clipDrag=state;else textDrag=state;
  renderClipTrack(preview,false,total);renderTextTrack(preview,total);reflectItemTiming(preview);
  const moved=(isClip?preview.clips:preview.texts).find(x=>x.id===t.id)!;
  const field=document.getElementById('item-startFrame') as HTMLInputElement|null;if(field)field.value=(moved.startFrame/30).toFixed(2);
  $('film-duration').textContent=`${preview.clips.length} scenes · ${(previewFrames(preview)/30).toFixed(1)} s`;
  note(active?colliding?`Release to reorder ${isClip?'scenes':'texts'}.`:`Release to place ${isClip?'scene':'text'} at ${(moved.startFrame/30).toFixed(2)} s.`:'Move canceled.');
 };
 const cleanup=()=>{
  window.removeEventListener('pointermove',update);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);
  if(isClip){clipDrag=null;cancelClipDrag=null;}else{textDrag=null;cancelTextDrag=null;}ghost?.remove();document.body.classList.remove(dragClass,'text-sliding');
  try{if(track.hasPointerCapture(event.pointerId))track.releasePointerCapture(event.pointerId);}catch{}
  if(started)suppressClipClickUntil=performance.now()+250;
 };
 const restore=()=>{renderTimeline();reflectFilm();renderInspector();draw();};
 const finish=(e:PointerEvent)=>{
  if(e.pointerId!==event.pointerId)return;if(!started){cleanup();return;}update(e);const state=isClip?clipDrag:textDrag;if(!state)return;cleanup();
  if(state.active){if(edit(p=>Object.assign(p,state.preview)))note(isClip?'Scene moved.':'Text moved.');}else{restore();note('Move canceled.');}
 };
 const cancel=(e?:Event)=>{if(e instanceof PointerEvent&&e.pointerId!==event.pointerId)return;cleanup();if(started){restore();note('Move canceled.');}};
 if(isClip)cancelClipDrag=cancel;else cancelTextDrag=cancel;window.addEventListener('pointermove',update,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);
}
let scrubPointer:number|null=null;
const scrub=(e:PointerEvent)=>{const r=$('ruler').getBoundingClientRect();seek((e.clientX-r.left)/r.width*previewFrames(film)/30);};
$('ruler').tabIndex=0;$('clip-track').tabIndex=0;$('text-track').tabIndex=0;
const timelineBody=$('timeline-body');
timelineBody.addEventListener('pointerdown',e=>{
 if(e.button!==0||!timelineReady()||!(e.target instanceof Element))return;
 if(e.target.closest('.clip-item,.text-item,#audio-bar,button,input,select'))return;
 const marker=e.target.closest('#playhead'),ruler=e.target.closest<HTMLElement>('.ruler');
 if(!marker&&!ruler)return;const surface=ruler??$('ruler');
 e.preventDefault();contextMenu.close(false);surface.focus({preventScroll:true});
 scrubPointer=e.pointerId;timelineBody.setPointerCapture(e.pointerId);if(ruler)scrub(e);
});
timelineBody.addEventListener('pointermove',e=>{if(e.pointerId===scrubPointer)scrub(e);});
const endScrub=(e:PointerEvent)=>{if(e.pointerId!==scrubPointer)return;scrubPointer=null;if(timelineBody.hasPointerCapture(e.pointerId))timelineBody.releasePointerCapture(e.pointerId);};
timelineBody.addEventListener('pointerup',endScrub);timelineBody.addEventListener('pointercancel',endScrub);timelineBody.addEventListener('lostpointercapture',endScrub);
window.addEventListener('blur',()=>{scrubPointer=null;});


function options(list:readonly {value:string;label:string}[],value:unknown){return list.map(o=>`<option value="${escape(o.value)}"${o.value===String(value)?' selected':''}>${escape(o.label)}</option>`).join('');}
function controlHTML(c:ClipInstance,control:Control){if(!controlVisible(c.settings,control))return '';const value=c.settings[control.key],id='setting-'+control.key;
 if(control.kind==='transaction'){const tx=data.layout.parcels.find(p=>p.txIndex===Number(value));return `<label>${escape(control.label)}</label><div class="target-card">#${tx?.txIndex??'—'} · ${tx?btc(tx.totalSats,4):'—'} BTC<br>Output value</div><button id="choose-tx" class="secondary full">Find transaction</button>`;}
 if(control.kind==='toggle')return `<label class="check"><input id="${id}" data-setting="${escape(control.key)}" type="checkbox"${value?' checked':''}>${escape(control.label)}</label>`;
 if(control.kind==='select')return `<label for="${id}">${escape(control.label)}</label><select id="${id}" data-setting="${escape(control.key)}">${options(control.options!,value)}</select>`;
 return `<label for="${id}">${escape(control.label)}<span class="field-value" id="value-${control.key}">${control.unit==='percent'?Math.round(Number(value)*100)+'%':control.unit==='multiplier'?value+'×':control.unit==='degrees'?value+'°':control.unit==='seconds'?value+' s':escape(value)}</span></label><input id="${id}" data-unit="${control.unit??''}" data-setting="${escape(control.key)}" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${escape(value)}">`;
}
function renderInspector(){all<HTMLDetailsElement>('[data-foldout]').forEach(node=>foldoutState.set(`${node.dataset.objectId}:${node.dataset.foldout}`,node.open));const root=$('inspector-content'),c=clip(),t=text(),renderSettings=selected===renderSelection,defaults=selected===sceneDefaultsSelection||selected===textDefaultsSelection;
 $('inspector').classList.toggle('open',!!c||!!t||selected===audioSelection||renderSettings||defaults);
 $('inspector').querySelector<HTMLElement>('.inspector-heading')!.hidden=!c&&!t&&selected!==audioSelection&&!renderSettings&&!defaults;
 document.body.classList.toggle('render-settings-open',renderSettings);
 $('render-settings-panel').hidden=!renderSettings;root.hidden=renderSettings;
 for(const [id,value] of [['global-scene-style',sceneDefaultsSelection],['global-text-style',textDefaultsSelection]]){const button=$(id!);button.classList.toggle('active',selected===value);button.setAttribute('aria-expanded',String(selected===value));}
 $('inspector-label').textContent=defaults?(selected===sceneDefaultsSelection?'Default Scene Settings':'Text Style'):renderSettings?'Render settings':c?'Scene':t?'Text':selected===audioSelection?'Audio':'Properties';
 $('preview-item-once').hidden=!c&&!t;$<HTMLButtonElement>('preview-item-once').disabled=!!draft;
 const playLabel=`Play ${c?'scene':'text'} once (P)`;$('preview-item-once').setAttribute('aria-label',playLabel);$('preview-item-once').title=playLabel;
 $('render-settings').classList.toggle('active',renderSettings);$('render-settings').setAttribute('aria-pressed',String(renderSettings));$('render-settings').setAttribute('aria-expanded',String(renderSettings));$('deselect').setAttribute('aria-label',renderSettings?'Close render settings':'Close properties');
 $('item-actions').hidden=!c&&!t;
 const timing=$('item-timing-header');timing.hidden=!c&&!t;timing.innerHTML=c||t?itemTimingHTML((c??t)!):'';

 if(defaults){renderDefaultsPanel(root);return;}
 if(renderSettings){renderQualitySettings();reflectQualityFrame();return;}
 if(selected===audioSelection){renderAudioInspector(root);return;}
 if(!c&&!t){root.innerHTML='<div class="empty"><span>⌖</span><h2>Select a template.</h2><p class="muted">Choose a scene or text on the timeline to edit its settings.</p></div>';return;}

 if(c){const d=definition(c.type);
 root.innerHTML=`<h1>${escape(d.name)}</h1><p class="object-description">${escape(d.description)}</p>${d.controls.length?foldoutHTML('settings','Settings',`${conditionalControls(controlsFor(c.type),c.settings,f=>controlHTML(c,f))}`):''}${objectModulesHTML(d.modules,c)}`;
 all<HTMLElement>('[data-phase-weight]').forEach(e=>e.style.flex=e.dataset.phaseWeight!);
 bindClip(c);
 }else if(t){const d=textDefinition(t.type),resolved=resolvedText(film,data,t);
 root.innerHTML=`<h1>${escape(d.name)}</h1><p class="object-description">${escape(d.description)}</p>${foldoutHTML('settings','Settings',`${conditionalControls(d.controls,t.settings,control=>textControlHTML(t,control))}${t.settings.source&&t.settings.source!=='manual'?`<div class="conditional-fields"><div class="target-card">${escape(resolved.kicker)}<br>${escape(resolved.text)}</div><button id="customize-text" class="secondary full">Customize this value</button></div>`:''}${d.layout==='transactions'?'<p class="muted small">Values come directly from the visible transactions. This template has no manual text fields.</p>':''}${t.settings.source==='transaction'||t.type==='callout'?'<div class="conditional-fields"><button id="choose-text-tx" class="secondary full">Find transaction</button></div>':''}<div class="settings-appearance">${d.layout==='screen'?`<label for="text-position">Position</label><select id="text-position">${options([{value:'bottom',label:'Bottom'},{value:'center',label:'Center'},{value:'top',label:'Top'}],t.position)}</select>`:''}<label>Scale <span id="scale-label" class="field-value">${Math.round(t.scale*100)}%</span></label><input id="text-scale" type="range" min="70" max="140" step="5" value="${t.scale*100}"></div>`)}${objectModulesHTML(d.modules,t)}<button id="duplicate-text" class="secondary full">⧉ Duplicate text</button><button id="delete-selection" class="danger full">Remove text</button>`;
 bindText(t);
 }
 bindTimelineControls((c??t)!);
 all<HTMLDetailsElement>('[data-foldout]').forEach(node=>node.ontoggle=()=>{if(node.isConnected)foldoutState.set(`${node.dataset.objectId}:${node.dataset.foldout}`,node.open);});
 const removeButton=document.getElementById('delete-selection');if(removeButton)removeButton.onclick=removeSelection;
}
function foldoutHTML(id:string,label:string,body:string){const open=foldoutState.get(`${selected}:${id}`)??true;return `<details class="object-foldout" data-foldout="${id}" data-object-id="${escape(selected)}"${open?' open':''}><summary>${escape(label)}</summary><div class="object-foldout-body">${body}</div></details>`;}
function objectModulesHTML(modules:readonly TimelineModule[],item:ClipInstance|FilmText){
 const renderers:Record<string,()=>string>={camera:()=>cameraModuleHTML(item as ClipInstance),'scene-style':()=>sceneStyleModuleHTML(item as ClipInstance),'text-style':()=>textStyleModuleHTML(item as FilmText),fade:()=>''};
 return modules.filter(module=>module.id!=='fade').map(module=>foldoutHTML(module.id,module.label,renderers[module.id]!())).join('');
}
function cameraModuleHTML(c:ClipInstance){
 const motion=c.type==='reveal'||c.type==='display'||c.type==='transaction'?conditionalControls(cameraMotionControls,c.settings,control=>controlHTML(c,control)):'';
 const d=definition(c.type),hasPrevious=film.clips.some(item=>item.id!==c.id&&item.startFrame+item.durationFrames<=c.startFrame),mode=cameraMode(c.settings,hasPrevious);
 const choices=[...(hasPrevious?[{value:'inherit',label:'Match previous camera'}]:[]),{value:'default',label:'Default Scene Settings'},{value:'custom',label:mode==='custom'?'Custom view':'Custom view…'}];
 return `<select id="camera-mode" aria-label="Camera position">${options(choices,mode)}</select>${mode==='custom'?'<div class="conditional-fields">':''}${mode==='custom'?(d.cameraControls??[]).map(slot=>`${(d.cameraControls?.length??0)>1?`<label>${escape(slot.label)}</label>`:''}<button class="secondary full" data-camera-adjust="${slot.key}" data-camera-at="${slot.at}">⌖ Edit camera</button>`).join(''):''}${mode==='custom'?'</div>':''}${motion}`;
}
function sceneStyleModuleHTML(c:ClipInstance){
 return `<select id="clip-style-mode">${options([{value:'inherit',label:'Inherit Default Scene Settings'},{value:'local',label:'Customize this scene'}],c.styleOverride?'local':'inherit')}</select>${c.styleOverride?`<div id="clip-style-fields" class="conditional-fields">${sceneStyleFields(effectiveStyle(film,c.id),'clip-style')}<button id="reset-style" class="quiet full">Reset to Default Scene Settings</button></div>`:''}`;
}

function itemTimingHTML(item:ClipInstance|FilmText){
 const local=Math.max(0,Math.min(item.durationFrames/30,time-item.startFrame/30)),isScene=film.clips.some(c=>c.id===item.id),limits=isScene?definition(item.type).duration:textDefinition(item.type).duration;
 return `<div class="item-time-row"><label for="item-current-time">Time<span class="compact-seconds"><input id="item-current-time" title="Current time within this item" aria-label="Current item time in seconds" type="number" min="0" max="${item.durationFrames/30}" step="0.01" value="${local.toFixed(2)}"><span>s</span></span></label><label for="item-durationFrames">Duration<span class="compact-seconds"><input id="item-durationFrames" aria-label="Item duration in seconds" type="number" min="${limits.min/30}"${'max' in limits?` max="${Number(limits.max)/30}"`:''} step="0.1" value="${(item.durationFrames/30).toFixed(2)}"><span>s</span></span></label></div><div class="item-fade-row">${timelineControls.map(({key})=>`<label for="item-${key}">${key==='fadeInFrames'?'Fade in':'Fade out'}<span class="compact-seconds"><input id="item-${key}" aria-label="${key==='fadeInFrames'?'Fade in':'Fade out'} in seconds" type="number" min="0" max="2" step="0.1" value="${item[key]/30}"><span>s</span></span></label>`).join('')}</div>`;
}
function reflectItemTiming(view:Film=film){
 const item=view.clips.find(c=>c.id===selected)??view.texts.find(t=>t.id===selected),current=document.getElementById('item-current-time') as HTMLInputElement|null,duration=document.getElementById('item-durationFrames') as HTMLInputElement|null;
 if(!item||!current||!duration)return;
 current.max=String(item.durationFrames/30);if(document.activeElement!==current)current.value=Math.max(0,Math.min(item.durationFrames/30,time-item.startFrame/30)).toFixed(2);if(document.activeElement!==duration)duration.value=(item.durationFrames/30).toFixed(2);
}
function bindTimelineControls(item:ClipInstance|FilmText){
 const timeInput=$<HTMLInputElement>('item-current-time'),durationInput=$<HTMLInputElement>('item-durationFrames');
 timeInput.onchange=()=>{const value=timeInput.valueAsNumber;if(!Number.isFinite(value)){reflectItemTiming();return;}seek(item.startFrame/30+Math.max(0,Math.min(item.durationFrames/30,Math.round(value*30)/30)));timeInput.value=Math.max(0,Math.min(item.durationFrames/30,time-item.startFrame/30)).toFixed(2);};
 durationInput.onchange=()=>{const value=durationInput.valueAsNumber;if(!Number.isFinite(value)){durationInput.value=(item.durationFrames/30).toFixed(2);return;}pause();closeDraft();edit(p=>Object.assign(p,(p.clips.some(c=>c.id===item.id)?resizeClipPreview:resizeTextPreview)(p,item.id,Math.round(value*30),'push')));};
 for(const {key} of timelineControls){const input=document.getElementById('item-'+key);if(!input)continue;input.onchange=()=>edit(p=>{
  const value=Math.round(Number($<HTMLInputElement>('item-'+key).value)*30);
  const current=p.clips.find(c=>c.id===item.id)??p.texts.find(t=>t.id===item.id)!;
  current[key]=value;
 });}
}
function appendFadeShapes(node:HTMLElement,item:TimelineCommon){
 const fades=itemFadeFrames(item);
 for(const edge of ['incoming','outgoing'] as const){if(!fades[edge])continue;const shape=document.createElement('span');shape.className='clip-fade '+edge;shape.style.width=fades[edge]/item.durationFrames*100+'%';shape.setAttribute('aria-hidden','true');node.prepend(shape);}
}
let audioImportEpoch=0;
function renderAudioInspector(root:HTMLElement){
 root.innerHTML=`<div class="eyebrow">AUDIO / SOUNDTRACK</div><h1>Your soundtrack.</h1><p class="muted intro">Choose music for the audio timeline.</p><section><h3>Soundtrack</h3><label class="check"><input id="audio-enabled" type="checkbox"${film.audio.enabled?' checked':''}> Include music in video</label><div class="conditional-fields"${film.audio.enabled?'':' hidden'}><button id="choose-audio-file" class="secondary full">${film.audio.file?'Replace audio file':'Choose audio file'}</button><input id="audio-file" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac" hidden>${film.audio.file?`<p class="muted small">${escape(film.audio.file.name)} · ${film.audio.file.duration.toFixed(1)} s</p><button id="use-generated-audio" class="secondary full">Use generative music</button>`:''}<p class="muted small">MP3, WAV, M4A, OGG, or another browser-supported audio file. Up to 20 MB. Stored with this project.</p><div${film.audio.file?' hidden':''}><label for="audio-score">Generative music</label><select id="audio-score">${options(availableScores.map(value=>({value,label:scores[value].name+' · '+scores[value].bpm+' BPM'})),['pulse','minimal'].includes(film.audio.score)?'jazz':film.audio.score)}</select><p class="muted small">${scoreInstruments[film.audio.score]}</p></div><label for="audio-volume">Volume <span id="audio-volume-label" class="field-value">${Math.round(film.audio.volume*100)}%</span></label><input id="audio-volume" type="range" min="0" max="100" step="5" value="${film.audio.volume*100}"><p class="muted small">${film.audio.file?'Longer files are trimmed to the video length. Shorter files end in silence.':'Original music synthesized in your browser.'} Muting preview keeps audio in the exported video.</p></div></section><section><h3>Time</h3><p class="muted small">${filmFrames(film)?`The soundtrack covers the film’s ${(filmFrames(film)/30).toFixed(2)} seconds. Scenes and text define its duration.`:`Audio-only preview: ${(previewFrames(film)/30).toFixed(2)} seconds. Add a scene or text to create a video.`}</p></section>`;
 $('choose-audio-file').onclick=()=>$<HTMLInputElement>('audio-file').click();
 $('audio-file').onchange=async()=>{
  const file=$<HTMLInputElement>('audio-file').files?.[0];if(!file)return;
  const epoch=++audioImportEpoch,initialProject=projectId;
  const button=$<HTMLButtonElement>('choose-audio-file');button.disabled=true;button.textContent='Loading audio…';
  try{
   const imported=await importAudioFile(file);
   if(epoch!==audioImportEpoch||projectId!==initialProject)return;
   pause();
   if(edit(p=>{p.audio.file=imported;p.audio.enabled=true;}))note('Audio file added.');
   else console.error('Audio import could not be applied to the project.');
  }catch(error){console.error('Audio import failed.',error);note((error as Error).message,true);}
  finally{if(selected===audioSelection&&projectId===initialProject)renderInspector();}
 };
 document.getElementById('use-generated-audio')?.addEventListener('click',()=>{audioImportEpoch++;pause();edit(p=>{delete p.audio.file;});});
 $('audio-enabled').onchange=()=>edit(p=>p.audio.enabled=$<HTMLInputElement>('audio-enabled').checked);
 $('audio-score').onchange=()=>edit(p=>{p.audio.score=$<HTMLSelectElement>('audio-score').value as Film['audio']['score'];p.audio.enabled=true;});
 $('audio-volume').oninput=()=>{const volume=Number($<HTMLInputElement>('audio-volume').value);if(edit(p=>p.audio.volume=volume/100,false,'audio-volume'))$('audio-volume-label').textContent=volume+'%';};
}
function openCameraEditor(c:ClipInstance,key:string,label:string,enteringCustom=false){
 if(!renderer)return;
 pause();closeDraft();const savedTime=time,savedView=structuredClone(styleView),plan=renderer.plan(film,c);
 const previewTime=cameraEditTime(c.startFrame,c.durationFrames,savedTime),local=previewTime-c.startFrame/30,pose=sampleCamera(data,plan.engine,local,canvas.width/canvas.height);
 const base:CameraSetting={position:pose.position.toArray(),target:pose.target.toArray(),fov:pose.fov};
 styleView=cameraEditorView(base);draft={id:c.id,key,base,initial:structuredClone(styleView),savedTime,savedView,enteringCustom};
 time=previewTime;document.body.classList.add('framing');$('camera-editor-context').textContent=`${definition(c.type).name} · ${label}`;framingUI(true);renderInspector();draw();canvas.focus({preventScroll:true});
}
function bindClip(c:ClipInstance){
 const mode=document.getElementById('camera-mode') as HTMLSelectElement|null;
 if(mode)mode.onchange=()=>{
  closeDraft();const selectedMode=mode.value;
  if(selectedMode==='custom'){const slot=definition(c.type).cameraControls?.[0];if(slot)openCameraEditor(c,slot.key,slot.label,true);else renderInspector();return;}
  edit(p=>{const settings=p.clips.find(x=>x.id===c.id)!.settings;settings.inheritLastCamera=selectedMode==='inherit';
   if(selectedMode==='default'){delete settings.cameraA;delete settings.cameraB;}
  });
 };
 all<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(input=>{const act=()=>{const v=input instanceof HTMLInputElement?(input.type==='checkbox'?input.checked:input.type==='range'||input.type==='number'?Number(input.value):input.value):input.value;const ok=edit(p=>p.clips.find(x=>x.id===c.id)!.settings[input.dataset.setting!]=v,input.type!=='range','setting:'+input.dataset.setting);if(!ok)return;if(input.type==='range'){const current=film.clips.find(x=>x.id===c.id)!,phases=buildClip({data,look:film.look,sceneStyle:film.sceneStyle},current).phases;all<HTMLElement>('[data-phase-weight]').forEach((e,i)=>{const phase=phases[i];if(phase)e.style.flex=String(phase.to-phase.from);});}const label=document.getElementById('value-'+input.dataset.setting);if(label)label.textContent=input.dataset.unit==='percent'?Math.round(Number(v)*100)+'%':input.dataset.unit==='multiplier'?v+'×':input.dataset.unit==='degrees'?v+'°':input.dataset.unit==='seconds'?v+' s':String(v);};if(input.type==='range')input.oninput=act;else input.onchange=act;});
 if(document.getElementById('choose-tx'))$('choose-tx').onclick=openTx;
 const styleMode=document.getElementById('clip-style-mode');if(styleMode)styleMode.onchange=()=>edit(p=>p.clips.find(x=>x.id===c.id)!.styleOverride=$<HTMLSelectElement>('clip-style-mode').value==='local'?{}:null);
 if(styleMode&&c.styleOverride){bindStyleFields($('clip-style-fields'),c.id);$('reset-style').onclick=()=>edit(p=>p.clips.find(x=>x.id===c.id)!.styleOverride=null);}
 all<HTMLElement>('[data-camera-adjust]').forEach(button=>button.onclick=()=>openCameraEditor(c,button.dataset.cameraAdjust!,button.previousElementSibling?.textContent??'Camera'));

}

function textControlHTML(t:FilmText,c:TextControl){
 if(!textControlVisible(t.settings,c))return '';const id='text-setting-'+c.key,value=t.settings[c.key],attrs=`id="${id}" data-text-setting="${escape(c.key)}"`;
 if(c.kind==='toggle')return `<label class="check"><input ${attrs} type="checkbox"${value?' checked':''}>${escape(c.label)}</label>`;
 const label=`<label for="${id}">${escape(c.label)}</label>`;
 if(c.kind==='select')return label+`<select ${attrs}>${options(c.options!,value)}</select>`;
 if(c.kind==='textarea')return label+`<textarea ${attrs} rows="4" maxlength="${c.maxLength??500}">${escape(value)}</textarea>`;
 return label+`<input ${attrs} type="${c.kind}" value="${escape(value)}"${c.maxLength?` maxlength="${c.maxLength}"`:''}${c.min!==undefined?` min="${c.min}"`:''}${c.max!==undefined?` max="${c.max}"`:''}${c.step!==undefined?` step="${c.step}"`:''}>`;
}
function bindText(t:FilmText){
 const mode=document.getElementById('text-style-mode') as HTMLSelectElement|null;
 if(mode)mode.onchange=()=>edit(p=>p.texts.find(x=>x.id===t.id)!.textStyleOverride=mode.value==='local'?{}:null);
 const fields=document.getElementById('text-style-fields');if(fields)bindTextStyleFields(fields,t.id);
 const reset=document.getElementById('reset-text-style');if(reset)reset.onclick=()=>edit(p=>p.texts.find(x=>x.id===t.id)!.textStyleOverride=null);
 all<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[data-text-setting]').forEach(input=>{
  const act=()=>{const key=input.dataset.textSetting!,numeric=input instanceof HTMLInputElement&&(input.type==='number'||input.type==='range'),value=input instanceof HTMLInputElement&&input.type==='checkbox'?input.checked:numeric?Number(input.value):input.value;
   edit(p=>{const current=p.texts.find(x=>x.id===t.id)!;if(key==='source'&&value==='manual'&&current.settings.source!=='manual'){const resolved=resolvedText(p,data,current);current.settings.text=resolved.text;current.settings.kicker=resolved.kicker;}current.settings[key]=value;},input instanceof HTMLSelectElement||input instanceof HTMLInputElement&&(input.type==='checkbox'||input.type==='number'),'text:'+t.id+':'+key);
  };if(input instanceof HTMLSelectElement||input instanceof HTMLInputElement&&(input.type==='checkbox'||input.type==='number'))input.onchange=act;else input.oninput=act;
 });
 if(document.getElementById('customize-text'))$('customize-text').onclick=()=>edit(p=>{const current=p.texts.find(x=>x.id===t.id)!,resolved=resolvedText(p,data,current);Object.assign(current.settings,{source:'manual',text:resolved.text,kicker:resolved.kicker});});
 if(document.getElementById('choose-text-tx'))$('choose-text-tx').onclick=openTx;
 if(document.getElementById('text-position'))$('text-position').onchange=()=>edit(p=>p.texts.find(x=>x.id===t.id)!.position=$<HTMLSelectElement>('text-position').value as FilmText['position']);
 $('text-scale').oninput=()=>{const value=Number($<HTMLInputElement>('text-scale').value);edit(p=>p.texts.find(x=>x.id===t.id)!.scale=value/100,false,'scale:'+t.id);$('scale-label').textContent=value+'%';};
 $('duplicate-text').onclick=()=>commands.execute('duplicate',{itemId:t.id});
}
function removeSelection(){if(clip()||text()){commands.execute('delete');return;}if(selected===renderSelection){select(null);return;}closeDraft();if(selected===audioSelection){edit(p=>p.audio.enabled=false);return;}const c=clip(),t=text();edit(p=>{if(c){p.clips=p.clips.filter(x=>x.id!==c.id);}else if(t)p.texts=p.texts.filter(x=>x.id!==t.id);selected=null;});}
function openTx(){renderTx();$<HTMLDialogElement>('tx-dialog').showModal();}
function renderTx(){const list=$('tx-results'),q=$<HTMLInputElement>('tx-search').value.trim().replace(/^#/,'').toLowerCase();list.replaceChildren();const numeric=/^\d{1,6}$/.test(q),rows=data.layout.parcels.filter(p=>!q||(numeric?p.txIndex===Number(q):p.txid.startsWith(q))).slice(0,40);for(const p of rows){const b=document.createElement('button');b.className='tx-result';b.textContent=`#${p.txIndex} · ${btc(p.totalSats,4)} BTC · ${p.size} × ${p.size}\n${p.txid.slice(0,18)}…`;b.onclick=()=>chooseTx(p.txIndex);list.append(b);}if(!rows.length)list.textContent='No transactions found.';}
function chooseTx(index:number){const c=clip(),t=text();if((!c||c.type!=='transaction')&&(!t||t.settings.source!=='transaction'&&t.type!=='callout'))return;$('stage-message').hidden=true;$<HTMLDialogElement>('tx-dialog').close();edit(p=>{if(t){p.texts.find(x=>x.id===t.id)!.settings.txIndex=index;}else{const x=p.clips.find(x=>x.id===c!.id)!;x.settings.target='selected';x.settings.txIndex=index;}});}
$('tx-search').oninput=renderTx;$('close-tx').onclick=()=>$<HTMLDialogElement>('tx-dialog').close();
let styleDrag:{id:number;button:number;view:StyleView;pose:{position:number[];target:number[];fov:number};x:number;y:number;yaw:number;elevation:number}|null=null;
const styleTouches=new Map<number,{x:number;y:number}>();
let touchStart:{view:StyleView;pose:{position:number[];target:number[];fov:number};x:number;y:number;span:number}|null=null;
function touchGeometry(){const points=[...styleTouches.values()].slice(0,2),a=points[0]!,b=points[1]??a;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,span:Math.hypot(b.x-a.x,b.y-a.y)};}
function rebaseTouches(){touchStart=styleTouches.size&&canvas.dataset.camera?{view:structuredClone(styleView),pose:JSON.parse(canvas.dataset.camera),...touchGeometry()}:null;}
canvas.onpointerdown=e=>{
 canvas.classList.add('pointer-focus');
 if(e.button!==0&&e.button!==1&&e.button!==2)return;
 contextMenu.close(false);canvas.focus({preventScroll:true});
 if(cameraNavigationActive()){
  e.preventDefault();if(!canvas.dataset.camera)return;
  if(e.pointerType==='touch'){styleTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});rebaseTouches();}
  else styleDrag={id:e.pointerId,button:e.button,view:structuredClone(styleView),pose:JSON.parse(canvas.dataset.camera),x:e.clientX,y:e.clientY,yaw:styleView.yaw,elevation:styleView.elevation};
  canvas.setPointerCapture(e.pointerId);return;
 }
 return;
};
canvas.onpointermove=e=>{
 if(styleTouches.has(e.pointerId)&&touchStart){
  styleTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});const current=touchGeometry(),start=touchStart;
  if(styleTouches.size===1)styleView={...start.view,yaw:start.view.yaw-(current.x-start.x)*.3,elevation:clamp(start.view.elevation+(current.y-start.y)*.2,10,89)};
  else {styleView=panStyle(start.view,start.pose.position,start.pose.target,start.pose.fov,canvas.getBoundingClientRect().height,current.x-start.x,current.y-start.y);if(start.span>0&&current.span>0)styleView.distance=clamp(start.view.distance*start.span/current.span,.1,32);}
  draw();return;
 }
 if(styleDrag){
  if(e.pointerId!==styleDrag.id)return;
  if(styleDrag.button===1)styleView.distance=clamp(styleDrag.view.distance*Math.exp((e.clientY-styleDrag.y)*.01),.1,32);
  else if(styleDrag.button===2)styleView=panStyle(styleDrag.view,styleDrag.pose.position,styleDrag.pose.target,styleDrag.pose.fov,canvas.getBoundingClientRect().height,e.clientX-styleDrag.x,e.clientY-styleDrag.y);
  else {styleView.yaw=styleDrag.yaw-(e.clientX-styleDrag.x)*.3;styleView.elevation=clamp(styleDrag.elevation+(e.clientY-styleDrag.y)*.2,10,89);}
  draw();return;
 }
 return;
};
function endViewportPointer(e:PointerEvent){if(styleTouches.delete(e.pointerId))rebaseTouches();if(styleDrag?.id===e.pointerId)styleDrag=null;}
canvas.onpointerup=canvas.onpointercancel=endViewportPointer;
canvas.addEventListener('lostpointercapture',endViewportPointer);
canvas.addEventListener('auxclick',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(cameraNavigationActive()){e.preventDefault();styleView.distance=clamp(styleView.distance*Math.exp(e.deltaY*.001),.1,32);draw();return;}},{passive:false});

function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('save-project').onclick=()=>download(new Blob([JSON.stringify({name:projectName,film,data},null,2)],{type:'application/json'}),`${projectName.replace(/[^a-z0-9._ -]/gi,'_')}.json`);
$('project-file').onchange=async()=>{const input=$<HTMLInputElement>('project-file'),file=input.files?.[0];if(!file)return;try{if(file.size>25000000)throw Error('Project exceeds 25 MB.');const doc=parseDocument(JSON.parse(await file.text()));await flushProject();templatePending=false;projectWritable=true;projectId=crypto.randomUUID();projectName=file.name.replace(/\.json$/i,'');pause();closeDraft();stopLoad();data=doc.data;film=doc.film;if(selected===renderSelection)renderQualitySettings();time=1.8;selected=null;history.reset(film);makeRenderer();source();renderTimeline();reflectFilm();renderInspector();renderLibrary();draw();save();$<HTMLDialogElement>('bitmap-dialog').close();note('Scene project imported.');}catch(e){note((e as Error).message,true);}finally{input.value='';}};
function loading(value:boolean){$('load-bitmap').classList.toggle('fetching',value);$('load-bitmap').setAttribute('aria-busy',String(value));$<HTMLButtonElement>('load-bitmap').disabled=value;$<HTMLInputElement>('bitmap').disabled=value;$('cancel-load').hidden=!value;$<HTMLButtonElement>('open-export').disabled=value||!projectWritable;}
function stopLoad(){loadEpoch++;worker?.terminate();worker=undefined;loading(false);}
let pendingBitmap:StoredBitmap|undefined;
function importLog(message:string){const terminal=$('bitmap-terminal');terminal.hidden=false;terminal.textContent+=`[${new Date().toLocaleTimeString()}] ${message}\n`;terminal.scrollTop=terminal.scrollHeight;}
function renderBitmapDetails(record:StoredBitmap|undefined,tableId:string,dateId:string,scene:SceneData){
 const info=record?.inscription.info,owner=info?.address??record?.inscription.recursiveInfo.address;
 const rows:[string,string][]=[['Owner',typeof owner==='string'&&owner?owner:'Unavailable'],['Transactions',scene.txCount.toLocaleString('en-US')],['Output value',btc(scene.totalSats,2)+' BTC'],['Layout',`${scene.layout.width} × ${scene.layout.height}`]];
 if(record){rows.push(['Inscription',info?.number!==undefined?`#${info.number.toLocaleString('en-US')}`:record.inscription.id]);if(info?.number!==undefined)rows.push(['Inscription ID',record.inscription.id]);}
 $(tableId).replaceChildren();for(const [label,value] of rows){const row=document.createElement('tr'),heading=document.createElement('th'),cell=document.createElement('td');heading.scope='row';heading.textContent=label;cell.textContent=value;row.append(heading,cell);$(tableId).append(row);}
 $(dateId).textContent=record?`Data saved locally · Owner as of ${new Date(record.inscription.checkedAt).toLocaleString()}`:'Refetch to load inscription and owner details.';
}
function downloadBitmap(height:number,epoch:number,log:(message:string)=>void,complete:(record:StoredBitmap)=>Promise<void>,failed:()=>void,refetch=false){
 const collector=new BitmapImport(height),active=new Worker('./worker.js',{type:'module'});worker=active;let completing=false;
 active.onmessage=async(event:MessageEvent<WorkerMessage>)=>{if(epoch!==loadEpoch||completing)return;const message=event.data;
  try{if(message.type==='progress')log(`${message.scope}: ${message.progress.message}`);
   if(message.type==='block-result')log('Block and transactions downloaded. Bitmap layout computed.');
   if(message.type==='result'&&message.result)log(`Inscription verified: ${message.result.id}`);
   const record=collector.accept(message);if(!record)return;completing=true;await complete(record);
  }catch(error){if(epoch!==loadEpoch)return;stopLoad();log(`ERROR: ${(error as Error).message}`);failed();}
 };
 active.onerror=()=>{if(epoch===loadEpoch){stopLoad();log('ERROR: Blockchain download failed. Try again.');failed();}};active.postMessage({bitmap:height,refetch});
}

function readyBitmap(record:StoredBitmap){
 const prepared=replacingProjectId?prepareBitmapReplacement(film,record.data):undefined;
 pendingBitmap=record;stopLoad();$('bitmap-import-step').hidden=true;$('bitmap-name-step').hidden=false;
 $('bitmap-import-summary').textContent=`✓ ${record.height}.bitmap loaded successfully`;$('bitmap-create-error').hidden=true;
 renderBitmapDetails(record,'bitmap-details','bitmap-owner-date',record.data);
 if(prepared){$('bitmap-replace-confirmation').hidden=false;$('bitmap-replace-confirmation').textContent=`Replace ${data.height}.bitmap with ${record.height}.bitmap in this video and save with the name below. Scenes, timing, effects, texts and audio are kept. Cameras are recalibrated for the new bitmap.${prepared.adjusted?` ${prepared.adjusted} unavailable transaction reference(s) will use the largest parcel.`:''}`;}
 $<HTMLInputElement>('new-project-name').value=`${record.height}.bitmap`;$('new-project-name').focus();
}

$('cancel-load').onclick=()=>{stopLoad();importLog('Import canceled.');};
$('load-form').onsubmit=async event=>{
 event.preventDefault();if(worker||$<HTMLButtonElement>('load-bitmap').disabled)return;let height:number;
 try{height=parseBitmap($<HTMLInputElement>('bitmap').value.trim());}catch(error){importLog((error as Error).message);return;}
 stopLoad();const epoch=loadEpoch;pendingBitmap=undefined;$('bitmap-terminal').textContent='';loading(true);importLog(`Preparing ${height}.bitmap…`);
 try{const cached=await projectLibrary.getBitmap(height);if(epoch!==loadEpoch)return;if(cached){importLog('Complete bitmap data found locally. Reusing block, transactions and inscription.');readyBitmap(cached);return;}}catch(error){if(epoch!==loadEpoch)return;stopLoad();importLog(`Storage error: ${(error as Error).message}`);return;}
 downloadBitmap(height,epoch,importLog,async record=>{importLog('Saving complete bitmap dataset…');await projectLibrary.saveBitmap(record);if(epoch!==loadEpoch)return;importLog('Bitmap dataset saved.');readyBitmap(record);},()=>{});

};

let refetching=false;
function finishRefetch(){refetching=false;$('refetch-bitmap').classList.remove('fetching');$('refetch-bitmap').setAttribute('aria-busy','false');$<HTMLButtonElement>('refetch-bitmap').disabled=false;$('cancel-refetch').hidden=true;}
function refetchLog(message:string){const terminal=$('refetch-terminal');terminal.hidden=false;terminal.textContent+=`[${new Date().toLocaleTimeString()}] ${message}\n`;terminal.scrollTop=terminal.scrollHeight;}
$('bitmap-info').onclick=async()=>{if(!projectWritable)return;pause();const id=projectId,height=data.height;$('bitmap-info-title').textContent=`${height}.bitmap`;$('refetch-success').hidden=true;$('refetch-terminal').textContent='';$('refetch-terminal').hidden=true;finishRefetch();renderBitmapDetails(undefined,'bitmap-info-details','bitmap-info-date',data);$<HTMLDialogElement>('bitmap-info-dialog').showModal();try{const record=await projectLibrary.getBitmap(height);if(id===projectId)renderBitmapDetails(record,'bitmap-info-details','bitmap-info-date',data);}catch(error){refetchLog((error as Error).message);}};
function cancelRefetch(){if(refetching){stopLoad();finishRefetch();refetchLog('Download canceled. Existing data preserved.');}}
$('close-bitmap-info').onclick=()=>{cancelRefetch();$<HTMLDialogElement>('bitmap-info-dialog').close();};$('bitmap-info-dialog').addEventListener('cancel',cancelRefetch);$('cancel-refetch').onclick=cancelRefetch;
$('refetch-bitmap').onclick=async()=>{
 if(refetching||!projectWritable)return;pause();closeDraft();stopLoad();const epoch=loadEpoch,id=projectId,height=data.height;refetching=true;$('refetch-success').hidden=true;$('refetch-bitmap').classList.add('fetching');$('refetch-bitmap').setAttribute('aria-busy','true');$<HTMLButtonElement>('refetch-bitmap').disabled=true;$('cancel-refetch').hidden=false;$('refetch-terminal').textContent='';refetchLog(`Downloading fresh ${height}.bitmap data from blockchain…`);
 downloadBitmap(height,epoch,refetchLog,async record=>{
  if(id!==projectId||epoch!==loadEpoch)return;const validated=validateFilm(film,record.data);refetchLog('Saving complete bitmap dataset…');await projectLibrary.saveBitmap(record);if(epoch!==loadEpoch)return;
  await flushProject();if(epoch!==loadEpoch)return;const previous=data;data=record.data;film=validated;try{await flushProject();}catch(error){data=previous;throw error;}
  stopLoad();finishRefetch();makeRenderer();renderTimeline();reflectFilm();renderInspector();renderLibrary();draw();renderBitmapDetails(record,'bitmap-info-details','bitmap-info-date',data);refetchLog('Bitmap updated. Project scenes and settings preserved.');$('refetch-success').textContent='✓ Bitmap updated successfully';$('refetch-success').hidden=false;
 },finishRefetch,true);
};
$('create-bitmap-project').onclick=async()=>{
 if(!pendingBitmap)return;const button=$<HTMLButtonElement>('create-bitmap-project');button.disabled=true;
 try{const name=$<HTMLInputElement>('new-project-name').value.trim();if(!name)throw Error('Enter a project name.');pause();closeDraft();await flushProject();const replacing=!!replacingProjectId;if(replacing&&replacingProjectId!==projectId)throw Error('The active project changed. Start replacement again.');const record:LocalProject={id:replacing?projectId:crypto.randomUUID(),name,updatedAt:Date.now(),data:structuredClone(pendingBitmap.data),film:replacing?prepareBitmapReplacement(film,pendingBitmap.data).film:templateFilm(pendingBitmap.data,'blank'),templatePending:replacing?templatePending:true};await projectLibrary.save(record);const savedTime=time,savedSelection=selected;activateProject(record);if(replacing){time=Math.min(savedTime,Math.max(0,previewFrames(film)/30));styleView={...defaultStyleView};selected=savedSelection;renderTimeline();renderInspector();draw();}await flushProject();pendingBitmap=undefined;replacingProjectId=undefined;$<HTMLDialogElement>('bitmap-dialog').close();note(replacing?'Bitmap replaced. Video preserved.':'Project created.');}catch(error){note((error as Error).message,true);$('bitmap-create-error').textContent=(error as Error).message;$('bitmap-create-error').hidden=false;}finally{button.disabled=false;}
};

const dialog=$<HTMLDialogElement>('export-dialog');
async function checkCodec(){const epoch=++codecEpoch,quality=$<HTMLSelectElement>('export-quality').value as '720'|'1080';$<HTMLButtonElement>('export-start').disabled=true;$('codec-info').textContent='Checking codecs…';$('export-spec').textContent=`${film.aspect} · ${(previewFrames(film)/30).toFixed(1)} s · 30 FPS`;try{const value=await exportMode(videoProject(film),quality);if(epoch!==codecEpoch)return;mode=value;$('codec-info').textContent=value?.name??'No encoder available in this browser.';$<HTMLButtonElement>('export-start').disabled=!value||!renderer;}catch(e){$('codec-info').textContent=(e as Error).message;}}
$('open-export').onclick=()=>{if(exporting)return;contextMenu.close(false);pause();closeDraft();renderInspector();draw();$('export-status').textContent='';$('export-progress').hidden=true;dialog.showModal();void checkCodec();};$('close-export').onclick=()=>{if(!exporting)dialog.close();};dialog.oncancel=e=>{if(exporting)e.preventDefault();};$('export-quality').onchange=()=>void checkCodec();$('export-cancel').onclick=()=>controller?.abort(new DOMException('Cancelado','AbortError'));
$('export-start').onclick=async()=>{if(!renderer||!mode||exporting)return;pause();const saved=time,p=videoProject(structuredClone(film)),quality=$<HTMLSelectElement>('export-quality').value as '720'|'1080';exporting=true;controller=new AbortController();document.body.classList.add('exporting');$('export-start').hidden=true;$('export-cancel').hidden=false;$('export-progress').hidden=false;$('download-video').hidden=true;$<HTMLButtonElement>('close-export').disabled=true;$<HTMLSelectElement>('export-quality').disabled=true;
 try{const blob=await renderVideo<typeof p>(renderer,p,quality,mode,controller.signal,(v,phase)=>{$<HTMLProgressElement>('export-progress').value=v;$('export-status').textContent=`${Math.round(v*100)}% · ${phase}`;});if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);const link=$<HTMLAnchorElement>('download-video');link.href=downloadURL;link.download=`${data.height}.bitmap-clips.${mode.extension}`;link.hidden=false;link.click();$('export-status').textContent=`Video ready · ${(blob.size/1000000).toFixed(1)} MB · ${mode.extension.toUpperCase()}`;}
 catch(e){$('export-status').textContent=(e as Error).name==='AbortError'?'Render canceled. Your edit was preserved.':`Failed: ${(e as Error).message}`;}
 finally{exporting=false;controller=undefined;document.body.classList.remove('exporting');$('export-start').hidden=false;$('export-cancel').hidden=true;$<HTMLButtonElement>('close-export').disabled=false;$<HTMLSelectElement>('export-quality').disabled=false;time=saved;draw();}};

function timelineTarget(context:CommandContext={}){
 const id=context.itemId??selected,scene=film.clips.find(item=>item.id===id),caption=film.texts.find(item=>item.id===id);
 return scene?{kind:'clip' as const,item:scene}:caption?{kind:'text' as const,item:caption}:null;
}
function timelineReady(){return projectWritable&&!templatePending&&!exporting&&!draft&&!clipDrag&&!textDrag&&!cancelClipResize;}
function copyItem(context:CommandContext={}){const target=timelineTarget(context);if(!target)return;timelineClipboard=copyTimelineItem(film,target.item.id,data.hash);feedback((target.kind==='clip'?'Scene':'Text')+' copied.');}
function insertCopied(context:CommandContext={},duplicate=false){
 const target=timelineTarget(context),copied=duplicate&&target?copyTimelineItem(film,target.item.id,data.hash):timelineClipboard;if(!copied)return;
 const frame=duplicate&&target?target.item.startFrame+target.item.durationFrames:pasteFrame(film,copied,context.itemId??selected,Math.round(time*30));
 let result:ReturnType<typeof pasteTimelineItem>|undefined;
 if(edit(p=>{result=pasteTimelineItem(p,copied,data.hash,frame,undefined,!duplicate);Object.assign(p,result.film);selected=result.id;})&&result)feedback(`${result.kind==='clip'?'Scene':'Text'} ${duplicate?'duplicated':'pasted'} at ${(result.startFrame/30).toFixed(2)} s.${result.shortened?' Shortened to fit the available space.':''}${result.adjusted?' Adjusted to the end of the occupied item.':''}${result.shifted?` ${result.shifted} following item${result.shifted===1?'':'s'} moved.`:''}`);
}
function deleteItem(context:CommandContext={}){const target=timelineTarget(context);if(!target){if(selected===audioSelection){removeSelection();feedback('Soundtrack removed.');}return;}closeDraft();if(edit(p=>{if(target.kind==='clip')p.clips=p.clips.filter(item=>item.id!==target.item.id);else p.texts=p.texts.filter(item=>item.id!==target.item.id);selected=null;}))feedback((target.kind==='clip'?'Scene':'Text')+' removed.');}
const shortcutModifier=navigator.platform.startsWith('Mac')?'⌘':'Ctrl';
commands.register(
 {id:'copy',label:'Copy',shortcut:shortcutModifier+'+C',enabled:c=>timelineReady()&&!!timelineTarget(c),run:copyItem},
 {id:'cut',label:'Cut',shortcut:shortcutModifier+'+X',enabled:c=>timelineReady()&&!!timelineTarget(c),run:c=>{const prior=timelineClipboard;const target=timelineTarget(c);if(!target)return;timelineClipboard=copyTimelineItem(film,target.item.id,data.hash);if(edit(p=>{if(target.kind==='clip')p.clips=p.clips.filter(item=>item.id!==target.item.id);else p.texts=p.texts.filter(item=>item.id!==target.item.id);selected=null;}))feedback((target.kind==='clip'?'Scene':'Text')+' cut.');else timelineClipboard=prior;}},
 {id:'paste',label:'Paste',shortcut:shortcutModifier+'+V',enabled:()=>timelineReady()&&!clipboardProblem(timelineClipboard,data.hash),run:c=>insertCopied(c)},

 {id:'duplicate',label:'Duplicate',shortcut:shortcutModifier+'+D',enabled:c=>timelineReady()&&!!timelineTarget(c),run:c=>insertCopied(c,true)},
 {id:'delete',label:'Delete',shortcut:'Delete',enabled:c=>timelineReady()&&((!!timelineTarget(c))||selected===audioSelection),run:deleteItem},
 {id:'preview',label:'Preview item',enabled:c=>timelineReady()&&!!timelineTarget(c),run:c=>{const target=timelineTarget(c);if(target){select(target.item.id);previewSelected();}}},
 {id:'play-selected-once',label:'Play selected item once',shortcut:'P',enabled:()=>timelineReady()&&!!timelineTarget(),run:()=>previewSelected(true)},
 {id:'play',label:'Play / pause',shortcut:'Space',enabled:()=>projectWritable&&!templatePending&&previewFrames(film)>0&&!exporting,run:togglePlayback},
 {id:'undo',label:'Undo',shortcut:shortcutModifier+'+Z',enabled:()=>history.canUndo,run:()=>restoreHistory('undo')},
 {id:'redo',label:'Redo',shortcut:shortcutModifier+'+Shift+Z',enabled:()=>history.canRedo,run:()=>restoreHistory('redo')},
 {id:'seek-here',label:'Move cursor here',run:c=>seek((c.frame??0)/30)},
 {id:'add-scene',label:'Add scene here…',enabled:()=>timelineReady(),run:c=>openAdd(c.frame,'clip')},
 {id:'add-text',label:'Add text here…',enabled:()=>timelineReady(),run:c=>openAdd(c.frame,'text')},
 {id:'template-start',label:'Add to start',enabled:()=>timelineReady(),run:c=>{if(c.template){if(c.kind==='text')addText(c.template,0,true);else addClip(c.template,0,true);}}},
 {id:'template-here',label:'Add to playhead',enabled:()=>timelineReady(),run:c=>{if(c.template){if(c.kind==='text')addText(c.template,c.frame??time*30,true);else addClip(c.template,c.frame??time*30,true);}}},
 {id:'template-end',label:'Add to end',enabled:()=>timelineReady(),run:c=>{if(c.template){if(c.kind==='text')addText(c.template,previewFrames(film),true);else addClip(c.template,previewFrames(film),true);}}},
 {id:'render-settings',label:'Render settings',run:()=>select(renderSelection)},
 {id:'help',label:'Keyboard shortcuts',shortcut:'?',run:()=>{contextMenu.close(false);$<HTMLDialogElement>('shortcuts-dialog').showModal();}},
 ...(['seek-back','seek-forward','seek-back-ten','seek-forward-ten','seek-start','seek-end'] as const).map(id=>({id,label:id,run:()=>seek(id==='seek-start'?0:id==='seek-end'?previewFrames(film)/30:time+({'seek-back':-1,'seek-forward':1,'seek-back-ten':-10,'seek-forward-ten':10}[id as 'seek-back']??0)/30)})),
 ...(['view-reset','view-fit','view-front','view-top','view-iso','view-left','view-right','view-up','view-down','view-in','view-out'] as const).map(id=>({id,label:({'view-reset':'Reset view','view-fit':'Fit bitmap','view-front':'Front view','view-top':'Top view','view-iso':'Isometric view'} as Record<string,string>)[id]??id,shortcut:({'view-reset':'R','view-fit':'F','view-front':'1','view-top':'2','view-iso':'3'} as Record<string,string>)[id],enabled:()=>cameraNavigationActive(),run:()=>{const previousDistance=styleView.distance;styleView=id==='view-reset'&&draft?structuredClone(draft.initial):navigateStyle(styleView,id,largeViewStep);if(id==='view-in'||id==='view-out')styleView.distance=clamp(previousDistance*(id==='view-in'?1/1.12:1.12),.1,32);draw();canvas.focus({preventScroll:true});}})),
);
const itemMenuCommands=['copy','cut','paste','duplicate','preview','delete'];
function openContextActions(target:Element,x:number,y:number){
 if(exporting||document.querySelector('dialog[open]')||editingTarget(target)||draft||clipDrag||textDrag||cancelClipResize)return false;
 const node=target.closest<HTMLElement>('.clip-item[data-id],.text-item[data-id]');
 if(node){const id=node.dataset.id!;select(id);const origin=()=>document.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);contextMenu.open(x,y,itemMenuCommands,{itemId:id},origin);return true;}
 const item=target.closest<HTMLElement>('#clip-library .clip-card,#text-library .clip-card');
 if(item){const kind=item.dataset.textType?'text':'clip';contextMenu.open(x,y,['template-start','template-here','template-end'],{template:item.dataset.textType??item.dataset.type,kind,frame:Math.round(time*30)},()=>item);return true;}
 if(target.closest('#canvas-wrap'))return false;
 const track=target.closest<HTMLElement>('#clip-track,#text-track,#ruler');
 if(track){const bounds=track.getBoundingClientRect(),frame=Math.max(0,Math.min(previewFrames(film),Math.round((x-bounds.left)/bounds.width*previewFrames(film)))),kind=track.id==='clip-track'?'clip':track.id==='text-track'?'text':undefined;
  contextMenu.open(x,y,kind?[kind==='clip'?'add-scene':'add-text','paste']:['seek-here','paste'],{frame,kind},()=>track);return true;}
 return false;
}
$('preview-item-once').onclick=()=>commands.execute('play-selected-once');
$('item-actions').onclick=()=>{const button=$('item-actions'),bounds=button.getBoundingClientRect();if(timelineTarget())contextMenu.open(bounds.left,bounds.bottom,itemMenuCommands,{itemId:selected!},()=>button);};
$('shortcut-help').onclick=()=>commands.execute('help');$('close-shortcuts').onclick=()=>$<HTMLDialogElement>('shortcuts-dialog').close();
document.addEventListener('contextmenu',event=>{event.preventDefault();if(!(event.target instanceof Element)||!openContextActions(event.target,event.clientX,event.clientY))contextMenu.close(false);},{capture:true});

document.addEventListener('dragstart',e=>{const target=e.target;if(target instanceof Element&&!target.closest('[draggable="true"],input,textarea'))e.preventDefault();else if(target instanceof Element&&target.closest('.clip-card'))document.body.classList.add('library-dragging');});
document.addEventListener('dragend',()=>document.body.classList.remove('library-dragging'));document.addEventListener('drop',()=>document.body.classList.remove('library-dragging'));
document.addEventListener('keydown',e=>{
 if(e.key==='Tab')canvas.classList.remove('pointer-focus');
 if(exporting||e.defaultPrevented||e.isComposing)return;
 const target=e.target instanceof Element?e.target:null;
 if(document.querySelector('dialog[open]'))return;
 if(e.key==='Escape'){
  if(contextMenu.isOpen){e.preventDefault();contextMenu.close();return;}
  if(cancelTextDrag){e.preventDefault();cancelTextDrag();return;}if(cancelClipResize){e.preventDefault();cancelClipResize();return;}if(cancelClipDrag){e.preventDefault();cancelClipDrag();return;}
  if(selected===sceneDefaultsSelection){e.preventDefault();select(null);canvas.focus({preventScroll:true});return;}
  $('stage-message').hidden=true;closeDraft();renderInspector();draw();return;
 }
 if(editingTarget(target)||cancelClipResize||textDrag||clipDrag)return;
 if((e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey)&&target instanceof HTMLElement){const bounds=target.getBoundingClientRect();if(openContextActions(target,bounds.left+8,bounds.bottom))e.preventDefault();return;}
 const id=shortcutCommand(e,cameraNavigationActive()?'style':'timeline',target===canvas,!!target?.closest('button,a'));
 if(draft&&(!id||!id.startsWith('view-'))){e.preventDefault();return;}
 if(!id)return;e.preventDefault();if(e.repeat&&!repeatableCommand(id))return;
 contextMenu.close(false);largeViewStep=e.shiftKey;try{if(!commands.execute(id))feedback(id==='paste'?clipboardProblem(timelineClipboard,data.hash)??'Paste is unavailable here.':'Select a scene or text for this action.');}finally{largeViewStep=false;}
});

new ResizeObserver(()=>{if(cameraNavigationActive())framingUI(!!draft);draw();}).observe($('stage'));new ResizeObserver(()=>{renderRuler();renderAudioWaveform();}).observe($('timeline-body'));window.addEventListener('beforeunload',()=>{clearTimeout(saving);try{if(projectWritable){localStorage.setItem(storageKey,JSON.stringify({film,data,projectId,projectName,templatePending,updatedAt:Date.now()}));void persistProject().catch(()=>{});}}catch{}renderer?.dispose();score.dispose();worker?.terminate();});
await document.fonts.load('16px "Silkscreen"');
makeRenderer();source();renderTimeline();reflectFilm();renderInspector();renderLibrary();renderProjectTemplates();draw();save();if(!projectWritable)$('save-state').textContent='No project open';note('');

function clearLibraryDrag(){libraryDrag=undefined;libraryDragScale=0;$('timeline-body').style.removeProperty('flex');renderTimeline();reflectFilm();}
function beginLibraryDrag(event:DragEvent,type:string,kind:'clip'|'text'='clip'){
 if(!event.dataTransfer||!projectWritable||(kind==='clip'?film.clips.length>=40:film.texts.length>=100)){event.preventDefault();return;}
 const track=$(kind==='clip'?'clip-track':'text-track');libraryDrag={initial:structuredClone(film),kind,item:kind==='clip'?makeClip(type):makeText(type,0),width:track.clientWidth,scale:previewFrames(film)||300};
 event.dataTransfer.setData(kind==='clip'?'application/bitmap-clip-type':'application/bitmap-text-type',type);event.dataTransfer.effectAllowed='copy';
 const ghost=document.createElement('div');ghost.className='library-clip-ghost'+(kind==='text'?' library-text-ghost':'');const name=kind==='clip'?definition(type).name:textDefinition(type).name;ghost.textContent=name;ghost.style.left=event.clientX+'px';ghost.style.top=event.clientY+'px';document.body.append(ghost);event.dataTransfer.setDragImage(ghost,12,22);requestAnimationFrame(()=>ghost.remove());
}
function libraryDropAllowed(event:DragEvent){
 return withinTimelinePanel(event,$('timeline-body').closest('.timeline-panel')!.getBoundingClientRect());
}
function previewLibraryDrag(event:DragEvent){
 const state=libraryDrag;if(!state||!libraryDropAllowed(event))return;event.preventDefault();event.dataTransfer!.dropEffect='copy';
 const frame=Math.max(0,Math.round((event.clientX-$(state.kind==='clip'?'clip-track':'text-track').getBoundingClientRect().left)/state.width*state.scale));
 state.preview=state.kind==='clip'?insertLibraryClip(state.initial,state.item as ClipInstance,frame):insertTimelineItem(state.initial,'text',state.item as FilmText,frame).film;const scale=Math.max(state.scale,previewFrames(state.preview));libraryDragScale=scale;
 $('timeline-body').style.removeProperty('flex');
 renderClipTrack(state.preview,false,scale,state.kind==='clip'?state.item.id:undefined);renderTextTrack(state.preview,scale,state.kind==='text'?state.item.id:undefined);renderRuler();renderAudioWaveform(state.preview);updateClock(state.preview);$('film-duration').textContent=`${state.preview.clips.length} scenes · ${(previewFrames(state.preview)/30).toFixed(1)} s`;
}
function dropLibraryDrag(event:DragEvent){
 if(!libraryDrag||!libraryDropAllowed(event))return;event.preventDefault();
 if(!libraryDrag.preview)previewLibraryDrag(event);
 const {preview,item,kind}=libraryDrag;clearLibraryDrag();
 if(preview&&edit(p=>{Object.assign(p,preview);selected=item.id;})){note(kind==='clip'?'Scene added.':'Text added.');}
}
document.addEventListener('dragend',()=>{if(libraryDrag)clearLibraryDrag();});
document.addEventListener('drop',event=>{if(!libraryDrag)return;if(libraryDropAllowed(event))dropLibraryDrag(event);else clearLibraryDrag();});
function clearLibraryPreview(){
 if(!libraryDrag?.preview)return;
 libraryDrag.preview=undefined;libraryDragScale=0;$('timeline-body').style.removeProperty('flex');renderTimeline();reflectFilm();
}
document.addEventListener('dragover',event=>{if(!libraryDrag)return;if(libraryDropAllowed(event)){previewLibraryDrag(event);return;}clearLibraryPreview();});
document.addEventListener('dragleave',event=>{if(libraryDrag&&!libraryDropAllowed(event))clearLibraryPreview();});
