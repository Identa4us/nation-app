import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Shield, Swords, GraduationCap, Sparkles, Bell, LogOut, Plus, Check, Clock, Play,
  Flag, Star, Users, TrendingUp, Wallet, Activity, ChevronRight, Trophy, MessageCircle,
  Search, X, ArrowRight, Crown, Zap, Hash, UserCheck, ShieldCheck, Trash2, Send,
  LifeBuoy, Copy, Eye, EyeOff, Upload, FileText, Gamepad2, Plus as PlusIc, Power, Headset, Phone, CalendarDays,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "./supabaseClient";

/* ===================== dominio ===================== */
const RANKS = ["Hierro", "Bronce", "Plata", "Oro", "Platino", "Esmeralda", "Diamante", "Master"];
const DIVS = ["IV", "III", "II", "I"];
const RANK_COLOR = { Hierro: "#7B8497", Bronce: "#B07B3E", Plata: "#A8B3C7", Oro: "#E8B349", Platino: "#2DD4BF", Esmeralda: "#10B981", Diamante: "#38BDF8", Master: "#A855F7" };
const SERVICES = {
  duoboost: { label: "DuoBoost", icon: Swords, color: "#38BDF8", desc: "Subís en dúo con un booster Grandmaster+. Jugás en tu cuenta, 0% riesgo de baneo." },
  coaching: { label: "Coaching", icon: GraduationCap, color: "#A855F7", desc: "Sesiones 1 a 1 con high elo: VOD review, pool de campeones, wave y macro." },
  combo: { label: "DuoBoost + Coaching", icon: Sparkles, color: "#E8B349", desc: "Subís de elo mientras el booster te hace coaching en vivo por Discord." },
  eloboost: { label: "Eloboost", icon: Shield, color: "#F87171", desc: "Un booster sube tu cuenta por vos en modo offline. Máximo 2 ligas por solicitud, por seguridad." },
};
const DISCORD_INVITE = "https://discord.gg/Fxghn7S5";
const STATUS_FLOW = ["pending", "available", "in_progress", "completed"];
const STATUS_LABEL = { pending: "En revisión", available: "Disponible", in_progress: "En proceso", completed: "Finalizado", cancelled: "Cancelado" };

const SUPPORT_WA = "https://api.whatsapp.com/send?phone=542214287466&text=Hola!%20Necesito%20ayuda%20con%20Eloboost%20Nation";
const PAY_ALIAS = "boost.nation.arq";
const PAY_NAME = "$felipemoneti";
const PAYPAL_URL = "https://www.paypal.com/paypalme/eloboostlolgg";
const ACC_STATUS_LABEL = { activa: "Disponible", inactiva: "En uso", deshabilitada: "Deshabilitada" };
const PREF_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const PREF_TIMES = ["Mañana", "Tarde", "Noche"];

