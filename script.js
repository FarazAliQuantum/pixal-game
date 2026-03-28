/**
 * PixelZone Advanced Game Engine v2
 * Sidebar, Lives System, WASD Support, Improved Graphics
 */

const loader = document.getElementById('loader');
const gameModal = document.getElementById('game-modal');
const closeModal = document.getElementById('close-modal');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('current-score');
const gameOverOverlay = document.getElementById('game-overlay');
const finalScoreDisplay = document.getElementById('final-score');
const modalTitle = document.getElementById('modal-game-title');
const gameControls = document.getElementById('game-controls');
const heartsContainer = document.getElementById('hearts-container');
const livesStat = document.getElementById('lives-stat');
const farmHud = document.getElementById('farm-hud');
const tdHud = document.getElementById('td-hud');

// Game State
let audioCtx;
let currentGame = null;
let gameLoop = null;
let score = 0;
let lives = 3;
let keys = {};
let frameCount = 0;
let particles = [];
let shake = 0;
let mouseX = 0, mouseY = 0;

class Particle {
    constructor(x, y, color, size = 3) {
        this.x = x; this.y = y; this.color = color;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.size = size;
        this.decay = 0.02 + Math.random() * 0.03;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= this.decay;
        this.vx *= 0.95; this.vy *= 0.95;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

function createBurst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.vy = -1; this.life = 1.0;
    }
    update() { this.y += this.vy; this.life -= 0.02; }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color; ctx.font = "10px 'Press Start 2P'";
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

let floatingTexts = [];
function updateFloatingTexts() {
    floatingTexts = floatingTexts.filter(t => t.life > 0);
    floatingTexts.forEach(t => { t.update(); t.draw(); });
}

function updateHUD() {
    if (currentGame === 'farm') {
        const btns = document.querySelectorAll('.tool-btn');
        btns.forEach(b => {
            const text = b.innerText.toLowerCase();
            let isActive = false;
            if (text === 'hoe' && fmTool === 'hoe') isActive = true;
            if (text === 'seed' && fmTool === 'seeds') isActive = true;
            if (text === 'wtr' && fmTool === 'water') isActive = true;
            if (text === 'sell' && fmTool === 'harvest') isActive = true;
            b.style.borderColor = isActive ? "var(--neon-pink)" : "var(--neon-cyan)";
            b.style.boxShadow = isActive ? "0 0 10px var(--neon-pink)" : "none";
        });
    } else if (currentGame === 'td') {
        document.querySelectorAll('.td-btn').forEach(b => {
            const btnText = b.innerText.toLowerCase();
            let isActive = false;
            if (btnText.includes('gun') && tdTool === 'basic') isActive = true;
            if (btnText.includes('sniper') && tdTool === 'sniper') isActive = true;
            if (btnText.includes('rapid') && tdTool === 'rapid') isActive = true;
            if (btnText.includes('sell') && tdTool === 'sell') isActive = true;
            b.style.borderColor = isActive ? "var(--neon-pink)" : "var(--neon-cyan)";
            b.style.boxShadow = isActive ? "0 0 15px var(--neon-pink)" : "none";
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(); });
}

function applyShake() {
    if (shake > 0) {
        const sx = (Math.random() - 0.5) * shake;
        const sy = (Math.random() - 0.5) * shake;
        ctx.translate(sx, sy);
        shake *= 0.9;
        if (shake < 0.1) shake = 0;
    }
}

function distToSegment(p, v, w) {
    const l2 = (v.x-w.x)**2 + (v.y-w.y)**2;
    if (l2 === 0) return Math.sqrt((p.x-v.x)**2 + (p.y-v.y)**2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2);
}

// Hide Loader
window.addEventListener('load', () => {
    bindMobileControls(); // Ensure controls are bound after DOM is ready
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }, 1500);
});

// Audio
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(freq, duration = 0.1, type = 'square', drift = 0) {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (drift) osc.frequency.exponentialRampToValueAtTime(drift, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Global Input (WASD + Arrows + Enter)
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    const key = e.key.toLowerCase();
    keys[key] = true;
    
    // Add aliases for common controls
    if (key === 'w') keys['KeyW'] = true;
    if (key === 'a') keys['KeyA'] = true;
    if (key === 's') keys['KeyS'] = true;
    if (key === 'd') keys['KeyD'] = true;

    if ((e.code === 'Enter' || e.code === 'Space') && gameOverOverlay.style.display === 'flex') {
        startGame();
    }
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
    const key = e.key.toLowerCase();
    keys[key] = false;
    if (key === 'w') keys['KeyW'] = false;
    if (key === 'a') keys['KeyA'] = false;
    if (key === 's') keys['KeyS'] = false;
    if (key === 'd') keys['KeyD'] = false;
});

// Unified shooting logic for Zombie game
function fireZombieBullet(mx, my) {
    if (currentGame === 'zombie') {
        pzReady = true; // Activate on first shot
        const px = pzPlayer.x + pzPlayer.size/2;
        const py = pzPlayer.y + pzPlayer.size/2;
        
        const dxBullet = mx - px;
        const dyBullet = my - py;
        const dist = Math.sqrt(dxBullet*dxBullet + dyBullet*dyBullet) || 1;
        
        pzBullets.push({
            x: px, 
            y: py, 
            vx: (dxBullet/dist) * 14, 
            vy: (dyBullet/dist) * 14 
        });
        
        // Muzzle flash positions
        pzPlayer.muzzleFlash = 5;
        pzPlayer.recoil = 8;
        
        playSound(150, 0.05, 'sawtooth');
        shake = 4;
    }
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    fireZombieBullet(mx, my);
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
});

canvas.addEventListener('mousedown', () => { keys['MouseDown'] = true; });
window.addEventListener('mouseup', () => { keys['MouseDown'] = false; });

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    keys['MouseDown'] = true;
    fireZombieBullet(mouseX, mouseY);
}, {passive: false});

window.addEventListener('touchend', () => { keys['MouseDown'] = false; });

// Mobile Controls Binding
function bindMobileControls() {
    const controls = {
        'ctrl-up': 'KeyW',
        'ctrl-down': 'KeyS',
        'ctrl-left': 'KeyA',
        'ctrl-right': 'KeyD',
        'ctrl-a': 'Space'
    };

    Object.keys(controls).forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;

        const keyCode = controls[id];
        const char = keyCode.replace('Key', '').toLowerCase();

        const press = (e) => {
            e.preventDefault();
            keys[keyCode] = true;
            keys[char] = true;
            if (keyCode === 'Space' && gameOverOverlay.style.display === 'flex') {
                startGame();
            }
        };

        const release = (e) => {
            e.preventDefault();
            keys[keyCode] = false;
            keys[char] = false;
        };

        btn.addEventListener('touchstart', press, {passive: false});
        btn.addEventListener('touchend', release, {passive: false});
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    });
}

// Fullscreen Control
const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.onclick = () => {
    if (!document.fullscreenElement) {
        gameModal.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
};

document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        fullscreenBtn.innerText = "EXIT FULLSCREEN";
        fullscreenBtn.style.backgroundColor = "var(--neon-pink)";
    } else {
        fullscreenBtn.innerText = "GO FULLSCREEN";
        fullscreenBtn.style.backgroundColor = "var(--neon-cyan)";
    }
});

/**
 * --- CORE ENGINE ---
 */
function openGame(id) {
    keys = {}; // Reset all keys on game open to prevent "ghost" movement
    initAudio();
    playSound(400, 0.2, 'sine', 800);
    gameModal.style.display = 'flex';
    currentGame = id;
    
    // UI Setup
    canvas.width = 800;
    canvas.height = 500;
    score = 0;
    lives = 3;
    updateHearts();
    scoreDisplay.innerText = "0";
    gameOverOverlay.style.display = 'none';
    livesStat.style.display = (id === 'snake') ? 'flex' : 'none';
    if (farmHud) farmHud.style.display = (id === 'farm') ? 'flex' : 'none';
    if (tdHud) tdHud.style.display = (id === 'td') ? 'flex' : 'none';
    if (id === 'farm' || id === 'td') updateHUD();

    startGame();
}

function startGame() {
    if (gameLoop) cancelAnimationFrame(gameLoop);
    keys = {}; // HARD RESET keys at start to prevent "carry-over" moves
    gameOverOverlay.style.display = 'none';
    score = 0;
    scoreDisplay.innerText = "0";
    frameCount = 0;

    switch(currentGame) {
        case 'snake': 
            modalTitle.innerText = "NEON SNAKE";
            gameControls.innerText = "WASD/ARROWS";
            initSnake(); break;
        case 'jump': 
            modalTitle.innerText = "PIXEL JUMP";
            gameControls.innerText = "A/D or ARROWS";
            initJump(); break;
        case 'space': 
            modalTitle.innerText = "STAR DEFENDER";
            gameControls.innerText = "WASD + SPACE";
            initSpace(); break;
        case 'car': 
            modalTitle.innerText = "CYBER RACER";
            gameControls.innerText = "A / D";
            initCar(); break;
        case 'block': 
            modalTitle.innerText = "BLOCK SMASH";
            gameControls.innerText = "A / D";
            initBlock(); break;
        case 'dungeon': 
            modalTitle.innerText = "CRYPT QUEST";
            gameControls.innerText = "WASD SURVIVAL";
            initDungeon(); break;
        case 'bird': 
            modalTitle.innerText = "PIXEL BIRD";
            gameControls.innerText = "SPACE / TOUCH";
            initBird(); break;
        case 'dino': 
            modalTitle.innerText = "DINO RUNNER";
            gameControls.innerText = "SPACE TO JUMP";
            initDino(); break;
        case 'shadow': 
            modalTitle.innerText = "NEON SHADOW RUNNER";
            gameControls.innerText = "SPACE: JUMP | S: SLIDE";
            initShadow(); break;
        case 'zombie': 
            modalTitle.innerText = "ZOMBIE SURVIVAL";
            gameControls.innerText = "WASD: MOVE | CLICK: SHOOT";
            initZombie(); break;
        case 'miner': 
            modalTitle.innerText = "SPACE MINER";
            gameControls.innerText = "WASD: MOVE | SPACE: BOOST";
            initMiner(); break;
        case 'shooter': 
            modalTitle.innerText = "NEON SHOOTER";
            gameControls.innerText = "WASD: MOVE | CLICK: FIRE";
            initShooter(); break;
        case 'farm':
            modalTitle.innerText = "PIXEL FARM";
            gameControls.innerText = "WASD: MOVE | CLICK: INTERACT | 1-4: TOOLS";
            initFarm(); break;
        case 'td':
            modalTitle.innerText = "PIXEL DEFENSE";
            gameControls.innerText = "MOUSE: PLACE TOWERS | STOP WAVES!";
            initTD(); break;
    }
}

function updateHearts() {
    const hearts = heartsContainer.getElementsByClassName('heart');
    for (let i = 0; i < hearts.length; i++) {
        hearts[i].classList.toggle('lost', i >= lives);
    }
}

function showGameOver() {
    playSound(150, 0.5, 'sawtooth', 50);
    gameOverOverlay.style.display = 'flex';
    finalScoreDisplay.innerText = `FINAL SCORE: ${score}`;
}

function stopGame() {
    if (gameLoop) cancelAnimationFrame(gameLoop);
    gameLoop = null;
    currentGame = null;
    if (audioCtx) audioCtx.suspend();
    if (farmHud) farmHud.style.display = 'none';
    if (tdHud) tdHud.style.display = 'none';
}

closeModal.onclick = () => {
    gameModal.style.display = 'none';
    stopGame();
};

/** 
 * --- 1. NEON SNAKE (With 3 Chances) ---
 */
let snake, food, dx, dy;
function initSnake() {
    snake = [{x: 400, y: 240}, {x: 380, y: 240}, {x: 360, y: 240}];
    food = {x: 100, y: 100};
    dx = 20; dy = 0;
    gameLoop = requestAnimationFrame(loopSnake);
}

function loopSnake() {
    if (currentGame !== 'snake') return;
    frameCount++;
    if (frameCount % 7 === 0) {
        // Controls (WASD + Arrows)
        // Controls (WASD + Arrows)
        if ((keys['KeyW'] || keys['w'] || keys['ArrowUp']) && dy === 0) { dx = 0; dy = -20; playSound(440, 0.05); }
        if ((keys['KeyS'] || keys['s'] || keys['ArrowDown']) && dy === 0) { dx = 0; dy = 20; playSound(440, 0.05); }
        if ((keys['KeyA'] || keys['a'] || keys['ArrowLeft']) && dx === 0) { dx = -20; dy = 0; playSound(440, 0.05); }
        if ((keys['KeyD'] || keys['d'] || keys['ArrowRight']) && dx === 0) { dx = 20; dy = 0; playSound(440, 0.05); }

        const head = {x: snake[0].x + dx, y: snake[0].y + dy};
        
        // Wall/Self Collision check
        const hitWall = head.x < 0 || head.x >= 800 || head.y < 0 || head.y >= 500;
        const hitSelf = snake.some(p => p.x === head.x && p.y === head.y);

        if (hitWall || hitSelf) {
            lives--;
            updateHearts();
            shake = 15;
            createBurst(head.x, head.y, "#ef4444", 20);
            playSound(200, 0.3, 'square');
            if (lives <= 0) { showGameOver(); return; }
            // Reset position but keep score
            snake = [{x: 400, y: 240}, {x: 380, y: 240}, {x: 360, y: 240}];
            dx = 20; dy = 0;
        } else {
            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score += 10;
                scoreDisplay.innerText = score;
                createBurst(food.x, food.y, "#f472b6", 15);
                playSound(880, 0.1, 'sine');
                food = {
                    x: Math.floor(Math.random() * 39) * 20,
                    y: Math.floor(Math.random() * 24) * 20
                };
            } else {
                snake.pop();
            }
        }
    }
    drawBackground();
    ctx.save();
    applyShake();
    
    // Pulsing Food
    const pulse = Math.sin(Date.now() / 150) * 4;
    ctx.shadowBlur = 15 + pulse;
    ctx.shadowColor = "#f472b6";
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(food.x - pulse/2, food.y - pulse/2, 18 + pulse, 18 + pulse);
    
    // Snake Drawing
    snake.forEach((p, i) => {
        ctx.shadowBlur = (i === 0) ? 20 : 10;
        ctx.shadowColor = (i === 0) ? "#22d3ee" : "#0ea5e9";
        ctx.fillStyle = (i === 0) ? "#fff" : `rgba(34, 211, 238, ${1 - i/snake.length})`;
        
        if (i === 0) {
            // Head with "Eyes"
            ctx.fillRect(p.x, p.y, 18, 18);
            ctx.fillStyle = "#000";
            ctx.fillRect(p.x + 4, p.y + 4, 3, 3);
            ctx.fillRect(p.x + 11, p.y + 4, 3, 3);
        } else {
            ctx.fillRect(p.x + 2, p.y + 2, 14, 14);
        }
    });

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopSnake);
}

/** 
 * --- 2. STAR DEFENDER ---
 */
