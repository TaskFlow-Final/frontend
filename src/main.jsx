import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DOMPurify from 'dompurify';
import { AnimatePresence, motion } from 'framer-motion';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  Activity, Archive, ArrowLeft, ArrowRight, Bell, CalendarDays, Camera, Check, CheckCircle2,
  ChevronDown, Circle, Clock3, Command, Copy, Ellipsis, ExternalLink, FileText, Filter,
  Gauge, Grid2X2, Hash, Headphones, Inbox, Kanban, LayoutDashboard,
  ListFilter, LogOut, Menu, MessageCircle, MessageSquare, Mic, MicOff, Moon, MoreHorizontal,
  Paperclip, PhoneOff, Plus, Radio, Search, Send, Settings, ShieldCheck, Sparkles,
  Sun, Tag, Target, Trash2, TrendingUp, UserPlus, Users, Video, VideoOff, WandSparkles,
  X, Zap, Star, Pencil, GripVertical, Bold, Italic, Type, Upload, Reply, ScreenShare, Link
} from 'lucide-react';
import './styles.css';
import './meeting.css';
import './features.css';
import './realtime.css';
import './chat-fixes.css';
import { API_URL, authApi, boardApi, chatApi, clearSession, getToken, meetingApi, notificationApi, uploadApi, userApi } from './lib/api';

