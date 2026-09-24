export interface SwishLinkOptions {
	phone: string;
	amount: number;
	monthName: string;
	year: number;
}

/**
 * Determines the recipient's Swish phone number based on who owes money.
 * If Person A pays (owes Person B), Person B is the recipient.
 * If Person B pays (owes Person A), Person A is the recipient.
 */
export function getSettlementRecipientSwish(
	payer: 'A' | 'B' | null,
	personASwish?: string | null,
	personBSwish?: string | null
): string {
	if (!payer) return '';
	const rawNumber = payer === 'A' ? personBSwish : personASwish;
	return rawNumber?.trim() || '';
}

/**
 * Builds a pre-filled Swish payment URL.
 * Example target: https://app.swish.nu/1/p/sw/?sw=073712345678&amt=100&cur=SEK&msg=September%202026
 */
export function buildSwishUrl(options: SwishLinkOptions): string {
	const cleanPhone = options.phone.trim().replace(/[\s-]/g, '');
	const roundedAmount = Math.round(options.amount);
	const msg = `${options.monthName} ${options.year}`;
	return `https://app.swish.nu/1/p/sw/?sw=${encodeURIComponent(cleanPhone)}&amt=${roundedAmount}&cur=SEK&msg=${encodeURIComponent(msg)}`;
}
