import type { Favorite } from './object-links.ts';

export type LinkService = { id: string; name: string; mark: string; kind: string; host: string };

/** Infer presentation only. Never follow a URL or fetch private page metadata. */
export function linkService(value: string): LinkService {
  let url: URL;
  try { url = new URL(value); } catch { return { id: 'web', name: 'Webリンク', mark: '↗', kind: '', host: '' }; }
  const host = url.hostname.toLowerCase(), path = url.pathname.toLowerCase();
  const at = (domain: string) => host === domain || host.endsWith('.' + domain);
  const service = (id: string, name: string, mark: string, kind = '') => ({ id, name, mark, kind, host });
  if (at('miro.com')) return service('miro', 'Miro', 'M', path.startsWith('/app/board/') ? 'ボード' : '');
  if (at('cacoo.com')) return service('cacoo', 'Cacoo', 'C', path.startsWith('/diagrams/') ? '図' : '');
  if (at('newrelic.com')) return service('newrelic', 'New Relic', 'N', path.includes('/dashboards') ? 'ダッシュボード' : path.startsWith('/logger') ? 'ログ' : '');
  if (at('atlassian.net')) {
    if (/^\/wiki(?:\/|$)/.test(path)) return service('confluence', 'Confluence', 'C', 'ページ');
    if (/^\/(jira|browse|projects|issues|secure|servicedesk)(?:\/|$)/.test(path)) return service('jira', 'Jira', 'J', path.startsWith('/browse/') ? '課題' : '');
    return service('atlassian', 'Atlassian', 'A');
  }
  if (at('figma.com')) return service('figma', 'Figma', 'F', /^\/(file|design)\//.test(path) ? 'デザイン' : '');
  if (at('github.com')) return service('github', 'GitHub', 'G');
  if (at('slack.com')) return service('slack', 'Slack', 'S');
  if (host === 'docs.google.com') {
    if (path.startsWith('/document/')) return service('google-docs', 'Google ドキュメント', 'D');
    if (path.startsWith('/spreadsheets/')) return service('google-sheets', 'Google スプレッドシート', 'S');
    if (path.startsWith('/presentation/')) return service('google-slides', 'Google スライド', 'P');
  }
  return service('web', host, '↗');
}

const normalized = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja');
export function filterFavorites(favorites: readonly Favorite[], query: string, serviceId = '', selected?: ReadonlySet<string>): Favorite[] {
  const terms = normalized(query).trim().split(/\s+/).filter(Boolean);
  return favorites.filter(favorite => {
    const service = linkService(favorite.url);
    const haystack = normalized(`${favorite.title} ${favorite.url} ${service.name} ${service.kind}`);
    return (!serviceId || service.id === serviceId) && (!selected || selected.has(favorite.id)) && terms.every(term => haystack.includes(term));
  });
}
