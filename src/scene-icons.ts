/** Small vector symbols for the scene library and insertion menu. */
export function sceneIcon(type:string):string{
 const paths:Record<string,string>={
  reveal:'<path d="m6 14 6-3 6 3v6l-6 3-6-3zM6 14l6 3 6-3M12 17v6M12 2v5M9 5l3-3 3 3M3 9l2 2M21 9l-2 2"/>',
  display:'<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8"/>',
  transaction:'<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4m9-10 5 3v6l-5 3-5-3V9zM7 9l5 3 5-3M12 12v6"/>',
 };
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type]??paths.display}</svg>`;
}
