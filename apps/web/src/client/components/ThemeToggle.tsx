import { Button } from '@cloudflare/kumo';
import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
	const [mode, setMode] = useState(() => localStorage.getItem('theme') ?? 'light');
	useEffect(() => {
		document.documentElement.setAttribute('data-mode', mode);
		document.documentElement.style.colorScheme = mode;
		localStorage.setItem('theme', mode);
	}, [mode]);
	return (
		<Button
			variant="ghost"
			shape="square"
			aria-label="Toggle theme"
			onClick={() => setMode((value) => (value === 'light' ? 'dark' : 'light'))}
			icon={mode === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
		/>
	);
}
