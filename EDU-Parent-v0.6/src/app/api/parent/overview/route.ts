import {NextRequest,NextResponse} from 'next/server';import {parentContext,restGet} from '../../../../lib/server';
export async function GET(req:NextRequest){try{
 const c=await parentContext(req);if('error'in c)return NextResponse.json({error:c.error},{status:c.status});
 // Only explicitly verified parent-child links are accessible; RLS must independently enforce this.
 const links=await restGet(`parent_student_links?parent_id=eq.${encodeURIComponent(c.userId)}&status=eq.verified&select=student_id`,c.headers);
 const children=[];
 for(const l of links){const p=await restGet(`profiles?id=eq.${encodeURIComponent(l.student_id)}&school_id=eq.${encodeURIComponent(c.schoolId)}&select=id,full_name,school_id`,c.headers);
 if(!p?.[0])continue;
 const growth=await restGet(`growth_events?student_id=eq.${encodeURIComponent(l.student_id)}&select=skill,score,created_at&order=created_at.desc&limit=12`,c.headers).catch(()=>[]);
 const interests=await restGet(`student_interests?student_id=eq.${encodeURIComponent(l.student_id)}&select=interest_key&limit=12`,c.headers).catch(()=>[]);
 children.push({id:p[0].id,name:p[0].full_name,schoolId:p[0].school_id,growth,interests});}
 return NextResponse.json({connected:true,parent:c.name,children});
 }catch{return NextResponse.json({error:'Unable to load family data; check migration and RLS.'},{status:503})}}
