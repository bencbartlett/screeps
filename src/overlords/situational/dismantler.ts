import {log} from '../../console/log';
import {CombatSetups, Roles, Setups} from '../../creepSetups/setups';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import {DirectiveModularDismantle} from "../../directives/targeting/modularDismantle";

/**
 * Spawns special-purpose dismantlers for transporting resources to/from a specified target
 */
@profile
export class DismantleOverlord extends Overlord {

	dismantlers: Zerg[];
	directive: DirectiveModularDismantle;
	target?: Structure;

	requiredRCL: 4;

	constructor(directive: DirectiveModularDismantle, target?: Structure, priority = OverlordPriority.tasks.dismantle) {
		super(directive, 'dismantle', priority);
		this.directive = directive;
		//this.target = target || Game.getObjectById(this.directive.memory.targetId) || undefined;
		this.dismantlers = this.zerg(Roles.dismantler);
	}

	init() {
		// Spawn a number of dismantlers, up to a max
		const MAX_DISMANTLERS = 4;
		let setup;
		if (!!this.directive.memory.attackInsteadOfDismantle) {
			setup = CombatSetups.dismantlers.attackDismantlers;
		} else {
			setup = CombatSetups.dismantlers.default;
		}
		const dismantlingParts = setup.getBodyPotential(!!this.directive.memory.attackInsteadOfDismantle ? ATTACK : WORK, this.colony);
		const dismantlingPower = dismantlingParts * (!!this.directive.memory.attackInsteadOfDismantle ? ATTACK_POWER : DISMANTLE_POWER);
		// Calculate total needed amount of dismantling power as (resource amount * trip distance)
		const tripDistance = Pathing.distance((this.colony).pos, this.directive.pos);
		const dismantleLifetimePower = (CREEP_LIFE_TIME-tripDistance)*dismantlingPower;
		// Calculate number of dismantlers
		if (this.directive.room && this.target && ! this.directive.memory.numberSpots) {
			this.directive.getDismantleSpots(this.target.pos);
		}
		const nearbySpots = this.directive.memory.numberSpots != undefined ? this.directive.memory.numberSpots : 1;

		// needs to be reachable spots
		const dismantleNeeded = Math.ceil((this.target ? this.target.hits : 50000) / dismantleLifetimePower);
		const numDismantlers = Math.min(nearbySpots, MAX_DISMANTLERS, dismantleNeeded);
		// Request the dismantlers
		this.wishlist(numDismantlers, setup);
	}

	private runDismantler(dismantler: Zerg) {
		if (!dismantler.inSameRoomAs(this.directive)) {
			let goal = this.target || this.directive;
			dismantler.goTo(goal, {avoidSK: true});
		} else {
			if (!this.target) {
				this.target = Game.getObjectById(this.directive.memory.targetId) || this.directive.getTarget();
				if (!this.target) {
					log.error(`No target found for ${this.directive.print}`);
				}
			} else {
				let res = !!this.directive.memory.attackInsteadOfDismantle ? dismantler.attack(this.target) : dismantler.dismantle(this.target);
				if (res == ERR_NOT_IN_RANGE) {
					let ret = dismantler.goTo(this.target);
					// TODO this is shit ⬇
				} else if (res == ERR_NO_BODYPART) {
					//dismantler.suicide();
				}
			}
		}
	}

	run() {
		this.reassignIdleCreeps(Roles.dismantler);
		for (const dismantler of this.dismantlers) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (dismantler.hasValidTask) {
				dismantler.run();
			} else {
				if (dismantler.needsBoosts) {
					this.handleBoosting(dismantler);
				} else {
					this.runDismantler(dismantler);
				}
			}
		}
		for (const dismantler of this.dismantlers) {
			this.runDismantler(dismantler);
		}
	}
}
