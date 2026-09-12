export type LineSnippet={id:string;title:string;body:string};
export const DEFAULT_LINE_SNIPPETS:LineSnippet[]=[
 {id:'greeting',title:'最初の挨拶',body:'いつもお世話になっております。'},
 {id:'thanks',title:'お礼',body:'ご連絡ありがとうございます。'},
 {id:'closing',title:'締めの挨拶',body:'引き続きよろしくお願いいたします。'},
];
export function validLineSnippets(value:unknown):value is LineSnippet[]{
 return Array.isArray(value)&&value.length<=20&&value.every(item=>item&&typeof item.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(item.id)&&typeof item.title==='string'&&!!item.title.trim()&&item.title.length<=80&&typeof item.body==='string'&&!!item.body.trim()&&item.body.length<=2000)&&new Set(value.map(item=>item.id)).size===value.length;
}
export function lineSnippets(value:unknown):LineSnippet[]{
 return (validLineSnippets(value)?value:DEFAULT_LINE_SNIPPETS).map(({id,title,body})=>({id,title,body}));
}
