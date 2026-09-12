export type SidebarLink={id:string;label:string;url:string;room?:string;iconUrl?:string};
export function validSidebarLinks(value:unknown):value is SidebarLink[]{
 if(!Array.isArray(value)||value.length>30)return false;
 const ids=new Set<string>();
 return value.every(link=>{if(!link||(link.room!==undefined&&(typeof link.room!=='string'||!link.room.trim()))||typeof link.id!=='string'||!link.id||ids.has(link.id)||typeof link.label!=='string'||!link.label.trim()||link.label.length>80||typeof link.url!=='string'||link.url.length>2048)return false;ids.add(link.id);if(link.iconUrl!==undefined){try{if(typeof link.iconUrl!=='string'||link.iconUrl.length>2048)return false;const icon=new URL(link.iconUrl);if(!['https:','http:'].includes(icon.protocol)||icon.username||icon.password)return false}catch{return false}}try{const url=new URL(link.url);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password}catch{return false}});
}

/** Reorder visible links while leaving other classrooms' entries in place. */
export function reorderSidebarLink(links:SidebarLink[],room:string,id:string,position:number):SidebarLink[]{
 const visible=links.filter(link=>!link.room||link.room===room);
 const from=visible.findIndex(link=>link.id===id);
 if(from<0||!Number.isInteger(position)||position<0||position>=visible.length)return links;
 const [moving]=visible.splice(from,1);visible.splice(position,0,moving);
 let index=0;
 return links.map(link=>!link.room||link.room===room?visible[index++]:link);
}
