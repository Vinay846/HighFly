// Enhanced PixiJS Rocket Animation System - Complete Rewrite
class PixiRocketAnimationSystem {
    constructor() {
        // Core PixiJS components
        this.app = null;
        this.container = null;
        this.gameCanvas = null;
        
        // System ready flag
        this.isSystemReady = false;
        
        // Rocket components
        this.rocket = null;
        this.rocketTexture = null;
        
        // Star animation system
        this.starsContainer = null;
        this.stars = [];
        this.maxStars = 500;
        this.starUpdateCounter = 0;
        
        // Animation state
        this.isActive = false;
        this.animationPaused = false;
        this.tabVisible = true;
        this.isRocketVisible = false;
        this.isCrashing = false;
        
        // Position tracking
        this.currentPosition = { x: 0, y: 0 };
        this.targetPosition = { x: 0, y: 0 };
        this.startPosition = { x: 0, y: 0 };
        
        // Canvas dimensions
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        
        // Animation properties
        this.currentMultiplier = 1.0;
        this.animationSpeed = 0.1;
        this.crashAnimation = null;
        
        // Initialize the system
        this.initialize();
    }

    async initialize() {
        console.log('🚀 Initializing PixiJS Rocket Animation System...');
        
        // Find game canvas
        this.gameCanvas = document.getElementById('gameCanvas');
        if (!this.gameCanvas) {
            console.error('❌ Game canvas not found');
            return this.initializeFallback();
        }

        try {
            // Create PixiJS application
            await this.createPixiApp();
            
            // Setup containers and rocket
            this.setupContainers();
            await this.createRocket();
            
            // Setup animation loop
            this.setupAnimationLoop();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            console.log('✅ PixiJS Rocket Animation System initialized successfully');
            
            // Mark as ready immediately
            this.isSystemReady = true;
            
            return true;
            
        } catch (error) {
            console.error('❌ PixiJS initialization failed:', error);
            return this.initializeFallback();
        }
    }

