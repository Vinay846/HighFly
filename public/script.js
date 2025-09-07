// Game state variables (enhanced for PixiJS integration)
let gameState = 'connecting';
let currentMultiplier = 1.00;
let crashedMultiplier = 1.00; // Store the actual crashed multiplier value
let currentH = 0;
let userBalance = 5000;
let userCurrency = 'USD'; // Default currency, will be updated from server
let countdown = 0;
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let roundCounter = 0;
let gameHistory = [];
let gameStarted = false;

// Settings state variables
let settingsState = {
    sound: false, // Initially off
    music: true,  // Initially on
    animation: true // Initially on
};

// User state variables
let userState = {
    name: 'Shreya',
    avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo='
};

// Make settingsState globally available
window.settingsState = settingsState;
window.userState = userState;

// Bet configuration constants
const MAX_BET_AMOUNT = 10000;
const MIN_BET_AMOUNT = 1;

// UI Control Functions
function disableBetControls(playerIndex) {
    // Disable bet adjustment buttons
    const adjustBtns = document.querySelectorAll(`button[onclick*="adjustBet"][onclick*="${playerIndex}"]`);
    adjustBtns.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.style.background = '#222 !important';
        btn.style.color = '#444 !important';
        btn.style.opacity = '0.3';
        btn.style.filter = 'grayscale(100%) brightness(0.5)';
    });
    
    // Disable preset buttons
    const presetBtns = document.querySelectorAll(`button[onclick*="setBetAmount"][onclick*="${playerIndex}"]`);
    presetBtns.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('disabled');
        btn.style.background = 'rgba(0,0,0,0.8) !important';
        btn.style.color = '#333 !important';
        btn.style.opacity = '0.25';
        btn.style.filter = 'grayscale(100%) brightness(0.4)';
    });
    
    // Disable bet amount input
    const betInput = document.getElementById(`betAmount${playerIndex}`);
    if (betInput) {
        betInput.disabled = true;
        betInput.classList.add('disabled');
        betInput.style.background = 'rgba(0,0,0,0.4) !important';
        betInput.style.color = '#333 !important';
        betInput.style.opacity = '0.3';
        betInput.style.filter = 'grayscale(100%) brightness(0.5)';
    }
    
    console.log(`🔒 Bet controls disabled for player ${playerIndex}`);
}

function enableBetControls(playerIndex) {
    // Enable bet adjustment buttons
    const adjustBtns = document.querySelectorAll(`button[onclick*="adjustBet"][onclick*="${playerIndex}"]`);
    adjustBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.style.removeProperty('background');
        btn.style.removeProperty('color');
        btn.style.removeProperty('opacity');
        btn.style.removeProperty('filter');
    });
    
    // Enable preset buttons
    const presetBtns = document.querySelectorAll(`button[onclick*="setBetAmount"][onclick*="${playerIndex}"]`);
    presetBtns.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.style.removeProperty('background');
        btn.style.removeProperty('color');
        btn.style.removeProperty('opacity');
        btn.style.removeProperty('filter');
    });
    
    // Enable bet amount input
    const betInput = document.getElementById(`betAmount${playerIndex}`);
    if (betInput) {
        betInput.disabled = false;
        betInput.classList.remove('disabled');
        betInput.style.removeProperty('background');
        betInput.style.removeProperty('color');
        betInput.style.removeProperty('opacity');
        betInput.style.removeProperty('filter');
    }
    
    console.log(`🔓 Bet controls enabled for player ${playerIndex}`);
}

// Update bet controls based on current game state and button state
function updateBetControls(playerIndex) {
    if (gameState === 'progress' && bets[playerIndex].buttonState === 'cashout') {
        disableBetControls(playerIndex);
    } else {
        enableBetControls(playerIndex);
    }
}

// Game Launch Loading Screen functions
function showLoadingScreen() {
    const loader = document.getElementById('gameLoaderOverlay');
    if (loader) {
        loader.style.display = 'flex';
        console.log('🎮 Game loading screen shown');
    }
}

function hideLoadingScreen() {
    const loader = document.getElementById('gameLoaderOverlay');
    if (loader) {
        loader.style.display = 'none';
        console.log('🎮 Game loading screen hidden');
    }
}

// PixiJS integration flags
let pixiJSReady = false;
let animationSystemReady = false;

// Crash sequence timing
let crashSequenceActive = false;
let crashAnimationDuration = 4000; // 4 seconds for smooth crash animation
let crashAnimationStartTime = 0;

// Bet controls for two players with enhanced auto-cashout
const bets = {
    1: {
        amount: 100.00,
        placed: false,
        mode: 'bet',
        buttonState: 'bet',
        autoCashoutEnabled: false,
        autoCashoutValue: 1.10,
        autoCashoutTriggered: false,
        counter: null,
        awaiting: false,
        scope: null
    },
    2: {
        amount: 100.00,
        placed: false,
        mode: 'bet',
        buttonState: 'bet',
        autoCashoutEnabled: false,
        autoCashoutValue: 1.10,
        autoCashoutTriggered: false,
        counter: null,
        awaiting: false,
        scope: null
    }
};

// Countdown variables
let countdownInterval = null;
let countdownAnimationId = null;

// DOM elements - will be initialized after DOM loads
let elements = {};

// PixiJS Integration Check
function checkPixiJSStatus() {
    pixiJSReady = typeof PIXI !== 'undefined';
    
    // Check if window.rocketAnimation exists and has required methods
    animationSystemReady = !!(window.rocketAnimation && 
                            window.rocketAnimation.start && 
                            window.rocketAnimation.updatePosition &&
                            window.rocketAnimation.getState);
    
    console.log('🔍 PixiJS Status Check:', {
        pixiJSAvailable: pixiJSReady,
        pixiVersion: pixiJSReady ? PIXI.VERSION : 'Not available',
        animationSystemReady: animationSystemReady,
        rocketAnimationExists: !!window.rocketAnimation,
        rocketAnimationType: window.rocketAnimation ? typeof window.rocketAnimation : 'undefined'
    });
    
    if (!pixiJSReady) {
        console.warn('⚠️ PixiJS not available, using DOM fallback');
        elements.gameCanvas.classList.add('pixijs-fallback');
        if (elements.rocket) elements.rocket.style.display = 'block';
        if (elements.trailContainer) elements.trailContainer.style.display = 'block';
        return true; // Stop checking, use fallback
    } 
    
    if (!animationSystemReady) {
        console.warn('⚠️ PixiJS Animation System not ready, retrying...');
        return false; // Continue waiting
    } 
    
    // System is ready
    console.log('✅ PixiJS Animation System ready');
    elements.gameCanvas.classList.remove('pixijs-fallback');
    if (elements.rocket) elements.rocket.style.display = 'none';
    if (elements.trailContainer) elements.trailContainer.style.display = 'none';
    
    // Test the system after a short delay
    setTimeout(() => {
        if (window.rocketAnimation && window.rocketAnimation.getState) {
            const state = window.rocketAnimation.getState();
            console.log('🚀 Post-init rocket state:', state);
            
            if (!state.appReady || state.usingFallback) {
                console.warn('⚠️ PixiJS system reports not ready, debugging...');
                if (window.rocketAnimation.forceRocketVisible) {
                    console.log('🔧 Attempting to force rocket visible...');
                    window.rocketAnimation.forceRocketVisible();
                }
            } else {
                console.log('✅ PixiJS system fully operational');
            }
        }
    }, 500);
    
    return true; // Stop checking
}

// Enhanced rocket animation interface
function getRocketAnimation() {
    if (animationSystemReady && window.rocketAnimation) {
        return window.rocketAnimation;
    }
    
    // Fallback object for when PixiJS is not available
    return {
        start: (multiplier) => console.warn('Animation system not ready'),
        startFromMultiplier: (multiplier) => console.warn('Animation system not ready'),
        updatePosition: (multiplier) => console.warn('Animation system not ready'),
        crash: () => console.warn('Animation system not ready'),
        stop: () => console.warn('Animation system not ready'),
        reset: () => console.warn('Animation system not ready'),
        shakeCanvas: () => console.warn('Animation system not ready'),
        getState: () => ({ isActive: false, usingFallback: true })
    };
}

