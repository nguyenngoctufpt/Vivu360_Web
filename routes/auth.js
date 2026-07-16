const express = require('express');
const router = express.Router();
const { ROLES } = require('../middleware/rbac');
const { upsertUser } = require('../config/firebase');

// ── Demo accounts — 7 roles × 4 groups ─────────────────
const ADMIN_ACCOUNTS = [
  // Group 1: System & Tech
  { email:'admin@vivu360.vn',   password:'admin123',    name:'Nguyễn Root',      role:'super_admin'    },
  { email:'dev@vivu360.vn',     password:'dev123',      name:'Trần Thanh Dev',   role:'developer'      },
  // Group 2: Operations & Content
  { email:'appmgr@vivu360.vn',  password:'appmgr123',   name:'Lê App Manager',   role:'app_manager'    },
  { email:'content@vivu360.vn', password:'content123',  name:'Phạm Content',     role:'content_manager'},
  // Group 3: User Support
  { email:'cs@vivu360.vn',      password:'cs123',       name:'Võ Helpdesk',      role:'helpdesk'       },
  { email:'mod@vivu360.vn',     password:'mod123',      name:'Đặng Moderator',   role:'moderator'      },
  // Group 4: Marketing & Growth
  { email:'mkt@vivu360.vn',     password:'mkt123',      name:'Hoàng Marketing',  role:'marketing'      },
  { email:'analyst@vivu360.vn', password:'analyst123',  name:'Lý Data Analyst',  role:'analyst'        },
];

// GET /login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { title: 'Đăng nhập', error: null, accounts: ADMIN_ACCOUNTS, ROLES });
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const acc = ADMIN_ACCOUNTS.find(a => a.email === email && a.password === password);
  if (acc) {
    const roleDef = ROLES[acc.role] || {};
    const syncedUser = await upsertUser({
      email: acc.email,
      name: acc.name,
      phone: '',
      createdAt: new Date(),
      status: 'active',
      rank: 'Đồng',
      points: 0,
    });

    req.session.user = {
      uid:        syncedUser.uid,
      name:       acc.name,
      email:      acc.email,
      role:       acc.role,
      roleLabel:  roleDef.label  || acc.role,
      roleColor:  roleDef.color  || '#64748b',
      roleBg:     roleDef.bgColor|| 'rgba(100,116,139,0.1)',
      roleIcon:   roleDef.icon   || 'user',
      roleGroup:  roleDef.group  || '',
      permissions: roleDef.permissions || [],
    };
    return res.redirect('/dashboard');
  }
  res.render('login', {
    title: 'Đăng nhập', error: 'Email hoặc mật khẩu không chính xác!',
    accounts: ADMIN_ACCOUNTS, ROLES,
  });
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email và mật khẩu là bắt buộc.' });
    }

    const user = await upsertUser({
      email,
      name: name || email.split('@')[0],
      phone,
      password,
      createdAt: new Date(),
    });

    return res.json({ success: true, message: 'Đã lưu người dùng vào danh sách admin.', user });
  } catch (error) {
    console.error('❌ Lỗi đăng ký/sync người dùng:', error.message);
    return res.status(500).json({ success: false, message: 'Không thể lưu người dùng.' });
  }
});

// POST /login-user
router.post('/login-user', async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email là bắt buộc.' });
    }

    const user = await upsertUser({
      email,
      name: name || email.split('@')[0],
      phone,
      createdAt: new Date(),
    });

    return res.json({ success: true, message: 'Đã đồng bộ người dùng đăng nhập.', user });
  } catch (error) {
    console.error('❌ Lỗi đồng bộ đăng nhập người dùng:', error.message);
    return res.status(500).json({ success: false, message: 'Không thể đồng bộ đăng nhập.' });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
