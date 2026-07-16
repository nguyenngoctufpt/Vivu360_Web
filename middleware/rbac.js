/* ═══════════════════════════════════════════════════════════
   RBAC Middleware — Role-Based Access Control v2
   Admin Vivu360 — 4 Groups, 7 Roles
   ═══════════════════════════════════════════════════════════ */

// ── Định nghĩa tất cả Roles ──────────────────────────────
const ROLES = {
  super_admin: {
    label: 'Super Admin',
    group: 'System & Tech',
    level: 100,
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    dot: '#a855f7',
    icon: 'shield-check',
    description: 'Toàn quyền hệ thống, quản lý API keys và tài khoản admin',
    permissions: ['*'], // wildcard = everything
  },
  developer: {
    label: 'Developer / QA',
    group: 'System & Tech',
    level: 80,
    color: '#22d3ee',
    bgColor: 'rgba(34,211,238,0.1)',
    dot: '#22d3ee',
    icon: 'code-2',
    description: 'Xem logs, quản lý feature flags, môi trường staging',
    permissions: ['dashboard', 'logs', 'feature_flags', 'users.read', 'tickets.read', 'feedback.read'],
  },
  app_manager: {
    label: 'App Manager',
    group: 'Operations & Content',
    level: 60,
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
    dot: '#f59e0b',
    icon: 'settings-2',
    description: 'Quản lý cấu hình app, force update, maintenance mode',
    permissions: ['dashboard', 'config.remote', 'notifications', 'banners', 'users.read', 'tickets.read'],
  },
  content_manager: {
    label: 'Content Manager',
    group: 'Operations & Content',
    level: 50,
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.1)',
    dot: '#10b981',
    icon: 'file-edit',
    description: 'Quản lý nội dung, điểm đến, bài viết, AI prompt',
    permissions: ['dashboard', 'destinations', 'posts', 'banners', 'config.ai', 'tickets.read'],
  },
  helpdesk: {
    label: 'Helpdesk / CS',
    group: 'User Support',
    level: 30,
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.1)',
    dot: '#6366f1',
    icon: 'headphones',
    description: 'Hỗ trợ người dùng, xem thông tin, ban/unban, reset mật khẩu',
    permissions: ['dashboard', 'users.read', 'users.edit', 'users.ban', 'users.reset', 'feedback', 'tickets.read', 'tickets.write'],
  },
  moderator: {
    label: 'Moderator',
    group: 'User Support',
    level: 25,
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.1)',
    dot: '#f97316',
    icon: 'shield',
    description: 'Kiểm duyệt bài viết, xử lý report vi phạm cộng đồng',
    permissions: ['dashboard', 'posts', 'feedback', 'users.read', 'chat'],
  },
  marketing: {
    label: 'Marketing Admin',
    group: 'Marketing & Growth',
    level: 20,
    color: '#ec4899',
    bgColor: 'rgba(236,72,153,0.1)',
    dot: '#ec4899',
    icon: 'megaphone',
    description: 'Gửi push notification, quản lý banner, voucher, chiến dịch',
    permissions: ['dashboard', 'notifications', 'banners', 'users.read'],
  },
  analyst: {
    label: 'Data Analyst',
    group: 'Marketing & Growth',
    level: 10,
    color: '#64748b',
    bgColor: 'rgba(100,116,139,0.1)',
    dot: '#64748b',
    icon: 'bar-chart-2',
    description: 'Chỉ đọc: xem dashboard, biểu đồ thống kê, xuất báo cáo',
    permissions: ['dashboard', 'users.read', 'tickets.read'],
  },
};

// ── Permission Matrix (route → required permissions) ─────
const ROUTE_PERMISSIONS = {
  '/dashboard':            ['dashboard'],
  '/users':                ['users.read'],
  '/users/export.xlsx':    ['users.read'],
  '/tickets':              ['tickets.read'],
  '/tickets/export.xlsx':  ['tickets.read'],
  '/destinations':         ['destinations'],
  '/posts':                ['posts'],
  '/chat':                 ['chat'],
  '/notifications':        ['notifications'],
  '/banners':              ['banners'],
  '/logs':                 ['logs'],
  '/feedback':             ['feedback'],
  '/config':               ['config.remote', 'config.ai', 'feature_flags'], // any of these
  '/admins':               ['*'],  // super_admin only
};

