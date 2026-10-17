Install this skill: https://github.com/TencentEdgeOne/edgeone-pages-skills
帮我创建一个「情绪调色盘」个人状态站点，核心要求：

【目标】
禅意极简单页，5 种情绪状态切换，页面随心情变换配色和呼吸动画。

【核心功能】
1. 五种情绪：创作中(creating)、摸鱼(slacking)、忙碌(busy)、学习中(learning)、放松(resting)
2. CSS 变量驱动配色（背景、圆环发光、文字色）
3. 中央 Mood Orb：260px，多层渐变 + 呼吸动画
4. 底部 5 个状态点，800ms 丝滑过渡
5. 天气 API（Edge Function 代理 Open-Meteo）
6. 情绪历史曲线页（localStorage/KV）

【视觉规范 - 禅意呼吸感】
背景：高亮度低饱和（<20%），不抢眼，圆环当主角
配色方案（HSL）：
- 创作：暖米白(38，18%，90%) + 暖琥珀光
- 摸鱼：沙石灰(30，12%，90%) + 暖粉光
- 忙碌：深邃夜蓝(225，15%，14%) + 暖月白光
- 学习：柔雾蓝(210，28%，88%) + 柔靛光
- 放松：极淡雾蓝(225，6%，94%) + 柔薰衣草光
内容布局：flex-end 下沉，padding-top: 28dvh

【技术栈】
React + TypeScript + Vite + Tailwind CSS v4

【部署】
使用 edgeone pages deploy 部署到 EdgeOne Pages