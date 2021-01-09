
//
// ___________________________________________________________
//
//  _____  _    _ _______  ______ _______ _____ __   _ ______
// |     |  \  /  |______ |_____/ |  |  |   |   | \  | |     \
// |_____|   \/   |______ |    \_ |  |  | __|__ |  \_| |_____/
//
// _______________________ Screeps AI ________________________
//
//
// Overmind repository: github.com/bencbartlett/overmind
//


// @formatter:off
/* tslint:disable:ordered-imports */

'use strict';
global.PHASE = 'assimilating';
global.LATEST_BUILD_TICK = Game.time;
// Import ALL the things! ==============================================================================================
import './assimilation/initializer'; // This must always be imported before anything else
import './console/globals'; // Global functions accessible from CLI
import './prototypes/Game'; // Game prototypes
import './prototypes/Creep'; // Creep prototypes
import './prototypes/PowerCreep'; // PowerCreep prototypes
import './prototypes/RoomObject'; // RoomObject and targeting prototypes
import './prototypes/RoomPosition'; // RoomPosition prototypes
import './prototypes/RoomVisual'; // Prototypes used in Visualizer class
import './prototypes/Room'; // Non-structure room prototypes
import './prototypes/RoomStructures'; // IVM-cached structure prototypes
import './prototypes/Structures'; // Prototypes for accessed structures
import './prototypes/Miscellaneous'; // Everything else
import './tasks/initializer'; // This line is necessary to ensure proper compilation ordering...
import './zerg/CombatZerg'; // ...so is this one... rollup is dumb about generating reference errors
import {MUON, MY_USERNAME, RL_TRAINING_MODE, USE_SCREEPS_PROFILER} from './~settings';
import {sandbox} from './utilities/sandbox';
import {Mem} from './memory/Memory';
import {OvermindConsole} from './console/Console';
import {Stats} from './stats/stats';
import profiler from './profiler/screeps-profiler';
import _Overmind from './Overmind_obfuscated'; // this should be './Overmind_obfuscated' unless you are me
import {VersionMigration} from './versionMigration/migrator';
import {RemoteDebugger} from './debug/remoteDebugger';
import {ActionParser} from './reinforcementLearning/actionParser';
// =====================================================================================================================

// Main loop
function main(): void {
	// Memory operations: load and clean memory, suspend operation as needed -------------------------------------------
	Mem.load();									// Load previous parsed memory if present
	if (!Mem.shouldRun()) return;				// Suspend operation if necessary
	Mem.clean();								// Clean memory contents

	// Instantiation operations: build or refresh the game state -------------------------------------------------------
	if (!Overmind || Overmind.shouldBuild || Game.time >= Overmind.expiration) {
		PHASE = 'build';
		delete global.Overmind;					// Explicitly delete the old Overmind object
		Mem.garbageCollect(true);			// Run quick garbage collection
		global.Overmind = new _Overmind();		// Instantiate the Overmind object
		Overmind.build();						// Build phase: instantiate all game components
		LATEST_BUILD_TICK = Game.time;			// Record this tick as having a build reset
	} else {
		PHASE = 'refresh';
		Overmind.refresh();						// Refresh phase: update the Overmind state
	}

	// Tick loop cycle: initialize and run each component --------------------------------------------------------------
	PHASE = 'init';
	Overmind.init();							// Init phase: spawning and energy requests
	PHASE = 'run';
	Overmind.run();								// Run phase: execute state-changing actions
	PHASE = 'postRun';
	Overmind.visuals(); 						// Draw visuals
	Stats.run(); 								// Record statistics
	Memory.tick++;								// Record successful tick

	// Post-run code: handle sandbox code and error catching -----------------------------------------------------------
	sandbox();									// Sandbox: run any testing code
	global.remoteDebugger.run();				// Run remote debugger code if enabled
	Overmind.postRun();							// Throw errors at end of tick; anything after here might not get run
}

// Main loop if RL mode is enabled (~settings.ts)
function main_RL(): void {
	Mem.clean();

	delete global.Overmind;
	global.Overmind = new _Overmind();

	ActionParser.run();
}

// This gets run on each global reset
function onGlobalReset(): void {
	global.LATEST_GLOBAL_RESET_TICK = Game.time;
	global.LATEST_GLOBAL_RESET_DATE = new Date();
	if (USE_SCREEPS_PROFILER) profiler.enable();
	Mem.format();
	OvermindConsole.init();
	VersionMigration.run();
	if (!Memory.stats.persistent) {
		Memory.stats.persistent = {};
	}
	Memory.stats.persistent.lastGlobalReset = Game.time;
	OvermindConsole.printUpdateMessage();
	// Update the master ledger of valid checksums
	if (MY_USERNAME == MUON) {
		Assimilator.updateValidChecksumLedger();
	}
	// Make a new Overmind object
	global.Overmind = new _Overmind();
	// Make a remote debugger
	global.remoteDebugger = new RemoteDebugger();
}


// Global reset function if RL mode is enabled
function onGlobalReset_RL(): void {
	Mem.format();
}

// Decide which loop to export as the script loop
let _loop: () => void;
if (RL_TRAINING_MODE) {
	// Use stripped version for training reinforcment learning model
	_loop = main_RL;
} else {
	if (USE_SCREEPS_PROFILER) {
		// Wrap the main loop in the profiler
		_loop = () => profiler.wrap(main);
	} else {
		// Use the default main loop
		_loop = main;
	}
}

export const loop = _loop;

// Run the appropriate global reset function
if (RL_TRAINING_MODE) {
	OvermindConsole.printTrainingMessage();
	onGlobalReset_RL();
} else {
	// Register these functions for checksum computations with the Assimilator
	Assimilator.validate(main);
	Assimilator.validate(loop);
	// Run the global reset code
	onGlobalReset();
}


