
/* =========================================================
   وِزنة V35
   كل الأحداث مربوطة بـ addEventListener
   لا يوجد inline onclick
========================================================= */

const STORAGE_KEY = "wiznah_v35";
const LEGACY_STORAGE_KEY = "wiznah_v20";
const LEGACY_V18_KEY = "wiznah_v18";
const LEGACY_V11_KEY = "wiznah_v11";

const DEFAULT_STATE = {
  onboarded:false,
  onboardStep:0,
  salary:0,
  salaryDay:27,
  extraIncome:0,
  commitments:[],
  debts:[],
  budgets:[],
  transactions:[],
  savingsPlans:[],
  currentPage:"home"
};

let state = loadState();

let selectedIcon = "🧺";
let currentBudgetId = null;
let editingType = null;
let editingId = null;
let toastTimer = null;


/* =========================================================
   STORAGE
========================================================= */

function loadState(){
  try{
    let saved = localStorage.getItem(STORAGE_KEY);
    let migrated = false;
    if(!saved){ saved=localStorage.getItem(LEGACY_V18_KEY); migrated=!!saved; }
    if(!saved){ saved=localStorage.getItem(LEGACY_STORAGE_KEY); migrated=!!saved; }
    if(!saved){ saved=localStorage.getItem(LEGACY_V11_KEY); migrated=!!saved; }
    if(!saved){ return structuredClone(DEFAULT_STATE); }

    const parsed = JSON.parse(saved);

    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      extraIncome:Number(parsed.extraIncome||0),
      commitments:(Array.isArray(parsed.commitments) ? parsed.commitments : []).map(c=>({
        id:c.id||id(),
        name:c.name||"التزام",
        amount:Number(c.amount||0),
        dueDay:Math.min(31,Math.max(1,Number(c.dueDay||1))),
        icon:c.icon||"🧾"
      })),
      debts:Array.isArray(parsed.debts) ? parsed.debts : [],
      budgets:Array.isArray(parsed.budgets) ? parsed.budgets : [],
      transactions:Array.isArray(parsed.transactions) ? parsed.transactions : [],
      savingsPlans:Array.isArray(parsed.savingsPlans) ? parsed.savingsPlans : []
    };

  }catch(error){
    console.error(error);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}


/* =========================================================
   HELPERS
========================================================= */

