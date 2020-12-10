import {Colony} from '../Colony';
import {log} from '../console/log';
import {CombatCreepSetup} from '../creepSetups/CombatCreepSetup';
import {CreepSetup} from '../creepSetups/CreepSetup';
import {SpawnRequest, SpawnRequestOptions} from '../hiveClusters/hatchery';
import {SpawnGroup} from '../logistics/SpawnGroup';
import {Mem} from '../memory/Memory';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {Abathur} from '../resources/Abathur';
import {Tasks} from '../tasks/Tasks';
import {getOverlord, setOverlord} from '../zerg/AnyZerg';
import {CombatZerg} from '../zerg/CombatZerg';
import {Zerg} from '../zerg/Zerg';

export interface OverlordInitializer {
	ref: string;
	room: Room | undefined;
	pos: RoomPosition;
	colony: Colony;
	memory: any;
	waypoints?: RoomPosition[];
}

export function hasColony(initializer: OverlordInitializer | Colony): initializer is OverlordInitializer {
	return (<OverlordInitializer>initializer).colony != undefined;
}

export const DEFAULT_PRESPAWN = 40;
export const MAX_SPAWN_REQUESTS = 100; // this stops division by zero or related errors from sending infinite requests

export interface CreepRequestOptions {
	reassignIdle?: boolean;
	spawnOneAtATime?: boolean;
	noLifetimeFilter?: boolean;
	prespawn?: number;
	priority?: number;
	partners?: (CreepSetup | CombatCreepSetup)[];
	options?: SpawnRequestOptions;
}

export interface ZergOptions {
	notifyWhenAttacked?: boolean;
}

export interface OverlordStats {
	start: number;
	end?: number;
	cpu: number;
	spawnCost: number;
	deaths: number; // TODO: track deaths
}

export interface OverlordSuspendOptions {
	endTick?: number;
	condition?: {
		fn: string; // stringified function with signature () => boolean;
		freq: number; // how often to check if the condition is met
	};
}

export interface OverlordMemory {
	suspend?: OverlordSuspendOptions;
	[MEM.STATS]?: OverlordStats;
	debug?: boolean;
}

const getDefaultOverlordMemory: () => OverlordMemory = () => ({});

/**
 * An Overlord is roughly analogous to a process in an OS: it is a generalization of a set of related things that need
 * to be done in a colony, like mining from a site, bootstrapping a new colony, guarding against invaders, or building
 * construction sites. Overlords handle spawning or obtaining suitable creeps to do these things and contain the actual
 * implementation of doing them.
 */
@profile
export abstract class Overlord {

	protected initializer: OverlordInitializer | Colony;
	memory: OverlordMemory;
	room: Room | undefined;
	priority: number; 			// priority can be changed in constructor phase but not after
	name: string;
	ref: string;
	pos: RoomPosition;
	colony: Colony;
	spawnGroup: SpawnGroup | undefined;
	private _creeps: { [roleName: string]: Creep[] };
	private _zerg: { [roleName: string]: Zerg[] };
	private _combatZerg: { [roleName: string]: CombatZerg[] };
	// private boosts: { [roleName: string]: ResourceConstant[] | undefined };
	creepUsageReport: { [roleName: string]: [number, number] | undefined };
	private shouldSpawnAt?: number;

