/* ==========================================================
   BLOG GAMER - script.js
   Backend: Firebase Authentication + Realtime Database
   ----------------------------------------------------------
   ========================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCczFv_waAwVLRbr__l1XBjMV_Id6wpnV4",
  authDomain: "novo-games-workin.firebaseapp.com",
  databaseURL: "https://novo-games-workin-default-rtdb.firebaseio.com",
  projectId: "novo-games-workin",
  storageBucket: "novo-games-workin.firebasestorage.app",
  messagingSenderId: "470006732824",
  appId: "1:470006732824:web:e1f5b49c356cfb2bc20b6d"
};


const ADMIN_EMAIL = "admin@admin.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

/* ---------- Modo página estática (páginas geradas) ---------- */
const STATIC_PAGE = window.STATIC_PAGE || null;   // definido nas páginas geradas
const BASE = window.BLOG_BASE || "";              // "../" nas páginas geradas

/* ---------- Estado ---------- */
const state = {
  settings: {},
  posts: [],
  menu: [],
  widgets: [],
  pages: [],
  user: null,
  isAdmin: false,
  postsLoaded: false
};

const DEFAULT_SETTINGS = {
  title: "GAMER ZONE",
  description: "Notícias, reviews e tudo sobre games",
  showTitle: true,
  logoSquare: "",
  logoWide: "",
  attribution: "© " + new Date().getFullYear() + " Gamer Zone — Todos os direitos reservados.",
  postsPerPage: 6,
  colors: { bg: "#07090f", surface: "#0e131d", text: "#e6ecf5", primary: "#00e5ff", accent: "#ff3d6e" },
  customCss: ""
};

/* ---------- Utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stripHtml = (html = "") => { const d = document.createElement("div"); d.innerHTML = html; return (d.textContent || "").trim(); };
const fmtDate = ts => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const slugify = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "pagina";

/** Link interno: na página estática aponta para o blog principal */
const link = hash => (STATIC_PAGE ? BASE + "index.html" + hash : hash);
/** URL de menu: relativas recebem o BASE quando estiver em página gerada */
const menuUrl = u => (!u ? "#/" : /^(https?:|mailto:|tel:|\/)/.test(u) ? u : u.startsWith("#") ? link(u) : BASE + u);

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2800);
}

/** Insere HTML executando os <script> (compatível com widgets HTML/JavaScript do Blogger) */
function injectHTML(el, html) {
  el.innerHTML = html || "";
  $$("script", el).forEach(old => {
    const s = document.createElement("script");
    [...old.attributes].forEach(a => s.setAttribute(a.name, a.value));
    s.text = old.textContent;
    old.replaceWith(s);
  });
}

const objToList = obj => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

/* ==========================================================
   CARREGAMENTO DE DADOS
   ========================================================== */
db.ref("settings").on("value", snap => {
  state.settings = { ...DEFAULT_SETTINGS, ...(snap.val() || {}) };
  state.settings.colors = { ...DEFAULT_SETTINGS.colors, ...(state.settings.colors || {}) };
  applySettings();
});

db.ref("menu").on("value", snap => {
  state.menu = objToList(snap.val()).sort((a, b) => (a.order || 0) - (b.order || 0));
  renderMenu();
  if (adminTab === "menu") renderAdmin();
});

db.ref("widgets").on("value", snap => {
  state.widgets = objToList(snap.val()).sort((a, b) => (a.order || 0) - (b.order || 0));
  renderWidgets();
  if (adminTab === "widgets") renderAdmin();
});

db.ref("posts").on("value", snap => {
  state.posts = objToList(snap.val()).sort((a, b) => (b.date || 0) - (a.date || 0));
  state.postsLoaded = true;
  renderSidebar();
  if (!STATIC_PAGE) route();
  if (adminTab === "posts") renderAdmin();
});

db.ref("pages").on("value", snap => {
  state.pages = objToList(snap.val()).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  if (adminTab === "pages") renderAdmin();
});

/* ==========================================================
   VISUAL
   ========================================================== */
