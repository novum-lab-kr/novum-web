// 첫 화면 움직임. 동작 줄이기가 켜져 있으면 아무것도 움직이지 않고 마지막 장면만 둔다.
// - 휴대폰 첫 화면 차곡이: 앱 스플래시(src/design-system/splash.tsx)와 같은 타이밍과 도트 그림으로 판 세 장을 한 번 받는다.
// - 둘레 스티커(컴퓨터와 휴대폰): 첫 화면이 열리면 한 장씩 붙고, 그 뒤로는 첫 화면이 보이는 동안 4.5초마다 한 장만 다시 톡 붙는다.
(() => {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	document.querySelectorAll('.m-hero2, header.hero').forEach(stickers);
	const svg = document.querySelector('.m-hero2-splash');
	if (!svg) return;
	const L = {"body":["........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","..........####..........","........##gggg##........","......##gggggggg##......",".....#gggggggggggg#.....",".....#gg##gggg##gg#.....","....#ggg##gggg##ggg#....","....#googgggggggoog#....","....#gggggg##gggggg#....","....#gggggggggggggg#....","....#gggggggggggggg#....","....#gggggggggggggg#....",".....##############.....","........##....##........","........................"],"item0_mint":["........................","........................","........................","........................","........................","........................","........................","........................","........########........","........#mmmmmm#........","........#mmmmmm#........","........########........","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................"],"item1_ivory":["........................","........................","........................","........................","........................",".........########.......",".........#wwwwww#.......",".........#wwwwww#.......",".........########.......","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................"],"item2_apricot":["........................","........................",".......########.........",".......#oooooo#.........",".......#oooooo#.........",".......########.........","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................","........................"]};
	const C = {"#": "#06261C", "g": "#C7DE94", "o": "#FD855F", "w": "#FEF1D1", "m": "#AFE1CB"};
	const ITEMS = ['item0_mint', 'item1_ivory', 'item2_apricot'];
	const cache = new Map();
	function layer(name, x = 0, y = 0) {
		let inner = cache.get(name);
		if (!inner) {
			const rows = L[name];
			const by = {};
			rows.forEach((row, yy) => {
				let i = 0;
				while (i < row.length) {
					const c = row[i]; let e = i + 1;
					while (row[e] === c) e++;
					if (c !== '.') (by[c] = by[c] || []).push(`M${i} ${yy}H${e}V${yy + 1}H${i}Z`);
					i = e;
				}
			});
			inner = Object.entries(by).map(([c, v]) => `<path fill="${C[c]}" d="${v.join(' ')}"/>`).join('');
			cache.set(name, inner);
		}
		return `<g transform="translate(${x} ${y})">${inner}</g>`;
	}
	// splash.tsx의 splashTimeline과 같은 값(색 채우기와 글자 치기는 뺐다)
	const o = { step: 28, move: 40, squash: 60, gap: 60, sway: [-2, 2, 0] };
	const ev = []; let t = 0, dx = 0;
	// 색이 차오르는 앞부분은 빼고, 다 칠해진 차곡이가 판을 받는 데서 시작한다
	ev.push({ t, landed: 0 }); t += 400;
	for (let i = 0; i < 3; i++) {
		const target = o.sway[i];
		for (let f = 0; f <= 6; f++) {
			if (dx !== target && f >= 1) dx += Math.sign(target - dx);
			ev.push({ t, landed: i, falling: i, dy: 12 - f * 2, dx, catchX: target }); t += o.step;
		}
		while (dx !== target) { dx += Math.sign(target - dx); ev.push({ t, landed: i, falling: i, dy: 0, dx, catchX: target }); t += o.move; }
		ev.push({ t, landed: i + 1, squash: true, dx }); t += o.squash;
		ev.push({ t, landed: i + 1, dx }); t += o.gap;
	}
	function draw(f) {
		const x = f.dx || 0, n = f.landed || 0;
		let h = layer('body', x, 0);
		for (let i = 0; i < n; i++) h += layer(ITEMS[i], x, f.squash ? 1 : 0);
		if (f.falling !== undefined) h += layer(ITEMS[f.falling], f.catchX || 0, -f.dy);
		svg.innerHTML = h;
	}
	ev.forEach(f => setTimeout(() => draw(f), f.t));
})();

function stickers(hero) {
	const list = [...hero.querySelectorAll('.st')];
	if (!list.length) return;
	hero.classList.add('st-burst');
	list.forEach(el => el.addEventListener('animationend', () => el.classList.remove('tap')));
	let visible = true, last = -1;
	if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero);
	// 마지막 장이 붙은 뒤(가장 큰 --i × 240ms + 480ms)부터
	const lastI = Math.max(...list.map(el => Number(el.style.getPropertyValue('--i')) || 0));
	setTimeout(() => {
		hero.classList.remove('st-burst'); hero.classList.add('st-done');
		setInterval(() => {
			if (!visible || document.hidden) return;
			let i; do { i = Math.floor(Math.random() * list.length); } while (i === last && list.length > 1);
			last = i;
			const el = list[i];
			el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap');
		}, 4500);
	}, lastI * 240 + 480 + 100);
}
