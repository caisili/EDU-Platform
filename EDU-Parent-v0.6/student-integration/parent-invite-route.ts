// Add as Student app: src/app/api/student/parent-invite/route.ts
import {NextRequest,NextResponse} from 'next/server';
export async function POST(req:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const auth=req.headers.get('authorization')||'';
 if(!url||!key)return NextResponse.json({error:'Supabase not configured'},{status:503});
 if(!/^Bearer [^ ]+$/.test(auth))return NextResponse.json({error:'Student sign-in required'},{status:401});
 const r=await fetch(`${url}/rest/v1/rpc/edu_create_parent_invite`,{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
 if(!r.ok)return NextResponse.json({error:'Unable to create invite. Check student role and database migration.'},{status:400});
 return NextResponse.json({code:await r.json(),expiresInDays:7});
}