    async createPixiApp() {
        // Update canvas dimensions first
        this.updateCanvasDimensions();
        
        // Create PixiJS application
        this.app = new PIXI.Application({
            width: this.canvasWidth,
            height: this.canvasHeight,
            backgroundColor: 0x000000,
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        // Add canvas to DOM
        this.app.view.style.position = 'absolute';
        this.app.view.style.top = '0';
        this.app.view.style.left = '0';
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
        this.app.view.style.pointerEvents = 'none';
        this.app.view.style.zIndex = '10';
        
        this.gameCanvas.appendChild(this.app.view);
        
        console.log('✅ PixiJS app created:', this.canvasWidth + 'x' + this.canvasHeight);
    }

    setupContainers() {
        // Main container
        this.container = new PIXI.Container();
        this.app.stage.addChild(this.container);
        
        // Stars container (background layer)
        this.starsContainer = new PIXI.Container();
        this.container.addChild(this.starsContainer);
        
        // Trail container removed - cleaner animation
        
        console.log('✅ Containers setup complete');
    }

    async createRocket() {
        try {
            // Try to load rocket texture
            if (PIXI.Assets && PIXI.Assets.load) {
                this.rocketTexture = await PIXI.Assets.load('./assets/images/fly.png');
            } else {
                this.rocketTexture = PIXI.Texture.from('./assets/images/fly.png');
                await new Promise((resolve) => {
                    if (this.rocketTexture.baseTexture.valid) {
                        resolve();
                    } else {
                        this.rocketTexture.baseTexture.on('loaded', resolve);
                    }
                });
            }
            
            console.log('✅ Rocket texture loaded');
            
        } catch (error) {
            console.warn('⚠️ Failed to load rocket texture, creating fallback');
            this.rocketTexture = this.createFallbackTexture();
        }

        // Create rocket sprite
        this.rocket = new PIXI.Sprite(this.rocketTexture);
        this.rocket.anchor.set(0.5, 0.5);
        this.rocket.scale.set(0.8);
        this.rocket.visible = false;
        
        // Add to main container (rocket should be on top)
        this.container.addChild(this.rocket);
        
        // Calculate start position
        this.calculateStartPosition();
        
        // Initialize star field
        this.createStarField();
        
        console.log('✅ Rocket sprite created at:', this.startPosition);
    }

    createFallbackTexture() {
        const graphics = new PIXI.Graphics();
        
        // Draw rocket body
        graphics.beginFill(0x00BFFF);
        graphics.drawRoundedRect(-15, -20, 30, 40, 5);
        graphics.endFill();
        
        // Draw rocket tip
        graphics.beginFill(0xFFFFFF);
        graphics.moveTo(0, -20);
        graphics.lineTo(-10, -30);
        graphics.lineTo(10, -30);
        graphics.closePath();
        graphics.endFill();
        
        // Draw fins
        graphics.beginFill(0xFF6B6B);
        graphics.moveTo(-15, 10);
        graphics.lineTo(-25, 20);
        graphics.lineTo(-15, 20);
        graphics.closePath();
        graphics.endFill();
        
        graphics.moveTo(15, 10);
        graphics.lineTo(25, 20);
        graphics.lineTo(15, 20);
        graphics.closePath();
        graphics.endFill();
        
        return this.app.renderer.generateTexture(graphics);
    }

    setupAnimationLoop() {
        this.app.ticker.add((delta) => {
            if (this.tabVisible) {
                this.updateAnimation(delta);
            }
        });
        
        console.log('✅ Animation loop setup complete');
    }

    setupEventHandlers() {
        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Tab visibility
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        window.addEventListener('blur', () => {
            this.tabVisible = false;
        });
        
        window.addEventListener('focus', () => {
            this.tabVisible = true;
        });
        
        console.log('✅ Event handlers setup complete');
    }

    handleResize() {
        this.updateCanvasDimensions();
        this.app.renderer.resize(this.canvasWidth, this.canvasHeight);
        this.calculateStartPosition();
        
        // Recreate star field for new dimensions (with error handling)
        if (this.starsContainer) {
            try {
                this.createStarField();
            } catch (e) {
                console.warn('⚠️ Could not recreate star field on resize:', e);
            }
        }
        
        if (this.isActive) {
            this.updatePosition(this.currentMultiplier);
        }
    }

    handleVisibilityChange() {
        this.tabVisible = !document.hidden;
        console.log('👁️ Tab visibility:', this.tabVisible);
    }

    updateCanvasDimensions() {
        if (this.gameCanvas) {
            const rect = this.gameCanvas.getBoundingClientRect();
            // Ensure minimum dimensions while handling all screen sizes
            this.canvasWidth = Math.max(Math.floor(rect.width) || 400, 300);
            this.canvasHeight = Math.max(Math.floor(rect.height) || 300, 200);
            
            // Handle very large dimensions (4K, 8K displays)
            this.canvasWidth = Math.min(this.canvasWidth, 7680); // 8K width limit
            this.canvasHeight = Math.min(this.canvasHeight, 4320); // 8K height limit
        } else {
            // Fallback dimensions
            this.canvasWidth = 800;
            this.canvasHeight = 600;
        }
    }

    calculateStartPosition() {
        // Adaptive margin based on screen size
        const marginRatio = Math.min(0.08, Math.max(0.03, 60 / Math.min(this.canvasWidth, this.canvasHeight)));
        const margin = Math.floor(marginRatio * Math.min(this.canvasWidth, this.canvasHeight));
        
        this.startPosition = {
            x: margin,
            y: this.canvasHeight - margin
        };
    }

    // Main animation update function
    updateAnimation(delta) {
        // Always update stars for ambient background
        this.updateStars(delta);
        
        // Only update rocket if it's active and visible
        if (this.isActive && this.rocket && this.isRocketVisible) {
            // Update rocket position smoothly
            this.smoothUpdatePosition(delta);
            
            // Trail particles removed for cleaner animation
        }
    }

    smoothUpdatePosition(delta) {
        if (this.isCrashing) return;

        const lerpSpeed = this.animationSpeed * delta;
        
        // Smoothly move to target position using linear interpolation
        this.currentPosition.x += (this.targetPosition.x - this.currentPosition.x) * lerpSpeed;
        this.currentPosition.y += (this.targetPosition.y - this.currentPosition.y) * lerpSpeed;
        
        // Update rocket sprite position
        this.rocket.x = this.currentPosition.x;
        this.rocket.y = this.currentPosition.y;
    }

    // updateTrail method removed for cleaner animation

    // createTrailParticle method removed for cleaner animation

    // Star Animation System
    createStarField() {
        if (!this.starsContainer) {
            console.warn('⚠️ Stars container not ready');
            return;
        }
        
        console.log('✨ Creating star field...');
        
        // Clear existing stars
        this.clearStars();
        
        // Calculate number of stars based on canvas size and aspect ratio
        const canvasArea = this.canvasWidth * this.canvasHeight;
        const baseDensity = canvasArea / 25000; // Adjusted density for better scaling
        const aspectRatio = this.canvasWidth / this.canvasHeight;
        const aspectMultiplier = Math.min(aspectRatio, 2.5); // Handle ultrawide displays
        const starDensity = baseDensity * aspectMultiplier;
        const numStars = Math.min(Math.max(Math.floor(starDensity), 10), this.maxStars);
        
        for (let i = 0; i < numStars; i++) {
            this.createStar();
        }
        
        console.log(`✨ Created ${numStars} stars`);
    }

    createStar() {
        if (!this.starsContainer) return;
        
        const star = new PIXI.Graphics();
        
        // Random star properties
        const size = 0.8 + Math.random() * 1.5; // Star size between 0.8 and 2.3
        const brightness = 0.4 + Math.random() * 0.6; // Alpha between 0.4 and 1.0
        
        // Star colors (white to light blue/yellow tints)
        const starColors = [
            0xFFFFFF, // Pure white
            0xF0F8FF, // Alice blue  
            0xFFFAF0, // Floral white
            0xF5F5DC, // Beige
        ];
        const color = starColors[Math.floor(Math.random() * starColors.length)];
        
        // Create simple circle instead of star shape for better compatibility
        star.beginFill(color, brightness);
        star.drawCircle(0, 0, size);
        star.endFill();
        
        // Position star in left-top area (spawning zone) - adaptive to dimensions
        const spawnMargin = Math.min(50, Math.max(30, this.canvasWidth * 0.05));
        const spawnWidthRatio = Math.min(0.5, Math.max(0.3, 800 / this.canvasWidth));
        const spawnHeightRatio = Math.min(0.5, Math.max(0.3, 600 / this.canvasHeight));
        
        star.x = -spawnMargin + Math.random() * (this.canvasWidth * spawnWidthRatio);
        star.y = -spawnMargin + Math.random() * (this.canvasHeight * spawnHeightRatio);
        
        // Movement properties
        star.baseSpeed = 0.4 + Math.random() * 0.8; // Base movement speed
        star.speedX = star.baseSpeed * (0.9 + Math.random() * 0.2); // Horizontal speed
        star.speedY = star.baseSpeed * (0.9 + Math.random() * 0.2); // Vertical speed
        
        // Twinkling properties
        star.twinkleSpeed = 0.008 + Math.random() * 0.012;
        star.twinklePhase = Math.random() * Math.PI * 2;
        star.baseBrightness = brightness;
        
        // Add subtle rotation (optional)
        star.rotationSpeed = (Math.random() - 0.5) * 0.005;
        
        // Add to container
        this.starsContainer.addChild(star);
        this.stars.push(star);
    }

    updateStars(delta) {
        if (!this.starsContainer || !this.stars) return;
        
        this.starUpdateCounter += delta;
        
        // Create new stars occasionally
        if (this.starUpdateCounter > 60 && this.stars.length < this.maxStars) { // Every ~60 frames
            this.createStar();
            this.starUpdateCounter = 0;
        }
        
        // Update existing stars
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const star = this.stars[i];
            
            if (!star || !star.parent) {
                // Remove broken star references
                this.stars.splice(i, 1);
                continue;
            }
            
            // Move star from left-top to right-bottom
            star.x += star.speedX * delta;
            star.y += star.speedY * delta;
            
            // Add subtle rotation if enabled
            if (star.rotationSpeed) {
                star.rotation += star.rotationSpeed * delta;
            }
            
            // Twinkling effect
            try {
                const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.twinklePhase) * 0.2;
                star.alpha = Math.max(0.2, Math.min(1.0, star.baseBrightness + twinkle));
            } catch (e) {
                // Fallback for twinkling
                star.alpha = star.baseBrightness;
            }
            
            // Remove stars that have moved off screen
            if (star.x > this.canvasWidth + 50 || star.y > this.canvasHeight + 50) {
                try {
                    this.starsContainer.removeChild(star);
                } catch (e) {
                    // Star already removed
                }
                this.stars.splice(i, 1);
            }
        }
    }

