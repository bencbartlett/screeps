interface Creep {
	hitsPredicted?: number;
	intel?: { [property: string]: number };
	memory: CreepMemory;
	boosts: ResourceConstant[];
	boostCounts: { [boostType: string]: number };
	inRampart: boolean;
	approxMoveSpeed: number;
	bodypartCounts: { [bodypart in BodyPartConstant]: number };
	isPlayer: true;
}

interface PowerCreep {
	hitsPredicted?: number;
	intel?: { [property: string]: number };
	memory: CreepMemory;
	inRampart: boolean;
	withdraw(target: Structure | Tombstone | Ruin, resourceType: ResourceConstant, amount?: number): ScreepsReturnCode;
}

interface CostMatrix {
	_bits: Uint8Array;
}

interface ConstructionSite {
	isWalkable: boolean;
}

interface Flag {

}

type Sink = StructureSpawn |
	StructureExtension |
	StructureLab |
	StructurePowerSpawn |
	StructureNuker |
	StructureTower;

type StorageUnit = StructureContainer | StructureTerminal | StructureStorage;

type rechargeObjectType = StructureStorage
	| StructureTerminal
	| StructureContainer
	| StructureLink
	| Tombstone
	| Ruin
	| Resource;

interface Room {

	print: string;

	my: boolean;

	isColony: boolean;
	isOutpost: boolean;

	owner: string | undefined;
	reservedByMe: boolean;
	signedByMe: boolean;

	creeps: Creep[];
	hostiles: Creep[];
	friendlies: Creep[];
	invaders: Creep[];
	sourceKeepers: Creep[];
	dangerousHostiles: Creep[];
	playerHostiles: Creep[];
	dangerousPlayerHostiles: Creep[];

	// Populated and tracked by RoomIntel
	isSafe: boolean;
	threatLevel: number;
	instantaneousThreatLevel: 0 | 0.5 | 1;

	fleeDefaults: HasPos[];

	structures: Structure[];
	hostileStructures: Structure[];

	flags: Flag[];

	// Cached structures
	tombstones: Tombstone[];
	drops: { [resourceType: string]: Resource[] };
	droppedEnergy: Resource[];
	droppedPower: Resource[];

	// Room structures
	_refreshStructureCache(): void;

	// Multiple structures
	spawns: StructureSpawn[];
	extensions: StructureExtension[];
	roads: StructureRoad[];
	walls: StructureWall[];
	constructedWalls: StructureWall[];
	ramparts: StructureRampart[];
	walkableRamparts: StructureRampart[];
	barriers: (StructureWall | StructureRampart)[];
	storageUnits: StorageUnit[];
	keeperLairs: StructureKeeperLair[];
	portals: StructurePortal[];
	links: StructureLink[];
	towers: StructureTower[];
	labs: StructureLab[];
	containers: StructureContainer[];
	powerBanks: StructurePowerBank[];

	// Single structures
	observer: StructureObserver | undefined;
	powerSpawn: StructurePowerSpawn | undefined;
	factory: StructureFactory | undefined;
	invaderCore: StructureInvaderCore | undefined;
	extractor: StructureExtractor | undefined;
	nuker: StructureNuker | undefined;
	repairables: Structure[];
	rechargeables: rechargeObjectType[];
	sources: Source[];
	mineral: Mineral | undefined;
	constructionSites: ConstructionSite[];
	allConstructionSites: ConstructionSite[];
	hostileConstructionSites: ConstructionSite[];
	ruins: Ruin[];

	// Used by movement library
	// _defaultMatrix: CostMatrix;
	// _directMatrix: CostMatrix;
	// _creepMatrix: CostMatrix;
	// _priorityMatrices: { [priority: number]: CostMatrix };
	// _skMatrix: CostMatrix;
	_kitingMatrix: CostMatrix;
}

interface RoomObject {
	ref: string;
	targetedBy: string[];

