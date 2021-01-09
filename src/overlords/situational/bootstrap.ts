import {ColonyStage} from '../../Colony';
import {bodyCost, CreepSetup, patternCost} from '../../creepSetups/CreepSetup';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveHarvest} from '../../directives/resource/harvest';
import {DirectiveBootstrap} from '../../directives/situational/bootstrap';
import {SpawnRequest} from '../../hiveClusters/hatchery';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

/**
 * Bootstrapping overlord: spawns small miners and suppliers to recover from a catastrophic colony crash
 */
@profile
export class BootstrappingOverlord extends Overlord {

	room: Room; // Definitely has vision
	fillers: Zerg[];
	withdrawStructures: (StructureStorage | StructureTerminal | StructureContainer | StructureLink |
		StructureTower | StructureLab | StructurePowerSpawn | StructureNuker)[];
	supplyStructures: (StructureSpawn | StructureExtension)[];

	static settings = {
		spawnBootstrapMinerThreshold: 3000
	};

	constructor(directive: DirectiveBootstrap, priority = OverlordPriority.emergency.bootstrap) {
		super(directive, 'bootstrap', priority);
		this.fillers = this.zerg(Roles.filler);
		// Calculate structures fillers can supply / withdraw from
		this.supplyStructures = _.filter([...this.colony.spawns, ...this.colony.extensions],
			structure => structure.energy < structure.energyCapacity);
		this.withdrawStructures = _.filter(_.compact([this.colony.storage!,
			this.colony.terminal!,
			this.colony.powerSpawn!,
			...this.room.containers,
			...this.room.links,
			...this.room.towers,
			...this.room.labs]), structure => structure.energy > 0);
	}

	private spawnBootstrapMiners() {
		// Isolate mining site overlords in the room
		let miningSitesInRoom = _.filter(_.values(this.colony.miningSites),
			site => site.room == this.colony.room) as DirectiveHarvest[];
		if (this.colony.spawns[0]) {
			miningSitesInRoom = _.sortBy(miningSitesInRoom, site => site.pos.getRangeTo(this.colony.spawns[0]));
		}

		// If you have no miners then create whatever is the biggest miner you can make
		const pattern = [WORK, WORK, CARRY, MOVE];
		const miningOverlordsInRoom = _.map(miningSitesInRoom, site => site.overlords.mine);
		const allMiners = _.flatten(_.map(miningOverlordsInRoom, overlord => overlord.lifetimeFilter(overlord.miners)));
		const allMiningPower = _.sum(allMiners, creep => creep.getActiveBodyparts(WORK));
		let sizeLimit: number;
		if (allMiningPower == 0) {
			sizeLimit = Math.min(Math.floor(this.colony.room.energyAvailable / bodyCost(pattern)), 3);
		} else { // Otherwise if you have miners then you can afford to make normal ones
			sizeLimit = 3;
		}
		const setup = new CreepSetup(Roles.drone, {
			pattern  : pattern,
			sizeLimit: sizeLimit,
		});

		// Create a bootstrapMiners and donate them to the miningSite overlords as needed
		for (const overlord of miningOverlordsInRoom) {
			const filteredMiners = this.lifetimeFilter(overlord.miners);
			const miningPowerAssigned = _.sum(_.map(this.lifetimeFilter(overlord.miners),
				creep => creep.getActiveBodyparts(WORK)));
			if (miningPowerAssigned < overlord.miningPowerNeeded &&
				filteredMiners.length < overlord.pos.availableNeighbors().length) {
				if (this.colony.hatchery) {
					const request: SpawnRequest = {
						setup   : setup,
						overlord: overlord,
						priority: this.priority + 1,
					};
					this.colony.hatchery.enqueue(request);
					this.debug(`Enqueueing bootstrap miner with size ${sizeLimit}`);
				}
			}
		}
	}

	updateFillerWishlist() {
		// Spawn fillers
		if (this.colony.getCreepsByRole(Roles.queen).length == 0 && this.colony.hatchery) { // no queen
			const transporter = _.first(this.colony.getZergByRole(Roles.transport));
			if (transporter) {
				// reassign transporter to be queen
				transporter.reassign(this.colony.hatchery.overlord, Roles.queen);
			} else {
				// wish for a filler
				this.wishlist(1, Setups.fillers.first);
				// if starting a big room, slowly ramp up the queens
				if (this.colony.getCreepsByRole(Roles.drone).length > 1) {
					this.wishlist(2, Setups.fillers.second);
					// even bigger rooms need more queens
					if (this.room.energyCapacityAvailable > 600
						&& this.colony.getCreepsByRole(Roles.drone).length > 2) {
						this.wishlist(3, Setups.fillers.third);
					}
				}
			}
		}
	}

	refresh() {
		super.refresh();

		// Spawn fillers
		this.updateFillerWishlist();

	}

	init() {

		// Then spawn the rest of the needed miners
		const energyInStructures = _.sum(_.map(this.withdrawStructures, structure => structure.energy));
		const droppedEnergy = _.sum(this.room.droppedEnergy, drop => drop.amount);

		// At early levels, spawn one miner, then a filler, then the rest of the miners
		if (energyInStructures + droppedEnergy < 300 && this.colony.stage == ColonyStage.Larva) {
			if (this.colony.getCreepsByRole(Roles.drone).length == 0) {
				// Isolate mining site overlords in the room
				let miningSites = _.filter(_.values(this.colony.miningSites),
					(site: DirectiveHarvest) => site.room == this.colony.room) as DirectiveHarvest[];
				if (this.colony.spawns[0]) {
					miningSites = _.sortBy(miningSites, site => site.pos.getRangeTo(this.colony.spawns[0]));
				}
				const miningOverlords = _.map(miningSites, site => site.overlords.mine);
				const firstOverlord = miningOverlords[0];
				// first
				if (this.colony.hatchery) {
					let setup = Setups.drones.miners.default;
					if (this.colony.controller.level > 2) {
						setup = Setups.drones.miners.emergency;
					}
					const request: SpawnRequest = {
						setup   : setup,
						overlord: firstOverlord,
						priority: 1,
					};
					this.colony.hatchery.enqueue(request);
				}
				return;
			}
		}

		// Spawn fillers
		this.updateFillerWishlist();

		if (energyInStructures + droppedEnergy < BootstrappingOverlord.settings.spawnBootstrapMinerThreshold) {
			this.spawnBootstrapMiners();
		}
	}

	private supplyActions(filler: Zerg) {
		const target = filler.pos.findClosestByRange(this.supplyStructures);
		if (target) {
			filler.task = Tasks.transfer(target);
		} else {
			this.rechargeActions(filler);
		}
	}

	private rechargeActions(filler: Zerg) {
		const target = filler.pos.findClosestByRange(this.withdrawStructures);
		if (target) {
			filler.task = Tasks.withdraw(target);
		} else {
			filler.task = Tasks.recharge();
		}
	}

	private handleFiller(filler: Zerg) {
		if (filler.carry.energy > 0) {
			this.supplyActions(filler);
		} else {
			this.rechargeActions(filler);
		}
	}

	run() {
		for (const filler of this.fillers) {
			if (filler.isIdle) {
				this.handleFiller(filler);
			}
			filler.run();
		}
	}
}
