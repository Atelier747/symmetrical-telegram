const SUPABASE_URL = "https://otphhdsguvalcfcczcyo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cGhoZHNndXZhbGNmY2N6Y3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTc0MzgsImV4cCI6MjA5Njk5MzQzOH0.Fi8MjL6XvviyoXsOD96qlFuGz-zp1GvBIbgx4oSZFVs";

let supabaseClient = null;

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      setTimeout(() => resolve(!!window.supabase?.createClient), 300);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    setTimeout(() => resolve(!!window.supabase?.createClient), 8000);
  });
}

async function setupSupabaseClient() {
  if (supabaseClient) return true;
  if (!window.supabase?.createClient) {
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  }
  if (!window.supabase?.createClient) {
    await loadScript("https://unpkg.com/@supabase/supabase-js@2");
  }
  if (!window.supabase?.createClient) {
    state.databaseError = "Database library did not load. Check your internet/CDN access and refresh.";
    return false;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  state.databaseError = "";
  return true;
}

const app = document.querySelector("#app");
const accountButton = document.querySelector("#accountButton");
const cartCount = document.querySelector("#cartCount");
const authModal = document.querySelector("#authModal");
const confirmModal = document.querySelector("#confirmModal");
const searchBar = document.querySelector("#searchBar");
const searchInput = document.querySelector("#searchInput");

const aboutCopy = `Every painting tells a story — and ours begins with passion.
We are a small, close-knit team of artists based in India, united by one shared love: the art of painting by hand. Every piece we create is made entirely from scratch — no prints, no digital shortcuts, just pure craftsmanship and a whole lot of heart.
We started this journey because we believed that handmade art deserves more than just a place on the wall — it deserves to be felt. Each painting that leaves our hands carries with it hours of dedication, the warmth of human touch, and the rich artistic heritage of India.
Our team may be small, but our passion is boundless. We take pride in every single brushstroke, ensuring that what reaches you is not just a painting, but a piece of someone's soul.
Because here, art is never mass-produced. It is always, only, handmade — made with care, created with love.`;

const state = {
  session: null,
  user: null,
  profile: null,
  paintings: [],
  cart: [],
  route: "home",
  routeId: null,
  search: "",
  filters: {
    maxPrice: "",
    minLength: "",
    maxLength: "",
    minBreadth: "",
    maxBreadth: "",
  },
  pendingAdd: null,
  pendingWhatsApp: null,
  adminTab: "items",
  selectedItems: new Set(),
  onlineTimer: null,
  adminRefreshTimer: null,
  adminStatsCache: {
    usersCount: 0,
    paintingsCount: 0,
    onlineUsers: [],
    mostViewed: null,
    users: [],
    paintings: [],
    tick: 0,
  },
  adminStatsRefreshInFlight: false,
  sliderTimer: null,
  filterOpen: false,
  databaseError: "",
  siteSettings: { about_body: aboutCopy },
};

window.__TPF_DEBUG__ = () => ({
  supabaseReady: !!supabaseClient,
  databaseError: state.databaseError,
  userEmail: state.profile?.email || state.user?.email || null,
  role: state.profile?.role || null,
  paintings: state.paintings.map((painting) => ({
    id: painting.id,
    name: painting.name,
    status: painting.status,
    normalizedStatus: getPaintingStatus(painting),
    variants: getVariants(painting).map((variant) => ({
      id: variant.id,
      frame_type: variant.frame_type,
      price: variant.price,
      available: variant.available,
      imageStart: String(variant.image_data || "").slice(0, 32),
      imageLength: String(variant.image_data || "").length,
    })),
  })),
  cartCount: state.cart.length,
});

const fallbackArt = (name = "Handmade painting") => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 980">
    <defs>
      <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#efe4d3"/>
        <stop offset="1" stop-color="#d6bfa4"/>
      </linearGradient>
    </defs>
    <rect width="800" height="980" fill="url(#paper)"/>
    <rect x="95" y="92" width="610" height="790" fill="#f9f3e8" stroke="#191510" stroke-width="18"/>
    <path d="M160 650 C270 500 360 590 450 430 C525 300 610 345 664 210" fill="none" stroke="#191510" stroke-width="17" stroke-linecap="round"/>
    <circle cx="287" cy="364" r="74" fill="#8b5e3c" opacity=".82"/>
    <path d="M155 746 C270 670 384 700 500 620 C590 560 646 582 690 548 L690 820 L155 820 Z" fill="#b78c67" opacity=".62"/>
    <text x="400" y="925" text-anchor="middle" font-family="Georgia,serif" font-size="38" fill="#191510">${escapeHtml(name).slice(0, 32)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const sketchSvg = `<svg class="artist-sketch" viewBox="0 0 720 390" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="128" cy="315" r="34" fill="#d1a48f" opacity=".8"/>
  <circle cx="618" cy="91" r="28" fill="#c6cdb9" opacity=".9"/>
  <path d="M505 232c28-46 54-64 88-96 18-17 34-38 47-58" stroke="#9a6048" stroke-width="14" stroke-linecap="round" opacity=".55"/>
  <path d="M498 54h135v224H498z" stroke="currentColor" stroke-width="8"/>
  <path d="M516 237c27-48 49-57 75-93 16-23 27-49 39-64" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <path d="M451 318h224M565 280v38M505 318l-28 48M635 318l28 48" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  <path d="M226 121c35 0 62 27 62 61s-27 62-62 62-62-28-62-62 27-61 62-61Z" stroke="currentColor" stroke-width="8"/>
  <path d="M172 259c33-21 78-22 112-2 28 17 47 49 55 96" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  <path d="M315 255c48-22 90-46 137-72" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
  <path d="M448 181l42-31 10 21-48 17-4-7Z" fill="#7b493f"/>
  <path d="M198 245c26-12 58-12 84 0 22 10 39 32 48 68H151c8-33 24-55 47-68Z" fill="#b9aa98" opacity=".75"/>
  <path d="M197 167c15-16 42-24 69-4" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <path d="M115 358c64-18 177-19 278 0" stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity=".45"/>
</svg>`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function getPublicPaintings() {
  return state.paintings;
}

function getVariants(painting) {
  return Array.isArray(painting.painting_variants) ? painting.painting_variants : [];
}

function getPaintingStatus(painting) {
  const rawStatus = String(painting?.status || "published").toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (rawStatus === "available") return "published";
  if (rawStatus === "out" || rawStatus === "out_of_stock" || rawStatus === "currently_out_of_stock") return "out_of_stock";
  if (rawStatus === "draft") return "published";
  return rawStatus || "published";
}

function isPaintingAvailable(painting) {
  return getPaintingStatus(painting) !== "out_of_stock";
}

function getAvailableVariants(painting) {
  if (!isPaintingAvailable(painting)) return [];
  return getVariants(painting).filter((variant) => variant.available !== false);
}

function variantName(variant, index = 0) {
  return String(variant?.variant_name || variant?.name || `Variant ${index + 1}`).trim();
}

function getDisplayVariant(painting) {
  const available = getAvailableVariants(painting);
  const variants = available.length ? available : getVariants(painting);
  return variants[0] || null;
}

function getPriceLabel(painting) {
  const variants = getAvailableVariants(painting);
  if (!variants.length) return "Currently out of stock";
  const minPrice = Math.min(...variants.map((variant) => Number(variant.price || 0)));
  return formatPrice(minPrice);
}

function imageSrcForVariant(variant, paintingName = "Handmade painting") {
  const raw = String(variant?.image_data || "").trim();
  if (raw.startsWith("data:image/") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return fallbackArt(paintingName);
}

function getStockClass(painting) {
  return getAvailableVariants(painting).length ? "stock" : "stock out";
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function withTimeout(promise, timeoutMs, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

function fillSlots(items, count) {
  if (!items.length) return Array.from({ length: count }, () => null);
  const output = [];
  for (let index = 0; index < count; index += 1) {
    output.push(items[index % items.length] || null);
  }
  return output;
}

async function recordPaintingEvent(paintingId, eventType) {
  if (!supabaseClient || !paintingId) return;
  try {
    await supabaseClient.rpc("record_painting_event", {
      painting_id_input: paintingId,
      event_type_input: eventType,
    });
  } catch {
    return;
  }
}

function paintingCard(painting, compact = false) {
  if (!painting) {
    return `<article class="soon-card"><span>Adding more paintings soon</span></article>`;
  }
  const variant = getDisplayVariant(painting);
  const image = imageSrcForVariant(variant, painting.name);
  const dims = variant ? `${variant.length_cm} x ${variant.breadth_cm} cm` : "";
  return `<article class="painting-card" data-open-painting="${painting.id}" role="link" tabindex="0">
    <figure><img src="${image}" alt="${escapeHtml(painting.name)}" loading="lazy"></figure>
    <div class="card-info">
      <h3>${escapeHtml(painting.name)}</h3>
      <span class="price">${getPriceLabel(painting)}</span>
      ${dims ? `<span class="card-dimensions">${escapeHtml(dims)}</span>` : ""}
      ${compact ? "" : `<span class="${getStockClass(painting)}">${getAvailableVariants(painting).length ? "Available" : "Currently out of stock"}</span>`}
    </div>
  </article>`;
}

function soonBlock() {
  return `<div class="soon-block">
    <p>Adding more paintings soon</p>
    ${sketchSvg}
  </div>`;
}

async function init() {
  bindGlobalEvents();
  readRoute();
  render();
  const databaseReady = await setupSupabaseClient();
  if (!databaseReady) {
    render();
    return;
  }
  await ensureSession();
  await loadSettings();
  render();
  await loadPaintings();
  await loadCart();
  render();
  await markOnline();
  supabaseClient.auth.onAuthStateChange(async () => {
    await ensureSession();
    await loadCart();
    render();
    await markOnline();
  });
}

async function ensureSession() {
  const { data } = await supabaseClient.auth.getSession();
  state.session = data.session;
  state.user = data.session?.user || null;
  const remember = localStorage.getItem("tpf_remember");
  if (state.user && remember === "false" && !sessionStorage.getItem("tpf_active_session")) {
    await supabaseClient.auth.signOut();
    state.session = null;
    state.user = null;
    state.profile = null;
    return;
  }
  if (state.user) {
    sessionStorage.setItem("tpf_active_session", "true");
    await loadProfile();
  } else {
    state.profile = null;
  }
  applyTheme();
}

async function loadProfile() {
  const { data, error } = await withTimeout(supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle(), 8000, { data: null, error: null });
  if (error) {
    console.warn(error);
    return;
  }
  state.profile = data;
}

async function loadPaintings() {
  const { data: paintings, error: paintingsError } = await withTimeout(supabaseClient
    .from("paintings")
    .select("*")
    .order("created_at", { ascending: false }), 8000, { data: [], error: null });
  const { data: variants, error: variantsError } = await withTimeout(supabaseClient
    .from("painting_variants")
    .select("*")
    .order("created_at", { ascending: true }), 8000, { data: [], error: null });
  if (paintingsError || variantsError) {
    console.warn(paintingsError || variantsError);
    return state.paintings;
  }
  const variantsByPainting = new Map();
  (variants || []).forEach((variant) => {
    const list = variantsByPainting.get(variant.painting_id) || [];
    list.push(variant);
    variantsByPainting.set(variant.painting_id, list);
  });
  state.paintings = (paintings || []).map((painting) => ({
    ...painting,
    status: getPaintingStatus(painting),
    painting_variants: variantsByPainting.get(painting.id) || [],
  }));
  state.adminStatsCache.paintings = state.paintings;
  state.adminStatsCache.paintingsCount = state.paintings.length;
  state.adminStatsCache.mostViewed = [...state.paintings].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0))[0] || null;
  return state.paintings;
}

async function loadSettings() {
  if (!supabaseClient) return;
  const { data, error } = await withTimeout(supabaseClient
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle(), 8000, { data: null, error: null });
  if (error || !data) return;
  state.siteSettings = { ...state.siteSettings, ...data };
}

async function loadCart() {
  state.cart = [];
  cartCount.textContent = "0";
  if (!state.user) return;
  await withTimeout(supabaseClient.from("cart_items").delete().eq("user_id", state.user.id).lt("expires_at", new Date().toISOString()), 5000, null);
  const { data, error } = await withTimeout(supabaseClient
    .from("cart_items")
    .select("*")
    .eq("user_id", state.user.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }), 8000, { data: [], error: null });
  if (!error) {
    const paintingMap = new Map(state.paintings.map((painting) => [painting.id, painting]));
    const variantMap = new Map(state.paintings.flatMap((painting) => getVariants(painting)).map((variant) => [variant.id, variant]));
    state.cart = (data || []).map((item) => ({
      ...item,
      paintings: paintingMap.get(item.painting_id) || {},
      painting_variants: variantMap.get(item.variant_id) || {},
    }));
  }
  cartCount.textContent = String(state.cart.length);
}

async function markOnline() {
  if (!state.user) return;
  const mark = async () => {
    if (!state.user || !supabaseClient) return;
    const result = await supabaseClient.rpc("mark_user_online");
    if (result.error) {
      await supabaseClient
        .from("profiles")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("id", state.user.id);
    }
  };
  await mark();
  if (state.onlineTimer) clearInterval(state.onlineTimer);
  state.onlineTimer = setInterval(mark, 10000);
}

function applyTheme() {
  const allowedThemes = new Set(["light", "studio", "charcoal", "sage", "rosewood", "linen", "clay", "olive", "inkwash", "terracotta", "pearl"]);
  const theme = allowedThemes.has(state.profile?.theme) ? state.profile.theme : "studio";
  document.body.dataset.theme = theme;
}

function bindGlobalEvents() {
  window.addEventListener("hashchange", () => {
    readRoute();
    render();
  });

  document.querySelector("#searchToggle").addEventListener("click", () => {
    searchBar.classList.toggle("hidden");
    if (!searchBar.classList.contains("hidden")) searchInput.focus();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim();
    const exact = getPublicPaintings().find((painting) => painting.name.toLowerCase() === state.search.toLowerCase());
    if (exact && state.search.length > 1) {
      location.hash = `#painting/${exact.id}`;
      return;
    }
    if (state.route !== "paintings") location.hash = "#paintings";
    else renderPaintings();
  });

  accountButton.addEventListener("click", () => {
    if (state.user) location.hash = "#profile";
    else openAuth("login");
  });

  document.querySelector("#closeAuth").addEventListener("click", closeAuth);
  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) closeAuth();
  });

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => openAuth(button.dataset.authTab));
  });

  document.querySelector("#loginForm").addEventListener("submit", handleLogin);
  document.querySelector("#signupForm").addEventListener("submit", handleSignup);

  document.querySelectorAll(".eye-button").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "Hide" : "Show";
    });
  });

  document.querySelector("#signupForm [name='pincode']").addEventListener("input", debounce(async (event) => {
    const form = event.target.form;
    await fillPincodeFields(event.target.value, form.city, form.state, document.querySelector("#signupMessage"));
  }, 500));

  window.addEventListener("beforeunload", () => {
    if (state.user && supabaseClient) {
      supabaseClient
        .from("profiles")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("id", state.user.id);
    }
  });
  window.addEventListener("focus", () => {
    if (state.user) markOnline();
    if (state.route === "admin" && state.adminTab === "stats") void refreshAdminStatsPanel();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.user) markOnline();
    if (!document.hidden && state.route === "admin" && state.adminTab === "stats") void refreshAdminStatsPanel();
  });
}

