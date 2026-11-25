"use strict";
const $ = (id) => document.getElementById(id);
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem("wr_" + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem("wr_" + k, JSON.stringify(v)); } catch {} },
};
let profile = store.get("profile", null), expenses = store.get("expenses", []), goals = store.get("goals", []);

/* ---------- Budget engine (rule-based) ---------- */
const WEIGHTS = {
  bachelor: { "Food & Groceries": 20, Transport: 10, "Family Support": 8, "Eating Out & Fun": 12, "Bills & Utilities": 10, "Savings & Investments": 40 },
  married:  { "Food & Groceries": 24, Transport: 9, "Family Support": 9, "Eating Out & Fun": 9, "Bills & Utilities": 11, "Savings & Investments": 38 },
  kids:     { "Food & Groceries": 25, "Kids & Education": 14, Transport: 8, "Family Support": 8, "Eating Out & Fun": 6, "Bills & Utilities": 11, "Savings & Investments": 28 },
};
function buildBudget(p) {
  const w = p.status === "bachelor" ? WEIGHTS.bachelor : p.kids > 0 ? WEIGHTS.kids : WEIGHTS.married;
  const rent = p.rent > 0 ? p.rent : p.salary * (p.status === "bachelor" ? 0.3 : 0.28);
  const left = Math.max(p.salary - rent, 0), sum = Object.values(w).reduce((a, b) => a + b, 0);
  const b = { "Rent & Home": rent };
  for (const [k, v] of Object.entries(w)) b[k] = (left * v) / sum;
  return b;
}
const categories = () => Object.keys(buildBudget(profile || { salary: 1, status: "bachelor", kids: 0, rent: 0 }));

function renderBudget() {
  if (!profile) return;
  const b = buildBudget(profile);
  const saved = b["Savings & Investments"];
  $("budget").innerHTML = `<div class="panel"><p class="total">${profile.name ? profile.name + "'s" : "Your"} plan for ${inr(profile.salary)}/month</p>
    <p class="note">You can save about <b>${inr(saved)}</b> (${Math.round((saved / profile.salary) * 100)}%) each month.</p>` +
    Object.entries(b).map(([k, v]) => `<div class="row"><span>${k}</span><div class="bar"><i style="width:${(v / profile.salary) * 100}%"></i></div><span class="amt">${inr(v)}</span></div>`).join("") + "</div>";
  fillCats();
}

/* ---------- Expenses ---------- */
function fillCats() { $("eCat").innerHTML = categories().filter((c) => !c.startsWith("Savings")).map((c) => `<option>${c}</option>`).join(""); }
function renderExpenses() {
  const el = $("expList");
  if (!expenses.length) { el.innerHTML = '<p class="note">No expenses yet. Add your first one above.</p>'; return; }
  el.innerHTML = '<div class="panel"></div>';
  [...expenses].sort((a, b) => b.date.localeCompare(a.date)).forEach((e) => {
    const d = document.createElement("div"); d.className = "item";
    const t = document.createElement("span"); t.textContent = `${e.date} · ${e.cat}${e.note ? " · " + e.note : ""}`;
    const r = document.createElement("span");
    r.innerHTML = `<b>${inr(e.amt)}</b> `;
    const x = document.createElement("button"); x.className = "del"; x.textContent = "Delete"; x.onclick = () => { expenses = expenses.filter((z) => z.id !== e.id); store.set("expenses", expenses); renderAll(); };
    r.append(x); d.append(t, r); el.firstChild.append(d);
  });
}

/* ---------- Insights ---------- */
function needProfile(el) { if (profile) return false; $(el).innerHTML = '<p class="note">Build your plan first on the My Plan tab.</p>'; return true; }
function renderInsights() {
  if (needProfile("insightOut")) return;
  if (!expenses.length) { $("insightOut").innerHTML = '<p class="note">Log a few expenses to see your pattern.</p>'; return; }
  const b = buildBudget(profile), spent = {};
  let total = 0, weekend = 0;
  expenses.forEach((e) => { spent[e.cat] = (spent[e.cat] || 0) + e.amt; total += e.amt; const d = new Date(e.date).getDay(); if (d === 0 || d === 6) weekend += e.amt; });
  const rate = total / profile.salary, wShare = weekend / total;
  let type = "Saver", tip = "You are spending well within your means. Move the extra into your investments.";
  if (rate > 0.9) { type = "Stretched thin"; tip = "Spending is close to your whole salary. Cut the biggest over-budget category first."; }
  else if (wShare > 0.45 && expenses.length >= 4) { type = "Weekend spender"; tip = "Nearly half your spending lands on weekends. Set a weekend cap each week."; }
  let html = `<div class="panel"><p>Your pattern: <span class="badge">${type}</span></p><p>${tip}</p><p class="note">Logged ${inr(total)} (${Math.round(rate * 100)}% of salary).</p></div><div class="panel" style="margin-top:14px">`;
  Object.entries(spent).forEach(([k, v]) => {
    const lim = b[k] || 0, over = v > lim;
    html += `<div class="row"><span>${k}</span><div class="bar"><i class="${over ? "over" : ""}" style="width:${Math.min((v / (lim || v)) * 100, 100)}%"></i></div><span class="amt ${over ? "bad" : ""}">${inr(v)} / ${inr(lim)}</span></div>`;
  });
  $("insightOut").innerHTML = html + "</div>";
}