let player, pBullets, enemies, sStars, psReady;
function initSpace() {
    psReady = false;
    player = {x: 380, y: 400, w: 40, h: 20, vx: 0, vy: 0, tilt: 0};
    pBullets = []; enemies = [];
    sStars = Array.from({length: 50}, () => ({x: Math.random()*800, y: Math.random()*500, s: 1 + Math.random()*3}));
    gameLoop = requestAnimationFrame(loopSpace);
}

function loopSpace() {
    if (currentGame !== 'space') return;
    frameCount++;
    
    // Physics-based movement (Inertia)
    const acc = 1.2;
    const friction = 0.92;
    
    if (keys['KeyA'] || keys['a'] || keys['ArrowLeft']) { player.vx -= acc; if (frameCount > 10) psReady = true; }
    if (keys['KeyD'] || keys['d'] || keys['ArrowRight']) { player.vx += acc; if (frameCount > 10) psReady = true; }
    if (keys['KeyW'] || keys['w'] || keys['ArrowUp']) { player.vy -= acc; if (frameCount > 10) psReady = true; }
    if (keys['KeyS'] || keys['s'] || keys['ArrowDown']) { player.vy += acc; if (frameCount > 10) psReady = true; }
    if (keys['Space'] && frameCount > 10) psReady = true;

    if (psReady) {
        player.vx *= friction;
        player.vy *= friction;
        player.x += player.vx;
        player.y += player.vy;
    }
    
    // Dynamic Tilt
    player.tilt = player.vx * 0.05;

    // Wall Bouncing
    if (player.x < 0) { player.x = 0; player.vx *= -0.5; }
    if (player.x > 800 - player.w) { player.x = 800 - player.w; player.vx *= -0.5; }
    if (player.y < 0) { player.y = 0; player.vy *= -0.5; }
    if (player.y > (500 - player.h)) { player.y = 500 - player.h; player.vy *= -0.5; }

    if (psReady && keys['Space'] && frameCount % 8 === 0) {
        pBullets.push({x: player.x + player.w/2 - 2, y: player.y, w: 4, h: 15});
        playSound(900, 0.05, 'triangle', 200);
        shake = 3;
    }
    if (psReady && frameCount % 35 === 0) enemies.push({x: Math.random()*760, y: -40, w: 40, h: 40, hp: 1, speed: 2 + Math.random() * 2});

    pBullets.forEach((b, bi) => {
        if (!psReady) return;
        b.y -= 12;
        if (b.y < -20) pBullets.splice(bi, 1);
    });

    enemies.forEach((e, ei) => {
        if (!psReady) return;
        e.y += e.speed + (score/1000);
        // Sinusoidal Weaving
        e.x += Math.sin(frameCount/20 + ei) * 2;
        
        if (e.y > 500) { shake = 20; showGameOver(); return; }
        pBullets.forEach((b, bi) => {
            if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
                createBurst(e.x + 20, e.y + 20, "#f472b6", 15);
                enemies.splice(ei, 1);
                pBullets.splice(bi, 1);
                score += 100;
                scoreDisplay.innerText = score;
                playSound(300, 0.1, 'square');
                shake = 5;
            }
        });
    });

    drawBackground();
    ctx.save();
    applyShake();
    
    if (!psReady) {
        ctx.fillStyle = "#fff";
        ctx.font = "20px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("READY? TAP TO FLY", 400, 250);
    }

    sStars.forEach(s => {
        s.y += s.s; if (s.y > 500) s.y = 0;
        ctx.fillStyle = `rgba(255,255,255,${s.s/5})`;
        ctx.fillRect(s.x, s.y, s.s/2, s.s/2);
    });

    // Ship Drawing with Tilt
    ctx.translate(player.x + player.w/2, player.y + player.h/2);
    ctx.rotate(player.tilt);
    const px = -player.w/2, py = -player.h/2;

    ctx.shadowBlur = 15; ctx.shadowColor = "#22d3ee";
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(px + 10, py, 20, 20); // Body
    
    ctx.fillStyle = "#0ea5e9"; // Wings
    ctx.beginPath();
    ctx.moveTo(px, py + 20); ctx.lineTo(px + 10, py); ctx.lineTo(px + 10, py + 20); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + 40, py + 20); ctx.lineTo(px + 30, py); ctx.lineTo(px + 30, py + 20); ctx.fill();
    
    ctx.restore(); // Restore tilt for bullets/enemies

    // Bullets
    ctx.shadowColor = "#fff"; ctx.fillStyle = "#fff";
    pBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

    // Enemies
    enemies.forEach(e => {
        ctx.shadowColor = "#f472b6"; ctx.fillStyle = "#f472b6";
        ctx.fillRect(e.x + 10, e.y + 10, 20, 20);
        const anim = Math.sin(frameCount/10) * 5;
        ctx.fillRect(e.x, e.y + 15 + anim, 10, 10);
        ctx.fillRect(e.x + 30, e.y + 15 + anim, 10, 10);
        ctx.fillStyle = "#fff";
        ctx.fillRect(e.x + 15, e.y + 15, 3, 3);
        ctx.fillRect(e.x + 22, e.y + 15, 3, 3);
    });

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopSpace);
}

/** 
 * --- 3. PIXEL JUMP ---
 */
let pjPlayer, pjPlats, pjStars, pjReady;
function initJump() {
    pjReady = false;
    pjPlayer = {x: 400, y: 250, vx: 0, vy: 0, w: 30, h: 30, sx: 1, sy: 1, dir: 1};
    pjPlats = Array.from({length: 7}, (_, i) => ({x: Math.random()*700, y: i*80, w: 100, type: i % 3 === 0 ? "neon" : "normal"}));
    pjStars = Array.from({length: 40}, () => ({x: Math.random()*800, y: Math.random()*500, r: Math.random()*2, s: Math.random()*0.5}));
    gameLoop = requestAnimationFrame(loopJump);
}

