// ===== CONFIG =====
const API = import.meta.env.VITE_API_URL || 'https://decifra-backend-production.up.railway.app'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const SUBJECTS = [
  { id: 'matematica',  label: 'Matemática',   color: '#3b82f6', emoji: '📐' },
  { id: 'portugues',   label: 'Português',    color: '#8b5cf6', emoji: '📖' },
  { id: 'biologia',    label: 'Biologia',     color: '#10b981', emoji: '🧬' },
  { id: 'quimica',     label: 'Química',      color: '#f59e0b', emoji: '⚗️' },
  { id: 'fisica',      label: 'Física',       color: '#ef4444', emoji: '⚡' },
  { id: 'historia',    label: 'História',     color: '#f97316', emoji: '🏛️' },
  { id: 'geografia',   label: 'Geografia',    color: '#06b6d4', emoji: '🌍' },
  { id: 'filosofia',   label: 'Filosofia',    color: '#a78bfa', emoji: '🤔' },
  { id: 'ingles',      label: 'Inglês',       color: '#ec4899', emoji: '🌐' },
]

const XP_LEVELS = [
  { name: 'Iniciante', emoji: '🌱', min: 0, max: 99, color: '#6b7280' },
  { name: 'Estudante', emoji: '📘', min: 100, max: 299, color: '#3b82f6' },
  { name: 'Veterano', emoji: '🎓', min: 300, max: 699, color: '#8b5cf6' },
  { name: 'Expert', emoji: '⭐', min: 700, max: 1499, color: '#f59e0b' },
  { name: 'Mestre', emoji: '🏆', min: 1500, max: Infinity, color: '#ef4444' },
]

const BADGES = [
  { id: 'first', icon: '🎯', name: 'Primeiro Passo', desc: '1ª questão respondida', check: p => p.totalQuestions >= 1 },
  { id: 'streak3', icon: '🔥', name: 'Em Chamas', desc: '3 dias seguidos de estudo', check: p => p.streak >= 3 },
  { id: 'streak7', icon: '⚡', name: 'Imparável', desc: '7 dias seguidos de estudo', check: p => p.streak >= 7 },
  { id: 'q50', icon: '📚', name: 'Estudioso', desc: '50 questões respondidas', check: p => p.totalQuestions >= 50 },
  { id: 'q100', icon: '💯', name: 'Centenário', desc: '100 questões respondidas', check: p => p.totalQuestions >= 100 },
  { id: 'acc80', icon: '🎖️', name: 'Precisão', desc: '80%+ de acertos (mín. 10 questões)', check: p => p.totalQuestions >= 10 && p.correct / p.totalQuestions >= 0.8 },
  { id: 'diag', icon: '🔬', name: 'Autoconhecimento', desc: 'Diagnóstico completo', check: () => !!state.diagnosticoDone },
  { id: 'xp500', icon: '🌟', name: 'Estrela em Ascensão', desc: '500 XP acumulados', check: (p, xp) => xp >= 500 },
]

// ===== STATE =====
const state = {
  user: null,
  token: null,
  plan: 'free',
  trialEnd: null,
  tab: 'inicio',
  tutor: { chatsBySubject: {}, subject: 'matematica', loading: false, used: 0, limit: 5 },
  simulado: { screen: 'menu', type: null, questions: [], current: 0, answers: [], timeLeft: 0, timer: null, score: null, loading: false },
  diag: { screen: 'intro', questions: [], current: 0, answers: [] },
  flashcards: { screen: 'menu', reviewIdx: 0, flipped: false },
  progresso: { totalQuestions: 0, correct: 0, streak: 0, subjects: {}, simuladosDone: 0 },
  plano: null,
  questaoHoje: null,
  questaoRespondida: false,
  onboarding: { done: false, prova: null, step: 0 },
  deferredInstall: null,
  xp: 0,
}

// ===== HELPERS =====
const $ = id => document.getElementById(id)
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e }
function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getToken() {
  return localStorage.getItem('decifra_token') || state.token
}

async function api(path, body, method = body ? 'POST' : 'GET') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro na requisição')
  return data
}

function saveLocal(key, val) { localStorage.setItem(`decifra_${key}`, JSON.stringify(val)) }
function loadLocal(key) { try { return JSON.parse(localStorage.getItem(`decifra_${key}`)) } catch { return null } }

function toast(msg, type = '') {
  document.querySelectorAll('.toast').forEach(t => t.remove())
  const t = el('div', `toast ${type}`, msg)
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3000)
}

function subjectClass(id) { return `subj-${id}` }
function subjectColor(id) { return SUBJECTS.find(s => s.id === id)?.color || '#3b82f6' }
function subjectLabel(id) { return SUBJECTS.find(s => s.id === id)?.label || id }

function getXpLevel(xp) { return [...XP_LEVELS].reverse().find(l => xp >= l.min) || XP_LEVELS[0] }
function getXpProgress(xp) { const l = getXpLevel(xp); if (l.max === Infinity) return 100; return Math.round(((xp - l.min) / (l.max - l.min)) * 100) }
function getEarnedBadges(prog, xp) { return BADGES.filter(b => b.check(prog, xp)) }

function planLabel(plan) {
  if (plan === 'trialing') return 'Trial'
  if (plan === 'active') return 'Pro'
  return 'Grátis'
}

function isPro() {
  return state.plan === 'active' || state.plan === 'trialing'
}

// ===== GAMIFICATION & PROGRESS HELPERS =====
const MISSION_GOAL = 5

function getDailyProgress() {
  const today = new Date().toDateString()
  return parseInt(localStorage.getItem(`decifra_daily_${today}`) || '0')
}

function incrementDailyProgress() {
  const today = new Date().toDateString()
  const key = `decifra_daily_${today}`
  const curr = parseInt(localStorage.getItem(key) || '0')
  const next = curr + 1
  localStorage.setItem(key, next)
  return next
}

function recordStudyToday() {
  const today = new Date().toISOString().slice(0, 10)
  const log = JSON.parse(localStorage.getItem('decifra_study_log') || '[]')
  if (!log.includes(today)) {
    log.push(today)
    if (log.length > 30) log.splice(0, log.length - 30)
    localStorage.setItem('decifra_study_log', JSON.stringify(log))
  }
}

function getActivityStrip() {
  const log = JSON.parse(localStorage.getItem('decifra_study_log') || '[]')
  const todayStr = new Date().toISOString().slice(0, 10)
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    days.push({ date: dateStr, label: dayName, studied: log.includes(dateStr), isToday: dateStr === todayStr })
  }
  return days
}

function checkAndShowNewBadges() {
  const currentBadges = getEarnedBadges(state.progresso, state.xp)
  const storedIds = JSON.parse(localStorage.getItem('decifra_earned_badges') || '[]')
  const newBadges = currentBadges.filter(b => !storedIds.includes(b.id))
  if (newBadges.length > 0) {
    localStorage.setItem('decifra_earned_badges', JSON.stringify(currentBadges.map(b => b.id)))
    showBadgeUnlockModal(newBadges[0])
  }
}

function showBadgeUnlockModal(badge) {
  const existing = document.querySelector('.badge-unlock-overlay')
  if (existing) existing.remove()
  const overlay = el('div', 'badge-unlock-overlay')
  overlay.innerHTML = `
    <div class="badge-unlock-card">
      <div class="badge-unlock-icon">${badge.icon}</div>
      <div class="badge-unlock-title">Conquista desbloqueada!</div>
      <div class="badge-unlock-name">${badge.name}</div>
      <div class="badge-unlock-desc">${badge.desc}</div>
      <button class="btn btn-primary" id="badgeOk" style="margin-top:1.5rem;width:100%">Incrível! 🎉</button>
    </div>
  `
  document.body.appendChild(overlay)
  document.getElementById('badgeOk').onclick = () => overlay.remove()
  overlay.onclick = e => { if (e.target === overlay) overlay.remove() }
  setTimeout(() => { if (overlay.parentNode) overlay.remove() }, 8000)
}

// ===== FLASHCARDS HELPERS =====
function loadFlashcardDeck() {
  return JSON.parse(localStorage.getItem('decifra_flashcards') || '[]')
}

function saveFlashcardDeck(deck) {
  localStorage.setItem('decifra_flashcards', JSON.stringify(deck))
}

function getDueCards(deck) {
  const today = new Date().toISOString().slice(0, 10)
  return deck.filter(c => !c.nextReview || c.nextReview <= today)
}

function rateCard(card, rating) {
  let { interval = 1, ease = 2.5 } = card
  if (rating === 1) { interval = 1; ease = Math.max(1.3, ease - 0.2) }
  else if (rating === 2) { interval = Math.max(1, Math.round(interval * ease)) }
  else { interval = Math.max(2, Math.round(interval * ease * 1.3)); ease = Math.min(3.0, ease + 0.1) }
  const next = new Date()
  next.setDate(next.getDate() + interval)
  return { ...card, interval, ease: Math.round(ease * 100) / 100, nextReview: next.toISOString().slice(0, 10), reps: (card.reps || 0) + 1 }
}

// ===== NOTIFICATIONS HELPERS =====
async function requestNotifPermission() {
  if (!('Notification' in window)) { toast('Seu navegador não suporta notificações.', ''); return }
  if (Notification.permission === 'granted') {
    localStorage.setItem('decifra_notif_enabled', 'true')
    toast('Notificações ativadas! 🔔', 'success')
    renderTab(state.tab)
    return
  }
  if (Notification.permission === 'denied') { toast('Notificações bloqueadas. Habilite nas configurações do navegador.', ''); return }
  const result = await Notification.requestPermission()
  if (result === 'granted') {
    localStorage.setItem('decifra_notif_enabled', 'true')
    toast('Notificações ativadas! 🔔', 'success')
    renderTab(state.tab)
  } else {
    toast('Permissão negada. Notificações não ativadas.', '')
  }
}

function disableNotifications() {
  localStorage.setItem('decifra_notif_enabled', 'false')
  toast('Notificações desativadas.', '')
  renderTab(state.tab)
}

function checkDailyNotification() {
  const notifEnabled = localStorage.getItem('decifra_notif_enabled') === 'true'
  if (!notifEnabled) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const today = new Date().toISOString().slice(0, 10)
  const lastNotif = localStorage.getItem('decifra_last_notif')
  if (lastNotif === today) return
  const hour = new Date().getHours()
  if (hour < 8) return
  const studyLog = JSON.parse(localStorage.getItem('decifra_study_log') || '[]')
  if (studyLog.includes(today)) return
  localStorage.setItem('decifra_last_notif', today)
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'NOTIFY',
        title: 'Decifra — hora de estudar! 📚',
        body: 'Você ainda não estudou hoje. Vamos manter o streak?'
      })
    } else {
      new Notification('Decifra — hora de estudar! 📚', {
        body: 'Você ainda não estudou hoje. Vamos manter o streak?',
        icon: '/icons/favicon.svg'
      })
    }
  } catch {}
}

