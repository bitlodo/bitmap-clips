import type { Project } from './editor-model';
/** History holds only the edit contract, never copies the block geometry. */
export class ProjectHistory<T=Project> {
  private past:string[]=[];
  private future:string[]=[];
  private current:string;
  private lastGroup='';
  private lastTime=0;
  constructor(project:T){this.current=JSON.stringify(project);}
  reset(project:T){this.past=[];this.future=[];this.current=JSON.stringify(project);this.lastGroup='';}
  record(project:T,group='',now=Date.now()){
    const next=JSON.stringify(project);if(next===this.current)return;
    if(!group||group!==this.lastGroup||now-this.lastTime>700){this.past.push(this.current);if(this.past.length>80)this.past.shift();}
    this.future=[];this.current=next;this.lastGroup=group;this.lastTime=now;
  }
  undo():T|null{const value=this.past.pop();if(!value)return null;this.future.push(this.current);this.current=value;this.lastGroup='';return JSON.parse(value);}
  redo():T|null{const value=this.future.pop();if(!value)return null;this.past.push(this.current);this.current=value;this.lastGroup='';return JSON.parse(value);}
  get canUndo(){return this.past.length>0;}
  get canRedo(){return this.future.length>0;}
}
