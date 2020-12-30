// Room prototypes - commonly used room properties and methods

import {isAlly} from '../utilities/utils';
import {MY_USERNAME} from '../~settings';

// Logging =============================================================================================================
Object.defineProperty(Room.prototype, 'print', {
	get() {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.name + '">' + this.name + '</a>';
	},
	configurable: true,
});

// Room properties =====================================================================================================

Object.defineProperty(Room.prototype, 'my', {
	get() {
		return this.controller && this.controller.my;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'isColony', {
	get() {
		return Overmind.colonies[this.name] != undefined;
	},
	configurable: true,
});


Object.defineProperty(Room.prototype, 'isOutpost', {
	get() {
		return Overmind.colonyMap[this.name] != undefined;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'owner', {
	get() {
		return this.controller && this.controller.owner ? this.controller.owner.username : undefined;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'reservedByMe', {
	get() {
		return this.controller && this.controller.reservation && this.controller.reservation.username == MY_USERNAME;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'signedByMe', {
	get() {
		return this.controller && this.controller.sign && this.controller.sign.text == Memory.settings.signature;
	},
	configurable: true,
});

// Room properties: creeps =============================================================================================

// Creeps physically in the room
Object.defineProperty(Room.prototype, 'creeps', {
	get() {
		if (!this._creeps) {
			this._creeps = this.find(FIND_MY_CREEPS);
		}
		return this._creeps;
	},
	configurable: true,
});

// Room properties: hostiles ===========================================================================================

Object.defineProperty(Room.prototype, 'hostiles', {
	get() {
		if (!this._hostiles) {
			this._hostiles = this.find(FIND_HOSTILE_CREEPS, {filter: (creep: Creep) => !isAlly(creep.owner.username)});
		}
		return this._hostiles;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'friendlies', {
	get() {
		if (!this._friendlies) {
			this._friendlies = this.find(FIND_HOSTILE_CREEPS, {filter: (creep: Creep) => isAlly(creep.owner.username)});
		}
		return this._friendlies;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'invaders', {
	get() {
		if (!this._invaders) {
			this._invaders = _.filter(this.hostiles, (creep: Creep) => creep.owner.username == 'Invader');
		}
		return this._invaders;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'sourceKeepers', {
	get() {
		if (!this._sourceKeepers) {
			this._sourceKeepers = _.filter(this.hostiles, (creep: Creep) => creep.owner.username == 'Source Keeper');
		}
		return this._sourceKeepers;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'playerHostiles', {
	get() {
		if (!this._playerHostiles) {
			this._playerHostiles = _.filter(this.hostiles, (creep: Creep) => creep.isPlayer);
		}
		return this._playerHostiles;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'dangerousHostiles', {
	get() {
		if (!this._dangerousHostiles) {
			if (this.my) {
				this._dangerousHostiles = _.filter(this.hostiles,
												   (creep: Creep) => creep.getActiveBodyparts(ATTACK) > 0
																	 || creep.getActiveBodyparts(RANGED_ATTACK) > 0
																	 || creep.getActiveBodyparts(WORK) > 0);
			} else {
				this._dangerousHostiles = _.filter(this.hostiles,
												   (creep: Creep) => creep.getActiveBodyparts(ATTACK) > 0
																	 || creep.getActiveBodyparts(RANGED_ATTACK) > 0);
			}
		}
		return this._dangerousHostiles;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'dangerousPlayerHostiles', {
	get() {
		if (!this._dangerousPlayerHostiles) {
			if (this.my) {
				this._dangerousPlayerHostiles = _.filter(this.playerHostiles,
												   (creep: Creep) => creep.getActiveBodyparts(ATTACK) > 0
																	 || creep.getActiveBodyparts(RANGED_ATTACK) > 0
																	 || creep.getActiveBodyparts(WORK) > 0);
			} else {
				this._dangerousPlayerHostiles = _.filter(this.playerHostiles,
												   (creep: Creep) => creep.getActiveBodyparts(ATTACK) > 0
																	 || creep.getActiveBodyparts(RANGED_ATTACK) > 0);
			}
		}
		return this._dangerousPlayerHostiles;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'fleeDefaults', {
	get() {
		if (!this._fleeDefaults) {
			this._fleeDefaults = [
				...this.dangerousHostiles,
				..._.filter(this.keeperLairs, (l: StructureKeeperLair) => (l.ticksToSpawn || Infinity) <= 10)
			];
		}
		return this._fleeDefaults;
	},
	configurable: true,
});

// Hostile structures currently in the room
Object.defineProperty(Room.prototype, 'structures', {
	get() {
		if (!this._allStructures) {
			this._allStructures = this.find(FIND_STRUCTURES);
		}
		return this._allStructures;
	},
	configurable: true,
});


// Hostile structures currently in the room
Object.defineProperty(Room.prototype, 'hostileStructures', {
	get() {
		if (!this._hostileStructures) {
			this._hostileStructures = this.find(FIND_HOSTILE_STRUCTURES, {
				filter: (s: Structure) => (s.hitsMax) && !isAlly(_.get(s, ['owner', 'username']))
			});
		}
		return this._hostileStructures;
	},
	configurable: true,
});

// Room properties: flags ==============================================================================================

// Flags physically in this room
Object.defineProperty(Room.prototype, 'flags', {
	get() {
		if (!this._flags) {
			this._flags = this.find(FIND_FLAGS);
		}
		return this._flags;
	},
	configurable: true,
});

// Room properties: structures =========================================================================================

Object.defineProperty(Room.prototype, 'constructionSites', {
	get() {
		if (!this._constructionSites) {
			this._constructionSites = this.find(FIND_MY_CONSTRUCTION_SITES);
		}
		return this._constructionSites;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'allConstructionSites', {
	get() {
		if (!this._allConstructionSites) {
			this._allConstructionSites = this.find(FIND_CONSTRUCTION_SITES);
		}
		return this._allConstructionSites;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'hostileConstructionSites', {
	get() {
		if (!this._hostileConstructionSites) {
			this._hostileConstructionSites = this.find(FIND_HOSTILE_CONSTRUCTION_SITES);
		}
		return this._hostileConstructionSites;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'tombstones', {
	get() {
		if (!this._tombstones) {
			this._tombstones = this.find(FIND_TOMBSTONES);
		}
		return this._tombstones;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'ruins', {
	get() {
		if (!this._ruins) {
			this._ruins = this.find(FIND_RUINS);
		}
		return this._ruins;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'drops', {
	get() {
		if (!this._drops) {
			this._drops = _.groupBy(this.find(FIND_DROPPED_RESOURCES), (r: Resource) => r.resourceType);
		}
		return this._drops;
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'droppedEnergy', {
	get() {
		return this.drops[RESOURCE_ENERGY] || [];
	},
	configurable: true,
});

Object.defineProperty(Room.prototype, 'droppedPower', {
	get() {
		return this.drops[RESOURCE_POWER] || [];
	},
	configurable: true,
});
