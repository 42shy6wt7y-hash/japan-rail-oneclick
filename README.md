# Japan Rail OneClick Assistant

一个无服务器的日本铁路中文行程规划和官方购票页辅助原型。用户输入起点、终点、日期和人数后，可以看到直达与换乘方案、预计时间、票价、JR Pass 风险、大件行李提示，以及按官方售票渠道合并后的购票任务。

## 重要边界

这个项目不会自动提交订单、不会自动付款，也不会保存账号、护照、验证码或银行卡信息。日本铁路票务分散在多个官方渠道，很多页面还有登录、验证码、取票规则和信用卡验证；因此本项目只做“统一规划 + 官方页面预填 + 中文任务浮层”，最终购买必须由用户在官方页面确认。

## 当前覆盖

- 常见游客干线：东京、品川、横滨、名古屋、京都、新大阪、奈良、冈山、广岛、博多、鹿儿岛中央、金泽、富山、仙台、盛冈、新青森、新函馆北斗、札幌。
- 官方渠道任务编排：Smart EX、JR-EAST Train Reservation、JR-WEST ONLINE TRAIN RESERVATION、JR KYUSHU、JR Hokkaido。
- 购票风险提示：跨售票系统、JR Pass 不覆盖 Nozomi/Mizuho、大件行李预约、组合特急换乘。

## 本地使用

直接打开 `index.html` 即可使用规划页面。也可以启动一个本地静态服务：

```bash
node scripts/serve.mjs
```

然后访问 `http://localhost:4173`。

## 作为 Chrome / Edge 扩展使用

1. 打开浏览器扩展管理页面。
2. 开启开发者模式。
3. 选择“加载已解压的扩展”。
4. 选择本项目根目录，也就是包含 `manifest.json` 的文件夹。
5. 点击扩展图标打开规划器，选择方案后打开官方购票页。

官方页面上会出现中文浮层，可以复制任务或尝试预填字段。由于各官方网站字段结构经常变化，预填是尽力辅助，不保证每个页面都能全自动填写。

## 测试

```bash
npm test
```

如果 PowerShell 拦截 `npm.ps1`，可以使用：

```powershell
npm.cmd test
```

或直接调用 Node 内置测试 runner：

```powershell
node --test tests\engine.test.js
```

## 后续可扩展方向

- 接入真实时刻表或 GTFS 数据源。
- 添加更多私铁和地方铁路。
- 为每个官方售票网站维护更精确的页面适配器。
- 增加浏览器端加密的本地旅客资料模板，但仍不自动提交支付。

## 官方入口

- [Smart EX](https://smart-ex.jp/en/index.php)
- [JR-EAST Train Reservation](https://www.eki-net.com/en/jreast-train-reservation/top/Index)
- [JR-WEST ONLINE TRAIN RESERVATION](https://www.westjr.co.jp/global/en/ticket/)
- [JR KYUSHU](https://www.jrkyushu.co.jp/english/)
- [JR Hokkaido](https://www.jrhokkaido.co.jp/global/english/)
