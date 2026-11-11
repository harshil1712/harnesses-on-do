import { Sidebar } from '@cloudflare/kumo';
import type { HarnessId } from '@harnesses-on-do/shared/config';
import { HARNESSES, type HarnessInfo } from '../harnesses';

export function HarnessSidebar({ selected, onSelect }: { selected: HarnessId; onSelect: (harness: HarnessInfo) => void }) {
	return (
		<Sidebar>
			<Sidebar.Header>
				<div className="px-2 py-1">
					<p className="text-sm font-semibold">Harnesses on DO</p>
					<p className="text-xs text-kumo-subtle">Agent harnesses in Durable Objects</p>
				</div>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupLabel>Harnesses</Sidebar.GroupLabel>
					<Sidebar.Menu>
						{HARNESSES.map((harness) => (
							<Sidebar.MenuButton key={harness.id} active={harness.id === selected} onClick={() => onSelect(harness)}>
								{harness.name}
							</Sidebar.MenuButton>
						))}
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>
		</Sidebar>
	);
}
