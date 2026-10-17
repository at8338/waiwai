"""Build all 1,025 national species and three officially announced 2026 species.

Python + Pillow are build-time tools only. Runtime uses local compact run data.
Species, default-form heights and art inputs are pinned; announced species have
no invented national number. Re-run to reproduce both thumbnail and map views.
"""
import csv
import hashlib
import io
import json
import os
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(os.environ.get('WAIWAI_POKEMON_CACHE', '/private/tmp/waiwai-pokemon-300'))
DATA_REV = '5ee47a9a9c1229632ec4b473a9c1c53026e005dd'
ART_REV = '289e842364648ec0495ae4ba12f48d5cbfbf670b'
NATIONAL_COUNT = 1025
CACHE.mkdir(parents=True, exist_ok=True)


def fetch(repo, revision, path, optional=False):
    dest = CACHE / revision / path
    missing = dest.with_suffix(dest.suffix + '.missing')
    if dest.exists():
        return dest.read_bytes()
    if optional and missing.exists():
        return None
    url = f'https://raw.githubusercontent.com/PokeAPI/{repo}/{revision}/{path}'
    for attempt in range(4):
        try:
            raw = urllib.request.urlopen(url, timeout=30).read()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(raw)
            return raw
        except urllib.error.HTTPError as error:
            if error.code == 404 and optional:
                missing.parent.mkdir(parents=True, exist_ok=True)
                missing.write_text('404\n')
                return None
            if error.code == 404 or attempt == 3:
                raise
        except Exception:
            if attempt == 3:
                raise
        time.sleep(1 + attempt * 2)


def rows(name):
    return list(csv.DictReader(io.StringIO(fetch('pokeapi', DATA_REV, f'data/v2/csv/{name}.csv').decode('utf-8'))))


def map_size(height_dm):
    # A bounded visual scale: the largest fits ~6 tiles, never the whole room.
    for limit, size in [(8, 20), (15, 24), (25, 32), (40, 40), (70, 56), (110, 72)]:
        if height_dm < limit:
            return size
    return 88


species = {int(r['id']): r for r in rows('pokemon_species') if int(r['id']) <= NATIONAL_COUNT}
names = {int(r['pokemon_species_id']): r for r in rows('pokemon_species_names') if r['local_language_id'] == '1' and int(r['pokemon_species_id']) <= NATIONAL_COUNT}
defaults = {int(r['species_id']): r for r in rows('pokemon') if r['is_default'] == '1'}
type_rows = rows('pokemon_types')
types = {int(r['pokemon_id']): int(r['type_id']) for r in type_rows if r['slot'] == '1'}
TYPE_ICONS = {1:'○', 2:'✊', 3:'🪽', 4:'☠', 5:'⛰', 6:'🪨', 7:'🐛', 8:'👻', 9:'⚙', 10:'🔥', 11:'💧', 12:'🌱', 13:'⚡', 14:'🔮', 15:'❄', 16:'🐉', 17:'☾', 18:'✦'}
FLYING = {int(r['pokemon_id']) for r in type_rows if r['type_id'] in ('3', '8')} | {63, 64, 65, 81, 82, 109, 110, 137, 151, 201, 233, 251, 280, 281, 282}
OFFICE_NOTES = ['オフィスのすみを、のんびり探検しています。', '会議の時間より、お散歩の時間が気になるようです。', 'あなたの一歩うしろから、今日も一緒に冒険。', '窓の近くで、ひと休みする場所を探しています。', '次の部屋へ遊びにいこう。', '今日の新しい発見があるかも。', 'ちょっとした休憩のお供に、ついてきます。', 'オフィスを歩くと、気分は冒険です。']
catalog = {}
for number in range(1, NATIONAL_COUNT + 1):
    source, localized, default = species[number], names[number], defaults[number]
    legendary = source['is_legendary'] == '1' or source['is_mythical'] == '1'
    capture = int(source['capture_rate'])
    weight = .5 if legendary else 2 if capture <= 45 else 5 if source['evolves_from_species_id'] else 10
    rarity = 'とてもめずらしい' if weight < 1 else 'めずらしい' if weight <= 3 else 'ときどき見かける' if weight <= 5 else 'よく見かける'
    height_dm = int(default['height'])
    catalog[source['identifier']] = dict(id=number, spriteIndex=number-1, heightDm=height_dm, mapSize=map_size(height_dm), name=localized['name'], icon=TYPE_ICONS[types[int(default['id'])]], description=localized['genus'] + 'の' + localized['name'] + '。' + OFFICE_NOTES[(number-1) % len(OFFICE_NOTES)], weight=weight, rarity=rarity, floating=int(default['id']) in FLYING)

ANNOUNCED = {
    'browt': ('ハブロウ', '🌱', 3, 'まゆの葉っぱをゆらして、オフィスの日なたを探しています。'),
    'pombon': ('ポムケン', '🔥', 4, 'ふわふわの毛並みで、みんなの後ろを元気にお散歩。'),
    'gecqua': ('ミオリー', '💧', 3, 'しっぽをゆらして、次の部屋の探検ルートを考え中。'),
}
for index, (kind, (name, icon, height, note)) in enumerate(ANNOUNCED.items(), NATIONAL_COUNT):
    catalog[kind] = dict(id=None, spriteIndex=index, heightDm=height, mapSize=20, name=name, icon=icon, description=name + '。' + note, weight=8, rarity='よく見かける', floating=False)


