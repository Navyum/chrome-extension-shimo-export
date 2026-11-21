# 官网展示图

正式图片使用内置 `image_gen` 生成，参考幕布项目的功能图与 banner prompt，统一采用浅紫背景、大标题及简化深色功能面板。它们是功能宣传示意图，不是原样界面截图；不包含二维码、赞赏区或账号信息。

品牌标识必须使用 `src/icons/icon.png` 原有黑底白字“石墨” logo，左上角及功能面板标题处均须保留，不能替换成通用文档图标。

完整 prompt、参考图及生成源文件记录在 `docs/images/promo-prompts.json`。再次生成时先生成 feat1 确定风格，再将其作为其余功能图及大 banner 的风格参考；小 banner 参考大 banner 单独排版，不能直接裁切宽图。功能内容须核对当前源码，不能照搬幕布格式或功能。

交付文件：

- `docs/images/feat1`～`feat4`：1280×800 PNG 与 WebP，分别展示格式选择、选择导出、备份目录、导出进度。
- `docs/images/banner-L.jpg`：1400×560；`banner-S.jpg`：440×280，JPEG 质量 96。
- `docs/images/banner-L.png`、`banner-S.png`：保留生成器原生分辨率的无损 banner，供后续适配。

生成后用 `sips` 缩放至交付尺寸，功能图用 `cwebp -q 92` 输出 WebP。检查中文、格式名称、树形层级、缩小后的可读性及二维码禁用要求。图片名称保持兼容已有页面引用。

## 本地界面预览

原 HTML/CSS 截图工具保留用于界面核对，输出到 `build/promo-preview/`，不覆盖正式图片：

1. `npm run build`
2. 一个终端执行 `node scripts/promo/server.js`（仅监听本机 54093）。
3. 另一个终端执行 `bash scripts/promo/capture.sh`。
4. 检查后关闭预览服务。

预览使用构建后的真实扩展页面及独立示例数据，不调用石墨接口或读取真实账号。依赖 `agent-browser`、`cwebp` 和 macOS 自带的 `sips`。`browser.js` 仅在本地预览服务替代浏览器兼容层，不参与扩展打包。
