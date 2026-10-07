export function horizontalDateScroll(node:HTMLDivElement,selectedDate:string){
 let frame=0;
 const showSelected=(value:string,behavior:ScrollBehavior)=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   const selected=node.querySelector<HTMLElement>(`[data-date="${CSS.escape(value)}"]`);
   if(!selected)return;
   const left=selected.getBoundingClientRect().left-node.getBoundingClientRect().left+node.scrollLeft-5;
   const max=Math.max(0,node.scrollWidth-node.clientWidth);
   node.scrollTo({left:Math.max(0,Math.min(max,left)),behavior});
  });
 };
 const onWheel=(event:WheelEvent)=>{
  if(event.ctrlKey||event.shiftKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
  const max=node.scrollWidth-node.clientWidth;
  if(max<=0)return;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientWidth:1);
  const next=Math.max(0,Math.min(max,node.scrollLeft+delta));
  if(next===node.scrollLeft)return;
  event.preventDefault();node.scrollLeft=next;
 };
 node.addEventListener('wheel',onWheel,{passive:false});
 showSelected(selectedDate,'auto');
 return{update(value:string){showSelected(value,'smooth')},destroy(){cancelAnimationFrame(frame);node.removeEventListener('wheel',onWheel)}};
}
