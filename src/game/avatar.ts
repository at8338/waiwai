export type Appearance = {
  gender: number; body: number; height: number; skin: number; hair: number;
  hairColor: number; clothing: number; color: number; accessory: number;
};
export const AVATAR_OPTIONS = {
  gender: { label: '性別・表現', choices: ['中性的', '男性タイプ', '女性タイプ'] },
  body: { label: '体型', choices: ['スリム', 'ふつう', 'ふっくら'] },
  height: { label: '身長', choices: ['小柄', 'ふつう', '高め'] },
  skin: { label: '肌の色', choices: ['アイボリー', 'ピーチ', 'サンド', 'ハニー', 'ブラウン', 'ディープ'] },
  hair: { label: '髪型', choices: ['ショート', 'ボブ', 'ロング', 'カーリー', '坊主・スキンヘッド'] },
  hairColor: { label: '髪の色', choices: ['ブラウン', 'ブラック', 'ブロンド', 'シルバー', 'ラベンダー'] },
  clothing: { label: '服装', choices: ['シャツ', 'ジャケット', 'ワンピース', 'パーカー'] },
  color: { label: '服の色', choices: ['グリーン', 'テラコッタ', 'ブルー', 'マスタード', 'ラベンダー', 'アイボリー'] },
  accessory: { label: 'アクセサリー', choices: ['なし', 'めがね', 'キャップ', 'ヘッドホン'] },
} as const;
export const DEFAULT_APPEARANCE: Appearance = { gender: 0, body: 1, height: 1, skin: 1, hair: 0, hairColor: 0, clothing: 0, color: 0, accessory: 0 };
export const SHIRTS = [0x668d77, 0xc17b5e, 0x698aab, 0xc5a34e, 0x9b83b5, 0xe5ddc1];
const SKINS = [0xffdfbd, 0xf2cba2, 0xdcb18a, 0xc38d60, 0x966443, 0x65432f];
const HAIR = [0x624632, 0x333536, 0xccab60, 0xb8b9b5, 0x9d83a7];
export function parseAppearance(value: unknown, outfit = 0): Appearance | undefined {
  if (value === undefined) return { ...DEFAULT_APPEARANCE, color: outfit };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const result = {} as Appearance;
  for (const key of Object.keys(AVATAR_OPTIONS) as Array<keyof Appearance>) {
    const n = (value as Record<string, unknown>)[key];
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) >= AVATAR_OPTIONS[key].choices.length) return;
    result[key] = n as number;
  }
  return result;
}
export const appearanceKey = (a: Appearance) => (Object.keys(AVATAR_OPTIONS) as Array<keyof Appearance>).map((k) => a[k]).join('');
export type Pixel = { color: number; x: number; y: number; w: number; h: number };
export function avatarPixels(a: Appearance, direction = 'down', frame = 0): Pixel[] {
  const pixels: Pixel[] = [];
  const p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  const skin = SKINS[a.skin], hair = HAIR[a.hairColor], shirt = SHIRTS[a.color];
  const width = 8 + a.body * 2, left = 10 - width / 2, top = 14 - a.height;
  const bob = frame ? -1 : 0, foot = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  p(0x3f4239, 6, 24 + foot, 3, 3); p(0x3f4239, 11, 24 - foot, 3, 3);
  p(0x59686c, 6, 20, 8, 5);
  p(shirt, left, top + bob, width, 10 + a.height);
  if (a.clothing === 1) {
    p(0xf2ebd5, 8, top + bob, 4, 9); p(0x485b50, left, top + bob + 2, 2, 7);
    p(0xc5ae77, 10, top + bob + 3, 1, 5);
  } else if (a.clothing === 2) {
    p(shirt, left - 1, top + bob + 6, width + 2, 6);
    p(0xf2dfb5, left, top + bob + 6, width, 1);
  } else if (a.clothing === 3) {
    p(0xe4dfc9, 8, top + bob, 1, 4); p(0xe4dfc9, 11, top + bob, 1, 4);
    p(0x4f665c, 8, top + bob + 6, 4, 2);
  }
  p(skin, left - 1, top + bob + 2, 2, 5); p(skin, left + width - 1, top + bob + 2, 2, 5);
  const head = top - 8 + bob;
  p(skin, 6, head, 8, 8);
  if (a.gender === 1) p(skin, 5, head + 4, 10, 3);
  if (a.gender === 2) { p(0xce9478, 6, head + 6, 1, 1); p(0xce9478, 13, head + 6, 1, 1); }
  if (a.hair !== 4) {
    p(hair, 5, head - 2, 10, 4); p(hair, 6, head - 3, 8, 2);
    p(hair, 5, head + 1, 2, a.hair === 2 ? 11 : a.hair === 1 ? 7 : 3);
    p(hair, 13, head + 1, 2, a.hair === 2 ? 11 : a.hair === 1 ? 7 : 3);
    if (a.hair === 3) { p(hair, 4, head - 1, 2, 5); p(hair, 14, head - 1, 2, 5); p(hair, 7, head - 3, 3, 2); }
  }
  if (direction === 'up') {
    if (a.hair !== 4) p(hair, 6, head, 8, a.hair === 2 ? 11 : 7);
  } else if (direction === 'down') {
    p(0x34352f, 7, head + 3, 1, 2); p(0x34352f, 12, head + 3, 1, 2);
    p(0xc48b73, 9, head + 6, 2, 1);
    if (a.accessory === 1) { p(0x374b4c, 6, head + 2, 4, 3); p(0x374b4c, 11, head + 2, 4, 3); p(0xa8c8bd, 7, head + 3, 2, 1); p(0xa8c8bd, 12, head + 3, 2, 1); p(0x374b4c, 10, head + 3, 1, 1); }
  } else {
    const l = direction === 'left';
    if (a.hair !== 4) p(hair, l ? 12 : 5, head + 1, 3, 6);
    p(0x34352f, l ? 6 : 13, head + 3, 1, 2); p(skin, l ? 5 : 14, head + 5, 1, 2);
    if (a.accessory === 1) p(0x374b4c, l ? 5 : 12, head + 2, 3, 3);
  }
  if (a.accessory === 2) { p(shirt, 5, head - 3, 10, 4); p(shirt, direction === 'left' ? 2 : 6, head, 12, 1); }
  if (a.accessory === 3) { p(0x374b4c, 5, head - 3, 10, 1); p(0x374b4c, 4, head, 2, 5); p(0x374b4c, 14, head, 2, 5); }
  return pixels;
}
