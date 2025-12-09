import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class IcloudApi implements ICredentialType {
	name = 'icloudApi';
	displayName = 'iCloud API';
	properties: INodeProperties[] = [
		{
			displayName: 'Apple ID',
			name: 'appleId',
			type: 'string',
			default: '',
			required: true,
			description: 'Apple ID email used with icloudjs.',
		},
		{
			displayName: 'App-Specific Password',
			name: 'appPassword',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'App-specific password for the Apple ID. If MFA is enforced, set trust on the device used to run this node so icloudjs can re-use the session.',
		},
		{
			displayName: 'MFA Code (Optional)',
			name: 'mfaCode',
			type: 'string',
			default: '',
			description:
				'Six-digit MFA code to satisfy a pending approval challenge. Leave empty normally; only required immediately after an MFA prompt.',
		},
		{
			displayName: 'Trust This Device',
			name: 'trustDevice',
			type: 'boolean',
			default: false,
			description:
				'Whether icloudjs should trust this device after MFA so future authentications skip code entry. Requires providing the MFA code once.',
		},
	];
}
