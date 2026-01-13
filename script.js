const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const TERMINAL_VELOCITY = 12;
const TICK_RATE = 1000 / 60; 

let gameRunning = false;
let currentLevel = 1;
let lastTimestamp = 0;
let accumulator = 0;
let isMuted = false;

// Sprite Settings (96x96 on a 192x288 sheet)
const playerSprite = new Image();
playerSprite.src = 'your-sprite-file.png'; 

const COLORS = {
    PLAYER: '#ffb7c5',
    PLATFORM: '#d4a373',
    ENEMY: '#a3b18a',
    BOSS1: '#b79ced',
    BOSS2: '#72efdd',
    PROJECTILE: '#e63946',
    DOOR: '#fb8500',
    HB_BG: '#eeeeee',
    HB_FILL: '#ffb7c5',
    SPARKLE: '#fff9c4'
};

const keys = { ArrowRight: false, ArrowLeft: false, ArrowUp: false, z: false };
const PEEK_STATE = { SAFE: 0, WARNING: 1, PEEKING: 2 };
let peekState = PEEK_STATE.SAFE;
let peekTimer = 0;
let nextPeekTime = 300; 

// --- AUDIO HANDLING ---
function toggleMute() {
    const bgMusic = document.getElementById('bgMusic');
    const heartbeat = document.getElementById('heartbeat');
    const btn = document.getElementById('mute-btn');
    
    isMuted = !isMuted;
    
    if (bgMusic) bgMusic.muted = isMuted;
    if (heartbeat) heartbeat.muted = isMuted;
    
    btn.innerText = isMuted ? "🔈" : "🔊";
}

function updatePeekMechanic() {
    peekTimer++;
    const warningUI = document.getElementById('peek-warning');
    const activeUI = document.getElementById('peek-active');
    const bgMusic = document.getElementById('bgMusic');
    const heartbeat = document.getElementById('heartbeat');
    
    if (peekState === PEEK_STATE.SAFE) {
        if (bgMusic) bgMusic.volume = 0.3;
        if (heartbeat) { heartbeat.pause(); heartbeat.currentTime = 0; }
        
        warningUI.style.display = 'none';
        activeUI.style.display = 'none';
        
        if (peekTimer > nextPeekTime) {
            peekState = PEEK_STATE.WARNING;
            peekTimer = 0;
        }
    } else if (peekState === PEEK_STATE.WARNING) {
        warningUI.style.display = 'block';
        if (peekTimer > 120) {
            peekState = PEEK_STATE.PEEKING;
            peekTimer = 0;
            // Play heartbeat when child is peeking
            if (heartbeat && !isMuted) heartbeat.play().catch(e => {});
        }
    } else {
        // PEEKING STATE
        if (bgMusic) bgMusic.volume = 0.1;
        activeUI.style.display = 'block';
        warningUI.style.display = 'none';
        
        // Check for movement (Caught logic)
        if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1 || keys.z) {
            player.takeDamage(100);
        }
        
        if (peekTimer > 180) {
            peekState = PEEK_STATE.SAFE;
            peekTimer = 0;
            nextPeekTime = Math.random() * 300 + 300;
        }
    }
}

// --- ENTITIES & CLASSES ---
class Player {
    constructor() {
        this.x = 50; this.y = 500;
        this.w = 96; this.h = 96;
        this.vx = 0; this.vy = 0;
        this.frameX = 0; this.frameY = 0;
        this.frameTimer = 0;
        this.speed = 5; this.jumpPower = -12;
        this.grounded = false; this.health = 100;
        this.maxHealth = 100; this.facingRight = true;
    }

    update(platforms) {
        this.vx = 0;
        if (keys.ArrowRight) { this.vx = this.speed; this.facingRight = true; }
        if (keys.ArrowLeft) { this.vx = -this.speed; this.facingRight = false; }
        if (keys.ArrowUp && this.grounded) { this.vy = this.jumpPower; this.grounded = false; }

        this.vy += GRAVITY;
        this.x += this.vx;
        
        // Vertical Collision
        this.y += this.vy;
        this.grounded = false;
        platforms.forEach(p => {
            if (this.x < p.x + p.w && this.x + this.w > p.x && this.y < p.y + p.h && this.y + this.h > p.y) {
                if (this.vy > 0) { this.y = p.y - this.h; this.vy = 0; this.grounded = true; }
                else if (this.vy < 0) { this.y = p.y + p.h; this.vy = 0; }
            }
        });

        // Animation Column Logic (2 columns)
        this.frameTimer++;
        if (this.frameTimer % 12 === 0) this.frameX = (this.frameX + 1) % 2;

        // Animation Row Logic (3 rows: 0=Idle, 1=Run, 2=Jump)
        if (!this.grounded) this.frameY = 2;
        else if (this.vx !== 0) this.frameY = 1;
        else this.frameY = 0;

        if (this.y > canvas.height) this.takeDamage(100);
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        if (!this.facingRight) ctx.scale(-1, 1);
        ctx.drawImage(playerSprite, this.frameX * 96, this.frameY * 96, 96, 96, -48, -48, 96, 96);
        ctx.restore();
    }
    
    takeDamage(amt) { this.health -= amt; if (this.health <= 0) endGame(false); }
}

// --- GAME LOOP ---
let player;
let platforms = [{x: 0, y: 550, w: 800, h: 50}, {x: 300, y: 400, w: 200, h: 20}];

function gameLoop(ts) {
    if (!gameRunning) return;
    if (!lastTimestamp) lastTimestamp = ts;
    accumulator += ts - lastTimestamp;
    lastTimestamp = ts;

    while (accumulator >= TICK_RATE) {
        updatePeekMechanic();
        player.update(platforms);
        accumulator -= TICK_RATE;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.PLATFORM;
    platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));
    player.draw();

    requestAnimationFrame(gameLoop);
}

function startGame() {
    const bgMusic = document.getElementById('bgMusic');
    if (bgMusic && !isMuted) bgMusic.play().catch(e => {});
    
    document.getElementById('start-screen').style.display = 'none';
    player = new Player();
    gameRunning = true;
    lastTimestamp = performance.now();
    requestAnimationFrame(gameLoop);
}

function endGame(victory) {
    gameRunning = false;
    const heartbeat = document.getElementById('heartbeat');
    if (heartbeat) heartbeat.pause();
    document.getElementById(victory ? 'victory-screen' : 'game-over-screen').style.display = 'flex';
}

function restartLevel() {
    document.getElementById('game-over-screen').style.display = 'none';
    startGame();
}

window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });
