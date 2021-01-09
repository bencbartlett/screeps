import {MatrixLib} from '../matrix/MatrixLib';
import {profile} from '../profiler/decorator';
import {StructureLayout, StructureMap} from '../roomPlanner/RoomPlanner';
import {rgbToHex} from '../utilities/utils';
import {asciiLogo, logoComponents, logoText} from './logos';


const TEXT_COLOR = '#c9c9c9';
const TEXT_SIZE = .8;
const CHAR_WIDTH = TEXT_SIZE * 0.4;
const CHAR_HEIGHT = TEXT_SIZE * 0.9;

/**
 * The Visualizer contains many static methods for drawing room visuals and displaying information through a GUI
 */
@profile
export class Visualizer {

	static get enabled(): boolean {
		return Memory.settings.enableVisuals;
	}

	private static textStyle(size = 1, style: TextStyle = {}) {
		return _.defaults(style, {
			color  : TEXT_COLOR,
			align  : 'left',
			font   : `${size * TEXT_SIZE} Trebuchet MS`,
			opacity: 0.8,
		});
	}

	static circle(pos: RoomPosition, color = 'red', opts = {}): RoomVisual {
		_.defaults(opts, {
			fill   : color,
			radius : 0.35,
			opacity: 0.5,
		});
		return new RoomVisual(pos.roomName).circle(pos.x, pos.y, opts);
	}

	static rect(pos: RoomPosition, color = 'red', opts = {}): RoomVisual {
		_.defaults(opts, {
			fill   : color,
			opacity: 0.5,
		});
		return new RoomVisual(pos.roomName).rect(pos.x, pos.y, 1, 1, opts);
	}

	static marker(pos: RoomPosition, opts = {}): RoomVisual {
		return new RoomVisual(pos.roomName).animatedPosition(pos.x, pos.y, opts);
	}

	static annotate(text: string, pos: { x: number, y: number, roomName?: string }, roomName?: string) {
		const location = {x: pos.x, y: pos.y, roomName: pos.roomName || roomName};
		Visualizer.text(text, location, 0.6, {
			color: 'white',
			backgroundColor: 'black',
		});
	}

	static drawStructureMap(structureMap: StructureMap): void {
		if (!this.enabled) return;
		const vis: { [roomName: string]: RoomVisual } = {};
		for (const structureType in structureMap) {
			for (const pos of structureMap[structureType]) {
				if (!vis[pos.roomName]) {
					vis[pos.roomName] = new RoomVisual(pos.roomName);
				}
				vis[pos.roomName].structure(pos.x, pos.y, structureType);
			}
		}
		for (const roomName in vis) {
			vis[roomName].connectRoads();
		}
	}

	static drawLayout(layout: StructureLayout, anchor: RoomPosition, opts = {}): void {
		_.defaults(opts, {opacity: 0.5});
		if (!this.enabled) return;
		const vis = new RoomVisual(anchor.roomName);
		for (const structureType in layout[8]!.buildings) {
			for (const pos of layout[8]!.buildings[structureType].pos) {
				const dx = pos.x - layout.data.anchor.x;
				const dy = pos.y - layout.data.anchor.y;
				vis.structure(anchor.x + dx, anchor.y + dy, structureType, opts);
			}
		}
		vis.connectRoads(opts);
	}

	static drawRoads(positoins: RoomPosition[]): void {
		const pointsByRoom = _.groupBy(positoins, pos => pos.roomName);
		for (const roomName in pointsByRoom) {
			const vis = new RoomVisual(roomName);
			for (const pos of pointsByRoom[roomName]) {
				vis.structure(pos.x, pos.y, STRUCTURE_ROAD);
			}
			vis.connectRoads();
		}
	}

	static drawPath(path: RoomPosition[], style?: PolyStyle): void {
		const pointsByRoom = _.groupBy(path, pos => pos.roomName);
		for (const roomName in pointsByRoom) {
			new RoomVisual(roomName).poly(pointsByRoom[roomName], style);
		}
	}

	static displayCostMatrix(matrix: CostMatrix, roomName?: string,
							 opts = {dots: true, displayZero: true}): void {

		opts = _.defaults(opts, {dots: true, displayZero: true});

		const vis = new RoomVisual(roomName);
		let x, y, cost, percentOfMax: number;
		let color: string;

		const maxVal = MatrixLib.getMaxValue(matrix) + 1;

		if (opts.dots) {
			for (y = 0; y < 50; ++y) {
				for (x = 0; x < 50; ++x) {
					cost = matrix.get(x, y);
					if (cost > 0) {
						percentOfMax = Math.round(255 * cost / maxVal);
						color = rgbToHex(255, 255 - percentOfMax, 255 - percentOfMax);
						vis.circle(x, y, {radius: matrix.get(x, y) / maxVal / 2, fill: color});
					}
				}
			}
		} else {
			for (y = 0; y < 50; ++y) {
				for (x = 0; x < 50; ++x) {
					cost = matrix.get(x, y);
					if (opts.displayZero || cost != 0) {
						percentOfMax = Math.round(255 * cost / maxVal);
						color = rgbToHex(255, 255 - percentOfMax, 255 - percentOfMax);
						vis.text(matrix.get(x, y).toString(), x, y, {color: color});
					}
				}
			}
		}

	}

