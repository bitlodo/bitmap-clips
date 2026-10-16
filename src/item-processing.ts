export interface ItemProcessing {progress:number;}
/** Shared timeline UI; producers provide normalized progress from their actual work. */
export function renderItemProcessing(node:HTMLElement,state:ItemProcessing|null){
 node.classList.toggle('item-processing',!!state);node.setAttribute('aria-busy',String(!!state));
 let label=node.querySelector<HTMLElement>('.item-processing-label');
 if(!state){label?.remove();node.style.removeProperty('--processing-progress');return;}
 node.style.setProperty('--processing-progress',`${Math.max(0,Math.min(1,state.progress))*100}%`);
 if(!label){label=document.createElement('span');label.className='item-processing-label';label.textContent='processing...';node.querySelector('.clip-label,.text-template-name')?.append(label);}
 node.setAttribute('aria-busy','true');
}
