import type {State} from '../lib/scheduler';

// accessibleRooms comes from the authenticated schedule response, including room-admin scoping.
export function canOpenTeacherShift(state:Pick<State,'teachers'>,role:string,self:string,accessibleRooms:string[],room:string,target:string):boolean{
 if(!target||!accessibleRooms.includes(room)||!state.teachers.some(item=>item.name===target&&item.rooms?.includes(room)))return false;
 return role==='admin'||role==='staff'&&target===self;
}
