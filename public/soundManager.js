// Enhanced Sound Manager for FlyHigh Game
class SoundManager {
    constructor() {
        this.sounds = {};
        this.isEnabled = true;
        this.volumes = {
            bgMusic: 0.3,
            crashSound: 0.7,
            cashoutSound: 0.8,
            planeSound: 0.5
        };
        this.initialized = false;
        this.backgroundMusicPlaying = false;
        this.planeSoundPlaying = false;
        this.tabVisible = true;
        
        this.initializeSounds();
        this.setupUserInteractionHandler();
        this.setupVisibilityHandler();
    }

    initializeSounds() {
        // Get audio elements
        this.sounds.bgMusic = document.getElementById('bgMusic');
        this.sounds.crashSound = document.getElementById('crashSound');
        this.sounds.cashoutSound = document.getElementById('cashoutSound');
        this.sounds.planeSound = document.getElementById('planeSound');

        // Set volumes
        Object.keys(this.sounds).forEach(key => {
            if (this.sounds[key]) {
                this.sounds[key].volume = this.volumes[key];
                
                // Add error handling
                this.sounds[key].addEventListener('error', (e) => {
                    console.warn(`Failed to load sound: ${key}`, e);
                });
                
                // Add load event listeners
                this.sounds[key].addEventListener('loadeddata', () => {
                    console.log(`Sound loaded: ${key}`);
                });
            }
        });

        console.log('🔊 Sound Manager initialized');
    }

    setupUserInteractionHandler() {
        // Modern browsers require user interaction before playing audio
        const enableAudio = () => {
            if (!this.initialized) {
                this.initialized = true;
                this.playBackgroundMusic();
                console.log('🔊 Audio enabled after user interaction');
            }
        };

        // Listen for first user interaction
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('keydown', enableAudio, { once: true });
        document.addEventListener('touchstart', enableAudio, { once: true });
    }

    setupVisibilityHandler() {
        // Handle tab visibility changes for sound management
        let lastVisibilityState = !document.hidden;
        
        const handleVisibilityChange = () => {
            const currentVisibility = !document.hidden;
            
            // Only process if visibility actually changed
            if (currentVisibility !== lastVisibilityState) {
                this.tabVisible = currentVisibility;
                lastVisibilityState = currentVisibility;
                
                console.log(`🔊 Sound tab visibility changed to: ${this.tabVisible}`);
                
                if (document.hidden) {
                    this.pauseAllSounds();
                } else {
                    this.resumeAllSounds();
                }
            }
        };
        
        const handleBlur = () => {
            if (this.tabVisible) {
                this.tabVisible = false;
                this.pauseAllSounds();
                console.log('🔊 Sound paused on blur');
            }
        };

        const handleFocus = () => {
            if (!this.tabVisible) {
                this.tabVisible = true;
                this.resumeAllSounds();
                console.log('🔊 Sound resumed on focus');
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        
        // Store handlers for cleanup
        this.visibilityHandlers = {
            handleVisibilityChange,
            handleBlur,
            handleFocus
        };
    }

    pauseAllSounds() {
        if (this.sounds.bgMusic && this.backgroundMusicPlaying) {
            this.sounds.bgMusic.pause();
        }
        if (this.sounds.planeSound && this.planeSoundPlaying) {
            this.sounds.planeSound.pause();
        }
        console.log('🔊 All sounds paused (tab hidden)');
    }

    resumeAllSounds() {
        if (!this.isEnabled || !this.tabVisible) return;
        
        // Resume background music if it was playing
        if (this.sounds.bgMusic && this.backgroundMusicPlaying) {
            const playPromise = this.sounds.bgMusic.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Background music resume failed:', error);
                });
            }
        }
        
