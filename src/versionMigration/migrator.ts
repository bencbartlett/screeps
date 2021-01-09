/* tslint:disable:no-string-literal */

import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {packCoordList} from '../utilities/packrat';
import {MY_USERNAME} from '../~settings';

interface VersionMigratorMemory {
	versions: { [version: string]: boolean };
}

/**
 * The VersionMigration class contains ad-hoc methods for migrating older versions of Overmind to newer versions
 */
export class VersionMigration {

	static run(): void {
		/*
		if (!this.memory.versions['02Xto03X']) {
			this.migrate_02X_03X();
		}
		if (!this.memory.versions['03Xto04X']) {
			this.migrate_03X_04X();
		}
		if (!this.memory.versions['04Xto05X']) {
			this.migrate_04X_05X();
		}
		if (!this.memory.versions['04Xto05X_part2']) {
			this.migrate_04X_05X_part2();
		}
		if (!this.memory.versions['04Xto05X_part3']) {
			this.migrate_04X_05X_part3();
		}
		*/

		if (!this.memory.versions['05Xto051']) {
			this.migrate_050_051();
		}
		if (!this.memory.versions['05Xto051_part2']) {
			this.migrate_050_051_part2();
		}
		if (!this.memory.versions['05Xto051_part3']) {
			this.migrate_050_051_part3();
		}
		if (!this.memory.versions['05Xto051_part4']) {
			this.migrate_050_051_part4();
		}
		if (!this.memory.versions['051to052']) {
			this.migrate_051_052();
		}
		if (!this.memory.versions['052to053']) {
			this.migrate_052_053();
		}
		if (!this.memory.versions['053to06X_part1']) {
			this.migrate_053_06X_part1();
		}
		if (!this.memory.versions['053to06X_part2']) {
			this.migrate_053_06X_part2();
		}
		if (!this.memory.versions['053to06X_part3']) {
			this.migrate_053_06X_part3();
		}
		if (!this.memory.versions['053to06X_part4']) {
			this.migrate_053_06X_part4();
		}
		if (!this.memory.versions['053to06X_part5']) {
			this.migrate_053_06X_part5();
		}
	}

	static get memory(): VersionMigratorMemory {
		return Mem.wrap(Memory.Overmind, 'versionMigrator', () => ({
			versions: {}
		}));
	}