	serialize(): ProtoRoomObject;
}

interface RoomPosition {
	print: string;
	printPlain: string;
	room: Room | undefined;
	readableName: string;
	// coordName: string;
	isEdge: boolean;
	isVisible: boolean;
	rangeToEdge: number;
	roomCoords: Coord;
	neighbors: RoomPosition[];

	toCoord(): Coord;

	inRangeToPos(pos: RoomPosition, range: number): boolean;

	inRangeToXY(x: number, y: number, range: number): boolean;

	getRangeToXY(x: number, y: number): number;

	getPositionsAtRange(range: number, includeWalls?: boolean, includeEdges?: boolean): RoomPosition[];

	getPositionsInRange(range: number, includeWalls?: boolean, includeEdges?: boolean): RoomPosition[];

	getOffsetPos(dx: number, dy: number): RoomPosition;

	lookFor<T extends keyof AllLookAtTypes>(structureType: T): Array<AllLookAtTypes[T]>;

	lookForStructure(structureType: StructureConstant): Structure | undefined;

	isWalkable(ignoreCreeps?: boolean): boolean;

	availableNeighbors(ignoreCreeps?: boolean): RoomPosition[];

	getPositionAtDirection(direction: DirectionConstant, range?: number): RoomPosition;

	getMultiRoomRangeTo(pos: RoomPosition): number;

	findClosestByLimitedRange<T>(objects: T[] | RoomPosition[], rangeLimit: number,
								 opts?: { filter: any | string; }): T | undefined;

	findClosestByMultiRoomRange<T extends _HasRoomPosition>(objects: T[]): T | undefined;

	findClosestByRangeThenPath<T extends _HasRoomPosition>(objects: T[]): T | undefined;
}

interface RoomVisual {
	box(x: number, y: number, w: number, h: number, style?: LineStyle): RoomVisual;

	infoBox(info: string[], x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	multitext(textLines: string[], x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	structure(x: number, y: number, type: string, opts?: { [option: string]: any }): RoomVisual;

	connectRoads(opts?: { [option: string]: any }): RoomVisual | void;

	speech(text: string, x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	animatedPosition(x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	resource(type: ResourceConstant, x: number, y: number, size?: number, opacity?: number): number;

	_fluid(type: string, x: number, y: number, size?: number, opacity?: number): void;

	_mineral(type: string, x: number, y: number, size?: number, opacity?: number): void;

	_compound(type: string, x: number, y: number, size?: number, opacity?: number): void;

	test(): RoomVisual;
}

interface OwnedStructure {
	_isActive(): boolean;
}

interface Structure {
	isWalkable: boolean;
}

interface StructureContainer {
	energy: number;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureController {
	reservedByMe: boolean;
	signedByMe: boolean;
	signedByScreeps: boolean;

	needsReserving(reserveBuffer: number): boolean;
}

interface StructureExtension {
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureLink {
	isFull: boolean;
	isEmpty: boolean;
	storeCapacity: number;
}

interface StructureStorage {
	energy: number;
	isFull: boolean;
	isEmpty: boolean;
}

interface StoreBase {
	contents: [ResourceConstant, number][];
}

interface StructureSpawn {
	isFull: boolean;
	isEmpty: boolean;

	cost(bodyArray: string[]): number;
}

interface StructureTerminal {
	energy: any;
	isFull: boolean;
	isEmpty: boolean;
	isReady: boolean;
	hasReceived: boolean;
}

interface StructureTower {
	isFull: boolean;
	isEmpty: boolean;

	// run(): void;
	//
	// attackNearestEnemy(): number;
	//
	// healNearestAlly(): number;
	//
	// repairNearestStructure(): number;
	//
	// preventRampartDecay(): number;
}



interface String {
	padRight(length: number, char?: string): string;

	padLeft(length: number, char?: string): string;
}

interface Number {
	toPercent(decimals?: number): string;

	truncate(decimals: number): number;
}