const TIER_DIV_COST = { Hierro: 3000, Bronce: 4500, Plata: 6000, Oro: 9000, Platino: 12600, Esmeralda: 17100, Diamante: 22500 };
const LANES = ["Top", "Jungla", "Mid", "ADC", "Support"];
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
function svcDuration(o) {
  const start = o.accepted_at || o.created_at;
  const end = o.completed_at;
  if (!start || !end) return "—";
  const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000));
  return days === 1 ? "1 día" : `${days} días`;
}
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
function RankBadge({ r, d }) {
  if (!r) return <span className="nop-mini">—</span>;
  return <span className="nop-rankpill" style={{ color: RANK_COLOR[r], borderColor: RANK_COLOR[r] + "55", background: RANK_COLOR[r] + "14" }}>{r}{r !== "Master" ? " " + d : ""}</span>;
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
  const [accounts, setAccounts] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [focusOrder, setFocusOrder] = useState(null);
  const [lastSeen, setLastSeen] = useState(0);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const reloadRef = useRef(() => {});

  /* sesión */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* perfil */
  useEffect(() => {
    if (!session) { setProfile(null); setBooting(false); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data);
      setBooting(false);
      if (data) {
        try { setLastSeen(Number(localStorage.getItem("nop_lastseen_" + data.id)) || 0); } catch (e) {}
        setTab(data.role === "admin" ? "validate" : data.role === "booster" ? "board" : "home");
      }
    })();
  }, [session]);

  /* carga de datos según rol */
  const reload = useCallback(async () => {
    if (!profile) return;
    const { data: ord } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(ord || []);
    const { data: nt } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(40);
    setNotifs(nt || []);
    if (profile.role === "admin" || profile.role === "booster") {
      const { data: acc } = await supabase.from("game_accounts").select("*").order("created_at", { ascending: false });
      setAccounts(acc || []);
    }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "game_accounts" }, () => reloadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile]);

  const notify = async (text, recipient_role = null, recipient_id = null, icon = "bell", link_type = null, link_id = null) => {
    await supabase.from("notifications").insert({ text, recipient_role, recipient_id, icon, link_type, link_id: link_id != null ? String(link_id) : null });
  };

  const deleteOrder = async (o) => {
    if (!window.confirm(`¿Eliminar el pedido #${o.id} de ${o.client_name}? Esta acción no se puede deshacer.`)) return;
    const { data, error } = await supabase.from("orders").delete().eq("id", o.id).select();
    if (error) { flash("No se pudo eliminar: " + error.message); return; }
    if (!data || data.length === 0) { flash("No se pudo eliminar: falta el permiso. Corré el SQL de borrado en Supabase."); return; }
    setFocusOrder(null);
    await reload(); flash(`Pedido #${o.id} eliminado`);
  };

  const logout = async () => { await supabase.auth.signOut(); setProfile(null); setOrders([]); setNotifs([]); setProfiles([]); setTab(""); };

  if (booting) return <Splash />;
  if (recovery) return <SetNewPassword onDone={() => setRecovery(false)} />;
  if (!session || !profile) return <Auth />;

  // booster pendiente de aprobación
  if (profile.role === "booster" && profile.status !== "active") {
    return <Gate logout={logout} title="Cuenta pendiente de aprobación"
      sub="Tu cuenta de booster fue creada. Un administrador tiene que habilitarte antes de que puedas ver los trabajos. Te avisamos apenas estés activo." />;
  }
  if (profile.status === "disabled") return <Gate logout={logout} title="Cuenta deshabilitada" sub="Tu acceso fue suspendido. Contactá al administrador." />;

  const seenKey = "nop_lastseen_" + profile.id;
  const markSeen = () => {
    const t = Date.now();
    setLastSeen(t);
    try { localStorage.setItem(seenKey, String(t)); } catch (e) {}
  };
  const unread = notifs.filter((n) => new Date(n.created_at).getTime() > lastSeen).length;

  const openDrawer = () => { setDrawer(true); };
  const closeDrawer = () => { setDrawer(false); markSeen(); };

  const handleNotif = (n) => {
    setDrawer(false); markSeen();
    if (n.link_type === "order" && n.link_id) {
      const ord = orders.find((o) => String(o.id) === String(n.link_id));
      if (profile.role === "admin") { setTab(ord && ord.status === "pending" ? "validate" : "orders"); if (ord) setFocusOrder(ord); }
      else if (profile.role === "booster") { setTab(ord && ord.status === "available" ? "board" : "mine"); }
      else { setTab("home"); }
    } else if (n.link_type === "validate") {
      if (profile.role === "admin") setTab("validate");
    } else if (n.link_type === "client" && n.link_id) {
      if (profile.role === "admin") setTab("users");
    }
  };

  const ctx = { profile, orders, profiles, accounts, reload, flash, notify, deleteOrder };
  const avatarColor = profile.role === "admin" ? "var(--gold)" : profile.role === "booster" ? "var(--cyan)" : "var(--violet)";

  return (
    <>
      <div className="nop-topbar"><div className="nop-shell">
        <div className="nop-topbar-in">
          <div className="nop-logo"><div className="nop-logo-mark"><Crown size={19} /></div><div><b>NATION</b><span>OPS PANEL</span></div></div>
          <div className="nop-spacer" />
          <span className="nop-roletag">{profile.role === "admin" ? "Admin" : profile.role === "booster" ? "Booster" : "Cliente"}</span>
          <a className="nop-iconbtn" href={SUPPORT_WA} target="_blank" rel="noreferrer" title="Soporte por WhatsApp" style={{ color: "#25D366" }}><Headset size={17} /></a>
          <button className="nop-iconbtn" onClick={openDrawer}><Bell size={17} />{unread > 0 && <span className="nop-dot">{unread > 9 ? "9+" : unread}</span>}</button>
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

      {drawer && <Drawer notifs={notifs} lastSeen={lastSeen} onClose={closeDrawer} onClick={handleNotif} onMarkAll={markSeen} />}
      {focusOrder && <OrderModal o={focusOrder} onClose={() => setFocusOrder(null)} onDelete={profile.role === "admin" ? deleteOrder : null} />}
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
  const [mode, setMode] = useState("login"); // login | signup | recover
  const [role, setRole] = useState("cliente");
  const [fullName, setName] = useState("");
  const [discord, setDiscord] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const clear = () => { setErr(""); setOk(""); };

  const submit = async () => {
    clear(); setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      } else if (mode === "signup") {
        if (!fullName) throw new Error("Ingresá tu nombre.");
        if (!phone) throw new Error("Ingresá tu teléfono.");
        const { data, error } = await supabase.auth.signUp({
          email, password: pass,
          options: { data: { full_name: fullName, role, discord, phone } },
        });
        if (error) throw error;
        if (role === "booster") {
          // aviso al admin (best-effort: requiere sesión activa, i.e. confirmación de email desactivada)
          try { await supabase.from("notifications").insert({ text: `Nuevo booster registrado: ${fullName}. Aprobalo o rechazalo en Validaciones.`, recipient_role: "admin", icon: "user", link_type: "validate" }); } catch (e) {}
        }
        if (!data.session) { setOk("Cuenta creada. Ya podés iniciar sesión."); setMode("login"); }
        else if (role === "booster") setOk("Cuenta creada. Un administrador tiene que aprobarte antes de tomar trabajos.");
      } else if (mode === "recover") {
        if (!email) throw new Error("Ingresá tu email.");
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setOk("Si ese email tiene cuenta, te enviamos un enlace para restablecer la contraseña. Revisá tu casilla (y spam).");
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

  const title = mode === "login" ? "Ingresá con tu cuenta." : mode === "signup" ? "Creá tu cuenta de cliente." : "Recuperá tu contraseña.";

  return (
    <div className="nop-auth"><div className="nop-authbox">
      <div className="nop-authhead">
        <div className="badge">Eloboost Nation</div>
        <h1 className="nop-display">Panel de Operaciones</h1>
        <p>{title}</p>
      </div>
      <div className="nop-card" style={{ padding: 24 }}>
        {mode !== "recover" && <div className="nop-authtabs">
          <button className={"nop-authtab" + (mode === "login" ? " on" : "")} onClick={() => { setMode("login"); clear(); }}>Iniciar sesión</button>
          <button className={"nop-authtab" + (mode === "signup" ? " on" : "")} onClick={() => { setMode("signup"); clear(); }}>Crear cuenta</button>
        </div>}
        {err && <div className="nop-err">{err}</div>}
        {ok && <div className="nop-ok">{ok}</div>}

        {mode === "signup" && <>
          <div className="nop-field"><label>Quiero registrarme como</label>
            <div className="nop-segwrap">
              <button type="button" className={"nop-seg" + (role === "cliente" ? " on" : "")} onClick={() => setRole("cliente")}>Cliente</button>
              <button type="button" className={"nop-seg" + (role === "booster" ? " on" : "")} onClick={() => setRole("booster")}>Booster</button>
            </div>
            <p className="nop-mini">{role === "booster" ? "Tu cuenta queda pendiente: un admin te acepta o rechaza." : "Tu pedido lo valida el admin antes de pasar a los boosters."}</p>
          </div>
          <div className="nop-field"><label>Nombre o nick <span className="req">*</span></label>
            <input className="nop-input" value={fullName} onChange={(e) => setName(e.target.value)} placeholder="Ej: Alkioz" /></div>
          <div className="nop-row2">
            <div className="nop-field"><label>Teléfono <span className="req">*</span></label>
              <input className="nop-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: +54 9 221 428 7466" /></div>
            <div className="nop-field"><label>Discord</label>
              <input className="nop-input" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="usuario#0000" /></div>
          </div>
        </>}

        <div className="nop-field"><label>Email <span className="req">*</span></label>
          <input className="nop-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
            onKeyDown={(e) => e.key === "Enter" && mode === "recover" && submit()} /></div>

        {mode !== "recover" && <div className="nop-field"><label>Contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && submit()} /></div>}

        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={busy || !email || (mode !== "recover" && !pass)} onClick={submit}>
          {busy ? "Procesando…" : mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}<ArrowRight size={15} />
        </button>

        {mode === "login" && <button className="nop-linkbtn" onClick={() => { setMode("recover"); clear(); }}>¿Olvidaste tu contraseña?</button>}
        {mode === "recover" && <button className="nop-linkbtn" onClick={() => { setMode("login"); clear(); }}>← Volver a iniciar sesión</button>}
      </div>
      <p style={{ textAlign: "center", color: "var(--mut2)", fontSize: 12, marginTop: 18 }}>Eloboost Nation · Operaciones internas</p>
    </div></div>
  );
}

/* pantalla para fijar nueva contraseña tras el enlace de recuperación */
function SetNewPassword({ onDone }) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr("");
    if (pass.length < 6) { setErr("Mínimo 6 caracteres."); return; }
    if (pass !== pass2) { setErr("Las contraseñas no coinciden."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  };
  return (
    <div className="nop-auth"><div className="nop-authbox">
      <div className="nop-authhead">
        <div className="badge">Eloboost Nation</div>
        <h1 className="nop-display">Nueva contraseña</h1>
        <p>Elegí una contraseña nueva para tu cuenta.</p>
      </div>
      <div className="nop-card" style={{ padding: 24 }}>
        {err && <div className="nop-err">{err}</div>}
        <div className="nop-field"><label>Nueva contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" /></div>
        <div className="nop-field"><label>Repetir contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && save()} /></div>
        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={busy} onClick={save}>
          {busy ? "Guardando…" : "Guardar contraseña"}<Check size={15} />
        </button>
      </div>
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
      {T("users", "Usuarios", Users)}
      {T("accounts", "Cuentas", Gamepad2)}
    </div>;
  }
  if (role === "booster") {
    const open = orders.filter((o) => o.status === "available").length;
    return <div className="nop-tabs">
      {T("board", "Trabajos disponibles", Zap, open || null)}
      {T("mine", "Mis servicios", Swords)}
      {T("accounts", "Cuentas", Gamepad2)}
      {T("hist", "Mi historial", Trophy)}
    </div>;
  }
  return <div className="nop-tabs">{T("home", "Mi pedido", Activity)}{T("new", "Solicitar servicio", Plus)}{T("hist", "Historial", Trophy)}</div>;
}

