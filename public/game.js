// Game Controller & 3D Raycaster Engine for Liminal Space Shooter (Enhanced Version)

// ================= CONSTANTS & GAME DATA =================
const MAP_WIDTH = 48;
const MAP_HEIGHT = 48;
const MAP = [];

function generateLiminalNeighborhoodMap() {
    // Create empty outdoor map
    for (let y = 0; y < MAP_HEIGHT; y++) {
        MAP[y] = [];

        for (let x = 0; x < MAP_WIDTH; x++) {

            // Outer border fence
            if (
                x === 0 ||
                y === 0 ||
                x === MAP_WIDTH - 1 ||
                y === MAP_HEIGHT - 1
            ) {
                MAP[y][x] = 3;
            } else {
                MAP[y][x] = 0;
            }
        }
    }

    function fillRect(x1, y1, x2, y2, type) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (
                    x > 0 &&
                    y > 0 &&
                    x < MAP_WIDTH - 1 &&
                    y < MAP_HEIGHT - 1
                ) {
                    MAP[y][x] = type;
                }
            }
        }
    }

    // =========================
    // PINK HOUSES
    // =========================

    fillRect(4, 4, 9, 9, 1);
    fillRect(15, 5, 21, 10, 1);
    fillRect(30, 4, 37, 10, 1);
    fillRect(39, 15, 45, 22, 1);

    fillRect(5, 30, 12, 38, 1);
    fillRect(20, 28, 28, 36, 1);
    fillRect(35, 33, 43, 42, 1);

    // =========================
    // TREE CLUSTERS
    // =========================

    fillRect(12, 14, 13, 15, 2);
    fillRect(16, 20, 17, 21, 2);
    fillRect(25, 15, 26, 16, 2);
    fillRect(33, 18, 34, 19, 2);

    fillRect(10, 42, 11, 43, 2);
    fillRect(18, 40, 19, 41, 2);
    fillRect(30, 40, 31, 41, 2);
    fillRect(44, 40, 45, 41, 2);

    // =========================
    // PARK AREA
    // =========================

    fillRect(20, 18, 28, 24, 0);

    // =========================
    // MAIN ROADS
    // =========================

    for (let x = 1; x < MAP_WIDTH - 1; x++) {
        MAP[24][x] = 0;
        MAP[25][x] = 0;
    }

    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        MAP[y][23] = 0;
        MAP[y][24] = 0;
    }

    // =========================
    // EXTRA OPEN FIELDS
    // =========================

    for (let y = 10; y < 20; y++) {
        for (let x = 10; x < 18; x++) {
            MAP[y][x] = 0;
        }
    }

    for (let y = 28; y < 40; y++) {
        for (let x = 28; x < 35; x++) {
            MAP[y][x] = 0;
        }
    }
}

const REWARDS = [100, 150, 200, 250, 300, 350, 500];

// Raycaster Resolution: scaled down to 320x240 for maximum performance + retro look
const RENDER_WIDTH = 320;
const RENDER_HEIGHT = 240;

