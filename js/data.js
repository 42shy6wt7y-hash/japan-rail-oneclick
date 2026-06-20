(function attachData(global) {
  const stations = [
    { id: "tokyo", name: "东京", aliases: ["Tokyo", "東京"], region: "kanto" },
    { id: "ueno", name: "上野", aliases: ["Ueno", "上野"], region: "kanto" },
    { id: "shinjuku", name: "新宿", aliases: ["Shinjuku", "新宿"], region: "kanto" },
    { id: "shinagawa", name: "品川", aliases: ["Shinagawa", "品川"], region: "kanto" },
    { id: "yokohama", name: "横滨", aliases: ["Yokohama", "横浜"], region: "kanto" },
    { id: "hachioji", name: "八王子", aliases: ["Hachioji", "八王子"], region: "kanto" },
    { id: "kofu", name: "甲府", aliases: ["Kofu", "甲府"], region: "chubu" },
    { id: "kamisuwa", name: "上诹访", aliases: ["Kamisuwa", "Kami-Suwa", "上諏訪", "上诹访"], region: "chubu" },
    { id: "shiojiri", name: "盐尻", aliases: ["Shiojiri", "塩尻", "盐尻"], region: "chubu" },
    { id: "matsumoto", name: "松本", aliases: ["Matsumoto", "松本"], region: "chubu" },
    { id: "nakatsugawa", name: "中津川", aliases: ["Nakatsugawa", "中津川"], region: "chubu" },
    { id: "nagoya", name: "名古屋", aliases: ["Nagoya", "名古屋"], region: "chubu" },
    { id: "kyoto", name: "京都", aliases: ["Kyoto", "京都"], region: "kansai" },
    { id: "shin-osaka", name: "新大阪", aliases: ["Shin-Osaka", "新大阪"], region: "kansai" },
    { id: "nara", name: "奈良", aliases: ["Nara", "奈良"], region: "kansai" },
    { id: "kanazawa", name: "金泽", aliases: ["Kanazawa", "金沢", "金泽"], region: "hokuriku" },
    { id: "toyama", name: "富山", aliases: ["Toyama", "富山"], region: "hokuriku" },
    { id: "hiroshima", name: "广岛", aliases: ["Hiroshima", "広島", "广岛"], region: "chugoku" },
    { id: "okayama", name: "冈山", aliases: ["Okayama", "岡山", "冈山"], region: "chugoku" },
    { id: "hakata", name: "博多", aliases: ["Hakata", "Fukuoka", "福冈", "福岡", "博多"], region: "kyushu" },
    { id: "kagoshima", name: "鹿儿岛中央", aliases: ["Kagoshima-Chuo", "Kagoshima", "鹿児島中央", "鹿儿岛"], region: "kyushu" },
    { id: "sendai", name: "仙台", aliases: ["Sendai", "仙台"], region: "tohoku" },
    { id: "morioka", name: "盛冈", aliases: ["Morioka", "盛岡", "盛冈"], region: "tohoku" },
    { id: "shin-aomori", name: "新青森", aliases: ["Shin-Aomori", "Aomori", "青森", "新青森"], region: "tohoku" },
    { id: "shin-hakodate", name: "新函馆北斗", aliases: ["Shin-Hakodate-Hokuto", "Hakodate", "函馆", "函館"], region: "hokkaido" },
    { id: "sapporo", name: "札幌", aliases: ["Sapporo", "札幌"], region: "hokkaido" }
  ];

  const officialSellers = {
    smartEx: {
      id: "smartEx",
      name: "Smart EX",
      url: "https://smart-ex.jp/en/index.php",
      coverage: "东海道、山阳、九州新干线",
      automation: "extension-overlay"
    },
    jrCentral: {
      id: "jrCentral",
      name: "JR-CENTRAL Reservation",
      url: "https://global.jr-central.co.jp/en/",
      coverage: "JR 东海在来线、中央西线及东海道相关服务",
      automation: "manual-confirm"
    },
    jrEast: {
      id: "jrEast",
      name: "JR-EAST Train Reservation",
      url: "https://www.eki-net.com/en/jreast-train-reservation/top/Index",
      coverage: "JR 东日本、北海道、北陆部分新干线",
      automation: "extension-overlay"
    },
    jrWest: {
      id: "jrWest",
      name: "JR-WEST ONLINE TRAIN RESERVATION",
      url: "https://www.westjr.co.jp/global/en/ticket/",
      coverage: "JR 西日本、北陆、山阳及关西特急",
      automation: "extension-overlay"
    },
    jrKyushu: {
      id: "jrKyushu",
      name: "JR KYUSHU RAIL PASS Online Booking",
      url: "https://www.jrkyushu.co.jp/english/railpass/railpass.html",
      coverage: "九州区域及部分九州新干线",
      automation: "manual-confirm"
    },
    jrHokkaido: {
      id: "jrHokkaido",
      name: "JR Hokkaido Reservation Guide",
      url: "https://www.jrhokkaido.co.jp/global/english/ticket/",
      coverage: "北海道区域",
      automation: "manual-confirm"
    },
    manual: {
      id: "manual",
      name: "Official / station counter confirmation",
      url: "https://www.jreast.co.jp/multi/en/",
      coverage: "未映射到特定在线售票渠道的铁路公司",
      automation: "manual-confirm"
    }
  };

  const edges = [
    ["tokyo", "shinagawa", 7, 180, "JR 山手/东海道线", "local", "jrEast", "green"],
    ["tokyo", "ueno", 5, 170, "JR 山手线", "local", "jrEast", "green"],
    ["shinagawa", "yokohama", 18, 310, "JR 东海道线", "local", "jrEast", "green"],
    ["tokyo", "hachioji", 53, 830, "JR 中央线快速", "rapid", "jrEast", "green"],
    ["shinjuku", "hachioji", 39, 490, "JR 中央线快速", "rapid", "jrEast", "green"],
    ["hachioji", "kofu", 58, 1580, "JR 中央本线 Azusa", "limited-express", "jrEast", "green", { jrPass: true }],
    ["kofu", "kamisuwa", 64, 2310, "JR 中央本线 Azusa", "limited-express", "jrEast", "green", { jrPass: true }],
    ["kamisuwa", "shiojiri", 25, 510, "JR 中央本线", "local", "jrEast", "green", { jrPass: true }],
    ["shiojiri", "matsumoto", 16, 240, "JR 篠之井线", "local", "jrEast", "green", { jrPass: true }],
    ["shiojiri", "nakatsugawa", 74, 1340, "JR 中央西线", "rapid", "jrCentral", "blue", { jrPass: true }],
    ["nakatsugawa", "nagoya", 80, 4510, "特急 Shinano", "limited-express", "jrCentral", "blue", { jrPass: true }],
    ["tokyo", "nagoya", 101, 11290, "东海道新干线 Nozomi", "shinkansen", "smartEx", "blue", { passExcluded: true, luggageReservation: true }],
    ["tokyo", "nagoya", 112, 11290, "东海道新干线 Hikari", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["tokyo", "kyoto", 135, 14170, "东海道新干线 Nozomi", "shinkansen", "smartEx", "blue", { passExcluded: true, luggageReservation: true }],
    ["tokyo", "kyoto", 160, 14170, "东海道新干线 Hikari", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["nagoya", "kyoto", 34, 5910, "东海道新干线 Nozomi", "shinkansen", "smartEx", "blue", { passExcluded: true, luggageReservation: true }],
    ["nagoya", "kyoto", 41, 5910, "东海道新干线 Hikari", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["kyoto", "shin-osaka", 14, 3070, "东海道新干线", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["kyoto", "nara", 46, 720, "JR 奈良线 Miyakoji", "rapid", "jrWest", "green"],
    ["shin-osaka", "okayama", 45, 6460, "山阳新干线 Nozomi", "shinkansen", "smartEx", "blue", { passExcluded: true, luggageReservation: true }],
    ["shin-osaka", "okayama", 50, 6460, "山阳新干线 Sakura", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["okayama", "hiroshima", 36, 5610, "山阳新干线 Nozomi", "shinkansen", "smartEx", "blue", { passExcluded: true, luggageReservation: true }],
    ["okayama", "hiroshima", 41, 5610, "山阳新干线 Sakura", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["hiroshima", "hakata", 62, 9460, "山阳新干线 Sakura", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["hakata", "kagoshima", 97, 10110, "九州新干线 Sakura", "shinkansen", "jrKyushu", "coral", { jrPass: true }],
    ["tokyo", "kanazawa", 150, 14180, "北陆新干线 Kagayaki", "shinkansen", "jrEast", "teal", { jrPass: true }],
    ["tokyo", "toyama", 128, 12760, "北陆新干线 Kagayaki", "shinkansen", "jrEast", "teal", { jrPass: true }],
    ["toyama", "kanazawa", 22, 2860, "北陆新干线 Tsurugi", "shinkansen", "jrWest", "teal", { jrPass: true }],
    ["kanazawa", "kyoto", 133, 7720, "Thunderbird + 北陆新干线", "limited-express", "jrWest", "teal", { jrPass: true, transferRequired: true }],
    ["kanazawa", "shin-osaka", 155, 9410, "Thunderbird + 北陆新干线", "limited-express", "jrWest", "teal", { jrPass: true, transferRequired: true }],
    ["tokyo", "sendai", 90, 11210, "东北新干线 Hayabusa", "shinkansen", "jrEast", "green", { jrPass: true }],
    ["sendai", "morioka", 39, 6790, "东北新干线 Hayabusa", "shinkansen", "jrEast", "green", { jrPass: true }],
    ["morioka", "shin-aomori", 65, 6710, "东北新干线 Hayabusa", "shinkansen", "jrEast", "green", { jrPass: true }],
    ["shin-aomori", "shin-hakodate", 61, 7520, "北海道新干线 Hayabusa", "shinkansen", "jrEast", "green", { jrPass: true }],
    ["shin-hakodate", "sapporo", 205, 9440, "特急 Hokuto", "limited-express", "jrHokkaido", "yellow", { jrPass: true }],
    ["tokyo", "shin-osaka", 147, 14720, "东海道新干线 Nozomi", "shinkansen", "smartEx", "blue", { passExcluded: true, luggageReservation: true }],
    ["tokyo", "shin-osaka", 174, 14720, "东海道新干线 Hikari", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["kyoto", "hiroshima", 96, 11300, "东海道/山阳新干线 Nozomi", "shinkansen", "smartEx", "blue", { passExcluded: true, luggageReservation: true }],
    ["kyoto", "hiroshima", 112, 11300, "东海道/山阳新干线 Sakura/Hikari", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["shin-osaka", "hakata", 149, 16020, "山阳/九州新干线 Sakura", "shinkansen", "smartEx", "blue", { jrPass: true, luggageReservation: true }],
    ["nagoya", "kanazawa", 156, 9350, "Shirasagi + 北陆新干线", "limited-express", "jrWest", "teal", { jrPass: true, transferRequired: true }]
  ];

  global.JR_DATA = {
    stations,
    officialSellers,
    edges: edges.map(([from, to, minutes, fare, line, mode, seller, color, flags = {}]) => ({
      from,
      to,
      minutes,
      fare,
      line,
      mode,
      seller,
      color,
      flags
    }))
  };
})(typeof window !== "undefined" ? window : globalThis);
