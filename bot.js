var sockjs = require('sockjs-client-ws');
var request = require('request');
var tools = require('./tools');

// Setup Logging
var logger = require('log4js').getLogger();

var client = sockjs.create("http://sim.smogon.com:8000/showdown");
var ACTION_PHP = "http://play.pokemonshowdown.com/~~showdown/action.php";
var account = require("./account.json");

var CHALLENGE_KEY_ID = null;
var CHALLENGE = null;

var BattleRoom = require('./battleroom');

function send(data, room) {
	if (room && room !== 'lobby' && room !== true) {
		data = room+'|'+data;
	} else if (room !== true) {
		data = '|'+data;
	}
	client.write(data);

	logger.trace(">> " + data);
}

function rename(name, password) {
	var self = this;
	request.post({
		url : ACTION_PHP,
		formData : {
			act: "login",
			name: name,
			pass: password,
			challengekeyid: CHALLENGE_KEY_ID,
			challenge: CHALLENGE
		}
	},
	function (err, response, body) {
		var data = tools.safeJSON(body);
		if(data && data.curuser && data.curuser.loggedin) {
			send("/trn " + account.username + ",0," + data.assertion);
		} else {
			// We couldn't log in for some reason
			logger.fatal("Error logging in...");
			process.exit();
		}
	});
}

var ROOMS = {};
function addRoom(id, type) {
	if(type == "battle") {
		ROOMS[id] = new BattleRoom(id, send);
		return ROOMS[id];
	} else {
		logger.error("Unkown room type: " + type);
	}
}
function removeRoom(id) {
	var room = ROOMS[id];
	if(room) {
		delete ROOMS[id];
		return true;
	}
	return false;
}

function recieve(data) {
	logger.trace("<< " + data);

	var roomid = '';
	if (data.substr(0,1) === '>') {
		var nlIndex = data.indexOf('\n');
		if (nlIndex < 0) return;
		roomid = tools.toRoomid(data.substr(1,nlIndex-1));
		data = data.substr(nlIndex+1);
	}
	if (data.substr(0,6) === '|init|') {
		if (!roomid) roomid = 'lobby';
		var roomType = data.substr(6);
		var roomTypeLFIndex = roomType.indexOf('\n');
		if (roomTypeLFIndex >= 0) roomType = roomType.substr(0, roomTypeLFIndex);
		roomType = tools.toId(roomType);

		logger.info(roomid + " is being opened.");
		addRoom(roomid, roomType);

	} else if ((data+'|').substr(0,8) === '|expire|') {
		var room = ROOMS[roomid];
		logger.info(roomid + " has expired.");
		if(room) {
			room.expired = true;
			if (room.updateUser) room.updateUser();
		}
		return;
	} else if ((data+'|').substr(0,8) === '|deinit|' || (data+'|').substr(0,8) === '|noinit|') {
		if (!roomid) roomid = 'lobby';

		// expired rooms aren't closed when left
		if (this.rooms[roomid] && this.rooms[roomid].expired) return;

		logger.info(roomid + " has been closed.");
		removeRoom(roomid);
		return;
	}
	if(roomid) {
		if(ROOMS[roomid]) {
			ROOMS[roomid].recieve(data);
		} else {
			log.error("Room of id " + roomid + " does not exist to send data to.");
		}
		return;
	}

	var parts;
	if(data.charAt(0) === '|') {
		parts = data.substr(1).split('|');
	} else {
		parts = [];
	}

	switch(parts[0]) {
		// Challenge string
		case 'challenge-string':
		case 'challstr':
			logger.info("Recieved challenge string...");
			CHALLENGE_KEY_ID = parseInt(parts[1], 10);
			CHALLENGE = parts[2];

			// Now try to rename to the given user
			rename(account.username, account.password);
			break;
		// Server is telling use to update the user that we are currently logged in as
		case 'updateuser':
			// The update user command can actually come with a second command (after the newline)
			var nlIndex = data.indexOf('\n');
			if (nlIndex > 0) {
				recieve(data.substr(nlIndex+1));
				nlIndex = parts[3].indexOf('\n');
				parts[3] = parts[3].substr(0, nlIndex);
			}

			var name = parts[1];
			var named = !!+parts[2];

			if(name == account.username) {
				logger.info("Successfully logged in.");

				logger.info("Searching for an unranked random battle");
				send("/search unratedrandombattle ");
			}
			break;
		case 'popup':
			logger.info("Popup: " + data.substr(7).replace(/\|\|/g, '\n'));
			break;
		default:
			logger.warn("Did not recognize command of type: " + parts[0]);
			break;
	}
}

client.on('connection', function() {
	logger.info('Connected to server.');
});

client.on('data', function(msg) {
	recieve(msg);
});

client.on('error', function(e) {

});