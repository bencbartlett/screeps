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
 * Bootstrapping overlord: spawns small miners and suppliers to recover from a catastrohpic colony crash
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
		// Pick up all possible structures first
		this.supplyStructures = [...this.colony.spawns, ...this.colony.extensions];
		this.withdrawStructures = _.compact([this.colony.storage!,
											this.colony.terminal!,
											this.colony.powerSpawn!,
											...this.room.containers,
											...this.room.links,
											...this.room.towers,
											...this.room.labs]);
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

	init() {
		// If you are super low on energy, spawn one miner, then a filler, then rest of the miners
		const totalEnergyInRoom = _.sum(this.withdrawStructures, structure => structure.store.energy);
		const costToMakeNormalMinerAndFiller = patternCost(Setups.drones.miners.emergency) * 3
											   + patternCost(Setups.filler); // costs 1000
		if (totalEnergyInRoom < costToMakeNormalMinerAndFiller) {
			if (this.colony.getCreepsByRole(Roles.drone).length == 0) {
				this.spawnBootstrapMiners();
				return;
			}
		}
		// Spawn fillers
		if (this.colony.getCreepsByRole(Roles.queen).length == 0 && this.colony.hatchery) { // no queen
			const transporter = _.first(this.colony.getZergByRole(Roles.transport));
			if (transporter) {
				// reassign transporter to be queen
				transporter.reassign(this.colony.hatchery.overlord, Roles.queen);
			} else {
				// wish for a filler
				this.wishlist(1, Setups.filler);
			}
		}
		// Then spawn the rest of the needed miners
		this.spawnBootstrapMiners();
		// const energyInStructures = _.sum(_.map(this.withdrawStructures, structure => structure.energy));
		// const droppedEnergy = _.sum(this.room.droppedEnergy, drop => drop.amount);
		// if (energyInStructures + droppedEnergy < BootstrappingOverlord.settings.spawnBootstrapMinerThreshold) {
		// 	this.spawnBootstrapMiners();
		// }
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
		let toUpdate = true;
		for (const filler of this.fillers) {
			if (filler.isIdle) {
				if (toUpdate) {
					toUpdate = false
					// Filter valid structures fillers can supply / withdraw from
					this.supplyStructures = _.filter(this.supplyStructures, structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
					this.withdrawStructures = _.filter(this.withdrawStructures, structure => structure.store.energy > 0);
				}
				this.handleFiller(filler);
			}
			filler.run();
		}
	}
}
