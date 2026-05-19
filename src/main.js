// ===== CONFIG =====
const API = import.meta.env.VITE_API_URL || 'https://decifra-backend-production.up.railway.app'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ===== ANALYTICS (PostHog) =====
let _ph = null
;(async () => {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return
  try {
    const { default: posthog } = await import('posthog-js')
    posthog.init(key, { api_host: 'https://app.posthog.com', autocapture: false, capture_pageview: false })
    _ph = posthog
  } catch {}
})()

function track(event, props = {}) {
  try { _ph?.capture(event, props) } catch {}
}

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
  trialUsed: false,
  referralCode: null,
  tab: 'inicio',
  tutor: { chatsBySubject: {}, subject: 'matematica', loading: false, used: 0, limit: 5 },
  simulado: { screen: 'menu', type: null, questions: [], current: 0, answers: [], timeLeft: 0, timer: null, score: null, loading: false, questionTimes: [], questionStartTime: 0 },
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
  if (res.status === 401) {
    localStorage.removeItem('decifra_token')
    localStorage.removeItem('decifra_user')
    localStorage.removeItem('decifra_plan')
    window.location.href = '/app'
    throw new Error('Sessão expirada. Faça login novamente.')
  }
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
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

function loadSimuladoHistory() { return loadLocal('simulado_history') || [] }
function saveToSimuladoHistory(entry) {
  const h = loadSimuladoHistory(); h.unshift(entry)
  if (h.length > 20) h.length = 20
  saveLocal('simulado_history', h)
}
function loadRedacaoHistory() { return loadLocal('redacao_history') || [] }
function saveToRedacaoHistory(entry) {
  const h = loadRedacaoHistory(); h.unshift(entry)
  if (h.length > 10) h.length = 10
  saveLocal('redacao_history', h)
}

function shareResult(text) {
  const url = window.location.origin
  if (navigator.share) {
    navigator.share({ title: 'Decifra', text, url }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(`${text} ${url}`)
      .then(() => toast('Copiado para a área de transferência!', 'success'))
      .catch(() => toast(text, ''))
  }
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
          ${mode === 'login' ? `<div style="text-align:center;margin-top:10px"><a href="#" id="forgotLink" style="color:#6b7280;font-size:13px">Esqueceu sua senha?</a></div>` : ''}
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
  document.getElementById('forgotLink')?.addEventListener('click', e => { e.preventDefault(); renderForgotPassword() })
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
    if (mode === 'register') {
      track('signup', { plan: 'free' })
      _ph?.identify(data.user.id, { email: data.user.email, name: data.user.name })
      // Apply referral code if pending
      const pendingRef = localStorage.getItem('decifra_pending_ref')
      if (pendingRef) {
        localStorage.removeItem('decifra_pending_ref')
        api('/api/referral/use', { code: pendingRef }).then(() => toast('Código de indicação aplicado! +7 dias Pro 🎁', 'success')).catch(() => {})
      }
    } else {
      track('login')
      _ph?.identify(data.user.id)
    }
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

function renderForgotPassword() {
  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">Decifra<span>.</span></div>
        <div class="auth-tagline">Recuperar senha</div>
        <p style="color:#9ca3af;font-size:14px;margin-bottom:20px;text-align:center">Digite seu email e enviaremos um link para redefinir sua senha.</p>
        <div id="forgotMsg"></div>
        <form id="forgotForm">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="forgotEmail" placeholder="seu@email.com" required autocomplete="email">
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="forgotSubmit">Enviar link</button>
        </form>
        <div class="auth-footer"><a href="#" id="backToLogin">← Voltar para o login</a></div>
      </div>
    </div>
  `
  document.getElementById('backToLogin').onclick = e => { e.preventDefault(); renderAuth('login') }
  document.getElementById('forgotForm').onsubmit = async e => {
    e.preventDefault()
    const email = document.getElementById('forgotEmail').value.trim()
    const btn = document.getElementById('forgotSubmit')
    const msg = document.getElementById('forgotMsg')
    btn.disabled = true
    btn.textContent = 'Enviando...'
    try {
      await api('/api/auth/forgot-password', { email })
      msg.innerHTML = `<div class="success-msg" style="background:#064e3b;color:#6ee7b7;padding:12px;border-radius:8px;margin-bottom:16px;text-align:center">Link enviado! Verifique seu email (cheque o spam também).</div>`
      btn.textContent = 'Enviado ✓'
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`
      btn.disabled = false
      btn.textContent = 'Enviar link'
    }
  }
}

function renderResetPassword(token) {
  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">Decifra<span>.</span></div>
        <div class="auth-tagline">Nova senha</div>
        <div id="resetMsg"></div>
        <form id="resetForm">
          <div class="form-group">
            <label class="form-label">Nova senha</label>
            <input type="password" class="form-input" id="resetPassword" placeholder="Mínimo 6 caracteres" required minlength="6">
          </div>
          <div class="form-group">
            <label class="form-label">Confirmar senha</label>
            <input type="password" class="form-input" id="resetConfirm" placeholder="Repita a nova senha" required>
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="resetSubmit">Redefinir senha</button>
        </form>
      </div>
    </div>
  `
  document.getElementById('resetForm').onsubmit = async e => {
    e.preventDefault()
    const password = document.getElementById('resetPassword').value
    const confirm = document.getElementById('resetConfirm').value
    const btn = document.getElementById('resetSubmit')
    const msg = document.getElementById('resetMsg')
    if (password !== confirm) {
      msg.innerHTML = `<div class="error-msg">As senhas não coincidem.</div>`
      return
    }
    btn.disabled = true
    btn.textContent = 'Redefinindo...'
    try {
      await api('/api/auth/reset-password', { token, password })
      msg.innerHTML = `<div class="success-msg" style="background:#064e3b;color:#6ee7b7;padding:12px;border-radius:8px;margin-bottom:16px;text-align:center">Senha redefinida com sucesso!</div>`
      btn.textContent = 'Pronto ✓'
      setTimeout(() => renderAuth('login'), 2000)
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${err.message}</div>`
      btn.disabled = false
      btn.textContent = 'Redefinir senha'
    }
  }
}

async function loadUserData() {
  try {
    const data = await api('/api/user/me')
    state.plan = data.plan || 'free'
    state.trialEnd = data.trialEnd
    state.trialUsed = data.trialUsed || false
    state.referralCode = data.referralCode || null
    state.xp = data.xp || 0
    state.diagnosticoDone = data.diagnosticoDone || false
    state.progresso = data.progresso || state.progresso
    if (data.plan) localStorage.setItem('decifra_plan', data.plan)
  } catch {}
}

function logout() {
  Object.keys(localStorage).filter(k => k.startsWith('decifra_')).forEach(k => localStorage.removeItem(k))
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
  saveLocal('questao_respondida_' + new Date().toDateString(), true)
  const isCorrect = idx === q.answerIndex
  document.querySelectorAll('.questao-option').forEach((btn, i) => {
    btn.disabled = true
    if (i === q.answerIndex) btn.classList.add('correct')
    else if (i === idx && !isCorrect) btn.classList.add('wrong')
  })
  const fb = document.getElementById('qdFeedback')
  if (fb) {
    const subj = SUBJECTS.find(s => s.id === q.subject)
    fb.innerHTML = `
      <div class="quiz-explanation">
        <strong>${isCorrect ? '✅ Correto!' : '❌ Errado'}</strong>
        ${q.explanation}
        <button id="qdShare" style="margin-top:0.75rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.85rem;font-size:0.78rem;cursor:pointer;color:var(--text2);display:flex;align-items:center;gap:0.4rem">📤 Compartilhar questão</button>
      </div>
    `
    document.getElementById('qdShare')?.addEventListener('click', () => {
      const emoji = subj?.emoji || '📚'
      const txt = `${emoji} Questão de ${subj?.label || q.subject} (${q.source || 'ENEM'} ${q.year || ''})\n\n${q.question.slice(0, 120)}...\n\n${isCorrect ? '✅ Acertei!' : '📖 Aprendi!'}\n\nEstude no Decifra: ${window.location.origin}/app`
      if (navigator.share) navigator.share({ title: 'Decifra — Questão do dia', text: txt }).catch(() => {})
      else { navigator.clipboard?.writeText(txt); toast('Copiado para compartilhar! 📋', 'success') }
    })
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
        <button class="practice-btn" id="tutorMapa" title="Gerar mapa mental" style="font-size:0.75rem;min-width:32px">🗺️</button>
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
  document.getElementById('tutorMapa').onclick = () => showMapaMental()
}

async function showMapaMental() {
  const subj = SUBJECTS.find(s => s.id === state.tutor.subject)
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:520px;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="font-size:1.1rem;font-weight:700">🗺️ Mapa Mental — ${subj?.label}</h2>
        <button id="mapaClose" style="background:none;border:none;color:var(--text2);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div style="margin-bottom:1rem">
        <input id="mapaTopico" class="form-input" placeholder="Tópico (ex: Fotossíntese, Lei de Newton, Romantismo...)" style="margin-bottom:0.5rem">
        <button class="btn btn-primary btn-full" id="mapaGerar">Gerar mapa</button>
      </div>
      <div id="mapaResult" style="font-size:0.83rem;line-height:1.7;white-space:pre-wrap;color:var(--text2);background:var(--surface2);border-radius:10px;padding:1rem;display:none"></div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.onclick = e => { if (e.target === overlay) overlay.remove() }
  document.getElementById('mapaClose').onclick = () => overlay.remove()
  document.getElementById('mapaGerar').onclick = async () => {
    const topic = document.getElementById('mapaTopico').value.trim()
    if (!topic) return
    const btn = document.getElementById('mapaGerar')
    const result = document.getElementById('mapaResult')
    btn.disabled = true; btn.textContent = 'Gerando...'
    result.style.display = 'none'
    try {
      const data = await api('/api/tutor/mapa-mental', { topic, subject: subj?.label })
      result.textContent = data.mapa
      result.style.display = 'block'
      btn.textContent = '🔄 Gerar outro'
    } catch {
      toast('Erro ao gerar mapa. Tente novamente.', 'error')
      btn.textContent = 'Gerar mapa'
    }
    btn.disabled = false
  }
  document.getElementById('mapaTopico').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('mapaGerar').click()
  })
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
    <div class="msg ${m.role === 'user' ? 'msg-user' : 'msg-tutor'}">${escapeHtml(m.content)}</div>
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
  localStorage.setItem('decifra_tutor_used_' + new Date().toDateString(), state.tutor.used)
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
    const msg = err.message?.includes('429') ? 'Limite de perguntas atingido hoje. Faça upgrade para Pro.' : 'Desculpe, ocorreu um erro. Tente novamente.'
    subjMsgs.push({ role: 'assistant', content: msg })
  }

  state.tutor.loading = false
  const limitBanner = document.querySelector('.free-limit-banner span')
  if (limitBanner && !isPro()) limitBanner.textContent = `Tutor: ${state.tutor.used}/${state.tutor.limit} perguntas hoje`
  const chatsToSave = Object.fromEntries(
    Object.entries(state.tutor.chatsBySubject).map(([k, msgs]) => [k, msgs.slice(-30)])
  )
  saveLocal('tutor_chats', chatsToSave)
  const m2 = document.getElementById('tutorMessages')
  if (m2) renderMessages(m2)
}