    clearStars() {
        if (!this.starsContainer || !this.stars) return;
        
        try {
            this.stars.forEach(star => {
                if (star && star.parent) {
                    this.starsContainer.removeChild(star);
                }
            });
        } catch (e) {
            console.warn('⚠️ Error clearing stars:', e);
        }
        
        this.stars = [];
    }

    // Enhanced start method with stars
    start(multiplier = 1.0) {
        if (this.fallbackSystem) {
            return this.fallbackSystem.start(multiplier);
        }
        
        if (!this.app || !this.rocket) {
            console.error('❌ Cannot start: PixiJS not ready');
            return false;
        }

        console.log('🚀 Starting rocket animation at', multiplier + 'x');
        
        this.isActive = true;
        this.isCrashing = false;
        this.currentMultiplier = multiplier;
        
        // Position rocket at start
        this.currentPosition = { ...this.startPosition };
        this.targetPosition = { ...this.startPosition };
        
        // Show rocket
        this.rocket.visible = true;
        this.isRocketVisible = true;
        this.rocket.x = this.startPosition.x;
        this.rocket.y = this.startPosition.y;
        this.rocket.alpha = 1;
        this.rocket.scale.set(0.8);
        this.rocket.rotation = 0;
        
        // Trail particles removed for cleaner animation
        
        // Ensure star field is active (but don't force if system isn't ready)
        if (this.starsContainer && this.stars.length < 5) {
            try {
                this.createStarField();
            } catch (e) {
                console.warn('⚠️ Could not create star field:', e);
            }
        }
        
        // Start ticker if needed
        if (!this.app.ticker.started) {
            this.app.ticker.start();
        }
        
        return true;
    }

