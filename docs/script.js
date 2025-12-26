// --- DOT GRID PHYSICS ANIMATION ---
const canvas = document.getElementById('dotCanvas');
const ctx = canvas.getContext('2d');
let width, height, dots = [];
const gap = 32;
const mouse = { x: -1000, y: -1000 };

function initDots() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    dots = [];
    for (let x = 0; x < width; x += gap) {
        for (let y = 0; y < height; y += gap) {
            dots.push({
                x, y,
                originX: x,
                originY: y,
                vx: 0,
                vy: 0,
                size: 1.5,
                opacity: 0.15 + Math.random() * 0.1
            });
        }
    }
}

function animate() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    
    dots.forEach(dot => {
        const dx = mouse.x - dot.x;
        const dy = mouse.y - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximity = 220;

        if (dist < proximity) {
            const angle = Math.atan2(dy, dx);
            const force = (proximity - dist) / proximity;
            // Stronger, smoother repulsion
            dot.vx -= Math.cos(angle) * force * 1.8;
            dot.vy -= Math.sin(angle) * force * 1.8;
            dot.opacity = Math.min(0.9, dot.opacity + 0.1);
        }

        // Elastic return force
        const rx = (dot.originX - dot.x) * 0.12;
        const ry = (dot.originY - dot.y) * 0.12;
        dot.vx += rx;
        dot.vy += ry;
        
        // Friction
        dot.vx *= 0.88;
        dot.vy *= 0.88;

        dot.x += dot.vx;
        dot.y += dot.vy;
        
        // Fade back to base opacity
        dot.opacity += (0.15 - dot.opacity) * 0.05;

        ctx.fillStyle = `rgba(255, 255, 255, ${dot.opacity})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fill();
    });
    requestAnimationFrame(animate);
}

window.addEventListener('resize', initDots);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// --- BENTO CARD GLOW EFFECT ---
function initBentoGlow() {
    document.querySelectorAll('.magic-bento-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--glow-x', `${x}px`);
            card.style.setProperty('--glow-y', `${y}px`);
        });
    });
}

// --- AUTHENTIC CARD SWAP LOGIC ---
const cardData = [
    { 
        title: '批量导出', 
        img: './images/feat1.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' 
    },
    { 
        title: '保留层级', 
        img: './images/feat2.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>' 
    },
    { 
        title: '多格式支持', 
        img: './images/feat3.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>' 
    },
    { 
        title: '安全稳定', 
        img: './images/feat4.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>' 
    }
];

const cardStack = document.getElementById('cardStack');
let currentIdx = 0;
let isTransitioning = false;
let cardElements = [];
const UPDATE_BENTO_KEY = 'shimo_export_update_bento_v2025_01';

function initCards() {
    if (!cardStack) return;
    cardStack.innerHTML = '';
    cardElements = [];
    
    cardData.forEach((data, i) => {
        const card = document.createElement('div');
        card.className = 'CardSwap_card__HvzWu';
        card.dataset.id = i;
        card.innerHTML = `
            <div class="CardSwap_windowHeader__pAaBr">
                <div class="CardSwap_windowIcon__mOIYe">${data.icon}</div>
                <div class="CardSwap_windowTitle__Q1Asa"><span>${data.title}</span></div>
            </div>
            <div class="CardSwap_windowContent__OWUTy" style="flex: 1; position: relative; width: 100%; background: rgba(0, 0, 0, 0.2);">
                <div class="CardSwap_cardImage__HhGOd" style="position: absolute; inset: 0; width: 100%; height: 100%;">
                    <img src="${data.img}" alt="${data.title}" draggable="false" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                </div>
            </div>
        `;
        cardStack.appendChild(card);
        cardElements.push(card);
    });
    renderCards();
}

function renderCards() {
    cardElements.forEach((card, i) => {
        const offset = (i - currentIdx + cardData.length) % cardData.length;
        
        // Skip front card if it's currently animating
        if (card.classList.contains('dropping') || card.classList.contains('slide-back')) return;

        // Sample-inspired physics values
        let zIndex = 20 - offset;
        let opacity = offset === 0 ? 1 : offset === 1 ? 0.8 : offset === 2 ? 0.7 : offset === 3 ? 0.6 : 0.5;
        let x = offset * 60;
        let y = offset * -70;
        let z = offset * -150;
        let skewY = 6;
        let filter = offset === 0 ? 'none' : `blur(${offset * 0.8}px)`;
        let visibility = offset > 4 ? 'hidden' : 'visible';

        card.style.zIndex = zIndex;
        card.style.opacity = opacity;
        card.style.visibility = visibility;
        card.style.filter = filter;
        card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${z}px) skewY(${skewY}deg)`;
    });
}

function cycleCards() {
    if (isTransitioning) return;
    const topCard = cardElements.find(c => c.dataset.id === currentIdx.toString());

    if (topCard) {
        isTransitioning = true;
        
        // Phase 1: 下移到停顿点
        topCard.classList.add('dropping');
        
        // Phase 2: 开始绕后，同时推进队列
        setTimeout(() => {
            topCard.classList.remove('dropping');
            topCard.classList.add('slide-back');

            currentIdx = (currentIdx + 1) % cardData.length;
            renderCards();
        }, 450); // 匹配 drop-phase 0.45s

        // Phase 3: 动画结束后收尾
        setTimeout(() => {
            topCard.classList.remove('slide-back');
            renderCards();
            isTransitioning = false;
        }, 1000); // 总时长 0.45s + 0.55s
    }
}

function initUpdateNotificationBento() {
    const container = document.getElementById('updateNotificationBento');
    if (!container) return;

    try {
        if (localStorage.getItem(UPDATE_BENTO_KEY) === '1') {
            return;
        }
    } catch (e) {}

    const closeBtn = document.getElementById('updateNotificationClose');
    const hideCheckbox = document.getElementById('updateNotificationHide');
    const gotItBtn = document.getElementById('updateNotificationGotIt');

    const dismiss = (e) => {
        e.stopPropagation();
        if (hideCheckbox && hideCheckbox.checked) {
            try { localStorage.setItem(UPDATE_BENTO_KEY, '1'); } catch (e) {}
        }
        container.classList.remove('show');
        setTimeout(() => container.hidden = true, 600);
    };

    const minimize = () => {
        if (!container.classList.contains('show')) return;
        container.classList.add('minimized');
    };

    const expand = () => {
        container.classList.remove('minimized');
    };

    closeBtn?.addEventListener('click', dismiss);
    gotItBtn?.addEventListener('click', dismiss);
    container.addEventListener('click', (e) => {
        if (container.classList.contains('minimized')) {
            expand();
        }
    });

    // 1. 5s 后渐变出现
    setTimeout(() => {
        container.hidden = false;
        // 强制重绘以触发 transition
        container.offsetHeight; 
        container.classList.add('show');

        // 2. 出现 5s 后自动收起
        setTimeout(minimize, 5000);
    }, 5000);
}

// Initialize after DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initDots();
    animate();
    initBentoGlow();
    initCards(); // Use initCards for efficient management
    setInterval(cycleCards, 5000);
    initUpdateNotificationBento();
});