// ================= AUDIO MANAGEMENT (Web Audio API) =================
class SoundManager {
    constructor() {
        this.ctx = null;
        this.humOsc = null;
        this.humGain = null;
        this.isSfxEnabled = true;
        this.isHumEnabled = true;
    }

    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
    }

    playShoot() {
        if (!this.isSfxEnabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const duration = 0.2;

        // Gunshot pitch drop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + duration);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        // Noise buffer for blast texture
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(900, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.25, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        noise.start(now);
        osc.stop(now + duration);
        noise.stop(now + duration);
    }

    playHit() {
        if (!this.isSfxEnabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const duration = 0.08;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(45, now + duration);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    playPlayerHit() {
        if (!this.isSfxEnabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const duration = 0.22;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(20, now + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    playDeath() {
        if (!this.isSfxEnabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const duration = 0.45;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(110, now);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    startHum() {
        if (!this.isHumEnabled) return;
        this.init();
        if (this.humOsc) return;

        try {
            const now = this.ctx.currentTime;
            this.humOsc = this.ctx.createOscillator();
            this.humGain = this.ctx.createGain();

            this.humOsc.type = 'sawtooth';
            this.humOsc.frequency.setValueAtTime(60, now); // Low industrial hum

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, now);

            // Subtle hum volume modulator LFO
            const lfo = this.ctx.createOscillator();
            lfo.frequency.setValueAtTime(0.6, now);
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.setValueAtTime(0.012, now);

            lfo.connect(lfoGain);
            lfoGain.connect(this.humGain.gain);

            this.humOsc.connect(filter);
            filter.connect(this.humGain);
            this.humGain.connect(this.ctx.destination);

            this.humGain.gain.setValueAtTime(0.02, now); // Very quiet, background

            lfo.start(now);
            this.humOsc.start(now);
        } catch (e) {
            console.warn("Fluorescent hum fail to start: ", e);
        }
    }

    stopHum() {
        if (this.humOsc) {
            try {
                this.humOsc.stop();
            } catch (e) { }
            this.humOsc = null;
            this.humGain = null;
        }
    }

    updateSettings(sfx, hum) {
        this.isSfxEnabled = sfx;
        this.isHumEnabled = hum;
        if (!this.isHumEnabled) {
            this.stopHum();
        } else if (this.ctx && this.ctx.state !== 'suspended') {
            this.startHum();
        }
    }
}

const sounds = new SoundManager();

// ================= PROCEDURAL GRAPHICS GENERATION =================
const textureCanvases = [];
const enemyIdleCanvas = document.createElement('canvas');
const enemyShootCanvas = document.createElement('canvas');
const enemyDeadCanvas = document.createElement('canvas');
const gunIdleCanvas = document.createElement('canvas');
const gunShootCanvas = document.createElement('canvas');

function initProceduralAssets() {
    // 1. Textures (64x64)
    for (let id = 1; id <= 3; id++) {
        const tCanvas = document.createElement('canvas');
        tCanvas.width = 64;
        tCanvas.height = 64;
        const ctx = tCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        if (id === 1) {
            // Texture 1: Pink siding wall with windows
            ctx.fillStyle = '#ffb3ba'; // base pink siding
            ctx.fillRect(0, 0, 64, 64);
            // Siding horizontal lines
            ctx.fillStyle = '#e59da6';
            for (let ry = 0; ry < 64; ry += 8) {
                ctx.fillRect(0, ry, 64, 1);
            }
            // Window details in some tiles
            ctx.fillStyle = '#ffffff'; // Window frame
            ctx.fillRect(20, 16, 24, 24);
            ctx.fillStyle = '#99ccff'; // Glass pane
            ctx.fillRect(22, 18, 20, 20);
            ctx.fillStyle = '#ffffff'; // Pane dividers
            ctx.fillRect(31, 18, 2, 20);
            ctx.fillRect(22, 27, 20, 2);
        } else if (id === 2) {
            // Texture 2: Creepy trees / foliage / leaves
            ctx.fillStyle = '#1e2f1f'; // dark forest green base
            ctx.fillRect(0, 0, 64, 64);
            // Foliage spots
            ctx.fillStyle = '#335c36';
            for (let i = 0; i < 40; i++) {
                let rx = Math.floor(Math.random() * 56);
                let ry = Math.floor(Math.random() * 56);
                ctx.fillRect(rx, ry, 8, 8);
            }
            // Branches/twigs
            ctx.fillStyle = '#3a281e';
            for (let i = 0; i < 8; i++) {
                let rx = Math.floor(Math.random() * 60);
                ctx.fillRect(rx, 0, 2, 64);
                ctx.fillRect(0, rx, 64, 2);
            }
        } else if (id === 3) {
            // Texture 3: White wooden fence
            ctx.fillStyle = '#3c3e42'; // dark grey shadow gap background
            ctx.fillRect(0, 0, 64, 64);
            // Fence posts
            ctx.fillStyle = '#f7f5f0'; // off-white
            for (let rx = 2; rx < 64; rx += 16) {
                ctx.fillRect(rx, 0, 12, 64);
                // Draw a pointed top to each post
                ctx.fillStyle = '#3c3e42';
                ctx.beginPath();
                ctx.moveTo(rx, 0);
                ctx.lineTo(rx + 6, 8);
                ctx.lineTo(rx + 12, 0);
                ctx.fill();
                ctx.fillStyle = '#f7f5f0';
            }
            // Horizontal rails
            ctx.fillRect(0, 16, 64, 4);
            ctx.fillRect(0, 44, 64, 4);
        }
        textureCanvases[id] = tCanvas;
    }

    // 2. Enemy Sprite: Idle (Creepy humanoid in white dress, pale beige skin, wide disturbing red smile, black gun in hand)
    enemyIdleCanvas.width = 64;
    enemyIdleCanvas.height = 64;
    let ctx = enemyIdleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Head (Pale beige skin)
    ctx.fillStyle = '#f0ebd8';
    ctx.fillRect(24, 6, 16, 16);

    // Wide disturbing smile (blood red)
    ctx.fillStyle = '#b51212';
    ctx.fillRect(26, 16, 12, 3);
    ctx.fillRect(26, 14, 2, 2);
    ctx.fillRect(36, 14, 2, 2);

    // Disturbing hollow eyes
    ctx.fillStyle = '#111111';
    ctx.fillRect(28, 10, 3, 3);
    ctx.fillRect(33, 10, 3, 3);

    // Blood around mouth
    ctx.fillStyle = '#9c0c0c';
    ctx.fillRect(28, 18, 2, 3);
    ctx.fillRect(34, 18, 2, 2);

    // White dress body (with light grey folds/shadows)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, 22, 28, 26);
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(18, 46, 28, 2);
    ctx.fillRect(24, 22, 2, 24);
    ctx.fillRect(38, 22, 2, 24);

    // Long arms
    ctx.fillStyle = '#ffffff'; // White sleeves
    ctx.fillRect(13, 24, 5, 12);
    ctx.fillRect(46, 24, 5, 12);
    ctx.fillStyle = '#f0ebd8'; // Bare pale arms
    ctx.fillRect(13, 36, 5, 8);
    ctx.fillRect(46, 36, 5, 8);

    // Legs (Bare pale skin)
    ctx.fillStyle = '#f0ebd8';
    ctx.fillRect(21, 48, 7, 16);
    ctx.fillRect(36, 48, 7, 16);

    // Black Gun in hand
    ctx.fillStyle = '#222222';
    ctx.fillRect(46, 40, 8, 4);
    ctx.fillRect(46, 40, 3, 8);

    // 3. Enemy Sprite: Shooting (Humanoid in white dress, aiming and firing a black gun, muzzle flash)
    enemyShootCanvas.width = 64;
    enemyShootCanvas.height = 64;
    ctx = enemyShootCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Head (Pale skin, wide smile, blood)
    ctx.fillStyle = '#f0ebd8';
    ctx.fillRect(24, 6, 16, 16);
    ctx.fillStyle = '#b51212';
    ctx.fillRect(26, 16, 12, 3);
    ctx.fillRect(26, 14, 2, 2);
    ctx.fillRect(36, 14, 2, 2);
    ctx.fillStyle = '#111111';
    ctx.fillRect(28, 10, 3, 3);
    ctx.fillRect(33, 10, 3, 3);
    ctx.fillStyle = '#9c0c0c';
    ctx.fillRect(28, 18, 2, 3);

    // White dress
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, 22, 28, 26);
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(24, 22, 2, 24);

    // Left arm down, right arm raised straight forward aiming gun
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(13, 24, 5, 12); // left sleeve
    ctx.fillRect(46, 22, 12, 5);  // right sleeve
    ctx.fillStyle = '#f0ebd8';
    ctx.fillRect(13, 36, 5, 8);   // left bare arm
    ctx.fillRect(58, 22, 6, 5);    // right bare hand

    // Legs
    ctx.fillStyle = '#f0ebd8';
    ctx.fillRect(21, 48, 7, 16);
    ctx.fillRect(36, 48, 7, 16);

    // Black Gun pointing forward
    ctx.fillStyle = '#222222';
    ctx.fillRect(60, 19, 8, 4); // barrel
    ctx.fillRect(60, 21, 3, 6); // grip

    // Muzzle Flash
    ctx.fillStyle = '#ffff66';
    ctx.beginPath(); ctx.arc(68, 21, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(68, 21, 3, 0, Math.PI * 2); ctx.fill();

    // 4. Enemy Sprite: Dead (Collapsed figure in white dress, pool of blood, dropped gun)
    enemyDeadCanvas.width = 64;
    enemyDeadCanvas.height = 64;
    ctx = enemyDeadCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Blood puddle
    ctx.fillStyle = '#941b1b';
    ctx.fillRect(14, 50, 36, 14);
    ctx.fillStyle = '#b51212';
    ctx.fillRect(20, 52, 24, 10);

    // Dead body parts
    ctx.fillStyle = '#f0ebd8'; // Head lying flat
    ctx.fillRect(8, 52, 10, 10);
    ctx.fillStyle = '#ffffff'; // White dress flat on floor
    ctx.fillRect(18, 54, 22, 10);
    ctx.fillStyle = '#f0ebd8'; // Disjointed pale limbs
    ctx.fillRect(12, 58, 12, 4);

    // Dropped black gun
    ctx.fillStyle = '#222222';
    ctx.fillRect(42, 57, 8, 3);

    // 5. Player Weapon: Idle Handgun (120x120)
    gunIdleCanvas.width = 120;
    gunIdleCanvas.height = 120;
    ctx = gunIdleCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // Arm/Sleeve
    ctx.fillStyle = '#1c1b18';
    ctx.fillRect(46, 70, 36, 50);
    // Hand
    ctx.fillStyle = '#d19d71';
    ctx.fillRect(48, 54, 28, 20);
    ctx.fillStyle = '#af7f56';
    ctx.fillRect(48, 64, 28, 10);
    // Metal Pistol
    ctx.fillStyle = '#393c3e';
    ctx.fillRect(56, 22, 14, 38); // Slider
    ctx.fillStyle = '#1c1d1e';
    ctx.fillRect(56, 22, 4, 38);
    ctx.fillStyle = '#111'; // Muzzle
    ctx.fillRect(60, 18, 6, 4);
    ctx.fillStyle = '#151515'; // Grip
    ctx.fillRect(52, 46, 10, 20);

    // 6. Player Weapon: Firing Handgun (120x120)
    gunShootCanvas.width = 120;
    gunShootCanvas.height = 120;
    ctx = gunShootCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // Arm/Sleeve (recoiled up)
    ctx.fillStyle = '#1c1b18';
    ctx.fillRect(46, 60, 36, 60);
    // Hand
    ctx.fillStyle = '#d19d71';
    ctx.fillRect(48, 44, 28, 20);
    ctx.fillStyle = '#af7f56';
    ctx.fillRect(48, 54, 28, 10);
    // Pistol (raised and slightly rotated)
    ctx.fillStyle = '#393c3e';
    ctx.fillRect(56, 12, 14, 38);
    ctx.fillStyle = '#1c1d1e';
    ctx.fillRect(56, 12, 4, 38);
    ctx.fillStyle = '#111'; // Muzzle
    ctx.fillRect(60, 8, 6, 4);
    ctx.fillStyle = '#151515';
    ctx.fillRect(52, 36, 10, 20);
}

// ================= GAMEPLAY VARIABLES & STATES =================
let gameState = 'home'; // home, playing, paused, gameover
let player = {
    x: 24.5,
    y: 24.5,
    angle: 0.0,
    fov: Math.PI / 3,
    hp: 100,
    score: 0,
    kills: 0,
    shootCooldown: 0.0,
    shootAnimTimer: 0.0,
    bobTimer: 0.0,
    isMoving: false
};

// Expose player to global scope for debugging/console check
window.player = player;

let sprites = []; // Enemies & visual FX sprites
const zBuffer = new Float32Array(RENDER_WIDTH);
let nextSpawnTimer = 22.0; // Spawns an enemy every 22 seconds
let sensitivity = 5;

// ================= USER AGENT DETECTION =================
// Differentiate mobile vs desktop using user-agent instead of touchscreen points
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// ================= MOBILE VIRTUAL JOYSTICK & TOUCH STATE =================
let moveForward = 0.0;
let moveStrafe = 0.0;
let lookActiveTouchId = null;
let lookLastX = 0;

// ================= TIMERS & DOM ELEMENTS =================
let lastFrameTime = performance.now();
const DOM = {
    home: document.getElementById('home-screen'),
    game: document.getElementById('game-screen'),
    pause: document.getElementById('pause-overlay'),
    gameover: document.getElementById('game-over-screen'),
    dailyModal: document.getElementById('daily-modal'),
    leaderboardModal: document.getElementById('leaderboard-modal'),
    settingsModal: document.getElementById('settings-modal'),
    canvas: document.getElementById('game-canvas'),

    // Values
    hpText: document.getElementById('hud-hp-text'),
    hpBar: document.getElementById('hud-hp-bar'),
    scoreText: document.getElementById('hud-score-text'),
    killsText: document.getElementById('hud-kills-tracker'),
    usernameLabel: document.getElementById('home-username'),
    coinsLabel: document.getElementById('home-coins-badge'),
    dailyReadyDot: document.getElementById('daily-ready-dot'),

    // Game Over stats
    goScore: document.getElementById('go-score'),
    goKills: document.getElementById('go-kills'),
    goBest: document.getElementById('go-best'),

    // Settings fields
    settingsUser: document.getElementById('settings-username'),
    settingsSfx: document.getElementById('settings-sfx'),
    settingsHum: document.getElementById('settings-hum'),
    settingsSens: document.getElementById('settings-sensitivity'),
    sensVal: document.getElementById('sensitivity-val')
};

const canvasContext = DOM.canvas.getContext('2d');
DOM.canvas.width = RENDER_WIDTH;
DOM.canvas.height = RENDER_HEIGHT;

// ================= KEYBOARD CONTROLS (DESKTOP TESTING) =================
const keys = {};
let isSpaceHeld = false;

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        isSpaceHeld = true;
    }
    console.log('KEY DOWN:', e.code);

    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }

    if (e.code === 'Escape') {
        if (gameState === 'playing') {
            pauseGame();
        } else if (gameState === 'paused') {
            resumeGame();
        }
    }

    if (e.code === 'KeyR' && gameState === 'gameover') {
        startGame();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Space') {
        isSpaceHeld = false;
    }
});
// ================= INITIALIZATION & SETUP =================
window.addEventListener('load', () => {
    generateLiminalNeighborhoodMap();
    initProceduralAssets();
    initSaveState();
    bindUIEvents();
    bindTouchControls();
    bindPCControls();

    // Start background loops
    updateDailyCheckInUI();
    setInterval(updateDailyTimers, 1000);

    // Main execution loop
    requestAnimationFrame(gameLoop);

    // Debug log coordinate shifts every 200ms
    setInterval(() => {
        if (gameState === 'playing') {
            console.log(`PLAYER_COORD: x=${player.x.toFixed(3)}, y=${player.y.toFixed(3)}, angle=${player.angle.toFixed(3)}, isMoving=${player.isMoving}`);
        }
    }, 200);
});
function initSaveState() {
    if (!localStorage.getItem('backrooms_username')) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('backrooms_username', `Explorer_${randomNum}`);
    }
    if (!localStorage.getItem('backrooms_coins')) {
        localStorage.setItem('backrooms_coins', '0');
    }
    if (!localStorage.getItem('backrooms_streak')) {
        localStorage.setItem('backrooms_streak', '0');
    }
    if (!localStorage.getItem('backrooms_last_claim')) {
        localStorage.setItem('backrooms_last_claim', '0');
    }
    if (!localStorage.getItem('backrooms_sensitivity')) {
        localStorage.setItem('backrooms_sensitivity', '5');
    }
    if (!localStorage.getItem('backrooms_leaderboard')) {
        // Pre-populate leaderboard
        const initialScores = [
            { username: 'Async_Agent_0', score: 10500, kills: 105, date: '2026-06-10' },
            { username: 'Entity_06', score: 6200, kills: 62, date: '2026-06-11' },
            { username: 'Explorer_Alpha', score: 4100, kills: 41, date: '2026-06-11' },
            { username: 'No_Clip_Guy', score: 2500, kills: 25, date: '2026-06-12' },
            { username: 'System_Vessel', score: 900, kills: 9, date: '2026-06-12' }
        ];
        localStorage.setItem('backrooms_leaderboard', JSON.stringify(initialScores));
    }

    // Update local config variables from store
    DOM.usernameLabel.innerText = localStorage.getItem('backrooms_username');
    DOM.coinsLabel.innerText = `🪙 ${localStorage.getItem('backrooms_coins')}`;
    sensitivity = parseInt(localStorage.getItem('backrooms_sensitivity'));
}

// ================= UI BINDINGS & SCREENS HANDLING =================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(scr => scr.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function bindUIEvents() {
    // Menu Buttons
    document.getElementById('btn-play').addEventListener('click', () => {
        sounds.init();
        sounds.startHum();
        startGame();
    });

    // Modals show/hide
    document.getElementById('btn-daily').addEventListener('click', () => {
        updateDailyCheckInUI();
        DOM.dailyModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-daily').addEventListener('click', () => {
        DOM.dailyModal.classList.add('hidden');
    });

    document.getElementById('btn-leaderboard').addEventListener('click', () => {
        renderLeaderboardUI();
        DOM.leaderboardModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
        DOM.leaderboardModal.classList.add('hidden');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
        DOM.settingsUser.value = localStorage.getItem('backrooms_username');
        DOM.settingsSens.value = localStorage.getItem('backrooms_sensitivity');
        DOM.sensVal.innerText = DOM.settingsSens.value;
        DOM.settingsModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-settings').addEventListener('click', () => {
        DOM.settingsModal.classList.add('hidden');
    });

    // Save settings
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        let user = DOM.settingsUser.value.trim();
        if (user.length === 0) user = "Explorer_Unknown";
        localStorage.setItem('backrooms_username', user);
        DOM.usernameLabel.innerText = user;

        localStorage.setItem('backrooms_sensitivity', DOM.settingsSens.value);
        sensitivity = parseInt(DOM.settingsSens.value);

        sounds.updateSettings(DOM.settingsSfx.checked, DOM.settingsHum.checked);
        DOM.settingsModal.classList.add('hidden');
    });

    DOM.settingsSens.addEventListener('input', () => {
        DOM.sensVal.innerText = DOM.settingsSens.value;
    });

    // Claim check-in reward
    document.getElementById('btn-claim-daily').addEventListener('click', claimDailyReward);

    // Pause control
    document.getElementById('btn-pause-game').addEventListener('click', pauseGame);
    document.getElementById('btn-resume-game').addEventListener('click', resumeGame);
    document.getElementById('btn-pause-settings').addEventListener('click', () => {
        DOM.settingsUser.value = localStorage.getItem('backrooms_username');
        DOM.settingsSens.value = localStorage.getItem('backrooms_sensitivity');
        DOM.sensVal.innerText = DOM.settingsSens.value;
        DOM.settingsModal.classList.remove('hidden');
    });
    document.getElementById('btn-exit-menu').addEventListener('click', () => {
        sounds.stopHum();
        if (document.pointerLockElement === DOM.canvas) {
            document.exitPointerLock();
        }
        exitToMenu();
    });

    // Game Over buttons
    document.getElementById('btn-restart').addEventListener('click', () => {
        startGame();
    });
    document.getElementById('btn-return-menu').addEventListener('click', () => {
        sounds.stopHum();
        exitToMenu();
    });
}

