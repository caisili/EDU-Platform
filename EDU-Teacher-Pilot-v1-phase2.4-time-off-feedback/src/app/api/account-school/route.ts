import {NextResponse} from 'next/server';
import {db,connected,bearer,jwtSubject} from '../../../lib/eduData';
export async function GET(req:Request){
 if(!connected)return NextResponse.json({connected:false,error:'Shared EDU Data Layer is not configured.'},{status:503});
 const token=bearer(req);if(!token)return NextResponse.json({error:'Sign in required'},{status:401});
 const userId=jwtSubject(token);if(!userId)return NextResponse.json({error:'Invalid session'},{status:401});
 try{
  const me=await db(`profiles?id=eq.${userId}&select=id,full_name,role,school_id&limit=1`,{},token);
  const profile=me?.[0];if(!profile?.school_id)return NextResponse.json({connected:false,error:'Account is not connected to a school.'},{status:403});
  const schools=await db(`schools?id=eq.${profile.school_id}&select=id,name&limit=1`,{},token);
  return NextResponse.json({connected:true,full_name:profile.full_name||'',role:profile.role,school_id:profile.school_id,school_name:schools?.[0]?.name||''});
 }catch(e:any){return NextResponse.json({connected:false,error:e?.message||'Could not load school account.'},{status:500})}
}
