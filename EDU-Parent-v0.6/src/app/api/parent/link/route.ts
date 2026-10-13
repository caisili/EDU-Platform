import {NextRequest,NextResponse} from 'next/server';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
export async function POST(req:NextRequest){
 if(!url||!key)return NextResponse.json({error:'Supabase not configured'},{status:503});
 const auth=req.headers.get('authorization')||'';
 if(!/^Bearer [^ ]+$/.test(auth))return NextResponse.json({error:'Sign in required'},{status:401});
 const {code}=await req.json().catch(()=>({}));
 if(typeof code!=='string'||!/^[A-Z0-9-]{8,32}$/.test(code.trim().toUpperCase()))return NextResponse.json({error:'Invalid invite code'},{status:400});
 const r=await fetch(`${url}/rest/v1/rpc/edu_redeem_parent_invite`,{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_code:code.trim().toUpperCase()}),cache:'no-store'});
 const d=await r.json().catch(()=>null);
 if(!r.ok){console.error("[Parent Link RPC Error]",r.status,d);return NextResponse.json({error:'Unable to link. Check the invite code, expiry, or school approval.'},{status:400});
 return NextResponse.json({status:d});
}

}