// ===== TAB: SIMULADOS =====
function renderSimulados(container) {
  if (state.simulado.screen === 'quiz') { renderQuiz(container); return }
  if (state.simulado.screen === 'result') { renderResults(container); return }
  if (state.simulado.screen === 'gabarito') { renderGabarito(container); return }

  container.innerHTML = `
    <div class="simulado-screen">
      <div class="panel-header">
        <div>
          <div class="panel-title">Simulados</div>
          <div class="panel-sub">Escolha o tipo e comece agora</div>
        </div>
      </div>
      <div class="simulado-types">
        <div class="simulado-type-card" data-type="adaptativo" style="border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.05)">
          <div class="simulado-type-info">
            <h3>🎯 Adaptativo</h3>
            <p>Foca nas suas matérias mais fracas · IA analisa seu histórico</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~15 min</span>
              <span class="meta-chip">10 questões</span>
              <span class="meta-chip" style="color:#10b981">Personalizado</span>
            </div>
          </div>
          <div class="simulado-type-icon">🧠</div>
        </div>
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
        <div class="simulado-type-card" data-type="enem_completo">
          <div class="simulado-type-info">
            <h3>ENEM Completo 🏆</h3>
            <p>45 questões · Distribuição oficial do ENEM</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ 5h30</span>
              <span class="meta-chip">45 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">📋</div>
        </div>
        <div class="simulado-type-card" data-type="vestibular">
          <div class="simulado-type-info">
            <h3>Vestibular Geral</h3>
            <p>FUVEST, UNICAMP, UNESP — nível alto</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~30 min</span>
              <span class="meta-chip">20 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🎓</div>
        </div>
        <div class="simulado-type-card" data-type="fuvest">
          <div class="simulado-type-info">
            <h3>FUVEST (USP)</h3>
            <p>Questões estilo FUVEST — alta dificuldade</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~30 min</span>
              <span class="meta-chip">20 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🏫</div>
        </div>
        <div class="simulado-type-card" data-type="unicamp">
          <div class="simulado-type-info">
            <h3>UNICAMP</h3>
            <p>Questões estilo UNICAMP — interpretação e raciocínio</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~30 min</span>
              <span class="meta-chip">20 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🔬</div>
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
        <div class="simulado-type-card" data-type="concurso_federal">
          <div class="simulado-type-info">
            <h3>Concurso Federal</h3>
            <p>Estilo CESPE/CEBRASPE — questões objetivas</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~30 min</span>
              <span class="meta-chip">20 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">📋</div>
        </div>
        <div class="simulado-type-card" data-type="militar">
          <div class="simulado-type-info">
            <h3>Militar (ESPCEX/AFA)</h3>
            <p>Matemática, Física, Português e Inglês — nível alto</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~30 min</span>
              <span class="meta-chip">20 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">⭐</div>
        </div>
        <div class="simulado-type-card" data-type="ia">
          <div class="simulado-type-info">
            <h3>Simulado IA ENEM ✨</h3>
            <p>10 questões únicas geradas por IA — banco infinito</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~15 min</span>
              <span class="meta-chip">10 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🤖</div>
        </div>
        <div class="simulado-type-card" data-type="vestibular_ia">
          <div class="simulado-type-info">
            <h3>Simulado IA Vestibular ✨</h3>
            <p>10 questões estilo FUVEST/UNICAMP geradas por IA</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~20 min</span>
              <span class="meta-chip">10 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🎓</div>
        </div>
        <div class="simulado-type-card" data-type="concurso_ia">
          <div class="simulado-type-info">
            <h3>Simulado IA Concurso ✨</h3>
            <p>10 questões estilo CESPE/FCC geradas por IA</p>
            <div class="simulado-meta">
              <span class="meta-chip">⏱ ~20 min</span>
              <span class="meta-chip">10 questões</span>
              ${isPro() ? '' : '<span class="meta-chip" style="color:var(--primary)">Pro</span>'}
            </div>
          </div>
          <div class="simulado-type-icon">🏛️</div>
        </div>
      </div>
      ${(() => {
        const hist = loadSimuladoHistory()
        if (!hist.length) return ''
        const typeNames = { mini: 'Mini', adaptativo: '🎯 Adaptativo', enem: 'ENEM', enem_completo: 'ENEM Completo', vestibular: 'Vestibular', fuvest: 'FUVEST', unicamp: 'UNICAMP', concurso: 'Concurso', concurso_federal: 'C.Federal', militar: 'Militar', ia: 'IA ✨', vestibular_ia: 'IA Vest.', concurso_ia: 'IA Conc.' }
        const items = hist.slice(0, 5).map(h => {
          const color = h.pct >= 70 ? '#10b981' : h.pct >= 50 ? '#f59e0b' : '#ef4444'
          const d = new Date(h.date)
          const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
          return `<div class="history-item"><span class="history-type">${typeNames[h.type] || h.type}</span><span class="history-date">${dateStr}</span><span class="history-pct" style="color:${color}">${h.pct}%</span></div>`
        }).join('')
        return `<div class="mais-section-title" style="margin-top:1.25rem;margin-bottom:0.5rem">Histórico recente</div><div class="history-list">${items}</div>`
      })()}
      <div class="mais-section-title" style="margin-top:1.25rem;margin-bottom:0.5rem">Mini por matéria</div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.75rem">
        ${SUBJECTS.map(s => `<button class="btn-subj-filter" data-subj="${s.id}" style="background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:0.3rem 0.7rem;font-size:0.75rem;cursor:pointer;color:${s.color}">${s.emoji} ${s.label.split(' ')[0]}</button>`).join('')}
      </div>
      <div class="mais-section-title" style="margin-top:0.5rem;margin-bottom:0.75rem">Provas anteriores ENEM</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-bottom:1rem">
        ${[2023,2022,2021,2020,2019,2018].map(year => `
          <div class="simulado-ano-card ${!isPro() ? 'locked' : ''}" data-year="${year}">
            <div style="font-weight:700;font-size:1rem">${year}</div>
            <div style="font-size:0.72rem;color:var(--text2)">ENEM${!isPro() ? ' 🔒' : ''}</div>
          </div>
        `).join('')}
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
      if (type !== 'mini' && type !== 'adaptativo' && !isPro()) { renderUpgradeModal(); return }
      const isIaType = type === 'ia' || type.endsWith('_ia')
      if (isIaType) {
        const content = document.getElementById('appContent')
        if (content) content.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div><p style="color:var(--text2);font-size:0.875rem">Gerando questões com IA... (~10s)</p></div>`
      }
      startSimulado(type)
    }
  })

  container.querySelectorAll('.btn-subj-filter').forEach(btn => {
    btn.onclick = () => {
      const subj = btn.dataset.subj
      btn.style.opacity = '0.5'
      btn.textContent = '⏳'
      startSimuladoBySubject(subj)
    }
  })

  if (document.getElementById('simUpgrade')) {
    document.getElementById('simUpgrade').onclick = () => renderUpgradeModal()
  }

  container.querySelectorAll('.simulado-ano-card').forEach(card => {
    card.onclick = () => {
      if (!isPro()) { renderUpgradeModal(); return }
      const year = parseInt(card.dataset.year)
      startSimuladoByYear(year)
    }
  })
}

async function startSimuladoByYear(year) {
  state.simulado.type = `enem_${year}`
  state.simulado.screen = 'loading'
  const content = document.getElementById('appContent')
  if (content) content.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div><p style="color:var(--text2);font-size:0.875rem">Carregando questões de ${year}...</p></div>`
  try {
    const data = await api('/api/simulado/start', { type: 'enem', year })
    state.simulado.questions = data.questions
    state.simulado.current = 0
    state.simulado.answers = []
    state.simulado.questionTimes = []
    state.simulado.questionStartTime = Date.now()
    state.simulado.timeLeft = data.timeLimit
    state.simulado.screen = 'quiz'
    state.simulado.loading = false
    track('simulado_start', { type: 'enem_ano', year })
    renderTab('simulados')
    startTimer()
  } catch {
    toast('Erro ao carregar simulado. Tente novamente.', 'error')
    state.simulado.screen = 'menu'
    renderTab('simulados')
  }
}

async function startSimuladoBySubject(subject) {
  const s = SUBJECTS.find(x => x.id === subject)
  state.simulado.type = `mini_${subject}`
  state.simulado.screen = 'loading'
  const content = document.getElementById('appContent')
  if (content) content.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div><p style="color:var(--text2);font-size:0.875rem">Carregando questões de ${s?.label || subject}...</p></div>`
  try {
    const data = await api('/api/simulado/start', { type: 'mini', subject })
    state.simulado.questions = data.questions
    state.simulado.current = 0
    state.simulado.answers = []
    state.simulado.questionTimes = []
    state.simulado.questionStartTime = Date.now()
    state.simulado.timeLeft = data.timeLimit
    state.simulado.screen = 'quiz'
    state.simulado.loading = false
    track('simulado_start', { type: 'mini_subject', subject })
    renderTab('simulados')
    startTimer()
  } catch {
    toast('Erro ao carregar simulado. Tente novamente.', 'error')
    state.simulado.screen = 'menu'
    renderTab('simulados')
  }
}

