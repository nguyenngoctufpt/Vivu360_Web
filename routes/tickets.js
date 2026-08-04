const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { requirePermission } = require('../middleware/rbac');
const { getTickets, mockTickets } = require('../config/firebase');

function getStatusIcon(s) { return { confirmed:'check-circle', pending:'clock', cancelled:'x-circle' }[s] || 'help-circle'; }
function getStatusLabel(s) { return { confirmed:'Đã xác nhận', pending:'Chờ duyệt', cancelled:'Đã hủy' }[s] || s; }

router.get('/', async (req, res) => {
  const { q = '', status = '', from = '', to = '', msg = '' } = req.query;
  const activeFilters = [q, status, from, to].filter(Boolean).length;

  const tickets = await getTickets();

  const filtered = tickets.filter(t => {
    const matchQ = !q || String(t.code || '').toLowerCase().includes(q.toLowerCase()) ||
                       String(t.userName || '').toLowerCase().includes(q.toLowerCase()) ||
                       String(t.destination || '').toLowerCase().includes(q.toLowerCase());
    const matchS = !status || t.status === status;
    const matchFrom = !from || t.date >= from;
    const matchTo   = !to   || t.date <= to;
    return matchQ && matchS && matchFrom && matchTo;
  });

  const rows = filtered.map(t => `
    <tr>
      <td style="font-family:monospace;font-size:11px;color:var(--accent-light);font-weight:700">${t.code}</td>
      <td><div class="user-cell-name">${t.userName}</div></td>
      <td><div style="font-weight:600;color:var(--text-primary)">${t.destination}</div><div style="font-size:11px;color:var(--text-muted)">${t.region}</div></td>
      <td>${t.date}</td>
      <td style="text-align:center">${t.guests}</td>
      <td style="font-weight:700;color:var(--green)">${t.price}</td>
      <td>
        <span class="badge-status ${t.status}" id="status-${t.code}">
          <i data-lucide="${getStatusIcon(t.status)}" style="width:12px;height:12px"></i>
          ${getStatusLabel(t.status)}
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-icon" data-action="view-ticket-details"
            data-code="${t.code}"
            data-username="${t.userName}"
            data-destination="${t.destination}"
            data-region="${t.region}"
            data-date="${t.date}"
            data-guests="${t.guests}"
            data-price="${t.price}"
            data-status="${t.status}"
            data-created="${t.createdAt || t.date}"
            data-tooltip="Xem chi tiết">
            <i data-lucide="eye" style="width:14px;height:14px"></i>
          </button>
          ${t.status === 'pending' ? `
            <button class="btn btn-icon" data-action="confirm-ticket" data-code="${t.code}" data-tooltip="Xác nhận">
              <i data-lucide="check" style="width:14px;height:14px;color:var(--green)"></i>
            </button>
            <button class="btn btn-icon" data-action="cancel-ticket" data-code="${t.code}" data-tooltip="Hủy vé">
              <i data-lucide="x" style="width:14px;height:14px;color:var(--red)"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>`).join('');

  const body = `
    ${msg === 'updated' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Cập nhật trạng thái vé thành công!</div>` : ''}

    <div class="page-title-row">
      <div class="page-title">
        <h1>Quản lý vé đặt</h1>
        <p>Hiển thị ${filtered.length}/${mockTickets.length} vé${activeFilters ? ` · <span style="color:var(--accent);font-weight:700">${activeFilters} bộ lọc</span>` : ''}</p>
      </div>
      <a href="/tickets/export.xlsx" class="btn btn-secondary">
        <i data-lucide="download" style="width:14px;height:14px"></i> Xuất Excel
      </a>
    </div>

    <!-- Filter nâng cao -->
    <div class="data-card" style="margin-bottom:16px;padding:16px 20px;">
      <form method="GET" action="/tickets" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;min-width:180px;">
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Tìm kiếm</label>
          <input name="q" value="${q}" placeholder="Mã vé, tên, điểm đến..."
            style="width:100%;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
        </div>
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Trạng thái</label>
          <select name="status" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
            <option value="">Tất cả</option>
            <option value="confirmed" ${status==='confirmed'?'selected':''}>Đã xác nhận</option>
            <option value="pending" ${status==='pending'?'selected':''}>Chờ duyệt</option>
            <option value="cancelled" ${status==='cancelled'?'selected':''}>Đã hủy</option>
          </select>
        </div>
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Từ ngày</label>
          <input type="date" name="from" value="${from}" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;color-scheme:dark;">
        </div>
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Đến ngày</label>
          <input type="date" name="to" value="${to}" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;color-scheme:dark;">
        </div>
        <button type="submit" class="btn btn-primary"><i data-lucide="filter" style="width:13px;height:13px"></i> Lọc</button>
        ${activeFilters ? `<a href="/tickets" class="btn btn-secondary"><i data-lucide="x" style="width:13px;height:13px"></i> Xóa lọc</a>` : ''}
      </form>
    </div>

    <div class="data-card">
      <table class="data-table">
        <thead>
          <tr><th>Mã vé</th><th>Khách hàng</th><th>Điểm đến</th><th>Ngày đi</th><th>Khách</th><th>Giá</th><th>Trạng thái</th><th>Thao tác</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-dim)">Không tìm thấy kết quả</td></tr>'}</tbody>
      </table>
    </div>

    <script>
      document.querySelectorAll('[data-action="confirm-ticket"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.code;
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/tickets/' + code + '/confirm';
          document.body.appendChild(form);
          form.submit();
        });
      });

      document.querySelectorAll('[data-action="cancel-ticket"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.code;
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/tickets/' + code + '/cancel';
          document.body.appendChild(form);
          form.submit();
        });
      });
    </script>
  `;
  res.render('layouts/main', { title: 'Vé đặt', body });
});

// Export Excel
router.get('/export.xlsx', async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Vivu360';
  const ws = wb.addWorksheet('Vé đặt');
  ws.columns = [
    { header: 'Mã vé', key: 'code', width: 20 },
    { header: 'Khách hàng', key: 'userName', width: 20 },
    { header: 'Điểm đến', key: 'destination', width: 24 },
    { header: 'Khu vực', key: 'region', width: 16 },
    { header: 'Ngày đi', key: 'date', width: 14 },
    { header: 'Số khách', key: 'guests', width: 10 },
    { header: 'Giá', key: 'price', width: 16 },
    { header: 'Trạng thái', key: 'status', width: 16 },
    { header: 'Ngày tạo', key: 'createdAt', width: 14 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22c55e' } };
  ws.getRow(1).height = 22;
  const tickets = await getTickets();
  tickets.forEach(t => ws.addRow({ ...t, status: getStatusLabel(t.status) }));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=tickets.xlsx');
  await wb.xlsx.write(res);
  res.end();
});

// POST /tickets/:code/confirm
router.post('/:code/confirm', requirePermission('tickets.write'), (req, res) => {
  const ticket = mockTickets.find(t => t.code === req.params.code);
  if (ticket) {
    ticket.status = 'confirmed';
  }
  res.redirect('/tickets?msg=updated');
});

// POST /tickets/:code/cancel
router.post('/:code/cancel', requirePermission('tickets.write'), (req, res) => {
  const ticket = mockTickets.find(t => t.code === req.params.code);
  if (ticket) {
    ticket.status = 'cancelled';
  }
  res.redirect('/tickets?msg=updated');
});

module.exports = router;
