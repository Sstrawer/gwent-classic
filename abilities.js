"use strict"

var ability_dict = {
	clear: {
		name: "晴空",
		description: "移除所有天气卡牌（刺骨冰霜、蔽日浓雾、倾盆大雨）的效果。",
		audio: "clear"
	},
	frost: {
		name: "刺骨冰霜",
		description: "双方所有近战单位牌战力变为1。",
		audio: "cold"
	},
	fog: {
		name: "蔽日浓雾",
		description: "双方所有远程单位牌战力变为1。",
		audio: "fog"
	},
	rain: {
		name: "倾盆大雨",
		description: "双方所有攻城单位牌战力变为1。",
		audio: "rain"
	},
	storm: {
		name: "史凯利杰风暴",
		description: "所有远程和攻城单位战力变为1。",
		audio: "rain"
	},
	hero: {
		name: "英雄",
		description: "不受任何特殊牌或能力影响。"
	},
	decoy: {
		name: "诱饵",
		audio: "decoy",
		description: "与场上的一张牌交换，将其收回手牌。"
	},
	horn: {
		name: "指挥官号角",
		description: "该排所有单位牌战力翻倍。每排限用一张。",
		audio: "horn",
		placed: async card => {
			await card.animate("horn");
		}
	},
	mardroeme: {
		name: "马德罗姆",
		description: "触发同一排所有狂战士卡牌变形。",
		placed: async (card, row) => {
			const berserkers = row.findCards(c => c.abilities.includes("berserker"));
			await Promise.all(berserkers.map(async c => await ability_dict["berserker"].placed(c, row)));
		}
	},
	berserker: {
		name: "狂战士",
		description: "当所在排有马德罗姆牌时变形为熊。",
		placed: async (card, row) => {
			if (row.effects.mardroeme === 0)
				return;
			row.removeCard(card);
			const cardId = card.name.indexOf("Young") === -1 ? 206 : 207;
			await row.addCard(new Card(card_dict[cardId], card.holder));
		}
	},
	vildkarrl: {
		placed: async (card, row) => {
			if (card.abilities.includes('vildkarrl'))
			{
				card.abilities.remove('vildkarrl');
				await AudioManager.playSFX("mardroeme", 1000);
				setTimeout(()=>card.placed.remove(ability_dict['vildkarrl'].placed), 5000);
			}
		}
	},
	scorch: {
		name: "灼烧",
		description: "打出后弃掉。消灭战场上战力最高的牌。",
		activated: async card => {	
			await ability_dict["scorch"].placed(card);
			await board.toGrave(card, card.holder.hand);
		},
		placed: async (card, row) => {
			if (row !== undefined)
				row.cards.splice( row.cards.indexOf(card), 1);
			let maxUnits = board.row.map( r => [r,r.maxUnits()] ).filter( p => p[1].length > 0);
			if (row !== undefined)
				row.cards.push(card);
			let maxPower = maxUnits.reduce( (a,p) => Math.max(a, p[1][0].power), 0 );
			let scorched = maxUnits.filter( p => p[1][0].power === maxPower);
			let cards = scorched.reduce( (a,p) => a.concat( p[1].map(u => [p[0], u])), []);
			
			if (cards.length)
			{
				await Promise.all(cards.map( async u => await u[1].animate("scorch", true, false)) );
				await Promise.all(cards.map( async u => await board.toGrave(u[1], u[0])) );
			}
		}
	},
	scorch_c: {
		name: "灼烧 — 近战",
		description: "若敌方所有近战单位总战力为10或以上，则摧毁其最强近战单位。",
		placed: async (card) => await board.getRow(card, "close", card.holder.opponent()).scorch()
	},
	scorch_r: {
		name: "灼烧 — 远程",
		description: "若敌方所有远程单位总战力为10或以上，则摧毁其最强远程单位。",
		placed: async (card) => await board.getRow(card, "ranged", card.holder.opponent()).scorch()
	},
	scorch_s: {
		name: "灼烧 — 攻城",
		description: "若敌方所有攻城单位总战力为10或以上，则摧毁其最强攻城单位。",
		placed: async (card) => await board.getRow(card, "siege", card.holder.opponent()).scorch()
	},
	agile: {
		name:"敏捷", 
		description: "可被放置于近战或远程排。一旦放置便不可移动。"
	},
	muster: {
		name:"集合", 
		description: "从卡组中找到所有同名卡牌并立即打出。",
		placed: async (card) => {
			let i = card.name.indexOf('-');
			let cardName = i === -1 ?  card.name : card.name.substring(0, i);
			if (card['muster'])
			{
				cardName = card['muster'];
			}
			let pred = c => c.name.startsWith(cardName);
			let units = card.holder.hand.getCards(pred).map(x => [card.holder.hand, x])
			.concat(card.holder.deck.getCards(pred).map( x => [card.holder.deck, x] ) );
			if (units.length === 0)
				return;
			await card.animate("muster");
			await Promise.all( units.map( async p =>  await board.addCardToRow(p[1], p[1].row, p[1].holder, p[0])));
		}
	},
	spy: {
		name: "间谍",
		description: "放置于敌方战场上（算入对方总分），并从你的卡组抽2张牌。",
		audio: "spy",
		placed: async (card) => {
			await card.animate("spy");
			for (let i=0;i<2;i++) {
				if (card.holder.deck.cards.length > 0)
					await card.holder.deck.draw(card.holder.hand);
			}
			card.holder = card.holder.opponent();
			AudioManager.playSFX('draw');
		}
	},
	medic: {
		name: "医生",
		description: "从你的坟场中选择一张牌立即打出（不能选英雄或特殊牌）。",
		audio: "medic",
		placed: async (card) => {
			let grave = board.getRow(card, "grave", card.holder);
			let units = card.holder.grave.findCards(c => c.isUnit());
			if (units.length <= 0)
				return;
			let wrapper = {card : null};
			if (game.randomRespawn) {
				const cards = grave.findCardsRandom(c => c.isUnit());
				if (cards.length > 0)
					wrapper.card = cards[0];
			} else if (card.holder.controller instanceof ControllerAI)
				wrapper.card =  card.holder.controller.medic(card, grave);
			else
				await ui.queueCarousel(card.holder.grave, 1, (c, i) => wrapper.card=c.cards[i], c => c.isUnit(), true);
			if (wrapper.card)
			{
				// move card visual to top of grave
				const res = wrapper.card;
				grave.removeCard(res);
				grave.addCard(res);
				let selectedRow = null;
				const isAgile = wrapper.card.row === "agile";
				if (isAgile)
				{
					if (card.holder.controller instanceof ControllerAI)
					{
						const close = board.getRow(res, "close", player_op);
						const ranged = board.getRow(res, "ranged", player_op);
						const closeVirtual = close.getVirtualCopy();
						const rangedVirtual = ranged.getVirtualCopy();

						closeVirtual.cards.push(res);
						closeVirtual.updateState(res, true);
						rangedVirtual.cards.push(res);
						rangedVirtual.updateState(res, true);

						const closeDif = closeVirtual.calcScore() - close.calcScore();
						const rangedDif = rangedVirtual.calcScore() - ranged.calcScore();
						const rowName = closeDif > rangedDif ? "close" 
							: closeDif < rangedDif ? "ranged"
							: Math.random() < 0.5 ? "close" : "ranged";
						selectedRow = board.getRow(res, rowName, player_op);
					}
					else
					{
						selectedRow = await ui.waitForRowSelection(wrapper.card);
						if (!selectedRow)
						{
							return;
						}
					}

				}
				await res.animate("medic");
				if (isAgile)
				{
					await board.moveTo(res, selectedRow, grave);
				}
				else
				{
					await res.autoplay(grave);
				}
			}
		}
	},
	morale: {
		name: "士气",
		description: "使该排所有其他单位战力+1。",
		audio: "morale",
		placed: async card => {
			await card.animate("morale");
		}
	},
	bond: {
		name: "同袍之情",
		description: "放在同名卡牌旁边时，两张牌的战力都翻倍。",
		audio: "bond",
		placed: async card => {
			let bonds = board.getRow(card, card.row, card.holder).findCards(c => c.name === card.name);
			if (bonds.length > 1)
				await Promise.all( bonds.map(c => c.animate("bond")) );
		}
	},
	avenger: {
		name: "复仇者",
		description: "当此牌从战场移除时，召唤一张强力新单位牌取而代之。",
		removed: async (card) => {
			let bdf = new Card(card_dict[21], card.holder);
			bdf.removed.push( () => setTimeout( () => {
				if (game.isPlaying())
					bdf.holder.grave.removeCard(bdf);
			}, 1001) );
			await board.addCardToRow(bdf, "close", card.holder);
		},
		weight: () => 50
	},
	avenger_kambi: {
		name: "复仇者",
		description: "当此牌从战场移除时，召唤一张强力新单位牌取而代之。",
		removed: async card => {
			let bdf = new Card(card_dict[196], card.holder);
			bdf.removed.push( () => setTimeout( () => {
				if (game.isPlaying())
					bdf.holder.grave.removeCard(bdf); 
			}, 1001) );
			await board.addCardToRow(bdf, "close", card.holder);
		},
		weight: () => 50
	},
	foltest_king: {
		description: "从你的卡组中选择一张蔽日浓雾立即打出。",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "蔽日浓雾");
			if (out)
				await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "fog")
	},
	foltest_lord: {
		description: "清除场上所有天气效果（刺骨冰霜、倾盆大雨、蔽日浓雾）。",
		activated: async () => await weather.clearWeather(),
		weight: (card, ai) =>  ai.weightCard( {row:"weather", name:"晴空"} )
	},
	foltest_siegemaster: {
		description: "你所有攻城单位战力翻倍（若该排已有指挥官号角则无效）。",
		activated: async card => await board.getRow(card, "siege", card.holder).leaderHorn(),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "siege", card.holder))
	},
	foltest_steelforged: {
		description: "若敌方所有攻城单位总战力为10或以上，摧毁其最强攻城单位。",
		activated: async card => await ability_dict["scorch_s"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "siege")
	},
	foltest_son: {
		description: "若敌方所有远程单位总战力为10或以上，摧毁其最强远程单位。",
		activated: async card => await ability_dict["scorch_r"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "ranged")
	},
	emhyr_imperial: {
		description: "从你的卡组中选择一张倾盆大雨立即打出。",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "倾盆大雨");
			if (out)
				await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "rain")
	},
	emhyr_emperor: {
		description: "查看对手手牌中随机3张牌。",
		activated: async card => {
			if (card.holder.controller instanceof ControllerAI)
				return;
			let container = new CardContainer();
			container.cards = card.holder.opponent().hand.findCardsRandom(() => true, 3);
			Carousel.curr.cancel();
			await ui.viewCardsInContainer(container);
		},
		weight: card => {
			let count = card.holder.opponent().hand.cards.length;
			return count === 0 ? 0 : Math.max(10, 10 * (8 - count));
		}
	},
	emhyr_whiteflame: {
		description: "取消对手的领袖能力。"
	},
	emhyr_relentless: {
		description: "从对手的坟场抽一张牌。",
		activated: async card => {
			let grave = board.getRow(card, "grave", card.holder.opponent());
			if (grave.findCards(c => c.isUnit()).length === 0)
				return;
			if (card.holder.controller instanceof ControllerAI) {
				let newCard = card.holder.controller.medic(card, grave);
				newCard.holder = card.holder;
				await board.toHand(newCard, grave);
				return;
			}
			Carousel.curr.cancel();
			await ui.queueCarousel(grave, 1, async (c,i) => {
				let newCard = c.cards[i];
				newCard.holder = card.holder;
				await board.toHand(newCard, grave);
			}, c => c.isUnit(), true);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder.opponent())
	},
	emhyr_invader: {
		description: "将单位恢复到战场的能力改为随机选择单位。影响双方玩家。",
		gameStart: () => game.randomRespawn = true
	},
	eredin_commander: {
		description: "你所有近战单位战力翻倍（若该排已有指挥官号角则无效）。",
		activated: async card => await board.getRow(card, "close", card.holder).leaderHorn(),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "close", card.holder))
	},
	eredin_bringer_of_death: {
		name: "艾瑞汀：死亡使者",
		description: "从你的坟场取回一张牌到手牌。",
		activated: async card => {
			let newCard;
			if (card.holder.controller instanceof ControllerAI) {
				newCard = card.holder.controller.medic(card, card.holder.grave)
			} else {
				Carousel.curr.exit();
				await ui.queueCarousel(card.holder.grave, 1, (c,i) => newCard = c.cards[i], c => c.isUnit(), false, false);
			}
			if (newCard)
				await board.toHand(newCard, card.holder.grave);
		},
		weight: (card, ai, max, data) => ai.weightMedic(data, 0, card.holder)
	},
	eredin_destroyer: {
		description: "弃掉2张牌，从你的卡组中选择1张牌抽到手牌。",
		activated: async (card) => {
			let hand = board.getRow(card, "hand", card.holder);
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				let cards = card.holder.controller.discardOrder(card).splice(0,2).filter(c => c.basePower < 7);
				await Promise.all(cards.map(async c => await board.toGrave(c, card.holder.hand)));
				card.holder.deck.draw(card.holder.hand);
				return;
			} else
				Carousel.curr.exit();
			await ui.queueCarousel(hand, 2, (c,i) => board.toGrave(c.cards[i], c), () => true);
			await ui.queueCarousel(deck, 1, (c,i) => board.toHand(c.cards[i], deck), () => true, true);
		},
		weight: (card, ai) => {
			let cards = ai.discardOrder(card).splice(0,2).filter(c => c.basePower < 7);
			if (cards.length < 2)
				return 0;
			return cards[0].abilities.includes("muster") ? 50 : 25;
		}
	},
	eredin_king: {
		description: "从你的卡组中选择任意一张天气牌立即打出。",
		activated: async card => {
			let deck = board.getRow(card, "deck", card.holder);
			if (card.holder.controller instanceof ControllerAI) {
				await ability_dict["eredin_king"].helper(card).card.autoplay(card.holder.deck);
			} else {
				Carousel.curr.cancel();
				await ui.queueCarousel(deck, 1, (c,i) => board.toWeather(c.cards[i], deck), c => c.faction === "weather", true);
			}
		},
		weight: (card, ai, max) => ability_dict["eredin_king"].helper(card).weight,
		helper: card => {
			let weather = card.holder.deck.cards.filter(c => c.row === "weather").reduce((a,c) =>a.map(c => c.name).includes(c.name) ? a : a.concat([c]), [] );
			
			let out, weight = -1;
			weather.forEach( c => {
				let w = card.holder.controller.weightWeatherFromDeck(c, c.abilities[0]);
				if (w > weight) {
					weight = w;
					out = c;
				}
			});
			return {card: out, weight: weight};
		}			
	},
	eredin_treacherous: {
		description: "所有间谍牌战力翻倍（影响双方玩家）。",
		gameStart: () => game.doubleSpyPower = true
	},
	francesca_queen: {
		description: "若敌方所有近战单位总战力为10或以上，摧毁其最强近战单位。",
		activated: async card => await ability_dict["scorch_c"].placed(card),
		weight: (card, ai, max) => ai.weightScorchRow(card, max, "close")
	},
	francesca_beautiful: {
		description: "你所有远程单位战力翻倍（若该排已有指挥官号角则无效）。",
		activated: async card => await board.getRow(card, "ranged", card.holder).leaderHorn(),
		weight: (card, ai) => ai.weightHornRow(card, board.getRow(card, "ranged", card.holder))
	},
	francesca_daisy: {
		description: "战斗开始时额外抽一张牌。",
		placed: card => game.gameStart.push( () => {
			let draw = card.holder.deck.removeCard(0);
			card.holder.hand.addCard( draw );
			return true;
		})
	},
	francesca_pureblood: {
		description: "从你的卡组中选择一张刺骨冰霜立即打出。",
		activated: async card => {
			let out = card.holder.deck.findCard(c => c.name === "刺骨冰霜");
			if (out)
				await out.autoplay(card.holder.deck);
		},
		weight: (card, ai) => ai.weightWeatherFromDeck(card, "frost")
	},
	francesca_hope: {
		description: "将敏捷单位移动到使其战力最大化的可行排（已在最优排的不动）。",
		activated: async card => {
			const close = board.getRow(card, "close");
			const ranged =  board.getRow(card, "ranged");
			const solution = ability_dict["francesca_hope"].helper(card);
			await Promise.all(solution.cards.map(async p => await board.moveTo(p.card, p.row === close ? ranged : close, p.row) ) );
		},
		weight: card => {
			const {score, cards} = ability_dict["francesca_hope"].helper(card);
			return score;
		},
		helper: card => {
			const close = board.getRow(card, "close");
			const ranged = board.getRow(card, "ranged");
			const agileCards = close.cards.filter(c => c.row === "agile").concat(ranged.cards.filter(c => c.row === "agile"));
			const notAgilePred = c => c.row !== "agile";
			const closeNorm = close.getVirtualCopy(notAgilePred);
			const rangedNorm = ranged.getVirtualCopy(notAgilePred);
			const {score, pattern} = findBest(closeNorm, rangedNorm, agileCards);
			// filter for only cards that need to change row and return
			return {
				score: score,
				cards: agileCards.map((c)=> { return {card: c, row: close.cards.includes(c) ? close : ranged}; })
				.filter((pair, i) => (pair.row === close) !== (pattern[i]===0))
			};

			function findBest(close, ranged, agile, depth = 0, pattern=null)
			{
				if (agile.length === 0)
					return {score: -1, pattern: []};
				else if (agile.length === depth)
				{
					const closeCopy = close.getVirtualCopy();
					const rangedCopy = ranged.getVirtualCopy();
					for (let i=0; i <agile.length; ++i)
					{
						const row = pattern[i] === 0 ? closeCopy : rangedCopy;
						row.cards.push(agile[i]);
						row.updateState(agile[i], true);
					}
					return {score: closeCopy.calcScore() + rangedCopy.calcScore() - (close.calcScore() + ranged.calcScore()), pattern: pattern};
				}
				if (depth === 0)
				{
					pattern = Array(agile.length).fill(0);
				}
				const left = findBest(close, ranged, agile, depth + 1, pattern)
				const modPattern = pattern.slice();
				modPattern[depth] = 1;
				const right = findBest(close, ranged, agile, depth + 1, modPattern);
				return left.score >= right.score ? left : right;
			}
		}
	},
	crach_an_craite: {
		description: "将双方玩家坟场中的所有牌洗回各自的卡组。",
		activated: async card => {
			AudioManager.playSFX('redraw');
			Promise.all(card.holder.grave.cards.map(c => board.toDeck(c, card.holder.grave)));
			await Promise.all(card.holder.opponent().grave.cards.map(c => board.toDeck(c, card.holder.opponent().grave)));
		},
		weight: (card, ai, max, data) => {
			if( game.roundCount < 2)
				return 0;
			let medics = card.holder.hand.findCard(c => c.abilities.includes("medic"));
			if (medics !== undefined)
				return 0;
			let spies = card.holder.hand.findCard(c => c.abilities.includes("spy"));
			if (spies !== undefined)
				return 0;
			if (card.holder.hand.findCard(c => c.abilities.includes("decoy")) !== undefined && (data.medic.length || data.spy.length && card.holder.deck.findCard(c => c.abilities.includes("medic")) !== undefined) )
				return 0;
			return 15;
		}
	},
	king_bran: {
		description: "在恶劣天气下，单位只损失一半战力。",
		placed: card => board.row.filter((c,i) => card.holder === player_me ^ i<3).forEach(r => r.effects.halfWeather = true)
	}
};