function loopJump() {
    if (currentGame !== 'jump') return;
    
    if (pjReady) {
        pjPlayer.vy += 0.5;
        pjPlayer.y += pjPlayer.vy;
    } else {
        if (keys['KeyA'] || keys['a'] || keys['ArrowLeft'] || keys['KeyD'] || keys['d'] || keys['ArrowRight']) pjReady = true;
    }
    
    if (keys['KeyA'] || keys['a'] || keys['ArrowLeft']) { pjPlayer.x -= 7; pjPlayer.dir = -1; }
    if (keys['KeyD'] || keys['d'] || keys['ArrowRight']) { pjPlayer.x += 7; pjPlayer.dir = 1; }

    // Squash & Stretch
    if (pjPlayer.vy < 0) {
        pjPlayer.sx = 0.8; pjPlayer.sy = 1.2; // Stretching up
    } else {
        pjPlayer.sx = 1.1; pjPlayer.sy = 0.9; // Squashing down
    }

    pjPlats.forEach(p => {
        if (pjPlayer.vy > 0 && pjPlayer.x + pjPlayer.w > p.x && pjPlayer.x < p.x + p.w && pjPlayer.y + pjPlayer.h > p.y && pjPlayer.y + pjPlayer.h < p.y + 15) {
            pjPlayer.vy = -15;
            pjPlayer.sx = 1.4; pjPlayer.sy = 0.6; // Impact squash
            score += 10; scoreDisplay.innerText = score;
            createBurst(pjPlayer.x + 15, pjPlayer.y + 30, "#4ade80", 10);
            shake = 3;
            playSound(600, 0.1, 'sine', 1200);
        }
        p.y += 2.5 + (score/2000);
        if (p.y > 500) { p.y = 0; p.x = Math.random()*700; p.w = 80 + Math.random()*40; }
    });

    // Boundary check outside loop
    if (pjReady && pjPlayer.y > 520) { shake = 20; showGameOver(); return; }

    // Draw Background with Depth
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, 800, 500);
    
    // Parallax Stars
    pjStars.forEach(s => {
        s.y += s.s; if(s.y > 500) s.y = 0;
        ctx.fillStyle = `rgba(34, 211, 238, ${s.s})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    });

    // Distant City (Parallax)
    ctx.fillStyle = "rgba(10, 10, 30, 0.8)";
    for(let i=0; i<800; i+=60) {
        const h = 50 + Math.sin(i + frameCount*0.01) * 20;
        ctx.fillRect(i, 500-h, 50, h);
    }

    ctx.save();
    applyShake();
    
    // Platforms Redesign
    pjPlats.forEach(p => {
        ctx.shadowBlur = 10; ctx.shadowColor = "#4ade80";
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(p.x, p.y, p.w, 12);
        // Energy core
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x + 5, p.y + 4, p.w - 10, 3);
        // Bevel
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(p.x, p.y + 10, p.w, 2);
    });

    // Player with Squash/Stretch
    ctx.translate(pjPlayer.x + 15, pjPlayer.y + 15);
    ctx.scale(pjPlayer.sx, pjPlayer.sy);
    
    ctx.shadowBlur = 20; ctx.shadowColor = "#22d3ee";
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(-15, -15, 30, 30);
    
    // "Faces"
    ctx.fillStyle = "#fff";
    const eyeX = pjPlayer.dir * 5;
    ctx.fillRect(eyeX - 8, -5, 6, 6);
    ctx.fillRect(eyeX + 2, -5, 6, 6);
    ctx.fillStyle = "#000";
    ctx.fillRect(eyeX - 6, -3, 3, 3);
    ctx.fillRect(eyeX + 4, -3, 3, 3);

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopJump);
}

/** 
 * --- 4. CYBER RACER ---
 */
let crCar, crObstacles, crReady, crRoadStars;
function initCar() {
    crReady = false;
    crCar = {x: 380, y: 400, w: 40, h: 70, vx: 0, tilt: 0};
    crObstacles = [];
    crRoadStars = Array.from({length: 20}, () => ({x: 150 + Math.random()*500, y: Math.random()*500, s: 15 + Math.random()*10}));
    gameLoop = requestAnimationFrame(loopCar);
}

function loopCar() {
    if (currentGame !== 'car') return;
    frameCount++;
    
    // Inertia physics
    const acc = 1.2;
    const friction = 0.9;
    if (keys['KeyA'] || keys['a'] || keys['ArrowLeft']) { crCar.vx -= acc; crReady = true; }
    if (keys['KeyD'] || keys['d'] || keys['ArrowRight']) { crCar.vx += acc; crReady = true; }
    
    if (crReady) {
        crCar.vx *= friction;
        crCar.x += crCar.vx;
        crCar.tilt = crCar.vx * 0.05;
        
        // Boundaries (Road is 150 to 650)
        if (crCar.x < 155) { crCar.x = 155; crCar.vx *= -0.5; }
        if (crCar.x > 645 - crCar.w) { crCar.x = 645 - crCar.w; crCar.vx *= -0.5; }
        
        // Speed spawn obstacles
        if (frameCount % 25 === 0) crObstacles.push({x: 170 + Math.random()*420, y: -100, w: 45, h: 80, s: 8 + Math.random()*8});
    }

    crObstacles.forEach((o, i) => {
        if (!crReady) return;
        o.y += o.s;
        if (o.y > 500) { crObstacles.splice(i, 1); score += 50; scoreDisplay.innerText = score; }
        if (crCar.x < o.x + o.w && crCar.x + crCar.w > o.x && crCar.y < o.y + o.h && crCar.y + crCar.h > o.y) {
            createBurst(crCar.x + 20, crCar.y + 20, "#f472b6", 20);
            shake = 15; showGameOver(); return;
        }
    });

    drawBackground();
    ctx.save();
    applyShake();
    
    // Side Railings (Glowing Neon)
    ctx.shadowBlur = 15; ctx.shadowColor = "var(--neon-cyan)";
    ctx.fillStyle = "var(--neon-cyan)";
    ctx.fillRect(145, 0, 5, 500);
    ctx.fillRect(650, 0, 5, 500);

    // Speed Lines (Parallax)
    crRoadStars.forEach(s => {
        if (crReady) s.y += s.s; if (s.y > 500) s.y = 0;
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(s.x, s.y, 2, 40);
    });

    if (!crReady) {
        ctx.fillStyle = "#fff";
        ctx.font = "20px 'Press Start 2P'"; ctx.textAlign = "center";
        ctx.fillText("DRIFT WITH WASD", 400, 250);
    }
    
    // Ghostly road floor
    ctx.fillStyle = "rgba(34, 211, 238, 0.05)";
    ctx.fillRect(150, 0, 500, 500);
    
    // Road Markings
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -frameCount * 15;
    ctx.beginPath(); ctx.moveTo(400,0); ctx.lineTo(400,500); ctx.stroke();
    ctx.setLineDash([]);

    // Draw Player Car
    ctx.translate(crCar.x + crCar.w/2, crCar.y + crCar.h/2);
    ctx.rotate(crCar.tilt);
    const px = -crCar.w/2, py = -crCar.h/2;

    // Body
    ctx.shadowBlur = 15; ctx.shadowColor = "#f472b6";
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(px, py, crCar.w, crCar.h);
    // Cockpit
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(px + 5, py + 12, 30, 20);
    // Taillights
    ctx.fillStyle = "#ff0000"; ctx.fillRect(px + 2, py + crCar.h - 5, 10, 3); ctx.fillRect(px + 28, py + crCar.h - 5, 10, 3);
    // Exhaust particles
    if (crReady && frameCount % 3 === 0) particles.push(new Particle(crCar.x + 20, crCar.y + 70, "#fbbf24", 2));

    ctx.restore();

    // Draw Obstacles (Now detailed blue cars)
    crObstacles.forEach(o => {
        ctx.save();
        ctx.translate(o.x + o.w/2, o.y + o.h/2);
        
        const ox = -o.w/2, oy = -o.h/2;
        
        ctx.shadowBlur = 10; ctx.shadowColor = "#22d3ee";
        ctx.fillStyle = "#22d3ee";
        // Body
        ctx.fillRect(ox, oy, o.w, o.h);
        // Cockpit (facing towards player)
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(ox + 5, oy + o.h - 30, 30, 15);
        // Headlights
        ctx.shadowBlur = 15; ctx.shadowColor = "#fff";
        ctx.fillStyle = "#fff";
        ctx.fillRect(ox + 2, oy + o.h - 5, 10, 4);
        ctx.fillRect(ox + o.w - 12, oy + o.h - 5, 10, 4);
        
        ctx.restore();
    });
    
    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopCar);
}

/** 
 * --- 5. BLOCK SMASH ---
 */
let bsPad, bsBall, bsBricks, bsReady;
function initBlock() {
    bsReady = false;
    bsPad = {x: 350, y: 460, w: 120, h: 15};
    bsBall = {x: 400, y: 400, vx: 5, vy: -5, r: 8};
    bsBricks = [];
    for(let r=0; r<5; r++) for(let c=0; c<12; c++) bsBricks.push({x: 40 + c*62, y: 60 + r*25, w: 55, h: 20, h: false});
    gameLoop = requestAnimationFrame(loopBlock);
}

function loopBlock() {
    if (currentGame !== 'block') return;
    if (keys['KeyA'] || keys['a'] || keys['ArrowLeft']) { bsPad.x -= 10; bsReady = true; }
    if (keys['KeyD'] || keys['d'] || keys['ArrowRight']) { bsPad.x += 10; bsReady = true; }
    
    if (bsReady) {
        bsBall.x += bsBall.vx; bsBall.y += bsBall.vy;
        if (bsBall.x < 0 || bsBall.x > 800) bsBall.vx *= -1;
        if (bsBall.y < 0) bsBall.vy *= -1;
        if (bsBall.y + bsBall.r > bsPad.y && bsBall.x > bsPad.x && bsBall.x < bsPad.x + bsPad.w) {
            bsBall.vy = -Math.abs(bsBall.vy);
            playSound(500, 0.05, 'sine', 800);
            shake = 2;
        }
        bsBricks.forEach(b => {
            if (!b.h && bsBall.x > b.x && bsBall.x < b.x + b.w && bsBall.y > b.y && bsBall.y < b.y + b.h) {
                b.h = true; bsBall.vy *= -1; score += 100; scoreDisplay.innerText = score;
                createBurst(b.x + 25, b.y + 10, "#f472b6", 10);
                playSound(1000, 0.05);
            }
        });
    }

    if (bsBall.y > 500) { shake = 20; showGameOver(); return; }

    drawBackground();
    ctx.save();
    applyShake();
    
    if (!bsReady) {
        ctx.fillStyle = "#fff";
        ctx.font = "20px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("TAP AD TO START", 400, 300);
    }

    ctx.shadowBlur = 10; ctx.shadowColor = "#22d3ee";
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(bsPad.x, bsPad.y, bsPad.w, bsPad.h);
    
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(bsBall.x, bsBall.y, bsBall.r, 0, Math.PI*2); ctx.fill();
    
    bsBricks.forEach(b => { 
        if (!b.h) {
            ctx.shadowColor = "#f472b6";
            ctx.fillStyle = "#f472b6";
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.fillRect(b.x, b.y, b.w, 3);
        }
    });

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopBlock);
}

/** 
 * --- 6. CRYPT QUEST (Maze Survival) ---
 */
let cqPlayer, cqEnemies, cqReady;
function initDungeon() {
    cqReady = false;
    cqPlayer = {x: 375, y: 235, w: 30, h: 30};
    cqEnemies = [];
    gameLoop = requestAnimationFrame(loopDungeon);
}

function loopDungeon() {
    if (currentGame !== 'dungeon') return;
    frameCount++;
    
    // Start only after first move
    if (keys['KeyW'] || keys['w'] || keys['ArrowUp'] || keys['KeyS'] || keys['s'] || keys['ArrowDown'] || 
        keys['KeyA'] || keys['a'] || keys['ArrowLeft'] || keys['KeyD'] || keys['d'] || keys['ArrowRight']) {
        if (frameCount > 10) cqReady = true;
    }

    if (cqReady) {
        if (keys['KeyW'] || keys['w'] || keys['ArrowUp']) cqPlayer.y -= 5;
        if (keys['KeyS'] || keys['s'] || keys['ArrowDown']) cqPlayer.y += 5;
        if (keys['KeyA'] || keys['a'] || keys['ArrowLeft']) cqPlayer.x -= 5;
        if (keys['KeyD'] || keys['d'] || keys['ArrowRight']) cqPlayer.x += 5;

        cqPlayer.x = Math.max(0, Math.min(800-cqPlayer.w, cqPlayer.x));
        cqPlayer.y = Math.max(0, Math.min(500-cqPlayer.h, cqPlayer.y));

        if (frameCount % 30 === 0) {
            score += 10; scoreDisplay.innerText = score;
            const side = Math.floor(Math.random()*4);
            let ex, ey;
            if (side === 0) { ex = Math.random()*800; ey = -40; }
            else if (side === 1) { ex = 840; ey = Math.random()*500; }
            else if (side === 2) { ex = Math.random()*800; ey = 540; }
            else { ex = -40; ey = Math.random()*500; }
            cqEnemies.push({x: ex, y: ey, w: 35, h: 35, vx: (cqPlayer.x-ex)*0.015, vy: (cqPlayer.y-ey)*0.015});
        }

        cqEnemies.forEach((e, ei) => {
            e.x += e.vx; e.y += e.vy;
            if (cqPlayer.x < e.x + e.w && cqPlayer.x + cqPlayer.w > e.x && cqPlayer.y < e.y + e.h && cqPlayer.y + cqPlayer.h > e.y) {
                createBurst(cqPlayer.x + 15, cqPlayer.y + 15, "#fbbf24", 20);
                shake = 20; showGameOver(); return;
            }
        });
    }

    drawBackground();
    ctx.save();
    applyShake();
    
    // Floor Pattern
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    for(let i=0; i<800; i+=60) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,500); ctx.stroke(); }
    for(let j=0; j<500; j+=60) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(800,j); ctx.stroke(); }

    // Torch Gradient
    const grd = ctx.createRadialGradient(
        cqPlayer.x + 15, cqPlayer.y + 15, 0,
        cqPlayer.x + 15, cqPlayer.y + 15, 250
    );
    grd.addColorStop(0, "transparent");
    grd.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,800,500);

    if (!cqReady) {
        ctx.fillStyle = "#fff";
        ctx.font = "18px 'Press Start 2P'"; ctx.textAlign = "center";
        ctx.fillText("WASD TO EXPLORE DARKNESS", 400, 300);
    }

    // Player Icon (Knight)
    ctx.translate(cqPlayer.x + 15, cqPlayer.y + 15);
    ctx.shadowBlur = 20; ctx.shadowColor = "#fbbf24";
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(-15, -15, 30, 30);
    const pAnim = Math.sin(frameCount/8) * 5;
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.strokeRect(-20 - pAnim/2, -20 - pAnim/2, 40 + pAnim, 40 + pAnim);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(-15, -4, 30, 6);
    ctx.restore();

    // Skulls (Enemies)
    cqEnemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x + 17, e.y + 17);
        ctx.shadowBlur = 10; ctx.shadowColor = "#f472b6";
        ctx.fillStyle = "#f472b6";
        // Skull body
        ctx.fillRect(-12, -15, 24, 25);
        // Eyes
        ctx.fillStyle = "#fff";
        ctx.fillRect(-6, -6, 4, 4); ctx.fillRect(2, -6, 4, 4);
        if (frameCount % 10 === 0) particles.push(new Particle(e.x + 17, e.y + 17, "rgba(244, 114, 182, 0.4)", 2));
        ctx.restore();
    });

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopDungeon);
}

/** 
 * --- 7. PIXEL BIRD (Tap to fly) ---
 */
let pbBird, pbPipes, pbReady, pbWind;
function initBird() {
    pbReady = false;
    pbBird = {y: 250, vy: 0, r: 15, flapTimer: 0};
    pbPipes = [];
    pbWind = Array.from({length: 15}, () => ({x: Math.random()*800, y: Math.random()*500, s: 10 + Math.random()*15}));
    gameLoop = requestAnimationFrame(loopBird);
}

function loopBird() {
    if (currentGame !== 'bird') return;
    frameCount++;
    
    const inputActive = (keys['Space'] || keys['KeyW'] || keys['w'] || keys['ArrowUp'] || keys['Digit1']);

    if(pbReady) {
        pbBird.vy += 0.4; // Reduced Gravity (was 0.5)
        pbBird.y += pbBird.vy;
    } else {
        // Float animation while waiting
        pbBird.y = 250 + Math.sin(frameCount / 10) * 10;
        // Only start if player presses a key AND hasn't just pressed it (prevent frame-1 tap)
        if (inputActive && frameCount > 10) pbReady = true;
    }

    if (inputActive && pbReady) {
        if (frameCount % 6 === 0) {
            pbBird.vy = -7.5; // Adjusted Flap (was -8.5)
            pbBird.flapTimer = 10; // Trigger "Video Effect"
            shake = 2; // Subtle glitch shake
            playSound(700, 0.05, 'sine', 1000);
        }
    }
    if (pbBird.flapTimer > 0) pbBird.flapTimer--;

    if (pbReady && frameCount % 100 === 0) { // Slower spawning (was 90)
        const h = 120 + Math.random() * 240;
        pbPipes.push({x: 800, y: h, w: 70, gap: 175}); // Wider Gap (was 140)
    }

    pbPipes.forEach((p, pi) => {
        p.x -= 3.5; // Reduced speed (was 4)
        if (p.x < -80) { pbPipes.splice(pi, 1); score += 1; scoreDisplay.innerText = score; }
        
        // Pipe collision (More forgiving hits)
        const bx = 400;
        if (bx + 10 > p.x && bx - 10 < p.x + p.w && (pbBird.y - 12 < p.y - p.gap || pbBird.y + 12 > p.y)) {
            // Impact Video Effect (Red Glitch)
            ctx.fillStyle = "rgba(255,0,0,0.5)"; ctx.fillRect(0,0,800,500);
            createBurst(bx, pbBird.y, "#fbbf24", 30);
            shake = 30; showGameOver(); return;
        }
    });

    // Boundary collision (Outside pipes loop)
    if (pbReady) {
        if (pbBird.y > 500) { // Hit ground
            ctx.fillStyle = "rgba(255,0,0,0.5)"; ctx.fillRect(0,0,800,500);
            createBurst(400, pbBird.y, "#fbbf24", 30);
            shake = 20; showGameOver(); return;
        }
        if (pbBird.y < 0) { // Hit ceiling
            pbBird.y = 0; pbBird.vy = 0;
        }
    }

    drawBackground();
    ctx.save();
    applyShake();
    
    // 1. Wind Streaks Video Effect
    pbWind.forEach(w => {
        if (pbReady) w.x -= w.s; if (w.x < -100) { w.x = 800; w.y = Math.random()*500; }
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(w.x, w.y, 60, 2);
    });

    if (!pbReady) {
        ctx.fillStyle = "#fff";
        ctx.font = "20px 'Press Start 2P'"; ctx.textAlign = "center";
        ctx.fillText("TAP SPACE TO START", 400, 350);
    }
    
    // 2. Pipes (Blur Video Effect)
    pbPipes.forEach(p => {
        ctx.shadowBlur = 10; ctx.shadowColor = "#4ade80";
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(p.x, 0, p.w, p.y - p.gap); // Top
        ctx.fillRect(p.x, p.y, p.w, 500 - p.y); // Bottom
        if (pbReady) { // Motion Blur Streak
            ctx.fillStyle = "rgba(74, 222, 128, 0.2)";
            ctx.fillRect(p.x + p.w, 0, 10, p.y - p.gap);
            ctx.fillRect(p.x + p.w, p.y, 10, 500 - p.y);
        }
    });

    // 3. Bird (Chromatic Aberration / RGB Split Video Effect)
    ctx.save();
    ctx.translate(400, pbBird.y);
    ctx.rotate(pbBird.vy * 0.04);
    
    // Add glitch offset on flap
    const gx = pbBird.flapTimer > 0 ? (Math.random()-0.5)*10 : 0;
    const gy = pbBird.flapTimer > 0 ? (Math.random()-0.5)*10 : 0;
    ctx.translate(gx, gy);

    if (pbBird.flapTimer > 0) {
        // Red Component
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255,0,0,0.8)";
        ctx.fillRect(-18, -15, 30, 30);
        // Blue Component
        ctx.fillStyle = "rgba(0,0,255,0.8)";
        ctx.fillRect(-12, -15, 30, 30);
    }
    
    ctx.shadowBlur = 15; ctx.shadowColor = "#fbbf24";
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(-15, -15, 30, 30);
    // Eye with blinking
    ctx.fillStyle = frameCount % 60 < 5 ? "#000" : "#fff"; 
    ctx.fillRect(5, -10, 8, 8);
    // Beak
    ctx.fillStyle = "#f97316"; ctx.fillRect(15, -2, 12, 10);
    ctx.restore();
    
    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopDino);
}

/** 
 * --- 9. NEON SHADOW RUNNER (Ultimate Cyberpunk Game) ---
 */
let nsNinja, nsObstacles, nsCoins, nsPowers, nsReady, nsRain, nsSpeed;
function initShadow() {
    nsReady = false;
    nsSpeed = 7;
    nsNinja = {
        y: 400, 
        vy: 0, 
        w: 40, 
        h: 60, 
        isJumping: false, 
        jumps: 0, 
        isSliding: false, 
        slideTimer: 0,
        magnetActive: 0,
        slowActive: 0
    };
    nsObstacles = []; nsCoins = []; nsPowers = [];
    nsRain = Array.from({length: 30}, () => ({x: Math.random()*800, y: Math.random()*500, s: 15 + Math.random()*10}));
    gameLoop = requestAnimationFrame(loopShadow);
}

function loopShadow() {
    if (currentGame !== 'shadow') return;
    frameCount++;
    
    const jumpInput = (keys['Space'] || keys['KeyW'] || keys['ArrowUp']);
    const slideInput = (keys['KeyS'] || keys['ArrowDown']);

    if(nsReady) {
        nsSpeed += 0.001; // Constant acceleration
        const currentSpeed = nsNinja.slowActive > 0 ? nsSpeed * 0.4 : nsSpeed;

        // Jump / Double Jump
        if (jumpInput && nsNinja.jumps < 2 && !keys.jumpPressed) {
            nsNinja.vy = -14;
            nsNinja.jumps++;
            nsNinja.isJumping = true;
            keys.jumpPressed = true;
            playSound(600 + (nsNinja.jumps*200), 0.1, 'sine', 1000);
            createBurst(420, nsNinja.y + (nsNinja.isSliding?0:nsNinja.h), "rgba(34, 211, 238, 0.5)", 10);
        }
        if (!jumpInput) keys.jumpPressed = false;

        // Slide
        if (slideInput && !nsNinja.isJumping) {
            nsNinja.isSliding = true;
            nsNinja.h = 30; // Shrink hitbox
        } else {
            nsNinja.isSliding = false;
            nsNinja.h = 60;
        }

        nsNinja.vy += 0.7; // Gravity
        nsNinja.y += nsNinja.vy;

        // Floor check
        const floor = 400;
        if (nsNinja.y >= floor) {
            nsNinja.y = floor; nsNinja.vy = 0; nsNinja.isJumping = false; nsNinja.jumps = 0;
        }

        // Timer decrements
        if (nsNinja.magnetActive > 0) nsNinja.magnetActive--;
        if (nsNinja.slowActive > 0) nsNinja.slowActive--;

        // Spawn logic
        if (frameCount % 60 === 0) {
            // Obstacles
            const type = Math.random() > 0.5 ? 'laser' : 'drone';
            nsObstacles.push({
                x: 800, 
                y: type === 'laser' ? 410 : 330, 
                w: type === 'laser' ? 20 : 40, 
                h: type === 'laser' ? 50 : 30, 
                type
            });
        }
        if (frameCount % 40 === 0) {
            nsCoins.push({ x: 800, y: 300 + Math.random()*100 });
        }
        if (frameCount % 400 === 0) {
            nsPowers.push({ x: 800, y: 350, type: Math.random() > 0.5 ? 'magnet' : 'slow' });
        }

        // Logic loops
        nsObstacles.forEach((o, i) => {
            o.x -= currentSpeed;
            if (o.x < -100) nsObstacles.splice(i, 1);
            if (400 < o.x + o.w && 440 > o.x && nsNinja.y < o.y + o.h && nsNinja.y + nsNinja.h > o.y) {
                shake = 40; showGameOver(); return;
            }
        });

        nsCoins.forEach((c, i) => {
            c.x -= currentSpeed;
            if (nsNinja.magnetActive > 0) {
                const dx = 420 - c.x; const dy = (nsNinja.y + 20) - c.y;
                c.x += dx * 0.1; c.y += dy * 0.1;
            }
            if (400 < c.x + 20 && 440 > c.x && nsNinja.y < c.y + 20 && nsNinja.y + nsNinja.h > c.y) {
                nsCoins.splice(i, 1); score += 50; scoreDisplay.innerText = score;
                playSound(900, 0.05, 'sine');
            }
        });

        nsPowers.forEach((p, i) => {
            p.x -= currentSpeed;
            if (400 < p.x + 30 && 440 > p.x && nsNinja.y < p.y + 30 && nsNinja.y + nsNinja.h > p.y) {
                if(p.type === 'magnet') nsNinja.magnetActive = 300;
                else nsNinja.slowActive = 180;
                nsPowers.splice(i, 1);
                playSound(1200, 0.2, 'triangle', 2000);
                shake = 5;
            }
        });

    } else {
        if (jumpInput && frameCount > 20) nsReady = true;
    }

    drawBackground();
    ctx.save();
    applyShake();

    // 1. Rain (Neon Glow)
    nsRain.forEach(r => {
        if (nsReady) r.y += r.s; if (r.y > 500) { r.y = -20; r.x = Math.random()*800; }
        ctx.fillStyle = "rgba(34, 211, 238, 0.2)";
        ctx.fillRect(r.x, r.y, 1, 15);
    });

    // 2. City Parallax
    ctx.fillStyle = "rgba(12, 12, 40, 0.8)";
    for(let i=0; i<800; i+=80) {
        const bx = (i - (nsReady ? frameCount*2 : 0)) % 800;
        const h = 200 + Math.sin(i) * 100;
        ctx.fillRect(bx < 0 ? bx+800 : bx, 460 - h, 60, h);
        ctx.fillStyle = "rgba(244, 114, 182, 0.1)";
        ctx.fillRect(bx, 460 - h, 2, h); // Neon edge
    }

    // 3. Ground
    ctx.shadowBlur = 15; ctx.shadowColor = "var(--neon-cyan)";
    ctx.strokeStyle = "var(--neon-cyan)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 460); ctx.lineTo(800, 460); ctx.stroke();
    ctx.lineWidth = 1;

    // 4. Entities
    nsObstacles.forEach(o => {
        ctx.shadowBlur = 15; ctx.shadowColor = o.type === 'laser' ? "#ef4444" : "#fbbf24";
        ctx.fillStyle = ctx.shadowColor;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        if (o.type === 'drone') { // Moving "eye"
            ctx.fillStyle = "#fff"; ctx.fillRect(o.x + 10 + Math.sin(frameCount/5)*5, o.y + 10, 10, 10);
        }
    });

    nsCoins.forEach(c => {
        ctx.shadowBlur = 15; ctx.shadowColor = "#facc15";
        ctx.fillStyle = "#facc15";
        ctx.beginPath(); ctx.arc(c.x + 10, c.y + 10, 8, 0, Math.PI*2); ctx.fill();
    });

    nsPowers.forEach(p => {
        ctx.shadowBlur = 20; ctx.shadowColor = p.type === 'magnet' ? "#22d3ee" : "#a855f7";
        ctx.fillStyle = ctx.shadowColor;
        ctx.fillRect(p.x, p.y, 30, 30);
        ctx.fillStyle = "#fff"; ctx.font = "12px Arial"; ctx.fillText(p.type === 'magnet' ? "M" : "S", p.x+8, p.y+20);
    });

    // 5. Ninja (Shadow with Neon Outlines)
    ctx.save();
    ctx.translate(400, nsNinja.y);
    
    // Magnet/Slow Glow
    if (nsNinja.magnetActive > 0) { ctx.shadowBlur = 30; ctx.shadowColor = "#22d3ee"; }
    if (nsNinja.slowActive > 0) { ctx.shadowBlur = 30; ctx.shadowColor = "#a855f7"; }

    ctx.fillStyle = "#000"; // Solid Shadow
    ctx.fillRect(0, 0, nsNinja.w, nsNinja.h);
    
    // Neon Outline
    ctx.strokeStyle = "var(--neon-cyan)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, nsNinja.w, nsNinja.h);
    
    // Scarf (Trail)
    ctx.fillStyle = "#ef4444";
    const scarfY = nsNinja.isSliding ? 10 : 20;
    ctx.fillRect(-20, scarfY + Math.sin(frameCount/5)*5, 20, 5);

    if (!nsNinja.isSliding) {
        // Ninja Mask / Eye
        ctx.fillStyle = "#fff";
        ctx.fillRect(30, 15, 8, 3);
    }

    ctx.restore();

    if (!nsReady) {
        ctx.fillStyle = "#fff";
        ctx.shadowBlur = 10; ctx.shadowColor = "#fff";
        ctx.font = "24px 'Press Start 2P'"; ctx.textAlign = "center";
        ctx.fillText("SPACE TO START", 400, 250);
    }

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopShadow);
}

/** 
 * --- 8. DINO RUNNER (Complete Rebuilt) ---
 */
let drDino, drObstacles, drReady, drClouds, drDistance;
function initDino() {
    drReady = false;
    drDistance = 0;
    drDino = {
        y: 450, 
        vy: 0, 
        w: 50, 
        h: 55, 
        isJumping: false,
        legFrame: 0,
        eyeBlink: 0
    };
    drObstacles = [];
    drClouds = Array.from({length: 4}, () => ({
        x: Math.random()*800, 
        y: 50 + Math.random()*150, 
        s: 0.5 + Math.random()*0.5, 
        w: 60 + Math.random()*40
    }));
    gameLoop = requestAnimationFrame(loopDino);
}

function loopDino() {
    if (currentGame !== 'dino') return;
    frameCount++;
    
    const jumpInput = (keys['Space'] || keys['KeyW'] || keys['ArrowUp']);

    if(drReady) {
        // Distance Score
        drDistance += 0.2;
        score = Math.floor(drDistance);
        scoreDisplay.innerText = score;

        // Physics
        if (jumpInput && !drDino.isJumping) {
            drDino.vy = -16; // Snappy Jump
            drDino.isJumping = true;
            playSound(300, 0.1, 'sine', 600);
        }
        drDino.vy += 0.8; // Stronger Gravity
        drDino.y += drDino.vy;

        // Ground check
        if (drDino.y >= 450) {
            drDino.y = 450;
            drDino.vy = 0;
            if (drDino.isJumping) {
                drDino.isJumping = false;
                createBurst(410, 450, "#fff", 8); // Land impact dust
            }
        }

        // Running Animation (Legs swap)
        if (!drDino.isJumping) {
            drDino.legFrame = (frameCount % 10 < 5) ? 0 : 1;
        }

        // Spawn Cacti Clusters
        if (frameCount % (Math.max(60, 110 - Math.floor(drDistance/500))) === 0) {
            const clusterSize = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3 cacti
            drObstacles.push({
                x: 800, 
                w: 25 * clusterSize, 
                h: 40 + Math.random()*30, 
                s: 7 + (drDistance/2000),
                type: 'cactus'
            });
        }
    } else {
        if (jumpInput && frameCount > 20) drReady = true;
    }

    // Clouds
    drClouds.forEach(c => {
        if (drReady) c.x -= c.s;
        if (c.x < -150) { c.x = 800; c.y = 50 + Math.random()*150; }
    });

    // Obstacles
    drObstacles.forEach((o, i) => {
        if (drReady) o.x -= o.s;
        if (o.x < -100) drObstacles.splice(i, 1);
        
        // Accurate Collision Hitbox (Fairness check)
        const dinoLeft = 410; // X is fixed but we draw it offset
        const dinoRight = 440;
        const dinoBottom = drDino.y;
        const dinoTop = drDino.y - drDino.h + 10;
        
        if (dinoRight > o.x + 5 && dinoLeft < o.x + o.w - 5) {
            if (dinoBottom > 450 - o.h + 5) {
                shake = 30; // Heavy impact
                showGameOver(); return;
            }
        }
    });

    drawBackground();
    ctx.save();
    applyShake();

    // 1. Back Parallax (Clouds)
    drClouds.forEach(c => {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(c.x, c.y, c.w, 15);
        ctx.fillRect(c.x + 10, c.y - 10, c.w - 20, 10);
    });

    // 2. Ground
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, 450, 800, 50);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.moveTo(0, 450); ctx.lineTo(800, 450); ctx.stroke();
    
    // Ground Texture (Dots)
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    for(let i=0; i<800; i+=100) {
        let gx = (i + (drReady ? -drDistance*8 : 0)) % 800;
        if (gx < 0) gx += 800;
        ctx.fillRect(gx, 460, 4, 2);
        ctx.fillRect(gx + 30, 480, 4, 2);
    }

    if (!drReady) {
        ctx.fillStyle = "#fff";
        ctx.font = "20px 'Press Start 2P'"; ctx.textAlign = "center";
        ctx.fillText("SPACE TO RUN", 400, 250);
    }

    // 3. Obstacles (Stylized Cacti)
    drObstacles.forEach(o => {
        ctx.shadowBlur = 10; ctx.shadowColor = "#4ade80";
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(o.x, 450 - o.h, o.w, o.h);
        // Spikes/Detail
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(o.x + 5, 450 - o.h + 5, 2, o.h - 10);
    });

    // 4. Dino Character (High-end Pixel T-Rex)
    ctx.save();
    ctx.translate(400, drDino.y - drDino.h);
    
    // Trail FX
    if (drReady && !drDino.isJumping && frameCount % 5 === 0) {
        particles.push(new Particle(410, drDino.y, "rgba(255,255,255,0.4)", 1.5));
    }

    ctx.shadowBlur = 15; ctx.shadowColor = "#f472b6";
    ctx.fillStyle = "#f472b6"; 
    
    // Dino Geometry
    // Tail
    ctx.fillRect(-12, 15, 15, 12);
    // Body
    ctx.fillRect(0, 5, 38, 38);
    // Neck
    ctx.fillRect(20, -10, 20, 20);
    // Head (Large Jaw)
    ctx.fillRect(25, -20, 30, 20);
    
    // Eye with blinking
    if (frameCount % 180 < 10) {
        ctx.fillStyle = "#000"; // Closed
    } else {
        ctx.fillStyle = "#fff"; // Open
    }
    ctx.fillRect(45, -14, 6, 6);
    
    // Hands
    ctx.fillStyle = "#f472b6"; ctx.fillRect(40, 15, 8, 4);

    // Dynamic Legs (Animation swap)
    ctx.fillStyle = "#be185d";
    if (drDino.isJumping) {
        ctx.fillRect(5, 40, 10, 12); ctx.fillRect(25, 40, 10, 12);
    } else {
        if (drDino.legFrame === 0) {
            ctx.fillRect(5, 40, 10, 15); ctx.fillRect(25, 35, 10, 10);
        } else {
            ctx.fillRect(5, 35, 10, 10); ctx.fillRect(25, 40, 10, 15);
        }
    }
    ctx.restore();

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopDino);
}

function drawBackground() {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, 800, 500);
    // Grid markers
    ctx.strokeStyle = "rgba(34, 211, 238, 0.05)";
    ctx.lineWidth = 1;
    for(let i=0; i<800; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,500); ctx.stroke(); }
}
/** 
 * --- 10. PIXEL ZOMBIE SURVIVAL (MINIMAL CLASSIC) ---
 */
let pzPlayer, pzEnemies, pzBullets, pzReady, pzStains;
function initZombie() {
    pzReady = false;
    pzPlayer = {
        x: 400, 
        y: 250, 
        size: 30, 
        muzzleFlash: 0, 
        recoil: 0, 
        angle: 0
    };
    pzEnemies = []; 
    pzBullets = []; 
    pzStains = [];
    gameLoop = requestAnimationFrame(loopZombie);
}

function loopZombie() {
    if (currentGame !== 'zombie') return;
    frameCount++;
    
    // Movement
    let speed = 4;
    const moveX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
    const moveY = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);

    if (moveX !== 0 || moveY !== 0) pzReady = true;

    if(pzReady) {
        // Player Rotation
        const dxp = mouseX - (pzPlayer.x + pzPlayer.size/2);
        const dyp = mouseY - (pzPlayer.y + pzPlayer.size/2);
        pzPlayer.angle = Math.atan2(dyp, dxp);

        // Normalize speed
        const mag = Math.sqrt(moveX*moveX + moveY*moveY) || 1;
        pzPlayer.x += (moveX/mag) * speed; 
        pzPlayer.y += (moveY/mag) * speed;
        
        pzPlayer.x = Math.max(0, Math.min(800-pzPlayer.size, pzPlayer.x));
        pzPlayer.y = Math.max(0, Math.min(500-pzPlayer.size, pzPlayer.y));

        if (pzPlayer.muzzleFlash > 0) pzPlayer.muzzleFlash--;
        if (pzPlayer.recoil > 0) pzPlayer.recoil *= 0.8;

        // Spawning
        const spawnRate = Math.max(20, 60 - Math.floor(score/20));
        if (frameCount % spawnRate === 0) {
            const side = Math.floor(Math.random()*4);
            let ex, ey;
            if (side === 0) { ex = Math.random()*800; ey = -40; }
            else if (side === 1) { ex = 840; ey = Math.random()*500; }
            else if (side === 2) { ex = Math.random()*800; ey = 540; }
            else { ex = -40; ey = Math.random()*500; }
            pzEnemies.push({
                x: ex, 
                y: ey, 
                size: 32 + Math.random()*8, 
                s: 1.2 + Math.random()*1.2,
                anim: Math.random()*Math.PI*2,
                hp: 1
            });
        }

        // Logic
        pzBullets.forEach((b, bi) => {
            b.x += b.vx; b.y += b.vy;
            if (b.x < -20 || b.x > 820 || b.y < -20 || b.y > 520) pzBullets.splice(bi, 1);
        });

        pzEnemies.forEach((e, ei) => {
            const dx = (pzPlayer.x + pzPlayer.size/2) - (e.x + e.size/2);
            const dy = (pzPlayer.y + pzPlayer.size/2) - (e.y + e.size/2);
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            e.x += (dx/dist) * e.s; e.y += (dy/dist) * e.s;
            e.anim += 0.1;

            // Bullet Collision
            pzBullets.forEach((b, bi) => {
                const bdx = b.x - (e.x + e.size/2);
                const bdy = b.y - (e.y + e.size/2);
                if (Math.abs(bdx) < e.size/2 && Math.abs(bdy) < e.size/2) {
                    // Kill Zombie
                    createBurst(e.x + e.size/2, e.y + e.size/2, "#ef4444", 15);
                    // Add Stain
                    pzStains.push({
                        x: e.x + e.size/2, 
                        y: e.y + e.size/2, 
                        size: 20 + Math.random()*30, 
                        rot: Math.random()*Math.PI*2,
                        opacity: 0.6
                    });
                    if (pzStains.length > 50) pzStains.shift(); // Performance cap

                    pzEnemies.splice(ei, 1); 
                    pzBullets.splice(bi, 1);
                    score += 10; 
                    scoreDisplay.innerText = score;
                    playSound(100, 0.05, 'square', 40);
                    shake = 2;
                }
            });

            // Player Collision
            const pdx = (pzPlayer.x + pzPlayer.size/2) - (e.x + e.size/2);
            const pdy = (pzPlayer.y + pzPlayer.size/2) - (e.y + e.size/2);
            if (Math.sqrt(pdx*pdx + pdy*pdy) < (pzPlayer.size + e.size)/2.5) {
                shake = 40; showGameOver(); return;
            }
        });
    }

    drawBackground();
    ctx.save();
    applyShake();
    
    // 1. Dark Floor with persistent stains
    ctx.fillStyle = "#0c0a09"; 
    ctx.fillRect(0,0,800,500);

    pzStains.forEach(s => {
        ctx.save();
        ctx.globalAlpha = s.opacity;
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = "#7f1d1d"; // Dark blood
        ctx.fillRect(-s.size/2, -s.size/2, s.size, s.size/2);
        ctx.fillRect(-s.size/4, -s.size/2, s.size/2, s.size);
        ctx.restore();
    });

    // 2. Flashlight Effect (Stencil/Mask)
    const grd = ctx.createRadialGradient(
        pzPlayer.x + pzPlayer.size/2, pzPlayer.y + pzPlayer.size/2, 0,
        pzPlayer.x + pzPlayer.size/2, pzPlayer.y + pzPlayer.size/2, 300
    );
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(0.5, "rgba(0,0,0,0.4)");
    grd.addColorStop(1, "rgba(0,0,0,0.95)");
    
    // We draw the darkness but keep the flashlight area visible
    // Wait, simpler: fill whole area with dark, use destination-out if possible or just draw large mask
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,800,500);

    if (!pzReady) {
        ctx.fillStyle = "#fff";
        ctx.font = "18px 'Press Start 2P'"; ctx.textAlign = "center";
        ctx.fillText("WASD: MOVE | CLICK: AIM & FIRE", 400, 250);
    }

    // 3. Bullets (Glowing)
    ctx.shadowBlur = 10; ctx.shadowColor = "#fde047";
    ctx.fillStyle = "#fff";
    pzBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill(); });
    ctx.shadowBlur = 0;

    // 4. Enemies (Animated Zombies)
    pzEnemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x + e.size/2, e.y + e.size/2);
        // Shuffle wobble
        const wobble = Math.sin(e.anim) * 5;
        ctx.rotate(wobble * 0.05);

        // Body
        ctx.fillStyle = "#166534"; // Dark Green
        ctx.fillRect(-e.size/2, -e.size/2, e.size, e.size);
        
        // Head / Top part
        ctx.fillStyle = "#15803d";
        ctx.fillRect(-e.size/2, -e.size/2, e.size, e.size/2);

        // Glowing Red Eyes
        ctx.shadowBlur = 10; ctx.shadowColor = "#ef4444";
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-10, -8, 4, 4);
        ctx.fillRect(6, -8, 4, 4);
        
        ctx.restore();
    });

    // 5. Player (Soldier)
    ctx.save();
    ctx.translate(pzPlayer.x + pzPlayer.size/2, pzPlayer.y + pzPlayer.size/2);
    ctx.rotate(pzPlayer.angle);

    // Recoil pushback visual
    const rx = -pzPlayer.recoil;

    // Gun
    ctx.fillStyle = "#444";
    ctx.fillRect(10 + rx, -4, 25, 8);
    ctx.fillStyle = "#222";
    ctx.fillRect(30 + rx, -2, 10, 4);

    // Muzzle Flash
    if (pzPlayer.muzzleFlash > 0) {
        ctx.shadowBlur = 20; ctx.shadowColor = "#fca5a5";
        ctx.fillStyle = "#fde68a";
        ctx.beginPath();
        ctx.arc(45 + rx, 0, 10 + Math.random()*5, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Body
    ctx.shadowBlur = 15; ctx.shadowColor = "#22c55e";
    ctx.fillStyle = "#15803d";
    ctx.fillRect(-pzPlayer.size/2, -pzPlayer.size/2, pzPlayer.size, pzPlayer.size);
    // Helmet
    ctx.fillStyle = "#166534";
    ctx.fillRect(-pzPlayer.size/2, -pzPlayer.size/2, pzPlayer.size, pzPlayer.size/3);
    // Face slot
    ctx.fillStyle = "#052e16";
    ctx.fillRect(-pzPlayer.size/2 + 5, -5, pzPlayer.size - 10, 10);

    ctx.restore();

    updateParticles();
    ctx.restore();
    gameLoop = requestAnimationFrame(loopZombie);
}

/** 
 * --- 11. SPACE MINER (2D Mining Adventure) ---
 */
let pmShip, pmAsteroids, pmMinerals, pmEnemies, pmBullets, pmReady, pmStars, pmUpgrades, pmMenuOpen, pmCurrency;
function initMiner() {
    pmReady = false; pmMenuOpen = false;
    pmCurrency = 0;
    pmShip = {
        x: 400, y: 250, 
        vx: 0, vy: 0, 
        angle: 0, 
        size: 25,
        fuel: 100, maxFuel: 100,
        hp: 100, maxHp: 100,
        speed: 0.15,
        laserDmg: 20,
        reload: 0,
        recoil: 0,
        cargo: 0, maxCargo: 50
    };
    pmUpgrades = { engine: 1, drill: 1, fuel: 1, shield: 1, magnet: 1 };
    pmAsteroids = []; pmMinerals = []; pmEnemies = []; pmBullets = [];
    pmStars = Array.from({length: 80}, () => ({
        x: Math.random()*800, 
        y: Math.random()*500, 
        s: Math.random()*2, 
        p: Math.random()*0.5
    }));
    
    for(let i=0; i<8; i++) spawnAsteroid(true);
    gameLoop = requestAnimationFrame(loopMiner);
}

function spawnAsteroid(randomPos = false, x, y, size) {
    let ax = x, ay = y;
    if (randomPos) {
        const side = Math.floor(Math.random()*4);
        if (side === 0) { ax = Math.random()*800; ay = -100; }
        else if (side === 1) { ax = 900; ay = Math.random()*500; }
        else if (side === 2) { ax = Math.random()*800; ay = 600; }
        else { ax = -100; ay = Math.random()*500; }
    }
    
    pmAsteroids.push({
        x: ax, y: ay, 
        size: size || (40 + Math.random()*40), 
        hp: size ? size * 2 : 100, 
        vx: (Math.random()-0.5)*1.5, 
        vy: (Math.random()-0.5)*1.5,
        rot: Math.random()*Math.PI*2,
        vRot: (Math.random()-0.5)*0.03,
        type: Math.random() > 0.85 ? 'gold' : 'iron'
    });
}

function spawnEnemy() {
    const side = Math.floor(Math.random()*4);
    let ex, ey;
    if (side === 0) { ex = Math.random()*800; ey = -50; }
    else if (side === 1) { ex = 850; ey = Math.random()*500; }
    else if (side === 2) { ax = Math.random()*800; ay = 550; }
    else { ex = -50; ey = Math.random()*500; }
    
    pmEnemies.push({
        x: ex, y: ey, vx: 0, vy: 0, angle: 0, hp: 40, reload: 0
    });
}

function loopMiner() {
    if (currentGame !== 'miner') return;
    frameCount++;
    
    if (pmReady) {
        // --- 1. MOVEMENT & PHYSICS ---
        const friction = 0.985, turnSpeed = 0.08;
        const boostMult = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.8 : 1;
        if (keys['KeyA'] || keys['ArrowLeft']) pmShip.angle -= turnSpeed;
        if (keys['KeyD'] || keys['ArrowRight']) pmShip.angle += turnSpeed;
        
        if (keys['KeyW'] || keys['ArrowUp']) {
            const acc = pmShip.speed * (0.8 + pmUpgrades.engine * 0.2) * boostMult;
            pmShip.vx += Math.cos(pmShip.angle) * acc; pmShip.vy += Math.sin(pmShip.angle) * acc;
            pmShip.fuel -= (0.05 * boostMult);
            if (frameCount % 2 === 0) particles.push(new Particle(pmShip.x - Math.cos(pmShip.angle)*15, pmShip.y - Math.sin(pmShip.angle)*15, boostMult > 1 ? "#f472b6" : "#22d3ee", 2));
        }
        pmShip.fuel -= 0.01; if (pmShip.fuel <= 0 || pmShip.hp <= 0) { showGameOver(); return; }
        pmShip.vx *= friction; pmShip.vy *= friction;
        pmShip.x += pmShip.vx; pmShip.y += pmShip.vy;
        if (pmShip.recoil > 0) pmShip.recoil *= 0.8;
        if (pmShip.x < -30) pmShip.x = 830; if (pmShip.x > 830) pmShip.x = -30;
        if (pmShip.y < -30) pmShip.y = 530; if (pmShip.y > 530) pmShip.y = -30;

        // --- 2. SHOOTING ---
        if (pmShip.reload > 0) pmShip.reload--;
        if (keys['Space'] && pmShip.reload <= 0) {
            pmBullets.push({ x: pmShip.x + Math.cos(pmShip.angle)*20, y: pmShip.y + Math.sin(pmShip.angle)*20, vx: Math.cos(pmShip.angle)*12 + pmShip.vx, vy: Math.sin(pmShip.angle)*12 + pmShip.vy, life: 50, owner: 'player' });
            pmShip.reload = Math.max(4, 12 - pmUpgrades.drill * 1.5); pmShip.recoil = 4;
            playSound(600, 0.02, 'sine');
        }

        // --- 3. COLLISIONS ---
        pmBullets.forEach((b, bi) => {
            b.x += b.vx; b.y += b.vy; b.life--; if (b.life <= 0) pmBullets.splice(bi, 1);
            pmAsteroids.forEach(a => { if (Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2) < a.size) { a.hp -= pmShip.laserDmg * (0.5+pmUpgrades.drill*0.5); createBurst(b.x, b.y, "#94a3b8", 3); pmBullets.splice(bi, 1); shake = 2; } });
            if (b.owner === 'player') pmEnemies.forEach(e => { if (Math.sqrt((b.x-e.x)**2+(b.y-e.y)**2) < 20) { e.hp -= 15; createBurst(b.x, b.y, "#ef4444", 5); pmBullets.splice(bi, 1); } });
            else if (Math.sqrt((b.x-pmShip.x)**2+(b.y-pmShip.y)**2) < 15) { pmShip.hp -= 8; shake = 10; pmBullets.splice(bi, 1); }
        });

        pmAsteroids.forEach((a, ai) => {
            a.x += a.vx; a.y += a.vy; a.rot += a.vRot;
            if (a.hp <= 0) {
                createBurst(a.x, a.y, a.type==='gold'?"#fbbf24":"#444", 15);
                if (a.size > 25) for(let i=0; i<2; i++) spawnAsteroid(false, a.x, a.y, a.size/1.8);
                pmMinerals.push({ x: a.x, y: a.y, type: a.type, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4 });
                pmAsteroids.splice(ai, 1); if (pmAsteroids.length < 7) spawnAsteroid(true);
            }
            if (Math.sqrt((pmShip.x-a.x)**2+(pmShip.y-a.y)**2) < a.size+15) {
                const s = Math.sqrt(pmShip.vx**2+pmShip.vy**2);
                if (s > 4) { pmShip.hp -= s*1.5; shake = s*3; pmShip.vx *= -0.6; pmShip.vy *= -0.6; playSound(100, 0.1, 'sawtooth'); }
            }
        });

        // --- 4. ENEMIES (NERFED) ---
        if (frameCount % 600 === 0 && pmEnemies.length < 2) spawnEnemy();
        pmEnemies.forEach((e, ei) => {
            const dx = pmShip.x-e.x, dy = pmShip.y-e.y, dist = Math.sqrt(dx**2+dy**2);
            if (dist < 350) {
                e.angle = Math.atan2(dy, dx); e.vx += Math.cos(e.angle)*0.04; e.vy += Math.sin(e.angle)*0.04;
                if (dist < 220 && e.reload <= 0) { pmBullets.push({ x: e.x, y: e.y, vx: Math.cos(e.angle)*6, vy: Math.sin(e.angle)*6, life: 70, owner: 'enemy' }); e.reload = 110; }
            }
            e.vx *= 0.98; e.vy *= 0.98; e.x += e.vx; e.y += e.vy;
            if (e.reload > 0) e.reload--;
            if (e.hp <= 0) { createBurst(e.x, e.y, "#f87171", 20); pmEnemies.splice(ei, 1); pmCurrency += 100; score += 150; }
        });

        // --- 5. MINERALS ---
        pmMinerals.forEach((m, mi) => {
            m.x += m.vx; m.y += m.vy; m.vx *= 0.96; m.vy *= 0.96;
            const dx = pmShip.x-m.x, dy = pmShip.y-m.y, dist = Math.sqrt(dx**2+dy**2);
            if (dist < 60 + pmUpgrades.magnet*50) { m.vx += (dx/dist)*1.2; m.vy += (dy/dist)*1.2; }
            if (dist < 20) { pmMinerals.splice(mi, 1); const v = m.type === 'gold' ? 30 : 10; pmCurrency += v; score += v*2; playSound(900, 0.05, 'sine'); }
        });

        if (keys['KeyU']) { pmMenuOpen = true; keys['KeyU'] = false; }
    } else if (!pmReady) { if (keys['Space'] || keys['KeyW']) pmReady = true; }

    // DRAWING
    drawBackground();
    ctx.save();
    applyShake();
    
    // Space Dust/Stars Parallax
    pmStars.forEach(s => {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(s.x, s.y, s.s, s.s);
    });

    // Draw Asteroids
    pmAsteroids.forEach(a => { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot); ctx.shadowBlur=10; ctx.shadowColor=a.type==='gold'?"#fbbf24":"#444"; ctx.fillStyle=ctx.shadowColor; ctx.beginPath(); for(let i=0; i<6; i++) ctx.lineTo(Math.cos(i*Math.PI/3)*(a.size+Math.sin(i*2.5)*(a.size/5)), Math.sin(i*Math.PI/3)*(a.size+Math.sin(i*2.5)*(a.size/5))); ctx.closePath(); ctx.fill(); ctx.restore(); });
    pmMinerals.forEach(m => { ctx.shadowBlur=15; ctx.shadowColor=m.type==='gold'?"#fbbf24":"#22d3ee"; ctx.fillStyle=ctx.shadowColor; ctx.fillRect(m.x-3, m.y-3, 6, 6); });
    pmBullets.forEach(b => { ctx.shadowBlur=10; ctx.shadowColor=b.owner==='player'?"#22d3ee":"#ef4444"; ctx.fillStyle="#fff"; ctx.fillRect(b.x-2, b.y-2, 4, 4); });
    pmEnemies.forEach(e => {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
        ctx.fillStyle="#f87171"; ctx.shadowBlur=10; ctx.shadowColor="#ef4444";
        ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-10,-8); ctx.lineTo(-6,0); ctx.lineTo(-10,8); ctx.closePath(); ctx.fill();
        ctx.restore();
    });
    // Player (Rocket Redesign)
    ctx.save(); ctx.translate(pmShip.x, pmShip.y); ctx.rotate(pmShip.angle);
    ctx.shadowBlur=15; ctx.shadowColor="#22d3ee";
    const rx = -pmShip.recoil;
    // Main Body
    ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.moveTo(20+rx, 0); ctx.lineTo(-5+rx, -9); ctx.lineTo(-12+rx, -9); ctx.lineTo(-12+rx, 9); ctx.lineTo(-5+rx, 9); ctx.closePath(); ctx.fill();
    // Red Side Fins
    ctx.fillStyle="#ef4444"; ctx.fillRect(-12+rx, -13, 6, 4); ctx.fillRect(-12+rx, 9, 6, 4);
    // Tinted Cockpit
    ctx.fillStyle="#0ea5e9"; ctx.fillRect(2+rx, -3, 6, 6);
    ctx.restore();
    ctx.restore();

    drawMinerUI();
    if (pmMenuOpen) drawUpgradeMenu();
    if (!pmReady) { ctx.fillStyle="rgba(0,0,0,0.75)"; ctx.fillRect(0,0,800,500); ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="20px 'Press Start 2P'"; ctx.fillText("SPACE MINER FRONTIER", 400, 200); ctx.font="12px 'Press Start 2P'"; ctx.fillText("WASD: FLY | SPACE: LASER | SHIFT: BOOST", 400, 260); ctx.fillText("PRESS START", 400, 340); }
    updateParticles(); gameLoop = requestAnimationFrame(loopMiner);
}

function drawMinerUI() {
    ctx.fillStyle="rgba(15, 23, 42, 0.85)"; ctx.fillRect(20, 20, 200, 100); ctx.strokeStyle="#22d3ee"; ctx.strokeRect(20, 20, 200, 100);
    ctx.font="10px 'Press Start 2P'"; ctx.textAlign="left";
    ctx.fillStyle="#fff"; ctx.fillText("HULL", 35, 45); ctx.fillStyle="#334155"; ctx.fillRect(85, 37, 120, 10); ctx.fillStyle="#ef4444"; ctx.fillRect(85, 37, (pmShip.hp/pmShip.maxHp)*120, 10);
    ctx.fillStyle="#fff"; ctx.fillText("FUEL", 35, 65); ctx.fillStyle="#334155"; ctx.fillRect(85, 57, 120, 10); ctx.fillStyle="#fbbf24"; ctx.fillRect(85, 57, pmShip.fuel*1.2, 10);
    ctx.fillStyle="#22d3ee"; ctx.fillText(`$ ${pmCurrency}`, 35, 95); ctx.fillStyle="#fff"; ctx.fillText(`[U] UPGRADES`, 35, 110);
}

function drawUpgradeMenu() {
    ctx.fillStyle="rgba(0,0,0,0.9)"; ctx.fillRect(0,0,800,500);
    ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="24px 'Press Start 2P'"; ctx.fillText("UPGRADES", 400, 80);
    const opts = [ { k: '1', n: 'ENGINE', c: 150*pmUpgrades.engine, l: pmUpgrades.engine }, { k: '2', n: 'LASER', c: 200*pmUpgrades.drill, l: pmUpgrades.drill }, { k: '3', n: 'FUEL', c: 100*pmUpgrades.fuel, l: pmUpgrades.fuel }, { k: '4', n: 'HULL', c: 250*pmUpgrades.shield, l: pmUpgrades.shield }, { k: '5', n: 'MAGNET', c: 100*pmUpgrades.magnet, l: pmUpgrades.magnet } ];
    opts.forEach((o, i) => {
        const y=160+i*50; ctx.textAlign="left"; ctx.fillStyle=pmCurrency>=o.c?"#4ade80":"#ef4444"; ctx.fillText(`[${o.k}] ${o.n} V${o.l}`, 100, y); ctx.textAlign="right"; ctx.fillText(`$${o.c}`, 700, y);
        if (keys['Digit'+o.k] && pmCurrency>=o.c) { pmCurrency-=o.c; if(o.k==='1')pmUpgrades.engine++; if(o.k==='2')pmUpgrades.drill++; if(o.k==='3'){pmUpgrades.fuel++;pmShip.fuel=100;} if(o.k==='4'){pmUpgrades.shield++;pmShip.maxHp+=50;pmShip.hp=pmShip.maxHp;} if(o.k==='5')pmUpgrades.magnet++; playSound(1000, 0.1, 'sine'); keys['Digit'+o.k]=false; }
    });
    ctx.textAlign="center"; ctx.fillStyle="#22d3ee"; ctx.fillText(`CREDITS: $${pmCurrency}`, 400, 420); ctx.fillStyle="#fff"; ctx.font="12px 'Press Start 2P'"; ctx.fillText("PRESS [U] TO DISMISS", 400, 460); if (keys['KeyU']) { pmMenuOpen=false; keys['KeyU']=false; }
}

/**
 * --- ASSET GENERATOR ---
 * Creates pixel banners for missing images
 */
function generateDynamicBanners() {
    const banners = document.querySelectorAll('img.game-thumb');
    banners.forEach(img => {
        const canvas = document.createElement('canvas');
        canvas.width = 400; canvas.height = 225;
        const btx = canvas.getContext('2d');
        const drawGrid = (color) => {
            btx.strokeStyle = color; btx.lineWidth = 1; btx.globalAlpha = 0.2;
            for(let i=0; i<400; i+=25) { btx.beginPath(); btx.moveTo(i,0); btx.lineTo(i,225); btx.stroke(); }
            for(let i=0; i<225; i+=25) { btx.beginPath(); btx.moveTo(0,i); btx.lineTo(400,i); btx.stroke(); }
            btx.globalAlpha = 1;
        };

        switch(img.alt) {
            case "Neon Snake":
                btx.fillStyle = "#0a0a1a"; btx.fillRect(0,0,400,225);
                drawGrid("#22d3ee");
                btx.shadowBlur = 15; btx.shadowColor = "#4ade80"; btx.fillStyle = "#4ade80";
                [20, 40, 60, 80].forEach((x, i) => btx.fillRect(100+x, 100, 18, 18));
                btx.shadowColor = "#f472b6"; btx.fillStyle = "#f472b6"; btx.fillRect(220, 100, 18, 18);
                break;
            case "Pixel Jump":
                btx.fillStyle = "#1e1b4b"; btx.fillRect(0,0,400,225);
                btx.fillStyle = "#312e81"; btx.fillRect(0, 180, 400, 45);
                btx.shadowBlur = 20; btx.shadowColor = "#22d3ee"; btx.fillStyle = "#fff";
                btx.fillRect(180, 120, 40, 40);
                btx.shadowColor = "#f472b6"; btx.fillStyle = "#f472b6";
                btx.fillRect(150, 160, 100, 10);
                break;
            case "Star Defender":
                btx.fillStyle = "#020617"; btx.fillRect(0,0,400,225);
                for(let i=0; i<30; i++) { btx.fillStyle = "#fff"; btx.fillRect(Math.random()*400, Math.random()*225, 2, 2); }
                btx.shadowBlur = 15; btx.shadowColor = "#22d3ee"; btx.fillStyle = "#fff";
                btx.beginPath(); btx.moveTo(200, 80); btx.lineTo(170, 130); btx.lineTo(230, 130); btx.fill();
                btx.shadowColor = "#ef4444"; btx.fillStyle = "#ef4444"; btx.fillRect(195, 130, 10, 15);
                break;
            case "Cyber Racer":
                btx.fillStyle = "#0c0a09"; btx.fillRect(0,0,400,225);
                btx.strokeStyle = "#f472b6"; btx.beginPath();
                for(let i=-200; i<600; i+=40) { btx.moveTo(200, 100); btx.lineTo(i, 225); }
                btx.stroke();
                btx.shadowBlur = 20; btx.shadowColor = "#22d3ee"; btx.fillStyle = "#22d3ee";
                btx.fillRect(170, 160, 60, 30);
                break;
            case "Dungeon Quest":
                btx.fillStyle = "#1c1917"; btx.fillRect(0,0,400,225);
                btx.fillStyle = "#0c0a09"; btx.fillRect(50, 50, 300, 125);
                btx.shadowBlur = 30; btx.shadowColor = "#fbbf24"; btx.fillStyle = "#fbbf24";
                btx.beginPath(); btx.arc(200, 112, 20, 0, Math.PI*2); btx.fill();
                break;
            case "Block Smasher":
                btx.fillStyle = "#0f172a"; btx.fillRect(0,0,400,225);
                drawGrid("#f472b6");
                btx.shadowBlur = 15; btx.shadowColor = "#fbbf24"; btx.fillStyle = "#fbbf24";
                btx.fillRect(160, 200, 80, 10);
                btx.shadowColor = "#22d3ee"; btx.fillStyle = "#22d3ee";
                btx.fillRect(190, 120, 20, 20);
                break;
            case "Pixel Bird":
                btx.fillStyle = "#0c4a6e"; btx.fillRect(0,0,400,225);
                btx.fillStyle = "#16a34a"; btx.fillRect(100, 0, 40, 80); btx.fillRect(100, 160, 40, 65);
                btx.shadowBlur = 15; btx.shadowColor = "#fbbf24"; btx.fillStyle = "#fbbf24";
                btx.fillRect(180, 100, 35, 30);
                break;
            case "Dino Runner":
                btx.fillStyle = "#1e1b4b"; btx.fillRect(0,0,400,225);
                btx.fillStyle = "#334155"; btx.fillRect(0, 180, 400, 5);
                btx.shadowBlur = 15; btx.shadowColor = "#f472b6"; btx.fillStyle = "#f472b6";
                btx.fillRect(80, 140, 40, 40);
                btx.shadowColor = "#4ade80"; btx.fillStyle = "#4ade80";
                btx.fillRect(300, 140, 20, 40);
                break;
            case "Neon Shadow Runner":
                btx.fillStyle = "#020617"; btx.fillRect(0,0,400,225);
                btx.shadowBlur = 20; btx.shadowColor = "#22d3ee"; btx.strokeStyle = "#22d3ee";
                btx.strokeRect(100, 110, 30, 45);
                btx.shadowColor = "#ef4444"; btx.fillStyle = "#ef4444";
                btx.fillRect(250, 120, 80, 5);
                break;
            case "Pixel Zombie Survival":
                btx.fillStyle = "#0c0a09"; btx.fillRect(0,0,400,225);
                btx.fillStyle = "#7f1d1d"; btx.globalAlpha = 0.3; btx.fillRect(200, 100, 50, 30); btx.globalAlpha = 1;
                btx.shadowBlur = 20; btx.shadowColor = "#22c55e"; btx.fillStyle = "#166534";
                btx.fillRect(150, 100, 30, 30);
                btx.shadowColor = "#ef4444"; btx.fillStyle = "#ef4444";
                btx.fillRect(240, 90, 30, 30);
                break;
            case "Space Miner":
                btx.fillStyle = "#050510"; btx.fillRect(0,0,400,225);
                btx.shadowBlur = 40; btx.shadowColor = "#a855f7"; btx.fillStyle = "rgba(168, 85, 247, 0.2)";
                btx.beginPath(); btx.arc(300, 112, 60, 0, Math.PI*2); btx.fill();
                btx.shadowBlur = 20; btx.shadowColor = "#22d3ee"; btx.fillStyle = "#fff";
                btx.beginPath(); btx.moveTo(180, 112); btx.lineTo(150, 100); btx.lineTo(150, 124); btx.fill();
                break;
            case "Neon Shooter":
                btx.fillStyle = "#020617"; btx.fillRect(0,0,400,225);
                drawGrid("#1e1b4b");
                // Player Ship (Blue Triangle)
                btx.shadowBlur = 25; btx.shadowColor = "#22d3ee"; btx.fillStyle = "#fff";
                btx.beginPath(); btx.moveTo(150, 112); btx.lineTo(120, 95); btx.lineTo(120, 130); btx.fill();
                // Laser Beams
                btx.shadowColor = "#f472b6"; btx.fillStyle = "#f472b6";
                btx.fillRect(155, 108, 100, 8);
                btx.shadowColor = "#22d3ee"; btx.fillStyle = "#22d3ee";
                btx.fillRect(155, 112, 100, 2);
                // Targets
                btx.shadowColor = "#ef4444"; btx.fillStyle = "#ef4444";
                btx.beginPath(); btx.arc(320, 112, 15, 0, Math.PI*2); btx.fill();
                btx.beginPath(); btx.arc(280, 60, 10, 0, Math.PI*2); btx.fill();
                break;
            case "Pixel Farm":
                btx.fillStyle = "#86efac"; btx.fillRect(0,0,400,225); // Grass
                btx.fillStyle = "#b45309"; btx.fillRect(100, 80, 100, 60); // Soil
                btx.shadowBlur = 10; btx.shadowColor = "#fbbf24"; btx.fillStyle = "#fbbf24";
                btx.beginPath(); btx.arc(350, 40, 30, 0, Math.PI*2); btx.fill(); // Sun
                btx.fillStyle = "#ef4444"; btx.fillRect(120, 90, 10, 10); // Tomato
                btx.fillStyle = "#4ade80"; btx.fillRect(160, 100, 8, 15); // Corn
                break;
            case "Pixel Defense":
                btx.fillStyle = "#1e293b"; btx.fillRect(0,0,400,225);
                btx.fillStyle = "#334155"; btx.fillRect(0, 80, 400, 40); // Path
                btx.shadowBlur = 15; btx.shadowColor = "#3b82f6"; btx.fillStyle = "#3b82f6";
                btx.fillRect(100, 40, 30, 30); // Tower
                btx.shadowColor = "#ef4444"; btx.fillStyle = "#ef4444";
                btx.beginPath(); btx.arc(250, 100, 10, 0, Math.PI*2); btx.fill(); // Enemy
                break;
        }
        img.src = canvas.toDataURL();
    });
}

/** 
 * --- 12. NEON SHOOTER (Top-Down Arena) ---
 */
let shPlayer, shEnemies, shBullets, shPowerups, shMultiplier, shLastHit;
function initShooter() {
    shPlayer = {
        x: 400, y: 250, 
        vx: 0, vy: 0, 
        angle: 0, 
        speed: 0.15,
        hp: 3, maxHp: 3,
        reload: 0,
        invul: 0,
        rapidMode: 0,
        shieldMode: 0,
        freezeMode: 0
    };
    shEnemies = []; shBullets = []; shPowerups = [];
    shMultiplier = 1; shLastHit = 0;
    
    // Initial spawn
    for(let i=0; i<4; i++) spawnShooterEnemy();
    gameLoop = requestAnimationFrame(loopShooter);
}

function spawnShooterEnemy() {
    const side = Math.floor(Math.random()*4);
    let ex, ey, type='basic';
    const rand = Math.random();
    if (rand > 0.8) type = 'tank';
    else if (rand > 0.6) type = 'fast';

    if (side === 0) { ex = Math.random()*800; ey = -50; }
    else if (side === 1) { ex = 850; ey = Math.random()*500; }
    else if (side === 2) { ex = Math.random()*800; ey = 550; }
    else { ex = -50; ey = Math.random()*500; }
    
    shEnemies.push({
        x: ex, y: ey,
        type: type,
        hp: type === 'tank' ? 300 : (type === 'fast' ? 50 : 100),
        speed: type === 'tank' ? 0.8 : (type === 'fast' ? 2.5 : 1.5),
        color: type === 'tank' ? "#a855f7" : (type === 'fast' ? "#f472b6" : "#4ade80")
    });
}

function loopShooter() {
    if (currentGame !== 'shooter') return;
    if (pmMenuOpen) { gameLoop = requestAnimationFrame(loopShooter); return; }
    frameCount++;

    // 1. INPUT & MOVEMENT
    const accel = shPlayer.speed;
    const friction = 0.94;
    
    if (keys['KeyW'] || keys['ArrowUp']) shPlayer.vy -= accel;
    if (keys['KeyS'] || keys['ArrowDown']) shPlayer.vy += accel;
    if (keys['KeyA'] || keys['ArrowLeft']) shPlayer.vx -= accel;
    if (keys['KeyD'] || keys['ArrowRight']) shPlayer.vx += accel;
    
    shPlayer.vx *= friction; shPlayer.vy *= friction;
    shPlayer.x += shPlayer.vx; shPlayer.y += shPlayer.vy;
    
    if (shPlayer.x < 20) shPlayer.x = 20; if (shPlayer.x > 780) shPlayer.x = 780;
    if (shPlayer.y < 20) shPlayer.y = 20; if (shPlayer.y > 480) shPlayer.y = 480;

    // Angle toward mouse
    shPlayer.angle = Math.atan2(mouseY - shPlayer.y, mouseX - shPlayer.x);

    // Shooting
    if (shPlayer.reload > 0) shPlayer.reload--;
    if ((keys['Space'] || keys['MouseDown']) && shPlayer.reload <= 0) {
        shBullets.push({
            x: shPlayer.x, y: shPlayer.y,
            vx: Math.cos(shPlayer.angle) * 12,
            vy: Math.sin(shPlayer.angle) * 12,
            life: 60, owner: 'player'
        });
        shPlayer.reload = shPlayer.rapidMode > 0 ? 5 : 15;
        playSound(500, 0.05, 'sine');
    }

    // Timers
    if (shPlayer.invul > 0) shPlayer.invul--;
    if (shPlayer.rapidMode > 0) shPlayer.rapidMode--;
    if (shPlayer.shieldMode > 0) shPlayer.shieldMode--;
    if (shPlayer.freezeMode > 0) shPlayer.freezeMode--;

    // 2. ENEMY LOGIC
    if (frameCount % Math.max(10, 60 - Math.floor(score/1000)) === 0) spawnShooterEnemy();

    shEnemies.forEach((e, ei) => {
        const dx = shPlayer.x - e.x, dy = shPlayer.y - e.y, dist = Math.sqrt(dx*dx+dy*dy);
        const actualSpeed = shPlayer.freezeMode > 0 ? e.speed * 0.2 : e.speed;
        e.x += (dx/dist) * actualSpeed; e.y += (dy/dist) * actualSpeed;
        
        if (dist < 25 && shPlayer.invul <= 0) {
            if (shPlayer.shieldMode > 0) {
                shPlayer.shieldMode = 0; shPlayer.invul = 60;
                createBurst(shPlayer.x, shPlayer.y, "#22d3ee", 30);
                playSound(200, 0.2, 'sawtooth');
            } else {
                shPlayer.hp--; shPlayer.invul = 60; shake = 25;
                shMultiplier = 1;
                playSound(100, 0.3, 'square');
                if (shPlayer.hp <= 0) { showGameOver(); return; }
            }
        }
    });

    // 3. BULLET LOGIC
    shBullets.forEach((b, bi) => {
        b.x += b.vx; b.y += b.vy; b.life--;
        // Trail
        if (frameCount % 2 === 0) particles.push(new Particle(b.x, b.y, "#fff", 2));
        
        if (b.life <= 0) { shBullets.splice(bi, 1); return; }
        
        shEnemies.forEach((e, ei) => {
            if (Math.sqrt((b.x-e.x)**2+(b.y-e.y)**2) < 25) {
                e.hp -= 40; createBurst(b.x, b.y, e.color, 5);
                shBullets.splice(bi, 1);
                if (e.hp <= 0) {
                    createBurst(e.x, e.y, e.color, 25);
                    shEnemies.splice(ei, 1);
                    score += 10 * shMultiplier;
                    shMultiplier = Math.min(10, shMultiplier + 0.05);
                    if (Math.random() > 0.85) {
                        const types = ['rapid', 'shield', 'freeze'];
                        shPowerups.push({ x: e.x, y: e.y, type: types[Math.floor(Math.random()*types.length)] });
                    }
                }
            }
        });
    });

    // 4. POWERUPS
    shPowerups.forEach((p, pi) => {
        const dist = Math.sqrt((shPlayer.x-p.x)**2+(shPlayer.y-p.y)**2);
        if (dist < 30) {
            if (p.type === 'rapid') shPlayer.rapidMode = 400;
            if (p.type === 'shield') shPlayer.shieldMode = 500;
            if (p.type === 'freeze') shPlayer.freezeMode = 300;
            shPowerups.splice(pi, 1); 
            playSound(1200, 0.1, 'sine', 1600);
            shake = 10;
        }
    });

    // --- DRAWING ---
    drawBackground();
    ctx.save(); applyShake();
    
    // Grid (Deeper Parallax-ish)
    ctx.strokeStyle = "rgba(34, 211, 238, 0.15)"; ctx.lineWidth = 1;
    for(let i=0; i<800; i+=50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,500); ctx.stroke(); }
    for(let i=0; i<500; i+=50) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(800,i); ctx.stroke(); }

    if (shPlayer.freezeMode > 0) {
        ctx.fillStyle = "rgba(34, 211, 238, 0.1)"; ctx.fillRect(0,0,800,500);
    }

    // Powerups
    shPowerups.forEach(p => {
        const colors = { rapid: "#f472b6", shield: "#22d3ee", freeze: "#60a5fa" };
        ctx.shadowBlur = 20; ctx.shadowColor = colors[p.type];
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath(); ctx.arc(p.x, p.y, 12 + Math.sin(frameCount*0.15)*4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.type[0].toUpperCase(), p.x, p.y + 4);
    });

    // Enemies
    shEnemies.forEach(e => {
        ctx.shadowBlur = shPlayer.freezeMode > 0 ? 5 : 15; ctx.shadowColor = e.color;
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.type === 'tank' ? 22 : 14, 0, Math.PI*2); ctx.fill();
        if (shPlayer.freezeMode > 0) { ctx.strokeStyle = "#fff"; ctx.stroke(); }
    });

    // Bullets
    shBullets.forEach(b => {
        ctx.shadowBlur = 10; ctx.shadowColor = "#22d3ee";
        ctx.fillStyle = "#fff";
        ctx.fillRect(b.x-4, b.y-4, 8, 8);
    });

    // Player
    ctx.save(); ctx.translate(shPlayer.x, shPlayer.y); ctx.rotate(shPlayer.angle);
    if (shPlayer.invul % 4 < 2) {
        ctx.shadowBlur = 25; ctx.shadowColor = "#22d3ee";
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-12,-12); ctx.lineTo(-12,12); ctx.fill();
        if (shPlayer.shieldMode > 0) {
            ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 3; ctx.shadowColor = "#22d3ee";
            ctx.beginPath(); ctx.arc(0,0, 30, 0, Math.PI*2); ctx.stroke();
        }
    }
    ctx.restore();
    ctx.restore();

    // UI
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(10, 10, 220, 100);
    ctx.strokeStyle = "#22d3ee"; ctx.strokeRect(10, 10, 220, 100);
    ctx.fillStyle = "#fff"; ctx.font = "12px 'Press Start 2P'"; ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${Math.floor(score)}`, 25, 40);
    ctx.fillStyle = shMultiplier > 5 ? "#f472b6" : "#4ade80";
    ctx.fillText(`COMBO: x${shMultiplier.toFixed(1)}`, 25, 65);
    
    // HP Bar
    ctx.fillStyle = "#334155"; ctx.fillRect(25, 85, 180, 10);
    ctx.fillStyle = "#ef4444"; ctx.fillRect(25, 85, (shPlayer.hp/shPlayer.maxHp)*180, 10);
    
    if (shPlayer.rapidMode > 0) { ctx.fillStyle = "#f472b6"; ctx.fillText("ULTRA RAPID!", 400, 50); }
    if (shPlayer.freezeMode > 0) { ctx.fillStyle = "#60a5fa"; ctx.fillText("TIME FROZEN!", 400, 80); }

    updateParticles();
    gameLoop = requestAnimationFrame(loopShooter);
}

