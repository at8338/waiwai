import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterFavorites, linkService } from './link-services.ts';

test('tool detection uses host boundaries and Atlassian product paths without guessing page titles', () => {
  for (const [url, id, kind] of [
    ['https://miro.com/app/board/uXtest=/', 'miro', 'ボード'],
    ['https://cacoo.com/diagrams/test/40', 'cacoo', '図'],
    ['https://one.newrelic.com/dashboards/detail/test', 'newrelic', 'ダッシュボード'],
    ['https://one.newrelic.com/logger?account=123', 'newrelic', 'ログ'],
    ['https://team.atlassian.net/wiki/spaces/TEAM/pages/1', 'confluence', 'ページ'],
    ['https://team.atlassian.net/browse/TEAM-1', 'jira', '課題'],
    ['https://team.atlassian.net/jira/software/projects/TEAM/boards/1', 'jira', ''],
    ['https://team.atlassian.net/', 'atlassian', ''],
    ['https://docs.google.com/spreadsheets/d/test/edit', 'google-sheets', ''],
    ['https://miro.com.evil.test/app/board/1', 'web', ''],
    ['https://notmiro.com/app/board/1', 'web', ''],
    ['https://example.com/?next=https://miro.com', 'web', ''],
    ['https://custom.example.test/wiki/pages/1', 'web', ''],
  ]) {
    const service = linkService(url);
    assert.equal(service.id, id, url); assert.equal(service.kind, kind, url);
  }
  assert.equal(linkService('not a URL').name, 'Webリンク');
  assert.equal(linkService('https://custom.example.test/path').name, 'custom.example.test');
});

test('100 favorites can be searched by tool, name, document kind and URL while retaining selection across filters', () => {
  const favorites = Array.from({ length: 100 }, (_, index) => ({ id: String(index), title: `構成図 ${index}`, url: `https://miro.com/app/board/${index}` }));
  favorites[50] = { id: '50', title: 'リリース手順書', url: 'https://team.atlassian.net/wiki/spaces/OPS/pages/50' };
  const selected = new Set(['0', '50']);
  assert.equal(filterFavorites(favorites, '').length, 100);
  assert.equal(filterFavorites(favorites, 'ｍｉｒｏ ボード').length, 99);
  assert.deepEqual(filterFavorites(favorites, 'Confluence 手順').map(f => f.id), ['50']);
  assert.deepEqual(filterFavorites(favorites, 'pages/50').map(f => f.id), ['50']);
  assert.deepEqual(filterFavorites(favorites, '', 'confluence', selected).map(f => f.id), ['50']);
  assert.equal(filterFavorites(favorites, '存在しない資料').length, 0);
  assert.deepEqual([...selected], ['0', '50']);
});
