import type {TimelineKind} from './timeline-clipboard';
export interface CommandContext {itemId?:string;frame?:number;kind?:TimelineKind;template?:string;}
export interface AppCommand {id:string;label:string;shortcut?:string;enabled?:(context:CommandContext)=>boolean;run:(context:CommandContext)=>void;}
export class CommandRegistry {
 private commands=new Map<string,AppCommand>();
 register(...commands:AppCommand[]){for(const command of commands){if(this.commands.has(command.id))throw Error('Duplicate command: '+command.id);this.commands.set(command.id,command);}}
 get(id:string){const command=this.commands.get(id);if(!command)throw Error('Unknown command: '+id);return command;}
 available(id:string,context:CommandContext={}){return this.get(id).enabled?.(context)??true;}
 execute(id:string,context:CommandContext={}){if(!this.available(id,context))return false;this.get(id).run(context);return true;}
}
