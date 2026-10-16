import {test,expect} from 'bun:test';
import {audioTimelineState} from '../src/audio-waveform';
import type {Film} from '../src/clips/film';

test('selected music remains visible on an empty timeline and gains a waveform with visual duration',()=>{
 for(const file of [undefined,{name:'My song.mp3',data:'AQID',duration:12}]){
  const audio:Film['audio']={enabled:true,score:'deep',volume:.5,file};
  const empty=audioTimelineState(audio,0),populated=audioTimelineState(audio,90);
  expect(empty.hasWaveform).toBe(false);
  expect(empty.message).toContain('Add a scene or text');
  expect(empty.message).not.toContain('No audio added');
  if(file)expect(empty.message).toContain(file.name);
  expect(populated.hasWaveform).toBe(true);
  expect(populated.label).toBe(empty.label);
 }
});

test('only disabled music is labeled as not added regardless of timeline duration',()=>{
 for(const frames of [0,90]){
  const state=audioTimelineState({enabled:false,score:'deep',volume:.5},frames);
  expect(state.hasWaveform).toBe(false);
  expect(state.message).toBe('No audio added. Click to choose a soundtrack.');
 }
});

test('audio-only preview supplies waveform and playback duration without changing the exported film length',async()=>{
 const {previewFrames,totalFrames,videoProject,makeClip}=await import('../src/clips/film');
 const {composeTemplate}=await import('../src/project-templates/compose');
 const {default:snapshot}=await import('../src/demo.json');
 const film=composeTemplate(snapshot as never,{audio:{enabled:true}});
 expect(previewFrames(film)).toBe(300);
 expect(audioTimelineState(film.audio,previewFrames(film)).hasWaveform).toBe(true);
 expect(totalFrames(film)).toBe(0);expect(videoProject(film).duration).toBe(0);
 film.audio.file={name:'Song.wav',data:'AQID',duration:24.5};
 expect(previewFrames(film)).toBe(735);
 film.clips=[makeClip('display',90)];
 expect(previewFrames(film)).toBe(90);expect(totalFrames(film)).toBe(90);
 film.clips=[];film.audio.enabled=false;expect(previewFrames(film)).toBe(0);
});