function bindRenderedEvents() {
  fitPaintingMedia();
  document.querySelectorAll("[data-open-painting]").forEach((card) => {
    const open = () => {
      location.hash = `#painting/${card.dataset.openPainting}`;
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") open();
    });
  });

  document.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.addCart, button.dataset.variantId));
  });

  document.querySelectorAll("[data-buy-now]").forEach((button) => {
    button.addEventListener("click", () => openWhatsAppAfterNotice("query", button.dataset.buyNow));
  });

  document.querySelectorAll("[data-whatsapp-kind]").forEach((button) => {
    button.addEventListener("click", () => openWhatsAppAfterNotice(button.dataset.whatsappKind || "query"));
  });

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.getAttribute("href")?.replace("#", "");
      if (target === state.route) requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    });
  });
}

const themeChoices = [
  ["studio", "Studio shade", "#d9ccba"],
  ["light", "Warm light", "#f7f1e7"],
  ["charcoal", "Charcoal paper", "#d8d0c3"],
  ["sage", "Soft sage", "#c6cdb9"],
  ["rosewood", "Rosewood gallery", "#d2b8ad"],
  ["linen", "Gallery linen", "#eee8dc"],
  ["clay", "Soft clay", "#d8bcae"],
  ["olive", "Olive wash", "#c7c8ad"],
  ["inkwash", "Ink wash", "#c9c7c1"],
  ["terracotta", "Terracotta paper", "#d1a48f"],
  ["pearl", "Pearl paper", "#f2efe8"],
];

function themePickerHtml(selectedTheme = "studio") {
  return `<div class="theme-picker">${themeChoices.map(([value, label, color]) => `<label class="theme-choice">
    <input type="radio" name="theme_choice" value="${value}" ${selectedTheme === value ? "checked" : ""}>
    <span class="theme-swatch" style="--swatch:${color}"></span>
    <span>${label}</span>
  </label>`).join("")}</div>`;
}

async function openWhatsAppAfterNotice(kind = "query", paintingId = null, options = {}) {
  if (!state.user || !state.profile) {
    if (paintingId && options.trackClick !== false) {
      await recordPaintingEvent(paintingId, "whatsapp_click");
    }
    state.pendingWhatsApp = { kind, paintingId };
    openAuth("login");
    showToast("Please log in", "Log in once so your name and email can be added to the WhatsApp message.");
    return;
  }
  const confirmed = await askConfirm("Before you continue", "<p>You will be redirected to send a message and after sending the message please wait for 24-48 hours for the reply by our team.</p>");
  if (!confirmed) return;
  if (paintingId && options.trackClick !== false) {
    await recordPaintingEvent(paintingId, "whatsapp_click");
  }
  const email = state.profile.email || state.user.email || "";
  const name = state.profile.name || state.user.user_metadata?.name || "";
  const messages = {
    connect: "I had a query about your painting",
    custom: "Hi! I was just checking your website and wanted to get a painting customized.",
    query: "Hi! I was just looking at your handmade paintings and had a query about them.",
  };
  const message = encodeURIComponent(`${messages[kind] || messages.query}\nEmail- ${email}\nName- ${name}`);
  window.location.href = `https://wa.me/917007118260?text=${message}`;
}

function fitPaintingMedia() {
  document.querySelectorAll(".painting-card figure img, .feature-frame img, .mini-stack img, .variant-picker img").forEach((image) => {
    const frame = image.closest("figure, .feature-frame, article");
    if (!frame) return;
    const applyRatio = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = Math.max(0.55, Math.min(1.8, image.naturalWidth / image.naturalHeight));
      frame.style.setProperty("--art-ratio", `${ratio}`);
    };
    if (image.complete) applyRatio();
    else image.addEventListener("load", applyRatio, { once: true });
  });
}

function readRoute() {
  const hash = location.hash.replace(/^#/, "") || "home";
  const [route, id] = hash.split("/");
  state.route = route || "home";
  state.routeId = id || null;
  state.filterOpen = false;
}

function setActiveNav() {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === state.route);
  });
  document.querySelector(".admin-link").classList.toggle("hidden", state.profile?.role !== "admin");
  accountButton.textContent = state.user ? "Profile" : "Log in / Sign up";
}

