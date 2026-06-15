"use strict"

var factions = {
	realms: {
		name: "北方领域",
		factionAbility: player => game.roundStart.push( async () => {
			if (game.roundCount > 1 && game.roundHistory[game.roundCount-2].winner === player) {
				player.deck.draw(player.hand);
				await ui.notification("north", 1200);
			}
			return false;
		}),
		description: "每赢一局从卡组抽一张牌。"
	},
	nilfgaard: {
		name: "尼弗迦德帝国",
		description: "以平局结束的局判定为胜利。"
	},
	monsters: {
		name: "怪物",
		factionAbility: player => game.roundEnd.push(() => {
			const units = board.row.filter( (r,i) => player === player_me ^ i < 3)
				.reduce((a,r) => r.cards.filter(c => c.isUnit()).concat(a), []);
			if (units.length === 0)
				return;
			const card = units[randomInt(units.length)];
			card.noRemove = true;
			game.roundStart.push( async () => {
				await ui.notification("monsters", 1200);
				delete card.noRemove;
				return true; 
			});
			return false;
		}),
		description: "每局结束后随机保留一张单位牌在场上。"
	},
	scoiatael: {
		name: "松鼠党",
		factionAbility: player => game.gameStart.push( async () => {
			let notif = "";
			if (player === player_me) {
				await ui.popup("先手", () => game.firstPlayer = player, "让对手先手", () => game.firstPlayer = player.opponent(), "你想先手吗？", "松鼠党阵营能力让你决定谁先手。", 0.55);
				notif = game.firstPlayer.tag + "-first";
			} else if (player.hand instanceof HandAI) {
				if (Math.random() < 0.5) {
					game.firstPlayer = player;
					notif = "scoiatael";
				} else {
					game.firstPlayer = player.opponent();
					notif = game.firstPlayer.tag + "-first";
				}
			} else {
				//sleepUntil(game.firstPlayer); //TODO online
			}
			await ui.notification(notif,1200);
			return true;
		}),
		description: "决定谁先手。"
	},
	skellige: {
		name: "史凯利杰",
		factionAbility: player => game.roundStart.push( async () => {
			if (game.roundCount != 3)
				return false;
			const currPlayer = game.currPlayer;
			game.currPlayer = player;
			await ui.notification("skellige-" + player.tag, 1200);
			if (player.controller instanceof ControllerAI)
			{
				await Promise.all(player.grave.findCardsRandom(c => c.isUnit(), 2).map(c => board.toRow(c, player.grave)));
			}
			else
			{
				await factions['skellige'].helper(player);
				await factions['skellige'].helper(player);
			}
			game.currPlayer = currPlayer;
			return true;
		}),
		helper: async player => {
			const units = player.grave.findCardsRandom(c => c.isUnit(), 1);
			if (units.length === 0)
				return;
			const card = units[0];
			if (card.row === 'agile')
			{
				const selectedRow = await ui.waitForRowSelection(card);
				if (selectedRow)
				{
					await board.moveTo(card, selectedRow, player.grave);
				}
			}
			else
			{
				await board.toRow(card, player.grave);
			}
		},
		description: "第3局开始时，随机从坟场拉回2张牌到战场上。"
	}
}