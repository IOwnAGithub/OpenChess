'use strict';
const apiUrl = '/.netlify/functions/database';
const TIMEOUT_AGE = 3 * 60 * 1000;
const READ_INTERVAL = 3 * 1000;

let lastReceivedFen;
let idleTime = 0;

async function getGameData(chat) {
	if (!window.gameId) throw Error('No game ID has been specified');
	const resp = await fetch(`${apiUrl}?type=read&gameId=${chat ? 'c:' : ''}${window.gameId}`).then(data => data.json());
	console.debug(`Retrieved data for game ID ${window.gameId}.`);
	return resp.output.data;
}

// Database //

async function readDB() {
	if (!gameOptions?.multiplayer) return;
	readChat();
	const { fen = createFen(), moves, lastMove, points, ingame = 1, players } = await getGameData();
	if (fen === lastReceivedFen) return;
	lastReceivedFen = fen;
	createBoardFromFen(fen);
	if (lastMove) {
		let [start, end] = lastMove.split(',');
		window.lastMove = { start, end };
		checkHighlight();
	}
	if (moves) {
		global.logList = moves.split(',');
		updateMoves();
	}
	if (points) {
		let [w, b] = points.split(',');
		window.points = { w: +w, b: +b };
		logPoints();
	}
	if (!+ingame) {
		$('#winner').innerText = 'Timed out';
		window.ingame = false;
	}
	window.playerCount = +players || 0;
}

async function sendDB(soft) {
	console.debug(`Attempting to send data to game ID ${window.gameId}...`);
	const fen = createFen();
	idleTime = 0;
	let queryParams = [
		'type=send',
		`gameId=${encodeURIComponent(window.gameId)}`,
		!soft && `fen=${encodeURIComponent(fen)}`,
		!soft && `moves=${global.logList.join(',')}`,
		!soft && `lastMove=${window.lastMove.start},${window.lastMove.end}`,
		!soft && `points=${window.points.w},${window.points.b}`,
		`players=${window.playerCount}`,
		`ingame=${+!window.sessionLost}`,
	];
	await fetch(`${apiUrl}?${queryParams.filter(p => !!p).join('&')}`);
	console.debug(`Sent FEN data for game ID ${window.gameId}: ${fen}.`);
}

// Chat //

async function readChat() {
	if (!gameOptions?.multiplayer) return;
	const { chat } = await getGameData('chat:true');
	if (!chat) return;
	let messages = chat.split(SEP.MSG);
	let messagesRaw = messages.map(msg => msg.split(SEP.INFO));
	const sorter = (a, b) => a.split(SEP.INFO)[0] - b.split(SEP.INFO)[0];
	window.chat = [...new Set([...messages, ...window.chat])].sort(sorter);
	$('#chat').innerHTML = messagesRaw.map(formatChatMessage).join('');
	$('#chat').lastElementChild.scrollIntoView();
}

async function sendChatMessage(force) {
	let message = $('#chat-message').value;
	$('#chat-message').value = '';
	if (!message && !force) return;

	await readChat();
	if (message) {
		let messageParts = [+new Date(), window.username, message];
		$('#chat').innerHTML += formatChatMessage(messageParts);
		window.chat.push(messageParts.join(SEP.INFO));
	}
	if (!window.autoPing || !window.ingame) return;
	let queryParams = [
		'type=send',
		`gameId=c:${encodeURIComponent(window.gameId)}`,
		`chat=${encodeURIComponent(window.chat.join(SEP.MSG))}`,
	];
	console.debug(`Attempting to send chat message data to game ID ${window.gameId}...`);
	fetch(`${apiUrl}?${queryParams.join('&')}`);
}

let lastMessageUser;
function formatChatMessage([ts, user, msg]) {
	let messageClass = { [window.username]: 'chat-message-self', [lastMessageUser]: 'chat-message-same', '[System]': 'chat-message-system' }[user] || '';
	const content = `
		<div data-ts="${ts}" class="chat-message ${messageClass}">
			<div class="chat-message_user">${user}</div>
			<div class="chat-message_text">${msg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
		</div>
	`;
	lastMessageUser = user;
	return content;
}

// Game functions //

async function init() {
	if (!gameOptions?.multiplayer) return;
	const data = await getGameData();
	window.playerCount = (+data.players || 0) + 1;
	window.playerTurn = playerCount === 1 ? 'white' : 'black';
	if (playerCount > 2) {
		gameOptions.spectating = true;
		window.ingame = false;
		addGameData('Spectating', 'Yes');
	}
	if (window.playerTurn === 'black') flipBoard();
	$('#chat').innerHTML = window.chat.map(msg => formatChatMessage(msg.split(SEP.INFO)));
	sendDB('soft:true');
	sendChatMessage('force:true');
}

document.addEventListener('DOMContentLoaded', init);

setInterval(function () {
	if (!window.autoPing || !window.ingame) return;
	if (idleTime > TIMEOUT_AGE) {
		window.sessionLost = true;
		sendDB('soft');
		alert('Session timed out');
		location.pathname = '/';
		return;
	}
	idleTime += READ_INTERVAL;
	readDB();
}, READ_INTERVAL);
