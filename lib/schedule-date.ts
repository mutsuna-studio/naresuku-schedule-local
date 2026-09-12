import type {State} from './scheduler';

function scheduleDates(state:State,room:string){
 return [...new Set(state.slots.filter(slot=>slot.room===room).map(slot=>slot.date))].sort();
}

export function openingScheduleDate(state:State,room:string,today:string){
 return scheduleDates(state,room).find(date=>date>=today)||today;
}

export function dayViewDate(state:State,room:string,date:string,today:string){
 const dates=scheduleDates(state,room);
 if(dates.includes(date))return date;
 return dates.find(value=>value.startsWith(date.slice(0,7)))||dates.find(value=>value>=today)||today;
}

export function scheduleDatesForTwoMonths(state:State,room:string,startMonth:string){
 const end=new Date(startMonth+'-01T12:00:00Z');
 end.setUTCMonth(end.getUTCMonth()+2);
 const start=startMonth+'-01',finish=end.toISOString().slice(0,10);
 return scheduleDates(state,room).filter(date=>date>=start&&date<finish);
}
