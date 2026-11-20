const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const rooms = new Map();
const roomClients = new Map();
const staticFiles = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/index.html": ["index.html", "text/html; charset=utf-8"],
    "/index.css": ["index.css", "text/css; charset=utf-8"],
    "/index.js": ["index.js", "text/javascript; charset=utf-8"]
};

function json(response, status, data) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(data));
}

function playerNumber(room, token) {
    if (room.players[1] === token) return 1;
    if (room.players[2] === token) return 2;
    return null;
}

function publicState(room) {
    return {
        digitCount: room.digitCount,
        status: room.status,
        currentPlayer: room.currentPlayer,
        secretsSaved: { 1: room.secrets[1] !== null, 2: room.secrets[2] !== null },
        guesses: room.guesses
    };
}

function broadcast(code, message, closeAfter = false) {
    const clients = roomClients.get(code);
    if (!clients) return;
    const frame = `data: ${JSON.stringify(message)}\n\n`;
    for (const response of clients) {
        if (!response.destroyed) response.write(frame);
        if (closeAfter && !response.destroyed) response.end();
    }
    if (closeAfter) roomClients.delete(code);
}

function sendState(code, room) {
    broadcast(code, { type: "state", state: publicState(room) });
}

async function readBody(request) {
    let body = "";
    for await (const chunk of request) {
        body += chunk;
        if (body.length > 16_384) throw new Error("Request is too large.");
    }
    return body ? JSON.parse(body) : {};
}

function validNumber(value, digitCount) {
    return typeof value === "string"
        && new RegExp(`^\\d{${digitCount}}$`).test(value)
        && new Set(value).size === digitCount;
}

function roomFrom(body) {
    const code = String(body.code || "").toUpperCase();
    const room = rooms.get(code);
    if (!room) return { error: "That room was not found. It may have ended or expired." };
    const player = playerNumber(room, body.token);
    if (!player) return { error: "This session is not a player in that room." };
    room.updatedAt = Date.now();
    return { code, room, player };
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/api/room/events") {
        const code = (url.searchParams.get("code") || "").toUpperCase();
        const room = rooms.get(code);
        const token = url.searchParams.get("token");
        if (!room || !playerNumber(room, token)) {
            return json(response, 404, { error: "This game room is no longer available." });
        }
        response.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        });
        response.write(`data: ${JSON.stringify({ type: "state", state: publicState(room) })}\n\n`);
        if (!roomClients.has(code)) roomClients.set(code, new Set());
        roomClients.get(code).add(response);
        const heartbeat = setInterval(() => {
            if (response.destroyed) return clearInterval(heartbeat);
            response.write(": keep-alive\n\n");
        }, 25_000);
        heartbeat.unref();
        request.on("close", () => {
            clearInterval(heartbeat);
            roomClients.get(code)?.delete(response);
        });
        return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/room/")) {
        let body;
        try {
            body = await readBody(request);
        } catch {
            return json(response, 400, { error: "Could not read the request." });
        }

        const action = url.pathname.slice("/api/room/".length);
        if (action === "create") {
            const digitCount = Number(body.digitCount);
            if (!Number.isInteger(digitCount) || digitCount < 3 || digitCount > 10) {
                return json(response, 400, { error: "Choose between 3 and 10 digits." });
            }
            let code;
            do {
                code = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
            } while (rooms.has(code));
            const token = crypto.randomUUID();
            const room = {
                digitCount,
                status: "lobby",
                currentPlayer: 1,
                players: { 1: token, 2: null },
                secrets: { 1: null, 2: null },
                guesses: { 1: [], 2: [] },
                updatedAt: Date.now()
            };
            rooms.set(code, room);
            return json(response, 201, { code, token, player: 1, state: publicState(room) });
        }

        if (action === "join") {
            const code = String(body.code || "").toUpperCase();
            const room = rooms.get(code);
            if (!room) return json(response, 404, { error: "Room not found. Check the code and try again." });
            if (room.players[2]) return json(response, 409, { error: "That room already has two players." });
            if (room.status !== "lobby") return json(response, 409, { error: "That game has already started." });
            const token = crypto.randomUUID();
            room.players[2] = token;
            room.updatedAt = Date.now();
            sendState(code, room);
            return json(response, 200, { code, token, player: 2, state: publicState(room) });
        }

        const found = roomFrom(body);
        if (found.error) return json(response, 404, { error: found.error });
        const { code, room, player } = found;

        if (action === "state") return json(response, 200, { player, state: publicState(room) });

        if (action === "save") {
            if (room.status !== "lobby") return json(response, 409, { error: "Secrets are already locked." });
            if (room.secrets[player] !== null) return json(response, 409, { error: "Your secret is already locked." });
            if (!validNumber(body.number, room.digitCount)) {
                return json(response, 400, { error: `Enter ${room.digitCount} digits with no repeats.` });
            }
            room.secrets[player] = body.number;
            room.updatedAt = Date.now();
            sendState(code, room);
            return json(response, 200, { state: publicState(room) });
        }

        if (action === "start") {
            if (room.status !== "lobby") return json(response, 409, { error: "The game is not waiting to start." });
            if (!room.secrets[1] || !room.secrets[2]) return json(response, 409, { error: "Both players must lock a secret first." });
            room.status = "playing";
            room.currentPlayer = 1;
            room.updatedAt = Date.now();
            sendState(code, room);
            return json(response, 200, { state: publicState(room) });
        }

        if (action === "guess") {
            if (room.status !== "playing") return json(response, 409, { error: "The game has not started." });
            if (room.currentPlayer !== player) return json(response, 409, { error: "Wait for your turn." });
            if (!validNumber(body.guess, room.digitCount)) {
                return json(response, 400, { error: `Enter ${room.digitCount} digits with no repeats.` });
            }
            const secret = room.secrets[player === 1 ? 2 : 1];
            const guess = body.guess;
            if (guess === secret) {
                const result = { type: "won", winner: player };
                broadcast(code, result, true);
                rooms.delete(code);
                return json(response, 200, result);
            }
            const digitsMatched = [...guess].filter((digit) => secret.includes(digit)).length;
            const placesMatched = [...guess].filter((digit, index) => digit === secret[index]).length;
            room.guesses[player].unshift({ guess, digitsMatched, placesMatched });
            room.currentPlayer = player === 1 ? 2 : 1;
            room.updatedAt = Date.now();
            sendState(code, room);
            return json(response, 200, { state: publicState(room) });
        }

        if (action === "leave") {
            broadcast(code, { type: "closed", message: `Player ${player} left the room.` }, true);
            rooms.delete(code);
            return json(response, 200, { ok: true });
        }

        return json(response, 404, { error: "Unknown room action." });
    }

    if (request.method === "GET" && staticFiles[url.pathname]) {
        const [filename, contentType] = staticFiles[url.pathname];
        response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
        return fs.createReadStream(path.join(ROOT, filename)).pipe(response);
    }

    return json(response, 404, { error: "Not found." });
});

setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
        const maxAge = room.status === "playing" ? 2 * 60 * 60 * 1000 : 30 * 60 * 1000;
        if (now - room.updatedAt > maxAge) {
            broadcast(code, { type: "closed", message: "This room expired." }, true);
            rooms.delete(code);
        }
    }
}, 60 * 1000).unref();

server.listen(PORT, "0.0.0.0", () => console.log(`Number Guessing game listening on port ${PORT}`));
