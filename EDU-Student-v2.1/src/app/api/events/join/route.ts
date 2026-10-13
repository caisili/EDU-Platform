import {NextResponse} from 'next/server';
import {connected,db} from '../../../../lib/eduData';
export async function POST(req:Request){
 if(!connected)return NextResponse.json({ok:false,error:'EDU Data Layer not configured'},{status:503});
 try{const b=await req.json();await db('event_participants?on_conflict=event_id,student_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({event_id:b.event_id,student_id:b.student_id,student_name:b.student_name})});return NextResponse.json({ok:true})}catch(e:any){return NextResponse.json({ok:false,error:e.message},{status:500})}
}