const avatar = (name, hue = 150) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=${hue === 150 ? 'd1fae5' : hue === 260 ? 'ede9fe' : 'fee2e2'}`;
const assetUrl = url => url?.startsWith('/') ? `${API_URL}${url}` : url;
const groupView = group => ({ ...group, avatarUrl: assetUrl(group.avatarUrl) });
const messageView = message => ({ ...message, mediaUrl: assetUrl(message.mediaUrl), replyTo: message.replyTo ? messageView(message.replyTo) : null });
const userView = user => ({
  ...user,
  name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
  title: user.role === 'SUPER_ADMIN' ? 'Workspace owner' : user.role === 'ADMIN' ? 'Administrator' : 'Team member',
  status: user.active === false ? 'Inactive' : 'Active',
  avatar: assetUrl(user.avatarUrl) || avatar(user.username || 'user'),
});
const columnStatus = name => {
  const value = name.toLowerCase();
  if (value.includes('done') || value.includes('complete')) return 'done';
  if (value.includes('review')) return 'review';
  if (value.includes('progress') || value.includes('doing')) return 'progress';
  return 'todo';
};
const taskView = (task, detail, people) => {
  const column = detail.columns.find(item => item.id === task.columnId);
  const assigneeIds = new Set([...(task.assigneeIds || []), ...(task.assigneeId ? [task.assigneeId] : [])]);
  return {
    ...task,
    status: columnStatus(column?.name || ''),
    project: detail.board.name,
    code: `TF-${String(task.id).slice(0, 4).toUpperCase()}`,
    tags: [],
    assignees: people.filter(item => assigneeIds.has(item.id)),
    comments: task.commentCount || 0,
    files: 0,
    due: task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date',
  };
};

const USERS = [
  { id: 1, name: 'Alex Morgan', username: 'super_admin', role: 'SUPER_ADMIN', title: 'Workspace owner', status: 'Active', avatar: avatar('Alex', 150) },
  { id: 2, name: 'Maya Chen', username: 'maya.chen', role: 'ADMIN', title: 'Product designer', status: 'Active', avatar: avatar('Maya', 260) },
  { id: 3, name: 'Jordan Lee', username: 'jordan.lee', role: 'MEMBER', title: 'Frontend engineer', status: 'Active', avatar: avatar('Jordan', 20) },
  { id: 4, name: 'Nora Malik', username: 'nora.malik', role: 'MEMBER', title: 'Growth strategist', status: 'Active', avatar: avatar('Nora', 260) },
  { id: 5, name: 'Sam Rivera', username: 'sam.rivera', role: 'MEMBER', title: 'QA engineer', status: 'Away', avatar: avatar('Sam', 20) },
];

const INITIAL_TASKS = [
  { id: 1, title: 'Finalize Q3 launch narrative', description: 'Align product story, launch beats and channel owners.', status: 'todo', priority: 'HIGH', due: 'Today', project: 'Website 2.0', tags: ['Strategy'], assignees: [USERS[1], USERS[3]], comments: 8, files: 3, code: 'TF-128' },
  { id: 2, title: 'Build pricing comparison section', description: 'Implement responsive pricing matrix from latest Figma.', status: 'todo', priority: 'MEDIUM', due: 'Jun 29', project: 'Website 2.0', tags: ['Frontend'], assignees: [USERS[2]], comments: 4, files: 1, code: 'TF-131' },
  { id: 3, title: 'Audit onboarding friction', description: 'Review first session recordings and group findings.', status: 'progress', priority: 'CRITICAL', due: 'Tomorrow', project: 'Product Core', tags: ['Research'], assignees: [USERS[1], USERS[4]], comments: 12, files: 2, code: 'TF-122' },
  { id: 4, title: 'Add command palette actions', description: 'Connect quick actions to global workspace navigation.', status: 'progress', priority: 'MEDIUM', due: 'Jul 01', project: 'Product Core', tags: ['Product'], assignees: [USERS[2]], comments: 5, files: 0, code: 'TF-135' },
  { id: 5, title: 'Review lifecycle email copy', description: 'Final copy pass before automation handoff.', status: 'review', priority: 'HIGH', due: 'Jun 28', project: 'Growth Engine', tags: ['Marketing'], assignees: [USERS[3]], comments: 9, files: 4, code: 'TF-119' },
  { id: 6, title: 'Mobile dashboard QA', description: 'Regression pass across primary phone breakpoints.', status: 'review', priority: 'LOW', due: 'Jul 02', project: 'Website 2.0', tags: ['QA'], assignees: [USERS[4]], comments: 3, files: 1, code: 'TF-137' },
  { id: 7, title: 'Create brand motion kit', description: 'Reusable motion language for marketing surfaces.', status: 'done', priority: 'MEDIUM', due: 'Jun 25', project: 'Website 2.0', tags: ['Design'], assignees: [USERS[1]], comments: 7, files: 6, code: 'TF-110' },
];

const NAV = [
  ['/', LayoutDashboard, 'Overview'],
  ['/boards', Kanban, 'Projects'],
  ['/tasks', CheckCircle2, 'My tasks'],
  ['/chat', MessageSquare, 'Messages'],
  ['/meetings', Video, 'Meetings'],
  ['/notifications', Bell, 'Inbox'],
];

const safeJson = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };

function App() {
  const [session, setSession] = useState(() => safeJson(localStorage.getItem('taskflow_session'), null));
  const [theme, setTheme] = useState(() => localStorage.getItem('taskflow_theme') || 'dark');
  const [tasks, setTasks] = useState([]);
  const [boards, setBoards] = useState([]);
  const [users, setUsers] = useState([]);
  const [notices, setNotices] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [chatGroups, setChatGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('taskflow_theme', theme);
  }, [theme]);
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    const unauthorized = () => setSession(null);
    window.addEventListener('taskflow:unauthorized', unauthorized);
    return () => window.removeEventListener('taskflow:unauthorized', unauthorized);
  }, []);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoading(true);
    Promise.all([userApi.list(), boardApi.list(), notificationApi.list(), meetingApi.list(), chatApi.groups()])
      .then(async ([rawUsers, rawBoards, rawNotices, rawMeetings, rawGroups]) => {
        const people = rawUsers.map(userView);
        const details = await Promise.all(rawBoards.map(board => boardApi.detail(board.id)));
        if (!alive) return;
        setUsers(people);
        setBoards(rawBoards);
        setTasks(details.flatMap(detail => detail.tasks.map(task => taskView(task, detail, people))));
        setNotices(rawNotices.map(notice => ({
          ...notice,
          unread: !notice.read,
          time: new Date(notice.createdAt).toLocaleString(),
          icon: notice.type === 'MEETING' ? Video : notice.type === 'TASK' ? CheckCircle2 : Bell,
        })));
        setMeetings(rawMeetings);
        setChatGroups(rawGroups);
      })
      .catch(error => notify(error.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [session]);

  useEffect(()=>{
    if(!session)return;
    const timer=setInterval(()=>Promise.all([notificationApi.list(),chatApi.groups()]).then(([rawNotices,rawGroups])=>{
      setNotices(rawNotices.map(notice=>({...notice,unread:!notice.read,time:new Date(notice.createdAt).toLocaleString(),icon:notice.type==='MEETING'?Video:notice.type==='TASK'||notice.type==='ASSIGNED'?CheckCircle2:Bell})));
      setChatGroups(rawGroups);
    }).catch(()=>{}),5000);
    return()=>clearInterval(timer);
  },[session]);

  const login = async ({ username, password }) => {
    if (!username || !password) throw new Error('Enter your username and password.');
    const data = await authApi.login({ username, password });
    localStorage.setItem('taskflow_token', data.token);
    const next = userView(data.user);
    setSession(next);
    localStorage.setItem('taskflow_session', JSON.stringify(next));
  };

  if (!session) return <Login onLogin={login} theme={theme} setTheme={setTheme} />;

  return (
    <BrowserRouter>
      <Shell session={session} theme={theme} setTheme={setTheme} notices={notices} chatGroups={chatGroups} boards={boards} tasks={tasks} users={users} commandOpen={commandOpen} setCommandOpen={setCommandOpen}
        logout={() => { clearSession(); setSession(null); }}>
        <Routes>
          <Route path="/" element={<Dashboard session={session} tasks={tasks} boards={boards} users={users} notify={notify} loading={loading} />} />
          <Route path="/boards" element={<Boards boards={boards} tasks={tasks} setBoards={setBoards} notify={notify} />} />
          <Route path="/boards/:id" element={<Board boards={boards} tasks={tasks} users={users} setTasks={setTasks} notify={notify} />} />
          <Route path="/tasks" element={<MyTasks tasks={tasks} setTasks={setTasks} session={session} />} />
          <Route path="/chat" element={<Chat notify={notify} users={users} session={session} />} />
          <Route path="/meetings" element={<Meetings meetings={meetings} setMeetings={setMeetings} users={users} session={session} notify={notify} />} />
          <Route path="/meetings/:id" element={<MeetingRoom session={session} />} />
          <Route path="/notifications" element={<Notifications notices={notices} setNotices={setNotices} />} />
          <Route path="/admin/users" element={['SUPER_ADMIN', 'ADMIN'].includes(session.role) ? <AdminUsers users={users} setUsers={setUsers} notify={notify} /> : <Navigate to="/" />} />
          <Route path="/settings" element={<SettingsPage theme={theme} setTheme={setTheme} session={session} setSession={setSession} notify={notify} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
      <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><CheckCircle2 />{toast}</motion.div>}</AnimatePresence>
    </BrowserRouter>
  );
}

function Login({ onLogin, theme, setTheme }) {
  const [form, setForm] = useState({ username: 'super_admin', password: 'super1234!' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return <main className="login-page">
    <div className="login-noise" />
    <header className="login-nav"><Logo /><button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button></header>
    <section className="login-copy">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <span className="eyebrow"><Sparkles /> Built for teams in motion</span>
        <h1>Turn your team's<br /><em>energy into impact.</em></h1>
        <p>One beautifully focused workspace to plan ambitious work, move faster together, and make progress visible.</p>
        <div className="proof">
          <div className="avatar-stack">{USERS.slice(1).map(u => <img key={u.id} src={u.avatar} />)}</div>
          <span><strong>4.9/5</strong><small>Loved by modern teams</small></span>
        </div>
      </motion.div>
      <div className="ambient-card a"><CheckCircle2 /><span>Launch system</span><b>84%</b></div>
      <div className="ambient-card b"><Radio /><span>Team is live</span><b>12 online</b></div>
    </section>
    <motion.form className="login-card" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} onSubmit={async e => {
      e.preventDefault(); setLoading(true); setError(''); try { await onLogin(form); } catch (err) { setError(err.message); } finally { setLoading(false); }
    }}>
      <div className="login-heading"><span>WELCOME BACK</span><h2>Sign in to TaskFlow</h2><p>Enter your details to open your workspace.</p></div>
      <label>Username<input aria-label="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
      <label><span className="label-row">Password <button type="button">Forgot password?</button></span><input aria-label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-btn login-submit" disabled={loading}>{loading ? 'Opening workspace…' : 'Enter workspace'}<ArrowRight /></button>
      <div className="login-divider"><span>Demo access is ready</span></div>
      <p className="credentials"><ShieldCheck /> <span><b>super_admin</b> / super1234!</span></p>
    </motion.form>
  </main>;
}

function Logo() { return <div className="logo"><span><Zap /></span>taskflow<b>.</b></div>; }

function Shell({ session, children, theme, setTheme, notices, chatGroups, boards, tasks, users, logout, commandOpen, setCommandOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const titles = { '/': ['Overview', 'A clear view of everything moving'], '/boards': ['Projects', 'Plan, prioritize and ship together'], '/tasks': ['My tasks', 'Your focused execution queue'], '/chat': ['Messages', 'Move work forward in real time'], '/meetings': ['Meetings', 'Stay aligned, without the calendar chaos'], '/notifications': ['Inbox', 'Updates that need your attention'], '/admin/users': ['People', 'Manage access, roles and workspace members'], '/settings': ['Settings', 'Make TaskFlow feel like yours'] };
  const boardId=location.pathname.startsWith('/boards/')?location.pathname.split('/')[2]:null;
  const currentBoard=boards.find(board=>board.id===boardId);
  const current = currentBoard ? [currentBoard.name, currentBoard.description || 'Project workspace'] : location.pathname.startsWith('/meetings/') ? ['Meeting room', 'Live meeting'] : titles[location.pathname] || ['TaskFlow', 'Workspace'];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="side-top"><Logo /><button className="close-mobile" onClick={() => setMobileNav(false)}><X /></button></div>
      <button className="workspace-switch"><span className="workspace-icon">F</span><span><b>Fluxion Labs</b><small>Business workspace</small></span><ChevronDown /></button>
      <nav className="main-nav">
        <p>WORKSPACE</p>
        {NAV.map(([path, Icon, label]) => {const badge=label==='Messages'?chatGroups.reduce((sum,group)=>sum+group.unreadCount,0):0;return <button key={path} className={location.pathname === path || (path === '/boards' && location.pathname.startsWith('/boards/')) ? 'active' : ''} onClick={() => { navigate(path); setMobileNav(false); }}><Icon />{label}{badge>0&&<i>{badge}</i>}</button>})}
        {['SUPER_ADMIN', 'ADMIN'].includes(session.role) && <><p>ADMIN</p><button className={location.pathname === '/admin/users' ? 'active' : ''} onClick={() => navigate('/admin/users')}><Users />People</button></>}
        <p>FAVORITES</p>
        {boards.filter(board=>board.favorite&&!board.archived).slice(0,4).map((board,index)=><button key={board.id} onClick={()=>navigate(`/boards/${board.id}`)}><span className={`dot ${index%2?'green':'purple'}`}/>{board.name}</button>)}
        {boards.every(board=>!board.favorite||board.archived)&&<button onClick={() => navigate('/boards')}><span className="dot purple" />All projects</button>}
      </nav>
      <div className="side-footer">
        {/* <button className="upgrade"><WandSparkles /><span><b>Unlock your flow</b><small>Explore Pro features</small></span><ArrowRight /></button> */}
        <button className="profile-chip" onClick={() => navigate('/settings')}><img src={session.avatar} /><span><b>{session.name}</b><small>{session.role.replace('_', ' ').toLowerCase()}</small></span><Ellipsis /></button>
        <button className="logout-link" onClick={logout}><LogOut /> Sign out</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu /></button>
        <div className="page-title"><h1>{current[0]}</h1><p>{current[1]}</p></div>
        <button className="search-trigger" onClick={() => setCommandOpen(true)}><Search /><span>Search anything...</span><kbd>⌘ K</kbd></button>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
          <button className="icon-btn notification-btn" onClick={() => navigate('/notifications')}><Bell /><i>{notices.filter(n => n.unread).length}</i></button>
          <img className="top-avatar" src={session.avatar} />
        </div>
      </header>
      <motion.div className="page" key={location.pathname} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }}>{children}</motion.div>
    </main>
    <AnimatePresence>{commandOpen && <CommandMenu close={() => setCommandOpen(false)} navigate={navigate} boards={boards} tasks={tasks} users={users} />}</AnimatePresence>
  </div>;
}

function CommandMenu({ close, navigate, boards, tasks, users }) {
  const [query,setQuery]=useState('');
  useEffect(()=>{const escape=event=>event.key==='Escape'&&close();window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[]);
  const actions = [
    ['Go to overview', '/', LayoutDashboard,'page'], ['Open projects', '/boards', Kanban,'page'],
    ['Message the team', '/chat', MessageSquare,'page'], ['Schedule a meeting', '/meetings', Video,'page'], ['Manage people', '/admin/users', Users,'page'],
    ...boards.map(board=>[board.name,`/boards/${board.id}`,Kanban,'project']),
    ...tasks.map(task=>[task.title,`/boards/${task.boardId}?task=${task.id}`,CheckCircle2,'task']),
    ...users.map(user=>[user.name,'/admin/users',Users,'person'])
  ].filter(([label])=>!query||label.toLowerCase().includes(query.toLowerCase())).slice(0,10);
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
    <motion.div className="command-menu" initial={{ scale: .96, y: -15 }} animate={{ scale: 1, y: 0 }} onMouseDown={e => e.stopPropagation()}>
      <div className="command-input"><Search /><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search pages, tasks, projects, or people…" /><kbd>ESC</kbd></div>
      <p>{query?'SEARCH RESULTS':'QUICK NAVIGATION'}</p>
      {actions.map(([label, path, Icon,type]) => <button key={`${type}-${label}`} onClick={() => { navigate(path); close(); }}><Icon /><span>{label}<small>{type}</small></span><ArrowRight /></button>)}
      {actions.length===0&&<div className="empty-state">No matching result.</div>}
    </motion.div>
  </motion.div>;
}

function Dashboard({ session, tasks, boards, users, notify, loading }) {
  const navigate = useNavigate();
  const scopedTasks = session.role === 'SUPER_ADMIN'
    ? tasks
    : tasks.filter(task => task.assigneeId === session.id || task.assigneeIds?.includes(session.id));
  const completed = scopedTasks.filter(t => t.status === 'done').length;
  const team = users.length ? users : USERS;
  return <>
    <section className="welcome-row">
      <div><span className="eyebrow"><Sparkles /> {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</span><h2>Good morning, {session.name.split(' ')[0]} <span>✦</span></h2><p>{loading ? 'Loading your workspace…' : `You have ${scopedTasks.filter(t => t.status !== 'done').length} tasks in motion.`}</p></div>
      <div className="welcome-actions"><button className="secondary-btn" onClick={() => navigate('/meetings')}><Video /> Start a huddle</button><button className="primary-btn" onClick={() => navigate('/boards')}><Plus /> Create task</button></div>
    </section>
    <section className="metric-grid">
      <Metric icon={Target} label="Tasks in motion" value={scopedTasks.filter(t => t.status !== 'done').length} trend="Live" tone="lime" note={session.role === 'SUPER_ADMIN' ? 'all workspace tasks' : 'assigned to you'} />
      <Metric icon={CheckCircle2} label="Completed" value={completed} trend={scopedTasks.length ? `${Math.round(completed / scopedTasks.length * 100)}%` : '0%'} tone="violet" note="of your scope" />
      <Metric icon={Gauge} label="Projects" value={new Set(scopedTasks.map(task => task.boardId)).size} trend="Active" tone="blue" note="with your tasks" />
      <Metric icon={Clock3} label="Due soon" value={scopedTasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date(Date.now() + 7 * 86400000) && task.status !== 'done').length} trend="7 days" tone="orange" note="needs attention" />
    </section>
    <section className="dashboard-grid">
      <div className="card work-card">
        <CardHead title="My focus" subtitle="Tasks that need your attention" action="View all" onAction={() => navigate('/tasks')} />
        <div className="focus-list">{scopedTasks.filter(t => t.status !== 'done').slice(0, 4).map(t => <FocusTask key={t.id} task={t} />)}</div>
      </div>
      <div className="card momentum-card">
        <CardHead title="Weekly momentum" subtitle="Completed tasks" action="This week" />
        <div className="chart-value"><strong>{completed}</strong><span><TrendingUp /> {scopedTasks.length ? Math.round(completed / scopedTasks.length * 100) : 0}%</span></div>
        <div className="bar-chart">{[6,5,4,3,2,1,0].map((offset, i) => { const day = new Date(Date.now() - offset * 86400000); const count = scopedTasks.filter(task => task.status === 'done' && new Date(task.createdAt).toDateString() === day.toDateString()).length; return <div key={i}><motion.i initial={{ height: 0 }} animate={{ height: `${Math.max(8, Math.min(100, count * 22))}%` }} transition={{ delay: i * .06 }} className={i === 6 ? 'hot' : ''} /><span>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>; })}</div>
      </div>
      <div className="card projects-card">
        <CardHead title="Active projects" subtitle="Progress across your workspace" action="View projects" onAction={() => navigate('/boards')} />
        {boards.filter(board => session.role === 'SUPER_ADMIN' || scopedTasks.some(task => task.boardId === board.id)).slice(0, 3).map((board, index) => {
          const boardTasks = tasks.filter(task => task.boardId === board.id);
          const pct = boardTasks.length ? Math.round(boardTasks.filter(task => task.status === 'done').length / boardTasks.length * 100) : 0;
          return <button className="project-row" key={board.id} onClick={() => navigate(`/boards/${board.id}`)}>
          {(() => { const tone = ['purple', 'green', 'orange'][index % 3]; return <span className={`project-symbol ${tone}`}><Grid2X2 /></span>; })()}<span className="project-name"><b>{board.name}</b><small>{board.description || 'Team project'}</small></span>
          <span className="mini-avatars">{team.slice(0, 3).map(u => <img key={u.id} src={u.avatar} />)}</span><span className="progress-wrap"><i><em style={{ width: `${pct}%` }} /></i><b>{pct}%</b></span><ArrowRight />
        </button>;
        })}
      </div>
      <div className="card activity-card">
        <CardHead title="Team pulse" subtitle="Live workspace activity" />
        {team.slice(0, 4).map(user => <div className="activity-row" key={user.id}><div className="avatar-online"><img src={user.avatar} /><i /></div><span><b>{user.name}</b><small>{user.title || 'Workspace member'}</small></span><time>{user.status || 'Active'}</time></div>)}
      </div>
    </section>
  </>;
}

function Metric({ icon: Icon, label, value, trend, tone, note }) {
  return <motion.article className="metric-card" whileHover={{ y: -3 }}><div className={`metric-icon ${tone}`}><Icon /></div><div><p>{label}</p><strong>{value}</strong></div><span className={`metric-trend ${tone}`}>{trend}</span><small>{note}</small></motion.article>;
}
function CardHead({ title, subtitle, action, onAction }) { return <div className="card-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button onClick={onAction}>{action}<ChevronDown /></button>}</div>; }
function Priority({ value }) { return <span className={`priority p-${value.toLowerCase()}`}><i />{value}</span>; }
function FocusTask({ task }) { return <div className="focus-task"><button className="task-check"><Circle /></button><span><b>{task.title}</b><small><span className="project-dot" />{task.project} · {task.code}</small></span><Priority value={task.priority} /><time className={task.due === 'Today' ? 'due' : ''}><CalendarDays />{task.due}</time><div className="mini-avatars">{task.assignees.map(u => <img key={u.id} src={u.avatar} />)}</div><button className="ghost-icon"><MoreHorizontal /></button></div>; }

function Modal({ children, close, className = '' }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
    <motion.div className={`feature-modal ${className}`} initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onMouseDown={event => event.stopPropagation()}>{children}</motion.div>
  </motion.div>;
}

function ProjectModal({ close, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '' });
  return <Modal close={close}><div className="modal-top"><div><h2>Create a project</h2><p>Give your team a clear home for the work.</p></div><button onClick={close}><X/></button></div>
    <form onSubmit={event => { event.preventDefault(); onCreate(form); }}>
      <label>Project name<input autoFocus required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Website launch"/></label>
      <label>Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="What will this project accomplish?"/></label>
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn"><Plus/>Create project</button></div>
    </form>
  </Modal>;
}

function Boards({ boards, tasks, setBoards, notify }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const createBoard = async form => {
    try {
      const created = await boardApi.create(form);
      setBoards(items => [...items, created]);
      setCreateOpen(false);
      notify('Project created');
      navigate(`/boards/${created.id}`);
    } catch (error) { notify(error.message); }
  };
  const updateBoard = async (board, changes) => {
    try {
      const updated = await boardApi.update(board.id, changes);
      setBoards(items => items.map(item => item.id === board.id ? updated : item));
    } catch (error) { notify(error.message); }
  };
  const visible = boards.filter(board => tab === 'favorites' ? board.favorite && !board.archived : tab === 'archived' ? board.archived : !board.archived);
  return <><div className="toolbar"><div className="filter-tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>All projects <span>{boards.filter(board => !board.archived).length}</span></button><button className={tab==='favorites'?'active':''} onClick={()=>setTab('favorites')}>Favorites</button><button className={tab==='archived'?'active':''} onClick={()=>setTab('archived')}>Archived</button></div><button className="primary-btn" onClick={()=>setCreateOpen(true)}><Plus /> New project</button></div>
    <div className="board-grid">{visible.map((board, index) => {
      const boardTasks = tasks.filter(task => task.boardId === board.id);
      const progress = boardTasks.length ? Math.round(boardTasks.filter(task => task.status === 'done').length / boardTasks.length * 100) : 0;
      const tone = ['purple', 'green', 'orange', 'blue'][index % 4];
      return <motion.article whileHover={{ y: -5 }} className="board-card card" key={board.id}>
        <div className={`board-cover ${tone}`} onClick={() => navigate(`/boards/${board.id}`)}><span><Grid2X2 /></span><div className="card-actions"><button className={board.favorite?'selected':''} title="Favorite" onClick={event => {event.stopPropagation();updateBoard(board,{favorite:!board.favorite})}}><Star/></button><button title={board.archived?'Restore':'Archive'} onClick={event=>{event.stopPropagation();updateBoard(board,{archived:!board.archived})}}><Archive/></button></div></div>
        <div className="board-body" onClick={() => navigate(`/boards/${board.id}`)}><h3>{board.name}</h3><p>{board.description || 'A focused space for your team.'}</p><div className="board-meta"><span>{boardTasks.length} tasks</span><span>{progress}% complete</span></div><div className="project-progress"><i style={{ width: `${progress}%` }} /></div><div className="board-foot"><time>{new Date(board.createdAt).toLocaleDateString()}</time><ArrowRight/></div></div>
      </motion.article>;
    })}</div>
    <AnimatePresence>{createOpen&&<ProjectModal close={()=>setCreateOpen(false)} onCreate={createBoard}/>}</AnimatePresence>
  </>;
}

const COLUMNS = [['todo','TO DO','#a78bfa'],['progress','IN PROGRESS','#bef264'],['review','REVIEW','#60a5fa'],['done','DONE','#34d399']];
function Board({ boards, tasks, users, setTasks, notify }) {
  const { id } = useParams();
  const location=useLocation();
  const [columns, setColumns] = useState([]);
  const [view, setView] = useState('board');
  const [editor, setEditor] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', priority: 'ALL', assignee: 'ALL' });
  const [activeTask, setActiveTask] = useState(null);
  const [columnEditor,setColumnEditor]=useState(null);
  useEffect(() => {
    boardApi.detail(id).then(detail => setColumns(detail.columns)).catch(error => notify(error.message));
  }, [id]);
  useEffect(()=>{const taskId=new URLSearchParams(location.search).get('task');const task=tasks.find(item=>item.id===taskId);if(task)setEditor(task)},[location.search,tasks.length]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }));
  const move = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;
    const movingTask = tasks.find(task => task.id === active.id);
    const overTask = tasks.find(task => task.id === over.id);
    const targetColumn = columns.find(column => column.id === over.id)
      || columns.find(column => column.id === overTask?.columnId);
    if (!targetColumn || !movingTask) return;
    const targetItems = tasks.filter(task => task.columnId === targetColumn.id && task.id !== movingTask.id).sort((a,b)=>a.position-b.position);
    const targetPosition = overTask ? Math.max(0, targetItems.findIndex(task => task.id === overTask.id)) : targetItems.length;
    try {
      await boardApi.moveTask(active.id, { columnId: targetColumn.id, position: targetPosition });
      setTasks(items => {
        const without = items.filter(task => task.id !== movingTask.id);
        const scoped = without.filter(task => task.columnId === targetColumn.id).sort((a,b)=>a.position-b.position);
        scoped.splice(targetPosition, 0, { ...movingTask, columnId: targetColumn.id, status: columnStatus(targetColumn.name) });
        const positions = new Map(scoped.map((task, position) => [task.id, position]));
        return [...without, scoped[targetPosition]].map(task => positions.has(task.id) ? { ...task, position: positions.get(task.id) } : task);
      });
    } catch (error) { notify(error.message); }
  };
  const saveTask = async form => {
    try {
      const detail = { board: boards.find(board => board.id === id) || { id, name: 'Project' }, columns };
      if (form.id) {
        const updated = await boardApi.updateTask(form.id, form);
        if (updated.columnId !== form.columnId) await boardApi.moveTask(form.id,{columnId:form.columnId,position:0});
        setTasks(items => items.map(task => task.id === form.id ? taskView({...updated,columnId:form.columnId}, detail, users) : task));
        notify('Task updated');
      } else {
        const created = await boardApi.createTask(id, form);
        setTasks(items => [...items, taskView(created, detail, users)]);
        notify('Task created');
      }
      setEditor(null);
    } catch (error) { notify(error.message); }
  };
  const deleteTask = async task => {
    try { await boardApi.deleteTask(task.id); setTasks(items=>items.filter(item=>item.id!==task.id)); setEditor(null); notify('Task deleted'); } catch(error){notify(error.message)}
  };
  const updateColumn = async (column, action) => {
    try {
      if (action === 'delete') {
        if (!confirm(`Delete "${column.name}" and its tasks?`)) return;
        await boardApi.deleteColumn(column.id);
        setColumns(items=>items.filter(item=>item.id!==column.id));
        setTasks(items=>items.filter(task=>task.columnId!==column.id));
      } else if (action === 'rename') {
        setColumnEditor(column);
      } else {
        const current = columns.findIndex(item=>item.id===column.id);
        const next = Math.max(0,Math.min(columns.length-1,current+(action==='left'?-1:1)));
        if(current===next)return;
        await boardApi.moveColumn(column.id,next);
        setColumns(items=>arrayMove(items,current,next).map((item,position)=>({...item,position})));
      }
    } catch(error){notify(error.message)}
  };
  const addColumn = async () => {
    setColumnEditor({});
  };
  const saveColumn=async name=>{try{if(columnEditor.id){const updated=await boardApi.updateColumn(columnEditor.id,{name});setColumns(items=>items.map(item=>item.id===updated.id?updated:item))}else{const created=await boardApi.addColumn(id,{name});setColumns(items=>[...items,created])}setColumnEditor(null)}catch(error){notify(error.message)}};
  const boardTasks = tasks.filter(task => task.boardId === id)
    .filter(task => filters.search ? `${task.title} ${task.description || ''}`.toLowerCase().includes(filters.search.toLowerCase()) : true)
    .filter(task => filters.priority === 'ALL' || task.priority === filters.priority)
    .filter(task => filters.assignee === 'ALL' || task.assigneeIds?.includes(filters.assignee) || task.assigneeId === filters.assignee);
  return <>
    <div className="board-toolbar"><div className="board-tabs"><button className={view==='board'?'active':''} onClick={()=>setView('board')}><Kanban /> Board</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}><ListFilter /> List</button><button className={view==='timeline'?'active':''} onClick={()=>setView('timeline')}><CalendarDays /> Timeline</button></div><div className="board-tools"><button className="secondary-btn" onClick={addColumn}><Plus/>Add list</button><button className={`secondary-btn ${filterOpen?'active':''}`} onClick={()=>setFilterOpen(!filterOpen)}><Filter /> Filter</button><button className="primary-btn" onClick={() => setEditor({columnId:columns[0]?.id})}><Plus /> Add task</button></div></div>
    {filterOpen&&<div className="filter-panel"><input placeholder="Search tasks…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/><select value={filters.priority} onChange={e=>setFilters({...filters,priority:e.target.value})}><option>ALL</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select><select value={filters.assignee} onChange={e=>setFilters({...filters,assignee:e.target.value})}><option value="ALL">All assignees</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select><button onClick={()=>setFilters({search:'',priority:'ALL',assignee:'ALL'})}><X/>Clear</button></div>}
    {view==='board'&&<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({active})=>setActiveTask(tasks.find(task=>task.id===active.id))} onDragEnd={move} onDragCancel={()=>setActiveTask(null)}><div className="kanban-board">{columns.map((column, index) => <KanbanColumn key={column.id} column={column} color={COLUMNS[index % COLUMNS.length][2]} tasks={boardTasks.filter(task => task.columnId === column.id).sort((a,b)=>a.position-b.position)} onSelect={setEditor} onAdd={() => setEditor({columnId:column.id})} onColumn={action=>updateColumn(column,action)} />)}</div><DragOverlay>{activeTask&&<TaskCardPreview task={activeTask}/>}</DragOverlay></DndContext>}
    {view==='list'&&<div className="card board-list-view">{columns.map(column=><section key={column.id}><h3>{column.name}<span>{boardTasks.filter(task=>task.columnId===column.id).length}</span></h3>{boardTasks.filter(task=>task.columnId===column.id).map(task=><button key={task.id} onClick={()=>setEditor(task)}><CheckCircle2/><b>{task.title}</b><Priority value={task.priority}/><span>{task.assignees.map(user=>user.name).join(', ')||'Unassigned'}</span><time>{task.due}</time></button>)}</section>)}</div>}
    {view==='timeline'&&<div className="card timeline-view">{boardTasks.slice().sort((a,b)=>new Date(a.dueDate||'9999')-new Date(b.dueDate||'9999')).map(task=><button key={task.id} onClick={()=>setEditor(task)}><span className="timeline-date">{task.dueDate?new Date(task.dueDate).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'No date'}</span><i/><div><b>{task.title}</b><small>{task.project} · {task.status}</small></div><Priority value={task.priority}/></button>)}</div>}
    <AnimatePresence>{editor&&<TaskEditor task={editor.id?editor:null} defaultColumnId={editor.columnId} columns={columns} users={users} session={users.find(user=>user.id===editor.createdById)} close={()=>setEditor(null)} save={saveTask} remove={deleteTask} notify={notify}/>}</AnimatePresence>
    <AnimatePresence>{columnEditor&&<ColumnModal column={columnEditor.id?columnEditor:null} close={()=>setColumnEditor(null)} save={saveColumn}/>}</AnimatePresence>
  </>;
}
function ColumnModal({column,close,save}){const [name,setName]=useState(column?.name||'');return <Modal close={close}><div className="modal-top"><div><h2>{column?'Rename list':'Add a list'}</h2><p>Shape the workflow with a clear stage name.</p></div><button onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();save(name.trim())}}><label>List name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ready for review"/></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn"><Check/>Save list</button></div></form></Modal>}
function KanbanColumn({ column, color, tasks, onSelect, onAdd, onColumn }) {
  const { setNodeRef, isOver } = useDroppable({ id:column.id });
  return <section className={`kanban-column ${isOver ? 'over' : ''}`} ref={setNodeRef}><header><span style={{ '--col': color }}><i />{column.name.toUpperCase()}</span><b>{tasks.length}</b><div className="column-actions"><button title="Move left" onClick={()=>onColumn('left')}><ArrowLeft/></button><button title="Move right" onClick={()=>onColumn('right')}><ArrowRight/></button><button title="Rename" onClick={()=>onColumn('rename')}><Pencil/></button><button title="Delete" onClick={()=>onColumn('delete')}><Trash2/></button></div></header><SortableContext items={tasks.map(task=>task.id)} strategy={verticalListSortingStrategy}><div className="kanban-stack">{tasks.map(task => <TaskCard key={task.id} task={task} onSelect={onSelect} />)}<button className="add-card" onClick={onAdd}><Plus /> Add task</button></div></SortableContext></section>;
}
function TaskCard({ task, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return <article ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} className={`task-card ${isDragging?'dragging':''}`} onClick={() => onSelect(task)}>
    <div className="task-top"><button className="drag-handle" {...attributes} {...listeners} onClick={event=>event.stopPropagation()}><GripVertical/></button><span className="task-code">{task.code}</span><Priority value={task.priority} /></div><h4>{task.title}</h4><p>{task.description?<span dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(task.description)}}/>:'No description'}</p><div className="task-foot"><div className="mini-avatars">{task.assignees.map(u => <img src={u.avatar} key={u.id} />)}</div><span><CalendarDays />{task.due}</span><span><MessageCircle />{task.comments}</span></div>
  </article>;
}
function TaskCardPreview({task}){return <div className="task-card drag-preview"><div className="task-top"><span>{task.code}</span><Priority value={task.priority}/></div><h4>{task.title}</h4><p>{task.assignees.map(user=>user.name).join(', ')}</p></div>}

function RichEditor({ value, onChange }) {
  const ref=useRef(null);
  const command=(name,arg)=>{ref.current?.focus();document.execCommand(name,false,arg);onChange(ref.current?.innerHTML||'')};
  return <div className="rich-editor"><div className="rich-toolbar"><button type="button" title="Bold (Ctrl+B)" onClick={()=>command('bold')}><Bold/></button><button type="button" title="Italic (Ctrl+I)" onClick={()=>command('italic')}><Italic/></button><button type="button" onClick={()=>command('formatBlock','h3')}><Type/>H3</button><select onChange={e=>command('fontSize',e.target.value)} defaultValue="3"><option value="2">Small</option><option value="3">Normal</option><option value="5">Large</option></select><button type="button" onClick={()=>{const url=prompt('Link URL');if(url)command('createLink',url)}}><Link/></button></div><div ref={ref} className="rich-content" contentEditable suppressContentEditableWarning onInput={e=>onChange(e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(value||'')}} data-placeholder="Describe the task…"/></div>;
}

function AssigneePicker({ users, selected, onChange }) {
  const [query,setQuery]=useState('');
  const matches=users.filter(user=>!selected.includes(user.id)&&(!query||`@${user.username} ${user.name}`.toLowerCase().includes(query.toLowerCase().replace('@',''))));
  return <div className="assignee-picker"><div className="selected-users">{selected.map(id=>{const user=users.find(item=>item.id===id);return user&&<button type="button" key={id} onClick={()=>onChange(selected.filter(item=>item!==id))}><img src={user.avatar}/>@{user.username}<X/></button>})}</div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="@ mention an assignee"/>{query&&<div className="mention-menu">{matches.slice(0,6).map(user=><button type="button" key={user.id} onClick={()=>{onChange([...selected,user.id]);setQuery('')}}><img src={user.avatar}/><span><b>{user.name}</b><small>@{user.username}</small></span></button>)}</div>}</div>;
}

function TaskEditor({ task, defaultColumnId, columns, users, close, save, remove, notify }) {
  const [form,setForm]=useState({id:task?.id,columnId:task?.columnId||defaultColumnId,title:task?.title||'',description:task?.description||'',priority:task?.priority||'MEDIUM',assigneeIds:task?.assigneeIds||task?.assignees?.map(user=>user.id)||[],dueDate:task?.dueDate?new Date(task.dueDate).toISOString().slice(0,16):''});
  const [comments,setComments]=useState([]),[comment,setComment]=useState('');
  useEffect(()=>{if(task?.id)boardApi.comments(task.id).then(setComments).catch(()=>{})},[task?.id]);
  const addComment=async()=>{if(!comment.trim())return;try{const created=await boardApi.addComment(task.id,comment);setComments(items=>[...items,created]);setComment('')}catch(error){notify(error.message)}};
  return <Modal close={close} className="task-editor-modal"><div className="modal-top"><div><span className="eyebrow">{task?'EDIT TASK':'NEW TASK'}</span><h2>{task?'Shape the details':'Create meaningful work'}</h2></div><button onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();save({...form,dueDate:form.dueDate?new Date(form.dueDate).toISOString():null})}}><div className="task-editor-grid"><label>Title<input autoFocus required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What needs to happen?"/></label><label>List<select value={form.columnId} onChange={e=>setForm({...form,columnId:e.target.value})}>{columns.map(column=><option key={column.id} value={column.id}>{column.name}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label><label>Due date<input type="datetime-local" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label></div><label>Description<RichEditor value={form.description} onChange={description=>setForm({...form,description})}/></label><label>Assign to<AssigneePicker users={users} selected={form.assigneeIds} onChange={assigneeIds=>setForm({...form,assigneeIds})}/></label>{task&&<div className="task-comments"><h3>Activity</h3>{comments.map(item=><div key={item.id}><img src={item.author?userView(item.author).avatar:avatar('user')}/><p><b>{item.author?`${item.author.firstName} ${item.author.lastName}`:'User'}</b><span>{item.content}</span></p></div>)}<div className="comment-compose"><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Leave a comment…"/><button type="button" onClick={addComment}><Send/></button></div></div>}<div className="modal-actions">{task&&<button type="button" className="danger-btn" onClick={()=>remove(task)}><Trash2/>Delete</button>}<button type="button" className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn"><Check/>{task?'Save changes':'Create task'}</button></div></form></Modal>;
}

function MyTasks({ tasks, setTasks, session }) {
  const [tab,setTab]=useState('assigned');
  const [filterOpen,setFilterOpen]=useState(false);
  const [priority,setPriority]=useState('ALL');
  const toggleTask = async task => {
    try {
      const detail = await boardApi.detail(task.boardId);
      const target = task.status === 'done'
        ? detail.columns[0]
        : detail.columns.find(column => columnStatus(column.name) === 'done');
      if (!target) throw new Error('This project has no completion column.');
      await boardApi.moveTask(task.id, { columnId: target.id, position: 0 });
      setTasks(items => items.map(item => item.id === task.id
        ? { ...item, columnId: target.id, status: columnStatus(target.name) }
        : item));
    } catch (error) { console.error(error); }
  };
  const visible=tasks.filter(task=>tab==='created'?task.createdById===session.id:tab==='completed'?(task.status==='done'&&(task.assigneeId===session.id||task.assigneeIds?.includes(session.id))):(task.status!=='done'&&(task.assigneeId===session.id||task.assigneeIds?.includes(session.id)))).filter(task=>priority==='ALL'||task.priority===priority);
  return <div className="card table-card"><div className="toolbar"><div className="filter-tabs"><button className={tab==='assigned'?'active':''} onClick={()=>setTab('assigned')}>Assigned to me</button><button className={tab==='created'?'active':''} onClick={()=>setTab('created')}>Created by me</button><button className={tab==='completed'?'active':''} onClick={()=>setTab('completed')}>Completed</button></div><button className={`secondary-btn ${filterOpen?'active':''}`} onClick={()=>setFilterOpen(!filterOpen)}><Filter /> Filter</button></div>{filterOpen&&<div className="filter-panel"><select value={priority} onChange={e=>setPriority(e.target.value)}><option>ALL</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select><button onClick={()=>setPriority('ALL')}><X/>Clear</button></div>}
    <div className="task-table"><div className="table-head"><span>Task</span><span>Project</span><span>Priority</span><span>Due date</span><span>Owner</span></div>{visible.map(t => <div className="table-row" key={t.id}><button onClick={() => toggleTask(t)}>{t.status === 'done' ? <CheckCircle2 /> : <Circle />}</button><span><b>{t.title}</b><small>{t.code}</small></span><span>{t.project}</span><Priority value={t.priority} /><time>{t.due}</time><div className="mini-avatars">{t.assignees.map(u => <img src={u.avatar} key={u.id} />)}</div></div>)}</div>
  </div>;
}

function GroupModal({ group, users, close, save, canManage }) {
  const [form,setForm]=useState({name:group?.name||'',description:group?.description||'',avatarUrl:group?.avatarUrl||'',memberIds:group?.memberIds?.filter(id=>users.some(user=>user.id===id))||[]});
  const [uploading,setUploading]=useState(false);
  const upload=async file=>{if(!file)return;setUploading(true);try{const media=await uploadApi(file,'taskflow/groups');setForm({...form,avatarUrl:assetUrl(media.url)})}finally{setUploading(false)}};
  return <Modal close={close}><div className="modal-top"><div><h2>{group?'Channel settings':'Create a channel'}</h2><p>Name the space and choose who belongs here.</p></div><button onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();save(form)}}><div className="group-avatar-upload"><img src={form.avatarUrl||avatar(form.name||'group')}/><label className="secondary-btn"><Upload/>{uploading?'Uploading…':'Group image'}<input type="file" accept="image/*" hidden onChange={e=>upload(e.target.files[0])}/></label></div><label>Channel name<input required disabled={group&&!canManage} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Description<textarea disabled={group&&!canManage} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Members<div className="member-selector">{users.filter(user=>user.username!=='flowa').map(user=><button type="button" disabled={group&&!canManage} className={form.memberIds.includes(user.id)?'selected':''} key={user.id} onClick={()=>setForm({...form,memberIds:form.memberIds.includes(user.id)?form.memberIds.filter(id=>id!==user.id):[...form.memberIds,user.id]})}><img src={user.avatar}/><span>{user.name}<small>@{user.username}</small></span>{form.memberIds.includes(user.id)&&<Check/>}</button>)}</div></label>{(!group||canManage)&&<div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn"><Check/>{group?'Save channel':'Create channel'}</button></div>}</form></Modal>;
}

function Chat({ notify, users, session }) {
  const location=useLocation();
  const requestedGroup=new URLSearchParams(location.search).get('group');
  const requestedMessage=new URLSearchParams(location.search).get('message');
  const [groups,setGroups]=useState([]),[active,setActive]=useState(null),[messages,setMessages]=useState([]),[text,setText]=useState('');
  const [groupModal,setGroupModal]=useState(null),[reply,setReply]=useState(null),[search,setSearch]=useState(''),[searching,setSearching]=useState(false);
  const [recording,setRecording]=useState(false);
  const [mobileChannels,setMobileChannels]=useState(false);
  const streamRef=useRef(null),fileRef=useRef(null),scrollTimer=useRef(null),recorderRef=useRef(null);
  const canManage=['SUPER_ADMIN','ADMIN'].includes(session.role);
  const refreshGroups=()=>chatApi.groups().then(raw=>{const items=raw.map(groupView);setGroups(items);setActive(current=>items.find(item=>item.id===(requestedGroup||current?.id))||items[0]||null)});
  useEffect(()=>{refreshGroups().catch(error=>notify(error.message));const timer=setInterval(()=>refreshGroups().catch(()=>{}),5000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{
    if(!active){setMessages([]);return}
    let socket;
    chatApi.messages(active.id).then(raw=>{const items=raw.map(messageView);setMessages(items);requestAnimationFrame(()=>{const targetId=requestedMessage||active.scrollMessageId;const target=targetId&&document.querySelector(`[data-message-id="${targetId}"]`);if(target)target.scrollIntoView({block:'center'});else if(streamRef.current)streamRef.current.scrollTop=streamRef.current.scrollHeight})}).catch(error=>notify(error.message));
    const wsBase=API_URL.replace(/^http/,'ws');
    socket=new WebSocket(`${wsBase}/ws/chat?token=${encodeURIComponent(getToken())}&group=${active.id}`);
    socket.onmessage=event=>{try{const payload=JSON.parse(event.data);if(payload.event==='message'){const incoming=messageView(payload.data);setMessages(items=>items.some(item=>item.id===incoming.id)?items:[...items,incoming])}}catch{}};
    return()=>socket?.close();
  },[active?.id]);
  useEffect(()=>{if(!active||!messages.length||active.scrollMessageId)return;const last=messages[messages.length-1];chatApi.markRead(active.id,{lastReadMessageId:last.id,scrollMessageId:last.id}).then(updated=>setGroups(items=>items.map(item=>item.id===updated.id?updated:item))).catch(()=>{})},[messages.length,active?.id]);
  const rememberScroll=event=>{const node=event.currentTarget;clearTimeout(scrollTimer.current);scrollTimer.current=setTimeout(()=>{if(!node?.isConnected)return;const elements=[...node.querySelectorAll('[data-message-id]')];const first=elements.find(element=>element.offsetTop+element.offsetHeight>=node.scrollTop);const atBottom=node.scrollHeight-node.scrollTop-node.clientHeight<70;const last=messages[messages.length-1];if(active&&first)chatApi.markRead(active.id,{lastReadMessageId:atBottom?last?.id:active.lastReadMessageId,scrollMessageId:atBottom?last?.id:first.dataset.messageId}).then(updated=>{setGroups(items=>items.map(item=>item.id===updated.id?updated:item));setActive(updated)}).catch(()=>{})},500)};
  const send=async payload=>{if(!active)return;try{const message=messageView(await chatApi.send(active.id,{content:text.trim(),type:'TEXT',replyToId:reply?.id,...payload}));setMessages(items=>items.some(item=>item.id===message.id)?items:[...items,message]);setText('');setReply(null)}catch(error){notify(error.message)}};
  const uploadMedia=async file=>{if(!file)return;try{const media=await uploadApi(file,'taskflow/chat');await send({content:file.name,type:media.type,mediaUrl:media.url,mediaName:media.name})}catch(error){notify(error.message)}};
  const toggleRecording=async()=>{if(recording){recorderRef.current?.stop();return}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const chunks=[];const recorder=new MediaRecorder(stream);recorderRef.current=recorder;recorder.ondataavailable=event=>chunks.push(event.data);recorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());setRecording(false);await uploadMedia(new File([new Blob(chunks,{type:recorder.mimeType})],`voice-${Date.now()}.webm`,{type:recorder.mimeType}))};recorder.start();setRecording(true)}catch(error){notify(error.message)}};
  const mentionQuery=text.match(/@([a-zA-Z0-9_.-]*)$/)?.[1];
  const mentionUsers=mentionQuery!==undefined?users.filter(user=>user.username.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0,6):[];
  const saveGroup=async form=>{try{if(groupModal?.id){const updated=groupView(await chatApi.updateGroup(groupModal.id,form));setGroups(items=>items.map(item=>item.id===updated.id?updated:item));setActive(updated)}else{const created=groupView(await chatApi.createGroup(form));setGroups(items=>[...items,created]);setActive(created)}setGroupModal(null)}catch(error){notify(error.message)}};
  const doSearch=async()=>{if(!search.trim()){chatApi.messages(active.id).then(items=>setMessages(items.map(messageView)));return}setSearching(true);try{setMessages((await chatApi.search(active.id,search)).map(messageView))}finally{setSearching(false)}};
  const media=messages.filter(message=>message.mediaUrl);
  return <><div className="chat-layout card"><aside className={`chat-side ${mobileChannels?'mobile-open':''}`}><div className="chat-side-title"><h3>Messages</h3><div><button onClick={()=>setGroupModal({})}><Plus/></button><button className="channel-close" onClick={()=>setMobileChannels(false)}><X/></button></div></div><div className="chat-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Search messages"/>{search&&<button onClick={()=>{setSearch('');chatApi.messages(active.id).then(items=>setMessages(items.map(messageView)))}}><X/></button>}</div><div className="channel-list"><p>CHANNELS</p>{groups.length===0&&<div className="empty-state">No channels yet.</div>}{groups.map(group=><button className={active?.id===group.id?'active':''} key={group.id} onClick={()=>{setActive(group);setMobileChannels(false)}}>{group.avatarUrl?<img className="channel-avatar" src={group.avatarUrl}/>:<Hash/>}<span>{group.name}</span>{group.mentionCount>0&&<i className="mention-badge">!</i>}{group.unreadCount>0&&<b>{group.unreadCount}</b>}</button>)}</div></aside>
    {mobileChannels&&<button className="chat-side-scrim" aria-label="Close channels" onClick={()=>setMobileChannels(false)}/>}<section className="chat-main"><header><div><button className="channel-toggle" onClick={()=>setMobileChannels(true)}><Menu/></button><span className="hash-icon">{active?.avatarUrl?<img src={active.avatarUrl}/>:<Hash/>}</span><span><b>{active?.name||'No channel yet'}</b><small>{active?.description||'Create a channel to start chatting'}</small></span></div><div><button onClick={()=>active&&setGroupModal(active)}><Users/> {active?.memberIds?.length||0}</button><button onClick={()=>setGroupModal(active)}><Settings/></button></div></header><div className="message-stream" ref={streamRef} onScroll={rememberScroll}>{searching&&<div className="empty-state">Searching…</div>}<div className="date-divider"><span>{search?'Search results':'Messages'}</span></div>{messages.map(message=>{const sender=message.sender?userView(message.sender):USERS[0];return <div className={`message ${message.senderId===session.id?'mine':''}`} data-message-id={message.id} key={message.id}><img src={sender.avatar}/><div>{message.replyTo&&<button className="reply-preview" onClick={()=>document.querySelector(`[data-message-id="${message.replyTo.id}"]`)?.scrollIntoView()}><Reply/>{message.replyTo.content}</button>}<p><b>{sender.name}</b><time>{new Date(message.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time><button className="reply-action" onClick={()=>setReply(message)}><Reply/></button></p>{message.mediaUrl&&message.type==='IMAGE'&&<img className="message-media" src={message.mediaUrl}/>} {message.mediaUrl&&message.type==='VIDEO'&&<video className="message-media" src={message.mediaUrl} controls/>}{message.mediaUrl&&message.type==='AUDIO'&&<audio src={message.mediaUrl} controls/>}{message.mediaUrl&&message.type==='FILE'&&<a href={message.mediaUrl} target="_blank"><FileText/>{message.mediaName}</a>}<span>{message.content}</span></div></div>})}</div>{reply&&<div className="composer-reply"><Reply/><span>Replying to <b>{reply.sender?.username}</b>: {reply.content}</span><button onClick={()=>setReply(null)}><X/></button></div>}<div className="message-composer"><div><button onClick={()=>fileRef.current?.click()}><Paperclip/></button><input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={e=>uploadMedia(e.target.files[0])}/><input value={text} disabled={!active} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder={recording?'Recording voice…':active?`Message #${active.name}`:'Select a channel'}/><button className={recording?'recording':''} onClick={toggleRecording}><Mic/></button><button className="send-btn" onClick={()=>send()}><Send/></button>{mentionUsers.length>0&&<div className="mention-menu chat-mentions">{mentionUsers.map(user=><button key={user.id} onClick={()=>setText(text.replace(/@[a-zA-Z0-9_.-]*$/,`@${user.username} `))}><img src={user.avatar}/><span><b>{user.name}</b><small>@{user.username}</small></span></button>)}</div>}</div></div></section>
    <aside className="chat-details"><div className="channel-orb">{active?.avatarUrl?<img src={active.avatarUrl}/>:<Hash/>}</div><h3>{active?.name||'Channel'}</h3><p>{active?.description||'Your team conversations live here.'}</p><div className="detail-stat"><span><b>{active?.memberIds?.length||0}</b><small>Members</small></span><span><b>{media.length}</b><small>Media</small></span></div>{canManage&&<button className="secondary-btn" onClick={()=>setGroupModal(active)}><Settings/>Manage channel</button>}<div className="media-gallery">{media.slice(-6).map(item=>item.type==='IMAGE'?<a href={item.mediaUrl} target="_blank" key={item.id}><img src={item.mediaUrl}/></a>:<a href={item.mediaUrl} target="_blank" key={item.id}><FileText/><small>{item.mediaName}</small></a>)}</div></aside></div><AnimatePresence>{groupModal&&<GroupModal group={groupModal.id?groupModal:null} users={users} close={()=>setGroupModal(null)} save={saveGroup} canManage={canManage}/>}</AnimatePresence></>;
}

