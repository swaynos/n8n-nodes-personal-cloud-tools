#!/usr/bin/env node
// One-off helper to capture an authenticated iCloud cookie for the n8n credential.
// Requires: npm install --no-save playwright
// Usage: node scripts/get-icloud-cookie.js
// Optional env vars:
//   ICLOUD_LOGIN_URL   - URL to open for login (default: https://www.icloud.com/)
//   ICLOUD_COOKIE_DOMAIN - Domain substring to keep (default: icloud.com)

/* eslint-disable no-console */

const loginUrl = process.env.ICLOUD_LOGIN_URL || 'https://www.icloud.com/';
const domainFilter = process.env.ICLOUD_COOKIE_DOMAIN || 'icloud.com';

async function ensurePlaywright() {
	try {
		// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
		const { chromium } = require('playwright');
		return chromium;
	} catch (error) {
		if (error && error.code === 'MODULE_NOT_FOUND') {
			console.error(
				'Missing dependency: playwright. Install locally with "npm install --no-save playwright" and re-run.',
			);
			process.exit(1);
		}
		throw error;
	}
}

async function promptEnter(message) {
	return new Promise((resolve) => {
		process.stdout.write(message);
		process.stdin.resume();
		process.stdin.once('data', () => {
			process.stdin.pause();
			resolve();
		});
	});
}

function formatCookieHeader(cookies) {
	return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function main() {
	const chromium = await ensurePlaywright();

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 900 },
	});
	const page = await context.newPage();

	console.log(`Opening browser at ${loginUrl}`);
	await page.goto(loginUrl);

	console.log(
		[
			'Log in to iCloud in the opened browser window.',
			'When you see your account/session is active, return here and press Enter to capture cookies.',
		].join(' '),
	);
	await promptEnter('Press Enter here to capture cookies... ');

	const cookies = await context.cookies();
	const filteredCookies = cookies.filter(
		(cookie) => cookie.domain && cookie.domain.includes(domainFilter),
	);

	await browser.close();

	if (filteredCookies.length === 0) {
		console.error(`No cookies found matching domain filter "${domainFilter}".`);
		process.exit(1);
	}

	const cookieHeader = formatCookieHeader(filteredCookies);
	console.log('\nCopy this single header line into the n8n iCloud credential (Cookie header value):\n');
	console.log(`Cookie: ${cookieHeader}`);

	if (process.env.PRINT_COOKIE_JSON === 'true') {
		console.log('\nCaptured cookies (JSON):\n');
		console.log(JSON.stringify(filteredCookies, null, 2));
	}
}

main().catch((error) => {
	console.error('Failed to capture cookies:', error);
	process.exit(1);
});
