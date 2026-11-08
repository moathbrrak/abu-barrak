// يفك رابط قوقل ماب (مختصر أو طويل) ويطلع منه الأماكن، ويطبع النتيجة JSON
// الاستخدام: node tools/resolve.mjs "<url>"
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const H = { 'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8' };

async function expand(u) {
  let cur = u;
  for (let i = 0; i < 10; i++) {
    const r = await fetch(cur, { redirect: 'manual', headers: H });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      cur = new URL(loc, cur).href;
      // صفحة الموافقة على الكوكيز: الرابط الحقيقي داخل continue
      try { const c = new URL(cur).searchParams.get('continue'); if (/consent\./.test(cur) && c) cur = c; } catch {}
      continue;
    }
    return { final: cur, html: await r.text() };
  }
  return { final: cur, html: '' };
}

function listId(s) {
  return (s.match(/placelists\/list\/([\w-]{10,})/) || s.match(/!11m1!2s([\w-]{10,})/) || [])[1] || null;
}

async function getList(id) {
  const pbs = [
    `!1m4!1s${id}!2e1!3m1!1e1!2e2!3e2!4i500!16b1`,
    `!1m4!1s${id}!2e1!3m1!1e1!2e2!3e2!4i500`,
    `!1m1!1s${id}!2e2!3e2!4i500`,
  ];
  for (const pb of pbs) {
    try {
      const r = await fetch(`https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=ar&gl=sa&pb=${pb}`, { headers: H });
      const t = await r.text();
      const j = JSON.parse(t.replace(/^\)\]\}'\s*/, ''));
      const root = j[0];
      const items = (root[8] || []).map(it => {
        const g = it[1] || [], c = g[5] || [];
        return { name: it[2] || g[2] || '', note: it[3] || '', lat: c[2], lng: c[3] };
      }).filter(x => typeof x.lat === 'number' && typeof x.lng === 'number');
      if (items.length) return { name: root[4] || 'قائمة من قوقل', items };
    } catch {}
  }
  return null;
}

const url = process.argv[2] || '';
const out = { ok: false, src: url };
try {
  if (!/^https:\/\/([\w-]+\.)*(goo\.gl|google\.[a-z.]+|maps\.app\.goo\.gl)\//.test(url)) throw new Error('not a google maps url');
  const { final, html } = await expand(url);
  out.final = final;
  const id = listId(final) || listId(html);
  if (id) { out.list = await getList(id); out.ok = !!out.list; }
  else out.ok = true; // مسار أو مكان: التطبيق يقرأ الرابط الطويل بنفسه
} catch (e) { out.error = String(e.message || e); }
process.stdout.write(JSON.stringify(out));
