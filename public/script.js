// Game state variables (enhanced for PixiJS integration)
let gameState = 'connecting';
let currentMultiplier = 1.00;
let currentH = 0;
let userBalance = 5000;
let countdown = 0;
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let roundCounter = 0;
let gameHistory = [];
let gameStarted = false;

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

// DOM elements
const elements = {
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
        };
        
        socket.onclose = function(event) {
            console.log('🔌 WebSocket Closed:', event.code, event.reason);
            updateGameStatus('crashed', 'Disconnected');
            
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`🔄 Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
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
    
    if (data.wallet && data.wallet.balance !== undefined) {
        userBalance = data.wallet.balance;
        updateBalance();
        console.log('💰 Balance updated:', userBalance);
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
        
        if (data.wallet && data.wallet.balance !== undefined) {
            userBalance = data.wallet.balance;
            updateBalance();
            console.log('💰 Initial balance:', userBalance);
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
        
        showToast('Authentication successful!', 'success');
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
            updateBalance();
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
            updateBalance();
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
            updateBalance();
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
    
    console.log(`⏸️ Pause state: countdown = ${countdown.toFixed(1)}s`);
    
    // Special handling for countdown = 10 (start of pause with FLEW AWAY! text)
    if (countdown === 10) {
        // Show FLEW AWAY! text in the center (rocket continues falling from crash state)
        console.log('💥 Showing FLEW AWAY! text - rocket continues falling from crash state');
        
        // Update display with FLEW AWAY! text - keep in middle of canvas
        elements.multiplierDisplay.textContent = 'FLEW AWAY!';
        elements.multiplierDisplay.classList.add('crashed');
        elements.multiplierDisplay.style.color = '#ffffff';
        elements.multiplierDisplay.classList.add('show'); // Keep visible during crash
        
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
        // Keep FLEW AWAY! text visible, rocket continues falling
        elements.multiplierDisplay.textContent = 'FLEW AWAY!';
        elements.multiplierDisplay.classList.add('crashed');
        elements.multiplierDisplay.style.color = '#ffffff';
        elements.multiplierDisplay.classList.add('show');
        elements.gameLogo.style.display = 'none';
        updateGameStatus('crashed', `Flew away at ${currentMultiplier.toFixed(2)}x`);
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
        
        // Reset crash display elements
        elements.multiplierDisplay.textContent = '1.00x';
        elements.multiplierDisplay.classList.remove('crashed');
        elements.multiplierDisplay.style.color = ''; // Reset color
        elements.multiplierDisplay.classList.remove('show');
        
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
    
    // Reset crash display elements
    elements.multiplierDisplay.textContent = '1.00x';
    elements.multiplierDisplay.classList.remove('crashed');
    elements.multiplierDisplay.style.color = ''; // Reset color
    elements.multiplierDisplay.classList.remove('show');
    
    // Show game logo
    elements.gameLogo.style.display = 'block';
    
    // Show countdown loader for countdown > 0 and <= 5
    if (countdown > 0 && countdown <= 5) {
        console.log('🕐 Showing countdown loader for betting phase:', countdown);
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
    
    // Start rocket animation from current multiplier position
    const rocketAnimation = getRocketAnimation();
    rocketAnimation.startFromMultiplier(currentMultiplier);
    
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
    currentMultiplier = data.k || 1.00;
    currentH = data.h || 0;
    
    // Update multiplier display with smooth animation
    elements.multiplierDisplay.textContent = currentMultiplier.toFixed(2) + 'x';
    
    // Update rocket animation position using the animation interface
    const rocketAnimation = getRocketAnimation();
    rocketAnimation.updatePosition(currentMultiplier);
    
    // Update cashout button amounts and check auto-cashout
    for (let i = 1; i <= 2; i++) {
        if (bets[i].placed && bets[i].scope === 'current' && bets[i].buttonState === 'cashout') {
            const cashoutValue = (bets[i].amount * currentMultiplier).toFixed(2);
            updateButtonAmount(i, cashoutValue);
            
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
    
    // Log progress for debugging
    console.log(`📈 Progress: ${currentMultiplier.toFixed(2)}x (H: ${currentH})`);
}

function handleCrashState(data) {
    gameState = 'crash';
    const crashMultiplier = data.k || currentMultiplier;
    
    console.log(`💥 Crash detected at ${crashMultiplier.toFixed(2)}x - Starting falling animation`);
    
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
            showToast(`Bet ${i} crashed at ${crashMultiplier.toFixed(2)}x - Lost ₹${bets[i].amount}`, 'error');
            
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
    const input = document.getElementById(`betAmount${playerIndex}`);
    const current = parseFloat(input.value) || 100;
    const newAmount = multiplier < 1 ? current * multiplier : current * multiplier;
    const finalAmount = Math.max(1, Math.round(newAmount * 100) / 100);
    
    input.value = finalAmount.toFixed(2);
    bets[playerIndex].amount = finalAmount;
    updateButtonAmount(playerIndex, finalAmount.toFixed(2));
}

function setBetAmount(amount, playerIndex) {
    document.getElementById(`betAmount${playerIndex}`).value = amount.toFixed(2);
    bets[playerIndex].amount = amount;
    updateButtonAmount(playerIndex, amount.toFixed(2));
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
        userBalance += winAmount;
        updateBalance();
        
        addToBetList(bets[playerIndex].amount, currentMultiplier, winAmount, false);
        
        bets[playerIndex].placed = false;
        bets[playerIndex].awaiting = false;
        bets[playerIndex].counter = null;
        bets[playerIndex].scope = null;
        bets[playerIndex].autoCashoutTriggered = false;
        updateButtonState(playerIndex, 'bet');
        
        const cashoutType = bets[playerIndex].autoCashoutTriggered ? 'Auto-cashed' : 'Cashed';
        showToast(`${cashoutType} out ₹${winAmount.toFixed(2)} at ${currentMultiplier.toFixed(2)}x`, 'success');
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
            const cashoutValue = (bets[playerIndex].amount * currentMultiplier).toFixed(2);
            updateButtonAmount(playerIndex, cashoutValue);
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
}

function updateButtonAmount(playerIndex, amount) {
    const amountElement = document.getElementById(`mainButtonAmount${playerIndex}`);
    if (amountElement) {
        amountElement.textContent = amount;
    }
}

function updateGameStatus(state, message) {
    const statusElement = elements.gameStatus;
    statusElement.className = `game-status ${state}`;
    statusElement.textContent = message;
}

function updateBalance() {
    elements.balance.textContent = userBalance.toFixed(2);
}

function showToast(message, type = 'info') {
    const toast = elements.toast;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
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

function addToBetList(amount, multiplier, winAmount, crashed) {
    const betList = elements.betList;
    const item = document.createElement('div');
    item.className = crashed ? 'bet-item loss' : 'bet-item bg';
    
    const multiplierText = `${multiplier.toFixed(2)}x`;
    const winAmountText = crashed ? `-₹${amount.toFixed(2)}` : `+₹${winAmount.toFixed(2)}`;
    
    item.innerHTML = `
        <div class="bet-amount">₹${amount.toFixed(2)}</div>
        <div class="bet-multiplier ${crashed ? 'crashed' : ''}">${multiplierText}</div>
        <div class="bet-win ${crashed ? 'loss' : 'profit'}">${winAmountText}</div>
    `;
    
    betList.insertBefore(item, betList.firstChild);
    
    while (betList.children.length > 20) {
        betList.removeChild(betList.lastChild);
    }
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

// Event listeners
document.getElementById('betAmount1').addEventListener('input', function() {
    const value = parseFloat(this.value) || 100;
    bets[1].amount = value;
    updateButtonAmount(1, value.toFixed(2));
});

document.getElementById('betAmount2').addEventListener('input', function() {
    const value = parseFloat(this.value) || 100;
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
    
    updateBalance();
    
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
    
    // Add sample bet history
    addToBetList(8000, 2.64, 12000, false);
    addToBetList(8000, 1.23, -8000, true);
    addToBetList(8000, 3.67, 12000, false);
    addToBetList(8000, 1.05, -8000, true);
    addToBetList(8000, 2.45, 12000, false);
    addToBetList(8000, 1.89, 12000, false);
    
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

// Additional blur/focus handlers for backup
window.addEventListener('blur', function() {
    if (isTabVisible) {
        isTabVisible = false;
        console.log('🔄 Window blur detected');
    }
});

window.addEventListener('focus', function() {
    if (!isTabVisible) {
        isTabVisible = true;
        console.log('🔄 Window focus detected');
    }
});

// Enhanced window beforeunload
window.addEventListener('beforeunload', function() {
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
