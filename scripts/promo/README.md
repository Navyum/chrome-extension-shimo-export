# 官网展示图

使用构建后的真实扩展页面、独立示例数据和 HTML/CSS 排版生成图片，不调用石墨接口或读取真实账号。

1. `npm run build`
2. 一个终端执行 `node scripts/promo/server.js`（仅监听本机 54093）。
3. 另一个终端执行 `bash scripts/promo/capture.sh`。
4. 检查图片后关闭预览服务。

依赖 `agent-browser`、`cwebp` 和 macOS 自带的 `sips`。沿用系统中文字体，换机器时应复核文字布局。

输出覆盖 `docs/images/banner-L.jpg`（1400×560）、`banner-S.jpg`（440×280），以及 `feat1`～`feat4` 的 PNG/WebP（1280×800）。

- feat1：popup 格式选择菜单。
- feat2：选择导出目录和勾选状态。
- feat3：通用设置相关控件局部，预览时省略下载提示和反馈区，以保证目录与时间设置可读。
- feat4：性能监控中的示例成功、失败状态与耗时；数据不代表实测速度。

`browser.js` 仅在这个本地预览服务中替代浏览器兼容层，不参与扩展打包。界面入场动画在截图中加速完成，生产页面不受影响。