def encode(image, edge, palette, large=False):
    image = image.convert('RGBA')
    box = image.getbbox()
    if not box:
        raise ValueError('Empty artwork')
    image = image.crop(box)
    ratio = min((edge - 2) / image.width, (edge - 2) / image.height)
    size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
    image = image.resize(size, Image.Resampling.NEAREST)
    if edge > 20:
        # Large original artwork can have thousands of antialiased colours. A
        # local 48-colour palette keeps the map data and decode work bounded.
        image = image.quantize(colors=48, method=Image.Quantize.FASTOCTREE).convert('RGBA')
    offset_x, offset_y = (edge-size[0])//2, edge-size[1]
    bits = 7 if large else 5
    runs = []
    for y in range(image.height):
        x = 0
        while x < image.width:
            r, g, b, a = image.getpixel((x, y))
            if a < 128:
                x += 1
                continue
            color = r << 16 | g << 8 | b
            if color not in palette:
                palette.append(color)
            end = x + 1
            while end < image.width and image.getpixel((end, y)) == image.getpixel((x, y)):
                end += 1
            runs.append((x + offset_x) | ((y + offset_y) << bits) | ((end-x) << (bits*2)) | (palette.index(color) << (bits*3)))
            x = end
    return runs


def pixels(number):
    kind = species[number]['identifier']
    front_raw = fetch('sprites', ART_REV, f'sprites/pokemon/{number}.png', optional=True)
    artwork_fallback = front_raw is None
    if artwork_fallback:
        front_raw = fetch('sprites', ART_REV, f'sprites/pokemon/other/official-artwork/{number}.png')
    back_raw = fetch('sprites', ART_REV, f'sprites/pokemon/back/{number}.png', optional=True)
    front = Image.open(io.BytesIO(front_raw))
    back = Image.open(io.BytesIO(back_raw)) if back_raw else front
    palette = []
    compact = [encode(image, 20, palette) for image in [front, back]]
    edge = catalog[kind]['mapSize']
    large = [encode(image, edge, palette, large=True) for image in [front, back]] if edge > 20 else [[], []]
    return number, [palette, *compact, *large], back_raw is None, artwork_fallback


art, reused_front, artwork_fallbacks = {}, [], []
with ThreadPoolExecutor(max_workers=10) as pool:
    futures = [pool.submit(pixels, number) for number in range(1, NATIONAL_COUNT + 1)]
    for done, future in enumerate(as_completed(futures), 1):
        number, views, reused, fallback = future.result()
        art[number] = views
        if reused:
            reused_front.append(number)
        if fallback:
            artwork_fallbacks.append(number)
        if done % 100 == 0:
            print(f'{done}/{NATIONAL_COUNT} species imported', flush=True)

# Official, transparent illustrations of the three announced partners. Reusing
# the front when facing away is explicit: no unofficial back views or fake IDs.
expected_announced_hashes = {
    'browt': 'c7a0972c3e501e90c2001d405b29bfb95bf7c4ca03542e8761c1ad49948289e9',
    'pombon': '9a0e47ff6e9e35dace1578a2723af821a6fe025f33d551249b5d580a9d36a606',
    'gecqua': 'f613efd3a07f275fdfef4a0cdb12097650c7023b1d1a5f0cc0eb45427d713fd3',
}
announced_hashes = {}
for number, kind in enumerate(ANNOUNCED, NATIONAL_COUNT + 1):
    path = CACHE / 'announced-2026' / (kind + '.png')
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(urllib.request.urlopen(f'https://windswaves.pokemon.com/_images/feb_27_2026/{kind}.png', timeout=30).read())
    raw = path.read_bytes()
    announced_hashes[kind] = hashlib.sha256(raw).hexdigest()
    assert announced_hashes[kind] == expected_announced_hashes[kind], f'Official artwork changed: {kind}'
    source = Image.open(io.BytesIO(raw)); palette = []
    front = encode(source, 20, palette)
    art[number] = [palette, front, front, [], []]

assert len(catalog) == len(art) == 1028
# Complete all downloads before replacing either generated runtime file. Write
# sprites first: an older catalog remains valid during a Vite source reload.
pixel_text = json.dumps([art[i] for i in range(1, len(art)+1)], separators=(',', ':')) + '\n'
(ROOT / 'src/game/pokemon-pixels.json').write_text(pixel_text, encoding='utf-8')
(ROOT / 'src/game/pokemon-catalog.ts').write_text('// Generated by scripts/pokemon/import_catalog.py. See docs/pokemon-data.md.\nexport const POKEMON_CATALOG = ' + json.dumps(catalog, ensure_ascii=False, indent=2) + ' as const;\n', encoding='utf-8')
(ROOT / 'scripts/pokemon/sources.json').write_text(json.dumps(dict(asOf='2026-10-18', nationalSpecies=NATIONAL_COUNT, announced=list(ANNOUNCED), dataRevision=DATA_REV, artRevision=ART_REV, frontReusedForBack=sorted(reused_front), officialArtworkFallback=sorted(artwork_fallbacks), announcedSha256=announced_hashes), indent=2) + '\n')
print(f'Generated {len(catalog)} species; {len(reused_front)} back views reuse front; pixels {len(pixel_text):,} bytes.', flush=True)
