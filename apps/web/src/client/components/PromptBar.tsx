import { Button, InputArea } from '@cloudflare/kumo';
import { PaperPlaneRightIcon, StopIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { HarnessSession } from '../chat';
import { PRESETS } from '../harnesses';

export function PromptBar({ session, name }: { session: HarnessSession; name: string }) {
	const [prompt, setPrompt] = useState('');
	const connected = session.status === 'open';

	const send = (how: 'submit' | 'steer' = 'submit') => {
		const text = prompt.trim();
		if (!text || !connected) return;
		setPrompt('');
		if (how === 'steer' && session.steer) session.steer(text);
		else session.submit(text);
	};

	return (
		<div className="shrink-0 border-t border-kumo-line bg-kumo-base">
			<form
				onSubmit={(event) => {
					event.preventDefault();
					send();
				}}
				className="mx-auto max-w-3xl space-y-2 px-5 py-4"
			>
				{session.messages.length === 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{PRESETS.map((preset) => (
							<Button
								key={preset.label}
								type="button"
								variant="secondary"
								size="sm"
								disabled={!connected}
								onClick={() => setPrompt(preset.prompt)}
							>
								{preset.label}
							</Button>
						))}
					</div>
				) : null}
				<div className="flex items-end gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-sm focus-within:border-transparent focus-within:ring-2 focus-within:ring-kumo-ring">
					<InputArea
						value={prompt}
						onValueChange={setPrompt}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault();
								send();
							}
						}}
						placeholder={
							session.running ? 'Queue a follow-up' + (session.steer ? ', or steer the running turn' : '') : `Ask ${name} to use a tool`
						}
						aria-label={`Message ${name}`}
						disabled={!connected}
						rows={2}
						className="flex-1 !bg-transparent !shadow-none !ring-0 !outline-none focus:!ring-0"
					/>
					{session.running ? (
						<div className="mb-0.5 flex gap-1.5">
							{session.steer ? (
								<Button type="button" variant="secondary" size="sm" disabled={prompt.trim() === ''} onClick={() => send('steer')}>
									Steer
								</Button>
							) : null}
							{session.abort ? (
								<Button
									type="button"
									variant="secondary"
									shape="square"
									aria-label="Stop"
									onClick={session.abort}
									icon={<StopIcon size={18} weight="fill" />}
								/>
							) : null}
						</div>
					) : (
						<Button
							type="submit"
							variant="primary"
							shape="square"
							aria-label="Send"
							disabled={!connected || prompt.trim() === ''}
							icon={<PaperPlaneRightIcon size={18} />}
							className="mb-0.5"
						/>
					)}
				</div>
			</form>
		</div>
	);
}