/**
 * --- 13. PIXEL FARM (Relaxing Simulation) ---
 */
let fmPlayer, fmTiles, fmCoins, fmTool, fmDayTime, fmShopOpen;
const TILE_SIZE = 50, GRID_W = 10, GRID_H = 7;

function initFarm() {
    fmPlayer = { x: 400, y: 250, vx: 0, vy: 0, speed: 3 };
    fmTiles = [];
    const startX = (800 - GRID_W * TILE_SIZE) / 2;
    const startY = (500 - GRID_H * TILE_SIZE) / 2;

    for (let row = 0; row < GRID_H; row++) {
        for (let col = 0; col < GRID_W; col++) {
            fmTiles.push({
                x: startX + col * TILE_SIZE,
                y: startY + row * TILE_SIZE,
                state: 'grass', // grass, tilled, seeded, grown, harvestable
                watered: false,
                growth: 0,
                type: 'tomato'
            });
        }
    }
    fmCoins = 20;
    fmTool = 'hoe'; // hoe, seeds, water, harvest
    fmDayTime = 0; // 0 to 1 cycle
    fmShopOpen = false;
    gameLoop = requestAnimationFrame(loopFarm);
}

function loopFarm() {
    if (currentGame !== 'farm') return;
    frameCount++;

    // 1. INPUT & MOVEMENT
    const accel = 1;
    if (keys['KeyW'] || keys['ArrowUp']) fmPlayer.y -= fmPlayer.speed;
    if (keys['KeyS'] || keys['ArrowDown']) fmPlayer.y += fmPlayer.speed;
    if (keys['KeyA'] || keys['ArrowLeft']) fmPlayer.x -= fmPlayer.speed;
    if (keys['KeyD'] || keys['ArrowRight']) fmPlayer.x += fmPlayer.speed;

    // Tool Selection
    const oldTool = fmTool;
    if (keys['Digit1']) fmTool = 'hoe';
    if (keys['Digit2']) fmTool = 'seeds';
    if (keys['Digit3']) fmTool = 'water';
    if (keys['Digit4']) fmTool = 'harvest';
    if (oldTool !== fmTool) updateHUD();

    // Day/Night Cycle (Slow)
    fmDayTime = (Math.sin(frameCount * 0.001) + 1) / 2;

    // 2. INTERACTION
    if (keys['MouseDown'] || keys['Space']) {
        fmTiles.forEach(t => {
            const dx = fmPlayer.x - (t.x + TILE_SIZE/2);
            const dy = fmPlayer.y - (t.y + TILE_SIZE/2);
            if (Math.abs(dx) < TILE_SIZE/2 && Math.abs(dy) < TILE_SIZE/2) {
                if (fmTool === 'hoe' && t.state === 'grass') { t.state = 'tilled'; playSound(300, 0.05, 'square'); }
                if (fmTool === 'seeds' && t.state === 'tilled' && fmCoins >= 5) { 
                    t.state = 'seeded'; t.growth = 0; fmCoins -= 5; 
                    floatingTexts.push(new FloatingText(t.x, t.y, "-$5", "#ef4444"));
                    playSound(600, 0.1, 'sine'); 
                }
                if (fmTool === 'water' && (t.state === 'seeded' || t.state === 'grown')) { t.watered = true; playSound(800, 0.2, 'sine'); }
                if (fmTool === 'harvest' && t.state === 'harvestable') { 
                    t.state = 'grass'; t.watered = false; fmCoins += 15; 
                    floatingTexts.push(new FloatingText(t.x, t.y, "+$15", "#4ade80"));
                    playSound(1000, 0.1, 'sine'); createBurst(t.x+25, t.y+25, "#fde047", 12); 
                }
            }
        });
        if (keys['Space']) keys['Space'] = false; // Debounce
        keys['MouseDown'] = false;
    }

    // 3. GROWTH LOGIC
    if (frameCount % 120 === 0) {
        fmTiles.forEach(t => {
            if (t.state === 'seeded' && t.watered) {
                t.growth += 1;
                if (t.growth > 2) { t.state = 'grown'; t.growth = 0; t.watered = false; }
            } else if (t.state === 'grown' && t.watered) {
                t.growth += 1;
                if (t.growth > 2) { t.state = 'harvestable'; t.watered = false; }
            }
        });
    }

    // --- DRAWING ---
    // Sky Color
    const r = Math.floor(134 - fmDayTime * 100);
    const g = Math.floor(239 - fmDayTime * 200);
    const b = Math.floor(172 - fmDayTime * 100);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0,0,800,500);

    // Tiles
    fmTiles.forEach(t => {
        // Render Tile
        if (t.state === 'grass') {
            ctx.fillStyle = "#4ade80"; ctx.fillRect(t.x, t.y, TILE_SIZE - 2, TILE_SIZE - 2);
            // Grass texture dots
            ctx.fillStyle = "#86efac"; 
            ctx.fillRect(t.x+10, t.y+10, 2, 2); ctx.fillRect(t.x+30, t.y+25, 2, 2); ctx.fillRect(t.x+15, t.y+40, 2, 2);
        }
        else if (t.state === 'tilled') {
            ctx.fillStyle = "#78350f"; ctx.fillRect(t.x, t.y, TILE_SIZE - 2, TILE_SIZE - 2);
            ctx.fillStyle = "#451a03"; ctx.fillRect(t.x+5, t.y+5, TILE_SIZE-12, 2); // Furrows
        }
        else {
            ctx.fillStyle = "#451a03"; ctx.fillRect(t.x, t.y, TILE_SIZE - 2, TILE_SIZE - 2); // Dirt
        }

        if (t.watered) {
            ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 3;
            ctx.strokeRect(t.x+2, t.y+2, TILE_SIZE-6, TILE_SIZE-6);
        }

        // Crops
        if (t.state === 'seeded') {
            ctx.fillStyle = "#15803d"; ctx.fillRect(t.x+20, t.y+30, 10, 10);
        } else if (t.state === 'grown') {
            ctx.fillStyle = "#166534"; ctx.fillRect(t.x+15, t.y+20, 20, 20);
        } else if (t.state === 'harvestable') {
            ctx.shadowBlur = 10; ctx.shadowColor = "#ef4444";
            ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(t.x+25, t.y+25, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#4ade80"; ctx.fillRect(t.x+22, t.y+10, 6, 6); // Sparkle sellable
            ctx.shadowBlur = 0;
        }
    });

    // Player (Now a Tractor!)
    ctx.save(); ctx.translate(fmPlayer.x, fmPlayer.y);
    // Mirror based on velocity if we had it, for now just draw
    ctx.shadowBlur = 15; ctx.shadowColor = "rgba(0,0,0,0.3)";
    btx = ctx; // Temp alias for consistency in my mental model
    btx.fillStyle = "#ef4444"; btx.fillRect(-25, -15, 50, 30); // Body
    btx.fillStyle = "#222"; btx.fillRect(-20, 10, 12, 12); btx.fillRect(8, 10, 12, 12); // Wheels
    btx.fillStyle = "#94a3b8"; btx.fillRect(5, -25, 15, 15); // Cabin
    btx.fillStyle = "#020617"; btx.fillRect(10, -20, 8, 8); // Window
    ctx.restore();

    // Night Overlay
    ctx.fillStyle = `rgba(15, 23, 42, ${fmDayTime * 0.7})`;
    ctx.fillRect(0,0,800,500);

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(10, 10, 280, 120);
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.strokeRect(10, 10, 280, 120);
    ctx.fillStyle = "#fbbf24"; ctx.font = "14px 'Press Start 2P'"; ctx.textAlign="left";
    ctx.fillText(`$ ${fmCoins}`, 30, 45);
    ctx.fillStyle = "#fff"; ctx.font = "10px 'Press Start 2P'";
    ctx.fillText(`ACTIVE: ${fmTool.toUpperCase()}`, 30, 75);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("1:HOE 2:SEED($5) 3:WATER 4:SELL", 20, 110);

    if (fmCoins < 5 && fmTool === 'seeds') {
        ctx.fillStyle = "#ef4444"; ctx.textAlign="center"; ctx.fillText("RUNNING OUT OF MONEY!", 400, 450);
    }

    updateFloatingTexts();
    updateParticles();
    gameLoop = requestAnimationFrame(loopFarm);
}

