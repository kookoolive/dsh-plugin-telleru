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
      ok: v('state-success-primary', '#16a34a'), okSoft: 'color-mix(in srgb, ' + v('state-success-primary', '#22c55e') + ' 14%, transparent)',
      danger: v('state-error-primary', '#ec1313'),
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
    // 何时弹（2026-11-11 用户需求）：对话里生成课程之前不弹；白板里点「开始上课」时由白板检测，
    // 没绑定就经 window.__telleruBind 请这里弹出；放弃绑定后白板里小优头顶的气泡还能再打开它
    const bindStore = { open: null, subs: new Set(), waiters: [] }
    function openBind(reason) { bindStore.open = reason; bindStore.subs.forEach(function (f) { f() }) }
    function closeBind(bound) {
      bindStore.open = null; bindStore.subs.forEach(function (f) { f() })
      const w = bindStore.waiters.splice(0); w.forEach(function (f) { f(!!bound) })
    }
    function isBound(d) { const v = (d && d.values) || {}; return !!((v.telleruToken && v.telleruToken.set) || (v.speechApiKey && v.speechApiKey.set)) }
    /** 白板（同源 iframe）调用：弹出绑定窗，关窗后返回是否已绑定 */
    if (typeof window !== 'undefined') {
      window.__telleruBind = function (reason) {
        return new Promise(function (resolve) { bindStore.waiters.push(resolve); openBind(reason || 'start') })
      }
    }

    // ───── 语音 Key 卡片（2026-11-11 用户需求：检测校验、显示状态、可删除）─────
    // 插件页设置和绑定弹窗共用；白板设置里的「模型配置」页签是同样的交互（网站代码 PluginKeys.tsx）
    const KEY_DEFS = {
      account: { field: 'telleruToken', title: 'TellerU 令牌', ph: 'tu_…', link: ['去 TellerU 生成', 'https://telleru.cn/settings'],
        hint: '在 TellerU 网站「设置 → 连接 AI 助手」生成（tu_ 开头），用账号积分：每节 3 积分，同一节只收一次。' },
      speech: { field: 'speechApiKey', title: '豆包语音 API Key', ph: '豆包语音 API Key', link: ['去火山引擎', 'https://console.volcengine.com/speech/app'],
        hint: '在火山引擎控制台「豆包语音」里创建，费用由火山引擎直接结算。两样都填时优先用它。' },
    }
    function hhmm(t) { const d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) }
    /** 某个 Key 的状态：{ set, ok, text } */
    function keyStatus(kind, d) {
      const v = (d && d.values) || {}
      const def = KEY_DEFS[kind]
      if (!(v[def.field] && v[def.field].set)) return { set: false, ok: false, text: '未填写' }
      if (kind === 'account') {
        const a = d.account
        if (a) return { set: true, ok: true, text: '可用 · ' + a.user.nickname + ' · ' + a.plan.name + ' · 可用积分 ' + (a.credits.unlimited ? '无限' : a.credits.available) }
        return { set: true, ok: false, text: d.accountError || '令牌无效，或连不上 TellerU' }
      }
      const sp = d.speech
      if (sp && sp.ok) return { set: true, ok: true, text: '可用 · 试合成成功（' + hhmm(sp.at) + ' 检测）' }
      return { set: true, ok: false, text: (sp && sp.error) || '还没检测' }
    }
    function anyKeyOk(d) { return keyStatus('account', d).ok || keyStatus('speech', d).ok }
    function smallBtn(label, onClick, opts) {
      opts = opts || {}
      return h('button', { type: 'button', onClick: onClick, disabled: !!opts.disabled, style: { border: opts.primary ? 0 : '1px solid ' + (opts.danger ? C.danger : C.line), borderRadius: 8, background: opts.primary ? C.board : C.card, color: opts.primary ? C.onBoard : opts.danger ? C.danger : C.ink, padding: '4px 11px', fontSize: 12.5, fontWeight: 500, cursor: opts.disabled ? 'default' : 'pointer', opacity: opts.disabled ? 0.5 : 1, whiteSpace: 'nowrap' } }, label)
    }
    /**
     * 一个 Key：已填写 → 状态 + 检测 / 更换 / 删除（删除要再点一次确认）；未填写 → 输入框 + 保存并检测
     * props: kind, data（GET settings 的结果）, reload(fresh) → Promise<data>
     */
    function KeyCard(props) {
      const def = KEY_DEFS[props.kind]
      const d = props.data
      const st = keyStatus(props.kind, d)
      const active = d && d.active === (props.kind === 'speech' ? 'own' : 'account') && st.ok
      const [edit, setEdit] = React.useState(false)
      const [val, setVal] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [confirmDel, setConfirmDel] = React.useState(false)
      const [msg, setMsg] = React.useState('')
      const fresh = props.kind
      const post = function (value, label) {
        const patch = {}; patch[def.field] = value
        setBusy(label); setMsg('')
        return fetch(SET_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
          .then(function (r) { return r.json() })
          .then(function (res) { if (!res || !res.ok) throw new Error((res && res.error && res.error.message) || '保存失败'); return props.reload(fresh) })
          .then(function () { setBusy(''); setEdit(false); setVal(''); setConfirmDel(false) })
          .catch(function (e) { setBusy(''); setMsg(e.message || '保存失败') })
      }
      const check = function () { setBusy('检测中…'); setMsg(''); props.reload(fresh).then(function () { setBusy('') }, function () { setBusy(''); setMsg('检测失败') }) }
      const input = function () {
        const ip = { type: 'password', autoComplete: 'off', value: val, placeholder: def.ph, 'aria-label': def.title, onChange: function (e) { setVal(e.target.value) },
          onKeyDown: function (e) { if (e.key === 'Enter' && val.trim()) post(val.trim(), '保存中…') }, style: Object.assign({}, inputStyle) }
        return h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('input', ip),
          smallBtn(busy || '保存并检测', function () { post(val.trim(), '保存中…') }, { primary: true, disabled: !val.trim() || !!busy }),
          st.set ? smallBtn('取消', function () { setEdit(false); setVal('') }) : null)
      }
      const pill = h('span', { style: { fontSize: 11.5, fontWeight: 500, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
        background: !st.set ? C.soft : st.ok ? C.okSoft : C.amberSoft, color: !st.set ? C.muted : st.ok ? C.ok : C.amber } },
        busy === '检测中…' ? '检测中…' : !st.set ? '未填写' : st.ok ? (active ? '可用 · 正在使用' : '可用') : '不可用')
      return h('div', { style: { border: '1px solid ' + C.line, borderRadius: 12, padding: '12px 14px', marginBottom: 12, background: C.card } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
          h('span', { style: { fontSize: 13.5, fontWeight: 600, color: C.ink } }, def.title), pill,
          h('a', { href: def.link[1], target: '_blank', rel: 'noopener noreferrer', style: { marginLeft: 'auto', color: C.board, textDecoration: 'none', fontSize: 12.5, whiteSpace: 'nowrap' } }, def.link[0] + ' ↗')),
        st.set && !edit
          ? h('div', null,
              h('div', { style: { fontSize: 12.5, lineHeight: 1.6, color: st.ok ? C.ink : C.amber, marginBottom: 8 } }, (st.ok ? '✓ ' : '✗ ') + st.text),
              h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                smallBtn(busy === '检测中…' ? '检测中…' : '检测', check, { disabled: !!busy }),
                smallBtn('更换', function () { setEdit(true); setConfirmDel(false) }, { disabled: !!busy }),
                confirmDel
                  ? h(React.Fragment, null, smallBtn(busy === '删除中…' ? '删除中…' : '确认删除', function () { post('', '删除中…') }, { danger: true, disabled: !!busy }), smallBtn('取消', function () { setConfirmDel(false) }))
                  : smallBtn('删除', function () { setConfirmDel(true) }, { danger: true, disabled: !!busy })))
          : input(),
        h('div', { style: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.6 } }, def.hint),
        msg ? h('div', { style: { fontSize: 12.5, color: C.amber, marginTop: 4 } }, msg) : null)
    }

    function BindOverlay() {
      const [, force] = React.useReducer(function (x) { return x + 1 }, 0)
      React.useEffect(function () { bindStore.subs.add(force); return function () { bindStore.subs.delete(force) } }, [])
      const reason = bindStore.open
      const [data, setData] = React.useState(null)
      const reload = React.useCallback(function (fresh) {
        return fetch(SET_ROUTE + (fresh ? '&fresh=' + fresh : '')).then(function (r) { return r.json() }).then(function (d) { setData(d); return d })
      }, [])
      React.useEffect(function () { if (reason) { setData(null); reload('') } }, [reason])
      if (!reason) return null
      const run = reason !== 'install'
      const ok = anyKeyOk(data)
      const body = h('div', { style: { fontSize: 13, color: C.ink, minWidth: 0 } },
        run && !ok ? h('div', { style: { background: C.amberSoft, color: C.amber, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 500, marginBottom: 12 } }, '还没有可用的语音：这次讲解只有板书和字幕') : null,
        ok ? h('div', { style: { background: C.okSoft, color: C.ok, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 500, marginBottom: 12 } }, '✓ 语音讲解已可用，点「完成」开讲') : null,
        data ? h(React.Fragment, null, h(KeyCard, { kind: 'account', data: data, reload: reload }), h(KeyCard, { kind: 'speech', data: data, reload: reload }))
          : h('div', { style: { color: C.muted, fontSize: 13, padding: '8px 0' } }, '正在读取…'))
      const btn = function (variant, label, onClick, disabled) {
        return P && P.Button
          ? h(P.Button, { variant: variant, onClick: onClick, disabled: !!disabled }, label)
          : h('button', { type: 'button', onClick: onClick, disabled: !!disabled, style: { border: variant === 'primary' ? 0 : '1px solid ' + C.line, borderRadius: 10, background: variant === 'primary' ? C.board : C.card, color: variant === 'primary' ? C.onBoard : C.ink, padding: '8px 16px', fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 } }, label)
      }
      const footer = h(React.Fragment, null,
        ok ? null : btn('outline', run ? '先不绑定，只看字幕' : '稍后再说', function () { closeBind(false) }),
        btn('primary', '完成', function () { closeBind(ok) }, !ok))
      const title = run ? '绑定后才有语音讲解' : 'TellerU 白板已安装：绑定语音'
      const desc = '二选一填一个：TellerU 令牌（账号积分），或豆包语音 API Key（两样都填时优先用它）。填好会自动检测。'
      if (P && P.Modal) return h(P.Modal, { open: true, onClose: function () { closeBind(anyKeyOk(data)) }, closeLabel: '关闭', title: title, description: desc, footer: footer }, body)
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
      const reload = React.useCallback(function (fresh) {
        return fetch(SET_ROUTE + (fresh ? '&fresh=' + fresh : '')).then(function (r) { return r.json() }).then(function (d) { setData(d); return d })
      }, [])
      React.useEffect(function () { reload('').catch(function () { setState('读取设置失败') }) }, [reload])
      if (!data) return h('div', { style: { color: C.muted, fontSize: 13 } }, state || '正在读取设置…')
      const v = data.values || {}
      const val = function (k) { return draft[k] !== undefined ? draft[k] : (typeof v[k] === 'string' ? v[k] : '') }
      const set = function (k) { return function (e) { const n = Object.assign({}, draft); n[k] = e.target.value; setDraft(n) } }
      const save = function () {
        setState('保存中…')
        fetch(SET_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) }).then(function (r) { return r.json() }).then(function (d) {
          if (d && d.ok) { setDraft({}); setState('已保存'); reload('') } else setState('保存失败：' + ((d && d.error && d.error.message) || '未知错误'))
        }).catch(function () { setState('保存失败') })
      }
      const section = function (title, children) { return h('div', { style: { border: '1px solid ' + C.line, borderRadius: 12, padding: '14px 16px', margin: '0 0 14px', background: C.card } }, h('div', { style: { fontWeight: 600, fontSize: 14, marginBottom: 10, color: C.ink } }, title), children) }
      const dirty = Object.keys(draft).length > 0
      return h('div', { style: { maxWidth: 640 } },
        h('p', { style: { fontSize: 13, color: C.muted, lineHeight: 1.7, margin: '0 0 14px' } }, '语音讲解二选一开通：TellerU 令牌（账号积分），或你自己的豆包语音 API Key（两样都填时优先用它）。填好会自动检测；都不填也能用，只是没有声音。'),
        h(KeyCard, { kind: 'account', data: data, reload: reload }),
        h(KeyCard, { kind: 'speech', data: data, reload: reload }),
        section('讲解', [
          Field('讲解音色', '有可用的语音后生效；白板设置里也能随时换。', h('select', { value: val('voice'), onChange: set('voice'), style: inputStyle }, (data.voices || []).map(function (x) { return h('option', { key: x.id, value: x.id }, x.label + ' · ' + x.desc) }))),
          Field('讲解语言', null, h('select', { value: val('language') || 'auto', onChange: set('language'), style: inputStyle }, h('option', { value: 'auto' }, '按内容自动判断'), h('option', { value: 'zh' }, '中文'), h('option', { value: 'en' }, 'English'))),
        ]),
        h('button', { type: 'button', onClick: function () { setAdv(!adv) }, style: { border: 0, background: 'transparent', color: C.muted, fontSize: 12.5, cursor: 'pointer', padding: 0, margin: '0 0 10px' } }, adv ? '收起高级设置' : '高级设置'),
        adv ? section('高级', [
          Field('TellerU 服务地址', null, h('input', { value: val('telleruBaseUrl'), onChange: set('telleruBaseUrl'), style: inputStyle })),
        ]) : null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          h('button', { type: 'button', onClick: save, disabled: !dirty, style: { border: 0, borderRadius: 10, background: dirty ? C.board : C.disabled, color: C.onBoard, padding: '8px 18px', fontSize: 13.5, fontWeight: 500, cursor: dirty ? 'pointer' : 'default' } }, '保存'),
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
      },
    }
  },
})