	static showInfo(info: string[], calledFrom: { room: Room | undefined, pos: RoomPosition }, opts = {}): RoomVisual {
		if (calledFrom.room) {
			return calledFrom.room.visual.infoBox(info, calledFrom.pos.x, calledFrom.pos.y, opts);
		} else {
			return new RoomVisual(calledFrom.pos.roomName).infoBox(info, calledFrom.pos.x, calledFrom.pos.y, opts);
		}
	}

	static section(title: string, pos: { x: number, y: number, roomName?: string }, width: number,
				   height: number): { x: number, y: number } {
		const vis = new RoomVisual(pos.roomName);
		vis.rect(pos.x, pos.y - CHAR_HEIGHT, width, 1.1 * CHAR_HEIGHT, {opacity: 0.15});
		vis.box(pos.x, pos.y - CHAR_HEIGHT, width, height + (1.1 + .25) * CHAR_HEIGHT, {color: TEXT_COLOR});
		vis.text(title, pos.x + .25, pos.y - .05, this.textStyle());
		return {x: pos.x + 0.25, y: pos.y + 1.1 * CHAR_HEIGHT};
	}

	static infoBox(header: string, content: string[] | string[][], pos: { x: number, y: number, roomName?: string },
				   width: number): number {
		// const vis = new RoomVisual(pos.roomName);
		// vis.rect(pos.x, pos.y - charHeight, width, 1.1 * charHeight, {opacity: 0.15});
		// vis.box(pos.x, pos.y - charHeight, width, ((content.length || 1) + 1.1 + .25) * charHeight,
		// 		{color: textColor});
		// vis.text(header, pos.x + .25, pos.y - .05, this.textStyle());
		const height = CHAR_HEIGHT * (content.length || 1);
		const {x, y} = this.section(header, pos, width, height);
		if (content.length > 0) {
			if (_.isArray(content[0])) {
				this.table(<string[][]>content, {
					x       : x,
					y       : y,
					roomName: pos.roomName
				});
			} else {
				this.multitext(<string[]>content, {
					x       : x,
					y       : y,
					roomName: pos.roomName
				});
			}
		}
		// return pos.y - charHeight + ((content.length || 1) + 1.1 + .25) * charHeight + 0.1;
		const spaceBuffer = 0.5;
		return y + height + spaceBuffer;
	}

	static text(text: string, pos: { x: number, y: number, roomName?: string }, size = 1, style: TextStyle = {}): void {
		new RoomVisual(pos.roomName).text(text, pos.x, pos.y, this.textStyle(size, style));
	}

	static barGraph(progress: number | [number, number], pos: { x: number, y: number, roomName?: string },
					width = 7, scale = 1): void {
		const vis = new RoomVisual(pos.roomName);
		let percent: number;
		let mode: 'percent' | 'fraction';
		if (typeof progress === 'number') {
			percent = progress;
			mode = 'percent';
		} else {
			percent = progress[0] / progress[1];
			mode = 'fraction';
		}
		// Draw frame
		vis.box(pos.x, pos.y - CHAR_HEIGHT * scale, width, 1.1 * scale * CHAR_HEIGHT, {color: TEXT_COLOR});
		vis.rect(pos.x, pos.y - CHAR_HEIGHT * scale, percent * width, 1.1 * scale * CHAR_HEIGHT, {
			fill       : TEXT_COLOR,
			opacity    : 0.4,
			strokeWidth: 0
		});
		// Draw text
		if (mode == 'percent') {
			vis.text(`${Math.round(100 * percent)}%`, pos.x + width / 2, pos.y - .1 * CHAR_HEIGHT,
					 this.textStyle(1, {align: 'center'}));
		} else {
			const [num, den] = <[number, number]>progress;
			vis.text(`${num}/${den}`, pos.x + width / 2, pos.y - .1 * CHAR_HEIGHT,
					 this.textStyle(1, {align: 'center'}));
		}

	}