/**
 * --- 14. PIXEL DEFENSE (Professional Edition) ---
 */
class TDEnemy {
    constructor(path, wave) {
        this.path = path;
        this.x = path[0].x;
        this.y = path[0].y;
        this.waypointIdx = 1;
        this.wave = wave;
        const isBoss = wave % 5 === 0 && tdWaveEnemiesLeft === 0;
        this.type = isBoss ? 'boss' : (Math.random() < 0.2 ? 'tank' : (Math.random() < 0.4 ? 'fast' : 'basic'));
        
        const hpMap = { basic: 80, fast: 40, tank: 300, boss: 1500 };
        const speedMap = { basic: 1.4, fast: 2.6, tank: 0.8, boss: 0.6 };
        
        this.hp = hpMap[this.type] * (1 + wave * 0.25);
        this.maxHp = this.hp;
        this.speed = speedMap[this.type] * (1 + wave * 0.05);
        this.color = { basic: "#ef4444", fast: "#4ade80", tank: "#a855f7", boss: "#fbbf24" }[this.type];
        this.radius = { basic: 12, fast: 10, tank: 20, boss: 35 }[this.type];
        this.reward = isBoss ? 200 : (this.type === 'tank' ? 30 : 15);
    }
    update() {
        const target = this.path[this.waypointIdx];
        const dx = target.x - this.x, dy = target.y - this.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < this.speed) {
            this.waypointIdx++;
            if (this.waypointIdx >= this.path.length) return true;
        } else {
            this.x += (dx/dist) * this.speed;
            this.y += (dy/dist) * this.speed;
        }
        return false;
    }
    draw() {
        ctx.shadowBlur = 15; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#334155"; ctx.fillRect(this.x-15, this.y-this.radius-10, 30, 4);
        ctx.fillStyle = "#ef4444"; ctx.fillRect(this.x-15, this.y-this.radius-10, (this.hp/this.maxHp)*30, 4);
        ctx.shadowBlur = 0;
    }
}