/* ===================== DRAWER ===================== */
function Drawer({ notifs, lastSeen, onClose, onClick, onMarkAll }) {
  const map = { bell: [Bell, "var(--gold)"], new: [Plus, "var(--cyan)"], done: [Check, "var(--grn)"], spark: [Sparkles, "var(--violet)"], user: [UserCheck, "var(--cyan)"] };
  const hasUnread = notifs.some((n) => new Date(n.created_at).getTime() > lastSeen);
  return <div className="nop-drawer" onClick={onClose}><div className="nop-drawer-bg" />
    <div className="nop-drawer-panel" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 16px", borderBottom: "1px solid var(--line)" }}>
        <div className="nop-panel-h" style={{ margin: 0 }}><Bell size={16} style={{ color: "var(--gold)" }} />Notificaciones</div>
        <div style={{ display: "flex", gap: 8 }}>
          {hasUnread && <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={onMarkAll}><Check size={13} />Marcar leídas</button>}
          <button className="nop-iconbtn" onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      {notifs.length === 0 ? <div className="nop-empty" style={{ padding: "40px 20px" }}><div className="ic"><Bell size={22} /></div><p>Sin novedades.</p></div>
        : notifs.map((n) => { const [Ic, c] = map[n.icon] || map.bell; const isNew = new Date(n.created_at).getTime() > lastSeen; const clickable = !!n.link_type;
          return (
            <div className={"nop-notif" + (clickable ? " nop-notif-click" : "")} key={n.id}
              onClick={clickable ? () => onClick(n) : undefined} style={{ background: isNew ? "rgba(232,179,73,.05)" : undefined }}>
              <div className="ic" style={{ background: c + "1f", color: c }}><Ic size={15} /></div>
              <div style={{ flex: 1 }}><div className="tx">{n.text}</div>
                <div className="tm">{timeAgo(n.created_at)}{clickable ? " · tocá para ver" : ""}</div></div>
              {isNew && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--gold)", alignSelf: "center", flexShrink: 0 }} />}
            </div>); })}
    </div></div>;
}

/* ===================== ADMIN ===================== */
function AdminViews({ tab, setTab, ...ctx }) {
  if (tab === "dash") return <AdminDash {...ctx} />;
  if (tab === "orders") return <AdminOrders {...ctx} />;
  if (tab === "users") return <AdminUsers {...ctx} />;
  if (tab === "accounts") return <AdminAccounts {...ctx} />;
  return <AdminValidate {...ctx} />;
}
function AdminUsers({ ...ctx }) {
  const [view, setView] = useState("clientes");
  return <>
    <div className="nop-segwrap" style={{ maxWidth: 360, marginBottom: 18 }}>
      <button type="button" className={"nop-seg" + (view === "clientes" ? " on" : "")} onClick={() => setView("clientes")}>Clientes</button>
      <button type="button" className={"nop-seg" + (view === "boosters" ? " on" : "")} onClick={() => setView("boosters")}>Boosters</button>
    </div>
    {view === "clientes" ? <AdminClients {...ctx} /> : <AdminBoosters {...ctx} />}
  </>;
}

function AdminValidate({ orders, profiles, reload, flash, notify }) {
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pendingBoosters = profiles.filter((p) => p.role === "booster" && p.status === "pending");

  const validateOrder = async (o) => {
    await supabase.from("orders").update({ status: "available" }).eq("id", o.id);
    await notify(`🆕 Nuevo cliente disponible: ${o.client_name} — ${SERVICES[o.service].label}.`, "booster", null, "new", "order", o.id);
    await reload(); flash(`Pedido #${o.id} validado y publicado`);
  };
  const rankText = (o) => {
    const f = `${o.cur_rank}${o.cur_rank !== "Master" ? " " + o.cur_div : ""}`;
    if (o.service === "coaching") return f;
    return `${f} → ${o.tgt_rank}${o.tgt_rank !== "Master" ? " " + o.tgt_div : ""}`;
  };
  const waMessage = (o) => {
    const link = window.location.origin;
    const cuts = profiles.filter((p) => p.role === "booster" && p.status === "active").map((p) => Number(p.cut));
    const baseCut = cuts.length ? Math.min(...cuts) : 0.5;
    const pay = Math.round(Number(o.price) * baseCut);
    return [
      "🔔 *NUEVA CUENTA DISPONIBLE* — Eloboost Nation", "",
      `🎮 *Servicio:* ${SERVICES[o.service].label}`,
      `📈 *Rango:* ${rankText(o)}`,
      `🌎 *Servidor:* ${o.server || "-"}`,
      `💰 *Pago:* desde ${fmtARS(pay)}`, "",
      "👉 Entrá a la app y tomalo antes que otro:", link,
    ].join("\n");
  };
  const shareWhatsApp = (o) => {
    window.open("https://wa.me/?text=" + encodeURIComponent(waMessage(o)), "_blank");
  };
  const validateAndShare = (o) => {
    shareWhatsApp(o);   // se abre primero (dentro del click) para que el navegador no lo bloquee
    validateOrder(o);
  };
  const viewReceipt = async (o) => {
    if (!o.receipt_path) { flash("Este pedido no tiene comprobante."); return; }
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(o.receipt_path, 3600);
    if (error || !data) { flash("No se pudo abrir el comprobante."); return; }
    window.open(data.signedUrl, "_blank");
  };
  const acceptBooster = async (p, cut) => {
    await supabase.from("profiles").update({ status: "active", cut }).eq("id", p.id);
    await notify(`Tu cuenta de booster fue aprobada. ¡Ya podés tomar trabajos!`, null, p.id, "done");
    await reload(); flash(`${p.full_name || p.email} aceptado`);
  };
  const rejectBooster = async (p) => {
    await supabase.from("profiles").update({ status: "disabled" }).eq("id", p.id);
    await reload(); flash(`${p.full_name || p.email} rechazado`);
  };

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Validaciones</h1>
      <p className="nop-sub">Aceptá o rechazá boosters nuevos y validá los pedidos pagos.</p></div></div>

    <div className="nop-card nop-panel" style={{ marginBottom: 16 }}>
      <div className="nop-panel-h"><UserCheck size={15} style={{ color: "var(--cyan)" }} />Boosters por aprobar ({pendingBoosters.length})</div>
      {pendingBoosters.length === 0 ? <p className="nop-mini">No hay boosters esperando aprobación.</p> :
        <div style={{ display: "grid", gap: 10 }}>{pendingBoosters.map((p) => <BoosterApprove key={p.id} p={p} onAccept={acceptBooster} onReject={rejectBooster} />)}</div>}
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <b className="nop-display" style={{ color: "var(--gold)" }}>{fmtARS(o.price)}</b>
              <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => viewReceipt(o)} disabled={!o.receipt_path}><FileText size={14} />{o.receipt_path ? "Ver comprobante" : "Sin comprobante"}</button>
              <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => validateOrder(o)}><Check size={14} />Validar</button>
              <button className="nop-btn nop-btn-wa nop-btn-sm" onClick={() => validateAndShare(o)}><Send size={14} />Validar y avisar</button>
            </div>
          </div>))}</div>}
    </div>
  </>;
}
function BoosterApprove({ p, onAccept, onReject }) {
  const [cut, setCut] = useState(0.5);
  return <div className="nop-card nop-panel" style={{ background: "var(--bg2)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span className="nop-avatar" style={{ background: "var(--cyan)" }}>{(p.full_name || "?")[0]}</span>
      <div><b style={{ fontSize: 13 }}>{p.full_name || "—"}</b><div className="nop-mini">{p.email} · {p.discord || "sin discord"}</div></div>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <label className="nop-mini">Corte</label>
      <select className="nop-select" style={{ width: 84, padding: "8px 10px" }} value={cut} onChange={(e) => setCut(parseFloat(e.target.value))}>
        {[0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7].map((c) => <option key={c} value={c}>{Math.round(c * 100)}%</option>)}
      </select>
      <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => onAccept(p, cut)}><Check size={14} />Aceptar</button>
      <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => onReject(p)}><X size={14} />Rechazar</button>
    </div>
  </div>;
}
function AdminClients({ profiles, orders }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  let clients = profiles.filter((p) => p.role === "cliente");
  if (q) clients = clients.filter((p) => ((p.full_name || "") + (p.email || "")).toLowerCase().includes(q.toLowerCase()));
  const statsOf = (id) => {
    const mine = orders.filter((o) => o.client_id === id);
    return {
      activos: mine.filter((o) => o.status === "in_progress").length,
      espera: mine.filter((o) => o.status === "pending" || o.status === "available").length,
      completados: mine.filter((o) => o.status === "completed").length,
      total: mine.length,
      gasto: mine.filter((o) => o.status === "completed").reduce((a, o) => a + Number(o.price), 0),
    };
  };
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Clientes</h1>
      <p className="nop-sub">Usuarios registrados y su actividad. Tocá una fila para ver el detalle.</p></div></div>
    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div style={{ position: "relative", maxWidth: 320 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--mut2)" }} />
        <input className="nop-input" style={{ paddingLeft: 36 }} placeholder="Buscar por nombre o email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
    </div>
    <div className="nop-card nop-panel">
      {clients.length === 0 ? <Empty icon={Users} title="Sin clientes todavía" sub="Cuando alguien se registre como cliente, aparece acá." /> :
        <div className="nop-tablewrap"><table className="nop-t">
          <thead><tr><th>Cliente</th><th>Email</th><th>Teléfono</th><th>Discord</th><th>Activos</th><th>En espera</th><th>Completados</th><th>Gastado</th></tr></thead>
          <tbody>{clients.map((c) => { const s = statsOf(c.id); return (
            <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setOpen({ c, s, orders: orders.filter((o) => o.client_id === c.id) })}>
              <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><span className="nop-avatar" style={{ background: "var(--violet)" }}>{(c.full_name || "?")[0]?.toUpperCase()}</span><b>{c.full_name || "—"}</b></div></td>
              <td className="nop-mini">{c.email}</td>
              <td className="nop-mini">{c.phone || "—"}</td>
              <td className="nop-mini">{c.discord || "—"}</td>
              <td><span style={{ color: "var(--violet)", fontWeight: 600 }}>{s.activos}</span></td>
              <td><span style={{ color: "var(--amber)", fontWeight: 600 }}>{s.espera}</span></td>
              <td><span style={{ color: "var(--grn)", fontWeight: 600 }}>{s.completados}</span></td>
              <td style={{ color: "var(--gold)" }}>{fmtARS(s.gasto)}</td>
            </tr>); })}</tbody>
        </table></div>}
    </div>
    {open && <ClientDetailModal data={open} onClose={() => setOpen(null)} />}
  </>;
}
function ClientDetailModal({ data, onClose }) {
  const { c, s, orders } = data;
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>{c.full_name || "Cliente"}</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini">Email</span><span style={{ fontSize: 13 }}>{c.email}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini">Teléfono</span><span style={{ fontSize: 13 }}>{c.phone || "—"}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini">Discord</span><span style={{ fontSize: 13 }}>{c.discord || "—"}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "14px 0", textAlign: "center" }}>
        <div className="nop-card" style={{ padding: "12px 8px", background: "var(--bg2)" }}><div className="nop-mini">Activos</div><div className="nop-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--violet)", marginTop: 4 }}>{s.activos}</div></div>
        <div className="nop-card" style={{ padding: "12px 8px", background: "var(--bg2)" }}><div className="nop-mini">En espera</div><div className="nop-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--amber)", marginTop: 4 }}>{s.espera}</div></div>
        <div className="nop-card" style={{ padding: "12px 8px", background: "var(--bg2)" }}><div className="nop-mini">Completados</div><div className="nop-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--grn)", marginTop: 4 }}>{s.completados}</div></div>
      </div>
      <div className="nop-panel-h" style={{ fontSize: 13, marginBottom: 8 }}>Pedidos</div>
      {orders.length === 0 ? <p className="nop-mini">Sin pedidos.</p> :
        <div style={{ display: "grid", gap: 8 }}>{orders.sort((a, b) => b.id - a.id).map((o) => (
          <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ color: "var(--mut)", fontSize: 12 }}>#{o.id}</b><SvcTag s={o.service} /><StatusBadge s={o.status} /></div>
            <b style={{ fontSize: 13 }}>{fmtARS(o.price)}</b>
          </div>))}</div>}
    </div>
  </div></div>;
}