// Initialize WebSocket connection
function initializeWebSocket() {
    try {
        socket = new WebSocket('wss://wss.polishchuk.com/nonstop-ws');
        
        socket.onopen = function(event) {
            console.log('🔗 WebSocket Connected');
            reconnectAttempts = 0;
            updateGameStatus('pause', 'Connected to server');
            showToast('Connected to server', 'success');
            
            socket.send(JSON.stringify({
                set: "authentication",
                location: window.location,
                cookie: document.cookie,
                key: "ba614aC3"
            }));
            console.log('🔐 Authentication sent');
        };
        
        socket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received:', data);
                handleServerMessage(data);
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        };
        
        socket.onerror = function(error) {
            console.error('❌ WebSocket Error:', error);
            updateGameStatus('crashed', 'Connection error');
            showToast('Connection error', 'error');
            
            // Show loading screen on connection error
            showLoadingScreen();
        };
        
        socket.onclose = function(event) {
            console.log('🔌 WebSocket Closed:', event.code, event.reason);
            updateGameStatus('crashed', 'Disconnected');
            
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`🔄 Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                
                // Show loading screen during reconnection
                showLoadingScreen();
                
                setTimeout(initializeWebSocket, 2000 * reconnectAttempts);
            } else {
                showToast('Connection lost. Please refresh the page.', 'error');
            }
        };
        
    } catch (error) {
        console.error('❌ WebSocket initialization error:', error);
        updateGameStatus('crashed', 'Connection failed');
    }
}

// Handle server messages
function handleServerMessage(data) {
    // Always check for wallet balance updates first in any response
    if (data.wallet && data.wallet.balance !== undefined) {
        userBalance = data.wallet.balance;
        updateBalanceDisplay();
        console.log('💰 Balance updated from wallet:', userBalance);
    }
    
    if (data.authentication !== undefined) {
        handleAuthenticationResponse(data);
        return;
    }
    
    if (data.game_list) {
        handleGameListResponse(data);
        return;
    }
    
    if (data.hasOwnProperty('bet')) {
        handleBetResponse(data);
        return;
    }
    
    // Handle user data updates from server
    if (data.userData || data.user_data) {
        const userData = data.userData || data.user_data;
        handleServerUserData(userData);
        return;
    }
    
    // Handle user data response from server
    if (data.get === 'user_data' && data.user) {
        handleServerUserData(data.user);
        return;
    }
    
    // Handle responses with "on" property (set options responses)
    if (data.on && data.on.set === 'options') {
        console.log('⚙️ Options set response:', data);
        // Balance already handled above via wallet object
        showToast('Bet options updated', 'info');
        return;
    }
    
    if (data.status) {
        switch (data.status) {
            case 'pause':
                handlePauseState(data);
                break;
            case 'started':
                handleStartedState(data);
                break;
            case 'progress':
                // Check for mid-game connection
                if (!gameStarted && data.k && data.k > 1.0) {
                    handleMidGameConnection(data);
                } else {
                    handleProgressState(data);
                }
                break;
            case 'crash':
                handleCrashState(data);
                break;
            default:
                console.log('🔔 Unknown game status:', data);
        }
    } else {
        console.log('🔔 Unknown message:', data);
    }
}

function handleAuthenticationResponse(data) {
    console.log('🔐 Authentication response:', data);
    
    if (data.authentication === true) {
        console.log('✅ Authentication successful');
        
        if (data.wallet) {
            if (data.wallet.balance !== undefined) {
                userBalance = data.wallet.balance;
                console.log('💰 Initial balance:', userBalance);
            }
            
            if (data.wallet.currency !== undefined) {
                userCurrency = data.wallet.currency;
                console.log('💱 Currency set to:', userCurrency);
            }
            
            // Update both balance and currency display
            updateBalanceDisplay();
        }
        
        if (data.set_cookie && Array.isArray(data.set_cookie)) {
            data.set_cookie.forEach(cookie => {
                document.cookie = cookie;
                console.log('🍪 Cookie set:', cookie);
            });
        }
        
        console.log('📋 Requesting game list...');
        socket.send(JSON.stringify({
            "get": "game_list"
        }));
        
        // Request user data from server
        console.log('👤 Requesting user data...');
        socket.send(JSON.stringify({
            "get": "user_data"
        }));
        
        showToast('Authentication successful!', 'success');
        
        // Add sample bet history now that we have proper currency
        setTimeout(() => {
            addSampleBetHistory();
        }, 500); // Small delay to ensure UI is ready
    } else {
        console.error('❌ Authentication failed');
        showToast('Authentication failed', 'error');
    }
}

function handleGameListResponse(data) {
    console.log('📋 Game list received:', data.game_list);
    
    const crackGame = data.game_list.find(game => game.tag === 'crs1');
    
    if (crackGame) {
        console.log('🎮 Crack game found:', crackGame);
        
        console.log('🎯 Setting game to Crack...');
        
        // Hide loading screen when setting game to Crack
        hideLoadingScreen();
        
        socket.send(JSON.stringify({
            "set": "game",
            "game": "crs1"
        }));
        
        showToast(`Game set to: ${crackGame.title}`, 'success');
    } else {
        console.error('❌ Crack game (crs1) not found in game list');
        showToast('Crash game not available', 'error');
    }
}

function handleBetResponse(data) {
    console.log('🎲 Bet response:', data);
    
    if (data.bet && data.bet.cancel === true) {
        const betIndex = data.PHP?.index || 0;
        const playerIndex = betIndex + 1;
        
        bets[playerIndex].placed = false;
        bets[playerIndex].awaiting = false;
        bets[playerIndex].counter = null;
        bets[playerIndex].scope = null;
        updateButtonState(playerIndex, 'bet');
        
        
        if (data.wallet && data.wallet.balance !== undefined) {
            userBalance = data.wallet.balance;
            updateBalanceDisplay();
        }
        
        showToast(`Bet cancelled successfully!`, 'success');
        return;
    }
    
    if (data.bet === false && data.error) {
        const betIndex = data.PHP?.index || 0;
        const playerIndex = betIndex + 1;
        
        let errorMessage = 'Bet failed';
        let shouldResetBet = true;
        
        switch (data.error.toLowerCase()) {
            case 'low balance':
                errorMessage = 'Insufficient balance!';
                break;
            case 'bet already placed':
            case 'already bet':
                errorMessage = 'Bet already placed for this round!';
                shouldResetBet = false;
                break;
            case 'game not accepting bets':
                errorMessage = 'Game not accepting bets!';
                shouldResetBet = false;
                break;
            default:
                errorMessage = `Bet failed: ${data.error}`;
        }
        
        if (shouldResetBet) {
            bets[playerIndex].placed = false;
            bets[playerIndex].awaiting = false;
            bets[playerIndex].scope = null;
            updateButtonState(playerIndex, 'bet');
            
        }
        
        showToast(errorMessage, 'error');
        
        if (data.wallet && data.wallet.balance !== undefined) {
            userBalance = data.wallet.balance;
            updateBalanceDisplay();
        }
        
        return;
    }
    
    if (data.bet && data.bet.awaiting) {
        const betIndex = data.PHP?.index || 0;
        const playerIndex = betIndex + 1;
        
        bets[playerIndex].placed = true;
        bets[playerIndex].awaiting = true;
        bets[playerIndex].counter = data.bet.counter;
        bets[playerIndex].scope = data.bet.scope;
        
        
        if (data.wallet && data.wallet.balance !== undefined) {
            userBalance = data.wallet.balance;
            updateBalanceDisplay();
        }
        
        if (data.bet.scope === 'current') {
            if (gameState === 'pause') {
                updateButtonState(playerIndex, 'cancel');
            } else if (gameState === 'progress') {
                updateButtonState(playerIndex, 'cashout');
            } else {
                updateButtonState(playerIndex, 'waiting');
            }
            showToast(`Bet placed for current round!`, 'success');
        } else if (data.bet.scope === 'next') {
            updateButtonState(playerIndex, 'waiting-next');
            showToast(`Bet placed for next round!`, 'success');
        } else {
            if (gameState === 'pause') {
                updateButtonState(playerIndex, 'cancel');
            } else {
                updateButtonState(playerIndex, 'waiting');
            }
            showToast(`Bet placed successfully!`, 'success');
        }
    }
}

// Countdown functions
function showCountdownLoader(totalTime) {
    if (!elements.countdownContainer || !elements.countdownText || !elements.countdownBar) return;
    
    console.log('🕐 Starting countdown loader:', totalTime, 'seconds');
    
    elements.countdownContainer.classList.remove('hidden');
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    if (totalTime <= 0 || gameState !== 'pause') {
        hideCountdownLoader();
        return;
    }
    
    elements.countdownText.textContent = `Accepting bets - ${totalTime.toFixed(1)}s`;
    
    const percentage = (totalTime / 5) * 100;
    elements.countdownBar.style.width = `${percentage}%`;
}

function hideCountdownLoader() {
    console.log('🕐 Hiding countdown loader');
    
    // Clear any running countdown intervals
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Clear any running countdown animation frames
    if (countdownAnimationId) {
        cancelAnimationFrame(countdownAnimationId);
        countdownAnimationId = null;
    }
    
    // Hide the loader UI
    if (elements.countdownContainer) {
        elements.countdownContainer.classList.add('hidden');
        console.log('🕐 Countdown container hidden');
    }
}

// Enhanced game state handlers with PixiJS integration
function handlePauseState(data) {
    gameState = 'pause';
    countdown = data.countdown || 0;
    gameStarted = false;
    
    // Clear any saved game state when starting a new round
    clearSavedGameState();
    
    console.log(`⏸️ Pause state: countdown = ${countdown.toFixed(1)}s`);
    
    // Special handling for countdown = 10 (start of pause with FLEW AWAY! text)
    if (countdown === 10) {
        // Show FLEW AWAY! overlay (rocket continues falling from crash state)
        console.log('💥 Showing FLEW AWAY! overlay - rocket continues falling from crash state');
        
        // Show flew away message with crashed multiplier
        showFlewAwayMessage(crashedMultiplier);
        
        // Hide game logo during crash sequence
        elements.gameLogo.style.display = 'none';
        
        // Explosion effects removed for cleaner animation
        const rocketAnimation = getRocketAnimation();
        rocketAnimation.shakeCanvas(8, 600);
        
        updateGameStatus('crashed', `Flew away at ${currentMultiplier.toFixed(2)}x`);
        
        // Keep countdown loader hidden during crash sequence
        hideCountdownLoader();
        
        return; // Exit early, don't process normal pause logic
    }
    
    // Handle countdown > 5 (continue showing FLEW AWAY! during falling animation)
    if (countdown > 5) {
        console.log(`⏸️ Pause state during crash sequence (countdown: ${countdown}), maintaining FLEW AWAY! display`);
        
        // Ensure blanket is visible
        const blanketOverlay = document.getElementById('blanketOverlay');
        if (blanketOverlay) {
            blanketOverlay.classList.add('visible');
        }
        
        // Keep FLEW AWAY! text visible, rocket continues falling
        if (!elements.multiplierDisplay.classList.contains('crashed')) {
            elements.multiplierDisplay.classList.add('crashed');
            elements.multiplierDisplay.classList.add('show');
            elements.multiplierDisplay.innerHTML = `FLEW AWAY!<br><span style="color: #00FFFF; font-size: 6.5rem;">${crashedMultiplier.toFixed(2)}X</span>`;
        }
        elements.gameLogo.style.display = 'none';
        updateGameStatus('crashed', `Flew away at ${crashedMultiplier.toFixed(2)}x`);
        // Keep countdown loader hidden during crash sequence
        hideCountdownLoader();
        return;
    }
    
    // Handle countdown = 5 (stop falling animation, start accepting bets)
    if (countdown === 5) {
        console.log('🔄 Countdown reached 5 - stopping falling animation, preparing for next round');
        
        // Stop the falling animation and reset rocket
        const rocketAnimation = getRocketAnimation();
        rocketAnimation.stop();
        rocketAnimation.reset();
        
        if (window.soundManager) {
            window.soundManager.onGamePause();
        }
    }
    
    // Handle countdown = 0 (hide loader immediately - server says countdown finished)
    if (countdown === 0) {
        console.log('🕐 Server sent countdown: 0 - hiding loader immediately');
        hideCountdownLoader();
        updateGameStatus('pause', 'Ready to start');
        
        // Hide flew away message and blanket
        hideFlewAwayMessage();
        
        // Show game logo
        elements.gameLogo.style.display = 'block';
        
        // Handle button states and return early
        for (let i = 1; i <= 2; i++) {
            if (bets[i].placed && bets[i].scope === 'next') {
                bets[i].scope = 'current';
                bets[i].awaiting = true;
                updateButtonState(i, 'cancel');
            } else if (bets[i].placed && bets[i].scope === 'current' && bets[i].awaiting) {
                updateButtonState(i, 'cancel');
            } else if (!bets[i].placed) {
                updateButtonState(i, 'bet');
            }
        }
        
        // Reset multiplier
        currentMultiplier = 1.00;
        currentH = 0;
        
        return; // Exit early for countdown = 0
    }
    
    // Normal pause handling for countdown > 0
    updateGameStatus('pause', `Accepting bets${countdown > 0 ? ` - ${countdown.toFixed(1)}s` : ''}`);
    
    // Show game logo
    elements.gameLogo.style.display = 'block';
    
    // Show countdown loader for countdown > 0 and <= 5
    if (countdown > 0 && countdown <= 5) {
        console.log('🕐 Showing countdown loader for betting phase:', countdown);
        
        // Hide flew away message and blanket when bet accepting starts
        hideFlewAwayMessage();
        
        showCountdownLoader(countdown);
        
        // Clear any existing countdown animation
        if (countdownAnimationId) {
            cancelAnimationFrame(countdownAnimationId);
            countdownAnimationId = null;
        }
        
        // Start countdown timer
        const countdownStart = performance.now();
        const countdownUpdate = () => {
            const elapsed = (performance.now() - countdownStart) / 1000;
            const remaining = Math.max(0, countdown - elapsed);
            
            if (remaining > 0 && gameState === 'pause') {
                updateCountdownDisplay(remaining);
                countdownAnimationId = requestAnimationFrame(countdownUpdate);
            } else if (gameState === 'pause' && remaining <= 0) {
                // Countdown finished naturally, hide loader
                console.log('🕐 Countdown finished naturally, hiding loader');
                countdownAnimationId = null;
                hideCountdownLoader();
            } else {
                // Game state changed, clear animation
                countdownAnimationId = null;
            }
        };
        countdownAnimationId = requestAnimationFrame(countdownUpdate);
    }
    
    // Reset multiplier
    currentMultiplier = 1.00;
    currentH = 0;
    
    // Update buttons based on bet status
    for (let i = 1; i <= 2; i++) {
        if (bets[i].placed && bets[i].scope === 'next') {
            bets[i].scope = 'current';
            bets[i].awaiting = true;
            updateButtonState(i, 'cancel');
        } else if (bets[i].placed && bets[i].scope === 'current' && bets[i].awaiting) {
            updateButtonState(i, 'cancel');
        } else if (!bets[i].placed) {
            updateButtonState(i, 'bet');
        }
    }
}

// Helper function to update countdown display smoothly
function updateCountdownDisplay(remainingTime) {
    if (!elements.countdownText || !elements.countdownBar) return;
    
    elements.countdownText.textContent = `Accepting bets - ${remainingTime.toFixed(1)}s`;
    
    // Update progress bar (assuming max countdown is usually 10 seconds)
    const maxTime = 10;
    const percentage = Math.max(0, (remainingTime / maxTime) * 100);
    elements.countdownBar.style.width = `${percentage}%`;
}

function handleStartedState(data) {
    gameState = 'started';
    gameStarted = true;
    currentMultiplier = 1.00;
    currentH = data.h || 0;
    
    updateGameStatus('started', 'Game Started');
    
    // Immediately hide countdown loader when game starts
    console.log('🚀 Game started - force hiding countdown loader');
    hideCountdownLoader();
    elements.gameLogo.style.display = 'none';
    elements.multiplierDisplay.classList.add('show');
    elements.multiplierDisplay.textContent = '1.00x';
    elements.multiplierDisplay.classList.remove('crashed');
    elements.multiplierDisplay.style.color = '';
    
    // Reset crashed multiplier for new game
    crashedMultiplier = 1.00;
    
    // Start rocket animation and sounds - but don't move rocket yet
    const rocketAnimation = getRocketAnimation();
    rocketAnimation.start(1.00); // Start at 1.00x
    
    if (window.soundManager) {
        window.soundManager.onGameStart();
    }
    
    // Reset auto-cashout triggers for new round
    for (let i = 1; i <= 2; i++) {
        bets[i].autoCashoutTriggered = false;
        
        if (bets[i].placed && bets[i].scope === 'current') {
            updateButtonState(i, 'cashout');
        } else if (bets[i].placed && bets[i].scope === 'next') {
            updateButtonState(i, 'waiting-next');
        } else if (!bets[i].placed) {
            updateButtonState(i, 'bet');
        }
    }
    
    console.log('🚀 Game started - waiting for progress updates to move rocket');
    showToast('Game started! 🚀', 'info');
}

function handleMidGameConnection(data) {
    console.log('🎯 Handling mid-game connection at multiplier:', data.k);
    
    gameState = 'progress'; // Set to progress immediately
    gameStarted = true;
    currentMultiplier = data.k || 1.00;
    currentH = data.h || 0;
    
    // Hide countdown and show game elements
    hideCountdownLoader();
    elements.gameLogo.style.display = 'none';
    elements.multiplierDisplay.classList.add('show');
    elements.multiplierDisplay.textContent = currentMultiplier.toFixed(2) + 'x';
    elements.multiplierDisplay.classList.remove('crashed');
    elements.multiplierDisplay.style.color = '';
    
    // Force rocket to be visible and start from current multiplier position
    const rocketAnimation = getRocketAnimation();
    
    // Ensure rocket is visible first
    if (rocketAnimation.forceRocketVisible) {
        rocketAnimation.forceRocketVisible();
    }
    
    // Start rocket animation from current multiplier position
    rocketAnimation.startFromMultiplier(currentMultiplier);
    
    // Ensure multiplier display is updated
    updateMultiplierDisplay(currentMultiplier);
    
    if (window.soundManager) {
        window.soundManager.onGameStart();
    }
    
    // Reset auto-cashout triggers for new round
    for (let i = 1; i <= 2; i++) {
        bets[i].autoCashoutTriggered = false;
        
        if (bets[i].placed && bets[i].scope === 'current') {
            updateButtonState(i, 'cashout');
            const cashoutValue = (bets[i].amount * currentMultiplier).toFixed(2);
            updateButtonAmount(i, cashoutValue);
        }
    }
    
    updateGameStatus('started', `Flying - ${currentMultiplier.toFixed(2)}x`);
    showToast(`Joined mid-game at ${currentMultiplier.toFixed(2)}x! 🚀`, 'info');
    
    console.log('🚀 Mid-game connection established - rocket synced to current multiplier');
}

function handleProgressState(data) {
    // Only process progress if game has started
    if (!gameStarted) {
        console.log('⚠️ Received progress before game started, ignoring');
        return;
    }
    
    gameState = 'progress';
    
    // Ensure countdown loader is hidden during progress
    hideCountdownLoader();
    
    currentH = data.h || 0;
    
    // Update multiplier display and cashout amounts together
    updateMultiplierDisplay(data.k || 1.00);
    
    // Update rocket animation position using the animation interface
    const rocketAnimation = getRocketAnimation();
    rocketAnimation.updatePosition(currentMultiplier);
    
    // DIRECTLY update button amounts for placed bets - no complex conditions
    for (let i = 1; i <= 2; i++) {
        if (bets[i].placed && bets[i].scope === 'current') {
            // Ensure button is in cashout state
            if (bets[i].buttonState !== 'cashout') {
                bets[i].buttonState = 'cashout';
                const button = document.getElementById(`mainActionButton${i}`);
                if (button) {
                    const label = button.querySelector('.button-label');
                    button.className = 'main-action-button cashout-state';
                    if (label) label.textContent = 'CASH OUT';
                    button.disabled = false;
                }
            }
            
            // Force update the cashout amount for this specific button
            const cashoutValue = (bets[i].amount * currentMultiplier).toFixed(2);
            const amountElement = document.getElementById(`mainButtonAmount${i}`);
            if (amountElement) {
                amountElement.textContent = cashoutValue;
            }
            
            // Check auto-cashout - only if enabled via checkbox
            if (bets[i].mode === 'auto' && 
                bets[i].autoCashoutEnabled && 
                !bets[i].autoCashoutTriggered && 
                bets[i].autoCashoutValue > 0) {
                
                const targetMultiplier = parseFloat(bets[i].autoCashoutValue.toFixed(2));
                const currentMult = parseFloat(currentMultiplier.toFixed(2));
                
                if (currentMult >= targetMultiplier) {
                    console.log(`🤖 Auto-cashout triggered for player ${i}: ${currentMult} >= ${targetMultiplier}, H: ${currentH}`);
                    bets[i].autoCashoutTriggered = true;
                    cashOut(i);
                }
            }
        } else if (!bets[i].placed) {
            updateButtonState(i, 'bet');
        }
    }
    
    updateGameStatus('started', `Flying - ${currentMultiplier.toFixed(2)}x`);
    
    // Final safety net - ensure cashout amounts are updated
    updateAllCashoutAmounts();
    
    // Log progress for debugging
    console.log(`📈 Progress: ${currentMultiplier.toFixed(2)}x (H: ${currentH})`);
}

function handleCrashState(data) {
    gameState = 'crash';
    const crashMultiplier = data.k || currentMultiplier;
    
    console.log(`💥 Crash detected at ${crashMultiplier.toFixed(2)}x - Starting falling animation`);
    
    // Clear saved game state since round is ending
    clearSavedGameState();
    
    // Store the crashed multiplier value
    crashedMultiplier = crashMultiplier;
    
    // Update current multiplier to crash value
    currentMultiplier = crashMultiplier;
    
    // Immediately start the falling animation
    const rocketAnimation = getRocketAnimation();
    rocketAnimation.crash(); // This will trigger the smooth falling animation
    
    // Immediately hide countdown loader during crash sequence
    console.log('💥 Crash detected - force hiding countdown loader');
    hideCountdownLoader();
    
    // Update display but don't show FLEW AWAY! text yet (will be shown in pause state)
    elements.multiplierDisplay.textContent = crashMultiplier.toFixed(2) + 'x';
    
    // Play crash sound effects
    if (window.soundManager) {
        window.soundManager.onGameCrash();
    }
    
    updateGameStatus('crashed', `Crashed at ${crashMultiplier.toFixed(2)}x`);
    
    // Add to history
    addToHistory(crashMultiplier);
    
    // Handle crashed bets
    for (let i = 1; i <= 2; i++) {
        if (bets[i].placed && bets[i].scope === 'current' && bets[i].awaiting) {
            addToBetList(bets[i].amount, crashMultiplier, -bets[i].amount, true);
            showToast(`Bet ${i} crashed at ${crashMultiplier.toFixed(2)}x - Lost ${getCurrencySymbol(userCurrency)}${bets[i].amount}`, 'error');
            
            bets[i].placed = false;
            bets[i].awaiting = false;
            bets[i].counter = null;
            bets[i].scope = null;
            bets[i].autoCashoutTriggered = false;
            
        }
    }
    
    console.log(`💥 Rocket falling animation started - will continue until pause state (countdown: 10)`);
}

// Enhanced betting functions with auto-cashout checkbox
function setBetMode(mode, playerIndex) {
    bets[playerIndex].mode = mode;
    
    // Get relevant elements
    const autoCashoutSection = document.getElementById(`autoCashoutSection${playerIndex}`);
    const betModeToggle = document.querySelector(`input[name="betMode${playerIndex}"][value="bet"]`);
    const autoModeToggle = document.querySelector(`input[name="betMode${playerIndex}"][value="auto"]`);
    
    if (mode === 'auto') {
        autoCashoutSection.classList.add('show');
        // Check the checkbox state to determine if auto-cashout is enabled
        const checkbox = document.getElementById(`autoCashoutCheckbox${playerIndex}`);
        bets[playerIndex].autoCashoutEnabled = checkbox ? checkbox.checked : false;
        // Update the auto cashout value
        updateAutoCashout(playerIndex);
        
        // Disable bet mode toggle when auto is selected and checkbox is checked
        if (checkbox && checkbox.checked) {
            betModeToggle.disabled = true;
            betModeToggle.parentElement.classList.add('disabled');
        }
    } else {
        autoCashoutSection.classList.remove('show');
        bets[playerIndex].autoCashoutEnabled = false;
        
        // Re-enable bet mode toggle
        if (betModeToggle) {
            betModeToggle.disabled = false;
            betModeToggle.parentElement.classList.remove('disabled');
        }
    }
    
    console.log(`🎯 Player ${playerIndex} mode set to: ${mode}, auto-cashout: ${bets[playerIndex].autoCashoutEnabled}`);
}

function updateAutoCashout(playerIndex) {
    const value = parseFloat(document.getElementById(`autoCashoutValue${playerIndex}`).value);
    if (value && value >= 1.01) {
        // Round to 2 decimal places for precision
        bets[playerIndex].autoCashoutValue = Math.round(value * 100) / 100;
        document.getElementById(`autoCashoutValue${playerIndex}`).value = bets[playerIndex].autoCashoutValue.toFixed(2);
        console.log(`🤖 Auto-cashout value updated for player ${playerIndex}: ${bets[playerIndex].autoCashoutValue}x`);
    }
}

// Enhanced function to handle auto-cashout checkbox changes
function toggleAutoCashout(playerIndex) {
    const checkbox = document.getElementById(`autoCashoutCheckbox${playerIndex}`);
    const input = document.getElementById(`autoCashoutValue${playerIndex}`);
    const betModeToggle = document.querySelector(`input[name="betMode${playerIndex}"][value="bet"]`);
    
    if (checkbox && bets[playerIndex].mode === 'auto') {
        bets[playerIndex].autoCashoutEnabled = checkbox.checked;
        console.log(`🤖 Auto-cashout ${bets[playerIndex].autoCashoutEnabled ? 'enabled' : 'disabled'} for player ${playerIndex}`);
        
        // Enable/disable input based on checkbox
        if (input) {
            input.disabled = !checkbox.checked;
        }
        
        // Update visual feedback
        const autoCashoutSection = document.getElementById(`autoCashoutSection${playerIndex}`);
        if (autoCashoutSection) {
            autoCashoutSection.classList.toggle('enabled', checkbox.checked);
        }
        
        // Control bet mode toggle availability
        if (betModeToggle) {
            if (checkbox.checked) {
                // Disable bet mode toggle when checkbox is checked
                betModeToggle.disabled = true;
                betModeToggle.parentElement.classList.add('disabled');
                console.log(`🔒 Bet mode toggle disabled for player ${playerIndex} (auto-cashout enabled)`);
            } else {
                // Enable bet mode toggle when checkbox is unchecked
                betModeToggle.disabled = false;
                betModeToggle.parentElement.classList.remove('disabled');
                console.log(`🔓 Bet mode toggle enabled for player ${playerIndex} (auto-cashout disabled)`);
            }
        }
    }
}

function adjustBet(multiplier, playerIndex) {
    // Prevent adjustment if bet is already placed
    if (bets[playerIndex].placed) {
        showToast('Cannot change bet amount after placing bet', 'error');
        return;
    }
    
    const input = document.getElementById(`betAmount${playerIndex}`);
    const current = parseFloat(input.value) || 100;
    const newAmount = multiplier < 1 ? current * multiplier : current * multiplier;
    let finalAmount = Math.max(MIN_BET_AMOUNT, Math.round(newAmount * 100) / 100);
    
    // Apply upper limit
    if (finalAmount > MAX_BET_AMOUNT) {
        finalAmount = MAX_BET_AMOUNT;
        showToast(`Maximum bet amount is ${getCurrencySymbol(userCurrency)}${MAX_BET_AMOUNT}`, 'warning');
    }
    
    input.value = finalAmount.toFixed(2);
    bets[playerIndex].amount = finalAmount;
    updateButtonAmount(playerIndex, finalAmount.toFixed(2));
}

function setBetAmount(amount, playerIndex) {
    // Prevent changes if bet is already placed
    if (bets[playerIndex].placed) {
        showToast('Cannot change bet amount after placing bet', 'error');
        return;
    }
    
    // Apply limits
    let finalAmount = Math.max(MIN_BET_AMOUNT, Math.min(amount, MAX_BET_AMOUNT));
    
    if (amount > MAX_BET_AMOUNT) {
        showToast(`Maximum bet amount is ${getCurrencySymbol(userCurrency)}${MAX_BET_AMOUNT}`, 'warning');
    }
    
    document.getElementById(`betAmount${playerIndex}`).value = finalAmount.toFixed(2);
    bets[playerIndex].amount = finalAmount;
    updateButtonAmount(playerIndex, finalAmount.toFixed(2));
}

function handleMainAction(playerIndex) {
    const buttonState = bets[playerIndex].buttonState;
    
    switch (buttonState) {
        case 'bet':
            if (gameState === 'pause' || gameState === 'progress' || gameState === 'crash') {
                placeBet(playerIndex);
            } else {
                showToast('Cannot place bet at this time', 'error');
            }
            break;
        case 'cancel':
            if (gameState === 'pause') {
                cancelBet(playerIndex);
            } else {
                showToast('Cannot cancel bet at this time', 'error');
            }
            break;
        case 'waiting-next':
            if (gameState === 'progress' || gameState === 'crash') {
                cancelBet(playerIndex);
            } else {
                showToast('Cannot cancel bet at this time', 'error');
            }
            break;
        case 'cashout':
            if (gameState === 'progress') {
                cashOut(playerIndex);
            } else {
                showToast('Can only cash out during game progress', 'error');
            }
            break;
        default:
            console.log('Button disabled or unknown state');
    }
}

function placeBet(playerIndex) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const betAmount = bets[playerIndex].amount;
        const betIndex = playerIndex - 1;
        
        socket.send(JSON.stringify({
            "set": "options",
            "bet_sum": betAmount,
            "index": betIndex
        }));
        
        setTimeout(() => {
            socket.send(JSON.stringify({
                "set": "bet",
                "index": betIndex
            }));
        }, 100);
        
        console.log('📤 Bet placed:', { amount: betAmount, index: betIndex });
        updateButtonState(playerIndex, 'waiting');
    } else {
        showToast('Connection error. Please try again.', 'error');
    }
}

function cancelBet(playerIndex) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const betIndex = playerIndex - 1;
        
        socket.send(JSON.stringify({
            "set": "bet",
            "index": betIndex,
            "cancel": true
        }));
        
        console.log('📤 Bet cancelled:', { index: betIndex });
        updateButtonState(playerIndex, 'waiting');
        showToast('Cancelling bet...', 'info');
    } else {
        showToast('Connection error. Please try again.', 'error');
    }
}

function cashOut(playerIndex) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const betIndex = playerIndex - 1;
        
        socket.send(JSON.stringify({
            "set": "bet",
            "index": betIndex,
            "cash_out": currentH
        }));
        
        console.log('📤 Cashout sent:', { 
            index: betIndex, 
            cash_out: currentH, 
            multiplier: currentMultiplier,
            h_value: currentH,
            auto_triggered: bets[playerIndex].autoCashoutTriggered
        });
        
        // Play cashout sound
        if (window.soundManager) {
            window.soundManager.onCashout();
        }
        
        const winAmount = bets[playerIndex].amount * currentMultiplier;
        // Note: Balance will be updated from server response via wallet object
        // Don't manually update balance here, wait for server confirmation
        
        addToBetList(bets[playerIndex].amount, currentMultiplier, winAmount, false);
        
        bets[playerIndex].placed = false;
        bets[playerIndex].awaiting = false;
        bets[playerIndex].counter = null;
        bets[playerIndex].scope = null;
        bets[playerIndex].autoCashoutTriggered = false;
        updateButtonState(playerIndex, 'bet');
        
        
        const cashoutType = bets[playerIndex].autoCashoutTriggered ? 'AUTO-CASHED OUT!' : 'YOU HAVE CASHED OUT!';
        const multiplierText = `${currentMultiplier.toFixed(2)}X`;
        const currencySymbol = getCurrencySymbol(userCurrency);
        const winText = `WIN ${currencySymbol}${winAmount.toFixed(2)}`;
        showToast(`${cashoutType} ${multiplierText}`, 'success', 0); // Don't auto-hide
    } else {
        showToast('Connection error. Please try again.', 'error');
    }
}

// UI update functions
function updateButtonState(playerIndex, state) {
    const button = document.getElementById(`mainActionButton${playerIndex}`);
    const label = button.querySelector('.button-label');
    
    bets[playerIndex].buttonState = state;
    
    switch (state) {
        case 'bet':
            button.className = 'main-action-button bet-state';
            label.textContent = 'BET';
            button.disabled = false;
            updateButtonAmount(playerIndex, bets[playerIndex].amount.toFixed(2));
            break;
        case 'cancel':
            button.className = 'main-action-button cancel-state';
            label.textContent = 'CANCEL';
            button.disabled = false;
            updateButtonAmount(playerIndex, bets[playerIndex].amount.toFixed(2));
            break;
        case 'cashout':
            button.className = 'main-action-button cashout-state';
            label.textContent = 'CASH OUT';
            button.disabled = false;
            // Don't update amount here during progress - let handleProgressState control it
            if (gameState !== 'progress') {
                const cashoutValue = (bets[playerIndex].amount * currentMultiplier).toFixed(2);
                updateButtonAmount(playerIndex, cashoutValue);
            }
            break;
        case 'waiting':
            button.className = 'main-action-button bet-state';
            label.textContent = 'Waiting...';
            button.disabled = true;
            updateButtonAmount(playerIndex, bets[playerIndex].amount.toFixed(2));
            break;
        case 'waiting-next':
            button.className = 'main-action-button cancel-state';
            label.textContent = 'Next Round';
            button.disabled = false;
            updateButtonAmount(playerIndex, bets[playerIndex].amount.toFixed(2));
            break;
    }
    
    // Update bet controls based on new button state
    updateBetControls(playerIndex);
}

function updateButtonAmount(playerIndex, amount) {
    // Try multiple ways to find the amount element
    let amountElement = document.getElementById(`mainButtonAmount${playerIndex}`);
    
    if (!amountElement) {
        // Alternative: find via button element
        const button = document.getElementById(`mainActionButton${playerIndex}`);
        if (button) {
            amountElement = button.querySelector('.button-amount span');
        }
    }
    
    if (amountElement) {
        amountElement.textContent = `${amount}`;
    }
}

// New function to update all cashout button amounts with current multiplier
function updateAllCashoutAmounts() {
    for (let i = 1; i <= 2; i++) {
        // Check if button is actually showing "CASH OUT" text in the DOM
        const button = document.getElementById(`mainActionButton${i}`);
        const label = button?.querySelector('.button-label');
        
        if (button && label && label.textContent === 'CASH OUT' && gameState === 'progress') {
            const cashoutValue = (bets[i].amount * currentMultiplier).toFixed(2);
            
            // Try multiple ways to find the amount element
            let amountElement = document.getElementById(`mainButtonAmount${i}`);
            if (!amountElement) {
                // Alternative: find by class within the button
                amountElement = button.querySelector('.button-amount span');
            }
            if (!amountElement) {
                // Alternative: find any span within button-amount
                const buttonAmountEl = button.querySelector('.button-amount');
                if (buttonAmountEl) {
                    amountElement = buttonAmountEl.querySelector('span');
                }
            }
            
            if (amountElement) {
                amountElement.textContent = cashoutValue;
            } else {
                console.error(`Could not find amount element for button ${i}`);
            }
        }
    }
}

// Helper function to update multiplier display and cashout amounts together
function updateMultiplierDisplay(multiplier) {
    currentMultiplier = multiplier;
    elements.multiplierDisplay.textContent = multiplier.toFixed(2) + 'x';
    updateAllCashoutAmounts();
}

function updateGameStatus(state, message) {
    const statusElement = elements.gameStatus;
    statusElement.className = `game-status ${state}`;
    statusElement.textContent = message;
}

function updateBalance() {
    if (elements.balance) {
        elements.balance.textContent = userBalance.toFixed(2);
    }
}

// New comprehensive balance update function
function updateBalanceDisplay() {
    // Update the balance number
    if (elements.balance) {
        elements.balance.textContent = userBalance.toFixed(2);
    }
    
    // Update balance with currency symbol if currency is known
    if (userCurrency && userCurrency !== 'USD') {
        updateCurrency();
    }
    
    console.log(`💰 Balance display updated: ${getCurrencySymbol(userCurrency)}${userBalance.toFixed(2)}`);
}

function updateCurrency() {
    // Get currency symbol based on currency code
    const currencySymbol = getCurrencySymbol(userCurrency);
    
    // Update balance display with currency
    const balanceDiv = document.querySelector('.balance');
    if (balanceDiv) {
        balanceDiv.innerHTML = `${currencySymbol}<span id="balance">${userBalance.toFixed(2)}</span>`;
        // Update elements reference to the new balance element
        elements.balance = document.getElementById('balance');
    }
    
    // Update existing bet list items with new currency
    updateBetListCurrency();
    
    // Note: Button amounts should not show currency - they're handled by updateButtonAmount function
    // Sidebar bet list items show currency via addToBetList function using getCurrencySymbol
    
    console.log('💱 Currency updated to:', userCurrency);
}

// Function to update existing bet list items with correct currency
function updateBetListCurrency() {
    const betList = elements.betList;
    if (!betList) return;
    
    const currencySymbol = getCurrencySymbol(userCurrency);
    const betItems = betList.querySelectorAll('.bet-item');
    
    betItems.forEach(item => {
        const betAmountEl = item.querySelector('.bet-amount');
        const betWinEl = item.querySelector('.bet-win');
        
        if (betAmountEl) {
            // Extract the numeric amount and update with new currency
            const amountText = betAmountEl.textContent.replace(/[^\d.]/g, '');
            if (amountText) {
                betAmountEl.textContent = `${currencySymbol}${amountText}`;
            }
        }
        
        if (betWinEl) {
            // Extract the numeric amount and update with new currency, preserve +/- sign
            const winText = betWinEl.textContent;
            const isNegative = winText.startsWith('-');
            const winAmount = winText.replace(/[^\d.]/g, '');
            if (winAmount) {
                betWinEl.textContent = `${isNegative ? '-' : '+'}${currencySymbol}${winAmount}`;
            }
        }
    });
    
    console.log('💱 Updated bet list currency symbols to:', currencySymbol);
}

function getCurrencySymbol(currencyCode) {
    const currencySymbols = {
        'INR': '',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'FUN': 'P', // Gaming/Fun currency
        'BTC': '₿',
        'ETH': 'Ξ'
    };
    return currencySymbols[currencyCode] || currencyCode;
}

function showToast(message, type = 'info', duration = 3000) {
    const toast = elements.toast;
    if (!toast) return;
    
    // Clear existing content
    toast.innerHTML = '';
    
    // Create toast content structure
    const toastContent = document.createElement('div');
    toastContent.className = 'toast-content';
    
    // Special handling for cashout success message
    if (type === 'success' && message.includes('CASHED OUT')) {
        // Parse the message to extract parts
        const parts = message.split(' ');
        const cashoutType = parts.slice(0, -1).join(' '); // Everything except last part
        const multiplier = parts[parts.length - 1]; // Last part is multiplier
        
        // Create structured content
        toastContent.innerHTML = `
            <span>${cashoutType}</span>
            <span style="margin-left: auto; margin-right: 20px;">${multiplier}</span>
        `;
    } else {
        toastContent.textContent = message;
    }
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
        toast.classList.remove('show');
    };
    
    // Assemble toast
    toast.appendChild(toastContent);
    toast.appendChild(closeBtn);
    
    // Set type and show
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
}

// History functions
function addToHistory(multiplier) {
    roundCounter++;
    
    gameHistory.unshift({ round: roundCounter, multiplier: multiplier });
    
    if (gameHistory.length > 50) {
        gameHistory.pop();
    }
    
    addToHistoryTrail(multiplier);
}

function addToHistoryTrail(multiplier) {
    const historyItems = elements.historyItems;
    const historyItemsMobile = elements.historyItemsMobile;
    
    const item = document.createElement('div');
    item.className = `history-item ${getMultiplierClass(multiplier)}`;
    item.textContent = multiplier.toFixed(2) + 'x';
    
    if (historyItems) {
        historyItems.insertBefore(item.cloneNode(true), historyItems.firstChild);
        
        while (historyItems.children.length > 15) {
            historyItems.removeChild(historyItems.lastChild);
        }
        
        historyItems.scrollLeft = 0;
    }
    
    if (historyItemsMobile) {
        historyItemsMobile.insertBefore(item.cloneNode(true), historyItemsMobile.firstChild);
        
        while (historyItemsMobile.children.length > 15) {
            historyItemsMobile.removeChild(historyItemsMobile.lastChild);
        }
        
        historyItemsMobile.scrollLeft = 0;
    }
}

function toggleHistoryExpansion() {
    const historyTrail = elements.historyTrailInGame;
    if (historyTrail) {
        historyTrail.classList.toggle('expanded');
        
        const expandBtn = historyTrail.querySelector('.history-expand-btn span');
        if (expandBtn) {
            expandBtn.textContent = historyTrail.classList.contains('expanded') ? '✕' : '📊 HISTORY';
        }
    }
}

// Track bet item count for alternating colors
let betItemCount = 0;

function addToBetList(amount, multiplier, winAmount, crashed) {
    const betList = elements.betList;
    const item = document.createElement('div');
    
    // Alternate between 'bg' and 'loss' classes for visual variety
    betItemCount++;
    const isEven = betItemCount % 2 === 0;
    item.className = isEven ? 'bet-item bg' : 'bet-item loss';
    
    const multiplierText = `${multiplier.toFixed(2)}x`;
    const currencySymbol = getCurrencySymbol(userCurrency);
    const winAmountText = crashed ? `-${currencySymbol}${amount.toFixed(2)}` : `+${currencySymbol}${winAmount.toFixed(2)}`;
    
    item.innerHTML = `
        <div class="bet-amount">${currencySymbol}${amount.toFixed(2)}</div>
        <div class="bet-multiplier ${crashed ? 'crashed' : ''}">${multiplierText}</div>
        <div class="bet-win ${crashed ? 'loss' : 'profit'}">${winAmountText}</div>
    `;
    
    betList.insertBefore(item, betList.firstChild);
    
    while (betList.children.length > 20) {
        betList.removeChild(betList.lastChild);
    }
}

// Function to add sample bet history with correct currency
function addSampleBetHistory() {
    console.log('📊 Adding sample bet history with currency:', userCurrency);
    
    // Clear existing bet list first
    const betList = elements.betList;
    if (betList) {
        betList.innerHTML = '';
    }
    
    // Add sample bet history with current currency
    addToBetList(8000, 2.64, 21120, false);
    addToBetList(8000, 1.23, -8000, true);
    addToBetList(8000, 3.67, 29360, false);
    addToBetList(8000, 1.05, -8000, true);
    addToBetList(8000, 2.45, 19600, false);
    addToBetList(8000, 1.89, 15120, false);
}

function getMultiplierClass(multiplier) {
    if (multiplier >= 10) return 'high';
    if (multiplier >= 2) return 'medium';
    return 'low';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('visible');
}

// Event listeners with bet validation
document.getElementById('betAmount1').addEventListener('input', function() {
    // Prevent changes if bet is already placed
    if (bets[1].placed) {
        this.value = bets[1].amount.toFixed(2);
        showToast('Cannot change bet amount after placing bet', 'error');
        return;
    }
    
    let value = parseFloat(this.value) || MIN_BET_AMOUNT;
    
    // Apply bet limits
    if (value > MAX_BET_AMOUNT) {
        value = MAX_BET_AMOUNT;
        this.value = value.toFixed(2);
        showToast(`Maximum bet amount is ${getCurrencySymbol(userCurrency)}${MAX_BET_AMOUNT}`, 'warning');
    } else if (value < MIN_BET_AMOUNT) {
        value = MIN_BET_AMOUNT;
        this.value = value.toFixed(2);
    }
    
    bets[1].amount = value;
    updateButtonAmount(1, value.toFixed(2));
});

document.getElementById('betAmount2').addEventListener('input', function() {
    // Prevent changes if bet is already placed
    if (bets[2].placed) {
        this.value = bets[2].amount.toFixed(2);
        showToast('Cannot change bet amount after placing bet', 'error');
        return;
    }
    
    let value = parseFloat(this.value) || MIN_BET_AMOUNT;
    
    // Apply bet limits
    if (value > MAX_BET_AMOUNT) {
        value = MAX_BET_AMOUNT;
        this.value = value.toFixed(2);
        showToast(`Maximum bet amount is ${getCurrencySymbol(userCurrency)}${MAX_BET_AMOUNT}`, 'warning');
    } else if (value < MIN_BET_AMOUNT) {
        value = MIN_BET_AMOUNT;
        this.value = value.toFixed(2);
    }
    
    bets[2].amount = value;
    updateButtonAmount(2, value.toFixed(2));
});

document.getElementById('autoCashoutValue1').addEventListener('input', function() {
    updateAutoCashout(1);
});

document.getElementById('autoCashoutValue2').addEventListener('input', function() {
    updateAutoCashout(2);
});

// Initialize the game
function initializeGame() {
    console.log('🎮 Initializing FlyHigh Game with PixiJS...');
    
    // Check PixiJS status first
    checkPixiJSStatus();
    
    updateBalanceDisplay();
    
    if (elements.countdownContainer) {
        elements.countdownContainer.classList.add('hidden');
    }
    
    for (let i = 1; i <= 2; i++) {
        updateButtonState(i, 'bet');
        setBetMode('bet', i);
    }
    
    // Initialize systems
    if (window.soundManager) {
        window.soundManager.preloadSounds();
    }
    
    // Reset rocket animation using the animation interface
    const rocketAnimation = getRocketAnimation();
    rocketAnimation.reset();
    
    initializeWebSocket();
    
    // Add sample history
    const sampleMultipliers = [6.94, 2.44, 2.94, 3.34, 6.94, 49.1, 6.94, 6.94, 6.94, 6.94, 6.94, 6.94, 2.45, 1.23, 3.67];
    sampleMultipliers.forEach(multiplier => {
        addToHistory(multiplier);
    });
    
    // Sample bet history will be added after authentication when currency is known
    
    console.log('✅ Game initialization complete');
}

// Enhanced cleanup function
function cleanup() {
    const rocketAnimation = getRocketAnimation();
    rocketAnimation.stop();
    
    if (window.soundManager) {
        window.soundManager.stopBackgroundMusic();
        window.soundManager.stopPlaneSound();
    }
    
    hideCountdownLoader();
    
    gameState = 'connecting';
    currentMultiplier = 1.00;
    gameStarted = false;
    
    gameHistory = [];
    
    console.log('🧹 Cleanup completed');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const historyToggle = document.querySelector('.history-toggle');
    
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !menuToggle.contains(e.target) && 
        !historyToggle.contains(e.target) &&
        sidebar.classList.contains('visible')) {
        sidebar.classList.remove('visible');
    }
});

// Enhanced page visibility handling - fixed tab switching animation queue issue
let isTabVisible = true;
let lastVisibilityState = true;

document.addEventListener('visibilitychange', function() {
    const currentVisibility = !document.hidden;
    
    // Only process if visibility actually changed
    if (currentVisibility !== lastVisibilityState) {
        isTabVisible = currentVisibility;
        lastVisibilityState = currentVisibility;
        
        console.log(`👁️ Tab visibility changed to: ${isTabVisible}`);
        
        if (document.hidden) {
            console.log('📱 Page hidden - pausing animations and sounds');
            const rocketAnimation = getRocketAnimation();
            if (rocketAnimation.pauseAnimation) {
                rocketAnimation.pauseAnimation();
            }
            hideCountdownLoader();
            
            if (window.soundManager) {
                window.soundManager.pauseAllSounds();
            }
        } else {
            console.log('📱 Page visible - resuming animations and sounds');
            const rocketAnimation = getRocketAnimation();
            if (rocketAnimation.resumeAnimation) {
                rocketAnimation.resumeAnimation();
            }
            
            // Resume countdown if in pause state with remaining time
            if (gameState === 'pause' && countdown > 0 && countdown <= 5) {
                showCountdownLoader(countdown);
            }
            
            if (window.soundManager) {
                window.soundManager.resumeAllSounds();
            }
            
            // Reconnect if socket is closed
            if (socket && socket.readyState !== WebSocket.OPEN) {
                initializeWebSocket();
            }
        }
    }
});

// Additional blur/focus handlers for backup - DISABLED to prevent animation stopping when clicking dev tools
// window.addEventListener('blur', function() {
//     if (isTabVisible) {
//         isTabVisible = false;
//         console.log('🔄 Window blur detected');
//     }
// });

// window.addEventListener('focus', function() {
//     if (!isTabVisible) {
//         isTabVisible = true;
//         console.log('🔄 Window focus detected');
//     }
// });

// Unfinished game handling
function saveGameState() {
    const gameData = {
        timestamp: Date.now(),
        gameState: gameState,
        currentMultiplier: currentMultiplier,
        bets: bets,
        roundCounter: roundCounter,
        gameStarted: gameStarted
    };
    localStorage.setItem('aviatorGameState', JSON.stringify(gameData));
}

function loadGameState() {
    try {
        const savedData = localStorage.getItem('aviatorGameState');
        if (!savedData) return false;
        
        const gameData = JSON.parse(savedData);
        const timeDiff = Date.now() - gameData.timestamp;
        
        // Only restore if saved less than 10 minutes ago and game was in progress
        if (timeDiff < 600000 && (gameData.gameState === 'progress' || gameData.gameState === 'pause')) {
            // Restore critical game state
            if (gameData.gameState === 'progress') {
                showToast('Previous game session detected - Will sync when server updates received', 'info');
                
                // Don't immediately set to pause - let the server determine current state
                // Just restore the saved multiplier as a reference
                const savedMultiplier = gameData.currentMultiplier || 1.0;
                console.log(`📦 Restored game state - was at ${savedMultiplier.toFixed(2)}x`);
                
                // Restore placed bets but keep them in a pending state until server confirms
                Object.keys(gameData.bets).forEach(playerIndex => {
                    if (gameData.bets[playerIndex].placed && !gameData.bets[playerIndex].cashedOut) {
                        bets[playerIndex] = { ...gameData.bets[playerIndex] };
                        // Keep bet state as-is - server will update the button state
                        console.log(`📦 Restored bet for player ${playerIndex}: ${getCurrencySymbol(userCurrency)}${bets[playerIndex].amount}`);
                    }
                });
            } else if (gameData.gameState === 'pause') {
                // Restore bet amounts but not placed status
                Object.keys(gameData.bets).forEach(playerIndex => {
                    if (gameData.bets[playerIndex].amount) {
                        bets[playerIndex].amount = gameData.bets[playerIndex].amount;
                        document.getElementById(`betAmount${playerIndex}`).value = bets[playerIndex].amount.toFixed(2);
                        updateButtonAmount(playerIndex, bets[playerIndex].amount.toFixed(2));
                    }
                });
                showToast('Bet amounts restored from previous session', 'info');
            }
            
            return true;
        }
    } catch (error) {
        console.error('Failed to load game state:', error);
    }
    
    // Clear old/invalid saved state
    localStorage.removeItem('aviatorGameState');
    return false;
}

function clearSavedGameState() {
    localStorage.removeItem('aviatorGameState');
}

// Enhanced window beforeunload with game state saving
window.addEventListener('beforeunload', function() {
    // Save game state if there are active bets or game in progress
    if ((gameState === 'progress' || gameState === 'pause') && 
        (bets[1].placed || bets[2].placed || bets[1].amount > 0 || bets[2].amount > 0)) {
        saveGameState();
    }
    
    cleanup();
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
});

// Handle window resize with PixiJS integration
window.addEventListener('resize', function() {
    const rocketAnimation = getRocketAnimation();
    if (rocketAnimation.updateCanvasDimensions) {
        rocketAnimation.updateCanvasDimensions();
    }
});

// Enhanced keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Space bar to bet/cashout on first bet section
    if (e.code === 'Space' && !e.target.matches('input')) {
        e.preventDefault();
        handleMainAction(1);
    }
    
    // Enter to bet/cashout on second bet section
    if (e.code === 'Enter' && !e.target.matches('input')) {
        e.preventDefault();
        handleMainAction(2);
    }
    
    // Escape to cancel bets
    if (e.code === 'Escape') {
        e.preventDefault();
        for (let i = 1; i <= 2; i++) {
            if (bets[i].buttonState === 'cancel') {
                cancelBet(i);
            }
        }
    }
    
    // M key to toggle sound
    if (e.code === 'KeyM' && !e.target.matches('input')) {
        e.preventDefault();
        if (window.soundManager) {
            const enabled = window.soundManager.toggleSound();
            showToast(`Sound ${enabled ? 'enabled' : 'disabled'}`, 'info');
        }
    }
    
    // P key to check PixiJS status (debug)
    if (e.code === 'KeyP' && !e.target.matches('input') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const rocketAnimation = getRocketAnimation();
        const state = rocketAnimation.getState();
        console.log('🎮 Animation System Status:', state);
        showToast(`Animation: ${state.usingFallback ? 'DOM' : 'PixiJS'}`, 'info');
    }
});

// Touch events for mobile optimization
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', function(e) {
    touchStartY = e.changedTouches[0].screenY;
});

document.addEventListener('touchend', function(e) {
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;
    const sidebar = document.getElementById('sidebar');
    
    if (window.innerWidth <= 768) {
        if (touchStartY < touchEndY - swipeThreshold) {
            sidebar.classList.add('visible');
        }
        if (touchStartY > touchEndY + swipeThreshold) {
            sidebar.classList.remove('visible');
        }
    }
}

// Enhanced error handling
window.addEventListener('error', function(e) {
    console.error('💥 Global error:', e.error);
    showToast('An error occurred. Please refresh the page.', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('💥 Unhandled promise rejection:', e.reason);
    showToast('Connection error. Trying to reconnect...', 'error');
});

// Network status monitoring
window.addEventListener('online', function() {
    console.log('🌐 Back online');
    showToast('Connection restored', 'success');
    if (socket && socket.readyState !== WebSocket.OPEN) {
        initializeWebSocket();
    }
});

window.addEventListener('offline', function() {
    console.log('📴 Gone offline');
    showToast('Connection lost', 'error');
});

// PixiJS System Ready Check
function waitForPixiJS() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 20; // Maximum 10 seconds (20 * 500ms)
        
        const checkInterval = setInterval(() => {
            attempts++;
            const isReady = checkPixiJSStatus();
            
            if (isReady || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                
                if (attempts >= maxAttempts) {
                    console.warn('⚠️ PixiJS initialization timeout, using fallback');
                    // Force fallback mode
                    pixiJSReady = false;
                    animationSystemReady = false;
                    elements.gameCanvas.classList.add('pixijs-fallback');
                    if (elements.rocket) elements.rocket.style.display = 'block';
                    if (elements.trailContainer) elements.trailContainer.style.display = 'block';
                }
                
                resolve();
            }
        }, 500);
    });
}

// Enhanced initialization sequence
async function enhancedInitialization() {
    console.log('🎮 Starting enhanced initialization sequence...');
    
    // Wait for PixiJS to be ready
    await waitForPixiJS();
    
    // Load saved game state before initializing
    const stateRestored = loadGameState();
    if (stateRestored) {
        console.log('🔄 Game state restored from previous session');
    }
    
    // Initialize bet controls state
    updateBetControls(1);
    updateBetControls(2);
    
    // Initialize currency display (will be updated when server responds)
    updateBalanceDisplay();
    
    // Initialize the game
    initializeGame();
    
    console.log('✅ Enhanced initialization complete');
}

// Start the game when page loads
window.addEventListener('load', enhancedInitialization);

if (document.readyState === 'complete') {
    enhancedInitialization();
}

// Final initialization check
setTimeout(() => {
    if (gameState === 'connecting') {
        console.log('🔄 Initialization check: Still connecting after 10 seconds');
        updateGameStatus('crashed', 'Connection timeout');
        showToast('Connection timeout. Please refresh the page.', 'error');
    }
}, 10000);

// Debug functions (available in console)
window.gameDebug = {
    diagnose: () => {
        console.log('🔍 Running comprehensive system diagnostics...');
        const issues = [];
        const system = window.gameDebug.getCurrentAnimationSystem();
        
        // Check PixiJS availability
        if (typeof PIXI === 'undefined') {
            issues.push('PixiJS library is not loaded');
        }
        
        // Check animation system
        if (!animationSystemReady) {
            issues.push('Animation system is not ready');
        }
        
        // Check rocket animation
        const rocketAnimation = getRocketAnimation();
        const state = rocketAnimation.getState();
        
        if (state.usingFallback) {
            issues.push('Using DOM fallback instead of PixiJS');
        }
        
        if (!state.appReady) {
            issues.push('PixiJS app is not ready');
        }
        
        if (!state.textureLoaded) {
            issues.push('Rocket texture failed to load');
        }
        
        console.log('🎮 System Status:', {
            pixiJSAvailable: typeof PIXI !== 'undefined',
            animationSystemReady: animationSystemReady,
            gameState: gameState,
            currentMultiplier: currentMultiplier,
            isTabVisible: isTabVisible,
            system: system
        });
        
        console.log('🚀 Rocket State:', state);
        
        if (issues.length > 0) {
            console.warn('⚠️ Issues detected:', issues);
        } else {
            console.log('✅ All systems operational');
        }
        
        return { system, state, issues };
    },
    getState: () => ({
        gameState,
        currentMultiplier,
        pixiJSReady,
        animationSystemReady,
        crashSequenceActive,
        isTabVisible,
        rocketAnimationState: getRocketAnimation().getState()
    }),
    checkPixiJS: checkPixiJSStatus,
    forcePixiFallback: () => {
        pixiJSReady = false;
        animationSystemReady = false;
        checkPixiJSStatus();
    },
    toggleRocketDebug: () => {
        const rocketAnimation = getRocketAnimation();
        if (rocketAnimation.toggleDebugVisibility) {
            rocketAnimation.toggleDebugVisibility();
        } else {
            console.log('Debug visibility not available for current animation system');
        }
    },
    forceRocketVisible: () => {
        const rocketAnimation = getRocketAnimation();
        if (rocketAnimation.forceRocketVisible) {
            rocketAnimation.forceRocketVisible();
        } else {
            console.log('Force rocket visible not available for current animation system');
        }
    },
    testRocket: () => {
        console.log('🧪 Testing rocket visibility and movement...');
        const rocketAnimation = getRocketAnimation();
        
        // Force rocket visible first
        if (rocketAnimation.forceRocketVisible) {
            rocketAnimation.forceRocketVisible();
        }
        
        // Start animation system
        rocketAnimation.start(1.0);
        
        // Test progressive movement
        setTimeout(() => {
            console.log('🧪 Starting progressive movement test...');
            const multipliers = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
            
            multipliers.forEach((mult, index) => {
                setTimeout(() => {
                    rocketAnimation.updatePosition(mult);
                    console.log(`🚀 Test: Rocket moved to ${mult.toFixed(1)}x`);
                    
                    // Check if rocket is actually visible and moving
                    const state = rocketAnimation.getState();
                    if (state.rocketVisible) {
                        console.log(`✅ Rocket visible at position: (${state.position.x.toFixed(0)}, ${state.position.y.toFixed(0)})`);
                        console.log(`✨ Stars active: ${state.stars}`);
                    } else {
                        console.warn(`⚠️ Rocket not visible at ${mult.toFixed(1)}x`);
                    }
                }, index * 800);
            });
        }, 1000);
        
        // Test crash animation
        setTimeout(() => {
            console.log('🧪 Testing crash animation...');
            rocketAnimation.crash();
        }, 8000);
        
        // Reset after test
        setTimeout(() => {
            console.log('🧪 Resetting after test...');
            rocketAnimation.reset();
        }, 12000);
    },
    
    testStars: () => {
        console.log('✨ Testing star animation system...');
        const rocketAnimation = getRocketAnimation();
        
        try {
            if (rocketAnimation.createStarField) {
                rocketAnimation.createStarField();
                
                const state = rocketAnimation.getState();
                console.log(`✨ Created ${state.stars} stars`);
                console.log('✨ Stars should be moving from left-top to right-bottom');
                console.log('✨ Watch the animation for 10 seconds...');
                
                // Monitor star count over time
                let monitorCount = 0;
                const monitor = setInterval(() => {
                    const currentState = rocketAnimation.getState();
                    console.log(`✨ Monitor ${++monitorCount}: ${currentState.stars} stars active`);
                    
                    if (monitorCount >= 10) {
                        clearInterval(monitor);
                        console.log('✨ Star monitoring complete');
                    }
                }, 1000);
            } else {
                console.warn('⚠️ Star field creation not available');
            }
        } catch (error) {
            console.error('❌ Error testing stars:', error);
            console.log('💡 Try: gameDebug.forceRocketVisible() first');
        }
    },
    getCurrentAnimationSystem: () => {
        const rocketAnimation = getRocketAnimation();
        const state = rocketAnimation.getState();
        return {
            system: state.usingFallback ? 'DOM (Fallback)' : 'PixiJS (Canvas)',
            pixiVersion: typeof PIXI !== 'undefined' ? PIXI.VERSION : 'Not loaded',
            ready: animationSystemReady,
            tabVisible: isTabVisible,
            state: state
        };
    }
};

console.log('🎮 FlyHigh Crash Game with Enhanced PixiJS Integration Loaded Successfully!');
console.log('💡 Debug Commands:');
console.log('  gameDebug.diagnose() - Run comprehensive diagnostics');
console.log('  gameDebug.getState() - Get current game and animation state');
console.log('  gameDebug.getCurrentAnimationSystem() - Check which animation system is active');
console.log('  gameDebug.toggleRocketDebug() - Toggle rocket debug visibility (red circle)');
console.log('  gameDebug.forceRocketVisible() - Force rocket to be visible');
console.log('  gameDebug.testRocket() - Run comprehensive rocket animation test');
console.log('  gameDebug.testStars() - Test star animation system');
console.log('💡 Keyboard shortcuts:');
console.log('  Ctrl/Cmd+P - Quick animation system status');
console.log('  Space - Bet/Cashout (Player 1)');
console.log('  Enter - Bet/Cashout (Player 2)');
console.log('  M - Toggle sound');
console.log('  Escape - Cancel bets');

// Auto-run diagnostics after initialization
setTimeout(() => {
    console.log('🔧 Auto Diagnostic Report:');
    const diagnostic = window.gameDebug.diagnose();
    
    if (diagnostic.issues.length === 0) {
        console.log('✅ PixiJS Animation System appears to be working correctly!');
        console.log(`✨ Stars active: ${diagnostic.system.state.stars || 0}`);
        console.log('💡 If you\'re not seeing the rocket, try:');
        console.log('  1. gameDebug.forceRocketVisible()');
        console.log('  2. gameDebug.testRocket()');
        console.log('💡 To test star animation:');
        console.log('  1. gameDebug.testStars()');
    } else {
        console.log('⚠️ Issues detected - see diagnostic output above');
    }
}, 3000);

// Settings Sidebar Functions
function toggleSettingsSidebar() {
    const sidebar = document.getElementById('settingsSidebar');
    const overlay = document.getElementById('menuOverlay');
    
    if (sidebar && overlay) {
        const isVisible = sidebar.classList.contains('visible');
        
        if (isVisible) {
            sidebar.classList.remove('visible');
            overlay.classList.remove('visible');
        } else {
            sidebar.classList.add('visible');
            overlay.classList.add('visible');
        }
        
        console.log('🔧 Settings sidebar toggled');
    }
}

function toggleSound() {
    settingsState.sound = !settingsState.sound;
    const toggle = document.getElementById('soundToggle');
    const toggleSwitch = toggle.parentElement;
    
    if (settingsState.sound) {
        toggleSwitch.classList.add('active');
    } else {
        toggleSwitch.classList.remove('active');
        if (window.soundManager) {
            window.soundManager.stopPlaneSound();
        }
    }
    
    console.log(`🔊 Sound ${settingsState.sound ? 'enabled' : 'disabled'}`);
}

function toggleMusic() {
    settingsState.music = !settingsState.music;
    const toggle = document.getElementById('musicToggle');
    const toggleSwitch = toggle.parentElement;
    
    if (settingsState.music) {
        toggleSwitch.classList.add('active');
        if (window.soundManager) {
            window.soundManager.playBackgroundMusic();
        }
    } else {
        toggleSwitch.classList.remove('active');
        if (window.soundManager) {
            window.soundManager.stopBackgroundMusic();
        }
    }
    
    console.log(`🎵 Music ${settingsState.music ? 'enabled' : 'disabled'}`);
}

function toggleAnimation() {
    settingsState.animation = !settingsState.animation;
    const toggle = document.getElementById('animationToggle');
    const toggleSwitch = toggle.parentElement;
    
    if (settingsState.animation) {
        toggleSwitch.classList.add('active');
        // Show rocket animation
        if (window.rocketAnimation) {
            window.rocketAnimation.showRocket();
        }
    } else {
        toggleSwitch.classList.remove('active');
        // Hide rocket animation, show only multiplier
        if (window.rocketAnimation) {
            window.rocketAnimation.hideRocket();
        }
    }
    
    console.log(`🎬 Animation ${settingsState.animation ? 'enabled' : 'disabled'}`);
}

// Game Rules Functions
function showGameRules() {
    const modal = document.getElementById('gameRulesModal');
    if (modal) {
        modal.classList.add('visible');
        console.log('📖 Game rules modal opened');
    }
}

function closeGameRules() {
    const modal = document.getElementById('gameRulesModal');
    if (modal) {
        modal.classList.remove('visible');
        console.log('📖 Game rules modal closed');
    }
}

// Placeholder functions for other settings links
function showFreeBets() {
    console.log('🎁 Free Bets clicked');
    
    // Create and show the Free Bets Management modal
    const modal = document.createElement('div');
    modal.className = 'free-bets-modal';
    modal.innerHTML = `
        <div class="free-bets-content">
            <div class="free-bets-header">
                <h3>Free bets Management</h3>
                <button class="close-btn" onclick="closeFreeBets()">×</button>
            </div>
            <div class="free-bets-body">
                <div class="play-with-cash-section">
                    <div class="radio-option selected auto-cashout-checkbox">
                        <input class="auto-cashout-input" type="checkbox" id="playWithCash" name="betMode" checked>
                        <label for="playWithCash">Play with Cash</label>
                    </div>
                   
                </div>
                <div class="active-free-bets-section">
                    <div class="section-header">
                        <h4>Active Free bets</h4>
                        <div class="archive-btn">
                            <img src="./assets/images/history-grey.svg" alt="History" style="width: 16px; height: 16px;">
                            Archive
                        </div>
                    </div>
                    <div class="free-bets-list">
                        <!-- Empty state - no active free bets -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show modal with animation
    setTimeout(() => {
        modal.classList.add('visible');
    }, 10);
    
    // Add auto-cashout functionality using the same logic as main game
    const autoCashoutCheckbox = modal.querySelector('#freeBetsAutoCashout');
    const autoCashoutInput = modal.querySelector('#freeBetsAutoCashoutValue');
    const autoCashoutSection = modal.querySelector('.auto-cashout-section');
    
    // Handle checkbox change - same logic as main game
    autoCashoutCheckbox.addEventListener('change', function() {
        // Enable/disable input based on checkbox
        autoCashoutInput.disabled = !this.checked;
        
        // Update visual feedback
        autoCashoutSection.classList.toggle('enabled', this.checked);
        
        console.log(`🤖 Free Bets Auto-cashout ${this.checked ? 'enabled' : 'disabled'}`);
    });
    
    // Handle input validation
    autoCashoutInput.addEventListener('input', function() {
        let value = parseFloat(this.value);
        if (value < 1.01) {
            this.value = '1.01';
        } else if (value > 1000) {
            this.value = '1000';
        }
    });
    
    // Initial state - same as main game
    autoCashoutInput.disabled = !autoCashoutCheckbox.checked;
}

function closeFreeBets() {
    const modal = document.querySelector('.free-bets-modal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    }
}

function showGameRoom() {
    console.log('🏠 Game Room clicked');
    
    // Create and show the Change Room modal
    const modal = document.createElement('div');
    modal.className = 'change-room-modal';
    modal.innerHTML = `
        <div class="change-room-content">
            <div class="change-room-header">
                <h3>Change Room</h3>
                <button class="close-btn" onclick="closeGameRoom()">×</button>
            </div>
            <div class="change-room-body">
                <div class="warning-message">
                    <p>Changing the room will restart the game.</p>
                    <p>Do you wish to continue?</p>
                </div>
                <div class="room-selection">
                    <div class="room-option selected">
                        <input type="radio" id="room1" name="room" checked>
                        <label for="room1">Room 1</label>
                    </div>
                    <div class="room-option">
                        <input type="radio" id="room2" name="room">
                        <label for="room2">Room 2</label>
                    </div>
                </div>
                <div class="change-room-actions">
                    <button class="change-btn" onclick="confirmRoomChange()">Change</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show modal with animation
    setTimeout(() => {
        modal.classList.add('visible');
    }, 10);
    
    // Add room selection functionality
    const roomOptions = modal.querySelectorAll('.room-option');
    roomOptions.forEach(option => {
        option.addEventListener('click', () => {
            roomOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
}

function closeGameRoom() {
    const modal = document.querySelector('.change-room-modal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    }
}

function confirmRoomChange() {
    const selectedRoom = document.querySelector('.room-option.selected input').id;
    console.log(`🏠 Room changed to: ${selectedRoom}`);
    
    // Update the menu text to reflect the selected room
    const gameRoomLink = document.querySelector('.setting-link[onclick="showGameRoom()"]');
    if (gameRoomLink) {
        const roomNumber = selectedRoom === 'room1' ? '1' : '2';
        gameRoomLink.textContent = `Game Room: Room #${roomNumber}`;
    }
    
    // Close the modal
    closeGameRoom();
    
    // Show success message
    showToast(`Successfully switched to ${selectedRoom === 'room1' ? 'Room 1' : 'Room 2'}`, 'success');
}

function showBetHistory() {
    // Check if mobile device
    if (window.innerWidth <= 768) {
        showMobileBetHistory();
    } else {
        const modal = document.getElementById('betHistoryModal');
        if (modal) {
            modal.classList.add('visible');
            populateBetHistory();
            console.log('📊 Bet History modal opened');
        }
    }
}

function closeBetHistory() {
    const modal = document.getElementById('betHistoryModal');
    if (modal) {
        modal.classList.remove('visible');
        console.log('📊 Bet History modal closed');
    }
}

function populateBetHistory() {
    const entriesContainer = document.getElementById('betHistoryEntries');
    if (!entriesContainer) return;
    
    // Sample bet history data
    const betHistory = [
        { date: '16:21 03-04-25', bet: 100.01, multiplier: 6.94, cashout: 1781.79 },
        { date: '16:20 03-04-25', bet: 100.01, multiplier: 6.94, cashout: 1781.79 },
        { date: '16:19 03-04-25', bet: 100.01, multiplier: 6.94, cashout: 1781.79 },
        { date: '16:18 03-04-25', bet: 100.01, multiplier: 6.94, cashout: 1781.79 }
    ];
    
    entriesContainer.innerHTML = '';
    
    betHistory.forEach((entry, index) => {
        const betEntry = document.createElement('div');
        betEntry.className = 'bet-entry';
        // if (index === 2) betEntry.classList.add('selected'); // Highlight third entry
        
        betEntry.innerHTML = `
            <div class="bet-date">${entry.date}</div>
            <div class="bet-amount">
                <span class="bet-value">${entry.bet.toFixed(2)}</span>
                <span class="multiplier-badge">${entry.multiplier}x</span>
            </div>
            <div class="cashout-amount">
                <span>${entry.cashout.toLocaleString()}</span>
                <div class="bet-actions">
                    <div class="action-icon shield-icon"></div>
                    <div class="action-icon chat-icon"></div>
                </div>
            </div>
        `;
        
        entriesContainer.appendChild(betEntry);
    });
}

// Mobile Bet History Functions
function showMobileBetHistory() {
    // Remove existing mobile modal if present
    const existingModal = document.getElementById('mobileBetHistoryModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create mobile bet history modal
    const modal = document.createElement('div');
    modal.id = 'mobileBetHistoryModal';
    modal.className = 'mobile-bet-history-modal';
    modal.innerHTML = `
        <div class="mobile-bet-history-content">
            <div class="mobile-bet-history-status-bar"></div>
            <div class="mobile-bet-history-header">
                <div class="main-tabs">
                    <div class="tab-btn" data-tab="all">All Bets</div>
                    <div class="tab-btn" data-tab="my">My Bets</div>
                    <div class="tab-btn active" data-tab="top">Top</div>
                </div>
                <div class="close-btn" onclick="closeMobileBetHistory()">×</div>
            </div>
            
            <div class="mobile-bet-history-body">
                <!-- Win Filters -->
                <div class="win-filters">
                    <div class="filter-btn active" data-filter="huge">Huge Wins</div>
                    <div class="filter-btn" data-filter="biggest">Biggest Wins</div>
                    <div class="filter-btn" data-filter="multipliers">Multipliers</div>
                </div>
                
                <!-- Date Filters -->
                <div class="date-filters">
                    <div class="filter-btn" data-filter="day">Day</div>
                    <div class="filter-btn active" data-filter="month">Month</div>
                    <div class="filter-btn" data-filter="year">Year</div>
                </div>
                
                <!-- Bet Records -->
                <div class="bet-records-container">
                    <div class="bet-records-list" id="mobileBetRecordsList">
                        <!-- Bet records will be populated here -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    setupMobileBetHistoryTabs();
    populateMobileBetHistory();
    
    // Show modal
    setTimeout(() => {
        modal.classList.add('visible');
    }, 10);
    
    console.log('📱 Mobile Bet History modal opened');
}

function closeMobileBetHistory() {
    const modal = document.getElementById('mobileBetHistoryModal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.remove();
        }, 300);
        console.log('📱 Mobile Bet History modal closed');
    }
}

function setupMobileBetHistoryTabs() {
    // Main tabs
    const mainTabs = document.querySelectorAll('.main-tabs .tab-btn');
    mainTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            mainTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            populateMobileBetHistory();
        });
    });
    
    // Win filters
    const winFilters = document.querySelectorAll('.win-filters .filter-btn');
    winFilters.forEach(filter => {
        filter.addEventListener('click', function() {
            winFilters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            populateMobileBetHistory();
        });
    });
    
    // Date filters
    const dateFilters = document.querySelectorAll('.date-filters .filter-btn');
    dateFilters.forEach(filter => {
        filter.addEventListener('click', function() {
            dateFilters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            populateMobileBetHistory();
        });
    });
}

function populateMobileBetHistory() {
    const recordsList = document.getElementById('mobileBetRecordsList');
    if (!recordsList) return;
    
    // Sample bet records data - matching the image exactly
    const betRecords = [
        {
            username: 'N**5',
            avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM4QjQ1M0QiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
            betAmount: 28.20,
            cashoutMultiplier: 6675.17,
            winAmount: 188283.81,
            date: '03 apr',
            roundId: '20045.97x',
            hasTarget: false
        },
        {
            username: 'N**5',
            avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM4QjQ1M0QiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
            betAmount: 15.50,
            cashoutMultiplier: 3456.78,
            winAmount: 53580.09,
            date: '02 apr',
            roundId: '19876.23x',
            hasTarget: true
        },
        {
            username: 'N**5',
            avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM4QjQ1M0QiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
            betAmount: 42.80,
            cashoutMultiplier: 1234.56,
            winAmount: 52839.17,
            date: '01 apr',
            roundId: '19765.44x',
            hasTarget: false
        }
    ];
    
    recordsList.innerHTML = '';
    
    betRecords.forEach(record => {
        const recordCard = document.createElement('div');
        recordCard.className = 'bet-record-card';
        
        recordCard.innerHTML = `
            <div class="record-left">
                <div class="user-avatar">
                    <img src="${record.avatar}" alt="User Avatar">
                </div>
                <div class="username">${record.username}</div>
            </div>
            <div class="record-right">
                <div class="bet-info">
                    <div class="bet-amount">
                        <span class="bet-amount-label">Bet INR</span>
                        <span class="bet-amount-value">${record.betAmount.toFixed(2)}</span>
                    </div>
                    <div class="cashout-info">
                        <span class="cashout-label">Cashed out</span>
                        <span class="cashout-multiplier">${record.cashoutMultiplier.toFixed(2)}x</span>
                    </div>
                    <div class="win-info">
                        <span class="win-label">Win INR</span>
                        <div style="display: flex; align-items: center;">
                            <span class="win-amount">${record.winAmount.toLocaleString()}</span>
                            ${record.hasTarget ? '<div class="target-icon"></div>' : ''}
                        </div>
                    </div>
                </div>
                <div class="record-bottom">
                    <div style="display: flex; align-items: center;">
                        <span class="record-date">${record.date}</span>
                        <span class="round-info">Round : ${record.roundId}</span>
                    </div>
                    <div class="record-actions">
                        <div class="action-icon shield-icon"></div>
                        <div class="action-icon chat-icon"></div>
                    </div>
                </div>
            </div>
        `;
        
        recordsList.appendChild(recordCard);
    });
}



function showGameLimits() {
    console.log('⚖️ Game Limits clicked');
    // TODO: Implement game limits functionality
}

// Avatar Selection Functions
function showAvatarModal() {
    const modal = document.getElementById('avatarModal');
    if (modal) {
        modal.classList.add('visible');
        populateAvatarGrid();
        console.log('👤 Avatar selection modal opened');
    }
}

function closeAvatarModal() {
    const modal = document.getElementById('avatarModal');
    if (modal) {
        modal.classList.remove('visible');
        console.log('👤 Avatar selection modal closed');
    }
}

function populateAvatarGrid() {
    const avatarGrid = document.getElementById('avatarGrid');
    if (!avatarGrid) return;
    
    // Sample avatar options (SVG data URLs)
    const avatarOptions = [
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMzMzMiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM0Q0FGNTAiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNGRjU3MjIiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM5QzI3QjAiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNGRjk4MDAiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo=',
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiMwMEJGRkYiLz4KPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iNiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNOCAzNGMwLTYuNjI3IDUuMzczLTEyIDEyLTEyczEyIDUuMzczIDEyIDEyIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo='
    ];
    
    avatarGrid.innerHTML = '';
    
    avatarOptions.forEach((avatarSrc, index) => {
        const avatarOption = document.createElement('div');
        avatarOption.className = 'avatar-option';
        
        // Check if this avatar matches the current user avatar
        if (avatarSrc === userState.avatar) {
            avatarOption.classList.add('selected');
        }
        
        avatarOption.innerHTML = `<img src="${avatarSrc}" alt="Avatar ${index + 1}">`;
        
        avatarOption.addEventListener('click', () => {
            // Remove selected class from all options
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            // Add selected class to clicked option
            avatarOption.classList.add('selected');
            
            // Update user state
            userState.avatar = avatarSrc;
            
            // Update all avatar instances
            updateUserAvatar(avatarSrc);
            
            console.log(`👤 Avatar ${index + 1} selected`);
        });
        
        avatarGrid.appendChild(avatarOption);
    });
}

// User Avatar Management Functions
function updateUserAvatar(avatarSrc) {
    // Update sidebar avatar
    const sidebarAvatar = document.getElementById('currentUserAvatar');
    if (sidebarAvatar) {
        sidebarAvatar.src = avatarSrc;
    }
    
    // Update header avatar
    const headerAvatar = document.getElementById('headerUserAvatar');
    if (headerAvatar) {
        headerAvatar.src = avatarSrc;
    }
    
    // Send avatar update to server (if connected)
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'updateAvatar',
            avatar: avatarSrc
        }));
    }
}

// Server Response Functions
function updateUserNameFromServer(userName) {
    userState.name = userName;
    
    // Update header user name
    const userNameDisplay = document.getElementById('userNameDisplay');
    if (userNameDisplay) {
        userNameDisplay.textContent = userName;
    }
    
    // Update sidebar user name
    const sidebarUserName = document.querySelector('.user-details .user-name');
    if (sidebarUserName) {
        sidebarUserName.textContent = userName;
    }
    
    console.log(`👤 User name updated to: ${userName}`);
}

function updateUserAvatarFromServer(avatarSrc) {
    userState.avatar = avatarSrc;
    updateUserAvatar(avatarSrc);
    console.log(`👤 User avatar updated from server`);
}

// Handle server user data response
function handleServerUserData(userData) {
    if (userData.name) {
        updateUserNameFromServer(userData.name);
    }
    
    if (userData.avatar) {
        updateUserAvatarFromServer(userData.avatar);
    }
    
    if (userData.balance !== undefined) {
        userBalance = userData.balance;
        updateBalanceDisplay();
    }
    
    console.log('👤 User data updated from server:', userData);
}

// Flew Away Message Functions
function showFlewAwayMessage(multiplier) {
    const blanketOverlay = document.getElementById('blanketOverlay');
    const multiplierDisplay = elements.multiplierDisplay;
    
    if (blanketOverlay && multiplierDisplay) {
        // Show blanket first
        blanketOverlay.classList.add('visible');
        
        // Update multiplier display for crashed state
        multiplierDisplay.classList.add('crashed');
        multiplierDisplay.classList.add('show');
        
        // Set the text content directly in the element
        multiplierDisplay.innerHTML = `FLEW AWAY!<br><span style="color: #00FFFF; font-size: 6.5rem;">${multiplier.toFixed(2)}X</span>`;
        
        console.log('✈️ Flew away message shown with multiplier:', multiplier);
    } else {
        console.error('❌ Missing elements for flew away message');
    }
}

function hideFlewAwayMessage() {
    const blanketOverlay = document.getElementById('blanketOverlay');
    const multiplierDisplay = elements.multiplierDisplay;
    
    if (blanketOverlay && multiplierDisplay) {
        // Reset multiplier display first
        multiplierDisplay.classList.remove('crashed');
        multiplierDisplay.classList.remove('show');
        
        // Hide blanket immediately
        blanketOverlay.classList.remove('visible');
        
        console.log('✈️ Flew away message hidden');
    } else {
        console.error('❌ Missing elements for hiding flew away message');
    }
}

function showProvablyFair() {
    console.log('🔒 Provably Fair clicked');
    // TODO: Implement provably fair functionality
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements
    elements = {
        multiplierDisplay: document.getElementById('multiplierDisplay'),
        gameLogo: document.getElementById('gameLogo'),
        rocket: document.getElementById('rocket'), // Legacy DOM rocket (fallback)
        trailContainer: document.getElementById('trailContainer'),
        gameCanvas: document.getElementById('gameCanvas'),
        gameStatus: document.getElementById('gameStatus'),
        toast: document.getElementById('toast'),
        balance: document.getElementById('balance'),
        historyItems: document.getElementById('historyItems'),
        historyItemsMobile: document.getElementById('historyItemsMobile'),
        historyTrailInGame: document.getElementById('historyTrailInGame'),
        betList: document.getElementById('betList'),
        countdownContainer: document.getElementById('countdownContainer'),
        countdownText: document.getElementById('countdownText'),
        countdownBar: document.getElementById('countdownBar')
    };
    
    // Initialize toggle states
    const soundToggle = document.getElementById('soundToggle');
    const musicToggle = document.getElementById('musicToggle');
    const animationToggle = document.getElementById('animationToggle');
    
    if (soundToggle && settingsState.sound) {
        soundToggle.parentElement.classList.add('active');
    }
    
    if (musicToggle && settingsState.music) {
        musicToggle.parentElement.classList.add('active');
    }
    
    if (animationToggle && settingsState.animation) {
        animationToggle.parentElement.classList.add('active');
    }
    
    // Initialize user avatar and name
    updateUserAvatar(userState.avatar);
    updateUserNameFromServer(userState.name);
    
    // Close modals when clicking outside
    const gameRulesModal = document.getElementById('gameRulesModal');
    if (gameRulesModal) {
        gameRulesModal.addEventListener('click', function(e) {
            if (e.target === gameRulesModal) {
                closeGameRules();
            }
        });
    }
    
    const betHistoryModal = document.getElementById('betHistoryModal');
    if (betHistoryModal) {
        betHistoryModal.addEventListener('click', function(e) {
            if (e.target === betHistoryModal) {
                closeBetHistory();
            }
        });
    }
    
    const avatarModal = document.getElementById('avatarModal');
    if (avatarModal) {
        avatarModal.addEventListener('click', function(e) {
            if (e.target === avatarModal) {
                closeAvatarModal();
            }
        });
    }
    
    // Close sidebar when clicking overlay
    const overlay = document.getElementById('menuOverlay');
    if (overlay) {
        overlay.addEventListener('click', function() {
            const sidebar = document.getElementById('settingsSidebar');
            if (sidebar && sidebar.classList.contains('visible')) {
                sidebar.classList.remove('visible');
                overlay.classList.remove('visible');
            }
        });
    }
    
    // Initialize PixiJS integration
    checkPixiJSStatus();
    
    // Initialize WebSocket connection
    initializeWebSocket();
    
    console.log('🎮 Game initialized successfully');
    console.log('🔧 Settings system initialized');
});






