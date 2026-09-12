type Navigation = {tab:string;room:string;date:string;scheduleView:'day'|'month'};
const adminTabs=['schedule','placement','shifts','students','imports','messages','teachers','settings','history','attendance','feedback'];
const staffTabs=['schedule','shifts','messages','account','attendance','feedback'];

export function readNavigation(href:string,role:'admin'|'staff',rooms:string[],defaults:Navigation):Navigation {
  const query=new URL(href).searchParams;
  const result={...defaults};
  const tab=query.get('view')||'';
  if((role==='staff'?staffTabs:adminTabs).includes(tab))result.tab=tab;
  const room=query.get('room')||'';
  if(rooms.includes(room))result.room=room;
  const date=query.get('date')||'';
  const month=query.get('month')||'';
  if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date)result.date=date;
  else if(/^\d{4}-(0[1-9]|1[0-2])$/.test(month))result.date=month+'-01';
  const mode=query.get('scheduleView');
  if(mode==='day'||mode==='month')result.scheduleView=mode;
  return result;
}

const storageKey='naresuku.navigation.v1';
const navigationParams=['view','room','date','month','scheduleView'];
type SessionStore=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function restoreNavigation(href:string,role:'admin'|'staff',rooms:string[],defaults:Navigation,storage:()=>SessionStore):Navigation {
  let result=defaults;
  try {
    const saved=JSON.parse(storage().getItem(storageKey)||'null');
    if(saved&&typeof saved==='object'){
      const url=new URL('https://navigation.local/');
      for(const [param,field] of [['view','tab'],['room','room'],['date','date'],['scheduleView','scheduleView']]){
        if(typeof saved[field]==='string')url.searchParams.set(param,saved[field]);
      }
      result=readNavigation(url.href,role,rooms,defaults);
    }
  } catch { /* Storage can be unavailable or contain invalid data. */ }
  // Accept old links once, then remove their navigation parameters.
  return readNavigation(href,role,rooms,result);
}
export function persistNavigation(state:Navigation,storage:()=>SessionStore):void {
  try { storage().setItem(storageKey,JSON.stringify(state)); } catch { /* Keep navigation usable when storage is blocked. */ }
}
export function clearNavigation(storage:()=>SessionStore):void {
  try { storage().removeItem(storageKey); } catch { /* Storage may be blocked. */ }
}
export function cleanNavigationUrl(href:string):string {
  const url=new URL(href);
  for(const param of navigationParams)url.searchParams.delete(param);
  return url.href;
}

// Keep app navigation separate from state owned by the browser/framework.
const historyKey='naresukuNavigation';
type NavigationHistory=Pick<History,'state'|'pushState'|'replaceState'|'go'>;
export function createNavigationHistory(history:NavigationHistory) {
  let current='';
  let started=false;
  let position=0;
  let returning=false;
  let afterReturn:(()=>void)|undefined;
  function read(scope:string,validate:(value:Navigation)=>Navigation):Navigation|null {
    const entry=history.state?.[historyKey];
    if(!entry||entry.scope!==scope||!entry.navigation)return null;
    const navigation=validate(entry.navigation);
    position=entry.position||0;
    current=JSON.stringify(navigation);
    started=true;
    return navigation;
  }
  return {
    read,
    guard(shouldBlock:(navigation:Navigation)=>boolean,onBlocked:(resume:()=>void)=>void){
      if(returning){returning=false;const callback=afterReturn;afterReturn=undefined;callback?.();return true}
      const entry=history.state?.[historyKey];
      if(!entry||!shouldBlock(entry.navigation))return false;
      const delta=(entry.position||0)-position;
      if(!delta)return false;
      returning=true;
      afterReturn=()=>onBlocked(()=>history.go(delta));
      history.go(-delta);
      return true;
    },
    sync(navigation:Navigation,scope:string,url:string) {
      const serialized=JSON.stringify(navigation);
      if(started&&serialized===current)return;
      if(started)position++;
      const state={...history.state,[historyKey]:{scope,position,navigation:{...navigation}}};
      if(started)history.pushState(state,'',url);
      else history.replaceState(state,'',url);
      current=serialized;started=true;
    },
    reset(){current='';started=false;history.replaceState({...history.state,[historyKey]:null},'')},
  };
}