// ================= DAILY CHECK-IN SYSTEM LOGIC =================
function updateDailyCheckInUI() {
    const lastClaim = parseInt(localStorage.getItem('backrooms_last_claim') || '0');
    let streak = parseInt(localStorage.getItem('backrooms_streak') || '0');
    const now = Date.now();
    const timeDiff = now - lastClaim;

    // If they missed more than 48 hours, reset streak.
    const isStreakBroken = lastClaim > 0 && timeDiff >= 48 * 60 * 60 * 1000;
    if (isStreakBroken) {
        streak = 0;
        localStorage.setItem('backrooms_streak', '0');
    }

    const canClaim = lastClaim === 0 || timeDiff >= 24 * 60 * 60 * 1000;

    // Red dot indicator on Home menu
    if (canClaim) {
        DOM.dailyReadyDot.classList.remove('hidden');
    } else {
        DOM.dailyReadyDot.classList.add('hidden');
    }

    // Update streak label
    document.getElementById('streak-count').innerText = `${streak} Days`;

    // Update grids
    const boxes = document.querySelectorAll('.day-box');
    boxes.forEach((box, index) => {
        box.classList.remove('claimed', 'current', 'locked');

        if (canClaim) {
            const targetIndex = streak % 7;
            if (index < targetIndex) {
                box.classList.add('claimed');
            } else if (index === targetIndex) {
                box.classList.add('current');
            } else {
                box.classList.add('locked');
            }
        } else {
            const lastClaimedIndex = (streak - 1 + 7) % 7;
            if (index <= lastClaimedIndex) {
                box.classList.add('claimed');
            } else {
                box.classList.add('locked');
            }
        }
    });

    const claimBtn = document.getElementById('btn-claim-daily');
    const timerDiv = document.getElementById('daily-timer');

    if (canClaim) {
        claimBtn.classList.remove('disabled');
        claimBtn.disabled = false;
        claimBtn.innerText = "CLAIM SURVIVAL COINS";
        timerDiv.classList.add('hidden');
    } else {
        claimBtn.classList.add('disabled');
        claimBtn.disabled = true;
        claimBtn.innerText = "ALREADY CLAIMED TODAY";
        timerDiv.classList.remove('hidden');
        updateCountdownTimer(lastClaim);
    }
}

