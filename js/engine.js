'use strict';
/*
 * May Attorney - 대사 파일 기반 비주얼노벨 / 법정 게임 엔진
 * 대사 파일 작성법은 README.md 를 참고하세요.
 */

/* ===================== 설정 ===================== */
const CONFIG = {
  TEXT_DIR: 'text/',            // 대사 파일 폴더
  START_SCENE: 'scene01',       // 새 게임 시작 장면
  GAMEOVER_SCENE: 'gameover',   // HP가 0이 되면 가는 장면
  NO_SAVE_SCENES: ['gameover'], // 자동 저장하지 않는 장면
  TYPE_SPEED: 30,               // 글자 출력 속도(ms)
  PUNCT_PAUSE: {                // 문장부호 뒤에서 잠깐 쉼(ms) → 말하는 리듬
    ',': 120, '~': 120, '.': 260, '!': 260, '?': 260, '…': 320,
  },
  MOUTH_MS: 100,                 // 입 모양을 바꾸는 간격(ms)
  TALK_BOB_PX: 3,               // 말할 때 고개가 위아래로 움직이는 최대 폭(px)
  TALK_TILT_DEG: 0.8,           // 말할 때 고개가 기울어지는 최대 각도(도)
  MAX_TALK_FRAMES: 3,           // _talk1 ~ _talk3 까지 찾음
  BLINK_MIN_MS: 2200,           // 눈 깜빡임 간격(ms, 이 사이에서 무작위)
  BLINK_MAX_MS: 5500,
  MAX_HP: 5,                    // 재판 신뢰도
  PLAYER: '메이',                // 플레이어 캐릭터 (@player hide 상태에선 그림을 띄우지 않음)
  SAVE_KEY: 'may_attorney_save_v1',
};

/* ===================== 상태 ===================== */
const G = {};
function resetState() {
  Object.assign(G, {
    scene: null, lines: [], labels: {}, idx: 0,
    evidence: [],            // { id, name, desc }
    hp: CONFIG.MAX_HP, hpVisible: false,
    playerVisible: false,    // false: 플레이어 시점 (메이 그림 안 보임)
    charsVisible: true,      // false: 상황 설명 장면 (누가 말해도 캐릭터 그림 안 보임)
    stack: [],               // @return 으로 돌아갈 지점
    cross: null,             // 반대신문 상태
    crossActive: false,
    presentReq: null,        // @present 요청
    busy: false, loading: false, choosing: false, ended: false,
    char: null, log: [],
  });
}
resetState();

const sceneCache = {};
const typing = { timer: null, full: '', i: 0, talker: null };
const $ = id => document.getElementById(id);

/* ===================== 대사 파일 파싱 ===================== */
// # 주석 / *라벨 / @명령 인자 / 캐릭터|표정: 대사 [press=#라벨] [present=증거:#라벨]
function parseScene(text) {
  const lines = [], labels = {};
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith('#')) continue;
    if (s.startsWith('*')) { labels[s.slice(1).trim()] = lines.length; continue; }
    if (s.startsWith('@')) {
      const sp = s.search(/\s/);
      lines.push({
        type: 'cmd',
        cmd: (sp < 0 ? s.slice(1) : s.slice(1, sp)).toLowerCase(),
        arg: sp < 0 ? '' : s.slice(sp + 1).trim(),
      });
      continue;
    }
    lines.push(parseSay(s));
  }
  return { lines, labels };
}

function parseSay(s) {
  let press = null, m;
  const present = {};
  while ((m = s.match(/\s*\[(\w+)\s*=\s*([^\]]*)\]\s*$/))) {
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'press') press = val;
    if (key === 'present') {
      const c = val.indexOf(':');
      if (c > 0) present[val.slice(0, c).trim()] = val.slice(c + 1).trim();
    }
    s = s.slice(0, m.index);
  }
  m = s.match(/^([^:|]*?)(?:\|([^:]*?))?\s*:\s*(.*)$/);
  if (!m) return { type: 'say', who: '', face: '', text: s, press, present };
  return { type: 'say', who: m[1].trim(), face: (m[2] || '').trim() || 'normal', text: m[3], press, present };
}

