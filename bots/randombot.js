/* Randombot - to be used primarily for testing
Can also be used as a fallback, in case another decision algorithm
fails or crashes */

// Logging
var log4js = require('log4js');
var logger = require('log4js').getLogger("minimax");
var learnlog = require('log4js').getLogger("learning");

var program = require('commander'); // Program settings
var fs = require('fs');

var _ = require("underscore");
var BattleRoom = require("./../battleroom");

var randombot = require("./randombot");
var greedybot = require("./greedybot");

var clone = require("./../clone");

var convnetjs = require("convnetjs");

var opPokT = [];
var aiPokT = [];


var calcHP = function(player, arr) {
	a = 0;
	for (var p = 0; p < 6; p++) {
		if (!isNaN(player.pokemon[p].hp) && player.pokemon[p].name !== "Bulbasaur") {
			var b = player.pokemon[p].hp/(arr[player.pokemon[p].name]);
			a+=b;
			console.log("HP IS");
			console.log(b);
		}
	}
	return a/6;
}

function sumArr(arr) {
	sum = 0.01;
	for (var i = 0; i < arr.length; i++) {
		sum += arr[i];
	}
	return sum;
}

function cumSum(arr) {
	sum = 0.0;
	for (var i = 0; i < arr.length; i++) {
		sum += arr[i];
		arr[i] = sum;
	}
	return arr;
}

function findMove(arr, n) {
	for (var i = 0; i < arr.length; i++) {
		if (n < arr[i]) {
			return i;
		}
	}
}		

function sim1v1(battle) {
	score = 0;
	//Get Opponents moves
	var oChoices = _.reject(BattleRoom.parseRequest(battle.p2.request).choices, function(c) {
		if(c.type == "switch") return true;
		return false;
	});
	//Get My Moves
	var aChoices = _.reject(BattleRoom.parseRequest(battle.t).choices, function(c) {
		if(c.type == "switch") return true;
		return false;
	});
	for (var q = 0; q < 12; q++) {
		newbattle = clone(battle);
		console.log("THE GAME HAS BEGUN");
		for (var j = 0; j < 10; j++) {
			//Give my priorities
			var mProb = _.map(aChoices, function(choice) {
		        return greedybot.getPriority(newbattle, choice, newbattle.p1, newbattle.p2);
		    });
			var oProb = _.map(oChoices, function(choice) {
		        return greedybot.getPriority(newbattle, choice, newbattle.p2, newbattle.p1);
		    });
			oSum = sumArr(oProb);
			mSum = sumArr(mProb);
		    var mProb = _.map(mProb, function(choice) {
		        return choice/mSum;
		    });
			var oProb = _.map(oProb, function(choice) {
		        return choice/oSum;
		    });
			var mProb = cumSum(mProb);
			var oProb = cumSum(oProb);
			omove = oChoices[findMove(oProb, Math.random())];
			pmove = aChoices[findMove(mProb, Math.random())];
			console.log(omove);
			console.log(pmove);
			console.log(newbattle.p1.request.wait);
			console.log(newbattle.p2.request.wait);
			if (pmove) {
				newbattle.choose('p1', BattleRoom.toChoiceString(pmove, newbattle.p1), newbattle.rqid);
			};
			if (omove) {
				newbattle.choose('p2', BattleRoom.toChoiceString(omove, newbattle.p2), newbattle.rqid);
			};
			newbattle.p1.decision = true;
			newbattle.p2.decision = true;
			var myPokemon = newbattle.p1.active[0];
    		var oppPokemon = newbattle.p2.active[0];
    		if (myPokemon.hp == 0) {
    			score -= 1;
    			console.log("I LOST, OH NOEZ");
    			break;
    		}
    		if (oppPokemon.hp == 0) {
    			score += 1;
    			console.log("I WON, OH YAYZ");
    			break;
    		}
		}
	}
	console.log("SCORE");
	console.log(score);
	return score;
}

var eval = module.exports.eval = function(battle) {
	var AI = battle.p1;
	var HU = battle.p2;
	var aHP = calcHP(AI, aiPokT);
	var oHP = calcHP(HU, opPokT);
	var vscr = sim1v1(battle);
	return aHP*50 + oHP*(-50) + vscr;
}

var getChoices = function(battle, p1) {
	if (p1) {
		var choices = BattleRoom.parseRequest(battle.p1.request).choices;		
	} else {
		var choices = BattleRoom.parseRequest(battle.p2.request).choices;
	}
	return choices;
}