// ===== AUTH =====
function renderAuth(mode = 'login') {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">Decifra<span>.</span></div>
        <div class="auth-tagline">Aprovação começa aqui</div>
        <div class="auth-tabs">
          <button class="auth-tab ${mode === 'login' ? 'active' : ''}" id="tabLogin">Entrar</button>
          <button class="auth-tab ${mode === 'register' ? 'active' : ''}" id="tabRegister">Criar conta</button>
        </div>
        <div id="authMsg"></div>
        <form id="authForm">
          ${mode === 'register' ? `
          <div class="form-group">
            <label class="form-label">Nome</label>
            <input type="text" class="form-input" id="authName" placeholder="Seu nome" required>
          </div>` : ''}
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="authEmail" placeholder="seu@email.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <input type="password" class="form-input" id="authPassword" placeholder="${mode === 'register' ? 'Mínimo 6 caracteres' : 'Sua senha'}" required autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="authSubmit">
            ${mode === 'login' ? 'Entrar' : 'Criar conta grátis'}
          </button>
        </form>
        <div class="auth-footer">
          ${mode === 'login'
            ? `Não tem conta? <a href="#" id="switchAuth">Criar grátis</a>`
            : `Já tem conta? <a href="#" id="switchAuth">Entrar</a>`}
        </div>
      </div>
    </div>
  `
  document.getElementById('tabLogin').onclick = () => renderAuth('login')
  document.getElementById('tabRegister').onclick = () => renderAuth('register')
  document.getElementById('switchAuth').onclick = e => { e.preventDefault(); renderAuth(mode === 'login' ? 'register' : 'login') }
  document.getElementById('authForm').onsubmit = e => handleAuth(e, mode)
}

async function handleAuth(e, mode) {
  e.preventDefault()
  const email = document.getElementById('authEmail').value.trim()
  const password = document.getElementById('authPassword').value
  const name = mode === 'register' ? document.getElementById('authName')?.value.trim() : undefined
  const btn = document.getElementById('authSubmit')
  const msg = document.getElementById('authMsg')

  btn.disabled = true
  btn.textContent = mode === 'login' ? 'Entrando...' : 'Criando conta...'
  msg.innerHTML = ''

  try {
    const data = await api(`/api/auth/${mode}`, { email, password, name })
    state.user = data.user
    state.token = data.token
    state.plan = data.plan || 'free'
    localStorage.setItem('decifra_token', data.token)
    localStorage.setItem('decifra_user', JSON.stringify(data.user))
    localStorage.setItem('decifra_plan', data.plan || 'free')
    await loadUserData()
    if (mode === 'register' && !loadLocal('onboarding_done')) {
      renderOnboarding()
    } else {
      renderApp()
    }
  } catch (err) {
    msg.innerHTML = `<div class="error-msg">${err.message}</div>`
    btn.disabled = false
    btn.textContent = mode === 'login' ? 'Entrar' : 'Criar conta grátis'
  }
}

async function loadUserData() {
  try {
    const data = await api('/api/user/me')
    state.plan = data.plan || 'free'
    state.trialEnd = data.trialEnd
    state.xp = data.xp || 0
    state.diagnosticoDone = data.diagnosticoDone || false
    state.progresso = data.progresso || state.progresso
    if (data.plan) localStorage.setItem('decifra_plan', data.plan)
  } catch {}
}

function logout() {
  localStorage.removeItem('decifra_token')
  localStorage.removeItem('decifra_user')
  localStorage.removeItem('decifra_plan')
  localStorage.removeItem('decifra_plano_cache')
  state.user = null
  state.token = null
  state.plan = 'free'
  state.plano = null
  renderAuth('login')
}

// ===== ONBOARDING =====
const ONBOARDING_STEPS = [
  {
    icon: '🎯',
    title: 'Qual é a sua prova?',
    text: 'Vamos personalizar sua experiência com base no seu objetivo.',
    options: ['ENEM 2026', 'Vestibular (FUVEST/UNICAMP/outros)', 'Concurso Público Federal', 'Concurso Público Estadual', 'Concurso Público Municipal', 'Militar (ESPCEX/AFA/outros)', 'Ainda não decidi'],
    key: 'prova'
  },
  {
    icon: '📅',
    title: 'Quando é a prova?',
    text: 'Isso vai ajudar a montar um cronograma realista pra você.',
    options: ['Em menos de 3 meses', 'Em 3 a 6 meses', 'Em 6 a 12 meses', 'Em mais de 1 ano'],
    key: 'prazo'
  },
  {
    icon: '🧠',
    title: 'Qual matéria você mais precisa melhorar?',
    text: 'Vamos focar mais nessa área no seu plano de estudo.',
    options: ['Matemática', 'Português / Redação', 'Ciências da Natureza', 'Ciências Humanas', 'Inglês / Língua Estrangeira', 'Raciocínio Lógico', 'Todas precisam melhorar'],
    key: 'fraqueza'
  },
]

function renderOnboarding() {
  const step = state.onboarding.step
  const s = ONBOARDING_STEPS[step]
  const app = document.getElementById('app')

  const dots = ONBOARDING_STEPS.map((_, i) =>
    `<div class="onb-dot ${i === step ? 'active' : ''}"></div>`
  ).join('')

  const options = s.options.map(opt =>
    `<button class="onb-option" data-val="${opt}">${opt}</button>`
  ).join('')

  app.innerHTML = `
    <div class="onboarding-overlay">
      <div class="onboarding-card">
        <div class="onb-step-dots">${dots}</div>
        <div class="onb-icon">${s.icon}</div>
        <div class="onb-title">${s.title}</div>
        <p class="onb-text">${s.text}</p>
        <div class="onb-options">${options}</div>
        <button class="btn btn-primary btn-full" id="onbNext" disabled>Continuar</button>
        ${step > 0 ? `<button class="btn btn-ghost btn-full" id="onbBack" style="margin-top:0.5rem">Voltar</button>` : ''}
      </div>
    </div>
  `

  let selected = null
  document.querySelectorAll('.onb-option').forEach(opt => {
    opt.onclick = () => {
      document.querySelectorAll('.onb-option').forEach(o => o.classList.remove('selected'))
      opt.classList.add('selected')
      selected = opt.dataset.val
      document.getElementById('onbNext').disabled = false
    }
  })

  document.getElementById('onbNext').onclick = () => {
    if (!selected) return
    state.onboarding[s.key] = selected
    if (step < ONBOARDING_STEPS.length - 1) {
      state.onboarding.step++
      renderOnboarding()
    } else {
      saveLocal('onboarding_done', true)
      saveLocal('onboarding_data', state.onboarding)
      api('/api/user/onboarding', state.onboarding).catch(() => {})
      renderApp()
    }
  }

  if (document.getElementById('onbBack')) {
    document.getElementById('onbBack').onclick = () => { state.onboarding.step--; renderOnboarding() }
  }
}

// ===== APP SHELL =====
const TABS = [
  { id: 'inicio', label: 'Início', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
  { id: 'tutor', label: 'Tutor', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>` },
  { id: 'simulados', label: 'Simulados', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>` },
  { id: 'progresso', label: 'Progresso', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>` },
  { id: 'mais', label: 'Mais', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>` },
]

function renderApp() {
  const app = document.getElementById('app')
  const user = state.user || loadLocal('user') || JSON.parse(localStorage.getItem('decifra_user') || '{}')
  const plan = state.plan || localStorage.getItem('decifra_plan') || 'free'
  state.plan = plan

  const tabs = TABS.map(t => `
    <button class="tab-item ${state.tab === t.id ? 'active' : ''}" data-tab="${t.id}">
      ${t.icon}
      <span class="tab-label">${t.label}</span>
    </button>
  `).join('')

  const initial = (user?.name || user?.email || 'U')[0].toUpperCase()

  app.innerHTML = `
    <div class="app-layout">
      <header class="app-header">
        <div class="header-logo">Decifra<span>.</span></div>
        <div class="header-right">
          <span class="streak-badge">🔥 ${state.progresso?.streak || 0}</span>
          <span class="plan-badge ${plan === 'active' ? 'pro' : plan === 'trialing' ? 'trialing' : 'free'}">${planLabel(plan)}</span>
          <div class="avatar" id="userAvatar">${initial}</div>
        </div>
      </header>
      <main class="app-content" id="appContent"></main>
      <nav class="app-tabs" id="appTabs">${tabs}</nav>
    </div>
  `

  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab)
  })
  document.getElementById('userAvatar').onclick = () => switchTab('mais')

  renderTab(state.tab)
  if (state.deferredInstall) renderInstallBanner()
}

function switchTab(id) {
  state.tab = id
  document.querySelectorAll('.tab-item').forEach(b => b.classList.toggle('active', b.dataset.tab === id))
  renderTab(id)
}

function renderTab(id) {
  const content = document.getElementById('appContent')
  if (!content) return
  content.scrollTop = 0
  switch (id) {
    case 'inicio':      renderInicio(content); break
    case 'tutor':       renderTutor(content); break
    case 'simulados':   renderSimulados(content); break
    case 'progresso':   renderProgresso(content); break
    case 'mais':        renderMais(content); break
    case 'diagnostico': renderDiagnosticoScreen(content); break
    case 'plano':       renderPlanoEstudo(content); break
    case 'redacao':     renderRedacao(content); break
    case 'flashcards':  renderFlashcards(content); break
  }
}

// ===== TAB: INÍCIO =====
async function renderInicio(container) {
  const prog = state.progresso
  const user = JSON.parse(localStorage.getItem('decifra_user') || '{}')
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = user?.name?.split(' ')[0] || 'Aluno'
  const dailyDone = getDailyProgress()
  const missionDone = dailyDone >= MISSION_GOAL
  const missionPct = Math.min(100, Math.round((dailyDone / MISSION_GOAL) * 100))

  const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const todayDayName = DAY_NAMES[new Date().getDay()]
  const SUBJ_EMOJI_MAP = { matematica: '📐', portugues: '📖', biologia: '🧬', quimica: '⚗️', fisica: '⚡', historia: '🏛️', geografia: '🌍', filosofia: '🤔', ingles: '🌐' }
  const todayPlan = state.plano?.dias?.find(d => d.dia === todayDayName) || null

  container.innerHTML = `
    <div class="inicio-greeting">
      <div class="greeting-text">${saudacao}, ${nome}! 👋</div>
      <div class="greeting-sub">Continue de onde parou — seu progresso está salvo.</div>
    </div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value text-accent">🔥${prog.streak || 0}</div>
        <div class="stat-label">Dias seguidos</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-primary">${prog.totalQuestions || 0}</div>
        <div class="stat-label">Questões</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-success">${prog.totalQuestions ? Math.round((prog.correct / prog.totalQuestions) * 100) : 0}%</div>
        <div class="stat-label">Acertos</div>
      </div>
    </div>
    <div class="mission-card ${missionDone ? 'mission-done' : ''}">
      <div class="mission-icon">${missionDone ? '✅' : '⚡'}</div>
      <div class="mission-info">
        <div class="mission-title">Missão do dia</div>
        <div class="mission-desc">${missionDone ? 'Missão concluída! 🎉' : `Responda ${MISSION_GOAL} questões hoje`}</div>
      </div>
      <div class="mission-right">
        <div class="mission-count" id="missionCount">${Math.min(dailyDone, MISSION_GOAL)}/${MISSION_GOAL}</div>
        <div class="mission-bar"><div class="mission-bar-fill ${missionDone ? 'done' : ''}" id="missionFill" style="width:${missionPct}%"></div></div>
      </div>
    </div>
    <div id="questaoHojeContainer"></div>
    ${todayPlan ? `
    <div class="card hoje-plano">
      <div class="hoje-plano-header">
        <span class="hoje-plano-title">📋 Hoje no seu plano</span>
        <button class="btn btn-ghost btn-sm" data-action="plano">Ver plano</button>
      </div>
      <div class="hoje-plano-items">
        ${todayPlan.materias.map(m => `
          <div class="hoje-plano-item">
            <span class="hoje-plano-emoji">${SUBJ_EMOJI_MAP[m.materia] || '📚'}</span>
            <div class="hoje-plano-info">
              <span class="hoje-plano-subj">${subjectLabel(m.materia)}</span>
              <span class="hoje-plano-topic">${m.topico} · ${m.minutos}min</span>
            </div>
            <button class="btn btn-primary btn-sm" data-plano-study="${m.materia}">Estudar</button>
          </div>
        `).join('')}
      </div>
    </div>` : ''}
    <div class="quick-actions">
      <div class="quick-title">Acesso rápido</div>
      <div class="quick-grid">
        <button class="quick-btn" data-action="tutor">
          <div class="quick-btn-icon">💬</div>
          <div class="quick-btn-label">Tutor</div>
          <div class="quick-btn-sub">Tirar dúvidas</div>
        </button>
        <button class="quick-btn" data-action="simulado-mini">
          <div class="quick-btn-icon">⚡</div>
          <div class="quick-btn-label">Mini-simulado</div>
          <div class="quick-btn-sub">10 questões</div>
        </button>
        <button class="quick-btn" data-action="simulado">
          <div class="quick-btn-icon">📝</div>
          <div class="quick-btn-label">Simulado</div>
          <div class="quick-btn-sub">ENEM completo</div>
        </button>
        <button class="quick-btn" data-action="flashcard">
          <div class="quick-btn-icon">🃏</div>
          <div class="quick-btn-label">Flashcards</div>
          <div class="quick-btn-sub">Revisão espaçada</div>
        </button>
        <button class="quick-btn" data-action="redacao">
          <div class="quick-btn-icon">✍️</div>
          <div class="quick-btn-label">Redação</div>
          <div class="quick-btn-sub">IA 0–1000</div>
        </button>
        <button class="quick-btn" data-action="diagnostico">
          <div class="quick-btn-icon">🔬</div>
          <div class="quick-btn-label">Diagnóstico</div>
          <div class="quick-btn-sub">Descubra seu nível</div>
        </button>
      </div>
    </div>
  `

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = () => {
      const a = btn.dataset.action
      if (a === 'tutor') switchTab('tutor')
      else if (a === 'simulado') { switchTab('simulados') }
      else if (a === 'simulado-mini') { state.simulado.type = 'mini'; switchTab('simulados'); startSimulado('mini') }
      else if (a === 'flashcard') switchTab('flashcards')
      else if (a === 'redacao') switchTab('redacao')
      else if (a === 'diagnostico') switchTab('diagnostico')
      else if (a === 'plano') switchTab('plano')
    }
  })

  container.querySelectorAll('[data-plano-study]').forEach(btn => {
    btn.onclick = () => {
      state.tutor.subject = btn.dataset.planoStudy
      switchTab('tutor')
    }
  })

  await renderQuestaoHoje()
}

async function renderQuestaoHoje() {
  const container = document.getElementById('questaoHojeContainer')
  if (!container) return

  try {
    if (!state.questaoHoje) {
      const data = await api('/api/questao-do-dia')
      state.questaoHoje = data.questao
    }
    const q = state.questaoHoje
    if (!q) return

    const opts = q.options.map((opt, i) => {
      const letter = String.fromCharCode(65 + i)
      return `<button class="questao-option" data-idx="${i}"><span class="option-letter">${letter}</span>${opt}</button>`
    }).join('')

    container.innerHTML = `
      <div class="questao-dia">
        <div class="questao-dia-header">
          <span class="questao-dia-label">⭐ Questão do dia</span>
          <span class="subject-chip ${subjectClass(q.subject)}">${subjectLabel(q.subject)}</span>
        </div>
        <div class="questao-dia-body">
          <div class="questao-enunciado">${q.question}</div>
          <div class="questao-options" id="qdOpts">${opts}</div>
          <div id="qdFeedback"></div>
        </div>
      </div>
    `

    if (state.questaoRespondida) {
      document.querySelectorAll('.questao-option').forEach((btn, i) => {
        btn.disabled = true
        if (i === q.answerIndex) btn.classList.add('correct')
      })
      return
    }

    container.querySelectorAll('.questao-option').forEach(btn => {
      btn.onclick = () => answerQuestaoHoje(parseInt(btn.dataset.idx), q)
    })
  } catch {}
}

function answerQuestaoHoje(idx, q) {
  state.questaoRespondida = true
  const isCorrect = idx === q.answerIndex
  document.querySelectorAll('.questao-option').forEach((btn, i) => {
    btn.disabled = true
    if (i === q.answerIndex) btn.classList.add('correct')
    else if (i === idx && !isCorrect) btn.classList.add('wrong')
  })
  const fb = document.getElementById('qdFeedback')
  if (fb) {
    fb.innerHTML = `
      <div class="quiz-explanation">
        <strong>${isCorrect ? '✅ Correto!' : '❌ Errado'}</strong>
        ${q.explanation}
      </div>
    `
  }
  if (isCorrect) {
    state.progresso.correct = (state.progresso.correct || 0) + 1
    state.xp = (state.xp || 0) + 10
    toast('Correto! +10 XP 🎉', 'success')
  } else {
    state.xp = (state.xp || 0) + 2
    toast('Quase! Veja a explicação abaixo.', '')
  }
  state.progresso.totalQuestions = (state.progresso.totalQuestions || 0) + 1
  if (!state.progresso.subjects) state.progresso.subjects = {}
  if (!state.progresso.subjects[q.subject]) state.progresso.subjects[q.subject] = { total: 0, correct: 0 }
  state.progresso.subjects[q.subject].total++
  if (isCorrect) state.progresso.subjects[q.subject].correct++
  saveLocal('progresso', state.progresso)
  const dailyCount = incrementDailyProgress()
  recordStudyToday()
  checkAndShowNewBadges()
  const mFill = document.getElementById('missionFill')
  const mCount = document.getElementById('missionCount')
  if (mFill) {
    const pct = Math.min(100, Math.round((dailyCount / MISSION_GOAL) * 100))
    mFill.style.width = `${pct}%`
    if (dailyCount >= MISSION_GOAL) mFill.classList.add('done')
  }
  if (mCount) mCount.textContent = `${Math.min(dailyCount, MISSION_GOAL)}/${MISSION_GOAL}`
  api('/api/user/resposta', { questaoId: q.id, correct: isCorrect, subject: q.subject })
    .then(res => {
      if (res?.streak !== undefined) {
        state.progresso.streak = res.streak
        const badge = document.querySelector('.streak-badge')
        if (badge) badge.textContent = `🔥 ${res.streak}`
      }
    })
    .catch(() => {})
}

// ===== TAB: TUTOR =====
function renderTutor(container) {
  const subjectBtns = SUBJECTS.map(s =>
    `<button class="subject-btn ${state.tutor.subject === s.id ? 'active' : ''}" data-subj="${s.id}">${s.emoji} ${s.label}</button>`
  ).join('')

  const used = state.tutor.used || 0
  const limit = isPro() ? '∞' : `${used}/${state.tutor.limit}`
  const limitBar = !isPro() ? `
    <div class="free-limit-banner">
      <span>Tutor: ${limit} perguntas hoje</span>
      <button class="limit-upgrade" id="tutorUpgrade">Upgrade →</button>
    </div>
  ` : ''

  container.innerHTML = `
    <div class="tutor-layout" style="height: calc(100vh - 56px - 64px); height: calc(100dvh - 56px - 64px);">
      <div class="tutor-subjects">${subjectBtns}</div>
      ${limitBar}
      <div class="tutor-messages" id="tutorMessages"></div>
      <div class="tutor-input-area">
        <button class="practice-btn" id="tutorPractice" title="Gerar questão de prática">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
        <textarea class="tutor-textarea" id="tutorInput" placeholder="Digite sua dúvida..." rows="1"></textarea>
        <button class="send-btn" id="tutorSend">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `

  container.querySelectorAll('.subject-btn').forEach(btn => {
    btn.onclick = () => {
      state.tutor.subject = btn.dataset.subj
      renderTutor(container)
    }
  })

  const messagesDiv = document.getElementById('tutorMessages')
  const subjMsgsNow = state.tutor.chatsBySubject[state.tutor.subject] || []
  if (subjMsgsNow.length === 0) {
    const subj = SUBJECTS.find(s => s.id === state.tutor.subject)
    messagesDiv.innerHTML = `
      <div class="msg msg-tutor">
        Olá! Sou seu tutor de <strong>${subj?.label}</strong>. ${subj?.emoji}<br><br>
        Pode me perguntar qualquer coisa — desde o básico até questões de prova. Como posso ajudar?
      </div>
    `
  } else {
    renderMessages(messagesDiv)
  }

  const input = document.getElementById('tutorInput')
  const sendBtn = document.getElementById('tutorSend')

  input.addEventListener('input', () => {
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 120) + 'px'
  })
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTutorMessage() }
  })
  sendBtn.onclick = () => sendTutorMessage()

  if (document.getElementById('tutorUpgrade')) {
    document.getElementById('tutorUpgrade').onclick = () => renderUpgradeModal()
  }

  document.getElementById('tutorPractice').onclick = () => generatePracticeQuestion(container)
}

async function generatePracticeQuestion(container) {
  const subj = state.tutor.subject
  const subjLabel = SUBJECTS.find(s => s.id === subj)?.label || subj

  if (!state.tutor.chatsBySubject[subj]) state.tutor.chatsBySubject[subj] = []
  const subjMsgs = state.tutor.chatsBySubject[subj]
  subjMsgs.push({ role: 'assistant', content: `⭐ Gerando questão de prática de ${subjLabel}...` })
  state.tutor.loading = true
  const msgs = document.getElementById('tutorMessages')
  if (msgs) renderMessages(msgs)

  try {
    const data = await api('/api/questao/generate', { subject: subj, difficulty: 'medio' })
    const q = data.questao
    const letters = ['A', 'B', 'C', 'D', 'E']
    const optsText = q.options.map((o, i) => `${letters[i]}) ${o}`).join('\n')
    const questionCard = `📝 **Questão de ${subjLabel}**\n\n${q.question}\n\n${optsText}\n\n_Responda a letra correta e explico o gabarito!_`

    subjMsgs[subjMsgs.length - 1] = { role: 'assistant', content: questionCard, _questao: q }
  } catch {
    subjMsgs[subjMsgs.length - 1] = { role: 'assistant', content: 'Erro ao gerar questão. Tente novamente.' }
  }

  state.tutor.loading = false
  const m2 = document.getElementById('tutorMessages')
  if (m2) renderMessages(m2)
}

function renderMessages(container) {
  const msgs = state.tutor.chatsBySubject[state.tutor.subject] || []
  container.innerHTML = msgs.map(m => `
    <div class="msg ${m.role === 'user' ? 'msg-user' : 'msg-tutor'}">${m.content.replace(/\n/g, '<br>')}</div>
  `).join('')
  if (state.tutor.loading) {
    container.innerHTML += `<div class="msg msg-tutor typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`
  }
  container.scrollTop = container.scrollHeight
}