function AdminDash({ orders, profiles }) {
  const [month, setMonth] = useState("all");

  const monthKey = (d) => { if (!d) return null; const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
  const monthLabel = (k) => { const [y, m] = k.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); };
  const months = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => { const k = monthKey(o.completed_at || o.created_at); if (k) set.add(k); });
    return Array.from(set).sort().reverse();
  }, [orders]);
  const inMonth = (d) => month === "all" || monthKey(d) === month;

  // métricas históricas: por mes de cierre / creación
  const completed = orders.filter((o) => o.status === "completed" && inMonth(o.completed_at || o.created_at));
  const scopedAll = orders.filter((o) => inMonth(o.completed_at || o.created_at));
  const facturacion = completed.reduce((a, o) => a + Number(o.price), 0);
  const ganancia = completed.reduce((a, o) => a + Number(o.profit || 0), 0);
  const ratings = completed.filter((o) => o.survey_rating).map((o) => o.survey_rating);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const byService = Object.keys(SERVICES).map((k) => ({ name: SERVICES[k].label, value: scopedAll.filter((o) => o.service === k).length, color: SERVICES[k].color }));

  // operativo en vivo (no depende del mes)
  const liveActive = orders.filter((o) => o.status === "in_progress");
  const liveQueue = orders.filter((o) => o.status === "pending" || o.status === "available");
  const boosters = profiles.filter((p) => p.role === "booster" && p.status === "active");
  const load = boosters.map((b) => ({ ...b, n: liveActive.filter((o) => o.booster_id === b.id).length }));

  const kpi = (lbl, val, Icon, color, sub) => (
    <div className="nop-card nop-kpi"><div className="gl" style={{ background: color }} />
      <div className="lbl"><Icon size={13} style={{ color }} />{lbl}</div>
      <div className="val">{val}</div>{sub && <div className="delta">{sub}</div>}</div>
  );
  const periodo = month === "all" ? "histórico" : monthLabel(month);
  return <>
    <div className="nop-sectionhead">
      <div><h1 className="nop-h1">Dashboard</h1>
        <p className="nop-sub">En vivo: <b style={{ color: "var(--cyan)" }}>{liveActive.length}</b> en proceso · <b style={{ color: "var(--amber)" }}>{liveQueue.length}</b> en cola.</p></div>
      <select className="nop-select" style={{ width: "auto", minWidth: 170 }} value={month} onChange={(e) => setMonth(e.target.value)}>
        <option value="all">Todo el histórico</option>
        {months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}
      </select>
    </div>
    <div className="nop-grid-kpi" style={{ marginBottom: 14 }}>
      {kpi("Facturación", fmtARS(facturacion), Wallet, "var(--gold)", periodo)}
      {kpi("Ganancia neta", fmtARS(ganancia), TrendingUp, "var(--grn)", "después de pagar boosters")}
      {kpi("Servicios cerrados", completed.length, Trophy, "var(--cyan)", periodo)}
      {kpi("Satisfacción", avg ? avg.toFixed(1) + " ★" : "—", Star, "var(--violet)", `${ratings.length} reseñas`)}
    </div>
    <div className="nop-twocol" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
      <div className="nop-card nop-panel">
        <div className="nop-panel-h"><Activity size={15} style={{ color: "var(--gold)" }} />Carga por booster (ahora)</div>
        {load.length === 0 ? <p className="nop-mini">Todavía no hay boosters activos.</p> :
          <div className="nop-flowbar">{load.map((b) => {
            const tag = b.n >= 7 ? ["Saturado", "var(--red)"] : b.n >= 3 ? ["Ideal", "var(--grn)"] : b.n >= 1 ? ["Liviano", "var(--cyan)"] : ["Libre", "var(--mut2)"];
            return <div className="nop-flowrow" key={b.id}><span className="nm">{b.full_name || b.email}</span>
              <div className="nop-flowtrack"><div className="nop-flowfill" style={{ width: Math.min(100, b.n * 14 + (b.n ? 12 : 0)) + "%", background: tag[1] }} /></div>
              <span className="nop-flowtag" style={{ color: tag[1] }}>{b.n} · {tag[0]}</span></div>; })}</div>}
        <p className="nop-mini" style={{ marginTop: 14 }}>Libre 0 · Ideal 3–6 · Saturado 7+.</p>
      </div>
      <div className="nop-card nop-panel">
        <div className="nop-panel-h"><Hash size={15} style={{ color: "var(--cyan)" }} />Pedidos por servicio ({periodo})</div>
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

    <div className="nop-card nop-panel" style={{ marginTop: 14 }}>
      <div className="nop-panel-h"><Swords size={15} style={{ color: "var(--cyan)" }} />Pedidos activos — en proceso ({liveActive.length})</div>
      {liveActive.length === 0 ? <p className="nop-mini">No hay servicios en proceso ahora mismo.</p> :
        <div className="nop-tablewrap"><table className="nop-t">
          <thead><tr><th>#</th><th>Cliente</th><th>Servicio</th><th>Liga actual</th><th>Objetivo</th><th>Booster</th><th>Monto</th><th>Pago booster</th><th>Ganancia</th></tr></thead>
          <tbody>{liveActive.map((o) => (
            <tr key={o.id}>
              <td className="nop-mini">#{o.id}</td>
              <td><b style={{ fontSize: 13 }}>{o.client_name}</b></td>
              <td><SvcTag s={o.service} /></td>
              <td><RankBadge r={o.cur_rank} d={o.cur_div} /></td>
              <td>{o.service === "coaching" ? <span className="nop-mini">—</span> : <RankBadge r={o.tgt_rank} d={o.tgt_div} />}</td>
              <td className="nop-mini">{o.booster_name || "—"}</td>
              <td style={{ color: "var(--gold)", fontWeight: 600 }}>{fmtARS(o.price)}</td>
              <td style={{ color: "var(--cyan)" }}>{fmtARS(o.booster_pay)}</td>
              <td style={{ color: "var(--grn)", fontWeight: 600 }}>{fmtARS(o.profit)}</td>
            </tr>))}</tbody>
        </table></div>}
    </div>
  </>;
}
function AdminOrders({ orders, reload, flash, deleteOrder }) {
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
        : <OrdersTable orders={list} onDelete={deleteOrder} cols={["id", "cliente", "rank", "servicio", "booster", "precio", "pago", "ganancia", "estado"]} />}
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
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Boosters</h1><p className="nop-sub">Equipo, cortes, estado y desempeño. Las altas se aprueban desde Validaciones.</p></div></div>
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

