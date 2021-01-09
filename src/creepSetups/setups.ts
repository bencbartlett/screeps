import {
	CarrierSetup,
	HydraliskSetup,
	RavagerSetup,
	RemoteUpgraderSetup,
	TransfuserSetup,
	ZerglingSetup
} from './CombatCreepSetup';
import {CreepSetup} from './CreepSetup';

/**
 * A mapping of role types to string constants used for naming creeps and accessing them by role
 */
export const Roles = {
	// Civilian roles
	drone           : 'drone',
	filler          : 'filler',
	claim           : 'infestor',
	pioneer         : 'pioneer',
	manager         : 'manager',
	queen           : 'queen',
	scout           : 'changeling',
	transport       : 'transport',
	worker          : 'worker',
	upgrader        : 'upgrader',
	praiser         : 'praiser',
	// Combat roles
	guardMelee      : 'broodling', // currently not a CombatCreepSetup
	melee           : 'zergling',
	ranged          : 'hydralisk',
	rangedDistractor: 'babbylisk',
	healer          : 'transfuser',
	dismantler      : 'lurker',
	bunkerDefender  : 'ravager',
	drill           : 'drill',
	coolant         : 'coolant',
	roomPoisoner    : 'poisoner',
	strongholdKiller: 'strongman',
};

/**
 * This object contains categorized default body setups for various types of creeps
 */
