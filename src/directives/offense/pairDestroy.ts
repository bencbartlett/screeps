import {log} from '../../console/log';
import {CombatIntel} from '../../intel/CombatIntel';
import {PairDestroyerOverlord} from '../../overlords/offense/pairDestroyer';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';
import {DistractionOverlord} from "../../overlords/defense/distraction";


interface DirectivePairDestroyMemory extends FlagMemory {
	persistent?: boolean;
}

/**
 * Spawns a pair of attacker/healer creeps to siege a room
 */
@profile
export class DirectivePairDestroy extends Directive {

	static directiveName = 'destroy';
	static color = COLOR_RED;
	static secondaryColor = COLOR_CYAN;

	specialRooms: ['W16N53'];

	overlords: {
		destroy: PairDestroyerOverlord;
		distraction: DistractionOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.destroy = new PairDestroyerOverlord(this);
	}

	init(): void {
		this.alert(`Pair destroyer directive active`);
	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0 && this.room.controller
			&& this.room.name != 'W18N48' && this.room.name != 'W17N47' && this.room.name != 'W16N53' && this.room.name != 'W16N54') {
			log.notify(`Pair destroyer mission at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
		const fallback = CombatIntel.getFallbackFrom(this.pos);
		Visualizer.marker(fallback, {color: 'green'});
	}
}