function render() {
  if (state.adminRefreshTimer) {
    clearInterval(state.adminRefreshTimer);
    state.adminRefreshTimer = null;
  }
  setActiveNav();
  const routes = {
    home: renderHome,
    paintings: renderPaintings,
    about: renderAbout,
    connect: renderConnect,
    cart: renderCart,
    profile: renderProfile,
    admin: renderAdmin,
    painting: renderProduct,
  };
  const renderer = routes[state.route] || renderHome;
  renderer();
  if (state.databaseError) {
    app.insertAdjacentHTML("afterbegin", `<div class="notice">${escapeHtml(state.databaseError)}</div>`);
  }
  bindRenderedEvents();
  app.focus({ preventScroll: true });
  requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
}

function renderHome() {
  const paintings = shuffle(getPublicPaintings());
  const sliderSlots = fillSlots(paintings, 8);

  app.innerHTML = `<section class="hero hero-compact">
    <div class="hero-copy">
      <p class="eyebrow">Handmade in India</p>
      <h1>Atelier</h1>
      <p class="brand-subtitle">by Murooj</p>
      <p>Original handmade paintings for homes that deserve warmth, craft, and a human brushstroke. No prints, no shortcuts, only art made by hand.</p>
      <div class="hero-actions">
        <a class="primary-button" href="#paintings">View Paintings</a>
        <a class="ghost-button" href="#about">Our Story</a>
      </div>
    </div>
  </section>
  <section class="section-band">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Fresh from the studio</p>
        <h2>Featured Paintings</h2>
      </div>
      <a class="ghost-button" href="#paintings">See all</a>
    </div>
    <div class="slider-row" id="featuredSlider">
      ${sliderSlots.map((painting) => paintingCard(painting)).join("")}
    </div>
  </section>
  <section class="section-band">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Collected by feel</p>
        <h2>Studio Picks</h2>
      </div>
    </div>
    <div class="painting-grid">
      ${fillSlots(shuffle(paintings), 6).map((painting) => paintingCard(painting)).join("")}
    </div>
  </section>`;

  startSlider();
}

function startSlider() {
  const slider = document.querySelector("#featuredSlider");
  if (!slider) return;
  if (state.sliderTimer) clearInterval(state.sliderTimer);
  let position = 0;
  state.sliderTimer = setInterval(() => {
    if (!document.body.contains(slider)) {
      clearInterval(state.sliderTimer);
      state.sliderTimer = null;
      return;
    }
    position += 240;
    if (position >= slider.scrollWidth - slider.clientWidth) position = 0;
    slider.scrollTo({ left: position, behavior: "smooth" });
  }, 3400);
}

function renderPaintings() {
  if (state.routeId === "custom") {
    renderCustomPaintings();
    return;
  }
  const paintings = filterPaintings(getPublicPaintings());
  app.innerHTML = `<section class="page">
    <div class="paintings-top">
      <div>
        <p class="eyebrow">Browse the collection</p>
        <h1>Paintings</h1>
        <p>Choose the size, frame, and mood that fits your wall.</p>
      </div>
      <div class="painting-tabs">
        <a class="primary-button" href="#paintings">Paintings</a>
        <a class="ghost-button" href="#paintings/custom">Custom paintings</a>
        <button class="ghost-button mobile-filter-button" id="mobileFilterButton" type="button">Filter</button>
      </div>
    </div>
    <div class="paintings-layout">
      <aside class="filter-panel ${state.filterOpen ? "open" : ""}" id="filterPanel">
        <button class="modal-close filter-close" id="filterCloseButton" type="button" aria-label="Close filters">×</button>
        <h2>Filter</h2>
        <div class="field-row"><span>Maximum price</span><input id="filterPrice" type="number" min="0" value="${escapeHtml(state.filters.maxPrice)}" placeholder="Example 5000"></div>
        <div class="field-row"><span>Minimum length cm</span><input id="filterMinLength" type="number" min="0" value="${escapeHtml(state.filters.minLength)}"></div>
        <div class="field-row"><span>Maximum length cm</span><input id="filterMaxLength" type="number" min="0" value="${escapeHtml(state.filters.maxLength)}"></div>
        <div class="field-row"><span>Minimum breadth cm</span><input id="filterMinBreadth" type="number" min="0" value="${escapeHtml(state.filters.minBreadth)}"></div>
        <div class="field-row"><span>Maximum breadth cm</span><input id="filterMaxBreadth" type="number" min="0" value="${escapeHtml(state.filters.maxBreadth)}"></div>
        <button class="primary-button" id="applyFilters" type="button">Done</button>
        <button class="small-button" id="clearFilters" type="button">Clear</button>
      </aside>
      <section>
        <div class="painting-grid">
          ${paintings.length ? paintings.map((painting) => paintingCard(painting)).join("") : ""}
        </div>
        ${paintings.length ? soonBlock() : soonBlock()}
      </section>
    </div>
  </section>`;

  document.querySelector("#applyFilters").addEventListener("click", () => {
    state.filters = {
      maxPrice: document.querySelector("#filterPrice").value,
      minLength: document.querySelector("#filterMinLength").value,
      maxLength: document.querySelector("#filterMaxLength").value,
      minBreadth: document.querySelector("#filterMinBreadth").value,
      maxBreadth: document.querySelector("#filterMaxBreadth").value,
    };
    state.filterOpen = false;
    renderPaintings();
    bindRenderedEvents();
  });
  document.querySelector("#clearFilters").addEventListener("click", () => {
    state.filters = { maxPrice: "", minLength: "", maxLength: "", minBreadth: "", maxBreadth: "" };
    state.search = "";
    searchInput.value = "";
    renderPaintings();
    bindRenderedEvents();
  });
  document.querySelector("#mobileFilterButton").addEventListener("click", () => {
    state.filterOpen = true;
    renderPaintings();
    bindRenderedEvents();
  });
  document.querySelector("#filterCloseButton").addEventListener("click", () => {
    state.filterOpen = false;
    renderPaintings();
    bindRenderedEvents();
  });
}

function filterPaintings(paintings) {
  return paintings.filter((painting) => {
    const text = `${painting.name} ${painting.description}`.toLowerCase();
    if (state.search && !text.includes(state.search.toLowerCase())) return false;
    const variants = getVariants(painting);
    return variants.some((variant) => {
      const price = Number(variant.price || 0);
      const length = Number(variant.length_cm || 0);
      const breadth = Number(variant.breadth_cm || 0);
      if (state.filters.maxPrice && price > Number(state.filters.maxPrice)) return false;
      if (state.filters.minLength && length < Number(state.filters.minLength)) return false;
      if (state.filters.maxLength && length > Number(state.filters.maxLength)) return false;
      if (state.filters.minBreadth && breadth < Number(state.filters.minBreadth)) return false;
      if (state.filters.maxBreadth && breadth > Number(state.filters.maxBreadth)) return false;
      return true;
    });
  });
}

async function renderProduct() {
  const painting = state.paintings.find((item) => item.id === state.routeId);
  if (!painting) {
    app.innerHTML = `<section class="page">${soonBlock()}</section>`;
    return;
  }
  await supabaseClient.rpc("increment_painting_view", { painting_id_input: painting.id });
  painting.view_count = Number(painting.view_count || 0) + 1;
  const variants = getVariants(painting);
  const selected = getAvailableVariants(painting)[0] || variants[0];
  app.innerHTML = productHtml(painting, selected?.id);
  bindRenderedEvents();
  bindProductOptions(painting);
}

function productHtml(painting, selectedVariantId) {
  const variants = getVariants(painting);
  const selected = variants.find((variant) => variant.id === selectedVariantId) || variants[0];
  const frameTypes = [...new Set(variants.map((variant) => variant.frame_type).filter(Boolean))];
  const sizes = [...new Set(variants.map((variant) => `${variant.length_cm} x ${variant.breadth_cm} cm`))];
  const available = selected && getPaintingStatus(painting) !== "out_of_stock" && selected.available !== false;
  return `<section class="page product-page">
    <article class="product-details product-details-single">
      <div>
        <p class="eyebrow">Original handmade painting</p>
        <h1>${escapeHtml(painting.name)}</h1>
      </div>
      <p class="description">${escapeHtml(painting.description)}</p>
      <div class="option-group">
        <strong>Variants</strong>
        <div class="variant-picker" data-product-options>
          ${variants.map((variant, index) => {
            const isSelected = variant.id === selected?.id;
            const isAvailable = getPaintingStatus(painting) !== "out_of_stock" && variant.available !== false;
            return `<button type="button" data-variant-option="${variant.id}" class="${isSelected ? "active" : ""}">
              <img src="${imageSrcForVariant(variant, painting.name)}" alt="">
              <span>${escapeHtml(variantName(variant, index))}</span>
              <small>${escapeHtml(variant.length_cm)} x ${escapeHtml(variant.breadth_cm)} cm</small>
              <small>${escapeHtml(variant.frame_type)}</small>
              <strong>${isAvailable ? formatPrice(variant.price) : "Out of stock"}</strong>
            </button>`;
          }).join("")}
        </div>
      </div>
      <div class="option-group">
        <strong>Size</strong>
        <div class="option-buttons" data-product-options>
          ${sizes.map((size) => `<button type="button" data-size="${escapeHtml(size)}" ${sizes.length === 1 ? "disabled" : ""} class="${size === `${selected?.length_cm} x ${selected?.breadth_cm} cm` ? "active" : ""}">${escapeHtml(size)}</button>`).join("")}
        </div>
      </div>
      <div class="option-group">
        <strong>Frame</strong>
        <div class="option-buttons" data-product-options>
          ${frameTypes.map((frame) => `<button type="button" data-frame="${escapeHtml(frame)}" ${frameTypes.length === 1 ? "disabled" : ""} class="${frame === selected?.frame_type ? "active" : ""}">${escapeHtml(frame)}</button>`).join("")}
        </div>
      </div>
      <ul class="meta-list">
        <li><span>Length</span><strong>${escapeHtml(selected?.length_cm || "-")} cm</strong></li>
        <li><span>Breadth</span><strong>${escapeHtml(selected?.breadth_cm || "-")} cm</strong></li>
        <li><span>Variant</span><strong>${escapeHtml(variantName(selected, variants.indexOf(selected)))}</strong></li>
        <li><span>Frame</span><strong>${escapeHtml(selected?.frame_type || "-")}</strong></li>
        <li><span>Price</span><strong>${available ? formatPrice(selected?.price) : "Currently out of stock"}</strong></li>
      </ul>
      <div class="action-row">
        <button class="primary-button" data-add-cart="${painting.id}" data-variant-id="${selected?.id || ""}" ${available ? "" : "disabled"} type="button">Add to cart</button>
        <button class="ghost-button" data-buy-now="${painting.id}" type="button">Buy now</button>
      </div>
    </article>
  </section>`;
}

