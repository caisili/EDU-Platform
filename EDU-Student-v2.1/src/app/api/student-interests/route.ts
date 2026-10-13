import {NextRequest,NextResponse} from 'next/server';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
const allowed=new Set(['coding','puzzles','basketball','space','art','animals','music','gaming','science','sports']);
async function identity(req:NextRequest){
 const auth=req.headers.get('authorization')||'';
 if(!url||!key)return {error:'Supabase not configured',status:503};
 if(!/^Bearer [^ ]+$/.test(auth))return {error:'Sign in required',status:401};
 const headers={apikey:key,Authorization:auth};
 const u=await fetch(`${url}/auth/v1/user`,{headers,cache:'no-store'});
 const user=await u.json().catch(()=>null);
 if(!u.ok||!user?.id)return {error:'Invalid session',status:401};
 const p=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,school_id`,{headers,cache:'no-store'});
 const rows=await p.json().catch(()=>[]);
 if(!p.ok)return {error:'Unable to verify profile',status:503};
 const profile=rows?.[0];
 if(profile?.role!=='student'||!profile.school_id)return {error:'Student school membership required',status:403};
 return {headers,userId:user.id,schoolId:profile.school_id};
}
export async function GET(req:NextRequest){
 const id=await identity(req);if('error'in id)return NextResponse.json({error:id.error},{status:id.status});
 const r=await fetch(`${url}/rest/v1/student_interests?student_id=eq.${encodeURIComponent(id.userId)}&school_id=eq.${encodeURIComponent(id.schoolId)}&select=interest_key&order=created_at.asc`,{headers:id.headers,cache:'no-store'});
 const data=await r.json().catch(()=>null);
 if(!r.ok)return NextResponse.json({error:'Interests unavailable. Apply the v2.0.1 SQL migration if not already applied.',details:data?.code||''},{status:503});
 return NextResponse.json({interests:(Array.isArray(data)?data:[]).map((x:any)=>x.interest_key)});
}
export async function PUT(req:NextRequest){
 const id=await identity(req);if('error'in id)return NextResponse.json({error:id.error},{status:id.status});
 const body=await req.json().catch(()=>null);
 if(!Array.isArray(body?.interests)||body.interests.length>10||body.interests.some((x:unknown)=>typeof x!=='string'||!allowed.has(x)))return NextResponse.json({error:'Invalid interests'},{status:400});
 const interests=[...new Set(body.interests)] as string[];
 // Use an atomic, authenticated database function; no service-role credentials or partial delete/insert.
 const r=await fetch(`${url}/rest/v1/rpc/edu_set_student_interests`,{method:'POST',headers:{...id.headers,'Content-Type':'application/json'},body:JSON.stringify({p_interests:interests}),cache:'no-store'});
 const data=await r.json().catch(()=>null);
 if(!r.ok)return NextResponse.json({error:'Could not save interests',details:data?.message||''},{status:503});
 return NextResponse.json({interests});
}
