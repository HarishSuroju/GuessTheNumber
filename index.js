const secretInputs = {
    1: document.getElementById("num1"),
    2: document.getElementById("num2")
};

const saveButtons = {
    1: document.getElementById("save1"),
    2: document.getElementById("save2")
};

const guessInputs = {
    1: document.getElementById("guess1"),
    2: document.getElementById("guess2")
};

const secrets = { 1: null, 2: null };
const digitCount = document.getElementById("digitCount");
const startButton = document.getElementById("startGame");
const gameStatus = document.getElementById("gameStatus");
const submitButtons = {
    1: document.getElementById("btn1"),
    2: document.getElementById("btn2")
};
const guessLists = {
    1: document.getElementById("guesses1"),
    2: document.getElementById("guesses2")
};
const playerPanels = {
    1: document.getElementById("div1"),
    2: document.getElementById("div2")
};
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerTitle = document.getElementById("winnerTitle");
const newGameButton = document.getElementById("newGame");
const confettiContainer = document.getElementById("confetti");
const modeScreen = document.getElementById("modeScreen");
const gameApp = document.getElementById("gameApp");
const onlineSetup = document.getElementById("onlineSetup");
const modeChoices = document.getElementById("modeChoices");
const onlineError = document.getElementById("onlineError");
const onlineDigitCount = document.getElementById("onlineDigitCount");
const roomInfo = document.getElementById("roomInfo");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const leaveButton = document.getElementById("leaveGame");

let gameStarted = false;
let gameOver = false;
let currentPlayer = 1;
let gameMode = null;
let onlineSession = null;
let onlinePlayerNumber = null;
let eventSource = null;

function saveNumber(player) {
    if (gameMode === "online") {
        saveOnlineNumber(player);
        return;
    }
    const input = secretInputs[player];
    const number = input.value.trim();
    const requiredLength = Number(digitCount.value);

    if (!isValidNumber(number, requiredLength)) {
        alert(`Enter exactly ${requiredLength} digits with no repeated digits.`);
        input.focus();
        return;
    }

    secrets[player] = number;
    digitCount.disabled = true;
    input.value = "";
    input.disabled = true;
    input.type = "text";
    input.placeholder = "Number saved";
    saveButtons[player].hidden = true;
    startButton.disabled = secrets[1] === null || secrets[2] === null;
}

function checkGuess(player) {
    if (gameMode === "online") {
        checkOnlineGuess(player);
        return;
    }
    if (!gameStarted || gameOver || player !== currentPlayer) {
        return;
    }

    const opponent = player === 1 ? 2 : 1;

    const guessText = guessInputs[player].value.trim();
    const requiredLength = Number(digitCount.value);
    if (!isValidNumber(guessText, requiredLength)) {
        alert(`Enter exactly ${requiredLength} digits with no repeated digits.`);
        guessInputs[player].focus();
        return;
    }

    if (guessText === secrets[opponent]) {
        gameOver = true;
        gameStatus.textContent = `Player ${player} guessed correctly and wins!`;
        playerPanels[player].classList.add("is-winner");
        submitButtons[1].disabled = true;
        submitButtons[2].disabled = true;
        showWinner(player);
    } else {
        const secret = secrets[opponent];
        const digitsMatched = [...new Set(guessText)].filter((digit) => secret.includes(digit)).length;
        const placesMatched = [...guessText].filter((digit, index) => digit === secret[index]).length;
        const row = guessLists[player].querySelector("tbody").insertRow(0);
        [guessText, digitsMatched, placesMatched].forEach((value) => {
            row.insertCell().textContent = value;
        });
        guessInputs[player].value = "";
        currentPlayer = opponent;
        updateTurn();
    }
}

