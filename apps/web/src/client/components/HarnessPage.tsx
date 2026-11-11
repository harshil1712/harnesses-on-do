import { Button, Tabs } from '@cloudflare/kumo';
import { PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { HarnessSession } from '../chat';
import type { HarnessInfo } from '../harnesses';
import { metricsOf, useModelCalls } from '../lib/metrics';
import { MetricsRail } from './MetricsRail';
import { CapabilitiesPanel, ObservabilityPanel } from './Panels';
import { PromptBar } from './PromptBar';
import { ThemeToggle } from './ThemeToggle';
import { Transcript } from './Transcript';

const TABS = [
	{ value: 'chat', label: 'Chat' },
	{ value: 'capabilities', label: 'Capabilities' },
	{ value: 'observability', label: 'Observability' },
];

function StatusDot({ status }: { status: HarnessSession['status'] }) {
	const label = status === 'open' ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Reconnecting';
	return (
		<span role="status" title={label} aria-label={label} className="px-2">
			<span className={`block size-2 rounded-full ${status === 'open' ? 'bg-kumo-success' : 'animate-pulse bg-kumo-inactive'}`} />
		</span>
	);
}

/** One harness: rendered with a `key` per harness and session, so its hook starts fresh. */
export function HarnessPage({ harness, sessionId, onNewSession }: { harness: HarnessInfo; sessionId: string; onNewSession: () => void }) {
	// Safe: the page is keyed by harness, so this hook never changes for a mounted page.
	const session = harness.useSession(sessionId);
	const calls = useModelCalls(harness.id, sessionId, session.running);
	const { last, session: totals } = metricsOf(session.messages, calls, session.running);
	const [tab, setTab] = useState('chat');

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={harness.name}>
				<header className="shrink-0 border-b border-kumo-line bg-kumo-base">
					<div className="flex items-center justify-between gap-3 px-5 pt-4">
						<div className="min-w-0">
							<h1 className="truncate text-base font-semibold">{harness.name}</h1>
							<p className="truncate text-xs text-kumo-subtle">{harness.tagline}</p>
						</div>
						<div className="flex shrink-0 items-center gap-1.5">
							<StatusDot status={session.status} />
							<Button variant="ghost" shape="square" aria-label="New session" onClick={onNewSession} icon={<PlusIcon size={16} />} />
							<ThemeToggle />
						</div>
					</div>
					<Tabs variant="underline" tabs={TABS} value={tab} onValueChange={setTab} className="px-5" />
				</header>
				<main className="min-h-0 flex-1 overflow-y-auto bg-kumo-elevated">
					{tab === 'chat' ? <Transcript session={session} emptyTitle={`Ask ${harness.name} something that needs a tool`} /> : null}
					{tab === 'capabilities' ? <CapabilitiesPanel harness={harness} session={session} calls={calls} /> : null}
					{tab === 'observability' ? <ObservabilityPanel harness={harness} calls={calls} sessionId={sessionId} /> : null}
				</main>
				{tab === 'chat' ? <PromptBar session={session} name={harness.name} /> : null}
			</section>
			<MetricsRail last={last} session={totals} />
		</div>
	);
}
