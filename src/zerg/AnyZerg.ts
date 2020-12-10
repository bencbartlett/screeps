import {Colony, getAllColonies} from '../Colony';
import {log} from '../console/log';
import {isAnyZerg, isPowerCreep} from '../declarations/typeGuards';
import {Movement, MoveOptions} from '../movement/Movement';
import {Pathing} from '../movement/Pathing';
import {Overlord} from '../overlords/Overlord';
import {profile} from '../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../utilities/Cartographer';
import {minBy} from '../utilities/utils';
import {NEW_OVERMIND_INTERVAL} from '../~settings';

export function getOverlord(creep: AnyZerg | AnyCreep): Overlord | null {
	if (creep.memory[MEM.OVERLORD]) {
		return Overmind.overlords[creep.memory[MEM.OVERLORD]!] || null;
	} else {
		return null;
	}
}

export function setOverlord(creep: AnyZerg | AnyCreep, newOverlord: Overlord | null) {
	// Remove cache references to old assignments
	const roleName = creep.memory.role;
	const ref = creep.memory[MEM.OVERLORD];
	const oldOverlord: Overlord | null = ref ? Overmind.overlords[ref] : null;
	if (ref && Overmind.cache.overlords[ref] && Overmind.cache.overlords[ref][roleName]) {
		_.remove(Overmind.cache.overlords[ref][roleName], name => name == creep.name);
	}
	if (newOverlord) {
		// Change to the new overlord's colony
		creep.memory[MEM.COLONY] = newOverlord.colony.name;
		// Change assignments in memory
		creep.memory[MEM.OVERLORD] = newOverlord.ref;
		// Update the cache references
		if (!Overmind.cache.overlords[newOverlord.ref]) {
			Overmind.cache.overlords[newOverlord.ref] = {};
		}
		if (!Overmind.cache.overlords[newOverlord.ref][roleName]) {
			Overmind.cache.overlords[newOverlord.ref][roleName] = [];
		}
		Overmind.cache.overlords[newOverlord.ref][roleName].push(creep.name);
	} else {
		creep.memory[MEM.OVERLORD] = null;
	}
	if (oldOverlord) oldOverlord.recalculateCreeps();
	if (newOverlord) newOverlord.recalculateCreeps();
}

export function normalizeAnyZerg(creep: AnyZerg | AnyCreep): AnyZerg | AnyCreep {
	return Overmind.zerg[creep.name] || Overmind.powerZerg[creep.name] || creep;
}

interface ParkingOptions {
	range: number;
	exactRange: boolean;
	offroad: boolean;
}

interface FleeOptions {
	timer?: number;
	dropEnergy?: boolean;
	invalidateTask?: boolean;
}

const RANGES = {
	BUILD   : 3,
	REPAIR  : 3,
	TRANSFER: 1,
	WITHDRAW: 1,
	HARVEST : 1,
	DROP    : 0,
};

/**
 * The AnyZerg abstract class contains all of the base methods that are present on both the Zerg and PowerZerg classes.
 * Most of these methods have been moved from the Zerg class.
 */
@profile
export abstract class AnyZerg {

	isAnyZerg: true;
	creep: AnyCreep; 					// The creep that this wrapper class will control
	// body: BodyPartDefinition[];    	 	// These properties are all wrapped from this.creep.* to this.*
	carry: StoreDefinition;				// |
	store: StoreDefinition; 			// |
	carryCapacity: number;				// |
	effects: RoomObjectEffect[];
	// fatigue: number;					// |
	hits: number;						// |
	hitsMax: number;					// |
	id: string;							// |
	memory: CreepMemory;				// | See the ICreepMemory interface for structure
	name: string;						// |
	pos: RoomPosition;					// |
	nextPos: RoomPosition;				// | The next position the creep will be in after registering a move intent
	ref: string;						// |
	// roleName: string;					// |
	room: Room;							// |
	saying: string;						// |
	// spawning: boolean;					// |
	ticksToLive: number | undefined;	// |
	lifetime: number;
	actionLog: { [actionName: string]: boolean }; // Tracks the actions that a creep has completed this tick
	blockMovement: boolean; 			// Whether the zerg is allowed to move or not
	// private _task: Task | null; 		// Cached Task object that is instantiated once per tick and on change

