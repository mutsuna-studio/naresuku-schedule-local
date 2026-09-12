export type LineTemplate={opening:string;closing:string};
export const defaultLineTemplate:LineTemplate={opening:'{挨拶}いつもお世話になっております😊\n{年}年{月}月の授業スケジュールを以下の日程とさせていただきます🙇',closing:'振替や変更も可能ですので、ご希望の場合はご連絡ください🙇\nよろしくお願いいたします！'};
export function validLineTemplate(value:unknown):value is LineTemplate{const t=value as LineTemplate;return !!t&&typeof t.opening==='string'&&typeof t.closing==='string'&&t.opening.length<=2000&&t.closing.length<=2000}
export function renderLineTemplate(template:LineTemplate,month:string,now=new Date()){
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',hourCycle:'h23'}).format(now));
 const values:Record<string,string>={'年':String(Number(month.slice(0,4))),'月':String(Number(month.slice(5,7))),'挨拶':hour>=5&&hour<11?'おはようございます！':hour>=11&&hour<17?'こんにちは！':'こんばんは！'};
 const expand=(s:string)=>s.replace(/\{(年|月|挨拶)\}/g,(_,key)=>values[key]);return {opening:expand(template.opening),closing:expand(template.closing)};
}

export function lineDate(date:string,{weekday=true,padDay=false}={}){
 const day=padDay?date.slice(8,10):String(Number(date.slice(8,10)));
 return `${Number(date.slice(5,7))}月${day}日`+(weekday?`(${'日月火水木金土'[new Date(date+'T00:00:00Z').getUTCDay()]})`:'');
}
export function lineDateList(slots:ReadonlyArray<{date:string;start:string}>,{groupByDate=false,padDay=false}={}){
 const sorted=[...slots].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
 if(!groupByDate)return sorted.map(slot=>`${lineDate(slot.date,{padDay})} ${slot.start}~`).join('\n');
 const dates=new Map<string,Set<string>>();
 for(const slot of sorted){if(!dates.has(slot.date))dates.set(slot.date,new Set());dates.get(slot.date)!.add(slot.start)}
 return [...dates].map(([date,times])=>`${lineDate(date,{padDay})} ${[...times].map(time=>time+'~').join(',')}`).join('\n');
}
export function composeLineMessage(opening:string,dates:string,closing:string,note=''){
 return [opening,dates+(note.trim()?'\n'+note.trim():''),closing].filter(Boolean).join('\n\n');
}