/* ===================== 장면 이동 ===================== */
async function fetchScene(name) {
  if (!sceneCache[name]) {
    const res = await fetch(CONFIG.TEXT_DIR + encodeURIComponent(name) + '.txt', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${CONFIG.TEXT_DIR}${name}.txt 을(를) 찾을 수 없습니다 (${res.status})`);
    sceneCache[name] = parseScene(await res.text());
  }
  return sceneCache[name];
}

// "#라벨" 을 "장면#라벨" 로 바꿈
const absTarget = (t, scene) => (t.startsWith('#') ? scene + t : t);

// target: "장면" | "#라벨" | "장면#라벨"
async function jump(target) {
  G.loading = true;
  try {
    target = target.trim();
    const h = target.indexOf('#');
    const prevScene = G.scene;
    let scene = G.scene, label = null;
    if (h === 0) label = target.slice(1).trim();
    else if (h > 0) { scene = target.slice(0, h).trim(); label = target.slice(h + 1).trim(); }
    else scene = target;

    if (h !== 0) {
      const data = await fetchScene(scene);
      G.scene = scene; G.lines = data.lines; G.labels = data.labels;
    }
    if (label) {
      if (!(label in G.labels)) throw new Error(`${G.scene}.txt 에 *${label} 라벨이 없습니다`);
      G.idx = G.labels[label];
    } else {
      G.idx = 0;
    }
    // 다른 장면으로 넘어갈 때만 자동 저장 (같은 장면 안의 라벨 이동은 저장 안 함)
    if (h !== 0 && (!label || scene !== prevScene)) autosave(target);
  } catch (e) {
    G.loading = false;
    showError(e.message);
    return;
  }
  G.loading = false;
  run();
}

/* ===================== 진행 ===================== */
function next() {
  if (G.busy || G.loading || G.choosing || modalOpen() || !$('title-screen').hidden) return;
  if (typing.timer) { finishTyping(); return; }
  if (G.ended) { showTitle(); return; }
  if (G.crossActive) { crossStep(1); return; }
  run();
}

function run() {
  $('next-mark').hidden = true;
  while (G.idx < G.lines.length) {
    const l = G.lines[G.idx++];
    if (l.type === 'cmd') {
      if (exec(l)) return;   // true: 진행을 멈추고 기다림
      continue;
    }
    say(l);
    return;
  }
  showError(`${G.scene}.txt 가 @goto 나 @end 없이 끝났습니다.`);
}

function exec({ cmd, arg }) {
  switch (cmd) {
    case 'bg':        hideChar(); setBg(arg); return false;   // 장소가 바뀌면 캐릭터도 지움
    case 'player':    playerCmd(arg); return false;
    case 'chars':     charsCmd(arg); return false;
    case 'show': {
      const [who, face] = arg.split('|').map(s => s.trim());
      showChar(who, face || 'normal');
      return false;
    }
    case 'hide':      hideChar(); return false;
    case 'bgm':       playBgm(arg); return false;
    case 'se':        playSe(arg); return false;
    case 'shake':     shake(arg === 'big'); return false;
    case 'flash':     flash(arg || 'white'); return false;
    case 'evidence':  evidenceCmd(arg); return false;
    case 'hp':        hpCmd(arg); return false;
    case 'penalty':   return penalty(parseInt(arg, 10) || 1);
    case 'wait':      pause(parseInt(arg, 10) || 500, run); return true;
    case 'title':     showCard(arg); return true;
    case 'objection': showBanner(arg || '이의 있음!', false, run); return true;
    case 'goto':      jump(arg); return true;
    case 'choice':    showChoices(arg); return true;
    case 'cross':     startCross(arg); return true;
    case 'endcross':  return false;
    case 'present':   askPresent(arg); return true;
    case 'return':    doReturn(); return true;
    case 'totitle':   showTitle(); return true;
    case 'end':       endGame(arg); return true;
    default:
      console.warn(`[${G.scene}] 알 수 없는 명령어: @${cmd}`);
      return false;
  }
}

function pause(ms, fn) {
  G.busy = true;
  setTimeout(() => { G.busy = false; fn(); }, ms);
}

/* ===================== 대사 출력 ===================== */
function say(l, testimony = false) {
  const thought = l.text.startsWith('(');
  $('name').textContent = l.who;
  $('line').className = testimony ? 'testimony' : thought ? 'thought' : '';
  // 플레이어 시점일 때 메이가 말하면 그림을 바꾸지 않고 대화 상대를 그대로 보여줌
  const hidePlayer = l.who === CONFIG.PLAYER && !G.playerVisible;
  if (l.who && !hidePlayer && G.charsVisible) showChar(l.who, l.face);
  startTyping(l.text, l.who && !thought ? l.who : null);
  G.log.push({ who: l.who, text: l.text });
  if (G.log.length > 500) G.log.shift();
}

function startTyping(text, talker) {
  clearTimeout(typing.timer);
  Object.assign(typing, { full: text, i: 0, talker, voiced: false });
  $('line').textContent = '';
  $('next-mark').hidden = true;
  if (!text) { finishTyping(); return; }
  typing.timer = setTimeout(typeNext, CONFIG.TYPE_SPEED);
}

function typeNext() {
  const ch = typing.full[typing.i++];
  $('line').textContent = typing.full.slice(0, typing.i);
  if (/[\p{L}\p{N}]/u.test(ch)) typing.voiced = true;   // 소리 나는 글자 → 입을 열 신호
  if (typing.i >= typing.full.length) { finishTyping(); return; }
  // 문장부호 뒤에선 쉼. "..." 처럼 이어지면 마지막 부호 뒤에서만 쉼
  const pause = CONFIG.PUNCT_PAUSE[ch];
  const nextIsPunct = typing.full[typing.i] in CONFIG.PUNCT_PAUSE;
  typing.timer = setTimeout(typeNext, pause && !nextIsPunct ? pause : CONFIG.TYPE_SPEED);
}

function finishTyping() {
  clearTimeout(typing.timer);
  typing.timer = null;
  $('line').textContent = typing.full;
  $('next-mark').hidden = G.crossActive;
}

/* ===================== 이미지 ===================== */
const imgCache = {};
function imageExists(url) {
  if (!(url in imgCache)) {
    imgCache[url] = new Promise(resolve => {
      const im = new Image();
      im.onload = () => resolve(true);
      im.onerror = () => resolve(false);
      im.src = url;
    });
  }
  return imgCache[url];
}

function hue(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

let bgReq = 0;
async function setBg(name) {
  const req = ++bgReq, el = $('bg'), label = $('bg-label');
  if (!name || name === 'none' || name === 'black') {
    el.style.backgroundImage = ''; el.style.backgroundColor = '#000'; label.textContent = '';
    return;
  }
  const url = `img/bg/${name}.png`;
  const ok = await imageExists(url);
  if (req !== bgReq) return;
  if (ok) {
    el.style.backgroundImage = `url("${url}")`;
    label.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.style.backgroundColor = `hsl(${hue(name)}, 28%, 20%)`;
    label.textContent = `배경: ${name} (img/bg/${name}.png 없음)`;
  }
}

// 캐릭터: img/char/이름_표정.png
//   말하는 입 모양 (선택): 이름_표정_talk.png  또는  이름_표정_talk1.png, _talk2.png, _talk3.png
//   눈 깜빡임 (선택):     이름_표정_blink.png (감은 눈),  이름_표정_blink_half.png (반쯤 감은 눈)
// 이미지가 없으면 이름/표정이 적힌 임시 실루엣을 보여줌
let charReq = 0;
async function showChar(who, face) {
  if (G.char && G.char.who === who && G.char.face === face && !$('char').hidden) return;
  const req = ++charReq;
  const pre = `img/char/${who}_${face}`;
  const talkUrls = [`${pre}_talk.png`];
  for (let i = 1; i <= CONFIG.MAX_TALK_FRAMES; i++) talkUrls.push(`${pre}_talk${i}.png`);
  const urls = [`${pre}.png`, `${pre}_blink.png`, `${pre}_blink_half.png`, ...talkUrls];
  const ok = await Promise.all(urls.map(imageExists));
  if (req !== charReq) return;

  const hasBase = ok[0];
  const prevWho = G.char && !$('char').hidden ? G.char.who : null;
  G.char = {
    who, face,
    base: hasBase ? urls[0] : null,
    blink: hasBase && ok[1] ? urls[1] : null,
    blinkHalf: hasBase && ok[2] ? urls[2] : null,
    talk: hasBase ? talkUrls.filter((u, i) => ok[3 + i]) : [],
  };
  anim.mouth = 0; anim.eye = 0;

  const el = $('char'), img = $('char-img'), ph = $('char-ph');
  if (hasBase) {
    img.setAttribute('src', G.char.base);
    img.hidden = false; ph.hidden = true;
  } else {
    img.hidden = true; ph.hidden = false;
    ph.querySelector('.ph-name').textContent = who;
    ph.querySelector('.ph-face').textContent = face;
    ph.style.setProperty('--c', `hsl(${hue(who)}, 45%, 42%)`);
  }
  el.hidden = false;
  // 다른 캐릭터로 바뀔 때만 살짝 페이드인 (표정만 바뀔 땐 그대로)
  if (prevWho !== who) {
    el.classList.remove('enter');
    void el.offsetWidth;
    el.classList.add('enter');
  }
  renderChar();
}

// @player show : 플레이어도 화면에 나옴 (법정)
// @player hide : 플레이어 시점 - 메이가 말해도 상대방 그림 유지 (일상 대화)
function playerCmd(arg) {
  G.playerVisible = arg === 'show';
  if (!G.playerVisible && G.char && G.char.who === CONFIG.PLAYER) hideChar();
}

// @chars hide : 상황 설명 장면 - 배경만 보이고, 누가 말해도 캐릭터 그림을 띄우지 않음
// @chars show : 다시 말하는 캐릭터를 보여줌 (@show 로 직접 띄우는 건 hide 중에도 가능)
function charsCmd(arg) {
  G.charsVisible = arg !== 'hide';
  if (!G.charsVisible) hideChar();
}

function hideChar() {
  charReq++;
  G.char = null;
  anim.mouth = 0; anim.eye = 0;
  $('char').hidden = true;
}

/* ----- 입 / 눈 애니메이션 ----- */
// mouth: 0 = 다문 입, 1~N = 입 모양 번호 / eye: 0 = 뜬 눈, 1 = 반쯤 감음, 2 = 감음
const anim = { mouth: 0, eye: 0 };
const PH_MOUTH_FRAMES = 3;   // 임시 실루엣의 입 모양 수

function renderChar() {
  const c = G.char;
  if (!c) return;
  if (c.base) {
    let want = c.base;
    if (anim.mouth > 0 && c.talk.length) want = c.talk[(anim.mouth - 1) % c.talk.length];
    else if (anim.eye === 2 && c.blink) want = c.blink;
    else if (anim.eye === 1 && c.blinkHalf) want = c.blinkHalf;
    const img = $('char-img');
    if (img.getAttribute('src') !== want) img.setAttribute('src', want);
  } else {
    const ph = $('char-ph');
    ph.dataset.mouth = anim.mouth;
    ph.dataset.eye = anim.eye;
  }
}

// 말하는 동안: 글자가 나온 순간에만 입을 열고, 매번 다른 입 모양을 무작위로 고름.
// 띄어쓰기·문장부호에서 쉬는 동안엔 자연스럽게 입이 닫힘.
setInterval(() => {
  const c = G.char;
  if (!c) return;
  const talking = !!typing.timer && typing.talker === c.who && typing.voiced;
  typing.voiced = false;
  const frames = c.base ? c.talk.length : PH_MOUTH_FRAMES;
  if (!talking || !frames) {
    anim.mouth = 0;
  } else if (anim.mouth > 0 && Math.random() < (frames === 1 ? 0.7 : 0.3)) {
    anim.mouth = 0;                                  // 가끔 입을 다물어 리듬을 줌
  } else {
    let m;
    do { m = 1 + Math.floor(Math.random() * frames); } while (frames > 1 && m === anim.mouth);
    anim.mouth = m;
  }
  // 말하는 동안 가끔 고개를 살짝 끄덕이고 기울임. 쉬는 동안엔 제자리로
  if (talking && Math.random() < 0.35) {
    setBob(-Math.random() * CONFIG.TALK_BOB_PX, (Math.random() * 2 - 1) * CONFIG.TALK_TILT_DEG);
  } else if (!talking && bobActive) {
    setBob(0, 0);
  }
  renderChar();
}, CONFIG.MOUTH_MS);

let bobActive = false;
function setBob(y, deg) {
  bobActive = y !== 0 || deg !== 0;
  for (const el of [$('char-img'), $('char-ph')]) {
    el.style.translate = `0 ${y.toFixed(1)}px`;
    el.style.rotate = `${deg.toFixed(2)}deg`;
  }
}

// 눈 깜빡임: 무작위 간격, 가끔 두 번 연속
const wait = ms => new Promise(r => setTimeout(r, ms));
async function setEye(e, ms) { anim.eye = e; renderChar(); if (ms) await wait(ms); }
async function blinkLoop() {
  for (;;) {
    await wait(CONFIG.BLINK_MIN_MS + Math.random() * (CONFIG.BLINK_MAX_MS - CONFIG.BLINK_MIN_MS));
    const c = G.char;
    if (!c || (c.base && !c.blink)) continue;
    const times = Math.random() < 0.2 ? 2 : 1;
    for (let k = 0; k < times; k++) {
      await setEye(1, 40);
      await setEye(2, 90);
      await setEye(1, 40);
      await setEye(0, times > 1 ? 140 : 0);
    }
  }
}
blinkLoop();

/* ===================== 사운드 ===================== */
// audio/bgm/이름.mp3, audio/se/이름.mp3 (파일이 없으면 조용히 무시)
let bgm = null, bgmName = '';
function playBgm(name) {
  if (name === bgmName) return;
  if (bgm) { bgm.pause(); bgm = null; }
  bgmName = name;
  if (!name || name === 'stop') { bgmName = ''; return; }
  bgm = new Audio(`audio/bgm/${name}.mp3`);
  bgm.loop = true; bgm.volume = 0.5;
  bgm.play().catch(() => {});
}
function playSe(name) {
  if (!name) return;
  const a = new Audio(`audio/se/${name}.mp3`);
  a.volume = 0.8;
  a.play().catch(() => {});
}

/* ===================== 연출 ===================== */
function shake(big) {
  const s = $('stage');
  s.classList.remove('shake', 'shake-big');
  void s.offsetWidth;
  s.classList.add(big ? 'shake-big' : 'shake');
}

function flash(color) {
  const f = $('flash');
  f.className = '';
  void f.offsetWidth;
  f.className = color === 'red' ? 'red' : 'white';
}

function showBanner(text, calm, then) {
  const b = $('banner');
  b.textContent = text;
  b.className = calm ? 'calm' : '';
  b.hidden = false;
  if (!calm) { shake(true); playSe('objection'); }
  pause(calm ? 1200 : 1100, () => { b.hidden = true; then(); });
}

// @title 날짜 / 장소  →  가운데 장소 카드
function showCard(text) {
  const c = $('card');
  c.textContent = text.split('/').map(s => s.trim()).join('\n');
  c.hidden = false;
  pause(2000, () => { c.hidden = true; run(); });
}

function toast(text) {
  const t = $('toast');
  t.hidden = true;
  void t.offsetWidth;
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ===================== 선택지 ===================== */
// @choice 보기1=대상 | 보기2=대상
function showChoices(arg) {
  G.choosing = true;
  const box = $('choices');
  box.innerHTML = '';
  for (const part of arg.split('|')) {
    const e = part.lastIndexOf('=');
    if (e < 0) continue;
    const label = part.slice(0, e).trim(), target = part.slice(e + 1).trim();
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = ev => {
      ev.stopPropagation();
      box.innerHTML = '';
      G.choosing = false;
      jump(target);
    };
    box.appendChild(btn);
  }
}

/* ===================== 증거 / HP ===================== */
// @evidence add 아이디 이름 | 설명   /   @evidence remove 아이디
function evidenceCmd(arg) {
  const m = arg.match(/^(\w+)\s+(\S+)\s*(.*)$/);
  if (!m) { console.warn('잘못된 @evidence:', arg); return; }
  const [, sub, id, rest] = m;
  if (sub === 'add') {
    const [name, ...desc] = rest.split('|').map(s => s.trim());
    if (!G.evidence.some(e => e.id === id)) {
      G.evidence.push({ id, name: name || id, desc: desc.join(' | ') });
      toast(`법정기록에 추가: ${name || id}`);
      playSe('get');
    }
  } else if (sub === 'remove') {
    G.evidence = G.evidence.filter(e => e.id !== id);
  }
}

// @hp show | hide | reset
function hpCmd(arg) {
  if (arg === 'show') G.hpVisible = true;
  else if (arg === 'hide') G.hpVisible = false;
  else if (arg === 'reset') G.hp = CONFIG.MAX_HP;
  renderHp();
}

function renderHp() {
  const el = $('hp');
  el.hidden = !G.hpVisible;
  el.innerHTML = '';
  for (let i = 0; i < CONFIG.MAX_HP; i++) {
    const s = document.createElement('span');
    if (i >= G.hp) s.className = 'lost';
    el.appendChild(s);
  }
}

function penalty(n) {
  G.hp = Math.max(0, G.hp - n);
  G.hpVisible = true;
  renderHp();
  flash('red'); shake(true); playSe('damage');
  if (G.hp <= 0) {
    leaveCross(false);
    G.stack = []; G.presentReq = null;
    pause(900, () => jump(CONFIG.GAMEOVER_SCENE));
    return true;
  }
  return false;
}

/* ===================== 법정기록 창 ===================== */
let evMode = 'view', evSelected = null;   // view | present | force

function openEvidence(mode) {
  if (!$('title-screen').hidden) return;
  if (typing.timer) finishTyping();
  evMode = mode;
  if (!G.evidence.some(e => e.id === evSelected)) evSelected = G.evidence[0]?.id ?? null;
  $('ev-heading').textContent = mode === 'view' ? '법정기록' : '제시할 증거를 고르세요';
  $('ev-present').hidden = mode === 'view';
  $('ev-close').hidden = mode === 'force';
  renderEvidence();
  $('evidence-modal').hidden = false;
}

function closeEvidence() {
  if (evMode === 'force') return;
  $('evidence-modal').hidden = true;
}

function renderEvidence() {
  const list = $('ev-list');
  list.innerHTML = '';
  if (!G.evidence.length) list.innerHTML = '<li class="empty">아직 증거가 없습니다.</li>';
  for (const e of G.evidence) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.textContent = e.name;
    b.className = e.id === evSelected ? 'selected' : '';
    b.onclick = () => { evSelected = e.id; renderEvidence(); };
    li.appendChild(b);
    list.appendChild(li);
  }
  const e = G.evidence.find(x => x.id === evSelected);
  const pic = $('ev-pic');
  $('ev-name').textContent = e ? e.name : '';
  $('ev-desc').textContent = e ? e.desc : '';
  $('ev-present').disabled = !e;
  pic.style.backgroundImage = ''; pic.textContent = '';
  if (e) {
    const url = `img/evidence/${e.id}.png`;
    pic.textContent = e.name[0];
    imageExists(url).then(ok => {
      if (ok && evSelected === e.id) { pic.textContent = ''; pic.style.backgroundImage = `url("${url}")`; }
    });
  }
}

function presentChosen() {
  const id = evSelected;
  if (!id) return;
  $('evidence-modal').hidden = true;
  evMode = 'view';

  // @present 로 요청된 경우
  if (G.presentReq) {
    const r = G.presentReq;
    G.presentReq = null;
    if (r.map[id]) { jump(absTarget(r.map[id], r.scene)); return; }
    if (r.wrong) {
      G.stack.push({ type: 'line', scene: r.scene, idx: r.idx });
      jump(absTarget(r.wrong, r.scene));
    } else {
      G.presentReq = r;
      openEvidence('force');
    }
    return;
  }

  // 반대신문 중 제시
  if (G.crossActive) {
    const c = G.cross, st = c.statements[c.i];
    if (st.present[id]) {
      leaveCross(false);
      jump(absTarget(st.present[id], c.scene));
    } else if (c.wrong) {
      leaveCross(true);
      G.stack.push({ type: 'cross' });
      jump(absTarget(c.wrong, c.scene));
    }
  }
}

// @present 증거=#라벨 | 증거2=#라벨 | wrong=#라벨
function askPresent(arg) {
  const map = {};
  let wrong = null;
  for (const part of arg.split('|')) {
    const e = part.indexOf('=');
    if (e < 0) continue;
    const k = part.slice(0, e).trim(), v = part.slice(e + 1).trim();
    if (k === 'wrong') wrong = v; else map[k] = v;
  }
  G.presentReq = { map, wrong, idx: G.idx - 1, scene: G.scene };
  openEvidence('force');
}

/* ===================== 반대신문 ===================== */
// @cross 증언 제목 | wrong=#라벨
//   증인: 증언 [press=#라벨] [present=증거:#라벨]
// @endcross
function startCross(arg) {
  const parts = arg.split('|').map(s => s.trim());
  let wrong = null;
  for (const p of parts.slice(1)) {
    const e = p.indexOf('=');
    if (e > 0 && p.slice(0, e).trim() === 'wrong') wrong = p.slice(e + 1).trim();
  }
  const statements = [];
  while (G.idx < G.lines.length) {
    const l = G.lines[G.idx++];
    if (l.type === 'cmd' && l.cmd === 'endcross') break;
    if (l.type === 'say') statements.push(l);
  }
  if (!statements.length) { showError(`${G.scene}.txt: @cross 안에 증언이 없습니다.`); return; }

  G.cross = { title: parts[0] || '증언', wrong, statements, i: -1, scene: G.scene };
  showBanner('반대신문 개시', true, () => {
    G.crossActive = true;
    crossStep(1);
  });
}

function crossStep(d) {
  const c = G.cross;
  let i = c.i + d;
  if (i >= c.statements.length) i = 0;   // 마지막 증언 다음 → 처음으로
  if (i < 0) i = 0;
  c.i = i;
  renderCrossUI();
  say(c.statements[i], true);
}

function renderCrossUI() {
  const c = G.cross;
  $('cross-bar').hidden = false;
  $('testimony-title').hidden = false;
  $('testimony-title').textContent = `〈 ${c.title} 〉 ${c.i + 1} / ${c.statements.length}`;
  $('cross-prev').disabled = c.i === 0;
  $('cross-press').disabled = !c.statements[c.i].press;
}

function leaveCross(suspend) {
  G.crossActive = false;
  if (!suspend) G.cross = null;
  $('cross-bar').hidden = true;
  $('testimony-title').hidden = true;
}

function crossPress() {
  if (!G.crossActive || G.busy || G.loading) return;
  if (typing.timer) finishTyping();
  const c = G.cross, st = c.statements[c.i];
  if (!st.press) return;
  leaveCross(true);
  G.stack.push({ type: 'cross' });
  jump(absTarget(st.press, c.scene));
}

function doReturn() {
  const r = G.stack.pop();
  if (!r) { showError(`${G.scene}.txt: 돌아갈 곳이 없는데 @return 이 실행되었습니다.`); return; }
  if (r.type === 'cross' && G.cross) {
    G.crossActive = true;
    crossStep(1);
  } else if (r.type === 'line') {
    G.loading = true;
    fetchScene(r.scene).then(data => {
      G.scene = r.scene; G.lines = data.lines; G.labels = data.labels; G.idx = r.idx;
      G.loading = false;
      run();
    });
  }
}

/* ===================== 대사기록 ===================== */
function openLog() {
  if (!$('title-screen').hidden) return;
  const list = $('log-list');
  list.innerHTML = '';
  for (const l of G.log) {
    const li = document.createElement('li');
    if (l.who) { const b = document.createElement('b'); b.textContent = l.who; li.appendChild(b); }
    li.appendChild(document.createTextNode(l.text));
    list.appendChild(li);
  }
  $('log-modal').hidden = false;
  list.scrollTop = list.scrollHeight;
}

const modalOpen = () => !$('evidence-modal').hidden || !$('log-modal').hidden;

/* ===================== 저장 / 타이틀 ===================== */
function autosave(target) {
  if (CONFIG.NO_SAVE_SCENES.includes(G.scene)) return;
  try {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({
      target, evidence: G.evidence, hp: G.hp, hpVisible: G.hpVisible, playerVisible: G.playerVisible,
      charsVisible: G.charsVisible,
    }));
  } catch (e) { /* 저장 불가 환경 */ }
}

function loadSave() {
  try { return JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY)); } catch (e) { return null; }
}

function clearScreen() {
  clearTimeout(typing.timer); typing.timer = null;
  playBgm('stop');
  hideChar();
  setBg('none');
  leaveCross(false);
  $('choices').innerHTML = '';
  $('name').textContent = ''; $('line').textContent = '';
  $('next-mark').hidden = true;
  $('evidence-modal').hidden = true; $('log-modal').hidden = true;
  $('banner').hidden = true; $('card').hidden = true;
  $('error').hidden = true;
}

function showTitle() {
  clearScreen();
  resetState();
  renderHp();
  $('btn-continue').disabled = !loadSave();
  $('title-screen').hidden = false;
}

function startGame(save) {
  clearScreen();
  resetState();
  if (save) {
    G.evidence = save.evidence || [];
    G.hp = save.hp ?? CONFIG.MAX_HP;
    G.hpVisible = !!save.hpVisible;
    G.playerVisible = !!save.playerVisible;
    G.charsVisible = save.charsVisible !== false;
  }
  renderHp();
  $('title-screen').hidden = true;
  jump(save ? save.target : CONFIG.START_SCENE);
}

function endGame(text) {
  leaveCross(false);
  $('name').textContent = '';
  $('line').className = '';
  startTyping(text || '— 끝 —', null);
  G.ended = true;
}

function showError(msg) {
  if (location.protocol === 'file:') {
    msg += '\n\nindex.html 을 더블클릭해서 열면 대사 파일을 읽을 수 없습니다.\n'
         + 'VS Code의 Live Server(Go Live) 또는 로컬 서버로 열어 주세요.';
  }
  $('error').textContent = msg;
  $('error').hidden = false;
  console.error(msg);
}

/* ===================== 입력 ===================== */
$('box').addEventListener('click', next);
$('btn-new').onclick = () => startGame(null);
$('btn-continue').onclick = () => { const s = loadSave(); if (s) startGame(s); };
$('btn-evidence').onclick = () => openEvidence(G.crossActive ? 'present' : 'view');
$('btn-log').onclick = openLog;
$('ev-close').onclick = closeEvidence;
$('ev-present').onclick = presentChosen;
$('log-close').onclick = () => { $('log-modal').hidden = true; };
$('cross-prev').onclick = () => { if (G.crossActive && !G.busy) crossStep(-1); };
$('cross-next').onclick = () => { if (G.crossActive && !G.busy) { if (typing.timer) finishTyping(); crossStep(1); } };
$('cross-press').onclick = crossPress;
$('cross-present').onclick = () => { if (G.crossActive && !G.busy) openEvidence('present'); };

document.addEventListener('keydown', e => {
  if (!$('title-screen').hidden) return;
  if (modalOpen()) {
    if (e.key === 'Escape') { closeEvidence(); $('log-modal').hidden = true; }
    return;
  }
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { e.preventDefault(); next(); }
  else if (k === 'arrowright' && G.crossActive) $('cross-next').click();
  else if (k === 'arrowleft' && G.crossActive) $('cross-prev').click();
  else if (k === 'e') $('btn-evidence').click();
  else if (k === 'l') openLog();
});

showTitle();
