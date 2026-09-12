export const DEFAULT_LINE_EMOJIS=['😊','🙇','👍','✨','🙏'];
export function validLineEmoji(value:unknown):value is string{
 return typeof value==='string'&&value.length<=32&&[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(value)].length===1&&/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(value);
}
export function validLineEmojis(value:unknown):value is string[]{
 return Array.isArray(value)&&value.length<=12&&value.every(validLineEmoji)&&new Set(value).size===value.length;
}
export function lineEmojis(value:unknown):string[]{return validLineEmojis(value)?[...value]:[...DEFAULT_LINE_EMOJIS]}
