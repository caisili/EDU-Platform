import {NextRequest,NextResponse} from 'next/server';
import {studentAuth,url} from '../_studentAuth/auth';
export async function GET(req:NextRequest){
 const id=await studentAuth(req);if('error'in id)return NextResponse.json({error:id.error},{status:id.status});
 const base=`${url}/rest/v1/`;
 const [p,u,l]=await Promise.all([
 fetch(base+`student_reward_profiles?student_id=eq.${id.userId}&select=balance,lifetime_points,active_pet,active_theme`,{headers:id.headers,cache:'no-store'}),
 fetch(base+`student_reward_unlocks?student_id=eq.${id.userId}&select=reward_type,reward_key`,{headers:id.headers,cache:'no-store'}),
 fetch(base+`student_points_ledger?student_id=eq.${id.userId}&select=event_key,amount,created_at&order=created_at.desc&limit=20`,{headers:id.headers,cache:'no-store'})]);
 if(!p.ok||!u.ok||!l.ok)return NextResponse.json({error:'Rewards unavailable. Apply the v2.1 SQL migration.'},{status:503});
 const profile=(await p.json())[0]||{balance:0,lifetime_points:0,active_pet:null,active_theme:'classic'};
 return NextResponse.json({profile,unlocks:await u.json(),ledger:await l.json()});
}
export async function POST(req:NextRequest){
 const id=await studentAuth(req);if('error'in id)return NextResponse.json({error:id.error},{status:id.status});
 const body=await req.json().catch(()=>null);
 if(!body||typeof body.action!=='string'||typeof body.key!=='string')return NextResponse.json({error:'Invalid reward action'},{status:400});
 const r=await fetch(`${url}/rest/v1/rpc/edu_reward_action`,{method:'POST',headers:{...id.headers,'Content-Type':'application/json'},body:JSON.stringify({p_action:body.action,p_key:body.key}),cache:'no-store'});
 const d=await r.json().catch(()=>null);if(!r.ok)return NextResponse.json({error:d?.message||'Reward action failed'},{status:400});return NextResponse.json(d);
}
