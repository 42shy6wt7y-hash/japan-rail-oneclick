import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const inputPath = process.argv[2] || "work/n02/N02-22/UTF-8/N02-22_Station.geojson";
const outputPath = process.argv[3] || "js/generated/rail-network.generated.js";

function centerOfGeometry(geometry) {
  const coords = geometry?.coordinates || [];
  const points = geometry?.type === "LineString" ? coords : coords.flat(Infinity);
  const pairs = [];
  if (geometry?.type === "LineString") {
    for (const point of coords) pairs.push(point);
  }
  if (!pairs.length) return [0, 0];
  const sum = pairs.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [sum[0] / pairs.length, sum[1] / pairs.length];
}

function romanizeJapaneseStation(name) {
  const known = {
    "東京": "Tokyo",
    "京都": "Kyoto",
    "名古屋": "Nagoya",
    "新大阪": "Shin-Osaka",
    "大阪": "Osaka",
    "上諏訪": "Kamisuwa",
    "塩尻": "Shiojiri",
    "中津川": "Nakatsugawa",
    "金沢": "Kanazawa",
    "博多": "Hakata",
    "札幌": "Sapporo"
  };
  return known[name] || "";
}

function simplifiedAlias(name) {
  return name
    .replaceAll("諏", "诹")
    .replaceAll("訪", "访")
    .replaceAll("塩", "盐")
    .replaceAll("沢", "泽")
    .replaceAll("広", "广")
    .replaceAll("島", "岛")
    .replaceAll("児", "儿");
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function lineKey(properties) {
  return `${properties.N02_004}::${properties.N02_003}`;
}

function classifyMode(properties) {
  if (properties.N02_002 === "1" || /新幹線/.test(properties.N02_003)) return "shinkansen";
  if (properties.N02_002 === "3" || properties.N02_002 === "4") return "metro";
  if (properties.N02_002 === "5") return "tram";
  return "rail";
}

function sellerFor(properties) {
  const operator = properties.N02_004 || "";
  if (operator.includes("東海旅客鉄道") && /新幹線/.test(properties.N02_003)) return "smartEx";
  if (operator.includes("東海旅客鉄道")) return "jrCentral";
  if (operator.includes("東日本旅客鉄道")) return "jrEast";
  if (operator.includes("西日本旅客鉄道")) return "jrWest";
  if (operator.includes("九州旅客鉄道")) return "jrKyushu";
  if (operator.includes("北海道旅客鉄道")) return "jrHokkaido";
  return "manual";
}

function minutesBetween(a, b, mode) {
  const dx = (a.lon - b.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dy = a.lat - b.lat;
  const km = Math.sqrt(dx * dx + dy * dy) * 111.32;
  const speed = mode === "shinkansen" ? 180 : mode === "metro" ? 38 : 64;
  return Math.max(2, Math.round((km / speed) * 60) + 1);
}

function fareEstimate(minutes, mode) {
  const base = mode === "shinkansen" ? 1800 : 170;
  const perMinute = mode === "shinkansen" ? 72 : mode === "metro" ? 18 : 24;
  return Math.round((base + minutes * perMinute) / 10) * 10;
}

const source = JSON.parse(readFileSync(inputPath, "utf8"));
const stationGroups = new Map();
const lineBuckets = new Map();
const seenMemberships = new Set();

for (const feature of source.features) {
  const p = feature.properties;
  const groupCode = p.N02_005g || p.N02_005c;
  if (!groupCode || !p.N02_005) continue;
  const [lon, lat] = centerOfGeometry(feature.geometry);
  if (!stationGroups.has(groupCode)) {
    const romanized = romanizeJapaneseStation(p.N02_005);
    const aliases = [...new Set([
      p.N02_005,
      simplifiedAlias(p.N02_005),
      romanized
    ].filter(Boolean))];
    stationGroups.set(groupCode, {
      id: `n02-${groupCode}`,
      code: groupCode,
      name: p.N02_005,
      aliases,
      lat,
      lon,
      lines: []
    });
  }

  const station = stationGroups.get(groupCode);
  const key = lineKey(p);
  const membershipKey = `${groupCode}::${key}`;
  if (!seenMemberships.has(membershipKey)) {
    seenMemberships.add(membershipKey);
    station.lines.push({ line: p.N02_003, operator: p.N02_004, mode: classifyMode(p) });
  }

  if (!lineBuckets.has(key)) {
    lineBuckets.set(key, {
      line: p.N02_003,
      operator: p.N02_004,
      mode: classifyMode(p),
      seller: sellerFor(p),
      stations: []
    });
  }
  lineBuckets.get(key).stations.push({
    id: `n02-${groupCode}`,
    name: p.N02_005,
    lat,
    lon
  });
}

const stations = [...stationGroups.values()].map((station) => ({
  ...station,
  aliases: [...new Set(station.aliases)],
  lines: station.lines.slice(0, 12)
}));

const stationById = new Map(stations.map((station) => [station.id, station]));
const edges = [];
const edgeSeen = new Set();

for (const bucket of lineBuckets.values()) {
  const unique = [];
  const ids = new Set();
  for (const station of bucket.stations) {
    if (!ids.has(station.id)) {
      ids.add(station.id);
      unique.push(station);
    }
  }
  if (unique.length < 2) continue;

  const lonSpan = Math.max(...unique.map((station) => station.lon)) - Math.min(...unique.map((station) => station.lon));
  const latSpan = Math.max(...unique.map((station) => station.lat)) - Math.min(...unique.map((station) => station.lat));
  unique.sort((a, b) => {
    const primary = lonSpan >= latSpan ? a.lon - b.lon : a.lat - b.lat;
    return primary || a.name.localeCompare(b.name, "ja");
  });

  for (let index = 0; index < unique.length - 1; index += 1) {
    const from = unique[index];
    const to = unique[index + 1];
    if (from.id === to.id) continue;
    const a = stationById.get(from.id);
    const b = stationById.get(to.id);
    const minutes = minutesBetween(a, b, bucket.mode);
    const edgeKey = [from.id, to.id, bucket.operator, bucket.line].join("::");
    const reverseKey = [to.id, from.id, bucket.operator, bucket.line].join("::");
    if (edgeSeen.has(edgeKey) || edgeSeen.has(reverseKey)) continue;
    edgeSeen.add(edgeKey);
    edges.push({
      from: from.id,
      to: to.id,
      minutes,
      fare: fareEstimate(minutes, bucket.mode),
      line: bucket.line,
      operator: bucket.operator,
      mode: bucket.mode,
      seller: bucket.seller
    });
  }
}

const network = {
  source: {
    name: "MLIT National Land Numerical Information Railway Data N02",
    year: 2022,
    url: "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v3_1.html"
  },
  stations,
  edges
};

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
const js = `(function attachGeneratedRailNetwork(global) {\n  global.JR_GENERATED_NETWORK = ${JSON.stringify(network)};\n})(typeof window !== "undefined" ? window : globalThis);\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = globalThis.JR_GENERATED_NETWORK;\n}\n`;
writeFileSync(outputPath, js, "utf8");
console.log(JSON.stringify({
  source: inputPath,
  output: outputPath,
  stations: stations.length,
  edges: edges.length
}, null, 2));
