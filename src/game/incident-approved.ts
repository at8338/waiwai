// The nine scenes explicitly selected by the user. IDs and concepts remain intact.
export const APPROVED_INCIDENTS = {
  "meteor-01": {
    "title": "隕石、着席しました",
    "discovery": "天井を抜けて部屋半分にクレーター。「配属先はこちら」と書いた付箋だけ無傷。",
    "scene": {
      "layout": "focus",
      "props": [
        "planet"
      ],
      "special": "meteor"
    }
  },
  "thief-01": {
    "title": "泥棒が入ったらしい",
    "discovery": "開いた金庫と足跡。でも盗まれたのは月曜のカレンダーだけ。",
    "scene": {
      "layout": "focus",
      "props": [
        "safe"
      ],
      "special": "thief"
    }
  },
  "flood-01": {
    "title": "配管破裂で室内が海",
    "discovery": "部屋いっぱいの水に机の天板が浮く。給湯室の蛇口は「弱」のまま。",
    "scene": {
      "layout": "focus",
      "props": [
        "boat"
      ],
      "special": "flood"
    }
  },
  "flood-03": {
    "title": "室内で雪合戦が始まった",
    "discovery": "椅子の陰に雪玉の備蓄。雪だるま審判だけは絶対に逃げない。",
    "scene": {
      "layout": "snowfield",
      "props": [
        "snowman",
        "snow",
        "flag"
      ]
    }
  },
  "flood-04": {
    "title": "一角だけ砂漠化",
    "discovery": "床を砂丘が覆い、給水所にサボテンが並ぶ。自販機の氷が人気商品。",
    "scene": {
      "layout": "desert",
      "props": [
        "cactus",
        "bottle",
        "sun"
      ]
    }
  },
  "santa-01": {
    "title": "季節外れのサンタ出勤",
    "discovery": "ソリとプレゼントが到着。袋の中に全員分の贈り物はあるが、自分の入館証だけ見つからない。",
    "scene": {
      "layout": "focus",
      "props": [
        "gift"
      ],
      "special": "santa"
    }
  },
  "delorean-01": {
    "title": "デロリアンが横壁に刺さった",
    "discovery": "壁から銀の車体が半分。炎のタイヤ跡の先に「駐車はご遠慮ください」。",
    "scene": {
      "layout": "focus",
      "props": [
        "car"
      ],
      "special": "delorean"
    }
  },
  "delorean-13": {
    "title": "ヘリポートになった会議机",
    "discovery": "卓上に着陸マーク。乗客は消しゴム三名、全員窓側希望。",
    "scene": {
      "layout": "helipad",
      "props": [
        "helicopter",
        "desk",
        "eraser"
      ]
    }
  },
  "terminator-01": {
    "title": "ターミネーターが掃射した",
    "discovery": "壁と机は弾痕だらけ、床には薬きょうの山。本人は「プリンター保守の訪問先を間違えた」と言っている。",
    "scene": {
      "layout": "focus",
      "props": [
        "robot"
      ],
      "special": "terminator"
    }
  }
} as const;