	constructor(initializer: OverlordInitializer | Colony, name: string, priority: number,
				memDefaults: () => OverlordMemory = getDefaultOverlordMemory) {
		this.initializer = initializer;
		this.memory = Mem.wrap(initializer.memory, name, memDefaults);
		this.room = initializer.room;
		this.priority = priority;
		this.name = name;
		this.ref = initializer.ref + '>' + name;
		this.pos = initializer.pos;
		this.colony = hasColony(initializer) ? initializer.colony : initializer;
		this.spawnGroup = undefined;

		// Calculate the creeps associated with this overlord and group by roles
		this._creeps = {};
		this._zerg = {};
		this._combatZerg = {};
		this.recalculateCreeps();
		this.creepUsageReport = _.mapValues(this._creeps, creep => undefined);

		// Register the overlord on the colony overseer and on the overmind
		Overmind.overlords[this.ref] = this;
		Overmind.overseer.registerOverlord(this);
	}

	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.ref + ']</a>';
	}

	debug(...args: any[]) {
		if (this.memory.debug) {
			log.alert(this.print, args);
		}
	}

	/**
	 * Refreshes overlord, recalculating creeps and refreshing existing Zerg. New creeps are automatically added,
	 * and the corresponding role groups (e.g. 'queens') are automatically updated. Child methods do not need to
	 * refresh their zerg properties or their memories, only other room objects stored on the Overlord.
	 */
	refresh(): void {
		// Refresh memory
		this.memory = Mem.wrap(this.initializer.memory, this.name);
		// Refresh room
		this.room = Game.rooms[this.pos.roomName];
		// Refresh zerg
		this.recalculateCreeps();
		for (const role in this._creeps) {
			for (const creep of this._creeps[role]) {
				if (Overmind.zerg[creep.name]) {
					// log.debug(`Refreshing creep ${creep.name}`)
					Overmind.zerg[creep.name].refresh();
				} else {
					log.warning(`${this.print}: could not find and refresh zerg with name ${creep.name}!`);
				}
			}
		}
	}

	recalculateCreeps(): void {
		// Recalculate the sets of creeps for each role in this overlord
		this._creeps = _.mapValues(Overmind.cache.overlords[this.ref],
								   creepsOfRole => _.map(creepsOfRole, creepName => Game.creeps[creepName]));
		// Update zerg and combatZerg records
		for (const role in this._zerg) {
			this.synchronizeZerg(role);
		}
		for (const role in this._combatZerg) {
			this.synchronizeCombatZerg(role);
		}
	}

	/**
	 * Returns whether the overlord is currently suspended
	 */
	get isSuspended(): boolean {
		if (this.memory.suspend) {
			if (this.memory.suspend.endTick) {
				if (Game.time < this.memory.suspend.endTick) {
					return true;
				} else {
					delete this.memory.suspend;
					return false;
				}
			}
			if (this.memory.suspend.condition) {
				log.error('NOT IMPLEMENTED'); // TODO
				const {fn, freq} = this.memory.suspend.condition;
				if (Game.time % freq == 0) {
					const condition = new Function(fn);
					// TODO - finish this
				}
			}
		}
		return false;
	}

	suspendFor(ticks: number): void {
		this.memory.suspend = {
			endTick: Game.time + ticks
		};
	}

	suspendUntil(endTick: number): void {
		this.memory.suspend = {
			endTick: endTick
		};
	}

	/**
	 * Check if profiling is active, also shuts it down if it is past end tick
	 */
	get profilingActive(): boolean {
		if (this.memory[MEM.STATS]) {
			if (this.memory[MEM.STATS]!.end) {
				if (Game.time > this.memory[MEM.STATS]!.end!) {
					this.finishProfiling();
					return false;
				}
			}
			return true;
		}
		return false;
	}

	/**
	 * Starts profiling on this overlord and initializes memory to defaults
	 */
	startProfiling(ticks?: number): void {
		if (!this.memory[MEM.STATS]) {
			this.memory[MEM.STATS] = {
				start    : Game.time,
				cpu      : 0,
				spawnCost: 0,
				deaths   : 0,
			};
			if (ticks) {
				this.memory[MEM.STATS]!.end = Game.time + ticks;
			}
		} else {
			log.alert(`Overlord ${this.print} is already being profiled!`);
		}
	}

	/**
	 * Finishes profiling this overlord and deletes the memory objects
	 */
	finishProfiling(verbose = true): void {
		if (!this.memory[MEM.STATS]) {
			log.error(`Overlord ${this.print} is not being profiled, finishProfiling() invalid!`);
			return;
		}
		if (verbose) {
			log.alert(`Profiling finished for overlord ${this.print}. Results:\n` +
					  JSON.stringify(this.memory[MEM.STATS]));
		}
		delete this.memory[MEM.STATS];
	}

	/**
	 * Wraps all creeps of a given role to Zerg objects and updates the contents in future ticks to avoid having to
	 * explicitly refresh groups of Zerg
	 */
	protected zerg(role: string, opts: ZergOptions = {}): Zerg[] {
		if (!this._zerg[role]) {
			this._zerg[role] = [];
			this.synchronizeZerg(role, opts.notifyWhenAttacked);
		}
		return this._zerg[role];
	}

	private synchronizeZerg(role: string, notifyWhenAttacked?: boolean): void {
		// Synchronize the corresponding sets of Zerg
		const zergNames = _.zipObject(_.map(this._zerg[role] || [],
											zerg => [zerg.name, true])) as { [name: string]: boolean };
		const creepNames = _.zipObject(_.map(this._creeps[role] || [],
											 creep => [creep.name, true])) as { [name: string]: boolean };
		// Add new creeps which aren't in the _zerg record
		for (const creep of this._creeps[role] || []) {
			if (!zergNames[creep.name]) {
				this._zerg[role].push(Overmind.zerg[creep.name] || new Zerg(creep, notifyWhenAttacked));
			}
		}
		// Remove dead/reassigned creeps from the _zerg record
		const removeZergNames: string[] = [];
		for (const zerg of this._zerg[role]) {
			if (!creepNames[zerg.name]) {
				removeZergNames.push(zerg.name);
			}
		}
		_.remove(this._zerg[role], deadZerg => removeZergNames.includes(deadZerg.name));
	}

	getAllZerg(): Zerg[] {
		const allZerg: Zerg[] = [];
		for (const role in this._creeps) {
			for (const zerg of this.zerg(role)) {
				allZerg.push(zerg);
			}
		}
		return allZerg;
	}

	/**
	 * Wraps all creeps of a given role to CombatZerg objects and updates the contents in future ticks
	 */
	protected combatZerg(role: string, opts: ZergOptions = {}): CombatZerg[] {
		if (!this._combatZerg[role]) {
			this._combatZerg[role] = [];
			this.synchronizeCombatZerg(role, opts.notifyWhenAttacked);
		}
		return this._combatZerg[role];
	}

	private synchronizeCombatZerg(role: string, notifyWhenAttacked?: boolean): void {
		// Synchronize the corresponding sets of CombatZerg
		const zergNames = _.zipObject(_.map(this._combatZerg[role] || [],
											zerg => [zerg.name, true])) as { [name: string]: boolean };
		const creepNames = _.zipObject(_.map(this._creeps[role] || [],
											 creep => [creep.name, true])) as { [name: string]: boolean };
		// Add new creeps which aren't in the _combatZerg record
		for (const creep of this._creeps[role] || []) {
			if (!zergNames[creep.name]) {
				if (Overmind.zerg[creep.name] && (<CombatZerg>Overmind.zerg[creep.name]).isCombatZerg) {
					this._combatZerg[role].push(Overmind.zerg[creep.name]);
				} else {
					this._combatZerg[role].push(new CombatZerg(creep, notifyWhenAttacked));
				}
			}
		}
		// Remove dead/reassigned creeps from the _combatZerg record
		const removeZergNames: string[] = [];
		for (const zerg of this._combatZerg[role]) {
			if (!creepNames[zerg.name]) {
				removeZergNames.push(zerg.name);
			}
		}
		_.remove(this._combatZerg[role], deadZerg => removeZergNames.includes(deadZerg.name));
	}

	getAllCombatZerg(): CombatZerg[] {
		const allCombatZerg: CombatZerg[] = [];
		for (const role in this._creeps) {
			for (const combatZerg of this.combatZerg(role)) {
				allCombatZerg.push(combatZerg);
			}
		}
		return allCombatZerg;
	}

	/**
	 * Gets the "ID" of the outpost this overlord is operating in. 0 for owned rooms, >= 1 for outposts, -1 for other
	 */
	get outpostIndex(): number {
		return _.findIndex(this.colony.roomNames, roomName => roomName == this.pos.roomName);
	}

	// TODO: make this potentially colony independent
	protected reassignIdleCreeps(role: string, maxPerTick=1): boolean {
		// Find all creeps without an overlord
		const idleCreeps = _.filter(this.colony.getCreepsByRole(role), creep => !getOverlord(creep));
		// Reassign them all to this flag
		let reassigned = 0;
		for (const creep of idleCreeps) {
			// TODO: check range of creep from overlord
			setOverlord(creep, this);
			reassigned++;
			if (reassigned >= maxPerTick) {
				break;
			}
		}
		return reassigned > 0;
	}

	protected creepReport(role: string, currentAmt: number, neededAmt: number) {
		this.creepUsageReport[role] = [currentAmt, neededAmt];
	}

	/**
	 * Requests a group of (2-3) creeps from a hatchery to be spawned at the same time. Using this with low-priority
	 * operations can result in a long time
	 */
	protected requestSquad(setups: (CreepSetup | CombatCreepSetup)[], opts = {} as CreepRequestOptions) {
		log.warning(`Overlord.requestSquad() is not finished yet!`); // TODO: finish
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		const spawner = this.spawnGroup || this.colony.spawnGroup || this.colony.hatchery;
		if (spawner) {
			if (setups.length > 3) {
				log.warning(`Requesting squads of >3 is not advisable`);
			}
			const request: SpawnRequest = {
				setup   : _.head(setups),
				overlord: this,
				priority: opts.priority!,
				partners: _.tail(setups),
			};
			if (opts.options) {
				request.options = opts.options;
			}
			spawner.enqueue(request);
		} else {
			if (Game.time % 100 == 0) {
				log.warning(`Overlord ${this.ref} @ ${this.pos.print}: no spawner object!`);
			}
		}
	}

	/**
	 * Create a creep setup and enqueue it to the Hatchery; does not include automatic reporting
	 */
	protected requestCreep(setup: CreepSetup | CombatCreepSetup, opts = {} as CreepRequestOptions) {
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		const spawner = this.spawnGroup || this.colony.spawnGroup || this.colony.hatchery;
		if (spawner) {
			const request: SpawnRequest = {
				setup   : setup,
				overlord: this,
				priority: opts.priority!,
			};
			if (opts.partners) {
				request.partners = opts.partners;
			}
			if (opts.options) {
				request.options = opts.options;
			}
			spawner.enqueue(request);
		} else {
			if (Game.time % 100 == 0) {
				log.warning(`Overlord ${this.ref} @ ${this.pos.print}: no spawner object!`);
			}
		}
	}

	// TODO: include creep move speed
	lifetimeFilter(creeps: (Creep | Zerg)[], prespawn = DEFAULT_PRESPAWN, spawnDistance?: number): (Creep | Zerg)[] {
		if (!spawnDistance) {
			spawnDistance = 0;
			if (this.spawnGroup) {
				const distances = _.take(_.sortBy(this.spawnGroup.memory.distances), 2);
				spawnDistance = (_.sum(distances) / distances.length) || 0;
			} else if (this.colony.hatchery) {
				// Use distance or 0 (in case distance returns something undefined due to incomplete pathfinding)
				spawnDistance = Pathing.distance(this.pos, this.colony.hatchery.pos) || 0;
			}
			if (this.colony.state.isIncubating && this.colony.spawnGroup) {
				spawnDistance += this.colony.spawnGroup.stats.avgDistance;
			}
		}

		/* The last condition fixes a bug only present on private servers that took me a fucking week to isolate.
		 * At the tick of birth, creep.spawning = false and creep.ticksTolive = undefined
		 * See: https://screeps.com/forum/topic/443/creep-spawning-is-not-updated-correctly-after-spawn-process */
		return _.filter(creeps, creep =>
			creep.ticksToLive! > CREEP_SPAWN_TIME * creep.body.length + spawnDistance! + prespawn ||
			creep.spawning || (!creep.spawning && !creep.ticksToLive));
	}

	/**
	 * Wishlist of creeps to simplify spawning logic; includes automatic reporting
	 */
	protected wishlist(quantity: number, setup: CreepSetup | CombatCreepSetup, opts = {} as CreepRequestOptions): void {

		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN, reassignIdle: false});

		// TODO Don't spawn if spawning is halted
		if (this.shouldSpawnAt && this.shouldSpawnAt > Game.time) {
			log.info(`Disabled spawning for ${this.print} for another ${this.shouldSpawnAt - Game.time} ticks`);
			return;
		}

		let creepQuantity: number;
		if (opts.noLifetimeFilter) {
			creepQuantity = (this._creeps[setup.role] || []).length;
		} else if (_.has(this.initializer, 'waypoints')) {
			// TODO: replace hardcoded distance with distance computed through portals
			creepQuantity = this.lifetimeFilter(this._creeps[setup.role] || [], opts.prespawn, 500).length;
		} else {
			creepQuantity = this.lifetimeFilter(this._creeps[setup.role] || [], opts.prespawn).length;
		}

		let spawnQuantity = quantity - creepQuantity;
		if (opts.reassignIdle && spawnQuantity > 0) {
			const idleCreeps = _.filter(this.colony.getCreepsByRole(setup.role), creep => !getOverlord(creep));
			for (let i = 0; i < Math.min(idleCreeps.length, spawnQuantity); i++) {
				setOverlord(idleCreeps[i], this);
				spawnQuantity--;
			}
		}

		// A bug in outpostDefenseOverlord caused infinite requests and cost me two botarena rounds before I found it...
		if (spawnQuantity > MAX_SPAWN_REQUESTS) {
			log.error(`Too many requests for ${setup.role}s submitted by ${this.print}! (Check for errors.)`);
		} else {
			for (let i = 0; i < spawnQuantity; i++) {
				if (i >= 1 && opts.spawnOneAtATime) break;
				this.requestCreep(setup, opts);
			}
		}

		this.creepReport(setup.role, creepQuantity, quantity);
	}

	/**
	 * Requests that should be handled for all overlords prior to the init() phase
	 */
	preInit(): void {
		// Handle requesting boosts from the evolution chamber
		const allZerg = _.flatten([..._.values(this._zerg), ..._.values(this._combatZerg)]) as (Zerg | CombatZerg)[];
		for (const zerg of allZerg) {
			if (zerg.needsBoosts) {
				const colony = Overmind.colonies[zerg.room.name] as Colony | undefined;
				const evolutionChamber = colony ? colony.evolutionChamber : undefined;
				if (evolutionChamber) {
					evolutionChamber.requestBoosts(zerg.getNeededBoosts());
				}
			}
		}
	}

	abstract init(): void;

	abstract run(): void;

	/**
	 * Contains logic for shutting down the overlord
	 */
	finish(successful: boolean): void {
		for (const zerg of this.getAllZerg()) {
			zerg.reassign(this.colony.overlords.default);
		}
		// TODO: CombatOverlord
	}

	/**
	 * Handle boosting of a creep; should be called during run()
	 */
	protected handleBoosting(zerg: Zerg | CombatZerg): void {
		const colony = Overmind.colonies[zerg.room.name] as Colony | undefined;
		const evolutionChamber = colony ? colony.evolutionChamber : undefined;

		if (evolutionChamber) {

			if (!zerg.needsBoosts) {
				log.error(`Overlord.handleBoosting() called for ${zerg.print}, but no boosts needed!`);
			}

			const neededBoosts = zerg.getNeededBoosts();
			const neededBoostResources = _.keys(neededBoosts);

			const [moveBoosts, nonMoveBoosts] = _.partition(neededBoostResources,
															resource => Abathur.isMoveBoost(<ResourceConstant>resource));

			for (const boost of [...moveBoosts, ...nonMoveBoosts]) { // try to get move boosts first if they're available
				const boostLab = _.find(evolutionChamber.boostingLabs, lab => lab.mineralType == boost);
				if (boostLab) {
					zerg.task = Tasks.getBoosted(boostLab, <ResourceConstant>boost);
					return;
				}
			}

		}
	}

	/**
	 * Standard sequence of actions for running task-based creeps
	 */
	autoRun(roleCreeps: Zerg[], taskHandler: (creep: Zerg) => void, fleeCallback?: (creep: Zerg) => boolean) {
		for (const creep of roleCreeps) {
			if (creep.spawning) {
				return;
			}
			if (!!fleeCallback) {
				if (fleeCallback(creep)) continue;
			}
			if (creep.isIdle) {
				if (creep.needsBoosts) {
					this.handleBoosting(creep);
				} else {
					taskHandler(creep);
				}
			}
			creep.run();
		}
	}

	visuals(): void {

	}

}

