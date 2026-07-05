import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line,
} from "recharts";
import {
  Plus, Trash2, Gem, TrendingUp, TrendingDown, AlertTriangle,
  Store, Receipt, LayoutDashboard, Sparkles, Loader2,
} from "lucide-react";
import { useSupaTable } from "./useSupaTable";
import { supabase } from "./supabaseClient";

/* ---------------------------------------------------------------
   RÉIA — Store Profitability Ledger
   Palette strictly: Black / White / Burgundy / Beige — no gold/yellow.
   Data persistence: Supabase (see /supabase/schema.sql)
---------------------------------------------------------------- */

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

const COLORS = {
  black: "#191410",
  blackSoft: "#2A211C",
  white: "#FFFFFF",
  burgundy: "#6E1E2B",
  burgundyDeep: "#4E1520",
  burgundyBright: "#8C2A3A",
  burgundyPale: "#B5677A",
  beige: "#EFE7D8",
  beigeLight: "#F8F3E9",
  beigeDeep: "#D6CFC0",
  beigeMuted: "rgba(255,255,255,0.62)",
  ink: "#2A211C",
};

/* Palette-safe tonal series for charts — black / burgundy / beige / white only */
const TONES = [COLORS.burgundy, COLORS.black, COLORS.beigeDeep, COLORS.burgundyBright, COLORS.burgundyDeep, COLORS.blackSoft, COLORS.burgundyPale, COLORS.white];

const STORES = [
  { id: "s1", name: "RS Puram Flagship", short: "RS Puram" },
  { id: "s2", name: "Réia Aisle", short: "Aisle" },
];

const CATEGORY_OPTS = ["Ring", "Necklace", "Bangle", "Earring", "Bracelet", "Pendant", "Chain", "Other"];
const PURITY_OPTS = ["9K", "14K", "18K", "22K"];
const GOLD_COLOR_OPTS = ["Yellow Gold", "White Gold", "Rose Gold"];
const EXPENSE_CATS = ["Petrol / Transport", "Refreshments", "External Repairs", "Parcel / Courier", "Packaging", "Miscellaneous"];
const ORDER_TYPE_OPTS = ["Custom Order", "In-Stock"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MC_COST = 1000;
const MC_SALE_DEFAULT = 1800;
const DIA_COST = 10000;
const DIA_SALE = 35000;
const GST_PCT = 3;

const uid = () => Math.random().toString(36).slice(2, 10);
const inr = (n) => "\u20B9" + (Math.round(n || 0)).toLocaleString("en-IN");
const inrK = (n) => {
  const v = n || 0;
  if (Math.abs(v) >= 100000) return "\u20B9" + (v / 100000).toFixed(2) + "L";
  return "\u20B9" + Math.round(v).toLocaleString("en-IN");
};
const monthKey = (dateStr) => (dateStr || "").slice(0, 7);
const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  return MONTHS[parseInt(m, 10) - 1] + " " + y.slice(2);
};

/* ---------------- DB <-> app field mappers ---------------- */
const salesToDb = (f) => ({
  id: f.id || uid(),
  date: f.date,
  store: f.store,
  category: f.category,
  purity: f.purity,
  gold_color: f.goldColor,
  gold_wt: parseFloat(f.goldWt) || 0,
  dia_wt: parseFloat(f.diaWt) || 0,
  mc_rate: parseFloat(f.mcRate) || 0,
  sale_price: parseFloat(f.salePrice) || 0,
  order_type: f.orderType || "In-Stock",
});
const salesFromDb = (r) => ({
  id: r.id, date: r.date, store: r.store, category: r.category, purity: r.purity,
  goldColor: r.gold_color, goldWt: r.gold_wt, diaWt: r.dia_wt, mcRate: r.mc_rate, salePrice: r.sale_price,
  orderType: r.order_type || "In-Stock",
});

const overheadsToDb = (f) => ({
  id: f.id || uid(),
  month: f.month,
  store: f.store,
  rent: parseFloat(f.rent) || 0,
  electricity: parseFloat(f.electricity) || 0,
  maintenance: parseFloat(f.maintenance) || 0,
  salaries: parseFloat(f.salaries) || 0,
});
const overheadsFromDb = (r) => ({
  id: r.id, month: r.month, store: r.store, rent: r.rent, electricity: r.electricity,
  maintenance: r.maintenance, salaries: r.salaries,
});

const expensesToDb = (f) => ({
  id: f.id || uid(),
  date: f.date,
  store: f.store,
  category: f.category,
  amount: parseFloat(f.amount) || 0,
  note: f.note || "",
  receipt_url: f.receiptUrl || null,
});
const expensesFromDb = (r) => ({
  id: r.id, date: r.date, store: r.store, category: r.category, amount: r.amount, note: r.note,
  receiptUrl: r.receipt_url,
});

const Diamond = ({ size = 6, color = COLORS.burgundy }) => (
  <span style={{ display: "inline-block", width: size, height: size, background: color, transform: "rotate(45deg)", flexShrink: 0 }} />
);

const Card = ({ children, style }) => (
  <div style={{ background: COLORS.beigeLight, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4, padding: "20px 22px", ...style }}>{children}</div>
);

const Eyebrow = ({ children, right }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: COLORS.burgundy, fontWeight: 500 }}>
      <Diamond size={5} /> {children}
    </div>
    {right && <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: COLORS.black, fontWeight: 500 }}>{right}</div>}
  </div>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 22 }}>
    <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 24, color: COLORS.black, margin: 0, letterSpacing: "-0.01em" }}>{children}</h2>
    {sub && <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: "#7A6E60", marginTop: 4 }}>{sub}</div>}
  </div>
);

const Input = (props) => (
  <input {...props} style={{ width: "100%", padding: "9px 11px", fontFamily: "'Jost',sans-serif", fontSize: 13.5, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 3, background: COLORS.white, color: COLORS.ink, outline: "none", boxSizing: "border-box", ...(props.style || {}) }} />
);
const Select = ({ children, ...props }) => (
  <select {...props} style={{ width: "100%", padding: "9px 11px", fontFamily: "'Jost',sans-serif", fontSize: 13.5, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 3, background: COLORS.white, color: COLORS.ink, outline: "none", boxSizing: "border-box", ...(props.style || {}) }}>{children}</select>
);
const Label = ({ children }) => (
  <label style={{ display: "block", fontFamily: "'Jost',sans-serif", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8A7C6B", marginBottom: 5, fontWeight: 500 }}>{children}</label>
);

const Btn = ({ children, onClick, variant = "primary", style, type = "button" }) => {
  const base = { display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "'Jost',sans-serif", fontSize: 13, fontWeight: 500, padding: "10px 18px", borderRadius: 3, cursor: "pointer", border: "none", letterSpacing: "0.02em", transition: "opacity .15s" };
  const variants = {
    primary: { background: COLORS.burgundy, color: COLORS.white },
    dark: { background: COLORS.black, color: COLORS.beige },
    ghost: { background: "transparent", color: COLORS.burgundy, border: `1px solid ${COLORS.burgundy}` },
    danger: { background: "transparent", color: COLORS.burgundyBright },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e)=>e.currentTarget.style.opacity=0.85}
      onMouseLeave={(e)=>e.currentTarget.style.opacity=1}>
      {children}
    </button>
  );
};

