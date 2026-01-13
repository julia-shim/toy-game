const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRAVITY = 0.6;
const TERMINAL_VELOCITY = 12;
let gameRunning = false;
let currentLevel = 1;

// Delta Time variables
let lastTime = 0;
const TARGET_FPS = 60;

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

let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.size = Math.random() * 5 + 2;
        this.color = color;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.alpha -= this.decay * dt; }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createSparkles(x, y, count, color) {
    for (let i = 0; i < count; i++) { particles.push(new Particle(x, y, color)); }
}

function drawHealthBar(x, y, w, health, maxHealth) {
    const barW = w * 1.2;
    const barH = 6;
    const drawX = x - (barW - w) / 2;
    const drawY = y - 15;
    ctx.fillStyle = COLORS.HB_BG;
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, barW, barH, 3);
    ctx.fill();
    const fillW = (health / maxHealth) * barW;
    ctx.fillStyle = COLORS.HB_FILL;
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, Math.max(0, fillW), barH, 3);
    ctx.fill();
}

class Entity {
    constructor(x, y, w, h, color) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.color = color; this.vx = 0; this.vy = 0;
        this.markedForDeletion = false;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.w, this.h, 8);
        ctx.fill();
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; }
}

class Player extends Entity {
    constructor() {
        super(50, 500, 30, 30, COLORS.PLAYER);
        this.speed = 5; this.jumpPower = -12;
        this.grounded = false; this.health = 100;
        this.maxHealth = 100; this.attackCooldown = 0;
        this.facingRight = true;
        this.scaleY = 1; this.scaleX = 1;
    }
    update(platforms, dt) {
        this.vx = 0;
        if (keys.ArrowRight) { this.vx = this.speed; this.facingRight = true; }
        if (keys.ArrowLeft) { this.vx = -this.speed; this.facingRight = false; }
        if (keys.ArrowUp && this.grounded) { 
            this.vy = this.jumpPower; this.grounded = false;
            this.scaleY = 1.4; this.scaleX = 0.7;
        }
        this.vy += GRAVITY * dt;
        if (this.vy > TERMINAL_VELOCITY) this.vy = TERMINAL_VELOCITY;
        
        // Apply horizontal movement
        this.x += this.vx * dt;
        platforms.forEach(plat => {
            if (this.checkCollision(plat)) {
                if (this.vx > 0) this.x = plat.x - this.w;
                else if (this.vx < 0) this.x = plat.x + plat.w;
            }
        });

        // Apply vertical movement
        let wasGrounded = this.grounded;
        this.grounded = false;
        this.y += this.vy * dt;
        platforms.forEach(plat => {
            if (this.checkCollision(plat)) {
                if (this.vy > 0) {
                    this.y = plat.y - this.h;
                    this.vy = 0;
                    this.grounded = true;
                    if (!wasGrounded) { this.scaleY = 0.6; this.scaleX = 1.4; }
                } else if (this.vy < 0) {
                    this.y = plat.y + plat.h;
                    this.vy = 0;
                }
            }
        });

        this.scaleX += (1 - this.scaleX) * 0.2 * dt;
        this.scaleY += (1 - this.scaleY) * 0.2 * dt;
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (keys.z && this.attackCooldown <= 0) this.attack();

        if (this.x < 0) this.x = 0;
        if (this.x + this.w > canvas.width) this.x = canvas.width - this.w;
        if (this.y > canvas.height) this.takeDamage(100);
    }
    draw() {
        drawHealthBar(this.x, this.y - 10, this.w, this.health, this.maxHealth);
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h);
        ctx.scale(this.scaleX, this.scaleY);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-this.w / 2, -this.h, this.w, this.h, 8);
        ctx.fill();
        ctx.fillStyle = "#555";
        const eyeOffset = this.facingRight ? 5 : -5;
        ctx.beginPath();
        ctx.arc(eyeOffset, -this.h * 0.7, 2, 0, Math.PI * 2);
        ctx.arc(eyeOffset + (this.facingRight ? 8 : -8), -this.h * 0.7, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    checkCollision(rect) {
        return (this.x < rect.x + rect.w && this.x + this.w > rect.x &&
                this.y < rect.y + rect.h && this.y + this.h > rect.y);
    }
    attack() {
        this.attackCooldown = 20;
        const projSpeed = this.facingRight ? 8 : -8;
        projectiles.push(new Projectile(this.x + (this.facingRight ? this.w : 0), this.y + 15, projSpeed, true));
    }
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) endGame(false);
    }
}

