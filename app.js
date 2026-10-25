// URL do Web App do Google Apps Script (termina em /exec). Vazio = modo demonstração, sem salvar na planilha.
const API_URL = "https://script.google.com/macros/s/AKfycbwive3yCrs_7aMBIM7kZjfmCi9wFE5ZvEV4fa1ItY8k_8QtWI9zj63nPXMdaNsRXbXzCQ/exec";

const STORE_KEY = "halloween-rsvp";
const DIETAS = ["carnista", "vegetariano", "vegano"];
const BEBIDAS = ["Cerveja", "Vinho", "Destilado", "Drink pronto", "Refri / suco", "Água / gelo", "Outro"];

const $ = (s) => document.querySelector(s);
const form = $("#form");
const coming = $("#coming");
const err = $("#err");

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}
function newId() {
  try { return crypto.randomUUID(); } catch { return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2); }
}

// ---------- formulário ----------
function setPessoas(n) {
  n = Math.max(1, Math.min(6, n));
  form.pessoas.value = n;
  $("#pessoasOut").textContent = n;
}
document.querySelectorAll("[data-step]").forEach((b) =>
  b.addEventListener("click", () => setPessoas(+form.pessoas.value + +b.dataset.step))
);

function syncComing() {
  const p = form.presenca.value;
  coming.classList.toggle("off", p === "nao");
}
form.addEventListener("change", (e) => {
  if (e.target.name === "presenca") syncComing();
  err.textContent = "";
});

function readForm() {
  const f = new FormData(form);
  return {
    nome: (f.get("nome") || "").trim(),
    presenca: f.get("presenca") || "",
    pessoas: +f.get("pessoas") || 1,
    comida: f.get("comida") || "",
    dieta: f.get("dieta") || "",
    prato: (f.get("prato") || "").trim(),
    bebidas: f.getAll("bebidas"),
    bebidaQual: (f.get("bebidaQual") || "").trim(),
    fantasia: (f.get("fantasia") || "").trim(),
  };
}

function fillForm(d) {
  form.nome.value = d.nome || "";
  form.querySelectorAll("input[type=radio], input[type=checkbox]").forEach((i) => {
    i.checked = i.name === "bebidas" ? (d.bebidas || []).includes(i.value) : d[i.name] === i.value;
  });
  setPessoas(d.pessoas || 1);
  form.prato.value = d.prato || "";
  form.bebidaQual.value = d.bebidaQual || "";
  form.fantasia.value = d.fantasia || "";
  syncComing();
}

function validate(d) {
  if (!d.nome) return "Faltou seu nome.";
  if (!d.presenca) return "Diz se você vem.";
  if (d.presenca === "nao") return "";
  if (!d.comida) return "Marca se vai levar salgado, doce ou meio a meio.";
  if (!d.dieta) return "Marca se o prato é carnista, vegetariano ou vegano.";
  if (!d.bebidas.length) return "Marca pelo menos um tipo de bebida.";
  return "";
}

async function send(payload) {
  if (!API_URL) return { ok: true, demo: true };
  const body = JSON.stringify({ action: "rsvp", ...payload });
  try {
    const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    return await r.json();
  } catch {
    // alguns navegadores bloqueiam a leitura da resposta; o envio em si costuma funcionar
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    return { ok: true };
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = readForm();
  const problem = validate(d);
  if (problem) { err.textContent = problem; return; }

  const prev = load();
  const payload = { id: (prev && prev.id) || newId(), ...d };
  if (d.presenca === "nao") Object.assign(payload, { pessoas: 0, comida: "", dieta: "", prato: "", bebidas: [], bebidaQual: "" });

  const btn = $("#submit");
  btn.disabled = true; btn.textContent = "Enviando…";
  try {
    const res = await send(payload);
    if (!res || res.ok === false) throw new Error(res && res.error);
    save(payload);
    showDone(payload);
    if (res.summary) renderBoard(res.summary); else refreshBoard();
  } catch {
    err.textContent = "Não consegui enviar. Confere sua internet e tenta de novo.";
  } finally {
    btn.disabled = false; btn.textContent = "Confirmar";
  }
});