async function sendTutorMessage() {
  const input = document.getElementById('tutorInput')
  const text = input?.value.trim()
  if (!text || state.tutor.loading) return

  if (!isPro() && state.tutor.used >= state.tutor.limit) {
    renderUpgradeModal()
    return
  }

  const subj = state.tutor.subject
  if (!state.tutor.chatsBySubject[subj]) state.tutor.chatsBySubject[subj] = []
  const subjMsgs = state.tutor.chatsBySubject[subj]

  subjMsgs.push({ role: 'user', content: text })
  state.tutor.loading = true
  state.tutor.used++
  if (input) { input.value = ''; input.style.height = 'auto' }

  const msgs = document.getElementById('tutorMessages')
  if (msgs) renderMessages(msgs)

  try {
    const data = await api('/api/tutor/chat', {
      messages: subjMsgs,
      subject: subj,
    })
    subjMsgs.push({ role: 'assistant', content: data.reply })
  } catch (err) {
    subjMsgs.push({ role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.' })
  }

  state.tutor.loading = false
  const m2 = document.getElementById('tutorMessages')
  if (m2) renderMessages(m2)
}

// ===== TAB: SIMULADOS =====
function renderSimulados(container) {
  if (state.simulado.screen === 'quiz') { renderQuiz(container); return }
  if (state.simulado.screen === 'result') { renderResults(container); return }

  container.innerHTML = `
    <div class="simulado-screen">
      <div class="panel-header">
        <div>
          <div class="panel-title">Simulados</div>
          <div class="panel-sub">Escolha o tipo e comece agora</div>
        </div>
      </div>
      <div class="simulado-types">
        <div class="simulado-type-card" data-type="mini">
          <div class="simulado-type-info">
            <h3>Mini-simulado</h3>
            <p>10 questões variadas · Rápido e objetivo</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~15 min</span>
              <span class="meta-chip">10 questões</span>
              <span class="meta-chip">Gratuito</span>
            </div>
          </div>
          <div class="simulado-type-icon">⚡</div>
        </div>
        <div class="simulado-type-card" data-type="enem">
          <div class="simulado-type-info">
            <h3>ENEM</h3>
            <p>Todas as matérias · Análise por área</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~45 min</span>
              <span class="meta-chip">30 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">📝</div>
        </div>
        <div class="simulado-type-card" data-type="vestibular">
          <div class="simulado-type-info">
            <h3>Vestibular</h3>
            <p>FUVEST, UNICAMP, UEL e outros</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~30 min</span>
              <span class="meta-chip">20 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🎓</div>
        </div>
        <div class="simulado-type-card" data-type="concurso">
          <div class="simulado-type-info">
            <h3>Concurso Público</h3>
            <p>Raciocínio lógico, português, conhecimentos gerais</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~30 min</span>
              <span class="meta-chip">20 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🏛️</div>
        </div>
      </div>
      ${!isPro() ? `
      <div class="card" style="background:var(--primary-glow); border-color:rgba(59,130,246,0.3);">
        <div style="display:flex;gap:0.75rem;align-items:center;">
          <div style="font-size:1.5rem">⭐</div>
          <div>
            <div style="font-weight:700;font-size:0.9rem">Simulados ilimitados com Pro</div>
            <div style="color:var(--text2);font-size:0.8rem;margin-top:0.25rem">7 dias grátis para testar tudo</div>
          </div>
          <button class="btn btn-primary btn-sm" id="simUpgrade">Ver planos</button>
        </div>
      </div>` : ''}
    </div>
  `

  container.querySelectorAll('[data-type]').forEach(card => {
    card.onclick = () => {
      const type = card.dataset.type
      if (type !== 'mini' && !isPro()) { renderUpgradeModal(); return }
      startSimulado(type)
    }
  })

  if (document.getElementById('simUpgrade')) {
    document.getElementById('simUpgrade').onclick = () => renderUpgradeModal()
  }
}

async function startSimulado(type) {
  state.simulado.type = type
  state.simulado.screen = 'loading'
  state.simulado.loading = true

  const content = document.getElementById('appContent')
  if (content) content.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div><p style="color:var(--text2);font-size:0.875rem">Preparando simulado...</p></div>`

  try {
    const data = await api('/api/simulado/start', { type })
    state.simulado.questions = data.questions
    state.simulado.current = 0
    state.simulado.answers = []
    state.simulado.timeLeft = data.timeLimit
    state.simulado.screen = 'quiz'
    state.simulado.loading = false
    renderTab('simulados')
    startTimer()
  } catch (err) {
    toast('Erro ao carregar simulado. Tente novamente.', 'error')
    state.simulado.screen = 'menu'
    renderTab('simulados')
  }
}

function startTimer() {
  clearInterval(state.simulado.timer)
  state.simulado.timer = setInterval(() => {
    if (state.simulado.screen !== 'quiz') { clearInterval(state.simulado.timer); return }
    state.simulado.timeLeft--
    updateTimerDisplay()
    if (state.simulado.timeLeft <= 0) { clearInterval(state.simulado.timer); finishSimulado() }
  }, 1000)
}

function updateTimerDisplay() {
  const el = document.getElementById('quizTimer')
  if (!el) return
  const m = Math.floor(state.simulado.timeLeft / 60)
  const s = state.simulado.timeLeft % 60
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`
  el.parentElement.className = `quiz-timer ${state.simulado.timeLeft < 120 ? 'warning' : ''}`
}

function renderQuiz(container) {
  const { questions, current, answers } = state.simulado
  if (!questions.length) { state.simulado.screen = 'menu'; renderTab('simulados'); return }
  const q = questions[current]
  const answered = answers[current] !== undefined

  const opts = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i)
    let cls = 'questao-option'
    if (answered) {
      if (i === q.answerIndex) cls += ' correct'
      else if (i === answers[current] && i !== q.answerIndex) cls += ' wrong'
      else if (i === answers[current]) cls += ' selected'
    }
    return `<button class="questao-option${answered ? (i === q.answerIndex ? ' correct' : (i === answers[current] ? ' wrong' : '')) : ''}" data-idx="${i}" ${answered ? 'disabled' : ''}>
      <span class="option-letter">${letter}</span>${opt}
    </button>`
  }).join('')

  const progress = Math.round((current / questions.length) * 100)
  const m = Math.floor(state.simulado.timeLeft / 60)
  const s = state.simulado.timeLeft % 60

  container.innerHTML = `
    <div class="quiz-screen" style="height:100%;">
      <div class="quiz-header">
        <button class="btn btn-ghost btn-sm" id="quizExit" style="padding:0.4rem">✕</button>
        <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${progress}%"></div></div>
        <span class="quiz-counter">${current + 1}/${questions.length}</span>
        <div class="quiz-timer ${state.simulado.timeLeft < 120 ? 'warning' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="quizTimer">${m}:${s.toString().padStart(2, '0')}</span>
        </div>
      </div>
      <div class="quiz-body">
        <div class="quiz-subject-label" style="color:${subjectColor(q.subject)}">${subjectLabel(q.subject)} · ${q.year || 'ENEM'}</div>
        <div class="quiz-enunciado">${q.question}</div>
        <div class="quiz-options" id="quizOpts">${opts}</div>
        ${answered ? `<div class="quiz-explanation"><strong>${answers[current] === q.answerIndex ? '✅ Correto!' : '❌ Errado'}</strong>${q.explanation}</div>` : ''}
      </div>
      <div class="quiz-footer">
        ${current > 0 ? `<button class="btn btn-outline" id="quizPrev">← Anterior</button>` : '<div></div>'}
        ${answered
          ? current < questions.length - 1
            ? `<button class="btn btn-primary" id="quizNext">Próxima →</button>`
            : `<button class="btn btn-primary" id="quizFinish">Ver resultado</button>`
          : `<button class="btn btn-ghost" id="quizSkip">Pular</button>`}
      </div>
    </div>
  `

  if (!answered) {
    container.querySelectorAll('[data-idx]').forEach(btn => {
      btn.onclick = () => answerQuiz(parseInt(btn.dataset.idx))
    })
  }

  document.getElementById('quizExit')?.addEventListener('click', () => {
    clearInterval(state.simulado.timer)
    state.simulado.screen = 'menu'
    renderTab('simulados')
  })
  document.getElementById('quizPrev')?.addEventListener('click', () => { state.simulado.current--; renderTab('simulados') })
  document.getElementById('quizNext')?.addEventListener('click', () => { state.simulado.current++; renderTab('simulados') })
  document.getElementById('quizSkip')?.addEventListener('click', () => {
    state.simulado.answers[current] = -1
    if (current < questions.length - 1) { state.simulado.current++; renderTab('simulados') }
    else finishSimulado()
  })
  document.getElementById('quizFinish')?.addEventListener('click', () => finishSimulado())
}