function updateCountdownTimer(lastClaim) {
    const countdownVal = document.getElementById('countdown-val');
    const now = Date.now();
    const target = lastClaim + 24 * 60 * 60 * 1000;
    const diff = target - now;

    if (diff <= 0) {
        updateDailyCheckInUI();
        return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const hStr = hours.toString().padStart(2, '0');
    const mStr = minutes.toString().padStart(2, '0');
    const sStr = seconds.toString().padStart(2, '0');

    countdownVal.innerText = `${hStr}:${mStr}:${sStr}`;
}

function updateDailyTimers() {
    if (!DOM.dailyModal.classList.contains('hidden')) {
        const lastClaim = parseInt(localStorage.getItem('backrooms_last_claim') || '0');
        const now = Date.now();
        if (now - lastClaim < 24 * 60 * 60 * 1000) {
            updateCountdownTimer(lastClaim);
        }
    }
}

function claimDailyReward() {
    const lastClaim = parseInt(localStorage.getItem('backrooms_last_claim') || '0');
    const now = Date.now();
    const timeDiff = now - lastClaim;
    const canClaim = lastClaim === 0 || timeDiff >= 24 * 60 * 60 * 1000;

    if (!canClaim) return;

    let streak = parseInt(localStorage.getItem('backrooms_streak') || '0');
    if (lastClaim > 0 && timeDiff >= 48 * 60 * 60 * 1000) {
        streak = 0;
    }

    const rewardDay = (streak % 7);
    const rewardCoins = REWARDS[rewardDay];

    // Add coins
    let coins = parseInt(localStorage.getItem('backrooms_coins') || '0');
    coins += rewardCoins;
    localStorage.setItem('backrooms_coins', coins.toString());

    // Update streak and time
    const newStreak = streak + 1;
    localStorage.setItem('backrooms_streak', newStreak.toString());
    localStorage.setItem('backrooms_last_claim', now.toString());

    updateDailyCheckInUI();
    DOM.coinsLabel.innerText = `🪙 ${coins}`;

    sounds.playHit();
}

// ================= LEADERBOARD LOGIC =================
function renderLeaderboardUI() {
    const list = JSON.parse(localStorage.getItem('backrooms_leaderboard') || '[]');
    list.sort((a, b) => b.score - a.score);

    const tbody = DOM.leaderboardBody;
    tbody.innerHTML = '';

    list.forEach((entry, i) => {
        const row = document.createElement('tr');
        if (entry.username === localStorage.getItem('backrooms_username')) {
            row.classList.add('highlight');
        }

        row.innerHTML = `
            <td class="rank-cell">#${i + 1}</td>
            <td>${escapeHTML(entry.username)}</td>
            <td style="color: var(--bg-yellow); font-weight: bold;">${entry.score}</td>
            <td style="color: var(--neon-green);">${entry.kills}</td>
            <td style="font-size: 0.8rem; opacity: 0.6;">${entry.date}</td>
        `;
        tbody.appendChild(row);
    });
}

function submitScoreToLeaderboard(score, kills) {
    const username = localStorage.getItem('backrooms_username') || 'Explorer';
    const list = JSON.parse(localStorage.getItem('backrooms_leaderboard') || '[]');

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    list.push({
        username: username,
        score: score,
        kills: kills,
        date: dateStr
    });

    list.sort((a, b) => b.score - a.score);
    if (list.length > 12) {
        list.length = 12;
    }

    localStorage.setItem('backrooms_leaderboard', JSON.stringify(list));
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ================= PC INPUT HANDLING (MOUSE LOOK & LOCK) =================
function bindPCControls() {
    // Canvas click requests mouse lock (Active on PC always)
    DOM.canvas.addEventListener('click', () => {
        if (gameState === 'playing' && document.pointerLockElement !== DOM.canvas) {
            DOM.canvas.requestPointerLock();
        }
    });

    // Handle cursor lock states
    document.addEventListener('pointerlockchange', () => {
        const hint = document.getElementById('pc-mouse-lock-hint');
        if (document.pointerLockElement === DOM.canvas) {
            hint.classList.add('hidden'); // Hide hint
        } else {
            if (!isMobile) {
                hint.classList.remove('hidden'); // Show hint again
            }
        }
    });

    // Capture infinite mouse look movement
    let lastMouseX = null;

    document.addEventListener('mousemove', (e) => {
        if (gameState !== 'playing') return;

        if (lastMouseX === null) {
            lastMouseX = e.clientX;
            return;
        }

        const dx = e.clientX - lastMouseX;
        lastMouseX = e.clientX;

        const sensFactor = sensitivity * 0.0016;
        player.angle += dx * sensFactor;

        while (player.angle < -Math.PI) player.angle += Math.PI * 2;
        while (player.angle > Math.PI) player.angle -= Math.PI * 2;
    });

    document.addEventListener('mouseleave', () => {
        lastMouseX = null;
    });

    // Shooting via Left-click on screen
    window.addEventListener('mousedown', (e) => {
        if (gameState === 'playing' && document.pointerLockElement === DOM.canvas && e.button === 0) {
            shootPlayerWeapon();
        }
    });
}

// ================= TOUCH INPUT & JOYSTICK DRAGGING (TOUCH + MOUSE SLIDE) =================
function bindTouchControls() {
    const joyZone = document.getElementById('joystick-zone');
    const joyBase = document.getElementById('joystick-base');
    const joyHandle = document.getElementById('joystick-handle');
    const fireBtn = document.getElementById('btn-fire-weapon');
    const gameScreen = DOM.game;

    let joyTouchId = null;
    let lookTouchId = null;
    let fireTouchId = null;

    let joyStartX = 0;
    let joyStartY = 0;
    const maxJoyRadius = 45;
    let lookLastX = 0;

    function updateJoystick(clientX, clientY) {
        let dx = clientX - joyStartX;
        let dy = clientY - joyStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxJoyRadius) {
            dx = (dx / dist) * maxJoyRadius;
            dy = (dy / dist) * maxJoyRadius;
        }
        joyHandle.style.transform = `translate(${dx}px, ${dy}px)`;
        moveForward = -dy / maxJoyRadius;
        moveStrafe = dx / maxJoyRadius;
    }

    gameScreen.addEventListener('touchstart', (e) => {
        e.preventDefault();

        const joyRect = joyZone.getBoundingClientRect();
        const fireRect = fireBtn.getBoundingClientRect();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const clientX = touch.clientX;
            const clientY = touch.clientY;

            const isFireTouch =
                clientX >= fireRect.left &&
                clientX <= fireRect.right &&
                clientY >= fireRect.top &&
                clientY <= fireRect.bottom;

            const isJoyTouch =
                clientX < window.innerWidth * 0.45 &&
                clientY > window.innerHeight * 0.45;

            if (isFireTouch && fireTouchId === null) {
                fireTouchId = touch.identifier;
                shootPlayerWeapon();
                continue;
            }

            if (isJoyTouch && joyTouchId === null) {
                joyTouchId = touch.identifier;
                sounds.init();
                updateJoystick(clientX, clientY);
                continue;
            }

            if (!isFireTouch && !isJoyTouch && lookTouchId === null) {
                lookTouchId = touch.identifier;
                lookLastX = clientX;
            }
        }
    }, { passive: false });

    gameScreen.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const clientX = touch.clientX;

            if (touch.identifier === joyTouchId) {
                updateJoystick(clientX, touch.clientY);
            } else if (touch.identifier === lookTouchId) {
                const dx = clientX - lookLastX;
                const sensFactor = sensitivity * 0.0016;
                player.angle += dx * sensFactor;

                while (player.angle < -Math.PI) player.angle += Math.PI * 2;
                while (player.angle > Math.PI) player.angle -= Math.PI * 2;

                lookLastX = clientX;
            }
        }
    }, { passive: false });

    function handleTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            if (touch.identifier === joyTouchId) {
                joyTouchId = null;
                joyHandle.style.transform = 'translate(0px, 0px)';
                moveForward = 0.0;
                moveStrafe = 0.0;
            } else if (touch.identifier === lookTouchId) {
                lookTouchId = null;
            } else if (touch.identifier === fireTouchId) {
                fireTouchId = null;
            }
        }
    }

    gameScreen.addEventListener('touchend', handleTouchEnd, { passive: false });
    gameScreen.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Fallbacks for mouse movement looking on desktop
    let isMouseDraggingLook = false;
    let lookLastMouseX = 0;

    gameScreen.addEventListener('mousedown', (e) => {
        if (isMobile) return;
        if (document.pointerLockElement === DOM.canvas) return;

        const isInsideJoy = joyZone.contains(e.target);
        const isPauseBtn = DOM.game.querySelector('.hud-pause').contains(e.target);
        const isFireBtn = (e.target.id === 'btn-fire-weapon');

        if (isInsideJoy || isPauseBtn || isFireBtn) return;

        isMouseDraggingLook = true;
        lookLastMouseX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
        if (isMouseDraggingLook && document.pointerLockElement !== DOM.canvas) {
            const dx = e.clientX - lookLastMouseX;
            const sensFactor = sensitivity * 0.0016;
            player.angle += dx * sensFactor;

            while (player.angle < -Math.PI) player.angle += Math.PI * 2;
            while (player.angle > Math.PI) player.angle -= Math.PI * 2;

            lookLastMouseX = e.clientX;
        }
    });

    window.addEventListener('mouseup', () => {
        isMouseDraggingLook = false;
    });

    document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// Show controls instructions adaptively (hide joystick on PC, show PC capture hint)