function showWinner(player) {
    const winnerMessage = document.querySelector(".winner-message");
    const winnerKicker = document.querySelector(".winner-kicker");
    const trophy = document.querySelector(".trophy");
    if (gameMode === "online") {
        const didWin = player === onlinePlayerNumber;
        winnerTitle.textContent = didWin ? "You won!" : "You lost!";
        winnerMessage.textContent = didWin ? "You cracked your opponent's secret code." : "Your opponent cracked your secret code.";
        winnerKicker.textContent = didWin ? "Brilliant guess!" : "Game over";
        trophy.textContent = didWin ? "🏆" : "💔";
    } else {
        winnerTitle.textContent = `Player ${player} wins!`;
        winnerMessage.textContent = "The secret code has been cracked.";
        winnerKicker.textContent = "Brilliant guess!";
        trophy.textContent = "🏆";
    }
    newGameButton.innerHTML = gameMode === "online" ? 'Back to start <span aria-hidden="true">↻</span>' : 'Play Again <span aria-hidden="true">↻</span>';
    winnerOverlay.hidden = false;
    winnerOverlay.classList.add("is-visible");
    winnerOverlay.setAttribute("aria-hidden", "false");
    confettiContainer.replaceChildren();

    const colors = ["#ffd84d", "#a8f06b", "#ffffff", "#ff8c69", "#9e8cff"];
    for (let index = 0; index < 72; index += 1) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.setProperty("--left", `${Math.random() * 100}%`);
        piece.style.setProperty("--delay", `${Math.random() * 1.2}s`);
        piece.style.setProperty("--duration", `${2.2 + Math.random() * 2}s`);
        piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 260}px`);
        piece.style.setProperty("--confetti-color", colors[index % colors.length]);
        confettiContainer.appendChild(piece);
    }

    newGameButton.focus();
}

function resetGame() {
    if (gameMode === "online") {
        returnToModeScreen();
        return;
    }
    secrets[1] = null;
    secrets[2] = null;
    gameStarted = false;
    gameOver = false;
    currentPlayer = 1;

    for (const player of [1, 2]) {
        const secretInput = secretInputs[player];
        secretInput.disabled = false;
        secretInput.type = "password";
        secretInput.value = "";
        secretInput.placeholder = "Choose a number";
        guessInputs[player].value = "";
        saveButtons[player].hidden = false;
        submitButtons[player].disabled = true;
        guessLists[player].querySelector("tbody").replaceChildren();
        playerPanels[player].classList.remove("is-active", "is-winner");
    }

    digitCount.disabled = false;
    startButton.hidden = false;
    startButton.disabled = true;
    gameStatus.textContent = "Both players must save a number to begin.";
    winnerOverlay.classList.remove("is-visible");
    winnerOverlay.hidden = true;
    winnerOverlay.setAttribute("aria-hidden", "true");
    confettiContainer.replaceChildren();
    secretInputs[1].focus();
}

function isValidNumber(value, requiredLength) {
    return new RegExp(`^\\d{${requiredLength}}$`).test(value)
        && new Set(value).size === requiredLength;
}

function updateTurn() {
    submitButtons[1].disabled = currentPlayer !== 1 || gameOver;
    submitButtons[2].disabled = currentPlayer !== 2 || gameOver;
    playerPanels[1].classList.toggle("is-active", currentPlayer === 1 && !gameOver);
    playerPanels[2].classList.toggle("is-active", currentPlayer === 2 && !gameOver);
    gameStatus.textContent = `Player ${currentPlayer}, enter your guess.`;
    guessInputs[currentPlayer].focus();
}

function startGame() {
    if (gameMode === "online") {
        startOnlineGame();
        return;
    }
    if (secrets[1] === null || secrets[2] === null || gameStarted) {
        return;
    }

    gameStarted = true;
    startButton.hidden = true;
    currentPlayer = 1;
    updateTurn();
}

saveButtons[1].addEventListener("click", () => saveNumber(1));
saveButtons[2].addEventListener("click", () => saveNumber(2));
startButton.addEventListener("click", startGame);
newGameButton.addEventListener("click", resetGame);

async function apiRequest(action, payload = {}) {
    const response = await fetch(`/api/room/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The room request failed.");
    return result;
}

function beginLocalGame() {
    gameMode = "local";
    modeScreen.hidden = true;
    gameApp.hidden = false;
    gameStatus.textContent = "Both players must save a number to begin.";
}

function showOnlineSetup() {
    modeChoices.hidden = true;
    onlineSetup.hidden = false;
    onlineError.textContent = "";
    document.getElementById("roomCodeInput").focus();
}

async function createOnlineRoom() {
    onlineError.textContent = "";
    try {
        const result = await apiRequest("create", { digitCount: Number(onlineDigitCount.value) });
        enterOnlineGame(result);
    } catch (error) {
        onlineError.textContent = error.message;
    }
}

async function joinOnlineRoom() {
    onlineError.textContent = "";
    const code = document.getElementById("roomCodeInput").value.trim().toUpperCase();
    if (!code) {
        onlineError.textContent = "Enter your friend's room code.";
        return;
    }
    try {
        const result = await apiRequest("join", { code });
        enterOnlineGame(result);
    } catch (error) {
        onlineError.textContent = error.message;
    }
}

