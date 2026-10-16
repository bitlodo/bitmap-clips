import {z} from 'zod';
import {btc} from '../../editor-model';
import {defineText} from '../types';

export const transactionLabels=defineText({
  id:'transaction-labels',version:1,name:'Transaction values',description:'Live output values below visible transactions. No manual text fields.',glyph:'₿',layout:'transactions',duration:{min:15,default:150},
  schema:z.object({}).strict(),controls:[],supportedProperties:['Output value'],
  build(context,_s,c){return {common:c,summary:`Output values · ${context.data.txCount.toLocaleString('en-US')} transactions`,titles:[],labels:context.data.layout.parcels.toSorted((a,b)=>b.size-a.size).map(p=>({txIndex:p.txIndex,text:btc(p.totalSats,2)+' BTC'}))};},
});
