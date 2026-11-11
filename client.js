// TellerU 白板讲解 · DeepSeek Harness 插件（浏览器端）
//
// 注册两样东西：
//  1. 右栏 tab 类型「TellerU 白板」：正文是同源 iframe（/api/telleru-wb.x?p=app/index.html#/session/<sid>/whiteboard），
//     里面跑的是 TellerU 网站同一份白板页面（嵌入模式）。
//  2. 对话里三个工具的卡片：whiteboard_ask（澄清 / 摸底 / 确认节数的结果行）、whiteboard_start（白板卡片，自动在右栏打开）、
//     whiteboard_write_section（这一节写好了 / 正在修改）。
// 不在输入框周围加任何按钮：入口只有斜杠命令 /telleru（宿主端注册）。

window.__ModuleLoader__.load({
  id: 'dsh-plugin-telleru',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    let P = null // DSH 的基础组件（Modal / Button / Input），用它保证弹窗和宿主一个样子
    try { P = require('@deepseek-ai/dsh-client-ui-primitives') } catch (e) { P = null }
    const TYPE_ID = 'dsh-plugin-telleru/board'
    const KIND = 'telleru-whiteboard'
    const APP = '/api/telleru-wb.x?p=app/index.html'
    const FRESH_MS = 90 * 1000 // 只有刚产生的工具结果才自动打开右栏（翻历史记录时不弹）

    // 配色直接用 DeepSeek Harness 的设计令牌（--dsw-alias-*），自动跟随宿主的浅色 / 深色（2026-11-10 用户需求）
    const v = function (name, fb) { return 'var(--dsw-alias-' + name + ', ' + fb + ')' }
    const C = {
      ink: v('label-primary', '#0f1115'), muted: v('label-secondary', '#61666b'), line: v('border-l2', '#0000001a'), card: v('bg-layer-1', '#fff'),
      board: v('state-business-primary', '#4176e6'), soft: v('state-business-tertiary', '#e4edfd'), amber: v('state-warn-label', '#dd8629'),
      amberSoft: 'color-mix(in srgb, ' + v('state-warn-primary', '#f59e0b') + ' 14%, transparent)',
      onBoard: v('label-primary-foreground', '#fff'), field: v('bg-layer-2', '#fff'), disabled: v('button-primary-dimmed', '#ebeef2'),
    }

    // ───── 右栏白板 ─────
    function BoardBody(props) {
      const info = props.useTabInfo ? props.useTabInfo() : null
      const nav = info && info.tab && info.tab.navigation
      const fromNav = nav && nav.params && nav.params.sid
      const key = 'telleru-wb:last:' + (props.sessionId || '')
      // 刷新 / 恢复布局后导航参数没了：用这段对话上次打开的那一节；再没有就问宿主这段对话最近的白板
      const [remembered, setRemembered] = React.useState(function () { try { return localStorage.getItem(key) } catch (e) { return null } })
      const sid = fromNav || remembered
      React.useEffect(function () { if (fromNav) { try { localStorage.setItem(key, fromNav) } catch (e) { /* 无痕模式 */ } } }, [fromNav])
      React.useEffect(function () {
        if (sid || !props.sessionId) return
        fetch('/api/telleru-wb.x?p=boards&session=' + encodeURIComponent(props.sessionId)).then(function (r) { return r.json() }).then(function (r) {
          const b = r && r.boards && r.boards[r.boards.length - 1]
          if (b) setRemembered(b.id + '~0')
        }).catch(function () {})
      }, [sid, props.sessionId])
      const frame = React.useRef(null)
      const [src] = React.useState(function () { return APP + (sid ? '#/session/' + encodeURIComponent(sid) + '/whiteboard' : '') })
      // iframe 里切换章节时（章节列表 / 下一节）记住，刷新后回到这一节
      React.useEffect(function () {
        const w = frame.current && frame.current.contentWindow
        if (!w) return
        const onHash = function () { const m = /#\/session\/([^/]+)\//.exec(w.location.hash); if (m) { try { localStorage.setItem(key, decodeURIComponent(m[1])) } catch (e) { /* */ } } }
        try { w.addEventListener('hashchange', onHash) } catch (e) { return }
        return function () { try { w.removeEventListener('hashchange', onHash) } catch (e) { /* */ } }
      }, [frame.current])
      React.useEffect(function () {
        // 再次打开（下一节写好 / 点卡片）：同一个 iframe 里换节，不重载页面
        const w = frame.current && frame.current.contentWindow
        if (!w || !sid) return
        const hash = '#/session/' + encodeURIComponent(sid) + '/whiteboard'
        try { if (w.location.hash !== hash) w.location.hash = hash } catch (e) { /* 同源，不会走到这里 */ }
      }, [sid, nav && nav.revision])
      return h('iframe', {
        ref: frame, src: src, title: 'TellerU 白板',
        allow: 'autoplay; clipboard-write; fullscreen',
        style: { border: 0, width: '100%', height: '100%', display: 'block', background: v('bg-base', '#fff') },
      })
    }

    function openBoard(ctx, sid) {
      try { ctx.sidebarRight.openTab(KIND, { params: { sid: sid } }) } catch (e) { console.warn('[telleru-whiteboard] 打开右栏失败', e) }
    }

    function metaOf(props) {
      if (props.phase !== 'result' || !props.block) return null
      const m = props.block.meta
      if (m && typeof m === 'object') return m
      try { const t = props.block.content && props.block.content[0] && props.block.content[0].text; return t ? JSON.parse(t.split('\n\n')[0]) : null } catch (e) { return null }
    }
    function isFresh(props) { return props.block && typeof props.block.time === 'number' && Date.now() - props.block.time < FRESH_MS }

    function Row(icon, title, sub, extra) {
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, color: C.muted, minWidth: 0 } },
        h('span', { style: { fontSize: 14 } }, icon),
        h('span', { style: { color: C.ink, fontWeight: 500, flexShrink: 0 } }, title),
        sub ? h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, sub) : null,
        extra || null)
    }

    // ───── whiteboard_ask：澄清目标 / 摸底 / 确认大纲 ─────
    const PURPOSE = { goal: '学习目标', level: '摸底', outline: '确认大纲', sections: '讲几节', other: '白板讲解' }
    function AskView(props) {
      React.useEffect(function () { if (isFresh(props) || props.phase !== 'result') promptIfUnbound('run') }, [])
      const m = metaOf(props)
      const args = (m && m.args) || (props.block && props.block.args) || {}
      const label = PURPOSE[args.purpose] || '白板讲解'
      if (props.phase !== 'result') return Row('🧭', label, '等你回答…')
      if (props.block.isError) return Row('🧭', label, '没有回答')
      const v = (m && m.value) || {}
      const answers = (v.answers || []).map(function (a) { return (a.selected || []).concat(a.custom ? [a.custom] : []).join('、') }).filter(Boolean)
      return Row('🧭', label, answers.length ? '你选了：' + answers.join(' / ') : '已回答')
    }

    // ───── whiteboard_start：白板卡片 ─────
    function makeStartView(ctx) {
      return function StartView(props) {
        const m = metaOf(props)
        const opened = React.useRef(false)
        React.useEffect(function () { if (isFresh(props)) promptIfUnbound('run') }, [])
        React.useEffect(function () {
          if (m && m.firstSid && !opened.current && isFresh(props)) { opened.current = true; openBoard(ctx, m.firstSid) }
        }, [m && m.firstSid])
        if (!m) return Row('🧑‍🏫', 'TellerU 白板', props.phase === 'result' ? '没能打开白板' : '正在准备白板…')
        const secs = m.sections || []
        return h('div', { style: { margin: '6px 0', border: '1px solid ' + C.line, borderRadius: 14, background: C.card, padding: '12px 14px', maxWidth: 520 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            h('span', { style: { background: C.board, color: C.onBoard, borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 600 } }, 'TellerU 白板'),
            h('span', { style: { fontWeight: 600, fontSize: 14, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.title)),
          secs.length > 1 ? h('ol', { style: { margin: '8px 0 0', paddingLeft: 20, fontSize: 12.5, color: C.muted, lineHeight: 1.7 } }, secs.map(function (t, i) { return h('li', { key: i }, t) })) : null,
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 } },
            h('button', { type: 'button', onClick: function () { openBoard(ctx, m.firstSid) }, style: { border: 0, borderRadius: 10, background: C.board, color: C.onBoard, padding: '6px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer' } }, '打开白板'),
            h('span', { style: { fontSize: 12, color: C.muted } }, secs.length > 1 ? '共 ' + secs.length + ' 节 · 学到哪节写哪节' : '在右侧白板上听讲')))
      }
    }

    // ───── whiteboard_write_section：这一节写好了 ─────
    function makeWriteView(ctx) {
      return function WriteView(props) {
        const m = metaOf(props)
        const opened = React.useRef(false)
        React.useEffect(function () {
          // 只有第 1 节写好时自动打开；后面的节是预先写好的，白板自己会刷新出来，不抢正在学的那一节
          if (m && m.ok && m.sid && m.index === 0 && !opened.current && isFresh(props)) { opened.current = true; openBoard(ctx, m.sid) }
        }, [m && m.ok, m && m.sid])
        const n = props.block && props.block.args && typeof props.block.args.index === 'number' ? props.block.args.index + 1 : null
        if (props.phase !== 'result') return Row('✍️', n ? '正在写第 ' + n + ' 节' : '正在写讲稿', '')
        if (!m || !m.ok) return Row('✍️', (m && m.title ? '《' + m.title + '》' : '讲稿') + ' 校验未通过', m && m.errors ? m.errors.length + ' 处要改，模型正在修改' : '')
        return Row('✅', '第 ' + (m.index + 1) + ' 节《' + m.title + '》已上白板', '',
          h('button', { type: 'button', onClick: function () { openBoard(ctx, m.sid) }, style: { marginLeft: 'auto', border: '1px solid ' + C.line, borderRadius: 8, background: C.card, color: C.board, padding: '2px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 } }, '去学'))
      }
    }

    // ───── 插件设置页（插件 → dsh-plugin-telleru → telleru-whiteboard）─────
    const SET_ROUTE = '/api/telleru-wb.x?p=settings'
    function Field(label, hint, input) {
      return h('label', { style: { display: 'block', margin: '0 0 14px' } },
        h('div', { style: { fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 4 } }, label),
        input,
        hint ? h('div', { style: { fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 } }, hint) : null)
    }
    const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid ' + C.line, borderRadius: 8, padding: '7px 10px', fontSize: 13, background: C.field, color: C.ink }
    // ───── 绑定弹窗（2026-11-10 用户需求）：装好后首次打开、以及每次运行 /telleru 时没绑定就弹 ─────
    // 两样二选一：TellerU 令牌（账号积分）或豆包语音 API Key（自己付费）；都没有时白板只有板书和字幕
    const bindStore = { open: null, subs: new Set() }
    function openBind(reason) { bindStore.open = reason; bindStore.subs.forEach(function (f) { f() }) }
    function closeBind() { bindStore.open = null; bindStore.subs.forEach(function (f) { f() }) }
    function isBound(d) { const v = (d && d.values) || {}; return !!((v.telleruToken && v.telleruToken.set) || (v.speechApiKey && v.speechApiKey.set)) }
    let lastRunPrompt = 0
    /** 运行时检查：没绑定就强提示（同一轮讲解里的几张卡片只弹一次） */
    function promptIfUnbound(reason) {
      if (reason === 'run' && Date.now() - lastRunPrompt < 10 * 60 * 1000) return
      if (reason === 'run') lastRunPrompt = Date.now()
      fetch(SET_ROUTE).then(function (r) { return r.json() }).then(function (d) { if (!isBound(d)) openBind(reason) }).catch(function () {})
    }

    function BindOverlay() {
      const [, force] = React.useReducer(function (x) { return x + 1 }, 0)
      React.useEffect(function () { bindStore.subs.add(force); return function () { bindStore.subs.delete(force) } }, [])
      const reason = bindStore.open
      const [token, setToken] = React.useState('')
      const [key, setKey] = React.useState('')
      const [state, setState] = React.useState({ busy: false, msg: '', bad: false })
      React.useEffect(function () { if (reason) { setToken(''); setKey(''); setState({ busy: false, msg: '', bad: false }) } }, [reason])
      if (!reason) return null
      const run = reason === 'run'
      const canSave = !!(token.trim() || key.trim()) && !state.busy
      const save = function () {
        const patch = {}
        if (token.trim()) patch.telleruToken = token.trim()
        if (key.trim()) patch.speechApiKey = key.trim()
        setState({ busy: true, msg: '保存中…', bad: false })
        fetch(SET_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
          .then(function (r) { return r.json() })
          .then(function (d) {
            if (!d || !d.ok) throw new Error((d && d.error && d.error.message) || '保存失败')
            return fetch(SET_ROUTE + '&fresh=1').then(function (r) { return r.json() })
          })
          .then(function (d) {
            if (patch.telleruToken && !patch.speechApiKey && d && d.accountError) { setState({ busy: false, msg: '令牌已保存，但检测没通过：' + d.accountError, bad: true }); return }
            setState({ busy: false, msg: '', bad: false }); closeBind()
          })
          .catch(function (e) { setState({ busy: false, msg: e.message || '保存失败', bad: true }) })
      }
      const link = function (label, url) {
        return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', style: { color: C.board, textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 400, fontSize: 12.5 } }, label + ' ↗')
      }
      const field = function (label, hint, value, onChange, ph, extra) {
        const props = { type: 'password', autoComplete: 'off', value: value, placeholder: ph, 'aria-label': label, style: { width: '100%', boxSizing: 'border-box' }, onChange: function (e) { onChange(e.target.value) } }
        const input = P && P.Input ? h(P.Input, props) : h('input', Object.assign({}, props, { style: Object.assign({}, inputStyle) }))
        return h('div', { style: { marginBottom: 14 } },
          h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 6 } }, label, extra || null),
          h('div', { className: 'tu-bind-input' }, input),
          h('div', { style: { fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 1.6 } }, hint))
      }
      const body = h('div', { style: { fontSize: 13, color: C.ink } },
        h('style', null, '.tu-bind-input > *{width:100%;box-sizing:border-box}'),
        run ? h('div', { style: { background: C.amberSoft, color: C.amber, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 500, marginBottom: 14 } }, '还没有绑定：这次讲解只有板书和字幕，没有语音') : null,
        field('TellerU 令牌', '在 TellerU 网站「设置 → 连接 AI 助手」生成（tu_ 开头），用账号积分：每节 3 积分。', token, setToken, 'tu_…', link('去 TellerU 生成', 'https://telleru.cn/settings')),
        field('豆包语音 API Key', '在火山引擎控制台「豆包语音」里创建，费用由火山引擎直接结算。两样都填时优先用它。', key, setKey, '豆包语音 API Key', link('去火山引擎', 'https://console.volcengine.com/speech/app')),
        state.msg ? h('div', { style: { fontSize: 12.5, color: state.bad ? C.amber : C.muted } }, state.msg) : null)
      const btn = function (variant, label, onClick, disabled) {
        return P && P.Button
          ? h(P.Button, { variant: variant, onClick: onClick, disabled: !!disabled }, label)
          : h('button', { type: 'button', onClick: onClick, disabled: !!disabled, style: { border: variant === 'primary' ? 0 : '1px solid ' + C.line, borderRadius: 10, background: variant === 'primary' ? C.board : C.card, color: variant === 'primary' ? C.onBoard : C.ink, padding: '8px 16px', fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 } }, label)
      }
      const footer = h(React.Fragment, null,
        btn('outline', run ? '先不绑定，只看字幕' : '稍后再说', closeBind),
        btn('primary', state.busy ? '保存中…' : '保存', save, !canSave))
      const title = run ? '绑定后才有语音讲解' : 'TellerU 白板已安装：绑定语音'
      const desc = run ? '二选一填一个：TellerU 令牌，或豆包语音 API Key。' : '二选一填一个，就有语音讲解。'
      if (P && P.Modal) return h(P.Modal, { open: true, onClose: closeBind, closeLabel: '关闭', title: title, description: desc, footer: footer }, body)
      // 拿不到宿主组件时的简易弹窗
      return h('div', { role: 'dialog', 'aria-modal': true, style: { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.35)', pointerEvents: 'auto' } },
        h('div', { style: { width: 'min(480px, calc(100vw - 32px))', background: C.card, borderRadius: 16, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,.25)' } },
          h('div', { style: { fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 6 } }, title),
          h('div', { style: { fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 } }, desc),
          body,
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 } }, footer)))
    }


    function SettingsView(props) {
      if (props.view === 'summary') return '在任何对话里输入 /telleru，把指定内容用 TellerU 白板边写边讲（右侧边栏）。'
      const [data, setData] = React.useState(null)
      const [draft, setDraft] = React.useState({})
      const [state, setState] = React.useState('')
      const [adv, setAdv] = React.useState(false)
      const load = React.useCallback(function (fresh) {
        return fetch(SET_ROUTE + (fresh ? '&fresh=1' : '')).then(function (r) { return r.json() }).then(function (d) { setData(d) }).catch(function () { setState('读取设置失败') })
      }, [])
      React.useEffect(function () { load(false) }, [load])
      if (!data) return h('div', { style: { color: C.muted, fontSize: 13 } }, state || '正在读取设置…')
      const v = data.values || {}
      const val = function (k) { return draft[k] !== undefined ? draft[k] : (typeof v[k] === 'string' ? v[k] : '') }
      const set = function (k) { return function (e) { const n = Object.assign({}, draft); n[k] = e.target.value; setDraft(n) } }
      const secret = function (k, ph) {
        return h('input', { type: 'password', autoComplete: 'off', value: draft[k] || '', onChange: set(k), placeholder: v[k] && v[k].set ? '已填写（留空保持不变；填一个空格清除）' : ph, style: inputStyle })
      }
      const save = function () {
        const patch = {}
        Object.keys(draft).forEach(function (k) { const x = draft[k]; if (x === '' && v[k] && typeof v[k] === 'object') return; patch[k] = x })
        setState('保存中…')
        fetch(SET_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }).then(function (r) { return r.json() }).then(function (d) {
          if (d && d.ok) { setDraft({}); setState('已保存'); setTimeout(function () { load(true) }, 400) } else setState('保存失败：' + ((d && d.error && d.error.message) || '未知错误'))
        }).catch(function () { setState('保存失败') })
      }
      const acct = data.account
      const section = function (title, children) { return h('div', { style: { border: '1px solid ' + C.line, borderRadius: 12, padding: '14px 16px', margin: '0 0 14px', background: C.card } }, h('div', { style: { fontWeight: 600, fontSize: 14, marginBottom: 10, color: C.ink } }, title), children) }
      return h('div', { style: { maxWidth: 640 } },
        h('p', { style: { fontSize: 13, color: C.muted, lineHeight: 1.7, margin: '0 0 14px' } }, '语音讲解二选一开通：TellerU 令牌（账号积分），或你自己的豆包语音 API Key（两样都填时优先用它）。都不填也能用，只是没有声音。'),
        section('TellerU 账号', [
          Field('TellerU 令牌', '在 TellerU 网站「设置 → 连接 AI 助手」生成（tu_ 开头）。豆包语音每节 ' + (acct ? acct.pricing.voiceSection : 3) + ' 积分，同一节只收一次。', secret('telleruToken', 'tu_…')),
          acct ? h('div', { key: 'acct', style: { fontSize: 13, color: C.board, background: C.soft, borderRadius: 8, padding: '8px 10px' } },
            '已绑定：' + acct.user.nickname + ' · ' + acct.plan.name + ' · 可用积分 ' + (acct.credits.unlimited ? '无限' : acct.credits.available))
            : data.accountError ? h('div', { key: 'err', style: { fontSize: 13, color: C.amber, background: C.amberSoft, borderRadius: 8, padding: '8px 10px' } }, data.accountError) : null,
        ]),
        section('自己的豆包语音 Key', [
          Field('豆包语音 API Key', '在豆包语音控制台创建。填了就优先用它，不扣 TellerU 积分。', secret('speechApiKey', '豆包语音控制台 → API Key')),
        ]),
        section('讲解', [
          Field('讲解音色', '绑定 TellerU 账号或填了豆包语音 Key 后生效；白板设置里也能随时换。', h('select', { value: val('voice'), onChange: set('voice'), style: inputStyle }, (data.voices || []).map(function (x) { return h('option', { key: x.id, value: x.id }, x.label + ' · ' + x.desc) }))),
          Field('讲解语言', null, h('select', { value: val('language') || 'auto', onChange: set('language'), style: inputStyle }, h('option', { value: 'auto' }, '按内容自动判断'), h('option', { value: 'zh' }, '中文'), h('option', { value: 'en' }, 'English'))),
        ]),
        h('button', { type: 'button', onClick: function () { setAdv(!adv) }, style: { border: 0, background: 'transparent', color: C.muted, fontSize: 12.5, cursor: 'pointer', padding: 0, margin: '0 0 10px' } }, adv ? '收起高级设置' : '高级设置'),
        adv ? section('高级', [
          Field('TellerU 服务地址', null, h('input', { value: val('telleruBaseUrl'), onChange: set('telleruBaseUrl'), style: inputStyle })),
        ]) : null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          h('button', { type: 'button', onClick: save, disabled: !Object.keys(draft).length, style: { border: 0, borderRadius: 10, background: Object.keys(draft).length ? C.board : C.disabled, color: C.onBoard, padding: '8px 18px', fontSize: 13.5, fontWeight: 500, cursor: Object.keys(draft).length ? 'pointer' : 'default' } }, '保存'),
          h('button', { type: 'button', onClick: function () { setState('检测中…'); load(true).then(function () { setState('') }) }, style: { border: '1px solid ' + C.line, borderRadius: 10, background: C.card, color: C.ink, padding: '7px 14px', fontSize: 13, cursor: 'pointer' } }, '检测账号'),
          h('span', { style: { fontSize: 12.5, color: C.muted } }, state)))
    }

    return {
      name: 'dsh-plugin-telleru',
      inject: ['slots', 'sidebarRightTabs', 'sidebarRight'],
      apply(ctx) {
        ctx.effect(function () {
          return ctx.sidebarRightTabs.register({ id: TYPE_ID, kind: KIND, priority: 'extension', keepMounted: true, title: function () { return 'TellerU 白板' } })
        }, 'telleru-whiteboard: tab type')
        ctx.slots.inject('sidebar.right.pane.tab', function () { return ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TYPE_ID }, BoardBody) })
        ctx.slots.inject('tool.call.toolview', function () { return ctx.slots.register({ name: 'tool.call.toolview', key: 'whiteboard_ask' }, AskView) })
        ctx.slots.inject('tool.call.toolview', function () { return ctx.slots.register({ name: 'tool.call.toolview', key: 'whiteboard_start' }, makeStartView(ctx)) })
        ctx.slots.inject('tool.call.toolview', function () { return ctx.slots.register({ name: 'tool.call.toolview', key: 'whiteboard_write_section' }, makeWriteView(ctx)) })
        // 组件行只给开关，不再点进二级设置页（2026-11-10 用户需求）；设置只放在插件页（plugins.bundle.config）
        // 设置表单也直接放在插件页上（描述和组件列表之间），不用再点进组件（2026-11-10 用户反馈：令牌输入藏得太深）
        ctx.slots.inject('plugins.bundle.config', function () { return ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-plugin-telleru' }, SettingsView) })
        ctx.slots.inject('tool.call.toolview', function () { return ctx.slots.register({ name: 'tool.call.toolview', key: 'whiteboard_format' }, function () { return Row('📄', '查看讲稿格式', '') }) })
        ctx.slots.inject('shell.overlay', function () { return ctx.slots.register({ name: 'shell.overlay', id: 'telleru-whiteboard.bind' }, BindOverlay) })
        // 装好后第一次打开：没绑定就弹一次（之后只在运行 /telleru 时提示）
        ctx.effect(function () {
          let done = false
          try { done = localStorage.getItem('telleru-wb:bind-prompted') === '1' } catch (e) { /* */ }
          if (done) return function () {}
          const t = setTimeout(function () {
            fetch(SET_ROUTE).then(function (r) { return r.json() }).then(function (d) {
              try { localStorage.setItem('telleru-wb:bind-prompted', '1') } catch (e) { /* */ }
              if (!isBound(d)) openBind('install')
            }).catch(function () {})
          }, 1500)
          return function () { clearTimeout(t) }
        }, 'telleru-whiteboard: first-run bind')
      },
    }
  },
})