	/*
	static migrate_02X_03X() {
		// This technically won't run correctly because it gets run only on global reset, but no one is using v0.2.x
		// anymore anyway, so I don't feel the need to maintain support for this function
		let allColoniesUpdated = true;
		let i = 0;
		for (let name in Memory.colonies) {
			let rpMemory = Memory.colonies[name].roomPlanner;
			let lastBuilt = rpMemory.lastGenerated;
			// Reboot colony room planners one at a time every 3 ticks
			if (!lastBuilt) {
				allColoniesUpdated = false;
				if (Game.time % 100 == 3 * i) {
					// Delete all white/white routing hints from memory
					rpMemory.savedFlags = _.filter(rpMemory.savedFlags, (flag: {secondaryColor: number}) =>
						flag.secondaryColor != COLOR_WHITE);
					rpMemory.active = true;
					log.alert(`Version migration: rebooting roomPlanner for colony ${name}!`);
				} else if (Game.time % 100 == 3 * i + 1) {
					colony.roomPlanner.finalize(true);
				}
			}
		}
		if (allColoniesUpdated) {
			this.memory.versions['02Xto03X'] = true;
			log.alert(`Version migration from 0.2.x -> 0.3.x completed successfully.`);
		}
	}

	static migrate_03X_04X() {
		// Update creep memory
		for (let i in Memory.creeps) {
			// Migrate all old-style overlord references to new ones
			if (Memory.creeps[i].overlord) {
				let hcName = Memory.creeps[i].overlord!.split(':')[0];
				if (hcName == 'commandCenter'
					|| hcName == 'hatchery'
					|| hcName == 'evolutionChamber'
					|| hcName == 'miningSite'
					|| hcName == 'upgradeSite') {
					let id = Memory.creeps[i].overlord!.split(':')[1];
					let roomObject = Game.getObjectById(id) as RoomObject | undefined;
					if (roomObject) {
						let overlordName = Memory.creeps[i].overlord!.split(':')[2];
						Memory.creeps[i].overlord = hcName + '@' + roomObject.pos.name + ':' + overlordName;
					}
				}
			}
			// Change all miner roles to drone roles
			if (Memory.creeps[i].role == 'miner') {
				Memory.creeps[i].role = 'drone';
			}
		}
		// Delete old-style miningSite overlords from memory
		OvermindConsole.deepCleanMemory();
		this.memory.versions['03Xto04X'] = true;
		log.alert(`Version migration from 0.3.x -> 0.4.x completed successfully.`);
	}

	static migrate_04X_05X() {
		let migrateClusterNames = ['commandCenter', 'evolutionChamber', 'hatchery', 'upgradeSite'];
		for (let i in Memory.creeps) {
			if (Memory.creeps[i].overlord) {
				let hcName = Memory.creeps[i].overlord!.split('@')[0];
				if (migrateClusterNames.includes(hcName)) {
					let overlordName = _.last(Memory.creeps[i].overlord!.split(':'));
					if (overlordName == 'hatchery') {
						overlordName = 'supply';
					}
					let colonyName = Memory.creeps[i].colony;
					Memory.creeps[i].overlord = hcName + '@' + colonyName + ':' + overlordName;
				}
			}
		}
		for (let i in Memory.rooms) {
			delete (<any>Memory.rooms[i]).tick;
			delete (<any>Memory.rooms[i]).score;
		}
		// Change to new signature
		let oldSignature = '[Overmind]';
		if ((<any>Memory).signature && (<any>Memory).signature.includes(oldSignature)) {
			(<any>Memory).signature = (<any>Memory).signature.replace(oldSignature, DEFAULT_OVERMIND_SIGNATURE);
		}
		this.memory.versions['04Xto05X'] = true;
		log.alert(`Version migration from 0.4.x -> 0.5.x (part 1) completed successfully.`);
	}

	static migrate_04X_05X_part2() {
		// Copy old memory to new memory locations
		if (Memory.signature) {
			Memory.settings.signature = (<any>Memory).signature;
		}
		delete (<any>Memory).signature;
		delete (<any>Memory).bot;
		delete (<any>Memory).log;
		delete (<any>Memory).autoclaim;
		this.memory.versions['04Xto05X_part2'] = true;
		log.alert(`Version migration from 0.4.x -> 0.5.x (part 2) completed successfully.`);
	}

	static migrate_04X_05X_part3() {
		for (let i in Memory.creeps) {
			if (Memory.creeps[i].overlord) {
				let ref = Memory.creeps[i].overlord as string;
				let n = ref.lastIndexOf(':');
				ref = ref.slice(0, n) + ref.slice(n).replace(':', '>');
				Memory.creeps[i].overlord = ref;
			}
		}
		this.memory.versions['04Xto05X_part3'] = true;
		log.alert(`Version migration from 0.4.x -> 0.5.x (part 3) completed successfully.`);
	}

	*/