async function startSimulado(type) {
  state.simulado.type = type
  state.simulado.screen = 'loading'
  state.simulado.loading = true

  const content = document.getElementById('appContent')
  if (content) content.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div><p style="color:var(--text2);font-size:0.875rem">Preparando simulado...</p></div>`

  const IA_MODES = ['fuvest_ia', 'unicamp_ia', 'concurso_ia', 'concurso_federal_ia', 'vestibular_ia']
  try {
    const data = type === 'ia'
      ? await api('/api/simulado/ia', { mode: 'enem' })
      : IA_MODES.includes(type)
        ? await api('/api/simulado/ia', { mode: type.replace('_ia', '') })
        : await api('/api/simulado/start', { type })
    state.simulado.questions = data.questions
    state.simulado.current = 0
    state.simulado.answers = []
    state.simulado.questionTimes = []
    state.simulado.questionStartTime = Date.now()
    state.simulado.timeLeft = data.timeLimit
    state.simulado.screen = 'quiz'
    state.simulado.loading = false
    track('simulado_start', { type })
    renderTab('simulados')
    startTimer()
  } catch (err) {
    toast('Erro ao carregar simulado. Tente novamente.', 'error')
    state.simulado.screen = 'menu'
    renderTab('simulados')
  }
}

function stopTimer() {
  clearInterval(state.simulado.timer)
  if (state.simulado._visibilityHandler) {
    document.removeEventListener('visibilitychange', state.simulado._visibilityHandler)
    state.simulado._visibilityHandler = null
  }
}

function startTimer() {
  stopTimer()
  let hiddenAt = null
  const handleVisibility = () => {
    if (document.hidden) {
      hiddenAt = Date.now()
    } else if (hiddenAt) {
      const elapsed = Math.floor((Date.now() - hiddenAt) / 1000)
      state.simulado.timeLeft = Math.max(0, state.simulado.timeLeft - elapsed)
      hiddenAt = null
      updateTimerDisplay()
      if (state.simulado.timeLeft <= 0) { stopTimer(); finishSimulado() }
    }
  }
  state.simulado._visibilityHandler = handleVisibility
  document.addEventListener('visibilitychange', handleVisibility)

  state.simulado.timer = setInterval(() => {
    if (state.simulado.screen !== 'quiz') { stopTimer(); return }
    if (document.hidden) return
    state.simulado.timeLeft--
    updateTimerDisplay()
    if (state.simulado.timeLeft <= 0) { stopTimer(); finishSimulado() }
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
        ${answered ? `<div class="quiz-explanation">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
            <strong>${answers[current] === q.answerIndex ? '✅ Correto!' : '❌ Errado'}</strong>
            ${state.simulado.questionTimes[current] != null ? `<span style="font-size:0.78rem;color:var(--text2);background:var(--card2);padding:0.2rem 0.5rem;border-radius:6px">⏱ ${state.simulado.questionTimes[current]}s</span>` : ''}
          </div>
          ${q.explanation}
        </div>` : ''}
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
    if (!confirm('Deseja sair do simulado? Seu progresso atual será perdido.')) return
    stopTimer()
    state.simulado.screen = 'menu'
    renderTab('simulados')
  })
  document.getElementById('quizPrev')?.addEventListener('click', () => { state.simulado.current--; state.simulado.questionStartTime = Date.now(); renderTab('simulados') })
  document.getElementById('quizNext')?.addEventListener('click', () => { state.simulado.current++; state.simulado.questionStartTime = Date.now(); renderTab('simulados') })
  document.getElementById('quizSkip')?.addEventListener('click', () => {
    const elapsed = Math.round((Date.now() - (state.simulado.questionStartTime || Date.now())) / 1000)
    state.simulado.questionTimes[current] = elapsed
    state.simulado.answers[current] = -1
    if (current < questions.length - 1) { state.simulado.current++; state.simulado.questionStartTime = Date.now(); renderTab('simulados') }
    else finishSimulado()
  })
  document.getElementById('quizFinish')?.addEventListener('click', () => finishSimulado())
}

function answerQuiz(idx) {
  const { current, questions } = state.simulado
  const elapsed = Math.round((Date.now() - (state.simulado.questionStartTime || Date.now())) / 1000)
  state.simulado.questionTimes[current] = elapsed
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
  stopTimer()
  state.simulado.screen = 'result'

  const { questions, answers } = state.simulado
  let correct = 0
  const bySubject = {}
  const wrongQuestions = []

  questions.forEach((q, i) => {
    const isCorrect = answers[i] === q.answerIndex
    if (isCorrect) correct++
    if (!bySubject[q.subject]) bySubject[q.subject] = { total: 0, correct: 0 }
    bySubject[q.subject].total++
    if (isCorrect) bySubject[q.subject].correct++
    if (!isCorrect && answers[i] !== undefined && answers[i] !== -1) {
      wrongQuestions.push({
        id: q.id, subject: q.subject,
        question: q.question.length > 300 ? q.question.slice(0, 300) + '...' : q.question,
        options: q.options, answerIndex: q.answerIndex,
        explanation: q.explanation, date: new Date().toISOString()
      })
    }
  })

  state.simulado.score = { correct, total: questions.length, bySubject }
  track('simulado_finish', { type: state.simulado.type, correct, total: questions.length, pct: Math.round(correct / questions.length * 100) })
  saveToSimuladoHistory({
    date: new Date().toISOString(),
    type: state.simulado.type,
    correct,
    total: questions.length,
    pct: Math.round((correct / questions.length) * 100)
  })
  recordStudyToday()
  api('/api/simulado/finish', { type: state.simulado.type, score: state.simulado.score, wrongQuestions })
    .then(res => {
      if (res?.xpGain) state.xp = (state.xp || 0) + res.xpGain
      checkAndShowNewBadges()
    })
    .catch(() => {})

  // Submit challenge result if this is a challenge simulado
  if (state.simulado._challengeId) {
    const elapsed = state.simulado.timeLeft != null ? (state.simulado._challengeData?.timeLimit || 900) - state.simulado.timeLeft : 0
    api(`/api/challenge/${state.simulado._challengeId}/submit`, {
      answers: state.simulado.answers,
      timeTaken: elapsed
    }).then(res => {
      if (res?.creatorScore || res?.challengerScore) {
        setTimeout(() => {
          const app = document.getElementById('app')
          if (app) renderDesafioResult(app, { ...state.simulado._challengeData, creatorScore: res.creatorScore, challengerScore: res.challengerScore }, state.user?.id)
        }, 3000)
      }
    }).catch(() => {})
  }

  renderTab('simulados')
}

function renderResults(container) {
  const { score } = state.simulado
  if (!score) { state.simulado.screen = 'menu'; renderTab('simulados'); return }

  const pct = Math.round((score.correct / score.total) * 100)
  const nota = Math.round((score.correct / score.total) * 1000)
  const scoreColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const scoreMsg = pct >= 70 ? 'Ótimo resultado! 🎉' : pct >= 50 ? 'Bom esforço! Pode melhorar.' : 'Continue praticando! 💪'

  const typeNames = { mini: 'Mini-simulado', enem: 'ENEM', enem_completo: 'ENEM Completo', vestibular: 'Vestibular', concurso: 'Concurso', ia: 'Simulado IA ✨', diagnostico: 'Diagnóstico' }
  const typeName = typeNames[state.simulado.type] || 'Simulado'

  const hasMultiSubj = Object.keys(score.bySubject).length > 1
  const subjRows = Object.entries(score.bySubject).map(([subj, data]) => {
    const p = Math.round((data.correct / data.total) * 100)
    const color = p >= 70 ? '#10b981' : p >= 50 ? '#f59e0b' : '#ef4444'
    const s = SUBJECTS.find(x => x.id === subj)
    return `
      <div class="results-subj-item">
        <span style="font-size:0.85rem">${s?.emoji || ''} ${subjectLabel(subj)}</span>
        <div class="subj-bar-container"><div class="subj-bar-fill" style="width:${p}%;background:${color}"></div></div>
        <span style="font-weight:700;color:${color};font-size:0.85rem">${data.correct}/${data.total}</span>
      </div>
    `
  }).join('')

  const wrongCount = state.simulado.questions.filter((q, i) => {
    const a = state.simulado.answers[i]
    return a !== undefined && a !== -1 && a !== q.answerIndex
  }).length

  container.innerHTML = `
    <div class="results-screen">
      <div class="results-type-label">${typeName}</div>
      <svg class="results-ring" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface2)" stroke-width="10"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="${scoreColor}" stroke-width="10"
          stroke-dasharray="${2 * Math.PI * 50}"
          stroke-dashoffset="${2 * Math.PI * 50 * (1 - pct/100)}"
          stroke-linecap="round" transform="rotate(-90 60 60)"/>
        <text x="60" y="52" text-anchor="middle" fill="white" font-size="22" font-weight="800">${pct}%</text>
        <text x="60" y="68" text-anchor="middle" fill="var(--text2)" font-size="10">${score.correct} de ${score.total}</text>
      </svg>
      <div class="results-msg" style="color:${scoreColor}">${scoreMsg}</div>
      ${['enem','enem_completo'].includes(state.simulado.type) ? `<div class="results-nota-enem">Nota ENEM estimada: <strong style="color:${scoreColor}">${nota} pontos</strong></div>` : ''}
      ${(() => {
        const times = (state.simulado.questionTimes || []).filter(t => t != null && t > 0)
        if (!times.length) return ''
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        const slowest = Math.max(...times)
        return `<div style="display:flex;gap:0.75rem;justify-content:center;margin:0.5rem 0">
          <div style="background:var(--surface2);border-radius:8px;padding:0.4rem 0.8rem;font-size:0.8rem;color:var(--text2)">⏱ Média: <strong style="color:var(--text)">${avg}s/questão</strong></div>
          <div style="background:var(--surface2);border-radius:8px;padding:0.4rem 0.8rem;font-size:0.8rem;color:var(--text2)">🐢 Mais lenta: <strong style="color:var(--text)">${slowest}s</strong></div>
        </div>`
      })()}
      ${hasMultiSubj ? `
        <div class="results-subjects">
          <div class="results-subj-title">Por matéria</div>
          ${subjRows}
        </div>` : ''}
      <div class="results-actions">
        <button class="btn btn-outline" id="resBack">🔄 Novo simulado</button>
        <button class="btn btn-primary" id="resGabarito">📋 Ver gabarito</button>
      </div>
      ${wrongCount > 0 ? `<button class="btn btn-outline btn-full" id="resSaveFlash" style="margin-top:0.75rem">🃏 Salvar ${wrongCount} ${wrongCount === 1 ? 'erro' : 'erros'} como flashcards</button>` : ''}
      <button class="btn btn-ghost btn-full" id="resShare" style="margin-top:0.5rem">📤 Compartilhar resultado</button>
    </div>
  `

  document.getElementById('resBack').onclick = () => { state.simulado.screen = 'menu'; renderTab('simulados') }
  document.getElementById('resGabarito').onclick = () => { state.simulado.screen = 'gabarito'; renderTab('simulados') }
  document.getElementById('resShare').onclick = () => {
    shareResult(`Acertei ${score.correct}/${score.total} (${pct}%) no ${typeName} do Decifra! 📚 Estude para o ENEM grátis em`)
  }
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

function renderGabarito(container) {
  const { questions, answers, score, questionTimes } = state.simulado
  if (!questions.length) { state.simulado.screen = 'menu'; renderTab('simulados'); return }

  const pct = score ? Math.round((score.correct / score.total) * 100) : 0
  const scoreColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'

  const rows = questions.map((q, i) => {
    const answered = answers[i] !== undefined && answers[i] !== -1
    const isCorrect = answered && answers[i] === q.answerIndex
    const s = SUBJECTS.find(x => x.id === q.subject)
    const opts = q.options.map((opt, j) => {
      let bg = 'transparent'; let border = 'var(--border)'; let color = 'var(--text2)'
      if (j === q.answerIndex) { bg = 'rgba(16,185,129,0.12)'; border = '#10b981'; color = '#10b981' }
      if (answered && answers[i] === j && j !== q.answerIndex) { bg = 'rgba(239,68,68,0.12)'; border = '#ef4444'; color = '#ef4444' }
      return `<div style="padding:0.4rem 0.6rem;border-radius:6px;border:1px solid ${border};background:${bg};color:${color};font-size:0.8rem;margin-bottom:0.25rem">
        <span style="font-weight:700;margin-right:0.4rem">${String.fromCharCode(65+j)}</span>${opt}
        ${j === q.answerIndex ? ' ✅' : (answered && answers[i] === j ? ' ❌' : '')}
      </div>`
    }).join('')
    return `
      <div style="border:1px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : answered ? 'rgba(239,68,68,0.3)' : 'var(--border)'};border-radius:12px;padding:1rem;margin-bottom:0.75rem;background:var(--surface)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
          <span style="font-size:0.75rem;color:${s?.color || 'var(--primary)'};font-weight:600">${s?.emoji || ''} ${subjectLabel(q.subject)}</span>
          <div style="display:flex;gap:0.5rem;align-items:center">
            ${questionTimes?.[i] != null ? `<span style="font-size:0.7rem;color:var(--text3)">⏱ ${questionTimes[i]}s</span>` : ''}
            <span style="font-size:0.75rem;font-weight:700;color:${isCorrect ? '#10b981' : answered ? '#ef4444' : 'var(--text3)'}">${!answered ? '—' : isCorrect ? 'Correto ✅' : 'Errado ❌'}</span>
          </div>
        </div>
        <div style="font-size:0.85rem;line-height:1.5;margin-bottom:0.75rem;color:var(--text)">${q.question}</div>
        <div>${opts}</div>
        ${q.explanation ? `<div style="margin-top:0.5rem;padding:0.5rem;background:rgba(59,130,246,0.08);border-radius:8px;font-size:0.8rem;color:var(--text2);line-height:1.5"><strong style="color:var(--primary)">Explicação:</strong> ${q.explanation}</div>` : ''}
        <div style="margin-top:0.5rem">
          <textarea class="nota-questao" data-qid="${q.id || i}" placeholder="📝 Minha anotação..." rows="2" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.6rem;font-size:0.78rem;color:var(--text2);resize:vertical;font-family:inherit;box-sizing:border-box">${loadLocal('nota_q_' + (q.id || i)) || ''}</textarea>
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = `
    <div class="results-screen" style="text-align:left">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <button class="btn btn-ghost btn-sm" id="gabBack">← Resultado</button>
        <span style="font-size:0.85rem;color:${scoreColor};font-weight:700">${score?.correct}/${score?.total} (${pct}%)</span>
      </div>
      <div style="font-weight:700;font-size:1rem;margin-bottom:1rem">Gabarito completo</div>
      ${rows}
      <button class="btn btn-outline btn-full" id="gabNewSim" style="margin-top:0.5rem">Novo simulado</button>
    </div>
  `
  document.getElementById('gabBack').onclick = () => { state.simulado.screen = 'result'; renderTab('simulados') }
  document.getElementById('gabNewSim').onclick = () => { state.simulado.screen = 'menu'; renderTab('simulados') }
  container.querySelectorAll('.nota-questao').forEach(ta => {
    ta.addEventListener('input', () => saveLocal('nota_q_' + ta.dataset.qid, ta.value))
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

      <div class="card" id="weeklyCard" style="margin-bottom:1.25rem">
        <div class="card-title">Evolução semanal</div>
        <div id="weeklyContent" style="color:var(--text3);font-size:0.85rem;text-align:center;padding:0.5rem 0">Carregando...</div>
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

      <div class="card" id="metasCard">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          Metas por matéria
          <button class="btn btn-ghost btn-sm" id="metasEditBtn" style="font-size:0.75rem">Editar</button>
        </div>
        <div id="metasContent" style="color:var(--text3);font-size:0.85rem;text-align:center;padding:0.5rem 0">Carregando...</div>
      </div>

      <div class="card" id="errosCard">
        <div class="card-title">❌ Revisão de Erros</div>
        <div id="errosContent" style="color:var(--text3);font-size:0.85rem;text-align:center;padding:0.5rem 0">Carregando...</div>
      </div>

      <div class="card" id="histCard">
        <div class="card-title">Histórico de Simulados</div>
        <div id="histContent" style="color:var(--text3);font-size:0.85rem;text-align:center;padding:0.5rem 0">Carregando...</div>
      </div>

      <div class="card" id="rankCard">
        <div class="card-title">🏆 Ranking Global</div>
        <div id="rankContent" style="color:var(--text3);font-size:0.85rem;text-align:center;padding:0.5rem 0">Carregando...</div>
      </div>
    </div>
  `

  loadMetasSection()
  loadErrosSection()
  loadHistoricoSection()
  loadRankingSection()
  loadWeeklySection()
}

async function loadWeeklySection() {
  const el = document.getElementById('weeklyContent')
  if (!el) return
  try {
    const token = localStorage.getItem('decifra_token')
    const r = await fetch(`${API}/api/stats/semanal`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await r.json()
    const weeks = (data.weeks || []).filter(w => w.simulados > 0 || w.total > 0)
    if (!weeks.length) { el.textContent = 'Faça simulados para ver sua evolução aqui.'; return }
    const maxPct = Math.max(...weeks.map(w => w.pct), 1)
    el.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:0.3rem;height:80px;margin-bottom:0.5rem">
        ${weeks.slice(-8).map(w => {
          const barH = w.pct > 0 ? Math.max(8, Math.round((w.pct / 100) * 72)) : 4
          const color = w.pct >= 70 ? '#10b981' : w.pct >= 50 ? '#f59e0b' : w.pct > 0 ? '#ef4444' : 'var(--border)'
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="font-size:0.6rem;color:var(--text3)">${w.pct > 0 ? w.pct + '%' : ''}</div>
            <div style="width:100%;background:${color};border-radius:4px 4px 0 0;height:${barH}px;transition:height 0.3s"></div>
          </div>`
        }).join('')}
      </div>
      <div style="display:flex;gap:0.3rem">
        ${weeks.slice(-8).map(w => `<div style="flex:1;font-size:0.6rem;color:var(--text3);text-align:center">${w.label}</div>`).join('')}
      </div>
      <div style="display:flex;gap:1rem;margin-top:0.75rem;flex-wrap:wrap">
        <span style="font-size:0.78rem;color:var(--text2)">📊 ${data.totalSimulados} simulados</span>
        <span style="font-size:0.78rem;color:var(--text2)">📝 ${data.totalQuestions} questões</span>
      </div>
    `
  } catch {
    const el2 = document.getElementById('weeklyContent')
    if (el2) el2.textContent = 'Erro ao carregar dados.'
  }
}

async function loadHistoricoSection() {
  const el = document.getElementById('histContent')
  if (!el) return
  try {
    const token = localStorage.getItem('decifra_token')
    const r = await fetch(`${API}/api/stats/historico`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await r.json()
    const hist = data.history || []
    if (!hist.length) { el.textContent = 'Nenhum simulado finalizado ainda.'; return }
    const typeNames = { mini: 'Mini', enem: 'ENEM', enem_completo: 'ENEM Completo', vestibular: 'Vestibular', fuvest: 'FUVEST', unicamp: 'UNICAMP', concurso: 'Concurso', concurso_federal: 'C.Federal', militar: 'Militar', ia: 'IA ENEM ✨', vestibular_ia: 'IA Vest. ✨', concurso_ia: 'IA Conc. ✨', diagnostico: 'Diagnóstico' }
    el.innerHTML = `<div class="history-list">${hist.slice(0, 10).map(h => {
      const pct = h.score?.total > 0 ? Math.round((h.score.correct / h.score.total) * 100) : 0
      const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
      const d = new Date(h.date)
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      return `<div class="history-item"><span class="history-type">${typeNames[h.type] || h.type}</span><span class="history-date" style="flex:1;margin-left:0.5rem">${dateStr}</span><span class="history-pct" style="color:${color}">${h.score?.correct || 0}/${h.score?.total || 0} (${pct}%)</span></div>`
    }).join('')}</div>`
  } catch {
    const el2 = document.getElementById('histContent')
    if (el2) el2.textContent = 'Erro ao carregar histórico.'
  }
}

async function loadRankingSection() {
  const el = document.getElementById('rankContent')
  if (!el) return
  try {
    const token = localStorage.getItem('decifra_token')
    const r = await fetch(`${API}/api/ranking`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await r.json()
    const ranking = data.ranking || []
    if (!ranking.length) { el.textContent = 'Nenhum usuário no ranking ainda.'; return }
    el.innerHTML = ranking.slice(0, 20).map(u => {
      const medal = u.position === 1 ? '🥇' : u.position === 2 ? '🥈' : u.position === 3 ? '🥉' : `#${u.position}`
      const isMe = !!u.isMe
      return `<div class="rank-item ${isMe ? 'rank-me' : ''}"><span class="rank-pos">${medal}</span><span class="rank-name">${u.name}${isMe ? ' (você)' : ''}</span><span class="rank-xp">${u.xp} XP</span><span class="rank-streak">🔥${u.streak}</span></div>`
    }).join('')
  } catch {
    const el2 = document.getElementById('rankContent')
    if (el2) el2.textContent = 'Erro ao carregar ranking.'
  }
}