	static table(data: string[][], pos: { x: number, y: number, roomName?: string }): void {
		if (data.length == 0) {
			return;
		}
		const colPadding = 4;
		const vis = new RoomVisual(pos.roomName);

		const style = this.textStyle();

		// Determine column locations
		const columns = Array(_.first(data).length).fill(0);
		for (const entries of data) {
			for (let i = 0; i < entries.length - 1; i++) {
				columns[i] = Math.max(columns[i], entries[i].length);
			}
		}

		// // Draw header and underline
		// vis.text(header, pos.x, pos.y, style);
		// vis.line(pos.x, pos.y + .3 * charHeight,
		// 	pos.x + charWidth * _.sum(columns) + colPadding * columns.length, pos.y + .25 * charHeight, {
		// 			 color: textColor
		// 		 });

		// Draw text
		// let dy = 1.5 * charHeight;
		let dy = 0;
		for (const entries of data) {
			let dx = 0;
			for (const i in entries) {
				vis.text(entries[i], pos.x + dx, pos.y + dy, style);
				dx += CHAR_WIDTH * (columns[i] + colPadding);
			}
			dy += CHAR_HEIGHT;
		}
	}

	static multitext(lines: string[], pos: { x: number, y: number, roomName?: string }): void {
		if (lines.length == 0) {
			return;
		}
		const vis = new RoomVisual(pos.roomName);
		const style = this.textStyle();
		// Draw text
		let dy = 0;
		for (const line of lines) {
			vis.text(line, pos.x, pos.y + dy, style);
			dy += CHAR_HEIGHT;
		}
	}

	static drawHUD(): void {
		// Draw Overmind logo
		new RoomVisual().multitext(asciiLogo, 0, 0, {textfont: 'monospace'});
		// // Display CPU Information
		// new RoomVisual().text('CPU:' + ' bucket:' + Game.cpu.bucket +
		// 					  ' tickLimit:' + Game.cpu.tickLimit, column, row, style);
	}

	/* Draws the Overmind logo using component coordinates extracted with Mathematica. This  uses about 0.2 CPU/tick */
	static drawLogo(): void {
		new RoomVisual().poly(logoComponents.black.points, logoComponents.black.style)
						.poly(logoComponents.dgray.points, logoComponents.dgray.style)
						.poly(logoComponents.lgray.points, logoComponents.lgray.style)
						.poly(logoComponents.blue.points, logoComponents.blue.style)
						.poly(logoComponents.red.points, logoComponents.red.style)
						.poly(logoComponents.purple.points, logoComponents.purple.style)
						.poly(logoComponents.pink.points, logoComponents.pink.style)
						.poly(logoText.V.points, logoText.V.style)
						.poly(logoText.E.points, logoText.E.style)
						.poly(logoText.R1.points, logoText.R1.style)
						.poly(logoText.R2.points, logoText.R2.style)
						.poly(logoText.M.points, logoText.M.style)
						.poly(logoText.I.points, logoText.I.style)
						.poly(logoText.N.points, logoText.N.style)
						.poly(logoText.D.points, logoText.D.style);
		Visualizer.text(`Colonies: ${_.keys(Overmind.colonies).length} | Creeps: ${_.keys(Game.creeps).length}`,
						{x: 1, y: 10}, .93);
	}

	static drawNotifications(notificationMessages: string[]): void {
		// const vis = new RoomVisual();
		const x = 10.5;
		const y = 7;
		if (notificationMessages.length == 0) {
			notificationMessages = ['No notifications'];
		}
		const maxStringLength = _.max(_.map(notificationMessages, msg => msg.length));
		const width = Math.max(11, 1.2 * CHAR_WIDTH * maxStringLength);
		this.infoBox('Notifications', notificationMessages, {x, y}, width);
	}

	// static colonyReport(colonyName: string, text: string[]) {
	// 	if (!this.enabled) return;
	// 	new RoomVisual(colonyName).multitext(text, 0, 4, {textfont: 'monospace', textsize: 0.75});
	// }

	static drawGraphs(): void {
		this.text(`CPU`, {x: 1, y: 7});
		this.barGraph(Memory.stats.persistent.avgCPU / Game.cpu.limit, {x: 2.75, y: 7});
		this.text(`BKT`, {x: 1, y: 8});
		this.barGraph(Game.cpu.bucket / 10000, {x: 2.75, y: 8});
		this.text(`GCL`, {x: 1, y: 9});
		this.barGraph(Game.gcl.progress / Game.gcl.progressTotal, {x: 2.75, y: 9});
	}


	// This typically takes about 0.3-0.6 CPU in total
	static visuals(): void {
		this.drawLogo();
		this.drawGraphs();
		// this.drawNotifications();
	}
}
