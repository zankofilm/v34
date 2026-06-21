const SECRET_KEY = "JAVANROOD_NGO_CLIENT_ACTIVATION_SECRET_V1";
const MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const APP_BUILD = "JAVANROOD_CLIENT_MOBILE_V34_EXPORT_PICKER_FULLSCREEN";

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();

function showFatalError(err){
  const msg = (err && (err.message || err.stack)) ? (err.stack || err.message) : String(err || "خطای نامشخص");
  document.body.innerHTML = `<div style="direction:rtl;font-family:Tahoma,Arial,sans-serif;min-height:100vh;margin:0;background:#eef3f7;color:#122033;padding:24px;box-sizing:border-box">
    <div style="max-width:760px;margin:40px auto;background:#fff;border:1px solid #d8e1ea;border-radius:24px;padding:24px;box-shadow:0 18px 50px rgba(10,37,64,.16)">
      <h1 style="margin:0 0 10px;font-size:22px;color:#b42318">خطای داخلی در اجرای برنامه</h1>
      <p style="line-height:1.9;color:#66758a">برای عیب‌یابی، متن زیر را نگه دارید.</p>
      <pre style="white-space:pre-wrap;direction:ltr;text-align:left;background:#0b1220;color:#d7e2f2;border-radius:16px;padding:16px;overflow:auto">${String(msg).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</pre>
    </div>
  </div>`;
}
window.addEventListener('error', e => showFatalError(e.error || e.message));
window.addEventListener('unhandledrejection', e => showFatalError(e.reason || e));


let state = loadState();
state.licenses = state.licenses || [];
state.attachments = state.attachments || [];
state.documents = state.documents || [];
state.beneficiaryPaymentFiles = state.beneficiaryPaymentFiles || [];
let currentPage = state.activated ? "login" : "activation";
try{ syncCeoBoardMember(false); }catch(e){}

function defaultState(){
  return {
    activated:false,
    activation:null,
    initialSetupCompleted:false,
    lockedBaseInfo:{},
    boardMembers:[],
    license:{},
    licenses:[],
    monthlyReports:[],
    financeCarryovers:{},
    currentExpenses:[],
    bankAccounts:[],
    beneficiaries:[],
    beneficiaryPaymentFiles:[],
    documents:[],
    attachments:[]
  };
}
function loadState(){
  try{
    return Object.assign(defaultState(), JSON.parse(localStorage.getItem("javanrood_mobile_state") || "{}"));
  }catch(e){ return defaultState(); }
}
function saveState(){
  try{
    localStorage.setItem("javanrood_mobile_state", JSON.stringify(state));
  }catch(e){
    console.error(e);
    notify("خطا در ذخیره اطلاعات. احتمالاً حجم فایل انتخابی زیاد است. لطفاً تصویر را کوچک‌تر کنید یا PDF سبک‌تری انتخاب کنید.");
    throw e;
  }
}
function notify(msg){ alert(msg); }
function ensureCeoBoardMember(){
  const info = state.lockedBaseInfo || {};
  const fullName = String(info.ceoFullName || "").trim();
  const nationalCode = String(info.nationalCode || "").trim();
  if(!fullName || !nationalCode) return false;
  state.boardMembers = Array.isArray(state.boardMembers) ? state.boardMembers : [];
  const autoItem = {
    fullName,
    nationalCode,
    role:"مدیرعامل",
    phone:String(info.phone || "").trim(),
    source:"activation_ceo",
    auto:true,
    locked:true,
    createdAt: nowIso()
  };
  const idx = state.boardMembers.findIndex(x =>
    String(x.source||"") === "activation_ceo" ||
    (String(x.nationalCode||"").trim() === nationalCode && String(x.role||"").trim() === "مدیرعامل")
  );
  if(idx >= 0){
    const before = JSON.stringify(state.boardMembers[idx]);
    state.boardMembers[idx] = {...state.boardMembers[idx], ...autoItem, createdAt: state.boardMembers[idx].createdAt || autoItem.createdAt};
    return before !== JSON.stringify(state.boardMembers[idx]);
  }
  state.boardMembers.unshift(autoItem);
  return true;
}
function syncCeoBoardMember(save=false){
  const changed = ensureCeoBoardMember();
  if(changed && save){ try{ saveState(); }catch(e){} }
  return changed;
}
function boardMemberRows(){
  syncCeoBoardMember(false);
  return state.boardMembers.map((m,i)=>[
    m.fullName,
    m.nationalCode,
    m.role,
    m.phone,
    m.source === "activation_ceo" ? '<span class="locked-badge">خودکار از فعال‌سازی</span>' : actionBtn("delMember",i)
  ]);
}
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function nowIso(){ return new Date().toISOString(); }
function toInt(v){
  const s = String(v || "0")
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return parseInt(s.replace(/[^\d-]/g,"") || "0",10);
}
function money(v){ return toFaDigits(toInt(v).toLocaleString("en-US")) + " ریال"; }
function toFaDigits(v){
  return String(v ?? "").replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
}
function toFa(v){
  return toFaDigits(v);
}
function formatRialInputValue(v){
  const raw = normDigitsAll(String(v || "")).replace(/[^\d]/g, "");
  if(!raw) return "";
  return toFaDigits(parseInt(raw, 10).toLocaleString("en-US"));
}

function bindFileInputWatchers(){
  const pay = $("beneficiaryPaymentFile");
  if(pay && !pay.dataset.boundAnalyze){
    pay.dataset.boundAnalyze = "1";
    pay.addEventListener("change", autoAnalyzeBeneficiaryPaymentFile);
  }
}

function bindRialInputs(){
  document.querySelectorAll("input.rial-input").forEach(inp=>{
    if(!inp.dataset.rialBound){
      inp.dataset.rialBound = "1";
      inp.addEventListener("input", ()=>{
        inp.value = formatRialInputValue(inp.value);
        if(typeof refreshFinanceTotals === "function") setTimeout(refreshFinanceTotals, 0);
      });
      inp.addEventListener("blur", ()=>{ inp.value = formatRialInputValue(inp.value); });
    }
    inp.value = formatRialInputValue(inp.value);
  });
}
function normDigitsAll(s){
  s = String(s || "");
  "۰۱۲۳۴۵۶۷۸۹".split("").forEach((ch,i)=>s=s.replaceAll(ch,String(i)));
  "٠١٢٣٤٥٦٧٨٩".split("").forEach((ch,i)=>s=s.replaceAll(ch,String(i)));
  return s;
}
function findCurrentExpense(year, month){
  return state.currentExpenses.find(x => String(x.year) === String(year) && x.month === month) || null;
}
function sumAccountDeposits(list){
  return (list || []).reduce((a,b)=> a + toInt(b.amount), 0);
}
function monthKey(year, month){ return normDigitsAll(year||"") + "_" + String(month||""); }
function currentJalaliDate(){
  const d = new Date();
  let gy = d.getFullYear(), gm = d.getMonth()+1, gd = d.getDate();
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365*gy + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) - 80 + gd + gdm[gm-1];
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if(days > 365){ jy += Math.floor((days-1)/365); days = (days-1) % 365; }
  let jm, jd;
  if(days < 186){ jm = 1 + Math.floor(days/31); jd = 1 + (days % 31); }
  else { jm = 7 + Math.floor((days-186)/30); jd = 1 + ((days-186) % 30); }
  return {jy,jm,jd, year:toFaDigits(jy), month:MONTHS[jm-1]};
}
function currentJalaliYear(){ return currentJalaliDate().year; }
function currentJalaliMonthName(){ return currentJalaliDate().month; }
function nextFinanceMonth(year, month){
  const normalizedYear = toInt(year);
  const idx = MONTHS.indexOf(month);
  if(idx < 0) return {year:toFaDigits(normalizedYear), month};
  if(idx === 11) return {year:toFaDigits(normalizedYear + 1), month:MONTHS[0]};
  return {year:toFaDigits(normalizedYear), month:MONTHS[idx+1]};
}
function getStoredCarryover(year, month){
  const map = state.financeCarryovers || {};
  return toInt(map[monthKey(year, month)] || 0);
}
function setStoredCarryover(year, month, amount){
  state.financeCarryovers = state.financeCarryovers || {};
  state.financeCarryovers[monthKey(year, month)] = toInt(amount);
}
function applyCarryoverForSelectedMonth(){
  if(!$('finYear') || !$('finMonth') || !$('prevCarry')) return;
  const amount = getStoredCarryover($('finYear').value.trim(), $('finMonth').value);
  $('prevCarry').value = amount ? toFaDigits(amount.toLocaleString('en-US')) : '';
}

