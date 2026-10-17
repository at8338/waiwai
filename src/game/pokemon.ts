export const POKEMON = {
  pikachu: { name: 'ピカチュウ', icon: '⚡', description: '長い耳と赤いほっぺ。元気にとことこついてきます。', weight: 10, rarity: 'よく見かける', floating: false },
  eevee: { name: 'イーブイ', icon: '🦊', description: 'ふわふわのえりとしっぽ。散歩の行き先が気になる相棒。', weight: 10, rarity: 'よく見かける', floating: false },
  snorlax: { name: 'カビゴン', icon: '💤', description: 'のんびり、ゆったり。あなたのペースで一緒に歩こう。', weight: 3, rarity: 'めずらしい', floating: false },
  bulbasaur: { name: 'フシギダネ', icon: '🌱', description: '背中のたねと一緒に、オフィスの日なたを探しています。', weight: 8, rarity: 'よく見かける', floating: false },
  charmander: { name: 'ヒトカゲ', icon: '🔥', description: 'しっぽの小さな炎をゆらして、会議の行き先を考え中。', weight: 8, rarity: 'よく見かける', floating: false },
  squirtle: { name: 'ゼニガメ', icon: '💧', description: 'ぴかぴかのこうらで、今日ものんびりお散歩。', weight: 8, rarity: 'よく見かける', floating: false },
  jigglypuff: { name: 'プリン', icon: '🎵', description: 'まあるい体で、オフィスに小さなリズムを運びます。', weight: 5, rarity: 'ときどき見かける', floating: false },
  psyduck: { name: 'コダック', icon: '🦆', description: '次に何をするんだっけ。ちょっと立ち止まって考えています。', weight: 5, rarity: 'ときどき見かける', floating: false },
  gengar: { name: 'ゲンガー', icon: '👻', description: 'いたずら顔で、部屋のすみからひょっこり。', weight: 2, rarity: 'めずらしい', floating: false },
  mew: { name: 'ミュウ', icon: '✦', description: '長いしっぽをゆらして、ふわり。出会えた日はちょっと特別。', weight: 0.5, rarity: 'とてもめずらしい', floating: true },
} as const;
export const POKEMON_KINDS = Object.keys(POKEMON) as PokemonKind[];
export type PokemonKind = keyof typeof POKEMON;
export const MAX_DAILY_POKEMON = 7;
export const isPokemonKind = (kind: unknown): kind is PokemonKind => typeof kind === 'string' && Object.hasOwn(POKEMON, kind);