/* ---------- Investment plan ---------- */
function renderInvest() {
  if (needProfile("investOut")) return;
  const b = buildBudget(profile), S = b["Savings & Investments"];
  const essentials = b["Rent & Home"] + b["Food & Groceries"] + b["Bills & Utilities"] + b.Transport;
  const emergency = S * 0.25, rest = S - emergency;
  const mix = { low: [25, 45, 30], medium: [50, 30, 20], high: [70, 15, 15] }[profile.risk].slice();
  if (profile.age > 45) { mix[0] -= 10; mix[1] += 10; }
  const lines = [["Emergency fund", emergency, `Target ${inr(essentials * 6)} (6 months of essentials), about ${Math.ceil((essentials * 6) / emergency)} months to build`],
    ["SIP (index / mutual funds)", (rest * mix[0]) / 100, "Long-term growth, market-linked"],
    ["PPF", (rest * mix[1]) / 100, "Government-backed, tax-efficient"],
    ["Gold", (rest * mix[2]) / 100, "Diversifier; consider sovereign or digital gold"]];
  $("investOut").innerHTML = `<div class="panel"><p class="total">${inr(S)} / month to invest</p>` +
    lines.map(([n, v, t]) => `<div class="row"><span>${n}</span><span class="note">${t}</span><span class="amt">${inr(v)}</span></div>`).join("") +
    `<p class="note">Also keep health insurance and term cover (roughly 10 times annual income if others depend on you). Educational guidance, not financial advice.</p></div>`;
}

/* ---------- Goals ---------- */
function renderGoals() {
  const el = $("goalList");
  if (!goals.length) { el.innerHTML = '<p class="note">Add a goal to see the monthly amount you need.</p>'; return; }
  el.innerHTML = '<div class="panel"></div>';
  goals.forEach((g) => {
    const d = document.createElement("div"); d.className = "item";
    const per = g.amt / g.months;
    const share = profile ? ` (${Math.round((per / buildBudget(profile)["Savings & Investments"]) * 100)}% of your monthly savings)` : "";
    const t = document.createElement("span"); t.textContent = `${g.name}: ${inr(g.amt)} in ${g.months} months, save ${inr(per)}/month${share}`;
    const x = document.createElement("button"); x.className = "del"; x.textContent = "Delete"; x.onclick = () => { goals = goals.filter((z) => z.id !== g.id); store.set("goals", goals); renderGoals(); };
    d.append(t, x); el.firstChild.append(d);
  });
}

/* ---------- Can I afford it? ---------- */
function ask(item, price) {
  if (needProfile("askOut")) return;
  const b = buildBudget(profile), month = new Date().toISOString().slice(0, 7);
  const spentFun = expenses.filter((e) => e.date.startsWith(month) && e.cat === "Eating Out & Fun").reduce((a, e) => a + e.amt, 0);
  const free = Math.max(b["Eating Out & Fun"] - spentFun, 0), S = b["Savings & Investments"];
  let verdict;
  if (price <= free) verdict = `<span class="good">Yes.</span> It fits within your remaining fun budget of ${inr(free)} this month.`;
  else if (price <= free + S * 0.25) verdict = `<span class="good">Possible.</span> It uses your fun budget and a little of your savings. Consider waiting a month.`;
  else verdict = `<span class="bad">Not now.</span> It is ${(price / S).toFixed(1)} months of your savings. Save ${inr(price / 3)}/month for 3 months instead.`;
  $("askOut").innerHTML = `<div class="panel"><p><b>${item.replace(/</g, "&lt;")}</b> for ${inr(price)}</p><p>${verdict}</p></div>`;
}

/* ---------- Wiring ---------- */
function renderAll() { renderBudget(); renderExpenses(); renderInsights(); renderInvest(); renderGoals(); }
document.querySelectorAll("[data-view]").forEach((a) => a.addEventListener("click", (ev) => {
  ev.preventDefault();
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === a.dataset.view));
  document.querySelectorAll("nav a").forEach((n) => n.classList.toggle("on", n.dataset.view === a.dataset.view));
  $("menu").classList.remove("open"); renderAll();
}));
$("menuBtn").onclick = () => $("menu").classList.toggle("open");
$("profileForm").onsubmit = (ev) => {
  ev.preventDefault();
  profile = { name: $("name").value.trim(), salary: +$("salary").value, status: $("status").value, kids: +$("kids").value || 0, rent: +$("rent").value || 0, age: +$("age").value || 28, risk: $("risk").value };
  store.set("profile", profile); renderAll();
};
$("expForm").onsubmit = (ev) => {
  ev.preventDefault();
  expenses.push({ id: Date.now(), amt: +$("eAmt").value, cat: $("eCat").value, date: $("eDate").value, note: $("eNote").value.trim() });
  store.set("expenses", expenses); ev.target.reset(); $("eDate").valueAsDate = new Date(); renderAll();
};
$("goalForm").onsubmit = (ev) => {
  ev.preventDefault();
  goals.push({ id: Date.now(), name: $("gName").value.trim(), amt: +$("gAmt").value, months: +$("gMonths").value });
  store.set("goals", goals); ev.target.reset(); renderGoals();
};
$("askForm").onsubmit = (ev) => { ev.preventDefault(); ask($("aItem").value, +$("aPrice").value); };

$("eDate").valueAsDate = new Date();
if (profile) { $("name").value = profile.name; $("salary").value = profile.salary; $("status").value = profile.status; $("kids").value = profile.kids; $("rent").value = profile.rent || ""; $("age").value = profile.age; $("risk").value = profile.risk; }
fillCats(); renderAll();
