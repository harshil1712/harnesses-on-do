/** Loaded stamp tables, by storage key. */
const tables = new Map<string, Record<string, number>>();

function load(key: string): Record<string, number> {
	try {
		return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>;
	} catch {
		return {};
	}
}

/**
 * When the browser first saw each message, for harnesses whose messages carry
 * no timestamp. Metrics only need user messages, to split turns. Kept in
 * localStorage so a reload does not move them; stamping is idempotent.
 */
export function messageStamps(key: string): (id: string) => number {
	let table = tables.get(key);
	if (!table) tables.set(key, (table = load(key)));
	const stamps = table;
	return (id) => {
		if (stamps[id] === undefined) {
			stamps[id] = Date.now();
			localStorage.setItem(key, JSON.stringify(stamps));
		}
		return stamps[id];
	};
}
