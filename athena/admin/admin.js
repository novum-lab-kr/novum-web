/* 관리자 통계 화면 — relay /admin/api/* 를 같은 출처로 부른다(계약 athena-app relay/docs/admin-api.md · 2026-11-24)
   쿠키는 HttpOnly 라 읽지 않는다 · 로그인 여부는 /admin/api/me 로 안다.
   외부 라이브러리 없이 그래프는 SVG 로 직접 그린다(곡선 · 말풍선 · 그리기 움직임). 서버 값은 textContent 로만 넣는다 */
(() => {
  const API = '/admin/api';
  const RANGES = [7, 30, 90];
  const DEFAULT_RANGE = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const byId = (id) => document.getElementById(id);
  const views = ['loading', 'off', 'login', 'stats'];
  let rangeDays = DEFAULT_RANGE;
  let statsRequest = 0;

  const show = (name) => {
    for (const view of views) byId(`view-${view}`).hidden = view !== name;
  };

  // ── 숫자 표기 ──
  const numberText = (value) => value.toLocaleString('ko-KR');

  const durationText = (ms) => {
    if (ms <= 0) return '0분';
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 1) return '1분 미만';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}분`;
    return minutes === 0 ? `${numberText(hours)}시간` : `${numberText(hours)}시간 ${minutes}분`;
  };

  const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB'];
  const bytesText = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const digits = value < 10 ? 1 : 0;
    return `${value.toFixed(digits)} ${BYTE_UNITS[unitIndex]}`;
  };

  // ── 날짜(KST) ──
  const kstToday = () => new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
  const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

  const timeText = (iso) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── API ──
  const request = async (path, options = {}) => {
    const response = await fetch(API + path, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options,
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body, headers: response.headers };
  };

  const postJson = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) });

  // 관리 API 가 꺼져 있음(404 env 없음 · 503 인증 파일 없음) · 그 밖의 예상 못 한 답
  const showOff = (status) => {
    const text = status === 404 || status === 503
      ? '관리 기능이 아직 켜지지 않았습니다.'
      : '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    byId('off-text').textContent = text;
    show('off');
  };

  const showLogin = (message) => {
    byId('who').hidden = true;
    const error = byId('login-error');
    error.hidden = !message;
    error.textContent = message ?? '';
    show('login');
    byId('login-user').focus();
  };

  const showSignedIn = (me) => {
    const expires = timeText(me.expiresAt);
    byId('who-name').textContent = expires ? `${me.user} · ${expires}까지` : me.user;
    byId('who').hidden = false;
    show('stats');
    loadStats();
  };

  const checkSession = async () => {
    show('loading');
    let result;
    try {
      result = await request('/me');
    } catch {
      showOff(0);
      return;
    }
    if (result.status === 200 && result.body?.user) showSignedIn(result.body);
    else if (result.status === 401) showLogin();
    else showOff(result.status);
  };

  // ── 로그인 · 로그아웃 ──
  const retryMinutes = (headers) => {
    const seconds = Number(headers.get('retry-after'));
    return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 10;
  };

  const loginMessage = (result) => {
    if (result.status === 401) return '아이디 또는 비밀번호가 맞지 않습니다.';
    if (result.status === 429) return `로그인 시도가 너무 많습니다. ${retryMinutes(result.headers)}분 뒤 다시 시도해 주세요.`;
    if (result.status === 400 || result.status === 415) return '아이디와 비밀번호를 모두 입력해 주세요.';
    return null;
  };

  byId('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = byId('login-user').value.trim();
    const password = byId('login-password').value;
    if (!user || !password) {
      showLogin('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }
    const submit = byId('login-submit');
    submit.disabled = true;
    let result;
    try {
      result = await postJson('/login', { user, password });
    } catch {
      result = null;
    } finally {
      submit.disabled = false;
    }
    if (!result) {
      showLogin('서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      return;
    }
    if (result.status === 200 && result.body?.user) {
      byId('login-password').value = '';
      showSignedIn(result.body);
      return;
    }
    const message = loginMessage(result);
    if (message) {
      byId('login-password').value = '';
      showLogin(message);
    } else {
      showOff(result.status);
    }
  });

  byId('logout').addEventListener('click', async () => {
    try {
      await postJson('/logout', {});
    } catch {
      // 서버에 닿지 못해도 화면은 로그인으로 돌린다(쿠키는 12시간 뒤 끝난다)
    }
    showLogin();
  });

  byId('off-retry').addEventListener('click', checkSession);

  // ── 통계 ──
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const total = (record) => sum(Object.values(record));
  const decimalText = (value) => value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

  // 오류 종류 · 이유 코드 — 한 곳 표(계약 admin-api.md "오류 이유 코드" · 고정 목록 + other · 늘 전부 온다).
  // 종류가 늘면 여기에만 더한다 — 오류 합계 · 큰 그래프 줄 · 이유별 표 · 날짜별 표 말풍선이 모두 이 표를 따른다
  const ERROR_KINDS = [
    {
      key: 'login',
      name: '로그인 실패',
      color: 'c-red',
      codes: [
        ['oauth_failed', 'Apple · Google 로그인 확인 실패'],
        ['invalid_grant', '웹 로그인 1회용 코드 교환 실패'],
      ],
    },
    {
      key: 'connReject',
      name: '연결 거부',
      color: 'c-gold',
      codes: [
        ['too_large', '로그인 전 너무 큰 요청'],
        ['connection_limit', '전체 연결 수 상한'],
        ['timeout', '로그인 시간 초과'],
      ],
    },
    {
      key: 'auth',
      name: '인증 실패',
      color: 'c-grey',
      codes: [
        ['invalid_token', '세션 토큰 없음 · 만료'],
        ['unauthenticated', '로그인 전 요청'],
        ['already_authenticated', '로그인 중복'],
        ['dev_login_disabled', '꺼진 개발용 로그인 시도'],
        ['provider_unavailable', '로그인 공급자 설정 없음'],
        ['device_limit', '기기 수 상한'],
      ],
    },
    {
      key: 'http',
      name: '서버 내부 오류(웹 요청)',
      color: 'c-blue',
      codes: [['internal', '웹 요청 처리 중 서버 오류(500)']],
    },
    {
      key: 'conn',
      name: '연결 메시지 처리 오류',
      color: 'c-blue-soft',
      codes: [['protocol', '연결 메시지 처리 중 예상 못 한 오류']],
    },
    {
      key: 'appleToken',
      name: 'Apple 토큰 받기 실패',
      note: '로그인은 됨',
      color: 'c-gold-soft',
      codes: [
        ['oauth_failed', 'Apple 로그인 답에 토큰으로 바꿀 code 없음'],
        ['unreachable', 'Apple 에 닿지 못함'],
        ['http_4xx', 'Apple 이 4xx 로 답함'],
        ['http_5xx', 'Apple 이 5xx 로 답함'],
      ],
    },
    {
      key: 'appleRevoke',
      name: 'Apple 연결 해지 실패',
      note: '계정은 지워짐',
      color: 'c-red-soft',
      codes: [
        ['unreachable', 'Apple 에 닿지 못함'],
        ['http_4xx', 'Apple 이 4xx 로 답함'],
        ['http_5xx', 'Apple 이 5xx 로 답함'],
      ],
    },
    {
      key: 'msgDropped',
      name: '전달 못 한 메시지',
      color: 'c-muted',
      // 맥이 꺼져 있기만 해도 흔해 오류 합계를 부풀린다 — 합계 · 증감 · 추이선에서 빼고 팝업 표에만 보인다(사용자 결정 2026-11-24)
      excluded: ['peer_offline'],
      codes: [
        ['rate_limited', '초당 메시지 수 상한'],
        ['too_large', '메시지 크기 상한'],
        ['not_paired', '연결 안 된 기기'],
        ['peer_offline', '상대 미접속'],
      ],
    },
  ];
  // 계약 그대로의 종류별 숫자(옛 응답에 칸이 없으면 0)
  const rawErrorCount = (day, kind) => (Number.isFinite(day.errors[kind.key]) ? day.errors[kind.key] : 0);
  // 합계에서 뺄 이유(excluded)의 그날 건수
  const excludedCount = (day, kind) => sum((kind.excluded ?? []).map((code) => reasonCount(day, kind.key, code)));
  // 화면 합계에 쓰는 종류별 숫자 — 뺄 이유를 덜어 낸 것
  const errorCount = (day, kind) => Math.max(0, rawErrorCount(day, kind) - excludedCount(day, kind));
  const errorTotal = (day) => sum(ERROR_KINDS.map((kind) => errorCount(day, kind)));
  const excludedTotal = (day) => sum(ERROR_KINDS.map((kind) => excludedCount(day, kind)));

  // 숫자 정의 — value: 카드 숫자(그날) · series: 그래프 [이름, 꺼내기, 색 class] · agg: 기간 묶기 · better: 늘면 좋은지
  const METRICS = [
    { key: 'new', tier: 'main', title: '새 계정', agg: 'sum', better: 'up', format: numberText, value: (day) => total(day.accounts.new) },
    // 활성 계정은 날마다 서로 다른 계정이라 더하지 않고 하루 평균으로
    { key: 'active', tier: 'main', title: '활성 계정', note: '하루 평균', agg: 'avg', better: 'up', format: numberText, value: (day) => day.accounts.active },
    { key: 'logins', tier: 'main', title: '로그인', agg: 'sum', better: 'up', format: numberText, value: (day) => total(day.logins) },
    { key: 'deleted', tier: 'sub', title: '계정 삭제', agg: 'sum', better: 'down', format: numberText, value: (day) => day.accounts.deleted },
    {
      key: 'push',
      tier: 'sub',
      title: '푸시',
      note: '성공',
      agg: 'sum',
      better: 'up',
      format: numberText,
      value: (day) => day.push.sent,
      extra: (days) => `실패 ${numberText(sum(days.map((day) => day.push.failed)))}`,
      series: [
        ['성공', (day) => day.push.sent, 'c-gold'],
        ['실패', (day) => day.push.failed, 'c-red'],
      ],
    },
    {
      key: 'errors',
      tier: 'sub',
      title: '오류',
      agg: 'sum',
      better: 'down',
      format: numberText,
      stacked: true,
      // 큰 그래프를 바꾸지 않고 이유별 팝업을 연다(사용자 결정 2026-11-24)
      popup: true,
      reasons: true,
      value: errorTotal,
      series: ERROR_KINDS.map((kind) => [kind.name, (day) => errorCount(day, kind), kind.color]),
    },
    { key: 'duration', tier: 'sub', title: '연결 시간', agg: 'sum', better: 'up', format: durationText, value: (day) => day.connections.durationMs },
    { key: 'bytes', tier: 'sub', title: '전송량', agg: 'sum', better: 'up', format: bytesText, value: (day) => day.connections.bytes },
  ];
  const seriesOf = (metric) => metric.series ?? [[metric.title, metric.value, 'c-gold']];

  const OTHER_CODE = ['other', '그 밖'];
  // 이유를 세기 전에 쓴 날은 byCode 가 0 으로 와서 종류별 숫자보다 적다 — 그 차이는 따로 한 줄로
  const UNCOUNTED_LABEL = '이유를 세기 전';

  const hasReasons = (days) => days.some((day) => typeof day.errors.byCode === 'object' && day.errors.byCode !== null);
  const reasonCount = (day, kind, code) => {
    const value = day.errors.byCode?.[kind]?.[code];
    return Number.isFinite(value) ? value : 0;
  };

  // 날들의 이유별 건수 — [{ kind, code, label, count, excluded }] (종류 순서대로 · 종류 안에서는 많은 순 · 그 밖 · 세기 전은 끝)
  const reasonRows = (days) => {
    const rows = [];
    for (const kind of ERROR_KINDS) {
      const counted = kind.codes.map(([code, label]) => ({
        kind,
        code,
        label,
        count: sum(days.map((day) => reasonCount(day, kind.key, code))),
        excluded: (kind.excluded ?? []).includes(code),
      }));
      // 많은 순 · 합계에서 뺀 이유는 그 종류 끝에
      counted.sort((left, right) => Number(left.excluded) - Number(right.excluded) || right.count - left.count);
      const other = { kind, code: OTHER_CODE[0], label: OTHER_CODE[1], count: sum(days.map((day) => reasonCount(day, kind.key, OTHER_CODE[0]))) };
      const kindTotal = sum(days.map((day) => rawErrorCount(day, kind)));
      const uncounted = Math.max(0, kindTotal - sum(counted.map((row) => row.count)) - other.count);
      rows.push(...counted, other);
      if (uncounted > 0) rows.push({ kind, code: '', label: UNCOUNTED_LABEL, count: uncounted });
    }
    return rows;
  };

  let selectedKey = 'new';
  let current = null; // { days, prevDays } — 크기가 바뀌면 다시 그린다
  let hover = null; // 큰 그래프 말풍선 { count, showAt, hide }
  let hoverIndex = -1;
  let uid = 0;

  const aggregate = (metric, days) => {
    if (!days.length) return 0;
    const values = days.map(metric.value);
    return metric.agg === 'avg' ? sum(values) / values.length : sum(values);
  };
  const aggregateText = (metric, value) => (metric.agg === 'avg' ? decimalText(value) : metric.format(value));

  // 앞 같은 길이 기간과 견준 증감
  const deltaOf = (metric, now, before) => {
    if (before === 0) return now === 0 ? { text: '변화 없음', tone: '', plain: true } : { text: `앞 ${rangeDays}일 0`, tone: '', plain: true };
    const percent = Math.round(((now - before) / before) * 100);
    if (percent === 0) return { text: '— 0%', tone: '' };
    const rising = percent > 0;
    const good = rising === (metric.better === 'up');
    return { text: `${rising ? '▲' : '▼'} ${Math.abs(percent).toLocaleString('ko-KR')}%`, tone: good ? 'good' : 'bad' };
  };

  const svgElement = (name, attributes = {}) => {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
  };

  const htmlElement = (name, className, text) => {
    const element = document.createElement(name);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  // ── 날짜 글자 ──
  const WEEKDAYS = '일월화수목금토';
  const longDate = (date) => {
    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${weekday})`;
  };
  const shortDate = (date) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

  // 부드러운 곡선(monotone cubic · Fritsch–Carlson) — 점 사이에서 위아래로 넘치지 않는다
  const curvePath = (points, top, bottom) => {
    const count = points.length;
    if (count < 3) return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join('');
    const secants = [];
    for (let index = 0; index < count - 1; index += 1) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[index + 1];
      secants.push((y1 - y0) / (x1 - x0));
    }
    const tangents = new Array(count).fill(0);
    for (let index = 1; index < count - 1; index += 1) {
      const before = secants[index - 1];
      const after = secants[index];
      if (before * after <= 0) continue;
      const widthBefore = points[index][0] - points[index - 1][0];
      const widthAfter = points[index + 1][0] - points[index][0];
      const blended = (before * widthAfter + after * widthBefore) / (widthBefore + widthAfter);
      tangents[index] = Math.sign(before) * 2 * Math.min(Math.abs(before), Math.abs(after), 0.5 * Math.abs(blended));
    }
    tangents[0] = (3 * secants[0] - tangents[1]) / 2;
    tangents[count - 1] = (3 * secants[count - 2] - tangents[count - 2]) / 2;
    const clampY = (value) => Math.min(bottom, Math.max(top, value));
    let path = `M${points[0][0]},${points[0][1]}`;
    for (let index = 0; index < count - 1; index += 1) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[index + 1];
      const third = (x1 - x0) / 3;
      path += `C${x0 + third},${clampY(y0 + third * tangents[index])},${x1 - third},${clampY(y1 - third * tangents[index + 1])},${x1},${y1}`;
    }
    return path;
  };

  const round = (value) => Math.round(value * 10) / 10;

  // 그래프 한 장 — 큰 그래프(말풍선) · 카드 안 작은 추이선(spark) 둘 다
  const drawPlot = (plot, metric, days, { animate, spark }) => {
    plot.replaceChildren();
    const width = Math.max(plot.clientWidth, 60);
    const height = plot.clientHeight || (spark ? 40 : 260);
    const pad = spark ? { top: 3, right: 2, bottom: 2, left: 2 } : { top: 26, right: 8, bottom: 4, left: 8 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const base = pad.top + innerHeight;
    const series = spark ? [[metric.title, metric.value, '']] : seriesOf(metric);
    const stacked = !spark && Boolean(metric.stacked);
    const columns = series.map(([, pick]) => days.map(pick));
    const totals = days.map((_, index) => sum(columns.map((column) => column[index])));
    const max = stacked ? Math.max(...totals) : Math.max(...columns.flat());
    const svg = svgElement('svg', { width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
    plot.appendChild(svg);
    if (!spark) svg.appendChild(svgElement('line', { x1: pad.left, y1: base + 0.5, x2: width - pad.right, y2: base + 0.5, class: 'ch-base' }));

    if (max === 0) {
      if (spark) svg.appendChild(svgElement('line', { x1: pad.left, y1: base - 0.5, x2: width - pad.right, y2: base - 0.5, class: 'spark-line' }));
      else plot.appendChild(htmlElement('p', 'admin-empty', '이 기간에는 기록이 없습니다'));
      return null;
    }

    // 세기 시작 전(또는 기록이 없던) 앞쪽 0 인 날은 선을 바닥에 붙이지 않고 옅은 점선으로 두고, 곡선은 첫 기록부터
    const first = Math.max(0, totals.findIndex((value) => value > 0));
    // 0 인 날이 절반 이상인 숫자는 바닥에 붙은 선 대신 얇은 막대로(쌓는 오류도 막대)
    const nonZero = (stacked ? totals : columns[0]).filter((value) => value > 0).length;
    const barMode = stacked || days.length - first < 3 || (series.length === 1 && nonZero / (days.length - first) <= 0.5);
    const slot = innerWidth / days.length;
    const xAt = barMode
      ? (index) => round(pad.left + slot * (index + 0.5))
      : (index) => round(pad.left + (days.length === 1 ? innerWidth / 2 : (innerWidth * index) / (days.length - 1)));
    const ceiling = max * (spark ? 1.06 : 1.16);
    const yAt = (value) => round(pad.top + innerHeight * (1 - value / ceiling));

    if (!spark) {
      const maxY = yAt(max) + 0.5;
      svg.appendChild(svgElement('line', { x1: pad.left, y1: maxY, x2: width - pad.right, y2: maxY, class: 'ch-grid' }));
      const label = htmlElement('span', 'admin-max', `최대 ${metric.format(max)}`);
      label.style.top = `${maxY}px`;
      plot.appendChild(label);
    }

    if (barMode) {
      const barWidth = Math.min(Math.max(slot * 0.42, spark ? 1.5 : 2), spark ? 4 : 10);
      const radius = Math.min(barWidth / 2, 3);
      days.forEach((_, index) => {
        let top = base;
        columns.forEach((column, seriesIndex) => {
          const value = column[index];
          if (value <= 0) return;
          const gap = top < base ? 1.5 : 0;
          const barHeight = Math.max((innerHeight * value) / ceiling - gap, 1.5);
          top -= barHeight + gap;
          const className = spark ? 'spark-bar' : `ch-bar ${series[seriesIndex][2]}`;
          const bar = svgElement('rect', { x: round(xAt(index) - barWidth / 2), y: round(top), width: round(barWidth), height: round(barHeight), rx: radius, class: animate ? `${className} ch-grow` : className });
          if (animate) bar.style.animationDelay = `${Math.round((index / days.length) * 450)}ms`;
          svg.appendChild(bar);
        });
      });
    } else {
      const gradientId = `admin-grad-${(uid += 1)}`;
      const defs = svgElement('defs');
      const gradient = svgElement('linearGradient', { id: gradientId, x1: 0, y1: 0, x2: 0, y2: 1 });
      const color = spark ? '' : series[0][2];
      gradient.appendChild(svgElement('stop', { offset: 0, 'stop-opacity': spark ? 0.22 : 0.26, class: color }));
      gradient.appendChild(svgElement('stop', { offset: 1, 'stop-opacity': 0, class: color }));
      defs.appendChild(gradient);
      svg.appendChild(defs);
      // 뒤 줄부터 그려 첫 줄(포인트색)이 위에 오게
      if (first > 0 && !spark) svg.appendChild(svgElement('line', { x1: xAt(0), y1: base - 0.5, x2: xAt(first), y2: base - 0.5, class: 'ch-lead' }));
      for (let seriesIndex = columns.length - 1; seriesIndex >= 0; seriesIndex -= 1) {
        const points = columns[seriesIndex].map((value, index) => [xAt(index), yAt(value)]).slice(first);
        const line = curvePath(points, pad.top, base);
        if (seriesIndex === 0) {
          const area = svgElement('path', { d: `${line}L${points[points.length - 1][0]},${base}L${points[0][0]},${base}Z`, fill: `url(#${gradientId})` });
          if (animate) area.setAttribute('class', 'ch-fade');
          svg.appendChild(area);
        }
        const classes = spark ? ['spark-line'] : ['ch-line', series[seriesIndex][2]];
        if (seriesIndex > 0) classes.push('second');
        if (animate) classes.push('ch-draw');
        const path = svgElement('path', { d: line, class: classes.join(' ') });
        if (animate) path.setAttribute('pathLength', '1');
        svg.appendChild(path);
      }
    }
    if (spark) return null;

    // 말풍선 — 세로 안내선 + 점(선) · 칸 밝히기(막대) + 그날 숫자
    const layer = svgElement('g', { visibility: 'hidden' });
    const column = svgElement('rect', { y: pad.top - 10, height: innerHeight + 10, width: Math.max(slot, 4), rx: 4, class: 'ch-col' });
    const guide = svgElement('line', { y1: pad.top - 10, y2: base, class: 'ch-guide' });
    layer.appendChild(barMode ? column : guide);
    const dots = barMode ? [] : series.map(([, , color]) => svgElement('circle', { r: 4.5, class: `ch-dot ${color}` }));
    for (const dot of dots) layer.appendChild(dot);
    svg.appendChild(layer);
    const tip = htmlElement('div', 'admin-tip');
    tip.hidden = true;
    plot.appendChild(tip);

    const showAt = (index) => {
      const day = days[index];
      const x = xAt(index);
      layer.setAttribute('visibility', 'visible');
      if (barMode) column.setAttribute('x', round(x - Math.max(slot, 4) / 2));
      else {
        guide.setAttribute('x1', x);
        guide.setAttribute('x2', x);
        dots.forEach((dot, seriesIndex) => {
          dot.setAttribute('cx', x);
          dot.setAttribute('cy', yAt(columns[seriesIndex][index]));
        });
      }
      const rows = [htmlElement('p', 'admin-tip-date', longDate(day.date))];
      series.forEach(([name, pick, color]) => {
        // 쌓는 그래프(오류 · 종류가 많다)는 그날 0 인 종류를 말풍선에서 뺀다 — 합계 줄이 있다
        if (stacked && pick(day) === 0) return;
        const row = htmlElement('p', 'admin-tip-row');
        row.appendChild(htmlElement('i', color));
        row.appendChild(document.createTextNode(name));
        row.appendChild(htmlElement('b', '', metric.format(pick(day))));
        rows.push(row);
      });
      if (stacked) {
        const row = htmlElement('p', 'admin-tip-row total', '합계');
        row.appendChild(htmlElement('b', '', metric.format(totals[index])));
        rows.push(row);
      }
      if (metric.reasons && hasReasons(days)) {
        const top = reasonRows([day])
          .filter((reason) => reason.count > 0 && !reason.excluded)
          .sort((left, right) => right.count - left.count)
          .slice(0, 3);
        if (top.length) {
          rows.push(htmlElement('p', 'admin-tip-sub', '많은 이유'));
          for (const reason of top) {
            const row = htmlElement('p', 'admin-tip-row reason');
            row.appendChild(htmlElement('i', reason.kind.color));
            row.appendChild(document.createTextNode(reason.label));
            row.appendChild(htmlElement('b', '', metric.format(reason.count)));
            rows.push(row);
          }
        }
      }
      tip.replaceChildren(...rows);
      tip.hidden = false;
      // 안내선 옆(오른쪽 · 자리가 없으면 왼쪽)에 둬 점을 가리지 않는다
      const tipWidth = tip.offsetWidth;
      const right = x + 14;
      tip.style.left = `${right + tipWidth <= width ? right : Math.max(0, x - 14 - tipWidth)}px`;
    };
    const hide = () => {
      layer.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    };

    const hit = svgElement('rect', { x: 0, y: 0, width, height, class: 'ch-hit' });
    hit.addEventListener('pointermove', (event) => {
      const offset = event.clientX - svg.getBoundingClientRect().left - pad.left;
      const step = barMode ? slot : innerWidth / Math.max(days.length - 1, 1);
      const raw = barMode ? Math.floor(offset / step) : Math.round(offset / step);
      hoverIndex = Math.min(days.length - 1, Math.max(0, raw));
      showAt(hoverIndex);
    });
    hit.addEventListener('pointerleave', () => {
      hoverIndex = -1;
      hide();
    });
    svg.appendChild(hit);
    return { count: days.length, showAt, hide };
  };

  // 키보드 — 그래프에 초점이 있으면 ← → 로 날을 옮긴다
  const plotElement = byId('chart-plot');
  plotElement.addEventListener('keydown', (event) => {
    if (!hover || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const start = hoverIndex < 0 ? hover.count : hoverIndex;
    hoverIndex = Math.min(hover.count - 1, Math.max(0, start + (event.key === 'ArrowLeft' ? -1 : 1)));
    hover.showAt(hoverIndex);
  });
  plotElement.addEventListener('focus', () => {
    if (!hover) return;
    hoverIndex = hover.count - 1;
    hover.showAt(hoverIndex);
  });
  plotElement.addEventListener('blur', () => {
    hoverIndex = -1;
    hover?.hide();
  });

  // ── 오류 이유별 표 — 큰 그래프가 오류일 때만 · 0건 줄은 접어 두고 버튼으로 편다 ──
  let showZeroReasons = false;

  const shareText = (count, all) => {
    if (count === 0 || all === 0) return '0%';
    const percent = (count / all) * 100;
    return percent < 1 ? '1% 미만' : `${Math.round(percent)}%`;
  };

  const renderReasons = (days) => {
    const box = byId('reasons');
    const all = sum(days.map(errorTotal));
    // 옛 relay 응답(byCode 없음) · 오류가 없는 기간(합계에서 뺀 것도 없음)은 표를 숨긴다
    if ((all === 0 && sum(days.map(excludedTotal)) === 0) || !hasReasons(days)) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const rows = reasonRows(days);
    const zeroCount = rows.filter((row) => row.count === 0).length;
    const toggle = byId('reasons-toggle');
    toggle.hidden = zeroCount === 0;
    toggle.textContent = showZeroReasons ? '0건 이유 접기' : `0건 이유 ${zeroCount}개 보기`;
    toggle.setAttribute('aria-expanded', String(showZeroReasons));
    const visible = showZeroReasons ? rows : rows.filter((row) => row.count > 0);
    const body = byId('reasons-body');
    body.replaceChildren();
    let lastKind = null;
    for (const reason of visible) {
      const row = document.createElement('tr');
      const firstOfKind = reason.kind !== lastKind;
      const classes = [];
      if (firstOfKind && lastKind) classes.push('kind-next');
      if (reason.count === 0) classes.push('zero');
      if (reason.excluded) classes.push('excluded');
      row.className = classes.join(' ');
      lastKind = reason.kind;
      const kindCell = htmlElement('th');
      kindCell.scope = 'row';
      if (firstOfKind) {
        const label = htmlElement('span', 'kind');
        label.appendChild(htmlElement('i', reason.kind.color));
        label.appendChild(document.createTextNode(reason.kind.name));
        kindCell.appendChild(label);
        if (reason.kind.note) kindCell.appendChild(htmlElement('small', '', reason.kind.note));
      }
      row.appendChild(kindCell);
      const reasonCell = htmlElement('td', 'reason', reason.label);
      if (reason.excluded) reasonCell.appendChild(htmlElement('span', 'admin-tag', '합계에서 뺌'));
      reasonCell.appendChild(htmlElement('small', '', reason.code || '이 기능 반영 전 날'));
      row.appendChild(reasonCell);
      row.appendChild(htmlElement('td', '', numberText(reason.count)));
      const shareCell = htmlElement('td');
      // 합계에서 뺀 이유는 비중이 없다(합계 기준)
      if (reason.excluded) {
        shareCell.textContent = '—';
        row.appendChild(shareCell);
        body.appendChild(row);
        continue;
      }
      const share = htmlElement('span', 'admin-share');
      const bar = htmlElement('span', 'admin-share-bar');
      const fill = htmlElement('span', reason.kind.color);
      fill.style.width = `${Math.round((reason.count / all) * 100)}%`;
      bar.appendChild(fill);
      share.appendChild(bar);
      share.appendChild(document.createTextNode(shareText(reason.count, all)));
      shareCell.appendChild(share);
      row.appendChild(shareCell);
      body.appendChild(row);
    }
  };

  byId('reasons-toggle').addEventListener('click', () => {
    showZeroReasons = !showZeroReasons;
    if (current) renderReasons(current.days);
  });

  // ── 오류 팝업 — 기간 종류별 쌓는 막대(작게) + 이유별 표 ──
  const errorsDialog = byId('errors-dialog');
  const errorsMetric = METRICS.find((item) => item.popup);

  const renderErrorsDialog = (animate) => {
    const { days } = current;
    const all = sum(days.map(errorTotal));
    // 합계에서 뺀 것만 있는 기간도 표는 보여 준다
    const shown = all > 0 || sum(days.map(excludedTotal)) > 0;
    byId('errors-sum').textContent = `${days[0].date} ~ ${days[days.length - 1].date} · 합계 ${numberText(all)}`;
    byId('errors-empty').hidden = shown;
    byId('errors-detail').hidden = !shown;
    if (!shown) return;
    const legend = byId('errors-legend');
    legend.replaceChildren();
    for (const [name, pick, color] of errorsMetric.series) {
      const item = htmlElement('span', '');
      item.appendChild(htmlElement('i', color));
      item.appendChild(document.createTextNode(name));
      item.appendChild(htmlElement('b', '', numberText(sum(days.map(pick)))));
      legend.appendChild(item);
    }
    byId('errors-x-from').textContent = shortDate(days[0].date);
    byId('errors-x-to').textContent = shortDate(days[days.length - 1].date);
    drawPlot(byId('errors-plot'), errorsMetric, days, { animate, spark: false });
    renderReasons(days);
  };

  const openErrorsDialog = () => {
    if (!current) return;
    showZeroReasons = false;
    errorsDialog.showModal();
    // 열린 뒤 너비를 재서 그린다
    renderErrorsDialog(true);
  };

  byId('errors-close').addEventListener('click', () => errorsDialog.close());
  // 바깥(배경) 누름 — dialog 자체가 눌렸을 때만(안쪽 내용은 .admin-dialog-body 가 받는다)
  errorsDialog.addEventListener('click', (event) => {
    if (event.target === errorsDialog) errorsDialog.close();
  });

  const renderChart = (animate) => {
    const metric = METRICS.find((item) => item.key === selectedKey) ?? METRICS[0];
    const { days } = current;
    byId('chart-title').textContent = metric.note && !metric.series ? `${metric.title} · ${metric.note}` : metric.title;
    const value = aggregate(metric, days);
    const label = metric.agg === 'avg' ? '하루 평균' : '기간 합계';
    byId('chart-sum').textContent = `${label} ${aggregateText(metric, value)}`;
    const legend = byId('chart-legend');
    legend.replaceChildren();
    if (metric.series) {
      for (const [name, pick, color] of metric.series) {
        const item = htmlElement('span', '');
        item.appendChild(htmlElement('i', color));
        item.appendChild(document.createTextNode(name));
        item.appendChild(htmlElement('b', '', metric.format(sum(days.map(pick)))));
        legend.appendChild(item);
      }
    }
    byId('chart-x-from').textContent = shortDate(days[0].date);
    byId('chart-x-to').textContent = shortDate(days[days.length - 1].date);
    hoverIndex = -1;
    hover = drawPlot(plotElement, metric, days, { animate, spark: false });
  };

  const selectMetric = (key) => {
    if (key === selectedKey) return;
    selectedKey = key;
    for (const card of document.querySelectorAll('.admin-kpi[aria-pressed]')) card.setAttribute('aria-pressed', String(card.dataset.key === key));
    renderChart(true);
  };

  const renderKpis = (animate) => {
    const { days, prevDays } = current;
    const holders = { main: byId('kpis-main'), sub: byId('kpis-sub') };
    holders.main.replaceChildren();
    holders.sub.replaceChildren();
    const sparks = [];
    for (const metric of METRICS) {
      const card = htmlElement('button', 'admin-kpi');
      card.type = 'button';
      card.dataset.key = metric.key;
      if (metric.popup) card.setAttribute('aria-haspopup', 'dialog');
      else card.setAttribute('aria-pressed', String(metric.key === selectedKey));
      const name = htmlElement('span', 'admin-kpi-name', metric.title);
      if (metric.note) name.appendChild(htmlElement('small', '', metric.note));
      card.appendChild(name);
      const now = aggregate(metric, days);
      card.appendChild(htmlElement('span', 'admin-kpi-value', aggregateText(metric, now)));
      const deltaRow = htmlElement('span', 'admin-kpi-delta');
      const delta = prevDays.length ? deltaOf(metric, now, aggregate(metric, prevDays)) : null;
      if (delta) deltaRow.appendChild(htmlElement('span', delta.plain ? 'admin-extra' : `admin-delta ${delta.tone}`.trim(), delta.text));
      // 견줄 숫자가 있을 때만 '앞 n일 대비'(앞 기간이 0 이면 위 글자가 이미 말한다)
      const compared = delta && !delta.plain && metric.tier === 'main' ? `앞 ${rangeDays}일 대비` : '';
      const extra = metric.extra ? metric.extra(days) : compared;
      if (extra) deltaRow.appendChild(htmlElement('span', 'admin-extra', extra));
      card.appendChild(deltaRow);
      const spark = htmlElement('span', 'admin-kpi-spark');
      card.appendChild(spark);
      card.addEventListener('click', () => (metric.popup ? openErrorsDialog() : selectMetric(metric.key)));
      holders[metric.tier].appendChild(card);
      sparks.push([spark, metric]);
    }
    // 카드가 화면에 붙은 뒤 너비를 재서 그린다
    for (const [spark, metric] of sparks) drawPlot(spark, metric, days, { animate, spark: true });
  };

  const renderTable = (days) => {
    const body = byId('table-body');
    body.replaceChildren();
    // 최근 날이 위로
    for (const day of [...days].reverse()) {
      const row = document.createElement('tr');
      const errors = errorTotal(day);
      const cells = [
        [day.date, 1, ''],
        [numberText(total(day.accounts.new)), total(day.accounts.new), ''],
        [numberText(day.accounts.active), day.accounts.active, ''],
        [numberText(total(day.logins)), total(day.logins), ''],
        [numberText(day.accounts.deleted), day.accounts.deleted, ''],
        [numberText(day.push.sent), day.push.sent, ''],
        [numberText(day.push.failed), day.push.failed, ''],
        [numberText(errors), errors, ERROR_KINDS.map((kind) => `${kind.name} ${errorCount(day, kind)}`).join(' · ')],
        [durationText(day.connections.durationMs), day.connections.durationMs, ''],
        [bytesText(day.connections.bytes), day.connections.bytes, ''],
      ];
      cells.forEach(([text, raw, title], index) => {
        const cell = htmlElement(index === 0 ? 'th' : 'td', raw === 0 ? 'zero' : '', text);
        if (index === 0) cell.scope = 'row';
        if (title) cell.title = title;
        row.appendChild(cell);
      });
      body.appendChild(row);
    }
  };

  const renderCurrent = (now, today) => {
    const { accounts, devices, pairs } = now;
    byId('cur-accounts').textContent = numberText(accounts.total);
    const accountParts = [`Apple ${numberText(accounts.apple)}`, `Google ${numberText(accounts.google)}`];
    if (accounts.dev > 0) accountParts.push(`개발 ${numberText(accounts.dev)}`);
    byId('cur-accounts-sub').textContent = accountParts.join(' · ');
    byId('cur-devices').textContent = numberText(devices.total);
    byId('cur-devices-sub').textContent = `맥 ${numberText(devices.mac)} · 폰 ${numberText(devices.app)}`;
    byId('cur-pairs').textContent = numberText(pairs);
    byId('stats-today').textContent = `오늘 ${today} · 한국 시간`;
  };

  const renderStats = (stats, days, prevDays) => {
    current = { days, prevDays };
    renderCurrent(stats.current, stats.today);
    byId('stats-range').textContent = `${days[0].date} ~ ${days[days.length - 1].date}`;
    renderKpis(true);
    renderChart(true);
    renderTable(days);
    if (errorsDialog.open) renderErrorsDialog(false);
  };

  // 창 너비가 바뀌면 움직임 없이 다시 그린다
  let lastWidth = 0;
  let resizeFrame = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (!current || width === lastWidth) return;
    lastWidth = width;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      renderKpis(false);
      renderChart(false);
      if (errorsDialog.open) renderErrorsDialog(false);
    });
  }).observe(byId('view-stats'));

  const markRange = () => {
    for (const button of document.querySelectorAll('.admin-range button')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.days) === rangeDays));
    }
  };

  const showStatsError = (message) => {
    const error = byId('stats-error');
    error.hidden = !message;
    error.textContent = message ?? '';
  };

  // ── 계정 목록(계약 admin-api.md "accounts 답" · 기간은 위 고르기와 같다 · 최대 90일) ──
  const PROVIDER_NAMES = { apple: 'Apple', google: 'Google', dev: '개발' };
  const countOf = (value) => (Number.isFinite(value) && value > 0 ? value : 0);
  const timeOf = (iso) => {
    const parsed = typeof iso === 'string' ? Date.parse(iso) : Number.NaN;
    return Number.isNaN(parsed) ? null : parsed;
  };
  // 가입일 — KST 날짜(YYYY-MM-DD)
  const kstDate = (time) => new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
  const kstDateTime = (time) => new Date(time + KST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');

  // 서버 답을 화면 줄로 — 숫자는 0 이상 정수만 · 시각은 밀리초(없거나 틀리면 null)
  // 맥 · 폰은 최근 7일 연결 기기 수(devices.recent7d)로 보이고 정렬한다 — recent7d 가 없는 옛 relay 답이면 전체 수
  const accountRow = (account) => {
    const devices = account.devices;
    const recent = typeof devices?.recent7d === 'object' && devices.recent7d !== null ? devices.recent7d : null;
    const macAll = countOf(devices?.mac);
    const appAll = countOf(devices?.app);
    return {
      id: typeof account.id === 'string' ? account.id : '',
      provider: typeof account.provider === 'string' ? account.provider : '',
      createdAt: timeOf(account.createdAt),
      hasRecent: recent !== null,
      mac: recent === null ? macAll : countOf(recent.mac),
      app: recent === null ? appAll : countOf(recent.app),
      macAll,
      appAll,
      pairs: countOf(account.pairs),
      pushSent: countOf(account.push?.sent),
      pushFailed: countOf(account.push?.failed),
      durationMs: countOf(account.connections?.durationMs),
      lastSeenAt: timeOf(account.lastSeenAt),
    };
  };

  // 열마다 처음 누를 때의 방향 — 글자는 가나다 순, 숫자 · 시각은 큰(최근) 것부터
  const TEXT_COLUMNS = ['id', 'provider'];
  const firstDirection = (key) => (TEXT_COLUMNS.includes(key) ? 'asc' : 'desc');
  // 기본은 서버 순서와 같은 가입 최근 순
  let accountSort = { key: 'createdAt', direction: 'desc' };
  let accountRows = [];
  let accountsRequest = 0;

  const providerName = (provider) => PROVIDER_NAMES[provider] ?? provider;

  const compareValues = (key, left, right) => {
    if (TEXT_COLUMNS.includes(key)) {
      const leftText = key === 'provider' ? providerName(left) : left;
      const rightText = key === 'provider' ? providerName(right) : right;
      return leftText.localeCompare(rightText, 'ko-KR');
    }
    return left - right;
  };

  const sortedAccounts = () => {
    const { key, direction } = accountSort;
    const sign = direction === 'asc' ? 1 : -1;
    return [...accountRows].sort((left, right) => {
      const leftValue = left[key];
      const rightValue = right[key];
      // 시각이 없는 줄(마지막 접속 없음)은 방향과 상관없이 끝에
      if (leftValue === null || rightValue === null) {
        if (leftValue !== rightValue) return leftValue === null ? 1 : -1;
      } else {
        const order = compareValues(key, leftValue, rightValue) * sign;
        if (order !== 0) return order;
      }
      // 같으면 가입 최근 순
      return (right.createdAt ?? 0) - (left.createdAt ?? 0);
    });
  };

  const markAccountSort = () => {
    for (const header of byId('accounts-head').querySelectorAll('th[data-sort]')) {
      const active = header.dataset.sort === accountSort.key;
      if (active) header.setAttribute('aria-sort', accountSort.direction === 'asc' ? 'ascending' : 'descending');
      else header.removeAttribute('aria-sort');
    }
  };

  const renderAccountsBody = () => {
    const body = byId('accounts-body');
    body.replaceChildren();
    for (const account of sortedAccounts()) {
      const row = document.createElement('tr');
      const idCell = htmlElement('th', 'admin-account-id', account.id);
      idCell.scope = 'row';
      row.appendChild(idCell);
      row.appendChild(htmlElement('td', 'admin-account-text', providerName(account.provider)));
      const created = htmlElement('td', '', account.createdAt === null ? '—' : kstDate(account.createdAt));
      if (account.createdAt !== null) created.title = `${kstDateTime(account.createdAt)} 한국 시간`;
      row.appendChild(created);
      // 맥 · 폰 — 최근 7일 수를 크게 · 세션이 남은 전체 수를 옆에 작게(옛 relay 답이면 전체만)
      for (const [key, allKey] of [['mac', 'macAll'], ['app', 'appAll']]) {
        const cell = htmlElement('td', account[key] === 0 ? 'zero' : '', numberText(account[key]));
        if (account.hasRecent) {
          cell.appendChild(htmlElement('small', 'admin-account-all', `(${numberText(account[allKey])})`));
          cell.title = `최근 7일 연결 ${numberText(account[key])}대 · 세션이 남은 전체 ${numberText(account[allKey])}대`;
        }
        row.appendChild(cell);
      }
      for (const key of ['pairs', 'pushSent', 'pushFailed']) {
        row.appendChild(htmlElement('td', account[key] === 0 ? 'zero' : '', numberText(account[key])));
      }
      row.appendChild(htmlElement('td', account.durationMs === 0 ? 'zero' : '', durationText(account.durationMs)));
      const lastSeen = htmlElement('td', account.lastSeenAt === null ? 'zero' : '', account.lastSeenAt === null ? '—' : kstDateTime(account.lastSeenAt));
      if (account.lastSeenAt === null) lastSeen.title = '90일 안에 접속 기록 없음';
      row.appendChild(lastSeen);
      body.appendChild(row);
    }
    markAccountSort();
  };

  const showAccountsError = (message) => {
    const error = byId('accounts-error');
    error.hidden = !message;
    error.textContent = message ?? '';
  };

  const renderAccounts = (answer) => {
    accountRows = answer.accounts.filter((account) => typeof account === 'object' && account !== null).map(accountRow);
    byId('accounts-sum').textContent = `${numberText(accountRows.length)}개 · 푸시 · 연결 시간은 ${answer.from} ~ ${answer.to} 합계`;
    byId('accounts-empty').hidden = accountRows.length > 0;
    byId('accounts-scroll').hidden = accountRows.length === 0;
    renderAccountsBody();
  };

  for (const header of byId('accounts-head').querySelectorAll('th[data-sort]')) {
    header.querySelector('button').addEventListener('click', () => {
      const key = header.dataset.sort;
      if (accountSort.key === key) accountSort = { key, direction: accountSort.direction === 'asc' ? 'desc' : 'asc' };
      else accountSort = { key, direction: firstDirection(key) };
      renderAccountsBody();
    });
  }

  async function loadAccounts() {
    const requestId = ++accountsRequest;
    const to = kstToday();
    const from = shiftDate(to, -(rangeDays - 1));
    let result;
    try {
      result = await request(`/accounts?from=${from}&to=${to}`);
    } catch {
      result = null;
    }
    // 기간을 빨리 바꿨으면 늦게 온 앞 답은 버린다
    if (requestId !== accountsRequest) return;
    if (result?.status === 200 && Array.isArray(result.body?.accounts)) {
      showAccountsError(null);
      renderAccounts(result.body);
      return;
    }
    if (result?.status === 401) {
      showLogin('로그인이 끝났습니다. 다시 로그인해 주세요.');
      return;
    }
    if (result?.status === 503) {
      showOff(result.status);
      return;
    }
    // 앞 기간 표가 새 기간 것처럼 보이지 않게 숨긴다
    byId('accounts-sum').textContent = '';
    byId('accounts-empty').hidden = true;
    byId('accounts-scroll').hidden = true;
    showAccountsError('계정 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  }

  async function loadStats() {
    markRange();
    loadAccounts();
    const requestId = ++statsRequest;
    const to = kstToday();
    // 증감을 보려고 앞 같은 길이 기간까지 한 번에 받는다(90일이면 180일 · 계약 한도 366일)
    const from = shiftDate(to, -(rangeDays * 2 - 1));
    let result;
    try {
      result = await request(`/stats?from=${from}&to=${to}`);
    } catch {
      result = null;
    }
    // 기간을 빨리 바꿨으면 늦게 온 앞 답은 버린다
    if (requestId !== statsRequest) return;
    if (!result) {
      showStatsError('통계를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      return;
    }
    const allDays = result.body?.days;
    if (result.status === 200 && Array.isArray(allDays) && allDays.length) {
      showStatsError(null);
      const split = Math.max(0, allDays.length - rangeDays);
      renderStats(result.body, allDays.slice(split), allDays.slice(0, split));
      return;
    }
    if (result.status === 401) {
      showLogin('로그인이 끝났습니다. 다시 로그인해 주세요.');
      return;
    }
    if (result.status === 404 || result.status === 503) {
      showOff(result.status);
      return;
    }
    showStatsError('통계를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  }

  for (const button of document.querySelectorAll('.admin-range button')) {
    button.addEventListener('click', () => {
      const days = Number(button.dataset.days);
      if (!RANGES.includes(days) || days === rangeDays) return;
      rangeDays = days;
      loadStats();
    });
  }

  checkSession();
})();
