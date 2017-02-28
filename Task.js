// Base class for creep tasks. Refactors creep_goTask implementation and is designed to be more extensible
class Task {
    constructor(taskName) {
        // Parameters for the task
        this.name = taskName; // name of task
        this.creepName = null; // name of creep assigned to task
        this.targetID = null; // id or name of target task is aimed at
        this.maxPerTarget = Infinity; // maximum number of creeps that can be assigned to a given target
        this.maxPerTask = Infinity; // maximum number of creeps that can be doing this task at once
        this.targetRange = 1; // range you need to be at to execute the task
        this.moveColor = '#fff';
        this.data = {
            quiet: true // suppress console logging
        };
    }

    // Getter/setter for task.creep
    get creep() { // Get task's own creep by its name
        if (this.creepName != null) {
            return Game.creeps[this.creepName];
        } else {
            console.log(this.name + ": creep is null!");
            return null;
        }
    }

    set creep(creep) {
        this.creepName = creep.name;
    }

    // Getter/setter for task.target
    get target() {
        if (this.targetID != null) { // Get task's own target by its ID or name
            return Game.getObjectById(this.targetID) || Game.spawns[this.targetID] || Game.flags[this.targetID];
        } else {
            console.log(this.name + ": target is null!");
            return null;
        }
    }

    set target(target) {
        this.targetID = target.id || target.name || null;
    }

    // Assign the task to a creep
    assign(creep, target = null) {
        // register references to creep and target
        this.creep = creep;
        this.target = target;
        creep.memory.task = this;
        this.onAssignment();
        return this.name;
    }

    // Action to do on assignment
    onAssignment() {
        // override if needed
        var creep = this.creep;
        if (this.data.quiet == false) {
            creep.log("assigned to " + this.name + " " + this.target + ".");
        }
        creep.say(this.name);
    }

    // Test every tick to see if task is still valid
    isValidTask() { // needs to be overwritten in task instance
        return true;
    }

    // Test every tick to see if target is still valid
    isValidTarget() { // needs to be overwritten in task instance
        return (this.target != null);
    }

    move() {
        this.creep.moveToVisual(this.target, this.moveColor);
    }

    // Execute this task each tick. Returns nothing unless work is done.
    step() {
        var creep = this.creep;
        var target = this.target;
        if (!target) {
            this.creep.log('null target!');
            return null; // in case you're targeting something that just became invisible
        }
        if (creep.pos.inRangeTo(target, this.targetRange)) {
            var workResult = this.work();
            if (workResult != OK && this.data.quiet == false) {
                creep.log("Error executing " + this.name + ", returned " + workResult);
            }
            return workResult;
        } else {
            creep.repairNearbyDamagedRoad(); // repair roads if you are capable
            this.move();
        }
    }

    // Task to perform when at the target
    work() {
        console.log("Error: Task.work() must be overwritten.");
        return ERR_INVALID_ARGS; // needs override
    }
}


module.exports = Task;