var playerMove = function(battle, pSC) {
	var choices = [];
	for (var i = 0; i < battle.p1.active[0].moves.length; i++) {
		choices.add({type: "move", id: battle.p1.active[0].moves[i]})
	}
	choices = _.reject(choices, function(choice) {
	var bob = choice;
	if (bob.id == "volt switch" && bob.id == "dragon tail" && bob.id == "roar" && bob.id == "baton pass" && bob.id == "whirlwind" && bob.id == "uturn" && bob.id == "substitute" && bob.id == "protect") {
		bob = choices[i];
		i++;
		return true;
	}
	return false;
});
	return choices;
}

var oppMove = function(battle, oSC) {
		var choices = [];
	for (var i = 0; i < battle.p2.active[0].moves.length; i++) {
		choices.add({type: "move", id: battle.p2.active[0].moves[i]})
	}
	choices = _.reject(choices, function(choice) {
	var bob = choice;
	if (bob.id == "volt switch" && bob.id == "dragon tail" && bob.id == "roar" && bob.id == "baton pass" && bob.id == "whirlwind" && bob.id == "uturn" && bob.id == "substitute" && bob.id == "protect") {
		bob = choices[i];
		i++;
		return true;
	}
	return false;
});
	return choices;
}

var runSim = function(n, move, battle, pd, od, oa) {
	var results = 0;
	for (var i = 0; i < n; i++) {
		var game = [];
		var newbattle = clone(battle);
		var oSC = 2;
		var pSC = 1;
		for (var j = 0; j < 20; j++) {
			if (j === 0) {
				var pmove = move;
			} else {
				var pmove = playerMove(newbattle, pSC);
			}
			var omove = oppMove(newbattle, oSC);
			if (pmove && !newbattle.p1.request.wait) {
				if (pmove.type === "switch") {
					pSC -= 1;
				}
				newbattle.choose('p1', BattleRoom.toChoiceString(pmove, newbattle.p1), newbattle.rqid);
			}
			if (omove && !newbattle.p2.request.wait) {
				if (omove.type === "switch") {
					oSC -= 1;
				}
				newbattle.choose('p2', BattleRoom.toChoiceString(omove, newbattle.p2), newbattle.rqid);
			}
			game.push(pmove);
			game.push(omove);
			newbattle.p1.decision = true;
			newbattle.p2.decision = true;
			var playerAlive = _.reject(newbattle.p1.pokemon, function(pokemon) { return pokemon.hp > 0; });
			var opponentAlive = _.reject(newbattle.p2.pokemon, function(pokemon) { return pokemon.hp > 0 && pokemon.name !== "Bulbasaur"});
			if (playerAlive.length - pd.length === Math.min(oa, 2) || playerAlive.length == 6) {
				a = 0;
				for (var p = 0; p < 6; p++) {
					if (!isNaN(newbattle.p2.pokemon[p].hp)) {
						a += newbattle.p2.pokemon[p].hp	
						console.log("adfsfdsdfsdfdsdsop");
						console.log(newbattle.p2.pokemon[p].hp);						
					}
				}
				console.log("OH NOE")
				results += -a - 20*(20-j);
				break;
			}
			if (opponentAlive.length - od.length === Math.min(2, oa) || opponentAlive.length == 6) {
				a = 0;
				for (var p = 0; p < 6; p++) {
					if (!isNaN(newbattle.p1.pokemon[p].hp)) {
						a += newbattle.p1.pokemon[p].hp
						console.log("adfsfdsdfsdfdsds");
						console.log(newbattle.p1.pokemon[p].hp);	
					}
				}
				console.log("GOTTEM TEAM")
				results += a + 20*(20-j);
				break;
			}
		}
		console.log("KIKIKI")
		console.log(game);
		delete game
		delete newbattle;
	}
	console.log(results);
	return results/n;
}

var monteCarlo = function(initC, battle) {
	var bestMove = initC[0];
	var bestScore = -10000;
	var playerAlive = _.reject(battle.p1.pokemon, function(pokemon) { return pokemon.hp > 0; });
	console.log("IM ALIIIVE")
	console.log(playerAlive);
	var opponentAlive = _.reject(battle.p2.pokemon, function(pokemon) { return pokemon.hp > 0 && pokemon.name !== "Bulbasaur"});	
	//var opponentA = _.reject(battle.p2.pokemon, function(pokemon) { return pokemon.hp <= 0 || pokemon.name === "Bulbasaur"});
	console.log("LENGYY");
	console.log(6 - opponentAlive.length);			
	for (var i = 0;i < initC.length; i++) {
		console.log("TROLOLOL");
		console.log(battle.p2.pokemon[0]);
		var score = runSim(50, initC[i], battle, playerAlive, opponentAlive, 6 - opponentAlive.length);
		if (score > bestScore) {
			bestMove = initC[i];
			bestScore = score;
		}
		console.log("Move NumberztzDFSF    Move Score");
		console.log(initC[i].id);
		console.log(score);
	}
	return bestMove;
}