function answerQuiz(idx) {
  const { current, questions } = state.simulado
  state.simulado.answers[current] = idx
  const isCorrect = idx === questions[current].answerIndex
  if (isCorrect) state.progresso.correct = (state.progresso.correct || 0) + 1
  state.progresso.totalQuestions = (state.progresso.totalQuestions || 0) + 1

  const subj = questions[current].subject
  if (!state.progresso.subjects[subj]) state.progresso.subjects[subj] = { total: 0, correct: 0 }
  state.progresso.subjects[subj].total++
  if (isCorrect) state.progresso.subjects[subj].correct++

  saveLocal('progresso', state.progresso)
  incrementDailyProgress()
  recordStudyToday()
  renderTab('simulados')
}

async function finishSimulado() {
  clearInterval(state.simulado.timer)
  state.simulado.screen = 'result'

  const { questions, answers } = state.simulado
  let correct = 0
  const bySubject = {}
  questions.forEach((q, i) => {
    const isCorrect = answers[i] === q.answerIndex
    if (isCorrect) correct++
    if (!bySubject[q.subject]) bySubject[q.subject] = { total: 0, correct: 0 }
    bySubject[q.subject].total++
    if (isCorrect) bySubject[q.subject].correct++
  })

  state.simulado.score = { correct, total: questions.length, bySubject }
  recordStudyToday()
  api('/api/simulado/finish', { type: state.simulado.type, score: state.simulado.score })
    .then(res => {
      if (res?.xpGain) state.xp = (state.xp || 0) + res.xpGain
      checkAndShowNewBadges()
    })
    .catch(() => {})
  renderTab('simulados')
}

