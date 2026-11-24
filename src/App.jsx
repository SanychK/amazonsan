import React, {useEffect, useMemo, useState} from 'react'
import {Search, Heart, UserRound, Menu, X, Bell, SlidersHorizontal, Plus, Pencil, Trash2, Upload, Download, LogOut, Settings, Sparkles, Package, ChevronRight, ExternalLink, ImagePlus, ShieldCheck, LayoutGrid, Clock3, Star, Mail, Lock, Eye, EyeOff, Check, Info} from 'lucide-react'
import {categories, demoProducts} from './data'
import {supabase, configured} from './supabase'

const money = n => n == null || n === '' ? '—' : new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(Number(n))
const emptyForm = {title:'',category:categories[0].name,subcategory:'',price_uah:'',original_price_uah:'',price_usd:'',description:'',image_url:'',amazon_url:'',sku:'',specs:'',is_new:true,is_popular:false,is_best_seller:false,is_recommended:false,is_exclusive:false,is_editor_pick:false,is_deal_of_day:false,stock_status:'in_stock',status:'published'}
function App(){
 const [products,setProducts]=useState(demoProducts),[stockFilter,setStockFilter]=useState('all'),[session,setSession]=useState(null),[profile,setProfile]=useState(null)
 const [favorites,setFavorites]=useState([]),[query,setQuery]=useState(''),[category,setCategory]=useState('Усі категорії'),[subcategory,setSubcategory]=useState('Усі підкатегорії')
 const [sort,setSort]=useState('new'),[onlyFav,setOnlyFav]=useState(false),[view,setView]=useState('catalog'),[selected,setSelected]=useState(null),[selectedImageIndex,setSelectedImageIndex]=useState(0)
 const [authOpen,setAuthOpen]=useState(false),[authMode,setAuthMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authError,setAuthError]=useState('')
 const [adminOpen,setAdminOpen]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(emptyForm),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false)
 const [aiModel,setAiModel]=useState('')
 const [aiPurpose,setAiPurpose]=useState('')
 const [aiBusy,setAiBusy]=useState(false)
 const [aiError,setAiError]=useState('')
 const [sidebar,setSidebar]=useState(false)
