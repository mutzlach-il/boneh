// בונה מערכות – Edge Function אחת לצ'אט, לפניות ולמונה המבקרים.
// המפתחות נשמרים כ-Secrets ב-Supabase ולא מופיעים בדף:
//   GROQ_API_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY
//   (אופציונלי) GROQ_MODEL, ALLOWED_ORIGIN
// SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY קיימים אוטומטית.

import { createClient } from "npm:@supabase/supabase-js@2";

function serverKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return keys.default ?? Object.values(keys)[0] as string;
  } catch { return ""; }
}
const db = createClient(Deno.env.get("SUPABASE_URL")!, serverKey(), { auth: { persistSession: false } });
const ALLOWED = (Deno.env.get("ALLOWED_ORIGIN") ?? "https://mutzlach-il.github.io").split(",").map((s) => s.trim());
const MODEL = Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile";

const SYSTEM = `אתה נציג המענה באתר "בונה מערכות" – העסק של אברהם, בונה מערכות עצמאי מבני ברק.
אתה כותב רק בעברית, בשפה פשוטה, חמה ומכבדת, בתשובות קצרות (עד 3–4 משפטים). לא משתמש באימוג'ים.

מה העסק עושה (רק במילים כלליות):
- מערכות ניהול לעסקים, למוסדות, לגמ"חים ולארגונים: לקוחות, תשלומים, תרומות, הלוואות, הפקדות, חיסכון.
- אתרים ודפי נחיתה. אפליקציות שמותקנות בטלפון ובמחשב, חלקן עובדות גם בלי אינטרנט.
- מערכות טלפוניות לטלפון כשר: קווים חכמים, הודעות, תזכורות ועדכונים.
- אוטומציות: מענה אוטומטי למיילים, דוחות, גיבויים, העברת מידע בין מערכות.
- תמלול שיעורים והקלטות (מערכת "דברי קודש": divrei-kodesh.github.io).
- שעות, נוכחות וחישובי שכר. ניהול פניות וקבלת קהל. מעקב תשלומים, תזכורות וקבלות.
- וכל מערכת אחרת לפי הזמנה: "יש לך רעיון? אני בונה לך אותו."
יתרונות: מכיר את הציבור החרדי (תאריכים עבריים, סגירה בשבת, נטפרי, טלפון כשר), איש קשר אחד שגם בונה, מחיר שסוכם מראש, פרטיות ואבטחה והרשאות, מערכת עם השם והעיצוב של הלקוח, הוראות וליווי, עלויות שוטפות נמוכות. כשנתיים בתחום, עשרות מערכות.
תהליך: שיחה ← אפיון ← בנייה ← מסירה וליווי.
טלפון: 053-313-6394. מייל: bnyytmrkwt@gmail.com.

כללים מחייבים:
- לעולם אל תציין מחיר, טווח מחירים או זמן אספקה מדויק. על מחיר תאמר: "כל מערכת נבנית לפי מידה, ואברהם יחזור אליך עם הצעה מסודרת."
- אל תבטיח דברים בשם אברהם, ואל תמציא לקוחות, המלצות, פרויקטים או נתונים.
- אל תזכיר שמות של לקוחות או מוסדות.
- אל תשתמש במילים "AI", "בינה מלאכותית", "צ'אט GPT" או דומות. אם שואלים מי אתה – "אני מערכת המענה של בונה מערכות, ואברהם עצמו יחזור אליך."
- ענה רק על נושאים שקשורים לעסק. על כל נושא אחר (הלכה, פוליטיקה, חדשות, תרבות, רפואה וכו') תאמר בנימוס שאתה כאן רק כדי לעזור בנושא מערכות ואתרים, ותחזיר לנושא.
- שמור על שפה נקייה ומתאימה לציבור החרדי.

המטרה שלך: להבין מה המבקר צריך, ולאסוף ממנו שלושה פרטים: שם, טלפון או מייל, ותיאור קצר של מה שהוא צריך. שאל אותם בצורה טבעית, פרט אחד או שניים בכל פעם, אחרי שהבנת את הצורך.
כשיש לך את שלושת הפרטים, הודה לו ואמור שאברהם יחזור אליו בהקדם, ובסוף ההודעה הוסף שורה נפרדת בדיוק בפורמט הזה (המבקר לא יראה אותה):
<<LEAD>>{"name":"...","contact":"...","need":"..."}<<END>>
הוסף את השורה הזאת רק פעם אחת בשיחה.`;

