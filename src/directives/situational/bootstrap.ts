import {Colony, ColonyStage} from '../../Colony';
import {log} from '../../console/log';
import {Roles} from '../../creepSetups/setups';
import {BootstrappingOverlord} from '../../overlords/situational/bootstrap';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';

/**
 * Bootstrapping directive: recover from a colony-wide crash or bootstrap from initial spawn-in
 */
@profile
export class DirectiveBootstrap extends Directive {

	static directiveName = 'bootstrap';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_ORANGE;

	colony: Colony; 					// Emergency flag definitely has a colony
	room: Room;							// Definitely has a room
	private needsMiner: boolean;		// Whether a miner needs to be spawned
	private needsManager: boolean;		// Whether a manager needs to be spawned
	private needsQueen: boolean;		// Whether a supplier needs to be spawned

	constructor(flag: Flag) {
		super(flag);
		this.refresh(); // data needs to be recomputed each tick
	}

	refresh() {
		super.refresh();
		this.colony.state.bootstrapping = true;
		this.needsMiner = (this.colony.getCreepsByRole(Roles.drone).length == 0);
		this.needsManager = (this.colony.commandCenter != undefined &&
							 this.colony.commandCenter.overlord != undefined &&
							 this.colony.commandCenter.link != undefined &&
							 this.colony.getCreepsByRole(Roles.manager).length == 0);
		this.needsQueen = (this.colony.getCreepsByRole(Roles.queen).length == 0);
	}

	spawnMoarOverlords() {
		this.overlords.bootstrap = new BootstrappingOverlord(this);
	}

	init(): void {
		this.alert(`Colony in bootstrap mode!`, NotifierPriority.High);
		if (Game.time % 100 == 0) {
			log.alert(`Colony ${this.room.print} is in emergency recovery mode.`);
		}
	}

	run(): void {
		if (!this.needsQueen && !this.needsMiner) {
			if (this.colony.storage && this.colony.assets.energy < 5000) {
				return; // wait a little while at higher levels before stopping bootstrapping
			}
			log.alert(`Colony ${this.room.print} has recovered from crash; removing bootstrap directive.`);
			// Suicide any fillers so they don't get in the way
			const overlord = this.overlords.bootstrap as BootstrappingOverlord;
			const queenOverlord = this.colony.hatchery && this.colony.hatchery.overlord;
			for (const filler of overlord.fillers) {
				if (queenOverlord && this.colony.stage == ColonyStage.Larva) {
					filler.reassign(queenOverlord, Roles.queen, false);
				} else {
					filler.suicide();
				}
			}
			// Remove the directive
			this.remove();
		}
	}
}
