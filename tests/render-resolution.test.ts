import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {renderDimensions} from '../src/render-resolution';
import {createFilm,parseDocument} from '../src/clips/film';
import type {SceneData} from '../src/editor-model';

test('fixed rendering resolution increases actual pixels independently of CSS size and pixel ratio',()=>{
 expect(renderDimensions(1600,900,'3840',8192,1)).toEqual([3840,2160]);
 expect(renderDimensions(800,450,'3840',8192,2)).toEqual([3840,2160]);
 expect(renderDimensions(900,1600,'7680',8192)).toEqual([4320,7680]);
 expect(renderDimensions(600,600,'2560',8192)).toEqual([2560,2560]);
});
test('auto and GPU limits preserve aspect and prevent oversized render buffers',()=>{
 expect(renderDimensions(1600,900,'auto',8192,2)).toEqual([1600,900]);
 expect(renderDimensions(800,450,'auto',8192,2)).toEqual([1200,675]);
 expect(renderDimensions(1600,900,'7680',2048)).toEqual([2048,1152]);
});
test('resolution persists with the project, and older projects default to auto',()=>{
 const data=snapshot as SceneData,film=createFilm(data);film.renderResolution='3840';
 expect(parseDocument(JSON.parse(JSON.stringify({data,film}))).film.renderResolution).toBe('3840');
 const {renderResolution,...old}=film;expect(parseDocument({data,film:old}).film.renderResolution).toBe('auto');
});

test('preview matches displayed canvas pixels without fixed resolution or artificial auto limits',async()=>{
 const {previewDimensions}=await import('../src/render-resolution');
 expect(previewDimensions(603,603,8192)).toEqual([603,603]);
 expect(previewDimensions(1800,1000,8192)).toEqual([1800,1000]);
 expect(previewDimensions(603,603,8192,2)).toEqual([1206,1206]);
 expect(previewDimensions(1800,1000,2048,2)).toEqual([2048,1138]);
});
