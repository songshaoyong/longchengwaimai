# 龙城外卖 · Dragon City Express

跑酷配送正式开发（第一期）。玩法：系统按导航自动行驶并拐弯，玩家左右躲障、跳跃、滑铲，完成取餐送达。

## 运行

```bash
npm install
npm run dev
```

浏览器打开终端里的 Local 地址（默认 `http://localhost:5173/`）。

## 操作

| 按键 | 作用 |
|------|------|
| A / D | 左右移动 |
| 空格 | 跳 |
| S | 滑铲 |
| Shift | 加速 |
| ESC | 暂停（自动存档） |

## 目录

- `src/data/` 餐厅、顾客、街区、等级等配置
- `src/game/` 运行时：骑手、城市、导航、订单、存档、HUD
- `GDD-龙城外卖-游戏策划文档.md` 策划原文
- `正式开发-第一期.md` 本期范围与下一期

存档在浏览器 `localStorage`（键 `dce-save-v1`）。