function cors(origin: string | null) {
  const ok = origin && (ALLOWED.includes(origin) || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// הגבלת קצב פשוטה לכל כתובת
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}

async function notify(lead: { name: string; contact: string; need: string; source: string }) {
  const service_id = Deno.env.get("EMAILJS_SERVICE_ID");
  if (!service_id) return;
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id,
        template_id: Deno.env.get("EMAILJS_TEMPLATE_ID"),
        user_id: Deno.env.get("EMAILJS_PUBLIC_KEY"),
        accessToken: Deno.env.get("EMAILJS_PRIVATE_KEY"),
        template_params: {
          subject: `פנייה חדשה מהאתר (${lead.source}): ${lead.name}`,
          name: lead.name,
          contact: lead.contact,
          need: lead.need,
          source: lead.source,
          time: new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
        },
      }),
    });
  } catch (_) { /* הפנייה כבר נשמרה בטבלה */ }
}

async function saveLead(l: { name: string; contact: string; need: string; source: string; session?: string }) {
  const { error } = await db.from("leads").insert(l);
  if (error) throw error;
  await notify(l);
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "x";
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  try {
    if (body.action === "visit") {
      if (limited("v" + ip, 20, 3600_000)) return json({ ok: true });
      await db.from("visits").upsert(
        { visitor: clip(body.visitor, 64), page: clip(body.page, 120), ref: clip(body.ref, 200) },
        { onConflict: "day,visitor", ignoreDuplicates: true },
      );
      return json({ ok: true });
    }

    if (body.action === "lead") {
      if (limited("l" + ip, 5, 3600_000)) return json({ error: "rate" }, 429);
      const lead = { name: clip(body.name, 80), contact: clip(body.contact, 120), need: clip(body.need, 2000), source: "טופס" };
      if (!lead.name || !lead.contact || !lead.need) return json({ error: "missing" }, 400);
      await saveLead(lead);
      return json({ ok: true });
    }

    if (body.action === "chat") {
      if (limited("c" + ip, 40, 3600_000)) {
        return json({ reply: "קיבלתי הרבה הודעות ברצף. אפשר להתקשר ל-053-313-6394 או להשאיר פרטים בטופס, ואברהם יחזור אליך." });
      }
      const session = clip(body.session, 64) || "na";
      const msgs = (Array.isArray(body.messages) ? body.messages : [])
        .slice(-16)
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
        .map((m: any) => ({ role: m.role, content: clip(m.content, 800) }));
      if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "bad" }, 400);

      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}` },
        body: JSON.stringify({ model: MODEL, temperature: 0.4, max_tokens: 400, messages: [{ role: "system", content: SYSTEM }, ...msgs] }),
      });
      if (!r.ok) throw new Error("groq " + r.status + " " + (await r.text()).slice(0, 200));
      const data = await r.json();
      let reply: string = data.choices?.[0]?.message?.content ?? "";

      const m = reply.match(/<<LEAD>>([\s\S]*?)<<END>>/);
      reply = reply.replace(/<<LEAD>>[\s\S]*?<<END>>/g, "").trim();
      if (m) {
        try {
          const l = JSON.parse(m[1]);
          const lead = { name: clip(l.name, 80), contact: clip(l.contact, 120), need: clip(l.need, 2000), source: "צ'אט", session };
          if (lead.name && lead.contact && lead.need) {
            const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("session", session);
            if (!count) await saveLead(lead);
          }
        } catch (_) { /* ignore */ }
      }
      if (!reply) reply = "תודה! אברהם יחזור אליך בהקדם.";

      await db.from("chat_messages").insert([
        { session, role: "user", content: msgs[msgs.length - 1].content },
        { session, role: "assistant", content: reply },
      ]);
      return json({ reply });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server", detail: String((e as any)?.message ?? e).replace(/gsk_[A-Za-z0-9]+/g, "***").slice(0, 300) }, 500);
  }
});