function renderResults(container) {
  const { score } = state.simulado
  if (!score) { state.simulado.screen = 'menu'; renderTab('simulados'); return }

  const pct = Math.round((score.correct / score.total) * 100)
  const nota = Math.round((score.correct / score.total) * 1000)

  const subjRows = Object.entries(score.bySubject).map(([subj, data]) => {
    const p = Math.round((data.correct / data.total) * 100)
    const color = p >= 70 ? '#10b981' : p >= 50 ? '#f59e0b' : '#ef4444'
    return `
      <div class="results-subj-item">
        <span>${subjectLabel(subj)}</span>
        <div class="subj-bar-container"><div class="subj-bar-fill" style="width:${p}%;background:${color}"></div></div>
        <span style="font-weight:700;color:${color}">${p}%</span>
      </div>
    `
  }).join('')

  const scoreColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  container.innerHTML = `
    <div class="results-screen">
      <div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.5px;">Resultado do simulado</div>
      <svg class="results-ring" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface2)" stroke-width="10"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="${scoreColor}" stroke-width="10"
          stroke-dasharray="${2 * Math.PI * 50}"
          stroke-dashoffset="${2 * Math.PI * 50 * (1 - pct/100)}"
          stroke-linecap="round" transform="rotate(-90 60 60)"/>
        <text x="60" y="55" text-anchor="middle" fill="white" font-size="20" font-weight="800">${pct}%</text>
        <text x="60" y="72" text-anchor="middle" fill="var(--text2)" font-size="10">${score.correct}/${score.total}</text>
      </svg>
      ${state.simulado.type === 'enem' ? `<div style="color:var(--text2);font-size:0.875rem;margin-bottom:1rem">Nota estimada ENEM: <strong style="color:${scoreColor}">${nota}</strong></div>` : ''}
      ${Object.keys(score.bySubject).length > 1 ? `
        <div class="results-subjects">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;">Por matéria</div>
          ${subjRows}
        </div>` : ''}
      <div style="display:flex;gap:0.75rem;margin-top:1.5rem;">
        <button class="btn btn-outline" id="resBack" style="flex:1">Novo simulado</button>
        <button class="btn btn-primary" id="resReview" style="flex:1">Ver gabarito</button>
      </div>
      ${score.correct < score.total ? `<button class="btn btn-outline btn-full" id="resSaveFlash" style="margin-top:0.75rem">🃏 Salvar erros como flashcards</button>` : ''}
    </div>
  `

  document.getElementById('resBack').onclick = () => { state.simulado.screen = 'menu'; renderTab('simulados') }
  document.getElementById('resReview').onclick = () => { state.simulado.screen = 'quiz'; state.simulado.current = 0; renderTab('simulados') }

  document.getElementById('resSaveFlash')?.addEventListener('click', () => {
    const { questions, answers } = state.simulado
    const today = new Date().toISOString().slice(0, 10)
    const wrongCards = questions.filter((q, i) => answers[i] !== undefined && answers[i] !== -1 && answers[i] !== q.answerIndex)
    if (wrongCards.length === 0) { toast('Nenhum erro para salvar.', ''); return }
    const deck = loadFlashcardDeck()
    wrongCards.forEach(q => {
      deck.push({
        id: `sim_${q.id}_${Date.now()}`,
        subject: q.subject,
        front: q.question.length > 250 ? q.question.slice(0, 250) + '...' : q.question,
        back: `✅ ${q.options[q.answerIndex]}\n\n${q.explanation}`,
        interval: 1, ease: 2.5, nextReview: today, reps: 0, createdAt: today
      })
    })
    saveFlashcardDeck(deck)
    toast(`${wrongCards.length} erros salvos como flashcards! 🃏`, 'success')
  })
}

// ===== TAB: PROGRESSO =====
function renderProgresso(container) {
  const p = state.progresso
  const xp = state.xp || 0
  const pct = p.totalQuestions > 0 ? Math.round((p.correct / p.totalQuestions) * 100) : 0
  const level = getXpLevel(xp)
  const lvlPct = getXpProgress(xp)
  const nextLevel = XP_LEVELS[XP_LEVELS.indexOf(level) + 1]
  const badges = getEarnedBadges(p, xp)

  const subjRows = SUBJECTS.map(s => {
    const data = p.subjects?.[s.id] || { total: 0, correct: 0 }
    const sp = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
    const color = data.total === 0 ? 'var(--surface2)' : sp >= 70 ? '#10b981' : sp >= 50 ? '#f59e0b' : '#ef4444'
    const textColor = data.total === 0 ? 'var(--text3)' : color
    return `
      <div class="subj-perf-item">
        <span class="subj-perf-name">${s.emoji} ${s.label.split(' ')[0]}</span>
        <div class="subj-perf-bar"><div class="subj-perf-fill" style="width:${sp}%;background:${color}"></div></div>
        <span class="subj-perf-pct" style="color:${textColor}">${data.total === 0 ? '—' : sp + '%'}</span>
      </div>
    `
  }).join('')

  const badgesHtml = badges.length > 0
    ? badges.map(b => `
        <div class="badge-item">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-info"><div class="badge-name">${b.name}</div><div class="badge-desc">${b.desc}</div></div>
        </div>
      `).join('')
    : `<div style="color:var(--text3);font-size:0.85rem;text-align:center;padding:0.5rem 0">Responda questões e faça o Diagnóstico para ganhar conquistas!</div>`

  const activityDays = getActivityStrip()
  const activityHtml = activityDays.map(d => `
    <div class="activity-day ${d.studied ? 'active' : ''} ${d.isToday ? 'today' : ''}">
      <div class="activity-dot"></div>
      <div class="activity-label">${d.label}</div>
    </div>
  `).join('')

  container.innerHTML = `
    <div class="progresso-screen">
      <div class="panel-title" style="margin-bottom:1rem">Meu Progresso</div>

      <div class="card xp-card">
        <div class="xp-header">
          <span class="xp-level-name" style="color:${level.color}">${level.emoji} ${level.name}</span>
          <span class="xp-total">${xp} XP</span>
        </div>
        <div class="xp-bar"><div class="xp-bar-fill" style="width:${lvlPct}%;background:${level.color}"></div></div>
        <div class="xp-label">${nextLevel ? `${xp - level.min} / ${level.max - level.min} XP para ${nextLevel.emoji} ${nextLevel.name}` : 'Nível máximo! 🏆'}</div>
      </div>

      <div class="card" style="margin-bottom:1.25rem">
        <div class="card-title">Atividade — últimos 7 dias</div>
        <div class="activity-strip">${activityHtml}</div>
      </div>

      <div class="progresso-overview">
        <div class="prog-card">
          <div class="prog-card-value text-primary">${p.totalQuestions || 0}</div>
          <div class="prog-card-label">Questões</div>
        </div>
        <div class="prog-card">
          <div class="prog-card-value text-success">${pct}%</div>
          <div class="prog-card-label">Acertos</div>
        </div>
        <div class="prog-card">
          <div class="prog-card-value text-accent">🔥${p.streak || 0}</div>
          <div class="prog-card-label">Dias seguidos</div>
        </div>
        <div class="prog-card">
          <div class="prog-card-value" style="color:var(--purple)">${p.simuladosDone || 0}</div>
          <div class="prog-card-label">Simulados</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Conquistas ${badges.length}/${BADGES.length}</div>
        <div class="badges-grid">${badgesHtml}</div>
      </div>

      <div class="card">
        <div class="card-title">Por matéria</div>
        <div class="subj-performance">${subjRows}</div>
      </div>
    </div>
  `
}

// ===== TAB: MAIS =====
function renderMais(container) {
  const user = JSON.parse(localStorage.getItem('decifra_user') || '{}')
  const plan = state.plan
  const initial = (user?.name || user?.email || 'U')[0].toUpperCase()
  const notifEnabled = localStorage.getItem('decifra_notif_enabled') === 'true'

  container.innerHTML = `
    <div class="mais-screen">
      <div class="mais-user-section">
        <div class="mais-avatar">${initial}</div>
        <div>
          <div class="mais-user-name">${user?.name || 'Aluno'}</div>
          <div class="mais-user-email">${user?.email || ''}</div>
          <div class="mais-user-plan">${plan === 'active' ? '⭐ Pro' : plan === 'trialing' ? '⏳ Trial ativo' : '🆓 Plano Grátis'}</div>
        </div>
      </div>

      ${!isPro() ? `
      <button class="btn btn-primary btn-full" id="maisUpgrade" style="margin-bottom:1rem">
        ⭐ Ativar Pro — 7 dias grátis
      </button>` : ''}

      <div class="mais-section-title">Ferramentas de estudo</div>
      <div class="mais-grid">
        <div class="mais-item" data-action="diagnostico">
          <div class="mais-icon">🔬</div>
          <div class="mais-info">
            <div class="mais-label">Diagnóstico</div>
            <div class="mais-sub">Descubra seus pontos fortes e fracos</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="mais-item" data-action="plano">
          <div class="mais-icon">📋</div>
          <div class="mais-info">
            <div class="mais-label">Plano de Estudo</div>
            <div class="mais-sub">Cronograma semanal gerado por IA</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="mais-item" data-action="redacao">
          <div class="mais-icon">✍️</div>
          <div class="mais-info">
            <div class="mais-label">Correção de Redação</div>
            <div class="mais-sub">Nota 0-1000 nas 5 competências ENEM</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="mais-item" data-action="flashcards">
          <div class="mais-icon">🃏</div>
          <div class="mais-info">
            <div class="mais-label">Flashcards</div>
            <div class="mais-sub">Revisão espaçada por matéria</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      <div class="mais-section-title">Configurações</div>
      <div class="mais-grid">
        <div class="mais-item" data-action="notif">
          <div class="mais-icon">🔔</div>
          <div class="mais-info">
            <div class="mais-label">Notificações diárias</div>
            <div class="mais-sub">${notifEnabled ? 'Ativadas — lembrete diário de estudo' : 'Desativadas'}</div>
          </div>
          <div class="mais-notif-toggle ${notifEnabled ? 'on' : ''}">${notifEnabled ? 'ON' : 'OFF'}</div>
        </div>
      </div>

      <div class="mais-section-title">Conta</div>
      <div class="mais-grid">
        <div class="mais-item" data-action="planos">
          <div class="mais-icon">💳</div>
          <div class="mais-info">
            <div class="mais-label">Planos e assinatura</div>
            <div class="mais-sub">Gerenciar plano atual</div>
          </div>
        </div>
        <div class="mais-item" data-action="logout">
          <div class="mais-icon">🚪</div>
          <div class="mais-info">
            <div class="mais-label">Sair</div>
            <div class="mais-sub">Fazer logout da conta</div>
          </div>
        </div>
      </div>
    </div>
  `

  container.querySelectorAll('[data-action]').forEach(item => {
    item.onclick = () => {
      const a = item.dataset.action
      if (a === 'logout') logout()
      else if (a === 'planos') renderUpgradeModal()
      else if (a === 'diagnostico') switchTab('diagnostico')
      else if (a === 'plano') switchTab('plano')
      else if (a === 'redacao') switchTab('redacao')
      else if (a === 'flashcards') switchTab('flashcards')
      else if (a === 'notif') { if (notifEnabled) disableNotifications(); else requestNotifPermission() }
    }
  })

  document.getElementById('maisUpgrade')?.addEventListener('click', () => renderUpgradeModal())
}