function applySettings() {
  const s = state.settings;
  const r = document.documentElement.style;
  r.setProperty("--bg", s.colors.bg);
  r.setProperty("--surface", s.colors.surface);
  r.setProperty("--surface-2", `color-mix(in srgb, ${s.colors.surface} 80%, ${s.colors.text} 6%)`);
  r.setProperty("--text", s.colors.text);
  r.setProperty("--primary", s.colors.primary);
  r.setProperty("--accent", s.colors.accent);
  r.setProperty("--border", `color-mix(in srgb, ${s.colors.surface} 75%, ${s.colors.primary} 18%)`);

  const sq = $("#logo-square"), wd = $("#logo-wide"), tx = $("#brand-text");
  sq.hidden = !s.logoSquare; if (s.logoSquare) { sq.src = s.logoSquare; sq.alt = s.title; }
  wd.hidden = !s.logoWide; if (s.logoWide) { wd.src = s.logoWide; wd.alt = s.title; }
  tx.textContent = s.title;
  tx.hidden = !s.showTitle && (s.logoWide || s.logoSquare);

  $("#attribution").innerHTML = s.attribution || "";
  $("#custom-css").textContent = s.customCss || "";
  $$("[data-home]").forEach(a => (a.href = link("#/")));
  if (STATIC_PAGE) document.title = STATIC_PAGE.title + " | " + s.title;
  else if (!location.hash.startsWith("#/post/")) document.title = s.title;
  const md = $('meta[name="description"]'); if (md) md.content = s.description || "";
}

function renderMenu() {
  const items = [{ label: "Início", url: "#/" }, ...state.menu];
  $("#menu-list").innerHTML = items.map(m =>
    `<li><a href="${esc(menuUrl(m.url))}" ${m.newTab ? 'target="_blank" rel="noopener"' : ""}>${esc(m.label)}</a></li>`
  ).join("");
  highlightMenu();
}

function highlightMenu() {
  const cur = location.href;
  $$("#menu-list a").forEach(a => a.classList.toggle("active", a.href === cur || (a.getAttribute("href") === "#/" && !STATIC_PAGE && (location.hash === "" || location.hash === "#/"))));
}

const AREAS = { header: "#area-header", top: "#area-top", sidebar: "#area-sidebar", footer: "#area-footer" };
function renderWidgets() {
  Object.entries(AREAS).forEach(([area, sel]) => {
    const el = $(sel);
    el.innerHTML = "";
    state.widgets.filter(w => w.area === area && w.enabled !== false).forEach(w => {
      // Classe "widget HTML" segue o padrão do Blogger
      const box = document.createElement("div");
      box.className = "widget HTML " + (w.cssClass || "");
      box.id = "HTML-" + w.id;
      if (w.title) box.innerHTML = `<h3 class="widget-title">${esc(w.title)}</h3>`;
      const content = document.createElement("div");
      content.className = "widget-content";
      box.appendChild(content);
      el.appendChild(box);
      injectHTML(content, w.html);
    });
  });
}

function renderSidebar() {
  // Marcadores
  const labels = {};
  state.posts.forEach(p => (p.labels || []).forEach(l => (labels[l] = (labels[l] || 0) + 1)));
  const lk = Object.keys(labels).sort();
  $("#labels-list").innerHTML = lk.length
    ? lk.map(l => `<a class="tag" href="${link("#/label/" + encodeURIComponent(l))}">${esc(l)} (${labels[l]})</a>`).join("")
    : '<span class="hint">Nenhum marcador.</span>';

  // Arquivo
  const groups = {};
  state.posts.forEach(p => {
    const d = new Date(p.date);
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    groups[k] = (groups[k] || 0) + 1;
  });
  const keys = Object.keys(groups).sort().reverse();
  $("#archive-list").innerHTML = keys.length
    ? keys.map(k => {
        const [y, m] = k.split("-");
        return `<li><a href="${link("#/archive/" + k)}">${MONTHS[+m - 1]} ${y}</a><span>(${groups[k]})</span></li>`;
      }).join("")
    : '<li class="hint">Sem postagens.</li>';
}

/* ==========================================================
   ROTEAMENTO (hash) — botões voltar/avançar funcionam
   nativamente no Android, iOS e desktop.
   ========================================================== */
window.addEventListener("hashchange", () => { route(); window.scrollTo({ top: 0, behavior: "smooth" }); });

function route() {
  $("#main-nav").classList.remove("open");
  highlightMenu();
  if (STATIC_PAGE) return renderStaticPage();
  if (!state.postsLoaded) return;

  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [type, ...rest] = h.split("/");
  const arg = rest.join("/");

  if (type === "post") return renderPost(arg);
  if (type === "label") return renderList(state.posts.filter(p => (p.labels || []).includes(arg)), `Marcador: <b>${esc(arg)}</b>`, 1, "#/label/" + encodeURIComponent(arg));
  if (type === "search") {
    const q = arg.toLowerCase();
    $("#search-input").value = arg;
    return renderList(state.posts.filter(p => (p.title + " " + stripHtml(p.content) + " " + (p.labels || []).join(" ")).toLowerCase().includes(q)), `Resultados para: <b>${esc(arg)}</b>`);
  }
  if (type === "archive") {
    const [y, m] = arg.split("-").map(Number);
    return renderList(state.posts.filter(p => { const d = new Date(p.date); return d.getFullYear() === y && d.getMonth() + 1 === m; }), `Arquivo: <b>${MONTHS[m - 1]} ${y}</b>`);
  }
  if (type === "page") return renderList(state.posts, "", Number(arg) || 1);
  renderList(state.posts, "", 1);
}

