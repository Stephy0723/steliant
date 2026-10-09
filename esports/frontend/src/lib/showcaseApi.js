import { TOURNAMENTS } from '../data/tournaments.js'
const user={_id:'steliant-demo-player',id:'steliant-demo-player',username:'SteliantDemo',nickname:'Steliant Demo',email:'demo@steliant.example',role:'player',roles:['player'],emailVerified:true,avatar:null,games:[],country:'DO',plan:'free'}
const tournaments=TOURNAMENTS.map(t=>({...t,_id:String(t.id),title:t.name.replace(/GG |Glitch/g,'Steliant '),game:({val:'valorant',lol:'league-of-legends',cs2:'counter-strike-2',apex:'apex-legends',rl:'rocket-league',mlbb:'mobile-legends-bang-bang'})[t.game]||t.game,status:t.status==='live'?'ongoing':t.status==='upcoming'?'open':'finished',maxSlots:t.slots,currentSlots:t.filled,prizePool:0,entryFee:0,registrations:[],organizer:user,description:'Torneo de demostración. No admite pagos ni inscripciones reales.'}))
export async function showcaseApi(path,options={}) {
 const url=new URL(path,'https://showcase.invalid');const p=url.pathname;const method=(options.method||'GET').toUpperCase()
 if(p==='/auth/me')return {user};
 if(/^\/auth\/(login|register|2fa\/verify)$/.test(p))return {user,token:'showcase-local-only'};
 if(p==='/auth/logout')return {success:true};
 if(p==='/settings/ads')return {banner:false,tournament:false,floating:false,dashboard:false,promo:false};
 if(p==='/site-ads'||p==='/site-promos'||p==='/ads')return [];
 if(p==='/tournaments')return {tournaments,total:tournaments.length,page:1,totalPages:1};
 if(/^\/tournaments\/\d+$/.test(p)){const t=tournaments.find(t=>t._id===p.split('/').pop());return {tournament:t,...t};}
 if(p==='/news')return {news:[]};
 if(p==='/notifications')return {notifications:[],unreadCount:0};
 if(p==='/rewards')return {referralCode:'DEMO',referrals:[],stats:{friends:0,titles:0,tournaments:0},progress:[],achievements:[],unlockedAchievements:0};
 if(p==='/communities')return {communities:[]};
 if(p==='/teams')return {teams:[]};
 if(p==='/players/me/matches')return {matches:[]};
 if(p==='/players/me/stats/games')return {stats:[]};
 if(p==='/players/me/tournaments')return {results:[]};
 if(method!=='GET')throw new Error('Esta acción requiere el servidor del proyecto. En esta muestra no se procesan pagos ni se envían datos.');
 throw new Error('Este módulo requiere el servidor del proyecto; puedes explorar su interfaz en la muestra.');
}
