window.global = {};
window.firstLoad = true;

function run() {
	$$('.resettable').forEach(elem => elem.innerHTML = '');

	const params = (new URL(location.href)).searchParams;
	const booleanParam = opt => params.get(opt) === 'on';
	if (window.firstLoad) window.gameOptions = {
		bot: booleanParam('bot'),
		botColour: params.get('botColour'),
		botIntelligence: +params.get('botIntelligence'),
		multiplayer: booleanParam('multiplayer'),
		username: params.get('username'),
		rules: !booleanParam('free'),
		autoFlip: booleanParam('autoflip'),
		gamecode: params.get('gamecode'),
		static: booleanParam('static'),
		spectating: booleanParam('spectating'),
	}
	window.firstLoad = false;
	history.pushState({}, 'Play', location.href.replace(location.search, ''));

	window.ingame = true;
	window.sessionLost = false;
	window.totalMoves = 0;
	window.selectedCell = null;
	window.playerTurn = 'white';
	window.promotionPiece = 'queen';
	window.points = { w: 0, b: 0 };
	window.currentBoard = [];
	window.enpassantCell = null
	window.enpassantTaken = false;
	window.lastEnpassantCell = enpassantCell;
	window.fmrMoves = 0;
	window.failedMoveCount = 0;
	window.autoFlip = gameOptions.autoFlip;
	window.autoPing = gameOptions.multiplayer;
	window.hasRules = gameOptions.rules;
	window.gameId = gameOptions.gamecode;
	window.session = randomID(5);
	window.username = gameOptions.username || 'Player' + random(0, 999);
	window.chat = [];

	const gameData = $('#game-data dl');
	const addGameData = (title, content) => gameData.innerHTML += `<dt>${title}</dt><dd>${content}</dd>`;
	gameData.innerHTML = '';
	addGameData('Opponent', gameOptions.bot ? 'Bot' : (gameOptions.multiplayer && !gameOptions.static) ? 'Online' : 'Local');
	if (gameOptions.bot) addGameData('Bot type', `Level ${gameOptions.botIntelligence}; ${gameOptions.botColour}`);
	if (window.gameId) addGameData('Game ID', window.gameId);
	if (gameOptions.static) {
		readDB();
		window.autoPing = false;
		addGameData('Replay', 'Yes');
	}
	if (gameOptions.spectating) {
		window.ingame = false;
		addGameData('Spectating', 'Yes');
	}
	if (!gameOptions.autoFlip) $('body').dataset.noflip = true;

	Object.assign(window, { ...fenFuncs });
	setupBoard();
	newBoard(8, true);
	alignBoard();

}

function reset() {
	run();
	if (gameOptions.multiplayer) sendDB(window.gameId, defaultFen);
}

/* Console IDs
 * S = selected
 * T = type
 * M = move
 * I = invalid
*/