function id(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function money(value){
  const n = Number(value) || 0;

  return new Intl.NumberFormat("ar-SA",{
    maximumFractionDigits:0
  }).format(Math.round(n));
}

function moneyDecimal(value){
  const n = Number(value) || 0;

  return new Intl.NumberFormat("ar-SA",{
    maximumFractionDigits:2
  }).format(n);
}

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function today(){
  return new Date();
}

function monthKey(date = new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}

function isThisMonth(timestamp){
  return monthKey(new Date(timestamp)) === monthKey();
}

function daysUntilSalary(){

  const now = new Date();

  const requestedDay = Math.min(31, Math.max(1, Number(state.salaryDay) || 27));
  const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  let target = new Date(now.getFullYear(), now.getMonth(), Math.min(requestedDay,lastDayThisMonth));

  if(target <= now){
    const nextMonthLastDay = new Date(now.getFullYear(), now.getMonth()+2, 0).getDate();
    target = new Date(now.getFullYear(), now.getMonth()+1, Math.min(requestedDay,nextMonthLastDay));
  }

  return Math.max(
    0,
    Math.ceil((target-now)/(1000*60*60*24))
  );
}

function monthsBetween(start,end){

  const a = new Date(start);
  const b = new Date(end);

  let months =
    (b.getFullYear()-a.getFullYear())*12 +
    (b.getMonth()-a.getMonth());

  if(b.getDate() < a.getDate()){
    months -= .5;
  }

  return Math.max(1,months);
}


/* =========================================================
   FINANCIAL CALCULATIONS
========================================================= */

function monthlyCommitments(){
  return state.commitments.reduce((sum,item)=>sum + Number(item.amount || 0),0);
}

function monthCommitmentPayments(commitmentId=null){
  return state.transactions
    .filter(t=>t.type==="commitment" && isThisMonth(t.date) && (!commitmentId || t.commitmentId===commitmentId))
    .reduce((sum,t)=>sum + Number(t.amount||0),0);
}

function remainingCommitmentAmount(commitment){
  return Math.max(0, Number(commitment.amount||0) - monthCommitmentPayments(commitment.id));
}

function monthlyDebtObligation(){
  return state.debts.reduce((sum,item)=>sum + Number(item.monthlyPayment || 0),0);
}

function monthExpenses(){

  return state.transactions
    .filter(t=>t.type==="expense" && isThisMonth(t.date))
    .reduce((sum,t)=>sum + Number(t.amount || 0),0);
}

function monthDebtPayments(){

  return state.transactions
    .filter(t=>t.type==="debt" && isThisMonth(t.date))
    .reduce((sum,t)=>sum + Number(t.amount || 0),0);
}

function monthSavings(){
  return state.transactions.filter(t=>(t.type==="saving"||t.type==="saving_withdrawal")&&isThisMonth(t.date)).reduce((sum,t)=>sum+(t.type==="saving"?Number(t.amount||0):-Number(t.amount||0)),0);
}
function totalSaved(){ return state.savingsPlans.reduce((sum,p)=>sum+Math.max(0,Number(p.saved||0)),0); }

function budgetSpent(budgetId){

  return state.transactions
    .filter(t=>
      t.type==="expense" &&
      t.budgetId===budgetId &&
      isThisMonth(t.date)
    )
    .reduce((sum,t)=>sum + Number(t.amount || 0),0);
}

function plannedBudgetTotal(){

  return state.budgets.reduce(
    (sum,b)=>sum + Number(b.amount || 0),
    0
  );
}

function safetyBuffer(){

  const salary = Number(state.salary) || 0;

  if(!salary) return 0;

  return Math.max(
    300,
    salary * .05
  );
}

function monthExtraIncome(){
  return state.transactions.filter(t=>t.type==="income"&&isThisMonth(t.date)).reduce((s,t)=>s+Number(t.amount||0),0);
}
function currentIncome(){
  return Number(state.salary||0)+Number(state.extraIncome||0)+monthExtraIncome();
}

function dailySafeSpend(){
  const days=Math.max(1,daysUntilSalary());
  return Math.max(0,safeAvailable()/days);
}

function spendingByBudget(){
  return state.budgets.map(b=>({name:b.name,icon:b.icon,spent:budgetSpent(b.id)})).filter(x=>x.spent>0).sort((a,b)=>b.spent-a.spent);
}
function totalExpensesByCategory(){ return spendingByBudget().reduce((s,x)=>s+x.spent,0); }

function availableToSave(){
  const recurringIncome = currentIncome();
  const plannedCommitments = monthlyCommitments();
  const plannedDebts = monthlyDebtObligation();
  const plannedBudgets = plannedBudgetTotal();
  const result = recurringIncome - plannedCommitments - plannedDebts - plannedBudgets - safetyBuffer();
  return Math.max(0,result);
}

function cashAvailable(){
  const income = currentIncome();
  if(!income) return 0;
  const spent = monthExpenses();
  const debtsPaid = monthDebtPayments();
  const commitmentPaid = monthCommitmentPayments();
  const savedNet = monthSavings();
  return Math.max(0, income - spent - debtsPaid - commitmentPaid - savedNet);
}

function safeAvailable(){
  const income = currentIncome();
  if(!income) return 0;

  const currentCash = cashAvailable();
  const remainingCommitments = Math.max(0, monthlyCommitments() - monthCommitmentPayments());
  const remainingDebt = Math.max(0, monthlyDebtObligation() - monthDebtPayments());
  const remainingBudgets = state.budgets.reduce((sum,b)=>{
    const spentBudget=budgetSpent(b.id);
    return sum + Math.max(0,Number(b.amount||0)-spentBudget);
  },0);
  const reserved = remainingCommitments + remainingDebt + remainingBudgets + safetyBuffer();
  return Math.max(0,currentCash-reserved);
}

function financialScore(){

  if(!state.salary){
    return {
      score:0,
      title:"أدخل راتبك أول",
      text:"وبعدها وِزنة يحسب وضعك المالي."
    };
  }

  const salary = Number(state.salary);

  const debtRatio =
    monthlyDebtObligation()/salary;

  const commitmentRatio =
    monthlyCommitments()/salary;

  const budgetRatio =
    plannedBudgetTotal()/salary;

  let score = 100;

  score -= Math.min(35,debtRatio*70);
  score -= Math.min(25,commitmentRatio*50);
  score -= Math.min(25,budgetRatio*35);

  if(state.savingsPlans.length===0){
    score -= 5;
  }

  const currentSaving = monthSavings();

  if(currentSaving > 0){
    score += 5;
  }

  score = Math.max(0,Math.min(100,Math.round(score)));

  let title = "ممتاز 👌";
  let text = "توزيعك المالي جيد.";

  if(score < 85){
    title = "وضعك جيد";
    text = "فيه مجال بسيط لتحسين توزيع راتبك.";
  }

  if(score < 70){
    title = "نحتاج نرتبها";
    text = "الأقساط أو الالتزامات تحتاج انتباه.";
  }

  if(score < 50){
    title = "خلنا نهدّي الصرف";
    text = "عندك ضغط مالي واضح هذا الشهر.";
  }

  return {score,title,text};
}

function getInsight(){

  if(!state.salary){
    return {
      icon:"👋",
      text:"ابدأ بالراتب، وبعدها وِزنة ترتب لك الصورة."
    };
  }

  const safe = safeAvailable();
  const days = daysUntilSalary();
  const debt = monthlyDebtObligation();

  if(debt > state.salary*.4){
    return {
      icon:"⚠️",
      text:"الأقساط أخذت نسبة كبيرة من راتبك. خل الأولوية لتخفيف الالتزامات."
    };
  }

  if(safe < state.salary*.1){
    return {
      icon:"🛑",
      text:`المتاح الآمن صار منخفض. حاول تخفف المشتريات غير الضرورية خلال ${days} يوم القادمة.`
    };
  }

  if(state.savingsPlans.length===0){
    return {
      icon:"🎯",
      text:"عندك مساحة تبدأ هدف ادخار بسيط. حتى 300 ريال شهريًا تفرق."
    };
  }

  if(days <= 5){
    return {
      icon:"⏳",
      text:"الراتب قريب. حاول ما تسحب من المبلغ المحجوز للأقساط والمحافظ."
    };
  }

  return {
    icon:"✨",
    text:"وضعك تحت السيطرة. قبل أي شراء كبير، اسأل وِزنة."
  };
}


/* =========================================================
   SMS IMPORT
========================================================= */
function normalizeDigits(text){
  return String(text||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function parseBankSMS(raw){
  const text=normalizeDigits(String(raw||'').replace(/\+/g,' '));
  const amountPatterns=[
    /(?:SAR|ر\.?س|ريال)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
    /([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:SAR|ر\.?س|ريال)/i,
    /(?:مبلغ|بقيمة|بمبلغ|amount)\s*[:：]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i
  ];
  let amount=0;
  for(const re of amountPatterns){const m=text.match(re);if(m){amount=Number(String(m[1]).replace(/,/g,''));if(amount>0)break;}}
  if(!amount){
    const nums=[...text.matchAll(/\b\d{1,6}(?:[.,]\d{1,2})?\b/g)].map(m=>Number(m[0].replace(',','.'))).filter(n=>n>0&&n<100000);
    amount=nums.length?nums[nums.length-1]:0;
  }
  let merchant='عملية بنكية';
  const merchantMatch=text.match(/(?:لدى|عند|في|to|at)\s*[:：-]?\s*([^\n،,|؛;]+)/i);
  if(merchantMatch) merchant=merchantMatch[1].trim().replace(/(?:رصيد|متبقي|balance).*$/i,'').trim();
  if(merchant.length>45) merchant=merchant.slice(0,45).trim();
  return {amount,merchant,raw:text};
}

function importSMSFromURL(){
  const params=new URLSearchParams(location.search);
  let encoded=params.get('wiznah_sms');
  if(!encoded){
    const marker='/wiznah_sms/';
    const path=location.pathname||'';
    const i=path.indexOf(marker);
    if(i>=0) encoded=path.slice(i+marker.length);
  }
  if(!encoded) return;
  try{
    encoded=decodeURIComponent(encoded);
  }catch(e){}
  try{
    const parsed=parseBankSMS(encoded);
    if(parsed.amount<=0){toast('ما قدرت أتعرف على مبلغ الرسالة','bad');return;}
    const fingerprint=btoa(unescape(encodeURIComponent(parsed.raw))).slice(0,120);
    const exists=state.transactions.some(t=>t.source==='sms'&&t.fingerprint===fingerprint);
    if(exists){toast('هذه العملية مسجلة مسبقًا','bad');return;}
    state.transactions.push({id:id(),type:'expense',amount:parsed.amount,name:parsed.merchant,budgetId:state.budgets[0]?.id||'',date:Date.now(),source:'sms',fingerprint});
    saveState();
    renderCurrentPage();
    toast(`تم تسجيل ${money(parsed.amount)} ر.س تلقائيًا 🎉`,'good');
    history.replaceState({},'',location.origin+location.pathname.replace(/\/wiznah_sms\/.*$/,'/'));
  }catch(e){console.error(e);toast('تعذر استيراد الرسالة','bad');}
}

function openShortcuts(){
  try{
    window.location.href='webapp://i8ztr.github.io/Wiznah2/';
  }catch(e){
    toast('افتح وِزنة من الشاشة الرئيسية ثم جرّب الاختصار','bad');
  }
}

/* =========================================================
   NAVIGATION
========================================================= */

function showPage(page){

  document.querySelectorAll(".screen").forEach(screen=>{
    screen.classList.remove("active");
  });

  const target = document.getElementById(page);

  if(target){
    target.classList.add("active");
  }

  state.currentPage = page;
  saveState();

  document.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.classList.toggle(
      "active",
      btn.dataset.page===page
    );
  });

  renderCurrentPage();
}

function renderCurrentPage(){

  renderHome();
  renderBudgets();
  renderCommitments();
  renderDebts();
  renderSavings();
  renderActivity();
  renderAnalysis();
  renderSettings();

  if(currentBudgetId){
    renderBudgetDetail();
  }
}


/* =========================================================
   ONBOARDING
========================================================= */

function renderOnboarding(){

  const content = document.getElementById("onboardContent");
  const dots = document.querySelectorAll("#onboardSteps .step-dot");

  dots.forEach((dot,index)=>{
    dot.classList.toggle(
      "active",
      index===state.onboardStep
    );
  });

  if(state.onboardStep===0){

    content.innerHTML = `
      <div class="form-group">
        <label class="label">كم راتبك الشهري؟</label>
        <input id="onSalary" class="input" type="number" inputmode="decimal" placeholder="مثال: 7000">
      </div>

      <div class="form-group">
        <label class="label">متى ينزل الراتب؟</label>
        <input id="onSalaryDay" class="input" type="number" min="1" max="31" value="${state.salaryDay || 27}">
        <div class="helper">مثال: إذا راتبك ينزل يوم 27 اكتب 27.</div>
      </div>

      <div class="onboard-actions">
        <button type="button" class="btn btn-primary" data-onboard="next">
          نبدأ 🚀
        </button>
      </div>
    `;

    return;
  }


  if(state.onboardStep===1){

    content.innerHTML = `
      <div style="font-size:20px;font-weight:900;margin-bottom:6px">
        عندك التزامات ثابتة؟
      </div>

      <div class="helper" style="margin-bottom:18px">
        مثل إيجار، جوال، إنترنت، اشتراكات، أو أي مبلغ شهري ثابت.
      </div>

      <div id="onCommitments" class="list"></div>

      <button type="button" class="btn btn-secondary" style="width:100%;margin-top:12px" data-onboard="add-commitment">
        + إضافة التزام
      </button>

      <div class="onboard-actions">
        <button type="button" class="btn btn-secondary" data-onboard="back">
          رجوع
        </button>

        <button type="button" class="btn btn-primary" data-onboard="next">
          التالي
        </button>
      </div>
    `;

    renderOnboardingCommitments();

    return;
  }


  if(state.onboardStep===2){

    content.innerHTML = `
      <div style="font-size:20px;font-weight:900;margin-bottom:6px">
        عندك أقساط؟
      </div>

      <div class="helper" style="margin-bottom:18px">
        أضف القسط الشهري والمبلغ المتبقي، ووِزنة بتحسب تأثيره عليك.
      </div>

      <div id="onDebts" class="list"></div>

      <button type="button" class="btn btn-secondary" style="width:100%;margin-top:12px" data-onboard="add-debt">
        + إضافة قسط
      </button>

      <div class="onboard-actions">
        <button type="button" class="btn btn-secondary" data-onboard="back">
          رجوع
        </button>

        <button type="button" class="btn btn-primary" data-onboard="next">
          التالي
        </button>
      </div>
    `;

    renderOnboardingDebts();

    return;
  }


  if(state.onboardStep===3){

    content.innerHTML = `
      <div style="font-size:20px;font-weight:900;margin-bottom:6px">
        خلاص، وِزنة جاهزة 🔥
      </div>

      <div class="helper" style="margin-bottom:20px">
        بنحسب لك المتاح الآمن، الأقساط، المحافظ،
        وخطط الادخار من نفس البيانات.
      </div>

      <div class="card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span style="color:var(--muted);font-size:11px">راتبك</span>
          <strong>${money(state.salary)} ر.س</strong>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span style="color:var(--muted);font-size:11px">الالتزامات</span>
          <strong>${money(monthlyCommitments())} ر.س</strong>
        </div>

        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--muted);font-size:11px">الأقساط</span>
          <strong>${money(monthlyDebtObligation())} ر.س</strong>
        </div>
      </div>

      <div class="onboard-actions">
        <button type="button" class="btn btn-secondary" data-onboard="back">
          رجوع
        </button>

        <button type="button" class="btn btn-primary" data-onboard="finish">
          افتح وِزنة ✨
        </button>
      </div>
    `;
  }
}

function renderOnboardingCommitments(){

  const el = document.getElementById("onCommitments");

  if(!el) return;

  if(state.commitments.length===0){

    el.innerHTML = `
      <div style="text-align:center;color:var(--muted);font-size:12px;padding:12px">
        ما أضفت أي التزام — عادي، تقدر تضيفه لاحقًا.
      </div>
    `;

    return;
  }

  el.innerHTML = state.commitments.map(item=>`
    <div class="card row-card">

      <div class="row-icon">🧾</div>

      <div class="row-main">
        <div class="row-name">${escapeHTML(item.name)}</div>
        <div class="row-sub">${money(item.amount)} ر.س شهريًا</div>
      </div>

      <div class="row-actions">
        <button type="button" class="small-btn primary" data-action="edit-commitment" data-id="${item.id}">تعديل</button>
        <button type="button" class="small-btn danger" data-action="delete-commitment" data-id="${item.id}">حذف</button>
      </div>

    </div>
  `).join("");
}

function renderOnboardingDebts(){

  const el = document.getElementById("onDebts");

  if(!el) return;

  if(state.debts.length===0){

    el.innerHTML = `
      <div style="text-align:center;color:var(--muted);font-size:12px;padding:12px">
        ما عندك أقساط؟ ممتاز 👌
      </div>
    `;

    return;
  }

  el.innerHTML = state.debts.map(item=>`
    <div class="card row-card">

      <div class="row-icon">💳</div>

      <div class="row-main">
        <div class="row-name">${escapeHTML(item.name)}</div>
        <div class="row-sub">
          ${money(item.monthlyPayment)} ر.س / شهر
          · باقي ${money(item.remainingTotal)} ر.س
        </div>
      </div>

      <button type="button"
        class="small-btn danger"
        data-action="delete-debt"
        data-id="${item.id}">
        حذف
      </button>

    </div>
  `).join("");
}

function nextOnboarding(){

  if(state.onboardStep===0){

    const salary =
      Number(document.getElementById("onSalary")?.value || 0);

    const day =
      Number(document.getElementById("onSalaryDay")?.value || 27);

    if(salary<=0){
      toast("اكتب راتبك أول عشان نحسب لك صح","bad");
      return;
    }

    if(day<1 || day>31){
      toast("يوم الراتب لازم يكون بين 1 و31","bad");
      return;
    }

    state.salary = salary;
    state.salaryDay = day;
  }

  state.onboardStep++;

  saveState();
  renderOnboarding();
}

function backOnboarding(){

  if(state.onboardStep>0){
    state.onboardStep--;
    saveState();
    renderOnboarding();
  }
}

function finishOnboarding(){

  state.onboarded = true;
  state.onboardStep = 0;
  state.currentPage = "home";

  saveState();

  document.getElementById("onboarding")
    .classList.remove("active");

  showPage("home");

  toast("تم تجهيز وِزنة لك ✨","good");
}


/* =========================================================
   MODAL SYSTEM
========================================================= */

const modal = document.getElementById("modal");
const modalContent = document.getElementById("modalContent");

function openModal(html){

  modalContent.innerHTML = html;

  if(!modal.open){
    modal.showModal();
  }

  setTimeout(()=>{
    modalContent.querySelector("input,select")?.focus();
  },50);
}

function closeModal(){

  if(modal.open){
    modal.close();
  }

  editingType = null;
  editingId = null;
}

modal.addEventListener("click",e=>{
  if(e.target===modal){
    closeModal();
  }
});

modal.addEventListener("cancel",()=>{
  closeModal();
});


/* =========================================================
   COMMITMENTS
========================================================= */

function openCommitmentForm(idValue=null){

  editingType = "commitment";
  editingId = idValue;

  const item =
    state.commitments.find(x=>x.id===idValue);

  openModal(`
    <div class="modal-head">
      <div class="modal-title">
        ${item ? "تعديل الالتزام" : "إضافة التزام"}
      </div>

      <button type="button" class="close-btn" data-action="close-modal">
        ×
      </button>
    </div>

    <div class="form-group">
      <label class="label">اسم الالتزام</label>
      <input id="modalName" class="input"
        value="${escapeHTML(item?.name || "")}"
        placeholder="مثال: الإنترنت">
    </div>

    <div class="form-group">
      <label class="label">المبلغ الشهري</label>
      <input id="modalAmount" class="input"
        type="number"
        inputmode="decimal"
        value="${item?.amount || ""}"
        placeholder="مثال: 349">
    </div>

    <div class="form-group">
      <label class="label">يوم الاستحقاق</label>
      <input id="modalDueDay" class="input" type="number" min="1" max="31" inputmode="numeric" value="${item?.dueDay || 1}" placeholder="مثال: 1">
      <div class="helper">وِزنة تستخدمه لتنبهك قبل موعد الدفع.</div>
    </div>

    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="close-modal">
        إلغاء
      </button>

      <button type="button" class="btn btn-primary" data-action="save-commitment">
        حفظ
      </button>
    </div>
  `);
}

function saveCommitment(){

  const name =
    document.getElementById("modalName")?.value.trim();

  const amount =
    Number(document.getElementById("modalAmount")?.value || 0);

  const dueDay =
    Number(document.getElementById("modalDueDay")?.value || 1);

  if(!name){
    toast("اكتب اسم الالتزام","bad");
    return;
  }

  if(amount<=0){
    toast("اكتب مبلغ صحيح","bad");
    return;
  }

  if(dueDay<1 || dueDay>31){
    toast("يوم الاستحقاق غير صحيح","bad");
    return;
  }

  if(editingId){

    const item =
      state.commitments.find(x=>x.id===editingId);

    if(item){
      item.name = name;
      item.amount = amount;
      item.dueDay = dueDay;
    }

  }else{

    state.commitments.push({
      id:id(),
      name,
      amount,
      dueDay,
      icon:"🧾"
    });

  }

  saveState();
  closeModal();
  renderCurrentPage();

  if(state.onboardStep===1){
    renderOnboarding();
  }

  toast("تم حفظ الالتزام","good");
}


function payCommitment(commitmentId){
  const item=state.commitments.find(x=>x.id===commitmentId);
  if(!item)return;
  const remaining=remainingCommitmentAmount(item);
  if(remaining<=0){toast("هذا الالتزام مدفوع هذا الشهر");return;}
  state.transactions.push({id:id(),type:"commitment",amount:remaining,name:`سداد ${item.name}`,commitmentId:item.id,date:Date.now()});
  saveState();renderCurrentPage();toast(`تم تسجيل سداد ${money(remaining)} ر.س ✅`,"good");
}

function unpayCommitment(commitmentId){
  const tx=state.transactions.filter(t=>t.type==="commitment"&&t.commitmentId===commitmentId&&isThisMonth(t.date)).sort((a,b)=>Number(b.date)-Number(a.date))[0];
  if(!tx){toast("ما فيه دفعة مسجلة لهذا الشهر");return;}
  state.transactions=state.transactions.filter(t=>t.id!==tx.id);
  saveState();renderCurrentPage();toast("تم التراجع عن دفعة الالتزام");
}

/* =========================================================
   DEBTS
========================================================= */

function openDebtForm(idValue=null){

  editingType = "debt";
  editingId = idValue;

  const item =
    state.debts.find(x=>x.id===idValue);

  openModal(`
    <div class="modal-head">

      <div class="modal-title">
        ${item ? "تعديل القسط" : "إضافة قسط"}
      </div>

      <button type="button" class="close-btn" data-action="close-modal">
        ×
      </button>

    </div>

    <div class="form-group">
      <label class="label">اسم القسط</label>
      <input id="modalDebtName" class="input"
        value="${escapeHTML(item?.name || "")}"
        placeholder="مثال: آيفون">
    </div>

    <div class="form-group">
      <label class="label">المبلغ المتبقي كامل</label>
      <input id="modalDebtRemaining" class="input"
        type="number"
        inputmode="decimal"
        value="${item?.remainingTotal || ""}"
        placeholder="مثال: 4800">
    </div>

    <div class="form-group">
      <label class="label">القسط الشهري</label>
      <input id="modalDebtMonthly" class="input"
        type="number"
        inputmode="decimal"
        value="${item?.monthlyPayment || ""}"
        placeholder="مثال: 400">
    </div>

    <div class="form-group">
      <label class="label">يوم الاستحقاق</label>
      <input id="modalDebtDay" class="input"
        type="number"
        min="1"
        max="31"
        inputmode="numeric"
        value="${item?.dueDay || 27}"
        placeholder="27">
    </div>

    <div class="helper">
      عند تسجيل "سددت القسط" ينقص المبلغ المتبقي تلقائيًا.
    </div>

    <div class="modal-actions">

      <button type="button" class="btn btn-secondary" data-action="close-modal">
        إلغاء
      </button>

      <button type="button" class="btn btn-primary" data-action="save-debt">
        حفظ
      </button>

    </div>
  `);
}

function saveDebt(){

  const name =
    document.getElementById("modalDebtName")?.value.trim();

  const remaining =
    Number(document.getElementById("modalDebtRemaining")?.value || 0);

  const monthly =
    Number(document.getElementById("modalDebtMonthly")?.value || 0);

  const due =
    Number(document.getElementById("modalDebtDay")?.value || 27);

  if(!name){
    toast("اكتب اسم القسط","bad");
    return;
  }

  if(remaining<=0){
    toast("اكتب المبلغ المتبقي","bad");
    return;
  }

  if(monthly<=0){
    toast("اكتب القسط الشهري","bad");
    return;
  }

  if(due<1 || due>31){
    toast("يوم الاستحقاق غير صحيح","bad");
    return;
  }

  if(editingId){

    const item =
      state.debts.find(x=>x.id===editingId);

    if(item){

      item.name = name;
      item.monthlyPayment = monthly;
      item.dueDay = due;

      /*
        إذا عدّل المستخدم المبلغ المتبقي،
        نحدّثه.
      */
      item.remainingTotal = remaining;

    }

  }else{

    state.debts.push({
      id:id(),
      name,
      remainingTotal:remaining,
      initialTotal:remaining,
      monthlyPayment:monthly,
      dueDay:due,
      createdAt:Date.now()
    });

  }

  saveState();
  closeModal();
  renderCurrentPage();

  if(state.onboardStep===2){
    renderOnboarding();
  }

  toast("تم حفظ القسط","good");
}

function payDebt(debtId){

  const debt =
    state.debts.find(x=>x.id===debtId);

  if(!debt) return;

  const amount =
    Math.min(
      Number(debt.monthlyPayment || 0),
      Number(debt.remainingTotal || 0)
    );

  if(amount<=0){
    toast("هذا القسط مكتمل بالفعل","good");
    return;
  }

  openModal(`
    <div class="modal-head">
      <div class="modal-title">تأكيد سداد القسط</div>
      <button type="button" class="close-btn" data-action="close-modal">×</button>
    </div>

    <div style="text-align:center;padding:10px 0 20px">

      <div style="font-size:44px">💳</div>

      <div style="font-size:17px;font-weight:900;margin-top:10px">
        ${escapeHTML(debt.name)}
      </div>

      <div style="font-size:27px;font-weight:950;margin-top:6px">
        ${money(amount)} ر.س
      </div>

      <div style="color:var(--muted);font-size:11px;margin-top:5px">
        سيبقى عليك ${money(Math.max(0,debt.remainingTotal-amount))} ر.س
      </div>

    </div>

    <div class="modal-actions">

      <button type="button" class="btn btn-secondary" data-action="close-modal">
        إلغاء
      </button>

      <button type="button"
        class="btn btn-primary"
        data-action="confirm-pay-debt"
        data-id="${debt.id}">
        سددت القسط
      </button>

    </div>
  `);
}

function confirmPayDebt(debtId){

  const debt =
    state.debts.find(x=>x.id===debtId);

  if(!debt) return;

  const amount =
    Math.min(
      Number(debt.monthlyPayment || 0),
      Number(debt.remainingTotal || 0)
    );

  debt.remainingTotal =
    Math.max(
      0,
      Number(debt.remainingTotal || 0)-amount
    );

  state.transactions.push({
    id:id(),
    type:"debt",
    amount,
    debtId:debt.id,
    name:`قسط - ${debt.name}`,
    date:Date.now()
  });

  saveState();
  closeModal();
  renderCurrentPage();

  toast(`تم تسجيل سداد ${money(amount)} ر.س ✓`,"good");
}


/* =========================================================
   BUDGETS
========================================================= */

const ICONS = [
  "🍔","☕","🚗","⛽","🎮","🛒",
  "🏠","📱","🛍️","💊","✈️","🎬"
];

function openBudgetForm(idValue=null){

  editingType = "budget";
  editingId = idValue;

  const item =
    state.budgets.find(x=>x.id===idValue);

  selectedIcon = item?.icon || "🧺";

  openModal(`
    <div class="modal-head">

      <div class="modal-title">
        ${item ? "تعديل المحفظة" : "محفظة جديدة"}
      </div>

      <button type="button" class="close-btn" data-action="close-modal">
        ×
      </button>

    </div>

    <div class="form-group">
      <label class="label">اسم المحفظة</label>
      <input id="modalBudgetName" class="input"
        value="${escapeHTML(item?.name || "")}"
        placeholder="مثال: قهوة">
    </div>

    <div class="form-group">
      <label class="label">الميزانية الشهرية</label>
      <input id="modalBudgetAmount" class="input"
        type="number"
        inputmode="decimal"
        value="${item?.amount || ""}"
        placeholder="مثال: 500">
    </div>

    <div class="form-group">

      <label class="label">الأيقونة</label>

      <div class="icon-grid">

        ${ICONS.map(icon=>`
          <button type="button"
            class="icon-choice ${icon===selectedIcon ? "selected":""}"
            data-icon="${icon}">
            ${icon}
          </button>
        `).join("")}

      </div>

    </div>

    <div class="modal-actions">

      <button type="button" class="btn btn-secondary" data-action="close-modal">
        إلغاء
      </button>

      <button type="button" class="btn btn-primary" data-action="save-budget">
        حفظ
      </button>

    </div>
  `);
}

function saveBudget(){

  const name =
    document.getElementById("modalBudgetName")?.value.trim();

  const amount =
    Number(document.getElementById("modalBudgetAmount")?.value || 0);

  if(!name){
    toast("اكتب اسم المحفظة","bad");
    return;
  }

  if(amount<=0){
    toast("اكتب ميزانية صحيحة","bad");
    return;
  }

  if(editingId){

    const item =
      state.budgets.find(x=>x.id===editingId);

    if(item){
      item.name = name;
      item.amount = amount;
      item.icon = selectedIcon;
    }

  }else{

    state.budgets.push({
      id:id(),
      name,
      amount,
      icon:selectedIcon
    });

  }

  saveState();
  closeModal();
  renderCurrentPage();

  toast("تم حفظ المحفظة","good");
}

function deleteBudget(budgetId){

  const budget =
    state.budgets.find(x=>x.id===budgetId);

  if(!budget) return;

  openConfirm(
    "حذف المحفظة؟",
    `سيتم حذف "${budget.name}" من المحافظ. العمليات السابقة لن تُحذف.`,
    ()=>{
      state.budgets =
        state.budgets.filter(x=>x.id!==budgetId);

      saveState();
      renderCurrentPage();

      toast("تم حذف المحفظة");
    }
  );
}

function openBudgetDetail(budgetId){

  currentBudgetId = budgetId;

  showPage("budgetDetail");

  renderBudgetDetail();
}

function renderBudgetDetail(){

  const budget =
    state.budgets.find(x=>x.id===currentBudgetId);

  const content =
    document.getElementById("budgetDetailContent");

  const header =
    document.getElementById("budgetDetailHeader");

  if(!budget || !content) return;

  header.textContent = budget.name;

  const spent =
    budgetSpent(budget.id);

  const remaining =
    Math.max(0,Number(budget.amount)-spent);

  const percent =
    Math.min(100,(spent/Number(budget.amount))*100);

  const transactions =
    state.transactions
      .filter(t=>t.type==="expense" && t.budgetId===budget.id)
      .sort((a,b)=>b.date-a.date);

  content.innerHTML = `

    <div class="card detail-hero">

      <div class="detail-icon">${budget.icon}</div>

      <div class="detail-name">${escapeHTML(budget.name)}</div>

      <div class="detail-amount">
        ${money(remaining)}
        <span>ر.س متبقي</span>
      </div>

      <div class="progress" style="height:8px;margin-top:15px">
        <i style="width:${percent}%"></i>
      </div>

      <div class="detail-stats">

        <div class="detail-stat">
          <strong>${money(budget.amount)}</strong>
          <span>الميزانية</span>
        </div>

        <div class="detail-stat">
          <strong>${money(spent)}</strong>
          <span>المصروف</span>
        </div>

        <div class="detail-stat">
          <strong>${Math.round(percent)}%</strong>
          <span>الاستخدام</span>
        </div>

      </div>

      <button type="button"
        class="btn btn-primary"
        style="width:100%;margin-top:14px"
        data-action="add-expense"
        data-id="${budget.id}">
        + أضف مصروف
      </button>

    </div>

    <div class="section-head">
      <strong>المصاريف</strong>

      <button type="button"
        class="link-btn"
        data-action="delete-budget"
        data-id="${budget.id}">
        حذف المحفظة
      </button>
    </div>

    ${
      transactions.length
      ?
      `<div class="list">
        ${transactions.map(t=>`
          <div class="card row-card">

            <div class="row-icon">💸</div>

            <div class="row-main">
              <div class="row-name">
                ${escapeHTML(t.name)}
              </div>

              <div class="row-sub">
                ${new Date(t.date).toLocaleDateString("ar-SA")}
              </div>
            </div>

            <div class="row-end">
              <div class="row-amount">
                -${money(t.amount)}
              </div>

              <button type="button"
                class="small-btn danger"
                data-action="delete-transaction"
                data-id="${t.id}">
                حذف
              </button>
            </div>

          </div>
        `).join("")}
      </div>`
      :
      `
      <div class="empty card">
        <div class="empty-icon">✨</div>
        <strong>لسه ما صرفت من المحفظة</strong>
        أول مصروف تضيفه بيظهر هنا.
      </div>
      `
    }
  `;
}

function quickExpense(){
  if(!state.budgets.length){toast("أضف محفظة أولًا عشان نعرف وين نحط المصروف","bad");showPage("budgets");return;}
  addExpense(state.budgets[0].id,true);
}
function purchaseCheck(){
  openModal(`<div class="modal-head"><div class="modal-title">أقدر أشتري؟ 🛍️</div><button type="button" class="close-btn" data-action="close-modal">×</button></div>
  <div class="form-group"><label class="label">وش ناوي تشتري؟</label><input id="purchaseName" class="input" placeholder="مثال: سماعة"></div>
  <div class="form-group"><label class="label">السعر</label><input id="purchaseAmount" class="input" type="number" inputmode="decimal" placeholder="700"></div>
  <div id="purchaseResult" style="margin:10px 0"></div>
  <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button><button type="button" class="btn btn-primary" data-action="check-purchase">احسب</button></div>`);
}
function checkPurchase(){
  const name=document.getElementById("purchaseName")?.value.trim()||"الشراء"; const amount=Number(document.getElementById("purchaseAmount")?.value||0); const out=document.getElementById("purchaseResult"); if(!out||amount<=0){toast("اكتب السعر","bad");return;}
  const safe=safeAvailable(); const after=safe-amount; let html;
  if(after>=dailySafeSpend()*3){html=`<div class="plan-analysis good">🟢 <strong>تقدر تشتري ${escapeHTML(name)}.</strong><br>بعد الشراء يبقى لك ${money(after)} ر.س من المتاح الآمن.</div>`}
  else if(after>=0){html=`<div class="plan-analysis warn">🟡 <strong>ممكن، لكن انتبه.</strong><br>بعد الشراء يبقى لك ${money(after)} ر.س، وهذا يقلل مساحة الصرف قبل الراتب.</div>`}
  else{html=`<div class="plan-analysis bad">🔴 <strong>ما أنصحك الآن.</strong><br>السعر أعلى من المتاح الآمن بمقدار ${money(Math.abs(after))} ر.س.</div>`}
  out.innerHTML=html;
}

function addExpense(budgetId,quick=false){

  const budget =
    state.budgets.find(x=>x.id===budgetId);

  if(!budget) return;

  openModal(`
    <div class="modal-head">

      <div class="modal-title">
        مصروف من ${escapeHTML(budget.name)}
      </div>

      <button type="button" class="close-btn" data-action="close-modal">
        ×
      </button>

    </div>

    <div class="form-group">
      <label class="label">المحفظة</label>
      <select id="expenseBudget" class="input">${state.budgets.map(b=>`<option value="${b.id}" ${b.id===budgetId?"selected":""}>${escapeHTML(b.icon)} ${escapeHTML(b.name)}</option>`).join("")}</select>
    </div>

    <div class="form-group">
      <label class="label">وش صرفت؟</label>

      <input id="expenseName"
        class="input"
        placeholder="مثال: قهوة">
    </div>

    <div class="form-group">
      <label class="label">المبلغ</label>

      <input id="expenseAmount"
        class="input"
        type="number"
        inputmode="decimal"
        placeholder="مثال: 25">
    </div>

    <div class="modal-actions">

      <button type="button" class="btn btn-secondary" data-action="close-modal">
        إلغاء
      </button>

      <button type="button"
        class="btn btn-primary"
        data-action="save-expense"
        data-id="${budget.id}">
        إضافة
      </button>

    </div>
  `);
}

function saveExpense(budgetId){

  budgetId=document.getElementById("expenseBudget")?.value || budgetId;
  const name =
    document.getElementById("expenseName")?.value.trim();

  const amount =
    Number(document.getElementById("expenseAmount")?.value || 0);

  if(!name){
    toast("اكتب وش صرفت","bad");
    return;
  }

  if(amount<=0){
    toast("اكتب مبلغ صحيح","bad");
    return;
  }

  state.transactions.push({
    id:id(),
    type:"expense",
    amount,
    name,
    budgetId,
    date:Date.now()
  });

  saveState();
  closeModal();
  renderCurrentPage();

  toast("تم تسجيل المصروف","good");
}

function deleteTransaction(transactionId){

  openConfirm(
    "حذف العملية؟",
    "سيتم حذف هذه العملية من سجلك.",
    ()=>{
      state.transactions =
        state.transactions.filter(
          x=>x.id!==transactionId
        );

      saveState();
      renderCurrentPage();

      toast("تم حذف العملية");
    }
  );
}


/* =========================================================
   SAVINGS PLANS
========================================================= */

function openSavingForm(idValue=null){

  editingType = "saving";
  editingId = idValue;

  const item =
    state.savingsPlans.find(x=>x.id===idValue);

  selectedIcon = item?.icon || "🎯";

  openModal(`
    <div class="modal-head">

      <div class="modal-title">
        ${item ? "تعديل هدف الادخار" : "هدف ادخار جديد"}
      </div>

      <button type="button" class="close-btn" data-action="close-modal">
        ×
      </button>

    </div>

    <div class="form-group">
      <label class="label">وش هدفك؟</label>

      <input id="savingName"
        class="input"
        value="${escapeHTML(item?.name || "")}"
        placeholder="مثال: سفرة">
    </div>

    <div class="form-group">
      <label class="label">المبلغ المطلوب</label>

      <input id="savingTarget"
        class="input"
        type="number"
        inputmode="decimal"
        value="${item?.target || ""}"
        placeholder="مثال: 6000">
    </div>

    ${item ? `<div class="card" style="padding:12px;margin-bottom:16px;background:rgba(53,211,153,.06)"><div style="color:var(--muted);font-size:11px">المدخر حاليًا</div><div style="font-size:22px;font-weight:950;margin-top:4px">${money(item.saved)} ر.س</div><div style="color:var(--muted);font-size:10px;margin-top:4px">غيّر المبلغ من أزرار الادخار والسحب حتى تبقى الحركة مسجلة.</div></div>` : `<div class="form-group"><label class="label">مبلغ بداية للهدف <span style="color:var(--muted)">(اختياري)</span></label><input id="savingInitial" class="input" type="number" inputmode="decimal" min="0" value="0" placeholder="0"><div class="helper">سيُحجز هذا المبلغ من المتاح عند إنشاء الهدف.</div></div>`}

    <div class="form-group">
      <label class="label">متى تحتاج المبلغ؟</label>

      <input id="savingDeadline"
        class="input"
        type="date"
        value="${item?.deadline || ""}">
    </div>

    <div class="form-group">

      <label class="label">الأيقونة</label>

      <div class="icon-grid">

        ${["🎯","✈️","🚗","💻","🏠","🎓","💍","🎮","📱","💰","🛍️","🏖️"].map(icon=>`
          <button type="button"
            class="icon-choice ${icon===selectedIcon ? "selected":""}"
            data-icon="${icon}">
            ${icon}
          </button>
        `).join("")}

      </div>

    </div>

    <div class="modal-actions">

      <button type="button" class="btn btn-secondary" data-action="close-modal">
        إلغاء
      </button>

      <button type="button" class="btn btn-primary" data-action="save-saving">
        حفظ الخطة
      </button>

    </div>
  `);
}

function saveSaving(){
  const name=document.getElementById("savingName")?.value.trim();
  const target=Number(document.getElementById("savingTarget")?.value||0);
  const deadline=document.getElementById("savingDeadline")?.value;
  const initial=editingId?0:Math.max(0,Number(document.getElementById("savingInitial")?.value||0));
  if(!name){toast("اكتب اسم الهدف","bad");return;}
  if(target<=0){toast("اكتب مبلغ الهدف","bad");return;}
  if(!deadline){toast("حدد موعد الهدف","bad");return;}
  const d=new Date(`${deadline}T23:59:59`);
  if(Number.isNaN(d.getTime())||d<=new Date()){toast("اختار موعدًا قادمًا","bad");return;}
  if(initial>safeAvailable()){toast(`المتاح الآمن ${money(safeAvailable())} ر.س فقط`,"bad");return;}
  if(editingId){
    const item=state.savingsPlans.find(x=>x.id===editingId);
    if(!item)return;
    if(target<Number(item.saved||0)){toast("الهدف لا يمكن أن يكون أقل من المدخر الحالي","bad");return;}
    item.name=name; item.target=target; item.deadline=deadline; item.icon=selectedIcon;
  }else{
    const planId=id();
    state.savingsPlans.push({id:planId,name,target,saved:initial,deadline,icon:selectedIcon,createdAt:Date.now()});
    if(initial>0) state.transactions.push({id:id(),type:"saving",amount:initial,name:`ادخار - ${name}`,savingsPlanId:planId,date:Date.now()});
  }
  saveState();closeModal();renderCurrentPage();toast(editingId?"تم تحديث الهدف 🎯":"تم إنشاء هدف الادخار 🎯","good");
}

function savingsAnalysis(plan){

  const remaining =
    Math.max(
      0,
      Number(plan.target)-Number(plan.saved)
    );

  const months =
    monthsBetween(
      new Date(),
      new Date(plan.deadline)
    );

  const monthlyNeeded =
    remaining/months;

  const available =
    availableToSave();

  const gap =
    monthlyNeeded-available;

  return {
    remaining,
    months,
    monthlyNeeded,
    available,
    gap,
    feasible:gap<=0
  };
}

function openSavingMoneyForm(mode="deposit",preselectedId=null){
  if(!state.savingsPlans.length){toast("أضف هدف ادخار أولًا","bad");return;}
  const title=mode==="deposit"?"إضافة مبلغ للادخار":"سحب مبلغ من الادخار";
  const action=mode==="deposit"?"confirm-saving-deposit":"confirm-saving-withdraw";
  openModal(`<div class="modal-head"><div class="modal-title">${title}</div><button type="button" class="close-btn" data-action="close-modal">×</button></div>
  <div class="form-group"><label class="label">الهدف</label><select id="savingMoneyPlan" class="input">${state.savingsPlans.map(p=>`<option value="${p.id}" ${p.id===preselectedId?"selected":""}>${escapeHTML(p.icon)} ${escapeHTML(p.name)} — ${money(p.saved)} ر.س</option>`).join("")}</select></div>
  <div class="form-group"><label class="label">المبلغ</label><input id="savingMoneyAmount" class="input" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="500"></div>
  <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button><button type="button" class="btn btn-primary" data-action="${action}">تأكيد</button></div>`);
}
function applySavingMoney(mode){
  const plan=state.savingsPlans.find(x=>x.id===document.getElementById("savingMoneyPlan")?.value);
  const amount=Number(document.getElementById("savingMoneyAmount")?.value||0);
  if(!plan){toast("اختر هدفًا صحيحًا","bad");return;} if(amount<=0){toast("اكتب مبلغًا صحيحًا","bad");return;}
  if(mode==="deposit"){
    const remaining=Math.max(0,Number(plan.target)-Number(plan.saved||0)); const safe=safeAvailable();
    if(amount>remaining){toast(`المتبقي للهدف ${money(remaining)} ر.س فقط`,"bad");return;} if(amount>safe){toast(`المتاح الآمن ${money(safe)} ر.س فقط`,"bad");return;}
    plan.saved=Number(plan.saved||0)+amount; state.transactions.push({id:id(),type:"saving",amount,name:`ادخار - ${plan.name}`,savingsPlanId:plan.id,date:Date.now()});
    saveState();closeModal();renderCurrentPage();toast(`تم ادخار ${money(amount)} ر.س — المتاح الآن ${money(cashAvailable())} ر.س 💰`,"good");return;
  }
  if(amount>Number(plan.saved||0)){toast(`رصيد الهدف ${money(plan.saved||0)} ر.س فقط`,"bad");return;}
  plan.saved=Number(plan.saved||0)-amount; state.transactions.push({id:id(),type:"saving_withdrawal",amount,name:`سحب من الادخار - ${plan.name}`,savingsPlanId:plan.id,date:Date.now()});
  saveState();closeModal();renderCurrentPage();toast(`تم إرجاع ${money(amount)} ر.س — المتاح الآن ${money(cashAvailable())} ر.س ↩️`,"good");
}

function deleteSaving(planId){
  const plan=state.savingsPlans.find(x=>x.id===planId);
  if(!plan)return;
  const saved=Number(plan.saved||0);
  const message=saved>0
    ? `سيتم حذف الهدف وإرجاع ${money(saved)} ر.س إلى المتاح. لن تُحذف الفلوس من حساب وِزنة.`
    : "سيتم حذف خطة الادخار هذه.";
  openConfirm("حذف الهدف؟",message,()=>{
    if(saved>0){
      state.transactions.push({id:id(),type:"saving_withdrawal",amount:saved,name:`إرجاع ادخار - ${plan.name}`,savingsPlanId:plan.id,date:Date.now()});
    }
    state.savingsPlans=state.savingsPlans.filter(x=>x.id!==planId);
    saveState();renderCurrentPage();toast(saved>0?"تم حذف الهدف وإرجاع المبلغ للمتاح":"تم حذف الهدف");
  });
}

/* =========================================================
   RENDER HOME
========================================================= */

function salaryRemaining(){
  const cash=cashAvailable();
  const remainingCommitments=Math.max(0,monthlyCommitments()-monthCommitmentPayments());
  const remainingDebt=Math.max(0,monthlyDebtObligation()-monthDebtPayments());
  return Math.max(0,cash-remainingCommitments-remainingDebt);
}

function upcomingReserved(){
  const debtPaid=monthDebtPayments();
  const remainingDebt=Math.max(0,monthlyDebtObligation()-debtPaid);
  const remainingCommitments=Math.max(0,monthlyCommitments()-monthCommitmentPayments());
  const remainingBudgets=state.budgets.reduce((sum,b)=>sum+Math.max(0,Number(b.amount||0)-budgetSpent(b.id)),0);
  return remainingCommitments+remainingDebt+remainingBudgets;
}

function renderMoneyFlow(){
  const salary=Number(state.salary)||0;
  const income=currentIncome();
  const spent=monthExpenses();
  const saved=Math.max(0,monthSavings());
  const remaining=salaryRemaining();
  const reserved=upcomingReserved();
  const safe=safeAvailable();
  const commitmentPaid=monthCommitmentPayments();
  const commitmentRemaining=Math.max(0,monthlyCommitments()-commitmentPaid);
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=money(value);};
  set('flowSalary',salary);
  set('flowRemainingSalary',remaining);
  set('flowSpent',spent);
  set('flowSaved',saved);
  set('flowReserved',reserved);
  set('flowSafe',safe);
  const progress=income?Math.min(100,Math.round(((spent+Math.max(0,monthDebtPayments())+commitmentPaid+saved)/income)*100)):0;
  const bar=document.getElementById('flowProgress');if(bar)bar.style.width=`${progress}%`;

  const homeTotal=document.getElementById('homeCommitmentsTotal');
  const homeRemaining=document.getElementById('homeCommitmentsRemaining');
  const homeBar=document.getElementById('homeCommitmentProgress');
  const homeStatus=document.getElementById('homeCommitmentStatus');
  if(homeTotal)homeTotal.textContent=money(monthlyCommitments());
  if(homeRemaining)homeRemaining.textContent=money(commitmentRemaining);
  if(homeBar)homeBar.style.width=`${monthlyCommitments()?Math.min(100,Math.round((commitmentPaid/monthlyCommitments())*100)):0}%`;
  if(homeStatus)homeStatus.textContent=commitmentRemaining?`باقي ${money(commitmentRemaining)} ر.س للدفع`:'كلها مدفوعة هذا الشهر ✅';
}

function renderHomePulse(){
  const el=document.getElementById("homePulse");
  if(!el) return;
  const safe=safeAvailable();
  const daily=dailySafeSpend();
  const today=new Date();
  const todaySpent=state.transactions.filter(t=>t.type==="expense" && new Date(t.date).toDateString()===today.toDateString()).reduce((a,t)=>a+Number(t.amount||0),0);
  const recent=state.transactions.filter(t=>t.type==="expense").sort((a,b)=>Number(b.date)-Number(a.date))[0];
  let icon="✨", title="وِزنة معك اليوم", message="وضعك تحت السيطرة. خل مشترياتك الكبيرة تمر على وِزنة أول.";
  let cls="good";
  if(!state.salary){ icon="👋"; title="خلنا نبدأ صح"; message="أدخل راتبك أول، وبعدها أعطيك رقم الصرف الآمن يوميًا."; }
  else if(safe<=0){ icon="🛑"; title="خفف الصرف اليوم"; message=`المتاح الآمن وصل للصفر. باقي ${daysUntilSalary()} يوم على الراتب، فخلنا نوقف المشتريات غير الضرورية.`; cls="bad"; }
  else if(todaySpent>daily && daily>0){ icon="⚠️"; title="اليوم صرفت فوق المعدل"; message=`صرفك اليوم ${money(todaySpent)} ر.س، بينما الآمن تقريبًا ${money(daily)} ر.س. تقدر تعوّض بهدوء الأيام الجاية.`; cls="warn"; }
  else if(state.savingsPlans.length){
    const plan=state.savingsPlans[0]; const target=Number(plan.target||0); const saved=Number(plan.saved||0); const pct=target?Math.round(saved/target*100):0;
    icon="🎯"; title=`هدفك ${plan.name}`; message=`وصلت ${pct}% من الهدف. كل ${money(Math.max(0,daily*0.2))} ر.س توفرها يوميًا تقربك منه.`;
  } else if(recent){ icon="💜"; title="نبضة من وِزنة"; message=`آخر مصروف مسجل: ${recent.name||"مصروف"} — ${money(recent.amount)} ر.س. لا تخلي المصاريف الصغيرة تتراكم.`; }
  el.className=`card wiz-pulse ${cls}`;
  el.innerHTML=`<div class="wiz-pulse-top"><div><div class="wiz-pulse-title">${title}</div><div class="wiz-pulse-sub">تحديث حي حسب حركاتك الحالية</div></div><div class="wiz-pulse-badge">${icon}</div></div><div class="wiz-pulse-main"><div class="wiz-pulse-stat"><span>صرفك اليوم</span><strong>${money(todaySpent)} <small style="font-size:9px;color:var(--muted)">ر.س</small></strong></div><div class="wiz-pulse-stat"><span>الآمن لليوم</span><strong>${money(daily)} <small style="font-size:9px;color:var(--muted)">ر.س</small></strong></div></div><div class="wiz-pulse-message">${message}</div>`;
}

function renderHome(){

  const safeEl =
    document.getElementById("safeAmount");

  if(!safeEl) return;

  const safe = safeAvailable();

  safeEl.textContent = money(safe);

  document.getElementById("daysSalary").textContent =
    daysUntilSalary();

  document.getElementById("monthlyDebtHome").textContent =
    money(monthlyDebtObligation());
  const dailyHome=document.getElementById("dailySafeHome"); if(dailyHome) dailyHome.textContent=money(dailySafeSpend());

  document.getElementById("salaryHome").textContent =
    money(state.salary);

  document.getElementById("commitmentsHome").textContent =
    money(monthlyCommitments());

  const insight = getInsight();

  document.getElementById("insightIcon").textContent =
    insight.icon;

  document.getElementById("insightText").textContent =
    insight.text;

  renderMoneyFlow();
  renderHomePulse();

  const score = financialScore();

  document.getElementById("scoreValue").textContent =
    score.score;

  document.getElementById("scoreTitle").textContent =
    score.title;

  document.getElementById("scoreText").textContent =
    score.text;

  document.getElementById("scoreRing")
    .style.setProperty(
      "--score",
      `${score.score}%`
    );

  const greetingHour = new Date().getHours();

  let greeting = "هلا";

  if(greetingHour >= 5 && greetingHour < 12){
    greeting = "صباح الخير";
  }else if(greetingHour >= 12 && greetingHour < 18){
    greeting = "مساء الخير";
  }else{
    greeting = "مساء الخير";
  }

  document.getElementById("greetingSmall").textContent =
    greeting;
  const greetingName=document.getElementById("greetingName");
  if(greetingName){
    const scoreNow=financialScore();
    greetingName.textContent = state.salary
      ? (scoreNow.score>=85 ? "أمورك المالية ماشية 👌" : scoreNow.score>=65 ? "خلنا نضبطها سوا 💜" : "خلنا ننقذ الشهر سوا 🛟")
      : "وضعك المالي 👋";
  }

  renderHomeBudgets();
  renderHomeGoal();
}

function renderHomeBudgets(){

  const el =
    document.getElementById("homeBudgets");

  if(!el) return;

  if(state.budgets.length===0){

    el.innerHTML = `
      <div class="envelope">
        <div class="env-top">
          <div class="env-icon">✨</div>
        </div>

        <div class="env-money" style="font-size:12px">
          أضف محفظتك الأولى
        </div>
      </div>
    `;

    return;
  }

  el.innerHTML =
    state.budgets.slice(0,5).map(b=>{

      const spent = budgetSpent(b.id);

      const percent =
        Math.min(
          100,
          (spent/Number(b.amount))*100
        );

      return `
        <button type="button"
          class="envelope"
          data-action="open-budget"
          data-id="${b.id}"
          style="text-align:right;color:white">

          <div class="env-top">
            <div class="env-icon">${b.icon}</div>
            <div class="env-name">
              ${escapeHTML(b.name)}
            </div>
          </div>

          <div class="env-money">
            ${money(Math.max(0,b.amount-spent))}
            <span style="font-size:9px;color:var(--muted)">
              ر.س
            </span>
          </div>

          <div class="progress">
            <i style="width:${percent}%"></i>
          </div>

        </button>
      `;
    }).join("");
}

function renderHomeGoal(){

  const el =
    document.getElementById("homeGoal");

  if(!el) return;

  const plan =
    state.savingsPlans[0];

  if(!plan){

    el.innerHTML = `
      <button type="button"
        class="card goal-mini"
        style="width:100%;color:white;text-align:right"
        data-action="add-saving">

        <div class="goal-icon">🎯</div>

        <div class="goal-info">
          <div class="goal-name">
            سو هدفك له خطة
          </div>

          <div class="goal-text">
            مثال: سفرة بعد 3 شهور
          </div>
        </div>

        <div>＋</div>

      </button>
    `;

    return;
  }

  const a = savingsAnalysis(plan);

  const percent =
    Math.min(
      100,
      (Number(plan.saved)/Number(plan.target))*100
    );

  el.innerHTML = `
    <button type="button"
      class="card goal-mini"
      style="width:100%;color:white;text-align:right"
      data-action="open-saving"
      data-id="${plan.id}">

      <div class="goal-icon">${plan.icon}</div>

      <div class="goal-info">

        <div class="goal-name">
          ${escapeHTML(plan.name)}
        </div>

        <div class="goal-text">
          ${money(plan.saved)} من ${money(plan.target)}
          · تحتاج ${money(a.monthlyNeeded)} شهريًا
        </div>

        <div class="progress">
          <i style="width:${percent}%"></i>
        </div>

      </div>

      <div class="plan-percent">
        ${Math.round(percent)}%
      </div>

    </button>
  `;
}


/* =========================================================
   RENDER BUDGETS
========================================================= */

function renderCommitments(){
  const list=document.getElementById("commitmentsList");
  const summary=document.getElementById("commitmentsSummary");
  if(!list||!summary) return;

  const total=monthlyCommitments();
  const paid=monthCommitmentPayments();
  const remaining=Math.max(0,total-paid);
  const pct=total?Math.min(100,Math.round((paid/total)*100)):0;

  summary.innerHTML=`
    <div class="card" style="padding:17px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div><div class="row-sub">التزاماتك الشهرية</div><div style="font-size:29px;font-weight:950;margin-top:3px">${money(total)} <span style="font-size:11px;color:var(--muted)">ر.س</span></div></div>
        <div style="text-align:left"><div class="row-sub">باقي للدفع</div><div style="font-size:20px;font-weight:900;margin-top:5px;color:${remaining?'var(--yellow)':'var(--green)'}">${money(remaining)} ر.س</div></div>
      </div>
      <div class="progress" style="margin-top:13px"><div style="width:${pct}%"></div></div>
      <div class="row-sub" style="margin-top:8px">${paid?`دفعت ${money(paid)} ر.س هذا الشهر`:'لم تسجل أي دفعة بعد'} · ${pct}% مكتمل</div>
    </div>`;

  if(!state.commitments.length){
    list.innerHTML=`<div class="empty card"><div class="empty-icon">🧾</div><strong>خلنا نثبت التزاماتك</strong><span>إيجار، جوال، إنترنت، اشتراكات، فواتير… أي مبلغ يتكرر شهريًا.</span><button type="button" class="btn btn-primary" style="margin-top:16px" data-action="add-commitment">+ إضافة التزام</button></div>`;
    return;
  }

  const now=new Date();
  list.innerHTML=state.commitments.map(item=>{
    const remainingFor=remainingCommitmentAmount(item);
    const done=remainingFor<=0;
    const dueDay=Math.min(31,Math.max(1,Number(item.dueDay||1)));
    const thisLast=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    let dueDate=new Date(now.getFullYear(),now.getMonth(),Math.min(dueDay,thisLast));
    if(dueDate < now){
      const nextLast=new Date(now.getFullYear(),now.getMonth()+2,0).getDate();
      dueDate=new Date(now.getFullYear(),now.getMonth()+1,Math.min(dueDay,nextLast));
    }
    const days=Math.max(0,Math.ceil((dueDate-now)/86400000));
    const dueText=done?'تم الدفع هذا الشهر ✅':days===0?'مستحق اليوم 🔔':`يستحق خلال ${days} يوم`;
    return `<div class="card row-card ${done?'commitment-paid':(!done&&days<=3?'commitment-due':'')}">
      <div class="row-icon">${item.icon||'🧾'}</div>
      <div class="row-main">
        <div class="row-name">${escapeHTML(item.name)}</div>
        <div class="row-sub">${money(item.amount)} ر.س شهريًا · يوم ${dueDay} · ${dueText}</div>
      </div>
      <div class="row-actions">
        ${done?`<button type="button" class="small-btn" data-action="unpay-commitment" data-id="${item.id}">تراجع</button>`:`<button type="button" class="small-btn primary" data-action="pay-commitment" data-id="${item.id}">سددت</button>`}
        <button type="button" class="small-btn primary" data-action="edit-commitment" data-id="${item.id}">تعديل</button>
        <button type="button" class="small-btn danger" data-action="delete-commitment" data-id="${item.id}">حذف</button>
      </div>
    </div>`;
  }).join("");
}

function renderBudgets(){

  const el =
    document.getElementById("budgetsList");

  if(!el) return;

  if(state.budgets.length===0){

    el.innerHTML = `
      <div class="empty card">
        <div class="empty-icon">🧺</div>
        <strong>ما عندك محافظ للحين</strong>
        وزّع راتبك على محافظ مثل القهوة، السيارة، الترفيه وغيرها.
        <button type="button"
          class="btn btn-primary"
          style="margin-top:16px"
          data-action="add-budget">
          + أول محفظة
        </button>
      </div>
    `;

    return;
  }

  el.innerHTML =
    state.budgets.map(b=>{

      const spent =
        budgetSpent(b.id);

      const remaining =
        Math.max(
          0,
          Number(b.amount)-spent
        );

      const percent =
        Math.min(
          100,
          (spent/Number(b.amount))*100
        );

      return `
        <div class="card row-card">

          <button type="button"
            class="row-icon"
            data-action="open-budget"
            data-id="${b.id}">
            ${b.icon}
          </button>

          <button type="button"
            class="row-main"
            data-action="open-budget"
            data-id="${b.id}"
            style="background:none;color:white;text-align:right">

            <div class="row-name">
              ${escapeHTML(b.name)}
            </div>

            <div class="row-sub">
              ${money(spent)} مصروف من ${money(b.amount)}
            </div>

            <div class="progress">
              <i style="width:${percent}%"></i>
            </div>

          </button>

          <div class="row-end">

            <div class="row-amount">
              ${money(remaining)}
            </div>

            <div class="row-sub">متبقي</div>

            <div class="row-actions">

              <button type="button"
                class="small-btn"
                data-action="edit-budget"
                data-id="${b.id}">
                تعديل
              </button>

              <button type="button"
                class="small-btn danger"
                data-action="delete-budget"
                data-id="${b.id}">
                حذف
              </button>

            </div>

          </div>

        </div>
      `;
    }).join("");
}


/* =========================================================
   RENDER DEBTS
========================================================= */

function renderDebts(){

  const list =
    document.getElementById("debtsList");

  const summary =
    document.getElementById("debtSummary");

  if(!list || !summary) return;

  const totalRemaining =
    state.debts.reduce(
      (sum,d)=>sum+Number(d.remainingTotal||0),
      0
    );

  const monthly =
    monthlyDebtObligation();

  summary.innerHTML = `
    <div class="card" style="padding:16px">

      <div style="display:flex;justify-content:space-between">

        <div>
          <div style="color:var(--muted);font-size:11px">
            إجمالي المتبقي
          </div>

          <div style="font-size:25px;font-weight:950;margin-top:4px">
            ${money(totalRemaining)}
            <span style="font-size:11px;color:var(--muted)">ر.س</span>
          </div>
        </div>

        <div style="text-align:left">

          <div style="color:var(--muted);font-size:11px">
            شهريًا
          </div>

          <div style="font-size:20px;font-weight:900;margin-top:5px">
            ${money(monthly)}
            <span style="font-size:10px;color:var(--muted)">ر.س</span>
          </div>

        </div>

      </div>

    </div>
  `;

  if(state.debts.length===0){

    list.innerHTML = `
      <div class="empty card">

        <div class="empty-icon">🎉</div>

        <strong>ما عندك أقساط</strong>

        وضع ممتاز. إذا أخذت قسط جديد أضفه هنا
        عشان وِزنة تحسبه لك.

        <button type="button"
          class="btn btn-primary"
          style="margin-top:16px"
          data-action="add-debt">
          + إضافة قسط
        </button>

      </div>
    `;

    return;
  }

  list.innerHTML =
    state.debts.map(d=>{

      const percent =
        d.initialTotal
        ?
        Math.min(
          100,
          ((d.initialTotal-d.remainingTotal)/d.initialTotal)*100
        )
        : 0;

      const complete =
        Number(d.remainingTotal)<=0;

      return `
        <div class="card row-card">

          <div class="row-icon">💳</div>

          <div class="row-main">

            <div class="row-name">
              ${escapeHTML(d.name)}
            </div>

            <div class="row-sub">
              ${complete
                ? "تم السداد 🎉"
                : `${money(d.monthlyPayment)} ر.س شهريًا · يوم ${d.dueDay}`
              }
            </div>

            <div class="progress">
              <i style="width:${percent}%"></i>
            </div>

          </div>

          <div class="row-end">

            <div class="row-amount">
              ${money(d.remainingTotal)}
            </div>

            <div class="row-sub">
              متبقي
            </div>

            <div class="row-actions">

              ${
                !complete
                ?
                `
                <button type="button"
                  class="small-btn primary"
                  data-action="pay-debt"
                  data-id="${d.id}">
                  سددت
                </button>
                `
                :
                ""
              }

              <button type="button"
                class="small-btn"
                data-action="edit-debt"
                data-id="${d.id}">
                تعديل
              </button>

              <button type="button"
                class="small-btn danger"
                data-action="delete-debt"
                data-id="${d.id}">
                حذف
              </button>

            </div>

          </div>

        </div>
      `;
    }).join("");
}


/* =========================================================
   RENDER SAVINGS
========================================================= */

function renderSavings(){

  const list =
    document.getElementById("savingsList");

  const available =
    document.getElementById("availableSaving");

  if(!list || !available) return;

  const availableValue =
    availableToSave();

  available.textContent = money(availableValue);

  const cashNow = document.getElementById("cashAvailableNow");
  if(cashNow) cashNow.textContent = money(cashAvailable());
  const totalSavedEl=document.getElementById("totalSavedNow"); if(totalSavedEl) totalSavedEl.textContent=money(totalSaved());

  document.getElementById("savingHeroDesc").textContent =
    availableValue>0
    ?
    "هذا تقدير محافظ بعد الالتزامات والأقساط والمحافظ واحتياطي أمان."
    :
    "حاليًا الأفضل نرتب المصاريف قبل ما نحط هدف ادخار جديد.";

  if(state.savingsPlans.length===0){

    list.innerHTML = `
      <div class="empty card">

        <div class="empty-icon">🎯</div>

        <strong>خل فلوسك تروح لمكان واضح</strong>

        مثال:
        "أبغى أجمع 6000 لسفرة بعد 3 شهور"

        <br>

        وِزنة تحسب لك كم تحتاج تدخر شهريًا وهل الخطة واقعية.

        <br>

        <button type="button"
          class="btn btn-primary"
          style="margin-top:16px"
          data-action="add-saving">
          + أول خطة
        </button>

      </div>
    `;

    return;
  }

  list.innerHTML =
    state.savingsPlans.map(plan=>{

      const a =
        savingsAnalysis(plan);

      const percent =
        Math.min(
          100,
          (Number(plan.saved)/Number(plan.target))*100
        );

      const analysisClass =
        a.feasible ? "good" : "bad";

      const analysisText =
        a.feasible
        ?
        `🟢 الخطة واقعية. تحتاج تقريبًا ${money(a.monthlyNeeded)} ر.س شهريًا، والمتاح المتوقع للادخار ${money(a.available)} ر.س.`
        :
        `🔴 تحتاج ${money(a.monthlyNeeded)} ر.س شهريًا، بينما المتاح المتوقع ${money(a.available)} ر.س. جرّب تمديد الموعد أو تخفيض الهدف.`;

      return `
        <div class="card plan-card">

          <div class="plan-top">

            <div class="plan-icon">
              ${plan.icon}
            </div>

            <div class="plan-info">

              <strong>
                ${escapeHTML(plan.name)}
              </strong>

              <p>
                الموعد:
                ${new Date(plan.deadline).toLocaleDateString("ar-SA")}
              </p>

            </div>

            <div class="plan-percent">
              ${Math.round(percent)}%
            </div>

          </div>

          <div class="plan-progress">

            <div class="progress" style="height:8px">
              <i style="width:${percent}%"></i>
            </div>

            <div class="plan-numbers">
              <span>
                ${money(plan.saved)} ر.س
              </span>

              <span>
                ${money(plan.target)} ر.س
              </span>
            </div>

          </div>

          <div class="plan-analysis ${analysisClass}">
            ${analysisText}
          </div>

          <div class="row-actions" style="margin-top:12px;flex-wrap:wrap">
            <button type="button" class="small-btn primary" data-action="deposit-saving-plan" data-id="${plan.id}">+ ادخار</button>
            <button type="button" class="small-btn" data-action="withdraw-saving-plan" data-id="${plan.id}">سحب</button>
            <button type="button" class="small-btn" data-action="edit-saving" data-id="${plan.id}">تعديل</button>
            <button type="button" class="small-btn danger" data-action="delete-saving" data-id="${plan.id}">حذف</button>
          </div>

        </div>
      `;
    }).join("");
}


/* =========================================================
   ACTIVITY
========================================================= */

function renderAnalysis(){
  const totalEl=document.getElementById("analysisTotal"); const dailyEl=document.getElementById("analysisDaily"); const list=document.getElementById("analysisList");
  if(!totalEl||!list)return;
  const rows=spendingByBudget(); const total=rows.reduce((s,x)=>s+x.spent,0);
  totalEl.textContent=`${money(total)} ر.س`;
  dailyEl.textContent=`المتاح الآمن اليومي: ${money(dailySafeSpend())} ر.س تقريبًا`;
  list.innerHTML=rows.length?rows.map(x=>{const pct=total?Math.round(x.spent/total*100):0;return `<div class="card plan-card"><div style="display:flex;align-items:center;gap:10px"><div class="row-icon">${x.icon}</div><div class="row-main"><div class="row-name">${escapeHTML(x.name)}</div><div class="row-sub">${money(x.spent)} ر.س · ${pct}% من المصروف</div></div><strong>${pct}%</strong></div><div class="progress"><i style="width:${pct}%"></i></div></div>`}).join(""):`<div class="empty card"><div class="empty-icon">📊</div><strong>لسه ما عندي مصروفات كفاية</strong>سجل مصروفاتك وبيطلع لك التحليل هنا.</div>`;
}

function renderActivity(){

  const el =
    document.getElementById("activityList");

  if(!el) return;

  const transactions =
    [...state.transactions]
      .sort((a,b)=>b.date-a.date);

  if(transactions.length===0){

    el.innerHTML = `
      <div class="empty card">

        <div class="empty-icon">📊</div>

        <strong>ما عندك عمليات للحين</strong>

        أول مصروف أو قسط تسجله بيظهر هنا.

      </div>
    `;

    return;
  }

  el.innerHTML =
    transactions.map(t=>{

      let icon = "💸";
      let prefix = "-";

      if(t.type==="debt"){
        icon = "💳";
      }

      if(t.type==="saving"){
        icon = "🎯";
      }

      if(t.type==="income"){
        icon = "💰";
        prefix = "+";
      }

      return `
        <div class="card row-card">

          <div class="row-icon">
            ${icon}
          </div>

          <div class="row-main">

            <div class="row-name">
              ${escapeHTML(t.name)}
            </div>

            <div class="row-sub">
              ${new Date(t.date).toLocaleDateString("ar-SA")}
            </div>

          </div>

          <div class="row-end">

            <div class="row-amount">
              ${prefix}${money(t.amount)}
            </div>

            <button type="button"
              class="small-btn danger"
              data-action="delete-transaction"
              data-id="${t.id}">
              حذف
            </button>

          </div>

        </div>
      `;
    }).join("");
}


function openIncomeForm(){
  openModal(`<div class="modal-head"><div class="modal-title">تسجيل دخل 💵</div><button type="button" class="close-btn" data-action="close-modal">×</button></div><div class="form-group"><label class="label">نوع الدخل</label><input id="incomeName" class="input" placeholder="مثال: عمولة / مكافأة / تحويل"></div><div class="form-group"><label class="label">المبلغ</label><input id="incomeAmount" class="input" type="number" inputmode="decimal" min="0" placeholder="مثال: 500"></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button><button type="button" class="btn btn-primary" data-action="save-income">إضافة</button></div>`);
}

function saveIncome(){
  const name=document.getElementById("incomeName")?.value.trim()||"دخل إضافي";
  const amount=Number(document.getElementById("incomeAmount")?.value||0);
  if(amount<=0){toast("اكتب مبلغ دخل صحيح","bad");return;}
  state.transactions.push({id:id(),type:"income",amount,name,date:Date.now()});
  saveState();closeModal();renderCurrentPage();toast(`تمت إضافة ${money(amount)} ر.س للدخل 💵`,"good");
}

/* =========================================================
   SETTINGS
========================================================= */

function renderSettings(){

  const salary =
    document.getElementById("settingsSalary");

  const day =
    document.getElementById("settingsSalaryDay");

  if(!salary || !day) return;

  /*
    لا نكتب القيمة كل مرة أثناء الكتابة.
    نعرضها فقط إذا الصفحة ليست في حالة focus.
  */

  if(document.activeElement!==salary){
    salary.value = state.salary || "";
  }

  if(document.activeElement!==day){
    day.value = state.salaryDay || 27;
  }
  const extra=document.getElementById("settingsExtraIncome");
  if(extra && document.activeElement!==extra){ extra.value = state.extraIncome || ""; }
  renderSettingsCommitments();
}

function renderSettingsCommitments(){
  const el=document.getElementById("settingsCommitments");
  if(!el)return;
  if(!state.commitments.length){
    el.innerHTML=`<div class="empty" style="padding:18px 10px"><div class="empty-icon" style="width:48px;height:48px;font-size:22px">🧾</div><strong>ما عندك التزامات مضافة</strong><span>أضف الثابت منها عشان يكون المتاح الآمن أدق.</span></div>`;
    return;
  }
  el.innerHTML=state.commitments.map(item=>`<div class="card row-card"><div class="row-icon">🧾</div><div class="row-main"><div class="row-name">${escapeHTML(item.name)}</div><div class="row-sub">${money(item.amount)} ر.س شهريًا</div></div><div class="row-actions"><button type="button" class="small-btn primary" data-action="edit-commitment" data-id="${item.id}">تعديل</button><button type="button" class="small-btn danger" data-action="delete-commitment" data-id="${item.id}">حذف</button></div></div>`).join("");
}

function saveSettings(){

  const salary =
    Number(document.getElementById("settingsSalary")?.value || 0);

  const day =
    Number(document.getElementById("settingsSalaryDay")?.value || 27);

  if(salary<=0){
    toast("اكتب راتب صحيح","bad");
    return;
  }

  if(day<1 || day>31){
    toast("يوم الراتب غير صحيح","bad");
    return;
  }

  state.salary = salary;
  state.salaryDay = day;
  state.extraIncome = Number(document.getElementById("settingsExtraIncome")?.value||0);

  saveState();
  renderCurrentPage();

  toast("تم تحديث بياناتك","good");
}


/* =========================================================
   ASSISTANT
========================================================= */

function openAssistant(){

  showPage("assistant");

  const chat =
    document.getElementById("chatArea");

  if(!chat.children.length){

    addBotMessage(
      `هلا 👋 أنا وِزنة.<br><br>
       أقدر أساعدك تعرف هل تقدر تشتري شيء،
       أو وين تروح فلوسك، أو أسوي لك خطة ادخار.`
    );

  }

}

function addBotMessage(text){

  const chat =
    document.getElementById("chatArea");

  const div =
    document.createElement("div");

  div.className = "bot-message";
  div.innerHTML = text;

  chat.appendChild(div);

  chat.scrollTop = chat.scrollHeight;
}

function addUserMessage(text){

  const chat =
    document.getElementById("chatArea");

  const div =
    document.createElement("div");

  div.className = "user-message";
  div.textContent = text;

  chat.appendChild(div);

  chat.scrollTop = chat.scrollHeight;
}

function showTyping(){

  const chat =
    document.getElementById("chatArea");

  const div =
    document.createElement("div");

  div.className = "bot-message";
  div.id = "typingMessage";

  div.innerHTML = `
    <div class="typing">
      <i></i><i></i><i></i>
    </div>
  `;

  chat.appendChild(div);

  chat.scrollTop = chat.scrollHeight;
}

function removeTyping(){

  document.getElementById("typingMessage")?.remove();
}

function assistantAnswer(question){

  const q = question.toLowerCase().trim().replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٬,]/g,"").replace("٫",".");

  const safe =
    safeAvailable();

  const saving =
    availableToSave();

  const expenses =
    monthExpenses();

  if(
    q.includes("وين") &&
    (q.includes("فلوس") || q.includes("صرف"))
  ){

    if(state.budgets.length===0){

      return `
        حاليًا ما عندي محافظ كفاية أحلل صرفك.<br><br>
        أضف محافظ مثل القهوة، السيارة، والترفيه
        وسأوضح لك وين يروح راتبك.
      `;

    }

    const sorted =
      state.budgets
        .map(b=>({
          ...b,
          spent:budgetSpent(b.id)
        }))
        .sort((a,b)=>b.spent-a.spent);

    const top = sorted[0];

    return `
      أكثر محفظة صرفت فيها هذا الشهر هي
      <strong>${escapeHTML(top.name)}</strong>
      بمبلغ <strong>${money(top.spent)} ر.س</strong>.<br><br>
      إجمالي المصروف المسجل:
      <strong>${money(expenses)} ر.س</strong>.
    `;
  }


  if(
    q.includes("كيف") &&
    (q.includes("وضع") || q.includes("وضعي"))
  ){

    const score =
      financialScore();

    return `
      تقييم وضعك المالي حاليًا
      <strong>${score.score}/100</strong>.<br><br>
      ${score.text}<br><br>
      المتاح الآمن لك:
      <strong>${money(safe)} ر.س</strong>.
    `;
  }


  if(
    q.includes("وفر") ||
    q.includes("ادخار") ||
    q.includes("أوفر")
  ){

    return `
      المتاح المتوقع للادخار عندك تقريبًا
      <strong>${money(saving)} ر.س شهريًا</strong>.<br><br>
      هذا بعد احتساب الالتزامات والأقساط والمحافظ واحتياطي أمان.
      لو عندك هدف معين، أضفه في "الادخار" وبحسب لك الخطة.
    `;
  }


  if(
    q.includes("أقدر") ||
    q.includes("اشتري") ||
    q.includes("شراء")
  ){

    return `
      أكيد أقدر أحسبها لك 👌<br><br>
      أرسل لي السعر مثل:
      <strong>أقدر أشتري سماعة بـ700؟</strong><br><br>
      وبقول لك إذا 🟢 تقدر،
      🟡 ممكن لكن انتبه،
      أو 🔴 ما أنصحك الآن.
    `;
  }


  const priceMatch =
    q.match(/(\d+(?:\.\d+)?)\s*(?:ر|ريال|ر\.س)?/);

  if(priceMatch){

    const price =
      Number(priceMatch[1]);

    const after =
      safe-price;

    if(after>=0){

      return `
        🟢 <strong>تقدر، من ناحية وِزنة.</strong><br><br>
        سعر الشيء:
        <strong>${money(price)} ر.س</strong><br>
        المتاح الآمن قبل الشراء:
        <strong>${money(safe)} ر.س</strong><br>
        المتبقي الآمن بعده:
        <strong>${money(after)} ر.س</strong>.
      `;

    }

    return `
      🔴 <strong>ما أنصحك الآن.</strong><br><br>
      سعر الشيء:
      <strong>${money(price)} ر.س</strong><br>
      المتاح الآمن:
      <strong>${money(safe)} ر.س</strong><br><br>
      الشراء بيخليك تتجاوز المبلغ اللي وِزنة تعتبره آمن.
    `;
  }


  return `
    أقدر أساعدك في أربع أشياء بسرعة:<br><br>
    💳 هل تقدر تشتري شيء معين؟<br>
    💰 تقييم وضعك المالي<br>
    📉 تحليل وين تروح فلوسك<br>
    🎯 خطة ادخار لهدف معين<br><br>
    جرب تكتب:
    <strong>أقدر أشتري سماعة بـ700؟</strong>
  `;
}

