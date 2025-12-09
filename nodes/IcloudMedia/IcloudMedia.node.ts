import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

type MediaTypeFilter = 'all' | 'photo' | 'video';

interface IcloudApiCredentials {
	appleId?: string;
	appPassword?: string;
	mfaCode?: string;
	trustDevice?: boolean;
}

type NormalisedAsset = IDataObject & {
	id?: string | undefined;
	filename?: string | undefined;
	mediaType?: string | undefined;
	created?: string | number | Date | null | undefined;
	size?: number | string | null | undefined;
	raw?: IDataObject | undefined;
};

async function createIcloudClient(credentials: IcloudApiCredentials): Promise<any> {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const IcloudJs = require('icloudjs');
	const Icloud = IcloudJs.default ?? IcloudJs;

	const appleId = credentials.appleId?.trim();
	const password = credentials.appPassword?.trim();
	const mfaCode = credentials.mfaCode?.trim();
	const trustDevice = Boolean(credentials.trustDevice);

	if (!appleId || !password) {
		throw new Error('Apple ID and app-specific password are required for iCloud authentication.');
	}

	const client = new Icloud({
		username: appleId,
		password,
		saveCredentials: false,
		trustDevice,
		authMethod: 'srp',
		logger: 'Error',
	});

	await client.authenticate();

	if (client.status === 'MfaRequested') {
		if (!mfaCode) {
			throw new Error(
				'Multi-factor authentication is required. Approve the device and provide the six-digit MFA code in the credential, then retry.',
			);
		}
		await client.provideMfaCode(mfaCode);
	}

	await client.awaitReady;

	if (client.status !== 'Ready') {
		throw new Error(`iCloud authentication did not complete. Status: ${client.status as string}`);
	}

	return client;
}

function normaliseAsset(asset: IDataObject): NormalisedAsset {
	const master = (asset as any)?.masterRecord as IDataObject;
	const fields = (master?.fields as IDataObject) || {};
	const hasVideoFields = Boolean(
		(fields as any)?.resVidSmallRes || (fields as any)?.resVidMedRes || (fields as any)?.resVidFullRes,
	);

	return {
		id: (asset as any).id ?? (master?.recordName as string | undefined),
		filename: (asset as any).filename as string | undefined,
		mediaType: hasVideoFields ? 'video' : 'photo',
		created: (asset as any).assetDate ?? (asset as any).created ?? (asset as any).addedDate ?? null,
		size: (asset as any).size ?? (fields as any)?.resOriginalRes?.value?.size ?? null,
		raw: asset,
	};
}

async function listPhotoAssets(client: any, limit?: number): Promise<NormalisedAsset[]> {
	const photosService = client.getService('photos');
	if (!photosService) throw new Error('icloudjs did not expose a Photos service.');

	const albums = await photosService.getAlbums();
	const allAlbum =
		photosService.all ??
		(albums instanceof Map ? albums.values().next().value : undefined) ??
		(Array.isArray(albums) ? albums[0] : undefined);

	if (!allAlbum) {
		throw new Error('No iCloud Photos album was returned.');
	}

	const assets = await allAlbum.getPhotos();
	const slice = limit && limit > 0 ? assets.slice(0, limit) : assets;
	return slice.map((entry: IDataObject) => normaliseAsset(entry));
}

function filterByMediaType(items: NormalisedAsset[], filter: MediaTypeFilter): NormalisedAsset[] {
	if (filter === 'all') return items;
	return items.filter((item) => {
		const type = (item.mediaType ?? '').toLowerCase();
		if (filter === 'photo') return type !== 'video';
		return type === 'video';
	});
}

function stripRawIfNeeded(items: NormalisedAsset[], includeRaw: boolean): NormalisedAsset[] {
	if (includeRaw) return items;
	return items.map((item) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { raw, ...rest } = item;
		return rest;
	});
}

export class IcloudMedia implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'iCloud Media',
		name: 'icloudMedia',
		group: ['transform'],
		version: 1,
		description: 'List media from iCloud Photos',
		defaults: { name: 'iCloud Media' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'icloudApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'List Media', value: 'list' }],
				default: 'list',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Maximum number of media items to return (0 = all available)',
				typeOptions: { minValue: 0, maxValue: 5000 },
			},
			{
				displayName: 'Media Type',
				name: 'mediaType',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Photos Only', value: 'photo' },
					{ name: 'Videos Only', value: 'video' },
				],
				default: 'all',
			},
			{
				displayName: 'Include Raw Response',
				name: 'includeRaw',
				type: 'boolean',
				default: false,
				description: 'Whether to include the unmodified response from icloudjs for each item',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = (await this.getCredentials('icloudApi')) as IcloudApiCredentials;
		const operation = this.getNodeParameter('operation', 0) as string;
		const limit = this.getNodeParameter('limit', 0) as number;
		const mediaType = this.getNodeParameter('mediaType', 0) as MediaTypeFilter;
		const includeRaw = this.getNodeParameter('includeRaw', 0) as boolean;

		if (operation !== 'list') {
			throw new Error(`Unsupported operation ${operation}`);
		}

		const client = await createIcloudClient(credentials);
		const assets = await listPhotoAssets(client, limit);
		const filtered = filterByMediaType(assets, mediaType);
		const output = stripRawIfNeeded(filtered, includeRaw);

		const returnData: INodeExecutionData[] = this.helpers.returnJsonArray(output);
		return [returnData];
	}
}
