// Message rendering ported from the upstream Pi example's client.tsx, typed
// against the shared ChatMessage so every harness renders the same way.
import { Badge, Empty, Surface } from '@cloudflare/kumo';
import { BrainIcon, CheckCircleIcon, GearIcon, XCircleIcon } from '@phosphor-icons/react';
import { code } from '@streamdown/code';
import { useEffect, useRef } from 'react';
import { Streamdown } from 'streamdown';
import type { ChatMessage, ChatPart, HarnessSession } from '../chat';

type ToolCall = Extract<ChatPart, { type: 'tool-call' }>;
type ToolResult = Extract<ChatPart, { type: 'tool-result' }>;

function Label({ children }: { children: string }) {
	return <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-kumo-inactive">{children}</p>;
}

function JsonBlock({ value }: { value: unknown }) {
	return (
		<pre className="max-h-40 overflow-auto rounded-lg bg-kumo-elevated p-2.5 text-xs leading-5 whitespace-pre-wrap break-words">
			{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
		</pre>
	);
}

/** One card per tool call, with its result once it arrives (results are matched by call id). */
function ToolCard({ call, result, running }: { call?: ToolCall; result?: ToolResult; running: boolean }) {
	const name = call?.name ?? result?.name ?? 'tool';
	const text = result?.content.map((content) => (content.type === 'text' ? content.text : '')).join('\n') ?? '';
	const state = result ? (result.error ? 'failed' : 'done') : running ? 'running' : 'called';
	return (
		<details className="rounded-xl border border-kumo-line bg-kumo-base">
			<summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
				{state === 'running' ? (
					<GearIcon size={14} className="animate-spin text-kumo-inactive" />
				) : state === 'failed' ? (
					<XCircleIcon size={14} className="text-kumo-danger" />
				) : (
					<CheckCircleIcon size={14} className="text-kumo-success" />
				)}
				<span className="min-w-0 flex-1 truncate text-xs">
					<span className="font-semibold">{name}</span>
					{text ? <span className="ml-2 text-kumo-subtle">{text}</span> : null}
				</span>
				<Badge variant={state === 'failed' ? 'error' : 'secondary'}>
					{{ running: 'Running', called: 'Called', done: 'Done', failed: 'Failed' }[state]}
				</Badge>
			</summary>
			<div className="space-y-3 border-t border-kumo-line px-3 py-3">
				{call ? (
					<div>
						<Label>Arguments</Label>
						<JsonBlock value={call.arguments} />
					</div>
				) : null}
				{text ? (
					<div>
						<Label>Result</Label>
						<JsonBlock value={text} />
					</div>
				) : null}
				{result?.content.map((content, index) =>
					content.type === 'image' ? (
						<img key={index} src={`data:${content.mimeType};base64,${content.data}`} alt="" className="max-w-full rounded-lg" />
					) : null,
				)}
				{result?.details !== undefined ? (
					<div>
						<Label>Details</Label>
						<JsonBlock value={result.details} />
					</div>
				) : null}
			</div>
		</details>
	);
}

/** Tool results by call id, across the whole transcript, so each call renders once with its result. */
function resultsOf(messages: readonly ChatMessage[]): Map<string, ToolResult> {
	const results = new Map<string, ToolResult>();
	for (const message of messages) for (const part of message.parts) if (part.type === 'tool-result') results.set(part.id, part);
	return results;
}

function Part({ part, running, results }: { part: ChatPart; running: boolean; results: Map<string, ToolResult> }) {
	switch (part.type) {
		case 'text':
			return (
				<Streamdown className="sd-theme text-sm leading-6" plugins={{ code }} controls={false}>
					{part.text}
				</Streamdown>
			);
		case 'thinking':
			return (
				<details className="rounded-xl border border-kumo-line px-3 py-2">
					<summary className="cursor-pointer list-none text-xs font-semibold text-kumo-subtle">Thinking</summary>
					<p className="mt-2 whitespace-pre-wrap text-xs italic leading-5 text-kumo-subtle">{part.text}</p>
				</details>
			);
		case 'tool-call':
			return <ToolCard call={part} result={results.get(part.id)} running={running} />;
		case 'tool-result':
			// Rendered with its call; standalone only when the call is not in the transcript.
			return null;
		case 'image':
			return <img src={`data:${part.mimeType};base64,${part.data}`} alt="" className="max-w-full rounded-lg" />;
	}
}

function Avatar() {
	return (
		<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-kumo-brand text-white">
			<BrainIcon size={17} weight="bold" />
		</div>
	);
}

function Message({
	message,
	streaming = false,
	runningTools,
	results,
	calls,
}: {
	message: ChatMessage;
	streaming?: boolean;
	runningTools: readonly string[];
	results: Map<string, ToolResult>;
	calls: ReadonlySet<string>;
}) {
	const text = () => message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
	switch (message.role) {
		case 'user':
			return (
				<div className="flex justify-end">
					<div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-kumo-contrast px-4 py-2.5 text-sm leading-relaxed text-kumo-inverse">
						{text()}
					</div>
				</div>
			);
		case 'assistant':
			return (
				<div className="flex items-start gap-3">
					<Avatar />
					<div className="min-w-0 flex-1 space-y-3">
						{message.parts.map((part, index) =>
							part.type === 'tool-result' && !calls.has(part.id) ? (
								<ToolCard key={index} result={part} running={false} />
							) : (
								<Part key={index} part={part} results={results} running={part.type === 'tool-call' && runningTools.includes(part.name)} />
							),
						)}
						{streaming ? <span className="streaming-cursor" /> : null}
						{message.error ? <div className="rounded-xl bg-kumo-danger/10 px-4 py-3 text-sm text-kumo-danger">{message.error}</div> : null}
					</div>
				</div>
			);
		case 'tool': {
			const orphans = message.parts.filter((part): part is ToolResult => part.type === 'tool-result' && !calls.has(part.id));
			return orphans.length === 0 ? null : (
				<div className="ml-11 space-y-2">
					{orphans.map((part, index) => (
						<ToolCard key={index} result={part} running={false} />
					))}
				</div>
			);
		}
		case 'notice':
		case 'summary':
			return message.parts.length === 0 ? null : <p className="text-center text-xs text-kumo-inactive">{text()}</p>;
	}
}

export function Transcript({ session, emptyTitle }: { session: HarnessSession; emptyTitle: string }) {
	const { messages, live, running, runningTools, error } = session;
	const endRef = useRef<HTMLDivElement>(null);
	const all = live ? [...messages, live] : messages;
	const results = resultsOf(all);
	const calls = new Set(all.flatMap((message) => message.parts.flatMap((part) => (part.type === 'tool-call' ? [part.id] : []))));
	useEffect(() => {
		if (messages.length > 0 || live) endRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages.length, live, running]);

	return (
		<div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
			{messages.length === 0 && !live && !running ? (
				<div className="py-10 sm:py-16">
					<Empty
						icon={<BrainIcon size={32} />}
						title={emptyTitle}
						description="Pick a preset below so metrics are comparable across harnesses."
					/>
				</div>
			) : null}
			{messages.map((message) => (
				<Message key={message.id} message={message} runningTools={running ? runningTools : []} results={results} calls={calls} />
			))}
			{live ? <Message message={live} streaming runningTools={runningTools} results={results} calls={calls} /> : null}
			{running && !live ? (
				<div className="flex items-start gap-3">
					<Avatar />
					<Surface className="rounded-xl px-4 py-3 ring ring-kumo-line">
						<div className="flex items-center gap-2 text-sm text-kumo-subtle">
							<GearIcon size={15} className="animate-spin" />
							{runningTools.length > 0 ? `Running ${runningTools.join(', ')}` : 'Waiting for the model'}
						</div>
					</Surface>
				</div>
			) : null}
			{session.queued ? <p className="ml-11 text-xs text-kumo-subtle">{session.queued} queued behind this run</p> : null}
			{error ? (
				<div role="alert" className="rounded-xl bg-kumo-danger/10 px-4 py-3 text-sm text-kumo-danger">
					{error}
				</div>
			) : null}
			<div ref={endRef} />
		</div>
	);
}
