import {NextResponse} from 'next/server';
import {db,connected,bearer,jwtSubject} from '../../../lib/eduData';
export async function POST(req:Request){
 if(!connected)return NextResponse.json({connected:false,error:'Shared EDU Data Layer is not configured.'},{status:503});
 const token=bearer(req);if(!token)return NextResponse.json({error:'Sign in required'},{status:401});
 const userId=jwtSubject(token);if(!userId)return NextResponse.json({error:'Invalid session'},{status:401});
 try{const body=await req.json();const {type,payload}=body||{};const table=type==='report'?'teaching_reports':type==='student_attendance'?'student_attendance':type==='work_attendance'?'staff_attendance':type==='leave_request'?'time_off_requests':'';if(!table)return NextResponse.json({error:'Unsupported school operation.'},{status:400});
  const me=await db(`profiles?id=eq.${userId}&select=id,school_id,full_name,role&limit=1`,{},token);if(!me?.[0]?.school_id)return NextResponse.json({error:'Your account is not connected to a school.'},{status:403});
  if(me[0].role!=='teacher')return NextResponse.json({error:'This workspace requires a teacher account.'},{status:403});
  const schools=await db(`schools?id=eq.${me[0].school_id}&select=name&limit=1`,{},token);
  const owned={...payload,school_id:me[0].school_id,user_id:me[0].id,teacher_name:me[0].full_name||'Teacher',school_name:schools?.[0]?.name||payload?.school_name||'School'};
  const rows=await db(table,{method:'POST',body:JSON.stringify(owned)},token);return NextResponse.json({connected:true,item:rows?.[0]||owned});
 }catch(e:any){return NextResponse.json({connected:true,error:e?.message||'Could not submit to school.'},{status:500})}
}

export async function GET(req:Request){
 if(!connected)return NextResponse.json({connected:false,error:'Shared EDU Data Layer is not configured.'},{status:503});
 const token=bearer(req);if(!token)return NextResponse.json({error:'Sign in required'},{status:401});
 const userId=jwtSubject(token);if(!userId)return NextResponse.json({error:'Invalid session'},{status:401});
 try{
  const me=await db(`profiles?id=eq.${userId}&select=id,school_id,role&limit=1`,{},token);
  if(!me?.[0]?.school_id||me[0].role!=='teacher')return NextResponse.json({error:'Teacher account required'},{status:403});
  const rows=await db(`time_off_requests?school_id=eq.${encodeURIComponent(me[0].school_id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&order=submitted_at.desc&limit=100`,{},token);
  return NextResponse.json({connected:true,timeOff:rows||[]});
 }catch(e:any){return NextResponse.json({connected:true,error:e?.message||'Could not load time-off requests'},{status:500})}
}
