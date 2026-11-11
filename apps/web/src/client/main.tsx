import { Sidebar } from '@cloudflare/kumo';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HarnessPage } from './components/HarnessPage';
import { HarnessSidebar } from './components/HarnessSidebar';
import type { HarnessId } from '@harnesses-on-do/shared/config';
import { HARNESSES, type HarnessInfo } from './harnesses';
import './styles.css';

/** The harness is the URL path: /pi, /nanocode, ... The first one is the default. */
function harnessFromPath(): HarnessInfo {
	const id = location.pathname.slice(1);
	return HARNESSES.find((harness) => harness.id === id) ?? HARNESSES[0];
}

/** One session per harness, kept across reloads. */
function sessionFor(harness: HarnessId, fresh = false): string {
	const key = `session:${harness}`;
	const existing = localStorage.getItem(key);
	if (existing && !fresh) return existing;
	const created = crypto.randomUUID();
	localStorage.setItem(key, created);
	return created;
}

function App() {
	const [harness, setHarness] = useState(harnessFromPath);
	const [sessionId, setSessionId] = useState(() => sessionFor(harness.id));

	useEffect(() => {
		const onPop = () => {
			const next = harnessFromPath();
			setHarness(next);
			setSessionId(sessionFor(next.id));
		};
		addEventListener('popstate', onPop);
		return () => removeEventListener('popstate', onPop);
	}, []);

	const select = (next: HarnessInfo) => {
		history.pushState(null, '', `/${next.id}`);
		setHarness(next);
		setSessionId(sessionFor(next.id));
	};

	return (
		<Sidebar.Provider defaultOpen className="h-dvh overflow-hidden bg-kumo-elevated text-kumo-default">
			<HarnessSidebar selected={harness.id} onSelect={select} />
			<HarnessPage
				key={`${harness.id}:${sessionId}`}
				harness={harness}
				sessionId={sessionId}
				onNewSession={() => setSessionId(sessionFor(harness.id, true))}
			/>
		</Sidebar.Provider>
	);
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(<App />);
