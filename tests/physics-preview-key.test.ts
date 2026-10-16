import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createFilm,makeClip} from '../src/clips/film';
import {physicsPreviewKey} from '../src/physics-preview-key';
import type {SceneData} from '../src/editor-model';
test('only object Settings invalidate physics when editing inspector modules',()=>{
 const film=createFilm(snapshot as SceneData);film.clips=[makeClip('presentation-gravity')];const clip=film.clips[0]!,original=physicsPreviewKey(film);
 clip.settings.cameraA={position:[10,10,10],target:[0,0,0],fov:50};clip.styleOverride={accent:'#abcdef'};clip.fadeInFrames=30;clip.fadeOutFrames=45;clip.framing.zoom=1.2;
 expect(physicsPreviewKey(film)).toBe(original);
 for(const [key,value] of [['flow',5],['dropHeight',8],['movement','zoom-in']] as const){const next=structuredClone(film);next.clips[0]!.settings[key]=value;expect(physicsPreviewKey(next)).not.toBe(original);}
});

test('switching Reveal to Gravity triggers preparation and camera changes keep the existing key',()=>{
 const film=createFilm(snapshot as SceneData);film.clips=[makeClip('reveal')];const clip=film.clips[0]!;
 expect(physicsPreviewKey(film)).toBe('[]');clip.settings.revealType='gravity';const key=physicsPreviewKey(film);expect(key).not.toBe('[]');
 clip.settings.rotation=true;clip.settings.rotationSpeed=5;clip.settings.zoomEnabled=true;clip.settings.cameraZoomStrength=2;clip.styleOverride={accent:'#abcdef'};
 expect(physicsPreviewKey(film)).toBe(key);
 for(const field of ['speed','dropHeight','flow']){const next=structuredClone(film);next.clips[0]!.settings[field]=3;expect(physicsPreviewKey(next)).not.toBe(key);}
 const longer=structuredClone(film);longer.clips[0]!.durationFrames+=30;expect(physicsPreviewKey(longer)).not.toBe(key);
 clip.settings.revealType='build';expect(physicsPreviewKey(film)).toBe('[]');
});
