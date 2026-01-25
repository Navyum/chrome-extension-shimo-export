// 博客通用JavaScript - 增强用户体验和SEO

(function () {
    'use strict';

    // 自动生成目录
    function generateTOC() {
        const content = document.querySelector('.article-content');
        const toc = document.querySelector('.toc-list');

        if (!content || !toc) {
            console.warn('未找到article-content或toc-list元素');
            return;
        }

        const headings = content.querySelectorAll('h2, h3');

        if (headings.length === 0) {
            console.warn('未找到任何h2或h3标题');
            return;
        }

        const tocItems = [];

        headings.forEach((heading, index) => {
            // 为标题添加ID（如果没有）
            if (!heading.id) {
                // 使用标题文本作为ID，更语义化
                const headingText = heading.textContent.trim();
                heading.id = `section-${index}-${headingText.substring(0, 20).replace(/[^\w\u4e00-\u9fa5]/g, '-')}`;
            }

            const li = document.createElement('li');
            li.className = heading.tagName === 'H3' ? 'toc-h3' : 'toc-h2';

            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            link.textContent = heading.textContent.trim();

            // 使用事件委托处理点击
            link.addEventListener('click', function (e) {
                e.preventDefault();

                // 滚动到目标位置
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);

                if (targetElement) {
                    smoothScrollTo(targetElement);

                    // 更新URL（不触发滚动）
                    if (history.pushState) {
                        history.pushState(null, null, `#${targetId}`);
                    }

                    // 移动端关闭目录
                    if (window.innerWidth <= 1200) {
                        const sidebar = document.querySelector('.blog-sidebar-left');
                        if (sidebar) {
                            sidebar.classList.remove('active');
                        }
                    }
                } else {
                    console.error('未找到目标元素:', targetId);
                }
            });

            li.appendChild(link);
            tocItems.push(li);
        });

        // 清空并添加新的目录项
        toc.innerHTML = '';
        tocItems.forEach(item => toc.appendChild(item));

        console.log(`生成了${tocItems.length}个目录项`);
    }

    // 平滑滚动
    function smoothScrollTo(element) {
        if (!element) {
            console.error('smoothScrollTo: element is null');
            return;
        }

        // 考虑固定导航栏的高度 - 每次都实时获取
        const navbar = document.querySelector('.blog-navbar');
        const navbarHeight = navbar ? navbar.offsetHeight : 70; // 默认70px
        const offset = navbarHeight + 20; // 导航栏高度 + 额外间距

        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        console.log(`滚动到元素: ${element.id}, 导航栏高度: ${navbarHeight}px, 目标位置: ${offsetPosition}px`);

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }

    // 高亮当前目录项
    function highlightTOC() {
        const headings = document.querySelectorAll('.article-content h2, .article-content h3');
        const tocLinks = document.querySelectorAll('.toc-list a');

        if (headings.length === 0 || tocLinks.length === 0) return;

        let currentHeading = null;
        const scrollPosition = window.scrollY + 100;

        headings.forEach(heading => {
            if (heading.offsetTop <= scrollPosition) {
                currentHeading = heading;
            }
        });

        tocLinks.forEach(link => {
            link.classList.remove('active');
            if (currentHeading && link.getAttribute('href') === `#${currentHeading.id}`) {
                link.classList.add('active');
            }
        });
    }

    // 移动端目录切换
    function setupMobileTOC() {
        const toggle = document.querySelector('.mobile-toc-toggle');
        const sidebar = document.querySelector('.blog-sidebar-left');

        if (!toggle || !sidebar) return;

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1200 &&
                !sidebar.contains(e.target) &&
                !toggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // 返回顶部按钮
    function setupBackToTop() {
        const button = document.querySelector('.back-to-top');
        if (!button) return;

        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                button.classList.add('visible');
            } else {
                button.classList.remove('visible');
            }
        });

        button.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // 图片懒加载
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img.lazy').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // 阅读进度条
    function setupReadingProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'reading-progress';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            z-index: 9999;
            transition: width 0.1s ease;
        `;
        document.body.appendChild(progressBar);

        window.addEventListener('scroll', () => {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollPercent = (scrollTop / (documentHeight - windowHeight)) * 100;

            progressBar.style.width = `${Math.min(scrollPercent, 100)}%`;
        });
    }

    // 复制代码块
    function setupCodeCopy() {
        document.querySelectorAll('pre code').forEach(block => {
            const button = document.createElement('button');
            button.className = 'copy-code-button';
            button.textContent = '复制';
            button.style.cssText = `
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                padding: 0.3rem 0.8rem;
                background: rgba(102, 126, 234, 0.8);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8rem;
                opacity: 0;
                transition: opacity 0.2s;
            `;

            const pre = block.parentElement;
            pre.style.position = 'relative';
            pre.appendChild(button);

            pre.addEventListener('mouseenter', () => {
                button.style.opacity = '1';
            });

            pre.addEventListener('mouseleave', () => {
                button.style.opacity = '0';
            });

            button.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent).then(() => {
                    button.textContent = '已复制！';
                    setTimeout(() => {
                        button.textContent = '复制';
                    }, 2000);
                });
            });
        });
    }

    // 外部链接添加图标和新窗口打开
    function setupExternalLinks() {
        document.querySelectorAll('.article-content a[href^="http"]').forEach(link => {
            if (!link.hostname.includes(window.location.hostname)) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');

                // 添加外部链接图标
                const icon = document.createElement('span');
                icon.innerHTML = ' ↗';
                icon.style.fontSize = '0.8em';
                link.appendChild(icon);
            }
        });
    }

    // 预计阅读时间
    function calculateReadingTime() {
        const content = document.querySelector('.article-content');
        const readingTimeElement = document.querySelector('.reading-time');

        if (!content || !readingTimeElement) return;

        const text = content.textContent;
        const wordsPerMinute = 300; // 中文每分钟约300字
        const wordCount = text.length;
        const readingTime = Math.ceil(wordCount / wordsPerMinute);

        readingTimeElement.textContent = `${readingTime}分钟`;
    }

    // 轮播图功能
    function setupCarousel() {
        const carousel = document.querySelector('.carousel-container');
        if (!carousel) return;

        const slides = carousel.querySelectorAll('.carousel-slide');
        const prevBtn = carousel.querySelector('.carousel-prev');
        const nextBtn = carousel.querySelector('.carousel-next');
        const indicators = carousel.querySelectorAll('.indicator');

        let currentSlide = 0;
        let autoPlayInterval = null;

        // 显示指定幻灯片
        function showSlide(index) {
            // 确保索引在有效范围内
            if (index < 0) {
                currentSlide = slides.length - 1;
            } else if (index >= slides.length) {
                currentSlide = 0;
            } else {
                currentSlide = index;
            }

            // 更新幻灯片
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === currentSlide);
            });

            // 更新指示器
            indicators.forEach((indicator, i) => {
                indicator.classList.toggle('active', i === currentSlide);
            });
        }

        // 下一张
        function nextSlide() {
            showSlide(currentSlide + 1);
        }

        // 上一张
        function prevSlide() {
            showSlide(currentSlide - 1);
        }

        // 自动播放
        function startAutoPlay() {
            stopAutoPlay(); // 先停止现有的
            autoPlayInterval = setInterval(nextSlide, 4000); // 每4秒切换
        }

        // 停止自动播放
        function stopAutoPlay() {
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
                autoPlayInterval = null;
            }
        }

        // 事件监听
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                prevSlide();
                stopAutoPlay();
                startAutoPlay(); // 重新开始自动播放
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                nextSlide();
                stopAutoPlay();
                startAutoPlay();
            });
        }

        // 指示器点击
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                showSlide(index);
                stopAutoPlay();
                startAutoPlay();
            });
        });

        // 鼠标悬停时暂停自动播放
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);

        // 触摸滑动支持
        let touchStartX = 0;
        let touchEndX = 0;

        carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });

        function handleSwipe() {
            if (touchEndX < touchStartX - 50) {
                // 向左滑动
                nextSlide();
            }
            if (touchEndX > touchStartX + 50) {
                // 向右滑动
                prevSlide();
            }
            stopAutoPlay();
            startAutoPlay();
        }

        // 键盘支持
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                prevSlide();
                stopAutoPlay();
                startAutoPlay();
            } else if (e.key === 'ArrowRight') {
                nextSlide();
                stopAutoPlay();
                startAutoPlay();
            }
        });

        // 启动自动播放
        startAutoPlay();

        console.log('轮播图初始化完成，共' + slides.length + '张图片');
    }

    // 初始化所有功能
    function init() {
        // DOM加载完成后执行
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('博客功能初始化开始...');

        // 等待组件加载完成后再初始化
        function initAfterComponents() {
            // 按顺序初始化功能
            generateTOC();
            setupMobileTOC();
            setupBackToTop();
            setupLazyLoading();
            setupReadingProgress();
            setupCodeCopy();
            setupExternalLinks();
            calculateReadingTime();
            setupCarousel();

            // 滚动时高亮目录
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        highlightTOC();
                        ticking = false;
                    });
                    ticking = true;
                }
            });

            // 处理URL hash
            if (window.location.hash) {
                setTimeout(() => {
                    const targetId = window.location.hash.substring(1);
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        smoothScrollTo(targetElement);
                    }
                }, 200); // 增加延迟确保组件完全渲染
            }

            console.log('✅ 博客功能初始化完成！');
        }

        // 如果组件已经加载，直接初始化；否则等待事件
        if (document.querySelector('.blog-navbar')) {
            initAfterComponents();
        } else {
            window.addEventListener('blogComponentsReady', initAfterComponents);
            // 备用方案：300ms后强制初始化
            setTimeout(() => {
                if (!document.querySelector('.toc-list')?.children.length) {
                    console.warn('等待超时，强制初始化');
                    initAfterComponents();
                }
            }, 300);
        }
    }

    // 立即执行初始化
    init();

})();
