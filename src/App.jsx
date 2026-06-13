import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Shield, Swords, GraduationCap, Sparkles, Bell, LogOut, Plus, Check, Clock, Play,
  Flag, Star, Users, TrendingUp, Wallet, Activity, ChevronRight, Trophy, MessageCircle,
  Search, X, ArrowRight, Crown, Zap, Hash, UserCheck, ShieldCheck,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "./supabaseClient";

/* ===================== dominio ===================== */
const RANKS = ["Hierro", "Bronce", "Plata", "Oro", "Platino", "Esmeralda", "Diamante", "Master"];
const DIVS = ["IV", "III", "II", "I"];
const RANK_COLOR = { Hierro: "#7B8497", Bronce: "#B07B3E", Plata: "#A8B3C7", Oro: "#E8B349", Platino: "#2DD4BF", Esmeralda: "#10B981", Diamante: "#38BDF8", Master: "#A855F7" };
const SERVICES = {
  duoboost: { label: "DuoBoost", icon: Swords, color: "#38BDF8", desc: "Un booster juega en dúo con vos. Jugás en tu cuenta, 0% riesgo." },
  coaching: { label: "Coaching", icon: GraduationCap, color: "#A855F7", desc: "Sesiones 1 a 1 con high elo. Revisión de partidas y plan de mejora." },
  combo: { label: "Duo + Coaching", icon: Sparkles, color: "#E8B349", desc: "Subís de elo mientras el coach te guía en vivo por Discord." },
};
const DISCORD_INVITE = "https://discord.gg/Fxghn7S5";
const STATUS_FLOW = ["pending", "available", "in_progress", "completed"];
const STATUS_LABEL = { pending: "En revisión", available: "Disponible", in_progress: "En proceso", completed: "Finalizado", cancelled: "Cancelado" };

