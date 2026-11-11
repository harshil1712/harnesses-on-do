import { Badge, Button, LayerCard, Link, Table, Text } from '@cloudflare/kumo';
import { WrenchIcon } from '@phosphor-icons/react';
import { GATEWAY_ID, MODEL_ID, REASONING } from '@harnesses-on-do/shared/config';
import type { HarnessSession } from '../chat';
import type { HarnessInfo } from '../harnesses';
import { format } from '../lib/metrics';
import type { ModelCall } from '../lib/metrics';

const DASH = 'https://dash.cloudflare.com/?to=/:account';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-kumo-line py-2.5 text-sm last:border-b-0">
			<span className="text-kumo-subtle">{label}</span>
			<span className="text-right">{children}</span>
		</div>
	);
}

const TRACING: Record<HarnessInfo['tracing'], string> = {
	automatic: 'This harness emits agent spans automatically.',
	app: 'This app adds agent spans: one per turn, with its model calls and tool runs inside.',
	'model-calls': 'Model calls are agent spans. Turns and tools run inside the harness engine, so they have none: see the transcript.',
	none: 'No agent spans: this harness runs turns on its own scheduler, outside any traced request. Model calls show in AI Gateway.',
};

export function CapabilitiesPanel({
	harness,
	session,
	calls,
}: {
	harness: HarnessInfo;
	session: HarnessSession;
	calls: readonly ModelCall[];
}) {
	// What the model was last offered, the same way for every harness; before the first call, the harness's own list.
	const tools = [...calls].reverse().find((call) => call.tools?.length)?.tools ?? session.tools ?? [];
	return (
		<div className="mx-auto max-w-3xl space-y-6 px-5 py-6">
			<LayerCard className="px-4 py-1">
				<Row label="Status">
					<Badge variant={harness.status === 'Recommended' ? 'success' : 'beta'}>{harness.status}</Badge>
				</Row>
				<Row label="Durability">
					<Badge variant={harness.durability.full ? 'success' : 'warning'} appearance="dot">
						{harness.durability.label}
					</Badge>
				</Row>
				<Row label="Steer a running turn">{session.steer ? 'Yes' : 'No'}</Row>
				<Row label="Model">
					<code className="text-xs">{MODEL_ID}</code> · reasoning {REASONING}
				</Row>
				<Row label="Docs">
					<Link href={harness.docs} target="_blank">
						{new URL(harness.docs).pathname}
					</Link>
				</Row>
				{harness.source ? (
					<Row label="Based on">
						<Link href={harness.source} target="_blank">
							upstream example
						</Link>
					</Row>
				) : null}
			</LayerCard>
			{session.restart ? (
				<div className="space-y-2">
					<Text size="sm" bold>
						Durability
					</Text>
					<LayerCard className="flex items-center justify-between gap-4 p-4">
						<p className="text-xs text-kumo-subtle">
							Abort the Durable Object, even mid-turn. The harness comes back in a fresh incarnation and resumes from its durable state.
							{session.recovered ? <span className="ml-1 font-semibold text-kumo-success">Recovered.</span> : null}
						</p>
						<Button variant="secondary" onClick={session.restart}>
							Restart Durable Object
						</Button>
					</LayerCard>
				</div>
			) : null}
			{session.revisions ? <RevisionsCard revisions={session.revisions} /> : null}
			{tools.length ? (
				<div className="space-y-2">
					<Text size="sm" bold>
						Tools offered to the model ({tools.length})
					</Text>
					<div className="grid gap-2 sm:grid-cols-2">
						{tools.map((tool) => (
							<LayerCard key={tool.name} className="p-3">
								<div className="flex items-center gap-2">
									<WrenchIcon
										size={14}
										className={session.runningTools.includes(tool.name) ? 'animate-spin text-kumo-accent' : 'text-kumo-inactive'}
									/>
									<code className="text-xs font-semibold">{tool.name}</code>
								</div>
								<p className="mt-1 line-clamp-3 text-xs text-kumo-subtle">{tool.description}</p>
							</LayerCard>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}

function RevisionsCard({ revisions }: { revisions: NonNullable<HarnessSession['revisions']> }) {
	return (
		<div className="space-y-2">
			<Text size="sm" bold>
				Harness revisions ({revisions.all.length})
			</Text>
			<p className="text-xs text-kumo-subtle">
				The agent edits its own loop under <code>/harness</code> and activates new revisions. Ask it to add a tool, then restore an earlier
				revision here.
			</p>
			<LayerCard className="p-0">
				<Table>
					<Table.Body>
						{[...revisions.all].reverse().map((revision) => (
							<Table.Row key={revision.id}>
								<Table.Cell className="font-mono text-xs">r{revision.id}</Table.Cell>
								<Table.Cell className="text-xs">{revision.note || '—'}</Table.Cell>
								<Table.Cell className="text-xs text-kumo-subtle">{new Date(revision.createdAt).toLocaleTimeString()}</Table.Cell>
								<Table.Cell className="text-right">
									{revision.id === revisions.active ? (
										<Badge variant="success">Active</Badge>
									) : (
										<Button size="sm" variant="secondary" onClick={() => revisions.restore(revision.id)}>
											Restore
										</Button>
									)}
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</LayerCard>
			<p className="text-xs text-kumo-subtle">Active source: {revisions.files.map((file) => file.path).join(', ')}</p>
		</div>
	);
}

export function ObservabilityPanel({
	harness,
	calls,
	sessionId,
}: {
	harness: HarnessInfo;
	calls: readonly ModelCall[];
	sessionId: string;
}) {
	return (
		<div className="mx-auto max-w-3xl space-y-6 px-5 py-6">
			<LayerCard className="px-4 py-1">
				<Row label="AI Gateway">
					<Link href={`${DASH}/ai/ai-gateway/gateways/${GATEWAY_ID}/logs`} target="_blank">
						{GATEWAY_ID} logs
					</Link>
					<p className="text-xs text-kumo-subtle">
						Filter by metadata <code>harness = {harness.id}</code>, <code>session = {sessionId.slice(0, 8)}…</code>
					</p>
				</Row>
				<Row label="Traces">
					<Link href={`${DASH}/agents`} target="_blank">
						Agents dashboard
					</Link>
					<p className="text-xs text-kumo-subtle">{TRACING[harness.tracing]}</p>
				</Row>
				<Row label="Workers traces">
					<Link href={`${DASH}/workers/services/view/harnesses-on-do/production/observability`} target="_blank">
						harnesses-on-do
					</Link>
				</Row>
				<Row label="Session">
					<code className="text-xs">{sessionId}</code>
				</Row>
			</LayerCard>
			{calls.length ? (
				<div className="space-y-2">
					<Text size="sm" bold>
						Model calls in this session ({calls.length})
					</Text>
					<LayerCard className="p-0">
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>Started</Table.Head>
									<Table.Head>Gateway log</Table.Head>
									<Table.Head className="text-right">In / out</Table.Head>
									<Table.Head className="text-right">Time</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{calls.map((call) => (
									<Table.Row key={call.logId}>
										<Table.Cell className="text-xs">{new Date(call.startedAt).toLocaleTimeString()}</Table.Cell>
										<Table.Cell>
											<code className="text-xs">{call.logId}</code>
										</Table.Cell>
										<Table.Cell className="text-right font-mono text-xs tabular-nums">
											{call.durationMs === undefined
												? 'pending'
												: `${format.tokens(call.tokensIn ?? 0)} / ${format.tokens(call.tokensOut ?? 0)}`}
										</Table.Cell>
										<Table.Cell className="text-right font-mono text-xs tabular-nums">{format.ms(call.durationMs)}</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					</LayerCard>
				</div>
			) : null}
		</div>
	);
}
