import { Table } from '@cloudflare/kumo';
import { format, type Metrics } from '../lib/metrics';

type Row = readonly [label: string, value: (metrics: Metrics) => string, perTurnOnly?: boolean];

const ROWS: readonly Row[] = [
	['Duration', (m) => format.ms(m.durationMs), true],
	['Model time', (m) => format.ms(m.modelMs)],
	['Tool + harness', (m) => (m.durationMs === undefined ? '—' : format.ms(Math.max(0, m.durationMs - m.modelMs))), true],
	['Model calls', (m) => (m.pending ? `${m.modelCalls}*` : String(m.modelCalls))],
	['Tool calls', (m) => String(m.toolCalls)],
	['Tokens in', (m) => format.tokens(m.tokensIn)],
	['Tokens out', (m) => format.tokens(m.tokensOut)],
	['Cost', (m) => format.usd(m.cost)],
];

/** The latest turn and the whole session, side by side. */
export function MetricsRail({ last, session }: { last: Metrics | null; session: Metrics | null }) {
	return (
		<aside
			className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-kumo-line bg-kumo-base p-4 xl:flex"
			aria-label="Metrics"
		>
			{last && session ? (
				<Table className="text-xs whitespace-nowrap">
					<Table.Header>
						<Table.Row>
							<Table.Head />
							<Table.Head className="text-right text-xs">Turn</Table.Head>
							<Table.Head className="text-right text-xs">Session</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{ROWS.map(([label, value, perTurnOnly]) => (
							<Table.Row key={label}>
								<Table.Cell className="text-kumo-subtle">{label}</Table.Cell>
								<Table.Cell className="text-right font-mono tabular-nums">{value(last)}</Table.Cell>
								<Table.Cell className="text-right font-mono tabular-nums">{perTurnOnly ? '' : value(session)}</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			) : (
				<p className="text-xs text-kumo-subtle">Metrics appear after the first turn.</p>
			)}
			<p className="text-[11px] leading-4 text-kumo-inactive">
				Model figures come from AI Gateway logs, measured the same way for every harness.
				{last?.pending || session?.pending ? ' * Some calls are still being logged.' : ''}
			</p>
		</aside>
	);
}
