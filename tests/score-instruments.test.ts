import {test,expect} from 'bun:test';
import {synthesizeTechno,scoreInstruments} from '../src/techno';
import {scores,availableScores,type ScoreStyle} from '../src/editor-model';
import {filmSchema} from '../src/clips/film';

const styles:readonly ScoreStyle[]=availableScores;
function profile(samples:Float32Array){
 let energy=0,difference=0,peak=0;
 for(let i=1;i<samples.length;i++){const value=samples[i]!;energy+=value*value;difference+=(value-samples[i-1]!)**2;peak=Math.max(peak,Math.abs(value));}
 return {brightness:difference/energy,rms:Math.sqrt(energy/samples.length),peak};
}
test('four available scores have distinct rhythms and instrument palettes with safe output levels',()=>{
 expect(styles).toHaveLength(4);
 expect(availableScores.map(id=>scores[id].name)).toEqual(['Liquid Drum & Bass','Chiptune','Ambient Electronica','Jazz Fusion']);
 const profiles=styles.map(style=>{
  expect(scoreInstruments[style].length).toBeGreaterThan(20);
  const sound=profile(synthesizeTechno(10,16000,style));
  expect(Number.isFinite(sound.brightness)).toBe(true);
  expect(sound.rms).toBeGreaterThan(.035);expect(sound.rms).toBeLessThan(.4);
  expect(sound.peak).toBeLessThan(.95);
  return sound;
 });
 for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++)expect(Math.abs(profiles[i]!.brightness-profiles[j]!.brightness)).toBeGreaterThan(.0001);
});
test('every score is repeatable, finite and fades at the film boundaries',()=>{
 for(const style of styles){
  const a=synthesizeTechno(3,8000,style),b=synthesizeTechno(3,8000,style);
  expect(a.length).toBe(24000);expect(a).toEqual(b);expect(a.every(Number.isFinite)).toBe(true);
  expect(a[0]).toBe(0);expect(Math.abs(a.at(-1)!)).toBeLessThan(.001);
  expect(synthesizeTechno(0,8000,style)).toHaveLength(0);
 }
});
test('arrangements evolve beyond the opening bar and preserve their opening when extended',()=>{
 for(const style of styles){
  const rate=8000,a=synthesizeTechno(12,rate,style),b=synthesizeTechno(16,rate,style);
  expect(a.slice(0,rate*2)).toEqual(b.slice(0,rate*2));
  const bar=Math.round(240/scores[style].bpm*rate);
  expect(a.slice(bar,bar*2)).not.toEqual(a.slice(bar*5,bar*6));
 }
});
test('new and legacy score IDs remain accepted by the saved film audio contract',()=>{
 for(const style of Object.keys(scores) as ScoreStyle[])expect(filmSchema.shape.audio.parse({enabled:true,score:style,volume:.5}).score).toBe(style);
});


test('removed tracks resolve to Jazz Fusion without returning to the available menu',()=>{
 for(const legacy of ['pulse','minimal'] as const){
  expect(availableScores as readonly string[]).not.toContain(legacy);
  expect(synthesizeTechno(2,8000,legacy)).toEqual(synthesizeTechno(2,8000,'jazz'));
 }
});