function postUrl(p) { return link("#/post/" + p.id); }

function renderList(posts, heading, page = 1, base = "") {
  document.title = state.settings.title || "Blog";
  const per = Number(state.settings.postsPerPage) || 6;
  const total = Math.max(1, Math.ceil(posts.length / per));
  const slice = posts.slice((page - 1) * per, page * per);
  const el = $("#content");

  if (!posts.length) {
    el.innerHTML = (heading ? `<h2 class="page-head">${heading}</h2>` : "") + '<div class="empty fade-in">Nenhuma postagem encontrada.</div>';
    return;
  }

  el.innerHTML = (heading ? `<h2 class="page-head">${heading}</h2>` : "") +
    slice.map(p => `
      <article class="post-card fade-in" data-url="${postUrl(p)}">
        ${p.image ? `<img class="post-thumb" src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">` : ""}
        <div class="post-body">
          <div class="post-meta"><span>📅 ${fmtDate(p.date)}</span></div>
          <h2 class="post-title">${esc(p.title)}</h2>
          <p class="post-excerpt">${esc(stripHtml(p.content).slice(0, 220))}…</p>
          <a class="btn" href="${postUrl(p)}">Ler mais...</a>
        </div>
      </article>`).join("") +
    (total > 1 && !heading ? `
      <div class="pager">
        ${page > 1 ? `<a class="btn ghost" href="#/page/${page - 1}">« Mais recentes</a>` : "<span></span>"}
        ${page < total ? `<a class="btn ghost" href="#/page/${page + 1}">Mais antigas »</a>` : ""}
      </div>` : "");

  $$(".post-card", el).forEach(c => c.addEventListener("click", e => {
    if (e.target.closest("a")) return;
    location.href = c.dataset.url;
  }));
}

let commentsRef = null;
function renderPost(id) {
  const p = state.posts.find(x => x.id === id);
  const el = $("#content");
  if (commentsRef) { commentsRef.off(); commentsRef = null; }
  if (!p) { el.innerHTML = '<div class="empty">Postagem não encontrada. <a href="#/">Voltar ao início</a></div>'; return; }
  document.title = p.title + " | " + (state.settings.title || "");

  el.innerHTML = `
    <article class="article fade-in">
      <a href="javascript:history.length>1?history.back():location.hash='#/'" class="back-link">← VOLTAR</a>
      <div class="post-meta"><span>📅 ${fmtDate(p.date)}</span></div>
      <h1>${esc(p.title)}</h1>
      <div class="tags">${(p.labels || []).map(l => `<a class="tag" href="#/label/${encodeURIComponent(l)}">${esc(l)}</a>`).join("")}</div>
      ${p.image ? `<img class="post-thumb" src="${esc(p.image)}" alt="${esc(p.title)}">` : ""}
      <div class="article-content" id="article-content"></div>
      <section class="comments">
        <h3>Comentários <span id="c-count"></span></h3>
        <div id="comment-form-wrap"></div>
        <div id="comment-list"></div>
      </section>
    </article>`;
  injectHTML($("#article-content"), p.content);
  renderCommentForm(id);

  commentsRef = db.ref("comments/" + id);
  commentsRef.on("value", snap => {
    const list = objToList(snap.val()).sort((a, b) => a.date - b.date);
    $("#c-count").textContent = `(${list.length})`;
    $("#comment-list").innerHTML = list.length ? list.map(c => `
      <div class="comment">
        <img src="${esc(c.photo || "https://www.gravatar.com/avatar/?d=mp")}" alt="" referrerpolicy="no-referrer">
        <div style="flex:1">
          <div><span class="comment-name">${esc(c.name)}</span><span class="comment-date">${fmtDate(c.date)}</span>
          ${state.user && (state.isAdmin || state.user.uid === c.uid) ? `<button class="comment-del" data-cid="${c.id}">excluir</button>` : ""}</div>
          <div class="comment-text">${esc(c.text)}</div>
        </div>
      </div>`).join("") : '<p class="hint">Seja o primeiro a comentar!</p>';
    $$(".comment-del").forEach(b => b.onclick = () => confirm("Excluir comentário?") && db.ref(`comments/${id}/${b.dataset.cid}`).remove());
  });
}

function renderCommentForm(postId) {
  const wrap = $("#comment-form-wrap");
  if (!wrap) return;
  const u = state.user;
  if (!u) {
    wrap.innerHTML = `<button class="btn" id="g-login">Entrar com Google para comentar</button><br><br>`;
    $("#g-login").onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => toast(e.message));
    return;
  }
  wrap.innerHTML = `
    <form class="form comment-form" id="comment-form">
      <div class="user-row">${u.photoURL ? `<img src="${esc(u.photoURL)}" referrerpolicy="no-referrer">` : ""} Comentando como <b>${esc(u.displayName || u.email)}</b>
        <a href="#" id="c-logout">(sair)</a></div>
      <textarea id="comment-text" placeholder="Escreva seu comentário..." maxlength="3000" required></textarea>
      <div><button class="btn" type="submit">Publicar comentário</button></div>
    </form><br>`;
  $("#c-logout").onclick = e => { e.preventDefault(); auth.signOut(); };
  $("#comment-form").onsubmit = e => {
    e.preventDefault();
    const text = $("#comment-text").value.trim();
    if (!text) return;
    db.ref("comments/" + postId).push({
      uid: u.uid, name: u.displayName || u.email, photo: u.photoURL || "", text, date: Date.now()
    }).then(() => { $("#comment-text").value = ""; toast("Comentário publicado!"); }).catch(e => toast(e.message));
  };
}

function renderStaticPage() {
  const el = $("#content");
  el.innerHTML = `<article class="article fade-in"><h1>${esc(STATIC_PAGE.title)}</h1><div class="article-content" id="article-content"></div></article>`;
  injectHTML($("#article-content"), STATIC_PAGE.content);
}

/* ---------- Pesquisa / menu mobile ---------- */
$("#search-form").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#search-input").value.trim();
  if (q) location.href = link("#/search/" + encodeURIComponent(q));
});
$("#menu-toggle").addEventListener("click", () => $("#main-nav").classList.toggle("open"));

/* ==========================================================
   AUTENTICAÇÃO
   ========================================================== */
auth.onAuthStateChanged(user => {
  state.user = user;
  const isPwd = user && user.providerData.some(p => p.providerId === "password");
  state.isAdmin = !!(user && isPwd && user.email && user.email.toLowerCase() === ADMIN_EMAIL);
  // Login por e-mail/senha que não seja o admin é bloqueado
  if (user && isPwd && !state.isAdmin) { auth.signOut(); toast("Acesso negado."); return; }
  if (!STATIC_PAGE && location.hash.startsWith("#/post/")) {
    renderCommentForm(location.hash.split("/")[2]);
    if (commentsRef) commentsRef.once("value").then(() => commentsRef && route());
  }
  if (!state.isAdmin) $("#admin-panel").hidden = true;
});

$("#admin-btn").addEventListener("click", () => {
  if (state.isAdmin) openAdmin();
  else { $("#login-modal").hidden = false; $("#login-email").focus(); }
});

$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#login-email").value.trim().toLowerCase();
  const msg = $("#login-msg");
  msg.textContent = "";
  if (email !== ADMIN_EMAIL) { msg.textContent = "Acesso negado."; return; }
  try {
    await auth.signInWithEmailAndPassword(email, $("#login-pass").value);
    $("#login-modal").hidden = true;
    $("#login-form").reset();
    openAdmin();
  } catch (err) { msg.textContent = "E-mail ou senha inválidos."; }
});

$$("[data-close]").forEach(b => b.addEventListener("click", () => (b.closest(".modal").hidden = true)));
$("#admin-logout").addEventListener("click", () => { auth.signOut(); $("#admin-panel").hidden = true; toast("Sessão encerrada."); });
document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal").forEach(m => (m.hidden = true)); });

/* ==========================================================
   PAINEL ADMIN
   ========================================================== */
let adminTab = null;
let editing = null;

function openAdmin() {
  $("#admin-panel").hidden = false;
  if (!adminTab) adminTab = "posts";
  renderAdmin();
}

$$("#admin-tabs button").forEach(b => b.addEventListener("click", () => {
  $$("#admin-tabs button").forEach(x => x.classList.toggle("active", x === b));
  adminTab = b.dataset.tab; editing = null; renderAdmin();
}));

function renderAdmin() {
  if (!state.isAdmin || $("#admin-panel").hidden) return;
  const body = $("#admin-body");
  if (editing && (adminTab === "posts" || adminTab === "pages")) return; // não sobrescrever editor aberto
  ({ posts: adminPosts, pages: adminPages, menu: adminMenu, widgets: adminWidgets, look: adminLook })[adminTab](body);
}

/* ---------- Editor rico (com modo HTML) ---------- */
function editorHTML(content) {
  return `
    <div class="editor-bar" id="ed-bar">
      <button type="button" data-cmd="bold"><b>B</b></button>
      <button type="button" data-cmd="italic"><i>I</i></button>
      <button type="button" data-cmd="underline"><u>U</u></button>
      <button type="button" data-cmd="formatBlock" data-val="h2">H2</button>
      <button type="button" data-cmd="formatBlock" data-val="h3">H3</button>
      <button type="button" data-cmd="formatBlock" data-val="p">¶</button>
      <button type="button" data-cmd="formatBlock" data-val="blockquote">❝</button>
      <button type="button" data-cmd="insertUnorderedList">• Lista</button>
      <button type="button" data-cmd="createLink">🔗 Link</button>
      <button type="button" data-cmd="insertImage">🖼 Imagem</button>
      <button type="button" data-cmd="video">▶ YouTube</button>
      <button type="button" data-cmd="removeFormat">✕ Limpar</button>
      <button type="button" id="ed-toggle">&lt;/&gt; HTML</button>
    </div>
    <div class="editor" id="ed-visual" contenteditable="true"></div>
    <textarea class="code" id="ed-code" hidden></textarea>`;
}
function setupEditor(content) {
  const vis = $("#ed-visual"), code = $("#ed-code");
  vis.innerHTML = content || "";
  $$("#ed-bar [data-cmd]").forEach(b => b.onclick = () => {
    vis.focus();
    const c = b.dataset.cmd;
    if (c === "createLink") { const u = prompt("URL do link:"); if (u) document.execCommand(c, false, u); }
    else if (c === "insertImage") { const u = prompt("URL da imagem:"); if (u) document.execCommand(c, false, u); }
    else if (c === "video") {
      const u = prompt("Link do YouTube:"); const m = u && u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
      if (m) document.execCommand("insertHTML", false, `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${m[1]}" frameborder="0" allowfullscreen></iframe><p></p>`);
    }
    else document.execCommand(c, false, b.dataset.val ? `<${b.dataset.val}>` : null);
  });
  $("#ed-toggle").onclick = () => {
    if (code.hidden) { code.value = vis.innerHTML; code.hidden = false; vis.hidden = true; }
    else { vis.innerHTML = code.value; code.hidden = true; vis.hidden = false; }
  };
}
const editorValue = () => ($("#ed-code").hidden ? $("#ed-visual").innerHTML : $("#ed-code").value);

