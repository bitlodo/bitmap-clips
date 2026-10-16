import {defineProjectTemplate} from './types';
import {composeTemplate} from './compose';
export const blank=defineProjectTemplate({id:'blank',version:1,name:'Blank timeline',description:'Start from scratch. Add your own scenes and texts.',tag:'Empty',actionLabel:'Start blank',preview:{kind:'empty'},build:data=>composeTemplate(data,{})});