var setup = function(battle, poke1, poke2) {
	newbattle = clone(battle);
	for (var i = 1; i < 6; i++) {
		if (newbattle.p1.pokemon[i].name === poke1) {
			console.log("PULLING THE GOOD OLD SWITCH")
			newbattle.switchIn(newbattle.p1.pokemon[i], 0);
			break;
		}
	}
	for (var i = 1; i < 6; i++) {
		if (newbattle.p2.pokemon[i].name === poke2) {
			newbattle.switchIn(newbattle.p2.pokemon[i], 0);
			break;
		}
	}
	// newbattle.choose('p1', BattleRoom.toChoiceString({type: 'switch', id: poke1}, newbattle.p1), newbattle.rqid);
	// newbattle.choose('p2', BattleRoom.toChoiceString({type: 'switch', id: poke2}, newbattle.p2), newbattle.rqid);
	// newbattle.p1.decision = true;
	// newbattle.p2.decision = true;
	console.log("NNEW ACTIVE POKEE");
	console.log(newbattle.p1.active[0].name);
	return newbattle;
}

var calcPotentialDamage = function(battle, choices, player) {
	var mp;
	var op;
	if (player === 1) {
		mp = battle.p1;
		op = battle.p2;
	} else {
		mp = battle.p2;
		op = battle.p1;
	}
	var potDat = 0;
	for (var i = 0; i < 6; i++) {
		if (!isNaN(op.pokemon[i].hp)) {
			if (!(op.pokemon[i].name === 'Bulbasaur')) {
				if (player === 1) {
				var stuff = findBestMoveMe(battle, choices, mp.pokemon[0].name, op.pokemon[i].name);
				console.log("ME VS U");
				console.log(mp.active[0].name);
				console.log(op.pokemon[i].name);
				console.log(stuff.score);
				} else {
					var stuff = findBestMoveOp(battle, choices, op.pokemon[i].name, mp.active[0].name);
				}
				potDat += stuff.score;
			} else {
				potDat += potDat*1.0/i;
			}
			
		}
	}
	return potDat;
}

var damDone = function(battle, player) {
	var mp;
	var op;
	if (player === 1) {
		mp = battle.p1;
		op = battle.p2;
	} else {
		mp = battle.p2;
		op = battle.p1;
	}
	var dd = 0;
	for (var i = 0; i < 6; i++) {
		if (!isNaN(op.pokemon[i].hp)) {
			dd += (op.pokemon[i].maxhp - op.pokemon[i].hp)*100.0/op.pokemon[i].maxhp;
		} else {
			dd += 100.0;
		}
	}	
	return dd;
}

var findBestMoveMe = function(battle, choices, poke1, poke2) {
	var bestMove = choices[0];
	var bestScore = 100000;
	var newwbattle = setup(battle, poke1, poke2);
	var opMove = oppMove(newwbattle, 10);
	console.log(opMove);
	for (var i = 0; i < 4; i++) {
		var score = 0;
		for (var j = 0; j < opMove.length; j++) {
			var newbattle = clone(newwbattle);
			newbattle.choose('p1', BattleRoom.toChoiceString(choices[i], newbattle.p1), newbattle.rqid);
			newbattle.choose('p2', BattleRoom.toChoiceString(opMove[j], newbattle.p2), newbattle.rqid);
			newbattle.p1.decision = true;
			newbattle.p2.decision = true;
			score += newbattle.p2.active[0].hp;
		}
		score = 100.0*score/(opMove.length*newwbattle.p2.active[0].maxhp);
		if (score < bestScore) {
			bestScore = score;
			bestMove = choices[i];
		}
	}
	var blob = {move: bestMove, score: 100 - bestScore};
	return blob;
}

var findBestMoveOp = function(battle, choices, poke1, poke2) {
	var bestMove = choices[0];
	var bestScore = 100000;
	var newwbattle = setup(battle, poke1, poke2);
	var opMove = oppMove(newwbattle, 10);
	var pMove = playerMove(newwbattle, 10);
	console.log(opMove);
	console.log(pMove);
	for (var i = 0; i < opMove.length; i++) {
		var score = 0;
		for (var j = 0; j < pMove.length; j++) {
			var newbattle = clone(newwbattle);
			newbattle.choose('p1', BattleRoom.toChoiceString(pMove[j], newbattle.p1), newbattle.rqid);
			newbattle.choose('p2', BattleRoom.toChoiceString(opMove[i], newbattle.p2), newbattle.rqid);
			newbattle.p1.decision = true;
			newbattle.p2.decision = true;
			score += newbattle.p1.active[0].hp;
		}
		score = score*100.0/(pMove.length*newwbattle.p1.active[0].maxhp);
		if (score < bestScore) {
			bestScore = score;
			bestMove = opMove[i];
		}
	}
	var blob = {move: bestMove, score: 100 - bestScore};
	return blob;
}