function initControlsDisplay() {
    const pcHint = document.getElementById('pc-mouse-lock-hint');
    const mobileControls = document.querySelector('.mobile-controls-layer');

    if (isMobile) {
        pcHint.classList.add('hidden');
        mobileControls.style.display = 'flex';
    } else {
        if (document.pointerLockElement === DOM.canvas) {
            pcHint.classList.add('hidden');
        } else {
            pcHint.classList.remove('hidden');
        }
        mobileControls.style.display = 'none'; // Hides joystick & fire buttons on PC completely
    }
}

// ================= GAME ENGINE LOOPS & RAYCASTER =================

function startGame() {
    // Spawn player in the wide carpeted offices Sector B
    player.x = 24.5;
    player.y = 24.5;
    player.angle = 0.0;
    player.hp = 100;
    player.score = 0;
    player.kills = 0;
    player.shootCooldown = 0.0;
    player.shootAnimTimer = 0.0;
    player.bobTimer = 0.0;
    player.isMoving = false;

    // Reset spawner and entities
    sprites = [];
    nextSpawnTimer = 6.5;

    // Spawn initial 8 enemies distributed
    for (let i = 0; i < 8; i++) {
        spawnEnemyDistributed();
    }

    DOM.home.classList.add('hidden');
    DOM.gameover.classList.add('hidden');
    DOM.pause.classList.add('hidden');
    DOM.game.classList.remove('hidden');

    gameState = 'playing';
    lastFrameTime = performance.now();

    // Setup instruction display
    initControlsDisplay();

    // Lock cursor automatically on PC when starting
    if (!isMobile) {
        DOM.canvas.requestPointerLock();
    }

    updateHUD();
}

function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    DOM.pause.classList.remove('hidden');
    sounds.stopHum();
}

function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    DOM.pause.classList.add('hidden');
    sounds.startHum();
    lastFrameTime = performance.now();
    initControlsDisplay();

    // Re-lock mouse lock on PC
    if (!isMobile && document.pointerLockElement !== DOM.canvas) {
        DOM.canvas.requestPointerLock();
    }
}

function exitToMenu() {
    gameState = 'home';
    DOM.game.classList.add('hidden');
    DOM.pause.classList.add('hidden');
    DOM.gameover.classList.add('hidden');
    DOM.home.classList.remove('hidden');
    updateDailyCheckInUI();
}

function triggerGameOver() {
    gameState = 'gameover';
    sounds.stopHum();
    sounds.playDeath();

    if (document.pointerLockElement === DOM.canvas) {
        document.exitPointerLock();
    }

    // Save high score checks
    const prevBest = parseInt(localStorage.getItem('backrooms_best_score') || '0');
    if (player.score > prevBest) {
        localStorage.setItem('backrooms_best_score', player.score.toString());
    }

    submitScoreToLeaderboard(player.score, player.kills);

    DOM.goScore.innerText = player.score;
    DOM.goKills.innerText = player.kills;
    DOM.goBest.innerText = localStorage.getItem('backrooms_best_score') || '0';

    DOM.game.classList.add('hidden');
    DOM.gameover.classList.remove('hidden');
}

function checkWallCollision(x, y) {
    const radius = 0.22; // Bounding cylinder
    const checkPts = [
        { x: x - radius, y: y - radius },
        { x: x + radius, y: y - radius },
        { x: x - radius, y: y + radius },
        { x: x + radius, y: y + radius }
    ];
    for (let p of checkPts) {
        let gx = Math.floor(p.x);
        let gy = Math.floor(p.y);
        if (gx < 0 || gx >= MAP_WIDTH || gy < 0 || gy >= MAP_HEIGHT) return true;
        if (MAP[gy][gx] > 0) return true;
    }
    return false;
}

