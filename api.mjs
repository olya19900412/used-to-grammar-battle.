import { getStore } from '@netlify/blobs';
import { randomBytes } from 'node:crypto';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export default async (request)=>{
 try {
  const u=new URL(request.url);const action=u.searchParams.get('action');const body=request.method==='POST'?await request.json():{};
  const store=getStore({name:'usedto-battle',consistency:'strong'});
  if(action==='create'&&request.method==='POST'){
   const room=randomBytes(3).toString('hex').toUpperCase();const secret=randomBytes(16).toString('hex');
   await store.setJSON(`room-${room}`,{secret,created:Date.now()});return reply({room,secret});
  }
  const room=String((request.method==='POST'?body.room:u.searchParams.get('room'))||'').toUpperCase();
  if(!/^[0-9A-F]{6}$/.test(room))return reply({error:'Invalid room'},400);
  const meta=await store.get(`room-${room}`,{type:'json'});if(!meta)return reply({error:'Room not found'},404);
  if(action==='submit'&&request.method==='POST'){
   const id=String(body.id||'');const name=String(body.name||'').trim().slice(0,36);const team=String(body.team||'');
   const correct=Number(body.correct),answered=Number(body.answered);
   if(!/^[a-zA-Z0-9-]{12,80}$/.test(id)||!name||!['Dragons','Lions','Cyber Knights'].includes(team)||!Number.isInteger(correct)||!Number.isInteger(answered)||answered<0||answered>15||correct<0||correct>answered)return reply({error:'Invalid result'},400);
   const key=`player-${room}-${id}`;const previous=await store.get(key,{type:'json'});
   if(previous&&(answered<previous.answered||correct<previous.correct))return reply({ok:true});
   await store.setJSON(key,{id,name,team,correct,answered,points:correct*10,updated:Date.now()});return reply({ok:true});
  }
  if(action==='results'){
   if(u.searchParams.get('secret')!==meta.secret)return reply({error:'Teacher access required'},403);
   const listed=await store.list({prefix:`player-${room}-`,paginate:false});
   const players=(await Promise.all(listed.blobs.map(b=>store.get(b.key,{type:'json'})))).filter(Boolean).sort((a,b)=>b.points-a.points||b.answered-a.answered);
   return reply({players});
  }
  return reply({error:'Unknown action'},404);
 }catch(e){return reply({error:'Server error. Check Netlify deployment and Blobs configuration.'},500)}
};
