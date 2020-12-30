import {$} from '../../caching/GlobalCache';
import {ColonyStage} from '../../Colony';
import {log} from '../../console/log';
import {bodyCost, CreepSetup} from '../../creepSetups/CreepSetup';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveOutpost} from '../../directives/colony/outpost';
import {DirectiveHarvest} from '../../directives/resource/harvest';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
import {getCacheExpiration, maxBy, minBy} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Overlord, OverlordMemory} from '../Overlord';

export const StandardMinerSetupCost = bodyCost(Setups.drones.miners.standard.generateBody(Infinity));

export const DoubleMinerSetupCost = bodyCost(Setups.drones.miners.double.generateBody(Infinity));


const BUILD_OUTPUT_FREQUENCY = 15;
const SUICIDE_CHECK_FREQUENCY = 3;
const MINER_SUICIDE_THRESHOLD = 200;
const DISMANTLE_CHECK_FREQUENCY = 1500;

const DISMANTLE_CHECK = 'dc';

interface MiningOverlordMemory extends OverlordMemory {
	doubleSource?: boolean;
	[DISMANTLE_CHECK]?: number;
	dismantleNeeded?: boolean;
}

/**
 * Spawns miners to harvest from remote, owned, or sourcekeeper energy deposits. Standard mining actions have been
 * heavily CPU-optimized
 */
@profile
export class MiningOverlord extends Overlord {

	memory: MiningOverlordMemory;

	room: Room | undefined;
	distance: number;
	source: Source | undefined;
	secondSource: Source | undefined;
	isDisabled: boolean;
	container: StructureContainer | undefined;
	link: StructureLink | undefined;
	constructionSite: ConstructionSite | undefined;
	harvestPos: RoomPosition | undefined;
	miners: Zerg[];
	energyPerTick: number;
	miningPowerNeeded: number;
	mode: 'early' | 'SK' | 'link' | 'standard' | 'double';
	setup: CreepSetup;
	minersNeeded: number;
	allowDropMining: boolean;

	private dismantlePositions: RoomPosition[] | undefined;

	static settings = {
		minLinkDistance : 10,
		dropMineUntilRCL: 3,
	};

	constructor(directive: DirectiveHarvest, priority: number) {
		super(directive, 'mine', priority);
		this.distance = directive.distance;

		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
		this.miners = this.zerg(Roles.drone);

		// Populate structures
		this.populateStructures();

		// Check if dismantling is needed
		if (this.memory.dismantleNeeded || Game.time > (this.memory[DISMANTLE_CHECK] || 0)) {
			if (this.room) {
				this.dismantlePositions = this.getDismantlePositions();
				if (this.dismantlePositions.length > 0) {
					this.memory.dismantleNeeded = true;
					this.dismantlePositions = this.getDismantlePositions();
				} else {
					this.memory[DISMANTLE_CHECK] = getCacheExpiration(DISMANTLE_CHECK_FREQUENCY,
																	  DISMANTLE_CHECK_FREQUENCY / 5);
				}
			}
		}

		// Compute energy output
		if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER) {
			this.energyPerTick = SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME;
		} else if (this.colony.level >= DirectiveOutpost.settings.canSpawnReserversAtRCL) {
			this.energyPerTick = SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME;
		} else {
			this.energyPerTick = SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME;
		}
		this.miningPowerNeeded = Math.ceil(this.energyPerTick / HARVEST_POWER) + 1;

		// this.checkForNearbyMines();