function MeetingModal({users,close,save}){
  const [form,setForm]=useState({title:'',description:'',scheduledAt:'',durationMinutes:30,participantIds:[]});
  return <Modal close={close}><div className="modal-top"><div><h2>Schedule a meeting</h2><p>Create a room that opens around its scheduled time.</p></div><button onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();save({...form,scheduledAt:new Date(form.scheduledAt).toISOString()})}}><label>Title<input autoFocus required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="task-editor-grid"><label>Date and time<input required type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label><label>Duration<select value={form.durationMinutes} onChange={e=>setForm({...form,durationMinutes:Number(e.target.value)})}><option value="15">15 min</option><option value="30">30 min</option><option value="60">60 min</option></select></label></div><label>Participants<div className="member-selector">{users.map(user=><button type="button" className={form.participantIds.includes(user.id)?'selected':''} key={user.id} onClick={()=>setForm({...form,participantIds:form.participantIds.includes(user.id)?form.participantIds.filter(id=>id!==user.id):[...form.participantIds,user.id]})}><img src={user.avatar}/><span>{user.name}<small>@{user.username}</small></span>{form.participantIds.includes(user.id)&&<Check/>}</button>)}</div></label><div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn"><CalendarDays/>Schedule</button></div></form></Modal>
}

function Meetings({ meetings, setMeetings, users, session, notify }) {
  const navigate = useNavigate();
  const [scheduleOpen,setScheduleOpen]=useState(false);
  const canManage=['SUPER_ADMIN','ADMIN'].includes(session.role);
  const activeMeetings=meetings.filter(meeting=>!meeting.scheduledAt||new Date(meeting.scheduledAt).getTime()+7200000>Date.now());
  const next=activeMeetings.find(meeting=>!meeting.scheduledAt||new Date(meeting.scheduledAt)>=new Date(Date.now()-7200000));
  const createMeeting = async form => {
    try {
      const created = await meetingApi.create(form||{ title: 'Instant huddle', participantIds: users.map(user => user.id), durationMinutes: 30 });
      setMeetings(items => [...items, created]);
      setScheduleOpen(false);
      notify(form?'Meeting scheduled':'Instant room is ready');
      if(!form)navigate(`/meetings/${created.roomId}`);
    } catch (error) { notify(error.message); }
  };
  const canOpen=meeting=>!meeting.scheduledAt||(Date.now()>=new Date(meeting.scheduledAt).getTime()-900000&&Date.now()<=new Date(meeting.scheduledAt).getTime()+7200000);
  const copy=meeting=>{if(!canOpen(meeting)){notify('Invite can be copied on the scheduled date');return}navigator.clipboard?.writeText(`${location.origin}/meetings/${meeting.roomId}`);notify('Meeting link copied')};
  return <><section className="meeting-hero card"><div><span className="eyebrow"><Radio /> {next?'YOUR NEXT MEETING':'READY WHEN YOU ARE'}</span><h2>{next?.title||'No upcoming meeting'}</h2><p>{next?.scheduledAt?new Date(next.scheduledAt).toLocaleString():'Admins can schedule or start a huddle'} · {next?.participantIds?.length||0} participants</p><div className="avatar-stack">{users.filter(user=>next?.participantIds?.includes(user.id)).slice(0,5).map(user=><img src={user.avatar} key={user.id}/>)}</div></div><div className="meeting-visual"><div className="pulse-ring"><Video/></div></div>{next&&<button disabled={!canOpen(next)} className="primary-btn" onClick={()=>navigate(`/meetings/${next.roomId}`)}><Video/>Join room</button>}</section>
    <div className="meetings-grid"><section className="card"><CardHead title="Upcoming" subtitle="Rooms disappear two hours after their start" />{activeMeetings.map((meeting,i)=><div className="meeting-row" key={meeting.id}><span className={`calendar-tile t${i%3}`}><b>{meeting.scheduledAt?new Date(meeting.scheduledAt).toLocaleDateString(undefined,{weekday:'short'}):'Now'}</b><small>{meeting.scheduledAt?new Date(meeting.scheduledAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Ready'}</small></span><span><b>{meeting.title}</b><small>{meeting.durationMinutes||30} min</small></span><div className="meeting-row-actions"><button title="Copy invite" onClick={()=>copy(meeting)}><Copy/></button><button disabled={!canOpen(meeting)} onClick={()=>navigate(`/meetings/${meeting.roomId}`)}><ArrowRight/></button></div></div>)}</section>
    <section className="card quick-meet"><span className="quick-icon"><Zap/></span><h3>Bring the team together</h3><p>Only workspace admins can create meeting rooms.</p>{canManage&&<><button className="primary-btn" onClick={()=>createMeeting()}><Video/>Start huddle</button><button className="secondary-btn" onClick={()=>setScheduleOpen(true)}><CalendarDays/>Schedule meeting</button></>}</section></div><AnimatePresence>{scheduleOpen&&<MeetingModal users={users} close={()=>setScheduleOpen(false)} save={createMeeting}/>}</AnimatePresence></>;
}

function MediaTile({ track, name, featured = false, fallback }) {
  const mediaRef = useRef(null);
  useEffect(() => {
    if (!track || !mediaRef.current) return;
    track.attach(mediaRef.current);
    return () => track.detach(mediaRef.current);
  }, [track]);
  return <div className={`video-tile ${featured ? 'featured' : ''}`}>
    {track ? <video ref={mediaRef} autoPlay playsInline muted={featured} /> : <img src={fallback} alt="" />}
    <span>{name}</span>
  </div>;
}

function MeetingRoom({ session }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [mic, setMic] = useState(true), [cam, setCam] = useState(true);
  const [liveRoom, setLiveRoom] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [localTrack, setLocalTrack] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    let active = true;
    const refreshRemoteTracks = () => {
      if (!active) return;
      const next = [];
      room.remoteParticipants.forEach(participant => {
        participant.trackPublications.forEach(publication => {
          if (publication.kind === Track.Kind.Video && publication.track) {
            next.push({ participant, track: publication.track });
          }
        });
      });
      setRemoteTracks(next);
    };
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.className = 'livekit-audio';
        document.body.appendChild(el);
      }
      refreshRemoteTracks();
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) track.detach().forEach(el => el.remove());
      refreshRemoteTracks();
    });
    room.on(RoomEvent.Disconnected, () => {
      document.querySelectorAll('.livekit-audio').forEach(el => el.remove());
    });
    room.on(RoomEvent.ParticipantDisconnected, refreshRemoteTracks);
    meetingApi.token(id)
      .then(credentials => room.connect(credentials.url, credentials.token))
      .then(async () => {
        if (!active) return;
        setLiveRoom(room);
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
        setLocalTrack(room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack || null);
      })
      .catch(reason => active && setError(reason.message || 'Could not connect to the meeting service.'));
    return () => {
      active = false;
      room.disconnect();
    };
  }, [id]);

  const toggleMic = async () => {
    const enabled = !mic;
    setMic(enabled);
    await liveRoom?.localParticipant.setMicrophoneEnabled(enabled);
  };
  const toggleCam = async () => {
    const enabled = !cam;
    setCam(enabled);
    await liveRoom?.localParticipant.setCameraEnabled(enabled);
    setLocalTrack(enabled ? liveRoom?.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack || null : null);
  };
  const toggleScreen = async () => {
    if (!liveRoom) return;
    const enabled = !sharing;
    try {
      await liveRoom.localParticipant.setScreenShareEnabled(enabled);
      setSharing(enabled);
    } catch (reason) { setError(reason.message || 'Screen share could not start.'); }
  };
  const participants = remoteTracks.length + (liveRoom ? 1 : 0);
  return <div className="meeting-room"><header><button onClick={()=>navigate('/meetings')}><ArrowLeft /></button><div><b>TaskFlow meeting</b><small><i /> {liveRoom ? 'Live' : error ? 'Service unavailable' : 'Connecting…'} · {id}</small></div><span><Users /> {participants} participants</span></header>{error && <div className="meeting-error">{error}</div>}<div className="video-grid"><MediaTile featured track={localTrack} name={`${session.name} (you)`} fallback={session.avatar}/>{remoteTracks.slice(0, 3).map(({ participant, track }) => <MediaTile key={`${participant.identity}-${track.sid}`} track={track} name={participant.name || participant.identity} fallback={avatar(participant.identity)} />)}{remoteTracks.length === 0 && <div className="video-tile waiting-tile"><Users/><span>Waiting for participants…</span></div>}</div><div className="call-controls"><button className={!mic?'off':''} onClick={toggleMic}>{mic?<Mic/>:<MicOff/>}</button><button className={!cam?'off':''} onClick={toggleCam}>{cam?<Camera/>:<VideoOff/>}</button><button className={sharing?'active':''} onClick={toggleScreen}><ScreenShare/></button><button><MessageSquare /></button><button className="leave" onClick={()=>navigate('/meetings')}><PhoneOff /></button></div></div>;
}