function bindProductOptions(painting) {
  const variants = getVariants(painting);
  let selected = variants.find((variant) => variant.id === document.querySelector("[data-add-cart]")?.dataset.variantId)
    || getAvailableVariants(painting)[0]
    || variants[0];
  document.querySelectorAll("[data-variant-option], [data-size], [data-frame]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.variantOption) {
        selected = variants.find((variant) => variant.id === button.dataset.variantOption) || selected;
        app.innerHTML = productHtml(painting, selected.id);
        bindRenderedEvents();
        bindProductOptions(painting);
        return;
      }
      const currentSize = `${selected.length_cm} x ${selected.breadth_cm} cm`;
      const nextSize = button.dataset.size || currentSize;
      const nextFrame = button.dataset.frame || selected.frame_type;
      selected = variants.find((variant) => `${variant.length_cm} x ${variant.breadth_cm} cm` === nextSize && variant.frame_type === nextFrame)
        || variants.find((variant) => `${variant.length_cm} x ${variant.breadth_cm} cm` === nextSize)
        || variants.find((variant) => variant.frame_type === nextFrame)
        || selected;
      app.innerHTML = productHtml(painting, selected.id);
      bindRenderedEvents();
      bindProductOptions(painting);
    });
  });
}

function renderAbout() {
  app.innerHTML = `<section class="about-page">
    <article class="about-story">
      <p class="eyebrow">Our Story</p>
      <h1>Atelier by Murooj</h1>
      ${(state.siteSettings.about_body || aboutCopy).split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      <span class="signature">-Atelier by Murooj</span>
    </article>
  </section>`;
}

function renderConnect() {
  app.innerHTML = `<section class="contact-page">
    <section class="contact-hero">
      <div class="contact-copy">
        <p class="eyebrow">Contact us</p>
        <h1>Have a query?</h1>
        <p class="contact-lead">Feel free to contact us.</p>
        <p class="contact-body">Whether you want help choosing a painting, need frame guidance, or want to start a custom piece, we will take it from there with care.</p>
        <div class="contact-actions">
          <button class="primary-button" data-whatsapp-kind="connect" type="button">Connect with us</button>
          <a class="ghost-button" href="#paintings">Browse paintings</a>
        </div>
      </div>
      <div class="contact-card">
        <div class="contact-card-inner">
          <span>WhatsApp</span>
          <strong>Fast replies for painting questions</strong>
          <p>Your name and email will be added automatically to the message before you send it.</p>
        </div>
        <div class="contact-orbit" aria-hidden="true"></div>
      </div>
    </section>
    <section class="contact-badges">
      <article>
        <strong>Handmade only</strong>
        <p>Every painting is created by hand, never printed.</p>
      </article>
      <article>
        <strong>India based</strong>
        <p>We work from India and ship with care.</p>
      </article>
      <article>
        <strong>Clear answers</strong>
        <p>Ask about size, frame, stock, or custom work.</p>
      </article>
    </section>
  </section>`;
}

function renderCustomPaintings() {
  app.innerHTML = `<section class="custom-page">
    <div class="paintings-top">
      <div>
        <p class="eyebrow">Custom work</p>
        <h1>Custom Paintings</h1>
        <p>Made just for you, shaped by your story, and painted by hand.</p>
      </div>
      <div class="painting-tabs">
        <a class="ghost-button" href="#paintings">Paintings</a>
        <a class="primary-button" href="#paintings/custom">Custom paintings</a>
      </div>
    </div>
    <section class="custom-hero">
      <div class="custom-copy">
        <p class="eyebrow">Made just for you</p>
        <h2>We create</h2>
        <p>Handmade with love, created just for you. We turn your moments into timeless art.</p>
        <button class="primary-button" data-whatsapp-kind="custom" type="button">Order your custom painting</button>
      </div>
      <div class="custom-art">
        <div class="custom-art-panel">
          <span>Your story,</span>
          <strong>beautifully hand-painted.</strong>
        </div>
      </div>
    </section>
    <section class="how-works">
      <h2>How it works</h2>
      <div class="how-grid">
        <article><strong>1</strong><h3>Reach out</h3><p>Share your idea, photo, size, and timing.</p></article>
        <article><strong>2</strong><h3>We create</h3><p>Your artwork is hand-painted with care.</p></article>
        <article><strong>3</strong><h3>Preview</h3><p>You receive a photo before final touches.</p></article>
        <article><strong>4</strong><h3>Delivery</h3><p>Your painting is carefully packed and shipped.</p></article>
      </div>
    </section>
    <section class="custom-bottom">
      <div>
        <p>Every painting is handmade with heart and intention.</p>
        <h2>Let's Make Magic</h2>
      </div>
      <div>
        <p>Whether it is a special moment, a loved one, or a place that means everything to you, we would be honored to paint it.</p>
        <button class="ghost-button" data-whatsapp-kind="custom" type="button">Start your order</button>
      </div>
    </section>
  </section>`;
}

function renderCart() {
  if (!state.user) {
    app.innerHTML = `<section class="page">
      <div class="cart-top"><div><p class="eyebrow">Your collection</p><h1>Cart</h1></div></div>
      <div class="empty-state"><p>Please log in to view your cart.</p><button class="primary-button" id="cartLogin" type="button">Log in / Sign up</button></div>
    </section>`;
    document.querySelector("#cartLogin").addEventListener("click", () => openAuth("login"));
    return;
  }
  const total = state.cart.reduce((sum, item) => sum + Number(item.price_at_add || 0), 0);
  app.innerHTML = `<section class="page">
    <div class="cart-top">
      <div><p class="eyebrow">Your collection</p><h1>Cart</h1></div>
    </div>
    <p class="notice">Note-All the items added by you in the cart will get removed from the cart after 92 hours of being added</p>
    <div class="cart-layout">
      <div class="cart-list">
        ${state.cart.length ? state.cart.map(cartItemHtml).join("") : `<div class="empty-state"><p>Your cart is empty.</p><a class="primary-button" href="#paintings">Browse paintings</a></div>`}
      </div>
      <aside class="cart-summary">
        <h3>Order summary</h3>
        <div class="summary-line"><span>Items</span><strong>${state.cart.length}</strong></div>
        <div class="summary-line total"><span>Total</span><strong>${formatPrice(total)}</strong></div>
        <button class="primary-button" id="proceedButton" type="button">Proceed</button>
      </aside>
    </div>
  </section>`;
  document.querySelectorAll("[data-remove-cart]").forEach((button) => {
    button.addEventListener("click", async () => {
      await supabaseClient.from("cart_items").delete().eq("id", button.dataset.removeCart).eq("user_id", state.user.id);
      await loadCart();
      renderCart();
    });
  });
  document.querySelector("#proceedButton").addEventListener("click", () => openWhatsAppAfterNotice("query"));
}

function cartItemHtml(item) {
  const painting = item.paintings || {};
  const variant = item.painting_variants || {};
  return `<article class="cart-item">
    <figure><img src="${imageSrcForVariant(variant, painting.name)}" alt="${escapeHtml(painting.name)}"></figure>
    <div>
      <h3>${escapeHtml(painting.name)}</h3>
      <p>${escapeHtml(variantName(variant))} · ${escapeHtml(variant.length_cm)} x ${escapeHtml(variant.breadth_cm)} cm · ${escapeHtml(variant.frame_type)}</p>
      <strong>${formatPrice(item.price_at_add)}</strong>
    </div>
    <button class="small-button" data-remove-cart="${item.id}" type="button">Remove</button>
  </article>`;
}

