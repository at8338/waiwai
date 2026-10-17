import { searchPeople } from './directory.ts';
import type { Person } from './directory.ts';
import { getRoom } from './rooms.ts';

export class PeopleDirectory {
  private people: Person[] = [];
  private connected = false;
  private localId?: string;
  private busy = false;
  private destinationName = '';
  private warning?: string;
  private dialog = document.querySelector<HTMLDialogElement>('#people-dialog')!;
  private query = document.querySelector<HTMLInputElement>('#people-query')!;
  private filter = document.querySelector<HTMLSelectElement>('#people-filter')!;
  private list = document.querySelector<HTMLUListElement>('#people-results')!;

  constructor(options: { signal: AbortSignal; open: () => void; warp: (id: string) => boolean }) {
    const { signal } = options;
    document.querySelector('#people-open')!.addEventListener('click', () => {
      options.open(); this.render(); this.dialog.showModal(); this.query.focus();
    }, { signal });
    this.query.addEventListener('input', () => this.render(), { signal });
    this.filter.addEventListener('change', () => this.render(), { signal });
    document.querySelector('#people-close')!.addEventListener('click', () => this.dialog.close(), { signal });
    this.list.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-warp-person]');
      const person = this.people.find((p) => p.id === button?.dataset.warpPerson);
      if (!person?.online || !person.playerId || this.busy || !this.connected || person.playerId === this.localId) return;
      if (!options.warp(person.playerId)) { this.fail('接続を確認してから、もう一度試してください。'); return; }
      this.destinationName = person.name; this.busy = true;
      this.status(`${person.name}さんの隣へワープしています…`); this.render();
    }, { signal });
    this.render();
  }
  setPeople(people: Person[], warning?: string): void { this.people = people; this.warning = warning; this.render(); }
  setConnection(connected: boolean, localId?: string): void {
    this.connected = connected; this.localId = localId;
    if (!connected) { this.busy = false; this.status('接続を確認しています。状態が更新されるまでワープできません。'); }
    else if (!this.busy) this.status('オンラインの人の「隣へワープ」で会いに行けます。');
    this.render();
  }
  complete(): void {
    this.busy = false;
    document.querySelector('#people-travel-status')!.textContent = `${this.destinationName}さんの隣へ移動しました。`;
    this.status('移動しました。'); this.dialog.close(); this.render();
  }
  fail(error: string): void { this.busy = false; this.status(error); this.render(); }
  private status(text: string): void { document.querySelector('#people-status')!.textContent = text; }
  private render(): void {
    const results = searchPeople(this.people, this.query.value, this.filter.value as 'all' | 'online' | 'offline');
    const focusId = (document.activeElement as HTMLElement | null)?.dataset.warpPerson;
    this.list.replaceChildren();
    for (const person of results) {
      const item = document.createElement('li'); item.dataset.personId = person.id;
      const info = document.createElement('div'); info.className = 'person-info';
      const name = document.createElement('strong'); name.textContent = person.name + (person.playerId === this.localId ? '（あなた）' : '');
      const detail = document.createElement('span');
      detail.textContent = !this.connected ? '接続状態を確認中' : person.online && person.roomId ? getRoom(person.roomId).name : '現在は入室していません';
      const identity = document.createElement('small'); identity.textContent = person.verified ? person.slack ? `Slackメンバー · ${person.slack.userId}` : 'Microsoftログイン済み' : 'ゲスト';
      info.append(name, detail, identity);
      const presence = document.createElement('span'); presence.className = 'person-presence';
      presence.dataset.online = String(this.connected && person.online);
      presence.textContent = !this.connected ? '確認中' : person.online ? 'オンライン' : 'オフライン';
      const warp = document.createElement('button'); warp.type = 'button'; warp.dataset.warpPerson = person.id;
      warp.textContent = person.playerId === this.localId ? 'あなた' : '隣へワープ';
      warp.setAttribute('aria-label', `${person.name}さんの隣へワープ`);
      warp.disabled = !this.connected || !person.online || !person.playerId || person.playerId === this.localId || this.busy;
      item.append(info, presence, warp); this.list.append(item);
      if (focusId === person.id) warp.focus({ preventScroll: true });
    }
    document.querySelector('#people-result-count')!.textContent = !this.connected ? '接続を確認中' : `${results.length}人 · オンライン ${this.people.filter((p) => p.online).length}人 / 全${this.people.length}人`;
    document.querySelector('#people-empty')!.textContent = !this.connected ? 'サーバーへの接続後に検索できます。' : this.people.length ? '条件に合う人が見つかりません。' : 'まだメンバーがいません。ログインして入室すると記録されます。';
    (document.querySelector('#people-empty') as HTMLElement).hidden = results.length > 0;
    document.querySelector('#people-warning')!.textContent = this.warning ?? '';
  }
}
