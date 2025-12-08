import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

type MediaTypeFilter = 'all' | 'photo' | 'video';

interface IcloudApiCredentials {
	cookie?: string;
	appleId?: string;
	appPassword?: string;
}

type NormalisedAsset = IDataObject & {
	id?: string | undefined;
	filename?: string | undefined;
	mediaType?: string | undefined;
	created?: string | number | Date | null | undefined;
	size?: number | string | null | undefined;
	raw?: IDataObject | undefined;
};

async function waitForReady(client: any): Promise<void> {
	if (!client || typeof client.on !== 'function') return;
	const emitter = client as { on: (event: string, handler: (...args: any[]) => void) => void };

	const twoFactorEvents = ['2fa', '2FA', 'twoFactor', 'twoFactorAuthentication', 'requires2FA'];

	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Timed out waiting for iCloud session.')), 20000);

		emitter.on('ready', () => {
			clearTimeout(timeout);
			resolve();
		});

		emitter.on('error', (error: Error) => {
			clearTimeout(timeout);
			reject(error);
		});

		for (const eventName of twoFactorEvents) {
			emitter.on(eventName, () => {
				clearTimeout(timeout);
				reject(
					new Error(
						'Two-factor authentication is required. Provide a trusted cookie session to avoid interactive prompts.',
					),
				);
			});
		}
	});
}

function normaliseCookieHeader(header?: string): string | undefined {
	if (!header) return undefined;
	const trimmed = header.trim();
	if (trimmed.toLowerCase().startsWith('cookie:')) {
		const [, value] = trimmed.split(':', 2);
		return value?.trim() || undefined;
	}
	return trimmed || undefined;
}

async function createIcloudClient(credentials: IcloudApiCredentials): Promise<any> {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const AppleIcloud = require('apple-icloud');

	const options: Record<string, string> = {};
	const cookie = normaliseCookieHeader(credentials.cookie);
	if (cookie) options.cookie = cookie;
	if (credentials.appleId) options.apple_id = credentials.appleId;
	if (credentials.appPassword) options.password = credentials.appPassword;

	const client = new AppleIcloud(options);

	if (typeof client.login === 'function') {
		await client.login();
	} else if (typeof client.init === 'function') {
		await client.init();
	} else {
		await waitForReady(client);
	}

	return client;
}

function normaliseAsset(asset: IDataObject): NormalisedAsset {
	const rawMediaType =
		(asset.item_type as string | undefined) ??
		(asset.media_type as string | undefined) ??
		(asset.type as string | undefined) ??
		(asset.mediaType as string | undefined);

	return {
		id:
			(asset.id as string | undefined) ??
			(asset.recordName as string | undefined) ??
			(asset.guid as string | undefined) ??
			(asset.uuid as string | undefined) ??
			(asset.assetId as string | undefined),
		filename: (asset.filename as string | undefined) ?? (asset.name as string | undefined),
		mediaType: rawMediaType?.toLowerCase(),
		created:
			(asset.created as string | number | Date | null | undefined) ??
			(asset.creationDate as string | number | Date | null | undefined) ??
			(asset.dateCreated as string | number | Date | null | undefined) ??
			(asset.creation_date as string | number | Date | null | undefined) ??
			(asset.date as string | number | Date | null | undefined) ??
			(asset.assetDate as string | number | Date | null | undefined) ??
			null,
		size:
			(asset.size as number | string | null | undefined) ??
			(asset.fileSize as number | string | null | undefined) ??
			(asset.data_length as number | string | null | undefined) ??
			null,
		raw: asset,
	};
}

function coerceAssetArray(result: any, limit?: number): NormalisedAsset[] {
	const candidates =
		(Array.isArray(result) ? result : undefined) ??
		result?.items ??
		result?.assets ??
		result?.data ??
		result?.photos ??
		[];
	const entries = Array.isArray(candidates) ? candidates : [];
	const slice = limit && limit > 0 ? entries.slice(0, limit) : entries;
	return slice.map((entry) => normaliseAsset(entry as IDataObject));
}

async function listPhotoAssets(client: any, limit?: number): Promise<NormalisedAsset[]> {
	const photosService =
		client?.photos ?? client?.Photos ?? client?.photo ?? client?.photosService ?? client?.PhotosService;

	if (!photosService) {
		throw new Error('apple-icloud client did not expose a Photos service.');
	}

	if (typeof photosService.list === 'function') {
		return coerceAssetArray(await photosService.list({ limit }), limit);
	}

	if (typeof photosService.get === 'function') {
		return coerceAssetArray(await photosService.get({ limit }), limit);
	}

	if (typeof photosService.getPhotos === 'function') {
		return coerceAssetArray(await photosService.getPhotos({ limit }), limit);
	}

	if (typeof photosService.fetch === 'function') {
		return coerceAssetArray(await photosService.fetch({ limit }), limit);
	}

	if (Array.isArray(photosService)) {
		return coerceAssetArray(photosService, limit);
	}

	throw new Error('Unable to list iCloud Photos assets; unsupported apple-icloud version or API.');
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
				description: 'Whether to include the unmodified response from apple-icloud for each item',
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