	constructor(creep: AnyCreep, notifyWhenAttacked = true) {
		this.isAnyZerg = true;
		// Copy over creep references
		this.creep = creep;
		// this.body = creep.body;
		this.carry = creep.carry;
		this.store = creep.store;
		this.carryCapacity = creep.carryCapacity;
		// this.fatigue = creep.fatigue;
		this.effects = creep.effects;
		this.hits = creep.hits;
		this.hitsMax = creep.hitsMax;
		this.id = creep.id;
		this.memory = creep.memory;
		this.name = creep.name;
		this.pos = creep.pos;
		this.nextPos = creep.pos;
		this.ref = creep.ref;
		// this.roleName = creep.memory.role;
		this.room = creep.room!; // only wrap actively spawned PowerCreeps
		this.saying = creep.saying;
		// this.spawning = creep.spawning;
		this.ticksToLive = creep.ticksToLive;
		// Extra properties
		if (isPowerCreep(creep)) {
			this.lifetime = POWER_CREEP_LIFE_TIME;
		} else {
			this.lifetime = _.filter(creep.body, part => part.type == CLAIM).length > 0
							? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
		}
		this.actionLog = {};
		this.blockMovement = false;
		// Register global references
		// Overmind.zerg[this.name] = this;
		global[this.name] = this;
		// Handle attack notification when at lifetime - 1
		if (!notifyWhenAttacked && (this.ticksToLive || 0) >= this.lifetime - (NEW_OVERMIND_INTERVAL + 1)) {
			// creep.notifyWhenAttacked only uses the 0.2CPU intent cost if it changes the intent value
			this.notifyWhenAttacked(notifyWhenAttacked);
		}
	}

	/**
	 * Refresh all changeable properties of the creep or delete from Overmind and global when dead
	 */
	refresh(): void {
		const creep = Game.creeps[this.name];
		if (creep) {
			this.creep = creep;
			this.pos = creep.pos;
			this.nextPos = creep.pos;
			// this.body = creep.body;
			this.carry = creep.carry;
			this.store = creep.store;
			this.carryCapacity = creep.carryCapacity;
			// this.fatigue = creep.fatigue;
			this.hits = creep.hits;
			this.memory = creep.memory;
			// this.roleName = creep.memory.role;
			this.room = creep.room;
			this.saying = creep.saying;
			// this.spawning = creep.spawning;
			this.ticksToLive = creep.ticksToLive;
			this.actionLog = {};
			this.blockMovement = false;
			// this._task = null;
		} else {
			log.debug(`Deleting ${this.print} from global`);
			// delete Overmind.zerg[this.name];
			delete global[this.name];
		}
	}

