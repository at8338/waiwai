// Room | real furniture anchor | visual beat | visitors | title | discovery | props.
// These are individual scene scripts, not permutations of a theme template.
// Historical IDs/order stay stable; each room is part of its incident's premise.
export const EVENT_STORIES = {
meteor: `KEEP
sky|telescope|orbit|spock|スポック、望遠鏡の向きに異議|望遠鏡の横で耳の尖った来客が計測中。東京タワーは新惑星ではないと伝える必要がある。|planet paper
ops|monitor|scan|r2d2|R2-D2、ログ検索に接続|管制室のログ画面に小さな青いロボット。探している設計図は、どうやら別の銀河のもの。|robot floppy
cockpit|console|beam|vader|ダース・ベイダーのミュート解除|操縦パネルで黒い兜が点滅。呼吸音だけが全館放送に接続された。|mic helmet
library|shelf|stars|littleprince|『星の王子さま』が本棚に帰らない|ナレッジ棚の前に小さな王子と一輪のバラ。本の背に、星へ帰る乗換案内を挟んでいる。|flower book planet
canteen|table|steam|astronaut|宇宙食にも味噌汁は欲しい|食堂の食卓に宇宙飛行士。ストロー付きの味噌汁を前に、地球の重力に感謝している。|bottle plate
wellness|bed|stars|et|E.T.、ベッド脇から電話|休憩室のベッド脇に長い指の来客。充電は十分なのに、地球の市外局番で悩んでいる。|phone flower
cafe|counter|orbit|doc|ドク、コーヒーを未来に送る|カフェのカウンター上でカップが小さく周回。届いた未来の自分から「もう冷めた」と返信が来た。|cup clock cable
workshop|workbench|sparks|astronaut|アポロ13号、文具で帰還|作業台のフィルター、テープ、段ボール。宇宙船の命がかかった工作に、工房の備品が総動員。|helmet glue cable
sky|sofa|stars|maetel|メーテルが終電を待っている|星空ラウンジのソファ脇に黒い帽子。銀河鉄道の切符はあるが、交通費精算の欄が足りない。|ticket suitcase
studio|easel|chalk|astronaut|月面着陸の背景美術|アトリエのイーゼルに月の絵。宇宙飛行士は撮影用ではなく、帰宅経路を描いているらしい。|moon flag painting
project|board|scan|spock|アプリ区画で宇宙語レビュー|実際の区画白板に星の記号が並ぶ。翻訳結果は「このボタン、押しても反応しません」。|paper cursor
arcade|arcade|pixels|vader|デス・スターの弱点、1クレジット|筐体の前に黒い兜。排気口を狙うゲームで、自分の設計ミスを復習している。|coin rocket
sky|telescope|trail|maetel|銀河鉄道999、窓辺に到着|望遠鏡の前の床に細い星のレール。車掌が切符を切る音だけ、やけにはっきり聞こえる。|train ticket`,
thief: `KEEP
office|desk|paper|lupin|ルパン、盗む資料が多すぎる|ひだまりのデスクに赤い上着。機密資料を選別していたら、すべて議事録で朝になった。|paper magnifier
library|shelf|footprints|zenigata|銭形、貸出履歴を捜査|資料棚の前に手錠と貸出カード。「返却期限を守れ、ルパン！」という声が館内に響く。|book key
cafe|counter|cards|kaito|怪盗キッドの白い予告状|カフェのカウンターに白い帽子と一枚のカード。盗むのは最後のケーキ、犯行時刻は15時。|card cake
ops|rack|scan|neo|ネオ、赤いケーブルを選ぶ|ラック前で赤と青の線を持つ黒いコート。どちらもLANケーブルだと説明する人を待っている。|cable bottle
project|desk|shadow|ninja|分身だけがコードレビューに出席|バックエンドの机のそばに同じ忍者が二人。本体の所在だけがレビューで指摘された。|paper mask
workshop|shelf|trace|indiana|聖なるホチキスのすり替え|工房の棚からホチキスを取る探検家。重さの同じ消しゴムを置く手つきが真剣すぎる。|stapler eraser
meeting|board|chalk|holmes|議事録の空白を追う名探偵|作戦室の白板に赤い線。犯人は誰かではなく、誰も決定事項を書かなかったことだった。|magnifier paper
wellness|sofa|shadow|phantom|怪人、仮眠予約を奪う|休憩室のソファ脇で半面の仮面が待機。オペラ座より、ここの静けさが気に入ったそうだ。|mask flower
studio|easel|trace|lupin|盗まれた絵が一枚増えた|イーゼルの絵の横にそっくりな贋作。どちらも「とてもよい」と書いて置いていった。|painting pencil
canteen|buffet|footprints|zenigata|消えたコロッケの足取り|配膳カウンターから続く小さな足跡。銭形の昼食も同時に行方不明になっている。|plate magnifier
arcade|arcade|sparks|lupin|金庫破りより難しいクレーン|筐体の前で赤いジャケットが腕組み。狙う景品は100円玉より安いが、プライドが許さない。|safe coin
focus|desk|paper|holmes|集中室の無音の盗難|一台の机だけ付箋がない。探偵が見つけたのは、全部モニターの裏に貼るという新手法。|paper magnifier
cafe|table|cards|jigen|次元の帽子に会計伝票|カフェの小卓の脇に深い帽子。格好よく席を立とうとしたら、全員分の伝票が残っていた。|hat paper cup`,
flood: `KEEP
cafe|counter|bubbles|ponyo|ポニョ、グラスから顔を出す|カフェの水差しに赤い小さな魚。水浸しにする気はなく、ハムの追加だけを要求している。|fish cup meat
KEEP
KEEP
meeting|board|rain|mary|メリー・ポピンズの傘立て講習|作戦室の白板前に黒い傘。室内では飛ばないと約束したのに、本人の足だけ少し浮いている。|umbrella basket
library|shelf|frost|elsa|エルサ、返却本を冷やす|図書室の一段だけ霜の縁取り。「延滞料金を凍結」はそういう意味ではない。|book crystal
sky|telescope|stars|wizard|ガンダルフ、天気アプリに敗れる|望遠鏡のそばに杖と雲の絵。魔法の予報より、窓の外を見た方が早い。|wand cloud
wellness|bed|snow|olaf|オラフの冷房指定席|ベッド脇に人間サイズの雪だるま。仮眠予約には「設定温度は下げたまま」とだけある。|snowman thermometer
canteen|buffet|steam|chef|雨の日のトトロ弁当|配膳台に葉で包んだ小さなお弁当。持参した葉の傘は、ちゃんと入口でたたんである。|leaf basket
studio|easel|rainbow|alice|虹の絵の具が乾かない|アトリエの絵だけ七色のしずく。アリスは虹の端を筆洗いのカップに戻そうとしている。|painting cup rainbow
workshop|workbench|sparks|doc|雷を充電器にする実験|作業台の瓶に小さな稲妻。ドクが必要な電力を書いた紙を見て、ブレーカー係が首を振った。|bottle lightning battery
ops|monitor|snow|snowqueen|管制室に積雪注意報|モニターの枠だけ白くなった。アラートは気温ではなく、サーバー室でかき氷を作る人に向いている。|snow thermometer
garden|plant|blossom|totoro|屋上の苗、雨を待ちきれない|屋上の既存の鉢にだけ葉っぱの雨宿り。トトロが傘を差して、先に芽が出るのを待っている。|umbrella seedling
sky|sofa|feathers|mary|上昇気流で帰れません|ラウンジのソファ脇に旅行鞄と傘。今日は窓からではなく、ちゃんとフロア移動で帰るそうだ。|suitcase umbrella`,
santa: `KEEP
garden|plant|ribbon|samurai|こいのぼり、屋上で逆風勤務|屋上の鉢の間に小さな吹き流し。侍の風向き判定は、天気予報より頬の感覚を信じている。|fish flag
canteen|buffet|steam|oni|節分の鬼、まかない当番|配膳台の横で鬼が豆を小皿に分けている。今日だけは「鬼は内、残業は外」。|seed plate mask
studio|easel|ribbon|princess|ひな人形、肖像画を発注|イーゼル前におひな様の小さな冠。五人囃子の集合写真は、毎年誰かが目を閉じている。|crown fan painting
sky|table|stars|rabbit|月のうさぎ、お月見団子を検品|ラウンジの小卓に一皿の団子。丸さは完璧、数だけ一つずつ減っていく。|dumpling moon
workshop|workbench|paper|oni|鬼の金棒、持ち込み修理|作業台に短い金棒と修理票。「豆には強く、床には優しく」が今回の注文。|hammer seed
library|shelf|ribbon|kaguya|かぐや姫の短冊は要件が多い|資料棚の横の小笹に、五枚の短冊。担当者はまず実現可能性から確認している。|bamboo paper
arcade|arcade|shadow|jack|ジャックのハロウィン高得点|筐体の前にかぼちゃの王。怖い顔より、リズムゲームの判定が厳しい。|pumpkin coin
canteen|table|steam|samurai|鏡開き、刀より先に木槌|食堂の食卓に小さな餅。侍が抜刀しかけたところで、木槌がそっと渡された。|hammer dumpling
cafe|counter|steam|chef|年越しそばのフライング提供|カウンターのそばに一杯のそば。まだ年末ではないが、年を越す勢いの会議はある。|noodle clock
garden|sofa|blossom|samurai|お花見の席はベンチ二人分|屋上のベンチ脇に敷物と小さな弁当。桜の鉢を持参したので場所取りは不要だった。|flower basket
cafe|counter|heart|witch|魔女のバレンタイン試食会|カフェのカウンターに三粒のチョコ。惚れ薬ではなく、寝不足に効く砂糖らしい。|heart candy
wellness|bed|music|princess|眠れる森の姫、目覚ましを導入|休憩室のベッド脇に目覚まし時計。百年寝坊する前に、五分スヌーズを覚えてしまった。|clock flower
library|shelf|paper|holmes|福袋の中身は積読だった|本棚の前に一袋だけの福袋。名探偵が開けると、読みかけの本の続巻ばかり入っている。|gift book`,
ghost: `library|shelf|ghosts|buster|ゴーストバスターズ、書架へ急行|本棚の間に小さな幽霊が三体。隊員は通路から捕獲しているが、貸出手続きだけは先に済ませた。|ghost book
focus|desk|shadow|wednesday|ウェンズデーの影だけ残業|集中室の机に黒い影。本人は定時退勤、影だけは妙にまじめにキーボードを打っている。|hand paper
studio|easel|mirror|phantom|肖像画の裏にオペラ座|既存のイーゼルに描かれた仮面が振り向いた。額縁の向こうから、非常に小さな拍手が聞こえる。|mask painting
wellness|bed|shadow|dracula|ドラキュラ、夜勤明けの仮眠|ベッド脇に黒いマントと日傘。遮光が足りないので、アイマスクを二枚注文している。|umbrella glasses
cafe|counter|steam|ghost|お化けの注文は透明ラテ|カウンターの横に透けるお客。ミルクもカップも透明なので、店員だけが困っている。|cup ghost
workshop|workbench|sparks|franken|フランケンの肩こり修理|作業台脇の来客に予備のボルト。落雷より先に、六角レンチで何とかする方針。|gear hammer
meeting|board|chalk|conan|コナン、動く議事録の謎|作戦室の白板の文字が一行ずつ増える。犯人はまだ会議が終わっていないことだった。|bowtie paper
library|shelf|webs|witch|禁書の蜘蛛、索引を編む|資料棚の隅にだけ細い糸。魔女が頼んだのは蜘蛛の巣ではなく、検索用のリンク集だった。|spider book
arcade|arcade|pixels|ghost|パックマンの敵、休憩申請|筐体の前に三角目の幽霊。追いかけられる側の気持ちを、一度だけ体験したいらしい。|ghost coin
wellness|sofa|shadow|sadako|貞子、モニターから出勤|休憩室の小卓に古いテレビ。出てきた人は怖がらせる前に、長い髪を結ぶゴムを探している。|tv cable
ops|monitor|scan|buster|深夜のアラートは幽霊だった|アラート画面の縁に小さな幽霊。隊員は除霊より先に、通知の重複設定を直している。|ghost bell
sky|sofa|stars|jack|ジャック、星を頭蓋骨と間違える|ラウンジのソファ脇で細い手が星図を指す。望遠鏡をのぞいたら、全部ただの星だった。|skull star
studio|easel|shadow|wednesday|ハンドのデッサンモデル|イーゼル前の台に片手だけ。モデル料は安いが、休憩時間に勝手に歩いていく。|hand pencil
canteen|buffet|steam|ghost|幽霊、食券の読み取り失敗|配膳台の前に透けた食券。券売機には「実体をかざしてください」と出ている。|ticket plate`,
waldo: `office|shelf|trace|waldo|ウォーリー、資料棚の陰に出勤|ひだまりの資料棚の横に、いつもの大きさの赤白帽子。目立たない席を探した結果、背表紙と同化している。|glasses book
arcade|table|cards|shogi|将棋の神様、昼休みの一局|ゲーセンの実際のテーブルに小さな盤。対局相手が来る前に、おやつの手だけ読んでいる。|shogi cup
meeting|table|cards|alice|アリス、会議机でチェックメイト|作戦室の会議机に卓上チェス。白の女王が「持ち帰って検討」を禁じた。|chess crown
arcade|arcade|pixels|mario|マリオ、ジャンプ禁止の筐体|ゲーム機の前に赤い帽子。床では跳ばないでと注意され、ボタンを全力で押している。|coin mushroom
arcade|table|cards|kaito|トランプ一枚だけ有給休暇|テーブルの手品に白い帽子。消えたカードは、ポケットではなく休暇申請の下にいた。|card paper
wellness|sofa|music|snoopy|スヌーピー、空想の卓球|ソファ脇で白い犬がラケットの代わりに本を振る。球がないのに、試合は白熱している。|ball book
workshop|workbench|trail|robot|ドミノ停止装置の実演|作業台の上だけ小さなドミノ列。最後に置いたクリップ一個が、全社の努力を止めている。|domino clip
studio|table|paper|alice|ジグソーの一片、絵から脱走|作業テーブルのパズルに小さな空白。アリスが追う一片は、隣の絵の中で休んでいる。|puzzle painting
arcade|table|orbit|goku|悟空のけん玉、ちょっと浮く|ゲーセンの小卓で玉が一個だけ浮く。気で止めるのは反則か、審判が悩んでいる。|ball ring
library|table|cards|holmes|すごろくの犯人は一回休み|図書室の読書机に小さな盤。探偵が推理するほど、「会議」のマスに止まる。|dice magnifier
cafe|table|cards|queen|ハートの女王、席の予約争い|カフェの二人席の脇に冠。順番札を見せられて、首ではなくコーヒーを注文し直した。|card crown cup
sky|table|orbit|littleprince|王子さまの輪投げ|ラウンジの小卓で輪が星を一周。入ったかどうかは、その星に住む人に聞くことになった。|ring planet
arcade|table|trace|jigen|次元、九番球を見失う|ゲーセンのテーブルで丸い球を探す。帽子を取ると一個だけ落ちてきた。|ball hat
arcade|arcade|sparks|zenigata|銭形、クレーンの景品に手錠|ゲーム機の景品口に小さな鍵。先に取れた手錠から抜けられず、捜査が一時中断した。|key trophy`,
delorean: `KEEP
garden|sofa|outside|catbus|ネコバス、屋上ベンチに停留|ベンチ脇に猫顔の小さな行先札。車体は屋外、屋上の通路はちゃんと空けて待っている。|cat sign
canteen|table|steam|porco|紅の豚、機内食の査定|食堂の食卓に飛行帽と一皿。豚は飛べるが、食後すぐは飛びたくないそうだ。|plane plate
workshop|workbench|trail|doc|ドクの卓上鉄道模型|作業台の縁だけに細いレール。速度を上げると過去の請求書が届くので、ゆっくり試運転中。|train clock
garden|sofa|ribbon|carl|『カールじいさん』の係留場所|屋上のベンチ横に旅行鞄と三つの風船。家は持ち込めないので、散歩だけで寄ってくれた。|balloon suitcase
sky|telescope|beam|spock|転送先が望遠鏡の前だった|ラウンジの望遠鏡脇に青い転送光。論理的には到着したが、挨拶の順番が計算外。|ring telescope
cockpit|pilot|sparks|amuro|アムロ、座席の高さ調整|実際のパイロット席に点検札。発進より先に、足がペダルに届くか確認している。|helmet ruler
cafe|counter|feathers|kiki|キキの宅配、カフェに置き配|カウンターに小箱と黒猫。ほうきは店の外へ立てかけて、受領印を待っている。|gift cat broom
library|shelf|trace|indiana|インディ、館内地図を入手|資料棚の前に革鞄と巻物。宝の位置より、コピー機の位置が急務だった。|scroll suitcase
focus|desk|paper|marty|マーティ、昨日の締切へ戻りたい|集中室の机に時計とギターケース。昨日の自分にも同じ相談を断られたらしい。|clock guitar
garden|plant|trail|et|E.T.の自転車、安全点検|屋上の鉢の脇に普通サイズの自転車。月を背景にする前に、ライトとベルを確認中。|bike moon
arcade|arcade|music|mario|マリオカート、社内交通安全回|筐体脇の赤い帽子。バナナはコースではなく、ちゃんとゴミ箱へという講習が始まった。|car banana
KEEP
workshop|workbench|sparks|nausicaa|ナウシカのメーヴェ整備|作業台に小さな白い翼。エンジンより先に、オフィスの空調風向きを確認している。|plane gear`,
terminator: `KEEP
workshop|workbench|sparks|walle|WALL-E、クリップを宝物にする|工房の作業台に箱型ロボット。拾ったクリップを、宝石より丁寧に並べている。|robot clip leaf
cafe|vending|scan|baymax|ベイマックス、自販機を診察|ドリンク機の前に白い看護ロボット。「痛みを十段階で」と聞いても、返るのは売切ランプだけ。|bottle heart
studio|easel|paper|atom|鉄腕アトム、鉛筆で自画像|イーゼル脇に赤い靴。原子力より小さな鉛筆の力で、丸い前髪を描いている。|pencil painting
meeting|table|sparks|c3po|C-3PO、議事録の翻訳渋滞|作戦室の会議机に翻訳メモ。人間の「なるはや」だけ、どの言語にも正確に訳せない。|paper gear
ops|rack|scan|r2d2|R2-D2、ラックの保守当番|既存ラックの横で青いランプが応答。保守記録にはビープ音しか残っていない。|robot cable
arcade|arcade|pixels|robocop|ロボコップ、反射神経測定|筐体前に銀の警官。法は守るが、連打の制限だけは納得がいかない。|helmet coin
project|monitor|scan|neo|マトリックスの緑のログ|案件部屋のAPIモニターだけ緑の文字列。ネオは原因を探す前に、まず再現手順を聞いている。|cursor cable
library|shelf|paper|atom|アトム、取扱説明書を探す|手順書棚の前でロボットが迷う。心のアップデートに対応する版だけが見つからない。|book heart
wellness|bed|heart|baymax|ベイマックスの仮眠診断|ベッド脇で白い体が待機。「休息が必要です」の表示に、反論できる人がいない。|heart thermometer
workshop|workbench|sparks|ironman|アイアンマン、USB-Cを探す|作業台の赤いヘルメットと充電線。世界は救えても、端子の規格は揃えられない。|helmet cable battery
ops|monitor|scan|hal|HAL、赤いランプで応答|中央の既存モニターに赤い一点。電源を切る相談だけ、なぜか文字化けする。|bulb camera
canteen|table|steam|walle eve|WALL-EとEVEの植木鉢ランチ|食卓の上に一鉢の若葉。二体のロボットは食べずに、ただ葉の成長を見ている。|seedling bottle
cockpit|console|sparks|robot|鉄人28号、リモコン電池切れ|操縦卓に小さなリモコン。巨大ロボを動かす力は、単三電池二本に託されている。|battery radio`,
momotaro: `canteen|buffet|steam|momotaro|桃太郎、食堂で桃を受け取る|配膳台に食べ頃の桃を一個。桃太郎は生まれるためではなく、食後のデザートとして取りに来た。|peach dumpling
wellness|sofa|music|kintaro|金太郎の肩こり体操|休憩室のソファ脇で小さな斧が休憩中。熊との相撲より、デスクワークが腰に来るらしい。|hammer medal
cafe|table|bubbles|issun|一寸法師、カップで渡航|カフェの卓上に普通のカップと針。小さな本人にとっては大海原だが、人間にはティースプーンの距離。|cup sword
workshop|workbench|ribbon|crane|鶴の恩返し、見学禁止の試作|工房の作業台に織りかけの布。製作中はのぞかない約束なのに、進捗報告だけは求められる。|feather shirt
garden|plant|blossom|oldman|花咲かじいさん、鉢限定開花|既存の屋上の鉢が一つだけ満開。床に灰をまく前に、掃除当番へちゃんと連絡してある。|flower seed
office|shelf|ribbon|jizo|かさ地蔵、傘の返却に来る|ひだまりの棚の脇に小さな笠が六つ。恩返しの品より、返却場所の丁寧さが印象的。|hat basket
cafe|counter|steam|tanuki|ぶんぶく茶釜、保温当番|カウンターの湯沸かし横に狸。お湯は得意だが、ラテアートの注文には首をかしげている。|cup leaf
canteen|table|trail|mouse|おむすびころりん、食卓で止まる|食卓の上に小さなおむすび。今回は床へ落ちる前に、鼠が受け皿を差し出した。|sushi plate
garden|plant|vine|jackbean|ジャックの豆、鉢から育つ|屋上の既存の鉢から一本のつる。天まで伸ばす前に、支柱の強度計算が始まった。|seedling ladder
library|shelf|trace|redhood|赤ずきん、マニュアルを届ける|資料棚の前の赤いフードと籠。おばあさんの家より、最新版の保管場所の方が迷いやすい。|basket book
workshop|workbench|paper|pig|三匹の子豚、耐震模型を提出|作業台に藁、木、煉瓦の小さな模型。狼の息は社内の扇風機で代替する予定。|tent tree castle
library|shelf|trail|gretel|パンくずの道、図書室で回収|棚の間の通路にごく小さなパンくず。掃除機に消される前に、しおりへ変更した。|bread book
studio|easel|stars|cinderella|シンデレラの靴、実寸デッサン|イーゼル脇に片方の靴。魔法が解ける前に、寸法だけでも残してほしいそうだ。|shoe ruler
studio|easel|mirror|king|裸の王様、衣装の色校正|アトリエに王冠と白い色見本。誰も見えない布より、ちゃんと見える服を注文している。|crown shirt`,
urashima: `library|table|smoke|urashima|浦島太郎の玉手箱、閲覧のみ|読書机の上に手のひら二つ分の箱。貸出規約の一行目が「開けないこと」になっている。|chest turtle
library|shelf|trace|indiana|インディと失われた議事録|設計資料棚の奥に巻物。宝の地図ではなく、前任者しか知らない運用手順だった。|scroll book
workshop|workbench|sand|mummy|ミイラ、包帯の巻き直し|作業台脇に布と糸巻き。三千年ものの包帯は、さすがに洗濯表示が読めない。|rope scissors
studio|easel|chalk|pharaoh|ファラオの横顔アイコン|イーゼル前で金の冠が微動だにしない。正面顔を頼むと、壁画の規則違反だと言う。|crown painting
library|shelf|paper|holmes|ホームズ、恐竜図鑑を誤配|本棚の前に大きな足跡のスケッチ。怪物事件かと思ったら、子供向け図鑑の付録だった。|fossil book
cafe|counter|cards|jackpirate|ジャック・スパロウ、会計に金貨|カウンターに一枚だけ古い金貨。現金か電子決済にしてほしいと、店員が静かに説明中。|coin compass
project|board|shadow|ninja|服部半蔵、区画の動線調査|CMS区画の白板に避難経路。天井裏は正規の通路ではない、と赤で追記された。|scroll paper
office|shelf|trace|goemon|五ェ門、傘と刀を取り違える|資料棚脇に傘と鞘。「またつまらぬ物を」と言う前に、借りた傘を返している。|sword umbrella
sky|sofa|music|cowboy|西部のガンマン、窓際指定|ラウンジのソファ脇に拍車付きの靴。夕日を待っているが、予約は昼までだった。|hat shoe
wellness|sofa|sparks|knight|騎士の鎧、静かな脱着|休憩室のソファ前に手袋と兜。金属音を立てずに休むのが、今日一番の難題。|helmet shield
workshop|workbench|bubbles|alchemist|錬金術師、コピー用紙を金に|作業台に一円玉と小瓶。変換には成功したが、経費申請の証憑がなくなった。|coin potion paper
library|shelf|paper|pharaoh|古代司書の貸出カード|マニュアル棚に一枚のパピルス。氏名欄だけ象形文字で、返却日は普通の数字だった。|scroll stamp
canteen|table|steam|caveman|原始人、電子食券と対面|食卓脇に石斧とICカード。火の起こし方より、タッチする位置に感動している。|bone ticket
focus|desk|paper|marty|タイムカプセルの中は今日のTODO|集中室の机に開封した小箱。十年後の自分も、同じタスクを積み残していた。|chest paper`,
kaguya: `garden|plant|stars|kaguya|かぐや姫、屋上の竹を間借り|既存の鉢に一本だけ光る竹。月のお迎えは屋上指定、入館申請はまだ未承認。|bamboo moon
garden|plant|vine|totoro|トトロ、盆栽の背比べ|屋上の鉢の横でトトロが伸びをする。木を巨大にせず、今日の新芽だけ数えている。|seedling ruler
studio|easel|blossom|belle|ベルの薔薇、描画時間を延長|イーゼルの前にガラスの小瓶と一輪。最後の花びらが落ちる前に、色だけ合わせたい。|flower bottle
cafe|table|trace|littleprince|王子さま、サボテンと握手しない|カフェの小卓に小さなサボテン。大事なものは見えないが、針はよく見た方がいい。|cactus cup
ops|rack|vine|nausicaa|ナウシカ、ラックの胞子を調査|サーバーラックの隙間に一輪のきのこ。まずネットワークを止めずに採取する段取りから。|mushroom bottle
studio|table|blossom|arrietty|アリエッティの落ち葉画材|アトリエの作業机に葉っぱと針。小さな来客が、紙の端だけを絵具皿として借りている。|leaf pencil
focus|desk|blossom|sunflower|集中室のひまわり、画面を追う|机の小鉢だけがモニター側を向く。ブルーライトより、コードレビューの熱量に反応している。|flower tv
garden|plant|music|ponyo|ポニョ、芽の応援団|屋上の鉢の横に小さな赤い魚と水差し。「出ておいで」の掛け声だけは誰より大きい。|fish seedling
project|rack|vine|nausicaa|インフラ区画、蔦の配線検査|検証ラックの足元に細いつる。結束バンドは不要だが、抜くと植物が不機嫌になる。|leaf cable
office|plant|blossom|sakura|桜の魔法、鉢一つだけ春|ひだまりの既存の観葉植物に一枝の桜。部屋全部を変えず、入口の挨拶だけ華やかになった。|flower wand
garden|sofa|feathers|san|サン、屋上ベンチで森を待つ|ベンチ脇に赤い仮面。植栽の剪定計画を、かなり真剣な表情で読んでいる。|mask leaf
library|shelf|vine|belle|本の蔦が索引をつなぐ|資料棚に一本だけ緑の蔦。ベルが葉をめくると、関連ページが順番に見つかる。|book leaf
workshop|workbench|paper|arrietty|つくしの実測、ミリ単位で|作業台のつくしと定規。小さな借りぐらしの人にとっては、ビルの高さを測るようなもの。|seedling ruler
canteen|table|steam|totoro|トトロのどんぐり定食|食卓に小さな木の実が三つ。栄養表示を読んだあと、葉っぱをナプキンにしている。|seed plate leaf`,
alice: `cafe|table|cards|alice|アリスのお茶会、サイズ確認済み|実際のカフェ卓に普通サイズのカップ。今日は大きくならないお菓子を選んでから着席した。|cup cake
wellness|sofa|shadow|alice|チェシャ猫、ソファの背だけ借りる|既存のソファの背に小さな笑顔。体が消えても、クッションのへこみはそのまま残る。|cat glasses
studio|table|mirror|arrietty|アリエッティ、消しゴムを借りる|作業机の端に小人と普通の消しゴム。一晩分の椅子にしたいので、角だけ借りたいらしい。|eraser pin
focus|desk|paper|doraemon|ドラえもん、署名をスモール化|集中室の机に細い光と申請書。字だけ小さくしたら、承認欄から読めなくなった。|pencil paper
arcade|table|pixels|ralph|シュガー・ラッシュの卓上映画館|ゲーセンの小卓に掌サイズのスクリーン。ポップコーンは普通サイズなので入口を通らない。|tv corn
studio|table|paper|howl|ハウル、折り紙の城を提出|アトリエの作業机に小さな紙の城。動くが、コンセントの位置には従順だった。|castle paper
workshop|workbench|trace|antman|アントマン、消しゴム下を点検|作業台の普通の消しゴムの横に極小の人。小さくなると、失くしたネジが立派な発見になる。|eraser gear
wellness|bed|shadow|arrietty|靴下の寝袋を借りぐらし|ベッド脇の畳んだ靴下に小さな灯り。一泊だけと約束して、繊維一本の梯子をかけている。|sock lantern
meeting|table|paper|doraemon|会議室模型、机の上にもう一室|会議机の端に小さな模型。模型の中でも会議が続いているので、電源は切れない。|desk chair
library|shelf|paper|alice|絵本の扉が棚の中で開く|図書室の一冊だけ見開きの扉。アリスは通路を塞がず、本の端からそっとのぞいている。|book door
cafe|counter|steam|hatter|帽子屋、カップの高さを採寸|カウンター上の普通のカップとメジャー。帽子をかぶせたいらしいが、まず飲み終えてほしい。|cup ruler hat
workshop|workbench|ribbon|arrietty|クリップの物干し、机上で開業|作業台の隅に短い糸と小さな服。クリップ一個で一週間分の洗濯物が干せる。|clip shirt
studio|easel|mirror|queen|女王の鏡、全員を褒める|イーゼルに立てた手鏡。「世界で一番」を聞くたびに、ちゃんと別の長所を見つけてくれる。|mirror crown
cafe|table|paper|hatter|帽子屋の畳める休憩時間|小さなカフェ卓の端に折り畳み時計。五分だけ伸ばして、会議の前には元へ戻す。|clock cup`,
oz: `garden|sofa|ribbon|dorothy|ドロシー、屋上の風向き待ち|屋上ベンチ脇に赤い靴と籠。竜巻は持ち込まず、帰りの風だけ確認している。|shoe basket
ops|monitor|scan|neo|ネオ、ログの雨を見上げる|中央モニターに緑の縦列。立っている床の重力はいつもどおりなので、コーヒーはこぼれない。|cursor cup
garden|sofa|ribbon|carl|風船の束、ベンチで休憩|屋上ベンチの脇に三本だけの風船。カールじいさんが結び目を二重に点検している。|balloon rope
cafe|counter|steam|aladdin|アラジン、注文は水だけ|カウンターに小さなランプ。ジーニーに頼むより早い、と本人がコップを受け取った。|lantern cup
studio|easel|music|belle|音符が絵の中で信号待ち|アトリエの絵の脇に小さな音符。ベルが譜面をめくるまで、ちゃんと順番を守っている。|note painting
workshop|workbench|feathers|nausicaa|風の谷の風洞実験|既存の作業台に小さな翼と扇風機。紙が飛ばないよう、周囲の道具も片づけてある。|fan plane
project|board|paper|dorothy|オズの黄色い経路図|案件部屋の区画白板に黄色い線。目的地は魔法使いではなく、インフラ担当の席だった。|paper shoe
wellness|bed|feathers|mary|羽毛のエレベーターは小人専用|ベッド脇に羽根が一枚だけ浮く。メリーは重量制限を、紅茶一杯分と説明した。|feather cup
workshop|workbench|paper|aladdin|魔法のじゅうたん、車検中|作業台に畳んだ小さな絨毯。端のほつれを直すまで、飛行許可は保留になった。|carpet ruler
studio|easel|mirror|mime|透明な壁の位置図|イーゼルの前でパントマイム。見えない壁も、館内図には記載してほしいそうだ。|hand painting
office|desk|paper|marty|紙飛行機の着陸許可|ひだまりのデスクの端だけ滑走路。マーティの申請書は、飛ばさず手で提出することになった。|plane paper
library|table|bubbles|harry|ハリー、泡の中のしおり|読書机に小さな透明の球。防水にはなったが、本を閉じるときに毎回割れる。|book wand
sky|telescope|stars|dorothy|ルビーの靴、東京タワーを指す|望遠鏡脇の赤い靴に星の光。「おうちが一番」の方向は、地図で再確認している。|shoe star
focus|desk|shadow|mime|パントマイムの空気椅子|集中室の机脇で誰かが座る姿勢。実物の椅子は空いているのに、仕事へのこだわりが強い。|shoe cup`,
pirate: `cafe|table|cards|jackpirate|ジャック船長、コースターを海図に|カフェの卓上でコンパスが回る。目指しているのは宝島ではなく、無料のおかわり。|compass cup
sky|telescope|beam|nausicaa|風の谷の灯台点検|望遠鏡の脇に小さな照明と地図。東京湾の明かりを数えて、帰りの航路を決めている。|lantern scroll
workshop|workbench|ribbon|popeye|ポパイ、結び目だけ力技|作業台に短いロープと工具。ほどく方が早いのに、腕力で解決しようとして止められた。|rope pan
cafe|counter|music|ariel|アリエル、貝殻で呼び出し|カウンターに小さな貝殻のベル。注文番号は歌で届くので、毎回ちょっと長い。|shell bell
library|shelf|paper|jackpirate|ボトルメールの保管規則|棚の一段に一通だけの瓶入り手紙。船長は添付ファイルの入れ方を真剣に相談している。|bottle envelope
focus|desk|trace|popeye|錨は文鎮として重すぎた|集中室のデスク端に掌サイズの錨。これでも申請書より先に、机の強度を心配されている。|anchor paper
meeting|board|chalk|luffy|ルフィ、海賊旗でプレゼン|既存の白板に小さな海賊旗の絵。事業計画の最初の一行が「自由」だけになっている。|flag paper
canteen|table|steam|jackpirate|船長、ドーナツを浮き輪と呼ぶ|食卓に輪っかのお菓子が一つ。食べるか救命具にするか、本人だけが本気で迷っている。|donut ring
canteen|buffet|steam|sanji|サンジ、非常食の味を改善|配膳台に缶詰と一皿。保存期間を伸ばす前に、おいしさの議論が始まった。|bread meat
garden|pond|bubbles|ariel|人魚、屋上の池に立ち寄る|既存の池の縁に小さな貝とブラシ。陸の打ち合わせは、ここまで来てもらう予定だ。|shell fish
arcade|arcade|music|jackpirate|舵輪ゲーム、宝の方向だけ不明|ゲーセンの筐体前で船長が舵を握る。コインの投入口だけはすぐ見つけた。|wheel coin
workshop|workbench|paper|shipwright|ボトルシップ、出口を検証|作業台に普通の瓶と小さな帆船。作った本人も、どう出すかまでは考えていなかった。|boat bottle
library|table|paper|nami|ナミ、昼食マップを測量|読書机に館内図と定規。宝島より食堂の混雑回避の方が、いまは大事らしい。|scroll ruler
studio|easel|chalk|jackpirate|船長の指名手配、似顔絵修正|イーゼル前で帽子の角度を直す船長。懸賞金より写真写りを気にしている。|painting hat`,
ninja: `workshop|board|trace|naruto|ナルト、的は白板の付箋だけ|工房の既存白板に紙の的。壁に刺すのは禁止なので、手裏剣も折り紙で作ってある。|star paper
library|shelf|paper|ninja|巻物、横スクロールに未対応|本棚前に短い巻物とノートPCのメモ。忍者は指でスワイプしても進まない理由を聞いている。|scroll cursor
library|shelf|shadow|goemon|五ェ門、本棚の隠し扉を探す|既存の資料棚を眺める剣士。回転扉はないので、普通に背表紙から探してもらう。|sword book
cafe|counter|steam|samurai|侍の茶道、テイクアウト可|カフェのカウンターに小さな茶碗。正座は不要と聞いて、少しだけ安心した。|cup fan
wellness|sofa|music|tanuki|招き猫、腕のリハビリ|休憩室のソファ脇に小さな招き猫。招きすぎて肩が凝ったので、今日は逆の手で営業。|cat medal
studio|easel|chalk|daruma|だるま、眼鏡のサイズ合わせ|イーゼル前に小さなだるま。目標達成より先に、両目の視力を測っている。|glasses mask
meeting|board|scan|samurai|将軍、オンライン参勤交代|作戦室の白板前にノートと扇。行列を作らなくてよいと知って、予算だけ大喜びしている。|tv flag
focus|desk|trace|ninja|忍び足でも打鍵は聞こえる|集中室の机脇で忍者が反省中。移動は無音でも、Enterだけは全力だった。|shoe paper
office|shelf|paper|miko|おみくじ、全部『要相談』|ひだまりの棚に小さな紙束。大吉より具体的な助言が欲しいと、巫女へ列ができかけている。|paper stamp
garden|plant|music|miko|屋上の風鈴、静音モード|既存の鉢の支柱に一個だけ風鈴。風は吹くが、会議中は短冊を外す運用になった。|bell paper
wellness|sofa|trace|lion|獅子舞、歯みがき指導|休憩室のソファ脇に獅子の頭。噛んで福を呼ぶ前に、歯ブラシの持ち方を習っている。|mask bone
workshop|workbench|ribbon|samurai|畳の端材、マウスパッドに|作業台に小さな畳見本。侍の手触り評価は最高だが、光学マウスの反応は微妙。|carpet cursor
arcade|table|music|festival|盆踊り、ゲーセンで一曲だけ|ゲーセンのテーブル脇に小太鼓。周囲を回る代わりに、二人分の足踏みで済ませている。|drum lantern
studio|table|ribbon|miko|手ぬぐいの柄、色校正待ち|作業机に一枚の布と色見本。祭りの開催前に、洗濯で落ちない色を選んでいる。|shirt flag`,
dragon: `garden|sofa|smoke|dragon|ドラゴン、屋上でくしゃみ我慢|ベンチ脇の小さな竜が鼻を押さえる。火気厳禁の表示を見て、ちゃんと我慢している。|dragon flower
studio|easel|rainbow|unicorn|ユニコーンの証明写真|イーゼル前に小さな白馬。角を画角へ入れるため、カメラを少し後ろに下げた。|unicorn camera
workshop|workbench|sparks|fawkes|不死鳥の羽ペン、熱すぎる|作業台に赤い羽根が一本。再生能力より、紙が焦げない筆圧が大事だ。|feather pencil
cafe|counter|feathers|gryphon|グリフォン便、カフェで受領|カウンターに小さな羽根と宅配箱。猛禽の爪では受領印が押しにくい。|feather gift
wellness|sofa|heart|cerberus|ケルベロス、三頭で一休み|ソファ脇に犬の顔が三つ。全員同時に寝ないので、静かになる時間が読めない。|dog dog dog
garden|sofa|feathers|pegasus|ペガサスの駐輪区分相談|屋上ベンチ脇に白い翼。自転車置き場か来客受付か、総務が分類に迷っている。|horse feather
library|table|paper|sphinx|スフィンクスのFAQ、答え付き|読書机の小さな猫像に問題集。答えないと通さないのでは、利用規約に反するらしい。|cat book
garden|pond|bubbles|ariel|人魚のリモート会議席|既存の池の縁に貝殻のマイク。背景は本物、声だけはミュート解除を忘れている。|shell mic
workshop|workbench|sand|golem|ゴーレム、予備の指を作る|作業台に粘土と小皿。壊れない体より、キーボードに合う細い指が欲しい。|statue cup
wellness|bed|frost|snowqueen|雪女、冷房の設定交渉|ベッド脇に小さな氷と温度計。他の人も休める温度で、折り合いを探している。|crystal thermometer
library|shelf|trace|troll|トロール、棚下の賃貸契約|資料棚の足元に小さな椅子。橋の下より乾燥しているが、返却本が天井をふさぐ。|chair coin
studio|table|stars|fairy|妖精、ペン先を管制塔に|作業机の鉛筆のそばに小さな羽。飛行許可は、筆が止まっている間だけ下りる。|pencil feather
project|board|chalk|minotaur|ミノタウロス、区画案内を添削|実際の区画白板に館内図。「迷わせない案内」にする仕事は、少し複雑な気分らしい。|scroll ruler
workshop|workbench|sparks|arthur|聖剣、コピー用紙から抜けない|作業台の紙束に小さな剣。王の資格より、ホチキスを外す方が先だった。|sword paper`,
slime: `arcade|table|bubbles|slime|スライム、卓上で組体操|ゲーセンの小卓に三匹だけの青いしずく。合体の練習だが、制限時間は休憩の五分。|slime crown
cafe|table|bubbles|kirby|カービィ、ゼリーを見守る|小さなカフェ卓に普通サイズのゼリー。吸い込むと実演が終わるので、じっと待っている。|jelly fork
workshop|workbench|bubbles|inventor|博士、泡の梱包材を試す|作業台に小箱と小さな泡。割れ物は守れたが、開け方の説明書も泡に包まれた。|cloud gift
wellness|sofa|heart|baymax|ベイマックス、グミの応急処置|ソファ脇に小皿のグミ。「溶けています」と診断したあと、冷たい水をそっと置いた。|heart bottle
studio|easel|chalk|ditto|メタモン、社員証の撮影日|イーゼル前に小さな桃色のかたまり。社員証の顔と本人の顔を合わせる方が難しい。|camera card
canteen|table|steam|chef|プリン、食卓で耐震試験|実際の食卓に普通のプリン。揺らしすぎると検品ではなく試食になる。|pudding fork
wellness|sofa|music|totoro|トトロ、クッションを返さない|既存ソファの脇で小さめのトトロがくつろぐ。クッションと自分の境目が気に入ったらしい。|leaf cup
focus|desk|shadow|invisible|透明人間の机、名札だけ実在|集中室のデスクに名札とカップ。本人の姿より、空席扱いされることが悩みだった。|card cup
workshop|workbench|sparks|inventor|ゴム風船発電、効率会議|作業台に小さな風船と電池。膨らませる人の方が、発電より多くカロリーを使っている。|balloon battery
meeting|table|cards|kirby|カービィ、丸い議題を選ぶ|会議机の上のボールをじっと見ている。食べ物ではないとわかってから、出席が静かになった。|ball paper
cafe|counter|steam|witch|魔女のマシュマロ雲|カウンターの一皿に白い雲。雨は降らないが、コーヒーへ入れるとすぐ消える。|cloud cup
workshop|workbench|trace|spongebob|スポンジ・ボブ、拭き掃除当番|作業台の小さな水滴を、黄色い来客が拭いている。誰より吸水性のある担当者だ。|broom bottle
arcade|arcade|pixels|sonic|ソニック、バネ台の修理依頼|ゲーム機脇に小さなバネ。ジャンプは得意でも、ネジ締めにはちゃんと工具を借りた。|gear shoe
canteen|buffet|steam|chef|こんにゃく、見本より揺れる|配膳台の一皿だけ妙にぷるぷる。見本か本物か迷う人向けに「本物」の札がついた。|jelly sign`,
robot: `workshop|workbench|sparks|robot|ロボットの定期健診|工房の作業台に工具と予備の歯車。健康診断の結果は「油を差して、よく休むこと」。|gear cable
cafe|counter|music|doraemon|ドラえもん、扇風機を逆回転|カウンター脇の小型扇風機。未来の風は来ず、レシートだけが戻ってきた。|fan paper
canteen|buffet|steam|inventor|シュレッダー製麺機、使用禁止|配膳台に試作品の小箱。紙と麺を同じ機械で扱う案は、衛生担当に一瞬で止められた。|printer noodle
studio|easel|chalk|walle|WALL-E、焼き目の版画展|イーゼルの横にトースト一枚。拾ったパンの焼き目を、美術作品として保存している。|bread painting
ops|rack|beam|r2d2|ルーターの灯台モード|実際のラック脇で青いドロイドが待機。点滅の意味を説明した結果、船員の方が詳しくなった。|radio satellite
project|board|paper|robot|エレベーターの人気投票|CMS区画の白板に丸い投票シール。階数ではなく、閉じるボタンが一位だった。|bell paper
cafe|counter|steam|calcifer|カルシファー、ケトルを担当|既存カウンターの端に小さな火。「ベーコンも焼かせろ」と湯気の中から抗議している。|fire cup
library|shelf|paper|c3po|電池の保証書、古代語で届く|マニュアル棚に一枚の保証書。C-3POが翻訳すると、有効期限だけはとっくに切れていた。|battery paper
garden|plant|trace|walle|WALL-Eの落ち葉標本|屋上の実際の鉢の隣に小箱。拾った葉を大事に並べて、ゴミとは別だと示している。|leaf chest
studio|easel|mirror|robot|冷蔵庫マグネットの小さな個展|イーゼルに立てた金属板に磁石が三つ。作品を動かせるので、学芸員も気が抜けない。|magnet painting
wellness|sofa|trace|holmes|靴下片方事件、洗濯機は無罪|ソファ脇に一足未満の証拠品。探偵は静電気で裏返った袖を見つけ、捜査を終えた。|sock magnifier
focus|desk|paper|robot|電卓、桁あふれで休憩|集中室の机に電卓と小さな旗。「ここまで」の表示に、担当者も一緒に席を立った。|calculator flag
canteen|table|stars|doraemon|電子レンジの星空弁当|食卓の小さな弁当箱に星形のおかず。未来の道具より、型抜きの腕が光っている。|star basket
office|shelf|music|baymax|自動ドアへ拍手の練習|ひだまりの棚前で白いロボットが両手を上げる。開閉のたびに拍手すると、通る人が照れてしまう。|hand bell`,
space: `cockpit|console|scan|alien|宇宙人、操縦卓の研修中|既存コンソールの前に緑の来客。「触るな」の札だけ、宇宙共通語で理解している。|ufo paper
workshop|workbench|orbit|newton|ニュートン、落ちないりんご|作業台の上で一個だけ浮くりんご。万有引力の説明が、今日は少し長引きそうだ。|apple book
ops|monitor|beam|spock|転送装置、靴だけ先着|モニター前の床に片方の靴。本人の到着まで、引継票が寂しく待っている。|shoe ring
library|shelf|paper|astronaut|ロケット燃料、資料だけ持参|棚の前に小瓶と注意書き。実物の持ち込みは禁止なので、中身はただの水になった。|bottle rocket
canteen|table|steam|spock|スポック、地球の給食に興味|食卓の一皿を論理的に観察。好き嫌いの説明だけ、数値化が難しいらしい。|plate bread
workshop|workbench|trace|walle|火星探査車の文具採集|作業台の小箱にクリップが三つ。地球にも未知の金属があると、報告書が賑わっている。|clip robot
garden|plant|feathers|astronaut|アンテナの巣、通信良好|屋上の既存の鉢の脇に小さな鳥の巣。親鳥が留まるたび、受信状態だけ少し変わる。|egg feather
sky|telescope|orbit|leia|レイア、人工衛星の位置合わせ|望遠鏡のそばに小さな衛星模型。銀河の地図に東京湾がないので、まず座標の変換から。|satellite planet
project|board|beam|spock|ワームホールの返品窓口|区画の白板に光る丸が二つ。戻した荷物より先に、返品理由の紙が出てきた。|ring gift
library|table|paper|alien|宇宙語、献立表で翻訳成功|図書室の読書机に記号のメモ。最初に通じた単語が「おかわり」だった。|paper fork
garden|plant|stars|astronaut|月面基地の盆栽、屋上研修|実際の鉢の横に小さなヘルメット。無重力でない水やりを、改めて練習している。|helmet seedling
cafe|counter|steam|flash|光速配達員、冷めたラテ|カウンターに赤い来客と封筒。配達は速いが、休憩の注文を忘れていた。|envelope cup
ops|monitor|scan|alien|宇宙の信号、アラートではない|監視モニターに点と線の通信。翻訳したら、ただの「こんにちは」が大音量だった。|satellite bell
meeting|table|cards|alien|異星人の名刺、裏が吸盤|会議机に小さな名刺が二枚。握手のあと、紙だけがしばらく離れなかった。|card octopus`,
dinosaur: `garden|pond|trace|grant|グラント博士、池の足跡調査|屋上の池の縁に三本指の小さな跡。恐竜が来たのか、植木屋の道具か、博士がしゃがんでいる。|footprint magnifier
workshop|workbench|feathers|grant|始祖鳥の羽、接着剤禁止|作業台に羽根と小さな模型。飛ばす実験より先に、本物の標本の扱いを教わる。|feather plane
studio|easel|chalk|dinosaur|トリケラトプスの帽子図面|イーゼルに三本角の帽子スケッチ。本人は小さな模型で参加し、採寸だけ現地対応。|dinosaur hat
workshop|workbench|ribbon|mammoth|マンモスの毛糸、一本だけ|作業台に太めの糸と編み針。一本でも十分なマフラーになると、担当者が驚いている。|rope shirt
library|shelf|trace|grant|アンモナイトの返却期限|資料棚の小さな化石と貸出カード。「一億年延滞」は桁が多すぎて入力できない。|fossil book
library|table|paper|grant|三葉虫、しおりに似すぎる|読書机の端に小さな化石。薄いからといって本へ挟まないよう、注意書きが増えた。|fossil paper
wellness|bed|heart|grant|恐竜の卵、休憩室で保温|ベッド脇の小さな籠に卵が一つ。湯たんぽと間違わないよう、博士が見張っている。|dinosaurEgg basket
studio|easel|ribbon|dinosaur|首長竜のネクタイ、模型で試着|アトリエの小さな首長竜模型。布の長さではなく、締め方の説明が長くなった。|dinosaur shirt
garden|plant|stars|grant|恐竜の背板、ソーラー見本|屋上の鉢脇に小型の背板模型。発電した電気で、注意書きのLEDだけ光っている。|dinosaur battery
cafe|counter|feathers|grant|翼竜便、割れ物は別便|カウンターに羽根と封筒。卵の配送依頼だけは、博士が丁重に断っている。|feather envelope
library|shelf|paper|fossil|化石の履歴書、職歴が長い|棚前の書類に「白亜紀から」。最後の職場は博物館、退職理由は閉館時間だった。|fossil paper
canteen|table|frost|grant|氷河期の保冷弁当|食卓の小さな保冷材と弁当。冷やしすぎると味見できないと、博士もようやく気づいた。|snow basket
meeting|board|chalk|caveman|石器時代のプレゼン、石板一枚|作戦室の実際の白板に石板の写し。「次のスライド」がなかなか運び込めない。|statue paper
canteen|table|steam|grant|地層ケーキ、発掘しながら試食|食卓の一切れに三色の層。フォークの代わりに小さな刷毛を渡されている。|cake fossil`,
magic: `arena|reactor|stars|harry|ハリー、魔法陣の安全点検|闘技場の既存の装置の足元に小さな光の輪。派手に広げる前に、避難通路を確認している。|wand book
garden|sofa|trail|kiki|キキのほうき、屋上で教習|屋上ベンチ横にほうきと小さなコーン。飛ぶ高さは手すりより下、と今日の講習で決まった。|broom cone
meeting|board|chalk|hermione|ハーマイオニー、呪文を議事録へ|白板に短い文字列。発音の修正だけで、会議の半分が終わりそうだ。|scroll wand
cafe|counter|bubbles|snape|スネイプのドリンクバー監査|カフェのカウンターに小瓶が二本。砂糖を混ぜる順番だけ、やたら厳しく見られている。|potion cup
wellness|sofa|shadow|mcgonagall|マクゴナガル、猫の姿で仮眠|既存ソファの横に縞猫と眼鏡。起こすと先生に戻るので、今日は静かに通ろう。|cat glasses
studio|easel|mirror|queen|魔法の鏡、天気予報を担当|イーゼルの小さな鏡に傘の絵。世界一美しい人より、洗濯物の行方をよく聞かれる。|mirror umbrella
canteen|table|sparks|harry|召喚されたのはスプーン一本|食卓の皿の隣にフォークが一本だけ増えた。大量召喚は後片づけが大変なので、今日はここまで。|fork plate
library|shelf|stars|hermione|透明な本、返却確認が難航|資料棚の前にラベルだけ浮く。ハーマイオニーが貸出台帳を指さして、確かに一冊あると言う。|book glasses
focus|desk|paper|wizard|ガンダルフの帽子から領収書|集中室の机に帽子と紙束。魔法の杖より、経理の照合の方が今日は強い。|hat paper
cafe|table|portal|doctor|ドクター、ティーカップだけ転送|実際の小卓に小さな光の輪。本人は到着したが、紅茶はまだロンドンにあるらしい。|cup ring
studio|easel|music|sakura|さくらの杖、指揮棒デビュー|イーゼルの譜面の前に小さな杖。魔法より先に、曲の入りを合わせる練習から。|wand note
project|board|paper|snape|承認の呪文、レビューは別|CMS区画の白板前に判子。「すべて承認」の魔法にも、コードレビューは通してもらう。|stamp paper
library|shelf|feathers|harry|飛ぶ本、書架の前で待機|本棚の前に一冊だけ浮く本。空中を巡回させず、返却先のラベルを待っている。|book feather
workshop|workbench|ribbon|witch|魔女の洗濯表示、杖使用不可|作業台に小さな帽子と布。タグを読むと、魔法洗いだけは丸く取り消されていた。|hat shirt`,
food: `canteen|table|steam|kirby|カービィ、プリンは一人一個|食堂の実際の食卓に一個だけプリン。量ではなく、ちゃんと味わう練習をしている。|pudding fork
canteen|buffet|steam|anpanman|アンパンマン、パンの差し入れ|配膳台の小籠に丸いパン。自分の顔は無事なまま、予備をちゃんと用意してきた。|bread basket
canteen|table|cards|sanji|サンジ、回らない寿司を提供|食卓の一皿に寿司が三貫。回転装置を使う前に、冷めないうちに食べてほしいそうだ。|sushi plate
canteen|buffet|steam|naruto|ナルト、一楽の出張カウンター|既存の配膳台に一杯のラーメン。影分身の分は食券が必要だと確認している。|noodle ticket
cafe|table|trace|remy|レミー、チーズの穴を点検|小さなカフェ卓に一切れのチーズ。会議室にするには狭いので、今日はそのまま食材へ。|cheese magnifier
arcade|arcade|pixels|donkey|ドンキーコング、バナナの持込確認|筐体の前に小さな樽とバナナ。皮をコースへ投げない約束を、先に取りつけられた。|banana chest
canteen|table|steam|ninja|ミュータント・タートルズのピザ会|食卓の一枚を四つに分ける作戦。下水道の地図より、最後の一切れの行方が難しい。|pizza mask
cafe|counter|steam|homer|ホーマー、ドーナツの穴を見つめる|カウンターの皿に一個のドーナツ。なくなった中心部の料金について、静かに交渉中。|donut cup
canteen|buffet|steam|popeye|ポパイ、ほうれん草の追加希望|配膳台の横に空の缶。今日はちゃんと野菜の皿から食べるよう、料理人にすすめられた。|carrot pan
canteen|table|paper|chihiro|千尋、おにぎりでひと息|食堂の食卓に普通のおにぎり。大きな出来事のあとも、塩むすびの大きさは変わらない。|sushi cup
cafe|counter|frost|elsa|エルサ、アイスの溶け方相談|カフェの一皿に小さなアイス。全部凍らせる前に、食べる人の歯へ配慮している。|icecream fork
cafe|table|steam|pooh|プーさん、パンケーキより蜂蜜|小さなカフェ卓に二枚のパンケーキ。持参の瓶の方が重くて、椅子の横へ置き直した。|bread bottle
cafe|counter|steam|porco|ポルコ、深煎りを一杯だけ|カウンターの脇に飛行帽。空を飛ぶ前のコーヒーは、格好より眠気対策らしい。|cup hat
canteen|table|steam|goku|悟空、弁当のおかずを数える|食卓の弁当は普通サイズ。「足りる？」に全員がうなずいたので、とりあえず一個から始める。|basket meat`,
festival: `garden|sofa|ribbon|festival|屋上縁日、ベンチ一台分|既存のベンチ脇に小さな提灯とお盆。屋台を建てず、通れる幅を残したお祭りになった。|lantern candy
workshop|workbench|music|inventor|観覧車の模型、試運転中|作業台に一台だけの小さな観覧車。乗れるのは消しゴムまで、と安全確認が終わった。|ferris eraser
arcade|table|cards|festival|付箋すくい、卓上で開催|ゲーセンの小卓に小さな容器。すくった付箋のTODOは、持ち帰らなくてよいルール。|paper ring
arcade|arcade|pixels|usopp|ウソップ、射的の景品を申請|筐体の横に小さな的とトロフィー。自慢話だけは、命中率と分けて集計している。|trophy star
cafe|counter|steam|festival|綿あめ雲、コーヒーの上だけ|カウンターのカップに小さな白い雲。天井まで広げないので、空調担当も安心した。|cloud cup
studio|easel|mirror|noface|カオナシ、仮面のデザイン相談|イーゼル前の黒い来客。表情差分を頼んだら、静かに一枚だけ元の顔を出してきた。|mask painting
arcade|table|music|mime|大道芸、卓上ボール三個まで|ゲーセンのテーブル脇で小さなジャグリング。増やすほど危ないので、三個がちょうどよい。|ball hat
garden|sofa|music|festival|チンドン屋の屋上リハーサル|ベンチ脇に小太鼓とラッパ。下の集中室へ響かない音量で、にぎやかさを調整中。|drum trumpet
studio|table|cards|kaito|キッド、箱より先に領収書を消す|作業テーブルの小箱は無事。手品で消えた経費の紙だけ、もう一度出してほしい。|chest paper
office|shelf|ribbon|festival|パレード先頭、館内図を確認|ひだまりの棚前に小さな旗。行進する前に、入口と出口を間違えないよう打ち合わせ中。|flag scroll
sky|telescope|stars|fireworker|花火師、窓辺で打上図を描く|望遠鏡脇の紙に小さな光の輪。室内では上げず、夜空の予定だけ見せてもらう。|star pencil
canteen|table|music|rabbit|月の餅つき、食卓サイズ|実際の食卓に小さな臼の見本。兎の掛け声より、休憩中の手拍子の方が揃っている。|hammer dumpling
arcade|table|cards|festival|福引きの玉、最後は参加賞|ゲーセンの小卓に玉が三つ。色より先に、参加した人全員へお菓子を渡している。|ball gift
workshop|workbench|paper|walle|WALL-E、お祭りの紙吹雪を分別|作業台の端に赤と白の小片。全部宝物にする案は、箱の容量で却下された。|paper broom`,
detective: `canteen|table|trace|conan|コナン、消えたおやつの現場検証|実際の食卓に空の皿とパンくず。犯人の名前より、次の差し入れ時刻が先に判明した。|plate magnifier
library|table|paper|holmes|シャーロック、手順書の矛盾を解く|図書室の読書机に旧版と新版。密室より難しいのは、どちらが正しい運用かという謎だった。|book magnifier
focus|desk|shadow|conan|机の下に逆向きの足跡|集中室のデスク横に小さな靴跡。椅子を後ろ向きで引いただけ、と名探偵は少し残念そう。|footprint shoe
library|shelf|trace|holmes|虫眼鏡の忘れ物、持ち主は隣|資料棚の前に虫眼鏡が一つ。探している探偵の手には、すでに同じ物がもう一本ある。|magnifier hat
project|board|chalk|conan|鍵の数と権限の数が合わない|案件部屋の白板に鍵のスケッチ。物理鍵の複製より、アカウント棚卸しが先だと結論が出た。|key paper
studio|easel|trace|holmes|指紋の絵、作者の署名がない|イーゼルの絵に丸い指紋。すべて本人の指だったので、本人確認だけが妙に簡単。|fingerprint painting
canteen|table|paper|conan|暗号の正体は麺の固さ|食堂の食卓に記号の注文メモ。解くと「かため・替え玉」だったので、捜査は昼食へ移行。|paper noodle
studio|easel|shadow|cat|写真の猫、額から出る|イーゼル前に猫と写真。印刷された方まであくびをするので、作品の版管理に困っている。|camera cat
library|table|ribbon|holmes|赤い糸、猫が先に解いた|読書机の小さな資料と糸。探偵の相関図は、猫にとっては絶好の遊び場だった。|rope paper
meeting|board|chalk|zenigata|犯行予告、誤字だけ指摘|作戦室の既存白板に一枚の予告状。銭形は追跡前に、日時の表記揺れを直している。|paper pencil
ops|monitor|scan|holmes|消えた金貨、ログには正常|管制室のモニターに会計記録。盗難ではなく、単に別勘定へ移しただけとわかった。|coin calculator
office|shelf|trace|conan|落とし物の傘、全員が心当たり|ひだまりの棚脇に普通の傘。名前を書くという最小の対策が、今日の名推理になった。|umbrella paper
studio|easel|mirror|holmes|似顔絵の容疑者、鏡の中|イーゼル前に手鏡とスケッチ。作者が自分に似せすぎたせいで、捜査線上へ浮かんでしまった。|painting mirror
library|table|cards|conan|アリバイ時計、全部五分進み|読書机に小さな時計とメモ。全員遅刻しない仕組みだったので、事件性はなかった。|clock paper`,
comic: `office|desk|portal|doraemon|ドラえもん、どこでもドアの入館申請|ひだまりのデスク脇に人サイズのピンクの扉。出入口を増やす前に、総務へちゃんと相談している。|door bell
canteen|table|steam|goku|悟空、空の皿だけ先に積む|食堂の実際の食卓に空皿が三枚。「追加は食べ終わってから」と言われ、素直に待っている。|plate meat
meeting|table|ribbon|luffy|ルフィの名札、伸ばしすぎ注意|会議机の端に名札と長めのひも。隣の人の資料を巻き込まない長さに調整中。|card rope
canteen|buffet|shadow|naruto|ナルト、影分身の食券不足|配膳台の前に同じ忍者が二人。食券は一枚なので、分身を解いてから並び直した。|noodle ticket
studio|easel|chalk|arale|アラレちゃん、地球儀の持ち方講座|イーゼル前に普通の地球儀。割ってはいけない備品だと聞いて、両手でそっと支えている。|planet ruler
canteen|buffet|steam|anpanman|アンパンマン、工房から焼きたて便|食堂の配膳台に籠一つ分のパン。顔の交換ではなく、普通の差し入れなので安心。|bread flower
cafe|counter|feathers|kiki|キキ、受領印をジジに頼めない|カウンターの小箱の隣に黒猫。猫の肉球でも受領できるか、伝票を見直している。|cat gift stamp
garden|plant|blossom|totoro|トトロ、屋上の鉢を巡回|既存の植木鉢の前にトトロと小さな種。新しい森を床に増やさず、一本ずつ育てる日。|seed umbrella
ops|monitor|scan|conan|コナン、蝶ネクタイの音声確認|既存モニター前に小さなマイク。声を変える前に、全館放送へつながっていないか確認中。|bowtie mic
workshop|workbench|sparks|pikachu|ピカチュウ、静電気の放電担当|作業台に小さな電池。全館停電は起こさず、指先のぱちっとだけ実演している。|battery lightning
cafe|table|suction|kirby|カービィ、吸い込みはパンくずだけ|小さなカフェ卓に一皿と数粒のくず。カップは残す約束をしてから、掃除が始まった。|bread plate
workshop|workbench|paper|mario|マリオ、配管図を読んでから|作業台に配管の模型と図面。何でも土管へ入る前に、水道設備か確認している。|pipe scroll
sky|sofa|stars|sailor|セーラームーン、月に代わって休憩|ラウンジのソファ脇に小さな月の杖。今日は罰ではなく、お茶の時間を知らせている。|moon cup
focus|desk|paper|snoopy|スヌーピー、机で執筆中|集中室の本物のデスクに紙が一枚。「暗い嵐の夜だった」から先が、なかなか増えない。|paper pencil`,
kaiju: `sky|telescope|outside|godzilla|ゴジラ、東京湾で信号待ち|ラウンジの窓の外に背びれ。レインボーブリッジを壊さず渡る経路を、じっと考えている。|dinosaur
garden|sofa|outside|mothra|モスラ、屋上の風に乗る|屋上の外側を大きな羽が通過。鉢もベンチもそのまま、影だけが静かに横切っていく。|butterfly
sky|telescope|outside|kong|キングコング、塔の点検員|ラウンジの窓の向こうで巨猿が塔をのぞく。手に持った点検票だけ、人間用では小さすぎた。|monkey
sky|sofa|outside|zeppelin|飛行船の広告、文字が小さい|ラウンジの窓の外に飛行船。広告の文字を読むため、望遠鏡の予約が一枠埋まった。|balloon
ops|monitor|scan|mulder|モルダー、UFO映像を解析|窓のない管制室では監視モニターで確認。拡大した映像は、たぶんカフェの照明の映り込みだった。|ufo camera
garden|sofa|outside|luckycat|巨大な招き猫、湾岸へ招く|屋上の外側に猫の大きな影。手を振るたびに風が来るので、洗濯物は今日は室内へ。|cat
sky|telescope|outside|laputa|ラピュタ、窓辺を静かに通過|ラウンジの窓の外に空の城。会議の開始より先に、みんなが一度だけ席を立った。|castle
garden|sofa|outside|haku|ハク、屋上の外を旋回|屋上の向こうに細い白い竜。手すりより内側へは入らず、風の道だけを借りている。|dragon
sky|telescope|outside|gamera|ガメラ、東京湾を飛び越える|ラウンジの窓の外を回る甲羅。航路確認のあと、室内のコーヒーだけ小さく揺れた。|turtle
garden|sofa|outside|penguin|巨大ペンギン、湾岸の日陰探し|屋上の外を黒白の影が通る。暑い日でも、オフィスの冷房を分けるには大きすぎる。|penguin
sky|telescope|outside|rainbow|二重の虹、窓の端から端へ|ラウンジの窓の外に七色が二本。どちらの虹にも、館内の椅子は一脚も動かされていない。|rainbow
sky|sofa|outside|whale|宇宙クジラ、星空の回遊路|ラウンジの窓の外にゆっくり泳ぐ影。潮ではなく、星の粒だけを小さく残していく。|whale
cockpit|viewport|screen|gundam|巨大ロボット同士の道の譲り合い|操縦室の実際のスクリーンに来客機。戦わず、先にどうぞの合図で仲良く通過した。|robot sign
sky|telescope|outside|train|銀河鉄道、窓の外に終電案内|ラウンジの窓の外に星のレール。乗る予定はないが、終電だけはなぜか気になる。|train
sky|table|stars|doctor|ドクターの砂時計、残り五分|ラウンジの小卓に普通サイズの砂時計。宇宙の危機ではなく、次の会議までのカウントだった。|hourglass star`,
} as const;
