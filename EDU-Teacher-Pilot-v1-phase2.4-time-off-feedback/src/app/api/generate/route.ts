import {NextResponse} from 'next/server';
export async function POST(req:Request){
 const body=await req.json();
 if(!process.env.OPENAI_API_KEY) return NextResponse.json({mode:'demo',message:'Add OPENAI_API_KEY to .env.local to enable live generation.',input:body});
 const model=process.env.OPENAI_MODEL||'gpt-5-mini';
 const prompt=`You are EDU, a Grade 6-8 math instructional copilot. Use curriculum, teacher materials and class-level mastery data to diagnose learning gaps before generating a lesson. Never invent student records. Return concise JSON with diagnosis, strategy, lessonArchitecture, misconceptions, exitTicket. Input: ${JSON.stringify(body)}`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model,input:prompt})});
 if(!r.ok) return NextResponse.json({error:await r.text()},{status:r.status});
 const data=await r.json(); return NextResponse.json(data);
}
