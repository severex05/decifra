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
  tutor: { messages: [], subject: 'matematica', loading: false, used: 0, limit: 5 },
  simulado: { screen: 'menu', type: null, questions: [], current: 0, answers: [], timeLeft: 0, timer: null, score: null, loading: false },
  diag: { screen: 'intro', questions: [], current: 0, answers: [] },
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
  state.user = null
  state.token = null
  state.plan = 'free'
  renderAuth('login')
}

// ===== ONBOARDING =====
const ONBOARDING_STEPS = [
  {
    icon: '🎯',
    title: 'Qual é a sua prova?',
    text: 'Vamos personalizar sua experiência com base no seu objetivo.',
    options: ['ENEM 2025', 'Vestibular (FUVEST/UNICAMP/outros)', 'Concurso Público Federal', 'Concurso Público Estadual', 'Ainda não decidi'],
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
    options: ['Matemática', 'Português', 'Ciências da Natureza', 'Ciências Humanas', 'Todas precisam melhorar'],
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
  }
}

// ===== TAB: INÍCIO =====
async function renderInicio(container) {
  const prog = state.progresso
  const user = JSON.parse(localStorage.getItem('decifra_user') || '{}')
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const nome = user?.name?.split(' ')[0] || 'Aluno'

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
    <div id="questaoHojeContainer"></div>
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
          <div class="quick-btn-sub">Em breve</div>
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
      else if (a === 'flashcard') toast('Flashcards chegando em breve!', '')
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
  saveLocal('progresso', state.progresso)
  api('/api/user/resposta', { questaoId: q.id, correct: isCorrect, subject: q.subject }).catch(() => {})
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
  if (state.tutor.messages.length === 0) {
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
}

function renderMessages(container) {
  container.innerHTML = state.tutor.messages.map(m => `
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

  state.tutor.messages.push({ role: 'user', content: text })
  state.tutor.loading = true
  state.tutor.used++
  if (input) { input.value = ''; input.style.height = 'auto' }

  const msgs = document.getElementById('tutorMessages')
  if (msgs) renderMessages(msgs)

  try {
    const data = await api('/api/tutor/chat', {
      messages: state.tutor.messages,
      subject: state.tutor.subject,
    })
    state.tutor.messages.push({ role: 'assistant', content: data.reply })
  } catch (err) {
    state.tutor.messages.push({ role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.' })
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
  api('/api/simulado/finish', { type: state.simulado.type, score: state.simulado.score })
    .then(res => { if (res?.xpGain) state.xp = (state.xp || 0) + res.xpGain })
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
    </div>
  `

  document.getElementById('resBack').onclick = () => { state.simulado.screen = 'menu'; renderTab('simulados') }
  document.getElementById('resReview').onclick = () => { state.simulado.screen = 'quiz'; state.simulado.current = 0; renderTab('simulados') }
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
          <span class="mais-badge-soon">Em breve</span>
        </div>
        <div class="mais-item" data-action="flashcards">
          <div class="mais-icon">🃏</div>
          <div class="mais-info">
            <div class="mais-label">Flashcards</div>
            <div class="mais-sub">Revisão espaçada por matéria</div>
          </div>
          <span class="mais-badge-soon">Em breve</span>
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
      else if (a === 'redacao' || a === 'flashcards') toast('Funcionalidade chegando em breve!', '')
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
          <div class="diag-bullet">✓ 7 questões — 1 por matéria</div>
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
  document.getElementById('diagExit')?.onclick = () => { state.diag.screen = 'intro'; renderTab('diagnostico') }
  document.getElementById('diagNext')?.onclick = () => { state.diag.current++; renderTab('diagnostico') }
  document.getElementById('diagFinish')?.onclick = () => finishDiagnostico()
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
    try { const data = await api('/api/plano-estudo'); state.plano = data.plan } catch {}
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

  const diasHtml = (plan.dias || []).map(d => `
    <div class="plano-day">
      <div class="plano-day-name">${d.dia}</div>
      <div class="plano-day-materias">
        ${(d.materias || []).map(m => `
          <div class="plano-materia-item ${subjectClass(m.materia)}">
            ${SUBJ_EMOJI[m.materia] || '📚'} <strong>${subjectLabel(m.materia)}</strong> — ${m.topico} · ${m.minutos}min
          </div>
        `).join('')}
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

      app.innerHTML = `<div class="loading-screen"><div class="loading-logo">Decifra<span>.</span></div><div class="spinner"></div></div>`

      await loadUserData()
      state.questaoHoje = null
      renderApp()
    } catch {
      localStorage.removeItem('decifra_token')
      renderAuth('login')
    }
  } else {
    renderAuth('login')
  }
}

init()
