const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbac');

const notifications = [
  { id: 'n1', title: 'Khuyến mãi hè 2026', body: 'Giảm 30% tất cả tour du lịch trong tháng 7!', target: 'all', status: 'sent', sentAt: '2026-07-01 09:00', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=60' },
  { id: 'n2', title: 'Điểm thưởng sắp hết hạn', body: 'Điểm thưởng của bạn sẽ hết hạn vào cuối tháng. Đổi ngay!', target: 'vip', status: 'sent', sentAt: '2026-06-28 14:30', image: '' },
  { id: 'n3', title: 'Tính năng mới: Chat nhóm', body: 'Bạn có thể tạo và tham gia nhóm chat cùng bạn đồng hành!', target: 'all', status: 'scheduled', sentAt: '2026-07-05 08:00', image: '' },
];

router.get('/', (req, res) => {
  const { msg = '' } = req.query;

  const historyRows = notifications.map(n => `
    <tr>
      <td style="font-weight:700;color:var(--text-primary)">${n.title}</td>
      <td style="font-size:12px;color:var(--text-muted);max-width:240px;">${n.body.substring(0,60)}${n.body.length>60?'...':''}</td>
      <td>
        <span class="badge-status ${n.target === 'all' ? 'active' : 'pending'}">
          ${n.target === 'all' ? 'Tất cả' : n.target === 'vip' ? 'VIP' : 'Một user'}
        </span>
      </td>
      <td><span class="badge-status ${n.status === 'sent' ? 'confirmed' : 'pending'}">${n.status === 'sent' ? 'Đã gửi' : 'Hẹn giờ'}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${n.sentAt}</td>
    </tr>`).join('');

  const body = `
    ${msg === 'sent' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã gửi thông báo thành công!</div>` : ''}

    <div class="page-title-row">
      <div class="page-title">
        <h1>Gửi Push Notification</h1>
        <p>Soạn và gửi thông báo đẩy đến thiết bị người dùng</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
      <!-- Form soạn -->
      <div class="data-card" style="padding:24px;">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:18px;display:flex;align-items:center;gap:8px;">
          <i data-lucide="bell" style="width:16px;height:16px;color:var(--accent)"></i>
          Soạn thông báo mới
        </div>
        <form method="POST" action="/notifications/send" style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Tiêu đề *</label>
            <input name="title" required maxlength="100" placeholder="Tiêu đề thông báo..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Nội dung *</label>
            <textarea name="body" rows="3" required maxlength="300" placeholder="Nội dung thông báo..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;resize:vertical;"></textarea>
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">URL Hình ảnh (tuỳ chọn)</label>
            <input name="image" type="url" placeholder="https://..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Đối tượng</label>
              <select name="target" style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
                <option value="all">Tất cả người dùng</option>
                <option value="vip">Hạng VIP (Vàng+)</option>
                <option value="new">Người dùng mới</option>
              </select>
            </div>
            <div>
              <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Thời gian</label>
              <select name="schedule" id="scheduleType" style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
                <option value="now">Gửi ngay</option>
                <option value="scheduled">Hẹn giờ</option>
              </select>
            </div>
          </div>
          <div id="scheduleInput" style="display:none;">
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Thời điểm gửi</label>
            <input type="datetime-local" name="sendAt" style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;color-scheme:dark;">
          </div>
          <button type="submit" class="btn btn-primary" style="align-self:flex-end;gap:8px;">
            <i data-lucide="send" style="width:14px;height:14px"></i> Gửi thông báo
          </button>
        </form>
      </div>

      <!-- Preview -->
      <div>
        <div class="data-card" style="padding:24px;margin-bottom:16px;">
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
            <i data-lucide="smartphone" style="width:16px;height:16px;color:var(--purple)"></i>
            Preview thông báo
          </div>
          <div style="background:var(--bg-input);border-radius:12px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;">
            <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i data-lucide="globe" style="width:16px;height:16px;color:white"></i>
            </div>
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:700;color:var(--text-primary)" id="prevTitle">Tiêu đề thông báo</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.5" id="prevBody">Nội dung thông báo sẽ hiển thị ở đây...</div>
            </div>
            <div style="font-size:10px;color:var(--text-dim);flex-shrink:0;">Vừa xong</div>
          </div>
        </div>

        <!-- Thống kê -->
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;">
          <div class="stat-card blue" style="margin:0;">
            <div class="stat-card-value">${notifications.length}</div>
            <div class="stat-card-label">Tổng đã gửi</div>
          </div>
          <div class="stat-card purple" style="margin:0;">
            <div class="stat-card-value">${notifications.filter(n=>n.status==='scheduled').length}</div>
            <div class="stat-card-label">Đang hẹn giờ</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lịch sử -->
    <div class="data-card">
      <div class="data-card-header">
        <span class="data-card-title">Lịch sử thông báo</span>
      </div>
      <table class="data-table">
        <thead><tr><th>Tiêu đề</th><th>Nội dung</th><th>Đối tượng</th><th>Trạng thái</th><th>Thời gian</th></tr></thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>

    <script>
      // Preview real-time
      const titleInput = document.querySelector('input[name="title"]');
      const bodyInput  = document.querySelector('textarea[name="body"]');
      if (titleInput) titleInput.addEventListener('input', e => { document.getElementById('prevTitle').textContent = e.target.value || 'Tiêu đề thông báo'; });
      if (bodyInput)  bodyInput.addEventListener('input',  e => { document.getElementById('prevBody').textContent  = e.target.value || 'Nội dung thông báo...'; });

      // Hẹn giờ toggle
      document.getElementById('scheduleType').addEventListener('change', function() {
        document.getElementById('scheduleInput').style.display = this.value === 'scheduled' ? 'block' : 'none';
      });
    </script>
  `;
  res.render('layouts/main', { title: 'Push Notification', body });
});

router.post('/send', requirePermission('notifications.write'), (req, res) => {
  const { title, body: msgBody, image, target, schedule } = req.body;
  notifications.unshift({
    id: 'n' + Date.now(), title, body: msgBody, image, target,
    status: schedule === 'scheduled' ? 'scheduled' : 'sent',
    sentAt: new Date().toLocaleString('vi-VN'),
  });
  res.redirect('/notifications?msg=sent');
});

module.exports = router;
