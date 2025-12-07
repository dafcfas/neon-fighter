const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 内部低分辨率 (复古感的核心)
// 画布物理像素只有 160x240，但在 CSS 里拉伸到了 320x480
const GAME_WIDTH = 160;
const GAME_HEIGHT = 240;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

// ==========================================
// 1. 像素画数据 (Sprite Art)
// 1 = 主色, 2 = 辅色, 3 = 引擎火光
// ==========================================
const sprites = {
    player: [
        [0,0,0,1,1,0,0,0],
        [0,0,1,2,2,1,0,0],
        [0,0,1,2,2,1,0,0],
        [0,1,1,2,2,1,1,0],
        [1,2,2,2,2,2,2,1],
        [1,0,1,2,2,1,0,1],
        [1,0,1,0,0,1,0,1],
        [0,0,3,0,0,3,0,0] // 底部引擎
    ],
    enemy: [
        [1,0,1,1,1,1,0,1],
        [0,1,1,2,2,1,1,0],
        [1,1,2,0,0,2,1,1],
        [1,1,2,2,2,2,1,1],
        [0,1,0,1,1,0,1,0],
        [0,1,0,0,0,0,1,0]
    ],
    bullet: [
        [1],
        [2],
        [1]
    ],
    explosion: [
        [1,0,0,1],
        [0,2,2,0],
        [0,2,2,0],
        [1,0,0,1]
    ]
};

// 调色板
const PALETTE = {
    0: null,       // 透明
    1: '#ffffff',  // 白 (通用轮廓)
    2: '#3b8dbc',  // 蓝 (玩家)
    3: '#ff6b6b',  // 红 (敌人/火光)
    4: '#feca57'   // 黄 (子弹)
};

// 绘图辅助函数：把数组画成像素块
function drawSprite(ctx, spriteData, x, y, colorMap) {
    const pixelSize = 1; // 在低分辨率画布上，1个单位就是1个像素
    for (let r = 0; r < spriteData.length; r++) {
        for (let c = 0; c < spriteData[r].length; c++) {
            const val = spriteData[r][c];
            if (val !== 0) {
                ctx.fillStyle = colorMap[val] || '#fff';
                ctx.fillRect(x + c * pixelSize, y + r * pixelSize, pixelSize, pixelSize);
            }
        }
    }
}

// ==========================================
// 2. 游戏逻辑
// ==========================================

let state = {
    running: false,
    score: 0,
    frames: 0,
    player: { x: 76, y: 200, w: 8, h: 8, hp: 1 },
    bullets: [],
    enemies: [],
    particles: [], // 爆炸碎片
    stars: []      // 背景星星
};

let keys = {};

// 初始化背景星星
for(let i=0; i<30; i++) {
    state.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        speed: 0.5 + Math.random()
    });
}

function initInput() {
    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);
    // 手机触摸支持 (简单版)
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        // 映射触摸坐标到游戏坐标
        const scaleX = GAME_WIDTH / rect.width;
        state.player.x = (touch.clientX - rect.left) * scaleX - 4;
    }, {passive: false});
}

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    
    state.running = true;
    state.score = 0;
    state.player = { x: GAME_WIDTH/2 - 4, y: GAME_HEIGHT - 20, w: 8, h: 8, hp: 1 };
    state.bullets = [];
    state.enemies = [];
    state.particles = [];
    
    loop();
}

function createExplosion(x, y, color) {
    // 生成4-8个像素碎片
    for(let i=0; i<8; i++) {
        state.particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 20,
            color: color
        });
    }
}

function update() {
    state.frames++;

    // 1. 玩家移动
    if (keys['ArrowLeft'] || keys['a']) state.player.x -= 1.5;
    if (keys['ArrowRight'] || keys['d']) state.player.x += 1.5;
    
    // 限制边界
    if (state.player.x < 0) state.player.x = 0;
    if (state.player.x > GAME_WIDTH - 8) state.player.x = GAME_WIDTH - 8;

    // 2. 射击 (自动每15帧一发)
    if (state.frames % 15 === 0) {
        state.bullets.push({ x: state.player.x + 3, y: state.player.y, w: 1, h: 3 });
    }

    // 3. 子弹更新
    state.bullets.forEach((b, i) => {
        b.y -= 3;
        if (b.y < 0) state.bullets.splice(i, 1);
    });

    // 4. 敌人生成与更新
    // 难度随分数增加：每60帧生成，分数越高间隔越短
    const spawnRate = Math.max(20, 60 - Math.floor(state.score / 100));
    if (state.frames % spawnRate === 0) {
        state.enemies.push({
            x: Math.random() * (GAME_WIDTH - 8),
            y: -8,
            w: 8, h: 6,
            speed: 0.5 + (state.score / 1000)
        });
    }

    state.enemies.forEach((e, i) => {
        e.y += e.speed;
        
        // 碰撞检测：子弹打敌人
        state.bullets.forEach((b, bi) => {
            if (b.x < e.x + e.w && b.x + b.w > e.x &&
                b.y < e.y + e.h && b.y + b.h > e.y) {
                // 击中
                state.enemies.splice(i, 1);
                state.bullets.splice(bi, 1);
                createExplosion(e.x + 4, e.y + 3, '#ff4d4d');
                state.score += 10;
                document.getElementById('score').innerText = state.score.toString().padStart(4, '0');
            }
        });

        // 碰撞检测：敌人撞玩家
        if (state.player.x < e.x + e.w && state.player.x + state.player.w > e.x &&
            state.player.y < e.y + e.h && state.player.y + state.player.h > e.y) {
            gameOver();
        }

        if (e.y > GAME_HEIGHT) state.enemies.splice(i, 1);
    });

    // 5. 粒子更新
    state.particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if(p.life <= 0) state.particles.splice(i, 1);
    });
    
    // 6. 背景星星滚动
    state.stars.forEach(s => {
        s.y += s.speed;
        if(s.y > GAME_HEIGHT) { s.y = 0; s.x = Math.random() * GAME_WIDTH; }
    });
}

function draw() {
    // 清空屏幕 (深灰色背景)
    ctx.fillStyle = '#202028';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 画星星
    ctx.fillStyle = '#555';
    state.stars.forEach(s => ctx.fillRect(s.x, s.y, 1, 1));

    // 画玩家 (使用 Sprite 数据, 自定义配色)
    // 玩家颜色映射: 1=白, 2=天蓝, 3=橙(火焰)
    const playerColors = {1: '#ecf0f1', 2: '#3498db', 3: '#e67e22'};
    drawSprite(ctx, sprites.player, state.player.x, state.player.y, playerColors);

    // 画敌人
    // 敌人颜色映射: 1=白, 2=深红
    const enemyColors = {1: '#ecf0f1', 2: '#c0392b'};
    state.enemies.forEach(e => {
        drawSprite(ctx, sprites.enemy, e.x, e.y, enemyColors);
    });

    // 画子弹 (黄色方块)
    ctx.fillStyle = '#f1c40f';
    state.bullets.forEach(b => {
        ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    // 画粒子
    state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
    });
}

function loop() {
    if (!state.running) return;
    update();
    draw();
    requestAnimationFrame(loop);
}

function gameOver() {
    state.running = false;
    document.getElementById('final-score').innerText = state.score;
    document.getElementById('game-over-screen').style.display = 'block';
}

initInput();
