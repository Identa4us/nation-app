import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Shield, Swords, GraduationCap, Sparkles, Bell, LogOut, Plus, Check, Clock, Play,
  Flag, Star, Users, TrendingUp, Wallet, Activity, ChevronRight, Trophy, MessageCircle,
  Search, X, ArrowRight, Crown, Zap, Hash, UserCheck, ShieldCheck, Trash2, Send,
  LifeBuoy, Copy, Eye, EyeOff, Upload, FileText, Gamepad2, Plus as PlusIc, Power, Headset, Phone, CalendarDays,
  Settings, RefreshCw, Banknote, Tag,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "./supabaseClient";

/* ===================== dominio ===================== */
const RANKS = ["Hierro", "Bronce", "Plata", "Oro", "Platino", "Esmeralda", "Diamante", "Master"];
// Boosters de prueba: se filtran del dashboard (KPIs, carga por booster) y no cuentan en el ratio.
const TEST_BOOSTER_NAMES = ["Colorin70", "Booster Prueba"];
const isTestBooster = (p) => p && TEST_BOOSTER_NAMES.some((n) => (p.full_name || "").trim().toLowerCase() === n.toLowerCase());
const DIVS = ["IV", "III", "II", "I"];
const RANK_COLOR = { Hierro: "#7B8497", Bronce: "#B07B3E", Plata: "#A8B3C7", Oro: "#E8B349", Platino: "#2DD4BF", Esmeralda: "#10B981", Diamante: "#38BDF8", Master: "#A855F7" };
const SERVICES = {
  eloboost: { label: "Eloboost", icon: Shield, color: "#F87171", desc: "Un booster sube tu cuenta por vos en modo offline. Máximo 2 ligas por solicitud, por seguridad." },
  duoboost: { label: "DuoBoost", icon: Swords, color: "#38BDF8", desc: "Subís en dúo con un booster Grandmaster+. Jugás en tu cuenta, 0% riesgo de baneo. Opción de coaching." },
  coaching: { label: "Coaching", icon: GraduationCap, color: "#A855F7", desc: "Sesiones 1 a 1 con high elo: VOD review, pool de campeones, wave y macro." },
  single_match: { label: "Single Match", icon: Play, color: "#34D399", desc: "Pagás por partida o por pack. Ideal para mantener MMR o proteger contra decaimiento en Diamante+." },
  placements: { label: "Placements", icon: Flag, color: "#FB923C", desc: "Jugamos tus 5 partidas de posicionamiento para asegurar el mejor inicio en la temporada." },
  tft: { label: "TFT", icon: Sparkles, color: "#E8B349", desc: "Teamfight Tactics: subimos tu rango de TFT. Opción de coaching para que aprendas a rankear vos." },
};
// Servicios legacy (ya no se ofrecen, pero pueden existir en pedidos históricos)
const SERVICES_LEGACY = {
  combo: { label: "DuoBoost + Coaching", icon: Sparkles, color: "#E8B349", desc: "Servicio histórico." },
};
// Servicio de solo-visualización: ventas de cuentas (no es reservable desde el formulario)
const SERVICES_EXTRA = {
  cuenta: { label: "Cuenta", icon: Gamepad2, color: "#2DD4BF", desc: "Venta de cuenta de LoL." },
};
const svcOf = (k) => SERVICES[k] || SERVICES_LEGACY[k] || SERVICES_EXTRA[k] || SERVICES.duoboost;
const DISCORD_INVITE = "https://discord.gg/AfmjdnbNgC";
const STATUS_FLOW = ["pending", "available", "in_progress", "completed"];
const STATUS_LABEL = { pending: "En revisión", available: "Disponible", in_progress: "En proceso", completed: "Finalizado", cancelled: "Cancelado" };

const SUPPORT_WA = "https://api.whatsapp.com/send?phone=542214287466&text=Hola!%20Necesito%20ayuda%20con%20Eloboost%20Nation";
const PAY_ALIAS = "boost.nation.arq";
const PAY_NAME = "Felipe Monetti";
const PAYPAL_URL = "https://www.paypal.com/paypalme/eloboostlolgg";
const ACC_STATUS_LABEL = { activa: "Disponible", inactiva: "En uso", deshabilitada: "Deshabilitada" };
const PREF_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const PREF_TIMES = ["Mañana", "Tarde", "Noche"];

// Precios por división (Hierro → Esmeralda: mismo precio para las 4 divisiones)
const PRICE_DIV_ARS = { Hierro: 2400, Bronce: 3600, Plata: 4800, Oro: 6000, Platino: 7200, Esmeralda: 9600 };
const PRICE_DIV_USD = { Hierro: 2.4, Bronce: 3, Plata: 4.2, Oro: 4.8, Platino: 6.6, Esmeralda: 9 };
// Diamante: precio escalonado según la división actual
const PRICE_DIAMANTE_ARS = { IV: 12000, III: 14400, II: 18000, I: 18000 };
const PRICE_DIAMANTE_USD = { IV: 12, III: 14.4, II: 18, I: 18 };
const LANES = ["Top", "Jungla", "Mid", "ADC", "Support"];
const COACHING_PRICE = { 1: 15000, 3: 35000, 5: 50000 };
// Single Match: precio por partida según la liga (ascendente Hierro→Master)
const SINGLE_MATCH_PER_GAME_ARS = { Hierro: 2500, Bronce: 3000, Plata: 3500, Oro: 4000, Platino: 4500, Esmeralda: 5000, Diamante: 5500, Master: 6000 };
const SINGLE_MATCH_PER_GAME_USD = { Hierro: 2.5, Bronce: 3, Plata: 3.5, Oro: 4, Platino: 4.5, Esmeralda: 5, Diamante: 5.5, Master: 6 };
// Cualquier pack (4, 5, 10 partidas) aplica 10% de descuento
function singleMatchPrice(rank, games) {
  const arsPer = SINGLE_MATCH_PER_GAME_ARS[rank] || 4000;
  const usdPer = SINGLE_MATCH_PER_GAME_USD[rank] || 4;
  const disc = games > 1 ? 0.9 : 1;
  return {
    ars: Math.round((arsPer * games * disc) / 100) * 100,
    usd: Math.round((usdPer * games * disc) * 100) / 100,
  };
}
const SINGLE_MATCH_OPTIONS = [
  { games: 1, label: "1 partida" },
  { games: 5, label: "5 partidas", off: 10 },
  { games: 10, label: "10 partidas", off: 10 },
];
// Pack 4 partidas (protección contra decaimiento) — precio fijo, solo disponible de Oro para arriba
const SINGLE_MATCH_PROTECT_ARS = 14400;
const SINGLE_MATCH_PROTECT_USD = 14.4;
const PROTECT_ELIGIBLE_RANKS = ["Diamante", "Master"];
// Placements: 5 partidas de inicio de temporada, con opción SoloQ o DuoQ
const PLACEMENTS_ARS = { soloq: 9900, duoq: 15000 };
const PLACEMENTS_USD = { soloq: 10, duoq: 13 };
function rankPos(r, d) { const i = RANKS.indexOf(r); return r === "Master" ? 32 : i * 4 + DIVS.indexOf(d); }

// Valida un username de Discord. No permite mails ni teléfonos.
// Discord: 2-32 chars, letras/números/guiones/puntos/guion_bajo (post-2023 sin #).
function validateDiscord(v) {
  const s = (v || "").trim().replace(/^@/, "");
  if (!s) return "Ingresá tu usuario de Discord.";
  if (/@.*\./.test(s) || /\b[\w.-]+@[\w.-]+\.\w+\b/.test(s)) return "Eso parece un email. Necesitamos tu usuario de Discord.";
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 7 && /^[+\d\s()-]+$/.test(s)) return "Eso parece un teléfono. Necesitamos tu usuario de Discord.";
  if (s.length < 2 || s.length > 32) return "El usuario de Discord tiene entre 2 y 32 caracteres.";
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return "Solo letras, números, puntos, guiones y guion bajo (sin espacios).";
  return null; // válido
}

// URL de op.gg para el summoner. Server: LAS/LAN/NA/BR/EUW/EUNE/KR/OCE. Summoner: "Nombre#TAG" o "Nombre".
function opggUrl(summoner, server) {
  if (!summoner) return null;
  const regionMap = { LAS: "las", LAN: "lan", NA: "na", BR: "br", EUW: "euw", EUNE: "eune", KR: "kr", OCE: "oce" };
  const region = regionMap[server] || "las";
  const s = String(summoner).trim();
  const parts = s.split("#");
  const gameName = encodeURIComponent(parts[0].trim());
  const tag = parts[1] ? encodeURIComponent(parts[1].trim()) : region.toUpperCase();
  return `https://op.gg/lol/summoners/${region}/${gameName}-${tag}`;
}

// % de progreso del servicio a partir del rango inicial, actual y objetivo.
function progressPct(o) {
  if (!o?.progress_rank) return null;
  const from = rankPos(o.cur_rank, o.cur_div || "IV");
  const to = rankPos(o.tgt_rank, o.tgt_div || "IV");
  const now = rankPos(o.progress_rank, o.progress_div || "IV");
  if (to <= from) return null;
  return Math.max(0, Math.min(100, Math.round(((now - from) / (to - from)) * 100)));
}

// Precio de subir UNA sola división desde (rank, div). Retorna { ars, usd }.
function priceOneDivision(rank, div) {
  if (rank === "Diamante") return { ars: PRICE_DIAMANTE_ARS[div] || 0, usd: PRICE_DIAMANTE_USD[div] || 0 };
  return { ars: PRICE_DIV_ARS[rank] || 0, usd: PRICE_DIV_USD[rank] || 0 };
}

// Precio base para ir de (cur, curD) hasta (tgt, tgtD). Suma cada división del trayecto.
function estimateBase(cur, curD, tgt, tgtD) {
  let p = rankPos(cur, curD), to = rankPos(tgt, tgtD), steps = Math.max(0, to - p);
  let ars = 0, usd = 0;
  for (let i = 0; i < steps; i++) {
    const rankIdx = Math.min(7, Math.floor(p / 4));
    const currRank = RANKS[rankIdx];
    const currDiv = DIVS[p % 4];
    const { ars: a, usd: u } = priceOneDivision(currRank, currDiv);
    ars += a; usd += u;
    p++;
  }
  // sin steps (mismo rank+div): cobrar mínimo el equivalente a 1 división de la liga actual
  if (steps === 0) {
    const { ars: a, usd: u } = priceOneDivision(cur, curD);
    ars = a; usd = u;
  }
  return { ars, usd };
}
const fmtARS = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const fmtUSD = (n) => "US$" + (Math.round((n || 0) * 100) / 100).toLocaleString("es-AR");
// Pedido cobrado en USD (tiene monto USD real cargado)
const isUsdOrder = (o) => !!o && o.currency === "usd" && o.usd_amount != null;
// Monto cobrado al cliente respetando la moneda: USD → US$, resto → $ (ARS-equivalente).
const fmtCharged = (o) => isUsdOrder(o) ? fmtUSD(o.usd_amount) : fmtARS(o.price);
// Pago FINAL al booster (siempre en pesos). El descuento del cliente NO lo toca:
// se calcula sobre el precio ARS pre-descuento (price + discount_ars), igual que al asignar/aceptar.
const previewBoosterPay = (o, cut) => Math.round((Number(o.price || 0) + Number(o.discount_ars || 0)) * Number(cut || 0.5));
// Muestra el pago al booster en su moneda: si cobra en USD, convierte con el blue; si no, en pesos.
const fmtBoosterPay = (ars, prof, blue) => (prof && prof.pay_currency === "usd" && blue) ? fmtUSD((Number(ars) || 0) / blue) : fmtARS(ars);
async function openReceipt(path) {
  try {
    const { data } = await supabase.storage.from("comprobantes").createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else alert("No se pudo abrir el comprobante.");
  } catch (e) { alert("No se pudo abrir el comprobante."); }
}
async function fetchBlue() {
  // Dólar blue (cotización informal) — bluelytics
  try {
    const r = await fetch("https://api.bluelytics.com.ar/v2/latest");
    const j = await r.json();
    const v = Number(j?.blue?.value_sell || j?.blue?.value_avg);
    return v > 0 ? v : null;
  } catch (e) { return null; }
}
// Servidores válidos para una cuenta
const ACCOUNT_SERVERS = ["LAS", "LAN", "NA", "BR", "EUW", "EUNE", "KR", "OCE"];
// URL pública de la portada de una cuenta (bucket público "cuentas")
const accCoverUrl = (path) => { try { return path ? supabase.storage.from("cuentas").getPublicUrl(path).data.publicUrl : null; } catch (e) { return null; } };
function svcDuration(o) {
  const start = o.accepted_at || o.created_at;
  const end = o.completed_at;
  if (!start || !end) return "—";
  const days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000));
  return days === 1 ? "1 día" : `${days} días`;
}
// Duración desde que el booster tomó el servicio (accepted_at) hasta que finalizó (o "en curso")
function svcDurationLive(o) {
  if (!o.accepted_at) return "";
  const end = o.completed_at ? new Date(o.completed_at) : new Date();
  const days = Math.max(1, Math.round((end - new Date(o.accepted_at)) / 86400000));
  const label = days === 1 ? "1 día" : `${days} días`;
  return o.completed_at ? label : label + " en curso";
}
function timeAgo(t) {
  const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "hace instantes";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}
const fmtDay = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
// Detecta viewport angosto (celular) para adaptar grillas/tipografías
function useIsMobile(bp = 640) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth <= bp : false);
  useEffect(() => {
    const on = () => setM(window.innerWidth <= bp);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

/* ===================== UI atoms ===================== */
function RankPath({ o }) {
  const pill = (r, d) => (
    <span className="nop-rankpill" style={{ color: RANK_COLOR[r], borderColor: RANK_COLOR[r] + "55", background: RANK_COLOR[r] + "14" }}>
      {r}{r !== "Master" ? " " + d : ""}
    </span>
  );
  if (o.service === "cuenta" || (!o.cur_rank && !o.tgt_rank)) return <span className="nop-mini">—</span>;
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
function SvcTag({ s }) { const S = svcOf(s); const Ic = S.icon; return <span className="nop-svc" style={{ color: S.color, borderColor: S.color + "44" }}><Ic size={12} />{S.label}</span>; }
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
  const [accountRequests, setAccountRequests] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [focusOrder, setFocusOrder] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [lastSeen, setLastSeen] = useState(0);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const reloadRef = useRef(() => {});

  /* sesión */
  useEffect(() => {
    // si el usuario llega desde el mail de recuperación (ruta /reset-password
    // o hash type=recovery), forzamos la pantalla de nueva contraseña aunque
    // el evento PASSWORD_RECOVERY se dispare después del primer render.
    try {
      const onResetRoute = window.location.pathname.replace(/\/+$/, "").endsWith("/reset-password");
      const hasRecoveryHash = window.location.hash.includes("type=recovery");
      if (onResetRoute || hasRecoveryHash) setRecovery(true);
    } catch (e) {}

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
        // recuperar tab del ultimo uso; util cuando iOS mata la webapp al abrir camara
        let savedTab = "";
        try { savedTab = localStorage.getItem("nop_tab_" + data.id) || ""; } catch (e) {}
        const defaultTab = data.role === "admin" ? "validate" : data.role === "booster" ? "board" : "home";
        setTab(savedTab || defaultTab);
      }
    })();
  }, [session]);

  /* persistir tab en localStorage cada vez que cambia (para sobrevivir a un reload) */
  useEffect(() => {
    if (!profile || !tab) return;
    try { localStorage.setItem("nop_tab_" + profile.id, tab); } catch (e) {}
  }, [tab, profile]);

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
    } else {
      // cliente: solo cuentas publicadas para la venta (vista pública, SIN credenciales)
      const { data: acc } = await supabase.from("client_accounts").select("*").order("created_at", { ascending: false });
      setAccounts(acc || []);
      // sus propias solicitudes de compra (para ver estado y credenciales desbloqueadas)
      const { data: myReqs } = await supabase.from("account_requests").select("*").order("created_at", { ascending: false });
      setAccountRequests(myReqs || []);
    }
    if (profile.role === "admin") {
      const { data: pf } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setProfiles(pf || []);
      const { data: reqs } = await supabase.from("account_requests").select("*").order("created_at", { ascending: false });
      setAccountRequests(reqs || []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "account_requests" }, () => reloadRef.current())
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

  const deleteUser = async (u) => {
    const label = u.full_name || u.email || "el usuario";
    const roleLbl = u.role === "booster" ? "booster" : "cliente";

    // seguridad: si es booster, verificar que no tenga trabajos en curso
    if (u.role === "booster") {
      const active = orders.filter((o) => o.booster_id === u.id && (o.status === "in_progress" || o.status === "available"));
      if (active.length > 0) {
        flash(`No se puede eliminar: ${label} tiene ${active.length} trabajo(s) activo(s). Reasignalos o finalizalos primero.`);
        return;
      }
    }

    if (!window.confirm(
      `¿Eliminar al ${roleLbl} "${label}"?\n\n` +
      `• Se borra el perfil de la app y pierde acceso.\n` +
      (u.role === "booster" ? "• Las cuentas de juego que tenía tomadas quedan libres.\n" : "") +
      "• El email queda liberado en Supabase Auth para volver a registrarse.\n\n" +
      "Esta acción no se puede deshacer."
    )) return;

    // 1) si es booster, liberar cuentas en uso para no dejarlas huérfanas
    if (u.role === "booster") {
      await supabase.from("game_accounts")
        .update({ status: "activa", taken_by: null, taken_by_name: null })
        .eq("taken_by", u.id);
    }

    // 2) borrar el perfil
    const { data, error } = await supabase.from("profiles").delete().eq("id", u.id).select();
    if (error) { flash("No se pudo eliminar: " + error.message); return; }
    if (!data || data.length === 0) {
      flash("No se pudo eliminar: falta el permiso (policy) o el usuario tiene registros relacionados que impiden el borrado.");
      return;
    }

    // 3) borrar tambien del auth.users via edge function (para liberar el email)
    try {
      const { error: fnError } = await supabase.functions.invoke("delete-user", {
        body: { action: "delete", target_user_id: u.id },
      });
      if (fnError) console.warn("No se pudo borrar el auth.users:", fnError);
    } catch (e) {
      console.warn("Edge function admin-users falló:", e);
    }

    await reload();
    flash(`${label} eliminado`);
  };

  const editUserAuth = async (u, { email, password }) => {
    const label = u.full_name || u.email || "el usuario";
    if (!email && !password) { flash("No hay cambios para guardar."); return { ok: false }; }
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { action: "update", target_user_id: u.id, email: email || undefined, password: password || undefined },
      });
      if (error) { flash("Error: " + (error.message || "no se pudo actualizar")); return { ok: false }; }
      if (data?.error) { flash("Error: " + data.error); return { ok: false }; }
      await reload();
      flash(`${label} actualizado`);
      return { ok: true };
    } catch (e) {
      flash("Error: " + (e.message || "no se pudo actualizar"));
      return { ok: false };
    }
  };

  const logout = async () => {
    try { if (profile) localStorage.removeItem("nop_tab_" + profile.id); } catch (e) {}
    await supabase.auth.signOut(); setProfile(null); setOrders([]); setNotifs([]); setProfiles([]); setTab("");
  };

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
  const visibleNotifs = notifs.filter((n) => {
    if (profile.role === "admin") return true;
    if (n.recipient_id && n.recipient_id === profile.id) return true;
    if (n.recipient_role && n.recipient_role === profile.role) return true;
    return false;
  });
  const unread = visibleNotifs.filter((n) => new Date(n.created_at).getTime() > lastSeen).length;

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

  const ctx = { profile, orders, profiles, accounts, accountRequests, reload, flash, notify, deleteOrder, deleteUser, editUserAuth };
  const avatarColor = profile.role === "admin" ? "var(--gold)" : profile.role === "booster" ? "var(--cyan)" : "var(--violet)";

  return (
    <>
      <div className="nop-topbar"><div className="nop-shell">
        <div className="nop-topbar-in">
          <div className="nop-logo"><img src="/logo.png" alt="Eloboost Nation" style={{ height: 44, width: "auto", display: "block", maxWidth: "60vw" }} /></div>
          <div className="nop-spacer" />
          <span className="nop-roletag">{profile.role === "admin" ? "Admin" : profile.role === "booster" ? "Booster" : "Cliente"}</span>
          <a className="nop-iconbtn" href={SUPPORT_WA} target="_blank" rel="noreferrer" title="Soporte por WhatsApp" style={{ color: "#25D366" }}><Headset size={17} /></a>
          <button className="nop-iconbtn" onClick={openDrawer}><Bell size={17} />{unread > 0 && <span className="nop-dot">{unread > 9 ? "9+" : unread}</span>}</button>
          <button className="nop-userchip" onClick={() => setShowProfile(true)} title="Mi perfil" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><span className="nm">{profile.full_name || profile.email}</span>
            <span className="nop-avatar" style={{ background: avatarColor }}>{(profile.full_name || "?")[0]?.toUpperCase()}</span></button>
          <button className="nop-iconbtn" onClick={logout} title="Salir"><LogOut size={16} /></button>
        </div>
        <Tabs role={profile.role} tab={tab} setTab={setTab} orders={orders} profiles={profiles} accountRequests={accountRequests} />
      </div></div>

      <div className="nop-shell"><div className="nop-page">
        {profile.role === "admin" && <AdminViews tab={tab} setTab={setTab} {...ctx} />}
        {profile.role === "booster" && <BoosterViews tab={tab} {...ctx} />}
        {profile.role === "cliente" && <ClientViews tab={tab} setTab={setTab} {...ctx} />}
      </div></div>

      {drawer && <Drawer notifs={visibleNotifs} lastSeen={lastSeen} onClose={closeDrawer} onClick={handleNotif} onMarkAll={markSeen} />}
      {showProfile && <ProfileModal profile={profile} onClose={() => setShowProfile(false)} flash={flash} reload={reload} />}
      {focusOrder && <OrderModal o={focusOrder} onClose={() => setFocusOrder(null)} onDelete={profile.role === "admin" ? deleteOrder : null} flash={flash} profiles={profiles} />}
      {toast && <div className="nop-toast"><Check size={16} style={{ color: "var(--grn)" }} />{toast}</div>}
    </>
  );
}

