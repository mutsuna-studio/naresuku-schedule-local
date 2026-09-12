/** Only HTTPS profile images may be rendered; invalid or missing images use initials. */
export function slackProfileImage(value:unknown):string|null {
 if(typeof value!=='string'||!value.trim())return null;
 try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null} catch {return null}
}