	static migrate_050_051() {
		// Destroy all links that aren't hatchery or commandCenter links
		for (const id in Game.structures) {
			const s = Game.structures[id];
			if (s.structureType == STRUCTURE_LINK) {
				const isCommandCenterLink = s.pos.findInRange(_.compact([s.room.storage!,
																		 s.room.terminal!]), 2).length > 0;
				const isHatcheryLink = s.pos.findInRange(s.room.spawns, 2).length > 0;
				if (!isCommandCenterLink && !isHatcheryLink) {
					s.destroy();
				}
			}
		}
		let count = 0;
		for (const name in Game.creeps) {
			const creep = Game.creeps[name];
			if (creep.memory.role == 'drone' &&
				(<any>creep.memory).overlord && (<any>creep.memory).overlord.includes('miningSite')) {
				creep.suicide();
				count++;
			}
		}
		this.memory.versions['05Xto051'] = true;
		log.alert(`Genocide complete: suicided ${count} innocent drones.`);
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 1) completed successfully.`);
	}

	static migrate_050_051_part2() {
		// Destroy all links that aren't hatchery or commandCenter links
		for (const name in Game.creeps) {
			const creep = Game.creeps[name];
			if (creep.memory.role == 'reserver') {
				creep.memory.role = 'infestor';
			} else if (creep.memory.role == 'guard') {
				creep.memory.role = 'broodling';
			}
		}
		this.memory.versions['05Xto051_part2'] = true;
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 2) completed successfully.`);
	}

	static migrate_050_051_part3() {
		if (Memory.assimilator && Memory.assimilator.users) {
			delete Memory.assimilator.users;
		}
		this.memory.versions['05Xto051_part3'] = true;
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 3) completed successfully.`);
	}

	static migrate_050_051_part4() {
		const protectedKeywords = ['suspendUntil', 'amount', 'created', 'persistent', 'setPosition', 'rotation',
								   'colony', 'parent', 'pathing', 'stats', 'safeTick', 'enhanced', 'persistent',
								   'recoveryWaypoint', 'totalResources', 'maxPathLength', 'maxLinearRange'];
		for (const name in Memory.flags) {
			for (const prop in Memory.flags[name]) {
				if (!protectedKeywords.includes(prop)) {
					delete (<any>Memory.flags[name])[prop];
				}
			}
		}
		this.memory.versions['05Xto051_part4'] = true;
		log.alert(`Version migration from 0.5.0 -> 0.5.1 (part 4) completed successfully.`);
	}

	static migrate_051_052() {
		if (__VERSION__ == '0.5.2') {
			for (const name in Game.creeps) {
				if (name.includes('mutalisk')) {
					Game.creeps[name].suicide();
				}
			}
		}
		this.memory.versions['051to052'] = true;
		log.alert(`Version migration from 0.5.1 -> 0.5.2 completed successfully.`);
	}

	static migrate_052_053() {

		// Reformat flag and harvest directive memory
		const newFlagKeys: { [oldKey: string]: string } = {
			created   : MEM.TICK,
			expiration: MEM.EXPIRATION,
			overlord  : MEM.OVERLORD,
			colony    : MEM.COLONY,
		};
		for (const name in Memory.flags) {

			// Replace old keys with new ones
			Memory.flags[name] = _.mapKeys((<any>Memory.flags[name]), function(value, key) {
				return newFlagKeys[key] || key;
			});

			// Special opertions for harvest flags
			if (name.includes('harvest:')) {
				const pathing = (<any>Memory.flags[name]).pathing;
				if (pathing) {
					(<any>Memory.flags[name])['P'] = {
						D: pathing.distance,
						X: pathing.expiration,
					};
					delete (<any>Memory.flags[name]).pathing;
				}
				(<any>Memory.flags[name])['u'] = (<any>Memory.flags[name]).stats.usage;
				(<any>Memory.flags[name])['d'] = (<any>Memory.flags[name]).stats.downtime;
				delete (<any>Memory.flags[name]).stats;
			}

		}

		// Reformat creep memory
		const newCreepKeys: { [oldKey: string]: string } = {
			overlord: MEM.OVERLORD,
			colony  : MEM.COLONY,
		};
		for (const name in Memory.creeps) {
			// Replace old keys with new ones
			(<any>Memory.creeps[name]) = _.mapKeys((<any>Memory.creeps[name]), function(value, key) {
				return newCreepKeys[key] || key;
			});
		}

		// Delete outdated colony memory properties
		for (const name in Memory.colonies) {
			for (const key in Memory.colonies[name]) {
				if (key.includes('miningSite@')) {
					delete Memory.colonies[name][key];
				}
			}
		}

		// Delete ALL room memory
		for (const name in Memory.rooms) {
			delete Memory.rooms[name];
		}

		this.memory.versions['052to053'] = true;
		log.alert(`Version migration from 0.5.2 -> 0.5.3 completed successfully.`);
	}

	static migrate_053_06X_part1() {
		// Delete some old properties
		delete Memory.overseer.suspendUntil;
		// Delete ALL room memory
		for (const name in Memory.rooms) {
			delete Memory.rooms[name];
		}
		this.memory.versions['053to06X_part1'] = true;
		log.alert(`Version migration from 0.5.3 -> 0.6.X part 1 completed successfully.`);
	}

	static migrate_053_06X_part2() {
		// Delete some old properties
		if ((<any>Memory).Overmind.terminalNetwork) {
			delete (<any>Memory).Overmind.terminalNetwork;
		}
		// Remove all orders
		for (const id in Game.market.orders) {
			Game.market.cancelOrder(id);
		}
		this.memory.versions['053to06X_part2'] = true;
		log.alert(`Version migration from 0.5.3 -> 0.6.X part 2 completed successfully.`);
	}

	static migrate_053_06X_part3() {
		// Remove all orders
		for (const colonyName in Memory.colonies) {
			if (Memory.colonies[colonyName].evolutionChamber) {
				delete Memory.colonies[colonyName].evolutionChamber.activeReaction;
				delete Memory.colonies[colonyName].evolutionChamber.reactionQueue;
				delete Memory.colonies[colonyName].evolutionChamber.status;
				delete Memory.colonies[colonyName].evolutionChamber.statusTick;
			}
		}
		this.memory.versions['053to06X_part3'] = true;
		log.alert(`Version migration from 0.5.3 -> 0.6.X part 3 completed successfully.`);
	}

	static migrate_053_06X_part4() {
		// Remove orders for reaction intermediates
		for (const id in Game.market.orders) {
			const order = Game.market.orders[id];
			const deleteOrdersFor: MarketResourceConstant[] = [RESOURCE_GHODIUM, RESOURCE_ZYNTHIUM_KEANITE,
															   RESOURCE_UTRIUM_LEMERGITE, RESOURCE_HYDROXIDE];
			if (deleteOrdersFor.includes(order.resourceType)) {
				Game.market.cancelOrder(id);
			}
		}
		this.memory.versions['053to06X_part4'] = true;
		log.alert(`Version migration from 0.5.3 -> 0.6.X part 4 completed successfully.`);
	}

	static migrate_053_06X_part5() {

		// Find oldest tick we can find
		log.alert(`Fetching approximate empire age...`);
		if (MY_USERNAME == 'Muon') {
			Memory.tick = Game.time - 4461275; // oldest tick I could find
		} else {
			let oldestTick = Infinity;
			for (const name in Memory.colonies) {
				if (Memory.colonies[name] && Memory.colonies[name].roomPlanner) {
					const rpmem =  Memory.colonies[name].roomPlanner;
					if (rpmem.lastGenerated && rpmem.lastGenerated < oldestTick) {
						oldestTick = rpmem.lastGenerated;
					}
				}
			}
			for (const name in Memory.flags) {
				const fmem = Memory.flags[name];
				if (fmem.T && fmem.T < oldestTick) {
					oldestTick = fmem.T;
				}
			}
			if (oldestTick < Infinity) {
				Memory.tick = Game.time - oldestTick;
			}
		}

		// Clean some properties we don't use anymore
		log.alert(`Cleaning memory...`);
		delete Memory.strategist;
		delete Memory.zoneRooms;
		Memory.roomIntel = {}; // reset this

		if (Memory.stats.persistent) {
			delete Memory.stats.persistent.terminalNetwork.transfers;
			delete Memory.stats.persistent.terminalNetwork.costs;
		}

		const mem = Memory as any;

		delete mem.pathing.paths; // not used
		delete mem.pathing.weightedDistances;

		// Changes will need repathing
		for (const name in Game.creeps) {
			const creep = Game.creeps[name];
			if (creep) {
				delete creep.memory._go;
			}
		}

		function derefCoords(coordName: string): Coord {
			const [x, y] = coordName.split(':');
			return {x: parseInt(x, 10), y: parseInt(y, 10)};
		}


		for (const name in Memory.colonies) {
			const colmem = Memory.colonies[name];

			delete colmem.abathur; // outdated

			delete colmem.expansionData; // bugged

			log.alert(`Migrating room planner memories...`);
			// Clean room planner memory of some old shit
			const validRoomPlannerMemKeys = ['active', 'relocating', 'recheckStructuresAt', 'bunkerData',
											 'lastGenerated', 'mapsByLevel', 'savedFlags'];
			if (colmem.roomPlanner) {
				for (const key in colmem.roomPlanner) {
					if (!validRoomPlannerMemKeys.includes(key)) {
						delete colmem.roomPlanner[key];
					}
				}
			}

			// Migrate road planner to new format
			log.alert(`Migrating road planner memories...`);
			if (colmem.roadPlanner) {
				if (colmem.roadPlanner.roadLookup) {
					const roadLookup = colmem.roadPlanner.roadLookup;
					const roadCoordsPacked: { [roomName: string]: string } = {};
					for (const roomName in roadLookup) {
						const roadCoords = _.map(_.keys(roadLookup[roomName]), coordName => derefCoords(coordName));
						roadCoordsPacked[roomName] = packCoordList(roadCoords);
					}
					colmem.roadPlanner.roadCoordsPacked = roadCoordsPacked;
					delete colmem.roadPlanner.roadLookup;
				}
			}

			// Migrate barrier planner to new format
			log.alert(`Migrating barrier planner memories...`);
			if (colmem.barrierPlanner) {
				if (colmem.barrierPlanner.barrierLookup) {
					const barrierLookup = colmem.barrierPlanner.barrierLookup;
					const barrierCoords = _.map(_.keys(barrierLookup), coordName => derefCoords(coordName));
					colmem.barrierPlanner.barrierCoordsPacked = packCoordList(barrierCoords);
					delete colmem.barrierPlanner.barrierLookup;
				}
			}
		}

		log.alert(`Clearing room memories...`);
		for (const roomName in Memory.rooms) {
			delete Memory.rooms[roomName];
		}

		this.memory.versions['053to06X_part5'] = true;
		log.alert(`Version migration from 0.5.3 -> 0.6.X part 5 completed successfully.`);
	}

}