    startFromMultiplier(multiplier) {
        if (this.fallbackSystem) {
            return this.fallbackSystem.startFromMultiplier(multiplier);
        }
        
        console.log('🚀 Starting from multiplier:', multiplier + 'x');
        
        // Start normally first
        if (!this.start(1.0)) return false;
        
        // Then update to target multiplier
        this.updatePosition(multiplier);
        
        return true;
    }

    updatePosition(multiplier) {
        if (this.fallbackSystem) {
            return this.fallbackSystem.updatePosition(multiplier);
        }
        
        if (!this.isActive || !this.rocket || this.isCrashing) {
            return;
        }
        
        this.currentMultiplier = multiplier;
        
        // Calculate progress (1.0x = 0%, 10.0x = 100% at canvas edge)
        const baseProgress = Math.min(Math.max((multiplier - 1.0) / 9.0, 0), 1);
        
        // Calculate target position - adaptive margins for different screen sizes
        const marginRatio = Math.min(0.08, Math.max(0.03, 60 / Math.min(this.canvasWidth, this.canvasHeight)));
        const margin = Math.floor(marginRatio * Math.min(this.canvasWidth, this.canvasHeight));
        const maxX = this.canvasWidth - margin;
        const maxY = margin;
        
        // Ensure rocket stays within canvas bounds
        let targetX = this.startPosition.x + (baseProgress * (maxX - this.startPosition.x));
        let targetY = this.startPosition.y - (baseProgress * (this.startPosition.y - maxY));
        
        // Clamp to canvas bounds with extra safety margin
        const safetyMargin = 20;
        targetX = Math.max(safetyMargin, Math.min(targetX, this.canvasWidth - safetyMargin));
        targetY = Math.max(safetyMargin, Math.min(targetY, this.canvasHeight - safetyMargin));
        
        // Handle high multipliers (>10x) - keep rocket at top-right position
        if (multiplier > 10.0) {
            // Keep rocket stable at top-right corner for high multipliers
            targetX = maxX;
            targetY = maxY;
        }
        
        this.targetPosition.x = targetX;
        this.targetPosition.y = targetY;
        
        // Update rotation based on movement
        if (baseProgress > 0) {
            // Standard diagonal flight rotation
            const angle = Math.atan2(maxY - this.startPosition.y, maxX - this.startPosition.x);
            this.rocket.rotation = angle + Math.PI / 4;
        }
        
        console.log(`🚀 Position target: ${multiplier.toFixed(2)}x → (${this.targetPosition.x.toFixed(0)}, ${this.targetPosition.y.toFixed(0)})`);
    }

    crash() {
        if (this.fallbackSystem) {
            return this.fallbackSystem.crash();
        }
        
        if (!this.rocket || !this.isActive) return;
        
        console.log('💥 Starting crash animation');
        
        this.isCrashing = true;
        
        // Start falling animation (explosion effects removed)
        this.startFallingAnimation();
    }

