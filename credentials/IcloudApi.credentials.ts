import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class IcloudApi implements ICredentialType {
	name = 'icloudApi';
	displayName = 'iCloud API';
	// Using cookie-based auth keeps this credential non-interactive inside n8n.
	properties: INodeProperties[] = [
		{
			displayName: 'iCloud Cookie Header',
			name: 'cookie',
			type: 'string',
			default: '',
			typeOptions: { rows: 4 },
			description:
				'Full Cookie header from an authenticated icloud.com browser session (keep tokens like X-APPLE-WEBAUTH-TOKEN). Prefix "Cookie:" is optional. Capture it locally by running "npm install --no-save playwright" then "npm run get-icloud-cookie" from this repo.',
		},
		{
			displayName: 'Apple ID (Optional)',
			name: 'appleId',
			type: 'string',
			default: '',
			description:
				'Apple ID email used when no cookie is provided or when the session needs to be refreshed.',
		},
		{
			displayName: 'App Password (Optional)',
			name: 'appPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'App-specific password or account password used with Apple ID. Provide cookies to avoid 2FA prompts during unattended runs.',
		},
	];

	authenticate = {
		type: 'generic' as const,
		properties: {
			headers: {
				Cookie: '={{$credentials.cookie}}',
			},
		},
	};

	test = {
		request: {
			method: 'GET' as const,
			url: 'https://httpbin.org/headers',
			headers: {
				Accept: 'application/json',
				Cookie: '={{ $credentials.cookie.replace(/^cookie:\\s*/i, "") }}',
			},
		},
	};
}