class Projectile extends Entity {
    constructor(x, y, vx, isPlayer) {
        super(x, y, 12, 12, isPlayer ? COLORS.PROJECTILE : '#333');
        this.vx = vx; this.isPlayer = isPlayer; this.life = 60; 
    }
    update(dt) { super.update(dt); this.life -= dt; if (this.life <= 0) this.markedForDeletion = true; }
}

class Enemy extends Entity {
    constructor(x, y, range) {
        super(x, y, 30, 30, COLORS.ENEMY); 
        this.startX = x; this.range = range; this.dir = 1; this.speed = 2; this.health = 20;
    }
    update(dt) {
        this.vx = this.speed * this.dir;
        super.update(dt);
        if (this.x > this.startX + this.range) this.dir = -1;
        if (this.x < this.startX) this.dir = 1;
        this.vy += GRAVITY * dt; 
        platforms.forEach(plat => {
            if (this.y + this.h <= plat.y + 10 && this.y + this.h + (this.vy * dt) >= plat.y) {
                 this.vy = 0; this.y = plat.y - this.h;
            }
        });
        if (player.checkCollision(this)) {
            player.takeDamage(1); player.vx = (player.x < this.x) ? -10 : 10;
        }
    }
    takeDamage(amount) { this.health -= amount; if (this.health <= 0) this.markedForDeletion = true; }
}

class Boss extends Entity {
    constructor(x, y, type, minX, maxX) {
        super(x, y, 60, 60, type === 1 ? COLORS.BOSS1 : COLORS.BOSS2);
        this.type = type; 
        this.maxHealth = type === 1 ? 100 : 80; 
        this.health = this.maxHealth; this.timer = 0; this.phase = 0;
        this.minX = minX; this.maxX = maxX;
    }
    update(dt) {
        this.timer += dt; this.vy += GRAVITY * dt;
        platforms.forEach(plat => {
            if (this.x < plat.x + plat.w && this.x + this.w > plat.x &&
                this.y + this.h <= plat.y + 15 && this.y + this.h + (this.vy * dt) >= plat.y) {
                 this.vy = 0; this.y = plat.y - this.h;
                 if (this.type === 2 && this.phase === 1) { this.vx = 0; this.phase = 0; this.timer = 0; }
            }
        });
        super.update(dt);
        if (this.x < 0) { this.x = 0; this.vx = 0; }
        if (this.x + this.w > 800) { this.x = 800 - this.w; this.vx = 0; }
        if (player.checkCollision(this)) player.takeDamage(2);
        if (this.type === 1) this.boss1AI(dt); else this.boss2AI(dt); 
    }
    draw() {
        super.draw();
        drawHealthBar(this.x, this.y - 15, this.w, this.health, this.maxHealth);
    }
    boss1AI(dt) {
        if (Math.floor(this.timer) % 120 === 0) {
            const dir = player.x < this.x ? -1 : 1;
            projectiles.push(new Projectile(this.x + 30, this.y + 30, dir * 7, false));
            this.timer += 1; // Prevent multiple shots in one tick
        }
        let moveDir = player.x < this.x ? -1 : 1;
        if ((moveDir === -1 && this.x <= this.minX) || (moveDir === 1 && (this.x + this.w) >= this.maxX)) moveDir = 0;
        this.vx = moveDir;
    }
    boss2AI(dt) {
        if (this.phase === 0 && this.timer > 60) {
            this.phase = 1; this.vy = -18; 
            let jumpSpeed = (player.x - this.x) / 40; 
            this.vx = Math.max(-8, Math.min(8, jumpSpeed));
            this.timer = 0;
        } 
    }
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) { 
            this.markedForDeletion = true; 
            createSparkles(this.x + this.w/2, this.y + this.h/2, 30, COLORS.SPARKLE);
            spawnDoor(); 
        }
    }
}

let player, platforms, enemies, projectiles, boss, door;

function loadLevel(levelNum) {
    platforms = []; enemies = []; projectiles = []; particles = []; boss = null; door = null; currentLevel = levelNum;
    platforms.push({x: 0, y: 550, w: 800, h: 50});
    if (levelNum === 1) {
        platforms.push({x: 100, y: 450, w: 100, h: 20}, {x: 250, y: 350, w: 100, h: 20});
        let topX = 350, topY = 250, topW = 400;
        platforms.push({x: topX, y: topY, w: topW, h: 20});
        enemies.push(new Enemy(100, 420, 80), new Enemy(250, 320, 80));
        boss = new Boss(600, 190, 1, topX, topX + topW); 
    } else {
        platforms.push({x: 50, y: 450, w: 100, h: 20}, {x: 650, y: 450, w: 100, h: 20}); 
        platforms.push({x: 150, y: 350, w: 100, h: 20}, {x: 550, y: 350, w: 100, h: 20});
        let topX = 225, topY = 250, topW = 350;
        platforms.push({x: topX, y: topY, w: topW, h: 20}); 
        enemies.push(new Enemy(150, 320, 80), new Enemy(550, 320, 80));
        boss = new Boss(400, 190, 2, topX, topX + topW);
    }
    player = new Player();
    peekTimer = 0; peekState = PEEK_STATE.SAFE;
}

