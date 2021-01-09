import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {isResource} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {maxBy, minMax} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Task} from '../Task';
import {TaskHarvest} from './harvest';
import {pickupTaskName, TaskPickup} from './pickup';
import {TaskWithdraw, withdrawTaskName} from './withdraw';

export type rechargeTargetType = null;
export const rechargeTaskName = 'recharge';

// This is a "dispenser task" which is not itself a valid task, but dispenses a task when assigned to a creep.

@profile
export class TaskRecharge extends Task {
	target: rechargeTargetType;

	data: {
		minEnergy: number;
	};

	constructor(target: rechargeTargetType, minEnergy = 0, options = {} as TaskOptions) {
		super(rechargeTaskName, {ref: '', pos: {x: -1, y: -1, roomName: ''}}, options);
		this.data.minEnergy = minEnergy;
	}

	private rechargeRateForCreep(creep: Zerg, obj: rechargeObjectType): number | false {
		if (creep.colony && creep.colony.hatchery && creep.colony.hatchery.battery
			&& obj.id == creep.colony.hatchery.battery.id && creep.roleName != 'queen') {
			return false; // only queens can use the hatchery battery
		}
		let amount = isResource(obj) ? obj.amount : obj.store[RESOURCE_ENERGY];
		if (amount < this.data.minEnergy) {
			return false;
		}
		const otherTargeters = _.filter(_.map(obj.targetedBy, name => Overmind.zerg[name]),
										zerg => !!zerg && zerg.memory._task
												&& (zerg.memory._task.name == withdrawTaskName
													|| zerg.memory._task.name == pickupTaskName));
		const resourceOutflux = _.sum(_.map(otherTargeters,
											other => other.carryCapacity - _.sum(other.carry)));
		amount = minMax(amount - resourceOutflux, 0, creep.carryCapacity);
		const effectiveAmount = amount / (creep.pos.getMultiRoomRangeTo(obj.pos) + 1);
		if (effectiveAmount <= 0) {
			return false;
		} else {
			return effectiveAmount;
		}
	}

	// Override creep setter to dispense a valid recharge task
	set creep(creep: Zerg) {
		this._creep.name = creep.name;
		if (this._parent) {
			this.parent!.creep = creep;
		}
		// Choose the target to maximize your energy gain subject to other targeting workers
		const possibleTargets = creep.colony && creep.inColonyRoom ? creep.colony.rechargeables
																   : creep.room.rechargeables;

		const target = maxBy(possibleTargets, o => this.rechargeRateForCreep(creep, o));
		if (!target || creep.pos.getMultiRoomRangeTo(target.pos) > 40) {
			// workers shouldn't harvest; let drones do it (disabling this check can destabilize early economy)
			const canHarvest = creep.getActiveBodyparts(WORK) > 0 && creep.roleName != 'worker';
			if (canHarvest) {

				const colony: Colony | undefined = Overmind.colonies[creep.room.name];
				let potentialSources: Source[] = creep.room.sources;
				if (colony) {
					potentialSources = colony.sources;
				}

				// Harvest from a source if there is no recharge target available
				const availableSources = _.filter(potentialSources, function(source) {
					const filledSource = source.energy > 0 || source.ticksToRegeneration < 20;
					// Only harvest from sources which aren't surrounded by creeps excluding yourself
					const isSurrounded = source.pos.availableNeighbors(false).length == 0;
					return filledSource && (!isSurrounded || creep.pos.isNearTo(source));
				});
				const availableSource = creep.pos.findClosestByMultiRoomRange(availableSources);
				if (availableSource) {
					creep.task = new TaskHarvest(availableSource);
					return;
				}
			}
		}
		if (target) {
			if (isResource(target)) {
				creep.task = new TaskPickup(target);
				return;
			} else {
				creep.task = new TaskWithdraw(target);
				return;
			}
		} else {
			// if (creep.roleName == 'queen') {
			log.debug(`No valid withdraw target for ${creep.print}!`);
			// }
			creep.task = null;
		}
	}

	isValidTask() {
		return false;
	}

	isValidTarget() {
		return false;
	}

	work() {
		log.warning(`BAD RESULT: Should not get here...`);
		return ERR_INVALID_TARGET;
	}
}