async function loadMetasSection() {
  const el = document.getElementById('metasContent')
  if (!el) return
  try {
    const token = localStorage.getItem('decifra_token')
    const r = await fetch(`${API}/api/metas`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await r.json()
    const metas = data.metas || {}
    const p = state.progresso

    const rows = SUBJECTS.map(s => {
      const perf = p.subjects?.[s.id]
      const atual = perf?.total > 0 ? Math.round((perf.correct / perf.total) * 100) : null
      const meta = metas[s.id]
      const cor = atual === null ? 'var(--text3)' : meta ? (atual >= meta ? '#10b981' : atual >= meta * 0.8 ? '#f59e0b' : '#ef4444') : 'var(--text2)'
      return `<div class="metas-row">
        <span class="metas-subj">${s.emoji} ${s.label.split(' ')[0]}</span>
        <span class="metas-atual" style="color:${cor}">${atual !== null ? atual + '%' : '—'}</span>
        <span class="metas-sep">→</span>
        <span class="metas-meta" style="color:${meta ? 'var(--primary)' : 'var(--text3)'}">${meta ? meta + '%' : '—'}</span>
      </div>`
    }).join('')

    el.innerHTML = `<div style="font-size:0.75rem;color:var(--text3);margin-bottom:0.5rem">Atual → Meta</div><div class="metas-list">${rows}</div>`

    const editBtn = document.getElementById('metasEditBtn')
    if (editBtn) editBtn.onclick = () => showMetasModal(metas)
  } catch {
    const el2 = document.getElementById('metasContent')
    if (el2) el2.textContent = 'Erro ao carregar metas.'
  }
}

function showMetasModal(currentMetas) {
  const existing = document.querySelector('.metas-modal-overlay')
  if (existing) existing.remove()
  const overlay = el('div', 'badge-unlock-overlay')
  const rows = SUBJECTS.map(s => `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
      <span style="flex:1;font-size:0.875rem">${s.emoji} ${s.label.split(' ')[0]}</span>
      <input type="number" min="0" max="100" class="form-input" style="width:70px;text-align:center;padding:0.35rem" data-subject="${s.id}" value="${currentMetas[s.id] || ''}" placeholder="—">
      <span style="font-size:0.8rem;color:var(--text3)">%</span>
    </div>
  `).join('')
  overlay.innerHTML = `<div class="badge-unlock-card" style="max-height:80vh;overflow-y:auto">
    <div class="badge-unlock-title" style="margin-bottom:0.25rem">Definir metas</div>
    <div style="color:var(--text2);font-size:0.8rem;margin-bottom:1rem">Porcentagem de acertos alvo por matéria</div>
    ${rows}
    <button class="btn btn-primary" id="metasSave" style="margin-top:1rem;width:100%">Salvar metas</button>
    <button class="btn btn-ghost" id="metasCancel" style="margin-top:0.5rem;width:100%">Cancelar</button>
  </div>`
  document.body.appendChild(overlay)
  overlay.onclick = e => { if (e.target === overlay) overlay.remove() }
  document.getElementById('metasCancel').onclick = () => overlay.remove()
  document.getElementById('metasSave').onclick = async () => {
    const token = localStorage.getItem('decifra_token')
    const inputs = overlay.querySelectorAll('[data-subject]')
    for (const input of inputs) {
      const subject = input.dataset.subject
      const val = input.value.trim()
      const meta = val ? Math.min(100, Math.max(0, parseInt(val))) : null
      try {
        await fetch(`${API}/api/metas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subject, meta })
        })
      } catch {}
    }
    overlay.remove()
    toast('Metas salvas! 🎯', 'success')
    loadMetasSection()
  }
}

async function loadErrosSection() {
  const el = document.getElementById('errosContent')
  if (!el) return
  try {
    const token = localStorage.getItem('decifra_token')
    const r = await fetch(`${API}/api/erros`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await r.json()
    const erros = data.erros || []
    if (!erros.length) { el.textContent = 'Nenhum erro registrado ainda. Complete simulados para ver seus erros aqui.'; return }

    const grouped = {}
    erros.forEach(e => {
      if (!grouped[e.subject]) grouped[e.subject] = []
      grouped[e.subject].push(e)
    })

    const html = Object.entries(grouped).slice(0, 5).map(([subj, qs]) => {
      const s = SUBJECTS.find(x => x.id === subj)
      return `<div style="margin-bottom:0.75rem">
        <div style="font-size:0.75rem;font-weight:700;color:${s?.color || 'var(--primary)'};margin-bottom:0.25rem">${s?.emoji || ''} ${subjectLabel(subj)} (${qs.length})</div>
        ${qs.slice(0, 2).map(q => `<div style="font-size:0.8rem;color:var(--text2);padding:0.4rem 0.6rem;background:var(--surface2);border-radius:6px;margin-bottom:0.25rem;line-height:1.4">${q.question.slice(0, 100)}${q.question.length > 100 ? '...' : ''}</div>`).join('')}
      </div>`
    }).join('')

    el.innerHTML = `<div style="font-size:0.75rem;color:var(--text3);margin-bottom:0.5rem">${erros.length} questões erradas salvas</div>${html}
      <button class="btn btn-outline btn-full" id="errosSaveFlash" style="margin-top:0.5rem;font-size:0.8rem">🃏 Salvar todos como flashcards</button>`

    document.getElementById('errosSaveFlash')?.addEventListener('click', () => {
      const today = new Date().toISOString().slice(0, 10)
      const deck = loadFlashcardDeck()
      erros.forEach(q => {
        deck.push({
          id: `err_${q.id}_${Date.now()}`,
          subject: q.subject,
          front: q.question.length > 250 ? q.question.slice(0, 250) + '...' : q.question,
          back: `✅ ${q.options[q.answerIndex]}\n\n${q.explanation || ''}`,
          interval: 1, ease: 2.5, nextReview: today, reps: 0, createdAt: today
        })
      })
      saveFlashcardDeck(deck)
      toast(`${erros.length} erros salvos como flashcards! 🃏`, 'success')
    })
  } catch {
    const el2 = document.getElementById('errosContent')
    if (el2) el2.textContent = 'Erro ao carregar revisão de erros.'
  }
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.75rem">
        <button class="btn btn-ghost btn-full" id="maisSharePerfil" style="font-size:0.82rem">🔗 Meu perfil</button>
        <button class="btn btn-ghost btn-full" id="maisReferral" style="font-size:0.82rem">🎁 Indicar amigo</button>
        <button class="btn btn-ghost btn-full" id="maisDesafio" style="font-size:0.82rem;grid-column:span 2">⚔️ Desafiar um amigo</button>
      </div>

      ${!isPro() ? `
      <button class="btn btn-primary btn-full" id="maisUpgrade" style="margin-bottom:1rem">
        ⭐ Ativar Pro — 7 dias grátis
      </button>` : `
      <button class="btn btn-outline btn-full" id="maisPortal" style="margin-bottom:1rem">
        💳 Gerenciar assinatura
      </button>`}

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
            <div class="mais-sub">Cronograma semanal personalizado</div>
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

      <div class="mais-section-title">Recursos</div>
      <div class="mais-grid">
        <a href="/blog" class="mais-item" style="text-decoration:none;color:inherit">
          <div class="mais-icon">📰</div>
          <div class="mais-info">
            <div class="mais-label">Blog — dicas ENEM</div>
            <div class="mais-sub">Estratégias e guias de estudo</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
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

  document.getElementById('maisSharePerfil')?.addEventListener('click', () => {
    const userId = state.user?.id || JSON.parse(localStorage.getItem('decifra_user') || '{}')?.id
    if (!userId) return
    const url = `${window.location.origin}/perfil/${userId}`
    if (navigator.share) {
      navigator.share({ title: 'Meu perfil no Decifra', text: 'Veja meu progresso no Decifra! 📚', url }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(url).then(() => toast('Link do perfil copiado! 🔗', 'success')).catch(() => toast(url, ''))
    }
  })

  document.getElementById('maisReferral')?.addEventListener('click', () => showReferralModal())
  document.getElementById('maisDesafio')?.addEventListener('click', () => showDesafioModal())
  document.getElementById('maisUpgrade')?.addEventListener('click', () => renderUpgradeModal())
  document.getElementById('maisPortal')?.addEventListener('click', async () => {
    const btn = document.getElementById('maisPortal')
    btn.disabled = true; btn.textContent = 'Aguarde...'
    try {
      const data = await api('/api/stripe/portal', {})
      window.location.href = data.url
    } catch {
      toast('Erro ao abrir portal. Tente novamente.', 'error')
      btn.disabled = false; btn.textContent = '💳 Gerenciar assinatura'
    }
  })
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
  const pro = isPro()
  container.innerHTML = `
    <div class="plano-screen">
      <div class="plano-header">
        <div class="plano-icon">📋</div>
        <h2 class="plano-title">Plano de Estudo</h2>
        <p class="plano-sub">Cronograma semanal personalizado com base no seu perfil e desempenho.</p>
        <div class="diag-bullets">
          <div class="diag-bullet">✓ Personalizado para sua prova</div>
          <div class="diag-bullet">✓ Foco nas suas matérias fracas</div>
          <div class="diag-bullet">✓ Regenere quando quiser</div>
        </div>
      </div>
      ${pro
        ? `<button class="btn btn-primary btn-full" id="gerarPlanoBtn">✨ Gerar meu plano</button>`
        : `<div class="card" style="background:var(--primary-glow);border-color:rgba(59,130,246,0.3);text-align:center;padding:1.5rem;margin-bottom:1rem">
            <div style="font-size:1.5rem;margin-bottom:0.5rem">⭐</div>
            <div style="font-weight:700;margin-bottom:0.5rem">Recurso Pro</div>
            <div style="color:var(--text2);font-size:0.875rem;margin-bottom:1rem">Plano de estudo personalizado está disponível a partir do plano Pro (7 dias grátis).</div>
            <button class="btn btn-primary btn-full" id="gerarPlanoBtn">Ver planos Pro →</button>
          </div>`}
      <button class="btn btn-ghost btn-full" id="planoBack" style="margin-top:0.5rem">Voltar</button>
    </div>
  `
  document.getElementById('gerarPlanoBtn').onclick = () => pro ? gerarPlano(container) : renderUpgradeModal()
  document.getElementById('planoBack').onclick = () => switchTab('mais')
}

async function gerarPlano(container) {
  const btn = document.getElementById('gerarPlanoBtn')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando plano...' }
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
const TEMAS_ENEM = [
  'Caminhos para combater o racismo no Brasil',
  'Desafios para a valorização de comunidades e povos tradicionais no Brasil',
  'O estigma associado às doenças mentais na sociedade brasileira',
  'Manipulação do comportamento do usuário pelo controle de dados na internet',
  'Democratização do acesso ao cinema no Brasil',
  'Invisibilidade e registro civil: direitos da pessoa em situação de rua',
  'A persistência da violência contra a mulher na sociedade brasileira',
  'Desafios para a formação educacional de surdos no Brasil',
  'A questão do tráfico de pessoas no Brasil',
  'Publicidade infantil em questão no Brasil',
  'O movimento imigratório para o Brasil no século XXI',
  'Vício em redes sociais na era digital',
  'Os impactos das fake news nas eleições democráticas',
  'Desigualdade social e acesso à educação no Brasil',
  'Mudanças climáticas e o papel da juventude brasileira',
  'Saúde mental dos jovens em tempos de pandemia',
  'A importância da leitura na formação do cidadão brasileiro',
  'Violência doméstica e proteção às vítimas no Brasil',
  'Segurança alimentar e combate à fome no Brasil',
  'Os desafios da inclusão digital no Brasil',
  'Impacto da Inteligência Artificial no mercado de trabalho',
  'Preconceito linguístico e diversidade cultural no Brasil',
]

function renderRedacao(container) {
  const temaOptions = TEMAS_ENEM.map(t => `<option value="${t}">${t}</option>`).join('')
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
          <label class="form-label">Tema da redação</label>
          <select class="form-input" id="redacaoTemaSelect" style="margin-bottom:0.5rem">
            <option value="">— Selecione um tema do ENEM —</option>
            ${temaOptions}
            <option value="__custom__">Outro tema (digitar)</option>
          </select>
          <input type="text" class="form-input" id="redacaoTema" placeholder="Digite o tema da redação..." style="display:none">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Texto da redação</label>
          <textarea class="form-input" id="redacaoTexto" rows="10" placeholder="Cole ou digite sua redação aqui (mínimo 100 caracteres)..." style="resize:vertical;min-height:180px;font-size:0.875rem;line-height:1.6"></textarea>
          <div id="redacaoCharCount" style="font-size:0.75rem;color:var(--text3);margin-top:0.25rem;text-align:right">0 caracteres</div>
        </div>
      </div>
      <button class="btn btn-primary btn-full" id="redacaoSubmit">✨ Corrigir redação</button>
      <div id="redacaoResult"></div>
      ${(() => {
        const hist = loadRedacaoHistory()
        if (!hist.length) return ''
        const items = hist.slice(0, 3).map(h => {
          const color = h.nota >= 700 ? '#10b981' : h.nota >= 500 ? '#f59e0b' : '#ef4444'
          const d = new Date(h.date)
          const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
          const temaShort = h.tema.length > 30 ? h.tema.slice(0, 30) + '…' : h.tema
          return `<div class="history-item"><div class="history-info"><span class="history-type">${temaShort}</span><span class="history-date">${dateStr}</span></div><span class="history-pct" style="color:${color}">${h.nota}</span></div>`
        }).join('')
        return `<div class="mais-section-title" style="margin-top:1.25rem;margin-bottom:0.5rem">Correções anteriores</div><div class="history-list">${items}</div>`
      })()}
    </div>
  `
  document.getElementById('redacaoBack').onclick = () => switchTab('mais')

  const select = document.getElementById('redacaoTemaSelect')
  const temaInput = document.getElementById('redacaoTema')
  select.addEventListener('change', () => {
    temaInput.style.display = select.value === '__custom__' ? 'block' : 'none'
    if (select.value !== '__custom__') temaInput.value = ''
  })

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
  const sel = document.getElementById('redacaoTemaSelect')
  const temaInput = document.getElementById('redacaoTema')
  const tema = sel?.value === '__custom__' ? temaInput?.value.trim() : (sel?.value || '')
  if (!texto || texto.length < 100) { toast('Mínimo 100 caracteres para corrigir.', 'error'); return }

  const btn = document.getElementById('redacaoSubmit')
  btn.disabled = true
  btn.textContent = '⏳ Corrigindo redação...'

  try {
    const data = await api('/api/redacao/corrigir', { texto, tema: tema || undefined })
    saveToRedacaoHistory({
      date: new Date().toISOString(),
      tema: tema || 'Sem tema',
      nota: data.correcao?.nota_total || 0
    })
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

      ${(c.paragrafos?.length > 0) ? `
      <div class="card" style="margin-bottom:1rem">
        <div class="card-title">Feedback por parágrafo</div>
        ${(c.paragrafos || []).map(p => {
          const score = p.nota || 0
          const barColor = score >= 8 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'
          return `
          <div style="margin-bottom:0.75rem;padding:0.75rem;background:var(--surface2);border-radius:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">
              <span style="font-size:0.8rem;font-weight:700;color:var(--text1)">${p.label || 'Parágrafo ' + p.numero}</span>
              <span style="font-size:0.75rem;font-weight:700;color:${barColor}">${score}/10</span>
            </div>
            <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:0.4rem">
              <div style="height:100%;width:${score * 10}%;background:${barColor};border-radius:2px"></div>
            </div>
            <p style="font-size:0.78rem;color:var(--text2);margin:0;line-height:1.5">${p.feedback}</p>
          </div>`
        }).join('')}
      </div>` : ''}

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

      <div style="display:flex;gap:0.75rem;margin-top:0">
        <button class="btn btn-outline" id="redacaoNova" style="flex:1">Nova redação</button>
        <button class="btn btn-ghost" id="redacaoShare" style="flex:1">📤 Compartilhar</button>
      </div>
      ${'speechSynthesis' in window ? `<button class="btn btn-ghost btn-full" id="redacaoTTS" style="margin-top:0.5rem">🔊 Ouvir feedback</button>` : ''}
    </div>
  `
  document.getElementById('redacaoBack2').onclick = () => switchTab('mais')
  document.getElementById('redacaoNova').onclick = () => renderRedacao(container)
  document.getElementById('redacaoShare').onclick = () => {
    const temaText = temaOriginal ? ` sobre "${temaOriginal}"` : ''
    shareResult(`Tirei ${nota} na redação ENEM${temaText} pelo Decifra! ✍️ Corrija a sua grátis em`)
  }
  document.getElementById('redacaoTTS')?.addEventListener('click', () => {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return }
    const btn = document.getElementById('redacaoTTS')
    const comp = (c.competencias || []).map(cc => `${cc.nome}: ${cc.nota} de 200 pontos. ${cc.comentario}`).join('. ')
    const pontos = (c.pontos_fortes || []).join('. ')
    const melh = (c.melhorias || []).join('. ')
    const txt = `Sua nota foi ${nota} pontos. ${c.resumo || ''}. Competências: ${comp}. Pontos fortes: ${pontos}. Melhorias: ${melh}.`
    const utter = new SpeechSynthesisUtterance(txt)
    utter.lang = 'pt-BR'; utter.rate = 0.95
    const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('pt'))
    if (voices.length) utter.voice = voices[0]
    utter.onstart = () => { btn.textContent = '⏹ Parar'; btn.style.color = '#ef4444' }
    utter.onend = () => { btn.textContent = '🔊 Ouvir feedback'; btn.style.color = '' }
    speechSynthesis.speak(utter)
  })
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
        <div class="fc-ai-divider">ou gere automaticamente</div>
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

// ===== PERFIL PÚBLICO =====
async function renderPerfilPublico(userId) {
  const app = document.getElementById('app')
  app.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div></div>`

  const SUBJECTS_MAP = { matematica: { label: 'Matemática', emoji: '📐', color: '#3b82f6' }, portugues: { label: 'Português', emoji: '📖', color: '#8b5cf6' }, biologia: { label: 'Biologia', emoji: '🧬', color: '#10b981' }, quimica: { label: 'Química', emoji: '⚗️', color: '#f59e0b' }, fisica: { label: 'Física', emoji: '⚡', color: '#ef4444' }, historia: { label: 'História', emoji: '🏛️', color: '#f97316' }, geografia: { label: 'Geografia', emoji: '🌍', color: '#06b6d4' }, filosofia: { label: 'Filosofia', emoji: '🤔', color: '#a78bfa' }, ingles: { label: 'Inglês', emoji: '🌐', color: '#ec4899' } }

  try {
    const data = await fetch(`${API}/api/perfil/${userId}`).then(r => r.json())
    if (data.error) throw new Error(data.error)

    const xp = data.xp || 0
    const level = getXpLevel(xp)
    const pct = data.totalQuestions > 0 ? Math.round((data.correct / data.totalQuestions) * 100) : 0
    const badges = getEarnedBadges({ totalQuestions: data.totalQuestions, correct: data.correct, streak: data.streak }, xp)

    const subjRows = Object.entries(data.subjects || {}).filter(([, d]) => d.total > 0).map(([subj, d]) => {
      const sp = Math.round((d.correct / d.total) * 100)
      const color = sp >= 70 ? '#10b981' : sp >= 50 ? '#f59e0b' : '#ef4444'
      const s = SUBJECTS_MAP[subj] || { label: subj, emoji: '📚', color: '#3b82f6' }
      return `<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <span style="font-size:0.875rem;width:90px;color:${s.color}">${s.emoji} ${s.label.split(' ')[0]}</span>
        <div style="flex:1;height:8px;background:#1a2540;border-radius:4px;overflow:hidden"><div style="height:100%;width:${sp}%;background:${color};border-radius:4px"></div></div>
        <span style="font-size:0.8rem;font-weight:700;color:${color};width:32px;text-align:right">${sp}%</span>
      </div>`
    }).join('')

    app.innerHTML = `
      <div style="min-height:100vh;background:#0a0f1e;color:#f9fafb;font-family:Inter,sans-serif;padding:2rem 1rem">
        <div style="max-width:500px;margin:0 auto">
          <div style="text-align:center;margin-bottom:2rem">
            <a href="/" style="color:#3b82f6;font-size:1.5rem;font-weight:800;text-decoration:none">Decifra<span style="color:#3b82f6">.</span></a>
          </div>
          <div style="background:#111827;border:1px solid #1e2d4a;border-radius:20px;padding:1.75rem;text-align:center;margin-bottom:1rem">
            <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:1.75rem;font-weight:800;margin:0 auto 1rem">${(data.name || 'E')[0].toUpperCase()}</div>
            <div style="font-size:1.25rem;font-weight:700;margin-bottom:0.25rem">${data.name || 'Estudante'}</div>
            <div style="color:${level.color};font-weight:700;margin-bottom:1rem">${level.emoji} ${level.name} · ${xp} XP</div>
            <div style="display:flex;justify-content:center;gap:2rem">
              <div><div style="font-size:1.5rem;font-weight:900;color:#3b82f6">${data.totalQuestions || 0}</div><div style="font-size:0.75rem;color:#6b7280">questões</div></div>
              <div><div style="font-size:1.5rem;font-weight:900;color:#10b981">${pct}%</div><div style="font-size:0.75rem;color:#6b7280">acertos</div></div>
              <div><div style="font-size:1.5rem;font-weight:900;color:#f59e0b">🔥${data.streak || 0}</div><div style="font-size:0.75rem;color:#6b7280">streak</div></div>
              <div><div style="font-size:1.5rem;font-weight:900;color:#a78bfa">${data.simuladosDone || 0}</div><div style="font-size:0.75rem;color:#6b7280">simulados</div></div>
            </div>
          </div>
          ${badges.length > 0 ? `
          <div style="background:#111827;border:1px solid #1e2d4a;border-radius:16px;padding:1.25rem;margin-bottom:1rem">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem">Conquistas ${badges.length}/${BADGES.length}</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem">${badges.map(b => `<div style="background:#1a2540;border-radius:10px;padding:0.4rem 0.75rem;font-size:0.8rem;display:flex;align-items:center;gap:0.375rem">${b.icon} ${b.name}</div>`).join('')}</div>
          </div>` : ''}
          ${subjRows ? `
          <div style="background:#111827;border:1px solid #1e2d4a;border-radius:16px;padding:1.25rem;margin-bottom:1.5rem">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem">Por matéria</div>
            ${subjRows}
          </div>` : ''}
          <div style="text-align:center">
            <a href="/app" style="background:#3b82f6;color:#fff;padding:0.875rem 2rem;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block;margin-bottom:0.75rem">Estudar no Decifra grátis →</a>
            <div style="color:#6b7280;font-size:0.8rem">ENEM · Vestibulares · Concursos Públicos</div>
          </div>
        </div>
      </div>
    `
  } catch {
    app.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><p style="color:#9ca3af;margin-top:1rem">Perfil não encontrado.</p><a href="/" style="color:#3b82f6;margin-top:0.5rem;display:block">← Ir para o início</a></div>`
  }
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
    track('checkout_start', { plan: selected })
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

// ===== TRIAL EXPIRADO =====
function checkTrialExpired() {
  if (state.plan !== 'free') return
  if (!state.trialUsed && !state.trialEnd) return
  if (!state.trialUsed) return
  const shownKey = 'decifra_trial_exp_shown'
  if (localStorage.getItem(shownKey) === new Date().toISOString().slice(0, 10)) return
  localStorage.setItem(shownKey, new Date().toISOString().slice(0, 10))
  setTimeout(() => showTrialExpiredModal(), 800)
}

function showTrialExpiredModal() {
  const overlay = el('div', 'modal-overlay center')
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:420px">
      <div style="text-align:center;margin-bottom:1rem">
        <div style="font-size:2.5rem;margin-bottom:0.5rem">😢</div>
        <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:0.5rem">Seu período Pro expirou</h2>
        <p style="color:var(--text2);font-size:0.9rem;line-height:1.6">Você voltou ao plano gratuito. Continue tendo acesso ao tutor (5 perguntas/dia), mini-simulados e questão do dia.</p>
      </div>
      <div style="background:var(--card2);border-radius:10px;padding:1rem;margin-bottom:1.25rem">
        <div style="font-size:0.85rem;font-weight:600;margin-bottom:0.5rem;color:var(--text1)">O que você perde no Free:</div>
        <ul style="color:var(--text2);font-size:0.82rem;line-height:2;margin:0;padding-left:1.25rem">
          <li>Tutor ilimitado (limite de 5/dia no Free)</li>
          <li>Plano de estudo personalizado</li>
          <li>Correção de redação ilimitada</li>
          <li>Simulados ENEM + IA</li>
          <li>Flashcards IA por tópico</li>
        </ul>
      </div>
      <button class="btn btn-primary btn-full" id="trialExpUpgrade" style="margin-bottom:0.5rem">⭐ Assinar Pro — R$29/mês</button>
      <button class="btn btn-ghost btn-full" id="trialExpClose">Continuar no Free</button>
    </div>
  `
  document.body.appendChild(overlay)
  document.getElementById('trialExpUpgrade').onclick = () => { overlay.remove(); renderUpgradeModal() }
  document.getElementById('trialExpClose').onclick = () => overlay.remove()
}

// ===== STREAK RECOVERY =====
function checkStreakLost() {
  const lastStreak = parseInt(localStorage.getItem('decifra_last_known_streak') || '0')
  const currentStreak = state.progresso?.streak || 0
  // Save current streak for next time
  if (currentStreak > 0) localStorage.setItem('decifra_last_known_streak', String(currentStreak))
  // Show modal if user had a streak >= 3 and it just dropped to 0
  if (lastStreak >= 3 && currentStreak === 0) {
    const shownKey = 'decifra_streak_loss_shown'
    if (localStorage.getItem(shownKey) === new Date().toISOString().slice(0, 10)) return
    localStorage.setItem(shownKey, new Date().toISOString().slice(0, 10))
    setTimeout(() => showStreakLostModal(lastStreak), 1200)
  }
}

function showStreakLostModal(lostStreak) {
  const overlay = el('div', 'modal-overlay center')
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:380px;text-align:center">
      <div style="font-size:3rem;margin-bottom:0.75rem">💔</div>
      <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:0.5rem">Streak de ${lostStreak} dias perdido</h2>
      <p style="color:var(--text2);font-size:0.9rem;line-height:1.6;margin-bottom:1.25rem">Você não estudou ontem e seu streak zerou. Mas não tem problema — comece um novo agora! Cada dia de estudo conta. 💪</p>
      <button class="btn btn-primary btn-full" id="streakRecoverStart" style="margin-bottom:0.5rem">Começar novo streak agora</button>
      <button class="btn btn-ghost btn-full" id="streakRecoverClose">Fechar</button>
    </div>
  `
  document.body.appendChild(overlay)
  document.getElementById('streakRecoverStart').onclick = () => { overlay.remove(); switchTab('simulados') }
  document.getElementById('streakRecoverClose').onclick = () => overlay.remove()
  overlay.onclick = e => { if (e.target === overlay) overlay.remove() }
}

// ===== DESAFIO ENTRE AMIGOS =====
async function showDesafioModal() {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:420px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="font-size:1.1rem;font-weight:700">⚔️ Desafiar um amigo</h2>
        <button id="desafioClose" style="background:none;border:none;color:var(--text2);font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <p style="color:var(--text2);font-size:0.875rem;line-height:1.6;margin-bottom:1.25rem">Gere um link de desafio com 10 questões. Seu amigo faz o mesmo simulado e vocês comparam resultados!</p>
      <div id="desafioContent">
        <button class="btn btn-primary btn-full" id="desafioCriar">⚔️ Criar desafio</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.onclick = e => { if (e.target === overlay) overlay.remove() }
  document.getElementById('desafioClose').onclick = () => overlay.remove()
  document.getElementById('desafioCriar').onclick = async () => {
    const btn = document.getElementById('desafioCriar')
    btn.disabled = true; btn.textContent = 'Gerando...'
    try {
      const data = await api('/api/challenge/create', { type: 'mini' })
      document.getElementById('desafioContent').innerHTML = `
        <div style="background:var(--card2);border-radius:10px;padding:1rem;margin-bottom:0.75rem">
          <div style="font-size:0.75rem;color:var(--text2);margin-bottom:0.4rem">Link do desafio (válido 7 dias)</div>
          <div style="font-family:monospace;font-size:0.85rem;color:var(--primary);word-break:break-all">${data.url}</div>
        </div>
        <div style="font-size:0.78rem;color:var(--text2);margin-bottom:0.75rem">10 questões · ${Math.round(data.timeLimit/60)} min · você e seu amigo fazem o mesmo simulado</div>
        <button class="btn btn-primary btn-full" id="desafioShare" style="margin-bottom:0.5rem">📤 Compartilhar desafio</button>
        <button class="btn btn-ghost btn-full" id="desafioCopy">📋 Copiar link</button>
      `
      document.getElementById('desafioShare').onclick = () => {
        if (navigator.share) navigator.share({ title: 'Desafio no Decifra!', text: 'Te desafio num simulado de 10 questões! Quem acerta mais? 🎯', url: data.url }).catch(() => {})
        else { navigator.clipboard?.writeText(data.url); toast('Link copiado! 🔗', 'success') }
      }
      document.getElementById('desafioCopy').onclick = () => {
        navigator.clipboard?.writeText(data.url).then(() => toast('Link copiado! 🔗', 'success')).catch(() => {})
      }
    } catch (err) {
      toast(err.message || 'Erro ao criar desafio', 'error')
      btn.disabled = false; btn.textContent = '⚔️ Criar desafio'
    }
  }
}

async function renderDesafio(challengeId) {
  const app = document.getElementById('app')
  app.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div><p style="color:var(--text2);font-size:0.875rem">Carregando desafio...</p></div>`
  try {
    const data = await fetch(`${API}/api/challenge/${challengeId}`).then(r => r.json())
    if (data.error) { app.innerHTML = `<div class="auth-screen"><div class="auth-card"><p style="color:#ef4444">${data.error}</p><a href="/app" class="btn btn-primary btn-full" style="margin-top:1rem">Entrar no app</a></div></div>`; return }

    if (!state.token) {
      app.innerHTML = `<div class="auth-screen"><div class="auth-card" style="max-width:400px">
        <div class="auth-logo">Decifra<span>.</span></div>
        <h2 style="font-size:1.1rem;margin-bottom:0.5rem">⚔️ ${data.creatorName} te desafiou!</h2>
        <p style="color:var(--text2);font-size:0.875rem;margin-bottom:1.25rem">Faça login ou crie sua conta para aceitar o desafio de 10 questões.</p>
        <a href="/app" class="btn btn-primary btn-full">Entrar e aceitar desafio →</a>
      </div></div>`
      return
    }

    // Já tem resultado do criador?
    const myId = state.user?.id
    const iCreated = myId && data.creatorScore?.userId === myId
    const alreadySubmitted = iCreated ? !!data.creatorScore : !!data.challengerScore
    if (alreadySubmitted) {
      renderDesafioResult(app, data, myId)
      return
    }

    // Start challenge simulado
    state.simulado = { screen: 'quiz', type: 'desafio', questions: data.questions, current: 0, answers: new Array(data.questions.length).fill(-1), timeLeft: data.timeLimit, timer: null, score: null, loading: false, questionTimes: [], questionStartTime: Date.now(), _challengeId: challengeId, _challengeData: data }
    renderApp()
    setTimeout(() => {
      switchTab('simulados')
      renderTab('simulados')
    }, 50)
  } catch {
    app.innerHTML = `<div class="auth-screen"><div class="auth-card"><p>Erro ao carregar desafio.</p><a href="/app" class="btn btn-primary btn-full" style="margin-top:1rem">Voltar</a></div></div>`
  }
}

function renderDesafioResult(container, data, myId) {
  const cs = data.creatorScore
  const chs = data.challengerScore
  const html = `<div class="auth-screen"><div class="auth-card" style="max-width:480px">
    <div class="auth-logo">Decifra<span>.</span> ⚔️</div>
    <h2 style="font-size:1.1rem;margin-bottom:1rem">Resultado do desafio</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.25rem">
      <div style="background:var(--card2);border-radius:12px;padding:1rem;text-align:center">
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:0.25rem">${data.creatorName || 'Criador'}</div>
        <div style="font-size:2rem;font-weight:900;color:var(--primary)">${cs ? cs.pct + '%' : '—'}</div>
        <div style="font-size:0.75rem;color:var(--text3)">${cs ? cs.correct + '/' + cs.total : 'Aguardando'}</div>
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:1rem;text-align:center">
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:0.25rem">Desafiado</div>
        <div style="font-size:2rem;font-weight:900;color:#10b981">${chs ? chs.pct + '%' : '—'}</div>
        <div style="font-size:0.75rem;color:var(--text3)">${chs ? chs.correct + '/' + chs.total : 'Aguardando'}</div>
      </div>
    </div>
    ${cs && chs ? `<div style="text-align:center;font-size:1rem;font-weight:700;margin-bottom:1rem">${cs.pct > chs.pct ? '🏆 ' + (data.creatorName || 'Criador') + ' venceu!' : chs.pct > cs.pct ? '🏆 Desafiado venceu!' : '🤝 Empate!'}</div>` : '<p style="color:var(--text2);text-align:center;font-size:0.875rem">Aguardando o outro participante...</p>'}
    <a href="/app" class="btn btn-primary btn-full">Voltar ao app</a>
  </div></div>`
  container.innerHTML = html
}

// ===== REFERRAL MODAL =====
async function showReferralModal() {
  const overlay = el('div', 'modal-overlay center')
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:420px">
      <button class="modal-close" id="refClose">✕</button>
      <div style="text-align:center;margin-bottom:1rem">
        <div style="font-size:2rem;margin-bottom:0.5rem">🎁</div>
        <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:0.5rem">Indique um amigo</h2>
        <p style="color:var(--text2);font-size:0.875rem;line-height:1.6">Você e seu amigo ganham <strong style="color:#10b981">+7 dias Pro grátis</strong> cada um!</p>
      </div>
      <div id="refContent" style="text-align:center">
        <div class="spinner" style="margin:2rem auto"></div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  document.getElementById('refClose').onclick = () => overlay.remove()
  overlay.onclick = e => { if (e.target === overlay) overlay.remove() }

  try {
    const data = await api('/api/referral/code')
    document.getElementById('refContent').innerHTML = `
      <div style="background:var(--card2);border-radius:10px;padding:1rem;margin-bottom:1rem">
        <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.5rem">Seu link de indicação</div>
        <div style="font-family:monospace;font-size:0.95rem;color:var(--primary);word-break:break-all">${data.url}</div>
      </div>
      <button class="btn btn-primary btn-full" id="refShare" style="margin-bottom:0.5rem">📤 Compartilhar link</button>
      <button class="btn btn-ghost btn-full" id="refCopy">📋 Copiar link</button>
      <p style="color:var(--text2);font-size:0.78rem;margin-top:1rem">Quando um amigo criar conta com seu link, ambos ganham 7 dias Pro!</p>
    `
    document.getElementById('refShare').onclick = () => {
      if (navigator.share) navigator.share({ title: 'Decifra — estude para o ENEM', text: 'Estou usando o Decifra para estudar para o ENEM. Entre com meu link e ganhe 7 dias Pro grátis!', url: data.url }).catch(() => {})
      else { navigator.clipboard?.writeText(data.url); toast('Link copiado!', 'success') }
    }
    document.getElementById('refCopy').onclick = () => {
      navigator.clipboard?.writeText(data.url).then(() => toast('Link copiado! 🔗', 'success')).catch(() => toast(data.url, ''))
    }
  } catch {
    document.getElementById('refContent').innerHTML = `<p style="color:var(--text2)">Erro ao carregar código. Tente novamente.</p>`
  }
}

// ===== ADMIN =====
function renderAdmin() {
  document.getElementById('app').innerHTML = `
    <div class="auth-screen">
      <div class="auth-card" style="max-width:480px">
        <div class="auth-logo">Decifra<span>.</span> Admin</div>
        <div id="adminContent">
          <input type="password" class="form-input" id="adminKey" placeholder="Chave admin" style="margin-bottom:12px">
          <button class="btn btn-primary btn-full" id="adminLogin">Entrar</button>
        </div>
      </div>
    </div>
  `
  document.getElementById('adminLogin').onclick = async () => {
    const key = document.getElementById('adminKey').value
    if (!key) return
    const btn = document.getElementById('adminLogin')
    btn.disabled = true; btn.textContent = 'Carregando...'
    try {
      const res = await fetch(`${API}/api/admin/stats`, { headers: { 'x-admin-key': key } })
      if (!res.ok) throw new Error('Chave inválida')
      const d = await res.json()
      document.getElementById('adminContent').innerHTML = `
        <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:1rem;color:var(--text1)">Dashboard — ${new Date().toLocaleDateString('pt-BR')}</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.25rem">
          ${[
            ['👥 Total usuários', d.total],
            ['📅 Hoje', d.today],
            ['📆 Esta semana', d.week],
            ['🗓 Este mês', d.month],
            ['🆓 Free', d.free],
            ['⏳ Trial ativo', d.trialing],
            ['⭐ Pro ativo', d.active],
            ['💰 MRR estimado', `R$${d.mrr}`],
            ['📈 Conversão', `${d.convRate}%`],
            ['🔥 Com streak', d.withStreak],
            ['⚡ XP médio', d.avgXp],
            ['📝 Questões/user', d.avgQ],
          ].map(([label, val]) => `
            <div style="background:var(--card2);border-radius:10px;padding:0.875rem;text-align:center">
              <div style="font-size:0.75rem;color:var(--text2);margin-bottom:0.25rem">${label}</div>
              <div style="font-size:1.4rem;font-weight:800;color:var(--primary)">${val}</div>
            </div>
          `).join('')}
        </div>
        <a href="/app" class="btn btn-ghost btn-full">← Voltar ao app</a>
      `
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Entrar'
      document.getElementById('adminKey').style.border = '1px solid #ef4444'
      toast(err.message, 'error')
    }
  }
  document.getElementById('adminKey').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('adminLogin').click() })
}

// ===== BLOG =====
const BLOG_POSTS = [
  {
    slug: 'como-estudar-matematica-enem',
    title: 'Como estudar Matemática para o ENEM: guia completo',
    date: '2026-05-10',
    description: 'As 5 estratégias mais eficientes para dominar a Matemática do ENEM, com foco nos tópicos mais cobrados.',
    content: `
      <p>A Matemática é uma das áreas que mais assusta os candidatos do ENEM. Mas com a estratégia certa, é possível melhorar significativamente sua nota.</p>
      <h2>1. Conheça os tópicos mais cobrados</h2>
      <p>Funções, geometria plana, probabilidade e estatística respondem por mais de 60% das questões de Matemática no ENEM. Priorize esses tópicos.</p>
      <h2>2. Resolva questões antigas</h2>
      <p>As provas anteriores do ENEM são o melhor material de estudo. O Decifra tem simulados baseados em questões reais dos últimos anos.</p>
      <h2>3. Entenda, não decore</h2>
      <p>O ENEM cobra raciocínio lógico, não memorização. Entenda o conceito por trás de cada fórmula.</p>
      <h2>4. Use o tutor IA para tirar dúvidas</h2>
      <p>Quando travar em alguma questão, o tutor do Decifra explica o raciocínio passo a passo em segundos.</p>
      <h2>5. Pratique diariamente</h2>
      <p>5 questões por dia são suficientes para criar o hábito e evoluir consistentemente até o ENEM.</p>
    `
  },
  {
    slug: 'redacao-enem-como-tirar-1000',
    title: 'Redação ENEM: como tirar 1000 — o guia definitivo',
    date: '2026-05-12',
    description: 'Entenda as 5 competências avaliadas na redação do ENEM e veja exemplos práticos para alcançar a nota máxima.',
    content: `
      <p>A nota 1000 na redação do ENEM é o sonho de muitos candidatos. Entender as 5 competências é o primeiro passo.</p>
      <h2>As 5 competências avaliadas</h2>
      <ol>
        <li><strong>Domínio da norma culta:</strong> Gramática, ortografia e pontuação corretas.</li>
        <li><strong>Compreensão do tema:</strong> Abordagem dentro do recorte temático proposto.</li>
        <li><strong>Seleção de argumentos:</strong> Argumentos pertinentes e coerentes para defender o ponto de vista.</li>
        <li><strong>Coesão e coerência:</strong> Uso correto de conectivos e progressão lógica das ideias.</li>
        <li><strong>Proposta de intervenção:</strong> Solução detalhada com agente, ação, modo, efeito e finalidade.</li>
      </ol>
      <h2>Estrutura ideal</h2>
      <p>Introdução (2 parágrafos) → Desenvolvimento (2 parágrafos com argumentos) → Conclusão com proposta de intervenção.</p>
      <h2>Use o Decifra para praticar</h2>
      <p>O Decifra corrige sua redação com nota 0-1000 em cada competência e dá feedback específico para você melhorar.</p>
    `
  },
  {
    slug: 'plano-de-estudos-enem-3-meses',
    title: 'Plano de estudos para o ENEM em 3 meses',
    date: '2026-05-14',
    description: 'Um cronograma realista e eficiente para quem tem apenas 3 meses para se preparar para o ENEM.',
    content: `
      <p>Com 3 meses de preparação focada, é possível melhorar consideravelmente sua nota no ENEM. Veja como organizar seu tempo.</p>
      <h2>Mês 1 — Diagnóstico e base</h2>
      <p>Faça o diagnóstico completo para identificar seus pontos fracos. Dedique 70% do tempo às matérias mais deficitárias.</p>
      <h2>Mês 2 — Questões e prática</h2>
      <p>Resolva pelo menos 200 questões de simulados. Use o tutor IA para entender os erros imediatamente.</p>
      <h2>Mês 3 — Revisão e simulados completos</h2>
      <p>Foque nos pontos que ainda erram mais. Faça pelo menos 2 simulados completos para treinar resistência.</p>
      <h2>Dica: use o Decifra</h2>
      <p>O plano de estudos do Decifra cria um cronograma semanal personalizado baseado na sua prova e data-alvo.</p>
    `
  },
  {
    slug: 'como-passar-fuvest-unicamp-vestibulares',
    title: 'FUVEST e UNICAMP: estratégias para passar nas melhores universidades do Brasil',
    date: '2026-05-16',
    description: 'Entenda as diferenças entre FUVEST e UNICAMP e saiba como montar um plano de estudos eficiente para passar na USP ou UNICAMP.',
    content: `
      <p>A FUVEST (USP) e a UNICAMP são dois dos vestibulares mais concorridos do Brasil. Entender as diferenças entre eles é essencial para se preparar de forma eficiente.</p>
      <h2>FUVEST: o vestibular da USP</h2>
      <p>A FUVEST tem duas fases. A primeira é eliminatória com 90 questões de múltipla escolha cobrindo todo o ensino médio. A segunda é discursiva com redação obrigatória.</p>
      <ul>
        <li><strong>Biologia e Química</strong> têm peso alto na primeira fase</li>
        <li><strong>Matemática</strong> exige nível elevado de raciocínio formal</li>
        <li><strong>Literatura brasileira</strong> é muito cobrada em Português</li>
        <li>A prova dura 5 horas com 90 questões</li>
      </ul>
      <h2>UNICAMP: criatividade e interdisciplinaridade</h2>
      <p>O vestibular da UNICAMP é famoso por questões interdisciplinares que exigem raciocínio analítico e criatividade, não apenas memorização.</p>
      <ul>
        <li>Questões de contexto atual (política, ciência, cultura)</li>
        <li><strong>Redação obrigatória</strong> com foco em argumentação</li>
        <li>Física e Química com forte componente experimental</li>
        <li>Menor peso de memorização, maior peso de raciocínio</li>
      </ul>
      <h2>Como se preparar com o Decifra</h2>
      <p>O Decifra tem simulados específicos para FUVEST e UNICAMP com questões de provas anteriores. Use o modo IA Vestibular para treinar com questões geradas no estilo de cada banca.</p>
      <h2>Dicas de estudo</h2>
      <ol>
        <li>Faça o diagnóstico para identificar suas matérias mais fracas</li>
        <li>Resolva questões reais das últimas 5 edições de cada vestibular</li>
        <li>Pratique redação semanalmente com correção automática</li>
        <li>Use o tutor IA para questões de Física e Química avançadas</li>
      </ol>
    `
  },
  {
    slug: 'como-passar-concurso-publico-federal',
    title: 'Concurso Público Federal: como estudar e passar na primeira tentativa',
    date: '2026-05-17',
    description: 'Guia completo para candidatos de concursos públicos federais: matérias obrigatórias, estratégias de estudo e como usar o Decifra para se preparar.',
    content: `
      <p>Os concursos públicos federais oferecem estabilidade, bons salários e benefícios. Mas a aprovação exige método e disciplina. Veja como estruturar sua preparação.</p>
      <h2>Matérias obrigatórias em concursos federais</h2>
      <p>Independente do cargo, quase todos os concursos federais cobram:</p>
      <ul>
        <li><strong>Língua Portuguesa:</strong> interpretação de texto, gramática, ortografia</li>
        <li><strong>Raciocínio Lógico:</strong> proposições, silogismos, tabelas e sequências</li>
        <li><strong>Informática:</strong> pacote Office, internet, segurança da informação</li>
        <li><strong>Matemática básica:</strong> porcentagem, regra de três, juros</li>
        <li><strong>Legislação:</strong> Constituição Federal, lei do órgão específico</li>
      </ul>
      <h2>Estratégia de estudo eficiente</h2>
      <ol>
        <li><strong>Escolha o concurso-alvo:</strong> Foque em 1 ou 2 concursos por vez</li>
        <li><strong>Baixe o edital:</strong> O edital define exatamente o que será cobrado</li>
        <li><strong>Priorize Português e Raciocínio Lógico:</strong> São as matérias com maior peso</li>
        <li><strong>Resolva questões do CESPE, FCC e FGV:</strong> As principais bancas têm estilos distintos</li>
        <li><strong>Faça simulados cronometrados:</strong> A gestão do tempo é decisiva</li>
      </ol>
      <h2>Diferença entre bancas</h2>
      <p><strong>CESPE/CEBRASPE:</strong> Questões certo/errado, pune erros. Exige conhecimento preciso.<br>
      <strong>FCC:</strong> Múltipla escolha clássica, cobra mais decoreba de legislação.<br>
      <strong>FGV:</strong> Questões mais interpretativas, cobra raciocínio e atualidades.</p>
      <h2>Use o Decifra para concursos</h2>
      <p>O Decifra tem simulados específicos para concursos públicos com questões de Raciocínio Lógico, Português e Informática. Use o modo IA Concurso para treinar com questões no estilo das principais bancas.</p>
    `
  },
  {
    slug: 'raciocinio-logico-concursos-guia',
    title: 'Raciocínio Lógico para concursos: do zero à aprovação',
    date: '2026-05-18',
    description: 'Domine os tipos de questões de raciocínio lógico mais cobrados em concursos públicos com exemplos práticos e dicas de resolução rápida.',
    content: `
      <p>Raciocínio Lógico é a matéria que mais reprova em concursos públicos. Mas também é a que mais se aprende com prática sistemática. Veja o guia completo.</p>
      <h2>Tipos de questões mais cobrados</h2>
      <ul>
        <li><strong>Proposições lógicas:</strong> negação, conjunção, disjunção, condicional</li>
        <li><strong>Silogismos:</strong> "Todo A é B. Todo B é C. Logo, todo A é C."</li>
        <li><strong>Sequências e padrões:</strong> numéricas, alfabéticas, figurativas</li>
        <li><strong>Tabelas e gráficos:</strong> interpretação de dados estatísticos</li>
        <li><strong>Lógica de conjuntos:</strong> diagramas de Euler-Venn</li>
        <li><strong>Raciocínio analítico:</strong> ordenação, posicionamento, agrupamento</li>
      </ul>
      <h2>Técnica da negação</h2>
      <p>Para questões do tipo "se P então Q", a negação correta é "P e não Q" — não é "se P então não Q" nem "se não P então Q". Dominar negações é essencial para o CESPE.</p>
      <h2>Estratégia de resolução rápida</h2>
      <ol>
        <li>Leia a questão identificando o tipo (proposição, sequência, conjunto)</li>
        <li>Desenhe o diagrama ou monte a tabela antes de resolver</li>
        <li>Elimine alternativas claramente erradas primeiro</li>
        <li>Nunca pule questões de lógica — geralmente têm resolução mecânica</li>
      </ol>
      <h2>Quanto tempo dedicar?</h2>
      <p>Dedique 30 minutos por dia exclusivamente para Raciocínio Lógico durante 60 dias. Com o Decifra, você pode fazer mini-simulados específicos de Raciocínio Lógico e usar o tutor IA para entender imediatamente os erros.</p>
    `
  },
]

function renderBlogIndex() {
  document.getElementById('app').innerHTML = `
    <div style="max-width:680px;margin:0 auto;padding:2rem 1rem;font-family:sans-serif;color:#f9fafb;background:#0a0f1e;min-height:100vh">
      <a href="/" style="color:#3b82f6;text-decoration:none;font-size:0.875rem">← Decifra</a>
      <h1 style="font-size:2rem;font-weight:800;margin:1.5rem 0 0.5rem;color:#f9fafb">Blog</h1>
      <p style="color:#9ca3af;margin-bottom:2rem">Dicas e estratégias para o ENEM, vestibulares e concursos.</p>
      ${BLOG_POSTS.map(p => `
        <a href="/blog/${p.slug}" style="display:block;background:#111827;border:1px solid #1e2d4a;border-radius:12px;padding:1.25rem;margin-bottom:1rem;text-decoration:none;color:inherit;transition:border-color 0.2s" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#1e2d4a'">
          <div style="font-size:0.8rem;color:#6b7280;margin-bottom:0.5rem">${new Date(p.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}</div>
          <h2 style="font-size:1.1rem;font-weight:700;color:#f9fafb;margin-bottom:0.5rem">${p.title}</h2>
          <p style="color:#9ca3af;font-size:0.875rem;margin:0;line-height:1.6">${p.description}</p>
        </a>
      `).join('')}
      <div style="margin-top:2rem;padding:1.5rem;background:#111827;border-radius:12px;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:0.5rem">📚</div>
        <div style="font-weight:700;margin-bottom:0.5rem">Estude com o Decifra</div>
        <p style="color:#9ca3af;font-size:0.875rem;margin-bottom:1rem">Simulados, tutor IA, flashcards e muito mais.</p>
        <a href="/app" style="background:#3b82f6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700">Começar grátis →</a>
      </div>
    </div>
  `
}

function renderBlogPost(slug) {
  const post = BLOG_POSTS.find(p => p.slug === slug)
  if (!post) { document.getElementById('app').innerHTML = `<div style="text-align:center;padding:4rem;color:#9ca3af">Artigo não encontrado. <a href="/blog" style="color:#3b82f6">← Ver todos</a></div>`; return }
  document.getElementById('app').innerHTML = `
    <div style="max-width:680px;margin:0 auto;padding:2rem 1rem;font-family:sans-serif;color:#f9fafb;background:#0a0f1e;min-height:100vh">
      <a href="/blog" style="color:#3b82f6;text-decoration:none;font-size:0.875rem">← Blog</a>
      <div style="font-size:0.8rem;color:#6b7280;margin:1rem 0 0.5rem">${new Date(post.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}</div>
      <h1 style="font-size:1.75rem;font-weight:800;margin-bottom:1.5rem;line-height:1.3">${post.title}</h1>
      <div style="color:#d1d5db;line-height:1.8;font-size:1rem">${post.content}</div>
      <div style="margin-top:2.5rem;padding:1.5rem;background:#111827;border-radius:12px;text-align:center">
        <div style="font-weight:700;margin-bottom:0.5rem">Pratique com o Decifra 📚</div>
        <p style="color:#9ca3af;font-size:0.875rem;margin-bottom:1rem">Simulados, tutor IA e flashcards para o ENEM.</p>
        <a href="/app" style="background:#3b82f6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700">Começar grátis →</a>
      </div>
    </div>
  `
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
    setTimeout(() => { if (state.user) renderInstallBanner() }, 30000)
  })

  // Handle public profile route /perfil/:userId
  const perfilMatch = window.location.pathname.match(/^\/perfil\/([^/]+)$/)
  if (perfilMatch) { renderPerfilPublico(perfilMatch[1]); return }

  // Handle challenge route /desafio/:id
  const desafioMatch = window.location.pathname.match(/^\/desafio\/([^/]+)$/)
  if (desafioMatch) { await renderDesafio(desafioMatch[1]); return }

  // Handle admin route
  if (window.location.pathname === '/admin') { renderAdmin(); return }

  // Handle blog routes
  const blogMatch = window.location.pathname.match(/^\/blog\/([^/]+)$/)
  if (blogMatch) { renderBlogPost(blogMatch[1]); return }
  if (window.location.pathname === '/blog') { renderBlogIndex(); return }

  // Handle password reset link (Supabase redirects with #access_token=...&type=recovery)
  const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('reset') === '1' && hashParams.get('access_token') && hashParams.get('type') === 'recovery') {
    history.replaceState(null, '', '/app')
    renderResetPassword(hashParams.get('access_token'))
    return
  }

  const stripeSuccess = urlParams.get('success') === '1'
  if (stripeSuccess) history.replaceState(null, '', '/app')

  // Save referral code from URL
  const refCode = urlParams.get('ref')
  if (refCode) {
    localStorage.setItem('decifra_pending_ref', refCode)
    history.replaceState(null, '', '/app')
  }

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
      state.questaoRespondida = loadLocal('questao_respondida_' + new Date().toDateString()) || false
      state.tutor.used = parseInt(localStorage.getItem('decifra_tutor_used_' + new Date().toDateString()) || '0')
      state.tutor.chatsBySubject = loadLocal('tutor_chats') || {}

      app.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div></div>`

      await loadUserData()
      state.questaoHoje = null
      renderApp()
      checkDailyNotification()
      if (stripeSuccess) toast('Assinatura ativada! Aproveite o Pro 🎉', 'success')
      else {
        checkTrialExpired()
        checkStreakLost()
      }
    } catch {
      localStorage.removeItem('decifra_token')
      renderAuth('login')
    }
  } else {
    renderAuth('login')
  }
}

init()
