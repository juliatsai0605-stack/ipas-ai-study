// Public configuration only. NEVER return a service_role or secret key.
export default function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("Content-Type","application/json; charset=utf-8");
  if(req.method!=="GET"){res.status(405).json({error:"Method not allowed"});return;}
  const url=process.env.SUPABASE_URL || "";
  const key=process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  if(!url || !key){res.status(200).json({configured:false});return;}
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url)){res.status(500).json({configured:false,error:"Invalid Supabase URL"});return;}
  res.status(200).json({configured:true,url,publishableKey:key});
}