const TIER_DIV_COST = { Hierro: 3000, Bronce: 3500, Plata: 4500, Oro: 6000, Platino: 8500, Esmeralda: 12000, Diamante: 17000 };
const COACHING_PRICE = { 1: 15000, 3: 35000, 5: 50000 };
function rankPos(r, d) { const i = RANKS.indexOf(r); return r === "Master" ? 32 : i * 4 + DIVS.indexOf(d); }
function estimateDuo(cur, curD, tgt, tgtD, combo) {
  let p = rankPos(cur, curD), to = rankPos(tgt, tgtD), steps = Math.max(0, to - p), price = 0;
  for (let i = 0; i < steps; i++) { price += TIER_DIV_COST[RANKS[Math.min(7, Math.floor(p / 4))]] || 6000; p++; }
  if (steps === 0) price = TIER_DIV_COST[cur] || 6000;
  if (combo) price = Math.round(price * 1.5);
  return Math.round(price / 100) * 100;
}
const fmtARS = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
function timeAgo(t) {
  const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "hace instantes";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

/* ===================== UI atoms ===================== */
function RankPath({ o }) {
  const pill = (r, d) => (
    <span className="nop-rankpill" style={{ color: RANK_COLOR[r], borderColor: RANK_COLOR[r] + "55", background: RANK_COLOR[r] + "14" }}>
      {r}{r !== "Master" ? " " + d : ""}
    </span>
  );
  if (o.service === "coaching") return <span className="nop-rankpath">{pill(o.cur_rank, o.cur_div)}</span>;
  return <span className="nop-rankpath">{pill(o.cur_rank, o.cur_div)}<ArrowRight size={13} style={{ color: "var(--mut2)" }} />{pill(o.tgt_rank, o.tgt_div)}</span>;
}
function StatusBadge({ s }) {
  const ic = { pending: <Clock size={11} />, available: <Zap size={11} />, in_progress: <Play size={11} />, completed: <Check size={11} />, cancelled: <X size={11} /> }[s];
  return <span className={"nop-status s-" + s}>{ic}{STATUS_LABEL[s]}</span>;
}
function SvcTag({ s }) { const S = SERVICES[s] || SERVICES.duoboost; const Ic = S.icon; return <span className="nop-svc" style={{ color: S.color, borderColor: S.color + "44" }}><Ic size={12} />{S.label}</span>; }
function Stars({ value, onChange }) {
  return <div className="nop-stars">{[1, 2, 3, 4, 5].map((n) => (
    <button key={n} type="button" className={"nop-starbtn" + (n <= value ? " on" : "")} onClick={() => onChange && onChange(n)} disabled={!onChange}>★</button>))}</div>;
}
function Empty({ icon: Icon, title, sub }) { return <div className="nop-empty"><div className="ic"><Icon size={24} /></div><h3>{title}</h3><p>{sub}</p></div>; }

/* ===================== APP ===================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState("");
  const [orders, setOrders] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const reloadRef = useRef(() => {});

  /* sesión */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  /* perfil */
  useEffect(() => {
    if (!session) { setProfile(null); setBooting(false); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data);
      setBooting(false);
      if (data) setTab(data.role === "admin" ? "validate" : data.role === "booster" ? "board" : "home");
    })();
  }, [session]);

  /* carga de datos según rol */
  const reload = useCallback(async () => {
    if (!profile) return;
    const { data: ord } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(ord || []);
    const { data: nt } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(40);
    setNotifs(nt || []);
    if (profile.role === "admin") {
      const { data: pf } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setProfiles(pf || []);
    }
  }, [profile]);
  reloadRef.current = reload;

  useEffect(() => { reload(); }, [reload]);

  /* tiempo real */
  useEffect(() => {
    if (!profile) return;
    const ch = supabase.channel("nop-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => reloadRef.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => reloadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile]);

  const notify = async (text, recipient_role = null, recipient_id = null, icon = "bell") => {
    await supabase.from("notifications").insert({ text, recipient_role, recipient_id, icon });
  };

  const logout = async () => { await supabase.auth.signOut(); setProfile(null); setOrders([]); setNotifs([]); setProfiles([]); setTab(""); };

  if (booting) return <Splash />;
  if (!session || !profile) return <Auth />;

  // booster pendiente de aprobación
  if (profile.role === "booster" && profile.status !== "active") {
    return <Gate logout={logout} title="Cuenta pendiente de aprobación"
      sub="Tu cuenta de booster fue creada. Un administrador tiene que habilitarte antes de que puedas ver los trabajos. Te avisamos apenas estés activo." />;
  }
  if (profile.status === "disabled") return <Gate logout={logout} title="Cuenta deshabilitada" sub="Tu acceso fue suspendido. Contactá al administrador." />;

  const ctx = { profile, orders, profiles, reload, flash, notify };
  const myNotifs = notifs;
  const avatarColor = profile.role === "admin" ? "var(--gold)" : profile.role === "booster" ? "var(--cyan)" : "var(--violet)";

  return (
    <>
      <div className="nop-topbar"><div className="nop-shell">
        <div className="nop-topbar-in">
          <div className="nop-logo"><div className="nop-logo-mark"><Crown size={19} /></div><div><b>NATION</b><span>OPS PANEL</span></div></div>
          <div className="nop-spacer" />
          <span className="nop-roletag">{profile.role === "admin" ? "Admin" : profile.role === "booster" ? "Booster" : "Cliente"}</span>
          <button className="nop-iconbtn" onClick={() => setDrawer(true)}><Bell size={17} />{myNotifs.length > 0 && <span className="nop-dot">{myNotifs.length > 9 ? "9+" : myNotifs.length}</span>}</button>
          <div className="nop-userchip"><span className="nm">{profile.full_name || profile.email}</span>
            <span className="nop-avatar" style={{ background: avatarColor }}>{(profile.full_name || "?")[0]?.toUpperCase()}</span></div>
          <button className="nop-iconbtn" onClick={logout} title="Salir"><LogOut size={16} /></button>
        </div>
        <Tabs role={profile.role} tab={tab} setTab={setTab} orders={orders} profiles={profiles} />
      </div></div>

      <div className="nop-shell"><div className="nop-page">
        {profile.role === "admin" && <AdminViews tab={tab} setTab={setTab} {...ctx} />}
        {profile.role === "booster" && <BoosterViews tab={tab} {...ctx} />}
        {profile.role === "cliente" && <ClientViews tab={tab} setTab={setTab} {...ctx} />}
      </div></div>

      {drawer && <Drawer notifs={myNotifs} onClose={() => setDrawer(false)} />}
      {toast && <div className="nop-toast"><Check size={16} style={{ color: "var(--grn)" }} />{toast}</div>}
    </>
  );
}

function Splash() {
  return <div className="nop-center"><div><div className="nop-logo-mark" style={{ width: 48, height: 48, margin: "0 auto 14px" }}><Crown size={24} /></div>Cargando panel…</div></div>;
}
function Gate({ title, sub, logout }) {
  return <div className="nop-auth"><div className="nop-authbox" style={{ textAlign: "center" }}>
    <div className="nop-logo-mark" style={{ width: 52, height: 52, margin: "0 auto 18px" }}><Clock size={26} /></div>
    <h1 className="nop-display" style={{ fontSize: 24, marginBottom: 10 }}>{title}</h1>
    <p style={{ color: "var(--mut)", fontSize: 14, marginBottom: 22 }}>{sub}</p>
    <button className="nop-btn nop-btn-ghost" onClick={logout}><LogOut size={15} />Cerrar sesión</button>
  </div></div>;
}

/* ===================== AUTH ===================== */
function Auth() {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("cliente");
  const [fullName, setName] = useState("");
  const [discord, setDiscord] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setOk(""); setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      } else {
        if (!fullName) throw new Error("Ingresá tu nombre.");
        const { data, error } = await supabase.auth.signUp({
          email, password: pass,
          options: { data: { full_name: fullName, role, discord } },
        });
        if (error) throw error;
        if (!data.session) { setOk("Cuenta creada. Ya podés iniciar sesión."); setMode("login"); }
        else if (role === "booster") setOk("Cuenta de booster creada. Espera la aprobación del admin.");
      }
    } catch (e) {
      const m = (e.message || "").toLowerCase();
      if (m.includes("invalid login")) setErr("Email o contraseña incorrectos.");
      else if (m.includes("already registered")) setErr("Ese email ya tiene cuenta. Iniciá sesión.");
      else if (m.includes("email not confirmed")) setErr("Falta confirmar el email (o desactivá la confirmación en Supabase).");
      else if (m.includes("password")) setErr("La contraseña debe tener al menos 6 caracteres.");
      else setErr(e.message || "Algo salió mal.");
    } finally { setBusy(false); }
  };

  return (
    <div className="nop-auth"><div className="nop-authbox">
      <div className="nop-authhead">
        <div className="badge">Eloboost Nation</div>
        <h1 className="nop-display">Panel de Operaciones</h1>
        <p>{mode === "login" ? "Ingresá con tu cuenta." : "Creá tu cuenta para empezar."}</p>
      </div>
      <div className="nop-card" style={{ padding: 24 }}>
        <div className="nop-authtabs">
          <button className={"nop-authtab" + (mode === "login" ? " on" : "")} onClick={() => { setMode("login"); setErr(""); setOk(""); }}>Iniciar sesión</button>
          <button className={"nop-authtab" + (mode === "signup" ? " on" : "")} onClick={() => { setMode("signup"); setErr(""); setOk(""); }}>Crear cuenta</button>
        </div>
        {err && <div className="nop-err">{err}</div>}
        {ok && <div className="nop-ok">{ok}</div>}

        {mode === "signup" && <>
          <div className="nop-field"><label>Quiero registrarme como</label>
            <div className="nop-segwrap">
              <button type="button" className={"nop-seg" + (role === "cliente" ? " on" : "")} onClick={() => setRole("cliente")}>Cliente</button>
              <button type="button" className={"nop-seg" + (role === "booster" ? " on" : "")} onClick={() => setRole("booster")}>Booster</button>
            </div>
            <p className="nop-mini">{role === "booster" ? "El admin tiene que habilitar tu acceso luego del registro." : "Tu pedido lo valida el admin antes de pasar a los boosters."}</p>
          </div>
          <div className="nop-field"><label>Nombre o nick <span className="req">*</span></label>
            <input className="nop-input" value={fullName} onChange={(e) => setName(e.target.value)} placeholder="Ej: Alkioz" /></div>
          <div className="nop-field"><label>Discord</label>
            <input className="nop-input" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="usuario#0000" /></div>
        </>}

        <div className="nop-field"><label>Email <span className="req">*</span></label>
          <input className="nop-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" /></div>
        <div className="nop-field"><label>Contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && submit()} /></div>

        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={busy || !email || !pass} onClick={submit}>
          {busy ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta"}<ArrowRight size={15} />
        </button>
      </div>
      <p style={{ textAlign: "center", color: "var(--mut2)", fontSize: 12, marginTop: 18 }}>Eloboost Nation · Operaciones internas</p>
    </div></div>
  );
}