// Spawns enemy sprites in random empty corridors distributed by quadrants
function spawnEnemyDistributed() {
    let attempts = 0;
    while (attempts < 100) {
        // Random cell in the map
        const rx = 1 + Math.floor(Math.random() * (MAP_WIDTH - 2));
        const ry = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2));

        if (MAP[ry][rx] === 0) {
            // Choose a randomized float position within this cell
            const sx = rx + 0.15 + Math.random() * 0.7;
            const sy = ry + 0.15 + Math.random() * 0.7;

            // Ensure not colliding with any walls
            if (!checkWallCollision(sx, sy)) {
                // Ensure medium distance from the player
                const distToPlayer = Math.sqrt((player.x - sx) ** 2 + (player.y - sy) ** 2);

                // Define limits based on attempt count to prevent deadlocks
                const minPlayerDist = (attempts < 70) ? 9.0 : 7.0;
                const maxPlayerDist = (attempts < 70) ? 26.0 : 32.0;

                if (distToPlayer >= minPlayerDist && distToPlayer <= maxPlayerDist) {
                    // Ensure minimum distance from other enemies
                    let tooCloseToOtherEnemy = false;
                    const minEnemyDist = (attempts < 60) ? 3.0 : ((attempts < 85) ? 1.5 : 1.0);

                    for (let s of sprites) {
                        if (s.type === 'enemy' && s.hp > 0) {
                            const distToEnemy = Math.sqrt((s.x - sx) ** 2 + (s.y - sy) ** 2);
                            if (distToEnemy < minEnemyDist) {
                                tooCloseToOtherEnemy = true;
                                break;
                            }
                        }
                    }

                    if (!tooCloseToOtherEnemy) {
                        sprites.push({
                            x: sx,
                            y: sy,
                            type: 'enemy',
                            hp: 20,
                            state: 'patrol',
                            patrolTimer: Math.random() * 2.0,
                            patrolDirAngle: Math.random() * Math.PI * 2,
                            shootCooldown: 1.0, // Initial 1.0s cooldown
                            animFrame: 'idle',
                            animTimer: 0.0,
                            hitFlashTimer: 0.0,
                            speed: 1.2
                        });
                        return true;
                    }
                }
            }
        }
        attempts++;
    }
    return false;
}

function shootPlayerWeapon() {
    if (gameState !== 'playing') return;
    if (player.shootCooldown > 0) return;

    sounds.playShoot();
    player.shootCooldown = 0.08;
    player.shootAnimTimer = 0.18;

    const bulletSpeed = 12;
    sprites.push({
        type: 'bullet',
        x: player.x + Math.cos(player.angle) * 0.6,
        y: player.y + Math.sin(player.angle) * 0.6,
        vx: Math.cos(player.angle) * bulletSpeed,
        vy: Math.sin(player.angle) * bulletSpeed,
        life: 1.5,
        damage: 10
    });
}

// Checks if line of sight is clear from A to B (DDA check)
function hasLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const steps = Math.ceil(distance * 3);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const checkX = x1 + dx * t;
        const checkY = y1 + dy * t;

        const gx = Math.floor(checkX);
        const gy = Math.floor(checkY);

        if (gx >= 0 && gx < MAP_WIDTH && gy >= 0 && gy < MAP_HEIGHT) {
            if (MAP[gy][gx] > 0) return false;
        }
    }
    return true;
}

function damagePlayer(amount) {
    player.hp = Math.max(0, player.hp - amount);
    sounds.playPlayerHit();

    const flash = document.getElementById('damage-flash');
    flash.style.opacity = '0.6';
    setTimeout(() => {
        flash.style.opacity = '0';
    }, 120);

    DOM.game.classList.add('screen-shake');
    setTimeout(() => {
        DOM.game.classList.remove('screen-shake');
    }, 150);

    updateHUD();

    if (player.hp <= 0) {
        triggerGameOver();
    }
}

function updateHUD() {
    DOM.hpText.innerText = `${player.hp} HP`;
    DOM.hpBar.style.width = `${player.hp}%`;
    DOM.scoreText.innerText = player.score.toString().padStart(6, '0');
    DOM.killsText.innerText = `KILLS: ${player.kills}`;
}

// ================= MAIN GAME LOOP =================

function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now = performance.now();
    let dt = (now - lastFrameTime) / 1000.0;
    lastFrameTime = now;

    if (gameState !== 'playing') return;
    if (dt > 0.1) dt = 0.1;

    updateGameLogic(dt);
    renderGame3D();
}

