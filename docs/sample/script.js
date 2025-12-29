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

window.addEventListener('resize', () => {
    initDots();
    renderCards();
});
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

// --- BENTO CARD GLOW EFFECT ---
function initBentoGlow() {
    const cards = document.querySelectorAll('.magic-bento-card');
    cards.forEach(card => {
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
        title: 'Cloud Integration', 
        img: './images/1-5.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a3.5 3.5 0 0 1-7 0c0-.18.01-.36.03-.53A3.501 3.501 0 0 1 7 12c0-1.93 1.57-3.5 3.5-3.5.18 0 .36.01.53.03A5.5 5.5 0 0 1 21 12c0 2.12-1.19 3.96-2.96 4.93.31.33.46.77.46 1.07 0 1.1-.9 2-2 2Z"/></svg>' 
    },
    { 
        title: 'QR Generation', 
        img: './images/1-1.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v.01"/></svg>' 
    },
    { 
        title: 'Right click', 
        img: './images/1-2.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/></svg>' 
    },
    { 
        title: 'Artistic Tuning', 
        img: './images/1-4.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.6 1.5-1.5 0-.4-.1-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-9-10-9z"/></svg>' 
    },
    { 
        title: 'Intelligent Scan', 
        img: './images/1-3.png', 
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/><path d="M12 7v10"/></svg>' 
    }
];

const cardStack = document.getElementById('cardStack');
let currentIdx = 0;
let isTransitioning = false;
let cardElements = [];
const UPDATE_BENTO_KEY = 'pixelqr_update_bento_v2025_01';

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
            <div class="CardSwap_cardContent__OWUTy">
                <div class="CardSwap_cardImage__HhGOd">
                    <img src="${data.img}" alt="${data.title}" draggable="false">
                </div>
            </div>
        `;
        cardStack.appendChild(card);
        cardElements.push(card);
    });
    renderCards();
}

function renderCards() {
    const isMobile = window.innerWidth <= 640;
    const isTablet = window.innerWidth <= 1024 && window.innerWidth > 640;

    cardElements.forEach((card, i) => {
        // Calculate logical offset
        const offset = (i - currentIdx + cardData.length) % cardData.length;
        
        // 为堆叠卡片添加交错延迟，营造“被推”的波动感
        const staggerDelay = isTransitioning ? (offset * 80) : 0;
        card.style.transitionDelay = `${staggerDelay}ms`;

        // Base styles for stacked cards
        let zIndex = 20 - offset;
        let opacity = 0.95; // Fully opaque
        
        let xOffsetMultiplier = isMobile ? 20 : isTablet ? 40 : 60;
        let yOffsetMultiplier = isMobile ? -30 : isTablet ? -50 : -70;
        let zOffsetMultiplier = isMobile ? -80 : isTablet ? -120 : -150;

        let x = offset * xOffsetMultiplier;
        let y = offset * yOffsetMultiplier;
        let z = offset * zOffsetMultiplier;
        let skewY = 6;
        let filter = 'none'; // No blur
        let visibility = offset > 4 ? 'hidden' : 'visible';

        // Set z-index always, but skip other styles if it's currently in an explicit CSS animation phase
        // to avoid conflicting with keyframes.
        card.style.zIndex = zIndex;
        
        if (card.classList.contains('dropping') || card.classList.contains('slide-back')) {
            return;
        }

        card.style.opacity = opacity;
        card.style.visibility = visibility;
        card.style.filter = filter;
        card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${z}px) skewY(${skewY}deg)`;
    });
}

function cycleCards() {
    if (isTransitioning) return;
    
    // Find the current top card by its data-id
    const topCard = cardElements.find(c => c.dataset.id === currentIdx.toString());

    if (topCard) {
        isTransitioning = true;
        
        // Phase 1: Card drops down (Visual focus)
        topCard.classList.add('dropping');
        
        // Phase 2: Midway through drop, switch to slide-back
        setTimeout(() => {
            topCard.classList.remove('dropping');
            topCard.classList.add('slide-back');

            // Phase 2.5: 额外延迟，等待绕后卡片“钻入”深层后再触发前移
            setTimeout(() => {
                currentIdx = (currentIdx + 1) % cardData.length;
                renderCards();
            }, 400); 
        }, 800); 

        // Phase 3: Cleanup and reset
        setTimeout(() => {
            // Before removing the animation class, temporarily disable transitions
            // to prevent the browser from trying to transition between the 
            // animation end-state and the JS-applied state.
            topCard.style.transition = 'none';
            topCard.classList.remove('slide-back');
            isTransitioning = false;
            
            // Sync final state
            renderCards();
            
            // Re-enable transitions after a tiny delay
            requestAnimationFrame(() => {
                topCard.style.transition = '';
            });
        }, 2400); 
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

