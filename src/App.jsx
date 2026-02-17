import React, { useState } from 'react'
import { useWineData, useAuth, addEntry, updateEntry, deleteEntry, addBottle, decrementBottle, toggleReaction, addComment as postComment } from './data'

const TYPES = [
  { label: "Red", color: "#C0392B", bg: "#C0392B15", emoji: "🍷" },
  { label: "White", color: "#D4AC0D", bg: "#D4AC0D15", emoji: "🥂" },
  { label: "Rosé", color: "#E74C8B", bg: "#E74C8B15", emoji: "🌸" },
  { label: "Orange", color: "#E67E22", bg: "#E67E2215", emoji: "🍊" },
  { label: "Sparkling", color: "#7D3C98", bg: "#7D3C9815", emoji: "🍾" },
  { label: "Dessert", color: "#784212", bg: "#78421215", emoji: "🍯" },
]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DL = ["S","M","T","W","T","F","S"]
const AVATARS = ["🍷","🍇","🥂","🍾","🌿","🔥","💎","🦊","🌊","☀️","🌙","🫧","🧊","🪩","💜","🖤"]

const gt = t => TYPES.find(x => x.label === t) || TYPES[0]
const fp = n => n != null ? "$" + Number(n).toFixed(2) : ""
const ti = () => { const t = new Date(); return t.getFullYear() + "-" + String(t.getMonth()+1).padStart(2,"0") + "-" + String(t.getDate()).padStart(2,"0") }
const mid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const fmtDT = iso => { try { return new Date(iso).toLocaleString(undefined, { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }) } catch { return iso } }

const ANTHROPIC_URL = "/api/anthropic"

async function aiWine(text) {
  const r = await fetch(ANTHROPIC_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:'Wine expert. Return ONLY JSON: {"name":"","producer":"","region":"","country":"","type":"Red|White|Rosé|Orange|Sparkling|Dessert","vintage":"","grape":"","price":null}', messages:[{role:"user",content:text}] }) })
  const d = await r.json(); return JSON.parse((d.content||[]).map(c=>c.text||"").join("").replace(/```json|```/g,"").trim())
}
async function aiBulk(text) {
  const r = await fetch(ANTHROPIC_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:'Extract wines. Return ONLY JSON array: [{"name":"","producer":"","type":"Red|White|Rosé|Orange|Sparkling|Dessert","price":null,"quantity":1,"store":"","vintage":""}]', messages:[{role:"user",content:text}] }) })
  const d = await r.json(); return JSON.parse((d.content||[]).map(c=>c.text||"").join("").replace(/```json|```/g,"").trim())
}
async function aiReceipt(b64, mt) {
  const r = await fetch(ANTHROPIC_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:'Extract wines from receipt image. Return ONLY JSON array: [{"name":"","producer":"","type":"Red|White|Rosé|Orange|Sparkling|Dessert","price":null,"quantity":1,"store":"","vintage":""}]', messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mt,data:b64}},{type:"text",text:"Extract wine purchases."}]}] }) })
  if(!r.ok) throw new Error("API "+r.status); const d = await r.json(); if(d.error) throw new Error(d.error.message)
  return JSON.parse((d.content||[]).map(c=>c.text||"").join("").replace(/```json|```/g,"").trim())
}

// ── Small components ──
function Stars({rating, onRate, size}) {
  return <div style={{display:"flex",gap:1}}>{[1,2,3,4,5].map(i=><span key={i} onClick={()=>onRate&&onRate(i)} style={{cursor:onRate?"pointer":"default",fontSize:size||16,color:i<=rating?"#E67E22":"#E5E0DA",userSelect:"none"}}>{"\u2605"}</span>)}</div>
}
function Modal({open, onClose, children}) {
  if(!open) return null
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.3)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn 0.2s"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",borderRadius:"24px 24px 0 0",padding:"8px 20px 28px",width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.12)",animation:"sheetUp 0.3s ease"}}>
      <div style={{width:36,height:4,borderRadius:2,background:"#E5E0DA",margin:"4px auto 16px"}} />
      {children}
    </div>
  </div>
}
function Tabs({tabs, active, onChange}) {
  return <div style={{display:"flex",gap:4,background:"#F5F0EB",borderRadius:14,padding:3}}>
    {tabs.map(t=><button key={t.key} onClick={()=>onChange(t.key)} style={{flex:1,padding:"8px 4px",borderRadius:12,border:"none",fontSize:12,fontFamily:"'Nunito'",fontWeight:active===t.key?800:600,cursor:"pointer",background:active===t.key?"#FFF":"transparent",color:active===t.key?"#2D2420":"#A09890",boxShadow:active===t.key?"0 2px 8px rgba(0,0,0,0.06)":"none",transition:"all 0.2s"}}>{t.label}</button>)}
  </div>
}
function SmartBar({onResult, placeholder, loading, setLoading}) {
  const [text, setText] = useState("")
  const go = async () => { if(!text.trim()||loading) return; setLoading(true); try { onResult(await aiWine(text)); setText("") } catch { onResult(null,"Couldn't parse") } setLoading(false) }
  return <div style={{display:"flex",gap:6}}>
    <input value={text} onChange={e=>setText(e.target.value)} placeholder={placeholder} onKeyDown={e=>e.key==="Enter"&&go()} style={{flex:1,fontSize:14,borderRadius:14,padding:"12px 16px",background:"#F5F0EB",border:"none",outline:"none",fontFamily:"'Nunito'",fontWeight:600,color:"#2D2420",width:"100%"}} />
    <button onClick={go} disabled={loading||!text.trim()} style={{width:44,height:44,borderRadius:14,border:"none",fontSize:18,cursor:"pointer",background:text.trim()?"#C0392B":"#F5F0EB",color:text.trim()?"#FFF":"#C8C0B8",display:"flex",alignItems:"center",justifyContent:"center"}}>{loading?"...":"\u2192"}</button>
  </div>
}
function Av({user, sz, showName}) {
  if(!user) return null; const size=sz||32
  return <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#F5F0EB,#E5E0DA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5,flexShrink:0,boxShadow:"0 2px 6px rgba(0,0,0,0.06)"}}>{user.avatar||"🍷"}</div>
    {showName!==false&&<span style={{fontSize:13,color:"#2D2420",fontFamily:"'Nunito'",fontWeight:700}}>{user.name}</span>}
  </div>
}
function TypePills({value, onChange}) {
  return <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
    {TYPES.map(t=><button key={t.label} onClick={()=>onChange(t.label)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontFamily:"'Nunito'",cursor:"pointer",border:"none",fontWeight:value===t.label?800:600,background:value===t.label?t.color:"#F5F0EB",color:value===t.label?"#FFF":"#8A8078",transition:"all 0.2s"}}>{t.emoji} {t.label}</button>)}
  </div>
}
function BuddyPicker({users, selected, onChange, currentUserId}) {
  const others = Object.values(users).filter(u => u.id !== currentUserId)
  if(others.length === 0) return null
  return <div>
    <label style={fl}>Drank with</label>
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {others.map(u => {
        const sel = selected.includes(u.id)
        return <button key={u.id} onClick={()=>onChange(sel ? selected.filter(id=>id!==u.id) : [...selected, u.id])} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:20,border:sel?"2px solid #C0392B":"2px solid #F0EBE6",background:sel?"#C0392B10":"#FFF",cursor:"pointer",fontSize:12,fontFamily:"'Nunito'",fontWeight:sel?800:600,color:sel?"#C0392B":"#8A8078"}}>
          <span style={{fontSize:14}}>{u.avatar||"🍷"}</span>{u.name}
        </button>
      })}
    </div>
  </div>
}
function AvatarRow({userIds, users, sz}) {
  const size = sz || 24
  return <div style={{display:"flex"}}>
    {userIds.map((uid, j) => {
      const u = users[uid]
      return <div key={uid} style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#F5F0EB,#E5E0DA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5,border:"2px solid #FFF",marginLeft:j>0?-6:0,zIndex:10-j,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>{(u||{}).avatar||"🍷"}</div>
    })}
  </div>
}