function Notifications({ notices, setNotices }) {
  const [tab,setTab]=useState('all');
  const navigate=useNavigate();
  const readAll = async () => {
    try {
      await notificationApi.readAll();
      setNotices(items => items.map(notice => ({ ...notice, unread: false, read: true })));
    } catch (error) { console.error(error); }
  };
  const visible=notices.filter(notice=>tab==='mentions'?notice.type==='MENTION':tab==='assigned'?notice.type==='ASSIGNED':true);
  return <div className="card notification-page"><div className="toolbar"><div className="filter-tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>All</button><button className={tab==='mentions'?'active':''} onClick={()=>setTab('mentions')}>Mentions</button><button className={tab==='assigned'?'active':''} onClick={()=>setTab('assigned')}>Assigned</button></div><button className="secondary-btn" onClick={readAll}><Check /> Mark all read</button></div>{visible.length === 0 && <div className="empty-state">You’re all caught up.</div>}{visible.map(n=>{const Icon=n.icon;return <button className={`notification-row ${n.unread?'unread':''}`} key={n.id} onClick={async()=>{if(n.unread){await notificationApi.read(n.id);setNotices(items=>items.map(item=>item.id===n.id?{...item,unread:false}:item))}if(n.actionUrl)navigate(n.actionUrl)}}><span><Icon /></span><div><b>{n.text}</b><small>{n.time}</small></div>{n.unread&&<i/>}<ArrowRight/></button>})}</div>;
}