function enterOnlineGame(session) {
    gameMode = "online";
    onlineSession = { code: session.code, token: session.token, player: session.player };
    onlinePlayerNumber = session.player;
    sessionStorage.setItem("numberGameSession", JSON.stringify(onlineSession));
    modeScreen.hidden = true;
    gameApp.hidden = false;
    roomInfo.hidden = false;
    roomCodeLabel.textContent = session.code;
    leaveButton.hidden = false;
    digitCount.value = session.state.digitCount;
    digitCount.disabled = true;
    gameStarted = false;
    gameOver = false;
    winnerOverlay.hidden = true;
    winnerOverlay.classList.remove("is-visible");
    renderOnlineState(session.state);
    connectToRoom();
}

function connectToRoom() {
    if (eventSource) eventSource.close();
    const { code, token } = onlineSession;
    eventSource = new EventSource(`/api/room/events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
    eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "state") renderOnlineState(message.state);
        if (message.type === "won") finishOnlineGame(message.winner);
        if (message.type === "closed") {
            gameStatus.textContent = message.message || "The room closed.";
            eventSource.close();
            alert(message.message || "The room closed.");
            returnToModeScreen();
        }
    };
    eventSource.onerror = () => {
        if (!gameOver) gameStatus.textContent = "Connection interrupted. Reconnecting…";
    };
}

function renderOnlineState(state) {
    digitCount.value = state.digitCount;
    digitCount.disabled = true;
    gameStarted = state.status === "playing";
    currentPlayer = state.currentPlayer;
    const player = onlineSession.player;

    for (const id of [1, 2]) {
        const isThisPlayer = id === player;
        const saved = state.secretsSaved[id];
        playerPanels[id].querySelector(".player-name").textContent = isThisPlayer ? "You" : "Opponent";
        playerPanels[id].querySelector(".player-tag").textContent = isThisPlayer ? "Your side" : "Opponent";
        playerPanels[id].querySelector(".guess-list-label").textContent = isThisPlayer ? "Your wrong guesses" : "Opponent's wrong guesses";
        secretInputs[id].parentElement.hidden = !isThisPlayer;
        secretInputs[id].parentElement.previousElementSibling.hidden = !isThisPlayer;
        secretInputs[id].disabled = saved;
        secretInputs[id].type = saved ? "text" : "password";
        secretInputs[id].value = "";
        secretInputs[id].placeholder = saved ? "Number saved" : "Choose a number";
        saveButtons[id].hidden = saved;
        submitButtons[id].disabled = state.status !== "playing" || state.currentPlayer !== id;
        guessInputs[id].disabled = !isThisPlayer || state.status !== "playing" || state.currentPlayer !== id;
        playerPanels[id].classList.toggle("is-active", state.status === "playing" && state.currentPlayer === id);
        playerPanels[id].classList.remove("is-winner");
        const body = guessLists[id].querySelector("tbody");
        body.replaceChildren();
        for (const entry of state.guesses[id]) {
            const row = body.insertRow();
            [entry.guess, entry.digitsMatched, entry.placesMatched].forEach((value) => {
                row.insertCell().textContent = value;
            });
        }
    }

    startButton.hidden = state.status === "playing";
    startButton.disabled = !state.secretsSaved[1] || !state.secretsSaved[2];
    gameStatus.textContent = state.status === "playing"
        ? state.currentPlayer === player ? "Your turn — enter a guess." : "Opponent's turn — waiting for their guess."
        : state.secretsSaved[1] && state.secretsSaved[2]
            ? "Both secrets are locked. Either player can start."
            : state.secretsSaved[player]
                ? "Your secret is locked. Waiting for your opponent."
                : "Lock your secret number to continue. Share the room code to invite your opponent.";
}

async function saveOnlineNumber(player) {
    if (player !== onlineSession.player) return;
    const input = secretInputs[player];
    const number = input.value.trim();
    const length = Number(digitCount.value);
    if (!isValidNumber(number, length)) {
        alert(`Enter exactly ${length} digits with no repeated digits.`);
        input.focus();
        return;
    }
    try {
        const result = await apiRequest("save", { ...onlineSession, number });
        renderOnlineState(result.state);
    } catch (error) {
        alert(error.message);
    }
}

async function startOnlineGame() {
    try {
        const result = await apiRequest("start", onlineSession);
        renderOnlineState(result.state);
    } catch (error) {
        alert(error.message);
    }
}

async function checkOnlineGuess(player) {
    if (!gameStarted || gameOver || player !== onlineSession.player || player !== currentPlayer) return;
    const guess = guessInputs[player].value.trim();
    const length = Number(digitCount.value);
    if (!isValidNumber(guess, length)) {
        alert(`Enter exactly ${length} digits with no repeated digits.`);
        guessInputs[player].focus();
        return;
    }
    try {
        const result = await apiRequest("guess", { ...onlineSession, guess });
        if (result.type === "won") finishOnlineGame(result.winner);
        else {
            guessInputs[player].value = "";
            renderOnlineState(result.state);
        }
    } catch (error) {
        alert(error.message);
    }
}

function finishOnlineGame(winner) {
    if (gameOver) return;
    gameOver = true;
    gameStatus.textContent = winner === onlinePlayerNumber ? "You guessed correctly and won!" : "Your opponent guessed correctly. You lost.";
    submitButtons[1].disabled = true;
    submitButtons[2].disabled = true;
    guessInputs[1].value = "";
    guessInputs[2].value = "";
    guessLists[1].querySelector("tbody").replaceChildren();
    guessLists[2].querySelector("tbody").replaceChildren();
    roomInfo.hidden = true;
    leaveButton.hidden = true;
    sessionStorage.removeItem("numberGameSession");
    onlineSession = null;
    playerPanels[winner].classList.add("is-winner");
    if (eventSource) eventSource.close();
    showWinner(winner);
}

async function leaveOnlineRoom() {
    try {
        await apiRequest("leave", onlineSession);
    } catch { /* The room may already have ended. */ }
    returnToModeScreen();
}

function returnToModeScreen() {
    if (eventSource) eventSource.close();
    eventSource = null;
    onlineSession = null;
    onlinePlayerNumber = null;
    sessionStorage.removeItem("numberGameSession");
    gameMode = null;
    gameStarted = false;
    gameOver = false;
    currentPlayer = 1;
    secrets[1] = null;
    secrets[2] = null;
    digitCount.disabled = false;
    startButton.hidden = false;
    startButton.disabled = true;
    for (const player of [1, 2]) {
        secretInputs[player].parentElement.hidden = false;
        secretInputs[player].parentElement.previousElementSibling.hidden = false;
        secretInputs[player].disabled = false;
        secretInputs[player].type = "password";
        secretInputs[player].value = "";
        secretInputs[player].placeholder = "Choose a number";
        guessInputs[player].disabled = false;
        guessInputs[player].value = "";
        saveButtons[player].hidden = false;
        submitButtons[player].disabled = true;
        guessLists[player].querySelector("tbody").replaceChildren();
        playerPanels[player].classList.remove("is-active", "is-winner");
    }
    gameApp.hidden = true;
    modeScreen.hidden = false;
    modeChoices.hidden = false;
    onlineSetup.hidden = true;
    onlineError.textContent = "";
    roomInfo.hidden = true;
    leaveButton.hidden = true;
    winnerOverlay.classList.remove("is-visible");
    winnerOverlay.hidden = true;
    modeScreen.querySelector("#playLocal").focus();
}

document.getElementById("playLocal").addEventListener("click", beginLocalGame);
document.getElementById("playOnline").addEventListener("click", showOnlineSetup);
document.getElementById("createRoom").addEventListener("click", createOnlineRoom);
document.getElementById("joinRoom").addEventListener("click", joinOnlineRoom);
document.getElementById("backToModes").addEventListener("click", () => {
    onlineSetup.hidden = true;
    modeChoices.hidden = false;
});
document.getElementById("roomCodeInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") joinOnlineRoom();
});
document.getElementById("copyRoomCode").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(onlineSession.code);
        document.getElementById("copyRoomCode").textContent = "Copied";
        setTimeout(() => { document.getElementById("copyRoomCode").textContent = "Copy"; }, 1500);
    } catch {
        alert(`Share this room code: ${onlineSession.code}`);
    }
});
leaveButton.addEventListener("click", leaveOnlineRoom);

async function restoreOnlineSession() {
    const stored = sessionStorage.getItem("numberGameSession");
    if (!stored) return;
    try {
        const session = JSON.parse(stored);
        const result = await apiRequest("state", session);
        enterOnlineGame({ ...session, state: result.state });
    } catch {
        sessionStorage.removeItem("numberGameSession");
    }
}

restoreOnlineSession();

for (const player of [1, 2]) {
    secretInputs[player].addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            saveButtons[player].click();
        }
    });
    guessInputs[player].addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submitButtons[player].click();
        }
    });
}