	debug(...args: any[]) {
		if (this.memory.debug) {
			log.alert(this.print, args);
		}
	}

	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.name + ']</a>';
	}

	// Wrapped creep methods ===========================================================================================

	cancelOrder(methodName: string): OK | ERR_NOT_OWNER | ERR_BUSY | ERR_NOT_FOUND {
		const result = this.creep.cancelOrder(methodName);
		if (result == OK) this.actionLog[methodName] = false;
		return result;
	}

	drop(resourceType: ResourceConstant, amount?: number) {
		const result = this.creep.drop(resourceType, amount);
		if (!this.actionLog.drop) this.actionLog.drop = (result == OK);
		return result;
	}

	goDrop(pos: RoomPosition, resourceType: ResourceConstant, amount?: number) {
		if (this.pos.inRangeToPos(pos, RANGES.DROP)) {
			return this.drop(resourceType, amount);
		} else {
			return this.goTo(pos);
		}
	}

	move(direction: DirectionConstant, force = false) {
		if (!this.blockMovement || force) {
			const result = this.creep.move(direction);
			if (result == OK) {
				if (!this.actionLog.move) this.actionLog.move = true;
				this.nextPos = this.pos.getPositionAtDirection(direction);
			}
			return result;
		} else {
			return ERR_BUSY;
		}
	}

	notifyWhenAttacked(enabled: boolean) {
		return this.creep.notifyWhenAttacked(enabled);
	}

	pickup(resource: Resource) {
		const result = this.creep.pickup(resource);
		if (!this.actionLog.pickup) this.actionLog.pickup = (result == OK);
		return result;
	}

	/* Say a message; maximum message length is 10 characters */
	say(message: string, pub?: boolean) {
		return this.creep.say(message, pub);
	}

	suicide() {
		return this.creep.suicide();
	}

	transfer(target: AnyCreep | AnyZerg | Structure, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
		let result: ScreepsReturnCode;
		if (isAnyZerg(target)) {
			result = this.creep.transfer(target.creep, resourceType, amount);
		} else {
			result = this.creep.transfer(target, resourceType, amount);
		}
		if (!this.actionLog.transfer) this.actionLog.transfer = (result == OK);
		return result;
	}

	transferAll(target: AnyCreep | AnyZerg | Structure, amount?: number) {
		for (const [resourceType, amount] of this.creep.store.contents) {
			if (amount > 0) {
				return this.transfer(target, resourceType);
			}
		}
	}

	goTransfer(target: Creep | AnyZerg | Structure, resourceType: ResourceConstant = RESOURCE_ENERGY,
			   amount?: number): void {
		if (this.transfer(target, resourceType, amount) == ERR_NOT_IN_RANGE) {
			this.goTo(target);
		}
	}

	withdraw(target: Structure | Tombstone | Ruin, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
		const result = this.creep.withdraw(target, resourceType, amount);
		if (!this.actionLog.withdraw) this.actionLog.withdraw = (result == OK);
		return result;
	}

	goWithdraw(target: Structure | Tombstone, resourceType: ResourceConstant = RESOURCE_ENERGY,
			   amount?: number): void {
		if (this.withdraw(target, resourceType, amount) == ERR_NOT_IN_RANGE) {
			this.goTo(target);
		}
	}

	// Custom creep methods ============================================================================================

	// Carry methods

	get hasMineralsInCarry(): boolean {
		for (const [resourceType, amount] of this.carry.contents) {
			if (resourceType != RESOURCE_ENERGY && amount > 0) {
				return true;
			}
		}
		return false;
	}

	// Overlord logic --------------------------------------------------------------------------------------------------

	get overlord(): Overlord | null {
		return getOverlord(this);
	}

	set overlord(newOverlord: Overlord | null) {
		setOverlord(this, newOverlord);
	}

	// Colony association ----------------------------------------------------------------------------------------------

	/**
	 * Colony that the creep belongs to.
	 */
	get colony(): Colony | null {
		if (this.memory[MEM.COLONY] != null) {
			return Overmind.colonies[this.memory[MEM.COLONY] as string];
		} else {
			return null;
		}
	}

	set colony(newColony: Colony | null) {
		if (newColony != null) {
			this.memory[MEM.COLONY] = newColony.name;
		} else {
			this.memory[MEM.COLONY] = null;
		}
	}

	/**
	 * If the creep is in a colony room or outpost
	 */
	get inColonyRoom(): boolean {
		return Overmind.colonyMap[this.room.name] == this.memory[MEM.COLONY];
	}

	// Movement and location -------------------------------------------------------------------------------------------

	goTo(destination: RoomPosition | HasPos, options: MoveOptions = {}) {
		return Movement.goTo(this, destination, options);
	}

	goToRoom(roomName: string, options: MoveOptions = {}) {
		return Movement.goToRoom(this, roomName, options);
	}

	inSameRoomAs(target: HasPos): boolean {
		return this.pos.roomName == target.pos.roomName;
	}

	safelyInRoom(roomName: string): boolean {
		return this.room.name == roomName && !this.pos.isEdge;
	}

	get inRampart(): boolean {
		return this.creep.inRampart;
	}

	get isMoving(): boolean {
		const moveData = this.memory._go as MoveData | undefined;
		return (!!moveData && !!moveData.path && moveData.path.length > 1) || this.actionLog[MOVE];
	}

	/**
	 * Kite around hostiles in the room
	 */
	kite(avoidGoals: (RoomPosition | HasPos)[] = this.room.hostiles, options: MoveOptions = {}): number | undefined {
		_.defaults(options, {
			fleeRange: 5
		});
		return Movement.kite(this, avoidGoals, options);
	}

	private defaultFleeGoals() {
		let fleeGoals: (RoomPosition | HasPos)[] = [];
		fleeGoals = fleeGoals.concat(this.room.hostiles)
							 .concat(_.filter(this.room.keeperLairs, lair => (lair.ticksToSpawn || Infinity) < 10));
		return fleeGoals;
	}

	/**
	 * Flee from hostiles in the room, while not repathing every tick // TODO: take a look at this
	 */
	flee(avoidGoals: (RoomPosition | HasPos)[] = this.room.fleeDefaults,
		 fleeOptions: FleeOptions              = {},
		 moveOptions: MoveOptions              = {}): boolean {
		if (avoidGoals.length == 0 || this.room.dangerousHostiles.find(
			creep => creep.pos.getRangeToXY(this.pos.x, this.pos.y) < 6) == undefined) {
			return false;
		} else if (this.room.controller && this.room.controller.my && this.room.controller.safeMode) {
			return false;
		} else {
			const fleeing = Movement.flee(this, avoidGoals, fleeOptions.dropEnergy, moveOptions) != undefined;
			if (fleeing) {
				// Drop energy if needed
				if (fleeOptions.dropEnergy && this.carry.energy > 0) {
					const nearbyContainers = this.pos.findInRange(this.room.storageUnits, 1);
					if (nearbyContainers.length > 0) {
						this.transfer(_.first(nearbyContainers), RESOURCE_ENERGY);
					} else {
						this.drop(RESOURCE_ENERGY);
					}
				}
			}
			return fleeing;
		}
	}

	/**
	 * Callback that is checked for many civilian roles. Returns true if the civilian zerg is in a dangerous situation
	 * and handles the zerg retreating to a fallback room. Acts as a replacement to the current default Zerg.flee()
	 * danger avoidance logic
	 */
	avoidDanger(opts: FleeOptions = {}): boolean {

		// If you're almost expired or you're spawning do nothing - if you get killed you're cheap and faster to replace
		if ((this.ticksToLive || 0) < 50) {
			return false; // I just wanna die!!
		}

		_.defaults(opts, {timer: 10, dropEnergy: true});

		// If you previously determined you are in danger, wait for timer to expire
		if (this.memory.avoidDanger) {
			if (this.memory.avoidDanger.timer > 0) {
				this.goToRoom(this.memory.avoidDanger.fallback);
				if (opts.dropEnergy && this.carry.energy > 0) {
					this.drop(RESOURCE_ENERGY); // transfer energy to container check is only run on first danger tick
				}
				this.memory.avoidDanger.timer--;
				return true;
			} else {
				delete this.memory.avoidDanger;
			}
		}

		if (!this.room.isSafe || this.hits < this.hitsMax) {

			if (Cartographer.roomType(this.room.name) == ROOMTYPE_SOURCEKEEPER) {
				// If you're in an SK room, you can skip the danger avoidance as long as you have max hp, there are no
				// player hostiles, no invaders, and you're not in range to any of the sourceKeepers or spawning lairs
				if (this.hits == this.hitsMax &&
					this.room.dangerousPlayerHostiles.length == 0 &&
					this.room.invaders.length == 0 &&
					!_.any(this.room.fleeDefaults, fleeThing => this.pos.inRangeTo(fleeThing, 5))) {
					// Not actually in danger
					return false;
				}
			}

			let fallback: string;
			const maxLinearRange = 6;
			// Like 99.999% of the time this will be the case
			if (this.colony && Game.map.getRoomLinearDistance(this.room.name, this.colony.name) <= maxLinearRange) {
				fallback = this.colony.name;
			}
			// But this could happen if the creep was working remotely through a portal
			else {
				const nearbyColonies = _.filter(getAllColonies(), colony =>
					Game.map.getRoomLinearDistance(this.room.name, colony.name) <= maxLinearRange);
				const closestColony = minBy(nearbyColonies, colony => {
					const route = Pathing.findRoute(this.room.name, colony.room.name);
					if (route == ERR_NO_PATH) {
						return false;
					} else {
						return route.length;
					}
				});
				if (!closestColony) {
					log.error(`${this.print} is all alone in a dangerous place and can't find their way home!`);
					return false;
				}
				fallback = closestColony.name;
			}

			this.memory.avoidDanger = {
				start   : Game.time,
				timer   : opts.timer!,
				fallback: fallback,
			};

			if (opts.dropEnergy && this.carry.energy > 0) {
				const containersInRange = this.pos.findInRange(this.room.containers, 1);
				const adjacentContainer = _.first(containersInRange);
				if (adjacentContainer) {
					this.transfer(adjacentContainer, RESOURCE_ENERGY);
				}
			}

			this.goToRoom(fallback);
			return true;

		}

		return false;

	}

	/**
	 * Park the creep off-roads
	 */
	park(pos: RoomPosition = this.pos, maintainDistance = false): number {
		return Movement.park(this, pos, maintainDistance);
	}

	/**
	 * Moves a creep off of the current tile to the first available neighbor
	 */
	moveOffCurrentPos(): number | undefined {
		return Movement.moveOffCurrentPos(this);
	}

	/**
	 * Moves onto an exit tile
	 */
	moveOnExit(): ScreepsReturnCode | undefined {
		return Movement.moveOnExit(this);
	}

	/**
	 * Moves off of an exit tile
	 */
	moveOffExit(towardPos?: RoomPosition, avoidSwamp = true): ScreepsReturnCode {
		return Movement.moveOffExit(this, towardPos, avoidSwamp);
	}


	// Miscellaneous fun stuff -----------------------------------------------------------------------------------------

	sayLoop(messageList: string[], pub?: boolean) {
		return this.say(messageList[Game.time % messageList.length], pub);
	}

	sayRandom(phrases: string[], pub?: boolean) {
		return this.say(phrases[Math.floor(Math.random() * phrases.length)], pub);
	}

}