export const Setups = {

	drones: {
		extractor: new CreepSetup(Roles.drone, {
			pattern  : [WORK, WORK, MOVE],
			sizeLimit: Infinity,
			prefix   : [CARRY, CARRY]
		}),

		miners: {

			default: new CreepSetup(Roles.drone, {
				pattern  : [WORK, WORK, CARRY, MOVE],
				sizeLimit: 3,
			}),

			standard: new CreepSetup(Roles.drone, {
				pattern  : [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, WORK],
				sizeLimit: 1,
			}),

			standardCPU: new CreepSetup(Roles.drone, {
				pattern  : [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, WORK],
				sizeLimit: 1,
			}),

			linkOptimized: new CreepSetup(Roles.drone, {
				pattern  : [WORK, WORK, WORK, CARRY, MOVE, MOVE, WORK],
				sizeLimit: 4,
			}),

			emergency: new CreepSetup(Roles.drone, {
				pattern  : [WORK, WORK, CARRY, MOVE],
				sizeLimit: 1,
			}),

			double: new CreepSetup(Roles.drone, {
				pattern  : [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
				sizeLimit: 2,
			}),

			sourceKeeper: new CreepSetup(Roles.drone, {
				pattern  : [WORK, WORK, CARRY, MOVE],
				sizeLimit: 5,
			})
		}
	},

	fillers: {
		first: new CreepSetup(Roles.filler, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: 1,
		}),
		second: new CreepSetup(Roles.filler, {
			pattern  : [CARRY, MOVE],
			sizeLimit: 3,
		}),
		third: new CreepSetup(Roles.filler, {
			pattern  : [CARRY, MOVE],
			sizeLimit: 6,
		}),
	},

	infestors: {

		claim: new CreepSetup(Roles.claim, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 1
		}),

		fastClaim: new CreepSetup(Roles.claim, {
			pattern  : [MOVE, MOVE, MOVE, MOVE, CLAIM, MOVE],
			sizeLimit: 1
		}),

		reserve: new CreepSetup(Roles.claim, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 4,
		}),

		controllerAttacker: new CreepSetup(Roles.claim, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: Infinity,
		}),

	},

	pioneer: new CreepSetup(Roles.pioneer, {
		pattern  : [WORK, CARRY, MOVE, MOVE],
		sizeLimit: Infinity,
	}),


	managers: {

		default: new CreepSetup(Roles.manager, {
			pattern  : [CARRY, CARRY, CARRY, CARRY, MOVE],
			sizeLimit: 3,
		}),

		twoPart: new CreepSetup(Roles.manager, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: 8,
		}),

		stationary: new CreepSetup(Roles.manager, {
			pattern  : [CARRY, CARRY],
			sizeLimit: 16,
		}),

		stationary_work: new CreepSetup(Roles.manager, {
			pattern  : [WORK, WORK, WORK, WORK, CARRY, CARRY],
			sizeLimit: 8,
		}),

	},

	queens: {

		default: new CreepSetup(Roles.queen, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		early: new CreepSetup(Roles.queen, {
			pattern  : [CARRY, MOVE],
			sizeLimit: Infinity,
		}),

	},

	scout: new CreepSetup(Roles.scout, {
		pattern  : [MOVE],
		sizeLimit: 1,
	}),

	transporters: {

		default: new CreepSetup(Roles.transport, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		early: new CreepSetup(Roles.transport, {
			pattern  : [CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		boosted: new CarrierSetup({boosted: true}),

	},

	workers: {
		// TODO: implement inhouse workers to reinforce bunker
		inhouse: new CreepSetup(Roles.worker, {
			pattern  : [WORK, WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		default: new CreepSetup(Roles.worker, {
			pattern  : [WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		early: new CreepSetup(Roles.worker, {
			pattern  : [WORK, CARRY, MOVE, MOVE],
			sizeLimit: Infinity,
		}),

	},

	upgraders: {

		default: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		rcl8: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: 5,
		}),

		rcl8_boosted: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: 5,
		}, ['upgrade']),

		remote: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: Infinity,
		}),

		remote_boosted: new RemoteUpgraderSetup({boosted: true}),

	},

	roomPoisoner: new CreepSetup(Roles.roomPoisoner, {
		pattern  : [WORK, CARRY, MOVE, MOVE],
		sizeLimit: 4,
	}),

	praisers: {

		default: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

	}

};


/**
 * This object contains default body setups for various types of combat-related creeps
 */
export const CombatSetups = {

	/**
	 * Zerglings are melee-only creeps (with exception of sourceKeeper setup)
	 */
	zerglings: {

		// default: new CreepSetup(Roles.melee, {
		// 	pattern  : [ATTACK, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// limitedDefault: new CreepSetup(Roles.melee, {
		// 	pattern  : [ATTACK, MOVE],
		// 	sizeLimit: 5,
		// }),
		//
		// armored: new CreepSetup(Roles.melee, {
		// 	pattern  : [TOUGH, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3_defense: new CreepSetup(Roles.melee, {
		// 	pattern  : [TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3: new CreepSetup(Roles.melee, {
		// 	pattern  : [TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3_armor: new CreepSetup(Roles.melee, {
		// 	pattern  : [TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3_strongArmor: new CreepSetup(Roles.melee, {
		// 	pattern  : [TOUGH, TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),

		default: new ZerglingSetup(),

		healing: new ZerglingSetup({healing: true}),

		boosted: {
			default       : new ZerglingSetup({boosted: true}),
			armored       : new ZerglingSetup({boosted: true, armored: true}),
			armoredHealing: new ZerglingSetup({boosted: true, armored: true, healing: true}),
		},


		sourceKeeper: new CreepSetup(Roles.melee, {
			pattern  : [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, HEAL, MOVE],
			sizeLimit: Infinity,
		}),

	},

	/**
	 * Hydralisks are ranged creeps which may have a small amount of healing
	 */
	hydralisks: {

		default: new HydraliskSetup(),

		noHeal: new HydraliskSetup({healing: false}),

		boosted: {
			default: new HydraliskSetup({boosted: true}),
			armored: new HydraliskSetup({boosted: true, armored: true}),
			noHeal : new HydraliskSetup({boosted: true, healing: false}),
		},


		// early: new CreepSetup(Roles.ranged, {
		// 	pattern  : [RANGED_ATTACK, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// distraction: new CreepSetup(Roles.ranged, {
		// 	pattern  : [MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, MOVE],
		// 	sizeLimit: 1,
		// }),
		//
		// default: new CreepSetup(Roles.ranged, {
		// 	pattern  : [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, HEAL],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3: new CreepSetup(Roles.ranged, {
		// 	pattern  : [TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE,
		// 				MOVE, HEAL, HEAL, HEAL],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3_old: new CreepSetup(Roles.ranged, {
		// 	pattern  : [TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
		// 				MOVE, MOVE, HEAL, HEAL],
		// 	sizeLimit: Infinity,
		// }),
		//
		// siege: new CreepSetup(Roles.ranged, {
		// 	pattern  : [RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL],
		// 	sizeLimit: Infinity,
		// }),
		//
		// siege_T3: new CreepSetup(Roles.ranged, {
		// 	pattern  : [TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
		// 				MOVE, MOVE, HEAL, HEAL],
		// 	sizeLimit: Infinity,
		// }),

		sourceKeeper: new CreepSetup(Roles.ranged, {
			pattern  : [MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, MOVE],
			sizeLimit: Infinity,
		}),

	},

	/**
	 * Healers (transfusers) are creeps which only do healing
	 */
	transfusers: {

		default: new TransfuserSetup(),

		boosted: {
			default: new TransfuserSetup({boosted: true}),
			armored: new TransfuserSetup({boosted: true, armored: true}),
		}

		// default: new CreepSetup(Roles.healer, {
		// 	pattern  : [HEAL, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// armored: new CreepSetup(Roles.healer, {
		// 	pattern  : [TOUGH, HEAL, HEAL, HEAL, MOVE, MOVE, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3: new CreepSetup(Roles.healer, {
		// 	pattern  : [TOUGH, TOUGH, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),

	},

	/**
	 * Broodlings are primarily melee creeps which may have a small amount of healing
	 */
	broodlings: {

		early: new CreepSetup(Roles.guardMelee, {
			pattern  : [ATTACK, MOVE],
			sizeLimit: Infinity,
		}),

		default: new CreepSetup(Roles.guardMelee, {
			pattern  : [ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL],
			sizeLimit: Infinity,
		}),

	},

	/**
	 * Pure melee raw power creeps that should never leave the bunker. These are the final guards for a room
	 */
	bunkerDefender: {

		default: new RavagerSetup(),

		boosted: new RavagerSetup({boosted: true}),
		// early: new CreepSetup(Roles.bunkerDefender, {
		// 	pattern  : [ATTACK, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// default: new CreepSetup(Roles.bunkerDefender, {
		// 	pattern  : [ATTACK, ATTACK, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// tiny: new CreepSetup(Roles.bunkerDefender, {
		// 	pattern  : [ATTACK, ATTACK, MOVE, MOVE],
		// 	sizeLimit: 2,
		// }),
		//
		// halfMove: new CreepSetup(Roles.bunkerDefender, {
		// 	pattern  : [ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		// 	sizeLimit: Infinity,
		// }),
		//
		// boosted_T3: new CreepSetup(Roles.bunkerDefender, {
		// 	// 22 ATTACK, 3 MOVE times 2
		// 	pattern  : [ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
		// 				ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),

	},

	/**
	 * Dismantlers (lurkers) are creeps with work parts for dismantle sieges
	 */
	dismantlers: {

		default: new CreepSetup(Roles.dismantler, {
			pattern  : [WORK, MOVE],
			sizeLimit: Infinity,
		}),

		attackDismantlers: new CreepSetup(Roles.dismantler, {
			pattern  : [ATTACK, MOVE],
			sizeLimit: Infinity,
		}),

		armored: new CreepSetup(Roles.dismantler, {
			pattern  : [TOUGH, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: Infinity,
		}),

		boosted_armored_T3: new CreepSetup(Roles.dismantler, {
			pattern  : [TOUGH, TOUGH, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE],
			sizeLimit: Infinity,
		}),

		// boosted_T3: new CreepSetup(Roles.dismantler, {
		// 	pattern  : [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE],
		// 	sizeLimit: Infinity,
		// }),

	},

	distractors: {
		ranged: new CreepSetup(Roles.rangedDistractor, {
			pattern  : [MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, MOVE],
			sizeLimit: 1,
		}),
	},

	drill: {
		default: new CreepSetup(Roles.drill, {
			pattern  : [MOVE, ATTACK, ATTACK, MOVE],
			sizeLimit: Infinity,
		}),
	},

	coolant: {
		default: new CreepSetup(Roles.coolant, {
			pattern  : [HEAL, MOVE],
			sizeLimit: Infinity,
		}),
		small  : new CreepSetup(Roles.coolant, {
			pattern  : [HEAL, MOVE],
			sizeLimit: 16,
		}),
	},

	strongholdKiller: {
		// SK deal 200 RA, gotta avoid, levels

		1: new CreepSetup(Roles.strongholdKiller, {
			// 180 damage after tough so 2 tough, 4 healing, 34 RA
			pattern  : [TOUGH, TOUGH,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						HEAL, HEAL, HEAL, HEAL,
						MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: 1,
		}),

		2: new CreepSetup(Roles.strongholdKiller, {
			// 360 damage after tough so 4 tough, 8 healing, 28 RA
			pattern  : [TOUGH, TOUGH, TOUGH, TOUGH,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
						MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: 1,
		}),

		3: new CreepSetup(Roles.strongholdKiller, {
			// 540 damage after tough so 6 tough, 12 healing, 22 RA
			pattern  : [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK,
						HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
						MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: 1,
		}),

		4: new CreepSetup(Roles.strongholdKiller, {
			// 720 damage after tough so 8 tough, 15 healing, 17RA - 15*250+17*150+50*11 = 6.8k
			pattern  : [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
						HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
						MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: 1,
		}),
	}

};