function ProfileModal({ profile, onClose, flash, reload }) {
  const [pass, setPass] = useState(""), [pass2, setPass2] = useState(""), [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(profile.email || "");
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [discord, setDiscord] = useState(profile.discord || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [cbu, setCbu] = useState(profile.cbu || "");
  const [discErr, setDiscErr] = useState("");
  const roleLabel = profile.role === "admin" ? "Administrador" : profile.role === "booster" ? "Booster" : "Cliente";
  const isBooster = profile.role === "booster";
  const saveInfo = async () => {
    setDiscErr("");
    if (discord.trim()) {
      const err = validateDiscord(discord);
      if (err) { setDiscErr(err); return; }
    }
    if (!fullName.trim()) { flash("El nombre no puede estar vacío."); return; }
    setBusy(true);
    try {
      const patch = {
        full_name: fullName.trim(),
        discord: discord.trim() || null,
        phone: phone.trim() || null,
      };
      if (isBooster) patch.cbu = cbu.trim() || null;
      const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
      if (error) throw error;
      // Propagar el nombre a los pedidos existentes del usuario
      if (fullName.trim() !== (profile.full_name || "")) {
        if (profile.role === "cliente") await supabase.from("orders").update({ client_name: fullName.trim() }).eq("client_id", profile.id);
        if (profile.role === "booster") await supabase.from("orders").update({ booster_name: fullName.trim() }).eq("booster_id", profile.id);
      }
      if (email && email !== profile.email) {
        const { error: e2 } = await supabase.auth.updateUser({ email });
        if (e2) throw e2;
        flash("Datos guardados. Te enviamos un mail para confirmar el nuevo correo.");
      } else { flash("Datos actualizados."); }
      if (reload) await reload();
    } catch (e) { flash("No se pudieron actualizar los datos: " + (e.message || "")); }
    setBusy(false);
  };
  const save = async () => {
    if (pass.length < 6) { flash("La contraseña debe tener al menos 6 caracteres."); return; }
    if (pass !== pass2) { flash("Las contraseñas no coinciden."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) { flash("No se pudo actualizar la contraseña."); return; }
    setPass(""); setPass2(""); flash("Contraseña actualizada."); onClose();
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Mi perfil</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span className="nop-avatar" style={{ width: 44, height: 44, fontSize: 18, background: "var(--gold)" }}>{(fullName || "?")[0]?.toUpperCase()}</span>
        <div><b style={{ fontSize: 15 }}>{fullName || "—"}</b><div className="nop-mini">{roleLabel}</div></div>
      </div>

      <div style={{ marginTop: 6 }}>
        <div className="nop-panel-h"><UserCheck size={15} style={{ color: "var(--cyan)" }} />Mis datos</div>
        <div className="nop-field"><label>Nombre</label><input className="nop-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" /></div>
        <div className="nop-field"><label>Email</label><input className="nop-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="nop-field"><label>Usuario de Discord</label>
          <input className="nop-input" value={discord} onChange={(e) => { setDiscord(e.target.value); setDiscErr(""); }} placeholder="Ej: cristian88" />
          {discErr && <p className="nop-mini" style={{ color: "var(--red)", marginTop: 6 }}>{discErr}</p>}
          <p className="nop-mini" style={{ marginTop: 6 }}>Importante para coordinar el servicio con el booster.</p>
        </div>
        <div className="nop-field"><label>Teléfono</label><input className="nop-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 11 2345 6789" /></div>
        {isBooster && <div className="nop-field"><label>CBU / Alias para cobrar</label><input className="nop-input" value={cbu} onChange={(e) => setCbu(e.target.value)} placeholder="Tu CBU o alias" /></div>}
        <button className="nop-btn nop-btn-ghost" style={{ width: "100%" }} disabled={busy} onClick={saveInfo}><Check size={15} />Guardar datos</button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="nop-panel-h"><Shield size={15} style={{ color: "var(--gold)" }} />Cambiar contraseña</div>
        <div className="nop-field"><label>Nueva contraseña</label><input className="nop-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" /></div>
        <div className="nop-field"><label>Repetir contraseña</label><input className="nop-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="••••••••" />
          {pass2 && pass !== pass2 && <p className="nop-mini" style={{ color: "var(--red)", marginTop: 6 }}>No coinciden.</p>}</div>
        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={busy || !pass || pass !== pass2} onClick={save}><Check size={15} />{busy ? "Guardando…" : "Actualizar contraseña"}</button>
      </div>
    </div></div></div>;
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
  const boosterSignup = (() => {
    try {
      const p = new URLSearchParams(window.location.search).get("r");
      const path = window.location.pathname.replace(/\/+$/, "");
      return p === "booster" || path.endsWith("/booster") || window.location.hash === "#booster";
    } catch (e) { return false; }
  })();
  const [mode, setMode] = useState(boosterSignup ? "signup" : "login"); // login | signup | recover
  const [role, setRole] = useState(boosterSignup ? "booster" : "cliente");
  const [fullName, setName] = useState("");
  const [discord, setDiscord] = useState("");
  const [phone, setPhone] = useState("");
  const [cbu, setCbu] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
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
        if (discord && discord.trim()) {
          const derr = validateDiscord(discord);
          if (derr) throw new Error(derr);
        }
        if (role === "cliente" && !discord.trim()) throw new Error("Ingresá tu usuario de Discord (lo necesitás para coordinar el servicio).");
        if (role === "booster" && !cbu) throw new Error("Ingresá tu CBU o alias para cobrar.");
        if (pass !== pass2) throw new Error("Las contraseñas no coinciden.");
        const { data, error } = await supabase.auth.signUp({
          email, password: pass,
          options: {
            data: { full_name: fullName, role, discord, phone, cbu },
            emailRedirectTo: window.location.origin + "/",
          },
        });
        if (error) throw error;
        if (role === "booster") {
          // aviso al admin (best-effort: requiere sesión activa, i.e. confirmación de email desactivada)
          try { await supabase.from("notifications").insert({ text: `Nuevo booster registrado: ${fullName}. Aprobalo o rechazalo en Validaciones.`, recipient_role: "admin", icon: "user", link_type: "validate" }); } catch (e) {}
        }
        if (!data.session) {
          if (role === "booster") setOk("Cuenta creada. 1) Confirmá tu email desde el enlace que te enviamos. 2) Un admin tiene que aprobarte antes de tomar trabajos.");
          else setOk("Cuenta creada. Confirmá tu email desde el enlace que te enviamos y luego iniciá sesión.");
          setMode("login");
        }
        else if (role === "booster") setOk("Cuenta creada. Un administrador tiene que aprobarte antes de tomar trabajos.");
      } else if (mode === "recover") {
        if (!email) throw new Error("Ingresá tu email.");
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
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
        <img src="/logo.png" alt="Eloboost Nation" className="nop-authlogo" />
        <h1 className="nop-display">{boosterSignup ? "Sumate como booster" : "Juega en la liga que realmente mereces"}</h1>
        <p>{boosterSignup ? "Completá tus datos para postularte. Un admin revisa y activa tu cuenta." : mode === "recover" ? title : "Registrate para solicitar tu servicio personalizado y seguilo en tiempo real."}</p>
      </div>
      <div className="nop-card" style={{ padding: 24 }}>
        {!boosterSignup && mode !== "recover" && <div className="nop-authtabs">
          <button className={"nop-authtab" + (mode === "login" ? " on" : "")} onClick={() => { setMode("login"); clear(); }}>Iniciar sesión</button>
          <button className={"nop-authtab" + (mode === "signup" ? " on" : "")} onClick={() => { setMode("signup"); clear(); }}>Crear cuenta</button>
        </div>}
        {err && <div className="nop-err">{err}</div>}
        {ok && <div className="nop-ok">{ok}</div>}

        {mode === "signup" && <>
          <div className="nop-field"><label>{boosterSignup ? "Nombre o nick" : "Nombre de invocador"} <span className="req">*</span></label>
            <input className="nop-input" value={fullName} onChange={(e) => setName(e.target.value)} placeholder={boosterSignup ? "Ej: Alkioz" : "Tu nombre de invocador en LoL"} /></div>
          <div className="nop-row2">
            <div className="nop-field"><label>Teléfono <span className="req">*</span></label>
              <input className="nop-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: +54 9 221 428 7466" /></div>
            <div className="nop-field"><label>Usuario de Discord {role === "cliente" && <span className="req">*</span>}</label>
              <input className="nop-input" value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="Ej: cristian88" /></div>
          </div>
          {role === "cliente" && <p className="nop-mini" style={{ marginTop: -6, marginBottom: 10 }}>Tu usuario de Discord es importante para coordinar el servicio con el booster.</p>}
          {role === "booster" && <div className="nop-field"><label>CBU / Alias para cobrar <span className="req">*</span></label>
            <input className="nop-input" value={cbu} onChange={(e) => setCbu(e.target.value)} placeholder="Tu CBU o alias de Mercado Pago / banco" /></div>}
        </>}

        <div className="nop-field"><label>Email <span className="req">*</span></label>
          <input className="nop-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
            onKeyDown={(e) => e.key === "Enter" && mode === "recover" && submit()} /></div>

        {mode !== "recover" && <div className="nop-field"><label>Contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()} /></div>}

        {mode === "signup" && <div className="nop-field"><label>Confirmar contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Repetí la contraseña"
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          {pass2 && pass !== pass2 && <p className="nop-mini" style={{ color: "var(--red)", marginTop: 6 }}>Las contraseñas no coinciden.</p>}</div>}

        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={busy || !email || (mode !== "recover" && !pass) || (mode === "signup" && pass !== pass2)} onClick={submit}>
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
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr(""); setOk("");
    if (pass.length < 6) { setErr("Mínimo 6 caracteres."); return; }
    if (pass !== pass2) { setErr("Las contraseñas no coinciden."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk("Contraseña actualizada. Entrando…");
    // limpiar hash/token de la URL y volver al home; la sesión de recovery
    // queda como sesión normal, así que la app entra directo al inicio.
    try { window.history.replaceState(null, "", "/"); } catch (e) {}
    setTimeout(() => onDone(), 600);
  };
  return (
    <div className="nop-auth"><div className="nop-authbox">
      <div className="nop-authhead">
        <img src="/logo.png" alt="Eloboost Nation" className="nop-authlogo" />
        <h1 className="nop-display">Nueva contraseña</h1>
        <p>Elegí una contraseña nueva para tu cuenta y volvemos a entrar.</p>
      </div>
      <div className="nop-card" style={{ padding: 24 }}>
        {err && <div className="nop-err">{err}</div>}
        {ok && <div className="nop-ok">{ok}</div>}
        <div className="nop-field"><label>Nueva contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoFocus /></div>
        <div className="nop-field"><label>Repetir contraseña <span className="req">*</span></label>
          <input className="nop-input" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && save()} />
          {pass2 && pass !== pass2 && <p className="nop-mini" style={{ color: "var(--red)", marginTop: 6 }}>Las contraseñas no coinciden.</p>}</div>
        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={busy || !pass || pass !== pass2} onClick={save}>
          {busy ? "Guardando…" : "Guardar y entrar"}<Check size={15} />
        </button>
      </div>
      <p style={{ textAlign: "center", color: "var(--mut2)", fontSize: 12, marginTop: 18 }}>Eloboost Nation · Operaciones internas</p>
    </div></div>
  );
}

/* ===================== TABS ===================== */
function Tabs({ role, tab, setTab, orders, profiles, accountRequests }) {
  const T = (id, label, Icon, badge) => (
    <button className={"nop-tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
      <Icon className="ic" size={16} />{label}{badge ? <span style={{ background: "var(--gold)", color: "#1a1305", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 7px" }}>{badge}</span> : null}
    </button>
  );
  if (role === "admin") {
    const reqPend = (accountRequests || []).filter((r) => r.status === "pending").length;
    const pend = orders.filter((o) => o.status === "pending").length + profiles.filter((p) => p.role === "booster" && p.status === "pending").length + reqPend;
    return <div className="nop-tabs">
      {T("validate", "Validaciones", ShieldCheck, pend || null)}
      {T("dash", "Dashboard", Activity)}
      {T("orders", "Pedidos", Hash)}
      {T("users", "Usuarios", Users)}
      {T("promos", "Promos", Tag)}
      {T("finance", "Contable", Wallet)}
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
  return <div className="nop-tabs">{T("home", "Mi pedido", Activity)}{T("new", "Solicitar servicio", Plus)}{T("accounts", "Cuentas", Gamepad2)}{T("hist", "Historial", Trophy)}</div>;
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
  if (tab === "promos") return <AdminPromos {...ctx} />;
  if (tab === "finance") return <AdminFinance {...ctx} />;
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

function AdminValidate({ orders, profiles, accountRequests, reload, flash, notify }) {
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pendingBoosters = profiles.filter((p) => p.role === "booster" && p.status === "pending");
  const pendingReqs = (accountRequests || []).filter((r) => r.status === "pending");
  const [expanded, setExpanded] = useState({});

  const validateReq = async (r) => {
    // desbloquear credenciales: copiar usuario/contraseña de la cuenta a la solicitud del cliente
    let gu = null, gp = null;
    if (r.account_id != null) {
      const { data: acc } = await supabase.from("game_accounts").select("login_user, login_pass").eq("id", r.account_id).single();
      gu = acc?.login_user || null; gp = acc?.login_pass || null;
    }
    await supabase.from("account_requests").update({ status: "validated", granted_user: gu, granted_pass: gp, validated_at: new Date().toISOString() }).eq("id", r.id);
    // marcar la cuenta como vendida (sale del catálogo)
    if (r.account_id != null) await supabase.from("game_accounts").update({ status: "deshabilitada" }).eq("id", r.account_id);
    // registrar la venta como pedido (aparece en la pestaña Pedidos y en Contable)
    let ordWarn = "";
    try {
      const { error: ordErr } = await supabase.from("orders").insert({
        client_id: r.client_id || null, client_name: r.client_name || "—", client_discord: r.client_discord || null,
        service: "cuenta", server: r.account_server || null,
        role_champ: r.account_title || "Cuenta",
        notes: `Venta de cuenta: ${r.account_title || ""}`.trim(),
        price: Number(r.account_price_ars || 0),
        currency: r.currency || "ars",
        usd_amount: r.currency === "usd" ? (r.account_price_usd ?? null) : null,
        status: "completed", summoner: r.account_title || null,
        booster_id: null, booster_pay: 0, profit: Number(r.account_price_ars || 0),
        receipt_path: r.receipt_path || null,
        completed_at: new Date().toISOString(),
      });
      if (ordErr) ordWarn = " (no se registró en Pedidos: " + ordErr.message + ")";
    } catch (e) { ordWarn = " (no se registró en Pedidos)"; }
    if (r.client_id) { try { await notify(`✅ Tu compra de "${r.account_title}" fue validada. Ya tenés el usuario y la contraseña en la pestaña Cuentas.`, null, r.client_id, "done"); } catch (e) {} }
    await reload(); flash("Compra validada · credenciales desbloqueadas" + ordWarn);
  };
  const rejectReq = async (r) => {
    if (!window.confirm(`¿Rechazar la compra de "${r.account_title}" de ${r.client_name}?`)) return;
    await supabase.from("account_requests").update({ status: "rejected" }).eq("id", r.id);
    if (r.client_id) { try { await notify(`❌ Tu compra de "${r.account_title}" no pudo validarse. Escribinos si tenés dudas.`, null, r.client_id, "warn"); } catch (e) {} }
    await reload(); flash("Solicitud rechazada");
  };
  const viewReqReceipt = async (r) => {
    if (!r.receipt_path) { flash("Esta solicitud no tiene comprobante."); return; }
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(r.receipt_path, 3600);
    if (error || !data) { flash("No se pudo abrir el comprobante."); return; }
    window.open(data.signedUrl, "_blank");
  };
  const deleteReq = async (r) => {
    if (!window.confirm("¿Eliminar esta solicitud de cuenta?")) return;
    await supabase.from("account_requests").delete().eq("id", r.id);
    await reload(); flash("Solicitud eliminada");
  };

  const validateOrder = async (o) => {
    await supabase.from("orders").update({ status: "available" }).eq("id", o.id);
    await notify(`🆕 Nuevo cliente disponible: ${o.client_name} — ${SERVICES[o.service].label}.`, "booster", null, "new", "order", o.id);
    await reload(); flash(`Pedido #${o.id} validado y publicado`);
  };
  const rejectOrder = async (o) => {
    if (!window.confirm(`¿Rechazar el pedido #${o.id} de ${o.client_name}?\n\nEl cliente será notificado y el pedido queda cancelado.`)) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    await notify(`❌ Tu pedido fue rechazado. Contactá al equipo si tenés dudas.`, null, o.client_id, "warn", "order", o.id);
    await reload(); flash(`Pedido #${o.id} rechazado`);
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
      "🔥 *NUEVO SERVICIO DISPONIBLE* 🔥",
      "🏆 Eloboost Nation", "",
      `🎮 *Servicio:* ${SERVICES[o.service].label}`,
      `📈 *Rango:* ${rankText(o)}`,
      `🌎 *Servidor:* ${o.server || "-"}`,
      `💰 *Tu pago:* ${fmtARS(pay)}`, "",
      "⚡ *Entrá a la app y tomalo antes que otro:*",
      `🔗 ${link}`,
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

    {pendingReqs.length > 0 && <div className="nop-card nop-panel" style={{ marginBottom: 16, borderColor: "var(--gold)" }}>
      <div className="nop-panel-h"><Gamepad2 size={15} style={{ color: "var(--gold)" }} />Compras de cuentas por validar ({pendingReqs.length})</div>
      <div style={{ display: "grid", gap: 10 }}>{pendingReqs.map((r) => (
        <div className="nop-card nop-panel" key={r.id} style={{ background: "var(--bg2)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Gamepad2 size={18} style={{ color: "var(--gold)" }} />
            <div>
              <b style={{ fontSize: 13 }}>{r.account_title || "Cuenta"}</b>
              <div className="nop-mini">{r.account_rank || "—"}{r.account_server ? ` · ${r.account_server}` : ""}
                {r.currency === "usd" ? (r.account_price_usd ? ` · ${fmtUSD(r.account_price_usd)} (PayPal)` : " · USD (PayPal)") : (r.account_price_ars ? ` · ${fmtARS(r.account_price_ars)} (transf.)` : " · ARS (transf.)")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <div className="nop-mini" style={{ color: "var(--mut2)" }}>Solicitó</div>
              <b style={{ fontSize: 13 }}>{r.client_name || "—"}</b>
              <div className="nop-mini">{r.client_discord || ""}</div>
            </div>
            <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => viewReqReceipt(r)} disabled={!r.receipt_path}><FileText size={13} />{r.receipt_path ? "Comprobante" : "Sin comprob."}</button>
            <button className="nop-btn nop-btn-grn nop-btn-sm" onClick={() => validateReq(r)}><Check size={14} />Validar</button>
            <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => rejectReq(r)}><X size={13} />Rechazar</button>
            <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={() => deleteReq(r)}><Trash2 size={13} /></button>
          </div>
        </div>))}</div>
    </div>}

    <div className="nop-card nop-panel" style={{ marginBottom: 16 }}>
      <div className="nop-panel-h"><UserCheck size={15} style={{ color: "var(--cyan)" }} />Boosters por aprobar ({pendingBoosters.length})</div>
      {pendingBoosters.length === 0 ? <p className="nop-mini">No hay boosters esperando aprobación.</p> :
        <div style={{ display: "grid", gap: 10 }}>{pendingBoosters.map((p) => <BoosterApprove key={p.id} p={p} onAccept={acceptBooster} onReject={rejectBooster} />)}</div>}
    </div>

    <div className="nop-card nop-panel">
      <div className="nop-panel-h"><ShieldCheck size={15} style={{ color: "var(--gold)" }} />Pedidos por validar ({pendingOrders.length})</div>
      {pendingOrders.length === 0 ? <Empty icon={ShieldCheck} title="Todo al día" sub="No hay pedidos esperando validación." /> :
        <div style={{ display: "grid", gap: 12 }}>{pendingOrders.map((o) => (
          <div className="nop-card nop-panel" key={o.id} style={{ background: "var(--bg2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ color: "var(--mut)" }}>#{o.id}</b><SvcTag s={o.service} /><ExtrasTags o={o} /><RankPath o={o} />
                <div><b style={{ fontSize: 13 }}>{o.client_name}</b><div className="nop-mini">{o.client_discord} · {o.server} · {o.payment}</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <b className="nop-display" style={{ color: "var(--gold)" }}>{fmtCharged(o)}</b>
                <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setExpanded((e) => ({ ...e, [o.id]: !e[o.id] }))}>{expanded[o.id] ? <><ChevronRight size={13} style={{ transform: "rotate(90deg)" }} />Ocultar</> : <><ChevronRight size={13} />Ver detalle</>}</button>
                <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => viewReceipt(o)} disabled={!o.receipt_path}><FileText size={14} />{o.receipt_path ? "Comprobante" : "Sin comprobante"}</button>
                <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => validateOrder(o)}><Check size={14} />Validar</button>
                <button className="nop-btn nop-btn-wa nop-btn-sm" onClick={() => validateAndShare(o)}><Send size={14} />Validar y avisar</button>
                <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={() => rejectOrder(o)}><X size={14} />Rechazar</button>
              </div>
            </div>
            {expanded[o.id] && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px 20px" }}>
              <VF k="Cliente" v={o.client_name} />
              <VF k="Discord" v={o.client_discord || "—"} />
              <VF k="Servicio" v={SERVICES[o.service]?.label || o.service} />
              <VF k="Servidor" v={o.server} />
              {!["coaching", "single_match", "placements"].includes(o.service) && <VF k="Recorrido" v={`${o.cur_rank} ${o.cur_div || ""} → ${o.tgt_rank} ${o.tgt_div || ""}`} />}
              {["coaching", "single_match", "placements"].includes(o.service) && <VF k="Liga actual" v={`${o.cur_rank} ${o.cur_div || ""}`} />}
              {o.lp && <VF k="Ganancia LP" v={o.lp} />}
              {o.games != null && <VF k="Partidas" v={o.games} />}
              {o.role_champ && cleanRoleDetail(o.role_champ) && <VF k="Rol / detalle" v={cleanRoleDetail(o.role_champ)} full />}
              {o.summoner && <VF k="Invocador" v={<span>{o.summoner}{opggUrl(o.summoner, o.server) && <> · <a href={opggUrl(o.summoner, o.server)} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>op.gg</a></>}</span>} />}
              {o.pref_days && <VF k="Días preferidos" v={o.pref_days} />}
              {o.pref_times && <VF k="Horarios" v={o.pref_times} />}
              <VF k="Pago" v={o.payment} />
              {o.currency === "usd" && <VF k="Monto USD" v={fmtUSD(o.usd_amount)} />}
              {o.promo_code_text && <VF k="Código promo" v={`${o.promo_code_text}${o.discount_ars ? " (−" + fmtARS(o.discount_ars) + ")" : ""}`} />}
              {o.service === "eloboost" && (o.acct_user || o.acct_pass) && <VF k="Credenciales" v="🔑 Cargadas (se asignan al validar)" full />}
              {o.notes && <VF k="Notas del cliente" v={o.notes} full />}
            </div>}
          </div>))}</div>}
    </div>
  </>;
}
function VF({ k, v, full }) {
  return <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
    <div className="nop-mini" style={{ color: "var(--mut2)", marginBottom: 2 }}>{k}</div>
    <div style={{ fontSize: 13, wordBreak: "break-word" }}>{v}</div>
  </div>;
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
function AdminClients({ profiles, orders, deleteUser }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  let clients = profiles.filter((p) => p.role === "cliente");
  if (q) { const nq = q.toLowerCase().trim(); clients = clients.filter((p) => ((p.full_name || "") + " " + (p.email || "") + " " + (p.phone || "") + " " + (p.discord || "")).toLowerCase().includes(nq)); }
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
  const onDelete = async (c, e) => {
    e.stopPropagation();
    await deleteUser(c);
    setOpen(null);
  };
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Clientes</h1>
      <p className="nop-sub">Usuarios registrados y su actividad. Tocá una fila para ver el detalle. · <b style={{ color: "var(--tx)" }}>{profiles.filter((p) => p.role === "cliente").length} clientes registrados</b></p></div></div>
    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div style={{ position: "relative", maxWidth: 320 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--mut2)" }} />
        <input className="nop-input" style={{ paddingLeft: 36 }} placeholder="Buscar por nombre, email o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
    </div>
    <div className="nop-card nop-panel">
      {clients.length === 0 ? <Empty icon={Users} title="Sin clientes todavía" sub="Cuando alguien se registre como cliente, aparece acá." /> :
        <div className="nop-tablewrap"><table className="nop-t">
          <thead><tr><th>Cliente</th><th>Email</th><th>Registrado</th><th>Activos</th><th>En espera</th><th>Completados</th><th>Gastado</th><th></th></tr></thead>
          <tbody>{clients.map((c) => { const s = statsOf(c.id); return (
            <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setOpen({ c, s, orders: orders.filter((o) => o.client_id === c.id) })}>
              <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><span className="nop-avatar" style={{ background: "var(--violet)" }}>{(c.full_name || "?")[0]?.toUpperCase()}</span><b>{c.full_name || "—"}</b></div></td>
              <td className="nop-mini">{c.email}</td>
              <td className="nop-mini">{fmtDay(c.created_at)}</td>
              <td><span style={{ color: "var(--violet)", fontWeight: 600 }}>{s.activos}</span></td>
              <td><span style={{ color: "var(--amber)", fontWeight: 600 }}>{s.espera}</span></td>
              <td><span style={{ color: "var(--grn)", fontWeight: 600 }}>{s.completados}</span></td>
              <td style={{ color: "var(--gold)" }}>{fmtARS(s.gasto)}</td>
              <td>
                <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={(e) => onDelete(c, e)} title="Eliminar cliente"><Trash2 size={13} /></button>
              </td>
            </tr>); })}</tbody>
        </table></div>}
    </div>
    {open && <ClientDetailModal data={open} onClose={() => setOpen(null)} onDelete={deleteUser ? async () => { await deleteUser(open.c); setOpen(null); } : null} />}
  </>;
}
function ClientDetailModal({ data, onClose, onDelete }) {
  const { c, s, orders } = data;
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>{c.full_name || "Cliente"}</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini">Email</span><span style={{ fontSize: 13 }}>{c.email}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini">Teléfono</span><span style={{ fontSize: 13 }}>{c.phone || "—"}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini">Discord</span><span style={{ fontSize: 13 }}>{c.discord || "—"}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini">Registrado</span><span style={{ fontSize: 13 }}>{fmtDay(c.created_at)}</span></div>
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
            <b style={{ fontSize: 13 }}>{fmtCharged(o)}</b>
          </div>))}</div>}
      {onDelete && <button className="nop-btn nop-btn-danger" style={{ width: "100%", marginTop: 16 }} onClick={onDelete}><Trash2 size={15} />Eliminar cliente</button>}
    </div>
  </div></div>;
}

function AdminDash({ orders, profiles, reload, flash, notify, deleteOrder }) {
  const [month, setMonth] = useState("all");
  const [assignFor, setAssignFor] = useState(null); // orden a la que le vamos a asignar booster
  const [detail, setDetail] = useState(null); // orden abierta en detalle

  const monthKey = (d) => { if (!d) return null; const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
  const monthLabel = (k) => { const [y, m] = k.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); };
  const months = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => { const k = monthKey(o.completed_at || o.created_at); if (k) set.add(k); });
    return Array.from(set).sort().reverse();
  }, [orders]);
  const inMonth = (d) => month === "all" || monthKey(d) === month;

  // Facturación empieza al VALIDAR el pedido: available + in_progress + completed cuentan.
  // Para el mes, usamos la fecha de creación (o completed_at si lo tiene).
  const isBilled = (o) => o.status === "available" || o.status === "in_progress" || o.status === "completed";
  const billed = orders.filter((o) => isBilled(o) && inMonth(o.completed_at || o.created_at));
  const completed = orders.filter((o) => o.status === "completed" && inMonth(o.completed_at || o.created_at));
  const scopedAll = orders.filter((o) => inMonth(o.completed_at || o.created_at));
  // Facturación = suma de ganancias netas (precio - pago booster). Si no tiene booster asignado aún, la ganancia = precio.
  const facturacion = billed.reduce((a, o) => a + (Number(o.price) - Number(o.booster_pay || 0)), 0);
  const ganancia = facturacion; // mismo valor: ganancia neta acumulada
  const ratings = completed.filter((o) => o.survey_rating).map((o) => o.survey_rating);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const byService = Object.keys(SERVICES).map((k) => ({ name: SERVICES[k].label, value: scopedAll.filter((o) => o.service === k).length, color: SERVICES[k].color }));

  // operativo en vivo (no depende del mes)
  const liveActive = orders.filter((o) => o.status === "in_progress");
  const liveQueue = orders.filter((o) => o.status === "available"); // en cola = validados sin booster
  // Boosters reales (excluye cuentas de prueba)
  const boosters = profiles.filter((p) => p.role === "booster" && p.status === "active" && !isTestBooster(p));
  const load = boosters.map((b) => ({ ...b, n: liveActive.filter((o) => o.booster_id === b.id).length }));

  // capacidad: ratio servicios activos por booster activo
  const ratio = boosters.length > 0 ? liveActive.length / boosters.length : 0;
  const capacity = boosters.length === 0
    ? { color: "var(--mut2)", label: "Sin boosters activos" }
    : ratio < 3
      ? { color: "var(--cyan)", label: `Podemos tomar más · ${ratio.toFixed(1)}/booster` }
      : ratio < 5
        ? { color: "var(--grn)", label: `Carga óptima · ${ratio.toFixed(1)}/booster` }
        : { color: "var(--red)", label: `Saturado · ${ratio.toFixed(1)}/booster` };

  const assignBooster = async (order, booster) => {
    // El pago del booster se calcula sobre el precio ORIGINAL (antes del descuento del promo).
    // El descuento se descuenta de la ganancia, no del pago del booster.
    const originalPrice = Number(order.price) + Number(order.discount_ars || 0);
    const pay = Math.round(originalPrice * Number(booster.cut || 0.5));
    const { error } = await supabase.from("orders")
      .update({ status: "in_progress", booster_id: booster.id, booster_name: booster.full_name, booster_pay: pay, profit: Number(order.price) - pay, accepted_at: new Date().toISOString() })
      .eq("id", order.id).eq("status", "available");
    if (error) { flash("No se pudo asignar: " + error.message); return; }
    await notify(`Se te asignó el pedido #${order.id} (${order.client_name}).`, null, booster.id, "new", "order", order.id);
    await notify(`¡Tenés booster! ${booster.full_name} tomó tu servicio.`, null, order.client_id, "done", "order", order.id);
    setAssignFor(null);
    await reload();
    flash(`Pedido #${order.id} asignado a ${booster.full_name}`);
  };

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
      {kpi("Facturación (ganancia neta)", fmtARS(facturacion), Wallet, "var(--gold)", periodo + " · validados en adelante")}
      {kpi("Servicios facturados", billed.filter((o) => !o.is_refund).length, TrendingUp, "var(--grn)", `${completed.filter((o) => !o.is_refund).length} cerrados`)}
      {kpi("Servicios cerrados", completed.filter((o) => !o.is_refund).length, Trophy, "var(--cyan)", periodo)}
      {kpi("Servicios activos", liveActive.length, Zap, capacity.color, boosters.length > 0 ? capacity.label : "Cargá boosters para ver capacidad")}
    </div>
    <div className="nop-twocol" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
      <div className="nop-card nop-panel">
        <div className="nop-panel-h"><Activity size={15} style={{ color: "var(--gold)" }} />Carga por booster (ahora)</div>
        {load.length === 0 ? <p className="nop-mini">Todavía no hay boosters activos.</p> :
          <div className="nop-flowbar">{load.map((b) => {
            const tag = b.n >= 5 ? ["Saturado", "var(--red)"] : b.n >= 3 ? ["Ideal", "var(--grn)"] : b.n >= 1 ? ["Liviano", "var(--cyan)"] : ["Libre", "var(--mut2)"];
            return <div className="nop-flowrow" key={b.id}><span className="nm">{b.full_name || b.email}</span>
              <div className="nop-flowtrack"><div className="nop-flowfill" style={{ width: Math.min(100, b.n * 20 + (b.n ? 12 : 0)) + "%", background: tag[1] }} /></div>
              <span className="nop-flowtag" style={{ color: tag[1] }}>{b.n} · {tag[0]}</span></div>; })}</div>}
        <p className="nop-mini" style={{ marginTop: 14 }}>Libre 0 · Liviano 1–2 · Ideal 3–4 · Saturado 5+.</p>
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
            <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setDetail(o)}>
              <td className="nop-mini">#{o.id}</td>
              <td><b style={{ fontSize: 13 }}>{o.client_name}</b></td>
              <td><SvcTag s={o.service} /></td>
              <td><RankBadge r={o.cur_rank} d={o.cur_div} /></td>
              <td>{o.service === "coaching" ? <span className="nop-mini">—</span> : <RankBadge r={o.tgt_rank} d={o.tgt_div} />}</td>
              <td className="nop-mini">{o.booster_name || "—"}</td>
              <td style={{ color: "var(--gold)", fontWeight: 600 }}>{fmtCharged(o)}</td>
              <td style={{ color: "var(--cyan)" }}>{fmtARS(o.booster_pay)}</td>
              <td style={{ color: "var(--grn)", fontWeight: 600 }}>{fmtARS(o.profit)}</td>
            </tr>))}</tbody>
        </table></div>}
    </div>

    <div className="nop-card nop-panel" style={{ marginTop: 14 }}>
      <div className="nop-panel-h"><Clock size={15} style={{ color: "var(--amber)" }} />Pedidos en cola — sin booster ({liveQueue.length})</div>
      {liveQueue.length === 0 ? <p className="nop-mini">No hay pedidos esperando booster.</p> :
        <div className="nop-tablewrap"><table className="nop-t">
          <thead><tr><th>#</th><th>Cliente</th><th>Servicio</th><th>Liga actual</th><th>Objetivo</th><th>Booster</th><th>Monto</th><th>Espera</th></tr></thead>
          <tbody>{liveQueue.map((o) => (
            <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setDetail(o)}>
              <td className="nop-mini">#{o.id}</td>
              <td><b style={{ fontSize: 13 }}>{o.client_name}</b></td>
              <td><SvcTag s={o.service} /></td>
              <td><RankBadge r={o.cur_rank} d={o.cur_div} /></td>
              <td>{o.service === "coaching" ? <span className="nop-mini">—</span> : <RankBadge r={o.tgt_rank} d={o.tgt_div} />}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <button className="nop-btn nop-btn-gold nop-btn-sm" onClick={() => setAssignFor(o)}><UserCheck size={13} />Asignar</button>
              </td>
              <td style={{ color: "var(--gold)", fontWeight: 600 }}>{fmtCharged(o)}</td>
              <td className="nop-mini">{timeAgo(o.created_at)}</td>
            </tr>))}</tbody>
        </table></div>}
    </div>

    {assignFor && <div className="nop-modal" onClick={() => setAssignFor(null)}>
      <div className="nop-card nop-modalbox" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="hd"><h3>Asignar pedido #{assignFor.id}</h3><button className="nop-iconbtn" onClick={() => setAssignFor(null)}><X size={16} /></button></div>
        <div className="bd">
          <p className="nop-mini" style={{ marginBottom: 14 }}>Cliente: <b style={{ color: "var(--tx)" }}>{assignFor.client_name}</b> · {SERVICES[assignFor.service].label} · {fmtCharged(assignFor)}</p>
          <div className="nop-mini" style={{ marginBottom: 8 }}>Elegí el booster que se hace cargo:</div>
          <div style={{ display: "grid", gap: 8 }}>
            {boosters.length === 0
              ? <div className="nop-mini" style={{ color: "var(--red)" }}>No hay boosters activos disponibles.</div>
              : boosters.map((b) => {
                const currentLoad = liveActive.filter((o) => o.booster_id === b.id).length;
                const pay = previewBoosterPay(assignFor, b.cut);
                return (
                  <button key={b.id} className="nop-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: "var(--bg2)", border: "1px solid var(--line)", textAlign: "left" }} onClick={() => assignBooster(assignFor, b)}>
                    <div>
                      <b style={{ fontSize: 14 }}>{b.full_name}</b>
                      <div className="nop-mini">Corte {Math.round((b.cut || 0.5) * 100)}% · {currentLoad} activos</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="nop-mini">Cobra</div>
                      <b style={{ color: "var(--cyan)" }}>{fmtARS(pay)}</b>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>}
    {detail && <OrderModal o={detail} onClose={() => setDetail(null)} onDelete={deleteOrder} onEdited={reload} flash={flash} profiles={profiles} />}
  </>;
}
function AdminOrders({ orders, profiles, reload, flash, deleteOrder, notify }) {
  const [f, setF] = useState("todos");
  const [fServer, setFServer] = useState("todos");
  const [fService, setFService] = useState("todos");
  const [fBooster, setFBooster] = useState("todos");
  const [fMonth, setFMonth] = useState("todos");
  const [q, setQ] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const boosters = (profiles || []).filter((p) => p.role === "booster");
  const mKey = (d) => { if (!d) return null; const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
  const mLabel = (k) => { const [y, m] = k.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); };
  const availMonths = Array.from(new Set(orders.map((o) => mKey(o.created_at)).filter(Boolean))).sort().reverse();
  // Prioridad: in_progress → available → pending → completed → cancelled
  const statusPrio = { in_progress: 0, available: 1, pending: 2, completed: 3, cancelled: 4 };
  let list = orders.slice().sort((a, b) => {
    const pa = statusPrio[a.status] ?? 9, pb = statusPrio[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  if (f !== "todos") list = list.filter((o) => o.status === f);
  if (fServer !== "todos") list = list.filter((o) => o.server === fServer);
  if (fService !== "todos") list = list.filter((o) => o.service === fService);
  if (fBooster !== "todos") list = list.filter((o) => (fBooster === "unassigned" ? !o.booster_id : o.booster_id === fBooster));
  if (fMonth !== "todos") list = list.filter((o) => mKey(o.created_at) === fMonth);
  if (q) list = list.filter((o) => (o.client_name + (o.client_discord || "") + o.id).toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Pedidos</h1><p className="nop-sub">Todos los servicios, en cualquier estado. Se muestran primero los activos y disponibles.</p></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="nop-btn nop-btn-gold nop-btn-sm" onClick={() => setShowNew(true)}><Plus size={14} />Nuevo pedido</button>
        <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setShowReports(true)}><FileText size={14} />Reportes</button>
        <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setShowImport(true)}><Upload size={14} />Carga masiva</button>
      </div></div>
    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--mut2)" }} />
          <input className="nop-input" style={{ paddingLeft: 36 }} placeholder="Buscar cliente o #ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="nop-select" style={{ width: "auto", minWidth: 130 }} value={f} onChange={(e) => setF(e.target.value)}>
          <option value="todos">Estado: Todos</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="nop-select" style={{ width: "auto", minWidth: 130 }} value={fService} onChange={(e) => setFService(e.target.value)}>
          <option value="todos">Servicio: Todos</option>
          {Object.keys(SERVICES).map((k) => <option key={k} value={k}>{SERVICES[k].label}</option>)}
          <option value="cuenta">Cuentas</option>
        </select>
        <select className="nop-select" style={{ width: "auto", minWidth: 120 }} value={fServer} onChange={(e) => setFServer(e.target.value)}>
          <option value="todos">Servidor: Todos</option>
          <option value="LAS">LAS</option><option value="LAN">LAN</option><option value="NA">NA</option><option value="BR">BR</option>
        </select>
        <select className="nop-select" style={{ width: "auto", minWidth: 140 }} value={fBooster} onChange={(e) => setFBooster(e.target.value)}>
          <option value="todos">Booster: Todos</option>
          <option value="unassigned">Sin asignar</option>
          {boosters.map((b) => <option key={b.id} value={b.id}>{b.full_name || b.email}</option>)}
        </select>
        <select className="nop-select" style={{ width: "auto", minWidth: 130 }} value={fMonth} onChange={(e) => setFMonth(e.target.value)}>
          <option value="todos">Mes: Todos</option>
          {availMonths.map((k) => <option key={k} value={k}>{mLabel(k)}</option>)}
        </select>
      </div>
    </div>
    <div className="nop-card nop-panel">
      {list.length === 0 ? <Empty icon={Hash} title="Sin resultados" sub="Probá con otro filtro." />
        : <OrdersTable orders={list} onDelete={deleteOrder} onEdited={reload} flash={flash} profiles={profiles} cols={["id", "cliente", "rank", "servicio", "booster", "precio", "pago", "ganancia", "estado"]} />}
    </div>
    {showImport && <BulkImportModal profiles={profiles || []} reload={reload} flash={flash} onClose={() => setShowImport(false)} />}
    {showReports && <ReportsModal orders={orders} flash={flash} onClose={() => setShowReports(false)} />}
    {showNew && <NewOrderModal profiles={profiles || []} reload={reload} flash={flash} notify={notify} onClose={() => setShowNew(false)} />}
  </>;
}

function NewOrderModal({ profiles, reload, flash, notify, onClose }) {
  const clients = profiles.filter((p) => p.role === "cliente");
  const boosters = profiles.filter((p) => p.role === "booster" && p.status === "active");
  const [clientId, setClientId] = useState("");
  const [clientNameManual, setClientNameManual] = useState("");
  const [clientDiscordManual, setClientDiscordManual] = useState("");
  const [service, setService] = useState("eloboost");
  const [cur, setCur] = useState("Oro"), [curD, setCurD] = useState("IV");
  const [tgt, setTgt] = useState("Platino"), [tgtD, setTgtD] = useState("IV");
  const [server, setServer] = useState("LAS");
  const [games, setGames] = useState(3);
  const [summoner, setSummoner] = useState("");
  const [notes, setNotes] = useState("");
  const [priceManual, setPriceManual] = useState("");
  const [currency, setCurrency] = useState("ars");
  const [usdManual, setUsdManual] = useState("");          // monto USD que se le cobra al cliente (PayPal)
  const [blue, setBlue] = useState(null);
  useEffect(() => { if (currency === "usd" && !blue) fetchBlue().then(setBlue); }, [currency]);
  const [assign, setAssign] = useState("");                // booster_id
  const [entryType, setEntryType] = useState("servicio");  // 'servicio' | 'devolucion'
  const [boosterPayManual, setBoosterPayManual] = useState(""); // pago al booster (para devoluciones)
  const isRefund = entryType === "devolucion";
  const [payment, setPayment] = useState("Transferencia (pesos)");
  const [placementMode, setPlacementMode] = useState("soloq");
  const [protectDec, setProtectDec] = useState(false);
  const [busy, setBusy] = useState(false);

  const isCoach = service === "coaching";
  const isElo = service === "eloboost";
  const isSingleMatch = service === "single_match";
  const isPlacements = service === "placements";
  const isTft = service === "tft";
  const noTgt = isCoach || isSingleMatch || isPlacements;
  const priceAuto = useMemo(() => {
    if (isCoach) return COACHING_PRICE[games];
    if (isSingleMatch) return protectDec && PROTECT_ELIGIBLE_RANKS.includes(cur) ? SINGLE_MATCH_PROTECT_ARS : singleMatchPrice(cur, games).ars;
    if (isPlacements) return PLACEMENTS_ARS[placementMode] || 0;
    const base = estimateBase(cur, curD, tgt, tgtD).ars;
    if (isTft) return Math.round(base * 0.8 / 100) * 100;       // TFT 20% más barato
    return base;
  }, [service, cur, curD, tgt, tgtD, games, isCoach, isSingleMatch, isPlacements, isTft, placementMode, protectDec]);
  const finalPrice = priceManual ? Number(priceManual) : priceAuto;

  const shareWhatsApp = (orderId, clientName, booster) => {
    const link = window.location.origin;
    const rangoTxt = isCoach || isSingleMatch || isPlacements ? `${cur}${cur !== "Master" ? " " + curD : ""}` : `${cur} ${curD} → ${tgt} ${tgt !== "Master" ? tgtD : ""}`;
    const msg = [
      booster ? "🎯 *TRABAJO ASIGNADO* 🎯" : "🔥 *NUEVO SERVICIO DISPONIBLE* 🔥",
      "🏆 Eloboost Nation", "",
      `👤 *Cliente:* ${clientName}`,
      `🎮 *Servicio:* ${SERVICES[service].label}`,
      `📈 *Rango:* ${rangoTxt}`,
      `🌎 *Servidor:* ${server}`,
      booster ? `👉 *Asignado a:* ${booster.full_name}` : "",
      "",
      "⚡ *Entrá a la app:*",
      `🔗 ${link}`,
    ].filter(Boolean).join("\n");
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  const save = async (opts = {}) => {
    // Cliente: si eligió uno de la lista, tomo sus datos; si no, uso los manuales
    let cliId = null, cliName = clientNameManual.trim(), cliDiscord = clientDiscordManual.trim();
    if (clientId) {
      const c = clients.find((x) => x.id === clientId);
      if (c) { cliId = c.id; cliName = c.full_name; cliDiscord = c.discord || c.email; }
    }
    if (!cliName) { flash("Elegí un cliente o ingresá el nombre manualmente."); return; }
    if (isRefund) {
      if (!assign) { flash("En una devolución tenés que asignar el booster que la rehace."); return; }
      if (!Number(boosterPayManual)) { flash("Ingresá el pago al booster de la devolución."); return; }
    } else if (!finalPrice || finalPrice <= 0) { flash("Ingresá un precio válido."); return; }

    setBusy(true);
    // Si se asigna a booster, el status pasa directo a in_progress
    const boosterProfile = assign ? boosters.find((b) => b.id === assign) : null;
    const status = boosterProfile ? "in_progress" : "available";
    // Devolución: precio 0 (sin ingreso), el booster cobra igual → la ganancia es la pérdida.
    const priceForRow = isRefund ? 0 : Number(finalPrice);
    const boosterPay = isRefund
      ? Math.round(Number(boosterPayManual) || 0)
      : (boosterProfile ? Math.round(Number(finalPrice) * Number(boosterProfile.cut || 0.5)) : null);
    // Pedido en USD: guardo el monto en dólares (lo que se cobra por PayPal).
    // Si no lo cargaron a mano, lo estimo con el dólar blue a partir del precio ARS.
    let usdAmt = null, fxRate = null;
    if (currency === "usd" && !isRefund) {
      usdAmt = usdManual ? Number(usdManual) : (blue ? Math.round((Number(finalPrice) / blue) * 100) / 100 : null);
      fxRate = blue || null;
    }

    const row = {
      client_id: cliId, client_name: cliName, client_discord: cliDiscord,
      service, cur_rank: cur, cur_div: curD,
      tgt_rank: noTgt ? cur : tgt, tgt_div: noTgt ? curD : tgtD,
      server, lp: noTgt ? null : "0-30",
      games: isCoach ? games : isSingleMatch ? (protectDec ? 4 : games) : isPlacements ? 5 : null,
      role_champ: isCoach ? `Sin preferencia · ${games} partida${games > 1 ? "s" : ""}`
        : isSingleMatch ? (protectDec ? "Pack protección decaimiento · 4 partidas" : `${games} partida${games > 1 ? "s" : ""}`)
        : isPlacements ? `Placements ${placementMode.toUpperCase()} · 5 partidas`
        : "",
      notes: notes || (isRefund ? "Devolución creada por admin." : "Pedido creado por admin (sin comprobante)."),
      payment, price: priceForRow, status,
      receipt_path: null,
      summoner: summoner || null,
      currency, usd_amount: usdAmt, fx_rate: fxRate,
      is_refund: isRefund,
      booster_id: boosterProfile?.id || null,
      booster_name: boosterProfile?.full_name || null,
      booster_pay: boosterPay,
      profit: boosterProfile ? (priceForRow - Number(boosterPay || 0)) : null,
      accepted_at: boosterProfile ? new Date().toISOString() : null,
    };
    const { data: created, error } = await supabase.from("orders").insert(row).select("id").single();
    setBusy(false);
    if (error) { flash("Error: " + error.message); return; }

    // Notificar
    if (boosterProfile) {
      await notify(`🎯 Nuevo trabajo asignado: ${cliName} — ${SERVICES[service].label}.`, null, boosterProfile.id, "new", "order", created.id);
    } else {
      await notify(`🆕 Nuevo cliente disponible: ${cliName} — ${SERVICES[service].label}.`, "booster", null, "new", "order", created.id);
    }

    if (opts.whatsapp) shareWhatsApp(created.id, cliName, boosterProfile);
    await reload();
    flash(`Pedido #${created.id} creado${boosterProfile ? " y asignado a " + boosterProfile.full_name : " (disponible para tomar)"}`);
    onClose();
  };

  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
    <div className="hd"><h3>Nuevo pedido</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      {/* Tipo de registro */}
      <div className="nop-field"><label>Tipo</label>
        <div className="nop-segwrap" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button type="button" className={"nop-seg" + (entryType === "servicio" ? " on" : "")} onClick={() => setEntryType("servicio")}>Servicio</button>
          <button type="button" className={"nop-seg" + (entryType === "devolucion" ? " on" : "")} onClick={() => setEntryType("devolucion")}>Devolución</button>
        </div>
        <div className="nop-mini" style={{ marginTop: 6 }}>{isRefund ? "Devolución: el booster cobra igual, no genera ingreso (es pérdida) y no suma al conteo de servicios del dashboard." : "Servicio normal contratado por un cliente."}</div>
      </div>
      {/* Cliente */}
      <div className="nop-field"><label>Cliente</label>
        <select className="nop-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">— Ingresar manualmente —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
        </select>
        <div className="nop-mini" style={{ marginTop: 6 }}>Elegí uno existente o cargá los datos abajo.</div>
      </div>
      {!clientId && (
        <div className="nop-row2">
          <div className="nop-field"><label>Nombre <span className="req">*</span></label>
            <input className="nop-input" value={clientNameManual} onChange={(e) => setClientNameManual(e.target.value)} placeholder="Ej: Juan Pérez" /></div>
          <div className="nop-field"><label>Discord / Email</label>
            <input className="nop-input" value={clientDiscordManual} onChange={(e) => setClientDiscordManual(e.target.value)} placeholder="Ej: juan#1234" /></div>
        </div>
      )}

      {/* Servicio */}
      <div className="nop-field"><label>Servicio <span className="req">*</span></label>
        <div className="nop-segwrap" style={{ marginBottom: 0, gridTemplateColumns: "repeat(3,1fr)" }}>
          {["eloboost", "duoboost", "tft", "coaching", "single_match", "placements"].map((k) => (
            <button key={k} type="button" className={"nop-seg" + (service === k ? " on" : "")} onClick={() => setService(k)}>{SERVICES[k].label}</button>
          ))}
        </div>
      </div>

      {/* Rangos / partidas / modalidad según servicio */}
      {!noTgt ? (
        <div className="nop-row2">
          <div className="nop-field"><label>Rango actual</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
              {cur !== "Master" && <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>}
            </div>
          </div>
          <div className="nop-field"><label>Rango objetivo</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select className="nop-select" value={tgt} onChange={(e) => setTgt(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
              {tgt !== "Master" && <select className="nop-select" value={tgtD} onChange={(e) => setTgtD(e.target.value)}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>}
            </div>
          </div>
        </div>
      ) : isCoach ? (
        <div className="nop-row2">
          <div className="nop-field"><label>Rango actual</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
              {cur !== "Master" && <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>}
            </div>
          </div>
          <div className="nop-field"><label>Partidas</label>
            <select className="nop-select" value={games} onChange={(e) => setGames(Number(e.target.value))}>
              <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option>
            </select>
          </div>
        </div>
      ) : isSingleMatch ? (
        <>
          <div className="nop-row2">
            <div className="nop-field"><label>Rango actual</label>
              <div style={{ display: "flex", gap: 6 }}>
                <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
                {cur !== "Master" && <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>}
              </div>
            </div>
            <div className="nop-field"><label>Paquete</label>
              <select className="nop-select" value={games} onChange={(e) => setGames(Number(e.target.value))} disabled={protectDec}>
                {SINGLE_MATCH_OPTIONS.map((o) => <option key={o.games} value={o.games}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {PROTECT_ELIGIBLE_RANKS.includes(cur) && (
            <div className="nop-field">
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                <input type="checkbox" checked={protectDec} onChange={(e) => setProtectDec(e.target.checked)} /> 🛡️ Protección de decaimiento (4 partidas · $14.400)
              </label>
            </div>
          )}
        </>
      ) : isPlacements ? (
        <div className="nop-field"><label>Modalidad</label>
          <div className="nop-segwrap" style={{ marginBottom: 0 }}>
            <button type="button" className={"nop-seg" + (placementMode === "soloq" ? " on" : "")} onClick={() => setPlacementMode("soloq")}>SoloQ</button>
            <button type="button" className={"nop-seg" + (placementMode === "duoq" ? " on" : "")} onClick={() => setPlacementMode("duoq")}>DuoQ</button>
          </div>
        </div>
      ) : null}

      <div className="nop-row2">
        <div className="nop-field"><label>Servidor</label>
          <select className="nop-select" value={server} onChange={(e) => setServer(e.target.value)}>
            <option>LAS</option><option>LAN</option><option>BR</option>
          </select></div>
        <div className="nop-field"><label>Summoner (opcional)</label>
          <input className="nop-input" value={summoner} onChange={(e) => setSummoner(e.target.value)} placeholder="Ej: Fakality#OTP" /></div>
      </div>

      {/* Precio (solo servicio) */}
      {!isRefund && <>
      <div className="nop-row2">
        <div className="nop-field"><label>{currency === "usd" ? "Precio en ARS (equiv. · pago booster)" : "Precio"} (sugerido: {fmtARS(priceAuto)})</label>
          <input className="nop-input" type="number" value={priceManual} onChange={(e) => setPriceManual(e.target.value)} placeholder={String(priceAuto)} /></div>
        <div className="nop-field"><label>Moneda / Pago</label>
          <select className="nop-select" value={payment} onChange={(e) => { setPayment(e.target.value); setCurrency(e.target.value.includes("PayPal") ? "usd" : "ars"); }}>
            <option>Transferencia (pesos)</option>
            <option>PayPal (USD)</option>
            <option>Otro</option>
          </select></div>
      </div>
      {currency === "usd" && (
        <div className="nop-field"><label>Monto cobrado en USD {blue ? `(sugerido: ${fmtUSD(Math.round((Number(finalPrice) / blue) * 100) / 100)})` : ""}</label>
          <input className="nop-input" type="number" step="0.01" value={usdManual} onChange={(e) => setUsdManual(e.target.value)} placeholder={blue ? String(Math.round((Number(finalPrice) / blue) * 100) / 100) : "USD"} />
          <div className="nop-mini" style={{ marginTop: 6 }}>Lo que cobrás por PayPal. Si lo dejás vacío, se estima con el dólar blue{blue ? ` (${fmtARS(blue)})` : ""}. El pago al booster sale del precio en ARS.</div>
        </div>
      )}
      </>}
      {isRefund && (
        <div className="nop-field"><label>Pago al booster por la devolución (ARS) <span className="req">*</span></label>
          <input className="nop-input" type="number" value={boosterPayManual} onChange={(e) => setBoosterPayManual(e.target.value)} placeholder="Ej: 17500" />
          <div className="nop-mini" style={{ marginTop: 6 }}>Sin ingreso (precio $0). La ganancia queda en <b style={{ color: "var(--red)" }}>−{fmtARS(Number(boosterPayManual) || 0)}</b> (pérdida). No suma al conteo de servicios.</div>
        </div>
      )}

      {/* Asignación */}
      <div className="nop-field"><label>Asignar a booster (opcional)</label>
        <select className="nop-select" value={assign} onChange={(e) => setAssign(e.target.value)}>
          <option value="">— Dejar disponible para que lo tomen —</option>
          {boosters.map((b) => <option key={b.id} value={b.id}>{b.full_name} · corte {Math.round((b.cut || 0.5) * 100)}%</option>)}
        </select>
        <div className="nop-mini" style={{ marginTop: 6 }}>Si asignás, el pedido va directo a "En curso" para ese booster.</div>
      </div>

      <div className="nop-field"><label>Notas internas</label>
        <textarea className="nop-ta" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cualquier dato adicional…" /></div>

      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        <button className="nop-btn nop-btn-ghost" style={{ flex: 1, minWidth: 120 }} onClick={onClose}>Cancelar</button>
        <button className="nop-btn nop-btn-wa" style={{ flex: 1, minWidth: 120 }} disabled={busy} onClick={() => save({ whatsapp: true })}><Send size={14} />Guardar y avisar WA</button>
        <button className="nop-btn nop-btn-gold" style={{ flex: 1, minWidth: 120 }} disabled={busy} onClick={() => save({})}>{busy ? "Guardando…" : "Guardar pedido"}<Check size={15} /></button>
      </div>
    </div>
  </div></div>;
}

function parseCSV(text) {
  const rows = []; let i = 0, field = "", row = [], inQ = false;
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => (x || "").trim() !== ""));
}
function ReportsModal({ orders, flash, onClose }) {
  const mKey = (d) => { if (!d) return null; const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
  const mLabel = (k) => { const [y, m] = k.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR") : "";
  const done = orders.filter((o) => o.status === "completed");
  const months = useMemo(() => {
    const s = new Set(); done.forEach((o) => { const k = mKey(o.completed_at || o.created_at); if (k) s.add(k); });
    return Array.from(s).sort().reverse();
  }, [orders]);
  const [sel, setSel] = useState(months.length ? [months[0]] : []);
  const [open, setOpen] = useState(false);
  const toggle = (k) => setSel(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);
  const rows = done.filter((o) => sel.includes(mKey(o.completed_at || o.created_at))).sort((a, b) => new Date(a.completed_at || 0) - new Date(b.completed_at || 0));
  const totPrice = rows.reduce((a, o) => a + Number(o.price || 0), 0);
  const totPay = rows.reduce((a, o) => a + Number(o.booster_pay || 0), 0);
  const totProfit = rows.reduce((a, o) => a + Number(o.profit || 0), 0);

  const esc = (v) => { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const download = () => {
    if (!rows.length) { flash("No hay servicios en los meses elegidos."); return; }
    const head = ["#", "Usuario", "Discord", "Invocador", "Servicio", "Liga inicial", "Liga objetivo", "Servidor", "Rol/Detalle", "Booster", "Fecha inicio", "Fecha fin", "Duración", "Estado pago", "Moneda", "Precio (ARS)", "Cobrado USD", "Pago booster (ARS)", "Ganancia (ARS)"];
    const lines = [head.join(";")];
    rows.forEach((o) => {
      lines.push([
        o.id, o.client_name, o.client_discord, o.summoner, SERVICES[o.service]?.label || o.service,
        `${o.cur_rank || ""} ${o.cur_div || ""}`.trim(), `${o.tgt_rank || ""} ${o.tgt_div || ""}`.trim(),
        o.server, o.role_champ, o.booster_name,
        fmtDate(o.accepted_at), fmtDate(o.completed_at), svcDuration(o),
        o.booster_paid ? "Pagado" : "Pendiente", (o.currency || "ars").toUpperCase(),
        Math.round(o.price || 0), o.currency === "usd" ? (o.usd_amount || "") : "", Math.round(o.booster_pay || 0), Math.round(o.profit || 0),
      ].map(esc).join(";"));
    });
    lines.push(""); lines.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "TOTALES", Math.round(totPrice), "", Math.round(totPay), Math.round(totProfit)].map(esc).join(";"));
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `reporte-eloboost-${sel.slice().sort().join("_")}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    flash(`Reporte descargado (${rows.length} servicios).`);
  };

  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Reporte de servicios</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <p className="nop-mini" style={{ marginBottom: 12 }}>Elegí uno o varios meses. El reporte incluye todos los servicios finalizados con: booster, fechas de inicio y fin, estado de pago, precio, cobrado en USD, pago al booster y ganancia.</p>
      {months.length === 0 ? <Empty icon={FileText} title="Sin servicios finalizados" sub="Todavía no hay datos para reportar." /> : <>
        <div className="nop-field"><label>Meses a incluir</label>
          <div style={{ position: "relative" }}>
            <button type="button" className="nop-select" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => setOpen((v) => !v)}>
              {sel.length === 0 ? "Elegí uno o más meses…" : sel.length === months.length ? "Todos los meses" : `${sel.length} ${sel.length === 1 ? "mes seleccionado" : "meses seleccionados"}`}
              <ChevronRight size={15} style={{ float: "right", transform: open ? "rotate(90deg)" : "none", transition: ".2s" }} />
            </button>
            {open && <div className="nop-card" style={{ position: "absolute", zIndex: 5, top: "calc(100% + 6px)", left: 0, right: 0, maxHeight: 240, overflowY: "auto", padding: 8, boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 13, textTransform: "none" }}>
                <input type="checkbox" checked={sel.length === months.length} onChange={() => setSel(sel.length === months.length ? [] : [...months])} /> Todos los meses</label>
              {months.map((k) => <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", cursor: "pointer", textTransform: "capitalize", fontSize: 13 }}>
                <input type="checkbox" checked={sel.includes(k)} onChange={() => toggle(k)} /> {mLabel(k)}</label>)}
            </div>}
          </div>
        </div>
        <div className="nop-card" style={{ padding: 14, background: "var(--bg2)", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span className="nop-mini">Servicios</span><b>{rows.length}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span className="nop-mini">Facturado (ARS)</span><b style={{ color: "var(--gold)" }}>{fmtARS(totPrice)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span className="nop-mini">Pago a boosters</span><b style={{ color: "var(--cyan)" }}>{fmtARS(totPay)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span className="nop-mini">Ganancia</span><b style={{ color: "var(--grn)" }}>{fmtARS(totProfit)}</b></div>
        </div>
        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={!rows.length} onClick={download}><FileText size={15} />Descargar CSV ({rows.length} servicios)</button>
      </>}
    </div></div></div>;
}
function BulkImportModal({ profiles, reload, flash, onClose }) {
  const [rows, setRows] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [map, setMap] = useState({}); // nombreCSVnormalizado -> boosterId ("" = sin asignar)
  const [names, setNames] = useState([]); // [{raw, norm}]
  const boosters = profiles.filter((p) => p.role === "booster");
  const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const svcMap = { duoboost: "duoboost", coaching: "coaching", tft: "tft", eloboost: "eloboost", single_match: "single_match", singlematch: "single_match", "single match": "single_match", placements: "placements", posicionamiento: "placements" };
  const parseRank = (s) => {
    const parts = (s || "").trim().split(/\s+/);
    const rank = RANKS.find((r) => r.toLowerCase() === (parts[0] || "").toLowerCase()) || parts[0] || "";
    const div = (parts[1] || "IV").toUpperCase();
    return [rank, DIVS.includes(div) ? div : "IV"];
  };
  const parseDate = (s) => {
    s = (s || "").trim(); if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) { let [_, d, mo, y] = m; if (y.length === 2) y = "20" + y; return new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`).toISOString(); }
    return null;
  };
  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = parseCSV(String(r.result).replace(/^\uFEFF/, ""));
        const head = parsed[0].map((h) => h.trim().toLowerCase());
        const idx = (name) => head.indexOf(name);
        const need = ["tipo_servicio", "liga_inicial", "fecha", "pago_booster", "booster"];
        const missing = need.filter((n) => idx(n) < 0);
        if (missing.length) { setErrors(["Faltan columnas: " + missing.join(", ")]); setRows(null); return; }
        const hasTgt = idx("liga_objetivo") >= 0;
        const hasModal = idx("modalidad") >= 0;
        const hasPart = idx("partidas") >= 0;
        const errs = []; const out = []; const nameSet = {};
        parsed.slice(1).forEach((r2, n) => {
          const svcRaw = (r2[idx("tipo_servicio")] || "").trim().toLowerCase().replace(/\s+/g, "");
          const service = svcMap[svcRaw];
          const [cr, cd] = parseRank(r2[idx("liga_inicial")]);
          // servicios sin liga objetivo: coaching, placements, single_match
          const noTgt = service === "coaching" || service === "placements" || service === "single_match";
          let tr = cr, td = cd;
          if (!noTgt) {
            const tgtRaw = hasTgt ? r2[idx("liga_objetivo")] : "";
            if (!tgtRaw || !tgtRaw.trim()) {
              errs.push(`Fila ${n + 2}: falta liga_objetivo para ${service}`);
              return;
            }
            [tr, td] = parseRank(tgtRaw);
          }
          const fecha = parseDate(r2[idx("fecha")]);
          const pago = Number((r2[idx("pago_booster")] || "").replace(/[^\d.-]/g, ""));
          const bname = (r2[idx("booster")] || "").trim();
          const modalidad = hasModal ? (r2[idx("modalidad")] || "").trim().toLowerCase() : "";
          const partidas = hasPart ? Number((r2[idx("partidas")] || "").replace(/[^\d]/g, "")) : 0;
          if (!service) { errs.push(`Fila ${n + 2}: servicio inválido "${svcRaw}"`); return; }
          if (!fecha) { errs.push(`Fila ${n + 2}: fecha inválida`); return; }
          if (!pago) { errs.push(`Fila ${n + 2}: pago_booster inválido`); return; }
          const nb = norm(bname); if (bname) nameSet[nb] = bname;
          // Detalles según servicio
          let games = null, role_champ = "Carga histórica";
          if (service === "coaching") { games = partidas || 3; role_champ = `Coaching histórico · ${games} partida${games > 1 ? "s" : ""}`; }
          if (service === "single_match") { games = partidas || 1; role_champ = `Single Match · ${games} partida${games > 1 ? "s" : ""}`; }
          if (service === "placements") { games = 5; const m = modalidad === "duoq" ? "DUOQ" : "SOLOQ"; role_champ = `Placements ${m} · 5 partidas`; }
          out.push({ service, cur_rank: cr, cur_div: cd, tgt_rank: tr, tgt_div: td, price: pago, fecha, bnorm: nb, bname, games, role_champ });
        });
        const distinct = Object.entries(nameSet).map(([nb, raw]) => ({ norm: nb, raw }));
        const initMap = {};
        distinct.forEach((d) => { const b = boosters.find((x) => norm(x.full_name) === d.norm); initMap[d.norm] = b?.id || ""; });
        setNames(distinct); setMap(initMap); setErrors(errs); setRows(out);
      } catch (e) { setErrors(["No se pudo leer el archivo. ¿Es un CSV válido?"]); setRows(null); }
    };
    r.readAsText(file, "utf-8");
  };
  const doImport = async () => {
    if (!rows || !rows.length) return;
    setBusy(true);
    const clean = rows.map((o) => {
      const bId = map[o.bnorm] || null;
      const b = boosters.find((x) => x.id === bId);
      return {
        client_id: null, client_name: "Histórico", client_discord: null,
        service: o.service, cur_rank: o.cur_rank, cur_div: o.cur_div, tgt_rank: o.tgt_rank, tgt_div: o.tgt_div, server: "LAS",
        role_champ: o.role_champ, games: o.games, price: o.price, booster_pay: o.price, profit: 0,
        status: "completed", completed_at: o.fecha, accepted_at: o.fecha,
        booster_id: bId, booster_name: b?.full_name || o.bname || "—",
        booster_paid: true, booster_paid_ccy: "ars", currency: "ars",
      };
    });
    const { error } = await supabase.from("orders").insert(clean);
    setBusy(false);
    if (error) { flash("No se pudo importar: " + error.message); return; }
    await reload(); flash(`Se importaron ${clean.length} servicios.`); onClose();
  };
  const wipeHistoric = async () => {
    if (!window.confirm("¿Borrar TODOS los servicios cargados como 'Histórico'? Esto no toca los pedidos reales.")) return;
    setBusy(true);
    const { error } = await supabase.from("orders").delete().eq("client_name", "Histórico");
    setBusy(false);
    if (error) { flash("No se pudieron borrar."); return; }
    await reload(); flash("Cargas históricas borradas.");
  };
  const assignedCount = (rows || []).filter((o) => map[o.bnorm]).length;
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Carga masiva de servicios</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <p className="nop-mini" style={{ marginBottom: 12 }}>Columnas obligatorias: <b>tipo_servicio, liga_inicial, fecha, pago_booster, booster</b>. Opcionales: <b>liga_objetivo</b> (necesaria para eloboost/duoboost/combo), <b>modalidad</b> (para placements: soloq/duoq), <b>partidas</b> (para coaching/single_match). Servicios válidos: eloboost, duoboost, combo, coaching, single_match, placements. Ligas "Oro IV". Fecha AAAA-MM-DD o DD/MM/AAAA. Se cargan como finalizados y pagados, con cliente "Histórico".</p>
      <label className="nop-upload" style={{ marginBottom: 14 }}>
        <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
        <Upload size={18} /><span>Elegir archivo CSV</span>
      </label>
      {errors.length > 0 && <div className="nop-card" style={{ padding: 12, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", marginBottom: 12 }}>
        {errors.slice(0, 8).map((e, i) => <div key={i} className="nop-mini" style={{ color: "#f87171" }}>{e}</div>)}
        {errors.length > 8 && <div className="nop-mini">…y {errors.length - 8} más</div>}
      </div>}
      {rows && rows.length > 0 && <>
        <div style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>Asigná cada nombre del CSV a un booster</b>
          <p className="nop-mini" style={{ margin: "4px 0 10px" }}>Verificá que cada nombre quede vinculado. Si queda "— sin asignar —", el servicio se crea pero no aparece en el historial de ningún booster.</p>
          {names.map((d) => <div key={d.norm} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{d.raw}</span>
            <ArrowRight size={13} style={{ color: "var(--mut2)" }} />
            <select className="nop-select" style={{ width: 190 }} value={map[d.norm] || ""} onChange={(e) => setMap({ ...map, [d.norm]: e.target.value })}>
              <option value="">— sin asignar —</option>
              {boosters.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
            </select>
          </div>)}
        </div>
        <div className="nop-card" style={{ padding: 12, background: "var(--bg2)", marginBottom: 12 }}>
          <b style={{ fontSize: 14 }}>{rows.length} servicios · {assignedCount} vinculados a un booster</b>
        </div>
        <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} disabled={busy} onClick={doImport}><Check size={15} />{busy ? "Importando…" : `Importar ${rows.length} servicios`}</button>
      </>}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12, textAlign: "center" }}>
        <button className="nop-linkbtn" style={{ color: "var(--red)" }} disabled={busy} onClick={wipeHistoric}>Borrar servicios "Histórico" ya cargados</button>
      </div>
    </div></div></div>;
}

function AdminBoosters({ orders, profiles, reload, flash, deleteUser, editUserAuth }) {
  const boosters = profiles.filter((p) => p.role === "booster");
  const completed = orders.filter((o) => o.status === "completed");
  const active = orders.filter((o) => o.status === "in_progress");
  const [editing, setEditing] = useState(null);
  const [noting, setNoting] = useState(null);
  const [blue, setBlue] = useState(null);
  useEffect(() => { fetchBlue().then(setBlue); }, []);
  const setCut = async (p, cut) => { await supabase.from("profiles").update({ cut }).eq("id", p.id); await reload(); flash(`Corte de ${p.full_name} → ${Math.round(cut * 100)}%`); };
  const setStatus = async (p, status) => { await supabase.from("profiles").update({ status }).eq("id", p.id); await reload(); flash(`${p.full_name}: ${status}`); };
  const setPayCcy = async (p, ccy) => { await supabase.from("profiles").update({ pay_currency: ccy }).eq("id", p.id); await reload(); flash(`${p.full_name} cobra en ${ccy === "usd" ? "USD" : "pesos"}`); };
  const statusLabel = (s) => s === "active" ? "Habilitado" : s === "interrupted" ? "Interrumpido" : s === "disabled" ? "Deshabilitado" : s === "pending" ? "Pendiente" : s;
  const statusColor = (s) => s === "active" ? "s-completed" : s === "interrupted" ? "s-pending" : s === "pending" ? "s-pending" : "s-cancelled";

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Boosters</h1><p className="nop-sub">Equipo, cortes, estado y desempeño. Las altas se aprueban desde Validaciones. · <b style={{ color: "var(--tx)" }}>{boosters.length} boosters registrados</b></p></div></div>
    <div className="nop-card nop-panel"><div className="nop-tablewrap"><table className="nop-t">
      <thead><tr><th>Booster</th><th>Estado</th><th>Corte</th><th>Cobro</th><th>Activos</th><th>Hechos</th><th>Pagado</th><th>★</th><th>Acción</th></tr></thead>
      <tbody>{boosters.map((b) => {
        const done = completed.filter((o) => o.booster_id === b.id);
        const paid = done.reduce((a, o) => a + Number(o.booster_pay || 0), 0);
        const rs = done.filter((o) => o.survey_rating).map((o) => o.survey_rating);
        const avg = rs.length ? (rs.reduce((a, c) => a + c, 0) / rs.length).toFixed(1) : "—";
        return <tr key={b.id}>
          <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><span className="nop-avatar" style={{ background: "var(--cyan)" }}>{(b.full_name || "?")[0]}</span><div><b>{b.full_name || "—"}</b><div className="nop-mini">{b.email}</div><div className="nop-mini" style={{ color: "var(--mut2)" }}>Alta: {fmtDay(b.created_at)}</div></div></div></td>
          <td>
            <select className="nop-select" style={{ width: 130, padding: "6px 8px", fontSize: 12, borderColor: b.status === "active" ? "var(--grn)" : b.status === "interrupted" ? "var(--amber)" : b.status === "disabled" ? "var(--red)" : "var(--line)" }} value={b.status || "pending"} onChange={(e) => setStatus(b, e.target.value)}>
              <option value="active">✅ Habilitado</option>
              <option value="interrupted">⚠️ Interrumpido</option>
              <option value="disabled">🚫 Deshabilitado</option>
              {b.status === "pending" && <option value="pending">Pendiente</option>}
            </select>
          </td>
          <td><select className="nop-select" style={{ width: 84, padding: "6px 8px" }} value={b.cut} onChange={(e) => setCut(b, parseFloat(e.target.value))}>{[0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7].map((c) => <option key={c} value={c}>{Math.round(c * 100)}%</option>)}</select></td>
          <td><select className="nop-select" style={{ width: 92, padding: "6px 8px", fontSize: 12 }} value={b.pay_currency || "ars"} onChange={(e) => setPayCcy(b, e.target.value)}><option value="ars">Pesos</option><option value="usd">USD</option></select></td>
          <td>{active.filter((o) => o.booster_id === b.id).length}</td>
          <td>{done.length}</td>
          <td style={{ color: "var(--gold)", fontWeight: 600 }}>{fmtBoosterPay(paid, b, blue)}</td>
          <td>{avg !== "—" ? avg + " ★" : "—"}</td>
          <td>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {editUserAuth && <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setEditing(b)} title="Editar email/contraseña"><Settings size={13} />Editar</button>}
              <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setNoting(b)} title="Notas del admin (privadas)" style={{ position: "relative" }}>
                <FileText size={13} />Nota
                {b.admin_note && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: 999, background: "var(--gold)" }} />}
              </button>
              {deleteUser && <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={() => deleteUser(b)} title="Eliminar booster"><Trash2 size={13} /></button>}
            </div>
          </td>
        </tr>; })}</tbody>
    </table></div></div>
    {editing && <EditAuthModal user={editing} onClose={() => setEditing(null)} onSave={editUserAuth} />}
    {noting && <AdminNoteModal user={noting} onClose={() => setNoting(null)} reload={reload} flash={flash} />}
  </>;
}