const fi = { width:"100%", padding:"10px 14px", borderRadius:12, border:"1px solid #F0EBE6", background:"#F5F0EB", color:"#2D2420", fontSize:13, outline:"none", fontFamily:"'Nunito'", fontWeight:600 }
const fl = { fontSize:9, color:"#B8B0A8", fontFamily:"'Nunito'", fontWeight:800, letterSpacing:1.5, textTransform:"uppercase", display:"block", marginBottom:3 }
const bBtn = { width:"100%", padding:"14px", borderRadius:16, border:"none", fontSize:14, fontFamily:"'Nunito'", fontWeight:900, cursor:"pointer", transition:"all 0.2s" }
const pBtn = { width:40, height:40, borderRadius:14, border:"none", fontSize:17, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#FFF", boxShadow:"0 3px 12px rgba(0,0,0,0.1)" }
const sBtn = { background:"none", border:"none", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", padding:"4px 8px", borderRadius:8, fontFamily:"'Nunito'" }

export default function App() {
  const { user, profile, authLoading, signUp, signIn, signOut } = useAuth()
  const { users, entries, collection, reactions, comments, loading } = useWineData()

  const [tab, setTab] = useState("feed")
  const [curDate, setCurDate] = useState(new Date())
  const [selDay, setSelDay] = useState(null)
  const [showDrink, setShowDrink] = useState(false)
  const [showBuy, setShowBuy] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [showOpen, setShowOpen] = useState(null)
  const [showEdit, setShowEdit] = useState(null)
  const [aiLoad, setAiLoad] = useState(false)
  const [aiErr, setAiErr] = useState("")
  const [parsed, setParsed] = useState([])
  const [proc, setProc] = useState(false)
  const [cmtText, setCmtText] = useState({})
  const [expCmts, setExpCmts] = useState({})
  const [statsR, setStatsR] = useState("month")
  const [feedF, setFeedF] = useState("all")
  const [bulkText, setBulkText] = useState("")
  const [pastImg, setPastImg] = useState(null)
  const [dF, setDF] = useState({name:"",type:"Red",producer:"",region:"",grape:"",vintage:"",notes:"",rating:0,date:"",price:"",drankWith:[]})
  const [pF, setPF] = useState({name:"",type:"Red",producer:"",region:"",price:"",quantity:"1",store:"",vintage:"",date:""})
  const [eF, setEF] = useState(null)
  const [oNotes, setONotes] = useState("")
  const [oRating, setORating] = useState(0)
  const [oQty, setOQty] = useState(1)
  const [oDrankWith, setODrankWith] = useState([])
  const [lbMode, setLbMode] = useState("drinks")

  // Auth form state
  const [authMode, setAuthMode] = useState("signin")
  const [authEmail, setAuthEmail] = useState("")
  const [authPass, setAuthPass] = useState("")
  const [authName, setAuthName] = useState("")
  const [authAvatar, setAuthAvatar] = useState("🍷")
  const [authErr, setAuthErr] = useState("")
  const [authBusy, setAuthBusy] = useState(false)

  const yr = curDate.getFullYear()
  const mo = curDate.getMonth()
  const now = new Date()

  const doAuth = async () => {
    if(authBusy) return
    setAuthErr("")
    if(!authEmail.trim()||!authPass.trim()) { setAuthErr("Email and password required"); return }
    if(authMode==="signup"&&!authName.trim()) { setAuthErr("Name required"); return }
    if(authPass.length<6) { setAuthErr("Password must be at least 6 characters"); return }
    setAuthBusy(true)
    const result = authMode==="signup"
      ? await signUp(authEmail.trim(), authPass, authName.trim(), authAvatar)
      : await signIn(authEmail.trim(), authPass)
    if(result.error) setAuthErr(result.error)
    setAuthBusy(false)
  }

  // Calendar
  const fDay = new Date(yr,mo,1).getDay()
  const dim = new Date(yr,mo+1,0).getDate()
  const cDays = []
  for(let i=0;i<fDay;i++) cDays.push(null)
  for(let i=1;i<=dim;i++) cDays.push(i)
  while(cDays.length%7) cDays.push(null)
  const ds = d => yr+"-"+String(mo+1).padStart(2,"0")+"-"+String(d).padStart(2,"0")
  const dItems = d => d ? entries.filter(e=>e.date===ds(d)) : []

  // Helper: get all participants of a drink entry
  const getParticipants = (entry) => {
    if(entry.kind !== "drink") return [entry.userId]
    return [entry.userId, ...(entry.drankWith || [])].filter((v,i,a) => a.indexOf(v) === i)
  }

  const aiH = setter => (result, err) => {
    if(err){setAiErr(err);return} setAiErr("")
    setter(f=>({...f,name:result.name||f.name,producer:result.producer||f.producer,region:[result.region,result.country].filter(Boolean).join(", ")||f.region,type:TYPES.find(t=>t.label===result.type)?result.type:f.type,grape:result.grape||f.grape,vintage:result.vintage||f.vintage,price:result.price!=null?String(result.price):f.price}))
  }

  const uid = profile?.id

  const subDrink = async () => {
    if(!dF.name.trim()||!uid) return
    const d = dF.date||(selDay?ds(selDay):ti())
    const price = dF.price ? parseFloat(dF.price) : null
    await addEntry({id:mid(),...dF,date:d,kind:"drink",userId:uid,price,drankWith:dF.drankWith,createdAt:new Date().toISOString()})
    setDF({name:"",type:"Red",producer:"",region:"",grape:"",vintage:"",notes:"",rating:0,date:"",price:"",drankWith:[]}); setShowDrink(false)
  }

  const subBuy = async () => {
    if(!pF.name.trim()||!uid) return
    const d=pF.date||ti(); const qty=parseInt(pF.quantity)||1; const price=pF.price?parseFloat(pF.price):null
    await addEntry({id:mid(),...pF,date:d,kind:"purchase",userId:uid,price,quantity:qty,createdAt:new Date().toISOString()})
    await addBottle({id:mid(),name:pF.name,producer:pF.producer,type:pF.type,vintage:pF.vintage,region:pF.region||"",price,store:pF.store,remaining:qty,total:qty,userId:uid,addedAt:new Date().toISOString()})
    setPF({name:"",type:"Red",producer:"",region:"",price:"",quantity:"1",store:"",vintage:"",date:""}); setShowBuy(false)
  }

  const doOpenBottle = async () => {
    if(!showOpen||!uid) return
    const b = showOpen
    const qty = oQty || 1
    await addEntry({id:mid(),name:b.name,producer:b.producer,type:b.type,vintage:b.vintage,region:b.region,grape:"",notes:oNotes,rating:oRating,date:ti(),kind:"drink",userId:uid,price:b.price!=null?(b.price*qty):null,quantity:qty,drankWith:oDrankWith,createdAt:new Date().toISOString(),fromCollection:b.id})
    for(let i=0;i<qty;i++) await decrementBottle(b.id)
    setShowOpen(null); setONotes(""); setORating(0); setOQty(1); setODrankWith([])
  }

  // Edit
  const openEdit = (entry) => {
    setEF({
      id: entry.id, kind: entry.kind, name: entry.name, type: entry.type,
      producer: entry.producer || "", region: entry.region || "", grape: entry.grape || "",
      vintage: entry.vintage || "", notes: entry.notes || "", rating: entry.rating || 0,
      price: entry.price != null ? String(entry.price) : "", quantity: String(entry.quantity || 1),
      store: entry.store || "", date: entry.date, drankWith: entry.drankWith || [],
    })
    setShowEdit(entry)
    setAiErr("")
  }
  const subEdit = async () => {
    if(!eF||!eF.name.trim()) return
    const price = eF.price ? parseFloat(eF.price) : null
    await updateEntry(eF.id, {
      name: eF.name, type: eF.type, producer: eF.producer, region: eF.region,
      grape: eF.grape, vintage: eF.vintage, notes: eF.notes, rating: eF.rating,
      price, quantity: parseInt(eF.quantity) || 1, store: eF.store, date: eF.date,
      drankWith: eF.drankWith,
    })
    setShowEdit(null); setEF(null)
  }

  const handleFile = async (file) => {
    if(!file||!file.type.startsWith("image/")) return
    try {
      const dataUrl = await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})
      const resized = await new Promise((res,rej)=>{
        const img=new Image(); img.onload=()=>{let w=img.width,h=img.height;const m=1024;if(w>m||h>m){const s=m/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s)}const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);const o=c.toDataURL("image/jpeg",0.7);res({base64:o.split(",")[1],mediaType:"image/jpeg",preview:o})}; img.onerror=rej; img.src=dataUrl
      })
      setPastImg(resized); setAiErr("")
    } catch { setAiErr("Failed to process image") }
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData && e.clipboardData.items
    if(!items) return
    for(let i=0;i<items.length;i++) {
      if(items[i].type && items[i].type.startsWith("image/")) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if(file) handleFile(file)
        return
      }
    }
  }

  const enrichWithAI = async (items) => {
    const enriched = []
    for(const it of items) {
      try {
        const ai = await aiWine(it.name + (it.producer ? " " + it.producer : "") + (it.vintage ? " " + it.vintage : ""))
        const qty = it.quantity || 1
        const unitPrice = it.price != null && qty > 1 ? Math.round((it.price / qty) * 100) / 100 : it.price || null
        enriched.push({
          ...it, name: ai.name || it.name, producer: ai.producer || it.producer || "",
          region: [ai.region, ai.country].filter(Boolean).join(", ") || "",
          type: TYPES.find(t => t.label === ai.type) ? ai.type : (it.type || "Red"),
          grape: ai.grape || "", vintage: ai.vintage || it.vintage || "",
          price: unitPrice, totalPrice: it.price || null, quantity: qty, selected: true,
        })
      } catch {
        const qty = it.quantity || 1
        const unitPrice = it.price != null && qty > 1 ? Math.round((it.price / qty) * 100) / 100 : it.price || null
        enriched.push({ ...it, price: unitPrice, totalPrice: it.price || null, quantity: qty, region: "", grape: "", selected: true })
      }
    }
    return enriched
  }

  const parseImg = async () => {
    if(!pastImg||proc) return; setProc(true); setParsed([]); setAiErr("")
    try {
      const items = await aiReceipt(pastImg.base64, pastImg.mediaType)
      if(!Array.isArray(items)||!items.length) { setAiErr("No wines found"); setProc(false); return }
      const enriched = await enrichWithAI(items)
      setParsed(enriched)
    } catch(e) { setAiErr("Error: "+(e.message||"Unknown")) }
    setProc(false)
  }
  const parseTxt = async () => {
    if(!bulkText.trim()||proc) return; setProc(true); setParsed([]); setAiErr("")
    try {
      const items = await aiBulk(bulkText)
      if(!Array.isArray(items)||!items.length) { setAiErr("No wines found"); setProc(false); return }
      const enriched = await enrichWithAI(items)
      setParsed(enriched)
    } catch { setAiErr("Couldn't parse text") }
    setProc(false)
  }
  const doImport = async () => {
    if(!uid) return; const d=ti(); const sel=parsed.filter(i=>i.selected)
    for(const it of sel) {
      const qty = it.quantity || 1; const unitPrice = it.price
      await addEntry({id:mid(),name:it.name||"?",producer:it.producer||"",type:TYPES.find(t=>t.label===it.type)?it.type:"Red",price:unitPrice,quantity:qty,store:it.store||"",vintage:it.vintage||"",region:it.region||"",grape:it.grape||"",notes:"",rating:0,date:d,kind:"purchase",userId:uid,createdAt:new Date().toISOString()})
      await addBottle({id:mid(),name:it.name||"?",producer:it.producer||"",type:TYPES.find(t=>t.label===it.type)?it.type:"Red",vintage:it.vintage||"",region:it.region||"",price:unitPrice,store:it.store||"",remaining:qty,total:qty,userId:uid,addedAt:new Date().toISOString()})
    }
    setParsed([]); setShowImport(false); setBulkText(""); setPastImg(null)
  }

  const doDelete = async id => {
    if(confirm("Delete this entry?")) {
      await deleteEntry(id)
      setShowDetail(null); setShowEdit(null)
    }
  }
  const doToggleLike = id => { if(uid) toggleReaction(id, uid) }
  const doAddCmt = id => {
    if(!uid||!(cmtText[id]||"").trim()) return
    postComment(id, uid, cmtText[id].trim())
    setCmtText(p=>({...p,[id]:""}))
  }

  const gL = id => reactions[id]||[]
  const gCm = id => comments[id]||[]
  const feed = [...entries].filter(e=>feedF==="all"||(feedF==="drinks"&&e.kind==="drink")||(feedF==="purchases"&&e.kind==="purchase")||(feedF==="mine"&&(e.userId===uid||(e.drankWith||[]).includes(uid)))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
  const myColl = collection.filter(b=>b.userId===uid)
  const myActive = myColl.filter(b=>b.remaining>0)
  const myEmpty = myColl.filter(b=>b.remaining<=0)

  // ═══ LOADING ═══
  if(authLoading||loading) return <div style={{minHeight:"100vh",background:"#FAFAF8",display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"#A09890",fontFamily:"'Nunito'",fontSize:16,fontWeight:700}}>Loading...</p></div>

  // ═══ AUTH SCREEN ═══
  if(!user||!profile) return (
    <div style={{minHeight:"100vh",background:"#FAFAF8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{fontSize:48,marginBottom:12}}>🍷</div>
      <h1 style={{fontFamily:"'Nunito'",fontSize:32,fontWeight:900,color:"#2D2420",margin:"0 0 4px"}}>Wine Tracker</h1>
      <p style={{fontFamily:"'Nunito'",fontSize:13,color:"#A09890",fontWeight:600,margin:"0 0 24px",letterSpacing:1}}>TRACK &middot; SHARE &middot; SIP</p>
      <div style={{width:"100%",maxWidth:320}}>
        <Tabs tabs={[{key:"signin",label:"Sign In"},{key:"signup",label:"Sign Up"}]} active={authMode} onChange={setAuthMode} />
        <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
          <div><label style={fl}>Email</label><input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@email.com" type="email" style={fi} /></div>
          <div><label style={fl}>Password</label><input value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Min 6 characters" type="password" onKeyDown={e=>e.key==="Enter"&&authMode==="signin"&&doAuth()} style={fi} /></div>
          {authMode==="signup" && <>
            <div><label style={fl}>Display Name</label><input value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Your name" onKeyDown={e=>e.key==="Enter"&&doAuth()} style={fi} /></div>
            <div><label style={fl}>Avatar</label><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{AVATARS.map(a=>(<button key={a} onClick={()=>setAuthAvatar(a)} style={{width:38,height:38,borderRadius:12,border:authAvatar===a?"3px solid #C0392B":"2px solid #F5F0EB",background:authAvatar===a?"#C0392B10":"#FFF",fontSize:18,cursor:"pointer"}}>{a}</button>))}</div></div>
          </>}
          {authErr&&<p style={{color:"#E74C3C",fontSize:12,fontFamily:"'Nunito'",fontWeight:600,margin:0,textAlign:"center"}}>{authErr}</p>}
          <button onClick={doAuth} disabled={authBusy} style={{...bBtn,background:authBusy?"#F5F0EB":"linear-gradient(135deg,#C0392B,#E74C3C)",color:authBusy?"#C8C0B8":"#FFF",boxShadow:authBusy?"none":"0 4px 20px rgba(192,57,43,0.3)",marginTop:4}}>{authBusy ? "..." : authMode==="signin" ? "Sign In" : "Create Account"} 🚀</button>
        </div>
      </div>
    </div>
  )

  // ═══ MAIN APP ═══
  return (
    <div style={{minHeight:"100vh",background:"#FAFAF8",color:"#2D2420",fontFamily:"'Nunito',sans-serif",maxWidth:520,margin:"0 auto"}}>
      {/* Header */}
      <div style={{padding:"16px 16px 12px",background:"#FFF",position:"sticky",top:0,zIndex:100,borderBottom:"1px solid #F5F0EB"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Av user={profile} sz={34} showName={false} />
            <div>
              <h1 style={{fontFamily:"'Nunito'",fontSize:20,fontWeight:900,color:"#2D2420",margin:0}}>Wine Tracker 🍷</h1>
              <p style={{fontFamily:"'Nunito'",fontSize:10,color:"#B8B0A8",fontWeight:700,margin:0,letterSpacing:1}}>{profile.name} &middot; {Object.keys(users).length} MEMBERS</p>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>{setShowDrink(true);setAiErr("");setDF(f=>({...f,drankWith:[]}))}} style={{...pBtn,background:"linear-gradient(135deg,#C0392B,#E74C3C)"}}>🍷</button>
            <button onClick={()=>{setShowBuy(true);setAiErr("")}} style={{...pBtn,background:"linear-gradient(135deg,#D4AC0D,#F1C40F)"}}>🛒</button>
            <button onClick={()=>{setShowImport(true);setAiErr("");setParsed([]);setBulkText("");setPastImg(null)}} style={{...pBtn,background:"linear-gradient(135deg,#7D3C98,#9B59B6)"}}>📸</button>
            <button onClick={signOut} style={{...pBtn,background:"#F5F0EB",color:"#A09890",boxShadow:"none",fontSize:13}}>↩</button>
          </div>
        </div>
      </div>

      {/* Bottom tabs */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"#FFF",borderTop:"1px solid #F0EBE6",display:"flex",maxWidth:520,margin:"0 auto",padding:"6px 8px 12px"}}>
        {[{k:"feed",i:"🏠",l:"Feed"},{k:"collection",i:"🗄️",l:"Cellar"},{k:"calendar",i:"📅",l:"Calendar"},{k:"stats",i:"📊",l:"Stats"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 0",border:"none",background:"none",cursor:"pointer"}}>
            <span style={{fontSize:20,transform:tab===t.k?"scale(1.2)":"scale(1)",transition:"transform 0.2s"}}>{t.i}</span>
            <span style={{fontSize:9,fontFamily:"'Nunito'",fontWeight:tab===t.k?900:600,color:tab===t.k?"#C0392B":"#B8B0A8"}}>{t.l}</span>
          </button>
        ))}
      </div>

      <div style={{paddingBottom:80}}>

      {/* FEED */}
      {tab==="feed" && <div style={{padding:"12px 16px"}}>
        <Tabs tabs={[{key:"all",label:"All"},{key:"drinks",label:"Drinks"},{key:"purchases",label:"Buys"},{key:"mine",label:"Mine"}]} active={feedF} onChange={setFeedF} />
        <div style={{marginTop:12}}>
          {feed.length===0&&<div style={{textAlign:"center",padding:"48px 20px"}}><p style={{fontFamily:"'Nunito'",fontSize:16,color:"#C8C0B8",fontWeight:700}}>No activity yet ✨</p></div>}
          {feed.map(entry=>{
            const eu=users[entry.userId]; const likes=gL(entry.id); const cmts=gCm(entry.id); const liked=uid&&likes.includes(uid); const exp=expCmts[entry.id]; const isDrink=entry.kind==="drink"; const ts=gt(entry.type); const own=entry.userId===uid
            const participants = getParticipants(entry)
            const participantNames = participants.map(pid => (users[pid]||{}).name || "?")
            return <div key={entry.id} style={{background:"#FFF",borderRadius:20,marginBottom:10,boxShadow:"0 2px 12px rgba(0,0,0,0.04)",overflow:"hidden",border:"1px solid #F5F0EB",borderLeft:isDrink?"4px solid #C0392B":"4px solid #D4AC0D"}}>
              <div style={{padding:"14px 16px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {isDrink && participants.length > 1
                      ? <AvatarRow userIds={participants} users={users} sz={28} />
                      : <Av user={eu} sz={30} showName={false} />
                    }
                    <div>
                      {isDrink && participants.length > 1
                        ? <span style={{fontSize:12,color:"#2D2420",fontFamily:"'Nunito'",fontWeight:700}}>{participantNames.join(", ")}</span>
                        : <span style={{fontSize:12,color:"#2D2420",fontFamily:"'Nunito'",fontWeight:700}}>{(eu||{}).name||"?"}</span>
                      }
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:10,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:600}}>{fmtDT(entry.createdAt)}</span>
                        <span style={{fontSize:9,fontFamily:"'Nunito'",fontWeight:800,padding:"2px 6px",borderRadius:10,background:isDrink?"#C0392B12":"#D4AC0D12",color:isDrink?"#C0392B":"#D4AC0D"}}>{isDrink?"DRANK":"BOUGHT"}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:10,color:ts.color,fontFamily:"'Nunito'",fontWeight:800,background:ts.bg,padding:"4px 10px",borderRadius:20}}>{ts.emoji} {entry.type}</span>
                    {own&&<button onClick={()=>openEdit(entry)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#D5D0CB",padding:"2px 4px",borderRadius:6,lineHeight:1}} title="Edit">✎</button>}
                    {own&&<button onClick={()=>doDelete(entry.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#D5D0CB",padding:"2px 4px",borderRadius:6,lineHeight:1}} title="Delete">✕</button>}
                  </div>
                </div>
                <p style={{margin:"0 0 2px",fontSize:18,fontFamily:"'Nunito'",fontWeight:900,color:"#2D2420"}}>{entry.name}{entry.vintage?<span style={{color:"#B8B0A8",fontWeight:600}}>{" '"+entry.vintage.slice(-2)}</span>:""}</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {entry.producer&&<span style={{fontSize:12,color:"#8A8078",fontFamily:"'Nunito'",fontWeight:600}}>{entry.producer}</span>}
                  {entry.region&&<span style={{fontSize:12,color:"#A09890",fontFamily:"'Nunito'",fontStyle:"italic"}}>{entry.region}</span>}
                </div>
                {isDrink&&entry.rating>0&&<div style={{margin:"6px 0"}}><Stars rating={entry.rating} size={14} /></div>}
                {isDrink&&entry.notes&&<p style={{margin:"6px 0 0",fontSize:13,color:"#6D6259",fontFamily:"'Nunito'",fontWeight:500,lineHeight:1.5}}>{entry.notes}</p>}
                {entry.price!=null&&<div style={{display:"flex",gap:10,marginTop:6,alignItems:"center"}}>
                  <span style={{fontSize:16,color:"#C0392B",fontFamily:"'Nunito'",fontWeight:900}}>{fp(entry.price)}</span>
                  {!isDrink&&entry.quantity>1&&<span style={{fontSize:12,color:"#A09890",fontFamily:"'Nunito'",fontWeight:700}}>x{entry.quantity}</span>}
                  {entry.store&&<span style={{fontSize:11,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:600}}>{entry.store}</span>}
                </div>}
                {!isDrink&&entry.price==null&&entry.store&&<div style={{marginTop:6}}><span style={{fontSize:11,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:600}}>{entry.store}</span></div>}
              </div>
              <div style={{display:"flex",alignItems:"center",padding:"8px 16px 10px",gap:4,borderTop:"1px solid #F5F0EB"}}>
                <button onClick={()=>doToggleLike(entry.id)} style={{...sBtn,color:liked?"#E74C3C":"#C8C0B8"}}>{liked?"\u2665":"\u2661"}{likes.length>0&&<span style={{marginLeft:3,fontSize:12,color:"#A09890",fontWeight:700}}>{likes.length}</span>}</button>
                <button onClick={()=>setExpCmts(p=>({...p,[entry.id]:!p[entry.id]}))} style={{...sBtn,color:"#C8C0B8"}}>💬{cmts.length>0&&<span style={{marginLeft:3,fontSize:12,color:"#A09890",fontWeight:700}}>{cmts.length}</span>}</button>
                {likes.length>0&&<div style={{display:"flex",marginLeft:"auto"}}>{likes.slice(0,4).map((u2,j)=>(<div key={u2} style={{width:22,height:22,borderRadius:"50%",background:"#F5F0EB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,border:"2px solid #FFF",marginLeft:j>0?-6:0,zIndex:5-j}}>{(users[u2]||{}).avatar||"🍷"}</div>))}</div>}
              </div>
              {exp&&<div style={{padding:"0 16px 12px"}}>
                {cmts.map(c=>(<div key={c.id} style={{display:"flex",gap:8,marginBottom:8}}><Av user={users[c.userId]} sz={22} showName={false} /><div><div style={{display:"flex",gap:4,alignItems:"baseline"}}><span style={{fontSize:12,color:"#2D2420",fontFamily:"'Nunito'",fontWeight:700}}>{(users[c.userId]||{}).name||"?"}</span><span style={{fontSize:10,color:"#C8C0B8"}}>{fmtDT(c.createdAt)}</span></div><p style={{margin:"1px 0 0",fontSize:13,color:"#6D6259",fontFamily:"'Nunito'",fontWeight:500}}>{c.text}</p></div></div>))}
                <div style={{display:"flex",gap:6}}>
                  <input value={cmtText[entry.id]||""} onChange={e=>setCmtText(p=>({...p,[entry.id]:e.target.value}))} placeholder="Comment..." onKeyDown={e=>e.key==="Enter"&&doAddCmt(entry.id)} style={{flex:1,fontSize:13,padding:"8px 12px",borderRadius:14,background:"#F5F0EB",border:"none",outline:"none",fontFamily:"'Nunito'",fontWeight:600,color:"#2D2420"}} />
                  <button onClick={()=>doAddCmt(entry.id)} style={{padding:"8px 14px",borderRadius:14,border:"none",fontSize:12,fontFamily:"'Nunito'",fontWeight:800,cursor:"pointer",background:(cmtText[entry.id]||"").trim()?"#C0392B":"#F5F0EB",color:(cmtText[entry.id]||"").trim()?"#FFF":"#C8C0B8"}}>Post</button>
                </div>
              </div>}
            </div>
          })}
        </div>
      </div>}

      {/* COLLECTION */}
      {tab==="collection" && <div style={{padding:"12px 16px"}}>
        <h2 style={{fontFamily:"'Nunito'",fontSize:18,fontWeight:900,color:"#2D2420",margin:"0 0 4px"}}>My Cellar</h2>
        <p style={{fontFamily:"'Nunito'",fontSize:12,color:"#A09890",fontWeight:600,margin:"0 0 14px"}}>{myActive.length} bottle{myActive.length!==1?"s":""} ready</p>
        {myActive.length===0&&myEmpty.length===0&&<div style={{textAlign:"center",padding:"48px 20px"}}><p style={{fontSize:40,marginBottom:8}}>🗄️</p><p style={{fontFamily:"'Nunito'",fontSize:15,color:"#C8C0B8",fontWeight:700}}>Your cellar is empty</p></div>}
        {myActive.map(b=>(<div key={b.id} style={{background:"#FFF",borderRadius:18,padding:"14px 16px",marginBottom:8,boxShadow:"0 2px 10px rgba(0,0,0,0.04)",border:"1px solid #F5F0EB",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:14,background:gt(b.type).bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{gt(b.type).emoji}</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:15,fontFamily:"'Nunito'",fontWeight:800,color:"#2D2420",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.name}{b.vintage?<span style={{color:"#B8B0A8",fontWeight:600}}>{" '"+b.vintage.slice(-2)}</span>:""}</p>
            <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
              {b.producer&&<span style={{fontSize:11,color:"#8A8078",fontFamily:"'Nunito'",fontWeight:600}}>{b.producer}</span>}
              {b.price!=null&&<span style={{fontSize:11,color:"#C0392B",fontFamily:"'Nunito'",fontWeight:700}}>{fp(b.price)}</span>}
              <span style={{fontSize:10,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:700}}>{b.remaining}/{b.total}</span>
            </div>
          </div>
          <button onClick={()=>{setShowOpen(b);setONotes("");setORating(0);setOQty(1);setODrankWith([])}} style={{padding:"10px 16px",borderRadius:14,border:"none",fontSize:12,fontFamily:"'Nunito'",fontWeight:800,cursor:"pointer",background:"linear-gradient(135deg,#C0392B,#E74C3C)",color:"#FFF",whiteSpace:"nowrap"}}>Open 🍷</button>
        </div>))}
        {myEmpty.length>0&&<div>
          <p style={{fontFamily:"'Nunito'",fontSize:12,color:"#C8C0B8",fontWeight:700,margin:"20px 0 8px",letterSpacing:1}}>FINISHED</p>
          {myEmpty.map(b=>(<div key={b.id} style={{background:"#FAFAFA",borderRadius:14,padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10,opacity:0.5}}><span style={{fontSize:16}}>{gt(b.type).emoji}</span><span style={{fontSize:13,fontFamily:"'Nunito'",fontWeight:700,color:"#A09890"}}>{b.name}</span><span style={{fontSize:10,fontFamily:"'Nunito'",fontWeight:600,color:"#C8C0B8",marginLeft:"auto"}}>0/{b.total}</span></div>))}
        </div>}
      </div>}

      {/* CALENDAR */}
      {tab==="calendar" && <div style={{padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button onClick={()=>setCurDate(new Date(yr,mo-1,1))} style={{width:32,height:32,borderRadius:10,border:"1px solid #F0EBE6",background:"#FFF",color:"#8A8078",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{"<"}</button>
          <h2 style={{fontFamily:"'Nunito'",fontSize:17,fontWeight:900,color:"#2D2420",margin:0}}>{MONTHS[mo]} {yr}</h2>
          <button onClick={()=>setCurDate(new Date(yr,mo+1,1))} style={{width:32,height:32,borderRadius:10,border:"1px solid #F0EBE6",background:"#FFF",color:"#8A8078",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{">"}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
          {DL.map((d,i)=>(<div key={i} style={{textAlign:"center",fontSize:10,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:800,padding:"2px 0"}}>{d}</div>))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {cDays.map((day,i)=>{
            const items=dItems(day); const isT=day&&now.getDate()===day&&now.getMonth()===mo&&now.getFullYear()===yr; const isSel=day&&selDay===day
            return <div key={i} onClick={()=>day&&setSelDay(day===selDay?null:day)} style={{aspectRatio:"1",borderRadius:12,background:isSel?"#C0392B10":day?"#FAFAFA":"transparent",border:isT?"2px solid #C0392B":"2px solid transparent",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:day?"pointer":"default",gap:2}}>
              {day&&<span style={{fontSize:12,fontFamily:"'Nunito'",fontWeight:isT||items.length?800:500,color:isT?"#C0392B":items.length?"#2D2420":"#D5D0CB"}}>{day}</span>}
              {day&&items.length>0&&<div style={{display:"flex",gap:2}}>{items.slice(0,3).map((e,j)=>(<div key={j} style={{width:5,height:5,borderRadius:e.kind==="drink"?"50%":2,background:e.kind==="drink"?gt(e.type).color:"#D4AC0D"}} />))}</div>}
            </div>
          })}
        </div>
        {selDay&&dItems(selDay).length>0&&<div style={{marginTop:14}}>
          <p style={{fontFamily:"'Nunito'",fontSize:13,color:"#A09890",fontWeight:700,margin:"0 0 8px"}}>{MONTHS[mo]} {selDay}</p>
          {dItems(selDay).map(e=>{
            const participants = getParticipants(e)
            return <div key={e.id} onClick={()=>setShowDetail(e)} style={{background:"#FFF",borderRadius:14,padding:"10px 14px",marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 6px rgba(0,0,0,0.04)",border:"1px solid #F5F0EB"}}>
              {e.kind==="drink" && participants.length > 1
                ? <AvatarRow userIds={participants} users={users} sz={22} />
                : <Av user={users[e.userId]} sz={24} showName={false} />
              }
              <div style={{flex:1,minWidth:0}}><p style={{margin:0,fontSize:14,fontFamily:"'Nunito'",fontWeight:800,color:"#2D2420",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</p></div>
              <span style={{fontSize:10,color:gt(e.type).color,fontWeight:800}}>{e.kind==="drink"?"🍷":"🛒"}</span>
            </div>
          })}
        </div>}
      </div>}

      {/* STATS */}
      {tab==="stats" && <div style={{padding:"12px 16px"}}>
        <Tabs tabs={[{key:"week",label:"Week"},{key:"month",label:"Month"},{key:"year",label:"Year"},{key:"all",label:"All"}]} active={statsR} onChange={setStatsR} />
        {(()=>{
          const myE=entries.filter(e=>e.userId===uid); const nd=new Date()
          let filtP=myE.filter(e=>e.kind==="purchase")
          let filtD=myE.filter(e=>e.kind==="drink")
          if(statsR==="week"){const w=new Date(nd);w.setDate(w.getDate()-7);filtP=filtP.filter(p=>new Date(p.date+"T12:00:00")>=w);filtD=filtD.filter(p=>new Date(p.date+"T12:00:00")>=w)}
          else if(statsR==="month"){filtP=filtP.filter(p=>{const d=new Date(p.date+"T12:00:00");return d.getMonth()===nd.getMonth()&&d.getFullYear()===nd.getFullYear()});filtD=filtD.filter(p=>{const d=new Date(p.date+"T12:00:00");return d.getMonth()===nd.getMonth()&&d.getFullYear()===nd.getFullYear()})}
          else if(statsR==="year"){filtP=filtP.filter(p=>new Date(p.date+"T12:00:00").getFullYear()===nd.getFullYear());filtD=filtD.filter(p=>new Date(p.date+"T12:00:00").getFullYear()===nd.getFullYear())}
          const purchaseSpent=filtP.reduce((s,p)=>s+(p.price||0)*(p.quantity||1),0)
          const drinkSpent=filtD.reduce((s,p)=>s+(p.price||0),0)
          const btls=filtP.reduce((s,p)=>s+(p.quantity||1),0)
          const drk=filtD.length
          const byT={}; filtP.forEach(p=>{byT[p.type]=(byT[p.type]||0)+(p.quantity||1)}); const mx=Math.max(...Object.values(byT),1)
          return <div style={{marginTop:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div style={{background:"#FFF",borderRadius:16,padding:14,textAlign:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.04)",border:"1px solid #F5F0EB"}}><p style={{fontSize:9,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:800,letterSpacing:1.5,margin:"0 0 4px"}}>PURCHASE $</p><p style={{fontSize:22,color:"#D4AC0D",fontFamily:"'Nunito'",fontWeight:900,margin:0}}>{fp(purchaseSpent)}</p><p style={{fontSize:11,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:600,margin:"2px 0 0"}}>{btls} bottle{btls!==1?"s":""}</p></div>
              <div style={{background:"#FFF",borderRadius:16,padding:14,textAlign:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.04)",border:"1px solid #F5F0EB"}}><p style={{fontSize:9,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:800,letterSpacing:1.5,margin:"0 0 4px"}}>CONSUMED $</p><p style={{fontSize:22,color:"#C0392B",fontFamily:"'Nunito'",fontWeight:900,margin:0}}>{fp(drinkSpent)}</p><p style={{fontSize:11,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:600,margin:"2px 0 0"}}>{drk} wine{drk!==1?"s":""}</p></div>
            </div>
            {Object.keys(byT).length>0&&<div style={{background:"#FFF",borderRadius:16,padding:14,marginBottom:10,border:"1px solid #F5F0EB"}}>
              <p style={{fontSize:10,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:800,letterSpacing:1,margin:"0 0 10px"}}>BY TYPE</p>
              {Object.entries(byT).sort((a,b)=>b[1]-a[1]).map(p=>(<div key={p[0]} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:14}}>{gt(p[0]).emoji}</span><div style={{flex:1,height:8,borderRadius:4,background:"#F5F0EB",overflow:"hidden"}}><div style={{width:(p[1]/mx*100)+"%",height:"100%",borderRadius:4,background:gt(p[0]).color}} /></div><span style={{fontSize:12,color:"#2D2420",fontFamily:"'Nunito'",fontWeight:800,minWidth:20,textAlign:"right"}}>{p[1]}</span></div>))}
            </div>}
            {Object.keys(users).length>1&&<div style={{background:"#FFF",borderRadius:16,padding:14,border:"1px solid #F5F0EB"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{fontSize:10,color:"#B8B0A8",fontFamily:"'Nunito'",fontWeight:800,letterSpacing:1,margin:0}}>LEADERBOARD 🏆</p>
                <div style={{display:"flex",gap:3,background:"#F5F0EB",borderRadius:10,padding:2}}>
                  {[{k:"drinks",l:"🍷 Drinks"},{k:"buys",l:"🛒 Buys"},{k:"spent",l:"💰 Spent"}].map(m=>(
                    <button key={m.k} onClick={()=>setLbMode(m.k)} style={{padding:"4px 8px",borderRadius:8,border:"none",fontSize:10,fontFamily:"'Nunito'",fontWeight:lbMode===m.k?800:600,cursor:"pointer",background:lbMode===m.k?"#FFF":"transparent",color:lbMode===m.k?"#2D2420":"#A09890",boxShadow:lbMode===m.k?"0 1px 4px rgba(0,0,0,0.06)":"none"}}>{m.l}</button>
                  ))}
                </div>
              </div>
              {Object.values(users).map(u=>{
                const uDrinks=entries.filter(e=>e.userId===u.id&&e.kind==="drink").length
                const uBuys=entries.filter(e=>e.userId===u.id&&e.kind==="purchase").reduce((s,p)=>s+(p.quantity||1),0)
                const uDrinkSpent=entries.filter(e=>e.userId===u.id&&e.kind==="drink").reduce((s,e)=>s+(e.price||0),0)
                const uBuySpent=entries.filter(e=>e.userId===u.id&&e.kind==="purchase").reduce((s,e)=>s+(e.price||0)*(e.quantity||1),0)
                const sortVal=lbMode==="drinks"?uDrinks:lbMode==="buys"?uBuys:uDrinkSpent+uBuySpent
                const display=lbMode==="drinks"?("🍷 "+uDrinks):lbMode==="buys"?("🛒 "+uBuys):fp(uDrinkSpent+uBuySpent)
                return{...u,sortVal,display}
              }).sort((a,b)=>b.sortVal-a.sortVal).map((u,i)=>(
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{fontSize:14,fontFamily:"'Nunito'",fontWeight:900,color:i===0?"#C0392B":i===1?"#D4AC0D":"#B8B0A8",width:18}}>{i+1}</span>
                  <Av user={u} sz={26} />
                  <span style={{marginLeft:"auto",fontSize:13,color:"#2D2420",fontFamily:"'Nunito'",fontWeight:800}}>{u.display}</span>
                </div>
              ))}
            </div>}
          </div>
        })()}
      </div>}

      </div>

      {/* ═══ MODALS ═══ */}

      {/* LOG DRINK */}
      <Modal open={showDrink} onClose={()=>setShowDrink(false)}>
        <h3 style={{fontFamily:"'Nunito'",fontSize:20,fontWeight:900,color:"#2D2420",margin:"0 0 12px"}}>Log a Drink 🍷</h3>
        <SmartBar onResult={aiH(setDF)} placeholder="Sassicaia 2018" loading={aiLoad} setLoading={setAiLoad} />
        {aiErr&&<p style={{color:"#E74C3C",fontSize:11,margin:"6px 0",fontFamily:"'Nunito'",fontWeight:600}}>{aiErr}</p>}
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><div><label style={fl}>Name *</label><input value={dF.name} onChange={e=>setDF(f=>({...f,name:e.target.value}))} style={fi} /></div><div><label style={fl}>Vintage</label><input value={dF.vintage} onChange={e=>setDF(f=>({...f,vintage:e.target.value}))} style={fi} /></div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><div><label style={fl}>Producer</label><input value={dF.producer} onChange={e=>setDF(f=>({...f,producer:e.target.value}))} style={fi} /></div><div><label style={fl}>Region</label><input value={dF.region} onChange={e=>setDF(f=>({...f,region:e.target.value}))} style={fi} /></div></div>
          <div><label style={fl}>Type</label><TypePills value={dF.type} onChange={v=>setDF(f=>({...f,type:v}))} /></div>
          <BuddyPicker users={users} selected={dF.drankWith} onChange={v=>setDF(f=>({...f,drankWith:v}))} currentUserId={uid} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,alignItems:"end"}}><div><label style={fl}>Price</label><input type="number" step="0.01" value={dF.price} onChange={e=>setDF(f=>({...f,price:e.target.value}))} placeholder="$" style={fi} /></div><div><label style={fl}>Date</label><input type="date" value={dF.date} onChange={e=>setDF(f=>({...f,date:e.target.value}))} style={fi} /></div><div><label style={fl}>Rating</label><Stars rating={dF.rating} onRate={r=>setDF(f=>({...f,rating:r}))} size={22} /></div></div>
          <textarea placeholder="Tasting notes..." value={dF.notes} onChange={e=>setDF(f=>({...f,notes:e.target.value}))} rows={2} style={{...fi,resize:"vertical"}} />
          <button onClick={subDrink} disabled={!dF.name.trim()} style={{...bBtn,background:dF.name.trim()?"linear-gradient(135deg,#C0392B,#E74C3C)":"#F5F0EB",color:dF.name.trim()?"#FFF":"#C8C0B8"}}>Log Drink 🍷</button>
        </div>
      </Modal>

      {/* LOG PURCHASE */}
      <Modal open={showBuy} onClose={()=>setShowBuy(false)}>
        <h3 style={{fontFamily:"'Nunito'",fontSize:20,fontWeight:900,color:"#2D2420",margin:"0 0 12px"}}>Log a Purchase 🛒</h3>
        <SmartBar onResult={aiH(setPF)} placeholder="Barolo Conterno 2016" loading={aiLoad} setLoading={setAiLoad} />
        {aiErr&&<p style={{color:"#E74C3C",fontSize:11,margin:"6px 0",fontFamily:"'Nunito'",fontWeight:600}}>{aiErr}</p>}
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><div><label style={fl}>Name *</label><input value={pF.name} onChange={e=>setPF(f=>({...f,name:e.target.value}))} style={fi} /></div><div><label style={fl}>Vintage</label><input value={pF.vintage} onChange={e=>setPF(f=>({...f,vintage:e.target.value}))} style={fi} /></div></div>
          <div><label style={fl}>Producer</label><input value={pF.producer} onChange={e=>setPF(f=>({...f,producer:e.target.value}))} style={fi} /></div>
          <div><label style={fl}>Type</label><TypePills value={pF.type} onChange={v=>setPF(f=>({...f,type:v}))} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}><div><label style={fl}>Price</label><input type="number" step="0.01" value={pF.price} onChange={e=>setPF(f=>({...f,price:e.target.value}))} style={fi} /></div><div><label style={fl}>Qty</label><input type="number" min="1" value={pF.quantity} onChange={e=>setPF(f=>({...f,quantity:e.target.value}))} style={fi} /></div><div><label style={fl}>Store</label><input value={pF.store} onChange={e=>setPF(f=>({...f,store:e.target.value}))} style={fi} /></div></div>
          <div><label style={fl}>Date</label><input type="date" value={pF.date} onChange={e=>setPF(f=>({...f,date:e.target.value}))} style={fi} /></div>
          <button onClick={subBuy} disabled={!pF.name.trim()} style={{...bBtn,background:pF.name.trim()?"linear-gradient(135deg,#D4AC0D,#F1C40F)":"#F5F0EB",color:pF.name.trim()?"#FFF":"#C8C0B8"}}>Log Purchase 🛒</button>
        </div>
      </Modal>

      {/* IMPORT */}
      <Modal open={showImport} onClose={()=>setShowImport(false)}>
        <h3 style={{fontFamily:"'Nunito'",fontSize:20,fontWeight:900,color:"#2D2420",margin:"0 0 12px"}}>Import Purchases 📸</h3>
        <div onPaste={handlePaste} tabIndex={0} style={{width:"100%",padding:pastImg?"8px":"16px",borderRadius:16,border:pastImg?"2px solid #C0392B30":"2px dashed #E5E0DA",background:"#F5F0EB",textAlign:"center",marginBottom:10,outline:"none",cursor:"pointer"}}>
          {pastImg ? <div style={{position:"relative"}}><img src={pastImg.preview} alt="Receipt" style={{width:"100%",borderRadius:12,maxHeight:180,objectFit:"contain"}} /><button onClick={ev=>{ev.stopPropagation();setPastImg(null);setParsed([])}} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",border:"none",background:"rgba(0,0,0,0.5)",color:"#FFF",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>x</button></div>
          : <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center",padding:"4px 0"}}>
              <span style={{color:"#A09890",fontFamily:"'Nunito'",fontSize:13,fontWeight:600}}>Paste a screenshot or upload a photo</span>
              <div style={{display:"flex",gap:8}}>
                <label style={{padding:"10px 18px",borderRadius:14,border:"none",fontSize:12,fontFamily:"'Nunito'",fontWeight:800,cursor:"pointer",background:"linear-gradient(135deg,#7D3C98,#9B59B6)",color:"#FFF",display:"flex",alignItems:"center",gap:6}}>
                  📷 Take Photo
                  <input type="file" accept="image/*" capture="environment" onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);e.target.value=""}} style={{display:"none"}} />
                </label>
                <label style={{padding:"10px 18px",borderRadius:14,border:"none",fontSize:12,fontFamily:"'Nunito'",fontWeight:800,cursor:"pointer",background:"linear-gradient(135deg,#E67E22,#F39C12)",color:"#FFF",display:"flex",alignItems:"center",gap:6}}>
                  🖼️ Photo Library
                  <input type="file" accept="image/*" onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);e.target.value=""}} style={{display:"none"}} />
                </label>
              </div>
            </div>}
        </div>
        {pastImg&&parsed.length===0&&<button onClick={parseImg} disabled={proc} style={{...bBtn,marginBottom:10,background:proc?"#F5F0EB":"linear-gradient(135deg,#7D3C98,#9B59B6)",color:proc?"#C8C0B8":"#FFF"}}>{proc?"Analyzing & enriching...":"Parse Image"}</button>}
        {!pastImg&&<div>
          <div style={{display:"flex",alignItems:"center",gap:8,margin:"2px 0 10px"}}><div style={{flex:1,height:1,background:"#E5E0DA"}} /><span style={{fontSize:11,color:"#C8C0B8",fontFamily:"'Nunito'",fontWeight:700}}>or type/paste text</span><div style={{flex:1,height:1,background:"#E5E0DA"}} /></div>
          <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} rows={3} placeholder={"2x Opus One 2019 - $350\nMargaux 2005 - $890"} style={{...fi,resize:"vertical",fontSize:13,lineHeight:1.5,marginBottom:8}} />
          <button onClick={parseTxt} disabled={proc||!bulkText.trim()} style={{...bBtn,background:bulkText.trim()&&!proc?"linear-gradient(135deg,#7D3C98,#9B59B6)":"#F5F0EB",color:bulkText.trim()&&!proc?"#FFF":"#C8C0B8"}}>{proc?"Analyzing & enriching...":"Parse Text"}</button>
        </div>}
        {aiErr&&<p style={{color:"#E74C3C",fontSize:11,margin:"8px 0",fontFamily:"'Nunito'",fontWeight:600}}>{aiErr}</p>}
        {parsed.length>0&&<div style={{marginTop:10}}>
          <p style={{fontSize:12,color:"#A09890",fontFamily:"'Nunito'",fontWeight:700,marginBottom:6}}>{parsed.length} items found</p>
          {parsed.map((it,idx)=>(<div key={idx} onClick={()=>{const n=[...parsed];n[idx]={...n[idx],selected:!n[idx].selected};setParsed(n)}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:it.selected?"#FFF":"#FAFAFA",borderRadius:12,marginBottom:4,cursor:"pointer",opacity:it.selected?1:0.4,border:"1px solid "+(it.selected?"#F5F0EB":"transparent")}}>
            <div style={{width:20,height:20,borderRadius:6,border:"2px solid "+(it.selected?"#C0392B":"#D5D0CB"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#C0392B",background:it.selected?"#C0392B10":"transparent",flexShrink:0}}>{it.selected?"\u2713":""}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:0,fontSize:14,color:"#2D2420",fontFamily:"'Nunito'",fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}{it.vintage?<span style={{color:"#B8B0A8",fontWeight:600}}>{" '"+it.vintage.slice(-2)}</span>:""}</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {it.producer&&<span style={{fontSize:11,color:"#8A8078",fontFamily:"'Nunito'",fontWeight:600}}>{it.producer}</span>}
                {it.region&&<span style={{fontSize:11,color:"#A09890",fontFamily:"'Nunito'",fontStyle:"italic"}}>{it.region}</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              {it.quantity>1&&<span style={{fontSize:11,color:"#A09890",fontFamily:"'Nunito'",fontWeight:700,display:"block"}}>x{it.quantity}</span>}
              {it.price!=null&&<span style={{fontSize:13,color:"#C0392B",fontFamily:"'Nunito'",fontWeight:800}}>{fp(it.price)}{it.quantity>1?" ea":""}</span>}
            </div>
          </div>))}
          <button onClick={doImport} disabled={!parsed.some(i=>i.selected)} style={{...bBtn,marginTop:8,background:"linear-gradient(135deg,#C0392B,#E74C3C)",color:"#FFF"}}>Import {parsed.filter(i=>i.selected).length} to Cellar 🗄️</button>
        </div>}
      </Modal>

      {/* OPEN BOTTLE */}
      <Modal open={!!showOpen} onClose={()=>setShowOpen(null)}>
        {showOpen&&<div style={{textAlign:"center"}}>
          <span style={{fontSize:48}}>{gt(showOpen.type).emoji}</span>
          <h3 style={{fontFamily:"'Nunito'",fontSize:20,fontWeight:900,color:"#2D2420",margin:"8px 0 2px"}}>{showOpen.name}</h3>
          {showOpen.producer&&<p style={{fontSize:13,color:"#8A8078",fontFamily:"'Nunito'",fontWeight:600,margin:0}}>{showOpen.producer}</p>}
          {showOpen.price!=null&&<p style={{fontSize:14,color:"#C0392B",fontFamily:"'Nunito'",fontWeight:800,margin:"4px 0 0"}}>{fp(showOpen.price)} /bottle</p>}
          <p style={{fontSize:11,color:"#C8C0B8",fontFamily:"'Nunito'",fontWeight:700,margin:"6px 0 12px"}}>{showOpen.remaining} of {showOpen.total} remaining</p>
          {showOpen.remaining>1&&<div style={{marginBottom:12}}>
            <div style={{textAlign:"left"}}><label style={fl}>How many to open?</label></div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
              <button onClick={()=>setOQty(Math.max(1,oQty-1))} style={{width:36,height:36,borderRadius:12,border:"1px solid #F0EBE6",background:"#FFF",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#8A8078"}}>−</button>
              <span style={{fontSize:24,fontFamily:"'Nunito'",fontWeight:900,color:"#2D2420",minWidth:32,textAlign:"center"}}>{oQty}</span>
              <button onClick={()=>setOQty(Math.min(showOpen.remaining,oQty+1))} style={{width:36,height:36,borderRadius:12,border:"1px solid #F0EBE6",background:"#FFF",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#8A8078"}}>+</button>
            </div>
          </div>}
          <div style={{textAlign:"left"}}><BuddyPicker users={users} selected={oDrankWith} onChange={setODrankWith} currentUserId={uid} /></div>
          <div style={{textAlign:"left",marginTop:8}}><label style={fl}>Rating</label></div>
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><Stars rating={oRating} onRate={setORating} size={28} /></div>
          <textarea placeholder="Quick tasting notes..." value={oNotes} onChange={e=>setONotes(e.target.value)} rows={2} style={{...fi,resize:"vertical",marginBottom:10}} />
          <button onClick={doOpenBottle} style={{...bBtn,background:"linear-gradient(135deg,#C0392B,#E74C3C)",color:"#FFF"}}>Open {oQty>1?oQty+" Bottles":"Bottle"} 🍷</button>
        </div>}
      </Modal>

      {/* EDIT ENTRY */}
      <Modal open={!!showEdit} onClose={()=>{setShowEdit(null);setEF(null)}}>
        {eF&&<div>
          <h3 style={{fontFamily:"'Nunito'",fontSize:20,fontWeight:900,color:"#2D2420",margin:"0 0 12px"}}>Edit {eF.kind==="drink"?"Drink 🍷":"Purchase 🛒"}</h3>
          {eF.kind==="drink" && <SmartBar onResult={aiH(setEF)} placeholder="AI lookup..." loading={aiLoad} setLoading={setAiLoad} />}
          {aiErr&&<p style={{color:"#E74C3C",fontSize:11,margin:"6px 0",fontFamily:"'Nunito'",fontWeight:600}}>{aiErr}</p>}
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><div><label style={fl}>Name *</label><input value={eF.name} onChange={e=>setEF(f=>({...f,name:e.target.value}))} style={fi} /></div><div><label style={fl}>Vintage</label><input value={eF.vintage} onChange={e=>setEF(f=>({...f,vintage:e.target.value}))} style={fi} /></div></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><div><label style={fl}>Producer</label><input value={eF.producer} onChange={e=>setEF(f=>({...f,producer:e.target.value}))} style={fi} /></div><div><label style={fl}>Region</label><input value={eF.region} onChange={e=>setEF(f=>({...f,region:e.target.value}))} style={fi} /></div></div>
            <div><label style={fl}>Type</label><TypePills value={eF.type} onChange={v=>setEF(f=>({...f,type:v}))} /></div>
            {eF.kind==="drink"&&<BuddyPicker users={users} selected={eF.drankWith} onChange={v=>setEF(f=>({...f,drankWith:v}))} currentUserId={uid} />}
            {eF.kind==="drink"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,alignItems:"end"}}><div><label style={fl}>Price</label><input type="number" step="0.01" value={eF.price} onChange={e=>setEF(f=>({...f,price:e.target.value}))} style={fi} /></div><div><label style={fl}>Date</label><input type="date" value={eF.date} onChange={e=>setEF(f=>({...f,date:e.target.value}))} style={fi} /></div><div><label style={fl}>Rating</label><Stars rating={eF.rating} onRate={r=>setEF(f=>({...f,rating:r}))} size={22} /></div></div>}
            {eF.kind==="drink"&&<textarea placeholder="Tasting notes..." value={eF.notes} onChange={e=>setEF(f=>({...f,notes:e.target.value}))} rows={2} style={{...fi,resize:"vertical"}} />}
            {eF.kind==="purchase"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}><div><label style={fl}>Price</label><input type="number" step="0.01" value={eF.price} onChange={e=>setEF(f=>({...f,price:e.target.value}))} style={fi} /></div><div><label style={fl}>Qty</label><input type="number" min="1" value={eF.quantity} onChange={e=>setEF(f=>({...f,quantity:e.target.value}))} style={fi} /></div><div><label style={fl}>Store</label><input value={eF.store} onChange={e=>setEF(f=>({...f,store:e.target.value}))} style={fi} /></div></div>}
            {eF.kind==="purchase"&&<div><label style={fl}>Date</label><input type="date" value={eF.date} onChange={e=>setEF(f=>({...f,date:e.target.value}))} style={fi} /></div>}
            <div style={{display:"flex",gap:6}}>
              <button onClick={subEdit} disabled={!eF.name.trim()} style={{...bBtn,flex:1,background:eF.name.trim()?"linear-gradient(135deg,#C0392B,#E74C3C)":"#F5F0EB",color:eF.name.trim()?"#FFF":"#C8C0B8"}}>Save Changes</button>
              <button onClick={()=>doDelete(eF.id)} style={{...bBtn,flex:0,padding:"14px 20px",background:"#FFF",color:"#C0392B",border:"2px solid #C0392B30"}}>🗑</button>
            </div>
          </div>
        </div>}
      </Modal>

      {/* DETAIL */}
      <Modal open={!!showDetail} onClose={()=>setShowDetail(null)}>
        {showDetail&&(()=>{
          const eu=users[showDetail.userId]; const isDrink=showDetail.kind==="drink"; const own=showDetail.userId===uid
          const participants = getParticipants(showDetail)
          return <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              {isDrink && participants.length > 1
                ? <div style={{display:"flex",alignItems:"center",gap:8}}><AvatarRow userIds={participants} users={users} sz={26} /><span style={{fontSize:12,fontFamily:"'Nunito'",fontWeight:700,color:"#2D2420"}}>{participants.map(pid=>(users[pid]||{}).name||"?").join(", ")}</span></div>
                : <Av user={eu} sz={26} />
              }
              <span style={{fontSize:11,color:gt(showDetail.type).color,fontFamily:"'Nunito'",fontWeight:800,background:gt(showDetail.type).bg,padding:"4px 10px",borderRadius:20}}>{gt(showDetail.type).emoji} {showDetail.type}</span>
            </div>
            <h3 style={{fontFamily:"'Nunito'",fontSize:20,fontWeight:900,color:"#2D2420",margin:"4px 0"}}>{showDetail.name}</h3>
            {showDetail.producer&&<p style={{margin:"4px 0",fontSize:13,color:"#8A8078",fontFamily:"'Nunito'",fontWeight:600}}>{showDetail.producer}</p>}
            {isDrink&&showDetail.rating>0&&<div style={{marginBottom:6}}><Stars rating={showDetail.rating} size={16} /></div>}
            {isDrink&&showDetail.notes&&<p style={{fontSize:13,color:"#6D6259",fontFamily:"'Nunito'",fontWeight:500,lineHeight:1.5,margin:"0 0 8px"}}>{showDetail.notes}</p>}
            {showDetail.price!=null&&<p style={{fontSize:18,color:"#C0392B",fontFamily:"'Nunito'",fontWeight:900,margin:"6px 0"}}>{fp(showDetail.price)}</p>}
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <button onClick={()=>setShowDetail(null)} style={{...bBtn,flex:1,background:"#F5F0EB",color:"#8A8078"}}>Close</button>
              {own&&<button onClick={()=>{setShowDetail(null);openEdit(showDetail)}} style={{...bBtn,flex:1,background:"#FFF",color:"#C0392B",border:"2px solid #C0392B30"}}>Edit</button>}
            </div>
          </div>
        })()}
      </Modal>
    </div>
  )
}
