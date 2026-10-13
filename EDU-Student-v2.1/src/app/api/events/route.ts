import {NextResponse} from 'next/server';
import {connected,db} from '../../../lib/eduData';
export async function GET(){
 if(!connected)return NextResponse.json({connected:false,events:[]});
 try{
  const events=await db('events?select=*&order=created_at.desc');
  const joins=await db('event_participants?select=event_id');
  const counts:any={}; for(const j of joins)counts[j.event_id]=(counts[j.event_id]||0)+1;
  return NextResponse.json({connected:true,events:events.map((e:any)=>({...e,participants:counts[e.id]||0}))});
 }catch(e:any){return NextResponse.json({connected:false,events:[],error:e.message},{status:500})}
}
export async function POST(req:Request){
 if(!connected)return NextResponse.json({connected:false,error:'Add Supabase keys to .env.local'});
 try{const b=await req.json();const rows=await db('events',{method:'POST',body:JSON.stringify({title:b.title,date:b.date,time:b.time,location:b.location,grades:b.grades,interest:b.interest,description:b.description,published:true})});return NextResponse.json({connected:true,event:{...rows[0],participants:0}})}catch(e:any){return NextResponse.json({connected:false,error:e.message},{status:500})}
}