class TDTower {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type; this.level = 1;
        this.config = {
            basic:  { cost: 50,  range: 160, cooldown: 30, dmg: 40,  color: "#3b82f6" },
            sniper: { cost: 100, range: 400, cooldown: 120, dmg: 200, color: "#fbbf24" },
            rapid:  { cost: 120, range: 140, cooldown: 8,  dmg: 12,  color: "#f472b6" }
        };
        const c = this.config[type];
        this.range = c.range; this.cooldown = c.cooldown; this.dmg = c.dmg; this.color = c.color;
        this.timer = 0;
    }
    update(enemies, projectiles) {
        this.timer++;
        if (this.timer >= this.cooldown) {
            const target = enemies.find(e => Math.sqrt((e.x-this.x)**2+(e.y-this.y)**2) <= this.range);
            if (target) {
                projectiles.push({ x: this.x, y: this.y, target, dmg: this.dmg, speed: 12, color: this.color });
                this.timer = 0;
                playSound(700, 0.05, 'sine');
            }
        }
    }
    upgrade() {
        const cost = Math.floor(this.config[this.type].cost * this.level * 1.5);
        if (tdCoins >= cost) {
            tdCoins -= cost; this.level++;
            this.dmg *= 1.5; this.range *= 1.1; this.cooldown *= 0.85;
            createBurst(this.x, this.y, "#fff", 20);
            playSound(1200, 0.1, 'sine');
            return true;
        }
        return false;
    }
    draw() {
        ctx.shadowBlur = 15; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        ctx.fillRect(this.x-22, this.y-22, 44, 44);
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign="center";
        ctx.fillText("L" + this.level, this.x, this.y+5);
        ctx.shadowBlur = 0;
    }
}

