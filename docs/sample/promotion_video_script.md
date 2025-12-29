# Pixel QR Code 产品宣传片分镜脚本 (简化解说版)

## 🎬 视频概述
*   **产品名称**: Pixel QR Code
*   **视觉风格**: 左右分层布局。左侧为 3D 卡通女生“小 Q”动作解说，背景为功能演示截图（由模糊背景+清晰功能图组成）。
*   **核心宗旨**: 极简分享，跨屏无界，个性定义

---

## 🎞️ 简化版分镜脚本

| 序号 | 画面布局 | 动作说明 (Character Actions) | 讲解内容 (中英双语旁白) |
| :--- | :--- | :--- | :--- |
| **1** | **人物 + 背景: `./images/1-5.png`** | **[开始]** 小 Q 眉头微皱，双手摊开做出“无奈”动作，随后指向背景中的本地文件。<br>**[转换]** 随着旁白提到 Pixel QR Code，小 Q 表情转为惊喜，单手向右侧一挥，背景切换到上传成功的界面。 | **CN:** “还在用数据线传文件？太慢啦！用 Pixel QR Code，本地文件一键上传 Google Drive，扫码即走，分享从未如此简单！”<br>**EN:** "Still using cables to transfer files? Too slow! With Pixel QR Code, upload local files to Google Drive in one click and scan to go. Sharing has never been this easy!" |
| **2** | **人物 + 背景: `./images/1-1.png`** | 小 Q 身体微侧，右手食指有节奏地点击空气（模拟点击插件图标），每点击一下，右侧背景的二维码就闪烁一下提示生成成功。最后小 Q 对着镜头露出灿烂笑容。 | **CN:** “看到好网页想在手机看？别再手动输入网址了！点一下，当前页面秒变二维码，跨屏阅读只需一秒。”<br>**EN:** "Found a great website and want to read it on your phone? Stop typing URLs manually! One click, and the page turns into a QR code instantly. Cross-screen reading in just a second!" |
| **3** | **人物 + 背景: `./images/1-2.png`** | 小 Q 做出“放大观察”的手势，眼睛睁大，表现出好奇。接着她做了一个快速的“右键点击”指法（中指轻弹），背景上突出显示右键菜单弹出的动画效果。 | **CN:** “网页上的文字和图片也能变身？右键选中，即刻生成二维码。遇到扫不了的码？右键也能直接识别，效率加倍！”<br>**EN:** "Text and images on the web can also transform! Right-click to generate QR codes instantly. Got a code you can't scan? Right-click to identify it directly. Double your efficiency!" |
| **4** | **人物 + 背景: `./images/1-4.png`** | 小 Q 手持一根虚拟的五彩画笔（或指挥棒），在空中轻快地挥舞，随着她的动作，背景中原本黑白的二维码开始像被涂抹过一样，迅速染上彩色渐变并跳入 Logo。 | **CN:** “谁说二维码只能黑白？在这里，你可以自定义颜色、添加 Logo。让你的二维码变身艺术品，彰显个性！”<br>**EN:** "Who says QR codes can only be black and white? Customize colors and add your logo here. Turn your QR codes into artworks and show off your personality!" |
| **5** | **人物 + 背景: `./images/1-3.png`** | 小 Q 拿出一个虚拟手机，做出扫描动作，头部随着扫描进度轻微点头，随后展示手机屏幕（或给一个大拇指），表现出对识别结果的非常认可。 | **CN:** “强力扫描，智能识别。无论是复杂的网址还是纯文本，通通不在话下。Pixel QR Code，你身边的全能二维码专家！”<br>**EN:** "Powerful scanning, intelligent identification. From complex URLs to plain text, we handle it all. Pixel QR Code, your all-in-one QR expert right by your side!" |
| **6** | **人物 + 品牌 Logo 展示** | 小 Q 全身出镜，活泼地向镜头挥手告别。背景背景淡出，居中显示 Pixel QR Code 官方 Logo 和 Chrome 商店下载图标，小 Q 最后指向 Logo。 | **CN:** “Pixel QR Code，让你的分享更聪明，更有型。立即在 Chrome 商店搜索下载吧！”<br>**EN:** "Pixel QR Code: making your sharing smarter and more stylish. Download it now on the Chrome Web Store!" |

---

## 🎨 3D 分镜图提示词 (AI Prompts)
*提示：这些提示词专门用于生成左侧的 3D 卡通女生形象。*

### Shot 1: 文件上传解说
> **Prompt:** 3D Pixar style, a cute cartoon girl teacher "Ami", half-body shot, expressive frustrated facial expression, shrugging her shoulders, wearing a modern casual outfit, soft studio lighting, high quality 3D render, solid plain green background (for easy background removal), 8k. --ar 16:9

### Shot 2: 网址生成解说
> **Prompt:** 3D Pixar style, the same cartoon girl "Ami", half-body shot, smiling happily, pointing her index finger to the right side of the frame, soft cinematic lighting, vibrant colors, high detail, solid plain green background, 8k. --ar 16:9

### Shot 3: 右键功能解说
> **Prompt:** 3D Pixar style, the same cartoon girl "Ami", half-body shot, looking surprised and curious, eyes wide open, hands gesturing as if showing something magical, bright studio lighting, solid plain green background, 8k. --ar 16:9

### Shot 4: 艺术定制解说
> **Prompt:** 3D Pixar style, the same cartoon girl "Ami", half-body shot, holding a large stylized digital paintbrush, winking at the camera, playful and creative expression, colorful paint splashes nearby, solid plain green background, 8k. --ar 16:9

### Shot 5: 智能扫描解说
> **Prompt:** 3D Pixar style, the same cartoon girl "Ami", half-body shot, holding a futuristic smartphone, nodding with a confident smile, professional and tech-savvy look, soft highlights, solid plain green background, 8k. --ar 16:9

### Shot 6: 结尾 Call to Action
> **Prompt:** 3D Pixar style, the same cartoon girl "Ami", full-body shot, waving both hands cheerfully at the camera, big warm smile, friendly and inviting, cinematic lighting, solid plain green background, 8k. --ar 16:9
