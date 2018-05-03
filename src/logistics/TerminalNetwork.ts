import {log} from '../lib/logger/log';
import minBy from 'lodash.minby';
import {Mem} from '../memory';
import {profile} from '../profiler/decorator';
import {Energetics} from './Energetics';

@profile
export class TerminalNetwork implements ITerminalNetwork {

	terminals: StructureTerminal[];					// All terminals
	private manifests: {							// Resources that various terminals need
		[terminalName: string]: {
			[resourceType: string]: number
		}
	};
	private alreadyReceived: StructureTerminal[];
	private cache: {
		sellPrice: { [resourceType: string]: number }
	};
	settings: {
		market: {
			reserveCredits: number,
			requestResourceAmount: number,
			maxPrice: {
				default: number,
				[resourceType: string]: number,
			}
		}
	};

	constructor(terminals: StructureTerminal[]) {
		this.terminals = terminals;
		this.manifests = {};
		this.alreadyReceived = [];
		this.settings = {
			market: {
				reserveCredits       : 10000,
				requestResourceAmount: 1000,
				maxPrice             : {
					default: 5.0,
				}
			},
		};
		this.cache = this.memory.cache;
	}

	get memory() {
		return Mem.wrap(Memory.Overmind, 'terminalNetwork', {
			cache: {}
		});
	}

	static get stats() {
		return Mem.wrap(Memory.stats.persistent, 'terminalNetwork');
	}

	/* Request resources to be transferred from another terminal or bought on the market */
	requestResource(resourceType: ResourceConstant, terminal: StructureTerminal,
					amount = this.settings.market.requestResourceAmount) {
		if (!this.manifests[terminal.room.name]) {
			this.manifests[terminal.room.name] = {};
		}
		this.manifests[terminal.room.name][resourceType] = amount;
	}

	private cacheBestSellPrices(): void {
		// Recache best selling prices on the market
		if (!this.memory.cache.sellPrice) {
			this.memory.cache.sellPrice = {};
		}
		let allOrders = Game.market.getAllOrders({type: ORDER_SELL});
		let groupedOrders = _.groupBy(allOrders, order => order.resourceType);
		for (let resourceType in groupedOrders) {
			this.memory.cache.sellPrice[resourceType] = _.min(_.map(groupedOrders[resourceType], order => order.price));
		}
	}

	/* Cost per unit including transfer price with energy converted to credits */
	private effectivePricePerUnit(order: Order, terminal: StructureTerminal): number {
		if (order.roomName) {
			let transferCost = Game.market.calcTransactionCost(1000, order.roomName, terminal.room.name) / 1000;
			let energyToCreditMultiplier = 0.3; //this.cache.sellPrice[RESOURCE_ENERGY] * 1.5;
			return order.price + transferCost * energyToCreditMultiplier;
		} else {
			return Infinity;
		}
	}

	/* Calculate what needs buying */
	private calculateShortages(terminal: StructureTerminal): { [mineralType: string]: number } {
		if (Game.market.credits < this.settings.market.reserveCredits) {
			return {};
		}
		let shortages: { [mineral: string]: number } = {};
		for (let resourceType in this.manifests[terminal.room.name]) {
			let amountInTerminal = terminal.store[<ResourceConstant>resourceType] || 0;
			let amountNeeded = this.manifests[terminal.room.name][resourceType];
			if (amountInTerminal < amountNeeded) {
				shortages[resourceType] = amountNeeded - amountInTerminal;
			}
		}
		return shortages;
	}

	private buyShortages(terminal: StructureTerminal): void {
		let shortages = this.calculateShortages(terminal);
		for (let resourceType in shortages) {
			let orders = Game.market.getAllOrders(order => order.type == ORDER_SELL &&
														   !!order.roomName &&
														   order.resourceType == resourceType &&
														   order.remainingAmount > 100);
			let bestOrder = minBy(orders, (order: Order) => this.effectivePricePerUnit(order, terminal));
			if (this.effectivePricePerUnit(bestOrder, terminal) <= this.settings.market.maxPrice[resourceType]) {
				let amount = Math.min(bestOrder.remainingAmount, shortages[resourceType]);
				let response = Game.market.deal(bestOrder.id, amount, terminal.room.name);
				this.logTransaction(bestOrder, terminal.room.name, amount, response);
			}
		}
	}

