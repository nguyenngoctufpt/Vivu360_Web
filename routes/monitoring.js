const express = require('express');
const { requirePermission } = require('../middleware/rbac');
const { getUsers } = require('../config/firebase');

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const logs = [
  { id: 'l1', level:'critical', message:'NullPointerException in TourDetailActivity', device:'iPhone 15 Pro', os:'iOS 17.4', appVersion:'2.1.3', userId:'u005', timestamp:'2026-07-01 22:14:03', resolved:false, stack:'java.lang.NullPointerException\n  at TourDetailActivity.onCreate(line 142)' },
  { id: 'l2', level:'warning',  message:'Network timeout when loading 360° images', device:'Samsung Galaxy S24', os:'Android 14', appVersion:'2.1.3', userId:'u002', timestamp:'2026-07-01 21:05:11', resolved:false, stack:'SocketTimeoutException: timeout 30s\n  at ImageLoader.fetch(line 88)' },
  { id: 'l3', level:'info',     message:'User opened app from push notification', device:'Pixel 8', os:'Android 14', appVersion:'2.1.2', userId:'u003', timestamp:'2026-07-01 20:30:45', resolved:true, stack:'' },
  { id: 'l4', level:'critical', message:'Crash: OutOfMemoryError loading panorama', device:'iPhone 13', os:'iOS 16.7', appVersion:'2.1.1', userId:'u001', timestamp:'2026-06-30 18:44:22', resolved:false, stack:'java.lang.OutOfMemoryError: GC overhead limit exceeded\n  at PanoramaRenderer.render(line 324)' },
  { id: 'l5', level:'warning',  message:'Firebase token refresh failed', device:'OPPO Reno 10', os:'Android 13', appVersion:'2.1.3', userId:'u008', timestamp:'2026-06-30 14:12:09', resolved:true, stack:'FirebaseException: token expired' },
];

let feedbacks = [];

// ══════════════════════════════════════════
// LOGS ROUTER (mount tại /logs)
// ══════════════════════════════════════════
const logsRouter = express.Router();

