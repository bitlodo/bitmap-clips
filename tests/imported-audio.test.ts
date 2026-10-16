import {test,expect,afterAll} from 'bun:test';
import snapshot from '../src/demo.json';
import {type SceneData} from '../src/editor-model';
import {createFilm,parseDocument,videoProject} from '../src/clips/film';
import {ProjectHistory} from '../src/history';
import {importAudioFile,importedAudioSchema,importedSoundtrack,importedWaveform,MAX_AUDIO_BYTES} from '../src/imported-audio';

const originalBuffer=globalThis.AudioBuffer,originalContext=globalThis.AudioContext;
class TestBuffer {
 sampleRate:number;length:number;numberOfChannels:number;channels:Float32Array[];
 constructor(options:{length:number;sampleRate:number;numberOfChannels:number}){Object.assign(this,options);this.length=options.length;this.sampleRate=options.sampleRate;this.numberOfChannels=options.numberOfChannels;this.channels=Array.from({length:this.numberOfChannels},()=>new Float32Array(this.length));}
 get duration(){return this.length/this.sampleRate;}
 getChannelData(channel:number){return this.channels[channel]!;}
}
let decoded=new TestBuffer({length:44100,sampleRate:44100,numberOfChannels:1});
let closed=0;
class TestContext {
 async decodeAudioData(bytes:ArrayBuffer){if(new Uint8Array(bytes)[0]===0)throw Error('Invalid audio');return decoded;}
 async close(){closed++;}
}
globalThis.AudioBuffer=TestBuffer as unknown as typeof AudioBuffer;
globalThis.AudioContext=TestContext as unknown as typeof AudioContext;
afterAll(()=>{globalThis.AudioBuffer=originalBuffer;globalThis.AudioContext=originalContext;});

test('local audio survives portable JSON, undo/redo and the video export contract',()=>{
 const data=snapshot as SceneData,film=createFilm(data),history=new ProjectHistory(film);
 const file={name:'My music.mp3',data:'AQID',duration:12};
 film.audio.file=file;history.record(film);
 const restored=parseDocument(JSON.parse(JSON.stringify({data,film}))).film;
 expect(restored.audio.file).toEqual(file);expect(videoProject(restored).audioFile).toEqual(file);
 expect(history.undo()!.audio.file).toBeUndefined();expect(history.redo()!.audio.file).toEqual(file);
 delete film.audio.file;expect(parseDocument({data,film}).film.audio.file).toBeUndefined();
 expect(importedAudioSchema.safeParse({...file,data:'https://youtube.com/watch?v=123'}).success).toBe(false);
});

test('import validates decoding and size before accepting a file',async()=>{
 decoded=new TestBuffer({length:44100,sampleRate:44100,numberOfChannels:1});
 const file=await importAudioFile(new File([new Uint8Array([1,2,4])],'song.wav'));
 expect(file.name).toBe('song.wav');expect(file.duration).toBe(1);expect(closed).toBeGreaterThan(0);
 await expect(importAudioFile(new File([],'empty.wav'))).rejects.toThrow('20 MB');
 await expect(importAudioFile({size:MAX_AUDIO_BYTES+1} as File)).rejects.toThrow('20 MB');
 await expect(importAudioFile(new File([new Uint8Array([0])],'broken.mp3'))).rejects.toThrow('could not be decoded');
});

test('imported soundtrack applies gain, duplicates mono, trims and pads with silence',async()=>{
 decoded=new TestBuffer({length:44100,sampleRate:44100,numberOfChannels:1});decoded.getChannelData(0).fill(.8);
 const file=await importAudioFile(new File([new Uint8Array([2])],'mono.wav'));
 const long=await importedSoundtrack(file,2,.5),short=await importedSoundtrack(file,.5,1);
 expect(long.length).toBe(88200);expect(long.numberOfChannels).toBe(2);
 for(const channel of [0,1]){expect(long.getChannelData(channel)[44099]).toBeCloseTo(.4);expect(long.getChannelData(channel)[44100]).toBe(0);}
 expect(short.length).toBe(22050);expect(short.getChannelData(0)[22049]).toBeCloseTo(.8);
 const peaks=importedWaveform(long,2,4);expect(Array.from(peaks)).toEqual([Math.fround(.4),Math.fround(.4),0,0]);
});

test('stereo audio retains separate channels and waveform reflects either channel',async()=>{
 decoded=new TestBuffer({length:44100,sampleRate:44100,numberOfChannels:2});decoded.getChannelData(0).fill(.2);decoded.getChannelData(1).fill(-.7);
 const file=await importAudioFile(new File([new Uint8Array([3])],'stereo.wav'));
 const output=await importedSoundtrack(file,1,1);
 expect(output.getChannelData(0)[0]).toBeCloseTo(.2);expect(output.getChannelData(1)[0]).toBeCloseTo(-.7);
 expect(importedWaveform(output,2,2)[0]).toBeCloseTo(.7);expect(importedWaveform(output,2,2)[1]).toBe(0);
});
