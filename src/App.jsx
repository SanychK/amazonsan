import React, {useEffect, useMemo, useState} from 'react'
import {Search, Heart, UserRound, Menu, X, SlidersHorizontal, Plus, Pencil, Trash2, Upload, Download, LogOut, Settings, Sparkles, Package, ChevronRight, ExternalLink, ImagePlus, ShieldCheck, LayoutGrid, Clock3, Star, Mail, Lock, Eye, EyeOff, Check, Info} from 'lucide-react'
import {categories, demoProducts} from './data'
import {supabase, configured} from './supabase'

const money = n => n == null || n === '' ? '—' : new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(Number(n))
const emptyForm = {title:'',category:categories[0].name,subcategory:'',price_uah:'',price_usd:'',description:'',image_url:'',amazon_url:'',sku:'',specs:'',is_new:true,is_popular:false,status:'published'}
function App(){
 const [products,setProducts]=useState(demoProducts),[session,setSession]=useState(null),[profile,setProfile]=useState(null)
 const [favorites,setFavorites]=useState([]),[query,setQuery]=useState(''),[category,setCategory]=useState('Усі категорії'),[subcategory,setSubcategory]=useState('Усі підкатегорії')
 const [sort,setSort]=useState('new'),[onlyFav,setOnlyFav]=useState(false),[view,setView]=useState('catalog'),[selected,setSelected]=useState(null)
 const [authOpen,setAuthOpen]=useState(false),[authMode,setAuthMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authError,setAuthError]=useState('')
 const [adminOpen,setAdminOpen]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(emptyForm),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false)
 const [sidebar,setSidebar]=useState(false),[showPassword,setShowPassword]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[siteIcon,setSiteIcon]=useState('/favicon.svg')
 const isAdmin=Boolean(profile?.is_admin)
 const notify = s => {setNotice(s); window.setTimeout(()=>setNotice(''),4200)}
 useEffect(()=>{
   if(!configured) return
   supabase.auth.getSession().then(({data})=>setSession(data.session))
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
   return ()=>subscription.unsubscribe()
 },[])
 useEffect(()=>{
   if(!configured) return
   if(!session){setProfile(null);setFavorites([]);return}
   Promise.all([
     supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle(),
     supabase.from('favorites').select('product_id').eq('user_id',session.user.id),
     supabase.from('products').select('*').eq('status','published').order('created_at',{ascending:false})
   ]).then(([p,f,pr])=>{
     setProfile(p.data||null);setFavorites((f.data||[]).map(x=>x.product_id))
     if(pr.data) setProducts(pr.data.length?pr.data:[])
   })
 },[session])
 const reloadProducts=async()=>{
   if(!configured)return
   const {data,error}=await supabase.from('products').select('*').order('created_at',{ascending:false})
   if(error)notify(error.message); else setProducts(data||[])
 }
 const visible=useMemo(()=>{
   let arr=products.filter(p=>p.status==='published'||isAdmin)
   if(category!=='Усі категорії')arr=arr.filter(p=>p.category===category)
   if(subcategory!=='Усі підкатегорії')arr=arr.filter(p=>p.subcategory===subcategory)
   if(onlyFav)arr=arr.filter(p=>favorites.includes(p.id))
   if(query.trim()){const q=query.toLowerCase();arr=arr.filter(p=>[p.title,p.description,p.category,p.subcategory,p.sku].join(' ').toLowerCase().includes(q))}
   if(sort==='priceUp')arr.sort((a,b)=>(a.price_uah||0)-(b.price_uah||0))
   if(sort==='priceDown')arr.sort((a,b)=>(b.price_uah||0)-(a.price_uah||0))
   if(sort==='name')arr.sort((a,b)=>a.title.localeCompare(b.title,'uk'))
   if(sort==='new')arr.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))
   return arr
 },[products,category,subcategory,onlyFav,favorites,query,sort,isAdmin])
 const toggleFavorite=async id=>{
   if(!session){setAuthOpen(true);notify('Увійди, щоб зберігати товари в обраному.');return}
   if(favorites.includes(id)){
     setFavorites(favorites.filter(x=>x!==id))
     if(configured)await supabase.from('favorites').delete().eq('user_id',session.user.id).eq('product_id',id)
   }else{
     setFavorites([...favorites,id])
     if(configured)await supabase.from('favorites').insert({user_id:session.user.id,product_id:id})
   }
 }
 const saveProduct=async()=>{
   if(!form.title.trim()){notify('Вкажи назву товару.');return}
   if(!configured){notify('Для збереження товарів налаштуй Supabase за інструкцією в README.');return}
   setLoading(true)
   const payload={...form,price_uah:form.price_uah===''?null:Number(form.price_uah),price_usd:form.price_usd===''?null:Number(form.price_usd),specs:form.specs?form.specs.split('\\n').filter(Boolean):[],created_by:session.user.id}
   let result
   if(editing) result=await supabase.from('products').update(payload).eq('id',editing)
   else result=await supabase.from('products').insert(payload)
   setLoading(false)
   if(result.error){notify(result.error.message);return}
   setAdminOpen(false);setEditing(null);setForm(emptyForm);await reloadProducts();notify('Товар збережено.')
 }
 const startEdit=p=>{setEditing(p.id);setForm({...emptyForm,...p,price_uah:p.price_uah??'',price_usd:p.price_usd??'',specs:Array.isArray(p.specs)?p.specs.join('\\n'):p.specs||''});setAdminOpen(true)}
 const deleteProduct=async id=>{
   if(!confirm('Видалити цей товар?'))return
   const {error}=await supabase.from('products').delete().eq('id',id)
   if(error)notify(error.message);else{await reloadProducts();notify('Товар видалено.')}
 }
 const signIn=async()=>{
   setAuthError('')
   if(!configured){setAuthError('Авторизація стане доступною після підключення Supabase.');return}
   const {error}=authMode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password})
   if(error)setAuthError(error.message);else{setAuthOpen(false);setPassword('');notify(authMode==='signup'?'Перевір пошту для підтвердження реєстрації.':'Вхід виконано.')}
 }
 const googleLogin=async()=>{if(!configured){setAuthError('Спочатку підключи Supabase.');return}const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}});if(error)setAuthError(error.message)}
 const signOut=async()=>{if(configured)await supabase.auth.signOut();setView('catalog');notify('Ти вийшов з акаунта.')}
 const uploadImage=async file=>{
   if(!configured||!session){notify('Для завантаження фото потрібне підключення Supabase та вхід.');return}
   const ext=file.name.split('.').pop(),path=`${session.user.id}/${Date.now()}.${ext}`
   const {error}=await supabase.storage.from('product-images').upload(path,file,{upsert:true})
   if(error){notify(error.message);return}
   const {data}=supabase.storage.from('product-images').getPublicUrl(path)
   setForm({...form,image_url:data.publicUrl});notify('Фото завантажено.')
 }
 const exportJSON=()=>{const blob=new Blob([JSON.stringify(products,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='amazonsan-products.json';a.click();URL.revokeObjectURL(a.href)}
 const importJSON=async file=>{
   if(!configured||!isAdmin){notify('Імпорт доступний адміністратору після підключення бази.');return}
   try{const rows=JSON.parse(await file.text());if(!Array.isArray(rows))throw Error('Очікується JSON-масив товарів');const clean=rows.map(({id,created_at,...p})=>({...p,created_by:session.user.id}));const {error}=await supabase.from('products').insert(clean);if(error)throw error;await reloadProducts();notify('Імпорт завершено.')}catch(e){notify('Помилка імпорту: '+e.message)}
 }
 const setField=(k,v)=>setForm(f=>({...f,[k]:v}))
 const currentSubs=categories.find(c=>c.name===category)?.subs||[]
 const adminForm=<div className="modal wide"><div className="modal-head"><div><span className="eyebrow">КЕРУВАННЯ КАТАЛОГОМ</span><h2>{editing?'Редагувати товар':'Додати товар'}</h2></div><button className="icon-btn" onClick={()=>setAdminOpen(false)}><X/></button></div>
   <div className="form-grid">
    <label className="full">Назва товару<input value={form.title} onChange={e=>setField('title',e.target.value)} placeholder="Наприклад, бездротові навушники"/></label>
    <label>Категорія<select value={form.category} onChange={e=>{setField('category',e.target.value);setField('subcategory','')}}>{categories.map(c=><option>{c.name}</option>)}</select></label>
    <label>Підкатегорія<select value={form.subcategory} onChange={e=>setField('subcategory',e.target.value)}><option value="">Оберіть підкатегорію</option>{(categories.find(c=>c.name===form.category)?.subs||[]).map(s=><option>{s}</option>)}</select></label>
    <label>Ціна, грн<input type="number" min="0" value={form.price_uah} onChange={e=>setField('price_uah',e.target.value)}/></label>
    <label>Ціна Amazon, USD<input type="number" min="0" step="0.01" value={form.price_usd} onChange={e=>setField('price_usd',e.target.value)}/></label>
    <label className="full">URL зображення<input value={form.image_url||''} onChange={e=>setField('image_url',e.target.value)} placeholder="https://..."/></label>
    <label className="full upload-label"><ImagePlus size={17}/> Завантажити фото з пристрою<input type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&uploadImage(e.target.files[0])}/></label>
    <label className="full">Посилання на товар Amazon<input value={form.amazon_url||''} onChange={e=>setField('amazon_url',e.target.value)} placeholder="https://www.amazon.com/..."/></label>
    <label className="full">Опис<textarea rows="4" value={form.description||''} onChange={e=>setField('description',e.target.value)} placeholder="Опис українською мовою"/></label>
    <label className="full">Характеристики (кожна з нового рядка)<textarea rows="3" value={form.specs||''} onChange={e=>setField('specs',e.target.value)} placeholder="Колір: чорний&#10;Підключення: Bluetooth"/></label>
    <label>Артикул / SKU<input value={form.sku||''} onChange={e=>setField('sku',e.target.value)}/></label>
    <label>Статус<select value={form.status||'published'} onChange={e=>setField('status',e.target.value)}><option value="published">Опубліковано</option><option value="draft">Чернетка</option></select></label>
    <div className="checks full"><label><input type="checkbox" checked={!!form.is_new} onChange={e=>setField('is_new',e.target.checked)}/> Новинка</label><label><input type="checkbox" checked={!!form.is_popular} onChange={e=>setField('is_popular',e.target.checked)}/> Популярний товар</label></div>
   </div><div className="modal-actions"><button className="btn secondary" onClick={()=>setAdminOpen(false)}>Скасувати</button><button className="btn primary" onClick={saveProduct} disabled={loading}>{loading?'Збереження…':'Зберегти товар'}</button></div></div>
 return <div className="app-shell">
  <header className="topbar"><div className="top-inner"><button className="mobile-menu icon-btn" onClick={()=>setSidebar(!sidebar)}><Menu/></button><button className="brand" onClick={()=>{setView('catalog');setSelected(null);setCategory('Усі категорії')}}><span className="brand-mark">a<span>•</span></span><span>amazonsan<small>КАТАЛОГ ТОВАРІВ</small></span></button>
   <div className="searchbox"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Знайти товар, категорію або бренд..."/><kbd>⌕</kbd></div>
   <div className="top-actions"><button className={`icon-btn ${onlyFav?'active':''}`} onClick={()=>{setOnlyFav(!onlyFav);setView('catalog')}} title="Обране"><Heart/><span className="count">{favorites.length}</span></button><button className="account-btn" onClick={()=>session?setView('account'):setAuthOpen(true)}><UserRound size={18}/><span>{session?'Мій акаунт':'Увійти'}</span></button></div>
  </div></header>
  <div className="layout">
   <aside className={`sidebar ${sidebar?'open':''}`}><div className="side-head"><span>КАТАЛОГ</span><button className="mobile-menu icon-btn" onClick={()=>setSidebar(false)}><X/></button></div>
    <button className={`cat-link ${category==='Усі категорії'?'selected':''}`} onClick={()=>{setCategory('Усі категорії');setSubcategory('Усі підкатегорії');setSidebar(false)}}><LayoutGrid size={17}/> Усі категорії</button>
    {categories.map(c=><div key={c.name}><button className={`cat-link ${category===c.name?'selected':''}`} onClick={()=>{setCategory(c.name);setSubcategory('Усі підкатегорії');setView('catalog');setSidebar(false)}}><span className="cat-icon">{c.icon}</span>{c.name}<ChevronRight size={14} className="cat-arrow"/></button>{category===c.name&&<div className="subcats">{c.subs.map(s=><button className={subcategory===s?'sub-active':''} onClick={()=>setSubcategory(s)}>{s}</button>)}</div>}</div>)}
    <div className="sidebar-bottom"><div className="mini-note"><Sparkles size={16}/><b>Знаходь цікаве</b><p>Каталог корисних товарів з Amazon в одному місці.</p></div><span>© 2026 amazonsan</span></div>
   </aside>
   <main className="main">
    {view==='catalog'&&<>
<section className="hero hero-banner">
  <img
    className="hero-background"
    src="/Baner.webp"
    alt="amazonsan — сучасний каталог товарів за вигідними цінами"
  />
  <div className="hero-overlay">
    <span className="eyebrow">✦ AMAZONSAN · ВИБІР РОЗУМНИХ ПОКУПОК</span>
    <h1>Технології та товари<br/>
      <em>за вигідними цінами!</em>
    </h1>
    <p>Відкривай новинки, порівнюй характеристики та знаходь цікаві пропозиції.</p>
    <div className="hero-benefits">
      <span>✦ Вигідні ціни</span>
      <span>✦ Цікаві новинки</span>
      <span>✦ Великий вибір</span>
    </div>
    <button className="btn light" onClick={() => {
      setCategory('Усі категорії');
      setOnlyFav(false);
      setView('catalog');
    }}>
      Переглянути каталог <ChevronRight size={17}/>
    </button>
  </div>
</section>
    </>}
    {view==='account'&&<section className="account-page"><span className="eyebrow">ОСОБИСТИЙ ПРОСТІР</span><h1>Мій кабінет</h1><div className="account-card"><div className="avatar">{session?.user?.email?.[0]?.toUpperCase()||'A'}</div><div><h3>{session?.user?.email}</h3><p>{isAdmin?'Адміністратор':'Користувач amazonsan'}</p></div></div><div className="account-actions"><button className="btn secondary" onClick={()=>{setOnlyFav(true);setView('catalog')}}><Heart/> Моє обране ({favorites.length})</button>{isAdmin&&<button className="btn secondary" onClick={()=>setSettingsOpen(true)}><Settings/> Налаштування сайту</button>}<button className="btn secondary" onClick={signOut}><LogOut/> Вийти</button></div>{!configured&&<p className="setup-warning">Демонстраційний режим: підключи Supabase, щоб зберігати профіль та обране між пристроями.</p>}</section>}
    {isAdmin&&<div className="admin-bar"><div><ShieldCheck size={17}/> Панель адміністратора</div><div className="admin-tools"><button className="btn primary small" onClick={()=>{setEditing(null);setForm(emptyForm);setAdminOpen(true)}}><Plus size={16}/> Додати товар</button><button className="btn secondary small" onClick={exportJSON}><Download size={16}/> Експорт JSON</button><label className="btn secondary small file-btn"><Upload size={16}/> Імпорт JSON<input type="file" accept=".json,application/json" onChange={e=>e.target.files?.[0]&&importJSON(e.target.files[0])}/></label></div></div>}
    <footer><div className="footer-brand">amazonsan<span>•</span></div><p>Каталог товарів для зручного пошуку та вибору.</p><div className="footer-links"><button onClick={()=>notify('Зв’язок: додай свою контактну пошту в налаштуваннях проєкту.')}>Контакти</button><button onClick={()=>notify('Політика конфіденційності: додай власний документ перед публічним запуском.')}>Конфіденційність</button><button onClick={()=>notify('amazonsan — незалежний каталог, не пов’язаний з Amazon.')}>Про проєкт</button></div><small>amazonsan не є офіційним сайтом Amazon і не афілійований з Amazon.</small></footer>
   </main>
  </div>
  {selected&&<div className="overlay" onClick={()=>setSelected(null)}><div className="modal detail-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><span className="eyebrow">ДЕТАЛІ ТОВАРУ</span><button className="icon-btn" onClick={()=>setSelected(null)}><X/></button></div><div className="detail-grid"><div className="detail-image">{selected.image_url?<img src={selected.image_url} alt={selected.title}/>:<Package/>}</div><div><span className="product-category">{selected.category} · {selected.subcategory}</span><h2>{selected.title}</h2><p>{selected.description}</p><div className="detail-price">{money(selected.price_uah)}{selected.price_usd&&<small>${selected.price_usd} на Amazon</small>}</div>{Array.isArray(selected.specs)&&selected.specs.length>0&&<ul className="spec-list">{selected.specs.map(s=><li>{s}</li>)}</ul>}<div className="detail-actions"><button className="btn secondary" onClick={()=>toggleFavorite(selected.id)}><Heart size={17}/> Зберегти</button>{selected.amazon_url&&<a className="btn primary" href={selected.amazon_url} target="_blank" rel="noreferrer">Переглянути на Amazon <ExternalLink size={16}/></a>}</div></div></div></div></div>}
  {authOpen&&<div className="overlay" onClick={()=>setAuthOpen(false)}><div className="modal auth-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">AMAZONSAN ACCOUNT</span><h2>{authMode==='login'?'Вхід в акаунт':'Створити акаунт'}</h2></div><button className="icon-btn" onClick={()=>setAuthOpen(false)}><X/></button></div><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@email.com"/></label><label>Пароль<div className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Не менше 6 символів"/><button onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>{authError&&<p className="error">{authError}</p>}<button className="btn primary full-btn" onClick={signIn}>{authMode==='login'?'Увійти':'Зареєструватися'}</button><button className="btn google-btn full-btn" onClick={googleLogin}>G　 Продовжити з Google</button><p className="switch-auth">{authMode==='login'?'Ще не маєш акаунта?':'Вже маєш акаунт?'} <button onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'Реєстрація':'Увійти'}</button></p></div></div>}
  {adminOpen&&<div className="overlay" onClick={()=>setAdminOpen(false)}>{adminForm}</div>}
  {settingsOpen&&<div className="overlay" onClick={()=>setSettingsOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>Налаштування сайту</h2><button className="icon-btn" onClick={()=>setSettingsOpen(false)}><X/></button></div><p>Іконка сайту (favicon)</p><div className="icon-preview"><img src={siteIcon} alt="Поточна іконка"/> <span>Поточна іконка amazonsan</span></div><label className="upload-label"><ImagePlus size={17}/> Завантажити нову іконку<input type="file" accept="image/png,image/svg+xml,image/x-icon" onChange={e=>{const f=e.target.files?.[0];if(f){const u=URL.createObjectURL(f);setSiteIcon(u);notify('Попередній перегляд іконки оновлено. Для постійної заміни заміни public/favicon.svg у файлах сайту.')}}}/></label><p className="muted">Поточна версія підтримує попередній перегляд. Для публікації нової іконки заміни favicon.svg та icon.svg у проєкті й опублікуй оновлення.</p></div></div>}
  {notice&&<div className="toast"><Check size={17}/>{notice}</div>}
  {!configured&&<div className="demo-ribbon"><Info size={14}/> ДЕМО-РЕЖИМ · ПІДКЛЮЧИ SUPABASE ДЛЯ ПОВНОЇ РОБОТИ</div>}
 </div>
}
export default App