    // createExplosion method removed for cleaner animation

    startFallingAnimation() {
        const startX = this.rocket.x;
        const startY = this.rocket.y;
        let fallTime = 0;
        
        const fallingAnimation = (delta) => {
            if (!this.rocket || !this.isCrashing) {
                this.app.ticker.remove(fallingAnimation);
                return;
            }
            
            fallTime += delta * 0.016; // Convert to seconds
            
            // Parachute-like falling with gentle sway
            const swayAmount = Math.sin(fallTime * 2) * 15;
            const fallProgress = Math.min(fallTime / 5.0, 1); // 5 second fall
            const fallDistance = fallProgress * fallProgress * (this.canvasHeight - startY + 100);
            
            this.rocket.x = startX + swayAmount;
            this.rocket.y = startY + fallDistance;
            this.rocket.rotation += 0.02 * delta;
            this.rocket.alpha = Math.max(0.3, 1 - fallProgress * 0.7);
            
            // Don't auto-complete - let it be stopped manually
        };
        
        this.crashAnimation = fallingAnimation;
        this.app.ticker.add(fallingAnimation);
    }

    stop() {
        if (this.fallbackSystem) {
            return this.fallbackSystem.stop();
        }
        
        console.log('🛑 Stopping rocket animation');
        
        this.isActive = false;
        this.isCrashing = false;
        
        // Stop crash animation if running
        if (this.crashAnimation) {
            this.app.ticker.remove(this.crashAnimation);
            this.crashAnimation = null;
        }
        
        // Hide rocket
        if (this.rocket) {
            this.rocket.visible = false;
            this.isRocketVisible = false;
        }
        
        // Trail particles removed for cleaner animation
    }

    reset() {
        if (this.fallbackSystem) {
            return this.fallbackSystem.reset();
        }
        
        console.log('🔄 Resetting rocket animation');
        
        this.stop();
        
        if (this.rocket) {
            this.rocket.x = this.startPosition.x;
            this.rocket.y = this.startPosition.y;
            this.rocket.rotation = 0;
            this.rocket.alpha = 1;
            this.rocket.scale.set(0.8);
        }
        
        this.currentPosition = { ...this.startPosition };
        this.targetPosition = { ...this.startPosition };
        this.currentMultiplier = 1.0;
        
        // Reset star field (with error handling)
        if (this.starsContainer) {
            try {
                this.createStarField();
            } catch (e) {
                console.warn('⚠️ Could not reset star field:', e);
            }
        }
    }

    // clearTrail method removed - no longer needed

    // createExplosionEffect method removed for cleaner animation

    shakeCanvas(intensity = 5, duration = 500) {
        if (!this.container) return;
        
        let shakeTime = 0;
        const originalX = this.container.x;
        const originalY = this.container.y;
        
        const shakeAnimation = (delta) => {
            shakeTime += delta * 16;
            
            if (shakeTime < duration) {
                this.container.x = originalX + (Math.random() - 0.5) * intensity;
                this.container.y = originalY + (Math.random() - 0.5) * intensity;
            } else {
                this.container.x = originalX;
                this.container.y = originalY;
                this.app.ticker.remove(shakeAnimation);
            }
        };
        
        this.app.ticker.add(shakeAnimation);
    }

    // Utility methods
    forceRocketVisible() {
        if (!this.app || !this.rocket) {
            console.error('❌ Cannot force visibility: system not ready');
            return false;
        }
        
        console.log('🔧 Forcing rocket visibility');
        
        this.updateCanvasDimensions();
        this.calculateStartPosition();
        
        this.rocket.visible = true;
        this.isRocketVisible = true;
        this.rocket.x = this.startPosition.x;
        this.rocket.y = this.startPosition.y;
        this.rocket.alpha = 1;
        this.rocket.scale.set(0.8);
        
        this.currentPosition = { ...this.startPosition };
        this.targetPosition = { ...this.startPosition };
        this.isActive = true;
        
        if (!this.app.ticker.started) {
            this.app.ticker.start();
        }
        
        console.log('✅ Rocket forced visible at:', this.startPosition);
        return true;
    }

