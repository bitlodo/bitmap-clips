/** Non-negative cube root using only IEEE-754 arithmetic, for saved physics inputs.
 * A fixed iteration count keeps the result independent of native Math.cbrt.
 * Physics parcel volumes are bounded well below the range covered by 96 iterations.
 */
export function positiveCubeRoot(value:number){
 if(value===0)return 0;
 let low=0,high=Math.max(1,value);
 for(let i=0;i<96;i++){
  const middle=(low+high)*.5;
  if(middle*middle*middle<=value)low=middle;else high=middle;
 }
 return (low+high)*.5;
}