function AdminNoteModal({ user, onClose, reload, flash }) {
  const [note, setNote] = useState(user.admin_note || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      admin_note: note.trim() || null,
      admin_note_updated_at: note.trim() ? new Date().toISOString() : null,
    }).eq("id", user.id);
    setBusy(false);
    if (error) { flash("No se pudo guardar: " + error.message); return; }
    await reload();
    flash(note.trim() ? "Nota actualizada" : "Nota borrada");
    onClose();
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Nota interna — {user.full_name}</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <p className="nop-mini" style={{ marginBottom: 12 }}>Solo la ven los admins. El booster nunca ve esta nota.</p>
      {user.admin_note_updated_at && <p className="nop-mini" style={{ marginBottom: 12, color: "var(--mut2)" }}>Última actualización: {new Date(user.admin_note_updated_at).toLocaleString("es-AR")}</p>}
      <textarea className="nop-ta" rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Le debemos $X del mes pasado. Reincidente en devolver pedidos." />
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="nop-btn nop-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className="nop-btn nop-btn-gold" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar nota"}<Check size={15} /></button>
      </div>
    </div>
  </div></div>;
}

function EditAuthModal({ user, onClose, onSave }) {
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const emailChanged = email && email !== user.email;
    const passwordChanged = password && password.length > 0;
    if (!emailChanged && !passwordChanged) { onClose(); return; }
    if (passwordChanged && password.length < 6) { alert("La contraseña debe tener al menos 6 caracteres."); return; }
    setBusy(true);
    const res = await onSave(user, { email: emailChanged ? email : null, password: passwordChanged ? password : null });
    setBusy(false);
    if (res?.ok) onClose();
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Editar {user.full_name || "usuario"}</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div className="nop-field"><label>Email</label>
        <input className="nop-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="nop-mini" style={{ marginTop: 6 }}>Se actualiza también en el perfil de la app.</div>
      </div>
      <div className="nop-field"><label>Nueva contraseña</label>
        <input className="nop-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Dejar vacío para no cambiar" />
        <div className="nop-mini" style={{ marginTop: 6 }}>Mínimo 6 caracteres. Si dejás vacío, no se toca.</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="nop-btn nop-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className="nop-btn nop-btn-gold" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar cambios"}<Check size={15} /></button>
      </div>
    </div>
  </div></div>;
}