    toggleDebugVisibility() {
        // Create debug circle if it doesn't exist
        if (this.rocket && !this.rocket.debugCircle) {
            const debugCircle = new PIXI.Graphics();
            debugCircle.lineStyle(2, 0xFF0000, 0.8);
            debugCircle.drawCircle(0, 0, 25);
            this.rocket.addChild(debugCircle);
            this.rocket.debugCircle = debugCircle;
        }
        
        if (this.rocket && this.rocket.debugCircle) {
            this.rocket.debugCircle.visible = !this.rocket.debugCircle.visible;
            console.log('🔍 Debug circle:', this.rocket.debugCircle.visible ? 'visible' : 'hidden');
        }
    }

    getState() {
        return {
            isActive: this.isActive,
            animationPaused: this.animationPaused,
            tabVisible: this.tabVisible,
            rocketVisible: this.isRocketVisible,
            isCrashing: this.isCrashing,
            position: { ...this.currentPosition },
            targetPosition: { ...this.targetPosition },
            multiplier: this.currentMultiplier,
            stars: this.stars.length,
            appReady: this.isSystemReady && !!this.app,
            textureLoaded: !!this.rocketTexture,
            canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
            startPosition: { ...this.startPosition },
            usingFallback: !!this.fallbackSystem
        };
    }

    // Fallback system
    initializeFallback() {
        console.warn('⚠️ Initializing fallback DOM animation system');
        this.fallbackSystem = true;
        this.isSystemReady = true; // Mark as ready for fallback
        return false;
    }

    destroy() {
        if (this.fallbackSystem) return;
        
        console.log('🗑️ Destroying PixiJS system');
        
        this.stop();
        
        // Clear stars
        this.clearStars();
        
        if (this.app) {
            this.app.destroy(true, {
                children: true,
                texture: true,
                baseTexture: true
            });
        }
        
        this.app = null;
        this.rocket = null;
        this.container = null;
        this.starsContainer = null;
    }
}

// Integration class for easy setup
class PixiRocketIntegration {
    constructor() {
        this.pixiSystem = null;
        this.initialized = false;
    }
    
    async initialize() {
        try {
            console.log('🎮 Initializing PixiJS Rocket Integration...');
            
            // Check for PixiJS
            if (typeof PIXI === 'undefined') {
                console.warn('⚠️ PixiJS not found, loading from CDN...');
                await this.loadPixiJS();
            }
            
            // Create system
            this.pixiSystem = new PixiRocketAnimationSystem();
            const success = await this.pixiSystem.initialize();
            
            if (success) {
                window.rocketAnimation = this.pixiSystem;
                this.initialized = true;
                console.log('✅ PixiJS Rocket Integration complete');
                return true;
            } else {
                throw new Error('PixiJS system initialization failed');
            }
            
        } catch (error) {
            console.error('❌ PixiJS integration failed:', error);
            this.initializeFallback();
            return false;
        }
    }
    
    async loadPixiJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    initializeFallback() {
        console.warn('⚠️ Using fallback animation system');
        // Initialize fallback if available
        if (window.RocketAnimationSystem) {
            window.rocketAnimation = new window.RocketAnimationSystem();
        }
    }
    
    destroy() {
        if (this.pixiSystem) {
            this.pixiSystem.destroy();
        }
    }
}

// Auto-initialization
(function() {
    let integration = null;
    
    const init = async () => {
        try {
            console.log('🎮 Starting PixiJS Rocket Integration...');
            integration = new PixiRocketIntegration();
            const success = await integration.initialize();
            
            // Ensure the integration is marked complete
            setTimeout(() => {
                console.log('🔧 Integration status check...');
                if (window.rocketAnimation) {
                    const state = window.rocketAnimation.getState();
                    console.log('✅ PixiJS Integration complete:', {
                        system: state.usingFallback ? 'DOM Fallback' : 'PixiJS Canvas',
                        appReady: state.appReady,
                        textureLoaded: state.textureLoaded
                    });
                } else {
                    console.warn('⚠️ rocketAnimation not available');
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Auto-initialization failed:', error);
        }
    };
    
    const cleanup = () => {
        if (integration) {
            integration.destroy();
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 50); // Reduced delay
    }
    
    window.addEventListener('beforeunload', cleanup);
    
    // Export for global access
    window.PixiRocketIntegration = PixiRocketIntegration;
    window.PixiRocketAnimationSystem = PixiRocketAnimationSystem;
})();

console.log('🚀 PixiJS Rocket Animation System v2.0 loaded successfully!');