/* ---------- Postagens ---------- */
function adminPosts(body) {
  if (editing) return;
  body.innerHTML = `
    <button class="btn" id="new-post">+ Nova postagem</button>
    <ul class="admin-list">${state.posts.map(p => `
      <li><div><b>${esc(p.title)}</b><br><small>${fmtDate(p.date)} · ${(p.labels || []).join(", ")}</small></div>
      <div class="actions"><a class="btn sm ghost" href="#/post/${p.id}" target="_blank">Ver</a>
      <button class="btn sm" data-edit="${p.id}">Editar</button><button class="btn sm danger" data-del="${p.id}">Excluir</button></div></li>`).join("") || '<li class="hint">Nenhuma postagem ainda.</li>'}
    </ul>`;
  $("#new-post").onclick = () => postForm(body, null);
  $$("[data-edit]", body).forEach(b => b.onclick = () => postForm(body, state.posts.find(p => p.id === b.dataset.edit)));
  $$("[data-del]", body).forEach(b => b.onclick = () => {
    if (confirm("Excluir esta postagem e seus comentários?")) {
      db.ref("posts/" + b.dataset.del).remove(); db.ref("comments/" + b.dataset.del).remove(); toast("Postagem excluída.");
    }
  });
}

function postForm(body, post) {
  editing = post ? post.id : "new";
  const d = new Date(post ? post.date : Date.now());
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  body.innerHTML = `
    <form class="form" id="post-form">
      <label>Título</label><input id="p-title" required value="${esc(post?.title || "")}">
      <div class="row">
        <div class="form"><label>Imagem de capa (URL)</label><input id="p-image" value="${esc(post?.image || "")}" placeholder="https://..."></div>
        <div class="form"><label>Data</label><input type="datetime-local" id="p-date" value="${local}"></div>
      </div>
      <label>Marcadores (separados por vírgula)</label><input id="p-labels" value="${esc((post?.labels || []).join(", "))}" placeholder="Reviews, PC, PlayStation">
      <label>Conteúdo</label>${editorHTML()}
      <div style="display:flex;gap:10px"><button class="btn" type="submit">Publicar</button><button class="btn ghost" type="button" id="p-cancel">Cancelar</button></div>
    </form>`;
  setupEditor(post?.content);
  $("#p-cancel").onclick = () => { editing = null; renderAdmin(); };
  $("#post-form").onsubmit = e => {
    e.preventDefault();
    const data = {
      title: $("#p-title").value.trim(),
      image: $("#p-image").value.trim(),
      date: new Date($("#p-date").value).getTime() || Date.now(),
      labels: $("#p-labels").value.split(",").map(s => s.trim()).filter(Boolean),
      content: editorValue()
    };
    const ref = post ? db.ref("posts/" + post.id) : db.ref("posts").push();
    ref.set(data).then(() => { toast("Postagem salva!"); editing = null; renderAdmin(); }).catch(err => toast(err.message));
  };
}