function renderProfile() {
  if (!state.user) {
    openAuth("login");
    location.hash = "#home";
    return;
  }
  const profile = state.profile || {};
  app.innerHTML = `<section class="page">
    <div class="paintings-top">
      <div><p class="eyebrow">Your account</p><h1>Profile</h1></div>
      <button class="ghost-button" id="logoutButton" type="button">Log out</button>
    </div>
    <div class="profile-grid">
      <form class="profile-panel" id="profileForm">
        <h2>Address</h2>
        <label>Name<input name="name" value="${escapeHtml(profile.name)}" required></label>
        <label>Address<textarea name="address" required placeholder="Enter your House/Flat number and residency name(Society name)">${escapeHtml(profile.address)}</textarea></label>
        <label>Pincode<input name="pincode" value="${escapeHtml(profile.pincode)}" maxlength="6" inputmode="numeric" required></label>
        <div class="two-fields">
          <label>City<input name="city" value="${escapeHtml(profile.city)}" readonly></label>
          <label>State<input name="state" value="${escapeHtml(profile.state)}" readonly></label>
        </div>
        <button class="primary-button" type="submit">Save address</button>
        <p class="form-note" id="profileMessage"></p>
      </form>
      <div class="profile-panel">
        <h2>Settings</h2>
        <div class="field-row"><span>Website color</span>${themePickerHtml(profile.theme || "studio")}</div>
        <form id="passwordForm" class="auth-form">
          <h3>Change password</h3>
          <label>Old password<input name="oldPassword" type="password" required></label>
          <label>New password<input name="newPassword" type="password" minlength="6" required></label>
          <label>Confirm password<input name="confirmPassword" type="password" minlength="6" required></label>
          <button class="primary-button" type="submit">Save password</button>
          <p class="form-note" id="passwordMessage"></p>
        </form>
        <button class="danger-button" id="deleteAccountButton" type="button">Delete account</button>
      </div>
    </div>
  </section>`;

  const form = document.querySelector("#profileForm");
  form.pincode.addEventListener("input", debounce(() => fillPincodeFields(form.pincode.value, form.city, form.state, document.querySelector("#profileMessage")), 500));
  form.addEventListener("submit", saveProfile);
  document.querySelectorAll("[name='theme_choice']").forEach((input) => input.addEventListener("change", saveTheme));
  document.querySelector("#passwordForm").addEventListener("submit", changePassword);
  document.querySelector("#logoutButton").addEventListener("click", logout);
  document.querySelector("#deleteAccountButton").addEventListener("click", deleteAccount);
}

async function renderAdmin() {
  if (state.adminRefreshTimer) {
    clearInterval(state.adminRefreshTimer);
    state.adminRefreshTimer = null;
  }
  if (state.profile?.role !== "admin") {
    app.innerHTML = `<section class="page"><div class="empty-state"><p>Admin access is required.</p></div></section>`;
    return;
  }
  const stats = await loadAdminStats();
  app.innerHTML = `<section class="page">
    <div class="admin-top">
      <div><p class="eyebrow">Special access</p><h1>Admin Panel</h1><p>Manage paintings, stock, users, and shop activity.</p></div>
    </div>
    <div class="admin-tabs">
      <button class="tab-button ${state.adminTab === "items" ? "active" : ""}" data-admin-tab="items" type="button">Items</button>
      <button class="tab-button ${state.adminTab === "stats" ? "active" : ""}" data-admin-tab="stats" type="button">Statistics</button>
      <button class="tab-button ${state.adminTab === "about" ? "active" : ""}" data-admin-tab="about" type="button">About us</button>
    </div>
    ${state.adminTab === "items" ? renderAdminItems() : state.adminTab === "stats" ? `<div id="adminStatsRoot">${renderAdminStats(stats)}</div>` : renderAdminAbout()}
  </section>`;
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.adminTab = button.dataset.adminTab;
      renderAdmin();
    });
  });
  if (state.adminTab === "items") bindAdminItems();
  else if (state.adminTab === "stats") bindAdminStats(stats);
  else bindAdminAbout();
  bindRenderedEvents();
  if (state.adminTab === "stats") {
    if (state.adminRefreshTimer) clearInterval(state.adminRefreshTimer);
    state.adminRefreshTimer = setInterval(refreshAdminStatsPanel, 15000);
  }
}

function renderAdminItems() {
  return `<section class="admin-panel">
    <h2>Items</h2>
    <div class="toolbar">
      <button class="primary-button" id="addItemButton" type="button">Add item</button>
      <button class="small-button" id="selectAllButton" type="button">Select all items</button>
      <button class="small-button" id="unselectAllButton" type="button">Unselect all</button>
      <button class="small-button" id="outStockButton" type="button">List as out of stock</button>
      <button class="small-button" id="availableButton" type="button">List as available</button>
      <button class="danger-button" id="deleteItemsButton" type="button">Delete item</button>
    </div>
    <div class="admin-list">
      ${state.paintings.length ? state.paintings.map(adminItemHtml).join("") : `<div class="empty-state"><p>No paintings listed yet.</p></div>`}
    </div>
  </section>`;
}

function adminItemHtml(painting) {
  const variant = getDisplayVariant(painting);
  return `<article class="admin-item">
    <input type="checkbox" data-admin-check="${painting.id}" ${state.selectedItems.has(painting.id) ? "checked" : ""}>
    <img class="admin-thumb" src="${imageSrcForVariant(variant, painting.name)}" alt="${escapeHtml(painting.name)}">
    <div>
      <h3>${escapeHtml(painting.name)}</h3>
      <p>${getPriceLabel(painting)} · ${escapeHtml(painting.status)}</p>
    </div>
    <div class="admin-item-actions">
      <button class="small-button" data-edit-painting="${painting.id}" type="button">Edit</button>
      <button class="small-button" data-open-painting="${painting.id}" type="button">View</button>
    </div>
  </article>`;
}

function bindAdminItems() {
  document.querySelectorAll("[data-admin-check]").forEach((check) => {
    check.addEventListener("change", () => {
      if (check.checked) state.selectedItems.add(check.dataset.adminCheck);
      else state.selectedItems.delete(check.dataset.adminCheck);
    });
  });
  document.querySelector("#selectAllButton").addEventListener("click", () => {
    state.paintings.forEach((painting) => state.selectedItems.add(painting.id));
    renderAdmin();
  });
  document.querySelector("#unselectAllButton").addEventListener("click", () => {
    state.selectedItems.clear();
    renderAdmin();
  });
  document.querySelector("#outStockButton").addEventListener("click", () => updateSelectedStock("out_of_stock"));
  document.querySelector("#availableButton").addEventListener("click", () => updateSelectedStock("published"));
  document.querySelector("#deleteItemsButton").addEventListener("click", deleteSelectedItems);
  document.querySelector("#addItemButton").addEventListener("click", openAddItemModal);
  document.querySelectorAll("[data-edit-painting]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditItemModal(button.dataset.editPainting);
    });
  });
}

async function loadAdminStats() {
  const cache = state.adminStatsCache || {};
  const onlineCutoff = new Date(Date.now() - 45 * 1000).toISOString();
  cache.tick = (cache.tick || 0) + 1;
  const refreshUsers = !cache.users.length || cache.tick % 5 === 1;
  const [countResult, usersResult, paintingsResult, onlineResult] = await Promise.all([
    withTimeout(supabaseClient.from("profiles").select("id", { count: "exact", head: true }), 5000, { count: cache.usersCount || 0, error: null }),
    refreshUsers
      ? withTimeout(supabaseClient.from("profiles").select("id,name,email,created_at").order("created_at", { ascending: false }), 6000, { data: cache.users || [], error: null })
      : Promise.resolve({ data: cache.users, error: null }),
    withTimeout(supabaseClient.from("paintings").select("id,name,view_count,status,created_at,updated_at").order("created_at", { ascending: false }), 6000, { data: cache.paintings || [], error: null }),
    withTimeout(supabaseClient.rpc("list_online_users"), 5000, { data: cache.onlineUsers || [], error: null }),
  ]);
  let users = refreshUsers ? (usersResult.data || cache.users || []) : (cache.users || []);
  if (refreshUsers && usersResult.error) users = cache.users || [];
  const paintings = paintingsResult.data || cache.paintings || [];
  let onlineUsers = onlineResult.data || [];
  if (onlineResult.error || !Array.isArray(onlineUsers)) {
    const fallback = await withTimeout(
      supabaseClient.from("profiles").select("id,name,email,created_at,is_online,last_seen").eq("is_online", true).gte("last_seen", onlineCutoff),
      5000,
      { data: [], error: null },
    );
    onlineUsers = fallback.data || cache.onlineUsers || [];
  }
  const mostViewed = [...paintings].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0))[0] || cache.mostViewed || null;
  const stats = {
    usersCount: typeof countResult.count === "number" ? countResult.count : cache.usersCount || 0,
    paintingsCount: paintings.length || cache.paintingsCount || 0,
    onlineUsers: Array.isArray(onlineUsers) ? onlineUsers : cache.onlineUsers || [],
    mostViewed,
    users,
    paintings,
    tick: cache.tick,
  };
  state.adminStatsCache = stats;
  return stats;
}

function renderAdminStats(stats) {
  const maxViews = Math.max(1, ...(stats.paintings || []).map((item) => Number(item.view_count || 0)));
  return `<section class="admin-layout">
    <div class="stats-grid">
      <article class="stat-card"><span>Users</span><strong>${stats.usersCount}</strong></article>
      <article class="stat-card"><span>Paintings</span><strong>${stats.paintingsCount}</strong></article>
      <article class="stat-card clickable" id="onlineStat"><span>Online now</span><strong>${stats.onlineUsers.length}</strong></article>
      <article class="stat-card"><span>Most viewed</span><strong>${escapeHtml(stats.mostViewed?.name || "-")}</strong><small>${Number(stats.mostViewed?.view_count || 0)} views</small></article>
    </div>
    <section class="admin-panel">
      <h2>Painting views</h2>
      <div class="bar-chart">
        ${[...(stats.paintings || [])].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0)).map((painting) => {
          const width = Math.max(6, (Number(painting.view_count || 0) / maxViews) * 100);
          return `<div class="bar-row">
            <button class="analytics-link" data-painting-analytics="${painting.id}" type="button"><strong>${escapeHtml(painting.name)}</strong></button>
            <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
            <strong>${Number(painting.view_count || 0)}</strong>
          </div>`;
        }).join("")}
      </div>
    </section>
    <section class="admin-panel">
      <h2>Users</h2>
      <div class="users-list">
        ${stats.users.length ? stats.users.map((user) => `<article class="user-card" data-user-id="${user.id}">
          <div><h3>${escapeHtml(user.name || "Unnamed user")}</h3><p>${escapeHtml(user.email)}</p></div>
          <time>${new Date(user.created_at).toLocaleString("en-IN")}</time>
        </article>`).join("") : `<div class="empty-state"><p>No users yet.</p></div>`}
      </div>
    </section>
  </section>`;
}