let tdEnemies, tdTowers, tdProjectiles, tdCoins, tdWave, tdTool, tdHealth, tdWaveActive, tdWaveEnemiesLeft;
const TD_WAYPOINTS = [{x:0,y:100}, {x:600,y:100}, {x:600,y:400}, {x:100,y:400}, {x:100,y:250}, {x:800,y:250}];

function initTD() {
    tdCoins = 250; tdWave = 0; tdHealth = 20; tdWaveActive = false;
    tdEnemies = []; tdTowers = []; tdProjectiles = []; tdTool = 'basic';
    gameLoop = requestAnimationFrame(loopTD);
}

let tdWaveTimer = 600; // Countdown timer
function startWave() {
    if (tdWaveActive) return;
    tdWave++; tdWaveActive = true;
    tdWaveEnemiesLeft = 5 + tdWave * 3;
    if (tdWave % 5 === 0) tdWaveEnemiesLeft = 1;
    tdWaveTimer = 900; // Reset for next wait
    playSound(400, 0.1, 'sine', 800);
}

function loopTD() {
    if (currentGame !== 'td') return;
    frameCount++;

    // 1. WAVE SPAWNING
    if (tdWaveActive && frameCount % 45 === 0 && tdWaveEnemiesLeft > 0) {
        tdEnemies.push(new TDEnemy(TD_WAYPOINTS, tdWave));
        tdWaveEnemiesLeft--;
    }
    if (tdWaveActive && tdEnemies.length === 0 && tdWaveEnemiesLeft === 0) {
        tdWaveActive = false; tdCoins += 100 + tdWave * 10;
        tdWaveTimer = 900;
        floatingTexts.push(new FloatingText(400, 80, "WAVE COMPLETE +$100", "#4ade80"));
    }
    
    if (!tdWaveActive) {
        tdWaveTimer--;
        if (tdWaveTimer <= 0) startWave();
    }

    // Tool Selection via Keyboard
    const oldTool = tdTool;
    if (keys['Digit1']) tdTool = 'basic';
    if (keys['Digit2']) tdTool = 'sniper';
    if (keys['Digit3']) tdTool = 'rapid';
    if (keys['Digit4']) tdTool = 'sell';
    if (oldTool !== tdTool) updateHUD();

    // 2. UPDATES
    tdEnemies.forEach((e, ei) => { if (e.update()) { tdHealth--; tdEnemies.splice(ei, 1); shake = 20; if (tdHealth <= 0) showGameOver(); } });
    tdTowers.forEach(t => t.update(tdEnemies, tdProjectiles));
    tdProjectiles.forEach((p, pi) => {
        const dx = p.target.x - p.x, dy = p.target.y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 12) {
            p.target.hp -= p.dmg; tdProjectiles.splice(pi, 1);
            if (p.target.hp <= 0) {
                const idx = tdEnemies.indexOf(p.target);
                if (idx !== -1) { 
                    tdCoins += p.target.reward; 
                    floatingTexts.push(new FloatingText(p.target.x, p.target.y, `+$${p.target.reward}`, "#4ade80"));
                    createBurst(p.target.x, p.target.y, p.target.color, 15); 
                    tdEnemies.splice(idx, 1); 
                }
            }
        } else { p.x += (dx/dist) * p.speed; p.y += (dy/dist) * p.speed; }
    });

    // 3. PLACEMENT & SELL
    if (keys['MouseDown']) {
        const gx = Math.floor(mouseX/50)*50 + 25, gy = Math.floor(mouseY/50)*50 + 25;
        const towerIdx = tdTowers.findIndex(t => t.x === gx && t.y === gy);
        
        // Path Check Logic
        let isOnPath = false;
        for (let i = 0; i < TD_WAYPOINTS.length - 1; i++) {
            const p1 = TD_WAYPOINTS[i], p2 = TD_WAYPOINTS[i+1];
            // Check if point gx,gy is near segment p1-p2
            const d = distToSegment({x:gx, y:gy}, p1, p2);
            if (d < 30) isOnPath = true;
        }

        if (towerIdx !== -1) {
            if (tdTool === 'sell') {
                const refund = Math.floor(tdTowers[towerIdx].config[tdTowers[towerIdx].type].cost * 0.7);
                tdCoins += refund;
                floatingTexts.push(new FloatingText(gx, gy, `+$${refund}`, "#fbbf24"));
                tdTowers.splice(towerIdx, 1);
                playSound(300, 0.1, 'sawtooth');
                updateHUD();
            } else {
                tdTowers[towerIdx].upgrade();
            }
        } else if (tdTool !== 'sell' && mouseX > 0 && mouseY > 0 && !isOnPath) {
            const cost = { basic: 50, sniper: 100, rapid: 120 }[tdTool];
            if (tdCoins >= cost) { tdTowers.push(new TDTower(gx, gy, tdTool)); tdCoins -= cost; playSound(300, 0.1, 'square'); }
        } else if (isOnPath && tdTool !== 'sell') {
            floatingTexts.push(new FloatingText(mouseX, mouseY, "CAN'T BUILD ON PATH", "#ef4444"));
        }
        keys['MouseDown'] = false;
    }

    // --- DRAWING ---
    ctx.fillStyle = "#0f172a"; ctx.fillRect(0,0,800,500);
    // Path
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 45; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(TD_WAYPOINTS[0].x, TD_WAYPOINTS[0].y); TD_WAYPOINTS.forEach(pt => ctx.lineTo(pt.x, pt.y)); ctx.stroke();
    
    // Grid Hover & RANGE
    const hx = Math.floor(mouseX/50)*50, hy = Math.floor(mouseY/50)*50;
    if (mouseX > 0 && mouseY > 0 && mouseX < 800 && mouseY < 500) {
        ctx.strokeStyle = "rgba(34, 211, 238, 0.4)"; ctx.lineWidth = 2; ctx.strokeRect(hx+2, hy+2, 46, 46);
        if (tdTool !== 'sell') {
            const range = { basic: 160, sniper: 400, rapid: 140 }[tdTool];
            ctx.fillStyle = "rgba(34, 211, 238, 0.1)"; ctx.beginPath(); ctx.arc(hx+25, hy+25, range, 0, Math.PI*2); ctx.fill();
        }
    }

    tdEnemies.forEach(e => e.draw());
    tdTowers.forEach(t => t.draw());
    tdProjectiles.forEach(p => { 
        ctx.shadowBlur = 5; ctx.shadowColor = p.color; ctx.fillStyle = p.color; 
        ctx.fillRect(p.x-4, p.y-4, 8, 8); ctx.shadowBlur = 0;
    });

    // UI
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(10, 10, 320, 100);
    ctx.strokeStyle = "#22d3ee"; ctx.strokeRect(10, 10, 320, 100);
    ctx.fillStyle = "#fff"; ctx.font = "12px 'Press Start 2P'"; ctx.textAlign="left";
    ctx.fillText(`$${tdCoins}  HP: ${tdHealth}`, 25, 40);
    ctx.fillText(`WAVE: ${tdWave}`, 25, 75);

    if (!tdWaveActive) {
        ctx.fillStyle = "var(--neon-pink)"; ctx.fillRect(350, 20, 150, 45);
        ctx.fillStyle = "#fff"; ctx.textAlign="center"; ctx.font="11px 'Press Start 2P'"; 
        ctx.fillText("START WAVE", 425, 45);
        ctx.font="9px 'Press Start 2P'";
        ctx.fillText(`Next Wave in: ${Math.ceil(tdWaveTimer/60)}s`, 425, 60);
        if (mouseX > 350 && mouseX < 500 && mouseY > 20 && mouseY < 65 && keys['MouseDown']) startWave();
    }

    updateFloatingTexts();
    updateParticles();
    gameLoop = requestAnimationFrame(loopTD);
}