function sendChat(textOverride=null){

  const input =
    document.getElementById("chatInput");

  const text =
    textOverride ?? input.value.trim();

  if(!text) return;

  if(!textOverride){
    input.value="";
  }

  addUserMessage(text);
  showTyping();

  setTimeout(()=>{

    removeTyping();

    addBotMessage(
      assistantAnswer(text)
    );

  },500);
}


/* =========================================================
   CONFIRM
========================================================= */

function openConfirm(title,text,onConfirm){

  openModal(`
    <div class="modal-head">

      <div class="modal-title">
        ${escapeHTML(title)}
      </div>

      <button type="button"
        class="close-btn"
        data-action="close-modal">
        ×
      </button>

    </div>

    <div style="color:var(--muted);font-size:12px;line-height:1.7">
      ${escapeHTML(text)}
    </div>

    <div class="modal-actions">

      <button type="button"
        class="btn btn-secondary"
        data-action="close-modal">
        إلغاء
      </button>

      <button type="button"
        class="btn btn-danger"
        id="confirmAction">
        تأكيد
      </button>

    </div>
  `);

  document
    .getElementById("confirmAction")
    ?.addEventListener("click",()=>{
      closeModal();
      onConfirm();
    });
}


/* =========================================================
   TOAST
========================================================= */

