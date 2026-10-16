import {test,expect} from 'bun:test';
import {easingNames,easeProgress,zoomEasingOptions,zoomEasingFor} from '../src/easing';
import {settingsFor,controlsFor} from '../src/clips/registry';
import {controlVisible} from '../src/clips/types';
test('reusable easing catalog has exact endpoints, finite curves and distinct motion',()=>{
 for(const name of easingNames){
  expect(easeProgress(-1,name)).toBe(0);expect(easeProgress(2,name)).toBe(1);
  for(let i=0;i<=100;i++)expect(Number.isFinite(easeProgress(i/100,name))).toBe(true);
 }
 expect(easeProgress(.25,'Linear')).toBe(.25);
 expect(easeProgress(.25,'SineIn')).toBeLessThan(.25);expect(easeProgress(.25,'SineOut')).toBeGreaterThan(.25);
 expect(easeProgress(.5,'SineInOut')).toBeCloseTo(.5);
 expect(easeProgress(.2,'ElasticOut')).toBeGreaterThan(1);expect(easeProgress(.2,'BackIn')).toBeLessThan(0);
});
test('zoom interpolation is shared by Ready and Gravity and persists in settings',()=>{
 for(const type of ['presentation-ready','presentation-gravity']){
  const control=controlsFor(type).find(c=>c.key==='zoomEasing')!;
  expect(control.options!.map(o=>o.value)).toEqual(zoomEasingOptions.map(o=>o.value));
  expect(controlVisible({movement:'zoom-in'},control)).toBe(true);expect(controlVisible({movement:'none'},control)).toBe(false);
  for(const zoomEasing of easingNames)expect(settingsFor(type,{zoomEasing}).zoomEasing).toBe(zoomEasingFor(zoomEasing));
 }
});