function spawnDoor() {
    door = {x: 720, y: 170, w: 50, h: 80, color: COLORS.DOOR};
    if (currentLevel === 2) door.x = 375;
}

function updatePeekMechanic(dt) {
    peekTimer += dt;
    const w = document.getElementById('peek-warning');
    const a = document.getElementById('peek-active');
    const music = document.getElementById('bgMusic');
    
    if (peekState === PEEK_STATE.SAFE) {
        if(music) music.volume = .3;
        if (w) w.style.display = 'none'; 
        if (a) a.style.display = 'none';
        if (peekTimer > nextPeekTime) { peekState = PEEK_STATE.WARNING; peekTimer = 0; }
    } else if (peekState === PEEK_STATE.WARNING) {
        if (w) w.style.display = 'block';
        if (peekTimer > 120) { peekState = PEEK_STATE.PEEKING; peekTimer = 0; }
    } else {
        if(music) music.volume = .1;
        if (a) a.style.display = 'block'; 
        if (w) w.style.display = 'none';
        const isMoving = Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1;
        const isShooting = keys.z;
        if (isMoving || isShooting) { player.takeDamage(100); } 
        if (peekTimer > 180) { 
            peekState = PEEK_STATE.SAFE; peekTimer = 0; 
            nextPeekTime = Math.random() * 300 + 300; 
        }
    }
}

function update(time) {
    if (!gameRunning) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    // Cap deltaTime to prevent huge jumps if tab is hidden
    const dt = Math.min(deltaTime / (1000 / TARGET_FPS), 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updatePeekMechanic(dt);
    
    ctx.fillStyle = COLORS.PLATFORM;
    platforms.forEach(p => { ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 4); ctx.fill(); });
    
    if (door) {
        ctx.fillStyle = door.color;
        ctx.beginPath(); ctx.roundRect(door.x, door.y, door.w, door.h, 10); ctx.fill();
        if (player.checkCollision(door)) { if (currentLevel === 1) loadLevel(2); else endGame(true); }
    }
    
    player.update(platforms, dt); 
    player.draw();
    
    enemies.forEach(e => { e.update(dt); e.draw(); });
    enemies = enemies.filter(e => !e.markedForDeletion);
    
    if (boss && !boss.markedForDeletion) { boss.update(dt); boss.draw(); }
    
    particles.forEach((p, i) => { p.update(dt); p.draw(); if (p.alpha <= 0) particles.splice(i, 1); });
    
    projectiles.forEach(p => {
        p.update(dt); p.draw();
        if (p.isPlayer) {
            enemies.forEach(e => { if (player.checkCollision.call(p, e)) { e.takeDamage(10); p.markedForDeletion = true; }});
            if (boss && !boss.markedForDeletion && player.checkCollision.call(p, boss)) { boss.takeDamage(5); p.markedForDeletion = true; }
        } else if (player.checkCollision.call(p, player)) { player.takeDamage(10); p.markedForDeletion = true; }
    });
    projectiles = projectiles.filter(p => !p.markedForDeletion);
    
    requestAnimationFrame(update);
}

function startGame() {
    const music = document.getElementById('bgMusic');
    if(music) { music.volume = 0.3; music.play().catch(e => console.log("Audio play blocked")); }
    document.getElementById('start-screen').style.display = 'none';
    gameRunning = true; 
    loadLevel(1); 
    lastTime = performance.now();
    requestAnimationFrame(update);
}
function restartLevel() { 
    document.getElementById('game-over-screen').style.display = 'none'; 
    gameRunning = true; loadLevel(currentLevel); 
    lastTime = performance.now();
    requestAnimationFrame(update); 
}
function fullRestart() { 
    document.getElementById('game-over-screen').style.display = 'none'; 
    document.getElementById('victory-screen').style.display = 'none'; 
    gameRunning = true; loadLevel(1); 
    lastTime = performance.now();
    requestAnimationFrame(update); 
}
function endGame(victory) { gameRunning = false; document.getElementById(victory ? 'victory-screen' : 'game-over-screen').style.display = 'flex'; }

window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

let isMuted = false;
function toggleMute() {
    const music = document.getElementById('bgMusic');
    const btn = document.getElementById('mute-btn');
    isMuted = !isMuted;
    if(music) music.muted = isMuted;
    btn.innerText = isMuted ? "🔈" : "🔊";
}