function updateGameLogic(dt) {
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.shootAnimTimer > 0) player.shootAnimTimer -= dt;

    if (isSpaceHeld) {
        console.log("HOLDING SPACE");
        shootPlayerWeapon();
    }

    // Inputs (Keyboard + Touch Joystick)
    let moveDirX = 0.0;
    let moveDirY = 0.0;

    // Keyboard WASD strafing & keyboard arrows mapping (supports e.code and lowercased e.key)
    if (keys['KeyW'] || keys['ArrowUp'] || keys['w'] || keys['arrowup']) moveDirY += 1.0;
    if (keys['KeyS'] || keys['ArrowDown'] || keys['s'] || keys['arrowdown']) moveDirY -= 1.0;
    if (keys['KeyA'] || keys['ArrowLeft'] || keys['a'] || keys['arrowleft']) moveDirX -= 1.0;  // Strafe Left
    if (keys['KeyD'] || keys['ArrowRight'] || keys['d'] || keys['arrowright']) moveDirX += 1.0; // Strafe Right
    if (keys['KeyQ']) player.angle -= 2.5 * dt;
    if (keys['KeyE']) player.angle += 2.5 * dt;

    const forwardVal = isMobile ? (moveDirY !== 0.0 ? moveDirY : moveForward) : moveDirY;
    const strafeVal = isMobile ? (moveDirX !== 0.0 ? moveDirX : moveStrafe) : moveDirX;

    // Movement angles
    const speed = 2.6; // player walking speed
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);

    // Orthogonal strafe vectors
    const strafeX = -dirY;
    const strafeY = dirX;

    const vx = (dirX * forwardVal + strafeX * strafeVal) * speed * dt;
    const vy = (dirY * forwardVal + strafeY * strafeVal) * speed * dt;

    player.isMoving = Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001;

    if (player.isMoving) {
        player.bobTimer += dt * 11;

        // Sliding physics colliders (check X and Y axes independently)
        let nextX = player.x + vx;
        let nextY = player.y + vy;

        if (!checkWallCollision(nextX, player.y)) {
            player.x = nextX;
        }
        if (!checkWallCollision(player.x, nextY)) {
            player.y = nextY;
        }
    } else {
        player.bobTimer = 0.0;
    }

    // Update temporary debug coordinates display in game screen
    const debugDiv = document.getElementById('hud-debug-coords');
    if (debugDiv) {
        let gx = Math.floor(player.x);
        let gy = Math.floor(player.y);
        let cellVal = (gx >= 0 && gx < MAP_WIDTH && gy >= 0 && gy < MAP_HEIGHT) ? MAP[gy][gx] : -1;
        debugDiv.innerText = `POS: X=${player.x.toFixed(2)}, Y=${player.y.toFixed(2)} | CELL=${cellVal}`;
    }

    // Distribute Spawning over quadrants gradually (exactly every 6.5 seconds)
    nextSpawnTimer -= dt;
    if (nextSpawnTimer <= 0) {
        nextSpawnTimer = 6.5;
        // Scale spawned enemy count over time based on kills
        const spawnCount = 1 + Math.floor(player.kills / 5);
        for (let i = 0; i < spawnCount; i++) {
            spawnEnemyDistributed();
        }
    }

    // Update Sprites (AI and Effects)
    const newSprites = [];
    sprites = sprites.filter(s => {
        if (s.type === 'spark') {
            s.timer -= dt;
            return s.timer > 0;
        }

        if (s.type === 'bullet') {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;

            // Check wall collision to remove bullet
            if (checkWallCollision(s.x, s.y)) {
                return false;
            }

            // Check hit against enemies
            let hitEnemy = false;
            sprites.forEach(e => {
                if (e.type === 'enemy' && e.hp > 0) {
                    const dist = Math.sqrt((e.x - s.x) ** 2 + (e.y - s.y) ** 2);
                    if (dist < 0.4) {
                        e.hp -= s.damage || 10;
                        e.hitFlashTimer = 0.12;
                        sounds.playHit();

                        // Spawn impact spark
                        newSprites.push({
                            x: e.x + (Math.random() - 0.5) * 0.2,
                            y: e.y + (Math.random() - 0.5) * 0.2,
                            type: 'spark',
                            timer: 0.15
                        });

                        if (e.hp <= 0) {
                            e.state = 'dead';
                            sounds.playDeath();
                            player.score += 150;
                            player.kills += 1;
                            updateHUD();
                        }

                        hitEnemy = true;
                    }
                }
            });

            if (hitEnemy) return false;

            return s.life > 0;
        }

        if (s.type === 'enemy_bullet') {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;

            // 1. Check hit against player FIRST (robust radius of 1.0)
            const dx = player.x - s.x;
            const dy = player.y - s.y;
            const hitRadius = 3.0;

            if ((dx * dx + dy * dy) < hitRadius * hitRadius) {
                console.log("ENEMY BULLET HIT PLAYER");
                damagePlayer(5);
                return false;
            }

            // 2. Check wall collision
            if (checkWallCollision(s.x, s.y)) {
                return false;
            }

            return s.life > 0;
        }

        if (s.type === 'enemy') {
            if (s.hp <= 0) {
                s.state = 'dead';
                return true;
            }

            if (s.hitFlashTimer > 0) s.hitFlashTimer -= dt;
            if (s.shootCooldown > 0) s.shootCooldown -= dt;

            const dx = player.x - s.x;
            const dy = player.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const canSee = dist < 12.0 && hasLineOfSight(s.x, s.y, player.x, player.y);

            if (canSee) {
                const chaseAngle = Math.atan2(dy, dx);

                if (s.state !== 'shoot') {
                    s.state = 'chase';
                    const step = 2.2 * dt; // Creepy balanced chase speed
                    const nextX = s.x + Math.cos(chaseAngle) * step;
                    const nextY = s.y + Math.sin(chaseAngle) * step;

                    if (!checkWallCollision(nextX, s.y)) s.x = nextX;
                    if (!checkWallCollision(s.x, nextY)) s.y = nextY;
                }

                // Ranged gun shooting attack (up to 8.0 units away, requiring strict line-of-sight)
                if (
                    dist < 8.0 &&
                    s.shootCooldown <= 0 &&
                    hasLineOfSight(s.x, s.y, player.x, player.y)
                ) {
                    s.shootCooldown = 4.0;
                    s.state = 'shoot';
                    s.animTimer = 0.3;
                    sounds.playShoot();

                    // Spawn visual enemy projectile
                    const bulletSpeed = 10.0;
                    const angleToPlayer = Math.atan2(player.y - s.y, player.x - s.x);
                    newSprites.push({
                        type: 'enemy_bullet',
                        x: s.x + Math.cos(angleToPlayer) * 0.4,
                        y: s.y + Math.sin(angleToPlayer) * 0.4,
                        vx: Math.cos(angleToPlayer) * bulletSpeed,
                        vy: Math.sin(angleToPlayer) * bulletSpeed,
                        life: 5.0,
                        damage: 5
                    });
                }
            } else {
                // Wandering Patrol State
                s.state = 'patrol';
                s.patrolTimer -= dt;
                if (s.patrolTimer <= 0) {
                    s.patrolTimer = 1.5 + Math.random() * 2.0;
                    s.patrolDirAngle = Math.random() * Math.PI * 2;
                }

                const step = (s.speed * 0.5) * dt;
                const nextX = s.x + Math.cos(s.patrolDirAngle) * step;
                const nextY = s.y + Math.sin(s.patrolDirAngle) * step;

                if (!checkWallCollision(nextX, s.y) && !checkWallCollision(s.x, nextY)) {
                    s.x = nextX;
                    s.y = nextY;
                } else {
                    s.patrolDirAngle = Math.random() * Math.PI * 2;
                }
            }

            if (s.state === 'shoot') {
                s.animTimer -= dt;
                if (s.animTimer <= 0) {
                    s.state = 'chase';
                }
            }
        }
        return true;
    });
    if (newSprites.length > 0) {
        sprites.push(...newSprites);
    }
}

// ================= 3D RAYCASTER RENDER ENGINE =================

