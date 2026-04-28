---
name: doubao extension local path
description: 豆包 Chrome 扩展本地源码路径，用于逆向分析参考
type: reference
---

**Why:** 需要对比豆包脑图/总结实现时，本地有解压后的完整源码。

**How to apply:** 当需要参考豆包实现时，直接读本地路径：

```
/Users/zhaoqiqiang/Library/Application Support/Google/Chrome/Default/Extensions/dbjibobgilijgolhjdcbdebjhejelffo/1.37.0_0/
```

关键文件：
- `static/js/content.js` — 内容脚本（Readability 提取、总结、脑图）
- `static/js/side_panel.js` — 侧边栏
- `static/js/background.js` — 后台脚本