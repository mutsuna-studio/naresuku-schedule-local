import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalApi} from '../local/api.mjs';
const request = (path = '/api/schedule', method = 'GET', body, headers = {}) => new Request('http://127.0.0.1:5173' + path, {method, headers, ...(body ? {body: JSON.stringify(body)} : {})});
test('sample state saves in memory with conflict detection and resets in a new process', async () => {
  const api = createLocalApi(), original = await (await api(request())).json();
  original.state.students[0].name = '検証変更';
  assert.equal((await api(request('/api/schedule', 'PUT', original))).status, 200);
  assert.equal((await (await api(request())).json()).state.students[0].name, '検証変更');
  assert.equal((await api(request('/api/schedule', 'PUT', original))).status, 409);
  assert.notEqual((await (await createLocalApi()(request())).json()).state.students[0].name, '検証変更');
});
test('rejects non-local hosts, cross-origin writes and all external integration routes', async () => {
  const api = createLocalApi();
  assert.equal((await api(new Request('https://example.invalid/api/schedule'))).status, 403);
  assert.equal((await api(request('/api/schedule', 'GET', undefined, {Origin: 'https://example.invalid'}))).status, 403);
  for (const path of ['/api/line/webhook', '/api/slack-notifications', '/api/auth/slack/start', '/api/attendance/records']) {
    assert.equal((await api(request(path, 'POST', {}))).status, 501);
  }
});
test('lesson notes detect competing edits without overwriting', async () => {
  const api = createLocalApi(), {state} = await (await api(request())).json();
  const lesson = state.lessons[0], input = {lessonId: lesson.id, previousNote: lesson.note, note: '検証メモ'};
  assert.equal((await api(request('/api/lesson-note', 'POST', input))).status, 200);
  assert.equal((await api(request('/api/lesson-note', 'POST', input))).status, 409);
});
test('rejects malformed state without replacing existing data', async () => {
  const api = createLocalApi();
  assert.equal((await api(request('/api/schedule', 'PUT', {revision: 1, state: {}}))).status, 400);
  assert.equal((await (await api(request())).json()).revision, 1);
});
