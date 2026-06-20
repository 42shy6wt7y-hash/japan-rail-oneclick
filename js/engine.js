(function attachEngine(global) {
  const DATA = global.JR_DATA;
  const GENERATED = global.JR_GENERATED_NETWORK;
  const MIN_TRANSFER = 10;
  const MAX_EXPANSIONS = 18000;
  let mergedNetworkCache = null;

  function exactStationIndex(stations) {
    const index = new Map();
    for (const station of stations) {
      for (const name of stationNames(station)) {
        const normalized = normalizeText(name);
        if (normalized && !index.has(normalized)) index.set(normalized, station);
      }
    }
    return index;
  }

  function mergedNetwork() {
    if (mergedNetworkCache) return mergedNetworkCache;
    const generatedStations = GENERATED?.stations?.length ? GENERATED.stations.map((station) => ({
      ...station,
      aliases: [...new Set([station.name, ...(station.aliases || [])].filter(Boolean))]
    })) : [];
    const generatedEdges = GENERATED?.edges?.length ? GENERATED.edges.map((edge) => ({
      ...edge,
      color: edge.mode === "shinkansen" ? "blue" : edge.mode === "metro" ? "teal" : "green",
      flags: edge.flags || {},
      source: "generated"
    })) : [];

    if (!generatedStations.length) {
      mergedNetworkCache = {
        stations: DATA.stations,
        edges: DATA.edges.map((edge) => ({ ...edge, flags: edge.flags || {}, priority: "manual" }))
      };
      return mergedNetworkCache;
    }

    const stationIndex = exactStationIndex(generatedStations);
    const stationById = new Map(generatedStations.map((station) => [station.id, station]));
    const manualToCanonical = new Map();

    for (const manual of DATA.stations) {
      const canonical = stationNames(manual)
        .map((name) => stationIndex.get(normalizeText(name)))
        .find(Boolean);

      if (canonical) {
        canonical.aliases = [...new Set([...canonical.aliases, manual.name, ...(manual.aliases || [])].filter(Boolean))];
        manualToCanonical.set(manual.id, canonical.id);
      } else {
        stationById.set(manual.id, { ...manual, aliases: [...new Set([manual.name, ...(manual.aliases || [])])] });
        manualToCanonical.set(manual.id, manual.id);
      }
    }

    const manualEdges = DATA.edges.map((edge) => ({
      ...edge,
      from: manualToCanonical.get(edge.from) || edge.from,
      to: manualToCanonical.get(edge.to) || edge.to,
      flags: edge.flags || {},
      priority: "manual",
      source: "manual"
    }));

    mergedNetworkCache = {
      stations: [...stationById.values()],
      edges: [...manualEdges, ...generatedEdges]
    };
    return mergedNetworkCache;
  }

  function allStations() {
    return mergedNetwork().stations;
  }

  function allEdges() {
    return mergedNetwork().edges;
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[‐‑‒–—]/g, "-");
  }

  function stationLabel(id) {
    const station = allStations().find((item) => item.id === id) || DATA.stations.find((item) => item.id === id);
    return station ? station.name : id;
  }

  function findStation(query) {
    const normalized = normalizeText(query);
    if (!normalized) return null;
    return allStations().find((station) => {
      const names = [station.id, station.name, ...station.aliases];
      return names.some((name) => normalizeText(name) === normalized);
    }) || allStations().find((station) => {
      const names = [station.name, ...station.aliases];
      return names.some((name) => normalizeText(name).includes(normalized));
    }) || null;
  }

  function stationNames(station) {
    return [station.name, ...station.aliases, station.id];
  }

  function editDistance(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);
    if (!left || !right) return Math.max(left.length, right.length);
    const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let row = 0; row <= left.length; row += 1) dp[row][0] = row;
    for (let col = 0; col <= right.length; col += 1) dp[0][col] = col;
    for (let row = 1; row <= left.length; row += 1) {
      for (let col = 1; col <= right.length; col += 1) {
        const cost = left[row - 1] === right[col - 1] ? 0 : 1;
        dp[row][col] = Math.min(
          dp[row - 1][col] + 1,
          dp[row][col - 1] + 1,
          dp[row - 1][col - 1] + cost
        );
      }
    }
    return dp[left.length][right.length];
  }

  function suggestStations(query, limit = 5) {
    const normalized = normalizeText(query);
    if (!normalized) return [];
    return allStations()
      .map((station) => {
        const names = stationNames(station);
        const best = Math.min(...names.map((name) => {
          const candidate = normalizeText(name);
          if (candidate === normalized) return 0;
          if (candidate.includes(normalized) || normalized.includes(candidate)) return 1;
          return editDistance(normalized, candidate);
        }));
        return { station, score: best };
      })
      .filter((item) => item.score <= Math.max(2, Math.ceil(normalized.length / 2)))
      .sort((a, b) => a.score - b.score || a.station.name.localeCompare(b.station.name, "zh-CN"))
      .slice(0, limit)
      .map((item) => item.station);
  }

  function buildGraph() {
    const graph = new Map();
    for (const station of allStations()) graph.set(station.id, []);
    for (const edge of allEdges()) {
      if (!graph.has(edge.from)) graph.set(edge.from, []);
      if (!graph.has(edge.to)) graph.set(edge.to, []);
      graph.get(edge.from).push(edge);
      graph.get(edge.to).push({ ...edge, from: edge.to, to: edge.from, reverse: true });
    }
    for (const edges of graph.values()) {
      edges.sort((a, b) => {
        const manual = (b.priority === "manual") - (a.priority === "manual");
        if (manual) return manual;
        return a.minutes - b.minutes;
      });
    }
    return graph;
  }

  function routeKey(legs) {
    return legs.map((leg) => `${leg.from}:${leg.to}:${leg.line}`).join("|");
  }

  function countTransfers(legs) {
    if (legs.length <= 1) return 0;
    return legs.length - 1;
  }

  function journeyMinutes(legs) {
    return legs.reduce((sum, leg) => sum + leg.minutes, 0) + countTransfers(legs) * MIN_TRANSFER;
  }

  function journeyFare(legs, options) {
    if (options.jrPass) {
      return legs.reduce((sum, leg) => sum + (leg.flags.passExcluded ? leg.fare : 0), 0);
    }
    return legs.reduce((sum, leg) => sum + leg.fare, 0);
  }

  function addMinutes(baseDate, minutes) {
    return new Date(baseDate.getTime() + minutes * 60000);
  }

  function formatClock(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(date);
  }

  function formatFare(amount) {
    return `¥${Math.max(0, Math.round(amount)).toLocaleString("ja-JP")}`;
  }

  function makeWarnings(legs, options) {
    const warnings = [];
    if (options.luggage && legs.some((leg) => leg.flags.luggageReservation)) {
      warnings.push("东海道/山阳/九州新干线大件行李通常需要预约对应座席，请在官方页面确认。");
    }
    if (options.jrPass && legs.some((leg) => leg.flags.passExcluded)) {
      warnings.push("该方案含 Nozomi/Mizuho 等 JR Pass 通常不可直接覆盖的列车，已把这些票价计入需另付金额。");
    }
    if (legs.some((leg) => leg.flags.transferRequired)) {
      warnings.push("该方案包含站内换乘或组合特急，请预留取票和换乘时间。");
    }
    const sellers = new Set(legs.map((leg) => leg.seller));
    if (sellers.size > 1) {
      warnings.push("行程跨多个官方售票系统，助手会分渠道编排购票任务，但最终确认仍在各官方页面完成。");
    }
    return warnings;
  }

  function scoreRoute(legs, options) {
    const transferPenalty = countTransfers(legs) * 18;
    const farePenalty = journeyFare(legs, options) / 750;
    const passPenalty = options.jrPass && legs.some((leg) => leg.flags.passExcluded) ? 90 : 0;
    const luggagePenalty = options.luggage && legs.some((leg) => leg.flags.luggageReservation) ? 8 : 0;
    return journeyMinutes(legs) + transferPenalty + farePenalty + passPenalty + luggagePenalty;
  }

  function collectRoutes(fromId, toId, options = {}) {
    const graph = buildGraph();
    const queue = [{ station: fromId, legs: [], visited: new Set([fromId]), cost: 0 }];
    const results = [];
    const seen = new Set();
    const bestByStation = new Map([[fromId, 0]]);

    let expansions = 0;
    while (queue.length && results.length < 18 && expansions < MAX_EXPANSIONS) {
      queue.sort((a, b) => (a.cost || 0) - (b.cost || 0));
      const current = queue.shift();
      expansions += 1;
      if (current.legs.length > 10) continue;

      for (const edge of graph.get(current.station) || []) {
        if (current.visited.has(edge.to)) continue;
        if (options.avoidNozomi && /Nozomi|Mizuho/i.test(edge.line)) continue;

        const nextLegs = [...current.legs, edge];
        const nextCost = journeyMinutes(nextLegs) + countTransfers(nextLegs) * 20;
        if (nextCost > (bestByStation.get(edge.to) ?? Infinity) + 35) continue;
        bestByStation.set(edge.to, Math.min(nextCost, bestByStation.get(edge.to) ?? Infinity));
        if (edge.to === toId) {
          const key = routeKey(nextLegs);
          if (!seen.has(key)) {
            seen.add(key);
            results.push(toPlan(nextLegs, options));
          }
        } else {
          const visited = new Set(current.visited);
          visited.add(edge.to);
          queue.push({ station: edge.to, legs: nextLegs, visited, cost: nextCost });
        }
      }
    }

    return results
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);
  }

  function toPlan(legs, options) {
    const minutes = journeyMinutes(legs);
    const fare = journeyFare(legs, options);
    const sellers = [...new Set(legs.map((leg) => leg.seller))];
    return {
      id: routeKey(legs).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(),
      from: legs[0].from,
      to: legs[legs.length - 1].to,
      legs,
      minutes,
      fare,
      transfers: countTransfers(legs),
      sellers,
      warnings: makeWarnings(legs, options),
      score: scoreRoute(legs, options),
      passFriendly: !legs.some((leg) => leg.flags.passExcluded),
      direct: legs.length === 1
    };
  }

  function sortPlans(plans, sortMode) {
    const copy = [...plans];
    if (sortMode === "fastest") {
      return copy.sort((a, b) => a.minutes - b.minutes || a.fare - b.fare);
    }
    if (sortMode === "cheapest") {
      return copy.sort((a, b) => a.fare - b.fare || a.minutes - b.minutes);
    }
    return copy.sort((a, b) => a.score - b.score);
  }

  function buildTimeline(plan, date, time) {
    const start = new Date(`${date}T${time || "09:00"}:00`);
    let cursor = Number.isNaN(start.getTime()) ? new Date() : start;
    return plan.legs.map((leg, index) => {
      const departAt = index === 0 ? cursor : addMinutes(cursor, MIN_TRANSFER);
      const arriveAt = addMinutes(departAt, leg.minutes);
      cursor = arriveAt;
      return {
        ...leg,
        departAt,
        arriveAt,
        departLabel: formatClock(departAt),
        arriveLabel: formatClock(arriveAt)
      };
    });
  }

  function groupBookingSegments(plan, timeline, options) {
    const groups = [];
    for (const leg of timeline) {
      const last = groups[groups.length - 1];
      const canMerge = last && last.seller === leg.seller && last.legs[last.legs.length - 1].to === leg.from;
      if (canMerge) {
        last.legs.push(leg);
        last.to = leg.to;
        last.arriveAt = leg.arriveAt;
        last.arriveLabel = leg.arriveLabel;
        last.fare += options.jrPass && !leg.flags.passExcluded ? 0 : leg.fare;
      } else {
        groups.push({
          seller: leg.seller,
          from: leg.from,
          to: leg.to,
          departAt: leg.departAt,
          arriveAt: leg.arriveAt,
          departLabel: leg.departLabel,
          arriveLabel: leg.arriveLabel,
          fare: options.jrPass && !leg.flags.passExcluded ? 0 : leg.fare,
          legs: [leg]
        });
      }
    }

    return groups.map((group, index) => {
      const seller = DATA.officialSellers[group.seller] || DATA.officialSellers.manual;
      return {
        id: `${plan.id}-segment-${index + 1}`,
        index: index + 1,
        seller,
        from: group.from,
        to: group.to,
        fromName: stationLabel(group.from),
        toName: stationLabel(group.to),
        departLabel: group.departLabel,
        arriveLabel: group.arriveLabel,
        fare: group.fare,
        lines: group.legs.map((leg) => leg.line),
        purchaseUrl: seller.url,
        payload: {
          sellerId: seller.id,
          sellerName: seller.name,
          url: seller.url,
          from: stationLabel(group.from),
          to: stationLabel(group.to),
          date: group.departAt.toISOString().slice(0, 10),
          time: group.departLabel,
          adults: options.adults || 1,
          children: options.children || 0,
          luggage: Boolean(options.luggage),
          jrPass: Boolean(options.jrPass),
          lines: group.legs.map((leg) => leg.line)
        }
      };
    });
  }

  function search(input) {
    const from = findStation(input.from);
    const to = findStation(input.to);
    if (!from || !to) {
      const missingValue = !from ? input.from : input.to;
      const suggestions = suggestStations(missingValue);
      return {
        error: !from ? `没有识别起点：${input.from}` : `没有识别终点：${input.to}`,
        errorType: !from ? "unknown-from" : "unknown-to",
        suggestions,
        plans: []
      };
    }
    if (from.id === to.id) {
      return { error: "起点和终点相同，请换一个站点。", plans: [] };
    }
    const options = {
      adults: Number(input.adults) || 1,
      children: Number(input.children) || 0,
      luggage: Boolean(input.luggage),
      jrPass: Boolean(input.jrPass),
      avoidNozomi: Boolean(input.avoidNozomi)
    };
    const plans = collectRoutes(from.id, to.id, options);
    return {
      from,
      to,
      options,
      plans,
      error: plans.length ? undefined : "当前离线数据还没有覆盖这两个站之间的连通方案。",
      errorType: plans.length ? undefined : "no-route"
    };
  }

  global.JR_ENGINE = {
    MIN_TRANSFER,
    normalizeText,
    findStation,
    suggestStations,
    stationLabel,
    allStations,
    collectRoutes,
    sortPlans,
    buildTimeline,
    groupBookingSegments,
    formatFare,
    search
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.JR_ENGINE;
  }
})(typeof window !== "undefined" ? window : globalThis);
