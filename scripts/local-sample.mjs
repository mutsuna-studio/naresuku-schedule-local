// Fictional, isolated scenarios. No production records or personal information.
export function localSample(now=new Date()){
 const room='検証用教室（希望・在籍・科目）',otherRoom='検証用別教室',prefix='scenario-v2';
 const base=new Date(now.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})+'T00:00:00Z');
 const month=base.toISOString().slice(0,7);
 const monthAt=offset=>new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+offset,1)).toISOString().slice(0,7);
 const next=monthAt(1),after=monthAt(2);
 const curricula=['Scratch','Unity','Swift'];
 const state={slots:[],lessons:[],students:[],teachers:[],availability:{},duty:{},history:[],preferences:[],settings:{campuses:[room,otherRoom],curricula,schedules:[],closeOnHolidays:{[room]:false,[otherRoom]:false},curriculumAbbreviations:{Scratch:'SC',Unity:'UN',Swift:'SW'}}};
 const students=[
  ['優先1・PCあり','Scratch',true,4,[]],
  ['優先3・PCなし','Scratch',false,4,[]],
  ['Unity専攻','Unity',true,4,[]],
  ['Swift担当不足','Swift',false,4,[]],
  ['翌月休会','Scratch',false,4,[{status:'paused',from:next,until:next}]],
  ['今月末退会','Unity',true,4,[{status:'withdrawn',from:month,until:''}]],
  ['翌月入会','Scratch',true,4,[{status:'active',from:next,until:''}]],
  ['翌々月復帰','Unity',false,2,[{status:'paused',from:month,until:next}]],
  ['月2回・隔週','Scratch',false,2,[]],
  ['出勤不可から別候補','Unity',true,4,[]],
  ['検定','Unity',true,2,[]],
  ['別教室の生徒','Scratch',false,4,[]],
 ];
 students.forEach(([name,course,ownsComputer,monthlyLessons,periods],index)=>state.students.push({id:`${prefix}-student-${index+1}`,name:`検証${String(index+1).padStart(2,'0')} ${name}`,room:index===11?otherRoom:room,course,ownsComputer,monthlyLessons,periods:periods.map((period,i)=>({...period,id:`${prefix}-period-${index}-${i}`})),reviewed:true}));
 const teacherSpecs=[['Scratch講師',['Scratch'],room,1,false],['Unity講師',['Unity'],room,2,false],['検定対応スタッフ',['Scratch','Unity'],room,1,true],['別教室講師',['Scratch'],otherRoom,2,false]];
 teacherSpecs.forEach(([name,courses,campus,max,autoAttendance],i)=>state.teachers.push({id:`${prefix}-teacher-${i}`,name,rooms:[campus],curricula:courses,max,autoAttendance,canSuperviseExam:autoAttendance}));
 const periods=[{start:'10:00',end:'11:30'},{start:'13:00',end:'14:30'}];
 for(const campus of [room,otherRoom])for(const weekday of [3,5])state.settings.schedules.push({room:campus,weekday,periods:periods.map((p,i)=>({...p,id:`${prefix}-${weekday}-${i}`,order:i+1}))});
 for(let day=new Date(month+'-01T00:00:00Z');day<new Date(monthAt(3)+'-01T00:00:00Z');day.setUTCDate(day.getUTCDate()+1)){
  if(![3,5].includes(day.getUTCDay())||Math.ceil(day.getUTCDate()/7)>4)continue;
  for(const campus of [room,otherRoom])for(const [i,period] of periods.entries()){
   const slot={id:`${prefix}-${campus===room?'main':'other'}-${day.toISOString().slice(0,10)}-${i}`,room:campus,date:day.toISOString().slice(0,10),...period};state.slots.push(slot);
   for(const teacher of state.teachers.filter(t=>t.rooms.includes(campus))){
    const value=teacher.name==='Unity講師'&&day.getUTCDay()===5?'no':teacher.name==='検定対応スタッフ'&&i===1?'no':day.getUTCDay()===5?'reserve':'yes';
    state.availability[`${teacher.name}|${slot.id}`]=value;
    if(slot.date.startsWith(month)&&value!=='no')state.duty[`${teacher.name}|${slot.id}`]=true;
   }
  }
 }
 function preference(index,weekday,period,weeks=[1,2,3,4],priority=1,alternatives=[]){const student=state.students[index];state.preferences.push({id:`${prefix}-preference-${state.preferences.length}`,studentId:student.id,name:student.name,room:student.room,course:student.course,weekday,weeks,...periods[period],priority,alternatives})}
 preference(0,3,0,[1,2,3,4],1,[{weekday:5,...periods[0]}]);
 preference(1,3,0,[1,2,3,4],3,[{weekday:5,...periods[0]}]);
 preference(2,3,1);preference(3,3,1);
 preference(4,3,1);preference(5,3,1);preference(6,5,1);preference(7,3,1,[1,3]);
 preference(8,5,1,[1,3]);preference(9,5,1,[1,2,3,4],2,[{weekday:3,...periods[1]}]);
 preference(10,3,0,[2,4]);preference(11,3,0);
 // Current month has concrete lessons for transfer/absence/exam checks.
 // Next two months deliberately have slots + preferences only, for generation tests.
 const current=state.slots.filter(slot=>slot.room===room&&slot.date.startsWith(month)&&slot.date>base.toISOString().slice(0,10));
 const first=current[0]||state.slots.find(slot=>slot.room===room&&slot.date.startsWith(month));
 function lesson(index,slot,extra={}){const st=state.students[index];state.lessons.push({id:`${prefix}-lesson-${state.lessons.length}`,studentId:st.id,name:st.name,course:st.course,slot:slot.id,teacher:'',note:'検証用：翌月は「月の予定作成」で生成してください',exam:false,absent:false,...extra})}
 if(first){lesson(0,first,{teacher:'Scratch講師'});lesson(1,first);lesson(10,first,{teacher:'検定対応スタッフ',exam:true});
 const afternoon=state.slots.find(slot=>slot.room===room&&slot.date===first.date&&slot.start==='13:00');
 if(afternoon){lesson(2,afternoon);lesson(3,afternoon);lesson(9,afternoon,{absent:true,request:'欠席｜理由：その他'});}
 }
 state.history.push({at:now.toISOString(),text:`検証用サンプル追加：${next}は新規配置、${after}は復帰を確認`});
 return state;
}