	private logTransaction(order: Order, destinationRoomName: string, amount: number, response: number): void {
		let action = order.type == ORDER_SELL ? 'Bought' : 'Sold';
		let fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, destinationRoomName) : 0;
		log.info(`${destinationRoomName}: ${action} ${amount} of ${order.resourceType} from ${order.roomName} ` +
				 `for ${order.price * amount} credits and ${fee} energy. Response: ${response}`);

	}

	static logTransfer(resourceType: ResourceConstant, amount: number, origin: string, destination: string) {
		if (!this.stats.transfers) this.stats.transfers = {};
		if (!this.stats.transfers[resourceType]) this.stats.transfers[resourceType] = {};
		if (!this.stats.transfers[resourceType][origin]) this.stats.transfers[resourceType][origin] = {};
		if (!this.stats.transfers[resourceType][origin][destination]) {
			this.stats.transfers[resourceType][origin][destination] = 0;
		}
		this.stats.transfers[resourceType][origin][destination] += amount;
		this.logTransferCosts(amount, origin, destination);
	}

	private static logTransferCosts(amount: number, origin: string, destination: string) {
		if (!this.stats.transfers.costs) this.stats.transfers.costs = {};
		if (!this.stats.transfers.costs[origin]) this.stats.transfers.costs[origin] = {};
		if (!this.stats.transfers.costs[origin][destination]) this.stats.transfers.costs[origin][destination] = 0;
		let transactionCost = Game.market.calcTransactionCost(amount, origin, destination);
		this.stats.transfers.costs[origin][destination] += transactionCost;
	}

	/* Whether the terminal has very little total energy in the room including storage */
	private terminalNeedsEnergy(terminal: StructureTerminal): boolean {
		let energy = terminal.store.energy;
		if (terminal.room.storage) {
			energy += terminal.room.storage.energy;
		}
		return energy < Energetics.settings.terminal.energy.outThreshold;
	}

	private sendExcessEnergy(terminal: StructureTerminal): void {
		let {sendSize, inThreshold, outThreshold, equilibrium} = Energetics.settings.terminal.energy;
		// See if there are any rooms actively needing energy first
		let needyTerminals = _.filter(this.terminals, t => t != terminal &&
														   this.terminalNeedsEnergy(t) &&
														   !this.alreadyReceived.includes(t));
		if (needyTerminals.length > 0) {
			// Send to the most cost-efficient needy terminal
			let bestTerminal = minBy(needyTerminals, (receiver: StructureTerminal) =>
				Game.market.calcTransactionCost(sendSize, terminal.room.name, receiver.room.name));
			let cost = Game.market.calcTransactionCost(sendSize, terminal.room.name, bestTerminal.room.name);
			let response = terminal.send(RESOURCE_ENERGY, sendSize, bestTerminal.room.name);
			log.info(`Sent ${sendSize} energy from ${terminal.room.name} to ` +
					 `${bestTerminal.room.name}. Fee: ${cost}`);
			if (response == OK) {
				TerminalNetwork.logTransfer(RESOURCE_ENERGY, sendSize, terminal.room.name, bestTerminal.room.name);
				this.alreadyReceived.push(bestTerminal);
			}
		} else {
			// Send to the most cost-efficient terminal not already trying to get rid of stuff
			let okTerminals = _.filter(this.terminals, t =>
				t != terminal && t.store.energy < outThreshold - sendSize && !this.alreadyReceived.includes(t));
			let bestTerminal = minBy(okTerminals, (receiver: StructureTerminal) =>
				Game.market.calcTransactionCost(sendSize, terminal.room.name, receiver.room.name));
			if (bestTerminal) {
				let cost = Game.market.calcTransactionCost(sendSize, terminal.room.name, bestTerminal.room.name);
				let response = terminal.send(RESOURCE_ENERGY, sendSize, bestTerminal.room.name);
				log.info(`Sent ${sendSize} energy from ${terminal.room.name} to ` +
						 `${bestTerminal.room.name}. Fee: ${cost}. Response: ${response}`);
				if (response == OK) {
					TerminalNetwork.logTransfer(RESOURCE_ENERGY, sendSize, terminal.room.name, bestTerminal.room.name);
					this.alreadyReceived.push(bestTerminal);
				}
			}
		}
	}

	init(): void {
		// if (Game.time % 500 == 2) {
		// 	this.cacheBestSellPrices();
		// }
	}

	run(): void {
		for (let terminal of this.terminals) {
			if (terminal.energy > Energetics.settings.terminal.energy.outThreshold) {
				this.sendExcessEnergy(terminal);
			}
			if (Game.time % 10 == 4) {
				this.buyShortages(terminal);
			}
		}
	}

}