logsRouter.get('/', requirePermission('logs'), (req, res) => {
  const { level = '', resolved = '', msg = '' } = req.query;
  const filtered = logs.filter(l => {
    const matchLevel = !level || l.level === level;
    const matchResolved = resolved === '' || (resolved === '1' ? l.resolved : !l.resolved);
    return matchLevel && matchResolved;
  });

  const levelColor = { critical:'var(--red)', warning:'var(--yellow)', info:'var(--cyan)' };
  const levelBg    = { critical:'var(--red-bg)', warning:'var(--yellow-bg)', info:'var(--cyan-bg)' };

  const rows = filtered.map(l => `
    <tr id="log-${l.id}">
      <td>
        <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:100px;font-size:10px;font-weight:800;background:${levelBg[l.level]};color:${levelColor[l.level]};text-transform:uppercase;">
          <i data-lucide="${l.level==='critical'?'alert-octagon':l.level==='warning'?'alert-triangle':'info'}" style="width:10px;height:10px"></i>
          ${l.level}
        </span>
      </td>
      <td>
        <div style="font-weight:600;color:var(--text-primary);font-size:12px;max-width:240px;">${l.message}</div>
        ${l.stack ? `<div style="font-size:10px;color:var(--text-dim);font-family:monospace;margin-top:4px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.stack.split('\\n')[0]}</div>` : ''}
      </td>
      <td>
        <div style="font-size:12px;color:var(--text-secondary)">${l.device}</div>
        <div style="font-size:10px;color:var(--text-dim)">${l.os} · v${l.appVersion}</div>
      </td>
      <td style="font-size:11px;color:var(--text-muted)">${l.timestamp}</td>
      <td>
        <span class="badge-status ${l.resolved ? 'confirmed' : 'pending'}">
          ${l.resolved ? 'Đã xử lý' : 'Chưa xử lý'}
        </span>
      </td>
      <td>
        <div class="action-btns">
          ${!l.resolved ? `
            <form method="POST" action="/logs/${l.id}/resolve" style="margin:0">
              <button type="submit" class="btn btn-icon" data-tooltip="Đánh dấu đã xử lý">
                <i data-lucide="check" style="width:14px;height:14px;color:var(--green)"></i>
              </button>
            </form>` : ''}
          <form method="POST" action="/logs/${l.id}/delete" style="margin:0">
            <button type="submit" class="btn btn-icon" data-tooltip="Xóa log">
              <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--red)"></i>
            </button>
          </form>
        </div>
      </td>
    </tr>`).join('');

  const body = `
    ${msg === 'updated' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã cập nhật!</div>` : ''}

    <div class="page-title-row">
      <div class="page-title"><h1>Error & Crash Logs</h1><p>Theo dõi lỗi xảy ra trên thiết bị người dùng</p></div>
      <form method="POST" action="/logs/clear" style="margin:0;">
        <button type="submit" class="btn btn-secondary btn-sm" style="gap:6px;">
          <i data-lucide="check-square" style="width:12px;height:12px"></i> Dọn log đã xử lý
        </button>
      </form>
    </div>

    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card red" style="margin:0;"><div class="stat-card-value">${logs.filter(l=>l.level==='critical'&&!l.resolved).length}</div><div class="stat-card-label">Critical chưa xử lý</div></div>
      <div class="stat-card yellow" style="margin:0;"><div class="stat-card-value">${logs.filter(l=>l.level==='warning').length}</div><div class="stat-card-label">Warnings</div></div>
      <div class="stat-card green" style="margin:0;"><div class="stat-card-value">${logs.filter(l=>l.resolved).length}</div><div class="stat-card-label">Đã xử lý</div></div>
      <div class="stat-card blue" style="margin:0;"><div class="stat-card-value">${logs.length}</div><div class="stat-card-label">Tổng logs</div></div>
    </div>

    <div class="data-card" style="margin-bottom:16px;padding:14px 20px;">
      <form method="GET" action="/logs" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Mức độ</label>
          <select name="level" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
            <option value="">Tất cả</option>
            <option value="critical" ${level==='critical'?'selected':''}>Critical</option>
            <option value="warning" ${level==='warning'?'selected':''}>Warning</option>
            <option value="info" ${level==='info'?'selected':''}>Info</option>
          </select>
        </div>
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Trạng thái</label>
          <select name="resolved" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
            <option value="">Tất cả</option>
            <option value="0" ${resolved==='0'?'selected':''}>Chưa xử lý</option>
            <option value="1" ${resolved==='1'?'selected':''}>Đã xử lý</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="filter" style="width:12px;height:12px"></i> Lọc</button>
        <a href="/logs" class="btn btn-secondary btn-sm"><i data-lucide="x" style="width:12px;height:12px"></i> Xóa lọc</a>
      </form>
    </div>

    <div class="data-card">
      <table class="data-table">
        <thead><tr><th>Mức độ</th><th>Lỗi</th><th>Thiết bị</th><th>Thời gian</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim)">Không có log nào</td></tr>'}</tbody>
      </table>
    </div>
  `;
  res.render('layouts/main', { title: 'Error Logs', body });
});

logsRouter.post('/:id/resolve', requirePermission('logs'), (req, res) => {
  const l = logs.find(l => l.id === req.params.id);
  if (l) l.resolved = true;
  res.redirect('/logs?msg=updated');
});
logsRouter.post('/:id/delete', requirePermission('logs'), (req, res) => {
  const idx = logs.findIndex(l => l.id === req.params.id);
  if (idx !== -1) logs.splice(idx, 1);
  res.redirect('/logs?msg=updated');
});
logsRouter.post('/clear', requirePermission('logs'), (req, res) => {
  const activeLogs = logs.filter(l => !l.resolved);
  logs.length = 0;
  logs.push(...activeLogs);
  res.redirect('/logs?msg=updated');
});

// ══════════════════════════════════════════
// FEEDBACK ROUTER (mount tại /feedback)
// ══════════════════════════════════════════
const feedbackRouter = express.Router();

feedbackRouter.get('/', requirePermission('feedback'), async (req, res) => {
  const { status = '', priority = '', msg = '' } = req.query;
  try {
    const apiBase = process.env.API_URL || 'http://localhost:3000';
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (priority) q.set('priority', priority);
    const url = `${apiBase}/api/feedback?${q.toString()}`;
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({ success: false }));
    const items = payload && payload.success && Array.isArray(payload.data) ? payload.data : [];

    // Load admin user list (same source as Users page) to get canonical avatars
    let userMap = new Map();
    try {
      const users = await getUsers();
      userMap = new Map(users.map(u => [u.uid, u]));
    } catch (e) {
      userMap = new Map();
    }

    const feedbackByDate = items.reduce((acc, f) => {
      const created = f.createdAt ? new Date(f.createdAt) : new Date();
      const dateKey = created.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(f);
      return acc;
    }, {});

    const sortedDates = Object.keys(feedbackByDate).sort((a, b) => {
      const parseDate = s => {
        const [day, month, year] = s.split('/');
        return new Date(`${year}-${month}-${day}`);
      };
      return parseDate(b) - parseDate(a);
    });

    const formatGroupLabel = (dateKey) => {
      const [day, month, year] = dateKey.split('/');
      const target = new Date(`${year}-${month}-${day}`);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isToday = target.toDateString() === today.toDateString();
      const isYesterday = target.toDateString() === yesterday.toDateString();
      if (isToday) return 'Hôm nay';
      if (isYesterday) return 'Hôm qua';
      return target.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const rows = sortedDates.map(dateKey => {
      const dayRows = feedbackByDate[dateKey].map(f => {
        const id = f._id || f.id;
        const ownerId = f.ownerId || '';
        const user = userMap.get(ownerId) || null;
        const name = user?.name || ownerId || (f.contact || '').slice(0, 24) || 'Người dùng';
        const contact = (f.contact && f.contact.trim()) || user?.phone || user?.email || '';
        const content = f.message || '';
        const date = f.createdAt ? new Date(f.createdAt).toLocaleString() : '';

        const seed = ownerId || contact || id;
        const avatarUrl = (user && user.avatar) ? user.avatar : `https://i.pravatar.cc/40?u=${encodeURIComponent(seed)}`;

        return `
          <tr id="feedback-${id}">
            <td style="min-width:220px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <img src="${avatarUrl}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;">
                <div>
                  <div style="font-weight:700;color:var(--text-primary)">${escapeHtml(name)}</div>
                </div>
              </div>
            </td>
            <td style="min-width:160px;color:var(--text-primary);font-weight:600">${escapeHtml(contact)}</td>
            <td style="color:var(--text-secondary);max-width:680px">${escapeHtml(content)}</td>
            <td style="white-space:nowrap;color:var(--text-dim);font-size:12px">${date}</td>
          </tr>`;
      }).join('');

      return `
        <tr class="feedback-date-group">
          <td colspan="4" style="padding:14px 16px;background:rgba(99,102,241,.06);color:var(--text-primary);font-weight:700;letter-spacing:.5px;">${formatGroupLabel(dateKey)}</td>
        </tr>
        ${dayRows}`;
    }).join('');

    const cards = `
      <div class="data-card">
        <table class="data-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Liên hệ</th>
              <th>Nội dung</th>
              <th>Ngày gửi</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-dim)">Không có feedback nào</td></tr>'}
          </tbody>
        </table>
      </div>`;

  const body = `
    ${msg === 'replied' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã gửi phản hồi!</div>` : ''}

    <div class="page-title-row">
      <div class="page-title"><h1>Feedback & Ticket</h1><p>Quản lý góp ý và báo cáo lỗi từ người dùng</p></div>
    </div>

    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card yellow" style="margin:0;"><div class="stat-card-value">${items.filter(f=>f.status==='open').length}</div><div class="stat-card-label">Đang mở</div></div>
      <div class="stat-card red" style="margin:0;"><div class="stat-card-value">${items.filter(f=>f.priority==='high'&&f.status==='open').length}</div><div class="stat-card-label">Ưu tiên cao</div></div>
      <div class="stat-card green" style="margin:0;"><div class="stat-card-value">${items.filter(f=>f.status==='resolved').length}</div><div class="stat-card-label">Đã giải quyết</div></div>
    </div>

    <div class="data-card" style="margin-bottom:16px;padding:14px 20px;">
      <form method="GET" action="/feedback" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Trạng thái</label>
          <select name="status" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
            <option value="">Tất cả</option>
            <option value="open" ${status==='open'?'selected':''}>Đang mở</option>
            <option value="resolved" ${status==='resolved'?'selected':''}>Đã giải quyết</option>
          </select>
        </div>
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Ưu tiên</label>
          <select name="priority" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
            <option value="">Tất cả</option>
            <option value="high" ${priority==='high'?'selected':''}>Cao</option>
            <option value="low" ${priority==='low'?'selected':''}>Thường</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="filter" style="width:12px;height:12px"></i> Lọc</button>
        <a href="/feedback" class="btn btn-secondary btn-sm">Xóa lọc</a>
      </form>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;">${cards || '<div class="data-card" style="padding:48px;text-align:center;color:var(--text-dim)">Không có feedback nào</div>'}</div>
  `;
    res.render('layouts/main', { title: 'Feedback', body });
  } catch (error) {
    console.error('Failed to load feedbacks', error);
    res.render('layouts/main', { title: 'Feedback', body: '<div class="data-card" style="padding:24px;color:var(--text-dim)">Không thể tải dữ liệu phản hồi từ API.</div>' });
  }
});

feedbackRouter.post('/:id/reply', requirePermission('feedback'), async (req, res) => {
  try {
    const apiBase = process.env.API_URL || 'http://localhost:3000';
    const id = req.params.id;
    const reply = String(req.body.reply || '').trim();
    await fetch(`${apiBase}/api/feedback/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reply, status: 'resolved' }),
    });
    res.redirect('/feedback?msg=replied');
  } catch (error) {
    console.error('Failed to send reply', error);
    res.redirect('/feedback?msg=error');
  }
});

module.exports = { logsRouter, feedbackRouter };
