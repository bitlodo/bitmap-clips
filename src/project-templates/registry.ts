import {validateFilm} from '../clips/film';
import type {SceneData} from '../editor-model';
import type {ProjectTemplateDefinition} from './types';
import {blank} from './blank';
import {exportedProjectTemplates} from './catalog.generated';
export function createTemplateRegistry(definitions:readonly ProjectTemplateDefinition[]){
 const entries=new Map<string,ProjectTemplateDefinition>();
 for(const definition of definitions){if(!definition.id.trim()||entries.has(definition.id))throw Error(`Invalid or duplicate project template: ${definition.id}`);if(definition.version!==1)throw Error('Unsupported project template version.');if(definition.preview.kind==='frame'&&(!Number.isFinite(definition.preview.time)||definition.preview.time<0))throw Error('Invalid template preview time.');entries.set(definition.id,definition);}
 return {definitions:[...entries.values()],build(data:SceneData,id:string){const definition=entries.get(id);if(!definition)throw Error(`Unknown project template: ${id}`);return validateFilm(definition.build(structuredClone(data)),data);}};
}
// Exported JSON projects are discovered during the frontend build.
const registry=createTemplateRegistry([blank,...exportedProjectTemplates]);
export const projectTemplates=registry.definitions;
export const templateFilm=registry.build;