/* ---------- Páginas padrões ---------- */
function adminPages(body) {
  if (editing) return;
  body.innerHTML = `
    <p class="hint">Páginas padrões usam o mesmo layout do blog (cabeçalho, menu, sidebar e rodapé), mas no lugar das postagens exibem o conteúdo que você criar.
    Ao clicar em <b>Gerar página</b> é baixado um .zip com a pasta da página (index.html, style.css e script.js). Envie essa pasta para a raiz do repositório no GitHub Pages
    — ela ficará acessível em <code>seusite.github.io/repositorio/nome-da-pasta/</code>. Adicione o link no Menu usando <code>nome-da-pasta/</code>.</p><br>
    <button class="btn" id="new-page">+ Nova página</button>
    <ul class="admin-list">${state.pages.map(p => `
      <li><div><b>${esc(p.title)}</b><br><small>/${esc(p.slug)}/</small></div>
      <div class="actions"><button class="btn sm ghost" data-gen="${p.id}">Gerar página</button>
      <button class="btn sm" data-edit="${p.id}">Editar</button><button class="btn sm danger" data-del="${p.id}">Excluir</button></div></li>`).join("") || '<li class="hint">Nenhuma página ainda.</li>'}
    </ul>`;
  $("#new-page").onclick = () => pageForm(body, null);
  $$("[data-edit]", body).forEach(b => b.onclick = () => pageForm(body, state.pages.find(p => p.id === b.dataset.edit)));
  $$("[data-gen]", body).forEach(b => b.onclick = () => generatePage(state.pages.find(p => p.id === b.dataset.gen)));
  $$("[data-del]", body).forEach(b => b.onclick = () => confirm("Excluir página?") && db.ref("pages/" + b.dataset.del).remove());
}

