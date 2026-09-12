import {localSample} from '../scripts/local-sample.mjs';

export const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
export function isLocalRequest(request) {
  const url = new URL(request.url);
  if (!localHosts.has(url.hostname)) return false;
  const origin = request.headers.get('origin');
  return (!origin || origin === url.origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});
export function createLocalApi(now = new Date()) {
  let state = localSample(now), revision = 1;
  return async function handle(request) {
    if (!isLocalRequest(request)) return json({error: 'ループバックからのみ利用できます'}, 403);
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (path === '/api/schedule' && method === 'GET') {
      return json(url.searchParams.has('revisionOnly') ? {revision} : {state, revision, role: 'admin'});
    }
    if (path === '/api/slack-staff/approvals' && method === 'GET') return json({requests: [], linked: []});
    if (path === '/api/student-links' && method === 'GET') return json({active: false});
    if (path === '/api/line-links' && method === 'GET') return json({links: []});
    if (['/api/auth/logout', '/api/auth/slack/logout'].includes(path) && method === 'POST') return json({ok: true});
    if ((path === '/api/schedule' && method === 'PUT') || (path === '/api/lesson-note' && method === 'POST')) {
      let input;
      try { input = await request.json(); } catch { return json({error: 'JSONを確認してください'}, 400); }
      if (path === '/api/schedule') {
        if (input.revision !== revision) return json({error: '別の編集が保存されました'}, 409);
        const next = input.state;
        if (!next || !['slots', 'lessons', 'teachers', 'history'].every(key => Array.isArray(next[key])) || !next.availability || !next.duty) {
          return json({error: 'スケジュール形式が不正です'}, 400);
        }
        state = structuredClone(next);
      } else {
        const lesson = state.lessons.find(item => item.id === input.lessonId);
        if (!lesson) return json({error: '授業が見つかりません'}, 404);
        if (typeof input.note !== 'string' || input.note.length > 2000) return json({error: 'メモを確認してください'}, 400);
        if ((lesson.note || '') !== (input.previousNote || '')) return json({error: 'メモが更新されています', note: lesson.note}, 409);
        lesson.note = input.note;
      }
      return json({revision: ++revision});
    }
    return json({error: 'この操作はローカル検証の対象外です。外部接続は行いません。'}, 501);
  };
}
