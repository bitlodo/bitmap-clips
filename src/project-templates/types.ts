import type {Film} from '../clips/film';
import type {SceneData} from '../editor-model';
export interface ProjectTemplateDefinition {
 id:string;version:1;name:string;description:string;tag:string;actionLabel:string;
 preview:{kind:'empty'}|{kind:'frame';time:number};
 build(data:SceneData):Film;
}
export function defineProjectTemplate<const T extends ProjectTemplateDefinition>(definition:T):T {return definition;}