function pageForm(body, page) {
  editing = page ? page.id : "new";
  body.innerHTML = `
    <form class="form" id="page-form">
      <div class="row">
        <div class="form"><label>Título da página</label><input id="pg-title" required value="${esc(page?.title || "")}"></div>
        <div class="form"><label>Nome da pasta (URL)</label><input id="pg-slug" value="${esc(page?.slug || "")}" placeholder="contato"></div>
      </div>
      <label>Conteúdo</label>${editorHTML()}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" type="submit">Salvar</button>
        <button class="btn ghost" type="button" id="pg-gen">Salvar e gerar página</button>
        <button class="btn ghost" type="button" id="pg-cancel">Cancelar</button>
      </div>
    </form>`;
  setupEditor(page?.content);
  $("#pg-title").addEventListener("input", () => { if (!page) $("#pg-slug").value = slugify($("#pg-title").value); });
  $("#pg-cancel").onclick = () => { editing = null; renderAdmin(); };
  const save = async () => {
    const data = { title: $("#pg-title").value.trim(), slug: slugify($("#pg-slug").value || $("#pg-title").value), content: editorValue() };
    if (!data.title) { toast("Informe o título."); return null; }
    const ref = page ? db.ref("pages/" + page.id) : db.ref("pages").push();
    await ref.set(data);
    return data;
  };
  $("#page-form").onsubmit = async e => { e.preventDefault(); if (await save()) { toast("Página salva!"); editing = null; renderAdmin(); } };
  $("#pg-gen").onclick = async () => { const d = await save(); if (d) { await generatePage(d); editing = null; renderAdmin(); } };
}

async function generatePage(page) {
  if (!page) return;
  try {
    toast("Gerando página...");
    const [css, js, html] = await Promise.all(["style.css", "script.js", "index.html"].map(f => fetch(BASE + f, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(f); return r.text(); })));
    const inject = `<script>window.BLOG_BASE = "../";\nwindow.STATIC_PAGE = ${JSON.stringify({ title: page.title, content: page.content }).replace(/</g, "\\u003c")};<\/script>\n  <script src="script.js"><\/script>`;
    const pageHtml = html
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
      .replace(/<script src="script\.js"><\/script>/, inject);
    const zip = new JSZip();
    const dir = zip.folder(page.slug);
    dir.file("index.html", pageHtml);
    dir.file("style.css", css);
    dir.file("script.js", js);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = page.slug + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    toast("Download iniciado: " + page.slug + ".zip");
  } catch (err) {
    toast("Não foi possível ler os arquivos do site. Abra o site pelo GitHub Pages (não pelo arquivo local).");
  }
}