		// Decide operating mode
		if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER) {
			this.mode = 'SK';
			this.setup = Setups.drones.miners.sourceKeeper;
		} else if (this.colony.room.energyCapacityAvailable < StandardMinerSetupCost) {
			this.mode = 'early';
			this.setup = Setups.drones.miners.default;
		}
			// else if (this.isDoubleSource() && this.colony.room.energyCapacityAvailable > DoubleMinerSetupCost) {
			// 	this.mode = 'double';
			// 	this.setup = Setups.drones.miners.double;
		// }
		else if (this.link) {
			this.mode = 'link';
			if (this.colony.assets.energy >= 100000) {
				this.setup = Setups.drones.miners.linkOptimized;
			} else {
				this.setup = Setups.drones.miners.default;
			}
		} else {
			this.mode = 'standard';
			// this.setup = Game.cpu.bucket < 9500 ? Setups.drones.miners.standardCPU : Setups.drones.miners.standard;
			this.setup = Setups.drones.miners.standard;
			// todo: double miner condition
		}

		const miningPowerEach = this.setup.getBodyPotential(WORK, this.colony);
		// this.minersNeeded = this.isDisabled ? 0 : Math.min(Math.ceil(this.miningPowerNeeded / miningPowerEach),
		// 							 this.pos.availableNeighbors(true).length);
		this.minersNeeded = Math.min(Math.ceil(this.miningPowerNeeded / miningPowerEach),
									 this.pos.availableNeighbors(true).length);
		this.minersNeeded = this.isDisabled ? 0 : this.minersNeeded;
		// Allow drop mining at low levels
		this.allowDropMining = this.colony.level < MiningOverlord.settings.dropMineUntilRCL;
		if (this.mode != 'early' && !this.allowDropMining) {
			if (this.container) {
				this.harvestPos = this.container.pos;
			} else if (this.link) {
				this.harvestPos = _.find(this.link.pos.availableNeighbors(true),
										 pos => pos.getRangeTo(this) == 1)!;
			} else {
				this.harvestPos = this.calculateContainerPos();
			}
		}
	}

	/**
	 * Calculates if this source has another one very nearby that should be handled by the same miner
	 * TODO: plug in
	 */
	private isDoubleSource(): boolean {
		if (this.memory.doubleSource !== undefined) {
			return this.memory.doubleSource;
		}
		const room = Game.rooms[this.pos.roomName];
		if (room) {
			this.source = this.source || _.first(room.sources);
			const otherSource = _.find(this.source.pos.findInRange(FIND_SOURCES, 2),
									   source => source.id != (this.source ? this.source.id : ''));
			if (otherSource) {
				this.secondSource = otherSource;
				// If its over 1 spot away, is there spot in between to mine?
				if (this.source.pos.getRangeTo(this.secondSource) > 1) {
					const miningPos = this.source.pos.getPositionAtDirection(this.source.pos.getDirectionTo(this.secondSource.pos));
					if (!miningPos.isWalkable()) {
						// console.log(`Double mining found but there is no spot between ${this.secondSource}
						// ${this.secondSource.pos.print} isWalkable ${miningPos}`);
						return false;
					}
				}
				// Disable mining from the source with greater id
				if (this.source.id > this.secondSource.id) {
					// console.log(`This is a disabled mining ${this.directive.name} via source id`);
					this.isDisabled = true;
				}
				return true;
			}
		}
		return false;
	}

	/**
	 * Checks if dismantling is needed in the operating room
	 */
	private getDismantlePositions(): RoomPosition[] {
		const dismantleStructures: Structure[] = [];
		if (this.room) {
			const targets = _.compact([...this.room.sources, this.room.controller]) as RoomObject[];
			for (const target of targets) {
				// Add blocking structures
				const blockingStructure = this.findBlockingStructure(target);
				if (blockingStructure) {
					dismantleStructures.push(blockingStructure);
				}
				// Add unwalkable structures with low hits in 2 range
				for (const pos of target.pos.getPositionsInRange(2, false, false)) {
					const unwalkableStructure = _.find(pos.lookFor(LOOK_STRUCTURES), s => !s.isWalkable);
					if (unwalkableStructure && !(<OwnedStructure>unwalkableStructure).my) {
						dismantleStructures.push(unwalkableStructure);
					}
				}
			}
		} else {
			log.error(`MiningOverlord.getDismantleStructures() called with no vision in room ${this.pos.roomName}!`);
		}
		return _.unique(_.map(dismantleStructures, s => s.pos));
	}

	/**
	 * Finds the structure which is blocking access to a source or controller
	 */
	private findBlockingStructure(target: RoomObject): Structure | undefined {
		if (!this.room) return;
		const pos = Pathing.findBlockingPos(this.colony.pos, target.pos,
											_.filter(this.room.structures, s => !s.isWalkable));
		if (pos) {
			const structure = _.find(pos.lookFor(LOOK_STRUCTURES), s => !s.isWalkable);
			return structure || log.error(`${this.print}: no structure at blocking pos ${pos.print}!`);
		}
	}

	private populateStructures() {
		if (Game.rooms[this.pos.roomName]) {
			this.source = _.first(this.pos.lookFor(LOOK_SOURCES));
			this.constructionSite = _.first(_.filter(this.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2),
													 site => site.structureType == STRUCTURE_CONTAINER ||
															 site.structureType == STRUCTURE_LINK));
			this.container = this.pos.findClosestByLimitedRange(Game.rooms[this.pos.roomName].containers, 1);
			this.link = this.pos.findClosestByLimitedRange(this.colony.availableLinks, 2);
		}
	}

	refresh() {
		if (!this.room && Game.rooms[this.pos.roomName]) { // if you just gained vision of this room
			this.populateStructures();
		}
		super.refresh();
		// Refresh your references to the objects
		$.refresh(this, 'source', 'container', 'link', 'constructionSite');
	}


	/**
	 * Calculate where the container output will be built for this site
	 */
	private calculateContainerPos(): RoomPosition {
		// log.debug(`Computing container position for mining overlord at ${this.pos.print}...`);
		let originPos: RoomPosition | undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.colony.roomPlanner.storagePos) {
			originPos = this.colony.roomPlanner.storagePos;
		}
		if (originPos) {
			const path = Pathing.findShortestPath(this.pos, originPos).path;
			const pos = _.find(path, pos => pos.getRangeTo(this) == 1);
			if (pos) return pos;
		}
		// Shouldn't ever get here
		log.warning(`Last resort container position calculation for ${this.print}!`);
		return _.first(this.pos.availableNeighbors(true));
	}

	/**
	 * Add or remove containers as needed to keep exactly one of container | link
	 */
	private addRemoveContainer(): void {
		if (this.allowDropMining) {
			return; // only build containers in reserved, owned, or SK rooms
		}
		// Create container if there is not already one being built and no link
		if (!this.container && !this.constructionSite && !this.link) {
			const containerPos = this.calculateContainerPos();
			if (!containerPos) {
				log.error(`${this.print}: can't build container at ${this.room}`);
				return;
			}
			const container = containerPos ? containerPos.lookForStructure(STRUCTURE_CONTAINER) as StructureContainer
				| undefined : undefined;
			if (container) {
				log.warning(`${this.print}: this.container out of sync at ${containerPos.print}`);
				this.container = container;
				return;
			}
			log.info(`${this.print}: building container at ${containerPos.print}`);
			const result = containerPos.createConstructionSite(STRUCTURE_CONTAINER);
			if (result != OK) {
				log.error(`${this.print}: cannot build container at ${containerPos.print}! Result: ${result}`);
			}
			return;
		}
		// Destroy container if link is nearby
		if (this.container && this.link) {
			// safety checks
			if (this.colony.hatchery && this.container.pos.getRangeTo(this.colony.hatchery) > 2 &&
				this.container.pos.getRangeTo(this.colony.upgradeSite) > 3) {
				log.info(`${this.print}: container and link present; destroying container at ${this.container.pos.print}`);
				this.container.destroy();
			}
		}
	}

	private registerEnergyRequests(): void {
		if (this.container) {
			const transportCapacity = 200 * this.colony.level;
			const threshold = this.colony.stage > ColonyStage.Larva ? 0.8 : 0.5;
			if (_.sum(this.container.store) > threshold * transportCapacity) {
				this.colony.logisticsNetwork.requestOutput(this.container, {
					resourceType: 'all',
					dAmountdt   : this.energyPerTick
				});
			}
		}
		if (this.link) {
			// If the link will be full with next deposit from the miner
			const minerCapacity = 150;
			if (this.link.energy + minerCapacity > this.link.energyCapacity) {
				this.colony.linkNetwork.requestTransmit(this.link);
			}
		}
	}

	init() {
		this.wishlist(this.minersNeeded, this.setup);
		this.registerEnergyRequests();
	}

	/**
	 * Actions for handling mining at early RCL, when multiple miners and drop mining are used
	 */
	private earlyMiningActions(miner: Zerg) {

		// Don't use goToMiningSite() here because miners will push each other around and waste CPU
		if (!miner.pos.inRangeToPos(this.pos, 1)) {
			return miner.goTo(this);
		}

		// Container mining
		if (this.container) {
			if (this.container.hits < this.container.hitsMax
				&& miner.carry.energy >= Math.min(miner.carryCapacity, REPAIR_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.goRepair(this.container);
			} else {
				if (_.sum(miner.carry) < miner.carryCapacity) {
					return miner.goHarvest(this.source!);
				} else {
					return miner.goTransfer(this.container);
				}
			}
		}

		// Build output site
		if (this.constructionSite) {
			if (miner.carry.energy >= Math.min(miner.carryCapacity, BUILD_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.goBuild(this.constructionSite);
			} else {
				return miner.goHarvest(this.source!);
			}
		}

		// Drop mining
		if (this.allowDropMining) {
			miner.goHarvest(this.source!);
			if (miner.carry.energy > 0.8 * miner.carryCapacity) { // try to drop on top of largest drop if full
				const biggestDrop = maxBy(miner.pos.findInRange(miner.room.droppedEnergy, 1), drop => drop.amount);
				if (biggestDrop) {
					miner.goDrop(biggestDrop.pos, RESOURCE_ENERGY);
				}
			}
			return;
		}
	}

	/**
	 * Suicide outdated miners when their replacements arrive
	 */
	private suicideOldMiners(): boolean {
		if (this.miners.length > this.minersNeeded && this.source) {
			// if you have multiple miners and the source is visible
			const targetPos = this.harvestPos || this.source.pos;
			const minersNearSource = _.filter(this.miners,
											  miner => miner.pos.getRangeTo(targetPos) <= SUICIDE_CHECK_FREQUENCY);
			if (minersNearSource.length > this.minersNeeded) {
				// if you have more miners by the source than you need
				const oldestMiner = minBy(minersNearSource, miner => miner.ticksToLive || 9999);
				if (oldestMiner && (oldestMiner.ticksToLive || 9999) < MINER_SUICIDE_THRESHOLD) {
					// if the oldest miner will die sufficiently soon
					oldestMiner.suicide();
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Actions for handling link mining
	 */
	private linkMiningActions(miner: Zerg) {
		// Sleep until your source regens
		if (this.isSleeping(miner)) return;

		// Link mining
		if (this.link) {
			const res = miner.harvest(this.source!);
			if (res == ERR_NOT_IN_RANGE) { // approach mining site
				if (this.goToMiningSite(miner)) return;
			}
			if (miner.carry.energy > 0.9 * miner.carryCapacity) {
				miner.transfer(this.link, RESOURCE_ENERGY);
			}
			// If for whatever reason there's no reciever link, you can get stuck in a bootstrapping loop, so
			// occasionally check for this and drop energy on the ground if needed
			if (Game.time % 10 == 0) {
				const commandCenterLink = this.colony.commandCenter ? this.colony.commandCenter.link : undefined;
				if (!commandCenterLink) {
					miner.drop(RESOURCE_ENERGY);
				}
			}
		} else {
			log.warning(`${this.print}: Link miner ${miner.print} has no link! (Why?)`);
		}
	}

	/**
	 * Actions for handling mining at RCL high enough to spawn ideal miner body to saturate source
	 */
	private standardMiningActions(miner: Zerg) {
		// TODO reeval to do mining first, try intent and if fail then more for cpu gain

		// Sleep until your source regens
		if (this.isSleeping(miner)) return;

		// Approach mining site
		if (this.goToMiningSite(miner)) return;

		// At this point the miner is in the room so we have vision of the source
		const source = this.source as Source;

		// Container mining
		if (this.container) {
			if (this.container.hits < this.container.hitsMax
				&& miner.carry.energy >= Math.min(miner.carryCapacity, REPAIR_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.repair(this.container);
			} else {
				return this.harvestOrSleep(miner, source);
			}
		}

		// Build output site
		if (this.constructionSite) { // standard miners won't have both a container and a construction site
			if (miner.carry.energy >= Math.min(miner.carryCapacity, BUILD_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.build(this.constructionSite);
			} else {
				return this.harvestOrSleep(miner, source);
			}
		}

		// Drop mining
		if (this.allowDropMining) {
			this.harvestOrSleep(miner, source);
			if (miner.carry.energy > 0.8 * miner.carryCapacity) { // move over the drop when you're close to full
				const biggestDrop = maxBy(miner.pos.findInRange(miner.room.droppedEnergy, 1), drop => drop.amount);
				if (biggestDrop) {
					miner.goTo(biggestDrop);
				}
			}
			if (miner.carry.energy == miner.carryCapacity) { // drop when you are full
				miner.drop(RESOURCE_ENERGY);
			}
			return;
		}
	}

	/**
	 * Actions for handling mining in source keeper rooms
	 */
	private skMiningActions(miner: Zerg) {
		// Sleep until your source regens
		if (this.isSleeping(miner)) return;

		// Approach mining site
		if (this.goToMiningSite(miner, false)) return;

		// At this point the miner is in the room so we have vision of the source
		const source = this.source as Source;

		// Container mining
		if (this.container) {
			if (this.container.hits < this.container.hitsMax
				&& miner.carry.energy >= Math.min(miner.carryCapacity, REPAIR_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.repair(this.container);
			} else {
				return this.harvestOrSleep(miner, source);
			}
		}

		// Build output site
		if (this.constructionSite) { // standard miners won't have both a container and a construction site
			if (miner.carry.energy >= Math.min(miner.carryCapacity, BUILD_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.build(this.constructionSite);
			} else {
				return this.harvestOrSleep(miner, source);
			}
		}

		// Drop mining
		if (this.allowDropMining) {
			this.harvestOrSleep(miner, source);
			if (miner.carry.energy > 0.8 * miner.carryCapacity) { // move over the drop when you're close to full
				const biggestDrop = maxBy(miner.pos.findInRange(miner.room.droppedEnergy, 1), drop => drop.amount);
				if (biggestDrop) {
					miner.goTo(biggestDrop);
				}
			}
			if (miner.carry.energy == miner.carryCapacity) { // drop when you are full
				miner.drop(RESOURCE_ENERGY);
			}
			return;
		}
	}

	/**
	 * Actions for handling double mining TODO: plug this in
	 */
	private doubleMiningActions(miner: Zerg) {

		// Approach mining site
		if (this.goToMiningSite(miner)) return;

		// Link mining
		if (this.link) {
			if (this.source && this.source.energy > 0) {
				miner.harvest(this.source!);
			} else {
				miner.harvest(this.secondSource!);
			}
			if (miner.carry.energy > 0.9 * miner.carryCapacity) {
				miner.transfer(this.link, RESOURCE_ENERGY);
			}
			return;
		} else {
			log.warning(`Link miner ${miner.print} has no link!`);
		}

		// Container mining
		if (this.container) {
			if (this.container.hits < this.container.hitsMax
				&& miner.carry.energy >= Math.min(miner.carryCapacity, REPAIR_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.repair(this.container);
			} else if (this.source && this.source.energy > 0) {
				return miner.harvest(this.source!);
			} else {
				return miner.harvest(this.secondSource!);
			}
		}

		// Build output site
		if (this.constructionSite) {
			if (miner.carry.energy >= Math.min(miner.carryCapacity, BUILD_POWER * miner.getActiveBodyparts(WORK))) {
				return miner.build(this.constructionSite);
			} else {
				return miner.harvest(this.source!);
			}
		}

		// Drop mining
		if (this.allowDropMining) {
			miner.harvest(this.source!);
			if (miner.carry.energy > 0.8 * miner.carryCapacity) { // move over the drop when you're close to full
				const biggestDrop = maxBy(miner.pos.findInRange(miner.room.droppedEnergy, 1), drop => drop.amount);
				if (biggestDrop) {
					miner.goTo(biggestDrop);
				}
			}
			if (miner.carry.energy == miner.carryCapacity) { // drop when you are full
				miner.drop(RESOURCE_ENERGY);
			}
			return;
		}
	}

	/**
	 * Actions for handling mining at RCL high enough to spawn ideal miner body to saturate source
	 */
	private dismantleActions(miner: Zerg): any {

		// Go to the room
		if (!miner.safelyInRoom(this.pos.roomName)) {
			return miner.goToRoom(this.pos.roomName);
		}

		// We're done if there are no dismantle positions left
		if (!this.dismantlePositions || this.dismantlePositions.length == 0) {
			log.info(`Miner dismantling completed in room ${miner.room.print}`);
			delete this.memory.dismantleNeeded;
			this.memory[DISMANTLE_CHECK] = getCacheExpiration(DISMANTLE_CHECK_FREQUENCY,
															  DISMANTLE_CHECK_FREQUENCY / 5);
			return;
		}

		// Find the first reachable position to dismantle stuff
		const dismantlePos = _.find(this.dismantlePositions,
									pos => Pathing.isReachable(miner.pos, pos,
															   _.filter(miner.room.structures, s => !s.isWalkable)));
		if (dismantlePos) {
			// Find the first blocking structure on the target position
			const dismantleTarget = _.find(dismantlePos.lookFor(LOOK_STRUCTURES),
										   s => !s.isWalkable && !(<OwnedStructure>s).my);
			// Dismantle it
			if (dismantleTarget) {
				if (dismantleTarget.hits > 1000 && Game.time % 10 == 0) {
					log.alert(`${miner.print} attempting to dismantle large structure!`);
				}
				return miner.goDismantle(dismantleTarget);
			}
			// Otherwise reclaculate dismantle positions and call again to get next target
			else {
				this.dismantlePositions = this.getDismantlePositions();
				return this.dismantleActions(miner);
			}
		} else {
			log.warning(`No reachable dismantle positions for ${miner.print}!`);
		}

	}

	/**
	 * Move onto harvesting position or near to source
	 */
	private goToMiningSite(miner: Zerg, avoidSK = true): boolean {
		if (this.harvestPos) {
			if (!miner.pos.inRangeToPos(this.harvestPos, 0)) {
				miner.goTo(this.harvestPos, {range: 0, pathOpts: {avoidSK: avoidSK}});
				return true;
			}
		} else {
			if (!miner.pos.inRangeToPos(this.pos, 1)) {
				miner.goTo(this.pos, {range: 1, pathOpts: {avoidSK: avoidSK}});
				return true;
			}
		}
		return false;
	}

	private isSleeping(miner: Zerg): boolean {
		if (miner.memory.sleepUntil) {
			if (Game.time >= miner.memory.sleepUntil) {
				delete miner.memory.sleepUntil;
				return false;
			}
			return true;
		}
		return false;
	}

	/**
	 * Harvests from a source and sleeps the creep until regeneration if needed. This method doesn't run many safety
	 * checks, so the creep will need to be in range
	 */
	private harvestOrSleep(miner: Zerg, source: Source, allowSuicide = true): void {
		const ret = miner.harvest(source);
		if (ret != OK) {
			switch (ret) {
				case ERR_NOT_ENOUGH_RESOURCES: // energy depleted
					if (allowSuicide && source.ticksToRegeneration > (miner.ticksToLive || Infinity)) {
						miner.suicide();
					} else {
						miner.memory.sleepUntil = Game.time + source.ticksToRegeneration;
					}
					break;
				case ERR_NO_BODYPART:
					if (allowSuicide) {
						miner.suicide();
					}
					break;
				case ERR_NOT_OWNER:
					if (Game.time % 20 == 0) {
						log.alert(`${miner.print}: room "${miner.room.name}" is reserved by hostiles!`);
					}
					break;
				default:
					log.error(`${miner.print}: unhandled miner.harvest() exception: ${ret}`);
					break;
			}
		}
	}


	private handleMiner(miner: Zerg) {

		// Stay safe out there!
		if (miner.avoidDanger({timer: 10, dropEnergy: true})) {
			return;
		}

		// Check if stuff needs to be dismantled to clean up the room
		if (this.memory.dismantleNeeded) {
			return this.dismantleActions(miner);
		}

		// Run the appropriate mining actions
		switch (this.mode) {
			case 'early':
				return this.earlyMiningActions(miner);
			case 'link':
				return this.linkMiningActions(miner);
			case 'standard':
				return this.standardMiningActions(miner);
			case 'SK':
				return this.skMiningActions(miner);
			case 'double':
				return this.doubleMiningActions(miner);
			default:
				log.error(`UNHANDLED MINER STATE FOR ${miner.print} (MODE: ${this.mode})`);
		}

	}

	run() {
		for (const miner of this.miners) {
			this.handleMiner(miner);
		}
		if (this.room && Game.time % BUILD_OUTPUT_FREQUENCY == 1) {
			this.addRemoveContainer();
		}
		if (Game.time % SUICIDE_CHECK_FREQUENCY == 0) {
			this.suicideOldMiners();
		}
	}
}
