# 背词 · 考研英语（PWA）

装在 iPhone 主屏幕上的背单词 App：**4,715 个考研英语真题词 + 1,687 条真题例句**，六箱调度、三档自评、每日打卡线。

纯静态、无账号、无后端，进度只存在本机。

## 快速开始

1. 把 `app` 里的内容部署到任意 HTTPS 静态托管（Cloudflare Pages / GitHub Pages / Netlify）。
2. iPhone 用 **Safari** 打开网址。
3. 分享 → **添加到主屏幕**。

详细步骤见 [使用说明.md](./使用说明.md)。本地预览：双击 `本地预览.bat`（需要 Python）。

## 功能（v0.1）

- 首页倒计时（考试日期可改）+ 今日任务量（新词 / 复习）
- 卡片：看词 → 想 3 秒 → 翻面 → 释义 + 真题例句 + TTS 发音
- 三档自评 → 六箱调度（1/2/4/7/15/30 天）；"忘了"当天晚些再现
- 第一关 5 张 = 今天打卡；连续天数（🔥）
- 强度三档（轻/标准/猛），切换不丢进度
- 导出 / 恢复 JSON 备份，7 天未备份首页提醒
- 暗色主题、离线可用（Service Worker）

## 技术

- 原生 ES Modules + CSS，无构建步骤
- localStorage 持久化；词库 `data/words.json`（0.61 MB，按真题频次降序）
- Service Worker 预缓存整套外壳 + 词库

## 已知边界

- 音标不显示（原书字体映射损坏，提取为乱码），发音走系统 TTS
- 例句覆盖 36%（只有 13 个年份的真题有文字层），没有就不显示
- iOS 无法定时推送；进度在本机，换机靠导出/恢复

## 目录

```
index.html  manifest.webmanifest  sw.js
assets/app.css
js/app.js  js/store.js
data/words.json
icons/
使用说明.md  本地预览.bat
```