const [categoryMenuOpen,setCategoryMenuOpen]=useState(false),[showPassword,setShowPassword]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[siteIcon,setSiteIcon]=useState('/favicon.svg')
 const [inquiryOpen,setInquiryOpen]=useState(false),[inquiryForm,setInquiryForm]=useState({name:'',contact:'',message:''}),[inquiryBusy,setInquiryBusy]=useState(false),[inquiries,setInquiries]=useState([])
  const [unreadInquiries,setUnreadInquiries]=useState(0)
  const [heroIndex,setHeroIndex]=useState(0)
  const [searchFocused,setSearchFocused]=useState(false)
  const [searchHistory,setSearchHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('amazonsan_search_history')||'[]')}catch{return []}})
 const [categoryFocus,setCategoryFocus]=useState(false)
 const [expandedCategory,setExpandedCategory]=useState('')
 const [compare,setCompare]=useState([]),[recentlyViewed,setRecentlyViewed]=useState(()=>{try{return JSON.parse(localStorage.getItem('amazonsan_recent')||'[]')}catch{return []}}),[smartFinder,setSmartFinder]=useState(false),[finderBudget,setFinderBudget]=useState(''),[budgetCap,setBudgetCap]=useState(''),[finderNeed,setFinderNeed]=useState(''),[finderFeature,setFinderFeature]=useState(''),[featureSettings,setFeatureSettings]=useState(()=>{try{return {...{new:true,bestsellers:true,deals:true,recommendations:true,recent:true,smart:true},...JSON.parse(localStorage.getItem('amazonsan_sections')||'{}')}}catch{return {new:true,bestsellers:true,deals:true,recommendations:true,recent:true,smart:true}}})
 const isAdmin=Boolean(profile?.is_admin)
 const notify = s => {setNotice(s); window.setTimeout(()=>setNotice(''),4200)}
 useEffect(()=>{
   if(!configured) return
   supabase.auth.getSession().then(({data})=>setSession(data.session))
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
   return ()=>subscription.unsubscribe()
 },[])
 useEffect(()=>{
  if(!configured||!isAdmin||!session?.user?.id)return
  const seenKey=`amazonsan_inquiries_seen_${session.user.id}`
  const getSeenAt=()=>localStorage.getItem(seenKey)||'1970-01-01T00:00:00.000Z'
  let active=true
  const refreshUnread=async()=>{
    const {count,error}=await supabase.from('product_inquiries').select('id',{count:'exact',head:true}).gt('created_at',getSeenAt())
    if(active&&!error)setUnreadInquiries(count||0)
  }
  refreshUnread()
  const timer=window.setInterval(refreshUnread,15000)
  const channel=supabase.channel(`amazonsan-inquiries-${session.user.id}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'product_inquiries'},refreshUnread)
    .subscribe()
  return ()=>{
    active=false
    window.clearInterval(timer)
    supabase.removeChannel(channel)
  }
 },[isAdmin,session?.user?.id])
 useEffect(()=>{
  if(!configured) return
  const loadCatalog=async()=>{
    if(!session){
      setProfile(null)
      setFavorites([])
      const {data,error}=await supabase
        .from('products')
        .select('*')
        .eq('status','published')
        .order('created_at',{ascending:false})

      if(!error&&data)setProducts(data)
      return
    }

    const [p,f]=await Promise.all([
      supabase.from('profiles')
        .select('*')
        .eq('id',session.user.id)
        .maybeSingle(),

      supabase.from('favorites')
        .select('product_id')
        .eq('user_id',session.user.id)
    ])

    const nextProfile=p.data||null

    setProfile(nextProfile)
    setFavorites((f.data||[]).map(x=>x.product_id))

    let productQuery=supabase
      .from('products')
      .select('*')
      .order('created_at',{ascending:false})

    if(!nextProfile?.is_admin){
      productQuery=productQuery.eq('status','published')
    }

    const {data,error}=await productQuery

    if(!error&&data)setProducts(data)
  }

  loadCatalog()
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
   if(budgetCap)arr=arr.filter(p=>p.price_uah!=null&&Number(p.price_uah)<=Number(budgetCap))
   if(stockFilter!=='all')arr=arr.filter(p=>(p.stock_status||'in_stock')===stockFilter)
   if(onlyFav)arr=arr.filter(p=>favorites.includes(p.id))
   if(query.trim()){
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  arr=arr.filter(p=>{
    const text=[p.title,p.brand,p.description,p.category,p.subcategory,p.sku]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return words.every(word=>text.includes(word))
  })
}
   if(sort==='priceUp')arr.sort((a,b)=>(a.price_uah||0)-(b.price_uah||0))
   if(sort==='priceDown')arr.sort((a,b)=>(b.price_uah||0)-(a.price_uah||0))
   if(sort==='name')arr.sort((a,b)=>a.title.localeCompare(b.title,'uk'))
   if(sort==='new')arr.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))
   if(sort==='best')arr.sort((a,b)=>Number(!!b.is_best_seller)-Number(!!a.is_best_seller))
   return arr
 },[products,category,subcategory,onlyFav,favorites,query,sort,isAdmin,budgetCap,stockFilter])
 const openProduct=p=>{setSelectedImageIndex(0);setSelected(p);setRecentlyViewed(old=>{const next=[p.id,...old.filter(id=>id!==p.id)].slice(0,8);localStorage.setItem('amazonsan_recent',JSON.stringify(next));return next})}
 const toggleCompare=id=>setCompare(old=>old.includes(id)?old.filter(x=>x!==id):old.length<4?[...old,id]:(notify('Можна порівняти до 4 товарів.'),old))
 const toggleFeature=k=>setFeatureSettings(old=>{const next={...old,[k]:!old[k]};localStorage.setItem('amazonsan_sections',JSON.stringify(next));return next})
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
 const deleteProduct=async id=>{
  if(!isAdmin){
    notify('Видалення доступне лише адміністратору.')
    return
  }

  const product=products.find(p=>p.id===id)
  if(!product)return

  if(!window.confirm(`Видалити товар «${product.title}»? Цю дію не можна скасувати.`))return

  setLoading(true)

  const {error}=await supabase
    .from('products')
    .delete()
    .eq('id',id)

  setLoading(false)

  if(error){
    notify('Не вдалося видалити товар: '+error.message)
    return
  }

  setProducts(current=>current.filter(p=>p.id!==id))
  setFavorites(current=>current.filter(x=>x!==id))
  setCompare(current=>current.filter(x=>x!==id))

  if(selected?.id===id)setSelected(null)

  notify('Товар успішно видалено.')
}
 const saveProduct=async()=>{
   if(!form.title.trim()){notify('Вкажи назву товару.');return}
   if(!configured){notify('Для збереження товарів налаштуй Supabase за інструкцією в README.');return}
   setLoading(true)
   const payload={
  ...form,
  image_urls:form.image_urls?.length?form.image_urls:(form.image_url?[form.image_url]:[]),
  image_url:form.image_urls?.[0]||form.image_url||null,
  price_uah:form.price_uah===''?null:Number(form.price_uah),
  original_price_uah:form.original_price_uah===''?null:Number(form.original_price_uah),
  price_usd:form.price_usd===''?null:Number(form.price_usd),
  specs:form.specs?form.specs.split('\n').filter(Boolean):[],
  created_by:session.user.id
}
   let result
   if(editing) result=await supabase.from('products').update(payload).eq('id',editing)
   else result=await supabase.from('products').insert(payload)
   setLoading(false)
   if(result.error){notify(result.error.message);return}
   setAdminOpen(false);setEditing(null);setForm(emptyForm);await reloadProducts();notify('Товар збережено.')
 }
 const startEdit=p=>{
  const images=Array.isArray(p.image_urls)&&p.image_urls.length
    ?p.image_urls
    :p.image_url?[p.image_url]:[]

  setEditing(p.id)
  setForm({
    ...emptyForm,
    ...p,
    image_urls:images,
    image_url:images[0]||'',
    price_uah:p.price_uah??'',
    original_price_uah:p.original_price_uah??'',
    price_usd:p.price_usd??'',
    specs:Array.isArray(p.specs)?p.specs.join('\n'):p.specs||''
  })
  setAdminOpen(true)
}
 const signIn=async()=>{
   setAuthError('')
   if(!configured){setAuthError('Авторизація стане доступною після підключення Supabase.');return}
   const {error}=authMode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password})
   if(error)setAuthError(error.message);else{setAuthOpen(false);setPassword('');notify(authMode==='signup'?'Перевір пошту для підтвердження реєстрації.':'Вхід виконано.')}
 }
 const googleLogin=async()=>{if(!configured){setAuthError('Спочатку підключи Supabase.');return}const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}});if(error)setAuthError(error.message)}
 const signOut=async()=>{if(configured)await supabase.auth.signOut();setView('catalog');notify('Ти вийшов з акаунта.')}
 const uploadImage=async files=>{
  if(!configured||!session){
    notify('Для завантаження фото потрібне підключення Supabase та вхід.')
    return
  }

  const selectedFiles=Array.from(files||[])
  if(!selectedFiles.length)return

  const uploadedUrls=[]

  for(const file of selectedFiles){
    const ext=file.name.split('.').pop()?.toLowerCase()||'jpg'
    const path=`${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const {error}=await supabase.storage.from('product-images').upload(path,file,{upsert:false})

    if(error){
      notify(error.message)
      return
    }
    const {data}=supabase.storage.from('product-images').getPublicUrl(path)
    uploadedUrls.push(data.publicUrl)
  }
  setForm(current=>{
    const existing=current.image_urls?.length
      ? current.image_urls
      : current.image_url?[current.image_url]:[]
    const images=[...existing,...uploadedUrls]
    return {...current,image_urls:images,image_url:images[0]||''}
  })
  notify(`Завантажено фото: ${uploadedUrls.length}`)
}
 const exportJSON=()=>{const blob=new Blob([JSON.stringify(products,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='amazonsan-products.json';a.click();URL.revokeObjectURL(a.href)}
 const importJSON=async file=>{
   if(!configured||!isAdmin){notify('Імпорт доступний адміністратору після підключення бази.');return}
   try{const rows=JSON.parse(await file.text());if(!Array.isArray(rows))throw Error('Очікується JSON-масив товарів');const clean=rows.map(({id,created_at,...p})=>({...p,created_by:session.user.id}));const {error}=await supabase.from('products').insert(clean);if(error)throw error;await reloadProducts();notify('Імпорт завершено.')}catch(e){notify('Помилка імпорту: '+e.message)}
 }
 const setField=(k,v)=>setForm(f=>({...f,[k]:v}))
  
const generateAiDescription=async()=>{
  if(!isAdmin||!session?.access_token){
    setAiError('Увійди в акаунт адміністратора.')
    return
  }

  if(!form.title.trim()){
    setAiError('Спочатку введи назву товару.')
    return
  }

  setAiBusy(true)
  setAiError('')

  try{
    const response=await fetch('/api/ai-description',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${session.access_token}`
      },
      body:JSON.stringify({
        title:form.title,
        model:aiModel,
        purpose:aiPurpose,
        specs:form.specs
      })
    })

    const data=await response.json()

    if(!response.ok){
      const details=data.diagnostics
        ? '\n\nДІАГНОСТИКА:\n'+JSON.stringify(data.diagnostics,null,2)
        : ''

      throw new Error(
        (data.error||'Не вдалося створити опис товару.')+details
      )
    }

    if(typeof data.description==='string'&&data.description.trim()){
      setField('description',data.description.trim())
      notify('Опис товару успішно створено. Перевір його перед збереженням.')
    }else{
      throw new Error('Не вдалося створити достовірний опис. Перевір вхідні дані.')
    }

  }catch(error){
    setAiError(error.message||'Помилка AI-помічника. Спробуй ще раз.')
  }finally{
    setAiBusy(false)
  }
}

 const sendInquiry=async()=>{
   if(!selected)return
   if(!inquiryForm.name.trim()||!inquiryForm.contact.trim()){notify('Вкажи ім’я та телефон або email для зв’язку.');return}
   if(!configured){notify('Форма звернень запрацює після підключення Supabase.');return}
   setInquiryBusy(true)
   const {error}=await supabase.from('product_inquiries').insert({product_id:selected.id,product_title:selected.title,price_uah:selected.price_uah??null,customer_name:inquiryForm.name.trim(),customer_contact:inquiryForm.contact.trim(),message:inquiryForm.message.trim()||null})
   setInquiryBusy(false)
   if(error){notify('Не вдалося надіслати звернення. Спробуй ще раз.');return}
   setInquiryOpen(false);setInquiryForm({name:'',contact:'',message:''});setSelected(null);notify('Звернення надіслано власнику каталогу. Дякуємо!')
 }
 const openInquiries=async()=>{
   if(!isAdmin||!configured)return
   const {data,error}=await supabase.from('product_inquiries').select('*').order('created_at',{ascending:false})
   if(error){notify('Не вдалося завантажити звернення: '+error.message);return}
   const latestCreatedAt=(data||[]).reduce((latest,item)=>item.created_at&&item.created_at>latest?item.created_at:latest,'')
   localStorage.setItem(`amazonsan_inquiries_seen_${session.user.id}`,latestCreatedAt||new Date().toISOString())
   setUnreadInquiries(0)
   setInquiries(data||[]);setView('inquiries')
 }
 const updateInquiryStatus=async(id,status)=>{
   const {error}=await supabase.from('product_inquiries').update({status}).eq('id',id)
   if(error){notify('Не вдалося оновити статус.');return}
   setInquiries(rows=>rows.map(row=>row.id===id?{...row,status}:row))
 }
 const deleteInquiry=async(id)=>{
   if(!isAdmin||!window.confirm('Видалити це звернення? Цю дію не можна скасувати.'))return
   const {error}=await supabase.from('product_inquiries').delete().eq('id',id)
   if(error){notify('Не вдалося видалити звернення: '+error.message);return}
   setInquiries(rows=>rows.filter(row=>row.id!==id))
   notify('Звернення видалено.')
 }

 const currentSubs=categories.find(c=>c.name===category)?.subs||[]
 const openHeroCategory = name => {
  setCategory(name)
  setCategoryFocus(name !== 'Усі категорії')
  setSubcategory('Усі підкатегорії')
  setOnlyFav(false)
  setView('catalog')
  setSelected(null)
  setSidebar(false)
  setCategoryMenuOpen(false)
  window.scrollTo({top:0,behavior:'smooth'})
}
 const heroTiles = [
   {name:'Усі категорії',left:2.5,top:49.3,width:15.0,height:11.3},
   {name:'Електроніка',left:18.8,top:49.3,width:14.9,height:11.3},
   {name:'Дім і кухня',left:34.8,top:49.3,width:14.6,height:11.3},
   {name:'Одяг і взуття',left:50.6,top:49.3,width:14.7,height:11.3},
   {name:'Краса та догляд',left:66.5,top:49.3,width:14.9,height:11.3},
   {name:'Здоров’я',left:82.6,top:49.3,width:14.9,height:11.3},
   {name:'Спорт і туризм',left:2.5,top:62.0,width:15.0,height:11.1},
   {name:'Автотовари',left:18.8,top:62.0,width:14.9,height:11.1},
   {name:'Дитячі товари',left:34.8,top:62.0,width:14.6,height:11.1},
   {name:'Іграшки та хобі',left:50.6,top:62.0,width:14.7,height:11.1},
   {name:'Інструменти',left:66.5,top:62.0,width:14.9,height:11.1},
   {name:'Товари для тварин',left:82.6,top:62.0,width:14.9,height:11.1},
   {name:'Офіс і канцелярія',left:2.5,top:74.5,width:15.0,height:11.0},
   {name:'Продукти та напої',left:18.8,top:74.5,width:14.9,height:11.0},
   {name:'Музика',left:34.8,top:74.5,width:14.6,height:11.0},
   {name:'Сад і город',left:50.6,top:74.5,width:14.7,height:11.0},
   {name:'Ювелірні вироби',left:66.5,top:74.5,width:14.9,height:11.0},
   {name:'Багаж і подорожі',left:82.6,top:74.5,width:14.9,height:11.0},
   {name:'Товари для бізнесу',left:2.5,top:86.6,width:15.0,height:11.0},
   {name:'Інше',left:18.8,top:86.6,width:14.9,height:11.0},
 ]
 
 // ПІДГОТОВКА ДАНИХ ДЛЯ ГОЛОВНОЇ СТОРІНКИ

 const publishedProducts = useMemo(
   () => products.filter(p => p.status === 'published'),
   [products]
 )

 const newestProducts = useMemo(
   () => [...publishedProducts].sort(
     (a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
   ),
   [publishedProducts]
 )

 const heroProducts = useMemo(() => {
   const featured = publishedProducts.filter(p =>
     p.is_recommended || p.is_best_seller || p.is_editor_pick
   )

   const source = featured.length ? featured : newestProducts

   return [...source].sort((a,b) => {
     const score = p =>
       Number(!!p.is_recommended) * 3 +
       Number(!!p.is_best_seller) * 2 +
       Number(!!p.is_editor_pick)

     return score(b) - score(a) ||
       new Date(b.created_at || 0) - new Date(a.created_at || 0)
   }).slice(0,5)
 }, [publishedProducts,newestProducts])

 const brandGroups = useMemo(() => {
   const groups = publishedProducts.reduce((acc,p) => {
     const brand = (p.brand || '').trim()

     if (brand) {
       if (!acc[brand]) acc[brand] = []
       acc[brand].push(p)
     }

     return acc
   }, {})

   return Object.entries(groups)
     .sort((a,b) => b[1].length - a[1].length)
     .slice(0,12)
 }, [publishedProducts])

 // ПОШУК ТА ІСТОРІЯ ПОШУКУ

 const runSearch = value => {
   const term = String(value || '').trim()

   setQuery(term)
   setCategory('Усі категорії')
   setSubcategory('Усі підкатегорії')
   setOnlyFav(false)
   setBudgetCap('')
   setStockFilter('all')
   setView('catalog')
   setSearchFocused(false)

   if (term) {
     setSearchHistory(old => {
       const next = [
         term,
         ...old.filter(x =>
           String(x).toLowerCase() !== term.toLowerCase()
         )
       ].slice(0,8)

       localStorage.setItem(
         'amazonsan_search_history',
         JSON.stringify(next)
       )

       return next
     })
   }
 }

 const searchSuggestions = (() => {
   const term = query.trim().toLowerCase()

   if (!term) {
     return searchHistory.map(label => ({
       type: 'Історія',
       label,
       action: () => runSearch(label)
     }))
   }

   const productMatches = publishedProducts
     .filter(p => {
       const text = [
         p.title,
         p.brand,
         p.category,
         p.subcategory
       ].filter(Boolean).join(' ').toLowerCase()

       return text.includes(term)
     })
     .slice(0,5)
     .map(p => ({
       type: 'Товар',
       label: p.title,
       action: () => runSearch(p.title)
     }))

   const categoryMatches = categories
     .filter(c => c.name.toLowerCase().includes(term))
     .slice(0,3)
     .map(c => ({
       type: 'Категорія',
       label: c.name,
       action: () => openHeroCategory(c.name)
     }))

   return [...productMatches,...categoryMatches]
 })()

 const adminForm=<div className="modal wide" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">КЕРУВАННЯ КАТАЛОГОМ</span><h2>{editing?'Редагувати товар':'Додати товар'}</h2></div><button className="icon-btn" onClick={()=>setAdminOpen(false)}><X/></button></div>
   <div className="form-grid">
    <label className="full">Назва товару<input value={form.title} onChange={e=>setField('title',e.target.value)} placeholder="Наприклад, бездротові навушники"/></label>
    
<div className="full">
  <button type="button" className="btn secondary" onClick={generateAiDescription} disabled={aiBusy}>
    <Sparkles size={16}/>
    {aiBusy ? 'Шукаю товар та заповнюю форму…' : 'Знайти товар і заповнити форму'}
  </button>

  {aiError && <p className="error">{aiError}</p>}

  <p className="muted">
    AI додає лише інформацію, яку вдалося підтвердити. Невідомі дані залишаються незаповненими.
  </p>

  <label className="full">
    Опис
    <textarea
      rows="5"
      value={form.description || ''}
      onChange={e => setField('description', e.target.value)}
      placeholder="Тут з’явиться перевірений опис товару. За потреби доповни його самостійно."
    />
  </label>
</div>
    <label>Категорія<select value={form.category} onChange={e=>{setField('category',e.target.value);setField('subcategory','')}}>{categories.map(c=><option>{c.name}</option>)}</select></label>
    <label>Підкатегорія<select value={form.subcategory} onChange={e=>setField('subcategory',e.target.value)}><option value="">Оберіть підкатегорію</option>{(categories.find(c=>c.name===form.category)?.subs||[]).map(s=><option>{s}</option>)}</select></label>
    <label>Ціна, грн<input type="number" min="0" value={form.price_uah} onChange={e=>setField('price_uah',e.target.value)}/></label>
    <label>Ціна Amazon, USD<input type="number" min="0" step="0.01" value={form.price_usd} onChange={e=>setField('price_usd',e.target.value)}/></label>
    <label>Стара ціна, грн<input type="number" min="0" value={form.original_price_uah||''} onChange={e=>setField('original_price_uah',e.target.value)}/></label>
    <label>Наявність<select value={form.stock_status||'in_stock'} onChange={e=>setField('stock_status',e.target.value)}><option value="in_stock">В наявності</option><option value="out_of_stock">Немає в наявності</option></select></label>
    <label className="full">URL зображення<input value={form.image_url||''} onChange={e=>setField('image_url',e.target.value)} placeholder="https://..."/></label>
    <label className="full upload-label"><ImagePlus size={17}/> Завантажити фото з пристрою<input type="file" accept="image/*" multiple onChange={e=>{uploadImage(e.target.files);e.target.value=''}}/></label>
    <div className="full admin-image-previews">
      {(form.image_urls?.length?form.image_urls:form.image_url?[form.image_url]:[]).map((url,index)=>(
      <div className="admin-image-preview" key={`${url}-${index}`}>
        <img src={url} alt={`Фото ${index+1}`}/>
        <button type="button" onClick={()=>{
          setForm(current=>{
            const images=current.image_urls?.length
              ?current.image_urls
              :current.image_url?[current.image_url]:[]
            const next=images.filter((_,i)=>i!==index)
            return {...current,image_urls:next,image_url:next[0]||''}
          })
        }} title="Видалити фото">
          <X size={15}/>
        </button>
        {index===0&&<span>Головне фото</span>}
      </div>
    ))}
  </div>
    <label className="full">Посилання на товар Amazon<input value={form.amazon_url||''} onChange={e=>setField('amazon_url',e.target.value)} placeholder="https://www.amazon.com/..."/></label>
    <label className="full">Модель товару (для AI)<input value={aiModel} onChange={e=>setAiModel(e.target.value)} placeholder="Наприклад, WH-1000XM5"/></label>

<label className="full">Призначення товару (для AI)<textarea rows="2" value={aiPurpose} onChange={e=>setAiPurpose(e.target.value)} placeholder="Для чого призначений товар і кому буде корисний"/></label>

    <label className="full">Характеристики (кожна з нового рядка)<textarea rows="3" value={form.specs||''} onChange={e=>setField('specs',e.target.value)} placeholder="Колір: чорний&#10;Підключення: Bluetooth"/></label>
    <label>Артикул / SKU<input value={form.sku||''} onChange={e=>setField('sku',e.target.value)}/></label>
    <label>Статус<select value={form.status||'published'} onChange={e=>setField('status',e.target.value)}><option value="published">Опубліковано</option><option value="draft">Чернетка</option></select></label>
    <div className="checks full"><label><input type="checkbox" checked={!!form.is_new} onChange={e=>setField('is_new',e.target.checked)}/> Новинка</label><label><input type="checkbox" checked={!!form.is_popular} onChange={e=>setField('is_popular',e.target.checked)}/> Популярний</label><label><input type="checkbox" checked={!!form.is_best_seller} onChange={e=>setField('is_best_seller',e.target.checked)}/> Хіт продажів</label><label><input type="checkbox" checked={!!form.is_recommended} onChange={e=>setField('is_recommended',e.target.checked)}/> Рекомендуємо</label><label><input type="checkbox" checked={!!form.is_exclusive} onChange={e=>setField('is_exclusive',e.target.checked)}/> Ексклюзив</label><label><input type="checkbox" checked={!!form.is_editor_pick} onChange={e=>setField('is_editor_pick',e.target.checked)}/> Вибір редакції</label><label><input type="checkbox" checked={!!form.is_deal_of_day} onChange={e=>setField('is_deal_of_day',e.target.checked)}/> Товар дня</label></div>
   </div><div className="modal-actions"><button className="btn secondary" onClick={()=>setAdminOpen(false)}>Скасувати</button><button className="btn primary" onClick={saveProduct} disabled={loading}>{loading?'Збереження…':'Зберегти товар'}</button></div></div>
 return <div className="app-shell">
  <header className="topbar"><div className="top-inner"><button className="mobile-menu icon-btn" onClick={()=>setSidebar(!sidebar)}><Menu/></button><button className="brand" onClick={()=>{
  setView('catalog')
  setSelected(null)
  setCategory('Усі категорії')
  setSubcategory('Усі підкатегорії')
  setQuery('')
  setOnlyFav(false)
  setBudgetCap('')
  setStockFilter('all')
  setCategoryFocus(false)
  window.scrollTo({top:0,behavior:'smooth'})
}}><span className="brand-mark">a<span>•</span></span><span>amazonsan<small>КАТАЛОГ ТОВАРІВ</small></span></button>
   <div className="search-wrap"><div className="searchbox"><Search size={19}/><input
  value={query}
  onFocus={()=>setSearchFocused(true)}
  onBlur={()=>window.setTimeout(()=>setSearchFocused(false),160)}
  onKeyDown={e=>{if(e.key==='Enter')runSearch(query);if(e.key==='Escape')setSearchFocused(false)}}
  onChange={e=>{setQuery(e.target.value);setView('catalog');if(e.target.value.trim()){setCategory('Усі категорії');setSubcategory('Усі підкатегорії');setOnlyFav(false);setBudgetCap('');setStockFilter('all')}}}
  placeholder="Знайти товар, категорію або бренд..."
/><button type="button" className="search-submit" onMouseDown={e=>e.preventDefault()} onClick={()=>runSearch(query)} aria-label="Шукати"><Search size={17}/></button></div>
  {searchFocused&&<div className="search-suggestions">{query.trim()&&searchSuggestions.length===0?<p>Нічого не знайдено. Натисни Enter, щоб переглянути результати.</p>:searchSuggestions.map((item,i)=><button key={`${item.type}-${item.label}-${i}`} onMouseDown={e=>e.preventDefault()} onClick={item.action}><Search size={14}/><span>{item.label}</span><small>{item.type}</small></button>)}{!query.trim()&&searchHistory.length>0&&<button className="clear-search-history" onMouseDown={e=>e.preventDefault()} onClick={()=>{setSearchHistory([]);localStorage.removeItem('amazonsan_search_history')}}>Очистити історію пошуку</button>}</div>}
 </div>
   <div className="top-actions"><button className={`icon-btn ${onlyFav?'active':''}`} onClick={()=>{setOnlyFav(!onlyFav);setView('catalog')}} title="Обране"><Heart/><span className="count">{favorites.length}</span></button>{isAdmin&&<button className={`notification-btn ${unreadInquiries>0?'has-unread':''}`} onClick={openInquiries} title={unreadInquiries>0?`Нові звернення: ${unreadInquiries}`:'Сповіщення'} aria-label={unreadInquiries>0?`Нові звернення: ${unreadInquiries}`:'Сповіщення'}><Bell size={19}/>{unreadInquiries>0&&<span className="notification-count">{unreadInquiries>99?'99+':unreadInquiries}</span>}</button>}<button className="account-btn" onClick={()=>session?setView('account'):setAuthOpen(true)}><UserRound size={18}/><span>{session?'Мій акаунт':'Увійти'}</span></button></div>
  </div></header>
  <div className="layout">
   <aside className={`sidebar ${sidebar?'open':''}`}><div className="side-head"><span>КАТАЛОГ</span><button className="mobile-menu icon-btn" onClick={()=>setSidebar(false)}><X/></button></div>
    <button className={`cat-link ${category==='Усі категорії'?'selected':''}`} onClick={()=>openHeroCategory('Усі категорії')}><LayoutGrid size={17}/> Усі категорії</button>
{categories.map(c=><div key={c.name}><button className={`cat-link ${category===c.name?'selected':''}`} onClick={()=>{setExpandedCategory(expandedCategory===c.name?'':c.name);openHeroCategory(c.name)}}><span className="cat-icon">{c.icon}</span>{c.name}<ChevronRight size={14} className="cat-arrow"/></button>{expandedCategory===c.name&&<div className="subcats">{c.subs.map(s=><button className={subcategory===s?'sub-active':''} onClick={()=>{setSubcategory(s);setCategoryFocus(true);setSidebar(false);window.scrollTo({top:0,behavior:'smooth'})}}>{s}</button>)}</div>}</div>)}
    <div className="sidebar-bottom"><div className="mini-note"><Sparkles size={16}/><b>Знаходь цікаве</b><p>Каталог корисних товарів з Amazon в одному місці.</p></div><span>© 2026 amazonsan</span></div>
   </aside>
   <main className={`main ${categoryFocus?'category-focus':''}`}>
    {view==='catalog'&&<>
{!query.trim() && <>
 <section className="home-hero-carousel" aria-label="Рекомендовані товари AMAZONSAN">
   <div className="home-hero-heading">
     <div><span className="eyebrow">AMAZONSAN · ВІДКРИВАЙ НОВЕ</span><h1>Знайди те, що <em>потрібно саме зараз</em></h1><p>Добірка товарів із каталогу — переглядай, порівнюй і зберігай цікаве.</p></div>
     <button className="btn secondary small" onClick={()=>{setCategory('Усі категорії');document.querySelector('.catalog-section')?.scrollIntoView({behavior:'smooth'})}}>Увесь каталог <ChevronRight size={16}/></button>
   </div>
   {heroProducts.length>0?<div className="hero-carousel-stage">
     <button className="hero-carousel-arrow prev" onClick={()=>setHeroIndex(i=>(i-1+heroProducts.length)%heroProducts.length)} aria-label="Попередній товар"><ChevronRight/></button>
     {heroProducts.map((p,i)=><article key={p.id} className={`hero-feature-card ${i===(heroIndex%heroProducts.length)?'active':''}`} aria-hidden={i!==heroIndex}>
       <button className="hero-feature-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package size={54}/>}</button>
       <div className="hero-feature-copy"><span className="eyebrow">{p.is_best_seller?'ХІТ ПРОДАЖІВ':p.is_editor_pick?'ВИБІР AMAZONSAN':p.is_recommended?'РЕКОМЕНДУЄМО':'ЩОЙНО ДОДАНО'}</span><h2>{p.title}</h2><p>{p.description||'Переглянь характеристики та детальну інформацію про товар.'}</p><div className="hero-feature-bottom"><b>{money(p.price_uah)}</b><button className="btn primary" onClick={()=>openProduct(p)}>Детальніше <ChevronRight size={16}/></button></div></div>
     </article>)}
     <button className="hero-carousel-arrow next" onClick={()=>setHeroIndex(i=>(i+1)%heroProducts.length)} aria-label="Наступний товар"><ChevronRight/></button>
     <div className="hero-carousel-dots">{heroProducts.map((p,i)=><button key={p.id} className={i===(heroIndex%heroProducts.length)?'active':''} onClick={()=>setHeroIndex(i)} aria-label={`Показати товар ${i+1}`}/>)}</div>
   </div>:<div className="hero-empty"><Package/><b>Каталог наповнюється</b><span>Нові товари з’являться тут після додавання.</span></div>}
 </section>

 <section className="home-section category-showcase">
   <div className="section-head"><div><span className="eyebrow">ЗНАЙДИ СВІЙ НАПРЯМ</span><h2>Популярні категорії</h2><p>Обирай категорію та переходь до відповідних товарів</p></div></div>
   <div className="category-tiles">
     {categories.map((c,i)=>{const count=publishedProducts.filter(p=>p.category===c.name).length;return <button key={c.name} className="category-tile" onClick={()=>openHeroCategory(c.name)}><span className="category-tile-icon">{c.icon||<Package/>}</span><b>{c.name}</b><small>{count} {count===1?'товар':count>1&&count<5?'товари':'товарів'}</small><ChevronRight size={16}/></button>})}
   </div>
 </section>

 <section className="home-section">
   <div className="section-head"><div><span className="eyebrow">ЩОЙНО ДОДАНО</span><h2>Нові надходження</h2><p>Останні товари, додані до каталогу</p></div><button className="btn secondary small" onClick={()=>{setSort('new');document.querySelector('.catalog-section')?.scrollIntoView({behavior:'smooth'})}}>Усі товари <ChevronRight size={16}/></button></div>
   <div className="home-product-row">{newestProducts.slice(0,6).map(p=><article className="home-mini-product" key={`arrival-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}</button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong></article>)}</div>
 </section>

 {brandGroups.length>0&&<section className="home-section brand-section"><div className="section-head"><div><span className="eyebrow">ВІДОМИЙ ВИБІР</span><h2>Популярні бренди</h2><p>Переглядай товари конкретного бренду</p></div></div><div className="brand-strip">{brandGroups.map(([brand,items])=><button key={brand} className="brand-tile" onClick={()=>runSearch(brand)}><b>{brand}</b><small>{items.length} {items.length===1?'товар':items.length>1&&items.length<5?'товари':'товарів'}</small></button>)}</div></section>}

 {featureSettings.bestsellers&&publishedProducts.some(p=>p.is_best_seller)&&<section className="home-section"><div className="section-head"><div><span className="eyebrow">ПОЗНАЧЕНО В КАТАЛОЗІ</span><h2>Хіти продажів</h2><p>Товари, які адміністратор позначив як хіти</p></div></div><div className="home-product-row">{publishedProducts.filter(p=>p.is_best_seller).slice(0,6).map(p=><article className="home-mini-product" key={`best-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}</button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong></article>)}</div></section>}

 {featureSettings.recommendations&&<section className="home-section"><div className="section-head"><div><span className="eyebrow">ДОБІРКА AMAZONSAN</span><h2>Можливо, вас зацікавить</h2><p>Редакційна добірка товарів, позначених для рекомендації</p></div></div>{publishedProducts.some(p=>p.is_recommended)?<div className="home-product-row">{publishedProducts.filter(p=>p.is_recommended).slice(0,6).map(p=><article className="home-mini-product" key={`rec-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}</button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong></article>)}</div>:<p className="home-muted">Добірка з’явиться, коли товари будуть позначені як рекомендовані.</p>}</section>}

 {category!=='Усі категорії'&&<section className="home-section"><div className="section-head"><div><span className="eyebrow">У ВИБРАНОМУ НАПРЯМІ</span><h2>Популярне у категорії «{category}»</h2><p>Позиції цієї категорії, позначені як популярні або рекомендовані</p></div></div>{publishedProducts.filter(p=>p.category===category&&(p.is_popular||p.is_best_seller||p.is_recommended)).length>0?<div className="home-product-row">{publishedProducts.filter(p=>p.category===category&&(p.is_popular||p.is_best_seller||p.is_recommended)).slice(0,6).map(p=><article className="home-mini-product" key={`category-pop-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}</button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong></article>)}</div>:<p className="home-muted">У цій категорії поки немає товарів із позначкою популярності або рекомендації.</p>}</section>}

 {recentlyViewed.length>0&&(()=>{const last=products.find(p=>p.id===recentlyViewed[0]);const related=last?publishedProducts.filter(p=>p.id!==last.id&&p.category===last.category).slice(0,6):[];return related.length>0?<section className="home-section"><div className="section-head"><div><span className="eyebrow">НА ОСНОВІ ПЕРЕГЛЯДУ</span><h2>Схожі товари</h2><p>Інші товари з категорії «{last.category}»</p></div></div><div className="home-product-row">{related.map(p=><article className="home-mini-product" key={`similar-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}</button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong></article>)}</div></section>:null})()}

 {featureSettings.deals&&publishedProducts.some(p=>Number(p.original_price_uah)>Number(p.price_uah)&&p.price_uah!=null)&&<section className="home-section promo-feature"><div className="section-head"><div><span className="eyebrow">ВИГІДНІ ПРОПОЗИЦІЇ</span><h2>Акції та спеціальні пропозиції</h2><p>Показуємо лише товари з указаною старою та актуальною ціною</p></div></div><div className="home-product-row">{publishedProducts.filter(p=>Number(p.original_price_uah)>Number(p.price_uah)&&p.price_uah!=null).slice(0,6).map(p=><article className="home-mini-product" key={`deal-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}<span className="sale-pill">−{Math.round((1-Number(p.price_uah)/Number(p.original_price_uah))*100)}%</span></button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong><del>{money(p.original_price_uah)}</del></article>)}</div></section>}

 {publishedProducts.some(p=>p.is_editor_pick)&&<section className="home-section editor-picks"><div className="section-head"><div><span className="eyebrow">ОСОБЛИВА ДОБІРКА</span><h2>Вибір AMAZONSAN</h2><p>Товари, відібрані власником каталогу</p></div></div><div className="home-product-row">{publishedProducts.filter(p=>p.is_editor_pick).slice(0,6).map(p=><article className="home-mini-product" key={`pick-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}</button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong></article>)}</div></section>}

 {featureSettings.recent&&recentlyViewed.length>0&&<section className="home-section"><div className="section-head"><div><span className="eyebrow">ПОВЕРНИСЯ ДО ЦІКАВОГО</span><h2>Нещодавно переглянуті</h2></div></div><div className="home-product-row">{recentlyViewed.map(id=>products.find(p=>p.id===id)).filter(Boolean).map(p=><article className="home-mini-product" key={`recent-${p.id}`}><button className="home-mini-image" onClick={()=>openProduct(p)}>{(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title}/>:<Package/>}</button><span>{p.category}</span><b onClick={()=>openProduct(p)}>{p.title}</b><strong>{money(p.price_uah)}</strong></article>)}</div></section>}

 <section className="home-info-strip"><div><Sparkles/><b>Зручний пошук і вибір</b><span>Знаходь товари за назвою та категорією</span></div><div><Heart/><b>Список бажань</b><span>Зберігай цікаві позиції в обраному</span></div><div><ShieldCheck/><b>Інформаційний каталог</b><span>Запит власнику — без онлайн-оплати</span></div>{featureSettings.smart&&<div className="home-info-action"><Sparkles/><b>Потрібна допомога з вибором?</b><span>Підбери товари за бюджетом і призначенням</span><button className="btn primary small" onClick={()=>setSmartFinder(true)}>Розумний підбір</button></div>}</section>
 </>}
      <section className="catalog-section future-catalog">
        <div className="section-head">
          <div><span className="eyebrow">ВІДКРИВАЙ · ОБИРАЙ · ПОРІВНЮЙ</span><h2>{onlyFav?'Обране':category==='Усі категорії'?'Каталог товарів':category}</h2><p>Знайди потрібне серед товарів AMAZONSAN</p></div>
          <div className="filters"><select value={stockFilter} onChange={e=>setStockFilter(e.target.value)} aria-label="Наявність"><option value="all">Будь-яка наявність</option><option value="in_stock">В наявності</option><option value="out_of_stock">Немає в наявності</option></select><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Сортування"><option value="new">Спочатку нові</option><option value="priceUp">Спочатку дешевші</option><option value="priceDown">Спочатку дорожчі</option><option value="name">За назвою</option><option value="best">Хіти продажів</option></select></div>
        </div>
        {(query || category!=='Усі категорії' || onlyFav || budgetCap || stockFilter!=='all') && <div className="active-filter">{query?`Пошук: ${query}`:onlyFav?'Показано обране':category}<button onClick={()=>{setQuery('');setCategory('Усі категорії');setSubcategory('Усі підкатегорії');setOnlyFav(false);setBudgetCap('');setStockFilter('all')}}>✕ Очистити</button></div>}
        <div className="future-results">ЗНАЙДЕНО <b>{visible.length}</b> ТОВАРІВ <span>·</span> {subcategory!=='Усі підкатегорії'?subcategory:'УСІ ПІДКАТЕГОРІЇ'}</div>
        {visible.length ? <div className="product-grid">{visible.map(p=><article className="product-card future-product" key={p.id}>
          <div className="product-image" onClick={()=>openProduct(p)} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&setSelected(p)}>
            {(p.image_urls?.[0]||p.image_url)?<img src={p.image_urls?.[0]||p.image_url} alt={p.title} loading="lazy"/>:<div className="image-placeholder"><Package/></div>}
            {p.is_new&&<span className="tag new">НОВИНКА</span>}{p.is_popular&&<span className="tag popular">ПОПУЛЯРНЕ</span>}{p.is_best_seller&&<span className="tag best">ХІТ ПРОДАЖІВ</span>}{p.is_editor_pick&&<span className="tag editorial">ВИБІР AMAZONSAN</span>}{p.is_exclusive&&<span className="tag exclusive">ЕКСКЛЮЗИВ</span>}{p.is_deal_of_day&&<span className="tag daydeal">ТОВАР ДНЯ</span>}{p.original_price_uah>p.price_uah&&<span className="tag sale">−{Math.round((1-p.price_uah/p.original_price_uah)*100)}%</span>}{p.stock_status==='out_of_stock'&&<span className="tag soldout">НЕМАЄ В НАЯВНОСТІ</span>}
            <button className={`fav-btn ${favorites.includes(p.id)?'liked':''}`} onClick={e=>{e.stopPropagation();toggleFavorite(p.id)}} title="В обране"><Heart size={16} fill={favorites.includes(p.id)?'currentColor':'none'}/></button>
          </div>
          <div className="product-info"><span className="product-category">{p.category}{p.subcategory?` · ${p.subcategory}`:''}</span><h3 onClick={()=>openProduct(p)}>{p.title}</h3><p>{p.description||'Детальна інформація про товар незабаром.'}</p>
            <div className="product-bottom"><div>{p.original_price_uah>p.price_uah&&<del className="old-price">{money(p.original_price_uah)}</del>}<b>{money(p.price_uah)}</b>{p.price_usd!=null&&<small>${p.price_usd} на Amazon</small>}</div><button className="arrow-btn" onClick={()=>openProduct(p)} aria-label="Детальніше"><ChevronRight size={18}/></button></div>
            <button className={`compare-toggle ${compare.includes(p.id)?'selected':''}`} onClick={()=>toggleCompare(p.id)}>{compare.includes(p.id)?'✓ Додано до порівняння':'+ Порівняти'}</button>{isAdmin&&<div className="admin-inline"><button onClick={()=>deleteProduct(p.id)}><Trash2 size={13}/> Видалити</button><button onClick={()=>startEdit(p)}><Pencil size={13}/> Редагувати</button></div>}
          </div>
        </article>)}</div> : <div className="empty"><div className="empty-icon"><Package/></div><h3>Поки що нічого не знайдено</h3><p>Спробуй змінити пошуковий запит або вибрати іншу категорію.</p><button className="btn primary" onClick={()=>{setQuery('');setCategory('Усі категорії');setSubcategory('Усі підкатегорії');setOnlyFav(false);setBudgetCap('');setStockFilter('all')}}>Показати всі товари</button></div>}
      </section>
      {compare.length>0&&<section className="compare-panel"><div className="section-head"><div><span className="eyebrow">ПОРІВНЯННЯ</span><h2>Обрані для порівняння ({compare.length}/4)</h2></div><button className="btn secondary small" onClick={()=>setCompare([])}>Очистити</button></div><div className="compare-grid">{compare.map(id=>products.find(p=>p.id===id)).filter(Boolean).map(p=><div key={p.id}><b>{p.title}</b><span>{money(p.price_uah)}</span><span>{p.stock_status==='out_of_stock'?'Немає в наявності':'В наявності'}</span><button onClick={()=>toggleCompare(p.id)}>Прибрати</button></div>)}</div></section>}
    </>}
    {view==='inquiries'&&isAdmin&&<section className="account-page"><span className="eyebrow">ПРИВАТНО ДЛЯ ВЛАСНИКА</span><h1>Звернення відвідувачів</h1><p>Це приватні запити щодо товарів. На сайті немає кошика, оформлення замовлення чи приймання платежів.</p><button className="btn secondary" onClick={()=>setView('catalog')}>Повернутися до каталогу</button><div className="inquiry-list">{inquiries.length?inquiries.map(item=><article className="inquiry-card" key={item.id}><div><b>{item.product_title}</b><small>{item.customer_name} · {item.customer_contact}</small><small>{new Date(item.created_at).toLocaleString('uk-UA')} · {item.price_uah==null?'Ціну не вказано':money(item.price_uah)}</small>{item.message&&<p>{item.message}</p>}</div><select value={item.status} onChange={e=>updateInquiryStatus(item.id,e.target.value)}><option value="new">Нове</option><option value="contacted">Зв’язалися</option><option value="discussing">Узгодження</option><option value="completed">Завершено</option><option value="declined">Відхилено</option></select><button className="inquiry-delete-btn" onClick={()=>deleteInquiry(item.id)} title="Видалити звернення" aria-label="Видалити звернення"><Trash2 size={16}/></button></article>):<p>Поки що звернень немає.</p>}</div></section>}
    {view==='account'&&<section className="account-page"><span className="eyebrow">ОСОБИСТИЙ ПРОСТІР</span><h1>Мій кабінет</h1><div className="account-card"><div className="avatar">{session?.user?.email?.[0]?.toUpperCase()||'A'}</div><div><h3>{session?.user?.email}</h3><p>{isAdmin?'Адміністратор':'Користувач amazonsan'}</p></div></div><div className="account-actions"><button className="btn secondary" onClick={()=>{setOnlyFav(true);setView('catalog')}}><Heart/> Моє обране ({favorites.length})</button>{isAdmin&&<button className="btn secondary" onClick={()=>setSettingsOpen(true)}><Settings/> Налаштування сайту</button>}<button className="btn secondary" onClick={signOut}><LogOut/> Вийти</button></div>{!configured&&<p className="setup-warning">Демонстраційний режим: підключи Supabase, щоб зберігати профіль та обране між пристроями.</p>}</section>}
    {isAdmin&&<div className="admin-bar"><div><ShieldCheck size={17}/> Панель адміністратора</div><div className="admin-tools"><button className="btn secondary small" onClick={openInquiries}><Mail size={16}/> Звернення</button><button className="btn primary small" onClick={()=>{setEditing(null);setForm(emptyForm);setAdminOpen(true)}}><Plus size={16}/> Додати товар</button><button className="btn secondary small" onClick={exportJSON}><Download size={16}/> Експорт JSON</button><label className="btn secondary small file-btn"><Upload size={16}/> Імпорт JSON<input type="file" accept=".json,application/json" onChange={e=>e.target.files?.[0]&&importJSON(e.target.files[0])}/></label></div></div>}
    <footer><div className="footer-brand">amazonsan<span>•</span></div><p>Каталог товарів для зручного пошуку та вибору.</p><div className="footer-links"><button onClick={()=>notify('Зв’язок: додай свою контактну пошту в налаштуваннях проєкту.')}>Контакти</button><button onClick={()=>notify('Політика конфіденційності: додай власний документ перед публічним запуском.')}>Конфіденційність</button><button onClick={()=>notify('amazonsan — незалежний каталог, не пов’язаний з Amazon.')}>Про проєкт</button></div><small>amazonsan не є офіційним сайтом Amazon і не афілійований з Amazon.</small></footer>
   </main>
  </div>
  {categoryMenuOpen&&
  <div className="overlay category-menu-overlay" onClick={()=>setCategoryMenuOpen(false)}>
    <div className="category-menu" onClick={e=>e.stopPropagation()}>
      <div className="category-menu-head">
        <div>
          <span className="eyebrow">AMAZONSAN · DISCOVER</span>
          <h2>Обери свій напрям</h2>
          <p>Знайди потрібні товари серед наших категорій</p>
        </div>
        <button className="icon-btn" onClick={()=>setCategoryMenuOpen(false)} aria-label="Закрити">
          <X/>
        </button>
      </div>

      <div className="category-menu-grid">
        <button className="category-menu-item category-all" onClick={()=>openHeroCategory('Усі категорії')}>
          <span className="category-menu-icon"><LayoutGrid/></span>
          <span><b>Усі категорії</b><small>Переглянути весь каталог</small></span>
          <ChevronRight/>
        </button>

        {categories.map((c,i)=>(
          <button
            key={c.name}
            className="category-menu-item"
            style={{'--menu-delay':`${i*25}ms`}}
            onClick={()=>openHeroCategory(c.name)}
          >
            <span className="category-menu-icon">{c.icon}</span>
            <span><b>{c.name}</b><small>{c.subs.length} підкатегорій</small></span>
            <ChevronRight/>
          </button>
        ))}
      </div>

      <div className="category-menu-footer">
        <Sparkles size={16}/>
        <span>Обирай, переглядай та зберігай цікаві товари</span>
      </div>
    </div>
  </div>
}
  {selected&&<div className="overlay" onClick={()=>setSelected(null)}><div className="modal detail-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><span className="eyebrow">ДЕТАЛІ ТОВАРУ</span><button className="icon-btn" onClick={()=>setSelected(null)}><X/></button></div><div className="detail-grid"><div className="detail-gallery">
  <div className="detail-image">
    {(selected.image_urls?.[selectedImageIndex]||selected.image_url)
      ?<img src={selected.image_urls?.[selectedImageIndex]||selected.image_url} alt={selected.title}/>
      :<Package/>}
  </div>
  {(selected.image_urls?.length||selected.image_url)&&
    <div className="detail-thumbnails">
      {(selected.image_urls?.length?selected.image_urls:[selected.image_url]).map((url,index)=>(
        <button key={index} className={`detail-thumb ${selectedImageIndex===index?'active':''}`} onClick={()=>setSelectedImageIndex(index)}>
          <img src={url} alt={`${selected.title} — фото ${index+1}`}/>
        </button>
      ))}
    </div>
  }
</div><div><span className="product-category">{selected.category} · {selected.subcategory}</span><h2>{selected.title}</h2><p>{selected.description}</p><div className="detail-price">{selected.original_price_uah>selected.price_uah&&<del className="old-price">{money(selected.original_price_uah)}</del>}{money(selected.price_uah)}{selected.price_usd&&<small>${selected.price_usd} на Amazon</small>}</div>{Array.isArray(selected.specs)&&selected.specs.length>0&&<ul className="spec-list">{selected.specs.map(s=><li>{s}</li>)}</ul>}<div className="detail-actions"><button className="btn secondary" onClick={()=>toggleCompare(selected.id)}>Порівняти</button><button className="btn secondary" onClick={()=>toggleFavorite(selected.id)}><Heart size={17}/> Зберегти</button><button className="btn primary" onClick={()=>setInquiryOpen(true)}><Mail size={16}/> Зв’язатися з власником</button>{selected.amazon_url&&<a className="btn secondary" href={selected.amazon_url} target="_blank" rel="noreferrer">Джерело товару <ExternalLink size={16}/></a>}</div><p className="inquiry-note">Це інформаційний каталог. Надсилання звернення не є оформленням замовлення або оплатою.</p></div></div></div></div>}
  {smartFinder&&<div className="overlay" onClick={()=>setSmartFinder(false)}><div className="modal auth-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">SMART FINDER</span><h2>Розумний підбір товару</h2></div><button className="icon-btn" onClick={()=>setSmartFinder(false)}><X/></button></div><label>Для чого шукаєш товар?<select value={finderNeed} onChange={e=>setFinderNeed(e.target.value)}><option value="">Будь-яке призначення</option>{categories.map(c=><option value={c.name}>{c.name}</option>)}</select></label><label>Бюджет до (грн)<input type="number" min="0" value={finderBudget} onChange={e=>setFinderBudget(e.target.value)} placeholder="Наприклад, 3000"/></label><label>Що найважливіше?<input value={finderFeature} onChange={e=>setFinderFeature(e.target.value)} placeholder="Наприклад, автономність, компактність"/></label><p className="muted">Підбір використовує наявні категорії, ціни та описи каталогу. Це базовий фільтр, не зовнішній AI-сервіс.</p><button className="btn primary full-btn" onClick={()=>{setCategory(finderNeed||'Усі категорії');setSubcategory('Усі підкатегорії');setQuery(finderFeature);setBudgetCap(finderBudget);setSort('priceUp');setOnlyFav(false);setSmartFinder(false);setView('catalog');setTimeout(()=>document.querySelector('.catalog-section')?.scrollIntoView({behavior:'smooth'}),100)}}>Показати відповідні товари</button></div></div>}
  {inquiryOpen&&selected&&<div className="overlay" onClick={()=>setInquiryOpen(false)}><div className="modal auth-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">ЗВЕРНЕННЯ ДО ВЛАСНИКА</span><h2>Зацікавив товар?</h2></div><button className="icon-btn" onClick={()=>setInquiryOpen(false)}><X/></button></div><p><b>{selected.title}</b><br/><span className="muted">{money(selected.price_uah)} · ціна для ознайомлення на момент звернення</span></p><label>Ваше ім’я<input value={inquiryForm.name} onChange={e=>setInquiryForm(f=>({...f,name:e.target.value}))} maxLength={100} placeholder="Як до вас звертатися"/></label><label>Телефон або email для зв’язку<input value={inquiryForm.contact} onChange={e=>setInquiryForm(f=>({...f,contact:e.target.value}))} maxLength={180} placeholder="Номер телефону або email"/></label><label>Повідомлення (необов’язково)<textarea rows="3" value={inquiryForm.message} onChange={e=>setInquiryForm(f=>({...f,message:e.target.value}))} maxLength={1000} placeholder="Ваше запитання щодо товару"/></label><p className="inquiry-note">Надсилаючи звернення, ви погоджуєтеся, що власник каталогу використає ці контактні дані лише для відповіді на ваш запит. Звернення не є замовленням і не передбачає оплату на сайті.</p><button className="btn primary full-btn" disabled={inquiryBusy} onClick={sendInquiry}>{inquiryBusy?'Надсилання…':'Надіслати звернення'}</button></div></div>}
  {authOpen&&<div className="overlay" onClick={()=>setAuthOpen(false)}><div className="modal auth-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">AMAZONSAN ACCOUNT</span><h2>{authMode==='login'?'Вхід в акаунт':'Створити акаунт'}</h2></div><button className="icon-btn" onClick={()=>setAuthOpen(false)}><X/></button></div><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@email.com"/></label><label>Пароль<div className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Не менше 6 символів"/><button onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>{authError&&<p className="error">{authError}</p>}<button className="btn primary full-btn" onClick={signIn}>{authMode==='login'?'Увійти':'Зареєструватися'}</button><button className="btn google-btn full-btn" onClick={googleLogin}>G　 Продовжити з Google</button><p className="switch-auth">{authMode==='login'?'Ще не маєш акаунта?':'Вже маєш акаунт?'} <button onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'Реєстрація':'Увійти'}</button></p></div></div>}
  {adminOpen&&<div className="overlay" onClick={()=>setAdminOpen(false)}>{adminForm}</div>}
  {settingsOpen&&<div className="overlay" onClick={()=>setSettingsOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>Налаштування сайту</h2><button className="icon-btn" onClick={()=>setSettingsOpen(false)}><X/></button></div><p><b>Керування блоками головної сторінки</b></p><div className="feature-switches">{[['bestsellers','Хіти продажів'],['deals','Акції та знижки'],['recommendations','Персональні рекомендації (підготовка)'],['recent','Нещодавно переглянуті'],['smart','Розумний підбір']].map(([k,label])=><label key={k}><input type="checkbox" checked={!!featureSettings[k]} onChange={()=>toggleFeature(k)}/>{label}</label>)}</div><p>Іконка сайту (favicon)</p><div className="icon-preview"><img src={siteIcon} alt="Поточна іконка"/> <span>Поточна іконка amazonsan</span></div><label className="upload-label"><ImagePlus size={17}/> Завантажити нову іконку<input type="file" accept="image/png,image/svg+xml,image/x-icon" onChange={e=>{const f=e.target.files?.[0];if(f){const u=URL.createObjectURL(f);setSiteIcon(u);notify('Попередній перегляд іконки оновлено. Для постійної заміни заміни public/favicon.svg у файлах сайту.')}}}/></label><p className="muted">Поточна версія підтримує попередній перегляд. Для публікації нової іконки заміни favicon.svg та icon.svg у проєкті й опублікуй оновлення.</p></div></div>}
  {notice&&<div className="toast"><Check size={17}/>{notice}</div>}
  {!configured&&<div className="demo-ribbon"><Info size={14}/> ДЕМО-РЕЖИМ · ПІДКЛЮЧИ SUPABASE ДЛЯ ПОВНОЇ РОБОТИ</div>}
 </div>
}
export default App