// ---------- confirmação ----------
function showDone(d) {
  const first = d.nome.split(" ")[0];
  const kicker = $("#doneKicker"), title = $("#doneTitle"), text = $("#doneText");
  if (d.presenca === "nao") {
    kicker.textContent = "Resposta enviada";
    title.textContent = `Que pena, ${first}!`;
    text.textContent = "Se mudar de ideia, é só voltar aqui e editar.";
    $("#cal").hidden = true;
  } else {
    kicker.textContent = d.presenca === "talvez" ? "Anotado como talvez" : "Presença confirmada";
    title.textContent = d.presenca === "talvez" ? `Tomara que dê, ${first}!` : `Tá confirmado, ${first}!`;
    const leva = d.comida === "ambos" ? "salgado e doce" : d.comida;
    const prato = `${leva} ${d.dieta}${d.prato ? ` (${d.prato})` : ""}`;
    const beb = d.bebidas.join(", ").toLowerCase() + (d.bebidaQual ? ` (${d.bebidaQual})` : "");
    const gente = d.pessoas > 1 ? `Vocês são ${d.pessoas}. ` : "";
    text.textContent = `${gente}Você leva ${prato} e ${beb}. Sábado, 07.11, a partir das 19h. Venha fantasiado!`;
    $("#cal").hidden = false;
  }
  form.hidden = true;
  $("#done").hidden = false;
}

$("#edit").addEventListener("click", () => {
  const d = load();
  if (d) fillForm(d);
  $("#done").hidden = true;
  form.hidden = false;
  form.nome.focus();
});

// ---------- painel ----------
function emptySummary() {
  const comida = {};
  ["salgado", "doce"].forEach((c) => { comida[c] = {}; DIETAS.forEach((t) => (comida[c][t] = 0)); });
  const bebidas = {}; BEBIDAS.forEach((b) => (bebidas[b] = 0));
  return { pessoas: 0, talvez: 0, respostas: 0, comida, bebidas };
}

function demoSummary() {
  const s = emptySummary();
  const d = load();
  if (d && d.presenca === "talvez") s.talvez += d.pessoas;
  if (d && d.presenca === "sim") {
    s.pessoas += d.pessoas;
    if (d.comida && d.dieta) (d.comida === "ambos" ? ["salgado", "doce"] : [d.comida]).forEach((c) => s.comida[c][d.dieta]++);
    d.bebidas.forEach((b) => (s.bebidas[b] = (s.bebidas[b] || 0) + 1));
  }
  return s;
}

function renderBoard(s) {
  $("#nPessoas").textContent = s.pessoas;
  $("#nTalvez").textContent = s.talvez ? `+ ${s.talvez} talvez` : "";

  const grid = $("#foodGrid");
  grid.innerHTML = "";
  ["salgado", "doce"].forEach((c) => {
    const vals = DIETAS.map((t) => s.comida[c][t] || 0);
    const total = vals.reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...vals);
    const col = document.createElement("div");
    col.className = "col";
    col.innerHTML = `<h4>${c === "salgado" ? "Salgados" : "Doces"}<span>${total}</span></h4>` +
      DIETAS.map((t, i) => `<div class="row"><span>${t}</span><span>${vals[i]}</span><div class="bar"><i style="width:${(vals[i] / max) * 100}%"></i></div></div>`).join("");
    grid.appendChild(col);
  });

  $("#bevList").innerHTML = BEBIDAS.map((b) => `<span>${b}<b>${s.bebidas[b] || 0}</b></span>`).join("");

  const faltaComida = [];
  ["salgado", "doce"].forEach((c) => DIETAS.forEach((t) => { if (!s.comida[c][t]) faltaComida.push(`${c} ${t}`); }));
  const faltaBebida = ["Água / gelo", "Refri / suco"].filter((b) => !s.bebidas[b]);
  const parts = [];
  if (!s.pessoas && !s.talvez) parts.push("Ninguém confirmou ainda. Seja a primeira pessoa!");
  else {
    if (faltaComida.length) parts.push(`Ainda não tem: ${faltaComida.map((x) => `<b>${x}</b>`).join(" ")}`);
    if (faltaBebida.length) parts.push(`Ninguém levando: ${faltaBebida.map((x) => `<b>${x.toLowerCase()}</b>`).join(" ")}`);
    if (!parts.length) parts.push("Mesa completa. Agora é só caprichar na fantasia.");
  }
  $("#missing").innerHTML = parts.join("<br>");
}

async function refreshBoard() {
  if (!API_URL) { renderBoard(demoSummary()); return; }
  try {
    const r = await fetch(API_URL + "?action=summary");
    renderBoard(await r.json());
  } catch {
    renderBoard(emptySummary());
  }
}

// ---------- início ----------
(function init() {
  syncComing();
  const d = load();
  if (d) { fillForm(d); showDone(d); }
  refreshBoard();
})();