const KPI = ({ label, value, delta, sub, accent }) => (
  <div style={{ background: accent ? COLORS.black : COLORS.beigeLight, border: `1px solid ${accent ? COLORS.black : COLORS.beigeDeep}`, borderRadius: 4, padding: "18px 20px", flex: 1, minWidth: 170 }}>
    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: accent ? COLORS.beigeMuted : "#8A7C6B", marginBottom: 8, fontWeight: 500 }}>{label}</div>
    <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 24, color: accent ? COLORS.white : COLORS.black, letterSpacing: "-0.01em" }}>{value}</div>
    {(delta !== undefined || sub) && (
      <div style={{ marginTop: 6, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: accent ? COLORS.beigeMuted : (delta >= 0 ? COLORS.black : COLORS.burgundyBright), display: "flex", alignItems: "center", gap: 4 }}>
        {delta !== undefined && (delta >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>)}
        {delta !== undefined ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prev month` : sub}
      </div>
    )}
  </div>
);

/* ---------------- Main App ---------------- */
export default function App() {
  const salesTable = useSupaTable("sales", salesToDb, salesFromDb);
  const overheadsTable = useSupaTable("overheads", overheadsToDb, overheadsFromDb);
  const expensesTable = useSupaTable("expenses", expensesToDb, expensesFromDb);

  const sales = salesTable.rows;
  const overheads = overheadsTable.rows;
  const expenses = expensesTable.rows;
  const ready = !salesTable.loading && !overheadsTable.loading && !expensesTable.loading;
  const dbError = salesTable.error || overheadsTable.error || expensesTable.error;

  const [tab, setTab] = useState("overview");
  const [storeFilter, setStoreFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  useEffect(() => {
    const el = document.createElement("style");
    el.innerHTML = FONTS + `
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::selection { background: ${COLORS.burgundy}; color: ${COLORS.beige}; }
      table { border-collapse: collapse; width: 100%; }
      th { text-align: left; font-family:'Jost',sans-serif; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:#8A7C6B; font-weight:500; padding:9px 10px; border-bottom: 1px solid ${COLORS.beigeDeep}; white-space:nowrap; }
      td { font-family:'IBM Plex Mono',monospace; font-size:12.5px; color:${COLORS.ink}; padding:9px 10px; border-bottom: 1px solid #EDE3D0; white-space:nowrap; }
      tr:hover td { background: #FBF7EE; }
      input::placeholder { color: #B3A692; }
      input[type=date], input[type=month] { font-family:'IBM Plex Mono',monospace; }
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  /* ---------- derived per-sale margin + GST ---------- */
  const salesEnriched = useMemo(() => sales.map(s => {
    const goldWt = parseFloat(s.goldWt) || 0;
    const diaWt = parseFloat(s.diaWt) || 0;
    const mcRate = parseFloat(s.mcRate) || 0;
    const salePrice = parseFloat(s.salePrice) || 0;
    const makingMargin = goldWt * (mcRate - MC_COST);
    const diamondMargin = diaWt * (DIA_SALE - DIA_COST);
    const grossProfit = makingMargin + diamondMargin;
    const gstAmount = salePrice * (GST_PCT / 100);
    const invoiceTotal = salePrice + gstAmount;
    return {
      ...s, goldWt, diaWt, mcRate, salePrice, makingMargin, diamondMargin, grossProfit,
      gstAmount, invoiceTotal, goldColor: s.goldColor || "Yellow Gold", purity: s.purity || "18K",
    };
  }), [sales]);

  /* ---------- monthly aggregation per store ---------- */
  const monthlyData = useMemo(() => {
    const map = {};
    const touch = (m, st) => {
      if (!map[m]) map[m] = {};
      if (!map[m][st]) map[m][st] = {
        revenue: 0, grossProfit: 0, makingMargin: 0, diamondMargin: 0, gstCollected: 0,
        overhead: 0, dailyExp: 0, rent: 0, electricity: 0, maintenance: 0, salaries: 0, expByCat: {},
      };
      return map[m][st];
    };
    salesEnriched.forEach(s => {
      const m = monthKey(s.date); if (!m || !s.store) return;
      const b = touch(m, s.store);
      b.revenue += s.salePrice; b.grossProfit += s.grossProfit;
      b.makingMargin += s.makingMargin; b.diamondMargin += s.diamondMargin;
      b.gstCollected += s.gstAmount;
    });
    overheads.forEach(o => {
      const b = touch(o.month, o.store);
      const rent = parseFloat(o.rent) || 0, elec = parseFloat(o.electricity) || 0, maint = parseFloat(o.maintenance) || 0, sal = parseFloat(o.salaries) || 0;
      b.rent += rent; b.electricity += elec; b.maintenance += maint; b.salaries += sal;
      b.overhead += rent + elec + maint + sal;
    });
    expenses.forEach(e => {
      const m = monthKey(e.date); if (!m || !e.store) return;
      const b = touch(m, e.store);
      const amt = parseFloat(e.amount) || 0;
      b.dailyExp += amt; b.overhead += amt;
      b.expByCat[e.category] = (b.expByCat[e.category] || 0) + amt;
    });
    return map;
  }, [salesEnriched, overheads, expenses]);

  const allMonths = useMemo(() => Object.keys(monthlyData).sort(), [monthlyData]);

  /* Months actually used for KPI/report aggregation — "All Time" uses every
     month; picking a specific month/year narrows every report below to it. */
  const viewMonths = useMemo(
    () => (periodFilter === "all" ? allMonths : allMonths.filter(m => m === periodFilter)),
    [allMonths, periodFilter]
  );

  const chartData = useMemo(() => allMonths.map(m => {
    const storesInMonth = monthlyData[m];
    let row = { month: monthLabel(m), key: m };
    let combGross = 0, combNet = 0, combRevenue = 0;
    STORES.forEach(st => {
      const b = storesInMonth[st.id] || { revenue: 0, grossProfit: 0, overhead: 0 };
      const net = b.grossProfit - b.overhead;
      row[`${st.short} Gross`] = Math.round(b.grossProfit);
      row[`${st.short} Net`] = Math.round(net);
      row[`${st.short} Revenue`] = Math.round(b.revenue);
      combGross += b.grossProfit; combNet += net; combRevenue += b.revenue;
    });
    row["Combined Gross"] = Math.round(combGross);
    row["Combined Net"] = Math.round(combNet);
    row["Combined Revenue"] = Math.round(combRevenue);
    return row;
  }), [allMonths, monthlyData]);

  const totals = useMemo(() => {
    let revenue = 0, gross = 0, overhead = 0, net = 0, makingM = 0, diaM = 0, gst = 0;
    const perStoreTotals = {};
    STORES.forEach(st => perStoreTotals[st.id] = { revenue: 0, gross: 0, overhead: 0, net: 0, months: 0 });
    viewMonths.forEach(m => {
      STORES.forEach(st => {
        if (storeFilter !== "all" && storeFilter !== st.id) return;
        const b = monthlyData[m][st.id];
        if (!b) return;
        const n = b.grossProfit - b.overhead;
        revenue += b.revenue; gross += b.grossProfit; overhead += b.overhead; net += n; gst += b.gstCollected;
        makingM += b.makingMargin; diaM += b.diamondMargin;
        perStoreTotals[st.id].revenue += b.revenue;
        perStoreTotals[st.id].gross += b.grossProfit;
        perStoreTotals[st.id].overhead += b.overhead;
        perStoreTotals[st.id].net += n;
        perStoreTotals[st.id].months += 1;
      });
    });
    return { revenue, gross, overhead, net, makingM, diaM, gst, perStoreTotals };
  }, [viewMonths, monthlyData, storeFilter]);

  const lastTwo = allMonths.slice(-2);
  const momDelta = useMemo(() => {
    if (lastTwo.length < 2) return {};
    const get = (m, field) => {
      let v = 0;
      STORES.forEach(st => {
        if (storeFilter !== "all" && storeFilter !== st.id) return;
        const b = monthlyData[m][st.id]; if (!b) return;
        if (field === "gross") v += b.grossProfit;
        if (field === "net") v += b.grossProfit - b.overhead;
        if (field === "revenue") v += b.revenue;
      });
      return v;
    };
    const prevG = get(lastTwo[0], "gross"), curG = get(lastTwo[1], "gross");
    const prevN = get(lastTwo[0], "net"), curN = get(lastTwo[1], "net");
    const prevR = get(lastTwo[0], "revenue"), curR = get(lastTwo[1], "revenue");
    return {
      gross: prevG ? ((curG - prevG) / Math.abs(prevG)) * 100 : 0,
      net: prevN ? ((curN - prevN) / Math.abs(prevN)) * 100 : 0,
      revenue: prevR ? ((curR - prevR) / Math.abs(prevR)) * 100 : 0,
    };
  }, [lastTwo, monthlyData, storeFilter]);

  const expenseBreakdown = useMemo(() => {
    let rent = 0, elec = 0, maint = 0, sal = 0;
    const cats = {};
    viewMonths.forEach(m => STORES.forEach(st => {
      if (storeFilter !== "all" && storeFilter !== st.id) return;
      const b = monthlyData[m][st.id]; if (!b) return;
      rent += b.rent; elec += b.electricity; maint += b.maintenance; sal += b.salaries;
      Object.entries(b.expByCat).forEach(([c, v]) => { cats[c] = (cats[c] || 0) + v; });
    }));
    const arr = [
      { name: "Salaries", value: Math.round(sal) },
      { name: "Rent", value: Math.round(rent) },
      { name: "Electricity", value: Math.round(elec) },
      { name: "Maintenance", value: Math.round(maint) },
      ...Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value) })),
    ].filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    const total = arr.reduce((a, x) => a + x.value, 0);
    return { items: arr, total };
  }, [viewMonths, monthlyData, storeFilter]);

  const flags = useMemo(() => {
    const out = [];
    for (let i = 1; i < allMonths.length; i++) {
      const prevM = allMonths[i - 1], curM = allMonths[i];
      STORES.forEach(st => {
        const prevB = monthlyData[prevM][st.id], curB = monthlyData[curM][st.id];
        if (!prevB || !curB) return;
        Object.keys(curB.expByCat || {}).forEach(cat => {
          const prevV = prevB.expByCat?.[cat] || 0;
          const curV = curB.expByCat[cat];
          if (prevV > 500 && curV > prevV * 1.2) {
            const pct = ((curV - prevV) / prevV) * 100;
            out.push({ level: pct > 50 ? "high" : "med", text: `${cat} at ${st.short} rose ${pct.toFixed(0)}% (${inrK(prevV)} \u2192 ${inrK(curV)}) from ${monthLabel(prevM)} to ${monthLabel(curM)}.` });
          }
        });
      });
    }
    allMonths.forEach(m => {
      const b1 = monthlyData[m]["s1"], b2 = monthlyData[m]["s2"];
      if (b1 && b2 && b1.revenue > 0 && b2.revenue > 0) {
        const r1 = b1.electricity / b1.revenue, r2 = b2.electricity / b2.revenue;
        if (r1 > 0 && r2 > 0) {
          const ratio = r1 > r2 ? r1 / r2 : r2 / r1;
          if (ratio > 1.6 && Math.max(b1.electricity, b2.electricity) > 1000) {
            const worse = r1 > r2 ? STORES[0] : STORES[1];
            out.push({ level: "med", text: `${worse.short} electricity cost is disproportionately high relative to revenue vs the other store in ${monthLabel(m)} (${ratio.toFixed(1)}x).` });
          }
        }
      }
    });
    const lowMc = salesEnriched.filter(s => s.mcRate > 0 && s.mcRate < 1650);
    if (lowMc.length) {
      const lost = lowMc.reduce((a, s) => a + s.goldWt * (1650 - s.mcRate), 0);
      out.push({ level: "high", text: `${lowMc.length} sale(s) charged making rate below your ₹1,650/g floor \u2014 roughly ${inrK(lost)} of margin left on the table.` });
    }
    if (lastTwo.length === 2 && momDelta.net !== undefined && momDelta.net < -15) {
      out.push({ level: "high", text: `Net profit fell ${Math.abs(momDelta.net).toFixed(0)}% month-on-month (${monthLabel(lastTwo[0])} \u2192 ${monthLabel(lastTwo[1])}). Overheads may be outpacing sales.` });
    }
    allMonths.forEach(m => {
      STORES.forEach(st => {
        const b = monthlyData[m][st.id]; if (!b || b.grossProfit <= 0) return;
        const ratio = b.overhead / b.grossProfit;
        if (ratio > 0.8) {
          out.push({ level: ratio > 1 ? "high" : "med", text: `${st.short} overhead ate ${(ratio * 100).toFixed(0)}% of gross profit in ${monthLabel(m)}${ratio > 1 ? " \u2014 store ran at a net LOSS" : ""}.` });
        }
      });
    });
    allMonths.forEach(m => {
      STORES.forEach(st => {
        const b = monthlyData[m][st.id]; if (!b || b.revenue <= 0) return;
        if (b.salaries / b.revenue > 0.35) {
          out.push({ level: "med", text: `${st.short} salary cost is ${((b.salaries / b.revenue) * 100).toFixed(0)}% of revenue in ${monthLabel(m)}, higher than a healthy ~20\u201325% benchmark for jewelry retail.` });
        }
      });
    });
    return out.sort((a, b) => (a.level === "high" ? -1 : 1) - (b.level === "high" ? -1 : 1)).slice(0, 12);
  }, [allMonths, monthlyData, salesEnriched, lastTwo, momDelta]);

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'Jost',sans-serif", color: COLORS.burgundy, gap: 10, background: COLORS.beige }}>
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        Loading ledger…
        <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.beige, minHeight: "100vh", fontFamily: "'Jost',sans-serif" }}>
      {dbError && (
        <div style={{ background: COLORS.burgundyBright, color: COLORS.white, padding: "10px 32px", fontFamily: "'Jost',sans-serif", fontSize: 13 }}>
          Database error: {dbError} — check your Supabase URL/key in .env.local and that the tables exist.
        </div>
      )}
      <div style={{ background: COLORS.black, padding: "26px 32px 22px", borderBottom: `3px solid ${COLORS.burgundy}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Diamond size={7} color={COLORS.white} />
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 10.5, letterSpacing: "0.22em", color: COLORS.beigeMuted, textTransform: "uppercase" }}>Lab-Grown Diamond Jewelry</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 32, color: COLORS.white, margin: 0, letterSpacing: "0.02em" }}>
              RÉIA <span style={{ fontWeight: 400, fontStyle: "italic", color: COLORS.beigeMuted, fontSize: 22 }}>Profitability Ledger</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value)}
              style={{
                fontFamily: "'Jost',sans-serif", fontSize: 12.5, padding: "8px 12px", borderRadius: 3,
                border: `1px solid #4A3F35`, background: periodFilter !== "all" ? COLORS.burgundy : "transparent",
                color: periodFilter !== "all" ? COLORS.white : COLORS.beigeMuted, cursor: "pointer", fontWeight: 500,
              }}
            >
              <option value="all" style={{ color: COLORS.ink, background: COLORS.white }}>All Time</option>
              {allMonths.slice().reverse().map(m => (
                <option key={m} value={m} style={{ color: COLORS.ink, background: COLORS.white }}>{monthLabel(m)}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              {["all", ...STORES.map(s => s.id)].map(f => (
                <button key={f} onClick={() => setStoreFilter(f)} style={{
                  fontFamily: "'Jost',sans-serif", fontSize: 12.5, padding: "8px 16px", borderRadius: 3,
                  border: `1px solid ${storeFilter === f ? COLORS.white : "#4A3F35"}`,
                  background: storeFilter === f ? COLORS.burgundy : "transparent",
                  color: storeFilter === f ? COLORS.white : COLORS.beigeMuted, cursor: "pointer", fontWeight: 500,
                }}>
                  {f === "all" ? "Both Stores" : STORES.find(s => s.id === f).short}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 22, flexWrap: "wrap" }}>
          {[
            ["overview", "Overview", LayoutDashboard],
            ["sales", "Sales Entry", Gem],
            ["merchandise", "Merchandise Report", Sparkles],
            ["overhead", "Store Overheads", Store],
            ["expenses", "Daily Expenses", Receipt],
            ["insights", "Flags & Insights", AlertTriangle],
          ].map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              display: "flex", alignItems: "center", gap: 6, fontFamily: "'Jost',sans-serif",
              fontSize: 13, padding: "9px 16px", borderRadius: "3px 3px 0 0", cursor: "pointer",
              border: "none", borderBottom: tab === k ? `2px solid ${COLORS.white}` : "2px solid transparent",
              background: tab === k ? COLORS.beige : "transparent",
              color: tab === k ? COLORS.black : COLORS.beigeMuted, fontWeight: 500,
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "26px 32px 50px" }}>
        {tab === "overview" && (
          <Overview totals={totals} chartData={chartData} momDelta={momDelta} allMonths={allMonths}
            expenseBreakdown={expenseBreakdown} flags={flags.slice(0, 4)}
            storeFilter={storeFilter} monthlyData={monthlyData} periodFilter={periodFilter} />
        )}
        {tab === "sales" && <SalesTab enriched={salesEnriched} onAdd={salesTable.add} onRemove={salesTable.remove} />}
        {tab === "merchandise" && <MerchandiseTab enriched={salesEnriched} storeFilter={storeFilter} periodFilter={periodFilter} />}
        {tab === "overhead" && <OverheadTab overheads={overheads} onAdd={overheadsTable.add} onRemove={overheadsTable.remove} />}
        {tab === "expenses" && <ExpensesTab expenses={expenses} onAdd={expensesTable.add} onRemove={expensesTable.remove} />}
        {tab === "insights" && <InsightsTab flags={flags} totals={totals} allMonths={allMonths} />}
      </div>
    </div>
  );
}

/* ================= OVERVIEW ================= */
function Overview({ totals, chartData, momDelta, allMonths, expenseBreakdown, flags, storeFilter, monthlyData, periodFilter }) {
  const marginPct = totals.revenue ? (totals.net / totals.revenue) * 100 : 0;
  const periodLabel = periodFilter === "all" ? "All Time" : monthLabel(periodFilter);

  if (allMonths.length === 0) {
    return <EmptyState title="No data yet" desc="Add sales, store overheads, and daily expenses from the tabs above. Once entries exist for a month, your gross and net profit will appear here automatically." />;
  }

  return (
    <div>
      <SectionTitle sub={`Diamond weight and making charges drive your margin — gold is pass-through at cost, GST is tracked separately as tax, not revenue. Showing: ${periodLabel}.`}>Business Overview</SectionTitle>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
        <KPI label="Total Revenue" value={inrK(totals.revenue)} delta={momDelta.revenue} accent />
        <KPI label="Gross Profit" value={inrK(totals.gross)} delta={momDelta.gross} />
        <KPI label="Net Profit" value={inrK(totals.net)} delta={momDelta.net} />
        <KPI label="Net Margin" value={marginPct.toFixed(1) + "%"} sub={`Overheads: ${inrK(totals.overhead)}`} />
        <KPI label="GST Collected (3%)" value={inrK(totals.gst)} sub="Pass-through tax, excluded from profit" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card>
          <Eyebrow>Monthly Gross vs Net Profit</Eyebrow>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.beigeDeep} />
              <XAxis dataKey="month" tick={{ fontFamily: "'Jost',sans-serif", fontSize: 11, fill: "#8A7C6B" }} />
              <YAxis tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fill: "#8A7C6B" }} tickFormatter={inrK} />
              <Tooltip formatter={(v) => inr(v)} contentStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4 }} />
              <Legend wrapperStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12 }} />
              <Bar dataKey={storeFilter === "all" ? "Combined Gross" : `${STORES.find(s => s.id === storeFilter)?.short} Gross`} fill={COLORS.beigeDeep} stroke={COLORS.black} strokeWidth={0.5} name="Gross Profit" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey={storeFilter === "all" ? "Combined Net" : `${STORES.find(s => s.id === storeFilter)?.short} Net`} stroke={COLORS.burgundy} strokeWidth={2.5} name="Net Profit" dot={{ r: 3.5, fill: COLORS.burgundy }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <Eyebrow right={expenseBreakdown.total ? inrK(expenseBreakdown.total) : null}>Overhead Breakdown</Eyebrow>
          {expenseBreakdown.items.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8A7C6B", padding: "40px 0", textAlign: "center" }}>
              No overhead entries yet. Add rent, electricity, maintenance, salaries or daily spends to see this chart.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={expenseBreakdown.items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={85} paddingAngle={2}>
                    {expenseBreakdown.items.map((e, i) => <Cell key={i} fill={TONES[i % TONES.length]} stroke={COLORS.black} strokeWidth={0.75} />)}
                  </Pie>
                  <Tooltip formatter={(v) => inr(v)} contentStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 8 }}>
                {expenseBreakdown.items.map((e, i) => (
                  <div key={e.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 2px", borderBottom: i < expenseBreakdown.items.length - 1 ? "1px solid #EDE3D0" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontFamily: "'Jost',sans-serif" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: TONES[i % TONES.length], border: `1px solid ${COLORS.black}`, display: "inline-block" }} />
                      {e.name}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, display: "flex", gap: 10 }}>
                      <span style={{ color: "#8A7C6B" }}>{((e.value / expenseBreakdown.total) * 100).toFixed(0)}%</span>
                      <span style={{ fontWeight: 500 }}>{inr(e.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card>
          <Eyebrow>Store 1 vs Store 2 — Latest Month</Eyebrow>
          <StoreCompare monthlyData={monthlyData} allMonths={allMonths} />
        </Card>
        <Card>
          <Eyebrow>Top Flags</Eyebrow>
          {flags.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8A7C6B", padding: "30px 0", textAlign: "center" }}>No spending concerns detected yet.</div>
          ) : flags.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 0", borderBottom: i < flags.length - 1 ? `1px solid #EDE3D0` : "none" }}>
              <AlertTriangle size={14} color={f.level === "high" ? COLORS.burgundyBright : COLORS.black} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: COLORS.ink }}>{f.text}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <Eyebrow>Average Profitability per Store (across all months entered)</Eyebrow>
        <table>
          <thead><tr><th>Store</th><th>Months</th><th>Avg Revenue</th><th>Avg Gross Profit</th><th>Avg Overhead</th><th>Avg Net Profit</th><th>Avg Net Margin</th></tr></thead>
          <tbody>
            {STORES.map(st => {
              const t = totals.perStoreTotals[st.id];
              const n = t.months || 1;
              const margin = t.revenue ? (t.net / t.revenue) * 100 : 0;
              return (
                <tr key={st.id}>
                  <td style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500 }}>{st.name}</td>
                  <td>{t.months}</td>
                  <td>{inr(t.revenue / n)}</td>
                  <td>{inr(t.gross / n)}</td>
                  <td>{inr(t.overhead / n)}</td>
                  <td style={{ color: t.net >= 0 ? COLORS.black : COLORS.burgundyBright, fontWeight: 500 }}>{inr(t.net / n)}</td>
                  <td>{margin.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function StoreCompare({ monthlyData, allMonths }) {
  if (allMonths.length === 0) return null;
  const latest = allMonths[allMonths.length - 1];
  const data = STORES.map(st => {
    const b = monthlyData[latest][st.id] || { revenue: 0, grossProfit: 0, overhead: 0 };
    return { name: st.short, Revenue: Math.round(b.revenue), "Gross Profit": Math.round(b.grossProfit), "Net Profit": Math.round(b.grossProfit - b.overhead) };
  });
  return (
    <>
      <div style={{ fontSize: 11, color: "#8A7C6B", marginBottom: 8, fontFamily: "'IBM Plex Mono',monospace" }}>{monthLabel(latest)}</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.beigeDeep} />
          <XAxis dataKey="name" tick={{ fontFamily: "'Jost',sans-serif", fontSize: 12, fill: "#8A7C6B" }} />
          <YAxis tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fill: "#8A7C6B" }} tickFormatter={inrK} />
          <Tooltip formatter={(v) => inr(v)} contentStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4 }} />
          <Legend wrapperStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12 }} />
          <Bar dataKey="Revenue" fill={COLORS.beigeDeep} stroke={COLORS.black} strokeWidth={0.5} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Gross Profit" fill={COLORS.burgundyPale} stroke={COLORS.black} strokeWidth={0.5} radius={[3, 3, 0, 0]} />
          <Bar dataKey="Net Profit" fill={COLORS.burgundy} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

function EmptyState({ title, desc }) {
  return (
    <div style={{ textAlign: "center", padding: "70px 20px", border: `1px dashed ${COLORS.beigeDeep}`, borderRadius: 4, background: COLORS.beigeLight }}>
      <Diamond size={14} />
      <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: COLORS.black, margin: "16px 0 8px" }}>{title}</h3>
      <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 13.5, color: "#8A7C6B", maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

/* ================= SALES TAB ================= */
function SalesTab({ enriched, onAdd, onRemove }) {
  const blank = { date: "", store: "s1", category: "Ring", purity: "18K", goldColor: "Yellow Gold", goldWt: "", diaWt: "", mcRate: MC_SALE_DEFAULT, salePrice: "", orderType: "In-Stock" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const gstPreview = (parseFloat(form.salePrice) || 0) * (GST_PCT / 100);
  const invoicePreview = (parseFloat(form.salePrice) || 0) + gstPreview;

  const add = async () => {
    if (!form.date || !form.goldWt || !form.salePrice) return;
    setSaving(true);
    await onAdd(form);
    setSaving(false);
    setForm(blank);
  };

  return (
    <div>
      <SectionTitle sub="One row per piece sold. Gold is priced pass-through, so margin comes purely from making/wastage and diamond spread. GST (3%) is calculated on top of sale price and tracked separately as tax.">Sales Entry</SectionTitle>

      <Card style={{ marginBottom: 22 }}>
        <Eyebrow>Add a Sale</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Store</Label>
            <Select value={form.store} onChange={e => setForm({ ...form, store: e.target.value })}>
              {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label>Category</Label>
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORY_OPTS.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div><Label>Gold Purity</Label>
            <Select value={form.purity} onChange={e => setForm({ ...form, purity: e.target.value })}>
              {PURITY_OPTS.map(p => <option key={p}>{p}</option>)}
            </Select>
          </div>
          <div><Label>Gold Color</Label>
            <Select value={form.goldColor} onChange={e => setForm({ ...form, goldColor: e.target.value })}>
              {GOLD_COLOR_OPTS.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div><Label>Order Type</Label>
            <Select value={form.orderType} onChange={e => setForm({ ...form, orderType: e.target.value })}>
              {ORDER_TYPE_OPTS.map(o => <option key={o}>{o}</option>)}
            </Select>
          </div>
          <div><Label>Gold Weight (g)</Label><Input type="number" step="0.01" placeholder="4.20" value={form.goldWt} onChange={e => setForm({ ...form, goldWt: e.target.value })} /></div>
          <div><Label>Diamond Weight (ct)</Label><Input type="number" step="0.01" placeholder="0.85" value={form.diaWt} onChange={e => setForm({ ...form, diaWt: e.target.value })} /></div>
          <div><Label>Making Rate Charged (₹/g)</Label><Input type="number" placeholder="1650–2000" value={form.mcRate} onChange={e => setForm({ ...form, mcRate: e.target.value })} /></div>
          <div><Label>Sale Price before GST (₹)</Label><Input type="number" placeholder="e.g. 185000" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} /></div>
        </div>
        {form.salePrice && (
          <div style={{ marginTop: 12, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#8A7C6B", display: "flex", gap: 20 }}>
            <span>GST (3%): <b style={{ color: COLORS.ink }}>{inr(gstPreview)}</b></span>
            <span>Invoice Total: <b style={{ color: COLORS.ink }}>{inr(invoicePreview)}</b></span>
          </div>
        )}
        <div style={{ marginTop: 16 }}><Btn onClick={add}>{saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} Add Sale</Btn></div>
      </Card>

      <Card>
        <Eyebrow>{enriched.length} Sale{enriched.length !== 1 ? "s" : ""} Logged</Eyebrow>
        {enriched.length === 0 ? <EmptyState title="No sales yet" desc="Add your first sale above to begin building the gross profit ledger." /> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr>
                <th>Date</th><th>Store</th><th>Item</th><th>Order Type</th><th>Purity</th><th>Gold Color</th><th>Gold (g)</th><th>Diamond (ct)</th><th>MC ₹/g</th><th>Sale Price</th><th>GST (3%)</th><th>Invoice Total</th><th>Gross Profit</th><th></th>
              </tr></thead>
              <tbody>
                {enriched.map(s => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td>{STORES.find(st => st.id === s.store)?.short}</td>
                    <td>{s.category}</td>
                    <td>{s.orderType || "In-Stock"}</td>
                    <td>{s.purity}</td>
                    <td>{s.goldColor}</td>
                    <td>{s.goldWt}</td>
                    <td>{s.diaWt}</td>
                    <td>{s.mcRate}{s.mcRate < 1650 && s.mcRate > 0 && <AlertTriangle size={11} color={COLORS.burgundyBright} style={{ marginLeft: 4, verticalAlign: "middle" }} />}</td>
                    <td>{inr(s.salePrice)}</td>
                    <td>{inr(s.gstAmount)}</td>
                    <td>{inr(s.invoiceTotal)}</td>
                    <td style={{ color: COLORS.black, fontWeight: 500 }}>{inr(s.grossProfit)}</td>
                    <td><button onClick={() => onRemove(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.burgundyBright }}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= MERCHANDISE REPORT TAB ================= */
function MerchandiseTab({ enriched, storeFilter, periodFilter }) {
  const filtered = useMemo(
    () => enriched.filter(s =>
      (storeFilter === "all" || s.store === storeFilter) &&
      (periodFilter === "all" || monthKey(s.date) === periodFilter)
    ),
    [enriched, storeFilter, periodFilter]
  );

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach(s => {
      const k = s.category || "Other";
      if (!map[k]) map[k] = { name: k, units: 0, revenue: 0, grossProfit: 0, s1: 0, s2: 0 };
      map[k].units += 1;
      map[k].revenue += s.salePrice;
      map[k].grossProfit += s.grossProfit;
      map[k][s.store] += 1;
    });
    return Object.values(map).sort((a, b) => b.units - a.units);
  }, [filtered]);

  const byGoldColor = useMemo(() => {
    const map = {};
    filtered.forEach(s => {
      const k = s.goldColor || "Yellow Gold";
      if (!map[k]) map[k] = { name: k, units: 0, revenue: 0 };
      map[k].units += 1;
      map[k].revenue += s.salePrice;
    });
    return Object.values(map).sort((a, b) => b.units - a.units);
  }, [filtered]);

  const byStoreCategory = useMemo(() => {
    const out = {};
    STORES.forEach(st => { out[st.id] = {}; });
    filtered.forEach(s => {
      if (!out[s.store]) return;
      out[s.store][s.category] = (out[s.store][s.category] || 0) + 1;
    });
    const top = {};
    STORES.forEach(st => {
      const entries = Object.entries(out[st.id] || {});
      top[st.id] = entries.length ? entries.sort((a, b) => b[1] - a[1])[0] : null;
    });
    return top;
  }, [filtered]);

  /* ---------- Order type: Custom Order vs In-Stock ---------- */
  const orderTypeStats = useMemo(() => {
    const monthsSeen = new Set();
    let custom = 0, instock = 0;
    filtered.forEach(s => {
      const m = monthKey(s.date);
      if (m) monthsSeen.add(m);
      if (s.orderType === "Custom Order") custom += 1; else instock += 1;
    });
    const monthCount = monthsSeen.size || 1;
    return {
      custom, instock, monthCount,
      avgCustomPerMonth: custom / monthCount,
      avgInStockPerMonth: instock / monthCount,
    };
  }, [filtered]);

  const orderTypeSplit = useMemo(() => ([
    { name: "Custom Order", units: orderTypeStats.custom },
    { name: "In-Stock", units: orderTypeStats.instock },
  ]), [orderTypeStats]);

  const byCategoryOrderType = useMemo(() => {
    const map = {};
    filtered.forEach(s => {
      const k = s.category || "Other";
      if (!map[k]) map[k] = { name: k, custom: 0, instock: 0, total: 0 };
      map[k].total += 1;
      if (s.orderType === "Custom Order") map[k].custom += 1; else map[k].instock += 1;
    });
    return Object.values(map)
      .map(c => ({
        ...c,
        customPct: c.total ? (c.custom / c.total) * 100 : 0,
        instockPct: c.total ? (c.instock / c.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const topCategory = byCategory[0];
  const topGoldColor = byGoldColor[0];
  const periodLabel = periodFilter === "all" ? "All Time" : monthLabel(periodFilter);

  if (filtered.length === 0) {
    return <EmptyState title="No sales to report on yet" desc="Once you log sales in the Sales Entry tab — including gold color — this report will show your best-selling categories, colors, and store performance." />;
  }

  return (
    <div>
      <SectionTitle sub={`Which products, gold colors and categories are moving at each store. Showing: ${periodLabel}.`}>Merchandise Report</SectionTitle>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KPI label="Best-Selling Category" value={topCategory ? topCategory.name : "—"} sub={topCategory ? `${topCategory.units} unit${topCategory.units !== 1 ? "s" : ""} sold` : ""} accent />
        <KPI label="Most Popular Gold Color" value={topGoldColor ? topGoldColor.name : "—"} sub={topGoldColor ? `${topGoldColor.units} unit${topGoldColor.units !== 1 ? "s" : ""} sold` : ""} />
        {STORES.map(st => (
          <KPI key={st.id} label={`Top Seller — ${st.short}`}
            value={byStoreCategory[st.id] ? byStoreCategory[st.id][0] : "—"}
            sub={byStoreCategory[st.id] ? `${byStoreCategory[st.id][1]} units` : "No sales logged"} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card>
          <Eyebrow>Units Sold by Category</Eyebrow>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.beigeDeep} />
              <XAxis type="number" tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fill: "#8A7C6B" }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontFamily: "'Jost',sans-serif", fontSize: 12, fill: "#8A7C6B" }} />
              <Tooltip contentStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4 }} />
              <Bar dataKey="units" name="Units Sold" fill={COLORS.burgundy} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <Eyebrow>Gold Color Preference</Eyebrow>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={byGoldColor} dataKey="units" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={85} paddingAngle={2}>
                {byGoldColor.map((e, i) => <Cell key={i} fill={TONES[i % TONES.length]} stroke={COLORS.black} strokeWidth={0.75} />)}
              </Pie>
              <Tooltip contentStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 8 }}>
            {byGoldColor.map((e, i) => (
              <div key={e.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 2px", borderBottom: i < byGoldColor.length - 1 ? "1px solid #EDE3D0" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontFamily: "'Jost',sans-serif" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: TONES[i % TONES.length], border: `1px solid ${COLORS.black}`, display: "inline-block" }} />
                  {e.name}
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>{e.units} ({((e.units / filtered.length) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 18 }}>
        <Eyebrow>Category Performance</Eyebrow>
        <table>
          <thead><tr><th>Category</th><th>Units</th><th>RS Puram</th><th>Aisle</th><th>Revenue</th><th>Gross Profit</th><th>Avg Ticket</th></tr></thead>
          <tbody>
            {byCategory.map(c => (
              <tr key={c.name}>
                <td style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500 }}>{c.name}</td>
                <td>{c.units}</td>
                <td>{c.s1 || 0}</td>
                <td>{c.s2 || 0}</td>
                <td>{inr(c.revenue)}</td>
                <td style={{ color: COLORS.black, fontWeight: 500 }}>{inr(c.grossProfit)}</td>
                <td>{inr(c.revenue / c.units)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card style={{ marginBottom: 18 }}>
        <Eyebrow>Gold Color Breakdown</Eyebrow>
        <table>
          <thead><tr><th>Gold Color</th><th>Units</th><th>Share</th><th>Revenue</th></tr></thead>
          <tbody>
            {byGoldColor.map(c => (
              <tr key={c.name}>
                <td style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500 }}>{c.name}</td>
                <td>{c.units}</td>
                <td>{((c.units / filtered.length) * 100).toFixed(0)}%</td>
                <td>{inr(c.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle sub="Custom orders are made to a customer's specification; In-Stock pieces are sold straight off the display. Averages are per calendar month across the sales currently shown above.">Custom Order vs In-Stock</SectionTitle>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KPI label="Avg Custom Orders / Month" value={orderTypeStats.avgCustomPerMonth.toFixed(1)} sub={`${orderTypeStats.custom} total custom order${orderTypeStats.custom !== 1 ? "s" : ""}`} accent />
        <KPI label="Avg In-Stock Sales / Month" value={orderTypeStats.avgInStockPerMonth.toFixed(1)} sub={`${orderTypeStats.instock} total in-stock sale${orderTypeStats.instock !== 1 ? "s" : ""}`} />
        <KPI label="Custom Order Share" value={`${((orderTypeStats.custom / filtered.length) * 100).toFixed(0)}%`} sub={`of ${filtered.length} sale${filtered.length !== 1 ? "s" : ""} shown`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <Card>
          <Eyebrow>Custom vs In-Stock Split</Eyebrow>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={orderTypeSplit} dataKey="units" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={85} paddingAngle={2}>
                {orderTypeSplit.map((e, i) => <Cell key={i} fill={TONES[i % TONES.length]} stroke={COLORS.black} strokeWidth={0.75} />)}
              </Pie>
              <Tooltip contentStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 8 }}>
            {orderTypeSplit.map((e, i) => (
              <div key={e.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 2px", borderBottom: i < orderTypeSplit.length - 1 ? "1px solid #EDE3D0" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontFamily: "'Jost',sans-serif" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: TONES[i % TONES.length], border: `1px solid ${COLORS.black}`, display: "inline-block" }} />
                  {e.name}
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>{e.units} ({filtered.length ? ((e.units / filtered.length) * 100).toFixed(0) : 0}%)</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Eyebrow>Custom Order % by Category</Eyebrow>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCategoryOrderType} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.beigeDeep} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fill: "#8A7C6B" }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontFamily: "'Jost',sans-serif", fontSize: 12, fill: "#8A7C6B" }} />
              <Tooltip formatter={v => `${v.toFixed(0)}%`} contentStyle={{ fontFamily: "'Jost',sans-serif", fontSize: 12, border: `1px solid ${COLORS.beigeDeep}`, borderRadius: 4 }} />
              <Bar dataKey="customPct" name="Custom Order %" fill={COLORS.burgundy} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <Eyebrow>Custom vs In-Stock by Category</Eyebrow>
        <table>
          <thead><tr><th>Category</th><th>Total Units</th><th>Custom Orders</th><th>In-Stock</th><th>% Custom</th><th>% In-Stock</th></tr></thead>
          <tbody>
            {byCategoryOrderType.map(c => (
              <tr key={c.name}>
                <td style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500 }}>{c.name}</td>
                <td>{c.total}</td>
                <td>{c.custom}</td>
                <td>{c.instock}</td>
                <td>{c.customPct.toFixed(0)}%</td>
                <td>{c.instockPct.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ================= OVERHEAD TAB ================= */
function OverheadTab({ overheads, onAdd, onRemove }) {
  const blank = { month: "", store: "s1", rent: "", electricity: "", maintenance: "", salaries: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.month) return;
    setSaving(true);
    await onAdd(form);
    setSaving(false);
    setForm(blank);
  };

  return (
    <div>
      <SectionTitle sub="Recurring monthly fixed costs, entered once per store per month. If you add another entry for the same store and month, amounts are added together — so it's fine to log rent and electricity separately.">Store Overheads</SectionTitle>

      <Card style={{ marginBottom: 22 }}>
        <Eyebrow>Add Monthly Overhead</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <div><Label>Month</Label><Input type="month" value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} /></div>
          <div><Label>Store</Label>
            <Select value={form.store} onChange={e => setForm({ ...form, store: e.target.value })}>
              {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div></div>
          <div><Label>Rent (₹)</Label><Input type="number" value={form.rent} onChange={e => setForm({ ...form, rent: e.target.value })} /></div>
          <div><Label>Electricity (₹)</Label><Input type="number" value={form.electricity} onChange={e => setForm({ ...form, electricity: e.target.value })} /></div>
          <div><Label>Maintenance (₹)</Label><Input type="number" value={form.maintenance} onChange={e => setForm({ ...form, maintenance: e.target.value })} /></div>
          <div><Label>Staff Salaries (₹, total)</Label><Input type="number" value={form.salaries} onChange={e => setForm({ ...form, salaries: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: 16 }}><Btn onClick={add}>{saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} Add Overhead Entry</Btn></div>
      </Card>

      <Card>
        <Eyebrow>{overheads.length} Overhead Entr{overheads.length !== 1 ? "ies" : "y"}</Eyebrow>
        {overheads.length === 0 ? <EmptyState title="No overhead entries yet" desc="Add rent, electricity, maintenance and salaries for each store, month by month." /> : (
          <table>
            <thead><tr><th>Month</th><th>Store</th><th>Rent</th><th>Electricity</th><th>Maintenance</th><th>Salaries</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {overheads.map(o => {
                const total = (parseFloat(o.rent) || 0) + (parseFloat(o.electricity) || 0) + (parseFloat(o.maintenance) || 0) + (parseFloat(o.salaries) || 0);
                return (
                  <tr key={o.id}>
                    <td>{monthLabel(o.month)}</td>
                    <td>{STORES.find(s => s.id === o.store)?.short}</td>
                    <td>{inr(o.rent)}</td>
                    <td>{inr(o.electricity)}</td>
                    <td>{inr(o.maintenance)}</td>
                    <td>{inr(o.salaries)}</td>
                    <td style={{ fontWeight: 500 }}>{inr(total)}</td>
                    <td><button onClick={() => onRemove(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.burgundyBright }}><Trash2 size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ================= EXPENSES TAB ================= */
const RECEIPTS_BUCKET = "receipts";

function ExpensesTab({ expenses, onAdd, onRemove }) {
  const blank = { date: "", store: "s1", category: EXPENSE_CATS[0], amount: "", note: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const onPickFile = (e) => {
    const file = e.target.files?.[0] || null;
    setUploadError(null);
    setReceiptFile(file);
  };

  const add = async () => {
    if (!form.date || !form.amount) return;
    setSaving(true);
    setUploadError(null);

    let receiptUrl = null;
    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop();
      const path = `${form.date || "undated"}/${uid()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, receiptFile, { cacheControl: "3600", upsert: false });
      if (upErr) {
        console.error("Receipt upload failed:", upErr.message);
        setUploadError(upErr.message);
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
      receiptUrl = pub?.publicUrl || null;
    }

    await onAdd({ ...form, receiptUrl });
    setSaving(false);
    setForm(blank);
    setReceiptFile(null);
  };

  return (
    <div>
      <SectionTitle sub="Petrol, refreshments, external repairs, parcel/courier and other day-to-day spends. Log each one as you send photos through and I'll tally them here.">Daily Expenses</SectionTitle>

      <Card style={{ marginBottom: 22 }}>
        <Eyebrow>Add a Daily Spend</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Store</Label>
            <Select value={form.store} onChange={e => setForm({ ...form, store: e.target.value })}>
              {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div><Label>Category</Label>
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div style={{ gridColumn: "1 / -1" }}><Label>Note (optional)</Label><Input placeholder="e.g. bike service, courier to customer" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Label>Receipt Photo (optional)</Label>
            <input
              type="file"
              accept="image/*"
              onChange={onPickFile}
              style={{ width: "100%", padding: "9px 0", fontFamily: "'Jost',sans-serif", fontSize: 13, color: COLORS.ink }}
            />
            {receiptFile && (
              <div style={{ marginTop: 6, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: COLORS.burgundy }}>
                Selected: {receiptFile.name}
              </div>
            )}
            {uploadError && (
              <div style={{ marginTop: 6, fontFamily: "'Jost',sans-serif", fontSize: 12, color: COLORS.burgundyBright }}>
                Upload failed: {uploadError}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 16 }}><Btn onClick={add}>{saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />} Add Expense</Btn></div>
      </Card>

      <Card>
        <Eyebrow>{expenses.length} Expense{expenses.length !== 1 ? "s" : ""} Logged</Eyebrow>
        {expenses.length === 0 ? <EmptyState title="No daily expenses yet" desc="As you send spend photos, log the date, store, category and amount here — the dashboard will flag any category that spikes month over month." /> : (
          <table>
            <thead><tr><th>Date</th><th>Store</th><th>Category</th><th>Amount</th><th>Note</th><th>Receipt</th><th></th></tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{STORES.find(s => s.id === e.store)?.short}</td>
                  <td>{e.category}</td>
                  <td>{inr(e.amount)}</td>
                  <td style={{ fontFamily: "'Jost',sans-serif" }}>{e.note}</td>
                  <td>
                    {e.receiptUrl ? (
                      <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.burgundy, fontFamily: "'Jost',sans-serif", fontWeight: 500 }}>
                        View
                      </a>
                    ) : (
                      <span style={{ color: "#B3A692" }}>—</span>
                    )}
                  </td>
                  <td><button onClick={() => onRemove(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.burgundyBright }}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ================= INSIGHTS TAB ================= */
function InsightsTab({ flags, totals, allMonths }) {
  if (allMonths.length === 0) {
    return <EmptyState title="Nothing to analyze yet" desc="Once sales, overheads and daily expenses are logged for at least one month, this tab will surface overspending patterns and margin risks automatically." />;
  }
  return (
    <div>
      <SectionTitle sub="Auto-generated from your logged data — refreshes as you add more entries.">Flags &amp; Insights</SectionTitle>
      <Card>
        {flags.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#8A7C6B", fontSize: 13.5 }}>No overspending patterns detected. Keep logging data for sharper insight over time.</div>
        ) : (
          <div>
            {flags.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 4px", borderBottom: i < flags.length - 1 ? `1px solid #EDE3D0` : "none" }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: f.level === "high" ? "#F4E0DD" : COLORS.beigeDeep, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={13} color={f.level === "high" ? COLORS.burgundyBright : COLORS.black} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: f.level === "high" ? COLORS.burgundyBright : COLORS.black, fontWeight: 600, marginBottom: 3 }}>
                    {f.level === "high" ? "Priority" : "Watch"}
                  </div>
                  <div style={{ fontSize: 13.5, color: COLORS.ink, lineHeight: 1.55 }}>{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 18 }}>
        <Eyebrow>How These Flags Are Generated</Eyebrow>
        <ul style={{ fontSize: 12.5, color: COLORS.ink, lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
          <li>Any daily-expense category rising more than 20% month-over-month, per store</li>
          <li>Electricity cost disproportionate between stores relative to their revenue</li>
          <li>Sales where the making rate charged fell below your ₹1,650/g floor</li>
          <li>Net profit dropping more than 15% month-over-month</li>
          <li>Overheads consuming over 80% of a store's gross profit in a given month</li>
          <li>Salary cost exceeding ~35% of revenue at a store (healthy benchmark: 20\u201325%)</li>
        </ul>
      </Card>
    </div>
  );
}