function bindAdminStats(stats) {
  document.querySelector("#onlineStat").addEventListener("click", () => {
    const list = stats.onlineUsers.length
      ? stats.onlineUsers.map((user) => `<p><strong>${escapeHtml(user.name || "Unnamed user")}</strong><br>${escapeHtml(user.email)}</p>`).join("")
      : "<p>No users are online right now.</p>";
    showInfo("People online", list);
  });
  document.querySelectorAll("[data-user-id]").forEach((card) => {
    card.addEventListener("click", async () => showUserDetails(card.dataset.userId));
  });
  document.querySelectorAll("[data-painting-analytics]").forEach((button) => {
    button.addEventListener("click", async () => openPaintingAnalytics(button.dataset.paintingAnalytics));
  });
}

async function refreshAdminStatsPanel() {
  if (state.route !== "admin" || state.adminTab !== "stats" || state.adminStatsRefreshInFlight) return;
  const root = document.querySelector("#adminStatsRoot");
  if (!root) return;
  state.adminStatsRefreshInFlight = true;
  try {
    const stats = await loadAdminStats();
    if (state.route !== "admin" || state.adminTab !== "stats" || !document.body.contains(root)) return;
    root.innerHTML = renderAdminStats(stats);
    bindAdminStats(stats);
  } catch (error) {
    console.warn(error);
  } finally {
    state.adminStatsRefreshInFlight = false;
  }
}