function canonicalJson(obj){
  if(obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if(Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}
async function sha256Hex(text){
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function base64Url(bytes){
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function hmacSignature(payload){
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET_KEY), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(canonicalJson(payload)));
  return base64Url(new Uint8Array(sig));
}
function normalizeSignature(sig){
  return String(sig || "").trim().replace(/=+$/g, "");
}
async function verifyActivation(data){
  if(!data || data.type !== "JAVANROOD_CLIENT_ACTIVATION") return false;
  if(!data.payload || !data.signature) return false;
  const expected = normalizeSignature(await hmacSignature(data.payload));
  const received = normalizeSignature(data.signature);
  return expected === received;
}
async function passwordHash(password, salt){
  return sha256Hex((salt||"") + "::" + (password||""));
}

function parseFileInput(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file, "utf-8");
  });
}
function readFileAsArrayBuffer(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}
function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function compressImageFileToDataUrl(file){
  const original = await readFileAsDataUrl(file);
  if(!String(file.type || "").startsWith("image/")) return {dataUrl:original, mime:file.type || "application/octet-stream", name:file.name, size:file.size};
  return await new Promise((resolve)=>{
    const img = new Image();
    img.onload = () => {
      try{
        const maxSide = 1600;
        let w = img.naturalWidth || img.width || 1;
        let h = img.naturalHeight || img.height || 1;
        const scale = Math.min(1, maxSide / Math.max(w,h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", .82);
        const baseName = String(file.name || "image").replace(/\.[^.]+$/, "");
        resolve({dataUrl, mime:"image/jpeg", name:baseName + ".jpg", size:Math.round((dataUrl.length * 3) / 4)});
      }catch(e){ resolve({dataUrl:original, mime:file.type || "image/*", name:file.name, size:file.size}); }
    };
    img.onerror = () => resolve({dataUrl:original, mime:file.type || "image/*", name:file.name, size:file.size});
    img.src = original;
  });
}
async function fileToAttachment(file, title, docType){
  const prepared = await compressImageFileToDataUrl(file);
  const dataUrl = String(prepared.dataUrl || "");
  const base64 = dataUrl.split(",")[1] || "";
  return {
    id:"att_"+Date.now()+"_"+Math.random().toString(16).slice(2),
    title:title || prepared.name || file.name,
    docType:docType || "پیوست",
    name:prepared.name || file.name,
    mime:prepared.mime || file.type || "application/octet-stream",
    size:prepared.size || file.size,
    base64,
    createdAt:nowIso(),
    path:prepared.name || file.name
  };
}

function attachmentById(id){
  let found = (state.attachments || []).find(a=>a.id===id) || (state.documents || []).find(a=>a.id===id) || null;
  if(found) return found;
  const lic = state.license || {};
  if(id && (id === "license_inline" || id === lic.attachmentId) && lic.attachmentBase64){
    return {
      id: lic.attachmentId || "license_inline",
      title: "اسکن مجوز",
      docType: "مجوز",
      name: lic.attachmentName || lic.scanPath || "license",
      mime: lic.attachmentMime || "application/octet-stream",
      size: lic.attachmentSize || 0,
      base64: lic.attachmentBase64,
      createdAt: lic.savedAt || lic.createdAt || nowIso(),
      path: lic.scanPath || lic.attachmentName || "license"
    };
  }
  return null;
}
function dataUrlForAttachment(att){
  if(!att || !att.base64) return "";
  return `data:${att.mime || "application/octet-stream"};base64,${att.base64}`;
}
function attachmentPreviewHtml(att, compact=false){
  if(!att) return `<div class="notice warn">فایلی ثبت نشده است.</div>`;
  const name = esc(att.name || att.path || att.title || "فایل");
  const mime = String(att.mime || "");
  const id = esc(att.id || "");
  const size = att.size ? ` | حجم: ${toFaDigits(Number(att.size).toLocaleString("en-US"))} بایت` : "";
  const head = `<div class="attachment-head"><b>${name}</b><span>${esc(mime || "نوع نامشخص")}${size}</span></div>`;
  const actions = `<div class="attachment-actions"><button class="primary" onclick="viewAttachment('${id}')">نمایش</button><button class="success" onclick="saveAttachment('${id}')">ذخیره فایل</button></div>`;
  if(mime.startsWith("image/") && att.base64){
    return `<div class="attachment-preview ${compact?"compact":""}">${head}<img src="${dataUrlForAttachment(att)}" alt="${name}">${actions}</div>`;
  }
  if(mime === "application/pdf"){
    return `<div class="attachment-preview file-only pdf-file">${head}<div class="file-badge">PDF</div>${actions}<p class="sub">برای نمایش PDF در گوشی، دکمه «نمایش» یا «ذخیره فایل» را بزنید.</p></div>`;
  }
  return `<div class="attachment-preview file-only">${head}<div class="file-badge">FILE</div>${actions}</div>`;
}
function licenseAttachment(licArg){
  const lic = licArg || state.license || {};
  let att = lic.attachmentId ? attachmentById(lic.attachmentId) : null;
  if(att) return att;
  const list = state.attachments || [];
  att = list.find(a => a.id === lic.attachmentId)
     || list.find(a => lic.scanPath && String(a.name||a.path||"") === String(lic.scanPath))
     || list.find(a => String(a.docType||"").includes("مجوز"))
     || list.find(a => String(a.title||"").includes("مجوز") || String(a.name||"").includes("مجوز"));
  if(att){
    if(!licArg){
      state.license.attachmentId = att.id;
      state.license.scanPath = state.license.scanPath || att.name || att.path || att.title || "مجوز";
      try{ saveState(); }catch(e){}
    }
    return att;
  }
  if(lic.attachmentBase64){
    return {
      id: lic.attachmentId || "license_inline",
      title: "اسکن مجوز",
      docType: "مجوز",
      name: lic.attachmentName || lic.scanPath || "license",
      mime: lic.attachmentMime || "application/octet-stream",
      size: lic.attachmentSize || 0,
      base64: lic.attachmentBase64,
      createdAt: lic.savedAt || lic.createdAt || nowIso(),
      path: lic.scanPath || lic.attachmentName || "license"
    };
  }
  return null;
}
function hasLicenseRecord(){
  const lic = state.license || {};
  return !!(lic.issueDate || lic.renewalDate || lic.expiryDate || lic.attachmentId || lic.attachmentBase64 || lic.scanPath || licenseAttachmentsList().length);
}

function licenseAttachmentsList(){
  const lic = state.license || {};
  const items = (state.attachments || []).filter(a =>
    (lic.attachmentId && a.id === lic.attachmentId) ||
    String(a.docType||"").includes("مجوز") ||
    String(a.title||"").includes("مجوز")
  );
  const map = new Map();
  items.forEach(a=>{ if(a && a.id) map.set(a.id, a); });
  const main = licenseAttachment();
  if(main && main.id) map.set(main.id, main);
  return Array.from(map.values()).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
}
function viewAttachment(id){
  const att = attachmentById(id);
  if(!att || !att.base64) return notify("فایل برای نمایش در حافظه برنامه پیدا نشد. دوباره فایل را بارگذاری کنید.");
  const name = att.name || att.path || att.title || "attachment";
  const mime = att.mime || "application/octet-stream";
  if(window.AndroidBridge && AndroidBridge.openBase64File){
    const ok = AndroidBridge.openBase64File(name, mime, att.base64);
    if(ok) return;
  }
  const url = dataUrlForAttachment(att);
  if(String(mime).startsWith("image/")){
    document.body.insertAdjacentHTML("beforeend", `<div class="file-modal" onclick="this.remove()"><div class="file-modal-box" onclick="event.stopPropagation()"><button class="danger modal-close" onclick="this.closest('.file-modal').remove()">بستن</button><img src="${url}" alt="${esc(name)}"></div></div>`);
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.click();
  }
}
function saveAttachment(id){
  const att = attachmentById(id);
  if(!att || !att.base64) return notify("فایل برای ذخیره پیدا نشد.");
  saveBase64File(att.name || att.path || att.title || "attachment", att.mime || "application/octet-stream", att.base64);
}
function triggerFileInput(id){
  const el = $(id);
  if(el) el.click();
}

function render(){
  if(currentPage === "activation") return renderActivation();
  if(currentPage === "login") return renderLogin();
  if(currentPage === "setup") return renderSetup();
  if(currentPage === "office") return renderOffice();
  if(currentPage === "board") return renderBoardPage();
  if(currentPage === "ngoInfo") return renderNgoInfoPage();
  if(currentPage === "finance") return renderFinancePage();
  if(currentPage === "expenses") return renderExpensesPage();
  if(currentPage === "bank") return renderBankPage();
  if(currentPage === "beneficiaries") return renderBeneficiaryPage();
  if(currentPage === "documents") return renderDocumentsPage();
  return renderOffice();
}
function pageMeta(){
  const map = {
    activation:["فعال‌سازی رسمی", "بارگذاری فایل مجوز صادرشده از پنل ادمین", "▣"],
    login:["ورود کاربر مجاز", "احراز هویت مدیرعامل / کاربر فعال‌شده", "◉"],
    setup:["اطلاعات پایه سمن", "ثبت هیأت مدیره، مجوز و مشخصات اولیه", "◈"],
    office:["داشبورد", "منوی اصلی کلاینت سمن و دسترسی سریع به بخش‌ها", "▦"],
    board:["اطلاعات هیأت مدیره سمن", "ثبت و مدیریت اسامی اعضای هیأت مدیره", "👥"],
    ngoInfo:["ثبت اطلاعات سمن", "مشخصات پایه، مدیرعامل و مجوز سمن", "🏛"],
    finance:["مالی سمن", "جمع‌آوری سمن، فایل واریزی، شمارش افراد و محاسبه ماهانه", "💰"],
    expenses:["هزینه‌های جاری", "ثبت هزینه‌های جاری ماهانه خارج از صفحه مالی", "🧾"],
    bank:["حساب سمن", "ثبت شماره حساب‌ها برای ساخت فیلد واریزی در مالی", "🏦"],
    beneficiaries:["مددجو / ذی‌نفعان", "ثبت اطلاعات مددجویان و ذی‌نفعان", "🤝"],
    documents:["مدارک و پیوست‌ها", "ثبت و نگهداری مدارک مستقل از مالی", "📎"]
  };
  return map[currentPage] || map.office;
}
function menuItems(){
  return [["board","هیأت مدیره","board"],["ngoInfo","ثبت اطلاعات سمن","ngoInfo"],["office","داشبورد","home"],["finance","مالی سمن","finance"],["login","خروج","logout"]];
}

function govOfficialHeader(){
  return `<div class="gov-official-header gov-letterhead" aria-label="سربرگ رسمی">
    <img class="gov-header-hero" src="gov_header_flag.png" alt="سربرگ رسمی جمهوری اسلامی ایران">
  </div>`;
}

function iconSvg(name){
  const map = {
    home:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.8V21h13V9.8"/><path d="M9.2 21v-6.2h5.6V21"/></svg>`,
    board:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8.2" r="2.7"/><circle cx="16" cy="8.2" r="2.7"/><path d="M3.7 18.7c.8-2.5 2.8-3.9 5.6-3.9s4.8 1.4 5.6 3.9"/><path d="M12.1 18.7c.7-2.2 2.3-3.3 4.7-3.3 1.9 0 3.5.8 4.5 2.3"/></svg>`,
    ngoInfo:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5h6.4L19 8.1V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 20V5A1.5 1.5 0 0 1 8.5 3.5Z"/><path d="M14.2 3.7V8h4.2"/><path d="M10 11.2h6"/><path d="M10 14.8h6"/><path d="M10 18.2h4.2"/></svg>`,
    finance:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.4A2.4 2.4 0 0 1 6.4 5h10.9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.8A2.8 2.8 0 0 1 4 16.2Z"/><path d="M4.6 8.6h12.2a2.3 2.3 0 0 1 0 4.6H4.6"/><circle cx="15.7" cy="10.9" r=".8"/></svg>`,
    logout:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 7V5.2A2.2 2.2 0 0 0 11.8 3H6.2A2.2 2.2 0 0 0 4 5.2v13.6A2.2 2.2 0 0 0 6.2 21h5.6a2.2 2.2 0 0 0 2.2-2.2V17"/><path d="M10 12h10"/><path d="m16.5 8.5 3.5 3.5-3.5 3.5"/></svg>`,
    bank:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.1 12 4l9 5.1"/><path d="M5 10.2h14"/><path d="M6.3 10.2v7.8"/><path d="M10.8 10.2v7.8"/><path d="M15.3 10.2v7.8"/><path d="M19 10.2V18"/><path d="M3 20h18"/></svg>`,
    expenses:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 3.5h9A2.5 2.5 0 0 1 19 6v12.8l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V6a2.5 2.5 0 0 1 2.5-2.5Z"/><path d="M9 8.4h6"/><path d="M9 12h6"/><path d="M9 15.6h3.6"/></svg>`,
    beneficiaries:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3s-6.8-3.8-8.6-7.8A4.5 4.5 0 0 1 11 8.3l1 1 1-1a4.5 4.5 0 0 1 7.6 4.2C18.8 16.5 12 20.3 12 20.3Z"/><path d="M8.2 10.7c.4 1.4 1.3 2.4 2.8 2.8"/></svg>`,
    documents:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6.2L20 8.8V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M15.1 4.2V9H20"/><path d="M10 12.3h5.7"/><path d="M10 15.7h5.7"/></svg>`
  };
  return `<span class="svg-icon svg-${name}">${map[name] || map.home}</span>`;
}

function dashTitleWords(title){
  return String(title || "").trim().split(/\s+/).filter(Boolean).map(w=>`<span>${esc(w)}</span>`).join(" ");
}

function shell(content, nav=true){
  const [title, subtitle, icon] = pageMeta();
  const info = state.lockedBaseInfo || {};
  if(!nav){
    document.body.innerHTML = `<div class="final-auth-shell">
      <aside class="final-auth-brand">
        <div class="gov-emblem">س</div>
        <div class="gov-kicker">فرمانداری شهرستان جوانرود</div>
        <h1>سامانه سمن‌های مردم‌نهاد</h1>
        <p>کلاینت رسمی برای ثبت اطلاعات مالی، مددجویان، مدارک و خروجی قابل ارسال به ادمین.</p>
        <div class="brand-stats"><span>آفلاین</span><span>امن</span><span>سازمانی</span></div>
      </aside>
      <main class="final-auth-content">
        ${govOfficialHeader()}
        <div class="mobile-brand-line"><b>سمن‌های جوانرود</b><span>کلاینت رسمی</span></div>
        <section class="final-auth-card">
          <div class="final-page-head"><span>${icon}</span><div><h1>${title}</h1><p>${subtitle}</p></div></div>
          ${content}
        </section>
      </main>
    </div>`;
    setTimeout(()=>{ bindRialInputs(); bindFileInputWatchers(); }, 0);
    return;
  }
  document.body.innerHTML = `<div class="final-dashboard-shell">
    <aside class="final-sidebar">
      <div class="side-logo"><div class="gov-emblem small"><img src="gov_header_flag.png" alt="سربرگ"></div><div><b>سمن‌های جوانرود</b><span>Client Console</span></div></div>
      <nav class="side-menu">${menuItems().map(([p,t,ic])=>`<button class="${currentPage===p?'active':''}" onclick="nav('${p}')"><b>${iconSvg(ic)}</b><span>${t}</span></button>`).join("")}</nav>
      <div class="side-org"><small>سمن فعال</small><b>${esc(info.organizationName||"ثبت نشده")}</b><span>${esc(info.ceoFullName||"مدیرعامل ثبت نشده")}</span></div>
    </aside>
    <main class="final-workspace">
      <header class="final-topbar official-topbar">
        ${govOfficialHeader()}
        <div class="topbar-page-row">
          <div class="final-page-head compact"><span>${icon}</span><div><h1>${title}</h1><p>${subtitle}</p></div></div>
          <div class="top-status"><small>وضعیت برنامه</small><b>آماده ثبت اطلاعات</b></div>
        </div>
      </header>
      <section class="final-content">${content}</section>
    </main>
  </div>${nav ? navbar() : ""}`;
  setTimeout(()=>{ bindRialInputs(); bindFileInputWatchers(); }, 0);
}
function navbar(){
  if(!state.activated || currentPage === "activation" || currentPage === "login") return "";
  return `<div class="final-mobile-nav">${menuItems().map(([p,t,ic])=>`<button class="${currentPage===p?'active':''}" onclick="nav('${p}')"><b>${iconSvg(ic)}</b><span>${t}</span></button>`).join("")}</div>`;
}
function nav(page){
  if(page === "login"){ currentPage="login"; render(); return; }
  if(page === "check"){ showChecklist(); return; }
  currentPage = page;
  render();
}
function renderCurrentSection(){
  if(["office","board","ngoInfo","finance","expenses","bank","beneficiaries","documents","setup"].includes(currentPage)) return render();
  return renderOffice();
}

function renderActivation(){
  shell(`
    <div class="final-form-panel activation-panel">
      <div class="panel-label">مرحله ۱ از ۲</div>
      <h2>ورود فایل فعال‌سازی رسمی</h2>
      <p class="form-intro">فایل فعال‌سازی صادرشده از پنل ادمین را انتخاب کنید تا دسترسی این کلاینت ثبت شود.</p>
      <label class="file-drop">انتخاب فایل فعال‌سازی
        <input id="actFile" type="file" accept=".jvnact,.json">
        <span>فایل .jvnact یا JSON صادرشده از پنل ادمین</span>
      </label>
      <div class="actions final-actions"><button class="primary big" onclick="activateFromFile()">بررسی و ثبت فعال‌سازی</button></div>
      <div class="mini-help">بعد از فعال‌سازی، ورود با کد ملی، نام کاربری و رمز عبور انجام می‌شود.</div>
    </div>
  `, false);
}
async function activateFromFile(){
  const f = $("actFile").files[0];
  if(!f) return notify("فایل فعال‌سازی را انتخاب کنید.");
  try{
    const text = await parseFileInput(f);
    const data = JSON.parse(text);
    const ok = await verifyActivation(data);
    if(!ok) return notify("فایل فعال‌سازی معتبر نیست یا دستکاری شده است.");
    const p = data.payload || {};
    const required = ["organizationName","ceoFullName","nationalCode","phone","username","passwordHash","passwordSalt"];
    const missing = required.filter(k => !String(p[k]||"").trim());
    if(missing.length) return notify("فایل فعال‌سازی ناقص است: " + missing.join(", "));
    state.activated = true;
    state.activation = data;
    state.lockedBaseInfo = {
      organizationName:p.organizationName,
      ceoFullName:p.ceoFullName,
      nationalCode:p.nationalCode,
      phone:p.phone,
      username:p.username
    };
    syncCeoBoardMember(false);
    saveState();
    currentPage = "login";
    render();
    notify("فعال‌سازی ثبت شد. اکنون وارد شوید.");
  }catch(e){ notify("خطا در خواندن فایل فعال‌سازی: " + e.message); }
}

function renderLogin(){
  const info = state.lockedBaseInfo || {};
  shell(`
    <div class="final-form-panel login-panel">
      <div class="panel-label">ورود امن</div>
      <h2>${esc(info.organizationName||"کلاینت سمن")}</h2>
      <p class="form-intro">برای ورود، کد ملی مدیرعامل، نام کاربری و رمز عبور ثبت‌شده در فایل فعال‌سازی را وارد کنید.</p>
      <div class="grid auth-grid">
        <div><label>کد ملی مدیرعامل</label><input id="loginNational" value="${esc(info.nationalCode||"")}"></div>
        <div><label>نام کاربری</label><input id="loginUser" value="${esc(info.username||"")}"></div>
        <div><label>رمز ورود</label><input id="loginPass" type="password"></div>
      </div>
      <div class="actions final-actions">
        <button class="primary big" onclick="doLogin()">ورود به داشبورد</button>
        <button class="danger" onclick="resetActivation()">تعویض فعال‌سازی</button>
      </div>
    </div>
  `, false);
}
async function doLogin(){
  const p = (state.activation||{}).payload || {};
  const national = $("loginNational").value.trim();
  const user = $("loginUser").value.trim();
  const pass = $("loginPass").value;
  if(national !== p.nationalCode) return notify("کد ملی اشتباه است.");
  if(user !== p.username) return notify("نام کاربری اشتباه است.");
  const hash = await passwordHash(pass, p.passwordSalt);
  if(hash !== p.passwordHash) return notify("رمز ورود اشتباه است.");
  currentPage = state.initialSetupCompleted ? "office" : "setup";
  render();
}
function resetActivation(){
  if(confirm("فعال‌سازی فعلی حذف شود؟")){
    state = defaultState();
    saveState();
    currentPage="activation";
    render();
  }
}

function renderSetup(){
  syncCeoBoardMember(false);
  const info = state.lockedBaseInfo || {};
  const lic = state.license || {};
  shell(`
    <div class="section-hero"><span>◈</span><div><h1>راه‌اندازی اولیه و اطلاعات پایه</h1><p>اطلاعات پایه سازمان، اعضای هیأت مدیره و وضعیت مجوز را به صورت رسمی تکمیل نمایید.</p></div></div>
    <div class="card">
      <h2 class="title">اطلاعات پایه</h2>
      <p class="sub">
        نام سمن: <b>${esc(info.organizationName||"")}</b><br>
        مدیرعامل: <b>${esc(info.ceoFullName||"")}</b><br>
        کد ملی: <b>${esc(info.nationalCode||"")}</b><br>
        شماره تماس: <b>${esc(info.phone||"")}</b>
      </p>
    </div>
    <div class="card">
      <h2 class="title">هیأت مدیره</h2>
      <div class="grid">
        <div><label>نام و نام خانوادگی</label><input id="memberName"></div>
        <div><label>کد ملی</label><input id="memberNational"></div>
        <div><label>سمت</label><input id="memberRole"></div>
        <div><label>شماره تماس</label><input id="memberPhone"></div>
      </div>
      <div class="actions"><button class="primary" onclick="addMember()">افزودن عضو</button></div>
      ${tableHtml(["نام","کد ملی","سمت","تلفن","عملیات"], boardMemberRows())}
    </div>
    <div class="card">
      <h2 class="title">مجوز سمن</h2>
      <div class="grid">
        <div><label>تاریخ صدور</label><input id="issueDate" value="${esc(lic.issueDate||"")}" placeholder="۱۴۰۴/۰۱/۱۵"></div>
        <div><label>تاریخ تمدید</label><input id="renewalDate" value="${esc(lic.renewalDate||"")}" placeholder="۱۴۰۴/۰۲/۱۰"></div>
        <div><label>مدت مجوز به ماه</label><input id="durationMonths" value="${esc(lic.durationMonths||"")}" placeholder="۱۲"></div>
        <div><label>اسکن / تصویر مجوز</label><input id="licenseFile" type="file" accept="image/*,.pdf"></div>
      </div>
      <div class="notice ${lic.status==='منقضی شده'?'bad':(lic.status==='نزدیک انقضا'?'warn':'good')}">
        تاریخ انقضا: ${esc(lic.expiryDate||"محاسبه نشده")} | باقی‌مانده: ${esc(lic.remainingDays??"")} روز | وضعیت: ${esc(lic.status||"")}
      </div>
      <div class="actions">
        <button class="orange" onclick="calculateAndSaveLicense(false)">محاسبه مجوز</button>
        <button class="success" onclick="saveInitialSetup()">ذخیره تکمیل اولیه</button>
      </div>
    </div>
  `);
}

function addMember(){
  const item = {
    fullName:$("memberName").value.trim(),
    nationalCode:$("memberNational").value.trim(),
    role:$("memberRole").value.trim(),
    phone:$("memberPhone").value.trim()
  };
  if(!item.fullName || !item.nationalCode || !item.role) return notify("نام، کد ملی و سمت الزامی است.");
  if(state.boardMembers.some(x=>x.nationalCode===item.nationalCode && x.role===item.role)) return notify("این عضو قبلاً ثبت شده است.");
  state.boardMembers.push(item); saveState(); renderCurrentSection();
}
function delMember(i){
  const item = state.boardMembers[i];
  if(item && item.source === "activation_ceo") return notify("رکورد مدیرعامل از فایل فعال‌سازی به‌صورت خودکار ثبت شده و قابل حذف دستی نیست.");
  if(confirm("حذف شود؟")){ state.boardMembers.splice(i,1); syncCeoBoardMember(false); saveState(); renderCurrentSection(); }
}

async function calculateAndSaveLicense(includeFile){
  const issue = $("issueDate").value.trim();
  const renewal = $("renewalDate").value.trim();
  const duration = parseInt($("durationMonths").value.trim()||"0",10);
  if(!issue || !renewal || !duration) throw new Error("تاریخ صدور، تاریخ تمدید و مدت مجوز الزامی است.");
  const exp = licenseExpiryInfo(renewal, duration);
  let old = state.license || {};
  state.license = {
    ...old,
    issueDate:issue,
    renewalDate:renewal,
    durationMonths:String(duration),
    expiryDate:exp.expiryDate,
    remainingDays:exp.remainingDays,
    status:exp.status,
  };
  const fileInput = $("licenseFile");
  const cameraInput = $("licenseCameraFile");
  const file = (fileInput && fileInput.files && fileInput.files[0]) || (cameraInput && cameraInput.files && cameraInput.files[0]);
  if(file){
    const att = await fileToAttachment(file, "اسکن مجوز", "مجوز");
    state.license.scanPath = att.name || file.name;
    if(state.license.attachmentId){
      state.attachments = state.attachments.filter(x=>x.id !== state.license.attachmentId);
    }
    state.license.attachmentId = att.id;
    state.license.attachmentName = att.name;
    state.license.attachmentMime = att.mime;
    state.license.attachmentSize = att.size;
    state.license.attachmentBase64 = att.base64;
    state.attachments = state.attachments.filter(x=>x.id !== att.id);
    state.attachments.push(att);
    const licenseDoc = {...att, title:"مجوز سمن", docType:"مجوز سمن", source:"license", locked:true};
    state.documents = (state.documents || []).filter(x => x.id !== att.id && !(String(x.docType||"").includes("مجوز") && String(x.source||"") === "license"));
    state.documents.unshift(licenseDoc);
  }
  state.license.savedAt = nowIso();
  try{ syncLicenseDocumentRecord(); }catch(e){}
  state.licenses = state.licenses || [];
  const existingIdx = state.licenses.findIndex(x => String(x.expiryDate||"") === String(state.license.expiryDate||"") && String(x.renewalDate||"") === String(state.license.renewalDate||""));
  const licenseSnapshot = {...state.license};
  if(existingIdx >= 0) state.licenses[existingIdx] = licenseSnapshot;
  else state.licenses.unshift(licenseSnapshot);
  state.licenses = state.licenses.slice(0, 10);
  saveState();
  if(!includeFile){ renderCurrentSection(); notify("اطلاعات سمن و مجوز ذخیره شد و رکورد آن پایین صفحه نمایش داده شد."); }
  return state.license;
}
async function saveInitialSetup(){
  try{
    syncCeoBoardMember(false);
    if(!state.boardMembers.length) return notify("حداقل یک عضو هیأت مدیره ثبت کنید.");
    await calculateAndSaveLicense(true);
    if(!state.license.scanPath && !state.license.attachmentId) return notify("اسکن یا تصویر مجوز را انتخاب کنید.");
    state.initialSetupCompleted = true;
    saveState();
    currentPage = "office";
    render();
    notify("تکمیل اولیه ذخیره شد. از این به بعد صفحه پیش‌فرض داشبورد اصلی است.");
  }catch(e){ notify(e.message); }
}

function renderOffice(){
  const info = state.lockedBaseInfo || {};
  const lic = state.license || {};
  const totalCurrentExpenses = state.currentExpenses.reduce((a,b)=>a+toInt(b.total),0);
  const totalReports = state.monthlyReports.reduce((a,b)=>a+toInt(b.totalInflow),0);
  const lastReport = state.monthlyReports[state.monthlyReports.length-1] || null;
  shell(`
    <div class="dashboard-main-grid pro-main-grid">
      ${dashboardPrimaryCard("board","board","اطلاعات هیأت مدیره سمن","مشاهده و مدیریت اطلاعات اعضای هیأت مدیره سمن","blue")}
      ${dashboardPrimaryCard("ngoInfo","ngoInfo","ثبت اطلاعات سمن","ثبت و به‌روزرسانی اطلاعات سمن و مدارک مرتبط","blue")}
      ${dashboardPrimaryCard("finance","finance","مالی سمن","مشاهده وضعیت مالی، گزارش‌ها و تراکنش‌های سمن","gold")}
      ${dashboardPrimaryCard("login","logout","خروج","بازگشت به صفحه ورود و خروج از حساب کاربری","red")}
    </div>

    <div class="dashboard-pro-subhead">بخش‌های تکمیلی داشبورد</div>
    <div class="quick-icon-grid pro-quick-grid">
      ${dashboardMiniCard("bank","bank","حساب سمن",`${state.bankAccounts.length} حساب`)}
      ${dashboardMiniCard("expenses","expenses","هزینه‌های جاری",`${state.currentExpenses.length} رکورد`)}
      ${dashboardMiniCard("beneficiaries","beneficiaries","مددجو / ذی‌نفعان",`${state.beneficiaries.length} نفر`)}
      ${dashboardMiniCard("documents","documents","مدارک و پیوست‌ها",`${documentDisplayItems().length} فایل`)}
    </div>

    <div class="dashboard-kpis pro-kpi-grid">
      <div class="kpi"><strong>${state.monthlyReports.length}</strong><span>گزارش مالی ثبت‌شده</span></div>
      <div class="kpi"><strong>${money(totalReports)}</strong><span>جمع ورودی ثبت‌شده</span></div>
      <div class="kpi"><strong>${money(totalCurrentExpenses)}</strong><span>جمع هزینه‌های جاری</span></div>
      <div class="kpi ${lic.status==='منقضی شده'?'warn':''}"><strong>${lastReport ? money(lastReport.ngoCollectedTotal || lastReport.totalInflow || 0) : "۰ ریال"}</strong><span>آخرین جمع‌آوری سمن</span></div>
    </div>

    <div class="card dashboard-export-card pro-export-card">
      <div class="export-topline"><b>وضعیت مجوز: ${esc(lic.status||"نامشخص")}</b><span>انقضا: ${esc(lic.expiryDate||"-")} | باقی‌مانده: ${esc(lic.remainingDays??"-")} روز</span></div>
      <h2 class="title">خروجی برای ادمین</h2>
      <p class="sub">برای ادمین، خروجی پکیج کامل .jvnpkg بسازید. هنگام خروجی گرفتن، محل ذخیره فایل را خودتان انتخاب می‌کنید.</p>
      <div class="actions">
        <button onclick="showChecklist()">چک‌لیست</button>
        <button onclick="exportJson()">خروجی JSON</button>
        <button class="primary" onclick="exportPackage()">خروجی .jvnpkg</button>
      </div>
    </div>
  `);
}
function dashboardPrimaryCard(page, iconName, title, desc, tone="blue"){
  return `<button class="dashboard-pro-card tone-${tone}" onclick="nav('${page}')"><div class="dash-card-head"><span class="dash-card-icon">${iconSvg(iconName)}</span></div><b class="dash-card-title">${esc(title)}</b><small class="dash-card-desc">${esc(desc)}</small><i class="dash-card-arrow">‹</i></button>`;
}
function dashboardMiniCard(page, iconName, title, count){
  return `<button class="dashboard-mini-card" onclick="nav('${page}')"><span class="mini-card-icon">${iconSvg(iconName)}</span><b class="mini-card-title">${esc(title)}</b><small class="mini-card-desc">${esc(count)}</small></button>`;
}

function dashboardMenuCard(page, icon, title, desc, extraClass=""){
  return `<button class="dashboard-menu-card ${extraClass}" onclick="nav('${page}')"><span>${iconSvg(icon)}</span><b class="dash-title-words">${dashTitleWords(title)}</b><small>${esc(desc)}</small></button>`;
}
function dashboardIcon(page, icon, title, count){
  return `<button class="quick-icon-card" onclick="nav('${page}')"><span>${iconSvg(icon)}</span><b class="dashboard-icon-title dash-title-words">${dashTitleWords(title)}</b><small>${esc(count)}</small></button>`;
}
function renderBoardPage(){
  syncCeoBoardMember(false);
  shell(`
    <div class="section-hero"><span>👥</span><div><h1>اطلاعات هیأت مدیره سمن</h1><p>این بخش فقط برای ثبت اسامی و سمت اعضای هیأت مدیره است.</p></div></div>
    ${boardMembersCard()}
  `);
}
function renderNgoInfoPage(){
  shell(`
    <div class="section-hero"><span>🏛</span><div><h1>ثبت اطلاعات سمن</h1><p>مشخصات پایه و مجوز سمن در این بخش نگهداری می‌شود.</p></div></div>
    ${ngoBaseInfoCard()}
    ${licenseCard()}
    ${ngoSavedRecordCard()}
  `);
}
function renderFinancePage(){
  shell(`
    <div class="section-hero"><span>💰</span><div><h1>مالی سمن</h1><p>در این صفحه فقط جمع کل‌ها، واریزی بانک‌ها، کمک‌های نقدی، قلک/صندوق، مددجو و محاسبه نمایش داده می‌شود.</p></div></div>
    ${financeCard()}
  `);
  setTimeout(refreshFinanceTotals, 50);
}
function renderExpensesPage(){
  shell(`
    <div class="section-hero"><span>🧾</span><div><h1>هزینه‌های جاری</h1><p>هزینه‌های جاری از مالی جدا شده و به عنوان آیکون مستقل در داشبورد قرار گرفت.</p></div></div>
    ${currentExpensesCard()}
  `);
}
function renderBankPage(){
  shell(`
    <div class="section-hero"><span>🏦</span><div><h1>حساب سمن</h1><p>هر حسابی که اینجا اضافه شود، در صفحه مالی یک فیلد واریزی مستقل می‌سازد.</p></div></div>
    ${bankCard()}
  `);
}
function renderBeneficiaryPage(){
  shell(`
    <div class="section-hero"><span>🤝</span><div><h1>مددجو / ذی‌نفعان</h1><p>این بخش از مالی جدا شد و در داشبورد آیکون اختصاصی دارد.</p></div></div>
    ${beneficiaryCard()}
  `);
}
function renderDocumentsPage(){
  shell(`
    <div class="section-hero"><span>📎</span><div><h1>مدارک و پیوست‌ها</h1><p>مدارک و پیوست‌ها از مالی جدا شد و در داشبورد آیکون اختصاصی دارد.</p></div></div>
    ${documentCard()}
  `);
}
function boardMembersCard(){
  return `<div class="card">
    <h2 class="title">ثبت اسامی هیأت مدیره</h2>
    <div class="grid">
      <div><label>نام و نام خانوادگی</label><input id="memberName"></div>
      <div><label>کد ملی</label><input id="memberNational"></div>
      <div><label>سمت</label><input id="memberRole" placeholder="رئیس، عضو، خزانه‌دار و ..."></div>
      <div><label>شماره تماس</label><input id="memberPhone"></div>
    </div>
    <div class="actions"><button class="primary" onclick="addMember()">افزودن عضو</button></div>
    ${tableHtml(["نام","کد ملی","سمت","تلفن","عملیات"], boardMemberRows())}
  </div>`;
}
function ngoBaseInfoCard(){
  const info = state.lockedBaseInfo || {};
  return `<div class="card">
    <h2 class="title">مشخصات ثبت‌شده سمن</h2>
    <div class="info-grid">
      <div><span>نام سمن</span><b>${esc(info.organizationName||"")}</b></div>
      <div><span>مدیرعامل</span><b>${esc(info.ceoFullName||"")}</b></div>
      <div><span>کد ملی مدیرعامل</span><b>${esc(info.nationalCode||"")}</b></div>
      <div><span>شماره تماس</span><b>${esc(info.phone||"")}</b></div>
    </div>
    <p class="sub">این مشخصات از فایل فعال‌سازی خوانده می‌شود تا کاربر کلاینت نتواند اطلاعات پایه مجاز را دستکاری کند.</p>
  </div>`;
}
function ngoSavedRecordCard(){
  const info = state.lockedBaseInfo || {};
  const lic = state.license || {};
  const licenseItems = licenseAttachmentsList();
  const hasRecord = !!(info.organizationName || lic.issueDate || lic.renewalDate || lic.expiryDate || licenseItems.length);
  if(!hasRecord){
    return `<div class="card"><h2 class="title">رکورد ثبت اطلاعات سمن</h2><div class="notice warn">هنوز رکوردی برای اطلاعات سمن ذخیره نشده است.</div></div>`;
  }
  const rows = [[
    esc(info.organizationName || "-"),
    esc(info.ceoFullName || "-"),
    esc(info.nationalCode || "-"),
    esc(lic.issueDate || "-"),
    esc(lic.expiryDate || "-"),
    esc(lic.status || "-")
  ]];
  return `<div class="card saved-ngo-record">
    <h2 class="title">رکورد ثبت‌شده اطلاعات سمن</h2>
    ${tableHtml(["نام سمن","مدیرعامل","کد ملی","تاریخ صدور مجوز","تاریخ انقضا","وضعیت"], rows)}
    <h3 class="title mini-title">مجوزهای ثبت‌شده</h3>
    <div class="attachment-grid">${licenseItems.length ? licenseItems.map(a=>attachmentPreviewHtml(a,true)).join("") : `<div class="notice warn">هیچ فایل مجوزی برای نمایش ثبت نشده است.</div>`}</div>
  </div>`;
}

function ngoInfoSavedRecordCard(){
  const info = state.lockedBaseInfo || {};
  const lic = state.license || {};
  if(!info.organizationName && !hasLicenseRecord()) return `<div class="notice warn">هنوز اطلاعاتی برای نمایش ثبت نشده است.</div>`;
  return `<div class="card saved-record-card">
    <h2 class="title">رکورد ثبت‌شده اطلاعات سمن</h2>
    <div class="info-grid">
      <div><span>نام سمن</span><b>${esc(info.organizationName||"ثبت نشده")}</b></div>
      <div><span>مدیرعامل</span><b>${esc(info.ceoFullName||"ثبت نشده")}</b></div>
      <div><span>کد ملی مدیرعامل</span><b>${esc(info.nationalCode||"ثبت نشده")}</b></div>
      <div><span>شماره تماس</span><b>${esc(info.phone||"ثبت نشده")}</b></div>
      <div><span>تاریخ انقضای مجوز</span><b>${esc(lic.expiryDate||"محاسبه نشده")}</b></div>
      <div><span>وضعیت مجوز</span><b>${esc(lic.status||"ثبت نشده")}</b></div>
    </div>
  </div>`;
}
function licenseRecordListCard(){
  const records = (state.licenses && state.licenses.length) ? state.licenses : (hasLicenseRecord() ? [state.license] : []);
  return `<div class="card license-record-card">
    <h2 class="title">مجوزهای ثبت‌شده (${toFa(records.length)} مجوز)</h2>
    ${records.length ? records.map((lic,i)=>{
      const att = licenseAttachment(lic);
      return `<div class="license-saved-item">
        <div class="info-grid">
          <div><span>ردیف</span><b>${toFa(i+1)}</b></div>
          <div><span>تاریخ صدور</span><b>${esc(lic.issueDate||"")}</b></div>
          <div><span>تاریخ تمدید</span><b>${esc(lic.renewalDate||"")}</b></div>
          <div><span>مدت</span><b>${esc(lic.durationMonths||"")} ماه</b></div>
          <div><span>انقضا</span><b>${esc(lic.expiryDate||"")}</b></div>
          <div><span>وضعیت</span><b>${esc(lic.status||"")}</b></div>
        </div>
        ${att ? attachmentPreviewHtml(att,true) : `<div class="notice warn">برای این مجوز تصویر/فایل قابل نمایش ذخیره نشده است.</div>`}
      </div>`;
    }).join("") : `<div class="notice warn">هنوز مجوزی ذخیره نشده است.</div>`}
  </div>`;
}

function licenseCard(){
  const lic = state.license || {};
  const att = licenseAttachment();
  return `<div class="card">
    <h2 class="title">مجوز سمن</h2>
    <div class="grid">
      <div><label>تاریخ صدور</label><input id="issueDate" value="${esc(lic.issueDate||"")}" placeholder="۱۴۰۴/۰۱/۱۵"></div>
      <div><label>تاریخ تمدید</label><input id="renewalDate" value="${esc(lic.renewalDate||"")}" placeholder="۱۴۰۴/۰۲/۱۰"></div>
      <div><label>مدت مجوز به ماه</label><input id="durationMonths" value="${esc(lic.durationMonths||"")}" placeholder="۱۲"></div>
      <div class="file-field"><label>بارگذاری تصویر / PDF مجوز</label><input id="licenseFile" type="file" accept="image/*,.pdf"></div>
      <div class="file-field"><label>گرفتن عکس مجوز با دوربین</label><input id="licenseCameraFile" type="file" accept="image/*" capture="environment" class="hidden-file"><button class="primary" onclick="triggerFileInput('licenseCameraFile')">باز کردن دوربین</button></div>
    </div>
    <div class="notice ${lic.status==='منقضی شده'?'bad':(lic.status==='نزدیک انقضا'?'warn':'good')}">
      تاریخ انقضا: ${esc(lic.expiryDate||"محاسبه نشده")} | باقی‌مانده: ${esc(lic.remainingDays??"")} روز | وضعیت: ${esc(lic.status||"")}
    </div>
    <div class="license-display-box">
      <h3 class="title mini-title">فایل مجوز ثبت‌شده</h3>
      ${licenseAttachmentsList().length ? `<div class="notice good">${toFa(licenseAttachmentsList().length)} مجوز ثبت شده است.</div><div class="attachment-grid">${licenseAttachmentsList().map(a=>attachmentPreviewHtml(a,true)).join("")}</div>` : `<div class="notice warn">هنوز فایل مجوز ذخیره نشده است. پس از انتخاب فایل یا عکس دوربین، روی «محاسبه و ذخیره مجوز» بزنید.</div>`}
    </div>
    <div class="actions"><button class="orange" onclick="calculateAndSaveLicense(false)">محاسبه و ذخیره مجوز</button></div>
  </div>`;
}

function currentExpensesCard(){
  return `<div class="card"><h2 class="title">هزینه‌های جاری ماه</h2>
    <div class="grid">
      <div><label>سال</label><input id="expYear" value="${currentJalaliYear()}"></div>
      <div><label>ماه</label><select id="expMonth">${MONTHS.map(m=>`<option>${m}</option>`).join("")}</select></div>
      <div><label>هزینه تلفن</label><input id="expPhone" class="rial-input" inputmode="numeric" placeholder="مثلاً ۱,۵۰۰,۰۰۰"></div>
      <div><label>آب</label><input id="expWater" class="rial-input" inputmode="numeric" placeholder="مثلاً ۸۵۰,۰۰۰"></div>
      <div><label>برق</label><input id="expElectricity" class="rial-input" inputmode="numeric" placeholder="مثلاً ۱,۲۰۰,۰۰۰"></div>
      <div><label>اینترنت</label><input id="expInternet" class="rial-input" inputmode="numeric" placeholder="مثلاً ۹۰۰,۰۰۰"></div>
      <div><label>گاز</label><input id="expGas" class="rial-input" inputmode="numeric" placeholder="مثلاً ۶۰۰,۰۰۰"></div>
      <div><label>اجاره</label><input id="expRent" class="rial-input" inputmode="numeric" placeholder="مثلاً ۳۰,۰۰۰,۰۰۰"></div>
      <div><label>سایر هزینه</label><input id="expOther" class="rial-input" inputmode="numeric" placeholder="مثلاً ۲,۰۰۰,۰۰۰"></div>
    </div>
    <div class="actions"><button class="success" onclick="saveCurrentExpenses()">ذخیره هزینه جاری ماه</button></div>
    ${tableHtml(["سال","ماه","تلفن","آب","برق","اینترنت","گاز","اجاره","سایر","مجموع","عملیات"], state.currentExpenses.map((e,i)=>[e.year,e.month,money(e.phone),money(e.water),money(e.electricity),money(e.internet),money(e.gas),money(e.rent),money(e.other),money(e.total),actionBtn("delExpense",i)]))}
  </div>`;
}
function saveCurrentExpenses(){
  const item = {
    year:$("expYear").value.trim(),
    month:$("expMonth").value,
    phone:toInt($("expPhone").value),
    water:toInt($("expWater").value),
    electricity:toInt($("expElectricity").value),
    internet:toInt($("expInternet").value),
    gas:toInt($("expGas").value),
    rent:toInt($("expRent").value),
    other:toInt($("expOther").value),
    createdAt:nowIso()
  };
  item.total = item.phone + item.water + item.electricity + item.internet + item.gas + item.rent + item.other;
  const idx = state.currentExpenses.findIndex(x=>x.year===item.year && x.month===item.month);
  if(idx >= 0){
    if(!confirm("برای این ماه هزینه جاری ثبت شده است. جایگزین شود؟")) return;
    state.currentExpenses[idx] = item;
  } else state.currentExpenses.push(item);
  saveState(); renderCurrentSection();
}
function delExpense(i){ if(confirm("حذف هزینه جاری این ماه؟")){ state.currentExpenses.splice(i,1); saveState(); renderCurrentSection(); } }

function financeCard(){
  const jNow = currentJalaliDate();
  const selectedYear = jNow.year;
  const selectedMonth = jNow.month;
  const initialCarry = getStoredCarryover(selectedYear, selectedMonth);
  return `<div class="card finance-only-card"><h2 class="title">مالی سمن و محاسبه ماهانه</h2>
    <p class="sub">در مالی فقط ورودی‌های مالی و محاسبات نگهداری می‌شود. مرجع محاسبه ماه جاری، «مجموع واریزی و جمع‌آوری سمن» است.</p>
    <div class="grid compact-grid">
      <div><label>سال شمسی</label><input id="finYear" value="${selectedYear}" oninput="applyCarryoverForSelectedMonth();refreshFinanceTotals()"></div>
      <div><label>ماه</label><select id="finMonth" onchange="applyCarryoverForSelectedMonth();refreshFinanceTotals()">${MONTHS.map(m=>`<option ${m===selectedMonth?"selected":""}>${m}</option>`).join("")}</select></div>
      <div><label>نقل از ماه قبل</label><input id="prevCarry" class="rial-input" inputmode="numeric" value="${initialCarry ? toFaDigits(initialCarry.toLocaleString("en-US")) : ""}" placeholder="مثلاً ۱۲,۵۰۰,۰۰۰" oninput="refreshFinanceTotals()"></div>
    </div>

    <div class="finance-step">
      <h3 class="title mini-title">۱) واریزی به حساب‌های بانکی سمن</h3>
      <p class="sub">هر حسابی که در بخش «حساب سمن» ثبت شود، اینجا یک فیلد مستقل برای ورود کمک‌ها می‌سازد.</p>
      ${accountDepositInputs()}
      <div class="finance-total-line"><span>جمع واریزی بانک‌ها</span><b id="financeAccountTotal">۰ ریال</b></div>
    </div>

    <div class="finance-step">
      <h3 class="title mini-title">۲) کمک‌های نقدی، قلک و جمع‌آوری سمن</h3>
      <div class="grid">
        <div><label>کمک‌های نقدی</label><input id="cashDonations" class="rial-input" inputmode="numeric" placeholder="مثلاً ۵,۰۰۰,۰۰۰" oninput="refreshFinanceTotals()"></div>
        <div><label>قلک و صندوق‌ها</label><input id="cashBoxes" class="rial-input" inputmode="numeric" placeholder="مثلاً ۳,۰۰۰,۰۰۰" oninput="refreshFinanceTotals()"></div>
      </div>
      <div class="finance-reference-line important-reference">
        <span>مجموع واریزی و جمع‌آوری سمن</span>
        <b id="financeNgoCollectedTotal">۰ ریال</b>
        <small>مجموع حساب‌ها + کمک‌های نقدی + قلک و صندوق‌ها؛ مرجع اصلی محاسبه ماه جاری</small>
      </div>
    </div>

    <div class="finance-step">
      <h3 class="title mini-title">۳) فایل ورودی سمن و وضعیت واریزی افراد</h3>
      <div class="grid">
        <div><label>مجموع مددجوهای تحت پوشش</label><input id="totalCovered" inputmode="numeric" oninput="refreshFinanceTotals()" value="${state.beneficiaries.length || ""}"></div>
        <div><label>فایل ورودی / واریزی سمن</label><input id="beneficiaryPaymentFile" type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onclick="this.value=null" onchange="autoAnalyzeBeneficiaryPaymentFile()"></div>
        <div><label>تعداد افراد واریز شده</label><input id="paidPeopleCount" value="۰" readonly></div>
        <div><label>تعداد افراد واریز نشده</label><input id="unpaidPeopleCount" value="۰" readonly></div>
      </div>
      <div class="actions"><button class="orange" onclick="analyzeBeneficiaryPaymentFile()">تحلیل فایل پرداختی مددجوها</button></div>
      <div id="beneficiaryPaymentResult" class="notice warn">هنوز فایل پرداختی تحلیل نشده است.</div>
    </div>

    <div class="finance-summary-board">
      <div><span>مرجع محاسبه: جمع‌آوری سمن</span><b id="financeNgoCollectedSummary">۰ ریال</b></div>
      <div><span>نقل از ماه قبل</span><b id="financePrevCarryTotal">۰ ریال</b></div>
      <div><span>هزینه جاری این ماه</span><b id="financeCurrentExpenseTotal">۰ ریال</b></div>
      <div><span>واریزی مددجو</span><b id="financeBeneficiaryPaidTotal">۰ ریال</b></div>
      <div><span>نتیجه محاسبه</span><b id="financeBalanceTotal">۰ ریال</b></div>
    </div>

    <label>توضیحات</label><textarea id="finNotes"></textarea>
    <div class="actions"><button class="success" onclick="addMonthlyReport()">ذخیره مالی ماه و محاسبه تراز</button></div>
    ${tableHtml(["سال","ماه","جمع‌آوری سمن","تعداد واریز شده","تعداد واریز نشده","هزینه جاری","واریزی مددجو","نتیجه","نقل/کسری","عملیات"], state.monthlyReports.map((r,i)=>[r.year,r.month,money(r.ngoCollectedTotal || r.totalInflow || 0),toFa(r.beneficiaryPaidCount||0),toFa(r.beneficiaryUnpaidCount||0),money(r.currentExpensesTotal),money(r.beneficiaryPaidTotal),r.balanceStatus,money(r.balanceAmount),actionBtn("delReport",i)]))}
  </div>`;
}

function accountDepositInputs(){
  if(!state.bankAccounts.length){
    return `<div class="notice warn">هنوز حساب سمن ثبت نشده است. ابتدا در بخش «حساب سمن» حساب بانکی را ثبت کنید.</div>`;
  }
  return `<div class="grid">${state.bankAccounts.map((b,i)=>`
    <div>
      <label>${esc(b.bankName||"بانک")} | ${esc(b.accountNo||"شماره حساب")}</label>
      <input class="depositAmount rial-input" data-bank-index="${i}" inputmode="numeric" placeholder="مثلاً ۱۰,۰۰۰,۰۰۰" oninput="refreshFinanceTotals()">
    </div>`).join("")}</div>`;
}
function refreshFinanceTotals(){
  try{
    const year = $("finYear") ? $("finYear").value.trim() : "";
    const month = $("finMonth") ? $("finMonth").value : "";
    const prevCarry = $("prevCarry") ? toInt($("prevCarry").value) : 0;
    const cashDonations = $("cashDonations") ? toInt($("cashDonations").value) : 0;
    const cashBoxes = $("cashBoxes") ? toInt($("cashBoxes").value) : 0;
    const accountDepositTotal = sumAccountDeposits(Array.from(document.querySelectorAll(".depositAmount")).map(inp=>({amount:toInt(inp.value)})));
    const ngoCollectedTotal = accountDepositTotal + cashDonations + cashBoxes;
    const expenseRecord = findCurrentExpense(year, month);
    const currentExpensesTotal = expenseRecord ? toInt(expenseRecord.total) : 0;
    const totalCovered = $("totalCovered") ? toInt($("totalCovered").value) : 0;
    const pay = window.lastBeneficiaryPaymentAnalysis || {paidCount:0,totalAmount:0,totalCovered,unpaidCount:totalCovered};
    const beneficiaryPaidTotal = toInt(pay.totalAmount);
    const beneficiaryPaidCount = toInt(pay.paidCount);
    const beneficiaryUnpaidCount = Math.max(0, totalCovered - beneficiaryPaidCount);
    const totalInflow = prevCarry + ngoCollectedTotal;
    const totalOutflow = currentExpensesTotal + beneficiaryPaidTotal;
    const balance = totalInflow - totalOutflow;
    if($("financeAccountTotal")) $("financeAccountTotal").textContent = money(accountDepositTotal);
    if($("financeNgoCollectedTotal")) $("financeNgoCollectedTotal").textContent = money(ngoCollectedTotal);
    if($("financeNgoCollectedSummary")) $("financeNgoCollectedSummary").textContent = money(ngoCollectedTotal);
    if($("financePrevCarryTotal")) $("financePrevCarryTotal").textContent = money(prevCarry);
    if($("financeInflowTotal")) $("financeInflowTotal").textContent = money(totalInflow);
    if($("financeCurrentExpenseTotal")) $("financeCurrentExpenseTotal").textContent = money(currentExpensesTotal);
    if($("financeBeneficiaryPaidTotal")) $("financeBeneficiaryPaidTotal").textContent = money(beneficiaryPaidTotal);
    if($("paidPeopleCount")) $("paidPeopleCount").value = toFa(beneficiaryPaidCount);
    if($("unpaidPeopleCount")) $("unpaidPeopleCount").value = toFa(beneficiaryUnpaidCount);
    if($("financeBalanceTotal")) {
      $("financeBalanceTotal").textContent = (balance >= 0 ? "قابل نقل: " : "کسری: ") + money(Math.abs(balance));
      $("financeBalanceTotal").className = balance >= 0 ? "positive-balance" : "negative-balance";
    }
  }catch(e){ console.warn(e); }
}

function autoAnalyzeBeneficiaryPaymentFile(){
  const el = $("beneficiaryPaymentFile");
  if(!el || !el.files || !el.files[0]) return;
  const file = el.files[0];
  if($("beneficiaryPaymentResult")){
    $("beneficiaryPaymentResult").className = "notice warn";
    $("beneficiaryPaymentResult").innerHTML = `فایل <b>${esc(file.name || "انتخاب‌شده")}</b> دریافت شد؛ در حال تحلیل اطلاعات...`;
  }
  setTimeout(()=>analyzeBeneficiaryPaymentFile(), 120);
}
async function analyzeBeneficiaryPaymentFile(){
  const file = $("beneficiaryPaymentFile").files[0];
  if(!file) return notify("فایل واریزی مددجوها را انتخاب کنید.");
  try{
    const result = await parseBeneficiaryPaymentFile(file);
    const totalCovered = toInt($("totalCovered").value);
    result.totalCovered = totalCovered;
    result.unpaidCount = Math.max(0, totalCovered - result.paidCount);
    result.fileName = file.name || "";
    result.analyzedAt = nowIso();
    window.lastBeneficiaryPaymentAnalysis = result;
    state.beneficiaryPaymentFiles = state.beneficiaryPaymentFiles || [];
    state.beneficiaryPaymentFiles.unshift({
      fileName: result.fileName,
      paidCount: result.paidCount,
      unpaidCount: result.unpaidCount,
      totalAmount: result.totalAmount,
      detectedFormat: result.detectedFormat || "متنی",
      analyzedAt: result.analyzedAt
    });
    state.beneficiaryPaymentFiles = state.beneficiaryPaymentFiles.slice(0, 20);
    saveState();
    if($("paidPeopleCount")) $("paidPeopleCount").value = toFa(result.paidCount);
    if($("unpaidPeopleCount")) $("unpaidPeopleCount").value = toFa(result.unpaidCount);
    $("beneficiaryPaymentResult").className = result.unpaidCount > 0 ? "notice warn" : "notice good";
    $("beneficiaryPaymentResult").innerHTML =
      `نوع فایل خوانده‌شده: <b>${esc(result.detectedFormat || "متنی")}</b><br>`+
      `تعداد مددجوهای واریزی این ماه: <b>${toFa(result.paidCount)}</b><br>`+
      `کل مبلغ واریزی به حساب مددجوها: <b>${money(result.totalAmount)}</b><br>`+
      `تعداد مددجوهایی که این ماه دریافتی نداشتند: <b>${toFa(result.unpaidCount)}</b><br>`+
      `تعداد ردیف‌های خوانده‌شده از فایل: <b>${toFa(result.rowCount || result.paidCount || 0)}</b>`;
    refreshFinanceTotals();
  }catch(e){
    if($("beneficiaryPaymentResult")){
      $("beneficiaryPaymentResult").className = "notice bad";
      $("beneficiaryPaymentResult").innerHTML = "خطا در تحلیل فایل پرداختی: " + esc(e.message || e);
    }
    notify("خطا در تحلیل فایل پرداختی: " + (e.message || e));
  }
}
async function parseBeneficiaryPaymentFile(file){
  const name = String(file.name || "").toLowerCase();
  const mime = String(file.type || "").toLowerCase();
  const buf = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buf);
  const isZipExcel = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOleXls = bytes.length > 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  const isXlsx = /\.(xlsx|xlsm)$/i.test(name) || mime.includes("spreadsheetml") || isZipExcel;
  const isOldXls = /\.xls$/i.test(name) || mime === "application/vnd.ms-excel" || isOleXls;
  if(isXlsx){
    const result = await parseBeneficiaryPaymentXlsxBytes(bytes);
    result.detectedFormat = "Excel XLSX";
    return result;
  }
  const text = decodeTextFileBytes(bytes);
  if(isOldXls){
    const htmlResult = parseBeneficiaryPaymentHtmlOrText(text);
    htmlResult.detectedFormat = "XLS قدیمی / HTML / متنی";
    if(htmlResult.paidCount || htmlResult.totalAmount) return htmlResult;
    throw new Error("فایل XLS قدیمی به صورت مستقیم خوانده نشد. لطفاً آن را با فرمت XLSX یا CSV ذخیره و دوباره انتخاب کنید.");
  }
  const result = parseBeneficiaryPaymentHtmlOrText(text);
  result.detectedFormat = "CSV / TXT / JSON";
  return result;
}
function decodeTextFileBytes(bytes){
  try{return new TextDecoder("utf-8").decode(bytes);}catch(e){}
  try{return new TextDecoder("windows-1256").decode(bytes);}catch(e){}
  return "";
}
async function parseBeneficiaryPaymentXlsx(file){
  const buf = await readFileAsArrayBuffer(file);
  return parseBeneficiaryPaymentXlsxBytes(new Uint8Array(buf));
}
async function parseBeneficiaryPaymentXlsxBytes(bytes){
  const entries = parseZipEntries(bytes);
  const getEntryText = async (name) => {
    const key = Object.keys(entries).find(k => k.toLowerCase() === name.toLowerCase());
    if(!key) return "";
    const bytes = await unzipEntryBytes(entries[key]);
    return new TextDecoder("utf-8").decode(bytes);
  };
  const sharedXml = await getEntryText("xl/sharedStrings.xml");
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  let sheetPath = await getFirstWorksheetPath(entries, getEntryText);
  const sheetXml = await getEntryText(sheetPath);
  if(!sheetXml) throw new Error("برگه اول فایل اکسل خوانده نشد.");
  const rows = parseSheetRows(sheetXml, shared);
  return parseBeneficiaryRows(rows);
}
function readU16(bytes, off){ return bytes[off] | (bytes[off+1] << 8); }
function readU32(bytes, off){ return (bytes[off] | (bytes[off+1] << 8) | (bytes[off+2] << 16) | (bytes[off+3] << 24)) >>> 0; }
function parseZipEntries(bytes){
  let eocd = -1;
  for(let i=bytes.length-22; i>=Math.max(0, bytes.length-66000); i--){
    if(readU32(bytes,i) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error("ساختار فایل اکسل معتبر نیست. فایل باید XLSX باشد.");
  const count = readU16(bytes, eocd+10);
  const cdOffset = readU32(bytes, eocd+16);
  const dec = new TextDecoder("utf-8");
  const entries = {};
  let p = cdOffset;
  for(let n=0; n<count; n++){
    if(readU32(bytes,p) !== 0x02014b50) break;
    const method = readU16(bytes,p+10);
    const compSize = readU32(bytes,p+20);
    const uncompSize = readU32(bytes,p+24);
    const nameLen = readU16(bytes,p+28);
    const extraLen = readU16(bytes,p+30);
    const commentLen = readU16(bytes,p+32);
    const localOffset = readU32(bytes,p+42);
    const name = dec.decode(bytes.slice(p+46, p+46+nameLen));
    entries[name] = {bytes, method, compSize, uncompSize, localOffset, name};
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
async function unzipEntryBytes(entry){
  const bytes = entry.bytes;
  const p = entry.localOffset;
  if(readU32(bytes,p) !== 0x04034b50) throw new Error("ورودی داخلی فایل اکسل معتبر نیست.");
  const nameLen = readU16(bytes,p+26);
  const extraLen = readU16(bytes,p+28);
  const start = p + 30 + nameLen + extraLen;
  const data = bytes.slice(start, start + entry.compSize);
  if(entry.method === 0) return data;
  if(entry.method === 8){
    if(window.pako && typeof window.pako.inflateRaw === "function"){
      try{ return new Uint8Array(window.pako.inflateRaw(data)); }catch(e){}
    }
    if(typeof DecompressionStream !== "undefined"){
      try{
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        await writer.write(data);
        await writer.close();
        return new Uint8Array(await new Response(ds.readable).arrayBuffer());
      }catch(e){}
    }
    throw new Error("فشرده‌سازی فایل XLSX در این دستگاه خوانده نشد. لطفاً فایل را با فرمت XLSX جدید یا CSV ذخیره کنید.");
  }
  throw new Error("نوع فشرده‌سازی فایل اکسل پشتیبانی نمی‌شود.");
}
function xmlTextContent(node){ return node ? (node.textContent || "") : ""; }
function parseXml(xml){ return new DOMParser().parseFromString(xml, "application/xml"); }
function xmlElements(root, localName){
  if(!root) return [];
  const all = root.getElementsByTagName ? Array.from(root.getElementsByTagName("*")) : [];
  const wanted = String(localName || "").toLowerCase();
  return all.filter(n => String(n.localName || n.nodeName || "").split(":").pop().toLowerCase() === wanted);
}
function xmlFirst(root, localName){ return xmlElements(root, localName)[0] || null; }
function xmlChildren(root, localName){
  if(!root) return [];
  const wanted = String(localName || "").toLowerCase();
  return Array.from(root.childNodes || []).filter(n => n.nodeType === 1 && String(n.localName || n.nodeName || "").split(":").pop().toLowerCase() === wanted);
}
function parseSharedStrings(xml){
  const doc = parseXml(xml);
  return xmlElements(doc, "si").map(si =>
    xmlElements(si, "t").map(t => t.textContent || "").join("")
  );
}
async function getFirstWorksheetPath(entries, getEntryText){
  const lowerKeys = Object.keys(entries).map(k => k.toLowerCase());
  const has = (p) => lowerKeys.includes(p.toLowerCase());
  try{
    const workbookXml = await getEntryText("xl/workbook.xml");
    const relsXml = await getEntryText("xl/_rels/workbook.xml.rels");
    if(workbookXml && relsXml){
      const wb = parseXml(workbookXml);
      const firstSheet = xmlFirst(wb, "sheet");
      const rid = firstSheet ? (firstSheet.getAttribute("r:id") || firstSheet.getAttribute("id") || "") : "";
      if(rid){
        const rels = xmlElements(parseXml(relsXml), "Relationship");
        for(const r of Array.from(rels)){
          if(r.getAttribute("Id") === rid){
            let target = r.getAttribute("Target") || "worksheets/sheet1.xml";
            if(target.startsWith("/")) target = target.slice(1);
            else target = "xl/" + target.replace(/^\.\//, "");
            if(has(target)) return target;
          }
        }
      }
    }
  }catch(e){}
  const first = Object.keys(entries).find(k => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  return first || "xl/worksheets/sheet1.xml";
}
function colToIndex(ref){
  const m = String(ref || "").match(/[A-Z]+/i);
  if(!m) return 0;
  let n = 0;
  for(const ch of m[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function parseSheetRows(xml, shared){
  const doc = parseXml(xml);
  const out = [];
  xmlElements(doc, "row").forEach(row=>{
    const arr = [];
    xmlChildren(row, "c").forEach(c=>{
      const idx = colToIndex(c.getAttribute("r"));
      const t = c.getAttribute("t") || "";
      let val = "";
      if(t === "s"){
        const v = xmlTextContent(xmlFirst(c, "v"));
        val = shared[toInt(v)] || "";
      }else if(t === "inlineStr"){
        val = xmlElements(c, "t").map(x=>x.textContent||"").join("");
      }else{
        val = xmlTextContent(xmlFirst(c, "v"));
      }
      arr[idx] = val;
    });
    if(arr.some(x => String(x || "").trim())) out.push(arr.map(x => String(x ?? "").trim()));
  });
  return out;
}
function normalizeHeaderName(v){
  return normDigitsAll(String(v || ""))
    .replace(/[ي]/g,"ی").replace(/[ك]/g,"ک")
    .replace(/[\s‌_\-:：\.]/g,"")
    .trim();
}
function findHeaderRow(rows){
  for(let r=0; r<Math.min(rows.length, 10); r++){
    const joined = rows[r].map(normalizeHeaderName).join("|");
    const hasAmount = /واریزی|مبلغ|پرداخت|دریافتی|amount|payment/i.test(joined);
    const hasIdentity = /کدملی|کدملّي|شمارهکارت|ناموخانوادگی|نام|national|card/i.test(joined);
    if(hasAmount && hasIdentity) return r;
  }
  return -1;
}
function findColumn(headers, patterns, fallback){
  for(let i=0; i<headers.length; i++){
    const h = normalizeHeaderName(headers[i]);
    if(patterns.some(p => p.test(h))) return i;
  }
  return fallback;
}
function parseBeneficiaryRows(rows){
  if(!rows || !rows.length) return {paidCount:0,totalAmount:0,detectedFormat:"Excel XLSX"};
  const headerIndex = findHeaderRow(rows);
  let dataRows = rows;
  let amountCol = -1, nationalCol = -1, cardCol = -1, nameCol = -1;
  if(headerIndex >= 0){
    const headers = rows[headerIndex];
    amountCol = findColumn(headers, [/واریزی/,/مبلغ/,/پرداخت/,/دریافتی/,/amount/i,/payment/i], headers.length-1);
    nationalCol = findColumn(headers, [/کدملی/,/شناسه/,/national/i], -1);
    cardCol = findColumn(headers, [/شمارهکارت/,/کارت/,/card/i], -1);
    nameCol = findColumn(headers, [/ناموخانوادگی/,/^نام$/, /fullname/i, /name/i], 0);
    dataRows = rows.slice(headerIndex + 1);
  }else{
    amountCol = Math.max(0, rows[0].length - 1);
    nationalCol = 1;
    cardCol = 2;
    nameCol = 0;
  }
  const paidKeys = new Set();
  let totalAmount = 0;
  dataRows.forEach((row,i)=>{
    const amount = toInt(row[amountCol] || row[row.length-1] || 0);
    const key = String((nationalCol>=0 && row[nationalCol]) || (cardCol>=0 && row[cardCol]) || (nameCol>=0 && row[nameCol]) || ("row"+i)).trim();
    if(amount > 0){
      paidKeys.add(key || ("row"+i));
      totalAmount += amount;
    }
  });
  return {paidCount: paidKeys.size, totalAmount, detectedFormat:"Excel XLSX", rowCount:dataRows.length};
}

function parseBeneficiaryPaymentHtmlOrText(text){
  const raw = String(text || "");
  if(/<table[\s\S]*<\/table>/i.test(raw)){
    try{
      const doc = new DOMParser().parseFromString(raw, "text/html");
      const rows = Array.from(doc.querySelectorAll("tr")).map(tr =>
        Array.from(tr.querySelectorAll("th,td")).map(td => String(td.textContent || "").trim())
      ).filter(r => r.some(Boolean));
      const res = parseBeneficiaryRows(rows);
      res.detectedFormat = "HTML Excel";
      return res;
    }catch(e){}
  }
  return parseBeneficiaryPaymentText(raw);
}

function parseBeneficiaryPaymentText(text){
  const normalized = normDigitsAll(text);
  let rows = [];
  try{
    const obj = JSON.parse(normalized);
    if(Array.isArray(obj)) rows = obj;
    else if(Array.isArray(obj.payments)) rows = obj.payments;
  }catch(e){}
  let paidKeys = new Set();
  let totalAmount = 0;
  if(rows.length){
    rows.forEach((r,i)=>{
      const key = String(r.nationalId || r.nationalCode || r.code || r.name || ("row"+i)).trim();
      const amount = toInt(r.amount || r.price || r.value || r.payment || 0);
      if(amount > 0){ paidKeys.add(key); totalAmount += amount; }
    });
  }else{
    normalized.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach((line,i)=>{
      const parts = line.split(/[,\t;،]+/).map(x=>x.trim()).filter(Boolean);
      const numbers = parts.join(" ").match(/\d+/g) || [];
      const amount = numbers.length ? toInt(numbers[numbers.length-1]) : 0;
      const key = numbers.length > 1 ? numbers[0] : ("row"+i);
      if(amount > 0){ paidKeys.add(key); totalAmount += amount; }
    });
  }
  return {paidCount: paidKeys.size, totalAmount};
}
function addMonthlyReport(){
  const year = $("finYear").value.trim();
  const month = $("finMonth").value;
  const prevCarry = toInt($("prevCarry").value);
  const cashDonations = toInt($("cashDonations").value);
  const cashBoxes = toInt($("cashBoxes").value);
  const totalCovered = toInt($("totalCovered").value);

  const accountDeposits = Array.from(document.querySelectorAll(".depositAmount")).map(inp=>{
    const bank = state.bankAccounts[toInt(inp.dataset.bankIndex)] || {};
    return {
      bankName: bank.bankName || "",
      accountNo: bank.accountNo || "",
      cardNo: bank.cardNo || "",
      iban: bank.iban || "",
      owner: bank.owner || "",
      amount: toInt(inp.value)
    };
  });
  const accountDepositTotal = sumAccountDeposits(accountDeposits);
  const expenseRecord = findCurrentExpense(year, month);
  const currentExpensesTotal = expenseRecord ? toInt(expenseRecord.total) : 0;

  const pay = window.lastBeneficiaryPaymentAnalysis || {paidCount:0,totalAmount:0,totalCovered,unpaidCount:totalCovered};
  const beneficiaryPaidCount = toInt(pay.paidCount);
  const beneficiaryPaidTotal = toInt(pay.totalAmount);
  const beneficiaryUnpaidCount = Math.max(0, totalCovered - beneficiaryPaidCount);

  const ngoCollectedTotal = accountDepositTotal + cashDonations + cashBoxes;
  const totalInflow = prevCarry + ngoCollectedTotal;
  const totalOutflow = currentExpensesTotal + beneficiaryPaidTotal;
  const balance = totalInflow - totalOutflow;
  const balanceStatus = balance >= 0 ? "اضافه و قابل نقل به ماه بعد" : "کسری داری؛ اصلاح کن";
  const report = {
    orgName:state.lockedBaseInfo.organizationName||"",
    year, month,
    previousCarryover: prevCarry,
    accountDeposits,
    accountDepositTotal,
    cashDonations,
    cashBoxes,
    ngoCollectedTotal,
    totalInflow,
    currentExpensesTotal,
    totalCoveredBeneficiaries: totalCovered,
    beneficiaryPaidCount,
    beneficiaryPaidTotal,
    beneficiaryUnpaidCount,
    totalOutflow,
    balance,
    balanceAmount: Math.abs(balance),
    balanceStatus,
    notes:$("finNotes").value.trim(),
    createdAt:nowIso(),
    status: balance >= 0 ? "ارسال نشده" : "نیازمند اصلاح"
  };
  if(!year || !month) return notify("سال شمسی و ماه الزامی است.");
  const idx = state.monthlyReports.findIndex(x=>normDigitsAll(x.year)===normDigitsAll(year) && x.month===month);
  if(idx >= 0){
    if(!confirm("برای این ماه گزارش ثبت شده است. جایگزین شود؟")) return;
    state.monthlyReports[idx] = report;
  }else state.monthlyReports.push(report);

  const next = nextFinanceMonth(year, month);
  const carryToNextMonth = balance > 0 ? balance : 0;
  setStoredCarryover(next.year, next.month, carryToNextMonth);
  saveState();
  notify(
    (balance < 0
      ? `کسری داری؛ اصلاح کن\nمبلغ کسری: ${money(Math.abs(balance))}`
      : `گزارش ذخیره شد. مبلغ ${money(balance)} به نقل ماه بعد منتقل شد.`)
    + `\nماه بعد: ${next.month} ${next.year}\nنقل از ماه قبل برای ماه بعد: ${money(carryToNextMonth)}`
  );
  renderCurrentSection();
}
function delReport(i){ if(confirm("حذف گزارش مالی؟")){ state.monthlyReports.splice(i,1); saveState(); renderCurrentSection(); } }


function bankCard(){
  return `<div class="card"><h2 class="title">حساب سمن</h2>
    <div class="grid">
      <div><label>نام بانک</label><input id="bankName"></div>
      <div><label>شماره حساب</label><input id="bankAccount"></div>
      <div><label>شماره کارت</label><input id="bankCardNo"></div>
      <div><label>شماره شبا</label><input id="bankIban"></div>
      <div><label>صاحب حساب</label><input id="bankOwner"></div>
    </div>
    <div class="actions"><button class="primary" onclick="addBank()">افزودن حساب سمن</button></div>
    ${tableHtml(["بانک","شماره حساب","کارت","شبا","صاحب حساب","عملیات"], state.bankAccounts.map((b,i)=>[b.bankName,b.accountNo,b.cardNo,b.iban,b.owner,actionBtn("delBank",i)]))}
  </div>`;
}
function addBank(){
  const item = {
    bankName:$("bankName").value.trim(),
    accountNo:$("bankAccount").value.trim(),
    cardNo:$("bankCardNo").value.trim(),
    iban:$("bankIban").value.trim(),
    owner:$("bankOwner").value.trim(),
    createdAt:nowIso()
  };
  if(!item.bankName || !item.accountNo) return notify("نام بانک و شماره حساب الزامی است.");
  state.bankAccounts.push(item); saveState(); renderCurrentSection();
}
function delBank(i){ if(confirm("حذف حساب سمن؟")){ state.bankAccounts.splice(i,1); saveState(); renderCurrentSection(); } }

function beneficiaryCard(){
  return `<div class="card"><h2 class="title">مددجوها / ذی‌نفعان</h2>
    <div class="grid">
      <div><label>نام مددجو</label><input id="benName"></div>
      <div><label>کد ملی</label><input id="benNational"></div>
      <div><label>شماره تماس</label><input id="benPhone"></div>
      <div><label>مبلغ دریافتی</label><input id="benAmount" class="rial-input" inputmode="numeric" placeholder="مثلاً ۵,۰۰۰,۰۰۰"></div>
    </div>
    <label>توضیحات</label><input id="benNotes">
    <div class="actions"><button class="primary" onclick="addBeneficiary()">افزودن مددجو</button></div>
    ${tableHtml(["نام","کد ملی","تلفن","مبلغ","توضیح","عملیات"], state.beneficiaries.map((b,i)=>[b.name,b.nationalId,b.phone,money(b.amount),b.notes,actionBtn("delBeneficiary",i)]))}
  </div>`;
}
function addBeneficiary(){
  const item = {name:$("benName").value.trim(), nationalId:$("benNational").value.trim(), phone:$("benPhone").value.trim(), amount:toInt($("benAmount").value), notes:$("benNotes").value.trim(), createdAt:nowIso()};
  if(!item.name || !item.nationalId) return notify("نام و کد ملی مددجو الزامی است.");
  if(state.beneficiaries.some(x=>x.nationalId===item.nationalId)) return notify("این کد ملی قبلاً ثبت شده است.");
  state.beneficiaries.push(item); saveState(); renderCurrentSection();
}
function delBeneficiary(i){ if(confirm("حذف مددجو؟")){ state.beneficiaries.splice(i,1); saveState(); renderCurrentSection(); } }


function syncLicenseDocumentRecord(){
  const lic = state.license || {};
  const att = licenseAttachment();
  if(!att || !att.base64) return null;
  state.documents = state.documents || [];
  const doc = {
    ...att,
    id: att.id || lic.attachmentId || "license_inline",
    title: "مجوز سمن",
    docType: "مجوز سمن",
    source:"license",
    locked:true,
    createdAt: att.createdAt || lic.savedAt || nowIso()
  };
  const idx = state.documents.findIndex(x => x && (x.id === doc.id || (String(x.docType||"").includes("مجوز") && String(x.source||"") === "license")));
  if(idx >= 0) state.documents[idx] = {...state.documents[idx], ...doc};
  else state.documents.unshift(doc);
  return doc;
}

function documentDisplayItems(){
  syncLicenseDocumentRecord();
  const map = new Map();
  (state.documents || []).forEach(d=>{
    if(d && (d.id || d.name || d.title)) map.set(d.id || (d.name+"_"+d.title), {...d, source:"document"});
  });
  licenseAttachmentsList().forEach((a,idx)=>{
    if(!a) return;
    const id = a.id || ("license_auto_"+idx);
    map.set(id, {
      ...a,
      id,
      title: a.title || "مجوز سمن",
      docType: "مجوز سمن",
      source:"license",
      locked:true
    });
  });
  return Array.from(map.values()).sort((a,b)=>String(b.createdAt||b.savedAt||"").localeCompare(String(a.createdAt||a.savedAt||"")));
}

function documentCard(){
  const docs = documentDisplayItems();
  const rows = docs.map((d,i)=>[
    d.title || "مجوز سمن",
    d.docType || "پیوست",
    d.name||d.path||"فایل",
    `<button class="primary" onclick="viewAttachment('${esc(d.id)}')">نمایش</button> <button class="success" onclick="saveAttachment('${esc(d.id)}')">ذخیره</button> ${d.locked ? `<span class="locked-note">ثبت‌شده در مجوز سمن</span>` : actionBtn("delDocument", i)}`
  ]);
  return `<div class="card"><h2 class="title">مدارک و پیوست‌ها</h2>
    <div class="notice ${docs.length ? 'good' : 'warn'}">${docs.length ? `${toFa(docs.length)} مدرک قابل مشاهده است. مجوز ثبت‌شده در بخش «ثبت اطلاعات سمن» نیز اینجا نمایش داده می‌شود.` : 'هنوز مدرکی ثبت نشده است.'}</div>
    <div class="grid">
      <div><label>عنوان مدرک</label><input id="docTitle"></div>
      <div><label>نوع مدرک</label><select id="docType"><option>مجوز</option><option>مدرک مددجو</option><option>گزارش مالی</option><option>سایر</option></select></div>
    </div>
    <div class="grid">
      <div class="file-field"><label>انتخاب فایل</label><input id="docFile" type="file" accept="image/*,.pdf,.json,.doc,.docx,.xlsx,.xls,.txt"></div>
      <div class="file-field"><label>گرفتن عکس مدرک با دوربین</label><input id="docCameraFile" type="file" accept="image/*" capture="environment" class="hidden-file"><button class="primary" onclick="triggerFileInput('docCameraFile')">باز کردن دوربین</button></div>
    </div>
    <div class="actions"><button class="primary" onclick="addDocument()">افزودن مدرک</button></div>
    <div class="attachment-grid">${docs.length ? docs.map(d=>attachmentPreviewHtml(d,true)).join("") : `<div class="notice warn">هنوز مدرکی برای نمایش ثبت نشده است.</div>`}</div>
    ${tableHtml(["عنوان","نوع","نام فایل","عملیات"], rows)}
  </div>`;
}
async function addDocument(){
  const fileInput = $("docFile");
  const cameraInput = $("docCameraFile");
  const file = (fileInput && fileInput.files && fileInput.files[0]) || (cameraInput && cameraInput.files && cameraInput.files[0]);
  const title = $("docTitle").value.trim();
  const docType = $("docType").value;
  if(!title || !file) return notify("عنوان و فایل مدرک الزامی است.");
  const att = await fileToAttachment(file, title, docType);
  state.documents.push(att);
  state.attachments.push(att);
  saveState(); renderCurrentSection();
}
function delDocument(i){
  const docs = documentDisplayItems();
  const d = docs[i];
  if(!d) return;
  if(d.locked) return notify("این مدرک، مجوز ثبت‌شده سمن است و از بخش ثبت اطلاعات سمن مدیریت می‌شود.");
  const idx = state.documents.findIndex(x => x.id === d.id);
  if(idx < 0) return notify("مدرک انتخاب‌شده در لیست اصلی پیدا نشد.");
  if(confirm("حذف مدرک؟")){
    state.documents.splice(idx,1);
    state.attachments = state.attachments.filter(x=>x.id !== d.id);
    saveState(); renderCurrentSection();
  }
}

function tableHtml(headers, rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${String(c).startsWith("<button")?c:esc(c)}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}">رکوردی ثبت نشده است.</td></tr>`}</tbody></table></div>`;
}
function actionBtn(fn,i){ return `<button class="danger" onclick="${fn}(${i})">حذف</button>`; }

function checklistItems(){
  const info = state.lockedBaseInfo||{}, lic = state.license||{};
  return [
    ["فعال‌سازی کلاینت", !!state.activated],
    ["تکمیل اولیه انجام شده", !!state.initialSetupCompleted],
    ["نام سمن از فایل فعال‌سازی ثبت شده", !!info.organizationName],
    ["اطلاعات مدیرعامل ثبت شده", !!(info.ceoFullName && info.nationalCode)],
    ["حداقل یک عضو هیأت مدیره", state.boardMembers.length>0],
    ["اسکن یا تصویر مجوز", !!(lic.attachmentId || lic.scanPath)],
    ["مجوز منقضی نیست", !!lic.status && lic.status !== "منقضی شده"],
    ["حداقل یک حساب بانکی", state.bankAccounts.length>0],
    ["حداقل یک گزارش مالی ماه", state.monthlyReports.length>0]
  ];
}
function showChecklist(){
  const items = checklistItems();
  let text = "چک‌لیست آماده ارسال به ادمین\n\n" + items.map(([t,ok])=>(ok?"✅ ":"❌ ")+t).join("\n");
  const missing = items.filter(x=>!x[1]).map(x=>x[0]);
  text += missing.length ? "\n\nپرونده ناقص است:\n- "+missing.join("\n- ") : "\n\nپرونده آماده ارسال به ادمین است.";
  notify(text);
}

function exportPayload(){
  const payload = {
    type:"JAVANROOD_CLIENT_EXPORT",
    exportVersion:"JAVANROOD_CLIENT_ANDROID_MOBILE_RELEASE",
    createdAt:nowIso(),
    lockedBaseInfo:state.lockedBaseInfo,
    initialSetupCompleted:state.initialSetupCompleted,
    boardMembers:state.boardMembers,
    license:{...state.license},
    licenses:state.licenses || [],
    monthlyReports:state.monthlyReports,
    financeCarryovers:state.financeCarryovers || {},
    currentExpenses:state.currentExpenses,
    bankAccounts:state.bankAccounts,
    beneficiaries:state.beneficiaries || [],
    documents:(state.documents||[]).map(stripBase64),
    attachments:(state.attachments||[]).map(stripBase64)
  };
  return payload;
}
function stripBase64(a){
  const {base64, ...rest} = a;
  return rest;
}
function saveExportBase64File(fileName, mime, base64){
  if(window.AndroidBridge && AndroidBridge.saveBase64FileWithPicker){
    try{
      AndroidBridge.saveBase64FileWithPicker(fileName, mime, base64);
      return;
    }catch(e){
      console.warn("save picker failed", e);
    }
  }
  saveBase64File(fileName, mime, base64);
}

function saveBase64File(fileName, mime, base64){
  if(window.AndroidBridge && AndroidBridge.saveBase64File){
    const path = AndroidBridge.saveBase64File(fileName, mime, base64);
    if(path) notify("فایل ذخیره شد:\n" + path);
  } else {
    const a = document.createElement("a");
    a.href = `data:${mime};base64,${base64}`;
    a.download = fileName;
    a.click();
  }
}
function utf8ToBase64(str){
  const bytes = enc.encode(str);
  let bin = "";
  bytes.forEach(b=>bin += String.fromCharCode(b));
  return btoa(bin);
}

function safeExportNamePart(v){
  return String(v || "سمن")
    .trim()
    .replace(/[\/:*?"<>|]+/g,"_")
    .replace(/\s+/g,"_")
    .slice(0,70) || "سمن";
}
function exportFileStamp(){
  const d = currentJalaliDate();
  const jm = String(d.jm).padStart(2,"0");
  const jd = String(d.jd).padStart(2,"0");
  const t = new Date();
  const hh = String(t.getHours()).padStart(2,"0");
  const mm = String(t.getMinutes()).padStart(2,"0");
  return `${toFaDigits(d.jy)}_${toFaDigits(jm)}_${toFaDigits(jd)}_${toFaDigits(hh)}${toFaDigits(mm)}`;
}
function exportFileBaseName(kind){
  const org = safeExportNamePart((state.lockedBaseInfo || {}).organizationName || "کلاینت");
  return `${kind}_${org}_${exportFileStamp()}`;
}
function exportJson(){
  const payload = exportPayload();
  const name = `${exportFileBaseName("خروجی_JSON_کلاینت")}.json`;
  saveExportBase64File(name, "application/json", utf8ToBase64(JSON.stringify(payload,null,2)));
}
async function exportPackage(){
  const missing = checklistItems().filter(x=>!x[1]).map(x=>x[0]);
  if(missing.length && !confirm("پرونده ناقص است:\n- "+missing.join("\n- ")+"\n\nبا این حال پکیج ساخته شود؟")) return;

  const payload = exportPayload();
  const files = [];
  const manifest = {type:"JAVANROOD_CLIENT_PACKAGE", packageVersion:"ANDROID_V34", appBuild:APP_BUILD, createdAt:nowIso(), organizationName:state.lockedBaseInfo.organizationName||"", attachmentCount:0, files:[]};

  function addAttachment(att, prefix){
    if(!att.base64) return;
    const safe = (att.name || att.title || ("file_"+Date.now())).replace(/[\\/:*?"<>|]+/g,"_");
    const arc = `attachments/${prefix}_${safe}`;
    manifest.files.push({title:att.title||safe, archivePath:arc, mime:att.mime||"application/octet-stream"});
    files.push({name:arc, bytes:base64ToBytes(att.base64)});
    const apply = (item)=>{ if(item.id===att.id){ item.packagePath = arc; item.path = arc; } };
    payload.documents.forEach(apply);
    payload.attachments.forEach(apply);
    if(payload.license.attachmentId === att.id){ payload.license.packagePath = arc; payload.license.scanPath = arc; }
  }
  state.attachments.forEach((a,i)=>addAttachment(a, "att"+(i+1)));
  state.documents.forEach((a,i)=>addAttachment(a, "doc"+(i+1)));
  manifest.attachmentCount = manifest.files.length;

  files.unshift({name:"manifest.json", bytes:enc.encode(JSON.stringify(manifest,null,2))});
  files.unshift({name:"export.json", bytes:enc.encode(JSON.stringify(payload,null,2))});

  const zipBytes = createZip(files);
  const base64 = bytesToBase64(zipBytes);
  const org = (state.lockedBaseInfo.organizationName||"client").replace(/\s+/g,"_");
  saveExportBase64File(`${exportFileBaseName("پکیج_ادمین_کلاینت")}.jvnpkg`, "application/octet-stream", base64);
}

function base64ToBytes(b64){
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes){
  let bin = "";
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    bin += String.fromCharCode.apply(null, bytes.subarray(i,i+chunk));
  }
  return btoa(bin);
}

// Minimal ZIP writer, store method 0, with CRC32
const crcTable = (()=>{ let c,t=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=((c&1)?(0xEDB88320^(c>>>1)):(c>>>1)); t[n]=c>>>0;} return t; })();
function crc32(bytes){ let c=0xffffffff; for(let i=0;i<bytes.length;i++) c=crcTable[(c^bytes[i])&0xff]^(c>>>8); return (c^0xffffffff)>>>0; }
function u16(n){ return [n&255,(n>>>8)&255]; }
function u32(n){ return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]; }
function createZip(files){
  let parts=[], central=[], offset=0;
  files.forEach(f=>{
    const nameBytes = enc.encode(f.name);
    const data = f.bytes;
    const crc = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)
    ]);
    parts.push(local,nameBytes,data);
    const cent = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset)
    ]);
    central.push(cent,nameBytes);
    offset += local.length + nameBytes.length + data.length;
  });
  const centralSize = central.reduce((a,b)=>a+b.length,0);
  const centralOffset = offset;
  const end = new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(centralOffset),...u16(0)]);
  const size = parts.reduce((a,b)=>a+b.length,0)+centralSize+end.length;
  const out = new Uint8Array(size); let pos=0;
  [...parts,...central,end].forEach(p=>{ out.set(p,pos); pos+=p.length; });
  return out;
}

// Jalali helpers
const PD="۰۱۲۳۴۵۶۷۸۹", AD="٠١٢٣٤٥٦٧٨٩";
function normDigits(s){ s=String(s||""); [...PD].forEach((ch,i)=>s=s.replaceAll(ch,String(i))); [...AD].forEach((ch,i)=>s=s.replaceAll(ch,String(i))); return s; }
function parseJalali(t){
  const p = normDigits(t).replaceAll("-","/").replaceAll(".","/").split("/").filter(Boolean).map(Number);
  if(p.length!==3) throw new Error("فرمت تاریخ باید مثل ۱۴۰۴/۰۲/۱۰ باشد.");
  return p;
}
function isLeap(jy){ return (((jy+38)*682)%2816)<682; }
function mdays(jy,jm){ if(jm<=6)return 31; if(jm<=11)return 30; return isLeap(jy)?30:29; }
function addMonthsJ(jy,jm,jd,months){ let total=jy*12+(jm-1)+months; let ny=Math.floor(total/12), nm=total%12+1, nd=Math.min(jd,mdays(ny,nm)); return [ny,nm,nd]; }
function jdnJ(jy,jm,jd){ let epbase=jy-(jy>=0?474:473), epyear=474+(epbase%2820); let md=jm<=7?(jm-1)*31:((jm-1)*30+6); return jd+md+Math.floor((epyear*682-110)/2816)+(epyear-1)*365+Math.floor(epbase/2820)*1029983+1948319; }
function jdnG(d){ let gy=d.getFullYear(),gm=d.getMonth()+1,gd=d.getDate(); let a=Math.floor((14-gm)/12), y=gy+4800-a, m=gm+12*a-3; return gd+Math.floor((153*m+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)-32045; }
function fmtJ(y,m,d){ return `${String(y).padStart(4,"0")}/${String(m).padStart(2,"0")}/${String(d).padStart(2,"0")}`; }
function licenseExpiryInfo(renewal, duration){
  const [y,m,d] = parseJalali(renewal);
  const [ey,em,ed] = addMonthsJ(y,m,d,duration);
  const rem = jdnJ(ey,em,ed) - jdnG(new Date());
  return {expiryDate:fmtJ(ey,em,ed), remainingDays:rem, status: rem<0?"منقضی شده":(rem<=30?"نزدیک انقضا":"فعال")};
}

try{ render(); }catch(e){ showFatalError(e); }

