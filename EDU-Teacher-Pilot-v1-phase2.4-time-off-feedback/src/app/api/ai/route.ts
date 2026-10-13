import OpenAI from 'openai';
import {NextResponse} from 'next/server';

export const runtime = 'nodejs';

const DEMO_REPLY = `I can help with this class right away. Based on the current Grade 7 math profile, I would keep the one-step equation review short and spend more time on distributive property and translating word problems into equations.\n\nTry this next: show one visual worked example, ask students to explain why the same operation must happen on both sides, then use two guided word problems before independent practice.`;

export async function POST(req: Request){
  try{
    const body = await req.json();
    const {message, history = [], context = {}, materialText = '', materialGuidance = {}} = body;
    if(!message?.trim()) return NextResponse.json({error:'Message is required.'},{status:400});

    if(!process.env.OPENAI_API_KEY){
      return NextResponse.json({text: DEMO_REPLY, demo:true});
    }

    const client = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
    const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const recent = history.slice(-8).map((m:any)=>`${m.role === 'assistant' ? 'EDU' : 'Teacher'}: ${m.content}`).join('\n');
    const prompt = `You are EDU, a practical Grade 6-8 math teacher copilot. You help teachers plan standards-aligned, class-specific instruction. Never invent student records. Treat class mastery as aggregate evidence, not a diagnosis of named students. Be concise, specific, and classroom-ready.\n\nCURRENT CLASS CONTEXT\n${JSON.stringify(context,null,2)}\n\nTEACHER MATERIAL NOTES\n${materialText || 'No teacher material text supplied.'}\n\nMATERIAL USE INSTRUCTIONS\n${JSON.stringify(materialGuidance,null,2)}\nInterpret file choices as: follow = closely match content/sequence; reference = use as flexible supporting context; gaps = use primarily to identify/target learning gaps. noteUse must-follow = requirement; teaching-preferences = shape pedagogy/style; optional-context = use only when helpful.\n\nRECENT CHAT\n${recent || 'None'}\n\nTEACHER QUESTION\n${message}`;
    const response = await client.responses.create({model,input:prompt,store:false});
    return NextResponse.json({text:response.output_text || 'I could not generate a response.'});
  }catch(err:any){
    return NextResponse.json({error:err?.message || 'AI request failed.'},{status:500});
  }
}