function AdminHistory({ orders, deleteOrder }) {
  const done = orders.filter((o) => o.status === "completed");
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Historial</h1><p className="nop-sub">Servicios finalizados y reseñas.</p></div></div>
    <div className="nop-card nop-panel">
      {done.length === 0 ? <Empty icon={Trophy} title="Todavía no hay cierres" sub="Aparecen acá cuando un booster finaliza." />
        : <OrdersTable orders={done} onDelete={deleteOrder} cols={["id", "cliente", "rank", "servicio", "booster", "precio", "ganancia", "rating"]} />}
    </div>
  </>;
}

/* ===== tabla compartida ===== */
function OrdersTable({ orders, cols, onDelete }) {
  const [open, setOpen] = useState(null);
  const head = { id: "#", cliente: "Cliente", rank: "Recorrido", servicio: "Servicio", booster: "Booster", precio: "Precio", pago: "Pago booster", ganancia: "Ganancia", estado: "Estado", rating: "Reseña" };
  return <>
    <div className="nop-tablewrap"><table className="nop-t">
      <thead><tr>{cols.map((c) => <th key={c}>{head[c]}</th>)}</tr></thead>
      <tbody>{orders.map((o) => <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setOpen(o)}>{cols.map((c) => <td key={c}>{cell(c, o)}</td>)}</tr>)}</tbody>
    </table></div>
    {open && <OrderModal o={open} onClose={() => setOpen(null)} onDelete={onDelete} />}
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
function OrderModal({ o, onClose, onDelete }) {
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
      {o.pref_days && <F k="Días de preferencia" v={o.pref_days} />}
      {o.pref_times && <F k="Horario de preferencia" v={o.pref_times} />}
      {o.notes && <F k="Notas del cliente" v={o.notes} />}
      <F k="Booster" v={o.booster_name || "Sin asignar"} />
      <F k="Medio de pago" v={o.payment} />
      {o.status === "completed" && <F k="Duración del servicio" v={svcDuration(o)} />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "14px 0", textAlign: "center" }}>
        <S k="Precio" v={fmtARS(o.price)} c="var(--gold)" /><S k="Pago booster" v={fmtARS(o.booster_pay)} c="var(--cyan)" /><S k="Ganancia" v={fmtARS(o.profit)} c="var(--grn)" />
      </div>
      {o.survey_rating && <div className="nop-card" style={{ padding: 14, background: "var(--bg2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><b style={{ fontSize: 13 }}>Reseña del cliente</b><Stars value={o.survey_rating} /></div>
        <p style={{ fontSize: 13, color: "var(--mut)", fontStyle: "italic" }}>"{o.survey_comment}"</p></div>}
      {onDelete && <button className="nop-btn nop-btn-danger" style={{ width: "100%", marginTop: 16 }} onClick={() => onDelete(o)}><Trash2 size={15} />Eliminar pedido</button>}
    </div></div></div>;
}

/* ===================== BOOSTER ===================== */
function BoosterViews({ tab, ...ctx }) {
  if (tab === "mine") return <BoosterMine {...ctx} />;
  if (tab === "accounts") return <BoosterAccounts {...ctx} />;
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
    await notify(`${profile.full_name} aceptó el pedido #${o.id} (${o.client_name}).`, "admin", null, "done", "order", o.id);
    await notify(`¡Tenés booster! ${profile.full_name} tomó tu servicio. Coordinen por Discord.`, null, o.client_id, "done", "order", o.id);
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
          {(o.pref_days || o.pref_times) && <div className="nop-mini" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {o.pref_days && <span><CalendarDays size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />{o.pref_days}</span>}
            {o.pref_times && <span><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />{o.pref_times}</span>}</div>}
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
    await notify(`Servicio #${o.id} finalizado por ${profile.full_name}.`, "admin", null, "done", "order", o.id);
    await notify(`Tu servicio #${o.id} fue finalizado. ¡Dejanos tu reseña!`, null, o.client_id, "done", "order", o.id);
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
          {(o.pref_days || o.pref_times) && <div className="nop-mini" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            {o.pref_days && <span><CalendarDays size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Días: {o.pref_days}</span>}
            {o.pref_times && <span><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Horario: {o.pref_times}</span>}</div>}
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
  if (tab === "hist") return <ClientHistory {...ctx} />;
  return <ClientHome {...ctx} setTab={setTab} />;
}
function ClientHome({ profile, orders, reload, flash, notify, setTab }) {
  const mine = orders.filter((o) => o.client_id === profile.id && o.status !== "completed");
  if (mine.length === 0) return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Hola, {profile.full_name} 👋</h1><p className="nop-sub">No tenés pedidos activos.</p></div></div>
    <div className="nop-card"><Empty icon={Trophy} title="Sin pedidos activos" sub="Cargá tu primer servicio y, una vez validado, un booster lo toma." />
      <div style={{ textAlign: "center", paddingBottom: 28 }}><button className="nop-btn nop-btn-gold" onClick={() => setTab("new")}><Plus size={15} />Solicitar un servicio</button></div></div>
  </>;
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Mis pedidos</h1><p className="nop-sub">Seguí el estado en vivo.</p></div></div>
    <div style={{ display: "grid", gap: 16 }}>{mine.map((o) => <ClientOrderCard key={o.id} o={o} reload={reload} flash={flash} notify={notify} />)}</div>
  </>;
}
function ClientHistory({ profile, orders, reload, flash, notify }) {
  const done = orders.filter((o) => o.client_id === profile.id && o.status === "completed")
    .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Historial</h1><p className="nop-sub">Resumen de tus servicios anteriores.</p></div></div>
    {done.length === 0 ? <div className="nop-card"><Empty icon={Trophy} title="Todavía no hay servicios finalizados" sub="Cuando completes tu primer servicio, aparece acá." /></div> :
      <div style={{ display: "grid", gap: 14 }}>{done.map((o) => o.survey_rating ? (
        <div className="nop-card nop-panel" key={o.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ color: "var(--mut)", fontSize: 12 }}>#{o.id}</b><SvcTag s={o.service} /><RankPath o={o} />
            </div>
            <b className="nop-display" style={{ color: "var(--gold)" }}>{fmtARS(o.price)}</b>
          </div>
          <div className="nop-mini" style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 12 }}>
            <span><Swords size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Booster: {o.booster_name || "—"}</span>
            <span><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Duración: {svcDuration(o)}</span>
            <span>Finalizado: {o.completed_at ? new Date(o.completed_at).toLocaleDateString("es-AR") : "—"}</span>
          </div>
          <div className="nop-card" style={{ padding: 14, background: "var(--bg2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: o.survey_comment ? 6 : 0 }}>
              <b style={{ fontSize: 13 }}>Tu reseña</b><Stars value={o.survey_rating} /></div>
            {o.survey_comment && <p style={{ fontSize: 13, color: "var(--mut)", fontStyle: "italic" }}>"{o.survey_comment}"</p>}
          </div>
        </div>
      ) : <ClientOrderCard key={o.id} o={o} reload={reload} flash={flash} notify={notify} />)}</div>}
  </>;
}
function ClientOrderCard({ o, reload, flash, notify }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [rec, setRec] = useState(true);
  const stepIdx = STATUS_FLOW.indexOf(o.status);
  const submit = async () => {
    await supabase.from("orders").update({ survey_rating: rating, survey_comment: comment || "¡Todo excelente!", survey_recommend: rec }).eq("id", o.id);
    await notify(`${o.client_name} dejó una reseña de ${rating}★ en el pedido #${o.id}.`, "admin", null, "spark", "order", o.id);
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
        <div className="nop-panel-h" style={{ marginBottom: 6 }}><Star size={15} style={{ color: "var(--gold)" }} />¿Cómo estuvo tu experiencia con {o.booster_name}?</div>
        <p className="nop-mini" style={{ marginBottom: 12 }}>Duración del servicio: <b style={{ color: "var(--tx)" }}>{svcDuration(o)}</b></p>
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
  const [step, setStep] = useState(1);
  const [service, setService] = useState("duoboost");
  const [cur, setCur] = useState("Oro"), [curD, setCurD] = useState("IV");
  const [tgt, setTgt] = useState("Platino"), [tgtD, setTgtD] = useState("IV");
  const [server, setServer] = useState("LAS"), [lp, setLp] = useState("+20"), [games, setGames] = useState(3);
  const [roleChamp, setRoleChamp] = useState(""), [notes, setNotes] = useState("");
  const [days, setDays] = useState([]);
  const [times, setTimes] = useState([]);
  const toggleArr = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const [eloRole, setEloRole] = useState("Mid");
  const [champOn, setChampOn] = useState(false), [champName, setChampName] = useState("");
  const [express, setExpress] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [currency, setCurrency] = useState("ars"); // ars | usd
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const isCoaching = service === "coaching";
  const isElo = service === "eloboost";
  const tierDiff = RANKS.indexOf(tgt) - RANKS.indexOf(cur);
  const eloTooFar = isElo && tierDiff > 2;
  const eloInvalid = isElo && (rankPos(tgt, tgtD) <= rankPos(cur, curD) || eloTooFar);
  const price = useMemo(() => {
    if (isCoaching) return COACHING_PRICE[games];
    if (isElo) {
      let b = estimateDuo(cur, curD, tgt, tgtD, false);
      if (champOn) b *= 1.5;
      if (express) b *= 1.2;
      return Math.round(b / 100) * 100;
    }
    return estimateDuo(cur, curD, tgt, tgtD, service === "combo");
  }, [service, cur, curD, tgt, tgtD, games, isCoaching, isElo, champOn, express]);
  const SvcIc = ({ k }) => { const Ic = SERVICES[k].icon; return <Ic size={19} />; };
  const copy = (t) => { try { navigator.clipboard.writeText(t); flash("Copiado: " + t); } catch (e) { flash("Copiá manualmente: " + t); } };

  const submit = async () => {
    if (!file) { flash("Subí el comprobante de pago para continuar."); return; }
    if (isElo && !accepted) { flash("Tenés que aceptar los términos y condiciones."); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("comprobantes").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const eloDetail = isElo ? `Rol: ${eloRole}${champOn && champName ? ` · Campeón: ${champName}` : ""}${express ? " · ⚡ Express" : ""}` : "";
      const row = {
        client_id: profile.id, client_name: profile.full_name, client_discord: profile.discord || profile.email,
        service, cur_rank: cur, cur_div: curD,
        tgt_rank: isCoaching ? cur : tgt, tgt_div: isCoaching ? curD : tgtD,
        server, lp: (isCoaching || isElo) ? null : lp, games: isCoaching ? games : null,
        role_champ: isCoaching ? `${roleChamp || "Sin preferencia"} · ${games} partida${games > 1 ? "s" : ""}` : isElo ? eloDetail : roleChamp,
        notes, payment: currency === "ars" ? "Transferencia (pesos)" : "PayPal (USD)", price, status: "pending",
        receipt_path: path,
        pref_days: isElo ? null : days.join(", "), pref_times: isElo ? null : times.join(", "),
      };
      const { data: created, error } = await supabase.from("orders").insert(row).select("id").single();
      if (error) throw error;
      await notify(`Nuevo pedido de ${profile.full_name} entró por validar (con comprobante).`, "admin", null, "new", "order", created?.id);
      await reload(); flash("¡Pedido enviado! Validamos el comprobante y pasa a los boosters."); setTab("home");
    } catch (e) {
      flash("No se pudo enviar el pedido. Reintentá.");
    } finally { setBusy(false); }
  };

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Solicitar servicio</h1>
      <p className="nop-sub">Paso {step} de 2 · {step === 1 ? "datos del servicio" : "pago y comprobante"}</p></div></div>

    <div className="nop-card nop-panel">
      {step === 1 && <>
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
        {isElo && <div className={"nop-" + (eloInvalid ? "err" : "ok")} style={{ marginTop: 4 }}>
          {eloTooFar ? "🔒 Por seguridad subimos como máximo 2 ligas por solicitud (ej: Hierro → Plata). Reducí la liga objetivo."
            : rankPos(tgt, tgtD) <= rankPos(cur, curD) ? "La liga objetivo tiene que ser más alta que la actual."
              : "✅ Recorrido válido. Por seguridad solo subimos hasta 2 ligas por solicitud."}
        </div>}

        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "10px 0 12px" }}>3 · Detalles</label>
        <div className="nop-row2">
          <div className="nop-field"><label>Servidor <span className="req">*</span></label><select className="nop-select" value={server} onChange={(e) => setServer(e.target.value)}><option>LAS</option><option>LAN</option><option>BR</option></select></div>
          {!isCoaching && !isElo && <div className="nop-field"><label>Ganancia LP aprox</label><select className="nop-select" value={lp} onChange={(e) => setLp(e.target.value)}><option>+15</option><option>+20</option><option>+25</option></select></div>}
        </div>

        {isElo ? <>
          <div className="nop-field"><label>Rol <span className="req">*</span></label>
            <div className="nop-chiprow">{LANES.map((l) => (
              <button type="button" key={l} className={"nop-chip" + (eloRole === l ? " on" : "")} onClick={() => setEloRole(l)}>{l}</button>))}</div></div>
          <div className="nop-field">
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={champOn} onChange={(e) => setChampOn(e.target.checked)} /> Campeón específico <b style={{ color: "var(--gold)" }}>(+50%)</b></label>
            {champOn && <input className="nop-input" style={{ marginTop: 8 }} value={champName} onChange={(e) => setChampName(e.target.value)} placeholder="¿Con qué campeón querés que suba? Ej: Yasuo" />}</div>
          <div className="nop-field">
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} /> Entrega express <b style={{ color: "var(--gold)" }}>(+20%)</b> · alta prioridad</label></div>
        </> : <>
          <div className="nop-field"><label>Rol / campeón preferido</label><input className="nop-input" value={roleChamp} onChange={(e) => setRoleChamp(e.target.value)} placeholder="Ej: ADC, Mid Katarina, Flash en D" /></div>
          <div className="nop-field"><label><CalendarDays size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Días de preferencia</label>
            <div className="nop-chiprow">{PREF_DAYS.map((d) => (
              <button type="button" key={d} className={"nop-chip" + (days.includes(d) ? " on" : "")} onClick={() => toggleArr(days, setDays, d)}>{d}</button>))}</div></div>
          <div className="nop-field"><label><Clock size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Preferencia horaria</label>
            <div className="nop-chiprow">{PREF_TIMES.map((t) => (
              <button type="button" key={t} className={"nop-chip" + (times.includes(t) ? " on" : "")} onClick={() => toggleArr(times, setTimes, t)}>{t}</button>))}</div>
            <p className="nop-mini" style={{ marginTop: 6 }}>Podés elegir varios (o todos). El booster los ve para coordinar.</p></div>
        </>}

        <div className="nop-field"><label>Notas para el booster</label><textarea className="nop-ta" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Horarios, preferencias, lo que quieras aclarar…" /></div>

        <div className="nop-card" style={{ padding: 16, background: "var(--bg2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div><div className="nop-mini">Precio estimado {service === "combo" && "(incluye coaching en vivo +50%)"}{isElo && champOn && " · +50% campeón"}{isElo && express && " · +20% express"}</div>
            <div className="nop-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>{fmtARS(price)}</div>
            <div className="nop-mini">Lo confirma el equipo según tu MMR.</div></div>
          <button className="nop-btn nop-btn-gold" disabled={eloInvalid} onClick={() => setStep(2)}>Siguiente: pago <ArrowRight size={15} /></button>
        </div>
      </>}

      {step === 2 && <>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 10 }}>4 · Elegí la moneda</label>
        <div className="nop-segwrap" style={{ marginBottom: 18 }}>
          <button type="button" className={"nop-seg" + (currency === "ars" ? " on" : "")} onClick={() => setCurrency("ars")}>Pesos (transferencia)</button>
          <button type="button" className={"nop-seg" + (currency === "usd" ? " on" : "")} onClick={() => setCurrency("usd")}>USD (PayPal)</button>
        </div>

        {currency === "ars" ? (
          <div className="nop-card" style={{ padding: 18, background: "var(--bg2)", marginBottom: 18 }}>
            <div className="nop-panel-h" style={{ marginBottom: 14 }}><Wallet size={15} style={{ color: "var(--gold)" }} />Transferí a este alias</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div><div className="nop-mini">Alias</div><b style={{ fontSize: 15 }}>{PAY_ALIAS}</b></div>
              <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => copy(PAY_ALIAS)}><Copy size={13} />Copiar</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0" }}>
              <div><div className="nop-mini">Nombre / referencia</div><b style={{ fontSize: 15 }}>{PAY_NAME}</b></div>
              <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => copy(PAY_NAME)}><Copy size={13} />Copiar</button>
            </div>
            <div className="nop-mini" style={{ marginTop: 12 }}>Monto a transferir: <b style={{ color: "var(--gold)" }}>{fmtARS(price)}</b> (aprox., se confirma según tu MMR).</div>
          </div>
        ) : (
          <div className="nop-card" style={{ padding: 18, background: "var(--bg2)", marginBottom: 18 }}>
            <div className="nop-panel-h" style={{ marginBottom: 12 }}><Wallet size={15} style={{ color: "var(--violet)" }} />Pagá con PayPal</div>
            <p className="nop-mini" style={{ marginBottom: 14 }}>Abrí el link, hacé el pago y descargá el comprobante para subirlo abajo.</p>
            <a className="nop-btn nop-btn-violet" href={PAYPAL_URL} target="_blank" rel="noreferrer"><ArrowRight size={15} />Ir a PayPal</a>
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "4px 0 10px" }}>5 · Subí el comprobante <span className="req">*</span></label>
        <label className="nop-upload">
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Upload size={20} style={{ color: file ? "var(--grn)" : "var(--mut)" }} />
          <span>{file ? file.name : "Tocá para elegir una imagen o PDF del comprobante"}</span>
        </label>
        {!file && <p className="nop-mini" style={{ marginTop: 8 }}>Sin comprobante no podés enviar el pedido.</p>}

        {isElo && <div className="nop-card" style={{ padding: 16, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", marginTop: 18 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.6 }}>
              <b style={{ color: "var(--tx)" }}>Acepto los términos y condiciones.</b> El Eloboost es un servicio que <b style={{ color: "#f87171" }}>Riot Games puede penalizar</b>. Tomamos todas las medidas de seguridad posibles (modo offline, VPN, juego discreto), pero <b style={{ color: "var(--tx)" }}>no hay reembolsos en caso de suspensión de la cuenta</b>. Al continuar, entendés y aceptás este riesgo.
            </span>
          </label>
        </div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 20 }}>
          <button className="nop-btn nop-btn-ghost" onClick={() => setStep(1)}>← Volver</button>
          <button className="nop-btn nop-btn-gold" disabled={busy || !file || (isElo && !accepted)} onClick={submit}><Check size={15} />{busy ? "Enviando…" : "Enviar pedido"}</button>
        </div>
      </>}
    </div>
  </>;
}

