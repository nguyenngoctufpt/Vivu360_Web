const express = require('express');
const router = express.Router();
const { getDashboardStats, getUsers, mockDestinations, mockTickets } = require('../config/firebase');
const { getAllMongoPosts, getAllMongoGroups, getPostsByUser, getMongoUsers } = require('../config/mongodbApi');

// ─── Health & Ping ─────────────────────────────────────────
router.all('/health', (req, res) => {
  res.json({ success: true, status: 'online', service: 'Vivu360 Web API', timestamp: new Date() });
});

router.all('/ping', (req, res) => {
  res.json({ success: true, status: 'pong', timestamp: new Date() });
});

// ─── Auth API ──────────────────────────────────────────────
router.post(['/auth/login', '/login'], (req, res) => {
  const { email, password } = req.body || {};
  res.json({
    success: true,
    message: 'Đăng nhập thành công',
    token: 'vivu360_demo_token_' + Date.now(),
    user: { email: email || 'admin@vivu360.vn', name: 'Vivu360 Admin', role: 'super_admin' }
  });
});

router.post(['/auth/register', '/register'], (req, res) => {
  res.json({ success: true, message: 'Đăng ký tài khoản thành công', user: req.body });
});

router.get(['/auth/me', '/me'], (req, res) => {
  res.json({
    success: true,
    user: { email: 'admin@vivu360.vn', name: 'Vivu360 Admin', role: 'super_admin', permissions: ['*'] }
  });
});

// ─── Stats API ─────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Destinations & Tours API ──────────────────────────────
router.get(['/destinations', '/tours'], (req, res) => {
  const { type = '', region = '', zone = '' } = req.query;
  let filtered = mockDestinations;
  if (type) filtered = filtered.filter(d => d.type === type);
  if (region) filtered = filtered.filter(d => d.region.toLowerCase().includes(region.toLowerCase()));
  if (zone) filtered = filtered.filter(d => d.zone === zone);
  
  res.json({ success: true, total: filtered.length, data: filtered });
});

router.get(['/destinations/:id', '/tours/:id'], (req, res) => {
  const dest = mockDestinations.find(d => d.id === req.params.id);
  if (!dest) {
    return res.status(404).json({ success: false, message: 'Điểm đến không tồn tại', id: req.params.id });
  }
  res.json({ success: true, data: dest });
});

router.post('/destinations', (req, res) => {
  const newDest = { id: 'd' + Date.now(), ...req.body };
  mockDestinations.unshift(newDest);
  res.status(201).json({ success: true, message: 'Đã tạo điểm đến mới', data: newDest });
});

// ─── Users API ─────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ success: true, total: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users/:uid', async (req, res) => {
  try {
    const users = await getUsers();
    const user = users.find(u => u.uid === req.params.uid || u.id === req.params.uid);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users/sync', (req, res) => {
  res.json({ success: true, message: 'Đã đồng bộ dữ liệu người dùng thành công', data: req.body });
});

router.patch('/users/:uid/access', (req, res) => {
  res.json({ success: true, message: 'Đã cập nhật trạng thái truy cập', uid: req.params.uid, status: req.body?.status });
});

// ─── Posts API ─────────────────────────────────────────────
router.get('/posts', async (req, res) => {
  try {
    const posts = await getAllMongoPosts();
    res.json({ success: true, total: posts.length, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/posts/user/:uid', async (req, res) => {
  try {
    const posts = await getPostsByUser(req.params.uid);
    res.json({ success: true, total: posts.length, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Chat & Groups API ─────────────────────────────────────
router.get(['/chat/groups', '/groups'], async (req, res) => {
  try {
    const groups = await getAllMongoGroups();
    res.json({ success: true, total: groups.length, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Tickets API ───────────────────────────────────────────
router.get('/tickets', (req, res) => {
  res.json({ success: true, total: mockTickets.length, data: mockTickets });
});

router.post('/tickets/:code/confirm', (req, res) => {
  const ticket = mockTickets.find(t => t.code === req.params.code);
  if (ticket) ticket.status = 'confirmed';
  res.json({ success: true, message: 'Đã xác nhận vé', code: req.params.code });
});

router.post('/tickets/:code/cancel', (req, res) => {
  const ticket = mockTickets.find(t => t.code === req.params.code);
  if (ticket) ticket.status = 'cancelled';
  res.json({ success: true, message: 'Đã hủy vé', code: req.params.code });
});

// ─── Banners & Notifications API ───────────────────────────
router.get('/banners', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'b1', title: 'Khuyến mãi Du lịch Hè Vivu360', active: true, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e' },
      { id: 'b2', title: 'Trải nghiệm Tour 360° Đỉnh Fansipan', active: true, image: 'https://images.unsplash.com/photo-1528127269322-539801943592' },
    ]
  });
});

router.get('/notifications', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'n1', title: 'Chào mừng bạn đến với Vivu360!', body: 'Khám phá ngay hơn 15+ điểm đến 360°', createdAt: new Date() },
    ]
  });
});

// ─── Config API ────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      appName: 'DATN_Vivu360',
      version: '1.2.0',
      maintenance: false,
      aiEnabled: true,
      maxUploadMB: 50,
    }
  });
});

// ─── Catch-all Fallback for Unknown API Endpoints ─────────
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Lỗi: Đường dẫn API không tồn tại hoặc sai phương thức HTTP',
    requestedUrl: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/api/health', '/api/stats', '/api/destinations', '/api/users',
      '/api/posts', '/api/chat/groups', '/api/tickets', '/api/banners',
      '/api/notifications', '/api/config', '/api/auth/me'
    ]
  });
});

module.exports = router;
