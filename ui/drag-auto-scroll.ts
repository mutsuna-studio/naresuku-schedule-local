type Axis='x'|'y';

/** Pixels per second, increasing as the pointer approaches an edge. */
export function edgeScrollSpeed(position:number,start:number,end:number){
 if(end<=start||position<start||position>end)return 0;
 const edge=Math.min(64,(end-start)/3);
 if(position<start+edge)return -720*(1-(position-start)/edge);
 if(position>end-edge)return 720*(1-(end-position)/edge);
 return 0;
}

/** Native lesson drags need to scroll the app's overflow container, not window. */
export function dragAutoScroll(node:HTMLElement,isActive:()=>boolean){
 const doc=node.ownerDocument,win=doc.defaultView!;
 let frame:number|undefined,lastTime=0,point:{x:number;y:number}|undefined;
 function stop(){if(frame!==undefined)win.cancelAnimationFrame(frame);frame=undefined;lastTime=0;point=undefined}
 function scrollParent(axis:Axis){
  for(let el:HTMLElement|null=node;el;el=el.parentElement){
   const style=win.getComputedStyle(el),overflow=axis==='y'?style.overflowY:style.overflowX;
   const excess=axis==='y'?el.scrollHeight-el.clientHeight:el.scrollWidth-el.clientWidth;
   if(excess>1&&(/auto|scroll/.test(overflow)||el===doc.scrollingElement))return el;
  }
 }
 function visibleBounds(el:HTMLElement){
  let left=0,top=0,right=win.innerWidth,bottom=win.innerHeight;
  for(let current:HTMLElement|null=el;current;current=current.parentElement){
   const style=win.getComputedStyle(current),rect=current.getBoundingClientRect();
   if(current===el||/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,rect.left+current.clientLeft);right=Math.min(right,rect.left+current.clientLeft+current.clientWidth)}
   if(current===el||/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,rect.top+current.clientTop);bottom=Math.min(bottom,rect.top+current.clientTop+current.clientHeight)}
  }
  return {left,top,right,bottom};
 }
 function tick(time:number){
  frame=undefined;
  if(!point||!isActive()||!node.isConnected){stop();return}
  const seconds=lastTime?Math.min(time-lastTime,50)/1000:1/60;lastTime=time;
  let moved=false;
  for(const axis of ['y','x'] as const){
   const el=scrollParent(axis);if(!el)continue;
   const bounds=visibleBounds(el);
   if(point.x<bounds.left||point.x>bounds.right||point.y<bounds.top||point.y>bounds.bottom)continue;
   const speed=axis==='y'?edgeScrollSpeed(point.y,bounds.top,bounds.bottom):edgeScrollSpeed(point.x,bounds.left,bounds.right);
   if(!speed)continue;
   const before=axis==='y'?el.scrollTop:el.scrollLeft;
   // Explicit instant scrolling avoids a smooth-scroll animation lagging behind the drag.
   el.scrollBy({top:axis==='y'?speed*seconds:0,left:axis==='x'?speed*seconds:0,behavior:'instant'});
   moved ||= (axis==='y'?el.scrollTop:el.scrollLeft)!==before;
  }
  if(moved)frame=win.requestAnimationFrame(tick);else lastTime=0;
 }
 function over(event:DragEvent){
  if(!isActive()){stop();return}
  point={x:event.clientX,y:event.clientY};
  if(frame===undefined)frame=win.requestAnimationFrame(tick);
 }
 function leave(event:DragEvent){if(!event.relatedTarget&&(event.clientX<=0||event.clientY<=0||event.clientX>=win.innerWidth||event.clientY>=win.innerHeight))stop()}
 function visibility(){if(doc.hidden)stop()}
 // Capture sees events even when individual drop targets stop propagation.
 doc.addEventListener('dragover',over,true);
 doc.addEventListener('drop',stop,true);
 doc.addEventListener('dragend',stop,true);
 doc.addEventListener('dragleave',leave,true);
 doc.addEventListener('visibilitychange',visibility);
 win.addEventListener('blur',stop);
 return {destroy(){stop();doc.removeEventListener('dragover',over,true);doc.removeEventListener('drop',stop,true);doc.removeEventListener('dragend',stop,true);doc.removeEventListener('dragleave',leave,true);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',stop)}};
}