/* ---------- Menu ---------- */
function adminMenu(body) {
  body.innerHTML = `
    <form class="form" id="menu-form">
      <div class="row3">
        <input id="m-label" placeholder="Texto (ex: Contato)" required>
        <input id="m-url" placeholder="Link (ex: contato/ ou #/label/Reviews)" required>
        <select id="m-tab"><option value="">Mesma aba</option><option value="1">Nova aba</option></select>
      </div>
      <p class="hint">Dica: para marcadores use <code>#/label/NomeDoMarcador</code>; para páginas padrões use <code>nome-da-pasta/</code>.</p>
      <div><button class="btn" type="submit">+ Adicionar ao menu</button></div>
    </form>
    <ul class="admin-list">${state.menu.map((m, i) => `
      <li><div><b>${esc(m.label)}</b><br><small>${esc(m.url)}</small></div>
      <div class="actions"><button class="btn sm ghost" data-up="${i}">↑</button><button class="btn sm ghost" data-down="${i}">↓</button>
      <button class="btn sm danger" data-del="${m.id}">Excluir</button></div></li>`).join("") || '<li class="hint">Menu vazio (apenas "Início").</li>'}
    </ul>
    <hr style="border-color:var(--border);margin:20px 0">
    <p class="hint">Atalho: adicionar um marcador existente ao menu</p>
    <div class="tags" style="margin-top:10px">${[...new Set(state.posts.flatMap(p => p.labels || []))].map(l => `<button class="tag" data-lbl="${esc(l)}">+ ${esc(l)}</button>`).join("") || '<span class="hint">Sem marcadores.</span>'}</div>`;
  $("#menu-form").onsubmit = e => {
    e.preventDefault();
    db.ref("menu").push({ label: $("#m-label").value.trim(), url: $("#m-url").value.trim(), newTab: !!$("#m-tab").value, order: Date.now() });
  };
  $$("[data-lbl]", body).forEach(b => b.onclick = () => db.ref("menu").push({ label: b.dataset.lbl, url: "#/label/" + b.dataset.lbl, order: Date.now() }));
  $$("[data-del]", body).forEach(b => b.onclick = () => db.ref("menu/" + b.dataset.del).remove());
  const swap = (i, j) => {
    const a = state.menu[i], c = state.menu[j]; if (!a || !c) return;
    db.ref().update({ [`menu/${a.id}/order`]: c.order || j, [`menu/${c.id}/order`]: a.order || i });
  };
  $$("[data-up]", body).forEach(b => b.onclick = () => swap(+b.dataset.up, +b.dataset.up - 1));
  $$("[data-down]", body).forEach(b => b.onclick = () => swap(+b.dataset.down, +b.dataset.down + 1));
}