// ===== DIAGNÓSTICO =====
function renderDiagnosticoScreen(container) {
  const { screen } = state.diag

  if (screen === 'loading') {
    container.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div><p style="color:var(--text2);font-size:0.875rem">Carregando diagnóstico...</p></div>`
    return
  }
  if (screen === 'quiz') { renderDiagQuiz(container); return }
  if (screen === 'result') { renderDiagResult(container); return }

  // intro
  const done = loadLocal('diagnostico_done')
  container.innerHTML = `
    <div class="diag-screen">
      <div class="diag-intro">
        <div class="diag-intro-icon">🔬</div>
        <h2 class="diag-title">Diagnóstico</h2>
        <p class="diag-sub">Responda questões de cada matéria e descubra seus pontos fortes e fracos.</p>
        <div class="diag-bullets">
          <div class="diag-bullet">✓ 9 questões — 1 por matéria</div>
          <div class="diag-bullet">✓ Sem limite de tempo</div>
          <div class="diag-bullet">✓ Relatório personalizado</div>
        </div>
      </div>
      ${done ? `<div class="card" style="margin-bottom:1rem;text-align:center"><div style="font-size:0.8rem;color:var(--text2)">Diagnóstico anterior</div><div style="font-size:0.9rem;font-weight:600;margin-top:0.25rem;color:var(--success)">Concluído ✅</div></div>` : ''}
      <button class="btn btn-primary btn-full" id="diagStart">${done ? 'Refazer Diagnóstico' : 'Iniciar Diagnóstico'}</button>
      <button class="btn btn-ghost btn-full" id="diagBack" style="margin-top:0.5rem">Voltar</button>
    </div>
  `
  document.getElementById('diagStart').onclick = () => startDiagnostico()
  document.getElementById('diagBack').onclick = () => switchTab('mais')
}

async function startDiagnostico() {
  state.diag.screen = 'loading'
  state.diag.questions = []
  state.diag.current = 0
  state.diag.answers = []
  renderTab('diagnostico')
  try {
    const data = await api('/api/simulado/start', { type: 'diagnostico' })
    state.diag.questions = data.questions
    state.diag.screen = 'quiz'
    renderTab('diagnostico')
  } catch {
    toast('Erro ao carregar diagnóstico. Tente novamente.', 'error')
    state.diag.screen = 'intro'
    renderTab('diagnostico')
  }
}

function renderDiagQuiz(container) {
  const { questions, current, answers } = state.diag
  const q = questions[current]
  const answered = answers[current] !== undefined
  const total = questions.length
  const progress = Math.round((current / total) * 100)

  const opts = q.options.map((opt, i) => {
    let cls = 'questao-option'
    if (answered) {
      if (i === q.answerIndex) cls += ' correct'
      else if (i === answers[current] && i !== q.answerIndex) cls += ' wrong'
    }
    return `<button class="${cls}" data-idx="${i}" ${answered ? 'disabled' : ''}><span class="option-letter">${String.fromCharCode(65 + i)}</span>${opt}</button>`
  }).join('')

  container.innerHTML = `
    <div class="quiz-screen" style="height:100%">
      <div class="quiz-header">
        <button class="btn btn-ghost btn-sm" id="diagExit" style="padding:0.4rem">✕</button>
        <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${progress}%"></div></div>
        <span class="quiz-counter">${current + 1}/${total}</span>
        <span class="subject-chip ${subjectClass(q.subject)}" style="font-size:0.65rem;white-space:nowrap">${subjectLabel(q.subject)}</span>
      </div>
      <div class="quiz-body">
        <div class="quiz-enunciado">${q.question}</div>
        <div class="quiz-options">${opts}</div>
        ${answered ? `<div class="quiz-explanation"><strong>${answers[current] === q.answerIndex ? '✅ Correto!' : '❌ Errado'}</strong>${q.explanation}</div>` : ''}
      </div>
      <div class="quiz-footer">
        ${answered
          ? current < total - 1
            ? `<button class="btn btn-primary btn-full" id="diagNext">Próxima →</button>`
            : `<button class="btn btn-primary btn-full" id="diagFinish">Ver resultado</button>`
          : '<div></div>'}
      </div>
    </div>
  `

  if (!answered) {
    container.querySelectorAll('[data-idx]').forEach(btn => {
      btn.onclick = () => { state.diag.answers[current] = parseInt(btn.dataset.idx); renderTab('diagnostico') }
    })
  }
  document.getElementById('diagExit').onclick = () => { state.diag.screen = 'intro'; renderTab('diagnostico') }
  const elNext = document.getElementById('diagNext')
  if (elNext) elNext.onclick = () => { state.diag.current++; renderTab('diagnostico') }
  const elFinish = document.getElementById('diagFinish')
  if (elFinish) elFinish.onclick = () => finishDiagnostico()
}

function finishDiagnostico() {
  const { questions, answers } = state.diag
  const bySubject = {}
  questions.forEach((q, i) => {
    const correct = answers[i] === q.answerIndex
    if (!bySubject[q.subject]) bySubject[q.subject] = { total: 0, correct: 0 }
    bySubject[q.subject].total++
    if (correct) bySubject[q.subject].correct++
    if (!state.progresso.subjects[q.subject]) state.progresso.subjects[q.subject] = { total: 0, correct: 0 }
    state.progresso.subjects[q.subject].total++
    if (correct) state.progresso.subjects[q.subject].correct++
    state.progresso.totalQuestions++
    if (correct) state.progresso.correct++
    api('/api/user/resposta', { questaoId: q.id, correct, subject: q.subject }).catch(() => {})
  })
  saveLocal('progresso', state.progresso)

  const weak = Object.entries(bySubject).filter(([, d]) => d.correct / d.total < 0.5).map(([s]) => s)
  const strong = Object.entries(bySubject).filter(([, d]) => d.correct / d.total >= 0.5).map(([s]) => s)
  state.diag.result = { bySubject, weak, strong }
  state.diag.screen = 'result'
  state.diagnosticoDone = true
  saveLocal('diagnostico_done', true)
  api('/api/diagnostico/save', { bySubject, weak, strong }).catch(() => {})
  renderTab('diagnostico')
  toast('Diagnóstico concluído! 🔬', 'success')
  recordStudyToday()
  checkAndShowNewBadges()
}

function renderDiagResult(container) {
  const { bySubject, weak, strong } = state.diag.result
  const total = Object.values(bySubject).reduce((a, d) => a + d.total, 0)
  const correct = Object.values(bySubject).reduce((a, d) => a + d.correct, 0)
  const pct = Math.round((correct / total) * 100)
  const scoreColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  const subjRows = Object.entries(bySubject).map(([s, d]) => {
    const sp = Math.round((d.correct / d.total) * 100)
    const icon = sp === 100 ? '✅' : sp === 0 ? '❌' : '🔸'
    return `
      <div class="diag-subj-row">
        <span>${icon}</span>
        <span class="diag-subj-name">${subjectLabel(s)}</span>
        <span style="font-weight:700;color:${sp >= 50 ? '#10b981' : '#ef4444'}">${sp}%</span>
      </div>
    `
  }).join('')

  const recommendation = weak.length > 0
    ? `Priorize ${weak.map(s => subjectLabel(s)).join(', ')} no seu plano de estudo.`
    : 'Excelente! Você está bem em todas as matérias. Continue praticando!'

  container.innerHTML = `
    <div class="diag-screen">
      <div class="diag-result-header">
        <div class="diag-result-score" style="color:${scoreColor}">${pct}%</div>
        <div class="diag-result-label">${correct} de ${total} questões corretas</div>
      </div>
      <div class="card">
        <div class="card-title">Resultado por matéria</div>
        ${subjRows}
      </div>
      <div class="card" style="background:var(--primary-glow);border-color:rgba(59,130,246,0.3)">
        <div class="card-title">📋 Recomendação</div>
        <div style="font-size:0.875rem;line-height:1.6">${recommendation}</div>
      </div>
      <button class="btn btn-primary btn-full" id="diagToPlano">Gerar Plano de Estudo →</button>
      <button class="btn btn-ghost btn-full" id="diagToMais" style="margin-top:0.5rem">Voltar ao menu</button>
    </div>
  `
  document.getElementById('diagToPlano').onclick = () => switchTab('plano')
  document.getElementById('diagToMais').onclick = () => { state.diag.screen = 'intro'; switchTab('mais') }
}

// ===== PLANO DE ESTUDO =====
async function renderPlanoEstudo(container) {
  container.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`
  if (!state.plano) {
    try {
      const data = await api('/api/plano-estudo')
      if (data.plan) { state.plano = data.plan; saveLocal('plano_cache', data.plan) }
    } catch {}
  }
  if (!state.plano) renderPlanoGerar(container)
  else renderPlanoSemana(container)
}

function renderPlanoGerar(container) {
  container.innerHTML = `
    <div class="plano-screen">
      <div class="plano-header">
        <div class="plano-icon">📋</div>
        <h2 class="plano-title">Plano de Estudo</h2>
        <p class="plano-sub">Cronograma semanal gerado por IA com base no seu perfil e desempenho.</p>
        <div class="diag-bullets">
          <div class="diag-bullet">✓ Personalizado para sua prova</div>
          <div class="diag-bullet">✓ Foco nas suas matérias fracas</div>
          <div class="diag-bullet">✓ Regenere quando quiser</div>
        </div>
      </div>
      <button class="btn btn-primary btn-full" id="gerarPlanoBtn">✨ Gerar meu plano</button>
      <button class="btn btn-ghost btn-full" id="planoBack" style="margin-top:0.5rem">Voltar</button>
    </div>
  `
  document.getElementById('gerarPlanoBtn').onclick = () => gerarPlano(container)
  document.getElementById('planoBack').onclick = () => switchTab('mais')
}

async function gerarPlano(container) {
  const btn = document.getElementById('gerarPlanoBtn')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando com IA...' }
  try {
    const data = await api('/api/plano-estudo/generate', {})
    state.plano = data.plan
    saveLocal('plano_cache', state.plano)
    renderPlanoSemana(container)
    toast('Plano gerado! 🎉', 'success')
  } catch (err) {
    toast(err.message || 'Erro ao gerar plano.', 'error')
    if (btn) { btn.disabled = false; btn.textContent = '✨ Gerar meu plano' }
  }
}

function renderPlanoSemana(container) {
  const plan = state.plano
  if (!plan) { renderPlanoGerar(container); return }

  const SUBJ_EMOJI = { matematica: '📐', portugues: '📖', biologia: '🧬', quimica: '⚗️', fisica: '⚡', historia: '🏛️', geografia: '🌍', filosofia: '🤔', ingles: '🌐' }
  const geradoEm = plan.gerado_em ? new Date(plan.gerado_em).toLocaleDateString('pt-BR') : ''

  const planoChecks = JSON.parse(localStorage.getItem('decifra_plano_checks') || '{}')
  const diasHtml = (plan.dias || []).map(d => `
    <div class="plano-day">
      <div class="plano-day-name">${d.dia}</div>
      <div class="plano-day-materias">
        ${(d.materias || []).map((m, i) => {
          const key = `${d.dia}_${m.materia}_${i}`
          const done = !!planoChecks[key]
          return `
            <div class="plano-materia-item ${subjectClass(m.materia)} ${done ? 'checked' : ''}">
              <button class="plano-check-btn ${done ? 'checked' : ''}" data-key="${key}">${done ? '✓' : ''}</button>
              <span class="plano-materia-text">${SUBJ_EMOJI[m.materia] || '📚'} <strong>${subjectLabel(m.materia)}</strong> — ${m.topico} · ${m.minutos}min</span>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `).join('')

  container.innerHTML = `
    <div class="plano-screen">
      <div class="plano-semana-header">
        <div>
          <div class="panel-title">📋 Plano de Estudo</div>
          <div class="panel-sub">${plan.semana || ''}</div>
        </div>
        <button class="btn btn-outline btn-sm" id="regenerarBtn">Regenerar</button>
      </div>
      ${plan.meta ? `<div class="card plano-meta">"${plan.meta}"</div>` : ''}
      <div class="plano-dias">${diasHtml}</div>
      ${geradoEm ? `<div style="text-align:center;color:var(--text3);font-size:0.75rem;margin-top:0.5rem;margin-bottom:1rem">Gerado em ${geradoEm}</div>` : ''}
    </div>
  `
  document.getElementById('regenerarBtn').onclick = () => {
    state.plano = null
    renderPlanoGerar(container)
    gerarPlano(container)
  }

  container.querySelectorAll('.plano-check-btn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation()
      const key = btn.dataset.key
      const checks = JSON.parse(localStorage.getItem('decifra_plano_checks') || '{}')
      checks[key] = !checks[key]
      localStorage.setItem('decifra_plano_checks', JSON.stringify(checks))
      const done = checks[key]
      btn.classList.toggle('checked', done)
      btn.textContent = done ? '✓' : ''
      btn.closest('.plano-materia-item').classList.toggle('checked', done)
    }
  })
}

// ===== CORREÇÃO DE REDAÇÃO =====
function renderRedacao(container) {
  container.innerHTML = `
    <div class="plano-screen">
      <button class="btn btn-ghost btn-sm" id="redacaoBack" style="margin-bottom:1rem">← Voltar</button>
      <div class="plano-header">
        <div class="plano-icon">✍️</div>
        <h2 class="plano-title">Correção de Redação</h2>
        <p class="plano-sub">Cole sua redação e receba nota 0–1000 nas 5 competências do ENEM, com feedback detalhado.</p>
        <div class="diag-bullets">
          <div class="diag-bullet">✓ Nota em cada competência</div>
          <div class="diag-bullet">✓ Pontos fortes e melhorias</div>
          <div class="diag-bullet">${isPro() ? '✓ Correções ilimitadas' : '✓ 1 correção grátis por dia'}</div>
        </div>
      </div>
      <div class="card" style="margin-bottom:1rem">
        <div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">Tema da redação (opcional)</label>
          <input type="text" class="form-input" id="redacaoTema" placeholder="Ex: Desafios da inclusão digital no Brasil">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Texto da redação</label>
          <textarea class="form-input" id="redacaoTexto" rows="10" placeholder="Cole ou digite sua redação aqui (mínimo 100 caracteres)..." style="resize:vertical;min-height:180px;font-size:0.875rem;line-height:1.6"></textarea>
          <div id="redacaoCharCount" style="font-size:0.75rem;color:var(--text3);margin-top:0.25rem;text-align:right">0 caracteres</div>
        </div>
      </div>
      <button class="btn btn-primary btn-full" id="redacaoSubmit">✨ Corrigir redação</button>
      <div id="redacaoResult"></div>
    </div>
  `
  document.getElementById('redacaoBack').onclick = () => switchTab('mais')

  const textarea = document.getElementById('redacaoTexto')
  const charCount = document.getElementById('redacaoCharCount')
  textarea.addEventListener('input', () => {
    charCount.textContent = `${textarea.value.length} caracteres`
    charCount.style.color = textarea.value.length < 100 ? 'var(--error)' : 'var(--text3)'
  })

  document.getElementById('redacaoSubmit').onclick = () => submitRedacao(container)
}

async function submitRedacao(container) {
  const texto = document.getElementById('redacaoTexto')?.value.trim()
  const tema = document.getElementById('redacaoTema')?.value.trim()
  if (!texto || texto.length < 100) { toast('Mínimo 100 caracteres para corrigir.', 'error'); return }

  const btn = document.getElementById('redacaoSubmit')
  btn.disabled = true
  btn.textContent = '⏳ Corrigindo com IA...'

  try {
    const data = await api('/api/redacao/corrigir', { texto, tema: tema || undefined })
    renderRedacaoResult(container, data.correcao, texto, tema)
  } catch (err) {
    toast(err.message || 'Erro ao corrigir. Tente novamente.', 'error')
    btn.disabled = false
    btn.textContent = '✨ Corrigir redação'
  }
}

function renderRedacaoResult(container, c, textoOriginal, temaOriginal) {
  const nota = c.nota_total || 0
  const color = nota >= 700 ? '#10b981' : nota >= 500 ? '#f59e0b' : nota >= 300 ? '#f97316' : '#ef4444'

  const competRow = (comp) => {
    const pct = Math.round((comp.nota / 200) * 100)
    const cc = comp.nota >= 140 ? '#10b981' : comp.nota >= 80 ? '#f59e0b' : '#ef4444'
    return `
      <div style="margin-bottom:0.75rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">
          <span style="font-size:0.8rem;font-weight:600">C${comp.numero}: ${comp.nome}</span>
          <span style="font-weight:700;color:${cc}">${comp.nota}/200</span>
        </div>
        <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;margin-bottom:0.3rem">
          <div style="height:100%;width:${pct}%;background:${cc};border-radius:3px"></div>
        </div>
        <p style="font-size:0.775rem;color:var(--text2);margin:0;line-height:1.5">${comp.comentario}</p>
      </div>
    `
  }

  container.innerHTML = `
    <div class="plano-screen">
      <button class="btn btn-ghost btn-sm" id="redacaoBack2" style="margin-bottom:1rem">← Nova redação</button>

      <div class="card" style="text-align:center;margin-bottom:1rem">
        <div style="font-size:3rem;font-weight:900;color:${color}">${nota}</div>
        <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.5rem">nota estimada ENEM (0–1000)</div>
        ${nota >= 700 ? '<div style="font-size:0.875rem">Excelente desempenho! 🏆</div>' :
          nota >= 500 ? '<div style="font-size:0.875rem">Bom! Foco nas melhorias abaixo. 📈</div>' :
          '<div style="font-size:0.875rem">Muitas oportunidades de melhoria. Vamos lá! 💪</div>'}
      </div>

      <div class="card" style="margin-bottom:1rem">
        <div class="card-title">Competências</div>
        ${(c.competencias || []).map(competRow).join('')}
      </div>

      <div class="card" style="margin-bottom:1rem">
        <div class="card-title">Pontos fortes</div>
        ${(c.pontos_fortes || []).map(p => `<div style="font-size:0.875rem;margin-bottom:0.4rem">✅ ${p}</div>`).join('')}
      </div>

      <div class="card" style="margin-bottom:1rem">
        <div class="card-title">O que melhorar</div>
        ${(c.melhorias || []).map(m => `<div style="font-size:0.875rem;margin-bottom:0.4rem">📌 ${m}</div>`).join('')}
      </div>

      <div class="card" style="background:var(--primary-glow);border-color:rgba(59,130,246,0.3);margin-bottom:1rem">
        <div class="card-title">Resumo do corretor</div>
        <p style="font-size:0.875rem;line-height:1.6;margin:0">${c.resumo}</p>
      </div>

      <button class="btn btn-outline btn-full" id="redacaoNova">Corrigir outra redação</button>
    </div>
  `
  document.getElementById('redacaoBack2').onclick = () => switchTab('mais')
  document.getElementById('redacaoNova').onclick = () => renderRedacao(container)
}

// ===== TAB: FLASHCARDS =====
function renderFlashcards(container) {
  const { screen } = state.flashcards
  if (screen === 'menu') renderFlashcardsMenu(container)
  else if (screen === 'new') renderFlashcardsNew(container)
  else if (screen === 'review') renderFlashcardsReview(container)
}

function renderFlashcardsMenu(container) {
  const deck = loadFlashcardDeck()
  const due = getDueCards(deck)
  const today = new Date().toISOString().slice(0, 10)
  const bySubject = {}
  deck.forEach(c => {
    if (!bySubject[c.subject]) bySubject[c.subject] = []
    bySubject[c.subject].push(c)
  })

  const subjectSections = Object.keys(bySubject).map(subj => {
    const cards = bySubject[subj]
    return `
      <div class="fc-subject-section">
        <div class="fc-subject-header">
          <span class="subject-chip ${subjectClass(subj)}">${SUBJECTS.find(x => x.id === subj)?.emoji || '📚'} ${subjectLabel(subj)}</span>
          <span class="fc-count">${cards.length} ${cards.length === 1 ? 'card' : 'cards'}</span>
        </div>
        <div class="fc-cards-list">
          ${cards.map(c => {
            const isDue = !c.nextReview || c.nextReview <= today
            return `
              <div class="fc-item">
                <div class="fc-item-front">${c.front}</div>
                <div class="fc-item-meta">
                  ${isDue ? '<span class="fc-due-badge">Revisar hoje</span>' : `<span class="fc-next-date">Próxima: ${formatDate(c.nextReview)}</span>`}
                </div>
                <button class="fc-delete-btn" data-delete="${c.id}">✕</button>
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = `
    <div class="fc-screen">
      <div class="fc-header">
        <div class="fc-title">🃏 Flashcards</div>
        <button class="btn btn-primary btn-sm" id="fcNew">+ Novo card</button>
      </div>
      ${due.length > 0 ? `
        <button class="btn btn-primary btn-full fc-review-btn" id="fcStartReview">
          Revisar ${due.length} ${due.length === 1 ? 'card' : 'cards'} de hoje
        </button>
      ` : deck.length > 0 ? `
        <div class="fc-empty-review">✅ Todos os cards revisados por hoje!</div>
      ` : ''}
      ${deck.length === 0 ? `
        <div class="fc-empty-state">
          <div class="fc-empty-icon">🃏</div>
          <div class="fc-empty-title">Nenhum flashcard ainda</div>
          <div class="fc-empty-sub">Crie flashcards para revisar conceitos importantes com revisão espaçada</div>
          <button class="btn btn-primary" id="fcNewEmpty">Criar primeiro flashcard</button>
        </div>
      ` : `
        <div class="fc-stats-row">
          <div class="fc-stat"><span class="fc-stat-val">${deck.length}</span><span class="fc-stat-lbl">Total</span></div>
          <div class="fc-stat"><span class="fc-stat-val text-accent">${due.length}</span><span class="fc-stat-lbl">Para revisar</span></div>
          <div class="fc-stat"><span class="fc-stat-val text-success">${deck.filter(c => (c.reps || 0) > 0).length}</span><span class="fc-stat-lbl">Estudados</span></div>
        </div>
        <div class="fc-subjects">${subjectSections}</div>
      `}
    </div>
  `

  document.getElementById('fcNew')?.addEventListener('click', () => { state.flashcards.screen = 'new'; renderFlashcards(container) })
  document.getElementById('fcNewEmpty')?.addEventListener('click', () => { state.flashcards.screen = 'new'; renderFlashcards(container) })
  document.getElementById('fcStartReview')?.addEventListener('click', () => {
    state.flashcards.screen = 'review'
    state.flashcards.reviewIdx = 0
    state.flashcards.flipped = false
    renderFlashcards(container)
  })
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation()
      const deck = loadFlashcardDeck()
      saveFlashcardDeck(deck.filter(c => c.id !== btn.dataset.delete))
      renderFlashcardsMenu(container)
    }
  })
}

function renderFlashcardsNew(container) {
  const subjectOpts = SUBJECTS.map(s => `<option value="${s.id}">${s.emoji} ${s.label}</option>`).join('')

  container.innerHTML = `
    <div class="fc-screen">
      <div class="fc-new-header">
        <button class="btn btn-ghost btn-sm" id="fcBack">← Voltar</button>
        <div class="fc-new-title">Novo flashcard</div>
      </div>
      <div class="card" style="margin:0 1rem 1rem">
        <div class="form-group">
          <label class="form-label">Matéria</label>
          <select class="form-input" id="fcSubject">${subjectOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Frente (pergunta / conceito)</label>
          <textarea class="form-input fc-textarea" id="fcFront" placeholder="Ex: O que é fotossíntese?" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Verso (resposta / definição)</label>
          <textarea class="form-input fc-textarea" id="fcBack" placeholder="Ex: Processo pelo qual plantas produzem energia usando luz solar..." rows="4"></textarea>
        </div>
        <button class="btn btn-primary btn-full" id="fcSave">Salvar flashcard</button>
      </div>
      <div class="fc-ai-section">
        <div class="fc-ai-divider">ou gere automaticamente com IA</div>
        <div style="padding: 0 1rem">
          <div class="form-group">
            <label class="form-label">Tópico para gerar com IA</label>
            <input type="text" class="form-input" id="fcAiTopic" placeholder="Ex: Lei de Ohm, Segunda Guerra...">
          </div>
          <button class="btn btn-outline btn-full" id="fcAiGen">✨ Gerar flashcard com IA${isPro() ? '' : ' (Pro)'}</button>
        </div>
      </div>
    </div>
  `

  document.getElementById('fcBack').onclick = () => { state.flashcards.screen = 'menu'; renderFlashcards(container) }

  document.getElementById('fcAiGen').onclick = async () => {
    if (!isPro()) { renderUpgradeModal(); return }
    const subject = document.getElementById('fcSubject').value
    const topic = document.getElementById('fcAiTopic').value.trim()
    const btn = document.getElementById('fcAiGen')
    btn.disabled = true
    btn.textContent = '⏳ Gerando...'
    try {
      const data = await api('/api/flashcard/generate', { subject, topic: topic || undefined })
      document.getElementById('fcFront').value = data.front
      document.getElementById('fcBack').value = data.back
      toast('Flashcard gerado! Revise e salve. 🃏', 'success')
    } catch {
      toast('Erro ao gerar. Tente novamente.', 'error')
    } finally {
      btn.disabled = false
      btn.textContent = `✨ Gerar flashcard com IA${isPro() ? '' : ' (Pro)'}`
    }
  }

  document.getElementById('fcSave').onclick = () => {
    const subject = document.getElementById('fcSubject').value
    const front = document.getElementById('fcFront').value.trim()
    const back = document.getElementById('fcBack').value.trim()
    if (!front || !back) { toast('Preencha a frente e o verso do card.', 'error'); return }
    const deck = loadFlashcardDeck()
    const today = new Date().toISOString().slice(0, 10)
    deck.push({ id: Date.now().toString(), subject, front, back, interval: 1, ease: 2.5, nextReview: today, reps: 0, createdAt: today })
    saveFlashcardDeck(deck)
    toast('Flashcard salvo! 🃏', 'success')
    state.flashcards.screen = 'menu'
    renderFlashcards(container)
  }
}

function renderFlashcardsReview(container) {
  const deck = loadFlashcardDeck()
  const queue = getDueCards(deck)
  const idx = state.flashcards.reviewIdx
  const flipped = state.flashcards.flipped

  if (queue.length === 0 || idx >= queue.length) {
    const reviewed = idx
    container.innerHTML = `
      <div class="fc-screen">
        <div class="fc-done">
          <div class="fc-done-icon">🎉</div>
          <div class="fc-done-title">Revisão completa!</div>
          <div class="fc-done-sub">Você revisou ${reviewed} ${reviewed === 1 ? 'card' : 'cards'} hoje. Continue assim!</div>
          <button class="btn btn-primary" id="fcDoneBack">Ver meus flashcards</button>
        </div>
      </div>
    `
    document.getElementById('fcDoneBack').onclick = () => {
      state.flashcards.screen = 'menu'
      state.flashcards.reviewIdx = 0
      state.flashcards.flipped = false
      renderFlashcards(container)
    }
    if (reviewed > 0) { incrementDailyProgress(); recordStudyToday() }
    return
  }

  const card = queue[idx]
  const subj = SUBJECTS.find(x => x.id === card.subject)

  container.innerHTML = `
    <div class="fc-screen">
      <div class="fc-review-header">
        <button class="btn btn-ghost btn-sm" id="fcReviewBack">← Sair</button>
        <div class="fc-progress-text">${idx + 1} / ${queue.length}</div>
      </div>
      <div class="fc-progress-bar-wrap">
        <div class="fc-progress-bar" style="width:${Math.round((idx / queue.length) * 100)}%"></div>
      </div>
      <div class="fc-card-wrap">
        <div class="fc-card ${flipped ? 'flipped' : ''}">
          <div class="fc-card-side fc-card-front">
            <div class="fc-card-label">Pergunta</div>
            <div class="fc-card-text">${card.front}</div>
            <div class="fc-card-subject"><span class="subject-chip ${subjectClass(card.subject)}">${subj?.emoji || ''} ${subjectLabel(card.subject)}</span></div>
          </div>
          <div class="fc-card-side fc-card-back">
            <div class="fc-card-label">Resposta</div>
            <div class="fc-card-text">${card.back}</div>
          </div>
        </div>
      </div>
      ${!flipped ? `
        <button class="btn btn-primary btn-full fc-flip-btn" id="fcFlip">Ver resposta</button>
      ` : `
        <div class="fc-rating">
          <div class="fc-rating-label">Como foi?</div>
          <div class="fc-rating-btns">
            <button class="btn fc-btn-hard" data-rate="1">😅 Difícil</button>
            <button class="btn fc-btn-ok" data-rate="2">🙂 Ok</button>
            <button class="btn fc-btn-easy" data-rate="3">😊 Fácil</button>
          </div>
        </div>
      `}
    </div>
  `

  document.getElementById('fcReviewBack').onclick = () => {
    state.flashcards.screen = 'menu'
    state.flashcards.reviewIdx = 0
    state.flashcards.flipped = false
    renderFlashcards(container)
  }
  document.getElementById('fcFlip')?.addEventListener('click', () => {
    state.flashcards.flipped = true
    renderFlashcardsReview(container)
  })
  container.querySelectorAll('[data-rate]').forEach(btn => {
    btn.onclick = () => {
      const rating = parseInt(btn.dataset.rate)
      const deck = loadFlashcardDeck()
      const i = deck.findIndex(c => c.id === card.id)
      if (i !== -1) deck[i] = rateCard(card, rating)
      saveFlashcardDeck(deck)
      state.flashcards.reviewIdx++
      state.flashcards.flipped = false
      renderFlashcardsReview(container)
    }
  })
}

// ===== UPGRADE MODAL =====
function renderUpgradeModal() {
  const existing = document.querySelector('.modal-overlay')
  if (existing) existing.remove()

  const PLANS = [
    { id: 'monthly', name: 'Pro Mensal', price: 'R$29', period: '/mês', desc: '7 dias grátis para começar', badge: null },
    { id: 'annual', name: 'Pro Anual', price: 'R$199', period: '/ano', desc: 'Equivale a R$16,58/mês · Economize 43%', badge: 'MELHOR PREÇO' },
  ]

  let selected = 'annual'

  const planCards = PLANS.map(p => `
    <div class="plan-card ${selected === p.id ? 'selected' : ''}" data-plan="${p.id}">
      ${p.badge ? `<div class="plan-card-badge">${p.badge}</div>` : ''}
      <div>
        <div class="plan-card-name">${p.name}</div>
        <div class="plan-card-price">${p.price}<span>${p.period}</span></div>
        <div class="plan-card-desc">${p.desc}</div>
      </div>
      <div class="plan-radio ${selected === p.id ? 'checked' : ''}"></div>
    </div>
  `).join('')

  const overlay = el('div', 'modal-overlay')
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-title">Tudo ilimitado no Pro</div>
      <p class="modal-sub">Tutor ilimitado, simulados completos, plano de estudo e muito mais</p>
      <div class="plans-list" id="plansList">${planCards}</div>
      <div class="upgrade-cta">
        <button class="btn btn-primary btn-full" id="upgradeBtn">Começar 7 dias grátis</button>
        <div class="upgrade-guarantee">🔒 Cancele quando quiser · Sem compromisso</div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

  overlay.querySelectorAll('[data-plan]').forEach(card => {
    card.onclick = () => {
      selected = card.dataset.plan
      overlay.querySelectorAll('[data-plan]').forEach(c => {
        c.classList.toggle('selected', c.dataset.plan === selected)
        c.querySelector('.plan-radio').classList.toggle('checked', c.dataset.plan === selected)
      })
    }
  })

  document.getElementById('upgradeBtn').onclick = async () => {
    const btn = document.getElementById('upgradeBtn')
    btn.disabled = true
    btn.textContent = 'Aguarde...'
    try {
      const data = await api('/api/stripe/checkout', { plan: selected })
      window.location.href = data.url
    } catch {
      toast('Erro ao criar checkout. Tente novamente.', 'error')
      btn.disabled = false
      btn.textContent = 'Começar 7 dias grátis'
    }
  }
}

// ===== PWA INSTALL BANNER =====
function renderInstallBanner() {
  const existing = document.querySelector('.install-banner')
  if (existing) return
  const banner = el('div', 'install-banner')
  banner.innerHTML = `
    <div class="install-icon">📲</div>
    <div class="install-text">
      <strong>Instalar Decifra</strong>
      <small>Estude offline, acesse mais rápido</small>
    </div>
    <div class="install-actions">
      <button class="btn btn-ghost btn-sm" id="installDismiss">Não</button>
      <button class="btn btn-primary btn-sm" id="installOk">Instalar</button>
    </div>
  `
  document.body.appendChild(banner)

  document.getElementById('installDismiss').onclick = () => banner.remove()
  document.getElementById('installOk').onclick = async () => {
    if (state.deferredInstall) {
      state.deferredInstall.prompt()
      const { outcome } = await state.deferredInstall.userChoice
      if (outcome === 'accepted') banner.remove()
    }
  }
}

// ===== INIT =====
async function init() {
  const app = document.getElementById('app')

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }

  // PWA install
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    state.deferredInstall = e
    setTimeout(() => { if (state.user) renderInstallBanner() }, 5000)
  })

  // Check existing session
  const token = localStorage.getItem('decifra_token')
  const userStr = localStorage.getItem('decifra_user')

  if (token && userStr) {
    try {
      state.user = JSON.parse(userStr)
      state.token = token
      state.plan = localStorage.getItem('decifra_plan') || 'free'
      state.progresso = loadLocal('progresso') || state.progresso
      state.plano = loadLocal('plano_cache') || null

      app.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div></div>`

      await loadUserData()
      state.questaoHoje = null
      renderApp()
      checkDailyNotification()
    } catch {
      localStorage.removeItem('decifra_token')
      renderAuth('login')
    }
  } else {
    renderAuth('login')
  }
}

init()