async function openPaintingAnalytics(paintingId) {
  const painting = (state.adminStatsCache.paintings || state.paintings || []).find((item) => item.id === paintingId);
  const title = painting?.name || "Painting analytics";
  showCustomModal(title, `<div class="analytics-modal"><div class="empty-state"><p>Loading analytics...</p></div></div>`, async (panel) => {
    panel.classList.add("analytics-panel");
    const body = panel.querySelector(".analytics-modal");
    try {
      const { data, error } = await withTimeout(supabaseClient
        .from("painting_engagement_events")
        .select("id,painting_id,user_id,user_name,user_email,event_type,created_at")
        .eq("painting_id", paintingId)
        .order("created_at", { ascending: false }), 9000, { data: [], error: null });
      if (error) {
        body.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
        return;
      }
      const analytics = buildPaintingAnalytics(painting, data || []);
      body.innerHTML = renderPaintingAnalyticsHtml(analytics);
    } catch (error) {
      body.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message || "Unable to load analytics.")}</p></div>`;
    }
  });
}

function buildPaintingAnalytics(painting, events) {
  const viewers = new Map();
  const orderedEvents = [...events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let totalViews = 0;
  let cartClicks = 0;
  let whatsappClicks = 0;

  orderedEvents.forEach((event) => {
    const key = event.user_id || event.user_email || event.user_name || "guest";
    const name = event.user_name || "Guest visitor";
    const email = event.user_email || "No email available";
    const current = viewers.get(key) || {
      key,
      name,
      email,
      views: 0,
      cartClicks: 0,
      whatsappClicks: 0,
      firstViewed: event.created_at,
      lastViewed: event.created_at,
    };
    if (event.event_type === "view") {
      current.views += 1;
      totalViews += 1;
    } else if (event.event_type === "cart_click") {
      current.cartClicks += 1;
      cartClicks += 1;
    } else if (event.event_type === "whatsapp_click") {
      current.whatsappClicks += 1;
      whatsappClicks += 1;
    }
    current.firstViewed = current.firstViewed < event.created_at ? current.firstViewed : event.created_at;
    current.lastViewed = current.lastViewed > event.created_at ? current.lastViewed : event.created_at;
    viewers.set(key, current);
  });

  const viewerRows = [...viewers.values()].filter((viewer) => viewer.views || viewer.cartClicks || viewer.whatsappClicks);
  const uniqueViewers = viewerRows.filter((viewer) => viewer.views > 0).length;
  const repeatViewers = viewerRows.filter((viewer) => viewer.views > 1).length;
  const retentionRate = uniqueViewers ? Math.round((repeatViewers / uniqueViewers) * 100) : 0;
  const clickRate = totalViews ? Math.round((cartClicks / totalViews) * 100) : 0;
  const whatsappRate = totalViews ? Math.round((whatsappClicks / totalViews) * 100) : 0;
  const averageViews = uniqueViewers ? (totalViews / uniqueViewers).toFixed(1) : "0.0";
  return {
    paintingName: painting?.name || "Painting",
    totalViews,
    uniqueViewers,
    repeatViewers,
    retentionRate,
    clickRate,
    whatsappRate,
    cartClicks,
    whatsappClicks,
    averageViews,
    viewerRows: viewerRows.sort((a, b) => b.views - a.views || b.cartClicks - a.cartClicks || b.whatsappClicks - a.whatsappClicks),
  };
}

function renderPaintingAnalyticsHtml(analytics) {
  return `<div class="analytics-modal-body">
    <section class="analytics-summary-grid">
      <article><span>Total views</span><strong>${analytics.totalViews}</strong></article>
      <article><span>Unique viewers</span><strong>${analytics.uniqueViewers}</strong></article>
      <article><span>Retention rate</span><strong>${analytics.retentionRate}%</strong><small>${analytics.repeatViewers} returning viewers</small></article>
      <article><span>Click rate</span><strong>${analytics.clickRate}%</strong><small>${analytics.cartClicks} cart clicks</small></article>
      <article><span>WhatsApp rate</span><strong>${analytics.whatsappRate}%</strong><small>${analytics.whatsappClicks} message opens</small></article>
      <article><span>Avg. views / viewer</span><strong>${analytics.averageViews}</strong></article>
    </section>
    <section class="analytics-viewer-list">
      <div class="analytics-viewer-head">
        <strong>Name</strong>
        <strong>Email</strong>
        <strong>Views</strong>
        <strong>Clicks</strong>
      </div>
      ${analytics.viewerRows.length ? analytics.viewerRows.map((viewer) => `<div class="analytics-viewer-row">
        <span>${escapeHtml(viewer.name)}</span>
        <span>${escapeHtml(viewer.email)}</span>
        <span>${viewer.views}</span>
        <span>${viewer.cartClicks + viewer.whatsappClicks}</span>
      </div>`).join("") : `<div class="empty-state"><p>No viewer records yet.</p></div>`}
    </section>
  </div>`;
}

function renderAdminAbout() {
  return `<section class="admin-panel about-editor">
    <h2>About us</h2>
    <p class="eyebrow">Our Story</p>
    <h3>Atelier by Murooj</h3>
    <form id="aboutForm" class="auth-form">
      <label>Editable about text<textarea name="about_body" rows="12" required>${escapeHtml(state.siteSettings.about_body || aboutCopy)}</textarea></label>
      <p class="form-note">The title and signature stay fixed. Only the story body is editable here.</p>
      <button class="primary-button" type="submit">Save</button>
      <p class="form-note" id="aboutMessage"></p>
    </form>
    <p class="signature">-Atelier by Murooj</p>
  </section>`;
}

function bindAdminAbout() {
  const form = document.querySelector("#aboutForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.querySelector("#aboutMessage");
    const confirmed = await askConfirm("Save About us?", "<p>This will update the story shown on the About us page.</p>");
    if (!confirmed) return;
    const about_body = form.about_body.value.trim();
    const { error } = await supabaseClient.from("site_settings").upsert({
      id: 1,
      about_body,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      message.textContent = error.message;
      return;
    }
    state.siteSettings.about_body = about_body;
    message.textContent = "About us updated.";
    renderAdmin();
  });
}

async function showUserDetails(userId) {
  const [{ data: profile }, { data: cartItems }] = await Promise.all([
    supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabaseClient
      .from("cart_items")
      .select("*, paintings(*), painting_variants(*)")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString()),
  ]);
  const cartHtml = (cartItems || []).length
    ? cartItems.map((item) => `<div class="user-cart-row"><img class="user-cart-thumb" src="${imageSrcForVariant(item.painting_variants, item.paintings?.name)}" alt=""><div><strong>${escapeHtml(item.paintings?.name)}</strong><br>${formatPrice(item.price_at_add)}</div></div>`).join("")
    : "<p>No active cart items.</p>";
  showInfo("User details", `<p><strong>${escapeHtml(profile?.name)}</strong><br>${escapeHtml(profile?.email)}</p><p>${escapeHtml(profile?.address)}<br>${escapeHtml(profile?.city)}, ${escapeHtml(profile?.state)} - ${escapeHtml(profile?.pincode)}</p><h3>Cart</h3>${cartHtml}`);
}

async function addToCart(paintingId, variantId, options = {}) {
  if (!supabaseClient) {
    showToast("Database is still loading. Refresh and try again.");
    return;
  }
  const painting = state.paintings.find((item) => item.id === paintingId);
  const variant = getVariants(painting || {}).find((item) => item.id === variantId);
  if (!painting || !variant) {
    showToast("Please select a painting variant before adding it to cart.");
    return;
  }
  if (getPaintingStatus(painting) === "out_of_stock" || variant.available === false) {
    showToast("This painting is currently out of stock.");
    return;
  }
  if (options.trackClick !== false) {
    void recordPaintingEvent(paintingId, "cart_click");
  }
  if (!state.user) {
    state.pendingAdd = { paintingId, variantId };
    openAuth("login");
    return;
  }
  let { error } = await supabaseClient.rpc("add_cart_item", {
    painting_id_input: paintingId,
    variant_id_input: variantId,
  });
  if (error) {
    const expires = new Date(Date.now() + 92 * 60 * 60 * 1000).toISOString();
    const fallback = await supabaseClient.from("cart_items").insert({
      user_id: state.user.id,
      painting_id: paintingId,
      variant_id: variantId,
      price_at_add: variant.price,
      expires_at: expires,
    });
    error = fallback.error;
  }
  if (error) showToast(error.message);
  else {
    await loadCart();
    render();
    showToast("Painting added to cart.");
  }
}

function openAuth(tab = "login") {
  authModal.classList.remove("hidden");
  document.querySelectorAll("[data-auth-tab]").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  document.querySelector("#loginForm").classList.toggle("hidden", tab !== "login");
  document.querySelector("#signupForm").classList.toggle("hidden", tab !== "signup");
}

function closeAuth() {
  authModal.classList.add("hidden");
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#loginMessage");
  message.textContent = "";
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  if (!isValidEmail(email)) {
    message.textContent = "Please enter a valid email address.";
    return;
  }
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    message.textContent = "Email or password did not match any account.";
    return;
  }
  localStorage.setItem("tpf_remember", form.remember.checked ? "true" : "false");
  sessionStorage.setItem("tpf_active_session", "true");
  closeAuth();
  await ensureSession();
  await continuePendingAdd();
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#signupMessage");
  message.textContent = "";
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const pincodeData = await validatePincode(form.pincode.value);

  if (!isValidEmail(email)) {
    message.textContent = "Please enter a valid email address.";
    return;
  }
  if (password !== confirmPassword) {
    message.textContent = "Both passwords must be exactly the same.";
    return;
  }
  if (!pincodeData.valid) {
    message.textContent = "Please enter a valid Pincode";
    return;
  }

  const details = {
    name: form.name.value.trim(),
    email,
    address: form.address.value.trim(),
    pincode: form.pincode.value.trim(),
    city: pincodeData.city,
    state: pincodeData.state,
  };

  const confirmed = await askConfirm("Are you sure that all your information is correct?", confirmationList(details));
  if (!confirmed) return;

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: details.name,
        address: details.address,
        pincode: details.pincode,
        city: details.city,
        state: details.state,
      },
    },
  });
  if (error) {
    message.textContent = error.message.includes("already") ? "An account already exists with this email." : error.message;
    return;
  }
  const user = data.user;
  if (user && data.session) {
    await supabaseClient.from("profiles").upsert({
      id: user.id,
      email,
      name: details.name,
      address: details.address,
      pincode: details.pincode,
      city: details.city,
      state: details.state,
      role: "user",
      theme: "studio",
      is_online: true,
      last_seen: new Date().toISOString(),
    });
  }
  if (!data.session) {
    message.style.color = "var(--success)";
    message.textContent = "Account created. Please confirm your email, then log in.";
    return;
  }
  localStorage.setItem("tpf_remember", form.remember.checked ? "true" : "false");
  sessionStorage.setItem("tpf_active_session", "true");
  closeAuth();
  await ensureSession();
  await continuePendingAdd();
}

async function continuePendingAdd() {
  const pending = state.pendingAdd;
  const pendingWhatsApp = state.pendingWhatsApp;
  state.pendingAdd = null;
  state.pendingWhatsApp = null;
  await loadPaintings();
  await loadCart();
  if (pending) await addToCart(pending.paintingId, pending.variantId, { trackClick: false });
  else if (pendingWhatsApp) await openWhatsAppAfterNotice(pendingWhatsApp.kind || "query", pendingWhatsApp.paintingId || null, { trackClick: false });
  else render();
}

function confirmationList(details) {
  return `<div class="notice">
    <p><strong>Name:</strong> ${escapeHtml(details.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(details.email)}</p>
    <p><strong>Address:</strong> ${escapeHtml(details.address)}</p>
    <p><strong>Pincode:</strong> ${escapeHtml(details.pincode)}</p>
    <p><strong>City:</strong> ${escapeHtml(details.city)}</p>
    <p><strong>State:</strong> ${escapeHtml(details.state)}</p>
  </div>`;
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#profileMessage");
  const pincodeData = await validatePincode(form.pincode.value);
  if (!pincodeData.valid) {
    message.textContent = "Please enter a valid Pincode";
    return;
  }
  const { error } = await supabaseClient.from("profiles").update({
    name: form.name.value.trim(),
    address: form.address.value.trim(),
    pincode: form.pincode.value.trim(),
    city: pincodeData.city,
    state: pincodeData.state,
    updated_at: new Date().toISOString(),
  }).eq("id", state.user.id);
  message.style.color = error ? "var(--danger)" : "var(--success)";
  message.textContent = error ? error.message : "Profile saved.";
  await loadProfile();
}

async function saveTheme(event) {
  await supabaseClient.from("profiles").update({ theme: event.target.value }).eq("id", state.user.id);
  await loadProfile();
  applyTheme();
}

async function changePassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#passwordMessage");
  const email = state.profile.email;
  if (form.newPassword.value !== form.confirmPassword.value) {
    message.textContent = "New password and confirm password must match.";
    return;
  }
  const loginCheck = await supabaseClient.auth.signInWithPassword({ email, password: form.oldPassword.value });
  if (loginCheck.error) {
    message.textContent = "Old password is incorrect.";
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({ password: form.newPassword.value });
  message.style.color = error ? "var(--danger)" : "var(--success)";
  message.textContent = error ? error.message : "Password updated.";
  form.reset();
}

async function logout() {
  if (state.user) {
    await supabaseClient.from("profiles").update({ is_online: false, last_seen: new Date().toISOString() }).eq("id", state.user.id);
  }
  await supabaseClient.auth.signOut();
  sessionStorage.removeItem("tpf_active_session");
  location.hash = "#home";
}

async function deleteAccount() {
  const confirmed = await askConfirm("Delete account?", "<p>This removes your account, profile, address, and cart from the shop database.</p>");
  if (!confirmed) return;
  const { error } = await supabaseClient.rpc("delete_my_account");
  if (error) {
    showToast(error.message);
    return;
  }
  await supabaseClient.auth.signOut();
  location.hash = "#home";
  render();
}

async function updateSelectedStock(status) {
  if (!state.selectedItems.size) return showToast("Select at least one item.");
  const selectedIds = [...state.selectedItems];
  if (!supabaseClient) {
    showToast("Database is still loading. Refresh and try again.");
    return;
  }
  const rpcResult = await supabaseClient.rpc("set_painting_stock", {
    painting_ids_input: selectedIds,
    is_available_input: status === "published",
  });
  if (!rpcResult.error) {
    state.selectedItems.clear();
    await loadPaintings();
    renderAdmin();
    return;
  }
  const paintingResult = await supabaseClient.from("paintings").update({ status }).in("id", selectedIds);
  if (paintingResult.error) {
    showToast(paintingResult.error.message || rpcResult.error.message);
    return;
  }
  const variantResult = await supabaseClient.from("painting_variants").update({ available: status === "published" }).in("painting_id", selectedIds);
  if (variantResult.error) {
    showToast(variantResult.error.message);
    return;
  }
  state.selectedItems.clear();
  await loadPaintings();
  renderAdmin();
}

async function deleteSelectedItems() {
  if (!state.selectedItems.size) return showToast("Select at least one item.");
  const confirmed = await askConfirm("Delete selected paintings?", "<p>This removes the selected paintings and their variants.</p>");
  if (!confirmed) return;
  const result = await supabaseClient.from("paintings").delete().in("id", [...state.selectedItems]);
  if (result.error) {
    showToast(result.error.message);
    return;
  }
  state.selectedItems.clear();
  await loadPaintings();
  renderAdmin();
}

function openAddItemModal() {
  showListingModal();
}

function openEditItemModal(paintingId) {
  const painting = state.paintings.find((item) => item.id === paintingId);
  if (!painting) return showToast("Painting was not found.");
  showListingModal(painting);
}

function showListingModal(painting = null) {
  const editing = Boolean(painting);
  showCustomModal(editing ? "Edit item" : "Add item", listingFormHtml(painting), (panel) => {
    const variantsWrap = panel.querySelector("#variantsWrap");
    const addVariant = (variant = null) => {
      const index = variantsWrap.querySelectorAll(".variant-form").length + 1;
      variantsWrap.insertAdjacentHTML("beforeend", variantFormHtml(index, variant, editing));
      bindVariantPreview(variantsWrap.lastElementChild);
    };
    const variants = getVariants(painting || {});
    if (variants.length) variants.forEach(addVariant);
    else addVariant();
    panel.querySelector("#addVariantButton").addEventListener("click", () => addVariant());
    panel.querySelector("#publishItemForm").addEventListener("submit", (event) => saveListing(event, painting));
  });
}

function listingFormHtml(painting = null) {
  const editing = Boolean(painting);
  return `<form id="publishItemForm" class="auth-form">
    <label>Painting name<input name="name" value="${escapeHtml(painting?.name || "")}" required></label>
    <label>Description<textarea name="description" required maxlength="850" placeholder="Maximum 100 words">${escapeHtml(painting?.description || "")}</textarea></label>
    <div id="variantsWrap"></div>
    <button class="small-button" id="addVariantButton" type="button">Add another variant</button>
    <button class="primary-button" type="submit">${editing ? "Save listing" : "Publish"}</button>
    <p class="form-note" id="publishMessage"></p>
  </form>`;
}

function frameOption(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function variantFormHtml(index, variant = null, editing = false) {
  const standardFrames = ["Canvas", "Black rectangular frame", "Brown rectangular frame", "White frame"];
  const frame = variant?.frame_type || "Canvas";
  const isCustomFrame = frame && !standardFrames.includes(frame);
  const imageRequired = variant?.id ? "" : "required";
  return `<fieldset class="variant-form">
    <legend>Variant ${index}</legend>
    <input type="hidden" name="variant_id" value="${escapeHtml(variant?.id || "")}">
    <input type="hidden" name="existing_image" value="${escapeHtml(variant?.image_data || "")}">
    <label>Variant name<input name="variant_name" value="${escapeHtml(variantName(variant, index - 1))}" required placeholder="Example: Medium black frame"></label>
    <div class="two-fields">
      <label>Length cm<input name="length_cm" type="number" min="1" step="0.1" value="${escapeHtml(variant?.length_cm || "")}" required></label>
      <label>Breadth cm<input name="breadth_cm" type="number" min="1" step="0.1" value="${escapeHtml(variant?.breadth_cm || "")}" required></label>
    </div>
    <label>Frame type
      <select name="frame_type" required>
        ${standardFrames.map((item) => frameOption(item, item, !isCustomFrame && frame === item)).join("")}
        ${frameOption("__other", "Other", isCustomFrame)}
      </select>
    </label>
    <label class="custom-frame ${isCustomFrame ? "" : "hidden"}">Custom frame type<input name="custom_frame_type" value="${escapeHtml(isCustomFrame ? frame : "")}" placeholder="Enter frame type" ${isCustomFrame ? "required" : ""}></label>
    <label>Price INR<input name="price" type="number" min="1" step="1" value="${escapeHtml(variant?.price || "")}" required></label>
    <label>Painting image</label>
    <div class="photo-actions">
      <button class="small-button" type="button" data-camera-button>Open camera</button>
      <button class="small-button" type="button" data-gallery-button>Upload from gallery</button>
      <button class="small-button ${variant?.image_data ? "" : "hidden"}" type="button" data-reupload-button>Re-upload</button>
    </div>
    <input class="hidden" name="image" type="file" accept="image/*" ${imageRequired}>
    <input class="hidden" name="camera_image" type="file" accept="image/*" capture="environment">
    ${editing && variant?.id ? `<small>Leave empty to keep the current image.</small>` : ""}
    <img class="variant-preview ${variant?.image_data ? "" : "hidden"}" src="${variant?.image_data ? imageSrcForVariant(variant) : ""}" alt="Variant preview">
  </fieldset>`;
}

function bindVariantPreview(fieldset) {
  const input = fieldset.querySelector("[name='image']");
  const cameraInput = fieldset.querySelector("[name='camera_image']");
  const preview = fieldset.querySelector(".variant-preview");
  const reuploadButton = fieldset.querySelector("[data-reupload-button]");
  const frameSelect = fieldset.querySelector("[name='frame_type']");
  const customFrame = fieldset.querySelector(".custom-frame");
  frameSelect.addEventListener("change", () => {
    const isOther = frameSelect.value === "__other";
    customFrame.classList.toggle("hidden", !isOther);
    customFrame.querySelector("input").required = isOther;
  });
  const handleFile = async (file) => {
    if (!file) return;
    preview.src = await fileToDataUrl(file);
    preview.classList.remove("hidden");
    reuploadButton.classList.remove("hidden");
  };
  fieldset.querySelector("[data-camera-button]").addEventListener("click", () => cameraInput.click());
  fieldset.querySelector("[data-gallery-button]").addEventListener("click", () => input.click());
  reuploadButton.addEventListener("click", () => input.click());
  input.addEventListener("change", () => handleFile(input.files[0]));
  cameraInput.addEventListener("change", () => handleFile(cameraInput.files[0]));
}

async function saveListing(event, painting = null) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#publishMessage");
  message.textContent = "";
  if (wordCount(form.description.value) > 100) {
    message.textContent = "Description can only be 100 words.";
    return;
  }
  const variantForms = [...form.querySelectorAll(".variant-form")];
  const variants = [];
  for (const fieldset of variantForms) {
    const imageFile = fieldset.querySelector("[name='image']").files[0] || fieldset.querySelector("[name='camera_image']").files[0];
    const existingImage = fieldset.querySelector("[name='existing_image']").value;
    const selectedFrameType = fieldset.querySelector("[name='frame_type']").value;
    const customFrameType = fieldset.querySelector("[name='custom_frame_type']").value.trim();
    const imageData = imageFile ? await fileToDataUrl(imageFile) : existingImage;
    if (!imageData) {
      message.textContent = "Please upload an image for every new variant.";
      return;
    }
    variants.push({
      id: fieldset.querySelector("[name='variant_id']").value || null,
      variant_name: fieldset.querySelector("[name='variant_name']").value.trim(),
      length_cm: Number(fieldset.querySelector("[name='length_cm']").value),
      breadth_cm: Number(fieldset.querySelector("[name='breadth_cm']").value),
      frame_type: selectedFrameType === "__other" ? customFrameType : selectedFrameType,
      price: Number(fieldset.querySelector("[name='price']").value),
      image_data: imageData,
      available: true,
    });
  }
  if (!variantsHaveUniqueNames(variants)) {
    message.textContent = "Every variant must have its own unique name.";
    return;
  }
  const confirmed = await askConfirm(painting ? "Save changes?" : "Publish this painting?", painting ? "<p>This updates the listing everyone sees.</p>" : "<p>After confirmation it can be seen by everyone.</p>");
  if (!confirmed) return;

  let paintingId = painting?.id;
  if (paintingId) {
    const { error } = await supabaseClient.from("paintings").update({
      name: form.name.value.trim(),
      description: form.description.value.trim(),
    }).eq("id", paintingId);
    if (error) {
      message.textContent = error.message;
      return;
    }
  } else {
    const { data: insertedPainting, error } = await supabaseClient.from("paintings").insert({
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      status: "published",
      created_by: state.user.id,
    }).select().single();
    if (error) {
      message.textContent = error.message;
      return;
    }
    paintingId = insertedPainting.id;
  }

  for (const variant of variants) {
    const payload = {
      painting_id: paintingId,
      variant_name: variant.variant_name,
      length_cm: variant.length_cm,
      breadth_cm: variant.breadth_cm,
      frame_type: variant.frame_type,
      price: variant.price,
      image_data: variant.image_data,
      available: variant.available,
    };
    const result = variant.id
      ? await supabaseClient.from("painting_variants").update(payload).eq("id", variant.id)
      : await supabaseClient.from("painting_variants").insert(payload);
    if (result.error) {
      message.textContent = result.error.message;
      return;
    }
  }
  closeTopModal();
  await loadPaintings();
  renderAdmin();
}

function variantsHaveUniqueNames(variants) {
  const seen = new Set();
  return variants.every((variant) => {
    const key = variant.variant_name.toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Please upload an image file."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 1400;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.onerror = () => resolve(reader.result);
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fillPincodeFields(value, cityInput, stateInput, messageEl) {
  cityInput.value = "";
  stateInput.value = "";
  if (!/^\d{6}$/.test(value)) return;
  const data = await validatePincode(value);
  if (!data.valid) {
    messageEl.textContent = "Please enter a valid Pincode";
    return;
  }
  messageEl.textContent = "";
  cityInput.value = data.city;
  stateInput.value = data.state;
}

async function validatePincode(pincode) {
  if (!/^\d{6}$/.test(String(pincode))) return { valid: false };
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    const result = data?.[0];
    const postOffice = result?.PostOffice?.[0];
    if (result?.Status !== "Success" || !postOffice) return { valid: false };
    return {
      valid: true,
      city: postOffice.District || postOffice.Block || postOffice.Name,
      state: postOffice.State,
    };
  } catch (error) {
    console.warn(error);
    return { valid: false };
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@(gmail|yahoo|outlook|hotmail|icloud|protonmail|rediffmail|aol|zoho|live|msn|me|ymail|rocketmail|mail)\.(com|co\.in|in|net|org)$/i.test(email);
}

function debounce(callback, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}

function askConfirm(title, body) {
  if (document.querySelector(".custom-modal")) {
    return new Promise((resolve) => {
      showCustomModal(title, `<div>${body}</div><div class="modal-actions"><button class="ghost-button" data-confirm-cancel type="button">Cancel</button><button class="primary-button" data-confirm-ok type="button">Confirm</button></div>`, (panel) => {
        panel.closest(".custom-modal").classList.add("confirm-top");
        panel.querySelector("[data-confirm-ok]").addEventListener("click", () => {
          closeTopModal();
          resolve(true);
        });
        panel.querySelector("[data-confirm-cancel]").addEventListener("click", () => {
          closeTopModal();
          resolve(false);
        });
      });
    });
  }
  return new Promise((resolve) => {
    document.querySelector("#confirmTitle").textContent = title;
    document.querySelector("#confirmBody").innerHTML = body;
    confirmModal.classList.remove("hidden");
    const ok = document.querySelector("#confirmOk");
    const cancel = document.querySelector("#confirmCancel");
    const cleanup = (value) => {
      confirmModal.classList.add("hidden");
      ok.onclick = null;
      cancel.onclick = null;
      resolve(value);
    };
    ok.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);
  });
}

function showInfo(title, body) {
  showCustomModal(title, `<div>${body}</div><div class="modal-actions"><button class="primary-button" data-close-top type="button">Close</button></div>`, (panel) => {
    panel.querySelector("[data-close-top]").addEventListener("click", closeTopModal);
  });
}

function showToast(message) {
  showInfo("Atelier by Murooj", `<p>${escapeHtml(message)}</p>`);
}

function showCustomModal(title, body, afterRender) {
  const wrapper = document.createElement("div");
  wrapper.className = "modal-backdrop custom-modal";
  wrapper.innerHTML = `<section class="modal-panel"><button class="modal-close" data-close-top type="button" aria-label="Close">×</button><h2>${escapeHtml(title)}</h2>${body}</section>`;
  document.body.appendChild(wrapper);
  wrapper.addEventListener("click", (event) => {
    if (event.target === wrapper || event.target.matches("[data-close-top]")) closeTopModal();
  });
  afterRender?.(wrapper.querySelector(".modal-panel"));
}

function closeTopModal() {
  document.querySelector(".custom-modal:last-of-type")?.remove();
}

init();