/* ===================== CUENTAS (pool compartido) ===================== */
function AccStatusBadge({ s }) {
  const cls = s === "activa" ? "s-completed" : s === "inactiva" ? "s-in_progress" : "s-cancelled";
  return <span className={"nop-status " + cls}>{ACC_STATUS_LABEL[s] || s}</span>;
}
function Cred({ label, value, flash }) {
  const [show, setShow] = useState(false);
  const copy = () => { try { navigator.clipboard.writeText(value || ""); flash && flash("Copiado"); } catch (e) {} };
  return <div className="nop-cred"><span className="nop-mini">{label}</span>
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <code>{show ? (value || "—") : "••••••••"}</code>
      <button className="nop-iconbtn" style={{ width: 28, height: 28 }} onClick={() => setShow((s) => !s)}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
      <button className="nop-iconbtn" style={{ width: 28, height: 28 }} onClick={copy}><Copy size={13} /></button>
    </span></div>;
}

function AdminAccounts({ accounts, reload, flash }) {
  const [summoner, setSummoner] = useState("");
  const [rk, setRk] = useState("Oro"), [rd, setRd] = useState("IV");
  const [user, setUser] = useState(""), [pass, setPass] = useState("");
  const [estado, setEstado] = useState("activa");
  const [edit, setEdit] = useState(null);

  const rankStr = (r, d) => r + (r !== "Master" ? " " + d : "");
  const create = async () => {
    if (!summoner) { flash("Falta el nombre de invocador."); return; }
    const { error } = await supabase.from("game_accounts").insert({ summoner, rank: rankStr(rk, rd), login_user: user, login_pass: pass, status: estado });
    if (error) { flash("No se pudo crear la cuenta."); return; }
    setSummoner(""); setUser(""); setPass(""); setEstado("activa");
    await reload(); flash("Cuenta creada");
  };
  const setStatus = async (a, status) => { await supabase.from("game_accounts").update({ status }).eq("id", a.id); await reload(); flash(`Cuenta ${ACC_STATUS_LABEL[status]?.toLowerCase()}`); };
  const del = async (a) => { if (!window.confirm(`¿Eliminar la cuenta ${a.summoner}?`)) return; await supabase.from("game_accounts").delete().eq("id", a.id); await reload(); flash("Cuenta eliminada"); };

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Cuentas</h1><p className="nop-sub">Pool de cuentas para los boosters. Crealas, actualizalas o deshabilitalas.</p></div></div>

    <div className="nop-card nop-panel" style={{ marginBottom: 16 }}>
      <div className="nop-panel-h"><PlusIc size={15} style={{ color: "var(--cyan)" }} />Nueva cuenta</div>
      <div className="nop-row3">
        <div className="nop-field" style={{ marginBottom: 12 }}><label>Nombre de invocador <span className="req">*</span></label>
          <input className="nop-input" value={summoner} onChange={(e) => setSummoner(e.target.value)} placeholder="Ej: SmurfNation01" /></div>
        <div className="nop-field" style={{ marginBottom: 12 }}><label>Liga actual</label>
          <div className="nop-row2">
            <select className="nop-select" value={rk} onChange={(e) => setRk(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
            <select className="nop-select" value={rd} onChange={(e) => setRd(e.target.value)} disabled={rk === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>
          </div></div>
        <div className="nop-field" style={{ marginBottom: 12 }}><label>Estado</label>
          <select className="nop-select" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="activa">Disponible</option><option value="deshabilitada">Deshabilitada</option></select></div>
      </div>
      <div className="nop-row3">
        <div className="nop-field" style={{ marginBottom: 0 }}><label>Usuario (oculto)</label>
          <input className="nop-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="usuario de login" /></div>
        <div className="nop-field" style={{ marginBottom: 0 }}><label>Contraseña (oculta)</label>
          <input className="nop-input" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="contraseña" /></div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button className="nop-btn nop-btn-cyan" style={{ width: "100%" }} onClick={create}><PlusIc size={15} />Crear cuenta</button></div>
      </div>
    </div>

    {accounts.length === 0 ? <Empty icon={Gamepad2} title="Sin cuentas todavía" sub="Creá la primera arriba." /> :
      <div className="nop-acc-grid">{accounts.map((a) => (
        <div className="nop-card nop-acc" key={a.id}>
          <div className="top">
            <div><div className="sm">{a.summoner}</div><div className="nop-mini">{a.rank || "—"}</div></div>
            <AccStatusBadge s={a.status} />
          </div>
          {a.status === "inactiva" && <div className="nop-mini">En uso por <b style={{ color: "var(--tx)" }}>{a.taken_by_name || "—"}</b></div>}
          <Cred label="Usuario" value={a.login_user} flash={flash} />
          <Cred label="Contraseña" value={a.login_pass} flash={flash} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setEdit(a)}>Editar</button>
            {a.status !== "deshabilitada"
              ? <button className="nop-btn nop-btn-ghost nop-btn-sm" disabled={a.status === "inactiva"} onClick={() => setStatus(a, "deshabilitada")}><Power size={13} />Deshabilitar</button>
              : <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => setStatus(a, "activa")}><Power size={13} />Activar</button>}
            <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={() => del(a)}><Trash2 size={13} /></button>
          </div>
        </div>))}</div>}

    {edit && <AccountEdit a={edit} onClose={() => setEdit(null)} reload={reload} flash={flash} />}
  </>;
}

function AccountEdit({ a, onClose, reload, flash }) {
  const init = (a.rank || "Oro IV").split(" ");
  const [summoner, setSummoner] = useState(a.summoner || "");
  const [rk, setRk] = useState(RANKS.includes(init[0]) ? init[0] : "Oro");
  const [rd, setRd] = useState(init[1] || "IV");
  const [user, setUser] = useState(a.login_user || "");
  const [pass, setPass] = useState(a.login_pass || "");
  const save = async () => {
    const rank = rk + (rk !== "Master" ? " " + rd : "");
    await supabase.from("game_accounts").update({ summoner, rank, login_user: user, login_pass: pass }).eq("id", a.id);
    await reload(); flash("Cuenta actualizada"); onClose();
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Editar cuenta</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div className="nop-field"><label>Nombre de invocador</label><input className="nop-input" value={summoner} onChange={(e) => setSummoner(e.target.value)} /></div>
      <div className="nop-field"><label>Liga actual</label><div className="nop-row2">
        <select className="nop-select" value={rk} onChange={(e) => setRk(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
        <select className="nop-select" value={rd} onChange={(e) => setRd(e.target.value)} disabled={rk === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
      <div className="nop-field"><label>Usuario</label><input className="nop-input" value={user} onChange={(e) => setUser(e.target.value)} /></div>
      <div className="nop-field"><label>Contraseña</label><input className="nop-input" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
      <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} onClick={save}><Check size={15} />Guardar cambios</button>
    </div>
  </div></div>;
}

function BoosterAccounts({ profile, accounts, reload, flash }) {
  const disponibles = accounts.filter((a) => a.status === "activa");
  const mias = accounts.filter((a) => a.status === "inactiva" && a.taken_by === profile.id);

  const use = async (a) => {
    const { data, error } = await supabase.from("game_accounts")
      .update({ status: "inactiva", taken_by: profile.id, taken_by_name: profile.full_name }).eq("id", a.id).eq("status", "activa").select();
    if (error) { flash("No se pudo tomar la cuenta."); return; }
    if (!data || data.length === 0) { flash("Otro booster la tomó primero."); await reload(); return; }
    await reload(); flash(`Tomaste la cuenta ${a.summoner}`);
  };
  const ret = async (a) => {
    await supabase.from("game_accounts").update({ status: "activa", taken_by: null, taken_by_name: null }).eq("id", a.id);
    await reload(); flash(`Devolviste la cuenta ${a.summoner}`);
  };

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Cuentas</h1><p className="nop-sub">Tomá una cuenta disponible para trabajar y devolvela al terminar.</p></div></div>

    {mias.length > 0 && <div style={{ marginBottom: 20 }}>
      <div className="nop-panel-h" style={{ marginBottom: 12 }}><Gamepad2 size={15} style={{ color: "var(--violet)" }} />Mis cuentas en uso ({mias.length})</div>
      <div className="nop-acc-grid">{mias.map((a) => (
        <div className="nop-card nop-acc" key={a.id} style={{ borderColor: "var(--violet)" }}>
          <div className="top"><div><div className="sm">{a.summoner}</div><div className="nop-mini">{a.rank || "—"}</div></div><AccStatusBadge s={a.status} /></div>
          <Cred label="Usuario" value={a.login_user} flash={flash} />
          <Cred label="Contraseña" value={a.login_pass} flash={flash} />
          <button className="nop-btn nop-btn-grn nop-btn-sm" onClick={() => ret(a)}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} />Devolver cuenta</button>
        </div>))}</div>
    </div>}

    <div className="nop-panel-h" style={{ marginBottom: 12 }}><Zap size={15} style={{ color: "var(--gold)" }} />Disponibles ({disponibles.length})</div>
    {disponibles.length === 0 ? <Empty icon={Gamepad2} title="No hay cuentas disponibles" sub="Cuando el admin cargue cuentas, aparecen acá." /> :
      <div className="nop-acc-grid">{disponibles.map((a) => (
        <div className="nop-card nop-acc" key={a.id}>
          <div className="top"><div><div className="sm">{a.summoner}</div><div className="nop-mini">{a.rank || "—"}</div></div><AccStatusBadge s={a.status} /></div>
          <Cred label="Usuario" value={a.login_user} flash={flash} />
          <Cred label="Contraseña" value={a.login_pass} flash={flash} />
          <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => use(a)}><Check size={13} />Usar esta cuenta</button>
        </div>))}</div>}
  </>;
}