function renderGame3D() {
    canvasContext.fillStyle = '#000';
    canvasContext.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
    sprites.forEach(s => {
        if (s.type === 'enemy') s.visibleToPlayer = false;
    });

    // Draw Ceiling (Linear Gradient - daylight sky with soft sunlight)
    const ceilGrad = canvasContext.createLinearGradient(0, 0, 0, RENDER_HEIGHT / 2);
    ceilGrad.addColorStop(0, '#94d0ff'); // Bright sky blue
    ceilGrad.addColorStop(1, '#ffe3d1'); // Soft pink-orange horizon glow
    canvasContext.fillStyle = ceilGrad;
    canvasContext.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT / 2);

    // Draw puffy white clouds on the sky
    canvasContext.fillStyle = 'rgba(255, 255, 255, 0.6)';
    // Cloud group 1
    canvasContext.beginPath();
    canvasContext.arc(50, 35, 12, 0, Math.PI * 2);
    canvasContext.arc(65, 30, 18, 0, Math.PI * 2);
    canvasContext.arc(80, 35, 12, 0, Math.PI * 2);
    canvasContext.fill();

    // Cloud group 2
    canvasContext.beginPath();
    canvasContext.arc(220, 45, 10, 0, Math.PI * 2);
    canvasContext.arc(235, 40, 15, 0, Math.PI * 2);
    canvasContext.arc(250, 45, 10, 0, Math.PI * 2);
    canvasContext.fill();

    // Draw Floor (Linear Gradient - lawn green grass)
    const floorGrad = canvasContext.createLinearGradient(0, RENDER_HEIGHT / 2, 0, RENDER_HEIGHT);
    floorGrad.addColorStop(0, '#2d5e20'); // Dark distant grass
    floorGrad.addColorStop(1, '#62b558'); // Bright grass near player
    canvasContext.fillStyle = floorGrad;
    canvasContext.fillRect(0, RENDER_HEIGHT / 2, RENDER_WIDTH, RENDER_HEIGHT / 2);

    // RAYCASTING LOOP
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);

    const planeX = -dirY * Math.tan(player.fov / 2);
    const planeY = dirX * Math.tan(player.fov / 2);

    for (let x = 0; x < RENDER_WIDTH; x++) {
        const cameraX = 2 * x / RENDER_WIDTH - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;

        let mapX = Math.floor(player.x);
        let mapY = Math.floor(player.y);

        let sideDistX, sideDistY;

        const deltaDistX = (rayDirX === 0) ? Infinity : Math.abs(1 / rayDirX);
        const deltaDistY = (rayDirY === 0) ? Infinity : Math.abs(1 / rayDirY);

        let stepX, stepY;
        let hit = 0;
        let side = 0;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (player.x - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - player.x) * deltaDistX;
        }

        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (player.y - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - player.y) * deltaDistY;
        }

        // Execute DDA
        while (hit === 0) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }

            if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
                break;
            }

            if (MAP[mapY][mapX] > 0) {
                hit = MAP[mapY][mapX];
            }
        }

        if (hit === 0) continue;

        let perpWallDist;
        if (side === 0) {
            perpWallDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX;
        } else {
            perpWallDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;
        }

        zBuffer[x] = perpWallDist;

        const wallHeight = Math.floor(RENDER_HEIGHT / perpWallDist);

        let drawStart = -wallHeight / 2 + RENDER_HEIGHT / 2;
        let drawEnd = wallHeight / 2 + RENDER_HEIGHT / 2;

        // TEXTURE MAPPING
        let wallX;
        if (side === 0) {
            wallX = player.y + perpWallDist * rayDirY;
        } else {
            wallX = player.x + perpWallDist * rayDirX;
        }
        wallX -= Math.floor(wallX);

        let texX = Math.floor(wallX * 64);
        if (side === 0 && rayDirX > 0) texX = 64 - texX - 1;
        if (side === 1 && rayDirY < 0) texX = 64 - texX - 1;

        const texCanvas = textureCanvases[hit] || textureCanvases[1];
        canvasContext.drawImage(
            texCanvas,
            texX, 0, 1, 64,
            x, drawStart, 1, drawEnd - drawStart
        );

        // SHADING & DEPTH FOG 
        let shadowColorMultiplier = (side === 1) ? 0.35 : 0.0;
        let fogDensity = Math.min(1.0, perpWallDist / 12.0);

        if (fogDensity > 0 || shadowColorMultiplier > 0) {
            canvasContext.fillStyle = `rgba(18, 17, 11, ${Math.max(shadowColorMultiplier, fogDensity)})`;
            canvasContext.fillRect(x, drawStart, 1, drawEnd - drawStart);
        }
    }

    // RENDER SPRITES (Enemies & VFX Sparks)
    const sortedSprites = sprites.map((s, index) => {
        const dx = player.x - s.x;
        const dy = player.y - s.y;
        return {
            ref: s,
            distSq: dx * dx + dy * dy
        };
    }).sort((a, b) => b.distSq - a.distSq);

    sortedSprites.forEach(item => {
        const s = item.ref;

        const spriteX = s.x - player.x;
        const spriteY = s.y - player.y;

        const invDet = 1.0 / (planeX * dirY - dirX * planeY);
        const transformX = invDet * (dirY * spriteX - dirX * spriteY);
        const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

        if (transformY <= 0.1) return;

        const spriteScreenX = Math.floor((RENDER_WIDTH / 2) * (1 + transformX / transformY));
        let spriteHeight = Math.abs(Math.floor(RENDER_HEIGHT / transformY));
        let spriteWidth = Math.abs(Math.floor(RENDER_HEIGHT / transformY));

        let drawStartY;
        if (s.type === 'enemy') {
            const wallHeight = spriteHeight;
            spriteHeight = Math.floor(wallHeight * 0.75);
            spriteWidth = Math.floor(wallHeight * 0.75);
            drawStartY = Math.floor(RENDER_HEIGHT / 2 + wallHeight / 2 - spriteHeight);
        } else {
            drawStartY = Math.floor(-spriteHeight / 2 + RENDER_HEIGHT / 2);
        }

        const drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);
        const drawEndX = Math.floor(spriteWidth / 2 + spriteScreenX);
        if (
            s.type === 'enemy' &&
            transformY > 0.1 &&
            transformY < 4.0 &&
            drawEndX >= 0 &&
            drawStartX < RENDER_WIDTH
        ) {
            s.visibleToPlayer = true;
        }

        let spriteCanvas;
        if (s.type === 'spark') {
            spriteCanvas = document.createElement('canvas');
            spriteCanvas.width = 32;
            spriteCanvas.height = 32;
            const sc = spriteCanvas.getContext('2d');
            sc.fillStyle = '#ffcc00';
            sc.beginPath(); sc.arc(16, 16, 6 + Math.random() * 4, 0, Math.PI * 2); sc.fill();
            sc.fillStyle = '#ffffff';
            sc.beginPath(); sc.arc(16, 16, 3, 0, Math.PI * 2); sc.fill();
        } else if (s.type === 'bullet' || s.type === 'enemy_bullet') {
            spriteCanvas = document.createElement('canvas');
            spriteCanvas.width = 16;
            spriteCanvas.height = 16;
            const sc = spriteCanvas.getContext('2d');
            sc.fillStyle = (s.type === 'enemy_bullet') ? '#ff3300' : '#ffcc00';
            sc.beginPath(); sc.arc(8, 8, 4, 0, Math.PI * 2); sc.fill();
            sc.fillStyle = '#ffffff';
            sc.beginPath(); sc.arc(8, 8, 1.5, 0, Math.PI * 2); sc.fill();
        } else {
            if (s.state === 'dead') {
                spriteCanvas = enemyDeadCanvas;
            } else if (s.state === 'shoot') {
                spriteCanvas = enemyShootCanvas;
            } else {
                spriteCanvas = enemyIdleCanvas;
            }
        }

        for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
            if (stripe >= 0 && stripe < RENDER_WIDTH) {
                if (transformY < zBuffer[stripe]) {
                    const texX = Math.floor((stripe - drawStartX) * spriteCanvas.width / spriteWidth);

                    canvasContext.drawImage(
                        spriteCanvas,
                        texX, 0, 1, spriteCanvas.height,
                        stripe, drawStartY, 1, spriteHeight
                    );

                    if (s.hitFlashTimer > 0) {
                        canvasContext.fillStyle = 'rgba(255, 30, 30, 0.55)';
                        canvasContext.fillRect(stripe, drawStartY, 1, spriteHeight);
                    } else {
                        const fogDensity = Math.min(1.0, transformY / 12.0);
                        if (fogDensity > 0) {
                            canvasContext.fillStyle = `rgba(18, 17, 11, ${fogDensity})`;
                            canvasContext.fillRect(stripe, drawStartY, 1, spriteHeight);
                        }
                    }
                }
            }
        }
    });

    // RENDER PLAYER HUD GUN (Bottom Center)
    const baseGunWidth = 140;
    const baseGunHeight = 140;

    let bobX = 0;
    let bobY = 0;
    if (player.isMoving) {
        bobX = Math.sin(player.bobTimer) * 7.5;
        bobY = Math.cos(player.bobTimer * 2) * 4.0;
    }

    const gunX = Math.floor((RENDER_WIDTH - baseGunWidth) / 2 + bobX);
    const gunY = Math.floor(RENDER_HEIGHT - baseGunHeight + 12 + bobY);

    const curGunCanvas = (player.shootAnimTimer > 0) ? gunShootCanvas : gunIdleCanvas;

    canvasContext.drawImage(
        curGunCanvas,
        0, 0, 120, 120,
        gunX, gunY, baseGunWidth, baseGunHeight
    );

    if (player.shootAnimTimer > 0) {
        const flashX = gunX + baseGunWidth * 0.52;
        const flashY = gunY + baseGunHeight * 0.12;

        canvasContext.fillStyle = '#ffaa33';
        canvasContext.beginPath();
        canvasContext.arc(flashX, flashY, 15 + Math.random() * 8, 0, Math.PI * 2);
        canvasContext.fill();

        canvasContext.fillStyle = '#ffffff';
        canvasContext.beginPath();
        canvasContext.arc(flashX, flashY, 7, 0, Math.PI * 2);
        canvasContext.fill();
    }
}

// Expose variables for blockchain integration
Object.defineProperty(window, 'gameState', {
    get: () => gameState,
    set: (val) => { gameState = val; }
});
Object.defineProperty(window, 'sprites', {
    get: () => sprites,
    set: (val) => { sprites = val; }
});
Object.defineProperty(window, 'nextSpawnTimer', {
    get: () => nextSpawnTimer,
    set: (val) => { nextSpawnTimer = val; }
});
window.player = player;
window.spawnEnemyDistributed = spawnEnemyDistributed;
window.updateHUD = updateHUD;
window.sounds = sounds;
window.DOM = DOM;
window.isMobile = isMobile;

