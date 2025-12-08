import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';

export class Foobar implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Foobar',
		name: 'foobar',
		group: ['transform'],
		version: 1,
		description: 'Simple test node that echoes input',
		defaults: { name: 'Foobar' },
		inputs: ['main'],
		outputs: ['main'],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		return [items];
	}
}