function AdminHistory({ orders, deleteOrder, flash, profiles }) {
  const done = orders.filter((o) => o.status === "completed");
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Historial</h1><p className="nop-sub">Servicios finalizados y reseñas.</p></div></div>
    <div className="nop-card nop-panel">
      {done.length === 0 ? <Empty icon={Trophy} title="Todavía no hay cierres" sub="Aparecen acá cuando un booster finaliza." />
        : <OrdersTable orders={done} onDelete={deleteOrder} flash={flash} profiles={profiles} cols={["id", "cliente", "rank", "servicio", "booster", "precio", "ganancia", "rating"]} />}
    </div>
  </>;
}

/* ===== tabla compartida ===== */
function OrdersTable({ orders, cols, onDelete, hideProfit, onEdited, flash, profiles }) {
  const [open, setOpen] = useState(null);
  const head = { id: "#", cliente: "Cliente", rank: "Recorrido", servicio: "Servicio", booster: "Booster", precio: "Precio", pago: "Pago booster", ganancia: "Ganancia", estado: "Estado", rating: "Reseña" };
  return <>
    <div className="nop-tablewrap"><table className="nop-t">
      <thead><tr>{cols.map((c) => <th key={c}>{head[c]}</th>)}</tr></thead>
      <tbody>{orders.map((o) => <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setOpen(o)}>{cols.map((c) => <td key={c}>{cell(c, o)}</td>)}</tr>)}</tbody>
    </table></div>
    {open && <OrderModal o={open} onClose={() => setOpen(null)} onDelete={onDelete} hideProfit={hideProfit} onEdited={onEdited} flash={flash} profiles={profiles} />}
  </>;
}
function ExtrasTags({ o }) {
  if (!o.role_champ) return null;
  const hasRol = /Rol:/i.test(o.role_champ);
  const hasChamp = /Camp[eé]on:/i.test(o.role_champ);
  const hasExpress = /Express/i.test(o.role_champ) || /⚡/.test(o.role_champ);
  if (!hasRol && !hasChamp && !hasExpress) return null;
  return <>
    {hasRol && <span className="nop-svc" style={{ background: "rgba(232,179,73,.15)", borderColor: "var(--gold)", color: "var(--gold)", fontSize: 11 }}>🎯 Rol</span>}
    {hasChamp && <span className="nop-svc" style={{ background: "rgba(232,179,73,.15)", borderColor: "var(--gold)", color: "var(--gold)", fontSize: 11 }}>🧙 Camp.</span>}
    {hasExpress && <span className="nop-svc" style={{ background: "rgba(168,85,247,.15)", borderColor: "var(--violet)", color: "var(--violet)", fontSize: 11 }}>⚡ Express</span>}
  </>;
}
function cell(c, o) {
  switch (c) {
    case "id": return <b style={{ color: "var(--mut)" }}>#{o.id}</b>;
    case "cliente": return <><b>{o.client_name}</b><div className="nop-mini">{o.client_discord}</div></>;
    case "rank": return <RankPath o={o} />;
    case "servicio": return <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}><SvcTag s={o.service} /><ExtrasTags o={o} /></div>;
    case "booster": return o.booster_name || <span className="nop-mini">Sin asignar</span>;
    case "precio": return <b>{fmtCharged(o)}</b>;
    case "pago": return <span style={{ color: "var(--cyan)" }}>{fmtARS(o.booster_pay)}</span>;
    case "ganancia": return <span style={{ color: "var(--grn)" }}>{fmtARS(o.profit)}</span>;
    case "estado": return <StatusBadge s={o.status} />;
    case "rating": return o.survey_rating ? <span style={{ color: "var(--gold)" }}>{"★".repeat(o.survey_rating)}</span> : <span className="nop-mini">—</span>;
    default: return null;
  }
}
function cleanRoleDetail(s) {
  if (!s) return s;
  return String(s)
    .replace(/[·•]\s*⚡?\s*Express/gi, "")
    .replace(/⚡\s*Express/gi, "")
    .replace(/[·•]\s*LP\s*[+\-]?\d+/gi, "")
    .replace(/\s*LP\s*[+\-]?\d+\s*$/gi, "")
    .replace(/\s*[·•]\s*$/g, "")
    .replace(/^\s*[·•]\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function OrderModal({ o, onClose, onDelete, hideProfit, onEdited, flash, profiles }) {
  const say = flash || (() => {});
  const boosters = (profiles || []).filter((p) => p.role === "booster" && (p.status === "active" || p.id === o.booster_id));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF2] = useState({
    client_name: o.client_name || "", client_discord: o.client_discord || "",
    summoner: o.summoner || "", server: o.server || "LAS",
    cur_rank: o.cur_rank || "Oro", cur_div: o.cur_div || "IV",
    tgt_rank: o.tgt_rank || "Platino", tgt_div: o.tgt_div || "IV",
    price: o.price || 0, notes: o.notes || "", role_champ: o.role_champ || "",
    pref_days: o.pref_days || "", pref_times: o.pref_times || "",
    acct_user: o.acct_user || "", acct_pass: o.acct_pass || "",
    booster_pay: o.booster_pay ?? "", usd_amount: o.usd_amount ?? "", admin_note: o.admin_note || "",
    booster_id: o.booster_id || "",
  });
  const upd = (k, v) => setF2((s) => ({ ...s, [k]: v }));
  const saveEdit = async () => {
    setBusy(true);
    const patch = {
      client_name: f.client_name, client_discord: f.client_discord, summoner: f.summoner || null,
      server: f.server, cur_rank: f.cur_rank, cur_div: f.cur_div,
      tgt_rank: f.tgt_rank, tgt_div: f.tgt_div, price: Number(f.price) || 0,
      notes: f.notes || null, role_champ: f.role_champ || null,
      pref_days: f.pref_days || null, pref_times: f.pref_times || null,
      acct_user: f.acct_user || null, acct_pass: f.acct_pass || null,
      admin_note: f.admin_note || null,
    };
    // montos editables
    if (f.booster_pay !== "" && f.booster_pay != null) patch.booster_pay = Number(f.booster_pay) || 0;
    if (o.currency === "usd") patch.usd_amount = f.usd_amount === "" ? null : Number(f.usd_amount);
    // reasignar / reparar booster: SIEMPRE fija booster_name según el seleccionado
    // (los boosters filtran por booster_id; el nombre es lo que se muestra en las tablas)
    const newBoosterId = f.booster_id || null;
    const nb = (profiles || []).find((b) => b.id === newBoosterId);
    patch.booster_id = newBoosterId;
    patch.booster_name = nb ? nb.full_name : (newBoosterId ? (o.booster_name || null) : null);
    if (newBoosterId) {
      if (o.status === "available" || o.status === "pending") patch.status = "in_progress";
      if (!o.accepted_at) patch.accepted_at = new Date().toISOString();
    } else {
      if (o.status === "in_progress") patch.status = "available";
      patch.accepted_at = null;
      if (!o.is_refund) patch.booster_pay = null;
    }
    // recalcular ganancia con el pago (editado o actual)
    const payForProfit = patch.booster_pay !== undefined ? patch.booster_pay : Number(o.booster_pay || 0);
    patch.profit = newBoosterId ? ((Number(f.price) || 0) - Number(payForProfit || 0)) : null;
    const { error } = await supabase.from("orders").update(patch).eq("id", o.id);
    setBusy(false);
    if (error) { alert("No se pudo guardar: " + error.message); return; }
    if (onEdited) await onEdited();
    setEditing(false);
    onClose();
  };
  const F = ({ k, v }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px solid var(--line)" }}><span className="nop-mini" style={{ flexShrink: 0 }}>{k}</span><span style={{ fontSize: 13, textAlign: "right" }}>{v}</span></div>;
  const S = ({ k, v, c }) => <div className="nop-card" style={{ padding: "12px 8px", background: "var(--bg2)" }}><div className="nop-mini">{k}</div><div className="nop-display" style={{ fontSize: 16, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div></div>;
  const noTgt = ["coaching", "single_match", "placements"].includes(o.service);

  if (editing) {
    return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
      <div className="hd"><h3>Editar pedido #{o.id}</h3><button className="nop-iconbtn" onClick={() => setEditing(false)}><X size={16} /></button></div>
      <div className="bd">
        <div className="nop-row2">
          <div className="nop-field"><label>Cliente</label><input className="nop-input" value={f.client_name} onChange={(e) => upd("client_name", e.target.value)} /></div>
          <div className="nop-field"><label>Discord</label><input className="nop-input" value={f.client_discord} onChange={(e) => upd("client_discord", e.target.value)} /></div>
        </div>
        <div className="nop-row2">
          <div className="nop-field"><label>Invocador</label><input className="nop-input" value={f.summoner} onChange={(e) => upd("summoner", e.target.value)} /></div>
          <div className="nop-field"><label>Servidor</label><select className="nop-select" value={f.server} onChange={(e) => upd("server", e.target.value)}><option>LAS</option><option>LAN</option><option>NA</option><option>BR</option></select></div>
        </div>
        <div className="nop-row2">
          <div className="nop-field"><label>Liga actual</label><div className="nop-row2">
            <select className="nop-select" value={f.cur_rank} onChange={(e) => upd("cur_rank", e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
            <select className="nop-select" value={f.cur_div} onChange={(e) => upd("cur_div", e.target.value)} disabled={f.cur_rank === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
          {!noTgt && <div className="nop-field"><label>Liga objetivo</label><div className="nop-row2">
            <select className="nop-select" value={f.tgt_rank} onChange={(e) => upd("tgt_rank", e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
            <select className="nop-select" value={f.tgt_div} onChange={(e) => upd("tgt_div", e.target.value)} disabled={f.tgt_rank === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>}
        </div>
        <div className="nop-row2">
          <div className="nop-field"><label>Precio (ARS)</label><input className="nop-input" type="number" value={f.price} onChange={(e) => upd("price", e.target.value)} /></div>
          <div className="nop-field"><label>Pago al booster (ARS)</label><input className="nop-input" type="number" value={f.booster_pay} onChange={(e) => upd("booster_pay", e.target.value)} placeholder="0" /></div>
        </div>
        <div className="nop-field"><label>Booster asignado</label>
          <select className="nop-select" value={f.booster_id} onChange={(e) => {
            const id = e.target.value; const nb = boosters.find((b) => b.id === id);
            setF2((s) => ({ ...s, booster_id: id, booster_pay: id ? (o.is_refund ? s.booster_pay : Math.round((Number(s.price) || 0) * Number((nb && nb.cut) || 0.5))) : "" }));
          }}>
            <option value="">— Sin asignar (vuelve a disponibles) —</option>
            {boosters.map((b) => <option key={b.id} value={b.id}>{b.full_name} · corte {Math.round((b.cut || 0.5) * 100)}%</option>)}
          </select>
          <div className="nop-mini" style={{ marginTop: 6 }}>Si cambiás el booster, el servicio se mueve a su perfil (desaparece del anterior). El pago se recalcula por su corte; podés ajustarlo arriba.</div>
        </div>
        {o.currency === "usd" && <div className="nop-field"><label>Monto cobrado en USD</label><input className="nop-input" type="number" step="0.01" value={f.usd_amount} onChange={(e) => upd("usd_amount", e.target.value)} placeholder="USD" /></div>}
        {o.service === "eloboost" && <div className="nop-row2">
          <div className="nop-field"><label>Usuario de la cuenta</label><input className="nop-input" value={f.acct_user} onChange={(e) => upd("acct_user", e.target.value)} placeholder="usuario de login" /></div>
          <div className="nop-field"><label>Contraseña de la cuenta</label><input className="nop-input" value={f.acct_pass} onChange={(e) => upd("acct_pass", e.target.value)} placeholder="contraseña" /></div>
        </div>}
        <div className="nop-field"><label>Rol / detalle</label><input className="nop-input" value={f.role_champ} onChange={(e) => upd("role_champ", e.target.value)} /></div>
        <div className="nop-row2">
          <div className="nop-field"><label>Días</label><input className="nop-input" value={f.pref_days} onChange={(e) => upd("pref_days", e.target.value)} /></div>
          <div className="nop-field"><label>Horarios</label><input className="nop-input" value={f.pref_times} onChange={(e) => upd("pref_times", e.target.value)} /></div>
        </div>
        <div className="nop-field"><label>Nota del cliente</label><textarea className="nop-ta" value={f.notes} onChange={(e) => upd("notes", e.target.value)} /></div>
        <div className="nop-field"><label>Nota interna (solo admin y boosters)</label><textarea className="nop-ta" value={f.admin_note} onChange={(e) => upd("admin_note", e.target.value)} placeholder="Instrucciones para el booster, aclaraciones internas, etc. El cliente no la ve." /></div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="nop-btn nop-btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancelar</button>
          <button className="nop-btn nop-btn-gold" style={{ flex: 1 }} disabled={busy} onClick={saveEdit}>{busy ? "Guardando…" : "Guardar cambios"}<Check size={15} /></button>
        </div>
      </div></div></div>;
  }

  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd">
      <div>
        <h3 style={{ margin: 0 }}>Pedido #{o.id}</h3>
        <div className="nop-mini" style={{ marginTop: 3 }}>{o.created_at ? new Date(o.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}{svcDurationLive(o) ? ` (${svcDurationLive(o)})` : ""}</div>
      </div>
      <button className="nop-iconbtn" onClick={onClose}><X size={16} /></button>
    </div>
    <div className="bd">
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}><SvcTag s={o.service} /><StatusBadge s={o.status} /><ExtrasTags o={o} />
        {onEdited && <button className="nop-btn nop-btn-ghost nop-btn-sm" style={{ marginLeft: "auto" }} onClick={() => setEditing(true)}><Settings size={13} />Editar</button>}
      </div>
      <F k="Usuario" v={o.client_name || "—"} />
      <F k="Discord" v={o.client_discord || "—"} />
      {o.summoner && <F k="Invocador" v={<span>{o.summoner}{opggUrl(o.summoner, o.server) && <> · <a href={opggUrl(o.summoner, o.server)} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>ver en op.gg</a></>}</span>} />}
      <F k="Recorrido" v={<RankPath o={o} />} />
      <F k="Servidor / LP" v={`${o.server} · ${o.lp || "—"}`} />
      {!hideProfit && o.service === "eloboost" && (o.acct_user || o.acct_pass) && <div className="nop-card" style={{ padding: 12, background: "var(--bg2)", margin: "10px 0" }}>
        <div className="nop-panel-h" style={{ marginBottom: 10 }}>🔑 Credenciales de la cuenta</div>
        <Cred label="Usuario" value={o.acct_user} flash={say} />
        <div style={{ height: 8 }} />
        <Cred label="Contraseña" value={o.acct_pass} flash={say} />
        {onEdited && <p className="nop-mini" style={{ marginTop: 8 }}>Podés modificarlas con el botón «Editar».</p>}
      </div>}
      {["eloboost", "duoboost", "tft"].includes(o.service) && o.status === "in_progress" && (() => {
        const pct = progressPct(o);
        const prLabel = o.progress_rank ? `${o.progress_rank}${o.progress_rank !== "Master" ? " " + (o.progress_div || "") : ""}` : "sin actualizar";
        return <div className="nop-card" style={{ padding: 12, background: "var(--bg2)", margin: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12 }}>
            <span className="nop-mini">Progreso · actual: <b style={{ color: o.progress_rank ? "var(--gold)" : "var(--mut2)" }}>{prLabel}</b></span>
            <b style={{ color: "var(--gold)" }}>{pct != null ? pct + "%" : "—"}</b>
          </div>
          <div style={{ height: 6, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: (pct || 0) + "%", background: "linear-gradient(90deg, var(--gold), var(--amber))" }} />
          </div>
        </div>;
      })()}
      {o.role_champ && cleanRoleDetail(o.role_champ) && <F k="Rol / detalle" v={cleanRoleDetail(o.role_champ)} />}
      {o.pref_days && <F k="Días de preferencia" v={o.pref_days} />}
      {o.pref_times && <F k="Horario de preferencia" v={o.pref_times} />}
      {o.notes && <F k="Notas del cliente" v={o.notes} />}
      {o.admin_note && <div className="nop-card" style={{ padding: 12, background: "var(--bg2)", margin: "10px 0", borderLeft: "3px solid var(--amber)" }}>
        <div className="nop-mini" style={{ color: "var(--amber)", marginBottom: 4, fontWeight: 600 }}>📌 Nota interna (admin / booster)</div>
        <p style={{ fontSize: 13, color: "var(--tx)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{o.admin_note}</p>
      </div>}
      <F k="Booster" v={o.booster_name || "Sin asignar"} />
      <F k="Medio de pago" v={o.payment} />
      {(o.discount_ars > 0 || o.discount_usd > 0 || o.promo_code_text) && <F k="Descuento aplicado" v={<span style={{ color: "var(--grn)" }}>{o.promo_code_text ? o.promo_code_text + " · " : ""}−{o.currency === "usd" && o.discount_usd ? fmtUSD(o.discount_usd) : fmtARS(o.discount_ars || 0)}</span>} />}
      {o.status === "completed" && <F k="Duración del servicio" v={svcDuration(o)} />}
      {o.status === "completed" && <F k="Pago al booster" v={<span style={{ color: o.booster_paid ? "var(--grn)" : "var(--amber)", fontWeight: 700 }}>{o.booster_paid ? "Pago realizado ✓" : "Pago pendiente"}</span>} />}
      {o.receipt_path && <button className="nop-btn nop-btn-ghost" style={{ width: "100%", margin: "8px 0 0" }} onClick={() => openReceipt(o.receipt_path)}><Eye size={15} />Ver comprobante del cliente</button>}
      <div style={{ display: "grid", gridTemplateColumns: hideProfit ? "1fr" : "1fr 1fr 1fr", gap: 10, margin: "14px 0", textAlign: "center" }}>
        {!hideProfit && <S k="Precio" v={<span>{fmtCharged(o)}{isUsdOrder(o) && o.price ? <div className="nop-mini" style={{ color: "var(--mut2)", fontWeight: 400, marginTop: 2 }}>≈ {fmtARS(o.price)}</div> : null}</span>} c="var(--gold)" />}<S k="Pago booster" v={fmtARS(o.booster_pay)} c="var(--cyan)" />
        {!hideProfit && <S k="Ganancia" v={fmtARS(o.profit)} c="var(--grn)" />}
      </div>
      {o.survey_rating && <div className="nop-card" style={{ padding: 14, background: "var(--bg2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><b style={{ fontSize: 13 }}>Reseña del cliente</b><Stars value={o.survey_rating} /></div>
        <p style={{ fontSize: 13, color: "var(--mut)", fontStyle: "italic" }}>"{o.survey_comment}"</p></div>}
      {onDelete && <button className="nop-btn nop-btn-danger" style={{ width: "100%", marginTop: 16 }} onClick={() => onDelete(o)}><Trash2 size={15} />Eliminar pedido</button>}
    </div></div></div>;
}

/* ===================== CONTABLE (ADMIN) ===================== */
function AdminFinance({ orders, profiles, flash, reload }) {
  const mKey = (d) => { if (!d) return null; const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
  const mLabel = (k) => { if (!k || k === "all") return "Todo el histórico"; const [y, m] = k.split("-"); return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); };
  const thisMonth = mKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [blue, setBlue] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [partners, setPartners] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [paypalPct, setPaypalPct] = useState(3);
  const [tarjeta, setTarjeta] = useState("");
  const [openArs, setOpenArs] = useState("");
  const [openUsd, setOpenUsd] = useState("");
  const [busy, setBusy] = useState(false);
  const [coUsd, setCoUsd] = useState("");
  const [coRate, setCoRate] = useState("");

  const load = async () => {
    const { data: ex } = await supabase.from("fin_expenses").select("*").order("created_at", { ascending: true });
    setExpenses(ex || []);
    const { data: cv } = await supabase.from("fin_conversions").select("*").order("created_at", { ascending: false });
    setConversions(cv || []);
    const { data: aj } = await supabase.from("fin_adjustments").select("*").order("created_at", { ascending: false });
    setAdjustments(aj || []);
    const { data: cfg } = await supabase.from("fin_config").select("*").eq("id", 1).maybeSingle();
    setPartners((cfg?.partners) || [{ name: "Tomi", pct: 34 }, { name: "Collo", pct: 33 }, { name: "Nico", pct: 33 }]);
    setPaypalPct(cfg?.paypal_pct ?? 3);
    setTarjeta(cfg?.tarjeta_rate != null ? String(cfg.tarjeta_rate) : "");
    setOpenArs(cfg?.saldo_ini_ars != null ? String(cfg.saldo_ini_ars) : "");
    setOpenUsd(cfg?.saldo_ini_usd != null ? String(cfg.saldo_ini_usd) : "");
  };
  useEffect(() => { load(); fetchBlue().then(setBlue); }, []);

  const pct = Number(paypalPct || 0) / 100;
  const tarjetaRate = Number(tarjeta) || (blue ? Math.round(blue * 1.6) : 0);

  const isBilled = (o) => o.status === "available" || o.status === "in_progress" || o.status === "completed";
  const billed = orders.filter(isBilled);
  const completed = orders.filter((o) => o.status === "completed");
  const months = useMemo(() => {
    const s = new Set([thisMonth]); billed.forEach((o) => { const k = mKey(o.completed_at || o.created_at); if (k) s.add(k); });
    conversions.forEach((c) => { if (c.month) s.add(c.month); });
    return Array.from(s).sort().reverse();
  }, [orders, conversions]);
  const inMonth = (o) => mKey(o.completed_at || o.created_at) === month;
  const monthDone = billed.filter(inMonth);
  // Pagos a boosters: SOLO servicios finalizados (completed) con booster.
  const completedWithBooster = completed.filter((o) => o.booster_id);
  const payPending = completedWithBooster.filter((o) => !o.booster_paid);
  const payDoneThisMonth = completedWithBooster.filter((o) => o.booster_paid && mKey(o.booster_paid_at || o.completed_at) === month);
  // Pagos futuros: servicios en proceso (no terminados) con booster asignado — deuda que se generará al finalizar.
  const payFuture = orders.filter((o) => o.status === "in_progress" && o.booster_id).reduce((a, o) => a + Number(o.booster_pay || 0), 0);

  // --- INGRESOS ---
  const arsOrders = monthDone.filter((o) => (o.currency || "ars") === "ars");
  const usdOrders = monthDone.filter((o) => o.currency === "usd");
  const cobradoArs = arsOrders.reduce((a, o) => a + Number(o.price || 0), 0);
  const cobradoUsdBruto = usdOrders.reduce((a, o) => a + Number(o.usd_amount || 0), 0);
  const cobradoUsdNeto = cobradoUsdBruto * (1 - pct);
  const cobradoTotalArs = monthDone.reduce((a, o) => a + Number(o.price || 0), 0);     // bruto ARS-equiv
  const comisionesArs = usdOrders.reduce((a, o) => a + Number(o.price || 0) * pct, 0);   // 3% de la parte USD, en ARS-equiv

  // --- BOOSTERS ---
  const boostersTotal = monthDone.reduce((a, o) => a + Number(o.booster_pay || 0), 0);
  const boostersPagado = monthDone.filter((o) => o.booster_paid).reduce((a, o) => a + Number(o.booster_pay || 0), 0);
  const boostersDeuda = boostersTotal - boostersPagado;

  // --- GASTOS ---
  const pesoOf = (e) => (e.currency === "usd" ? Number(e.amount || 0) * tarjetaRate : Number(e.amount || 0));
  const monthExpenses = expenses.filter((e) => e.recurring || e.month === month);
  const gastosTotal = monthExpenses.reduce((a, e) => a + pesoOf(e), 0);

  // --- GANANCIA ---
  const gananciaBruta = cobradoTotalArs - comisionesArs - boostersTotal;
  const gananciaNeta = gananciaBruta - gastosTotal;
  const pctSum = partners.reduce((a, p) => a + Number(p.pct || 0), 0);

  // --- CUENTAS (histórico) ---
  const allDone = billed;
  const convArsIn = conversions.reduce((a, c) => a + Number(c.ars_in || 0), 0);
  const convUsdOut = conversions.reduce((a, c) => a + Number(c.usd_out || 0), 0);
  const adjArs = adjustments.filter((a) => (a.currency || "ars") === "ars").reduce((s, a) => s + Number(a.amount || 0), 0);
  const adjUsd = adjustments.filter((a) => a.currency === "usd").reduce((s, a) => s + Number(a.amount || 0), 0);
  const saldoArs = Number(openArs || 0)
    + allDone.filter((o) => (o.currency || "ars") === "ars").reduce((a, o) => a + Number(o.price || 0), 0)
    - allDone.filter((o) => o.booster_paid && (o.booster_paid_ccy || "ars") === "ars").reduce((a, o) => a + Number(o.booster_pay || 0), 0)
    - expenses.reduce((a, e) => a + pesoOf(e), 0)
    + convArsIn + adjArs;
  const saldoUsd = Number(openUsd || 0)
    + allDone.filter((o) => o.currency === "usd").reduce((a, o) => a + Number(o.usd_amount || 0) * (1 - pct), 0)
    - allDone.filter((o) => o.booster_paid && o.booster_paid_ccy === "usd").reduce((a, o) => a + Number(o.booster_paid_usd || 0), 0)
    - convUsdOut + adjUsd;
  const saldoUnificadoArs = saldoArs + (blue ? saldoUsd * blue : 0);

  // --- CIERRE USD -> PESOS ---
  const coUsdNum = Number(coUsd) || (saldoUsd > 0 ? Math.round(saldoUsd * 100) / 100 : 0);
  const coRateNum = Number(coRate) || Number(blue) || 0;
  const coArsIn = Math.round(coUsdNum * coRateNum);
  const doCloseout = async () => {
    if (coUsdNum <= 0 || coRateNum <= 0) { flash("Cargá los dólares y el tipo de cambio."); return; }
    setBusy(true);
    const { error } = await supabase.from("fin_conversions").insert({ usd_out: coUsdNum, fee_pct: 0, rate: coRateNum, ars_in: coArsIn, month });
    setBusy(false);
    if (error) { flash("No se pudo registrar el cierre."); return; }
    setCoUsd(""); setCoRate(""); await load(); flash(`Cierre registrado: ${fmtUSD(coUsdNum)} → ${fmtARS(coArsIn)}`);
  };
  const delConversion = async (id) => { await supabase.from("fin_conversions").delete().eq("id", id); await load(); };

  const saveConfig = async () => {
    setBusy(true);
    const { error } = await supabase.from("fin_config").upsert({ id: 1, partners, paypal_pct: Number(paypalPct || 0), tarjeta_rate: tarjeta ? Number(tarjeta) : null, saldo_ini_ars: openArs ? Number(openArs) : 0, saldo_ini_usd: openUsd ? Number(openUsd) : 0, updated_at: new Date().toISOString() });
    setBusy(false);
    flash(error ? "No se pudo guardar." : "Ajustes guardados.");
  };

  const addAdjustment = async (amount, currency, note) => {
    const { error } = await supabase.from("fin_adjustments").insert({ amount: Number(amount), currency, note: note || null });
    if (error) { flash("No se pudo guardar el ajuste."); return; }
    await load(); flash("Ajuste aplicado a la cuenta.");
  };
  const delAdjustment = async (id) => { await supabase.from("fin_adjustments").delete().eq("id", id); await load(); };

  const uploadBoosterReceipt = async (o, file) => {
    if (!file) return;
    try {
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const path = `pagos/${o.booster_id || "sin"}/${o.id}.${ext}`;
      const up = await supabase.storage.from("comprobantes").upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      await supabase.from("orders").update({ booster_receipt_path: path, booster_paid: true, booster_paid_at: new Date().toISOString(), booster_paid_ccy: "ars" }).eq("id", o.id);
      o.booster_receipt_path = path; o.booster_paid = true; setBusy((b) => b);
      flash(`Comprobante adjuntado al #${o.id} y pago marcado.`);
    } catch (e) { flash("No se pudo subir el comprobante."); }
  };
  const togglePaid = async (o, paid) => {
    let ccy = "ars", usd = null;
    if (paid && o.currency === "usd") {
      const ans = window.confirm("¿Le pagaste al booster en DÓLARES?\n\nAceptar = USD · Cancelar = Pesos");
      if (ans) { ccy = "usd"; usd = Number(o.price) ? Math.round(Number(o.usd_amount) * Number(o.booster_pay) / Number(o.price) * 100) / 100 : 0; }
    }
    await supabase.from("orders").update({ booster_paid: paid, booster_paid_at: paid ? new Date().toISOString() : null, booster_paid_ccy: ccy, booster_paid_usd: usd }).eq("id", o.id);
    o.booster_paid = paid; o.booster_paid_ccy = ccy; o.booster_paid_usd = usd;
    flash(paid ? `Pago del #${o.id} marcado como pagado` : `Pago del #${o.id} marcado como pendiente`);
    if (reload) await reload();
  };

  const addExpense = async (label, amount, recurring, currency) => {
    const { error } = await supabase.from("fin_expenses").insert({ label, amount: Number(amount), recurring, currency, month: recurring ? null : month });
    if (error) { flash("No se pudo guardar el gasto."); return; }
    await load();
  };
  const delExpense = async (id) => { await supabase.from("fin_expenses").delete().eq("id", id); await load(); };
  const editExpense = async (id, amount) => { await supabase.from("fin_expenses").update({ amount: Number(amount) }).eq("id", id); await load(); };

  const mobile = useIsMobile();
  const KPI = ({ lbl, val, c, sub }) => <div className="nop-card nop-kpi"><div className="gl" style={{ background: c }} /><div className="lbl" style={{ color: "var(--mut)" }}>{lbl}</div><div className="val" style={{ color: c, whiteSpace: "normal", overflowWrap: "anywhere", fontSize: mobile ? 21 : undefined, lineHeight: 1.15 }}>{val}</div>{sub && <div className="delta">{sub}</div>}</div>;

  return <>
    <div className="nop-sectionhead">
      <div><h1 className="nop-h1">Gestión contable</h1>
        <p className="nop-sub" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>Dólar blue: <b style={{ color: "var(--grn)" }}>{blue ? fmtARS(blue) : "…"}</b>
          <button className="nop-linkbtn" style={{ display: "inline-flex", alignItems: "center", gap: 4, font: "inherit" }} onClick={() => fetchBlue().then(setBlue)}><RefreshCw size={12} />actualizar</button></p></div>
      <select className="nop-select" style={{ width: "auto", minWidth: 170 }} value={month} onChange={(e) => setMonth(e.target.value)}>
        {months.map((k) => <option key={k} value={k}>{mLabel(k)}</option>)}
      </select>
    </div>

    {/* CUENTAS */}
    <div className="nop-grid-kpi" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 8 }}>
      {KPI({ lbl: "Cuenta en PESOS", val: fmtARS(saldoArs), c: "var(--gold)", sub: "saldo real acumulado" })}
      {KPI({ lbl: "Cuenta en USD", val: fmtUSD(saldoUsd), c: "var(--grn)", sub: "neto, después de comisión" })}
      {KPI({ lbl: "Total unificado", val: fmtARS(saldoUnificadoArs), c: "var(--cyan)", sub: blue ? `USD al blue ${fmtARS(blue)}` : "—" })}
    </div>
    <p className="nop-mini" style={{ marginBottom: 18 }}>Saldos acumulados de todo el histórico. Pesos y dólares no se mezclan; el total unificado es solo de referencia.</p>

    {/* RESUMEN DEL MES */}
    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div className="nop-panel-h"><Activity size={15} style={{ color: "var(--gold)" }} />Resumen de {mLabel(month)}</div>
      <div className="nop-grid-kpi" style={{ gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)" }}>
        {KPI({ lbl: "Cobrado (pesos)", val: fmtARS(cobradoArs), c: "var(--gold)", sub: arsOrders.length + " servicios" })}
        {KPI({ lbl: "Cobrado (USD neto)", val: fmtUSD(cobradoUsdNeto), c: "var(--grn)", sub: `bruto ${fmtUSD(cobradoUsdBruto)} · ${usdOrders.length} serv.` })}
        {KPI({ lbl: "Cobrado total", val: fmtARS(cobradoTotalArs), c: "var(--cyan)", sub: "en pesos (USD al blue del cobro)" })}
        {KPI({ lbl: "Servicios", val: monthDone.filter((o) => !o.is_refund).length, c: "var(--violet)", sub: "completados en el mes" })}
      </div>
      <div className="nop-finflow">
        <div className="row"><span>Cobrado total del mes (bruto)</span><b style={{ color: "var(--gold)" }}>{fmtARS(cobradoTotalArs)}</b></div>
        <div className="row"><span>− Comisión PayPal ({paypalPct}% sobre USD)</span><b style={{ color: "var(--red)" }}>−{fmtARS(comisionesArs)}</b></div>
        <div className="row"><span>− Pago a boosters ({fmtARS(boostersPagado)} pagado · {fmtARS(boostersDeuda)} pendiente)</span><b style={{ color: "var(--cyan)" }}>−{fmtARS(boostersTotal)}</b></div>
        <div className="row"><span>− Gastos del mes</span><b style={{ color: "var(--red)" }}>−{fmtARS(gastosTotal)}</b></div>
        <div className="row total"><span>Ganancia neta</span><b style={{ color: gananciaNeta >= 0 ? "var(--grn)" : "var(--red)" }}>{fmtARS(gananciaNeta)}</b></div>
      </div>
    </div>

    {/* CIERRE USD -> PESOS */}
    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div className="nop-panel-h"><RefreshCw size={15} style={{ color: "var(--grn)" }} />Cierre de cuenta USD → pesos</div>
      <p className="nop-mini" style={{ marginBottom: 12 }}>Una vez al mes, pasá los dólares de PayPal a pesos. Se suma a la cuenta en pesos (la transferencia no tiene comisión). Saldo USD actual: <b style={{ color: "var(--grn)" }}>{fmtUSD(saldoUsd)}</b>.</p>
      <div className="nop-row2" style={{ alignItems: "end" }}>
        <div className="nop-field" style={{ marginBottom: 0 }}><label>Dólares a pasar</label>
          <input className="nop-input" type="number" value={coUsd} onChange={(e) => setCoUsd(e.target.value)} placeholder={saldoUsd > 0 ? String(Math.round(saldoUsd * 100) / 100) : "0"} /></div>
        <div className="nop-field" style={{ marginBottom: 0 }}><label>Tipo de cambio</label>
          <input className="nop-input" type="number" value={coRate} onChange={(e) => setCoRate(e.target.value)} placeholder={blue ? String(blue) : "blue"} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 10 }}>
        <span className="nop-mini">Recibís ≈ <b style={{ color: "var(--gold)" }}>{fmtARS(coArsIn)}</b></span>
        <button className="nop-btn nop-btn-grn nop-btn-sm" disabled={busy || saldoUsd <= 0} onClick={doCloseout}><RefreshCw size={13} />Registrar cierre</button>
      </div>
      {conversions.length > 0 && <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <div className="nop-mini" style={{ marginBottom: 8 }}>Historial de conversiones</div>
        {conversions.slice(0, 8).map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5, color: "var(--mut)" }}>
          <span>{new Date(c.created_at).toLocaleDateString("es-AR")} · {fmtUSD(c.usd_out)} → <b style={{ color: "var(--tx)" }}>{fmtARS(c.ars_in)}</b> <span className="nop-mini">(TC {fmtARS(c.rate)} · −{c.fee_pct}%)</span></span>
          <button className="nop-iconbtn" onClick={() => delConversion(c.id)}><Trash2 size={13} /></button>
        </div>)}
      </div>}
    </div>

    <div className="nop-twocol" style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
      {/* GASTOS */}
      <ExpensesPanel month={month} mLabel={mLabel} monthExpenses={monthExpenses} onAdd={addExpense} onDel={delExpense} onEdit={editExpense} total={gastosTotal} pesoOf={pesoOf} tarjetaRate={tarjetaRate} />
      {/* REPARTO */}
      <div className="nop-card nop-panel">
        <div className="nop-panel-h"><Users size={15} style={{ color: "var(--violet)" }} />Reparto entre socios</div>
        <p className="nop-mini" style={{ marginBottom: 12 }}>Sobre la ganancia neta de {mLabel(month)}: <b style={{ color: "var(--grn)" }}>{fmtARS(gananciaNeta)}</b></p>
        {partners.map((p, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input className="nop-input" style={{ flex: 1 }} value={p.name} onChange={(e) => setPartners(partners.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
          <input className="nop-input" type="number" style={{ width: 78 }} value={p.pct} onChange={(e) => setPartners(partners.map((x, j) => j === i ? { ...x, pct: Number(e.target.value) } : x))} />
          <span className="nop-mini" style={{ width: 90, textAlign: "right" }}>{fmtARS(gananciaNeta * Number(p.pct || 0) / 100)}</span>
        </div>)}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span className="nop-mini" style={{ color: pctSum === 100 ? "var(--grn)" : "var(--red)" }}>Suma: {pctSum}% {pctSum !== 100 ? "(debe dar 100%)" : "✓"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setPartners([...partners, { name: "Socio", pct: 0 }])}><Plus size={13} />Socio</button>
            <button className="nop-btn nop-btn-gold nop-btn-sm" disabled={busy} onClick={saveConfig}><Check size={13} />Guardar</button>
          </div>
        </div>
      </div>
    </div>

    {/* PAGOS A BOOSTERS — pendientes siempre + pagados del mes */}
    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div className="nop-panel-h"><Swords size={15} style={{ color: "var(--amber)" }} />Pagos pendientes a boosters <span className="nop-mini" style={{ marginLeft: "auto", fontWeight: 400 }}>Deuda total: <b style={{ color: "var(--amber)" }}>{fmtARS(payPending.reduce((a, o) => a + Number(o.booster_pay || 0), 0))}</b></span></div>
      <p className="nop-mini" style={{ marginBottom: 12 }}>Servicios finalizados sin pagar. Aparecen acá hasta que los marques como pagados, sin importar el mes en que se hicieron.</p>
      {payPending.length === 0 ? <Empty icon={Check} title="No hay pagos pendientes" sub="Todos los servicios finalizados ya fueron pagados." /> :
        <div className="nop-tablewrap"><table className="nop-t">
          <thead><tr><th>#</th><th>Booster</th><th>Alias / CBU</th><th>Servicio</th><th>Finalizado</th><th>Pago booster</th><th>Acción</th></tr></thead>
          <tbody>{payPending.map((o) => <tr key={o.id}>
            <td>#{o.id}</td><td>{o.booster_name || "—"}</td>
            <td className="nop-mini">{(profiles || []).find((p) => p.id === o.booster_id)?.cbu || "—"}</td>
            <td><SvcTag s={o.service} /></td>
            <td className="nop-mini">{o.completed_at ? new Date(o.completed_at).toLocaleDateString("es-AR") : "—"}</td>
            <td style={{ color: "var(--cyan)" }}>{fmtARS(o.booster_pay)}</td>
            <td><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button className="nop-btn nop-btn-gold nop-btn-sm" onClick={() => togglePaid(o, true)}><Check size={13} />Marcar pagado</button>
              {o.booster_receipt_path
                ? <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => openReceipt(o.booster_receipt_path)}><Eye size={13} />Ver</button>
                : <label className="nop-btn nop-btn-ghost nop-btn-sm" style={{ cursor: "pointer" }}><Upload size={13} />Adjuntar<input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => uploadBoosterReceipt(o, e.target.files?.[0])} /></label>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </div>

    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div className="nop-panel-h"><Check size={15} style={{ color: "var(--grn)" }} />Pagos realizados · {mLabel(month)} <span className="nop-mini" style={{ marginLeft: "auto", fontWeight: 400 }}>Total pagado: <b style={{ color: "var(--grn)" }}>{fmtARS(payDoneThisMonth.reduce((a, o) => a + Number(o.booster_pay || 0), 0))}</b> · Pagos futuros: <b style={{ color: "var(--amber)" }}>{fmtARS(payFuture)}</b></span></div>
      {payDoneThisMonth.length === 0 ? <Empty icon={Wallet} title="Sin pagos este mes" sub="Los pagos marcados como realizados aparecen en el mes en que se pagaron." /> :
        <div className="nop-tablewrap"><table className="nop-t">
          <thead><tr><th>#</th><th>Booster</th><th>Servicio</th><th>Pagado el</th><th>Pago booster</th><th>Acción</th></tr></thead>
          <tbody>{payDoneThisMonth.map((o) => <tr key={o.id}>
            <td>#{o.id}</td><td>{o.booster_name || "—"}</td>
            <td><SvcTag s={o.service} /></td>
            <td className="nop-mini">{o.booster_paid_at ? new Date(o.booster_paid_at).toLocaleDateString("es-AR") : "—"}</td>
            <td style={{ color: "var(--grn)" }}>{fmtARS(o.booster_pay)}</td>
            <td><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => togglePaid(o, false)}>Revertir</button>
              {o.booster_receipt_path && <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => openReceipt(o.booster_receipt_path)}><Eye size={13} />Ver</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </div>

    {/* AJUSTES (global, colapsable) */}
    <div className="nop-card nop-panel">
      <button className="nop-acc-head" onClick={() => setShowSettings((v) => !v)}>
        <span className="nop-panel-h" style={{ margin: 0 }}><Settings size={15} style={{ color: "var(--mut2)" }} />Ajustes contables (configuración global)</span>
        <ChevronRight size={18} style={{ transform: showSettings ? "rotate(90deg)" : "none", transition: ".2s", color: "var(--mut)" }} />
      </button>
      {showSettings && <div style={{ marginTop: 14 }}>
        <div className="nop-row2" style={{ alignItems: "end", marginBottom: 12 }}>
          <div className="nop-field" style={{ marginBottom: 0 }}><label>Saldo inicial PESOS <span title="Lo que tenés hoy en la cuenta de pesos. Punto de partida; de acá en más se suma lo nuevo." style={{ cursor: "help", color: "var(--mut2)" }}>ⓘ</span></label>
            <input className="nop-input" type="number" value={openArs} onChange={(e) => setOpenArs(e.target.value)} placeholder="$ actual en pesos" /></div>
          <div className="nop-field" style={{ marginBottom: 0 }}><label>Saldo inicial USD <span title="Lo que tenés hoy en PayPal / dólares." style={{ cursor: "help", color: "var(--mut2)" }}>ⓘ</span></label>
            <input className="nop-input" type="number" value={openUsd} onChange={(e) => setOpenUsd(e.target.value)} placeholder="US$ actual" /></div>
        </div>
        <div className="nop-row2" style={{ alignItems: "end" }}>
          <div className="nop-field" style={{ marginBottom: 0 }}><label>Comisión PayPal (%) <span title="Se descuenta solo de los cobros en USD a clientes. No se aplica al pasar USD a pesos." style={{ cursor: "help", color: "var(--mut2)" }}>ⓘ</span></label>
            <input className="nop-input" type="number" value={paypalPct} onChange={(e) => setPaypalPct(e.target.value)} /></div>
          <div className="nop-field" style={{ marginBottom: 0 }}><label>Dólar tarjeta <span title="Para gastos en USD (Netlify, Supabase). Incluí el dólar + impuestos. Vacío = blue ×1.6." style={{ cursor: "help", color: "var(--mut2)" }}>ⓘ</span></label>
            <input className="nop-input" type="number" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} placeholder={blue ? `auto: ${Math.round(blue * 1.6)}` : "auto"} /></div>
        </div>
        <button className="nop-btn nop-btn-gold nop-btn-sm" style={{ marginTop: 12 }} disabled={busy} onClick={saveConfig}><Check size={13} />Guardar configuración global</button>

        <div style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 14 }}>
          <div className="nop-panel-h"><Banknote size={15} style={{ color: "var(--gold)" }} />Ajustar saldo de la cuenta</div>
          <p className="nop-mini" style={{ marginBottom: 12 }}>Sumá o restá un monto fijo a la cuenta (ej: una comisión de $75, un retiro, una corrección). Usá monto negativo para restar.</p>
          <AdjustForm onAdd={addAdjustment} />
          {adjustments.length > 0 && <div style={{ marginTop: 12 }}>{adjustments.slice(0, 10).map((a) => <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5, color: "var(--mut)", borderBottom: "1px solid var(--line)" }}>
            <span>{new Date(a.created_at).toLocaleDateString("es-AR")} · <b style={{ color: Number(a.amount) >= 0 ? "var(--grn)" : "var(--red)" }}>{Number(a.amount) >= 0 ? "+" : ""}{a.currency === "usd" ? fmtUSD(a.amount) : fmtARS(a.amount)}</b>{a.note ? ` · ${a.note}` : ""}</span>
            <button className="nop-iconbtn" onClick={() => delAdjustment(a.id)}><Trash2 size={13} /></button>
          </div>)}</div>}
        </div>
      </div>}
    </div>
  </>;
}
function AdjustForm({ onAdd }) {
  const [amount, setAmount] = useState(""); const [ccy, setCcy] = useState("ars"); const [sign, setSign] = useState("-"); const [note, setNote] = useState("");
  return <div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select className="nop-select" style={{ width: 80 }} value={sign} onChange={(e) => setSign(e.target.value)}><option value="-">Restar</option><option value="+">Sumar</option></select>
      <input className="nop-input" type="number" style={{ width: 110 }} placeholder="monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className="nop-select" style={{ width: 90 }} value={ccy} onChange={(e) => setCcy(e.target.value)}><option value="ars">Pesos</option><option value="usd">USD</option></select>
      <input className="nop-input" style={{ flex: 1, minWidth: 140 }} placeholder="Detalle (ej: comisión, retiro)" value={note} onChange={(e) => setNote(e.target.value)} />
    </div>
    <button className="nop-btn nop-btn-ghost nop-btn-sm" style={{ marginTop: 10 }} disabled={!amount} onClick={() => { onAdd((sign === "-" ? -1 : 1) * Math.abs(Number(amount)), ccy, note); setAmount(""); setNote(""); }}><Plus size={13} />Aplicar ajuste</button>
  </div>;
}
function ExpensesPanel({ month, mLabel, monthExpenses, onAdd, onDel, onEdit, total, pesoOf, tarjetaRate }) {
  const [label, setLabel] = useState(""); const [amount, setAmount] = useState(""); const [recurring, setRecurring] = useState(true); const [ccy, setCcy] = useState("ars");
  return <div className="nop-card nop-panel">
    <div className="nop-panel-h"><FileText size={15} style={{ color: "var(--red)" }} />Gastos · {mLabel(month)}</div>
    {monthExpenses.length === 0 ? <p className="nop-mini" style={{ marginBottom: 12 }}>Sin gastos cargados.</p> :
      <div style={{ marginBottom: 12 }}>{monthExpenses.map((e) => <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
        <span style={{ flex: 1, fontSize: 13 }}>{e.label} <span className="nop-mini">· {e.recurring ? "fijo" : "puntual"}{e.currency === "usd" ? " · USD" : ""}</span>{e.currency === "usd" && <div className="nop-mini">≈ {fmtARS(pesoOf(e))} (al dólar tarjeta {fmtARS(tarjetaRate)})</div>}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span className="nop-mini">{e.currency === "usd" ? "US$" : "$"}</span>
          <input className="nop-input" type="number" style={{ width: 100, padding: "6px 8px" }} defaultValue={e.amount} onBlur={(ev) => Number(ev.target.value) !== Number(e.amount) && onEdit(e.id, ev.target.value)} />
        </div>
        <button className="nop-iconbtn" onClick={() => onDel(e.id)}><Trash2 size={14} /></button>
      </div>)}</div>}
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><b className="nop-mini">Total del mes (en pesos)</b><b style={{ color: "var(--red)" }}>{fmtARS(total)}</b></div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input className="nop-input" style={{ flex: 1, minWidth: 110 }} placeholder="Nombre (ej: Netlify)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <select className="nop-select" style={{ width: 90 }} value={ccy} onChange={(e) => setCcy(e.target.value)}><option value="ars">Pesos</option><option value="usd">USD</option></select>
      <input className="nop-input" type="number" style={{ width: 100 }} placeholder={ccy === "usd" ? "US$" : "$"} value={amount} onChange={(e) => setAmount(e.target.value)} />
    </div>
    <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0", fontSize: 12.5, color: "var(--mut)", cursor: "pointer" }}>
      <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Gasto fijo (se repite todos los meses)</label>
    <button className="nop-btn nop-btn-ghost nop-btn-sm" disabled={!label || !amount} onClick={() => { onAdd(label, amount, recurring, ccy); setLabel(""); setAmount(""); }}><Plus size={13} />Agregar gasto</button>
  </div>;
}

/* ===================== BOOSTER ===================== */
function BoosterViews({ tab, ...ctx }) {
  if (tab === "mine") return <BoosterMine {...ctx} />;
  if (tab === "accounts") return <BoosterAccounts {...ctx} />;
  if (tab === "hist") return <BoosterHist {...ctx} />;
  return <BoosterBoard {...ctx} />;
}
function BoosterBoard({ profile, orders, reload, flash, notify }) {
  const [blue, setBlue] = useState(null);
  const [fSvc, setFSvc] = useState("todos");
  const [fServer, setFServer] = useState(profile.pref_server || "todos");
  useEffect(() => { if (profile.pay_currency === "usd") fetchBlue().then(setBlue); }, [profile.pay_currency]);

  let open = orders.filter((o) => o.status === "available");
  if (fSvc !== "todos") open = open.filter((o) => o.service === fSvc);
  if (fServer !== "todos") open = open.filter((o) => o.server === fServer);

  const pinServer = async (val) => {
    setFServer(val);
    // Guardar el servidor fijado en el perfil (persiste entre sesiones/dispositivos)
    try { await supabase.from("profiles").update({ pref_server: val === "todos" ? null : val }).eq("id", profile.id); await reload(); } catch (e) {}
  };

  const accept = async (o) => {
    // El pago del booster se calcula sobre el precio ORIGINAL (antes del descuento del promo).
    // El descuento se descuenta de la ganancia, no del pago del booster.
    const originalPrice = Number(o.price) + Number(o.discount_ars || 0);
    const pay = Math.round(originalPrice * Number(profile.cut));
    const { data, error } = await supabase.from("orders")
      .update({ status: "in_progress", booster_id: profile.id, booster_name: profile.full_name, booster_pay: pay, profit: Number(o.price) - pay, accepted_at: new Date().toISOString() })
      .eq("id", o.id).eq("status", "available").select();
    if (error) { flash("No se pudo aceptar. Reintentá."); return; }
    if (!data || data.length === 0) { flash("Otro booster lo tomó primero."); await reload(); return; }
    await notify(`${profile.full_name} aceptó el pedido #${o.id} (${o.client_name}).`, "admin", null, "done", "order", o.id);
    await notify(`¡Tenés booster! ${profile.full_name} tomó tu servicio. Coordinen por Discord.`, null, o.client_id, "done", "order", o.id);
    // Mail al cliente (fire and forget, no bloquea si falla)
    supabase.functions.invoke("notify-client-email", { body: { event: "booster_assigned", order_id: o.id } }).then(() => {}, () => {});
    await reload(); flash(`Aceptaste el pedido #${o.id}`);
  };
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Trabajos disponibles</h1><p className="nop-sub">Clientes validados esperando booster. El primero que acepta se lo queda.</p></div></div>
    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="nop-field" style={{ margin: 0, flex: 1, minWidth: 160 }}><label>Servicio</label>
          <select className="nop-select" value={fSvc} onChange={(e) => setFSvc(e.target.value)}>
            <option value="todos">Todos los servicios</option>{Object.keys(SERVICES).map((k) => <option key={k} value={k}>{SERVICES[k].label}</option>)}
          </select></div>
        <div className="nop-field" style={{ margin: 0, flex: 1, minWidth: 160 }}><label>Servidor {fServer !== "todos" && <span style={{ color: "var(--gold)" }}>· 📌 fijado</span>}</label>
          <select className="nop-select" value={fServer} onChange={(e) => pinServer(e.target.value)}>
            <option value="todos">Todos los servidores</option>{ACCOUNT_SERVERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
      </div>
      <p className="nop-mini" style={{ marginTop: 8 }}>Si fijás un servidor, queda guardado y solo vas a ver trabajos de esa región cada vez que entres.</p>
    </div>
    {open.length === 0 ? <Empty icon={Zap} title="No hay trabajos abiertos" sub={fServer !== "todos" || fSvc !== "todos" ? "Probá quitar los filtros o cambiar de servidor." : "Apenas el admin valide un cliente nuevo, aparece acá al instante."} /> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>{open.map((o) => (
        <div className="nop-card nop-panel" key={o.id} style={{ display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><SvcTag s={o.service} /><span className="nop-mini">{timeAgo(o.created_at)}</span></div>
          <RankPath o={o} />
          <div className="nop-pillrow">
            <span className="nop-svc">{o.server}</span>
            {o.lp && <span className="nop-svc">{o.lp} LP</span>}
            {o.role_champ && /Rol:/i.test(o.role_champ) && <span className="nop-svc" style={{ background: "rgba(232,179,73,.15)", borderColor: "var(--gold)", color: "var(--gold)" }}>🎯 Rol</span>}
            {o.role_champ && /Camp[eé]on:/i.test(o.role_champ) && <span className="nop-svc" style={{ background: "rgba(232,179,73,.15)", borderColor: "var(--gold)", color: "var(--gold)" }}>🧙 Campeón</span>}
            {o.role_champ && (/Express/i.test(o.role_champ) || /⚡/.test(o.role_champ)) && <span className="nop-svc" style={{ background: "rgba(168,85,247,.15)", borderColor: "var(--violet)", color: "var(--violet)" }}>⚡ Express</span>}
          </div>
          {o.role_champ && cleanRoleDetail(o.role_champ) && <div className="nop-mini" style={{ color: "var(--mut)", background: "var(--bg2)", padding: "8px 10px", borderRadius: 8, wordBreak: "break-word", overflowWrap: "break-word", fontSize: 12, lineHeight: 1.45 }}>{cleanRoleDetail(o.role_champ)}</div>}
          {(o.pref_days || o.pref_times) && <div className="nop-mini" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {o.pref_days && <span><CalendarDays size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />{o.pref_days}</span>}
            {o.pref_times && <span><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />{o.pref_times}</span>}</div>}
          {o.notes && <p className="nop-mini" style={{ fontStyle: "italic" }}>"{o.notes}"</p>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
            <div><div className="nop-mini">Tu pago ({Math.round(profile.cut * 100)}%)</div><div className="nop-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{fmtBoosterPay(previewBoosterPay(o, profile.cut), profile, blue)}</div></div>
            <button className="nop-btn nop-btn-grn" onClick={() => accept(o)}><Check size={15} />Aceptar</button>
          </div>
        </div>))}</div>}
  </>;
}
function BoosterMine({ profile, orders, reload, flash, notify }) {
  const mine = orders.filter((o) => o.booster_id === profile.id && o.status === "in_progress");
  const [progressFor, setProgressFor] = useState(null);
  const [blue, setBlue] = useState(null);
  useEffect(() => { if (profile.pay_currency === "usd") fetchBlue().then(setBlue); }, [profile.pay_currency]);
  const finish = async (o) => {
    await supabase.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", o.id);
    await notify(`Servicio #${o.id} (${SERVICES[o.service].label}) finalizado por ${profile.full_name}.`, "admin", null, "done", "order", o.id);
    await notify(`Tu servicio #${o.id} fue finalizado. ¡Dejanos tu reseña!`, null, o.client_id, "done", "order", o.id);
    await reload(); flash(`Servicio #${o.id} finalizado`);
  };
  const giveBack = async (o) => {
    if (!window.confirm(`¿Devolver el servicio #${o.id}? Vuelve a "Trabajos disponibles" para que otro booster lo tome.`)) return;
    await supabase.from("orders").update({ status: "available", booster_id: null, booster_name: null, booster_pay: null, profit: null, accepted_at: null }).eq("id", o.id);
    await notify(`El servicio #${o.id} volvió a estar disponible.`, "booster", null, "new", "order", o.id);
    await notify(`El booster devolvió el servicio #${o.id}. Volvió a la lista de disponibles.`, "admin", null, "new", "order", o.id);
    await reload(); flash(`Servicio #${o.id} devuelto a disponibles`);
  };
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Mis servicios</h1><p className="nop-sub">Lo que tenés en curso.</p></div></div>
    {mine.length === 0 ? <Empty icon={Swords} title="No tenés servicios activos" sub="Aceptá un trabajo desde la pestaña de disponibles." /> :
      <div style={{ display: "grid", gap: 14 }}>{mine.map((o) => {
        const hasProgressUI = ["eloboost", "duoboost", "tft"].includes(o.service);
        const pct = progressPct(o);
        const prLabel = o.progress_rank ? `${o.progress_rank}${o.progress_rank !== "Master" ? " " + (o.progress_div || "") : ""}` : null;
        return (
        <div className="nop-card nop-panel" key={o.id}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><b style={{ color: "var(--mut)" }}>#{o.id}</b><SvcTag s={o.service} /><StatusBadge s={o.status} /><RankPath o={o} /></div>
            <div className="nop-display" style={{ fontWeight: 700, color: "var(--gold)" }}>{fmtBoosterPay(o.booster_pay, profile, blue)}</div>
          </div>
          <div className="nop-discordbox" style={{ marginBottom: 14 }}>
            <div className="ic"><MessageCircle size={19} /></div>
            <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>Coordiná con {o.client_name} ({o.client_discord})</b><div className="nop-mini">{o.summoner ? <>Invocador: <b style={{ color: "var(--tx)" }}>{o.summoner}</b> · </> : ""}Sala sugerida: <b style={{ color: "var(--tx)" }}>#pedido-{o.id}</b></div></div>
            <a className="nop-btn nop-btn-sm nop-btn-ghost" href={DISCORD_INVITE} target="_blank" rel="noreferrer">Abrir Discord</a>
          </div>
          {hasProgressUI && (
            <div className="nop-card" style={{ padding: 14, background: "var(--bg2)", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <div className="nop-panel-h" style={{ margin: 0 }}><TrendingUp size={14} style={{ color: "var(--gold)" }} />Progreso del servicio {pct != null ? <b style={{ color: "var(--gold)", marginLeft: 8 }}>{pct}%</b> : null}</div>
                <button className="nop-btn nop-btn-gold nop-btn-sm" onClick={() => setProgressFor(o)}><RefreshCw size={13} />Actualizar rango</button>
              </div>
              <div className="nop-mini" style={{ marginBottom: 8 }}>Actual: <b style={{ color: prLabel ? "var(--gold)" : "var(--mut2)" }}>{prLabel || "sin actualizar aún"}</b> · Objetivo: <b style={{ color: "var(--tx)" }}>{o.tgt_rank}{o.tgt_rank !== "Master" ? " " + (o.tgt_div || "") : ""}</b></div>
              <div style={{ height: 8, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: (pct || 0) + "%", background: "linear-gradient(90deg, var(--gold), var(--amber))", borderRadius: 999, transition: "width .4s" }} />
              </div>
              {o.summoner && opggUrl(o.summoner, o.server) && (
                <a href={opggUrl(o.summoner, o.server)} target="_blank" rel="noreferrer" className="nop-btn nop-btn-ghost nop-btn-sm" style={{ marginTop: 10 }}>
                  <Eye size={13} />Ver en op.gg
                </a>
              )}
            </div>
          )}
          {(o.pref_days || o.pref_times) && <div className="nop-mini" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            {o.pref_days && <span><CalendarDays size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Días: {o.pref_days}</span>}
            {o.pref_times && <span><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Horario: {o.pref_times}</span>}</div>}
          {o.notes && <p className="nop-mini" style={{ fontStyle: "italic", marginBottom: 14 }}>Nota: "{o.notes}"</p>}
          {o.admin_note && <div className="nop-card" style={{ padding: 12, background: "var(--bg2)", marginBottom: 14, borderLeft: "3px solid var(--amber)" }}>
            <div className="nop-mini" style={{ color: "var(--amber)", marginBottom: 4, fontWeight: 600 }}>📌 Nota del staff</div>
            <p style={{ fontSize: 13, color: "var(--tx)", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{o.admin_note}</p>
          </div>}
          {o.service === "eloboost" && (o.acct_user || o.acct_pass) && <div className="nop-card" style={{ padding: 14, background: "var(--bg2)", marginBottom: 14 }}>
            <div className="nop-panel-h" style={{ marginBottom: 10 }}><Shield size={14} style={{ color: "var(--gold)" }} />Credenciales de la cuenta</div>
            <Cred label="Usuario" value={o.acct_user} flash={flash} />
            <div style={{ height: 8 }} />
            <Cred label="Contraseña" value={o.acct_pass} flash={flash} />
            <p className="nop-mini" style={{ marginTop: 10 }}>Jugá en modo offline. No las compartas con nadie.</p>
          </div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="nop-btn nop-btn-grn" onClick={() => finish(o)}><Flag size={15} />Marcar finalizado</button>
            <button className="nop-btn nop-btn-ghost" onClick={() => giveBack(o)}><ArrowRight size={15} style={{ transform: "rotate(180deg)" }} />Devolver servicio</button>
          </div>
        </div>);
      })}</div>}
    {progressFor && <UpdateProgressModal order={progressFor} profile={profile} onClose={() => setProgressFor(null)} reload={reload} flash={flash} notify={notify} />}
  </>;
}

function UpdateProgressModal({ order, profile, onClose, reload, flash, notify }) {
  const [rk, setRk] = useState(order.progress_rank || order.cur_rank || "Oro");
  const [rd, setRd] = useState(order.progress_div || order.cur_div || "IV");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("orders").update({
      progress_rank: rk,
      progress_div: rk === "Master" ? null : rd,
      progress_updated_at: new Date().toISOString(),
      progress_updated_by: profile.id,
    }).eq("id", order.id);
    setBusy(false);
    if (error) { flash("No se pudo actualizar: " + error.message); return; }
    // Notificar al cliente
    if (order.client_id) {
      const label = `${rk}${rk !== "Master" ? " " + rd : ""}`;
      await notify(`Tu progreso se actualizó: ahora estás en ${label}.`, null, order.client_id, "done", "order", order.id);
    }
    await reload();
    flash("Progreso actualizado");
    onClose();
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Actualizar rango del cliente</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <p className="nop-mini" style={{ marginBottom: 14 }}>Cliente <b style={{ color: "var(--tx)" }}>{order.client_name}</b> · Inicio: {order.cur_rank}{order.cur_rank !== "Master" ? " " + (order.cur_div || "") : ""} · Objetivo: {order.tgt_rank}{order.tgt_rank !== "Master" ? " " + (order.tgt_div || "") : ""}</p>
      <div className="nop-field"><label>Liga actual del cliente</label>
        <div className="nop-row2">
          <select className="nop-select" value={rk} onChange={(e) => setRk(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
          <select className="nop-select" value={rd} onChange={(e) => setRd(e.target.value)} disabled={rk === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="nop-btn nop-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className="nop-btn nop-btn-gold" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}<Check size={15} /></button>
      </div>
    </div>
  </div></div>;
}
function BoosterHist({ profile, orders }) {
  const done = orders.filter((o) => o.booster_id === profile.id && o.status === "completed");
  const earned = done.reduce((a, o) => a + Number(o.booster_pay || 0), 0);
  const [blue, setBlue] = useState(null);
  useEffect(() => { if (profile.pay_currency === "usd") fetchBlue().then(setBlue); }, [profile.pay_currency]);
  const rs = done.filter((o) => o.survey_rating).map((o) => o.survey_rating);
  const avg = rs.length ? (rs.reduce((a, c) => a + c, 0) / rs.length).toFixed(1) : "—";
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Mi historial</h1><p className="nop-sub">Completados y ganancias{profile.pay_currency === "usd" ? " · cobrás en USD" : ""}.</p></div></div>
    <div className="nop-grid-kpi" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 14 }}>
      <div className="nop-card nop-kpi"><div className="lbl"><Trophy size={13} style={{ color: "var(--gold)" }} />Completados</div><div className="val">{done.length}</div></div>
      <div className="nop-card nop-kpi"><div className="lbl"><Wallet size={13} style={{ color: "var(--grn)" }} />Ganado total</div><div className="val">{fmtBoosterPay(earned, profile, blue)}</div></div>
      <div className="nop-card nop-kpi"><div className="lbl"><Star size={13} style={{ color: "var(--violet)" }} />Reseña prom.</div><div className="val">{avg !== "—" ? avg + " ★" : "—"}</div></div>
    </div>
    <div className="nop-card nop-panel">
      {profile.pay_currency === "usd" && <p className="nop-mini" style={{ marginBottom: 10 }}>Tu total está en USD (al blue{blue ? ` ${fmtARS(blue)}` : ""}). El detalle por servicio de la tabla se muestra en pesos.</p>}
      {done.length === 0 ? <Empty icon={Trophy} title="Aún sin cierres" sub="Tus servicios finalizados se listan acá." />
        : <OrdersTable orders={done} hideProfit cols={["id", "cliente", "rank", "servicio", "pago", "rating"]} />}
    </div>
  </>;
}

/* ===================== CLIENTE ===================== */
function ClientViews({ tab, setTab, ...ctx }) {
  if (tab === "new") return <ClientNew {...ctx} setTab={setTab} />;
  if (tab === "hist") return <ClientHistory {...ctx} />;
  if (tab === "accounts") return <ClientAccounts {...ctx} setTab={setTab} />;
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
        <div style={{ flex: 1 }}>
          {o.service === "eloboost"
            ? <><b style={{ fontSize: 13 }}>Un booster del equipo está trabajando en tu cuenta</b><div className="nop-mini">Cualquier consulta, contactanos por Discord en <b style={{ color: "var(--tx)" }}>#pedido-{o.id}</b>.</div></>
            : <><b style={{ fontSize: 13 }}>Tu booster es {o.booster_name}</b><div className="nop-mini">Entrá al Discord y buscá <b style={{ color: "var(--tx)" }}>#pedido-{o.id}</b>.</div></>}
        </div>
        <a className="nop-btn nop-btn-sm nop-btn-ghost" href={DISCORD_INVITE} target="_blank" rel="noreferrer">Abrir Discord</a></div>}
      {o.status === "in_progress" && ["eloboost", "duoboost", "tft"].includes(o.service) && (() => {
        const pct = progressPct(o);
        const prLabel = o.progress_rank ? `${o.progress_rank}${o.progress_rank !== "Master" ? " " + (o.progress_div || "") : ""}` : `${o.cur_rank}${o.cur_rank !== "Master" ? " " + (o.cur_div || "") : ""}`;
        const initLabel = `${o.cur_rank}${o.cur_rank !== "Master" ? " " + (o.cur_div || "") : ""}`;
        const tgtLabel = `${o.tgt_rank}${o.tgt_rank !== "Master" ? " " + (o.tgt_div || "") : ""}`;
        const displayPct = pct != null ? pct : 0;
        return <div className="nop-card" style={{ padding: 16, marginTop: 12, background: "var(--bg2)" }}>
          <div className="nop-panel-h" style={{ marginBottom: 12 }}><TrendingUp size={15} style={{ color: "var(--gold)" }} />Progreso del servicio</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, fontSize: 13 }}>
            <span className="nop-mini">Inicio: <b style={{ color: "var(--tx)" }}>{initLabel}</b> · Actual: <b style={{ color: "var(--gold)" }}>{prLabel}</b> · Objetivo: <b style={{ color: "var(--tx)" }}>{tgtLabel}</b></span>
            <b style={{ color: "var(--gold)", fontSize: 18 }}>{displayPct}%</b>
          </div>
          <div style={{ height: 10, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: displayPct + "%", background: "linear-gradient(90deg, var(--gold), var(--amber))", borderRadius: 999, transition: "width .4s" }} />
          </div>
          {o.progress_updated_at && <div className="nop-mini" style={{ marginTop: 8 }}>Última actualización: {timeAgo(o.progress_updated_at)}</div>}
          {!o.progress_rank && <div className="nop-mini" style={{ marginTop: 8, color: "var(--mut2)" }}>Tu booster va a actualizar el progreso a medida que avance.</div>}
          {o.summoner && opggUrl(o.summoner, o.server) && (
            <a href={opggUrl(o.summoner, o.server)} target="_blank" rel="noreferrer" className="nop-btn nop-btn-ghost nop-btn-sm" style={{ marginTop: 12, width: "100%" }}>
              <Eye size={13} />Ver historial de partidas en op.gg
            </a>
          )}
        </div>;
      })()}
      {o.status === "in_progress" && o.service === "eloboost" && <div className="nop-card" style={{ padding: 14, marginTop: 12, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Shield size={18} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.6 }}><b style={{ color: "#f87171" }}>Importante:</b> no ingreses a tu cuenta hasta que el servicio esté completado. Por seguridad (cambio de IP), si entrás mientras el booster trabaja, podés interrumpir el servicio o exponer la cuenta.</span>
      </div>}
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
  const DRAFT_KEY = "nop_draft_" + profile.id;
  const [eloRoles, setEloRoles] = useState([]);
  const [rolOn, setRolOn] = useState(false);
  const [champOn, setChampOn] = useState(false), [champName, setChampName] = useState("");
  const [express, setExpress] = useState(false);
  const [acctUser, setAcctUser] = useState(""), [acctPass, setAcctPass] = useState("");
  const [summoner, setSummoner] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [currency, setCurrency] = useState("ars"); // ars | usd

  // LAN y BR solo cobran USD; si el usuario cambia a esos servers, forzar USD
  useEffect(() => {
    if ((server === "LAN" || server === "BR") && currency === "ars") setCurrency("usd");
  }, [server]);
  const [blue, setBlue] = useState(null);
  useEffect(() => { if (currency === "usd" && !blue) fetchBlue().then(setBlue); }, [currency]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  // Codigo promocional
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null);         // objeto del promo validado o null
  const [promoErr, setPromoErr] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const applyPromo = async () => {
    setPromoErr("");
    const code = promoInput.trim();
    if (!code) { setPromoErr("Ingresá un código."); return; }
    setPromoBusy(true);
    try {
      const { data, error } = await supabase.rpc("validate_promo_code", { p_code: code, p_client_id: profile?.id || null });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setPromo(null); setPromoErr("Ese código no existe, venció, ya lo usaste o está desactivado."); }
      else { setPromo(row); setPromoErr(""); flash(`Código ${row.code} aplicado`); }
    } catch (e) {
      setPromoErr("No se pudo validar el código. Reintentá.");
    } finally { setPromoBusy(false); }
  };
  const removePromo = () => { setPromo(null); setPromoInput(""); setPromoErr(""); };
  const isCoaching = service === "coaching";
  const isElo = service === "eloboost";
  const isSingleMatch = service === "single_match";
  const isPlacements = service === "placements";
  const isTft = service === "tft";
  const isDuo = service === "duoboost";
  const [placementMode, setPlacementMode] = useState("soloq");
  const [protectDec, setProtectDec] = useState(false);
  const [placementChamp, setPlacementChamp] = useState(false);
  const [placementChampName, setPlacementChampName] = useState("");
  const [coachAddon, setCoachAddon] = useState(false); // coaching como extra en duoboost/tft
  const [discordInput, setDiscordInput] = useState(profile.discord || "");
  const [discordErr, setDiscordErr] = useState("");
  const needsDiscord = !profile.discord;
  const curPos = rankPos(cur, curD);
  const steps = rankPos(tgt, tgtD) - curPos;
  // Regla eloboost: como máximo 2 ligas adelante, y si es la segunda liga siguiente, solo hasta IV.
  const curRankIdx = RANKS.indexOf(cur);
  const tgtRankIdx = RANKS.indexOf(tgt);
  const maxTgtRankIdx = Math.min(RANKS.length - 1, curRankIdx + 2);
  const eloTooFar = isElo && (
    tgtRankIdx > curRankIdx + 2 ||
    (tgtRankIdx === curRankIdx + 2 && tgt !== "Master" && tgtD !== "IV")
  );
  // Ningún servicio con rango objetivo (elo/duoboost/combo) puede tener destino <= actual
  const rankInvalid = !isCoaching && !isSingleMatch && !isPlacements && steps <= 0;
  const eloInvalid = isElo && (steps <= 0 || eloTooFar);
  const stepInvalid = rankInvalid || eloInvalid;
  // límites de selección para eloboost
  const eloTgtRanks = RANKS.filter((r, i) => i >= curRankIdx && i <= maxTgtRankIdx);
  const eloTgtDivs = DIVS.filter((d) => {
    if (rankPos(tgt, d) <= curPos) return false;
    if (tgtRankIdx === maxTgtRankIdx && tgt !== "Master" && d !== "IV") return false;
    return true;
  });
  // Reset protectDec si la liga elegida no es elegible (Hierro/Bronce/Plata)
  useEffect(() => {
    if (protectDec && !PROTECT_ELIGIBLE_RANKS.includes(cur)) setProtectDec(false);
  }, [cur, protectDec]);
  // Auto-corregir tgt/tgtD cuando la elección actual queda inválida (ej: pasar de Oro IV a Diamante IV)
  useEffect(() => {
    if (!isElo && isCoaching) return;
    // Si el destino está fuera del rango permitido (o quedó igual o menor al actual), corregir
    if (tgtRankIdx < curRankIdx || tgtRankIdx > maxTgtRankIdx || rankPos(tgt, tgtD) <= curPos || (isElo && eloTooFar)) {
      // Elegir el primer destino válido: misma liga con div superior o siguiente liga
      const curDivIdx = DIVS.indexOf(curD);
      if (cur === "Master") {
        // Ya está en Master, no hay destino posible
        return;
      }
      if (curDivIdx > 0) {
        // Misma liga, division superior (ej: Oro IV → Oro III)
        setTgt(cur);
        setTgtD(DIVS[curDivIdx - 1]);
      } else {
        // curD es "I", saltar a la siguiente liga en IV
        const nextRank = RANKS[curRankIdx + 1];
        if (nextRank) {
          setTgt(nextRank);
          setTgtD(nextRank === "Master" ? "IV" : "IV");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, curD, service]);
  const lpSurcharge = lp === "+15" ? 1.1 : 1;

  const priceBoth = useMemo(() => {
    let base;
    if (isCoaching) {
      // coaching: precio fijo en ARS; USD se sigue convirtiendo con el blue (spec del user)
      const ars = COACHING_PRICE[games];
      const usd = blue ? Math.round((ars / blue) * 100) / 100 : null;
      base = { ars, usd };
    } else if (isSingleMatch) {
      // Si tiene el pack protección de decaimiento activado (solo disponible Oro+), precio fijo
      if (protectDec && PROTECT_ELIGIBLE_RANKS.includes(cur)) {
        base = { ars: SINGLE_MATCH_PROTECT_ARS, usd: SINGLE_MATCH_PROTECT_USD };
      } else {
        base = singleMatchPrice(cur, games);
      }
    } else if (isPlacements) {
      // placements: 5 partidas de inicio de temporada, precio segun modo (soloq/duoq)
      let ars = PLACEMENTS_ARS[placementMode] || 0;
      let usd = PLACEMENTS_USD[placementMode] || 0;
      // Extra: en SoloQ, si eligió campeón específico, +50%
      if (placementMode === "soloq" && placementChamp) {
        ars = Math.round(ars * 1.5 / 100) * 100;
        usd = Math.round(usd * 1.5 * 100) / 100;
      }
      base = { ars, usd };
    } else {
      // precio base (suma por división)
      let { ars, usd } = estimateBase(cur, curD, tgt, tgtD);
      // multiplicadores ADITIVOS sobre el base (no compuestos)
      let mult = 0;
      if (service === "duoboost") mult += 0.50;                        // DuoBoost = +50%
      if (isTft) mult -= 0.20;                                         // TFT = 20% más barato que eloboost base
      if ((isDuo || isTft) && coachAddon) mult += 0.50;               // Coaching addon = +50%
      if (isElo) {
        if (lp === "+15") mult += 0.10;                                // LP +15 = +10%
        if (rolOn && eloRoles.length) mult += 0.30;                    // Rol específico = +30%
        if (champOn) mult += 0.50;                                     // Campeón específico = +50%
        if (express) mult += 0.20;                                     // Express = +20%
      }
      base = {
        ars: Math.round((ars * (1 + mult)) / 100) * 100,               // redondeo a centena
        usd: Math.round((usd * (1 + mult)) * 100) / 100,               // 2 decimales
      };
    }
    // aplicar descuento del promo (si hay uno validado)
    let discArs = 0, discUsd = 0;
    if (promo) {
      if (promo.discount_type === "percent" && promo.discount_percent) {
        discArs = Math.round((base.ars * Number(promo.discount_percent) / 100) / 100) * 100;
        discUsd = Math.round((base.usd * Number(promo.discount_percent) / 100) * 100) / 100;
      } else if (promo.discount_type === "amount") {
        discArs = Math.min(base.ars, Number(promo.discount_ars) || 0);
        discUsd = Math.min(base.usd || 0, Number(promo.discount_usd) || 0);
      }
    }
    return {
      arsBase: base.ars,
      usdBase: base.usd,
      arsDisc: discArs,
      usdDisc: discUsd,
      ars: Math.max(0, base.ars - discArs),
      usd: base.usd != null ? Math.max(0, base.usd - discUsd) : null,
    };
  }, [service, cur, curD, tgt, tgtD, games, isCoaching, isElo, isSingleMatch, isPlacements, isTft, isDuo, coachAddon, placementMode, placementChamp, protectDec, rolOn, eloRoles, champOn, express, lp, blue, promo]);
  const price = priceBoth.ars;
  const usdAmount = priceBoth.usd;
  const SvcIc = ({ k }) => { const Ic = SERVICES[k].icon; return <Ic size={19} />; };
  const copy = (t) => { try { navigator.clipboard.writeText(t); flash("Copiado: " + t); } catch (e) { flash("Copiá manualmente: " + t); } };

  // guardar/restaurar borrador del formulario (sobrevive refresh y cambio de pestaña)
  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d) { setService(d.service ?? "duoboost"); setCur(d.cur ?? "Oro"); setCurD(d.curD ?? "IV"); setTgt(d.tgt ?? "Platino"); setTgtD(d.tgtD ?? "IV");
        setServer(d.server ?? "LAS"); setLp(d.lp ?? "+20"); setGames(d.games ?? 3); setRoleChamp(d.roleChamp ?? ""); setNotes(d.notes ?? "");
        setDays(d.days ?? []); setTimes(d.times ?? []); setEloRoles(d.eloRoles ?? []); setRolOn(d.rolOn ?? false);
        setChampOn(d.champOn ?? false); setChampName(d.champName ?? ""); setExpress(d.express ?? false); setStep(d.step ?? 1); }
    } catch (e) {}
  }, []);
  useEffect(() => {
    const d = { service, cur, curD, tgt, tgtD, server, lp, games, roleChamp, notes, days, times, eloRoles, rolOn, champOn, champName, express, step };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
  }, [service, cur, curD, tgt, tgtD, server, lp, games, roleChamp, notes, days, times, eloRoles, rolOn, champOn, champName, express, step]);

  const submit = async () => {
    if (busy) return;                                // prevenir doble click
    if (!file) { flash("Subí el comprobante de pago para continuar."); return; }
    if (!isElo && !summoner.trim()) { flash("Ingresá tu nombre de invocador."); return; }
    if (isElo && (!acctUser || !acctPass)) { flash("Ingresá el usuario y la contraseña de la cuenta."); return; }
    if (isElo && !accepted) { flash("Tenés que aceptar los términos y condiciones."); return; }
    // Discord obligatorio si el perfil no lo tiene
    if (needsDiscord) {
      const derr = validateDiscord(discordInput);
      if (derr) { setDiscordErr(derr); flash(derr); return; }
    }
    setBusy(true);
    try {
      // Si el perfil no tenía discord y ahora lo cargó, lo guardamos en el perfil
      if (needsDiscord && discordInput.trim()) {
        try { await supabase.from("profiles").update({ discord: discordInput.trim() }).eq("id", profile.id); } catch (e) {}
      }
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("comprobantes").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const eloDetail = isElo ? `${rolOn && eloRoles.length ? "Rol: " + eloRoles.join("/") : "Sin rol fijo"}${champOn && champName ? ` · Campeón: ${champName}` : ""}${express ? " · ⚡ Express" : ""} · LP ${lp}` : "";
      let fxRate = null, usdAmt = null;
      if (currency === "usd") {
        usdAmt = usdAmount;
        fxRate = blue || (await fetchBlue());
      }
      const noTgt = isCoaching || isSingleMatch || isPlacements;
      const row = {
        client_id: profile.id, client_name: profile.full_name, client_discord: (needsDiscord ? discordInput.trim() : profile.discord) || profile.email,
        service, cur_rank: cur, cur_div: curD,
        tgt_rank: noTgt ? cur : tgt, tgt_div: noTgt ? curD : tgtD,
        server, lp: (isCoaching || isSingleMatch || isPlacements) ? null : lp,
        games: isCoaching ? games : isSingleMatch ? (protectDec ? 4 : games) : isPlacements ? 5 : null,
        role_champ: isCoaching ? `${roleChamp || "Sin preferencia"} · ${games} partida${games > 1 ? "s" : ""}`
          : isSingleMatch ? (protectDec ? "Pack protección decaimiento · 4 partidas" : `${games} partida${games > 1 ? "s" : ""}`)
          : isPlacements ? `Placements ${placementMode.toUpperCase()} · 5 partidas${placementMode === "soloq" && placementChamp ? " · Campeón: " + (placementChampName || "específico") : ""}`
          : isTft ? `TFT${coachAddon ? " · Coaching incluido" : ""}${roleChamp ? " · " + roleChamp : ""}`
          : isDuo ? `${roleChamp || "Sin preferencia"}${coachAddon ? " · Coaching incluido" : ""}`
          : isElo ? eloDetail : roleChamp,
        notes, payment: currency === "ars" ? "Transferencia (pesos)" : "PayPal (USD)", price, status: "pending",
        receipt_path: path,
        pref_days: isElo ? null : days.join(", "), pref_times: isElo ? null : times.join(", "),
        acct_user: isElo ? acctUser : null, acct_pass: isElo ? acctPass : null,
        summoner: isElo ? acctUser : summoner,
        currency, usd_amount: usdAmt, fx_rate: fxRate,
        promo_code_id: promo?.id || null,
        promo_code_text: promo?.code || null,
        discount_ars: promo ? priceBoth.arsDisc || null : null,
        discount_usd: promo ? priceBoth.usdDisc || null : null,
      };
      const { data: created, error } = await supabase.from("orders").insert(row).select("id").single();
      if (error) throw error;
      // incrementar contador del promo — fire and forget, envuelto en función async para que NADA pueda romperlo
      if (promo?.id) {
        (async () => {
          try { await supabase.rpc("increment_promo_usage", { p_code_id: promo.id }); } catch (e) { console.warn("promo increment failed", e); }
        })();
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      try { await notify(`Nuevo pedido de ${profile.full_name} — ${SERVICES[service].label} — entró por validar (con comprobante).`, "admin", null, "new", "order", created?.id); } catch (e) {}
      await reload(); flash("¡Pedido enviado! Validamos el comprobante y pasa a los boosters."); setTab("home");
    } catch (e) {
      console.error("Error al enviar pedido:", e);
      flash("No se pudo enviar el pedido: " + (e.message || e.error_description || "error desconocido"));
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

        {!isPlacements && <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "6px 0 12px" }}>2 · {isCoaching ? "Tu nivel y cuántas partidas" : isSingleMatch ? "Tu liga y cantidad de partidas" : "Liga actual y objetivo"}</label>}
        {!isCoaching && !isSingleMatch && !isPlacements ? <div className="nop-row2" style={{ marginBottom: 4 }}>
          <div className="nop-field" style={{ marginBottom: 8 }}><label>Liga actual <span className="req">*</span></label><div className="nop-row2">
            <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
            <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)} disabled={cur === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
          <div className="nop-field" style={{ marginBottom: 8 }}><label>Liga objetivo <span className="req">*</span></label><div className="nop-row2">
            <select className="nop-select" value={tgt} onChange={(e) => setTgt(e.target.value)}>{(isElo ? eloTgtRanks : RANKS).map((r) => <option key={r}>{r}</option>)}</select>
            <select className="nop-select" value={tgtD} onChange={(e) => setTgtD(e.target.value)} disabled={tgt === "Master"}>{(isElo ? (eloTgtDivs.length ? eloTgtDivs : ["IV"]) : DIVS).map((d) => <option key={d}>{d}</option>)}</select></div></div>
        </div> : isCoaching ? <div className="nop-row2">
          <div className="nop-field"><label>Tu liga actual</label><div className="nop-row2">
            <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
            <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)} disabled={cur === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
          <div className="nop-field"><label>Cantidad de partidas</label>
            <select className="nop-select" value={games} onChange={(e) => setGames(parseInt(e.target.value))}><option value={1}>1 partida</option><option value={3}>3 partidas</option><option value={5}>5 partidas</option></select></div>
        </div> : isSingleMatch ? <>
          <div className="nop-row2">
            <div className="nop-field"><label>Tu liga actual <span className="req">*</span></label><div className="nop-row2">
              <select className="nop-select" value={cur} onChange={(e) => setCur(e.target.value)}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
              <select className="nop-select" value={curD} onChange={(e) => setCurD(e.target.value)} disabled={cur === "Master"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
            <div className="nop-field"><label>Elegí paquete <span className="req">*</span></label>
              <select className="nop-select" value={games} onChange={(e) => setGames(parseInt(e.target.value))} disabled={protectDec}>
                {SINGLE_MATCH_OPTIONS.map((o) => (
                  <option key={o.games} value={o.games}>{o.label}{o.off ? ` (${o.off}% off)` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="nop-card" style={{ padding: 12, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.3)", marginTop: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--grn)", marginBottom: 6 }}>✅ Winrate garantizado del 70%</div>
            <div className="nop-mini" style={{ lineHeight: 1.5 }}>
              Jugamos partidas clasificatorias en tu cuenta para que subas MMR sin jugarlas vos.
              Podés comprar 1 partida suelta o packs con descuento.
            </div>
          </div>
          {(cur === "Diamante" || cur === "Master") && (
            <div className="nop-card" style={{ padding: 12, background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.3)", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cyan)", marginBottom: 6 }}>🛡️ Protección contra decaimiento (Diamante+)</div>
              <div className="nop-mini" style={{ lineHeight: 1.5, marginBottom: 10 }}>
                En Diamante+ perdés LP por inactividad. Jugamos partidas clasificatorias en tu cuenta para mantener tu <b>contador de protección</b> al máximo, sin que tengas que jugar vos.<br /><br />
                <b>Recomendado:</b> pack de 4 partidas por mes (~28 días de protección).<br />
                <b>¿Cómo funciona?</b> Contratás el paquete, coordinamos horario y jugamos en tu cuenta. Podés revisar los días de protección en <b>Perfil &gt; Clasificatoria</b>. Cuando se te acabe o quieras renovar, nos avisás.
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "10px 12px", background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.35)", borderRadius: 8 }}>
                <input type="checkbox" checked={protectDec} onChange={(e) => setProtectDec(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cyan)" }}>Activar pack de 4 partidas (protección de decaimiento)</span>
              </label>
            </div>
          )}
        </> : null}
        {isPlacements && <>
          <div className="nop-field" style={{ maxWidth: 420 }}><label>Modalidad <span className="req">*</span></label>
            <div className="nop-segwrap" style={{ marginBottom: 0 }}>
              <button type="button" className={"nop-seg" + (placementMode === "soloq" ? " on" : "")} onClick={() => setPlacementMode("soloq")}>SoloQ</button>
              <button type="button" className={"nop-seg" + (placementMode === "duoq" ? " on" : "")} onClick={() => setPlacementMode("duoq")}>DuoQ</button>
            </div>
          </div>
          <div className="nop-card" style={{ padding: 12, background: "rgba(251,146,60,.08)", border: "1px solid rgba(251,146,60,.3)", marginTop: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber)", marginBottom: 6 }}>🏁 5 partidas de posicionamiento — inicio de temporada</div>
            <div className="nop-mini" style={{ lineHeight: 1.5 }}>
              Jugamos tus 5 partidas de placements para asegurar el mejor arranque de temporada. Elegí <b>SoloQ</b> (jugamos por vos en tu cuenta) o <b>DuoQ</b> (te acompañamos en dúo).
            </div>
          </div>
        </>}
        {(isDuo || isTft) && (
          <div className="nop-card" style={{ padding: 12, background: coachAddon ? "rgba(168,85,247,.1)" : "var(--bg2)", border: "1px solid " + (coachAddon ? "var(--violet)" : "var(--line)"), marginTop: 6, marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={coachAddon} onChange={(e) => setCoachAddon(e.target.checked)} />
              <div>
                <b style={{ fontSize: 13 }}>Agregar Coaching <span style={{ color: "var(--violet)" }}>(+50%)</span></b>
                <div className="nop-mini">El booster te explica en vivo mientras juegan: macro, decisiones, pool de campeones. Aprendés a rankear vos.</div>
              </div>
            </label>
          </div>
        )}
        {!isCoaching && !isSingleMatch && !isPlacements && <div className={"nop-" + (stepInvalid ? "err" : "ok")} style={{ marginTop: 4 }}>
          {eloTooFar ? "🔒 En Eloboost subimos como máximo 2 ligas y sólo hasta la división IV de la segunda liga (ej: Hierro IV → Plata IV, no Plata III). Ajustá el objetivo."
            : rankInvalid ? "La liga objetivo tiene que ser más alta que la actual. No podés pedir bajar de división."
              : isElo ? "✅ Recorrido válido."
                : "✅ Recorrido válido."}
        </div>}

        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "10px 0 12px" }}>3 · Detalles</label>
        <div className="nop-row2">
          <div className="nop-field"><label>Servidor <span className="req">*</span></label><select className="nop-select" value={server} onChange={(e) => setServer(e.target.value)}><option>LAS</option><option>LAN</option><option>BR</option></select></div>
          {!isCoaching && !isElo && !isSingleMatch && !isPlacements && <div className="nop-field"><label>Ganancia LP aprox</label><select className="nop-select" value={lp} onChange={(e) => setLp(e.target.value)}><option>+15</option><option>+20</option><option>+25</option></select></div>}
        </div>

        {isElo ? <>
          <div className="nop-row2">
            <div className="nop-field"><label>Ganancia LP aprox <span title="Con +15 LP el recargo es del 10%. +20 y +25 mantienen el precio." style={{ cursor: "help", color: "var(--mut2)" }}>ⓘ</span></label>
              <select className="nop-select" value={lp} onChange={(e) => setLp(e.target.value)}><option>+15</option><option>+20</option><option>+25</option></select></div>
            <div />
          </div>
          <div className="nop-field">
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={rolOn} onChange={(e) => setRolOn(e.target.checked)} /> Rol específico <b style={{ color: "var(--gold)" }}>(+30%)</b> <span style={{ color: "var(--mut2)", fontWeight: 400 }}>· opcional</span></label>
            {rolOn && <div className="nop-chiprow" style={{ marginTop: 8 }}>{LANES.map((l) => (
              <button type="button" key={l} className={"nop-chip" + (eloRoles.includes(l) ? " on" : "")} onClick={() => toggleArr(eloRoles, setEloRoles, l)}>{l}</button>))}</div>}
            {rolOn && <p className="nop-mini" style={{ marginTop: 6 }}>Podés elegir más de un rol.</p>}</div>
          <div className="nop-field">
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={champOn} onChange={(e) => setChampOn(e.target.checked)} /> Campeón específico <b style={{ color: "var(--gold)" }}>(+50%)</b></label>
            {champOn && <input className="nop-input" style={{ marginTop: 8 }} value={champName} onChange={(e) => setChampName(e.target.value)} placeholder="¿Con qué campeón querés que suba? Ej: Yasuo" />}</div>
          <div className="nop-field">
            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} /> Entrega express <b style={{ color: "var(--gold)" }}>(+20%)</b>
              <span title="Te damos prioridad para asignarte un booster lo antes posible." style={{ cursor: "help", color: "var(--mut2)" }}>ⓘ</span></label></div>
        </> : isSingleMatch ? null : isPlacements ? (
          placementMode === "soloq" ? <>
            <div className="nop-field">
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                <input type="checkbox" checked={placementChamp} onChange={(e) => setPlacementChamp(e.target.checked)} /> Campeón específico <b style={{ color: "var(--gold)" }}>(+50%)</b>
              </label>
              {placementChamp && <input className="nop-input" style={{ marginTop: 8 }} value={placementChampName} onChange={(e) => setPlacementChampName(e.target.value)} placeholder="¿Con qué campeón querés jugar? Ej: Yasuo" />}
            </div>
          </> : <>
            <div className="nop-field"><label><CalendarDays size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Días de preferencia</label>
              <div className="nop-chiprow">{PREF_DAYS.map((d) => (
                <button type="button" key={d} className={"nop-chip" + (days.includes(d) ? " on" : "")} onClick={() => toggleArr(days, setDays, d)}>{d}</button>))}</div></div>
            <div className="nop-field"><label><Clock size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />Preferencia horaria</label>
              <div className="nop-chiprow">{PREF_TIMES.map((t) => (
                <button type="button" key={t} className={"nop-chip" + (times.includes(t) ? " on" : "")} onClick={() => toggleArr(times, setTimes, t)}>{t}</button>))}</div>
              <p className="nop-mini" style={{ marginTop: 6 }}>Podés elegir varios (o todos). El booster los ve para coordinar.</p></div>
          </>
        ) : <>
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
          <div>
            {stepInvalid ? (
              <div className="nop-mini" style={{ color: "var(--red)", fontSize: 13 }}>Ajustá la liga objetivo para ver el precio.</div>
            ) : <>
              <div className="nop-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)", lineHeight: 1.1 }}>
                {server === "LAS" ? (
                  <>{fmtARS(price)} <span style={{ fontSize: 18, color: "var(--violet)" }}>· {usdAmount ? fmtUSD(usdAmount) : "—"}</span></>
                ) : (
                  <span style={{ color: "var(--violet)" }}>{usdAmount ? fmtUSD(usdAmount) : "—"}</span>
                )}
              </div>
              {((isDuo && coachAddon) || isTft || (isElo && ((lpSurcharge > 1) || (rolOn && eloRoles.length > 0) || champOn || express))) && (
                <div className="nop-mini" style={{ marginTop: 6 }}>
                  {[
                    isTft && "TFT −20%",
                    (isDuo || isTft) && coachAddon && "coaching +50%",
                    isElo && lpSurcharge > 1 && "+10% LP",
                    isElo && rolOn && eloRoles.length > 0 && "+30% rol",
                    isElo && champOn && "+50% campeón",
                    isElo && express && "+20% express",
                  ].filter(Boolean).join(" · ")}
                </div>
              )}
            </>}
          </div>
          <button className="nop-btn nop-btn-gold" disabled={stepInvalid} onClick={() => setStep(2)}>Siguiente: pago <ArrowRight size={15} /></button>
        </div>
      </>}

      {step === 2 && <>
        {/* Codigo promocional */}
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 10 }}>Código promocional (opcional)</label>
        {!promo ? (
          <div className="nop-card" style={{ padding: 14, background: "var(--bg2)", marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="nop-input" style={{ flex: 1, minWidth: 160, textTransform: "uppercase" }} placeholder="Ej: PROMO10" value={promoInput} onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoErr(""); }} onKeyDown={(e) => e.key === "Enter" && applyPromo()} />
              <button className="nop-btn nop-btn-ghost" disabled={promoBusy || !promoInput.trim()} onClick={applyPromo}>{promoBusy ? "Validando…" : "Aplicar"}</button>
            </div>
            {promoErr && <div className="nop-mini" style={{ color: "var(--red)", marginTop: 8 }}>{promoErr}</div>}
          </div>
        ) : (
          <div className="nop-card" style={{ padding: 14, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.35)", marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Check size={16} style={{ color: "var(--grn)" }} />
                  <b style={{ color: "var(--grn)", fontSize: 14 }}>{promo.code}</b>
                </div>
                <div className="nop-mini">
                  {promo.discount_type === "percent"
                    ? `Descuento del ${promo.discount_percent}%`
                    : `Descuento fijo${(currency === "ars" && promo.discount_ars) ? ` de ${fmtARS(promo.discount_ars)}` : (currency === "usd" && promo.discount_usd) ? ` de ${fmtUSD(promo.discount_usd)}` : ""}`}
                  {(currency === "ars" && priceBoth.arsDisc > 0) && ` · Ahorrás ${fmtARS(priceBoth.arsDisc)}`}
                  {(currency === "usd" && priceBoth.usdDisc > 0) && ` · Ahorrás ${fmtUSD(priceBoth.usdDisc)}`}
                </div>
                {promo.discount_type === "amount" && ((currency === "ars" && !promo.discount_ars) || (currency === "usd" && !promo.discount_usd)) && (
                  <div className="nop-mini" style={{ color: "var(--amber)", marginTop: 4 }}>Este código no tiene monto para {currency.toUpperCase()}. Cambiá de moneda o probá otro.</div>
                )}
              </div>
              <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={removePromo}><X size={13} />Quitar</button>
            </div>
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 10 }}>4 · Elegí la moneda{(server === "LAN" || server === "BR") && <span style={{ color: "var(--mut2)", fontWeight: 400 }}> · {server} solo acepta USD</span>}</label>
        <div className="nop-segwrap" style={{ marginBottom: 18 }}>
          <button type="button" className={"nop-seg" + (currency === "ars" ? " on" : "")} disabled={server === "LAN" || server === "BR"} style={{ opacity: (server === "LAN" || server === "BR") ? .45 : 1, cursor: (server === "LAN" || server === "BR") ? "not-allowed" : "pointer" }} onClick={() => setCurrency("ars")}>Pesos ARS (transferencia)</button>
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
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              {promo && priceBoth.arsDisc > 0 ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--mut)", marginBottom: 4 }}>
                    <span>Precio original</span>
                    <span style={{ textDecoration: "line-through" }}>{fmtARS(priceBoth.arsBase)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--grn)", marginBottom: 8 }}>
                    <span>Descuento ({promo.code})</span>
                    <span>− {fmtARS(priceBoth.arsDisc)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 6, borderTop: "1px dashed var(--line)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Monto a transferir</span>
                    <b className="nop-display" style={{ color: "var(--gold)", fontSize: 22, fontWeight: 700 }}>{fmtARS(price)}</b>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Monto a transferir</span>
                  <b className="nop-display" style={{ color: "var(--gold)", fontSize: 22, fontWeight: 700 }}>{fmtARS(price)}</b>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="nop-card" style={{ padding: 18, background: "var(--bg2)", marginBottom: 18 }}>
            <div className="nop-panel-h" style={{ marginBottom: 12 }}><Wallet size={15} style={{ color: "var(--violet)" }} />Pagá con PayPal</div>
            {promo && priceBoth.usdDisc > 0 && usdAmount != null && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--mut)", marginBottom: 4 }}>
                  <span>Precio original</span>
                  <span style={{ textDecoration: "line-through" }}>{fmtUSD(priceBoth.usdBase)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--grn)", marginBottom: 8 }}>
                  <span>Descuento ({promo.code})</span>
                  <span>− {fmtUSD(priceBoth.usdDisc)}</span>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: (promo && priceBoth.usdDisc > 0) ? 6 : 0, borderTop: (promo && priceBoth.usdDisc > 0) ? "1px dashed var(--line)" : "none", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Monto a pagar</span>
              <b className="nop-display" style={{ color: "var(--violet)", fontSize: 22, fontWeight: 700 }}>{usdAmount ? fmtUSD(usdAmount) : "calculando…"}</b>
            </div>
            <p className="nop-mini" style={{ marginBottom: 14 }}>Abrí el link, hacé el pago y descargá el comprobante para subirlo abajo.</p>
            <a className="nop-btn nop-btn-violet" href={PAYPAL_URL} target="_blank" rel="noreferrer"><ArrowRight size={15} />Ir a PayPal</a>
          </div>
        )}

        {!isElo && <div className="nop-field"><label>Nombre de invocador <span className="req">*</span></label>
          <input className="nop-input" value={summoner} onChange={(e) => setSummoner(e.target.value)} placeholder="Tu nombre de invocador en LoL" /></div>}

        {needsDiscord && <div className="nop-field"><label>Tu usuario de Discord <span className="req">*</span></label>
          <input className="nop-input" value={discordInput} onChange={(e) => { setDiscordInput(e.target.value); setDiscordErr(""); }} placeholder="Ej: cristian88" />
          {discordErr && <p className="nop-mini" style={{ color: "var(--red)", marginTop: 6 }}>{discordErr}</p>}
          <p className="nop-mini" style={{ marginTop: 6 }}>Importante: lo usamos para coordinar el servicio con tu booster por Discord. Se guarda en tu perfil.</p>
        </div>}

        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "4px 0 10px" }}>5 · Subí el comprobante <span className="req">*</span></label>
        <label className="nop-upload">
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Upload size={22} style={{ color: file ? "var(--grn)" : "var(--mut)" }} />
          <span>{file ? file.name : "Tocá para elegir una imagen o PDF del comprobante"}</span>
        </label>
        {!file && <p className="nop-mini" style={{ marginTop: 8 }}>Sin comprobante no podés enviar el pedido.</p>}

        {isElo && <div className="nop-card" style={{ padding: 16, background: "var(--bg2)", marginTop: 18 }}>
          <div className="nop-panel-h" style={{ marginBottom: 6 }}><Shield size={15} style={{ color: "var(--gold)" }} />Credenciales de tu cuenta</div>
          <p className="nop-mini" style={{ marginBottom: 12 }}>Las credenciales se le asignan al booster correspondiente <b style={{ color: "var(--tx)" }}>una vez validado el pago</b>. Hasta entonces nadie las ve.</p>
          <div className="nop-row2">
            <div className="nop-field" style={{ marginBottom: 0 }}><label>Usuario <span className="req">*</span></label>
              <input className="nop-input" value={acctUser} onChange={(e) => setAcctUser(e.target.value)} placeholder="usuario de inicio de sesión" /></div>
            <div className="nop-field" style={{ marginBottom: 0 }}><label>Contraseña <span className="req">*</span></label>
              <input className="nop-input" type="text" value={acctPass} onChange={(e) => setAcctPass(e.target.value)} placeholder="contraseña de la cuenta" /></div>
          </div>
        </div>}

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
          <button className="nop-btn nop-btn-gold" disabled={busy || !file || (!isElo && !summoner.trim()) || (isElo && (!accepted || !acctUser || !acctPass))} onClick={submit}><Check size={15} />{busy ? "Enviando…" : "Enviar pedido"}</button>
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

function AdminPromos({ flash }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const load = async () => {
    setBusy(true);
    const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    if (!error) setRows(data || []);
    setBusy(false);
  };
  useEffect(() => { load(); }, []);
  const toggleActive = async (r) => {
    const { error } = await supabase.from("promo_codes").update({ active: !r.active }).eq("id", r.id);
    if (error) { flash("Error: " + error.message); return; }
    flash(`Código ${r.code} ${!r.active ? "activado" : "desactivado"}`);
    load();
  };
  const remove = async (r) => {
    if (!window.confirm(`¿Eliminar el código "${r.code}"?\n\nLas órdenes que ya lo usaron mantienen la referencia (el descuento ya está aplicado). Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", r.id);
    if (error) { flash("Error: " + error.message); return; }
    flash(`Código "${r.code}" eliminado`);
    load();
  };

  const fmtDiscount = (r) => {
    if (r.discount_type === "percent") return `${r.discount_percent}% off`;
    const parts = [];
    if (r.discount_ars) parts.push(fmtARS(r.discount_ars));
    if (r.discount_usd) parts.push(fmtUSD(r.discount_usd));
    return parts.join(" · ") || "—";
  };
  const fmtMode = (r) => {
    if (r.usage_limit === 1) return "Uso único";
    if (r.valid_from || r.expires_at) {
      const f = r.valid_from ? new Date(r.valid_from).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "hoy";
      const t = r.expires_at ? new Date(r.expires_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "∞";
      return `${f} → ${t}`;
    }
    return "Ilimitado";
  };
  const fmtUses = (r) => {
    if (r.usage_limit) return `${r.used_count || 0} / ${r.usage_limit}`;
    return `${r.used_count || 0}`;
  };
  const isInactive = (r) => {
    if (!r.active) return true;
    if (r.expires_at && new Date(r.expires_at) < new Date()) return true;
    if (r.usage_limit && (r.used_count || 0) >= r.usage_limit) return true;
    return false;
  };
  const inactiveReason = (r) => {
    if (!r.active) return "Inactivo";
    if (r.expires_at && new Date(r.expires_at) < new Date()) return "Vencido";
    if (r.usage_limit && (r.used_count || 0) >= r.usage_limit) return "Agotado";
    return "";
  };

  return <>
    <div className="nop-sectionhead">
      <div><h1 className="nop-h1">Códigos promocionales</h1>
        <p className="nop-sub">Descuentos que el cliente aplica en el paso 2 del formulario. Podés tener varios activos a la vez.</p></div>
      <button className="nop-btn nop-btn-gold" onClick={() => setShowNew(true)}><Plus size={15} />Nuevo código</button>
    </div>

    {showNew && <PromoForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} flash={flash} />}

    <div className="nop-card nop-panel">
      {busy && rows.length === 0 ? <div className="nop-mini">Cargando…</div> :
        rows.length === 0 ? <Empty icon={Tag} title="Sin códigos todavía" sub="Creá un código para ofrecer descuentos a tus clientes." /> :
        <div className="nop-tablewrap"><table className="nop-t">
          <thead><tr><th>Código</th><th>Descuento</th><th>Duración</th><th>Estado</th><th>Usos</th><th>Notas</th><th></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><b style={{ fontFamily: "ui-monospace,monospace", fontSize: 13 }}>{r.code}</b></td>
              <td>{fmtDiscount(r)}</td>
              <td className="nop-mini">{fmtMode(r)}{r.once_per_client ? " · 1 x cliente" : ""}</td>
              <td>{isInactive(r)
                ? <span className="nop-status s-cancelled">{inactiveReason(r)}</span>
                : <span className="nop-status s-completed">Activo</span>}</td>
              <td>{fmtUses(r)}</td>
              <td className="nop-mini" style={{ maxWidth: 200 }}>{r.notes || "—"}</td>
              <td>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => toggleActive(r)}>
                    {r.active ? <><EyeOff size={13} />Desactivar</> : <><Eye size={13} />Activar</>}
                  </button>
                  <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={() => remove(r)} title="Eliminar"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>))}</tbody>
        </table></div>}
    </div>
  </>;
}

function PromoForm({ onClose, onSaved, flash }) {
  const [code, setCode] = useState("");
  const [type, setType] = useState("percent");
  const [pct, setPct] = useState("");
  const [ars, setArs] = useState("");
  const [usd, setUsd] = useState("");
  // Modo de duración: "unlimited" | "single_use" | "date_range"
  const [mode, setMode] = useState("unlimited");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [oncePerClient, setOncePerClient] = useState(false);
  const [busy, setBusy] = useState(false);

  // Generar código aleatorio de 8 caracteres, sin caracteres confundibles (0/O, 1/I, etc.)
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setCode(out);
  };

  const save = async () => {
    if (!code.trim()) { flash("Ingresá o generá un código."); return; }
    if (type === "percent") {
      const n = Number(pct);
      if (!(n > 0 && n <= 100)) { flash("El porcentaje debe estar entre 1 y 100."); return; }
    } else {
      if (!ars && !usd) { flash("Ingresá al menos un monto (ARS o USD)."); return; }
    }
    if (mode === "date_range" && !validFrom && !validUntil) {
      flash("Ingresá al menos una fecha (desde o hasta).");
      return;
    }
    setBusy(true);
    const row = {
      code: code.trim().toUpperCase(),
      discount_type: type,
      discount_percent: type === "percent" ? Number(pct) : null,
      discount_ars: type === "amount" && ars ? Number(ars) : null,
      discount_usd: type === "amount" && usd ? Number(usd) : null,
      valid_from: mode === "date_range" && validFrom ? validFrom : null,
      expires_at: mode === "date_range" && validUntil ? validUntil : null,
      usage_limit: mode === "single_use" ? 1 : null,
      notes: notes.trim() || null,
      once_per_client: oncePerClient,
      active: true,
    };
    const { error } = await supabase.from("promo_codes").insert(row);
    setBusy(false);
    if (error) { flash(error.message.includes("duplicate") ? "Ese código ya existe. Elegí otro o generá uno automático." : "Error: " + error.message); return; }
    flash(`Código "${row.code}" creado`);
    onSaved();
  };

  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Nuevo código promocional</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div className="nop-field"><label>Código <span className="req">*</span></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="nop-input" style={{ flex: 1, minWidth: 160, textTransform: "uppercase", fontFamily: "ui-monospace,monospace", letterSpacing: ".05em" }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ej: WELCOME10 o dejá que se genere" />
          <button type="button" className="nop-btn nop-btn-ghost" onClick={generateCode}><RefreshCw size={13} />Generar</button>
        </div>
        <div className="nop-mini" style={{ marginTop: 6 }}>Podés escribirlo vos o generar uno aleatorio de 8 caracteres.</div>
      </div>

      <div className="nop-field"><label>Tipo de descuento <span className="req">*</span></label>
        <div className="nop-segwrap" style={{ marginBottom: 0 }}>
          <button type="button" className={"nop-seg" + (type === "percent" ? " on" : "")} onClick={() => setType("percent")}>Porcentaje (%)</button>
          <button type="button" className={"nop-seg" + (type === "amount" ? " on" : "")} onClick={() => setType("amount")}>Monto fijo</button>
        </div>
      </div>

      {type === "percent" ? (
        <div className="nop-field"><label>Porcentaje <span className="req">*</span></label>
          <input className="nop-input" type="number" min="1" max="100" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Ej: 15" />
          <div className="nop-mini" style={{ marginTop: 6 }}>Se aplica igual sobre ARS y USD.</div>
        </div>
      ) : (
        <div className="nop-row2">
          <div className="nop-field"><label>Monto ARS (opcional)</label>
            <input className="nop-input" type="number" min="0" value={ars} onChange={(e) => setArs(e.target.value)} placeholder="Ej: 5000" /></div>
          <div className="nop-field"><label>Monto USD (opcional)</label>
            <input className="nop-input" type="number" min="0" step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="Ej: 5" /></div>
        </div>
      )}

      <div className="nop-field"><label>Duración <span className="req">*</span></label>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid " + (mode === "unlimited" ? "var(--gold)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: mode === "unlimited" ? "rgba(232,179,73,.08)" : "var(--bg2)" }}>
            <input type="radio" checked={mode === "unlimited"} onChange={() => setMode("unlimited")} style={{ margin: 0 }} />
            <div><b style={{ fontSize: 13 }}>Ilimitado</b>
              <div className="nop-mini">Funciona mientras esté activo. Lo desactivás a mano cuando quieras.</div></div>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid " + (mode === "single_use" ? "var(--gold)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: mode === "single_use" ? "rgba(232,179,73,.08)" : "var(--bg2)" }}>
            <input type="radio" checked={mode === "single_use"} onChange={() => setMode("single_use")} style={{ margin: 0 }} />
            <div><b style={{ fontSize: 13 }}>Uso único</b>
              <div className="nop-mini">Se puede usar UNA SOLA VEZ en total. Después se desactiva solo.</div></div>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid " + (mode === "date_range" ? "var(--gold)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: mode === "date_range" ? "rgba(232,179,73,.08)" : "var(--bg2)" }}>
            <input type="radio" checked={mode === "date_range"} onChange={() => setMode("date_range")} style={{ margin: 0 }} />
            <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>Habilitado por fechas</b>
              <div className="nop-mini">Funciona solo entre las fechas que elijas.</div></div>
          </label>
        </div>
      </div>

      {mode === "date_range" && (
        <div className="nop-row2">
          <div className="nop-field"><label>Desde (opcional)</label>
            <input className="nop-input" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            <div className="nop-mini" style={{ marginTop: 6 }}>Vacío = arranca hoy.</div>
          </div>
          <div className="nop-field"><label>Hasta (opcional)</label>
            <input className="nop-input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            <div className="nop-mini" style={{ marginTop: 6 }}>Vacío = no expira.</div>
          </div>
        </div>
      )}

      <div className="nop-field">
        <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "10px 12px", border: "1px solid " + (oncePerClient ? "var(--gold)" : "var(--line)"), borderRadius: 10, background: oncePerClient ? "rgba(232,179,73,.08)" : "var(--bg2)" }}>
          <input type="checkbox" checked={oncePerClient} onChange={(e) => setOncePerClient(e.target.checked)} />
          <div>
            <b style={{ fontSize: 13 }}>Un solo uso por cliente</b>
            <div className="nop-mini">Cada cliente puede usar este código una vez. Se combina con los demás modos (por ej. ilimitado + 1 por cliente).</div>
          </div>
        </label>
      </div>

      <div className="nop-field"><label>Notas (solo para vos)</label>
        <input className="nop-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Campaña Instagram junio" /></div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="nop-btn nop-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        <button className="nop-btn nop-btn-gold" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Creando…" : "Crear código"}<Check size={15} /></button>
      </div>
    </div>
  </div></div>;
}

/* ===================== CUENTAS ===================== */
function AdminAccounts({ accounts, profiles, accountRequests, reload, flash }) {
  const [sub, setSub] = useState("booster");
  const boosterAccts = (accounts || []).filter((a) => (a.kind || "booster") !== "client");
  const clientAccts = (accounts || []).filter((a) => a.kind === "client");
  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Cuentas</h1>
      <p className="nop-sub">Pool para los boosters y catálogo de cuentas a la venta para los clientes.</p></div></div>
    <div className="nop-segwrap" style={{ marginBottom: 16, gridTemplateColumns: "repeat(2,1fr)", maxWidth: 460 }}>
      <button type="button" className={"nop-seg" + (sub === "booster" ? " on" : "")} onClick={() => setSub("booster")}>Cuentas boosters ({boosterAccts.length})</button>
      <button type="button" className={"nop-seg" + (sub === "client" ? " on" : "")} onClick={() => setSub("client")}>Cuentas clientes ({clientAccts.length})</button>
    </div>
    {sub === "booster"
      ? <AdminBoosterAccounts accounts={boosterAccts} profiles={profiles} reload={reload} flash={flash} />
      : <AdminClientAccounts accounts={clientAccts} accountRequests={accountRequests} reload={reload} flash={flash} />}
  </>;
}

/* ---- Sub-pestaña: cuentas para boosters (pool de trabajo) ---- */
function AdminBoosterAccounts({ accounts, profiles, reload, flash }) {
  const [summoner, setSummoner] = useState("");
  const [rk, setRk] = useState("Unranked"), [rd, setRd] = useState("IV");
  const [server, setServer] = useState("LAS");
  const [user, setUser] = useState(""), [pass, setPass] = useState("");
  const [estado, setEstado] = useState("activa");
  const [edit, setEdit] = useState(null);
  const [promote, setPromote] = useState(null); // cuenta a convertir en cuenta de cliente
  const [assignFor, setAssignFor] = useState(null);

  const ACCOUNT_RANKS = ["Unranked", ...RANKS];
  const isUnranked = rk === "Unranked";
  const boosters = (profiles || []).filter((p) => p.role === "booster" && p.status === "active" && !isTestBooster(p));
  const rankStr = (r, d) => r === "Unranked" ? "Unranked" : r + (r !== "Master" ? " " + d : "");
  const create = async () => {
    if (!summoner) { flash("Falta el nombre de invocador."); return; }
    const { error } = await supabase.from("game_accounts").insert({ kind: "booster", summoner, rank: rankStr(rk, rd), server, login_user: user, login_pass: pass, status: estado });
    if (error) { flash("No se pudo crear la cuenta: " + error.message); return; }
    setSummoner(""); setUser(""); setPass(""); setEstado("activa");
    await reload(); flash("Cuenta creada");
  };
  const setStatus = async (a, status) => { await supabase.from("game_accounts").update({ status }).eq("id", a.id); await reload(); flash(`Cuenta ${ACC_STATUS_LABEL[status]?.toLowerCase()}`); };
  const del = async (a) => { if (!window.confirm(`¿Eliminar la cuenta ${a.summoner}?`)) return; await supabase.from("game_accounts").delete().eq("id", a.id); await reload(); flash("Cuenta eliminada"); };
  const assign = async (a, b) => {
    const { error } = await supabase.from("game_accounts").update({ status: "inactiva", taken_by: b.id, taken_by_name: b.full_name }).eq("id", a.id);
    if (error) { flash("No se pudo asignar: " + error.message); return; }
    setAssignFor(null);
    await reload(); flash(`Cuenta ${a.summoner} asignada a ${b.full_name}`);
  };
  const release = async (a) => {
    if (!window.confirm(`¿Liberar la cuenta ${a.summoner}? Vuelve a disponibles.`)) return;
    await supabase.from("game_accounts").update({ status: "activa", taken_by: null, taken_by_name: null }).eq("id", a.id);
    await reload(); flash(`Cuenta ${a.summoner} liberada`);
  };

  return <>
    <div className="nop-card nop-panel" style={{ marginBottom: 16 }}>
      <div className="nop-panel-h"><PlusIc size={15} style={{ color: "var(--cyan)" }} />Nueva cuenta (pool boosters)</div>
      <div className="nop-row3">
        <div className="nop-field" style={{ marginBottom: 12 }}><label>Nombre de invocador <span className="req">*</span></label>
          <input className="nop-input" value={summoner} onChange={(e) => setSummoner(e.target.value)} placeholder="Ej: SmurfNation01" /></div>
        <div className="nop-field" style={{ marginBottom: 12 }}><label>Liga actual</label>
          <div className="nop-row2">
            <select className="nop-select" value={rk} onChange={(e) => setRk(e.target.value)}>{ACCOUNT_RANKS.map((r) => <option key={r}>{r}</option>)}</select>
            <select className="nop-select" value={rd} onChange={(e) => setRd(e.target.value)} disabled={rk === "Master" || isUnranked}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select>
          </div></div>
        <div className="nop-field" style={{ marginBottom: 12 }}><label>Servidor</label>
          <select className="nop-select" value={server} onChange={(e) => setServer(e.target.value)}>{ACCOUNT_SERVERS.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="nop-row3">
        <div className="nop-field" style={{ marginBottom: 0 }}><label>Usuario (oculto)</label>
          <input className="nop-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="usuario de login" /></div>
        <div className="nop-field" style={{ marginBottom: 0 }}><label>Contraseña (oculta)</label>
          <input className="nop-input" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="contraseña" /></div>
        <div className="nop-field" style={{ marginBottom: 0 }}><label>Estado</label>
          <select className="nop-select" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="activa">Disponible</option><option value="deshabilitada">Deshabilitada</option></select></div>
      </div>
      <button className="nop-btn nop-btn-cyan" style={{ width: "100%", marginTop: 12 }} onClick={create}><PlusIc size={15} />Crear cuenta</button>
    </div>

    {accounts.length === 0 ? <Empty icon={Gamepad2} title="Sin cuentas todavía" sub="Creá la primera arriba." /> :
      <div className="nop-acc-grid">{accounts.map((a) => (
        <div className="nop-card nop-acc" key={a.id}>
          <div className="top">
            <div>
              <div className="sm">{a.summoner}</div>
              <div className="nop-mini">{a.rank || "—"}{a.server ? ` · ${a.server}` : ""}</div>
            </div>
            <AccStatusBadge s={a.status} />
          </div>
          {a.status === "inactiva" && <div className="nop-mini">En uso por <b style={{ color: "var(--tx)" }}>{a.taken_by_name || "—"}</b></div>}
          <Cred label="Usuario" value={a.login_user} flash={flash} />
          <Cred label="Contraseña" value={a.login_pass} flash={flash} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setEdit(a)}>Editar</button>
            {a.status === "activa" && <button className="nop-btn nop-btn-gold nop-btn-sm" onClick={() => setAssignFor(a)}><UserCheck size={13} />Asignar</button>}
            {a.status === "inactiva" && <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => release(a)}>Liberar</button>}
            {a.status !== "deshabilitada"
              ? <button className="nop-btn nop-btn-ghost nop-btn-sm" disabled={a.status === "inactiva"} onClick={() => setStatus(a, "deshabilitada")}><Power size={13} />Deshabilitar</button>
              : <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => setStatus(a, "activa")}><Power size={13} />Activar</button>}
            <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setPromote(a)} title="Pasar al catálogo de clientes"><ArrowRight size={13} />A clientes</button>
            <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={() => del(a)}><Trash2 size={13} /></button>
          </div>
        </div>))}</div>}

    {edit && <AccountEdit a={edit} onClose={() => setEdit(null)} reload={reload} flash={flash} />}
    {promote && <ClientAccountEditor a={promote} onClose={() => setPromote(null)} reload={reload} flash={flash} />}
    {assignFor && <div className="nop-modal" onClick={() => setAssignFor(null)}>
      <div className="nop-card nop-modalbox" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="hd"><h3>Asignar cuenta {assignFor.summoner}</h3><button className="nop-iconbtn" onClick={() => setAssignFor(null)}><X size={16} /></button></div>
        <div className="bd">
          <p className="nop-mini" style={{ marginBottom: 14 }}>{assignFor.rank || "—"}{assignFor.server ? ` · ${assignFor.server}` : ""}</p>
          {boosters.length === 0 ? <div className="nop-mini" style={{ color: "var(--red)" }}>No hay boosters activos.</div> :
            <div style={{ display: "grid", gap: 8 }}>{boosters.map((b) => {
              const taken = accounts.filter((a) => a.taken_by === b.id).length;
              return <button key={b.id} className="nop-card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: "var(--bg2)", border: "1px solid var(--line)", textAlign: "left" }} onClick={() => assign(assignFor, b)}>
                <div><b style={{ fontSize: 14 }}>{b.full_name}</b><div className="nop-mini">{taken} cuentas asignadas</div></div>
                <ArrowRight size={15} style={{ color: "var(--gold)" }} />
              </button>;
            })}</div>}
        </div>
      </div>
    </div>}
  </>;
}

/* ---- Sub-pestaña: cuentas para clientes (catálogo a la venta) ---- */
function AdminClientAccounts({ accounts, accountRequests, reload, flash }) {
  const [showNew, setShowNew] = useState(false);
  const [edit, setEdit] = useState(null);
  const [blue, setBlue] = useState(null);
  useEffect(() => { fetchBlue().then(setBlue); }, []);
  const reqCount = (a) => (accountRequests || []).filter((r) => r.account_id === a.id && r.status === "pending").length;
  const del = async (a) => { if (!window.confirm(`¿Eliminar la cuenta "${a.summoner}"?`)) return; await supabase.from("game_accounts").delete().eq("id", a.id); await reload(); flash("Cuenta eliminada"); };
  const setStatus = async (a, status) => { await supabase.from("game_accounts").update({ status }).eq("id", a.id); await reload(); flash(status === "activa" ? "Cuenta publicada" : "Cuenta oculta"); };

  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
      <p className="nop-mini" style={{ margin: 0 }}>Cuentas visibles para los clientes en su pestaña “Cuentas”. Cargá portada, skins, esencia azul, precio y datos adicionales.</p>
      <button className="nop-btn nop-btn-gold nop-btn-sm" onClick={() => setShowNew(true)}><PlusIc size={14} />Nueva cuenta de cliente</button>
    </div>

    {accounts.length === 0 ? <Empty icon={Gamepad2} title="Sin cuentas para clientes" sub="Creá una nueva o pasá una cuenta desde la pestaña de boosters." /> :
      <div className="nop-acc-grid">{accounts.map((a) => (
        <AccountSaleCard key={a.id} a={a} blue={blue} showExtra admin>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {reqCount(a) > 0 && <span className="nop-svc" style={{ background: "rgba(232,179,73,.15)", borderColor: "var(--gold)", color: "var(--gold)" }}>🛒 {reqCount(a)} solicitud{reqCount(a) > 1 ? "es" : ""}</span>}
            <AccStatusBadge s={a.status} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setEdit(a)}><Settings size={13} />Editar</button>
            {a.status === "activa"
              ? <button className="nop-btn nop-btn-ghost nop-btn-sm" onClick={() => setStatus(a, "deshabilitada")}><EyeOff size={13} />Ocultar</button>
              : <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => setStatus(a, "activa")}><Eye size={13} />Publicar</button>}
            <button className="nop-btn nop-btn-danger nop-btn-sm" onClick={() => del(a)}><Trash2 size={13} /></button>
          </div>
        </AccountSaleCard>
      ))}</div>}

    {(showNew || edit) && <ClientAccountEditor a={edit} onClose={() => { setShowNew(false); setEdit(null); }} reload={reload} flash={flash} />}
  </>;
}

/* ---- Card de cuenta a la venta (compartida admin + cliente) ---- */
function AccountStatChip({ icon: Icon, label, value }) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 10, padding: "7px 10px" }}>
    {Icon && <Icon size={16} style={{ color: "var(--gold)", flexShrink: 0 }} />}
    <div style={{ minWidth: 0 }}>
      <div className="nop-mini" style={{ color: "var(--mut2)", lineHeight: 1.1 }}>{label}</div>
      <b style={{ fontSize: 13 }}>{isNaN(n) ? value : n.toLocaleString("es-AR")}</b>
    </div>
  </div>;
}
function AccountSaleCard({ a, blue, children, showExtra, onClick }) {
  const cover = accCoverUrl(a.cover_path);
  const rkColor = RANK_COLOR[String(a.rank || "").split(" ")[0]] || "var(--mut)";
  const usd = a.price_usd != null ? a.price_usd : (blue && a.price_ars ? Math.round((Number(a.price_ars) / blue) * 100) / 100 : null);
  return <div className="nop-card" style={{ overflow: "hidden", padding: 0, display: "flex", flexDirection: "column", cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
    <div style={{ position: "relative", height: 148, background: "var(--bg2)" }}>
      {cover
        ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--mut2)" }}><Gamepad2 size={34} /></div>}
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {a.server && <span className="nop-svc" style={{ background: "rgba(6,10,20,.7)", borderColor: "transparent", color: "#fff", backdropFilter: "blur(4px)" }}>{a.server}</span>}
        <span className="nop-svc" style={{ background: "rgba(6,10,20,.7)", borderColor: "transparent", color: rkColor, fontWeight: 700, backdropFilter: "blur(4px)" }}>{a.rank || "Unranked"}</span>
      </div>
    </div>
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
      <b style={{ fontSize: 15, lineHeight: 1.3, wordBreak: "break-word" }}>{a.summoner}</b>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <AccountStatChip icon={Crown} label="Nivel" value={a.level} />
        <AccountStatChip icon={Swords} label="Campeones" value={a.champions} />
        <AccountStatChip icon={Sparkles} label="Skins" value={a.skins} />
        <AccountStatChip icon={Zap} label="Esencia azul" value={a.blue_essence} />
      </div>
      {showExtra && a.extra_info && <p className="nop-mini" style={{ whiteSpace: "pre-wrap", color: "var(--mut)", background: "var(--bg2)", padding: "8px 10px", borderRadius: 8, lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.extra_info}</p>}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: "auto" }}>
        {a.price_ars != null && <b className="nop-display" style={{ fontSize: 20, color: "var(--gold)" }}>{fmtARS(a.price_ars)}</b>}
        {usd != null && <span style={{ color: "var(--grn)", fontWeight: 700 }}>{fmtUSD(usd)}</span>}
        {a.price_ars == null && usd == null && <span className="nop-mini">Precio a consultar</span>}
      </div>
      {children && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  </div>;
}

/* ---- Editor de cuenta de cliente (crear / editar / promover) ---- */
function ClientAccountEditor({ a, onClose, reload, flash }) {
  const isNew = !a;
  const ACCOUNT_RANKS = ["Unranked", ...RANKS];
  const initRank = a?.rank || "Unranked";
  const initIsUnranked = String(initRank).toLowerCase().startsWith("unranked");
  const initParts = String(initRank).split(" ");
  const [title, setTitle] = useState(a?.summoner || "");
  const [rk, setRk] = useState(initIsUnranked ? "Unranked" : (RANKS.includes(initParts[0]) ? initParts[0] : "Unranked"));
  const [rd, setRd] = useState(DIVS.includes(initParts[1]) ? initParts[1] : "IV");
  const [server, setServer] = useState(a?.server || "LAS");
  const [level, setLevel] = useState(a?.level ?? "");
  const [champs, setChamps] = useState(a?.champions ?? "");
  const [skins, setSkins] = useState(a?.skins ?? "");
  const [be, setBe] = useState(a?.blue_essence ?? "");
  const [priceArs, setPriceArs] = useState(a?.price_ars ?? "");
  const [priceUsd, setPriceUsd] = useState(a?.price_usd ?? "");
  const [extra, setExtra] = useState(a?.extra_info || "");
  const [user, setUser] = useState(a?.login_user || "");
  const [pass, setPass] = useState(a?.login_pass || "");
  const [estado, setEstado] = useState(a?.status || "activa");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPath] = useState(a?.cover_path || null);
  const [blue, setBlue] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchBlue().then(setBlue); }, []);
  const rankStr = (r, d) => r === "Unranked" ? "Unranked" : r + (r !== "Master" ? " " + d : "");
  const previewUrl = coverFile ? URL.createObjectURL(coverFile) : accCoverUrl(coverPath);
  const usdSuggest = blue && priceArs ? Math.round((Number(priceArs) / blue) * 100) / 100 : null;

  const save = async () => {
    if (!title.trim()) { flash("Poné un título o nombre para la cuenta."); return; }
    setBusy(true);
    try {
      let cover = coverPath;
      if (coverFile) {
        const ext = (coverFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `client-accounts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await supabase.storage.from("cuentas").upload(path, coverFile, { upsert: true });
        if (up.error) throw up.error;
        cover = path;
      }
      const num = (v) => v === "" || v == null ? null : Number(v);
      const row = {
        kind: "client",
        summoner: title.trim(),
        rank: rankStr(rk, rd),
        server,
        level: num(level), champions: num(champs), skins: num(skins), blue_essence: num(be),
        price_ars: num(priceArs), price_usd: num(priceUsd),
        extra_info: extra || null,
        login_user: user || null, login_pass: pass || null,
        status: estado, cover_path: cover || null,
      };
      let error;
      if (isNew) ({ error } = await supabase.from("game_accounts").insert(row));
      else ({ error } = await supabase.from("game_accounts").update(row).eq("id", a.id));
      if (error) throw error;
      await reload(); flash(isNew ? "Cuenta de cliente creada" : "Cuenta actualizada"); onClose();
    } catch (e) { flash("No se pudo guardar: " + (e.message || e)); } finally { setBusy(false); }
  };

  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
    <div className="hd"><h3>{isNew ? "Nueva cuenta de cliente" : "Editar cuenta de cliente"}</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      {/* Portada */}
      <div className="nop-field"><label>Portada (visible para el cliente)</label>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 140, height: 84, borderRadius: 10, overflow: "hidden", background: "var(--bg2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {previewUrl ? <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Gamepad2 size={26} style={{ color: "var(--mut2)" }} />}
          </div>
          <label className="nop-btn nop-btn-ghost nop-btn-sm" style={{ cursor: "pointer" }}>
            <Upload size={14} />{previewUrl ? "Cambiar imagen" : "Subir imagen"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
          </label>
        </div>
      </div>
      <div className="nop-field"><label>Título / nombre <span className="req">*</span></label>
        <input className="nop-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: EUW · Diamante IV · 34 Skins" /></div>
      <div className="nop-row3">
        <div className="nop-field"><label>Liga</label><div className="nop-row2">
          <select className="nop-select" value={rk} onChange={(e) => setRk(e.target.value)}>{ACCOUNT_RANKS.map((r) => <option key={r}>{r}</option>)}</select>
          <select className="nop-select" value={rd} onChange={(e) => setRd(e.target.value)} disabled={rk === "Master" || rk === "Unranked"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
        <div className="nop-field"><label>Servidor</label>
          <select className="nop-select" value={server} onChange={(e) => setServer(e.target.value)}>{ACCOUNT_SERVERS.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="nop-field"><label>Estado</label>
          <select className="nop-select" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="activa">Publicada (visible)</option><option value="deshabilitada">Oculta</option></select></div>
      </div>
      <div className="nop-row2">
        <div className="nop-field"><label>Nivel</label><input className="nop-input" type="number" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Ej: 107" /></div>
        <div className="nop-field"><label>Campeones</label><input className="nop-input" type="number" value={champs} onChange={(e) => setChamps(e.target.value)} placeholder="Ej: 71" /></div>
      </div>
      <div className="nop-row2">
        <div className="nop-field"><label>Skins</label><input className="nop-input" type="number" value={skins} onChange={(e) => setSkins(e.target.value)} placeholder="Ej: 34" /></div>
        <div className="nop-field"><label>Esencia azul</label><input className="nop-input" type="number" value={be} onChange={(e) => setBe(e.target.value)} placeholder="Ej: 56200" /></div>
      </div>
      <div className="nop-row2">
        <div className="nop-field"><label>Precio en ARS</label><input className="nop-input" type="number" value={priceArs} onChange={(e) => setPriceArs(e.target.value)} placeholder="Ej: 45000" /></div>
        <div className="nop-field"><label>Precio en USD {usdSuggest ? `(sugerido: ${fmtUSD(usdSuggest)})` : ""}</label><input className="nop-input" type="number" step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} placeholder={usdSuggest ? String(usdSuggest) : "Ej: 40"} /></div>
      </div>
      <div className="nop-field"><label>Datos adicionales (visible para el cliente)</label>
        <textarea className="nop-ta" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Handleveled, email cambiable, sin baneos, acceso completo, RP disponibles, etc." /></div>
      <div className="nop-row2">
        <div className="nop-field"><label>Usuario de login (interno)</label><input className="nop-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="no se muestra al cliente" /></div>
        <div className="nop-field"><label>Contraseña (interno)</label><input className="nop-input" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="no se muestra al cliente" /></div>
      </div>
      <button className="nop-btn nop-btn-gold" style={{ width: "100%", marginTop: 4 }} disabled={busy} onClick={save}>{busy ? "Guardando…" : (isNew ? "Crear cuenta" : "Guardar cambios")}<Check size={15} /></button>
    </div>
  </div></div>;
}

/* ---- Editor mínimo (pool boosters) ---- */
function AccountEdit({ a, onClose, reload, flash }) {
  const ACCOUNT_RANKS = ["Unranked", ...RANKS];
  const initRank = a.rank || "Oro IV";
  const initIsUnranked = initRank.toLowerCase().startsWith("unranked");
  const init = initRank.split(" ");
  const [summoner, setSummoner] = useState(a.summoner || "");
  const [rk, setRk] = useState(initIsUnranked ? "Unranked" : (RANKS.includes(init[0]) ? init[0] : "Oro"));
  const [rd, setRd] = useState(init[1] || "IV");
  const [server, setServer] = useState(a.server || "LAS");
  const [user, setUser] = useState(a.login_user || "");
  const [pass, setPass] = useState(a.login_pass || "");
  const save = async () => {
    const rank = rk === "Unranked" ? "Unranked" : rk + (rk !== "Master" ? " " + rd : "");
    await supabase.from("game_accounts").update({ summoner, rank, server, login_user: user, login_pass: pass }).eq("id", a.id);
    await reload(); flash("Cuenta actualizada"); onClose();
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
    <div className="hd"><h3>Editar cuenta</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <div className="nop-field"><label>Nombre de invocador</label><input className="nop-input" value={summoner} onChange={(e) => setSummoner(e.target.value)} /></div>
      <div className="nop-field"><label>Liga actual</label><div className="nop-row2">
        <select className="nop-select" value={rk} onChange={(e) => setRk(e.target.value)}>{ACCOUNT_RANKS.map((r) => <option key={r}>{r}</option>)}</select>
        <select className="nop-select" value={rd} onChange={(e) => setRd(e.target.value)} disabled={rk === "Master" || rk === "Unranked"}>{DIVS.map((d) => <option key={d}>{d}</option>)}</select></div></div>
      <div className="nop-field"><label>Servidor</label>
        <select className="nop-select" value={server} onChange={(e) => setServer(e.target.value)}>{ACCOUNT_SERVERS.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="nop-field"><label>Usuario</label><input className="nop-input" value={user} onChange={(e) => setUser(e.target.value)} /></div>
      <div className="nop-field"><label>Contraseña</label><input className="nop-input" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
      <button className="nop-btn nop-btn-gold" style={{ width: "100%" }} onClick={save}><Check size={15} />Guardar cambios</button>
    </div>
  </div></div>;
}

/* ---- Vista booster: pool de cuentas de trabajo ---- */
function BoosterAccounts({ profile, accounts, reload, flash }) {
  const disponibles = accounts.filter((a) => a.status === "activa" && (a.kind || "booster") !== "client");
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
          <div className="top"><div><div className="sm">{a.summoner}</div><div className="nop-mini">{a.rank || "—"}{a.server ? ` · ${a.server}` : ""}</div></div><AccStatusBadge s={a.status} /></div>
          <Cred label="Usuario" value={a.login_user} flash={flash} />
          <Cred label="Contraseña" value={a.login_pass} flash={flash} />
          <button className="nop-btn nop-btn-grn nop-btn-sm" onClick={() => ret(a)}><ArrowRight size={13} style={{ transform: "rotate(180deg)" }} />Devolver cuenta</button>
        </div>))}</div>
    </div>}

    <div className="nop-panel-h" style={{ marginBottom: 12 }}><Zap size={15} style={{ color: "var(--gold)" }} />Disponibles ({disponibles.length})</div>
    {disponibles.length === 0 ? <Empty icon={Gamepad2} title="No hay cuentas disponibles" sub="Cuando el admin cargue cuentas, aparecen acá." /> :
      <div className="nop-acc-grid">{disponibles.map((a) => (
        <div className="nop-card nop-acc" key={a.id}>
          <div className="top"><div><div className="sm">{a.summoner}</div><div className="nop-mini">{a.rank || "—"}{a.server ? ` · ${a.server}` : ""}</div></div><AccStatusBadge s={a.status} /></div>
          <Cred label="Usuario" value={a.login_user} flash={flash} />
          <Cred label="Contraseña" value={a.login_pass} flash={flash} />
          <button className="nop-btn nop-btn-cyan nop-btn-sm" onClick={() => use(a)}><Check size={13} />Usar esta cuenta</button>
        </div>))}</div>}
  </>;
}

/* ---- Vista cliente: catálogo de cuentas a la venta ---- */
function ClientAccounts({ profile, accounts, accountRequests, reload, flash, notify }) {
  const [blue, setBlue] = useState(null);
  const [q, setQ] = useState("");
  const [fLiga, setFLiga] = useState("todas");
  const [fRegion, setFRegion] = useState("todas");
  const [fLevel, setFLevel] = useState("todos");
  const [detail, setDetail] = useState(null);
  const [acquire, setAcquire] = useState(null);
  useEffect(() => { fetchBlue().then(setBlue); }, []);

  const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const consultar = (a) => {
    const u = a.price_usd != null ? a.price_usd : (blue && a.price_ars ? Math.round((Number(a.price_ars) / blue) * 100) / 100 : null);
    const price = [a.price_ars != null ? fmtARS(a.price_ars) : null, u != null ? fmtUSD(u) : null].filter(Boolean).join(" / ");
    const msg = `Hola! Me interesa la cuenta "${a.summoner}" (${a.rank || "Unranked"}${a.server ? " · " + a.server : ""})${price ? " — " + price : ""}. Quería consultar.`;
    window.open(SUPPORT_WA.split("&text=")[0] + "&text=" + encodeURIComponent(msg), "_blank");
  };
  const myReqs = (accountRequests || []).filter((r) => r.client_id === profile.id);
  const reqByAccount = {};
  myReqs.forEach((r) => { if (r.account_id != null && (!reqByAccount[r.account_id] || new Date(r.created_at) > new Date(reqByAccount[r.account_id].created_at))) reqByAccount[r.account_id] = r; });
  const pendingMine = myReqs.filter((r) => r.status === "pending" || r.status === "validated");

  const LEVELS = [
    { k: "todos", label: "Nivel: todos", test: () => true },
    { k: "1", label: "1 – 29", test: (n) => n != null && !isNaN(n) && n < 30 },
    { k: "30", label: "30 – 99", test: (n) => n >= 30 && n < 100 },
    { k: "100", label: "100 – 199", test: (n) => n >= 100 && n < 200 },
    { k: "200", label: "200+", test: (n) => n >= 200 },
  ];
  const LIGAS = ["Unranked", ...RANKS];

  let list = (accounts || []).filter((a) => a.status === "activa");
  if (fLiga !== "todas") list = list.filter((a) => String(a.rank || "Unranked").split(" ")[0] === fLiga);
  if (fRegion !== "todas") list = list.filter((a) => a.server === fRegion);
  if (fLevel !== "todos") { const lv = LEVELS.find((x) => x.k === fLevel); if (lv) list = list.filter((a) => lv.test(Number(a.level))); }
  if (q.trim()) { const nq = norm(q); list = list.filter((a) => norm(a.extra_info).includes(nq) || norm(a.summoner).includes(nq)); }

  return <>
    <div className="nop-sectionhead"><div><h1 className="nop-h1">Cuentas en venta</h1><p className="nop-sub">Tocá una cuenta para ver todos los detalles, consultá o adquirila.</p></div></div>

    {pendingMine.length > 0 && <div className="nop-card nop-panel" style={{ marginBottom: 16 }}>
      <div className="nop-panel-h"><Gamepad2 size={15} style={{ color: "var(--violet)" }} />Mis solicitudes ({pendingMine.length})</div>
      <div style={{ display: "grid", gap: 10 }}>{pendingMine.map((r) => (
        <div className="nop-card" key={r.id} style={{ padding: 12, background: "var(--bg2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div><b style={{ fontSize: 13 }}>{r.account_title || "Cuenta"}</b><div className="nop-mini">{r.account_rank || "—"}{r.account_server ? ` · ${r.account_server}` : ""}</div></div>
            {r.status === "validated"
              ? <span className="nop-svc" style={{ background: "rgba(52,211,153,.15)", borderColor: "var(--grn)", color: "var(--grn)" }}><Check size={12} /> Validada</span>
              : <span className="nop-svc" style={{ background: "rgba(232,179,73,.15)", borderColor: "var(--amber)", color: "var(--amber)" }}><Clock size={12} /> Esperando validación</span>}
          </div>
          {r.status === "validated" && (r.granted_user || r.granted_pass) && <div style={{ marginTop: 10 }}>
            <p className="nop-mini" style={{ marginBottom: 8, color: "var(--grn)" }}>¡Compra validada! Datos de acceso:</p>
            <Cred label="Usuario" value={r.granted_user} flash={flash} />
            <div style={{ height: 8 }} />
            <Cred label="Contraseña" value={r.granted_pass} flash={flash} />
          </div>}
        </div>))}</div>
    </div>}

    <div className="nop-card nop-panel" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--mut2)" }} />
          <input className="nop-input" style={{ paddingLeft: 36 }} placeholder="Buscar por skin (ej: Elementalist Lux)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="nop-select" style={{ width: "auto", minWidth: 130 }} value={fLiga} onChange={(e) => setFLiga(e.target.value)}>
          <option value="todas">Liga: todas</option>{LIGAS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="nop-select" style={{ width: "auto", minWidth: 130 }} value={fRegion} onChange={(e) => setFRegion(e.target.value)}>
          <option value="todas">Región: todas</option>{ACCOUNT_SERVERS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="nop-select" style={{ width: "auto", minWidth: 130 }} value={fLevel} onChange={(e) => setFLevel(e.target.value)}>
          {LEVELS.map((l) => <option key={l.k} value={l.k}>{l.label}</option>)}
        </select>
      </div>
      <p className="nop-mini" style={{ marginTop: 8 }}>La búsqueda por skin filtra las cuentas que la mencionan en sus detalles.</p>
    </div>

    {list.length === 0 ? <div className="nop-card"><Empty icon={Gamepad2} title="Sin resultados" sub="Probá con otro filtro o buscá otra skin." /></div> :
      <div className="nop-acc-grid">{list.map((a) => {
        const mr = reqByAccount[a.id];
        return <AccountSaleCard key={a.id} a={a} blue={blue} showExtra onClick={() => setDetail(a)}>
          {mr && mr.status === "validated"
            ? <button className="nop-btn nop-btn-grn" style={{ width: "100%" }} onClick={() => setDetail(a)}><Check size={15} />Comprada · ver datos</button>
            : mr && mr.status === "pending"
              ? <button className="nop-btn nop-btn-ghost" disabled style={{ width: "100%" }}><Clock size={15} />Esperando validación</button>
              : <div style={{ display: "flex", gap: 8 }}>
                  <button className="nop-btn nop-btn-ghost nop-btn-sm" style={{ flex: 1 }} onClick={() => consultar(a)}><MessageCircle size={14} />Consultar</button>
                  <button className="nop-btn nop-btn-gold nop-btn-sm" style={{ flex: 1 }} onClick={() => setAcquire(a)}><Wallet size={14} />Adquirir</button>
                </div>}
        </AccountSaleCard>;
      })}</div>}

    {detail && <AccountDetailModal a={detail} blue={blue} myReq={reqByAccount[detail.id]} profile={profile} flash={flash}
      onClose={() => setDetail(null)} onAcquire={() => { setAcquire(detail); setDetail(null); }} />}
    {acquire && <AcquireAccountModal a={acquire} blue={blue} profile={profile} reload={reload} flash={flash} notify={notify} onClose={() => setAcquire(null)} />}
  </>;
}

/* ---- Modal: detalle completo de la cuenta ---- */
function AccountDetailModal({ a, blue, myReq, profile, flash, onClose, onAcquire }) {
  const cover = accCoverUrl(a.cover_path);
  const rkColor = RANK_COLOR[String(a.rank || "").split(" ")[0]] || "var(--mut)";
  const usd = a.price_usd != null ? a.price_usd : (blue && a.price_ars ? Math.round((Number(a.price_ars) / blue) * 100) / 100 : null);
  const consultar = () => {
    const price = [a.price_ars != null ? fmtARS(a.price_ars) : null, usd != null ? fmtUSD(usd) : null].filter(Boolean).join(" / ");
    const msg = `Hola! Me interesa la cuenta "${a.summoner}" (${a.rank || "Unranked"}${a.server ? " · " + a.server : ""})${price ? " — " + price : ""}. Quería consultar.`;
    const base = SUPPORT_WA.split("&text=")[0];
    window.open(base + "&text=" + encodeURIComponent(msg), "_blank");
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 0, overflow: "hidden" }}>
    <div style={{ position: "relative", height: 180, background: "var(--bg2)" }}>
      {cover ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--mut2)" }}><Gamepad2 size={40} /></div>}
      <button className="nop-iconbtn" onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "rgba(6,10,20,.6)" }}><X size={16} /></button>
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {a.server && <span className="nop-svc" style={{ background: "rgba(6,10,20,.7)", borderColor: "transparent", color: "#fff" }}>{a.server}</span>}
        <span className="nop-svc" style={{ background: "rgba(6,10,20,.7)", borderColor: "transparent", color: rkColor, fontWeight: 700 }}>{a.rank || "Unranked"}</span>
      </div>
    </div>
    <div className="bd" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>{a.summoner}</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <AccountStatChip icon={Crown} label="Nivel" value={a.level} />
        <AccountStatChip icon={Swords} label="Campeones" value={a.champions} />
        <AccountStatChip icon={Sparkles} label="Skins" value={a.skins} />
        <AccountStatChip icon={Zap} label="Esencia azul" value={a.blue_essence} />
      </div>
      {a.extra_info && <div style={{ marginBottom: 14 }}>
        <div className="nop-panel-h" style={{ marginBottom: 8 }}><FileText size={14} style={{ color: "var(--gold)" }} />Detalles de la cuenta</div>
        <p className="nop-mini" style={{ whiteSpace: "pre-wrap", color: "var(--mut)", lineHeight: 1.6, margin: 0 }}>{a.extra_info}</p>
      </div>}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        {a.price_ars != null && <b className="nop-display" style={{ fontSize: 26, color: "var(--gold)" }}>{fmtARS(a.price_ars)}</b>}
        {usd != null && <span style={{ color: "var(--grn)", fontWeight: 700, fontSize: 16 }}>{fmtUSD(usd)}</span>}
        {a.price_ars == null && usd == null && <span className="nop-mini">Precio a consultar</span>}
      </div>

      {myReq && myReq.status === "validated" ? (
        <div className="nop-card" style={{ padding: 14, background: "var(--bg2)" }}>
          <p className="nop-mini" style={{ marginBottom: 10, color: "var(--grn)" }}><Check size={13} style={{ verticalAlign: "-2px" }} /> Compra validada. Datos de acceso:</p>
          <Cred label="Usuario" value={myReq.granted_user} flash={flash} />
          <div style={{ height: 8 }} />
          <Cred label="Contraseña" value={myReq.granted_pass} flash={flash} />
        </div>
      ) : myReq && myReq.status === "pending" ? (
        <div className="nop-card" style={{ padding: 14, background: "var(--bg2)", textAlign: "center" }}>
          <Clock size={20} style={{ color: "var(--amber)" }} />
          <p className="nop-mini" style={{ marginTop: 6 }}>Ya enviaste el comprobante. Estamos validando el pago; apenas lo confirmemos se desbloquean el usuario y la contraseña acá.</p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="nop-btn nop-btn-ghost" style={{ flex: 1, minWidth: 140 }} onClick={consultar}><MessageCircle size={15} />Consultar</button>
          <button className="nop-btn nop-btn-gold" style={{ flex: 1, minWidth: 140 }} onClick={onAcquire}><Wallet size={15} />Adquirir</button>
        </div>
      )}
    </div>
  </div></div>;
}

/* ---- Modal: adquirir (pago + comprobante) ---- */
function AcquireAccountModal({ a, blue, profile, reload, flash, notify, onClose }) {
  const [currency, setCurrency] = useState("ars");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const usd = a.price_usd != null ? a.price_usd : (blue && a.price_ars ? Math.round((Number(a.price_ars) / blue) * 100) / 100 : null);
  const copy = (t) => { try { navigator.clipboard.writeText(t); flash("Copiado: " + t); } catch (e) { flash("Copiá manualmente: " + t); } };
  const submit = async () => {
    if (!file) { flash("Subí el comprobante de pago para continuar."); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "dat").toLowerCase();
      const path = `${profile.id}/account-${a.id}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("comprobantes").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("account_requests").insert({
        account_id: a.id, account_title: a.summoner, account_rank: a.rank, account_server: a.server,
        account_price_ars: a.price_ars ?? null, account_price_usd: a.price_usd ?? null,
        currency, receipt_path: path, status: "pending",
        client_id: profile.id, client_name: profile.full_name, client_discord: profile.discord || profile.email,
      });
      if (error) throw error;
      try { await notify(`🛒 ${profile.full_name} quiere adquirir "${a.summoner}" (con comprobante).`, "admin", null, "new"); } catch (e) {}
      await reload(); flash("¡Comprobante enviado! Validamos el pago y te desbloqueamos la cuenta."); onClose();
    } catch (e) { flash("No se pudo enviar: " + (e.message || e)); } finally { setBusy(false); }
  };
  return <div className="nop-modal" onClick={onClose}><div className="nop-card nop-modalbox" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
    <div className="hd"><h3>Adquirir · {a.summoner}</h3><button className="nop-iconbtn" onClick={onClose}><X size={16} /></button></div>
    <div className="bd">
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 10 }}>1 · Elegí la moneda</label>
      <div className="nop-segwrap" style={{ marginBottom: 18 }}>
        <button type="button" className={"nop-seg" + (currency === "ars" ? " on" : "")} onClick={() => setCurrency("ars")}>Pesos ARS (transferencia)</button>
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
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Monto a transferir</span>
            <b className="nop-display" style={{ color: "var(--gold)", fontSize: 22, fontWeight: 700 }}>{a.price_ars != null ? fmtARS(a.price_ars) : "a consultar"}</b>
          </div>
        </div>
      ) : (
        <div className="nop-card" style={{ padding: 18, background: "var(--bg2)", marginBottom: 18 }}>
          <div className="nop-panel-h" style={{ marginBottom: 12 }}><Wallet size={15} style={{ color: "var(--violet)" }} />Pagá con PayPal</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Monto a pagar</span>
            <b className="nop-display" style={{ color: "var(--violet)", fontSize: 22, fontWeight: 700 }}>{usd != null ? fmtUSD(usd) : "a consultar"}</b>
          </div>
          <p className="nop-mini" style={{ marginBottom: 14 }}>Abrí el link, pagá y descargá el comprobante para subirlo abajo.</p>
          <a className="nop-btn nop-btn-violet" href={PAYPAL_URL} target="_blank" rel="noreferrer"><ArrowRight size={15} />Ir a PayPal</a>
        </div>
      )}
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", margin: "4px 0 10px" }}>2 · Subí el comprobante <span className="req">*</span></label>
      <label className="nop-upload">
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Upload size={22} style={{ color: file ? "var(--grn)" : "var(--mut)" }} />
        <span>{file ? file.name : "Tocá para elegir una imagen o PDF del comprobante"}</span>
      </label>
      <button className="nop-btn nop-btn-gold" style={{ width: "100%", marginTop: 16 }} disabled={busy} onClick={submit}>{busy ? "Enviando…" : "Enviar solicitud de compra"}<Send size={15} /></button>
    </div>
  </div></div>;
}
