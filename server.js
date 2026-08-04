const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 4000;

// ─── Middleware ───────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'vivu360-admin-secret-key-v2',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));

const { postReports, getPendingReports } = require('./config/postReports');

// Inject session, path & post reports into all templates
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.pendingReports = getPendingReports();
  res.locals.pendingReportsCount = res.locals.pendingReports.length;
  next();
});

// ─── RBAC ────────────────────────────────────────────────
const { requireAuth, requireRole, requirePermission } = require('./middleware/rbac');

// ─── Routes ──────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const dashboardRoutes     = require('./routes/dashboard');
const analyticsRoutes     = require('./routes/analytics');
const destinationsRoutes  = require('./routes/destinations');
const ticketsRoutes       = require('./routes/tickets');
const usersRoutes         = require('./routes/users');
const postsRoutes         = require('./routes/posts');
const chatRoutes          = require('./routes/chat');
const notificationsRoutes = require('./routes/notifications');
const bannersRoutes       = require('./routes/banners');
const configRoutes        = require('./routes/config');
const adminsRoutes        = require('./routes/admins');
const apiRoutes           = require('./routes/api');

// Import monitoring — hỗ trợ cả 2 dạng export (object hoặc single router)
const monitoringModule = require('./routes/monitoring');
const logsRouter     = monitoringModule.logsRouter     || monitoringModule;
const feedbackRouter = monitoringModule.feedbackRouter || monitoringModule;

// ─── Mount Routes ────────────────────────────────────────

// Auth (login / logout)
app.use('/', authRoutes);

// Root redirect
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

// REST API Endpoints (/api & /api/v1)
app.use('/api/v1', apiRoutes);
app.use('/api',    apiRoutes);

// Dashboard
app.use('/dashboard', requireAuth, requirePermission('dashboard'), dashboardRoutes);

// Analytics & Statistical Map (/analytics & /map)
app.use('/analytics', requireAuth, requirePermission('dashboard'), analyticsRoutes);
app.use('/map',       requireAuth, requirePermission('dashboard'), analyticsRoutes);

// Destinations & Tours
app.use('/destinations', requireAuth, requirePermission('destinations'), destinationsRoutes);

// Tickets & Bookings
app.use('/tickets', requireAuth, requirePermission('tickets.read'), ticketsRoutes);

// Users
app.use('/users', requireAuth, requirePermission('users.read'), usersRoutes);

// Posts
app.use('/posts', requireAuth, requirePermission('posts'), postsRoutes);

// Chat
app.use('/chat', requireAuth, requirePermission('chat'), chatRoutes);

// Notifications
app.use('/notifications', requireAuth, requirePermission('notifications'), notificationsRoutes);

// Banners
app.use('/banners', requireAuth, requirePermission('banners'), bannersRoutes);

// Logs & Feedback (monitoring)
app.use('/logs',     requireAuth, logsRouter);
app.use('/feedback', requireAuth, feedbackRouter);

// Config
app.use('/config', requireAuth, requirePermission('config.remote'), configRoutes);

// Admins (super_admin only)
app.use('/admins', requireAuth, requireRole('super_admin'), adminsRoutes);

// ─── 404 Handler ─────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(404).json({ success: false, message: "Điểm cuối không tồn tại", path: req.originalUrl });
  }

  if (!req.session.user) return res.redirect('/login');
  res.status(404).render('layouts/main', {
    title: '404 — Không tìm thấy',
    body: `
      <div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:16px;">
        <div style="font-size:80px;font-weight:900;background:linear-gradient(135deg,#6366f1,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent">404</div>
        <p style="color:#6272a4;font-size:14px">Trang bạn tìm không tồn tại</p>
        <a href="/dashboard" style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border-radius:10px;font-weight:700;font-size:13px;">← Về Dashboard</a>
      </div>`,
  });
});

// ─── Start Server ─────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n  ⚡ Admin Vivu360 đang chạy tại:`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  ── Demo accounts ──────────────────────`);
  console.log(`  🟣 Super Admin  : admin@vivu360.vn    / admin123`);
  console.log(`  🩵 Developer/QA : dev@vivu360.vn      / dev123`);
  console.log(`  🟡 App Manager  : appmgr@vivu360.vn   / appmgr123`);
  console.log(`  🟢 Content Mgr  : content@vivu360.vn  / content123`);
  console.log(`  🔵 Helpdesk     : cs@vivu360.vn       / cs123`);
  console.log(`  🟠 Moderator    : mod@vivu360.vn      / mod123`);
  console.log(`  🩷 Marketing    : mkt@vivu360.vn      / mkt123`);
  console.log(`  ⚫ Analyst      : analyst@vivu360.vn  / analyst123\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n⚠️  Cổng ${PORT} đang được sử dụng bởi tiến trình khác.`);
    console.log(`👉 Web Admin vẫn đang chạy tại: http://localhost:${PORT}\n`);
  } else {
    console.error('❌ Lỗi server:', err);
  }
});

