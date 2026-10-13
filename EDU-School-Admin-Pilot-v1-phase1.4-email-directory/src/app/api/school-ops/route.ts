import {NextResponse} from 'next/server';
import {db,connected,bearer,jwtSubject} from '../../../lib/eduData';

async function adminContext(token:string){
  const uid=jwtSubject(token); if(!uid) throw new Error('Invalid session');
  const rows=await db(`profiles?id=eq.${uid}&select=id,role,school_id&limit=1`,{},token);
  const me=rows?.[0];
  if(!me?.school_id||!['principal','admin'].includes(me.role)) throw new Error('School Admin access required');
  return me;
}

async function loadStudentAttendance(token:string, schoolId:string){
  const sid=encodeURIComponent(schoolId);
  let rows=await db(`student_attendance?school_id=eq.${sid}&select=*&order=attendance_date.desc,submitted_at.desc&limit=250`,{},token).catch(()=>[]);
  // Compatibility for attendance rows created before school_id was populated:
  // use teacher user_id membership in this same school, never a display-name guess.
  if(!rows?.length){
    const teachers=await db(`profiles?school_id=eq.${sid}&role=eq.teacher&select=id`,{},token).catch(()=>[]);
    const ids=(teachers||[]).map((t:any)=>t.id).filter(Boolean);
    if(ids.length){
      const list=ids.map((id:string)=>`"${id}"`).join(',');
      rows=await db(`student_attendance?user_id=in.(${encodeURIComponent(list)})&select=*&order=attendance_date.desc,submitted_at.desc&limit=250`,{},token).catch(()=>[]);
    }
  }
  return rows||[];
}

export async function GET(req:Request){
  if(!connected)return NextResponse.json({connected:false,error:'Supabase is not configured'});
  const token=bearer(req); if(!token)return NextResponse.json({error:'Sign in required'},{status:401});
  try{
    const me=await adminContext(token); const sid=encodeURIComponent(me.school_id);
    const [reports,studentAttendance,staffAttendance,timeOff]=await Promise.all([
      db(`teaching_reports?school_id=eq.${sid}&select=*&order=submitted_at.desc&limit=100`,{},token),
      loadStudentAttendance(token,me.school_id),
      db(`staff_attendance?school_id=eq.${sid}&select=*&order=created_at.desc&limit=100`,{},token),
      db(`time_off_requests?school_id=eq.${sid}&select=*&order=submitted_at.desc&limit=100`,{},token)
    ]);
    return NextResponse.json({connected:true,reports,studentAttendance,staffAttendance,timeOff});
  }catch(e:any){return NextResponse.json({connected:true,error:e?.message||'Could not load school operations'},{status:500})}
}

export async function PATCH(req:Request){
  if(!connected)return NextResponse.json({connected:false,error:'Supabase is not configured'},{status:503});
  const token=bearer(req);if(!token)return NextResponse.json({error:'Sign in required'},{status:401});
  try{const me=await adminContext(token);const {id,status}=await req.json();if(!id||!['Approved','Denied'].includes(status))return NextResponse.json({error:'Invalid review'},{status:400});const rows=await db(`time_off_requests?id=eq.${encodeURIComponent(id)}&school_id=eq.${encodeURIComponent(me.school_id)}`,{method:'PATCH',body:JSON.stringify({status,reviewed_at:new Date().toISOString()})},token);return NextResponse.json({connected:true,item:rows?.[0]})}catch(e:any){return NextResponse.json({connected:true,error:e?.message||'Could not review request'},{status:500})}
}