/* ===================== TABS ===================== */
function Tabs({ role, tab, setTab, orders, profiles }) {
  const T = (id, label, Icon, badge) => (
    <button className={"nop-tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
      <Icon className="ic" size={16} />{label}{badge ? <span style={{ background: "var(--gold)", color: "#1a1305", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{badge}</span> : null}
    </button>
  );
  if (role === "admin") {
    const pend = orders.filter((o) => o.status === "pending").length + profiles.filter((p) => p.role === "booster" && p.status === "pending").length;
    return <div className="nop-tabs">
      {T("validate", "Validaciones", ShieldCheck, pend || null)}
      {T("dash", "Dashboard", Activity)}
      {T("orders", "Pedidos", Hash)}
      {T("boosters", "Boosters", Users)}
      {T("history", "Historial", Trophy)}
    </div>;
  }
  if (role === "booster") {
    const open = orders.filter((o) => o.status === "available").length;
    return <div className="nop-tabs">
      {T("board", "Trabajos disponibles", Zap, open || null)}
      {T("mine", "Mis servicios", Swords)}
      {T("hist", "Mi historial", Trophy)}
    </div>;
  }
  return <div className="nop-tabs">{T("home", "Mi pedido", Activity)}{T("new", "Solicitar servicio", Plus)}</div>;
}

/* ===================== DRAWER ===================== */
function Drawer({ notifs, onClose }) {
  const map = { bell: [Bell, "var(--gold)"], new: [Plus, "var(--cyan)"], done: [Check, "var(--grn)"], spark: [Sparkles, "var(--violet)"], user: [UserCheck, "var(--cyan)"] };
  return <div className="nop-drawer" onClick={onClose}><div className="nop-drawer-bg" />
    <div className="nop-drawer-panel" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 16px", borderBottom: "1px solid var(--line)" }}>
        <div className="nop-panel-h" style={{ margin: 0 }}><Bell size={16} style={{ color: "var(--gold)" }} />Notificaciones</div>
        <button className="nop-iconbtn" onClick={onClose}><X size={16} /></button>
      </div>
      {notifs.length === 0 ? <div className="nop-empty" style={{ padding: "40px 20px" }}><div className="ic"><Bell size={22} /></div><p>Sin novedades.</p></div>
        : notifs.map((n) => { const [Ic, c] = map[n.icon] || map.bell; return (
          <div className="nop-notif" key={n.id}><div className="ic" style={{ background: c + "1f", color: c }}><Ic size={15} /></div>
            <div><div className="tx">{n.text}</div><div className="tm">{timeAgo(n.created_at)}</div></div></div>); })}
    </div></div>;
}

/* ===================== ADMIN ===================== */
function AdminViews({ tab, setTab, ...ctx }) {
  if (tab === "dash") return <AdminDash {...ctx} />;
  if (tab === "orders") return <AdminOrders {...ctx} />;
  if (tab === "boosters") return <AdminBoosters {...ctx} />;
  if (tab === "history") return <AdminHistory {...ctx} />;
  return <AdminValidate {...ctx} />;
}

function AdminValidate({ orders, profiles, reload, flash, notify }) {
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pendingBoosters = profiles.filter((p) => p.role === "booster" && p.status === "pending");

  const validateOrder = async (o) => {
    await supabase.from("orders").update({ status: "available" }).eq("id", o.id);
    await notify(`🆕 Nuevo cliente disponible: ${o.client_name} — ${SERVICES[o.service].label}.`, "booster", null, "new");
    await reload(); flash(`Pedido #${o.id} validado y publicado`);
  };
  const approveBooster = async (p, cut) => {
    await supabase.from("profiles").update({ status: "active", cut }).eq("id", p.id);
    await notify(`Tu cuenta de booster fue aprobada. ¡Ya podés tomar trabajos!`, null, p.id, "done");
    await reload(); flash(`${p.full_name || p.email} habilitado`);
  };

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Validaciones</h1>
      <p className="nop-sub">Confirmá pedidos pagos para publicarlos y habilitá nuevos boosters.</p></div></div>

    <div className="nop-card nop-panel" style={{ marginBottom: 16 }}>
      <div className="nop-panel-h"><UserCheck size={15} style={{ color: "var(--cyan)" }} />Boosters por aprobar ({pendingBoosters.length})</div>
      {pendingBoosters.length === 0 ? <p className="nop-mini">No hay boosters esperando aprobación.</p> :
        <div style={{ display: "grid", gap: 10 }}>{pendingBoosters.map((p) => <BoosterApprove key={p.id} p={p} onApprove={approveBooster} />)}</div>}
    </div>

    <div className="nop-card nop-panel">
      <div className="nop-panel-h"><ShieldCheck size={15} style={{ color: "var(--gold)" }} />Pedidos por validar ({pendingOrders.length})</div>
      {pendingOrders.length === 0 ? <Empty icon={ShieldCheck} title="Todo al día" sub="No hay pedidos esperando validación." /> :
        <div style={{ display: "grid", gap: 12 }}>{pendingOrders.map((o) => (
          <div className="nop-card nop-panel" key={o.id} style={{ background: "var(--bg2)", display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ color: "var(--mut)" }}>#{o.id}</b><SvcTag s={o.service} /><RankPath o={o} />
              <div><b style={{ fontSize: 13 }}>{o.client_name}</b><div className="nop-mini">{o.client_discord} · {o.server} · {o.payment}</div></div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <b className="nop-display" style={{ color: "var(--gold)" }}>{fmtARS(o.price)}</b>
              <button className="nop-btn nop-btn-grn nop-btn-sm" onClick={() => validateOrder(o)}><Check size={14} />Validar y publicar</button>
            </div>
          </div>))}</div>}
    </div>
  </>;
}
function BoosterApprove({ p, onApprove }) {
  const [cut, setCut] = useState(0.55);
  return <div className="nop-card nop-panel" style={{ background: "var(--bg2)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span className="nop-avatar" style={{ background: "var(--cyan)" }}>{(p.full_name || "?")[0]}</span>
      <div><b style={{ fontSize: 13 }}>{p.full_name || "—"}</b><div className="nop-mini">{p.email} · {p.discord || "sin discord"}</div></div>
    </div>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <label className="nop-mini">Corte</label>
      <select className="nop-select" style={{ width: 90, padding: "8px 10px" }} value={cut} onChange={(e) => setCut(parseFloat(e.target.value))}>
        {[0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7].map((c) => <option key={c} value={c}>{Math.round(c * 100)}%</option>)}
      </select>
      <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => onApprove(p, cut)}><Check size={14} />Habilitar</button>
    </div>
  </div>;
}

function AdminDash({ orders, profiles }) {
  const completed = orders.filter((o) => o.status === "completed");
  const active = orders.filter((o) => o.status === "in_progress");
  const pending = orders.filter((o) => o.status === "pending" || o.status === "available");
  const facturacion = completed.reduce((a, o) => a + Number(o.price), 0);
  const ganancia = completed.reduce((a, o) => a + Number(o.profit || 0), 0);
  const ratings = completed.filter((o) => o.survey_rating).map((o) => o.survey_rating);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const byService = Object.keys(SERVICES).map((k) => ({ name: SERVICES[k].label, value: orders.filter((o) => o.service === k).length, color: SERVICES[k].color }));
  const boosters = profiles.filter((p) => p.role === "booster" && p.status === "active");
  const load = boosters.map((b) => ({ ...b, n: active.filter((o) => o.booster_id === b.id).length }));

  const kpi = (lbl, val, Icon, color, sub) => (
    <div className="nop-card nop-kpi"><div className="gl" style={{ background: color }} />
      <div className="lbl"><Icon size={13} style={{ color }} />{lbl}</div>
      <div className="val">{val}</div>{sub && <div className="delta">{sub}</div>}</div>
  );
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Dashboard</h1><p className="nop-sub">Resumen del negocio en tiempo real.</p></div></div>
    <div className="nop-grid-kpi" style={{ marginBottom: 14 }}>
      {kpi("Facturación", fmtARS(facturacion), Wallet, "var(--gold)", `${completed.length} servicios cerrados`)}
      {kpi("Ganancia neta", fmtARS(ganancia), TrendingUp, "var(--grn)", "después de pagar boosters")}
      {kpi("En proceso", active.length, Activity, "var(--cyan)", `${pending.length} en cola`)}
      {kpi("Satisfacción", avg ? avg.toFixed(1) + " ★" : "—", Star, "var(--violet)", `${ratings.length} reseñas`)}
    </div>
    <div className="nop-twocol" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
      <div className="nop-card nop-panel">
        <div className="nop-panel-h"><Activity size={15} style={{ color: "var(--gold)" }} />Carga por booster</div>
        {load.length === 0 ? <p className="nop-mini">Todavía no hay boosters activos.</p> :
          <div className="nop-flowbar">{load.map((b) => {
            const tag = b.n >= 7 ? ["Saturado", "var(--red)"] : b.n >= 3 ? ["Ideal", "var(--grn)"] : b.n >= 1 ? ["Liviano", "var(--cyan)"] : ["Libre", "var(--mut2)"];
            return <div className="nop-flowrow" key={b.id}><span className="nm">{b.full_name || b.email}</span>
              <div className="nop-flowtrack"><div className="nop-flowfill" style={{ width: Math.min(100, b.n * 14 + (b.n ? 12 : 0)) + "%", background: tag[1] }} /></div>
              <span className="nop-flowtag" style={{ color: tag[1] }}>{b.n} · {tag[0]}</span></div>; })}</div>}
        <p className="nop-mini" style={{ marginTop: 14 }}>Libre 0 · Ideal 3–6 · Saturado 7+.</p>
      </div>
      <div className="nop-card nop-panel">
        <div className="nop-panel-h"><Hash size={15} style={{ color: "var(--cyan)" }} />Pedidos por servicio</div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={byService} margin={{ left: -18, right: 8, top: 8 }}>
            <XAxis dataKey="name" tick={{ fill: "#8A95AD", fontSize: 11 }} axisLine={{ stroke: "#26304A" }} tickLine={false} />
            <YAxis tick={{ fill: "#8A95AD", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,.03)" }} contentStyle={{ background: "#1A2238", border: "1px solid #323E5C", borderRadius: 10, color: "#E8ECF6", fontSize: 12 }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>{byService.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </>;
}

function AdminOrders({ orders, reload, flash }) {
  const [f, setF] = useState("todos");
  const [q, setQ] = useState("");
  let list = orders;
  if (f !== "todos") list = list.filter((o) => o.status === f);
  if (q) list = list.filter((o) => (o.client_name + (o.client_discord || "") + o.id).toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Pedidos</h1><p className="nop-sub">Todos los servicios, en cualquier estado.</p></div></div>
    <div className="nop-card nop-panel" style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--mut2)" }} />
        <input className="nop-input" style={{ paddingLeft: 36 }} placeholder="Buscar cliente o #ID" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="nop-pillrow">{["todos", ...STATUS_FLOW].map((s) => (
        <button key={s} className={"nop-btn nop-btn-sm " + (f === s ? "nop-btn-gold" : "nop-btn-ghost")} onClick={() => setF(s)}>{s === "todos" ? "Todos" : STATUS_LABEL[s]}</button>))}</div>
    </div>
    <div className="nop-card nop-panel">
      {list.length === 0 ? <Empty icon={Hash} title="Sin resultados" sub="Probá con otro filtro." />
        : <OrdersTable orders={list} cols={["id", "cliente", "rank", "servicio", "booster", "precio", "pago", "ganancia", "estado"]} />}
    </div>
  </>;
}

function AdminBoosters({ orders, profiles, reload, flash }) {
  const boosters = profiles.filter((p) => p.role === "booster");
  const completed = orders.filter((o) => o.status === "completed");
  const active = orders.filter((o) => o.status === "in_progress");
  const setCut = async (p, cut) => { await supabase.from("profiles").update({ cut }).eq("id", p.id); await reload(); flash(`Corte de ${p.full_name} → ${Math.round(cut * 100)}%`); };
  const setStatus = async (p, status) => { await supabase.from("profiles").update({ status }).eq("id", p.id); await reload(); flash(`${p.full_name}: ${status}`); };
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Boosters</h1><p className="nop-sub">Equipo, cortes, estado y desempeño.</p></div></div>
    <div className="nop-card nop-panel"><div className="nop-tablewrap"><table className="nop-t">
      <thead><tr><th>Booster</th><th>Estado</th><th>Corte</th><th>Activos</th><th>Hechos</th><th>Pagado</th><th>★</th><th>Acción</th></tr></thead>
      <tbody>{boosters.map((b) => {
        const done = completed.filter((o) => o.booster_id === b.id);
        const paid = done.reduce((a, o) => a + Number(o.booster_pay || 0), 0);
        const rs = done.filter((o) => o.survey_rating).map((o) => o.survey_rating);
        const avg = rs.length ? (rs.reduce((a, c) => a + c, 0) / rs.length).toFixed(1) : "—";
        return <tr key={b.id}>
          <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><span className="nop-avatar" style={{ background: "var(--cyan)" }}>{(b.full_name || "?")[0]}</span><div><b>{b.full_name || "—"}</b><div className="nop-mini">{b.email}</div></div></div></td>
          <td><span className={"nop-status s-" + (b.status === "active" ? "completed" : b.status === "pending" ? "pending" : "cancelled")}>{b.status}</span></td>
          <td><select className="nop-select" style={{ width: 84, padding: "6px 8px" }} value={b.cut} onChange={(e) => setCut(b, parseFloat(e.target.value))}>{[0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7].map((c) => <option key={c} value={c}>{Math.round(c * 100)}%</option>)}</select></td>
          <td>{active.filter((o) => o.booster_id === b.id).length}</td>
          <td>{done.length}</td>
          <td style={{ color: "var(--gold)", fontWeight: 600 }}>{fmtARS(paid)}</td>
          <td>{avg !== "—" ? avg + " ★" : "—"}</td>
          <td>{b.status === "active"
            ? <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setStatus(b, "disabled")}>Deshabilitar</button>
            : <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => setStatus(b, "active")}>Habilitar</button>}</td>
        </tr>; })}</tbody>
    </table></div></div>
  </>;
}

function AdminHistory({ orders }) {
  const done = orders.filter((o) => o.status === "completed");
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Historial</h1><p className="nop-sub">Servicios finalizados y reseñas.</p></div></div>
    <div className="nop-card nop-panel">
      {done.length === 0 ? <Empty icon={Trophy} title="Todavía no hay cierres" sub="Aparecen acá cuando un booster finaliza." />
        : <OrdersTable orders={done} cols={["id", "cliente", "rank", "servicio", "booster", "precio", "ganancia", "rating"]} />}
    </div>
  </>;
}

/* ===== tabla compartida ===== */
function OrdersTable({ orders, cols }) {
  const [open, setOpen] = useState(null);
  const head = { id: "#", cliente: "Cliente", rank: "Recorrido", servicio: "Servicio", booster: "Booster", precio: "Precio", pago: "Pago booster", ganancia: "Ganancia", estado: "Estado", rating: "Reseña" };
  return <>
    <div className="nop-tablewrap"><table className="nop-t">
      <thead><tr>{cols.map((c) => <th key={c}>{head[c]}</th>)}</tr></thead>
      <tbody>{orders.map((o) => <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setOpen(o)}>{cols.map((c) => <td key={c}>{cell(c, o)}</td>)}</tr>)}</tbody>
    </table></div>
    {open && <OrderModal o={open} onClose={() => setOpen(null)} />}
  </>;
}
function cell(c, o) {
  switch (c) {
    case "id": return <b style={{ color: "var(--mut)" }}>#{o.id}</b>;
    case "cliente": return <><b>{o.client_name}</b><div className="nop-mini">{o.client_discord}</div></>;
    case "rank": return <RankPath o={o} />;
    case "servicio": return <SvcTag s={o.service} />;
    case "booster": return o.booster_name || <span className="nop-mini">Sin asignar</span>;
    case "precio": return <b>{fmtARS(o.price)}</b>;
    case "pago": return <span style={{ color: "var(--cyan)" }}>{fmtARS(o.booster_pay)}</span>;
    case "ganancia": return <span style={{ color: "var(--grn)" }}>{fmtARS(o.profit)}</span>;
    case "estado": return <StatusBadge s={o.status} />;
    case "rating": return o.survey_rating ? <span style={{ color: "var(--gold)" }}>{"★".repeat(o.survey_rating)}</span> : <span className="nop-mini">—</span>;
    default: return null;
  }
}
function OrderModal({ o, onClose }) {
  const F = ({ k, v }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini" style={{ flexShrink: 0 }}>{k}</span><span style={{ fontSize: 13, textAlign: "right" }}>{v}</span></div>;
  const S = ({ k, v, c }) => <div className="nop-card" style={{ padding: "12px 8px", background: "var(--bg2)" }}><div className="nop-mini">{k}</div><div className="nop-display" style={{ fontSize: 16, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div></div>;
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Pedido #{o.id}</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}><SvcTag s={o.service} /><StatusBadge s={o.status} /></div>
      <F k="Cliente" v={`${o.client_name} · ${o.client_discord || ""}`} />
      <F k="Recorrido" v={<RankPath o={o} />} />
      <F k="Servidor / LP" v={`${o.server} · ${o.lp || "—"}`} />
      {o.role_champ && <F k="Rol / detalle" v={o.role_champ} />}
      {o.notes && <F k="Notas del cliente" v={o.notes} />}
      <F k="Booster" v={o.booster_name || "Sin asignar"} />
      <F k="Medio de pago" v={o.payment} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "14px 0", textAlign: "center" }}>
        <S k="Precio" v={fmtARS(o.price)} c="var(--gold)" /><S k="Pago booster" v={fmtARS(o.booster_pay)} c="var(--cyan)" /><S k="Ganancia" v={fmtARS(o.profit)} c="var(--grn)" />
      </div>
      {o.survey_rating && <div className="nop-card" style={{ padding: 14, background: "var(--bg2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><b style={{ fontSize: 13 }}>Reseña del cliente</b><Stars value={o.survey_rating} /></div>
        <p style={{ fontSize: 13, color: "var(--mut)", fontStyle: "italic" }}>"{o.survey_comment}"</p></div>}
    </div></div></div>;
}

/* ===================== BOOSTER ===================== */
function BoosterViews({ tab, ...ctx }) {
  if (tab === "mine") return <BoosterMine {...ctx} />;
  if (tab === "hist") return <BoosterHist {...ctx} />;
  return <BoosterBoard {...ctx} />;
}
function BoosterBoard({ profile, orders, reload, flash, notify }) {
  const open = orders.filter((o) => o.status === "available");
  const accept = async (o) => {
    const pay = Math.round(Number(o.price) * Number(profile.cut));
    const { data, error } = await supabase.from("orders")
      .update({ status: "in_progress", booster_id: profile.id, booster_name: profile.full_name, booster_pay: pay, profit: Number(o.price) - pay, accepted_at: new Date().toISOString() })
      .eq("id", o.id).eq("status", "available").select();
    if (error) { flash("No se pudo aceptar. Reintentá."); return; }
    if (!data || data.length === 0) { flash("Otro booster lo tomó primero."); await reload(); return; }
    await notify(`${profile.full_name} aceptó el pedido #${o.id} (${o.client_name}).`, "admin", null, "done");
    await notify(`¡Tenés booster! ${profile.full_name} tomó tu servicio. Coordinen por Discord.`, null, o.client_id, "done");
    await reload(); flash(`Aceptaste el pedido #${o.id}`);
  };
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Trabajos disponibles</h1><p className="nop-sub">Clientes validados esperando booster. El primero que acepta se lo queda.</p></div></div>
    {open.length === 0 ? <Empty icon={Zap} title="No hay trabajos abiertos" sub="Apenas el admin valide un cliente nuevo, aparece acá al instante." /> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>{open.map((o) => (
        <div className="nop-card nop-panel" key={o.id} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><SvcTag s={o.service} /><span className="nop-mini">{timeAgo(o.created_at)}</span></div>
          <RankPath o={o} />
          <div className="nop-pillrow"><span className="nop-svc">{o.server}</span>{o.lp && <span className="nop-svc">{o.lp} LP</span>}{o.role_champ && <span className="nop-svc">{o.role_champ}</span>}</div>
          {o.notes && <p className="nop-mini" style={{ fontStyle: "italic" }}>"{o.notes}"</p>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
            <div><div className="nop-mini">Tu pago ({Math.round(profile.cut * 100)}%)</div><div className="nop-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{fmtARS(o.price * profile.cut)}</div></div>
            <button className="nop-btn nop-btn-grn" onClick={() => accept(o)}><Check size={15} />Aceptar</button>
          </div>
        </div>))}</div>}
  </>;
}
function BoosterMine({ profile, orders, reload, flash, notify }) {
  const mine = orders.filter((o) => o.booster_id === profile.id && o.status === "in_progress");
  const finish = async (o) => {
    await supabase.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", o.id);
    await notify(`Servicio #${o.id} finalizado por ${profile.full_name}.`, "admin", null, "done");
    await notify(`Tu servicio #${o.id} fue finalizado. ¡Dejanos tu reseña!`, null, o.client_id, "done");
    await reload(); flash(`Servicio #${o.id} finalizado`);
  };
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Mis servicios</h1><p className="nop-sub">Lo que tenés en curso.</p></div></div>
    {mine.length === 0 ? <Empty icon={Swords} title="No tenés servicios activos" sub="Aceptá un trabajo desde la pestaña de disponibles." /> :
      <div style={{ display: "grid", gap: 14 }}>{mine.map((o) => (
        <div className="nop-card nop-panel" key={o.id}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><b style={{ color: "var(--mut)" }}>#{o.id}</b><SvcTag s={o.service} /><StatusBadge s={o.status} /><RankPath o={o} /></div>
            <div className="nop-display" style={{ fontWeight: 700, color: "var(--gold)" }}>{fmtARS(o.booster_pay)}</div>
          </div>
          <div className="nop-discordbox" style={{ marginBottom: 14 }}>
            <div className="ic"><MessageCircle size={19} /></div>
            <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>Coordiná con {o.client_name} ({o.client_discord})</b><div className="nop-mini">Sala sugerida: <b style={{ color: "var(--tx)" }}>#pedido-{o.id}</b></div></div>
            <a className="nop-btn nop-btn-sm nop-btn-ghost" href={DISCORD_INVITE} target="_blank" rel="noreferrer">Abrir Discord</a>
          </div>
          {o.notes && <p className="nop-mini" style={{ fontStyle: "italic", marginBottom: 14 }}>Nota: "{o.notes}"</p>}
          <button className="nop-btn nop-btn-grn" onClick={() => finish(o)}><Flag size={15} />Marcar finalizado</button>
        </div>))}</div>}
  </>;
}
function BoosterHist({ profile, orders }) {
  const done = orders.filter((o) => o.booster_id === profile.id && o.status === "completed");
  const earned = done.reduce((a, o) => a + Number(o.booster_pay || 0), 0);
  const rs = done.filter((o) => o.survey_rating).map((o) => o.survey_rating);
  const avg = rs.length ? (rs.reduce((a, c) => a + c, 0) / rs.length).toFixed(1) : "—";
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Mi historial</h1><p className="nop-sub">Completados y ganancias.</p></div></div>
    <div className="nop-grid-kpi" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 14 }}>
      <div className="nop-card nop-kpi"><div className="lbl"><Trophy size={13} style={{ color: "var(--gold)" }} />Completados</div><div className="val">{done.length}</div></div>
      <div className="nop-card nop-kpi"><div className="lbl"><Wallet size={13} style={{ color: "var(--grn)" }} />Ganado total</div><div className="val">{fmtARS(earned)}</div></div>
      <div className="nop-card nop-kpi"><div className="lbl"><Star size={13} style={{ color: "var(--violet)" }} />Reseña prom.</div><div className="val">{avg !== "—" ? avg + " ★" : "—"}</div></div>
    </div>
    <div className="nop-card nop-panel">
      {done.length === 0 ? <Empty icon={Trophy} title="Aún sin cierres" sub="Tus servicios finalizados se listan acá." />
        : <OrdersTable orders={done} cols={["id", "cliente", "rank", "servicio", "pago", "rating"]} />}
    </div>
  </>;
}

/* ===================== CLIENTE ===================== */
function ClientViews({ tab, setTab, ...ctx }) {
  if (tab === "new") return <ClientNew {...ctx} setTab={setTab} />;
  return <ClientHome {...ctx} setTab={setTab} />;
}
function ClientHome({ profile, orders, reload, flash, notify, setTab }) {
  const mine = orders.filter((o) => o.client_id === profile.id);
  if (mine.length === 0) return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Hola, {profile.full_name} 👋</h1><p className="nop-sub">Todavía no tenés pedidos.</p></div></div>
    <div className="nop-card"><Empty icon={Trophy} title="Sin pedidos activos" sub="Cargá tu primer servicio y, una vez validado, un booster lo toma." />
      <div style={{ textAlign: "center", paddingBottom: 28 }}><button className="nop-btn nop-btn-gold" onClick={() => setTab("new")}><Plus size={15} />Solicitar un servicio</button></div></div>
  </>;
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Mis pedidos</h1><p className="nop-sub">Seguí el estado en vivo.</p></div></div>
    <div style={{ display: "grid", gap: 16 }}>{mine.map((o) => <ClientOrderCard key={o.id} o={o} reload={reload} flash={flash} notify={notify} />)}</div>
  </>;
}
function ClientOrderCard({ o, reload, flash, notify }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [rec, setRec] = useState(true);
  const stepIdx = STATUS_FLOW.indexOf(o.status);
  const submit = async () => {
    await supabase.from("orders").update({ survey_rating: rating, survey_comment: comment || "¡Todo excelente!", survey_recommend: rec }).eq("id", o.id);
    await notify(`${o.client_name} dejó una reseña de ${rating}★ en el pedido #${o.id}.`, "admin", null, "spark");
    await reload(); flash("¡Gracias por tu reseña!");
  };
  return <div className="nop-card nop-panel">
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center", flexWrap: "wrap" }}><b style={{ color: "var(--mut)" }}>#{o.id}</b><SvcTag s={o.service} /><RankPath o={o} /></div>
      <StatusBadge s={o.status} />
    </div>
    <div className="nop-timeline">{[["Solicitado", Plus], ["Validado", ShieldCheck], ["En proceso", Play], ["Finalizado", Flag]].map(([lab, Ic], i) => (
      <div key={lab} className={"nop-step " + (i < stepIdx ? "done" : i === stepIdx ? "active" : "")}><div className="ring"><Ic size={15} /></div><div className="lab">{lab}</div></div>))}</div>
    <div style={{ marginTop: 18 }}>
      {o.status === "pending" && <p className="nop-mini" style={{ textAlign: "center" }}>Estamos validando tu pago. Apenas confirmemos, tu pedido pasa a los boosters.</p>}
      {o.status === "available" && <p className="nop-mini" style={{ textAlign: "center" }}>¡Validado! Buscando booster… avisamos a todo el equipo.</p>}
      {o.status === "in_progress" && <div className="nop-discordbox">
        <div className="ic"><MessageCircle size={19} /></div>
        <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>Tu booster es {o.booster_name}</b><div className="nop-mini">Entrá al Discord y buscá <b style={{ color: "var(--tx)" }}>#pedido-{o.id}</b>.</div></div>
        <a className="nop-btn nop-btn-sm nop-btn-ghost" href={DISCORD_INVITE} target="_blank" rel="noreferrer">Abrir Discord</a></div>}
      {o.status === "completed" && !o.survey_rating && <div className="nop-card" style={{ padding: 18, background: "var(--bg2)" }}>
        <div className="nop-panel-h" style={{ marginBottom: 12 }}><Star size={15} style={{ color: "var(--gold)" }} />¿Cómo estuvo tu experiencia con {o.booster_name}?</div>
        <Stars value={rating} onChange={setRating} />
        <textarea className="nop-ta" style={{ marginTop: 12 }} placeholder="Contanos cómo fue (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <label style={{ display: "flex", gap: 9, alignItems: "center", margin: "12px 0", fontSize: 13, color: "var(--mut)", cursor: "pointer" }}>
          <input type="checkbox" checked={rec} onChange={(e) => setRec(e.target.checked)} /> Recomendaría el servicio</label>
        <button className="nop-btn nop-btn-gold" onClick={submit}><Check size={15} />Enviar reseña</button></div>}
      {o.status === "completed" && o.survey_rating && <div style={{ textAlign: "center", color: "var(--grn)", fontWeight: 600, fontSize: 14 }}>
        <Check size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Servicio completado · reseña enviada ({"★".repeat(o.survey_rating)})</div>}
    </div>
  </div>;
}
function ClientNew({ profile, reload, flash, notify, setTab }) {
  const [service, setService] = useState("duoboost");
  const [cur, setCur] = useState("Oro"), [curD, setCurD] = useState("IV");
  const [tgt, setTgt] = useState("Platino"), [tgtD, setTgtD] = useState("IV");
  const [server, setServer] = useState("LAS"), [lp, setLp] = useState("+20"), [games, setGames] = useState(3);
  const [roleChamp, setRoleChamp] = useState(""), [notes, setNotes] = useState("");
  const [payment, setPayment] = useState("Transferencia (pesos)");
  const [busy, setBusy] = useState(false);
  const isCoaching = service === "coaching";
  const price = useMemo(() => isCoaching ? COACHING_PRICE[games] : estimateDuo(cur, curD, tgt, tgtD, service === "combo"), [service, cur, curD, tgt, tgtD, games, isCoaching]);

  const submit = async () => {
    setBusy(true);
    const row = {
      client_id: profile.id, client_name: profile.full_name, client_discord: profile.discord || profile.email,
      service, cur_rank: cur, cur_div: curD,
      tgt_rank: isCoaching ? cur : tgt, tgt_div: isCoaching ? curD : tgtD,
      server, lp: isCoaching ? null : lp, games: isCoaching ? games : null,
      role_champ: isCoaching ? `${roleChamp || "Sin preferencia"} · ${games} partida${games > 1 ? "s" : ""}` : roleChamp,
      notes, payment, price, status: "pending",
    };
    const { error } = await supabase.from("orders").insert(row);
    setBusy(false);
    if (error) { flash("No se pudo crear el pedido."); return; }
    await notify(`Nuevo pedido de ${profile.full_name} entró por validar.`, "admin", null, "new");
    await reload(); flash("¡Pedido enviado! Lo validamos y pasa a los boosters."); setTab("home");
  };
  const SvcIc = ({ k }) => { const Ic = SERVICES[k].icon; return <Ic size={19} />; };

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Solicitar servicio</h1><p className="nop-sub">Jugás en tu propia cuenta — no pedimos usuario ni contraseña. 0% riesgo.</p></div></div>
    <div className="nop-card nop-panel" style={{ maxWidth: 720 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 10 }}>1 · Elegí el servicio</label>
      <div className="nop-svcpick">{Object.keys(SERVICES).map((k) => (
        <button key={k} type="button" className={"nop-svccard" + (service === k ? " on" : "")} onClick={() => setService(k)}>
          <div className="ic" style={{ background: SERVICES[k].color + "1f", color: SERVICES[k].color }}><SvcIc k={k} /></div>
          <h4>{SERVICES[k].label}</h4><p>{SERVICES[k].desc}</p></button>))}</div>

      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "6px 0 12px" }}>2 · {isCoaching ? "Tu nivel y cuántas partidas" : "Liga actual y objetivo"}</label>
      {!isCoaching ? <div className="nop-row2" style={{ marginBottom: 4 }}>
        <div className="nop-field" style={{ marginBottom: 8 }}><label>Liga actual <span className="req">*</span></label><div className="nop-row2">
          <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
          <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)} disabled={cur === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
        <div className="nop-field" style={{ marginBottom: 8 }}><label>Liga objetivo <span className="req">*</span></label><div className="nop-row2">
          <select className="nop-select" value={tgt} onChange={(e) => setTgt(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
          <select className="nop-select" value={tgtD} onChange={(e) => setTgtD(e.target.value)} disabled={tgt === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
      </div> : <div className="nop-row2">
        <div className="nop-field"><label>Tu liga actual</label><div className="nop-row2">
          <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
          <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)} disabled={cur === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
        <div className="nop-field"><label>Cantidad de partidas</label>
          <select className="nop-select" value={games} onChange={(e) => setGames(parseInt(e.target.value))}><option value={1}>1 partida</option><option value={3}>3 partidas</option><option value={5}>5 partidas</option></select></div>
      </div>}

      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "10px 0 12px" }}>3 · Detalles</label>
      <div className="nop-row3">
        <div className="nop-field"><label>Servidor <span className="req">*</span></label><select className="nop-select" value={server} onChange={(e) => setServer(e.target.value)}><option>LAS</option><option>LAN</option><option>BR</option></select></div>
        {!isCoaching && <div className="nop-field"><label>Ganancia LP aprox</label><select className="nop-select" value={lp} onChange={(e) => setLp(e.target.value)}><option>+15</option><option>+20</option><option>+25</option></select></div>}
        <div className="nop-field"><label>Medio de pago <span className="req">*</span></label><select className="nop-select" value={payment} onChange={(e) => setPayment(e.target.value)}><option>Transferencia (pesos)</option><option>PayPal (usd)</option><option>Mercado Pago</option></select></div>
      </div>
      <div className="nop-field"><label>Rol / campeón preferido</label><input className="nop-input" value={roleChamp} onChange={(e) => setRoleChamp(e.target.value)} placeholder="Ej: ADC, Mid Katarina, Flash en D" /></div>
      <div className="nop-field"><label>Notas para el booster</label><textarea className="nop-ta" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Horarios, preferencias, lo que quieras aclarar…" /></div>

      <div className="nop-card" style={{ padding: 16, background: "var(--bg2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div><div className="nop-mini">Precio estimado {service === "combo" && "(incluye coaching en vivo +50%)"}</div>
          <div className="nop-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>{fmtARS(price)}</div>
          <div className="nop-mini">Lo confirma el equipo según tu MMR. El pago se gestiona aparte.</div></div>
        <button className="nop-btn nop-btn-gold" disabled={busy} onClick={submit}><Plus size={15} />{busy ? "Enviando…" : "Enviar pedido"}</button>
      </div>
    </div>
  </>;
}