// Global initialization
window.addEventListener('load', () => {
    generateDynamicBanners();
    // Re-bind controls as well to ensure they are fresh
    bindMobileControls();
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }, 1500);
});

// Game Search Functionality
const gameSearch = document.getElementById('game-search');
if (gameSearch) {
    gameSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.game-card');
        
        cards.forEach(card => {
            const title = card.querySelector('.game-title').innerText.toLowerCase();
            if (title.includes(query)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });

    gameSearch.addEventListener('focus', () => {
        gameSearch.style.borderColor = 'var(--neon-pink)';
        gameSearch.style.boxShadow = '0 0 20px rgba(244, 114, 182, 0.4)';
    });

    gameSearch.addEventListener('blur', () => {
        gameSearch.style.borderColor = 'var(--neon-cyan)';
        gameSearch.style.boxShadow = '0 0 10px rgba(34, 211, 238, 0.2)';
    });
}

// --- GOOGLE OAUTH SIGN-IN ---
const connectBtn = document.getElementById('connect-btn');
let userLoggedIn = false;

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    userLoggedIn = true;
    updateUserProfile(responsePayload.name, responsePayload.picture);
    localStorage.setItem('pixel_user', JSON.stringify({
        name: responsePayload.name, 
        picture: responsePayload.picture 
    }));
}

function decodeJwtResponse(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function updateUserProfile(name, imageUrl) {
    if (connectBtn) {
        connectBtn.innerHTML = `<img src="${imageUrl}" style="width: 20px; height: 20px; border-radius: 50%; display: inline-block; vertical-align: middle; margin-right: 8px;"> <span style="vertical-align: middle;">${name.toUpperCase()}</span>`;
        connectBtn.style.padding = '0.5rem 1rem';
        connectBtn.style.fontSize = '0.6rem';
        connectBtn.style.backgroundColor = 'var(--neon-pink)';
    }
}

function handleLoginSuccess(user) {
    userLoggedIn = true;
    updateUserProfile(user.name, user.picture);
    localStorage.setItem('pixel_user', JSON.stringify(user));
}

// Simulated Sign-In Pop-up for Demo
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        if (userLoggedIn) return;
        const confirmLogin = confirm("PIXELZONE LOGIN: Sign in with Google?");
        if (confirmLogin) {
            handleLoginSuccess({
                name: "Pixel Player",
                picture: "https://ui-avatars.com/api/?name=Pixel+Player&background=22d3ee&color=fff"
            });
        }
    });
}

// Restore session
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('pixel_user');
    if (savedUser) {
        const u = JSON.parse(savedUser);
        updateUserProfile(u.name, u.picture);
        userLoggedIn = true;
    }
});