// ── Helper: kiểm tra permission ──────────────────────────
function hasPermission(role, perm) {
  const roleDef = ROLES[role];
  if (!roleDef) return false;
  if (roleDef.permissions.includes('*')) return true; // super_admin
  // exact match hoặc prefix match (vd: 'users' covers 'users.read', 'users.ban')
  return roleDef.permissions.some(p =>
    p === perm || p === perm.split('.')[0] || perm.startsWith(p + '.')
  );
}

function hasAnyPermission(role, perms) {
  return perms.some(p => hasPermission(role, p));
}

// ── Middleware: yêu cầu đăng nhập ───────────────────────
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.redirect('/login');
  next();
}

// ── Middleware: yêu cầu role cụ thể (level-based) ───────
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.session?.user) return res.redirect('/login');
    const userRole = req.session.user.role;
    const userLevel = ROLES[userRole]?.level || 0;
    const minLevel  = ROLES[minRole]?.level  || 999;
    if (userLevel < minLevel) return forbidden(res, minRole, userRole);
    next();
  };
}

// ── Middleware: yêu cầu permission cụ thể ────────────────
function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.session?.user) return res.redirect('/login');
    const userRole = req.session.user.role;
    const hasAny = perms.some(perm => hasPermission(userRole, perm));
    if (!hasAny) return forbidden(res, perms.join(' hoặc '), userRole);
    next();
  };
}

// ── 403 Response ────────────────────────────────────────
function forbidden(res, required, currentRole) {
  const role = ROLES[currentRole] || {};
  return res.status(403).send(`
    <!DOCTYPE html><html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>403 — Không có quyền</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap">
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Inter,sans-serif;background:#050508;color:#f0f2ff;
          min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;}
        body::before{content:'';position:fixed;inset:0;
          background:radial-gradient(ellipse 70% 50% at 30% 30%,rgba(244,63,94,0.06) 0%,transparent 60%),
                     radial-gradient(ellipse 50% 40% at 80% 80%,rgba(99,102,241,0.05) 0%,transparent 60%);}
        .card{position:relative;z-index:1;text-align:center;padding:60px 48px;
          background:rgba(13,13,24,0.95);border:1px solid rgba(244,63,94,0.15);
          border-radius:24px;max-width:460px;width:90%;
          box-shadow:0 32px 80px rgba(0,0,0,0.6),0 0 40px rgba(244,63,94,0.08);}
        .icon{font-size:56px;margin-bottom:20px;display:block;}
        h1{font-size:22px;font-weight:900;margin-bottom:8px;color:#f0f2ff;}
        .sub{font-size:13px;color:#6272a4;line-height:1.7;margin-bottom:28px;}
        .role-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;
          border-radius:100px;font-size:11px;font-weight:700;margin-bottom:20px;
          background:${role.bgColor || 'rgba(100,116,139,0.1)'};
          color:${role.color || '#64748b'};
          border:1px solid ${role.color ? role.color + '33' : 'rgba(100,116,139,0.2)'};}
        a{display:inline-flex;align-items:center;gap:8px;padding:11px 24px;
          background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;
          border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;
          box-shadow:0 6px 20px rgba(99,102,241,0.3);}
        a:hover{opacity:0.9;transform:translateY(-1px);}
      </style>
    </head>
    <body>
      <div class="card">
        <span class="icon">🔒</span>
        <div class="role-badge">${role.icon ? '●' : ''} ${role.label || currentRole}</div>
        <h1>Không có quyền truy cập</h1>
        <p class="sub">
          Role <strong style="color:#f0f2ff">${role.label || currentRole}</strong> của bạn
          không có quyền thực hiện hành động này.<br>
          Liên hệ <strong style="color:#a855f7">Super Admin</strong> để được cấp quyền.
        </p>
        <a href="/dashboard">← Về Dashboard</a>
      </div>
    </body></html>
  `);
}

module.exports = { requireAuth, requireRole, requirePermission, hasPermission, hasAnyPermission, ROLES, forbidden };
