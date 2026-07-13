// 博客通用组件 - 自动插入导航栏、CTA和Footer

(function () {
    'use strict';

    // 顶部导航栏HTML
    const navbarHTML = `
        <nav class="homepage-nav">
            <div class="nav-content">
                <div class="nav-left">
                    <a href="../index.html">
                        <picture>
                            <source srcset="../images/icon-36x36.webp" type="image/webp">
                            <img src="../images/icon-36x36.png" alt="石墨文档导出工具 Logo">
                        </picture>
                        <span class="logo-text">石墨文档导出工具</span>
                    </a>
                </div>
                <div class="nav-center">
                    <a href="../index.html#features" class="nav-link">功能特性</a>
                    <a href="../index.html#faq" class="nav-link">常见问题</a>
                    <a href="index.html" class="nav-link" style="color: #fff;">博客</a>
                    <a href="../privacy.html" class="nav-link">隐私政策</a>
                </div>
                <div class="nav-right">
                    <a href="https://chromewebstore.google.com/detail/jdipfhjpijkdjbefbaehnimligdldhdp?utm_source=blog" target="_blank" class="nav-cta-button">
                        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 496 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M131.5 217.5L55.1 100.1c47.6-59.2 119-91.8 192-92.1 42.3-.3 85.5 10.5 124.8 33.2 43.4 25.2 76.4 61.4 97.4 103L264 133.4c-58.1-3.4-113.4 29.3-132.5 84.1zm32.9 38.5c0 46.2 37.4 83.6 83.6 83.6s83.6-37.4 83.6-83.6-37.4-83.6-83.6-83.6-83.6 37.3-83.6 83.6zm314.9-89.2L339.6 174c37.9 44.3 38.5 108.2 6.6 157.2L234.1 503.6c46.5 2.5 94.4-7.7 137.8-32.9 107.4-62 150.9-192 107.4-303.9zM133.7 303.6L40.4 120.1C14.9 159.1 0 205.9 0 256c0 124 90.8 226.7 209.5 244.9l63.7-124.8c-57.6 10.8-113.2-20.8-139.5-72.5z"></path></svg>
                        <span>添加到 Chrome</span>
                    </a>
                </div>
            </div>
        </nav>
    `;

    // 右侧CTA区域HTML
    const sidebarHTML = `
        <!-- 主要CTA卡片 -->
        <div class="cta-card">
            <img src="../images/icon.png" alt="石墨文档导出工具" class="cta-icon-img">
            <h3 class="cta-title">立即备份你的文档</h3>
            <p class="cta-description">使用石墨文档导出工具，一键批量导出所有文档，支持多种格式，完整保留文件夹结构。</p>
            <a href="https://chromewebstore.google.com/detail/jdipfhjpijkdjbefbaehnimligdldhdp?utm_source=blog" target="_blank" class="cta-button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                免费下载扩展
            </a>
        </div>
        
        <!-- 功能轮播图 -->
        <div class="feature-carousel">
            <h4 class="feature-carousel-title">功能预览</h4>
            <div class="carousel-container">
                <div class="carousel-slides">
                    <div class="carousel-slide active">
                        <img src="../images/feat1.webp" alt="一键批量导出" loading="lazy">
                        <p class="carousel-caption">一键批量导出所有文档</p>
                    </div>
                    <div class="carousel-slide">
                        <img src="../images/feat2.webp" alt="保留文件夹结构" loading="lazy">
                        <p class="carousel-caption">完整保留文件夹层级</p>
                    </div>
                    <div class="carousel-slide">
                        <img src="../images/feat3.webp" alt="多格式支持" loading="lazy">
                        <p class="carousel-caption">支持多种导出格式</p>
                    </div>
                    <div class="carousel-slide">
                        <img src="../images/feat4.webp" alt="团队空间支持" loading="lazy">
                        <p class="carousel-caption">团队空间一键导出</p>
                    </div>
                </div>
                <button class="carousel-prev" aria-label="上一张">‹</button>
                <button class="carousel-next" aria-label="下一张">›</button>
                <div class="carousel-indicators">
                    <span class="indicator active" data-slide="0"></span>
                    <span class="indicator" data-slide="1"></span>
                    <span class="indicator" data-slide="2"></span>
                    <span class="indicator" data-slide="3"></span>
                </div>
            </div>
        </div>
        
        <!-- 相关文章 -->
        <div class="related-posts">
            <h4 class="related-posts-title">相关文章推荐</h4>
            <div id="related-posts-list">
                <!-- 由JavaScript动态生成 -->
            </div>
        </div>
    `;

    // 底部Footer HTML
    const footerHTML = `
        <footer class="homepage-footer">
            <div class="footer-container">
                <div class="footer-grid">
                    <div class="footer-column">
                        <div class="footer-logo">
                            <picture>
                                <source srcset="../images/icon-36x36.webp" type="image/webp">
                                <img src="../images/icon-36x36.png" alt="石墨文档导出工具 Logo" class="footer-logo-image">
                            </picture>
                            <span class="footer-logo-text">石墨文档导出工具</span>
                        </div>
                        <p class="footer-description">专业的石墨文档批量导出解决方案。为隐私而设计，为效率而生。</p>
                    </div>
                    <div class="footer-column">
                        <h3 class="footer-heading">产品</h3>
                        <ul class="footer-links">
                            <li><a href="../index.html#features">功能特性</a></li>
                            <li><a href="index.html">博客</a></li>
                            <li><a href="../index.html#privacy">隐私保护</a></li>
                            <li><a href="../privacy.html">隐私政策</a></li>
                        </ul>
                    </div>
                    <div class="footer-column">
                        <h3 class="footer-heading">支持</h3>
                        <ul class="footer-links">
                            <li><a href="mailto:yhj2433488839@gmail.com">联系我们</a></li>
                        </ul>
                        <div class="footer-social">
                            <a href="https://chromewebstore.google.com/detail/jdipfhjpijkdjbefbaehnimligdldhdp?utm_source=offiial_website" target="_blank">
                                <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 496 512" class="social-icon" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M131.5 217.5L55.1 100.1c47.6-59.2 119-91.8 192-92.1 42.3-.3 85.5 10.5 124.8 33.2 43.4 25.2 76.4 61.4 97.4 103L264 133.4c-58.1-3.4-113.4 29.3-132.5 84.1zm32.9 38.5c0 46.2 37.4 83.6 83.6 83.6s83.6-37.4 83.6-83.6-37.4-83.6-83.6-83.6-83.6 37.3-83.6 83.6zm314.9-89.2L339.6 174c37.9 44.3 38.5 108.2 6.6 157.2L234.1 503.6c46.5 2.5 94.4-7.7 137.8-32.9 107.4-62 150.9-192 107.4-303.9zM133.7 303.6L40.4 120.1C14.9 159.1 0 205.9 0 256c0 124 90.8 226.7 209.5 244.9l63.7-124.8c-57.6 10.8-113.2-20.8-139.5-72.5z"></path></svg>
                            </a>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>© 2025 石墨文档导出工具. Built with passion for better data freedom.</p>
                </div>
            </div>
        </footer>
    `;

    // 所有博客文章配置
    const blogPosts = {
        'why-backup-cloud-documents.html': {
            title: '云文档数据丢失怎么办？5个真实案例教你避坑',
            related: [
                'shimo-tips-and-tricks.html',
                'document-format-guide.html',
                'team-document-management.html',
                'data-migration-guide.html'
            ]
        },
        'shimo-tips-and-tricks.html': {
            title: '石墨文档使用技巧：10个提高效率的隐藏功能',
            related: [
                'why-backup-cloud-documents.html',
                'document-format-guide.html',
                'team-document-management.html',
                'data-migration-guide.html'
            ]
        },
        'document-format-guide.html': {
            title: 'Markdown vs PDF vs Word：如何选择最适合的文档格式？',
            related: [
                'why-backup-cloud-documents.html',
                'shimo-tips-and-tricks.html',
                'team-document-management.html',
                'data-migration-guide.html'
            ]
        },
        'team-document-management.html': {
            title: '团队协作文档管理最佳实践',
            related: [
                'why-backup-cloud-documents.html',
                'shimo-tips-and-tricks.html',
                'document-format-guide.html',
                'data-migration-guide.html'
            ]
        },
        'data-migration-guide.html': {
            title: '从云文档迁移到本地：完整的数据迁移指南',
            related: [
                'shimo-export-tools-comparison.html',
                'why-backup-cloud-documents.html',
                'shimo-tips-and-tricks.html',
                'document-format-guide.html'
            ]
        },
        'shimo-export-tools-comparison.html': {
            title: '2025年石墨文档导出工具深度评测：脚本 vs 插件 vs 官方',
            related: [
                'data-migration-guide.html',
                'shimo-tips-and-tricks.html',
                'why-backup-cloud-documents.html',
                'document-format-guide.html'
            ]
        },
        'shimo-export-markdown-guide.html': {
            title: '石墨文档导出Markdown完整教程：图片、表格、链接怎么保留？',
            related: [
                'document-format-guide.html',
                'shimo-export-complete-guide.html',
                'shimo-export-chrome-plugin-guide.html',
                'data-migration-guide.html'
            ]
        },
        'shimo-team-space-backup-permission-checklist.html': {
            title: '石墨团队空间备份权限清单：管理员批量导出前必看',
            related: [
                'team-document-management.html',
                'shimo-export-complete-guide.html',
                'shimo-export-troubleshooting.html',
                'why-backup-cloud-documents.html'
            ]
        },
        'shimo-spreadsheet-export-excel-guide.html': {
            title: '石墨表格导出Excel避坑指南：公式、合并单元格和乱码处理',
            related: [
                'document-format-guide.html',
                'shimo-export-troubleshooting.html',
                'shimo-export-chrome-plugin-guide.html',
                'shimo-export-complete-guide.html'
            ]
        }
    };

    // 文章简短标题映射
    const shortTitles = {
        'why-backup-cloud-documents.html': '为什么需要定期备份云文档',
        'shimo-tips-and-tricks.html': '石墨文档使用技巧',
        'document-format-guide.html': '文档格式选择指南',
        'team-document-management.html': '团队文档管理最佳实践',
        'data-migration-guide.html': '数据迁移完整指南',
        'shimo-export-tools-comparison.html': '工具评测',
        'shimo-export-complete-guide.html': '石墨文档导出完全指南',
        'shimo-export-chrome-plugin-guide.html': 'Chrome插件使用指南',
        'shimo-export-troubleshooting.html': '导出问题排查',
        'shimo-export-markdown-guide.html': 'Markdown导出教程',
        'shimo-team-space-backup-permission-checklist.html': '团队空间备份清单',
        'shimo-spreadsheet-export-excel-guide.html': '表格导出Excel指南'
    };

    // 插入导航栏
    function insertNavbar() {
        const body = document.body;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = navbarHTML;
        body.insertBefore(tempDiv.firstElementChild, body.firstChild);
        console.log('✓ 导航栏已插入');
    }

    // 插入右侧CTA
    function insertSidebar() {
        const sidebar = document.querySelector('.blog-sidebar-right');
        if (sidebar) {
            sidebar.innerHTML = sidebarHTML;
            console.log('✓ 右侧CTA已插入');

            // 生成相关文章列表
            generateRelatedPosts();
        }
    }

    // 生成相关文章列表
    function generateRelatedPosts() {
        const relatedPostsList = document.getElementById('related-posts-list');
        if (!relatedPostsList) return;

        // 获取当前页面文件名
        const currentPage = window.location.pathname.split('/').pop();
        const postConfig = blogPosts[currentPage];

        if (!postConfig || !postConfig.related) {
            console.warn('未找到当前页面的相关文章配置');
            return;
        }

        // 生成相关文章HTML
        const relatedHTML = postConfig.related.map(filename => {
            const title = shortTitles[filename] || filename;
            return `
                <div class="related-post-item">
                    <a href="${filename}" class="related-post-link">
                        ${title}
                    </a>
                </div>
            `;
        }).join('');

        relatedPostsList.innerHTML = relatedHTML;
        console.log(`✓ 已生成${postConfig.related.length}个相关文章链接`);
    }

    // 插入底部Footer
    function insertFooter() {
        const layout = document.querySelector('.blog-layout');
        if (layout) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = footerHTML;
            layout.parentNode.insertBefore(tempDiv.firstElementChild, layout.nextSibling);
            console.log('✓ 底部Footer已插入');
        }
    }

    // 初始化所有组件
    function initComponents() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initComponents);
            return;
        }

        console.log('📦 开始加载博客通用组件...');

        insertNavbar();
        insertSidebar();
        insertFooter();

        console.log('✅ 博客通用组件加载完成！');

        // 触发自定义事件，通知其他脚本组件已加载
        window.dispatchEvent(new Event('blogComponentsReady'));
    }

    // 立即执行
    initComponents();

    // 导出配置供其他脚本使用
    window.BlogComponents = {
        posts: blogPosts,
        shortTitles: shortTitles
    };

})();