function AvatarCropper({file,close,done}){
  const [src,setSrc]=useState(''),[zoom,setZoom]=useState(1);const imageRef=useRef(null);
  useEffect(()=>{const reader=new FileReader();reader.onload=()=>setSrc(reader.result);reader.readAsDataURL(file)},[file]);
  const crop=()=>{const image=imageRef.current,canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');const scale=Math.max(512/image.naturalWidth,512/image.naturalHeight)*zoom;const w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,(512-w)/2,(512-h)/2,w,h);canvas.toBlob(blob=>done(new File([blob],'avatar.jpg',{type:'image/jpeg'})),'image/jpeg',.9)};
  return <Modal close={close} className="crop-modal"><div className="modal-top"><h2>Crop photo</h2><button onClick={close}><X/></button></div><div className="crop-stage"><img ref={imageRef} src={src} style={{transform:`scale(${zoom})`}}/></div><label>Zoom<input type="range" min="1" max="2.5" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label><div className="modal-actions"><button className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn" onClick={crop}><Check/>Use photo</button></div></Modal>
}

function MemberModal({member,close,save,notify}){
  const [form,setForm]=useState({firstName:member?.firstName||'',lastName:member?.lastName||'',username:member?.username||'',password:'',email:member?.email||'',githubUrl:member?.githubUrl||'',linkedinUrl:member?.linkedinUrl||'',avatarUrl:member?.avatarUrl||'',role:member?.role||'MEMBER'}),[cropFile,setCropFile]=useState(null),[uploading,setUploading]=useState(false);
  const upload=async file=>{setUploading(true);try{const media=await uploadApi(file,'taskflow/avatars');setForm(current=>({...current,avatarUrl:assetUrl(media.url)}));setCropFile(null)}catch(error){notify(error.message)}finally{setUploading(false)}};
  return <><Modal close={close}><div className="modal-top"><div><h2>{member?'Edit member':'Add a teammate'}</h2><p>Manage identity, role and profile links.</p></div><button onClick={close}><X/></button></div><form onSubmit={e=>{e.preventDefault();save(form)}}><div className="profile-edit"><img src={form.avatarUrl||avatar(form.username||'new')}/><label className="secondary-btn"><Camera/>{uploading?'Uploading…':'Choose & crop'}<input type="file" accept="image/*" hidden onChange={e=>setCropFile(e.target.files[0])}/></label></div><div className="task-editor-grid"><label>First name<input required value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></label><label>Last name<input required value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></label><label>Username<input required value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label><label>{member?'New password (optional)':'Temporary password'}<input required={!member} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option>MEMBER</option><option>ADMIN</option></select></label><label>GitHub<input value={form.githubUrl} onChange={e=>setForm({...form,githubUrl:e.target.value})} placeholder="https://github.com/…"/></label><label>LinkedIn<input value={form.linkedinUrl} onChange={e=>setForm({...form,linkedinUrl:e.target.value})} placeholder="https://linkedin.com/in/…"/></label></div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn"><Check/>{member?'Save member':'Create member'}</button></div></form></Modal>{cropFile&&<AvatarCropper file={cropFile} close={()=>setCropFile(null)} done={upload}/>}</>
}

function AdminUsers({ users, setUsers, notify }) {
  const [editing,setEditing]=useState(null),[query,setQuery]=useState('');
  const toggle=async user=>{try{const updated=userView(await userApi.update(user.id,{active:user.status!=='Active'}));setUsers(items=>items.map(item=>item.id===user.id?updated:item))}catch(error){notify(error.message)}};
  const save=async form=>{try{const result=editing?.id?await userApi.update(editing.id,form):await userApi.create(form);const updated=userView(result);setUsers(items=>editing?.id?items.map(item=>item.id===updated.id?updated:item):[...items,updated]);setEditing(null);notify(editing?.id?'Member updated':'New member added')}catch(error){notify(error.message)}};
  const visible=users.filter(user=>`${user.name} ${user.username} ${user.email||''}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="admin-summary"><Metric icon={Users} label="Total members" value={users.length} trend="Team" tone="lime" note="workspace members"/><Metric icon={ShieldCheck} label="Administrators" value={users.filter(user=>user.role!=='MEMBER').length} trend="Secure" tone="violet" note="workspace roles"/><Metric icon={Activity} label="Active" value={users.filter(user=>user.status==='Active').length} trend="Live" tone="blue" note="enabled accounts"/></div><div className="card users-card"><div className="toolbar"><div className="table-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people…"/></div><button className="primary-btn" onClick={()=>setEditing({})}><UserPlus/>Add member</button></div><div className="users-table"><div className="users-head"><span>Member</span><span>Role</span><span>Status</span><span>Links</span><span/></div>{visible.map(user=><div className="user-table-row" key={user.id}><span><img src={user.avatar}/><span><b>{user.name}</b><small>@{user.username} · {user.email||user.title}</small></span></span><span className="role-pill">{user.role.replace('_',' ')}</span><button className={`status ${user.status.toLowerCase()}`} onClick={()=>toggle(user)}><i/>{user.status}</button><span className="user-links">{user.githubUrl&&<a href={user.githubUrl} target="_blank">GitHub</a>}{user.linkedinUrl&&<a href={user.linkedinUrl} target="_blank">LinkedIn</a>}</span><button onClick={()=>setEditing(user)}><Pencil/></button></div>)}</div></div><AnimatePresence>{editing&&<MemberModal member={editing.id?editing:null} close={()=>setEditing(null)} save={save} notify={notify}/>}</AnimatePresence></>;
}

function SettingsPage({ theme, setTheme, session, setSession, notify }) {
  const [tab,setTab]=useState('profile'),[cropFile,setCropFile]=useState(null);
  const [form, setForm] = useState({ firstName: session.firstName || '', lastName: session.lastName || '', username: session.username || '', email:session.email||'', githubUrl: session.githubUrl || '', linkedinUrl: session.linkedinUrl || '',avatarUrl:session.avatarUrl||'',notificationsEnabled:session.notificationsEnabled!==false,currentPassword:'',newPassword:'' });
  const save = async () => {
    try {
      const next = userView(await authApi.updateMe(form));
      setSession(next);
      localStorage.setItem('taskflow_session', JSON.stringify(next));
      notify('Profile saved');
    } catch (error) { notify(error.message); }
  };
  const upload=async file=>{try{const media=await uploadApi(file,'taskflow/avatars');setForm(current=>({...current,avatarUrl:assetUrl(media.url)}));setCropFile(null)}catch(error){notify(error.message)}};
  return <><div className="settings-grid"><aside className="card settings-nav"><button className={tab==='profile'?'active':''} onClick={()=>setTab('profile')}><Users/>Profile</button><button className={tab==='notifications'?'active':''} onClick={()=>setTab('notifications')}><Bell/>Notifications</button><button className={tab==='security'?'active':''} onClick={()=>setTab('security')}><ShieldCheck/>Security</button><button className={tab==='appearance'?'active':''} onClick={()=>setTab('appearance')}><Sparkles/>Appearance</button></aside><section className="card settings-card">{tab==='profile'&&<><h2>Profile details</h2><p>This is how teammates see you across TaskFlow.</p><div className="profile-edit"><img src={form.avatarUrl||session.avatar}/><label className="secondary-btn"><Camera/>Change & crop<input hidden type="file" accept="image/*" onChange={e=>setCropFile(e.target.files[0])}/></label></div><div className="form-grid"><label>First name<input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></label><label>Last name<input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></label><label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label><label>Email<input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>GitHub<input value={form.githubUrl} onChange={e=>setForm({...form,githubUrl:e.target.value})}/></label><label>LinkedIn<input value={form.linkedinUrl} onChange={e=>setForm({...form,linkedinUrl:e.target.value})}/></label></div></>}{tab==='notifications'&&<><h2>Notifications</h2><p>Choose whether TaskFlow should create inbox updates for your account.</p><label className="setting-toggle"><span><b>Workspace notifications</b><small>Mentions, assignments and meeting reminders</small></span><input type="checkbox" checked={form.notificationsEnabled} onChange={e=>setForm({...form,notificationsEnabled:e.target.checked})}/></label></>}{tab==='security'&&<><h2>Security</h2><p>Change your password securely.</p><div className="form-grid"><label>Current password<input type="password" value={form.currentPassword} onChange={e=>setForm({...form,currentPassword:e.target.value})}/></label><label>New password<input type="password" value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})}/></label></div></>}{tab==='appearance'&&<><h2>Appearance</h2><p>Pick the workspace theme that feels right.</p><div className="theme-choice"><button className={theme==='dark'?'active':''} onClick={()=>{setTheme('dark');setForm({...form,theme:'dark'})}}><Moon/>Dark</button><button className={theme==='light'?'active':''} onClick={()=>{setTheme('light');setForm({...form,theme:'light'})}}><Sun/>Light</button></div></>}<button className="primary-btn settings-save" onClick={save}><Check/>Save changes</button></section></div>{cropFile&&<AvatarCropper file={cropFile} close={()=>setCropFile(null)} done={upload}/>}</>;
}
function NotFound(){const navigate=useNavigate();return <div className="not-found"><span>404</span><h2>This flow went off course.</h2><p>The page you’re looking for moved, or never existed.</p><button className="primary-btn" onClick={()=>navigate('/')}><ArrowLeft/>Back to overview</button></div>}

createRoot(document.getElementById('root')).render(<App />);
