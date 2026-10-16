import {test,expect} from 'bun:test';
import {conditionalControls} from '../src/conditional-controls';
import {clips} from '../src/clips/registry';
import {texts,textSettingsFor} from '../src/texts/registry';
import {sceneStyleFields,styleValue} from '../src/scene-style-controls';
const render=(c:{key:string})=>`<input data-key="${c.key}">`;
test('conditional controls are rendered directly beneath their parent, once per active branch',()=>{
 const controls=[{key:'type'},{key:'other'},{key:'amount',when:{key:'type',value:'one'}},{key:'amount',when:{key:'type',value:'two'}},{key:'enabled',when:{key:'type',value:'one'}},{key:'speed',when:{key:'enabled',value:true}}];
 const html=conditionalControls(controls,{type:'one',enabled:true},render);
 expect(html.indexOf('data-key="amount"')).toBeLessThan(html.indexOf('data-key="other"'));
 expect(html.match(/data-key="amount"/g)).toHaveLength(1);expect(html.match(/class="conditional-fields"/g)).toHaveLength(2);
 expect(conditionalControls(controls,{type:'two',enabled:true},render)).not.toContain('data-key="speed"');
 expect(conditionalControls(controls,{type:'none',enabled:true},render)).not.toContain('conditional-fields');
});
test('scene and text definitions use the same conditional renderer without duplicate controls',()=>{
 for(const d of clips){const settings=d.schema.parse({}),html=conditionalControls(d.controls,settings,render);for(const c of d.controls){const matches=html.match(new RegExp(`data-key="${c.key}"`,'g'))??[];expect(matches.length).toBeLessThanOrEqual(1);}}
 for(const d of texts){const settings=textSettingsFor(d.id,{});expect(conditionalControls(d.controls,settings,render)).toBeString();}
});
test('fog and shadows share one indented region per toggle in global and scene style forms',()=>{
 for(const prefix of ['style','clip-style']){
  const html=sceneStyleFields({fog:true,shadows:false,fogNear:1,fogFar:6,shadowOpacity:.4},prefix);
  expect(html).toContain('class="conditional-fields" data-style-when="fog"');
  expect(html).toContain('class="conditional-fields" data-style-when="shadows" hidden');
  expect(html.match(/data-style-when="fog"/g)).toHaveLength(1);
 }
 expect(styleValue(.5,'percent')).toBe('50%');
});