var evaluate = function(battle, choices) {
	var ddme = damDone(battle, 1);
	var ddu = damDone(battle, 2);
	if (!(battle.p1.wait || battle.p2.wait)) {
		var dpme = calcPotentialDamage(battle, choices, 1);
		var dpu = calcPotentialDamage(battle, oppMove(battle, 10), 2);
		console.log("MY DAMAGE DONE")
	console.log(ddme);
	console.log("MY DAMAGE POT");
	console.log(dpme);
	console.log("YOUR DAMAGE DONE");
	console.log(ddu);
	console.log("UR DAMAGE POT");
	console.log(dpu);
	console.log(ddme*10 + dpme - dpu - ddu*9);
	return (ddme*3 + dpme - dpu - ddu*2);
	} else {
		return ddme*3 - ddu*2
	}
}

var decide = module.exports.decide = function(battle, choices) {
	battle.start();
	// console.log("RAYMOND3")
 //    console.log(battle.p1.active.length);
	//if (choices[0].type == "switch") return choices[0];
	// for (var p = 0; p < 6; p++) {
	// 	if (!isNaN(battle.p2.pokemon[p].hp)) {
	// 		console.log("adfsfdsdfsdfdsds");
	// 		console.log(battle.p2.pokemon[p].name);
	// 		console.log(battle.p2.pokemon[p].hp);	
	// 	}
	// 	if (opPokT.indexOf(battle.p2.pokemon[p].name) == -1 && battle.p2.pokemon[p] !== "Bulbasaur") {
	// 		opPokT[battle.p2.pokemon[p].name] = battle.p2.pokemon[p].hp;
	// 	}
	// 	if (aiPokT.indexOf(battle.p1.pokemon[p].name) == -1 && battle.p1.pokemon[p] !== "Bulbasaur") {
	// 		aiPokT[battle.p1.pokemon[p].name] = battle.p1.pokemon[p].hp;
	// 	}
	// }
	// sim1v1(battle);
	// var bestMove = choices[0];
	// var bestScore = -100000;
	// for (var i = 0; i < choices.length; i++) {
	// 	var newbattle = clone(battle);
	// 	if (!newbattle.p2.wait) {
	// 		var opmove = findBestMoveOp(newbattle, oppMove(newbattle, 10), newbattle.p1.active[0].name, newbattle.p2.active[0].name);		
	// 		opmove = opmove.move;
	// 		console.log("HAPPING BRO");
	// 		console.log(opmove);
	// 		newbattle.choose('p2', BattleRoom.toChoiceString(opmove, newbattle.p2), newbattle.rqid);
	// 		newbattle.p2.decision = true;
	// 	}
	// 	newbattle.choose('p1', BattleRoom.toChoiceString(choices[i], newbattle.p1), newbattle.rqid);
	// 	newbattle.p1.decision = true;
	// 	var score = evaluate(newbattle, playerMove(battle, 10));
	// 	console.log("HERE IS MY STUFF");
	// 	console.log(choices[i]);
	// 	console.log(score);
	// 	if (score > bestScore) {
	// 		bestMove = choices[i];
	// 		bestScore = score;
	// 	}
	// }
	// // console.log("EVALLED THE THING")
	// var scr = evaluate(battle, choices);
	// var bob = findBestMoveMe(battle, choices, battle.p1.active[0].name, battle.p2.active[0].name);
	// console.log("GOTCHuuuuU BRUH")
	// console.log(bob.move);
	// console.log(bob.score);
	// var bolb = findBestMoveOp(battle, choices, battle.p1.active[0].name, battle.p2.active[0].name);
	// console.log(bolb.move);
	// console.log(bolb.score);
	//console.log(findBestMove(battle, choices, battle.p1.active[0].name, battle.p2.active[0].name, 2));
	// console.log(choices);
	// var beeb = calcPotentialDamage(battle, choices, 2);
	// console.log("POT DAMAGE TIME");
	// console.log(beeb);
	return choices[0];
    // return monteCarlo(choices, battle);
};