function toast(message,type=""){

  const el =
    document.getElementById("toast");

  clearTimeout(toastTimer);

  el.textContent = message;
  el.className = `toast show ${type}`;

  toastTimer =
    setTimeout(()=>{
      el.classList.remove("show");
    },2400);
}


/* =========================================================
   RESET
========================================================= */

function backupData(){
  const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`wiznah-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast("تم حفظ النسخة الاحتياطية 💾","good");
}
function restoreData(){
  const input=document.createElement("input"); input.type="file"; input.accept="application/json,.json";
  input.onchange=()=>{const file=input.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{const obj=JSON.parse(reader.result); const incoming=obj.state||obj; if(!incoming||typeof incoming!=="object")throw new Error(); state={...structuredClone(DEFAULT_STATE),...incoming};
      state.salary=Number(state.salary||0);
      state.salaryDay=Math.min(31,Math.max(1,Number(state.salaryDay||27)));
      state.extraIncome=Number(state.extraIncome||0);
      state.commitments=Array.isArray(state.commitments)?state.commitments:[];
      state.debts=Array.isArray(state.debts)?state.debts:[];
      state.budgets=Array.isArray(state.budgets)?state.budgets:[];
      state.transactions=Array.isArray(state.transactions)?state.transactions:[];
      state.savingsPlans=Array.isArray(state.savingsPlans)?state.savingsPlans:[];
      saveState(); showPage(state.currentPage||"home"); toast("تم استرجاع بياناتك ✅","good");}catch(e){toast("ملف النسخة الاحتياطية غير صالح","bad")}}; reader.readAsText(file)}; input.click();
}

function resetData(){

  openConfirm(
    "حذف كل بياناتك؟",
    "هذا يمسح الراتب والمحافظ والأقساط والأهداف والعمليات من هذا الجهاز.",
    ()=>{

      localStorage.removeItem(STORAGE_KEY);

      state =
        structuredClone(DEFAULT_STATE);

      currentBudgetId = null;

      closeModal();

      document
        .querySelectorAll(".screen")
        .forEach(s=>s.classList.remove("active"));

      document
        .getElementById("onboarding")
        .classList.add("active");

      renderOnboarding();

      toast("تم حذف البيانات");
    }
  );
}


/* =========================================================
   ONBOARDING CLICK SAFETY
   Direct listeners ensure the first-run buttons remain clickable
   even if a screen-level layout rule changes.
========================================================= */

document.addEventListener("click",event=>{
  const btn = event.target.closest("[data-onboard]");
  if(!btn) return;
  const action = btn.dataset.onboard;
  if(action === "next") nextOnboarding();
  else if(action === "back") backOnboarding();
  else if(action === "finish") finishOnboarding();
  else if(action === "add-commitment") openCommitmentForm();
  else if(action === "add-debt") openDebtForm();
}, true);

/* =========================================================
   GLOBAL EVENT DELEGATION
========================================================= */

document.addEventListener("click",event=>{

  const target =
    event.target.closest(
      "[data-action],[data-page],[data-onboard],[data-icon],[data-question]"
    );

  if(!target) return;


  /* NAV */

  if(target.dataset.page){

    showPage(target.dataset.page);
    return;
  }


  /* ICON */

  if(target.dataset.icon){

    selectedIcon = target.dataset.icon;

    modalContent
      .querySelectorAll(".icon-choice")
      .forEach(btn=>{
        btn.classList.toggle(
          "selected",
          btn.dataset.icon===selectedIcon
        );
      });

    return;
  }


  /* QUESTIONS */

  if(target.dataset.question){

    openAssistant();
    sendChat(target.dataset.question);
    return;
  }


  /* ONBOARDING IS HANDLED BY THE CAPTURE-PHASE SAFETY LISTENER ABOVE */
  if(target.dataset.onboard){ return; }

  /* ACTIONS */

  const action =
    target.dataset.action;

  if(!action) return;


  if(action==="quick-expense"){ quickExpense(); return; }
  if(action==="purchase-check"){ purchaseCheck(); return; }
  if(action==="check-purchase"){ checkPurchase(); return; }
  if(action==="analysis"){ showPage("analysis"); return; }
  if(action==="backup"){ backupData(); return; }
  if(action==="restore"){ restoreData(); return; }

  if(action==="settings"){
    showPage("settings");
    return;
  }

  if(action==="assistant"){
    openAssistant();
    return;
  }

  if(action==="send-chat"){
    sendChat();
    return;
  }

  if(action==="activity"){
    showPage("activity");
    return;
  }

  if(action==="sms-import"){ showPage("smsImport"); return; }
  if(action==="open-shortcuts"){ openShortcuts(); return; }

  if(action==="quick-income"){
    openIncomeForm();
    return;
  }

  if(action==="budgets"){
    showPage("budgets");
    return;
  }

  if(action==="savings"){
    showPage("savings");
    return;
  }

  if(action==="add-budget"){
    openBudgetForm();
    return;
  }

  if(action==="edit-budget"){
    openBudgetForm(target.dataset.id);
    return;
  }

  if(action==="delete-budget"){
    deleteBudget(target.dataset.id);
    return;
  }

  if(action==="open-budget"){
    openBudgetDetail(target.dataset.id);
    return;
  }

  if(action==="back-budget"){
    currentBudgetId = null;
    showPage("budgets");
    return;
  }

  if(action==="edit-current-budget"){

    if(currentBudgetId){
      openBudgetForm(currentBudgetId);
    }

    return;
  }

  if(action==="add-expense"){
    addExpense(target.dataset.id);
    return;
  }

  if(action==="delete-transaction"){
    deleteTransaction(target.dataset.id);
    return;
  }

  if(action==="add-commitment"){ openCommitmentForm(); return; }

  if(action==="pay-commitment"){ payCommitment(target.dataset.id); return; }
  if(action==="unpay-commitment"){ unpayCommitment(target.dataset.id); return; }

  if(action==="add-debt"){
    openDebtForm();
    return;
  }

  if(action==="edit-commitment"){
    openCommitmentForm(target.dataset.id);
    return;
  }

  if(action==="edit-debt"){
    openDebtForm(target.dataset.id);
    return;
  }

  if(action==="delete-debt"){

    const debt =
      state.debts.find(x=>x.id===target.dataset.id);

    if(!debt) return;

    openConfirm(
      "حذف القسط؟",
      `سيتم حذف "${debt.name}" من قائمة الأقساط.`,
      ()=>{
        state.debts =
          state.debts.filter(
            x=>x.id!==target.dataset.id
          );

        saveState();
        renderCurrentPage();

        toast("تم حذف القسط");
      }
    );

    return;
  }

  if(action==="pay-debt"){
    payDebt(target.dataset.id);
    return;
  }

  if(action==="confirm-pay-debt"){
    confirmPayDebt(target.dataset.id);
    return;
  }

  if(action==="add-saving"){
    openSavingForm();
    return;
  }

  if(action==="add-saving-money"){openSavingMoneyForm("deposit");return;}
  if(action==="withdraw-saving-money"){openSavingMoneyForm("withdraw");return;}
  if(action==="deposit-saving-plan"){openSavingMoneyForm("deposit",target.dataset.id);return;}
  if(action==="withdraw-saving-plan"){openSavingMoneyForm("withdraw",target.dataset.id);return;}
  if(action==="confirm-saving-deposit"){applySavingMoney("deposit");return;}
  if(action==="confirm-saving-withdraw"){applySavingMoney("withdraw");return;}

  if(action==="edit-saving"){
    openSavingForm(target.dataset.id);
    return;
  }

  if(action==="open-saving"){
    openSavingForm(target.dataset.id);
    return;
  }

  if(action==="delete-saving"){
    deleteSaving(target.dataset.id);
    return;
  }

  if(action==="save-settings"){
    saveSettings();
    return;
  }

  if(action==="save-income"){
    saveIncome();
    return;
  }

  if(action==="reset-data"){
    resetData();
    return;
  }

  if(action==="close-modal"){
    closeModal();
    return;
  }

  if(action==="save-commitment"){
    saveCommitment();
    return;
  }

  if(action==="save-debt"){
    saveDebt();
    return;
  }

  if(action==="save-budget"){
    saveBudget();
    return;
  }

  if(action==="save-expense"){
    saveExpense(target.dataset.id);
    return;
  }

  if(action==="save-saving"){
    saveSaving();
    return;
  }

  if(action==="back-more"){
    showPage("more");
    return;
  }

  if(action==="delete-commitment"){

    const item =
      state.commitments.find(
        x=>x.id===target.dataset.id
      );

    if(!item) return;

    state.commitments =
      state.commitments.filter(
        x=>x.id!==target.dataset.id
      );

    saveState();

    if(state.onboardStep===1){
      renderOnboarding();
    }

    renderCurrentPage();

    toast("تم حذف الالتزام");
    return;
  }

});


/* =========================================================
   CHAT EVENTS
========================================================= */

document
  .getElementById("chatInput")
  ?.addEventListener("keydown",event=>{

    if(event.key==="Enter"){
      event.preventDefault();
      sendChat();
    }

  });


/* =========================================================
   START
========================================================= */

function start(){

  if(!state.onboarded){

    document
      .getElementById("onboarding")
      .classList.add("active");

    renderOnboarding();

  }else{

    document
      .getElementById("onboarding")
      .classList.remove("active");

    showPage(state.currentPage || "home");

  }

}

start();

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=36").catch(()=>{}));}

importSMSFromURL();
