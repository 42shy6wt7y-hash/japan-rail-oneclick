const test = require("node:test");
const assert = require("node:assert/strict");

require("../js/data.js");
const engine = require("../js/engine.js");

test("finds stations by Chinese and English aliases", () => {
  assert.equal(engine.findStation("东京").id, "tokyo");
  assert.equal(engine.findStation("Tokyo").id, "tokyo");
  assert.equal(engine.findStation("大阪").id, "shin-osaka");
});

test("returns direct and transfer-aware routes", () => {
  const output = engine.search({
    from: "东京",
    to: "京都",
    date: "2026-07-20",
    time: "09:00",
    adults: 1,
    children: 0,
    luggage: true,
    jrPass: false,
    avoidNozomi: false
  });
  assert.equal(output.error, undefined);
  assert.ok(output.plans.length > 0);
  assert.equal(output.plans[0].from, "tokyo");
  assert.equal(output.plans[0].to, "kyoto");
  assert.ok(output.plans.some((plan) => plan.legs.some((leg) => leg.seller === "smartEx")));
});

test("JR Pass mode penalizes pass-excluded trains", () => {
  const output = engine.search({
    from: "东京",
    to: "新大阪",
    date: "2026-07-20",
    time: "09:00",
    jrPass: true,
    avoidNozomi: false
  });
  assert.ok(output.plans.length > 1);
  assert.equal(output.plans[0].passFriendly, true);
});

test("avoid Nozomi removes Nozomi legs", () => {
  const output = engine.search({
    from: "东京",
    to: "京都",
    date: "2026-07-20",
    time: "09:00",
    avoidNozomi: true
  });
  assert.ok(output.plans.length > 0);
  assert.equal(output.plans.some((plan) => plan.legs.some((leg) => /Nozomi/.test(leg.line))), false);
});

test("groups adjacent legs by official seller", () => {
  const output = engine.search({
    from: "东京",
    to: "博多",
    date: "2026-07-20",
    time: "09:00",
    adults: 2,
    children: 1,
    luggage: true
  });
  const plan = output.plans[0];
  const timeline = engine.buildTimeline(plan, "2026-07-20", "09:00");
  const segments = engine.groupBookingSegments(plan, timeline, {
    adults: 2,
    children: 1,
    luggage: true
  });

  assert.ok(segments.length >= 1);
  assert.equal(segments[0].payload.adults, 2);
  assert.equal(segments[0].payload.children, 1);
  assert.ok(segments[0].purchaseUrl.startsWith("https://"));
});
