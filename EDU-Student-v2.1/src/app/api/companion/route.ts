import {NextRequest,NextResponse} from 'next/server';
import {studentAuth} from '../_studentAuth/auth';
export async function POST(req:NextRequest){
 const id=await studentAuth(req);if('error'in id)return NextResponse.json({error:id.error},{status:id.status});
 const body=await req.json().catch(()=>null);const messages=body?.messages;
 if(!Array.isArray(messages)||messages.length>12||messages.length===0||messages.some((m:any)=>!['user','assistant'].includes(m?.role)||typeof m?.content!=='string'||m.content.length>1200))return NextResponse.json({error:'Invalid conversation'},{status:400});
 const interests=Array.isArray(body?.interests)?body.interests.filter((x:any)=>typeof x==='string').slice(0,10):[];
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'AI Companion needs OPENAI_API_KEY in the server environment. Missions still work without it.'},{status:503});
 try{
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.EDU_AI_MODEL||'gpt-4o-mini',max_tokens:280,temperature:0.7,messages:[{role:'system',content:'You are EDU, a safe, encouraging, curious learning companion for grade 6-8 students. Help students discover new interests and connect their interests to school learning, especially math. Use short, friendly explanations and one engaging follow-up question. Offer one of these real app missions when relevant: Basketball Analyst (percentages), Mars Mission Planner (25% budgets), Game Score Designer (multiplication). Do not claim you can launch or record missions yourself. Never fabricate recent news or claim live information. Avoid asking for personal data. Avoid personal, romantic, or emotionally dependent bonding. Redirect dangerous or sensitive situations to trusted adults. Student interests (unverified preferences): '+interests.join(', ')},...messages.map((m:any)=>({role:m.role,content:m.content}))]})});const d=await r.json().catch(()=>null);if(!r.ok)return NextResponse.json({error:'AI service temporarily unavailable'},{status:502});return NextResponse.json({reply:d?.choices?.[0]?.message?.content||'What would you like to explore next?'})
 }catch{return NextResponse.json({error:'AI service temporarily unavailable'},{status:502})}
}
