import {test,expect} from 'bun:test';
import {playbackBoundary} from '../src/playback-boundary';
test('film and selected scene loops preserve elapsed overshoot',()=>{
 expect(playbackBoundary(23.2,23,0,true,false)).toEqual({time:23.2-23,restart:true,stop:false});
 expect(playbackBoundary(10.5,10,5,true,false)).toEqual({time:5.5,restart:true,stop:false});
 expect(playbackBoundary(21,10,5,true,false).time).toBe(6);
});
test('play once stops the selected scene even with loop enabled',()=>{
 expect(playbackBoundary(10,10,5,true,true)).toEqual({time:10,restart:false,stop:true});
 expect(playbackBoundary(8,10,5,true,true)).toEqual({time:8,restart:false,stop:false});
 expect(playbackBoundary(10,10,5,false,false).stop).toBe(true);
});

test('stopped playback reaches the exact two-second timeline endpoint',()=>{
 expect(playbackBoundary(2.01,2,0,false,false)).toEqual({time:2,restart:false,stop:true});
});