/* ---------- Widgets ---------- */
const AREA_NAMES = { header: "Cabeçalho (abaixo do menu)", top: "Acima das postagens", sidebar: "Sidebar direita", footer: "Rodapé (acima da atribuição)" };
function adminWidgets(body, w = null) {
  body.innerHTML = `
    <form class="form" id="w-form">
      <p class="hint">Cole qualquer código HTML/JavaScript — inclusive widgets do Blogger (gadget "HTML/JavaScript"), banners, players, contadores, redes sociais etc.</p>
      <div class="row3">
        <input id="w-title" placeholder="Título (opcional)" value="${esc(w?.title || "")}">
        <select id="w-area">${Object.entries(AREA_NAMES).map(([k, v]) => `<option value="${k}" ${w?.area === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <input id="w-class" placeholder="Classe CSS extra (opcional)" value="${esc(w?.cssClass || "")}">
      </div>
      <textarea class="code" id="w-html" placeholder="<div>Seu widget aqui</div>">${esc(w?.html || "")}</textarea>
      <div style="display:flex;gap:10px"><button class="btn" type="submit">${w ? "Salvar widget" : "+ Adicionar widget"}</button>
      ${w ? '<button class="btn ghost" type="button" id="w-cancel">Cancelar</button>' : ""}</div>
    </form>
    ${Object.entries(AREA_NAMES).map(([k, v]) => `
      <h4 style="margin-top:22px;font-family:var(--font-title);font-size:13px;color:var(--primary)">${v}</h4>
      <ul class="admin-list" style="margin-top:8px">${state.widgets.filter(x => x.area === k).map(x => `
        <li><div><b>${esc(x.title || "(sem título)")}</b> ${x.enabled === false ? "<small>— oculto</small>" : ""}</div>
        <div class="actions"><button class="btn sm ghost" data-tog="${x.id}">${x.enabled === false ? "Mostrar" : "Ocultar"}</button>
        <button class="btn sm ghost" data-up="${x.id}">↑</button>
        <button class="btn sm" data-edit="${x.id}">Editar</button><button class="btn sm danger" data-del="${x.id}">Excluir</button></div></li>`).join("") || '<li class="hint">Vazio</li>'}</ul>`).join("")}`;
  $("#w-form").onsubmit = e => {
    e.preventDefault();
    const data = { title: $("#w-title").value.trim(), area: $("#w-area").value, cssClass: $("#w-class").value.trim(), html: $("#w-html").value, enabled: w ? w.enabled !== false : true, order: w?.order || Date.now() };
    (w ? db.ref("widgets/" + w.id) : db.ref("widgets").push()).set(data).then(() => toast("Widget salvo!"));
  };
  if (w) $("#w-cancel").onclick = () => adminWidgets(body);
  $$("[data-edit]", body).forEach(b => b.onclick = () => adminWidgets(body, state.widgets.find(x => x.id === b.dataset.edit)));
  $$("[data-del]", body).forEach(b => b.onclick = () => confirm("Excluir widget?") && db.ref("widgets/" + b.dataset.del).remove());
  $$("[data-tog]", body).forEach(b => b.onclick = () => { const x = state.widgets.find(y => y.id === b.dataset.tog); db.ref(`widgets/${x.id}/enabled`).set(x.enabled === false); });
  $$("[data-up]", body).forEach(b => b.onclick = () => {
    const x = state.widgets.find(y => y.id === b.dataset.up);
    const same = state.widgets.filter(y => y.area === x.area);
    const prev = same[same.indexOf(x) - 1];
    if (prev) db.ref().update({ [`widgets/${x.id}/order`]: prev.order || 0, [`widgets/${prev.id}/order`]: x.order || 1 });
  });
}

/* ---------- Visual ---------- */
function adminLook(body) {
  const s = state.settings, c = s.colors;
  body.innerHTML = `
    <form class="form" id="look-form">
      <div class="row">
        <div class="form"><label>Nome do blog</label><input id="s-title" value="${esc(s.title)}"></div>
        <div class="form"><label>Descrição</label><input id="s-desc" value="${esc(s.description)}"></div>
      </div>
      <div class="row">
        <div class="form"><label>Logo quadrada (URL)</label><input id="s-lsq" value="${esc(s.logoSquare)}" placeholder="https://..."></div>
        <div class="form"><label>Logo retangular / escrita (URL)</label><input id="s-lwd" value="${esc(s.logoWide)}" placeholder="https://..."></div>
      </div>
      <label><input type="checkbox" id="s-show" style="width:auto" ${s.showTitle ? "checked" : ""}> Exibir nome do blog em texto ao lado das logos</label>
      <label>Cores</label>
      <div class="row3">
        <div class="form"><small>Fundo</small><input type="color" id="c-bg" value="${c.bg}"></div>
        <div class="form"><small>Superfície (cards)</small><input type="color" id="c-surface" value="${c.surface}"></div>
        <div class="form"><small>Texto</small><input type="color" id="c-text" value="${c.text}"></div>
        <div class="form"><small>Cor principal (neon)</small><input type="color" id="c-primary" value="${c.primary}"></div>
        <div class="form"><small>Cor de destaque</small><input type="color" id="c-accent" value="${c.accent}"></div>
        <div class="form"><small>Postagens por página</small><input type="number" min="1" max="50" id="s-pp" value="${s.postsPerPage}"></div>
      </div>
      <label>Atribuição do rodapé (aceita HTML)</label><textarea id="s-attr">${esc(s.attribution)}</textarea>
      <label>CSS personalizado</label><textarea class="code" id="s-css" placeholder=".post-title { font-size: 28px; }">${esc(s.customCss)}</textarea>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Salvar visual</button>
      <button class="btn ghost" type="button" id="s-reset">Restaurar cores padrão</button></div>
    </form>`;
  $("#look-form").onsubmit = e => {
    e.preventDefault();
    db.ref("settings").set({
      title: $("#s-title").value.trim(), description: $("#s-desc").value.trim(),
      logoSquare: $("#s-lsq").value.trim(), logoWide: $("#s-lwd").value.trim(), showTitle: $("#s-show").checked,
      postsPerPage: Number($("#s-pp").value) || 6, attribution: $("#s-attr").value, customCss: $("#s-css").value,
      colors: { bg: $("#c-bg").value, surface: $("#c-surface").value, text: $("#c-text").value, primary: $("#c-primary").value, accent: $("#c-accent").value }
    }).then(() => toast("Visual salvo!")).catch(err => toast(err.message));
  };
  $("#s-reset").onclick = () => db.ref("settings/colors").set(DEFAULT_SETTINGS.colors).then(() => adminLook(body));
}

/* ---------- Início ---------- */
renderMenu();
if (STATIC_PAGE) route();
