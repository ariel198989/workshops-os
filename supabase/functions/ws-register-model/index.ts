// ws-register-model: the workshops' Colab trainer posts the trained tfjs model here.
// The model always belongs to a job in ws_training_jobs: group, workshop and owner come from the job,
// never from the request. The ZIP goes to the bucket ws-models, the row to ws_models.
// scope: 'personal' when the workshop runs personal pools and the requester is an active member of
// the group (a student's own model); otherwise 'group' (a facilitator's merged model, or any model
// of a group-pool workshop).
// Secret-gated with WS_TRAIN_SECRET. FAILS CLOSED when it is not configured.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('WS_TRAIN_SECRET') ?? '';
const MODELS = 'ws-models';
const MEDIA = 'ws-media';
const MAX_BYTES = 200 * 1024 * 1024;
const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-train-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** ZIP local-file-header signature at byte 0 and a 'model.json' entry name somewhere in the archive. */
function looksLikeTfjsZip(buf: Uint8Array): boolean {
  if (buf.length < 1000) return false;
  if (!(buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)) return false;
  const needle = new TextEncoder().encode('model.json');
  outer: for (let i = 0; i + needle.length <= buf.length; i++) {
    for (let j = 0; j < needle.length; j++) if (buf[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = +String(v);
  return Number.isFinite(n) ? n : null;
};

async function scopeOf(job: { workshop_id: string; group_id: string; requested_by: string | null }): Promise<'personal' | 'group'> {
  if (!job.requested_by) return 'group';
  const { data: w } = await admin.from('ws_workshops').select('pool_scope').eq('id', job.workshop_id).maybeSingle();
  if ((w?.pool_scope ?? 'personal') !== 'personal') return 'group';
  const { data: p } = await admin.from('ws_participants').select('id')
    .eq('group_id', job.group_id).eq('user_id', job.requested_by).eq('status', 'active').limit(1);
  return p && p.length ? 'personal' : 'group';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!SECRET || SECRET.length < 16) return json({ error: 'trainer secret not configured' }, 503);
  // reject oversized bodies and wrong header secrets before the multipart body is read into memory
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_BYTES + 1024 * 1024) return json({ error: 'zip too large' }, 413);
  const headerSecret = req.headers.get('x-train-secret');
  if (headerSecret !== null && !timingSafeEqual(headerSecret, SECRET)) return json({ error: 'bad secret' }, 401);
  try {
    const form = await req.formData();
    if (!timingSafeEqual(String(form.get('secret') || ''), SECRET)) return json({ error: 'bad secret' }, 401);
    const jobId = String(form.get('job_id') || '');
    if (!jobId) return json({ error: 'job_id required' }, 400);
    const file = form.get('file');
    if (!(file instanceof File)) return json({ error: 'no file' }, 400);
    if (file.size > MAX_BYTES) return json({ error: 'zip too large' }, 413);
    const buf = new Uint8Array(await file.arrayBuffer());
    if (!looksLikeTfjsZip(buf)) return json({ error: 'הקובץ אינו מודל tfjs תקין (אין model.json)' }, 422);

    const { data: job } = await admin.from('ws_training_jobs')
      .select('id, status, workshop_id, group_id, team_name, requested_by, pool_zip_path, classes, image_count')
      .eq('id', jobId).maybeSingle();
    if (!job) return json({ error: 'job not found' }, 404);
    if (!['pending', 'running'].includes(job.status)) return json({ error: 'job is not active' }, 409);

    const accuracy = num(form.get('accuracy'));
    const icRaw = num(form.get('image_count'));
    const image_count = icRaw === null ? job.image_count : Math.round(icRaw);
    const honest_val = String(form.get('honest_val') || '') === 'true';
    let classes: string[] = [];
    try { classes = JSON.parse(String(form.get('classes') || '[]')); } catch { /* keep [] */ }
    if (!Array.isArray(classes) || !classes.length) classes = Array.isArray(job.classes) ? job.classes : [];
    classes = classes.filter((c) => typeof c === 'string').slice(0, 50);
    let class_stats: unknown = null;
    try {
      const cs = JSON.parse(String(form.get('class_stats') || 'null'));
      if (Array.isArray(cs)) {
        class_stats = cs.slice(0, 50).map((r: Record<string, unknown>) => ({
          name: String(r?.name ?? ''),
          ap50: num(r?.ap50),
          boxes: num(r?.boxes),
        })).filter((r: { name: string }) => r.name);
      }
    } catch { /* keep null */ }

    const scope = await scopeOf(job);
    const stamp = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const path = `${job.group_id}/m_${stamp}.zip`;
    const up = await admin.storage.from(MODELS).upload(path, buf, { contentType: 'application/zip', upsert: false });
    if (up.error) return json({ error: 'storage: ' + up.error.message }, 500);

    const name = (scope === 'group' ? `מודל הקבוצה · ${job.team_name}` : `מודל · ${job.team_name}`).slice(0, 80);
    const { data: model, error: insErr } = await admin.from('ws_models')
      .insert({ group_id: job.group_id, team_name: job.team_name, owner: job.requested_by, name, classes,
                zip_path: path, approved: true, accuracy, image_count, honest_val, class_stats, scope })
      .select().single();
    if (insErr) {
      await admin.storage.from(MODELS).remove([path]).catch(() => null);
      return json({ error: 'insert: ' + insErr.message }, 500);
    }

    const { data: closed, error: updErr } = await admin.from('ws_training_jobs')
      .update({ status: 'done', result_model_id: model.id, completed_at: new Date().toISOString(), pool_zip_path: null })
      .eq('id', jobId).in('status', ['pending', 'running']).select('id');
    if (updErr || !closed || !closed.length) {
      // the job was cancelled or failed while the trainer uploaded: keep no orphan model
      await admin.from('ws_models').delete().eq('id', model.id);
      await admin.storage.from(MODELS).remove([path]).catch(() => null);
      return json({ error: updErr ? 'job update: ' + updErr.message : 'job is no longer active' }, 409);
    }
    if (job.pool_zip_path) await admin.storage.from(MEDIA).remove([job.pool_zip_path]).catch(() => null);

    // GC: dataset ZIPs of finished jobs older than a day
    try {
      const { data: stale } = await admin.from('ws_training_jobs')
        .select('id, pool_zip_path').in('status', ['done', 'cancelled', 'failed']).not('pool_zip_path', 'is', null)
        .lt('created_at', new Date(Date.now() - 864e5).toISOString()).limit(20);
      const paths = (stale || []).map((s: { pool_zip_path: string | null }) => s.pool_zip_path).filter(Boolean) as string[];
      if (paths.length) {
        await admin.storage.from(MEDIA).remove(paths).catch(() => null);
        await admin.from('ws_training_jobs').update({ pool_zip_path: null })
          .in('id', (stale || []).map((s: { id: string }) => s.id));
      }
    } catch { /* GC best-effort */ }
    return json({ ok: true, model_id: model.id, name, scope, classes, accuracy, image_count, honest_val, class_stats, path });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
