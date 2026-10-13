import {NextRequest,NextResponse} from 'next/server';
function clean(s:string){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim()}
function tag(block:string,name:string){const m=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return m?clean(m[1]):''}
export async function GET(req:NextRequest){
 const interest=(req.nextUrl.searchParams.get('interest')||'education').slice(0,60);
 const url=`https://news.google.com/rss/search?q=${encodeURIComponent(interest+' when:7d')}&hl=en-US&gl=US&ceid=US:en`;
 try{const r=await fetch(url,{cache:'no-store',headers:{'User-Agent':'EDU-Student-MVP/0.3'}});if(!r.ok)throw new Error();const xml=await r.text();const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,8).map(m=>{const b=m[1],raw=tag(b,'title'),source=tag(b,'source');return {title:source&&raw.endsWith(' - '+source)?raw.slice(0,-(' - '+source).length):raw,link:tag(b,'link'),source,publishedAt:tag(b,'pubDate')}}).filter(x=>x.title&&x.link);return NextResponse.json({interest,items,fetchedAt:new Date().toISOString(),live:true})}catch{return NextResponse.json({interest,items:[],live:false,error:'Live news is temporarily unavailable. EDU will not show made-up news.'},{status:503})}
}