        // Resume plane sound if it was playing
        if (this.sounds.planeSound && this.planeSoundPlaying) {
            const playPromise = this.sounds.planeSound.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Plane sound resume failed:', error);
                });
            }
        }
        
        console.log('🔊 Sounds resumed (tab visible)');
    }

    playBackgroundMusic() {
        if (!this.isEnabled || !this.sounds.bgMusic || this.backgroundMusicPlaying || !this.tabVisible) return;
        
        try {
            this.sounds.bgMusic.currentTime = 0;
            const playPromise = this.sounds.bgMusic.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        this.backgroundMusicPlaying = true;
                        console.log('🎵 Background music started');
                    })
                    .catch(error => {
                        console.warn('Background music play failed:', error);
                    });
            }
        } catch (error) {
            console.warn('Background music error:', error);
        }
    }

    stopBackgroundMusic() {
        if (this.sounds.bgMusic && this.backgroundMusicPlaying) {
            this.sounds.bgMusic.pause();
            this.sounds.bgMusic.currentTime = 0;
            this.backgroundMusicPlaying = false;
            console.log('🎵 Background music stopped');
        }
    }

    playPlaneSound() {
        if (!this.isEnabled || !this.sounds.planeSound || this.planeSoundPlaying || !this.tabVisible) return;
        
        try {
            this.sounds.planeSound.currentTime = 0;
            const playPromise = this.sounds.planeSound.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        this.planeSoundPlaying = true;
                        console.log('✈️ Plane sound started');
                    })
                    .catch(error => {
                        console.warn('Plane sound play failed:', error);
                    });
            }
        } catch (error) {
            console.warn('Plane sound error:', error);
        }
    }

    stopPlaneSound() {
        if (this.sounds.planeSound && this.planeSoundPlaying) {
            this.sounds.planeSound.pause();
            this.sounds.planeSound.currentTime = 0;
            this.planeSoundPlaying = false;
            console.log('✈️ Plane sound stopped');
        }
    }

    playCrashSound() {
        if (!this.isEnabled || !this.sounds.crashSound || !this.tabVisible) return;
        
        try {
            this.sounds.crashSound.currentTime = 0;
            const playPromise = this.sounds.crashSound.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('💥 Crash sound played');
                    })
                    .catch(error => {
                        console.warn('Crash sound play failed:', error);
                    });
            }
        } catch (error) {
            console.warn('Crash sound error:', error);
        }
    }

    playCashoutSound() {
        if (!this.isEnabled || !this.sounds.cashoutSound || !this.tabVisible) return;
        
        try {
            this.sounds.cashoutSound.currentTime = 0;
            const playPromise = this.sounds.cashoutSound.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('💰 Cashout sound played');
                    })
                    .catch(error => {
                        console.warn('Cashout sound play failed:', error);
                    });
            }
        } catch (error) {
            console.warn('Cashout sound error:', error);
        }
    }

    setVolume(soundName, volume) {
        volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        
        if (this.sounds[soundName]) {
            this.sounds[soundName].volume = volume;
            this.volumes[soundName] = volume;
            console.log(`🔊 ${soundName} volume set to ${volume}`);
        }
    }

    toggleSound() {
        this.isEnabled = !this.isEnabled;
        
        if (!this.isEnabled) {
            // Stop all sounds
            this.stopBackgroundMusic();
            this.stopPlaneSound();
        } else if (this.initialized && this.tabVisible) {
            // Restart background music if game is not in progress
            if (window.gameState === 'pause' || window.gameState === 'connecting') {
                this.playBackgroundMusic();
            }
        }
        
        console.log(`🔊 Sound ${this.isEnabled ? 'enabled' : 'disabled'}`);
        return this.isEnabled;
    }

    // Game state handlers
    onGameStart() {
        this.stopBackgroundMusic();
        this.playPlaneSound();
    }

    onGamePause() {
        this.stopPlaneSound();
        this.playBackgroundMusic();
    }

    onGameCrash() {
        this.stopPlaneSound();
        this.playCrashSound();
        
        // Restart background music after crash sound (slightly longer delay for smooth transition)
        setTimeout(() => {
            this.playBackgroundMusic();
        }, 1500);
    }

    onCashout() {
        this.playCashoutSound();
    }

    // Preload all sounds
    preloadSounds() {
        Object.keys(this.sounds).forEach(key => {
            if (this.sounds[key]) {
                this.sounds[key].load();
            }
        });
        console.log('🔊 All sounds preloaded');
    }

    // Get sound status
    getStatus() {
        return {
            enabled: this.isEnabled,
            initialized: this.initialized,
            tabVisible: this.tabVisible,
            backgroundMusicPlaying: this.backgroundMusicPlaying,
            planeSoundPlaying: this.planeSoundPlaying,
            volumes: { ...this.volumes }
        };
    }

    // Cleanup method
    destroy() {
        // Stop all sounds
        this.stopBackgroundMusic();
        this.stopPlaneSound();
        
        // Remove event listeners using stored references
        if (this.visibilityHandlers) {
            document.removeEventListener('visibilitychange', this.visibilityHandlers.handleVisibilityChange);
            window.removeEventListener('blur', this.visibilityHandlers.handleBlur);
            window.removeEventListener('focus', this.visibilityHandlers.handleFocus);
        }
        
        // Clear references
        this.sounds = {};
        this.initialized = false;
        this.backgroundMusicPlaying = false;
        this.planeSoundPlaying = false;
        
        console.log('🔊 Sound Manager destroyed');
    }
}

// Create global sound manager instance
const soundManager = new SoundManager();

// Export for use in other files
window.soundManager = soundManager;