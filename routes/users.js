const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { requirePermission } = require('../middleware/rbac');
const {
  getUsers,
  resetUserPassword,
} = require('../config/firebase');


// ── GET /users ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { q = '', status = '', msg = '' } = req.query;

  const users = await getUsers();

  const filtered = users.filter(u => {
    const matchQ = !q || (u.name && u.name.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = !status || u.status === status;
    return matchQ && matchStatus;
  });

  const activeFilters = [q, status].filter(Boolean).length;

  const rows = filtered.map(u => `
    <tr id="row-${u.uid}" data-user-name="${encodeURIComponent(u.name || '')}"
      data-user-status="${u.status || ''}">
      <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${u.uid}</td>
      <td>
        <div class="user-cell">
          <img src="${u.avatar}" alt="${u.name}" loading="lazy">
          <div class="user-cell-info">
            <div class="user-cell-name">${u.name}</div>
            <div class="user-cell-email">${u.email}</div>
          </div>
        </div>
      </td>
      <td>${u.phone}</td>
      <td style="font-weight:700;color:var(--accent-light)">${u.points.toLocaleString()}</td>
      <td>
        <span class="badge-status ${u.status}" id="status-${u.uid}">
          <i data-lucide="${u.status === 'active' ? 'check-circle' : 'lock'}" style="width:12px;height:12px"></i>
          ${u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
        </span>
      </td>
      <td>${u.createdAt}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-icon" data-tooltip="Xem chi tiết"
            data-action="view-user"
            data-uid="${u.uid}" data-name="${u.name}" data-email="${u.email}"
            data-phone="${u.phone}" data-rank="${u.rank}" data-points="${u.points}"
            data-status="${u.status}" data-created="${u.createdAt}" data-avatar="${u.avatar}">
            <i data-lucide="eye" style="width:14px;height:14px"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  const totalActive  = users.filter(u => u.status === 'active').length;
  const totalLocked  = users.filter(u => u.status !== 'active').length;

  const body = `
     
    ${msg === 'updated' ? `<div class="alert-bar green"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã cập nhật thông tin thành công.</div>` : ''}
    ${msg === 'deleted' ? `<div class="alert-bar green"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã xóa tài khoản thành công khỏi hệ thống.</div>` : ''}

    <div class="page-title-row">
      <div class="page-title">
        <h1>Quản lý người dùng</h1>
        <p>Hiển thị <strong>${filtered.length}</strong>/${users.length} người dùng
          ${activeFilters ? `<span style="color:var(--accent);font-weight:700"> · ${activeFilters} bộ lọc đang bật</span>` : ''}
          <span id="searchHint" style="color:var(--accent-light);font-weight:700;margin-left:6px;"></span>
        </p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <a href="/users/export.xlsx" class="btn btn-secondary">
          <i data-lucide="download" style="width:14px;height:14px"></i> Xuất Excel
        </a>
      </div>
    </div>

    <!-- Quick Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px;">
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;gap:12px;transition:var(--transition);"
           onmouseover="this.style.borderColor='var(--border-hover)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="width:36px;height:36px;border-radius:10px;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i data-lucide="users" style="width:16px;height:16px;color:var(--accent-light);"></i>
        </div>
        <div>
          <div style="font-size:20px;font-weight:900;color:var(--text-primary);letter-spacing:-0.5px;">${users.length}</div>
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;">Tổng cộng</div>
        </div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;gap:12px;transition:var(--transition);"
           onmouseover="this.style.borderColor='var(--border-hover)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="width:36px;height:36px;border-radius:10px;background:var(--green-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--green);"></i>
        </div>
        <div>
          <div style="font-size:20px;font-weight:900;color:var(--text-primary);letter-spacing:-0.5px;">${totalActive}</div>
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;">Hoạt động</div>
        </div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;gap:12px;transition:var(--transition);"
           onmouseover="this.style.borderColor='var(--border-hover)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="width:36px;height:36px;border-radius:10px;background:var(--red-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i data-lucide="lock" style="width:16px;height:16px;color:var(--red);"></i>
        </div>
        <div>
          <div style="font-size:20px;font-weight:900;color:var(--text-primary);letter-spacing:-0.5px;">${totalLocked}</div>
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;">Đã khóa</div>
        </div>
      </div>
    </div>

    <!-- Filter -->
    <div class="data-card" style="margin-bottom:14px;padding:14px 18px;">
      <form method="GET" action="/users" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;min-width:200px;">
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Tìm kiếm</label>
          <div style="position:relative;">
            <i data-lucide="search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:13px;height:13px;color:var(--text-muted)"></i>
            <input id="userNameFilter" name="q" value="${q}" list="userNameSuggestions"
              autocomplete="off" placeholder="Nhập tên người dùng..."
              style="width:100%;padding:8px 12px 8px 32px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;transition:var(--transition);"
              onfocus="this.style.borderColor='var(--border-active)';this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)'"
              onblur="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
            <datalist id="userNameSuggestions">
              ${users.map(u => `<option value="${u.name || ''}"></option>`).join('')}
            </datalist>
          </div>
        </div>
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Trạng thái</label>
          <select id="userStatusFilter" name="status" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
            <option value="" ${!status?'selected':''}>Tất cả</option>
            <option value="active"  ${status==='active'?'selected':''}>✓ Hoạt động</option>
            <option value="locked"  ${status==='locked'?'selected':''}>⊘ Đã khóa</option>
          </select>
        </div>

        <button type="submit" class="btn btn-primary">
          <i data-lucide="filter" style="width:13px;height:13px"></i> Lọc
        </button>
        ${activeFilters ? `<a href="/users" class="btn btn-secondary"><i data-lucide="x" style="width:13px;height:13px"></i> Xóa lọc</a>` : ''}
      </form>
    </div>

    <div class="data-card">
      <div style="overflow-x:auto;">
        <table class="data-table" id="usersTable">
          <thead>
            <tr>
              <th style="width:80px;">UID</th>
              <th>Người dùng</th>
              <th>Điện thoại</th>
              <th>Điểm</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th style="text-align:right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim)"><i data-lucide="search" style="width:20px;height:20px;display:block;margin:0 auto 8px;"></i>Không tìm thấy kết quả nào</td></tr>'}</tbody>
        </table>
      </div>
      <!-- Pagination -->
      <div id="paginationBar" style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-top:1px solid var(--border);flex-wrap:wrap;gap:10px;">
        <span id="pageInfo" style="font-size:11px;color:var(--text-muted);font-weight:600;"></span>
        <div style="display:flex;gap:5px;" id="pageButtons"></div>
      </div>
    </div>

    <!-- ── MODAL XEM CHI TIẾT TÀI KHOẢN ── -->
    <div id="viewModal" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:540px;">
        <!-- Header -->
        <div class="modal-header" style="background:var(--accent-glow2);border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:14px;">
            <img id="vAvatar" src="" style="width:56px;height:56px;border-radius:14px;object-fit:cover;border:2px solid var(--accent-light);">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <div id="vName" style="font-size:18px;font-weight:800;color:var(--text-primary)"></div>
                <span id="vLevelBadge" style="font-size:10px;padding:2px 8px;border-radius:100px;background:rgba(99,102,241,0.2);color:var(--accent-light);font-weight:700;">Cấp 1</span>
              </div>
              <div id="vEmail" style="font-size:12px;color:var(--text-muted);margin-top:2px;"></div>
            </div>
          </div>
          <button class="btn btn-icon modal-close" data-modal="viewModal"><i data-lucide="x" style="width:16px;height:16px"></i></button>
        </div>

        <!-- Body Content -->
        <div style="padding:22px 28px;">
          <!-- Highlight Stats Cards -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
            <div style="background:var(--bg-input);padding:12px;border-radius:12px;border:1px solid var(--border);text-align:center;">
              <div style="font-size:10px;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Điểm thưởng</div>
              <div id="vPoints" style="font-size:15px;font-weight:900;color:var(--accent-light);margin-top:4px;"></div>
            </div>
            <div style="background:var(--bg-input);padding:12px;border-radius:12px;border:1px solid var(--border);text-align:center;">
              <div style="font-size:10px;color:var(--text-dim);font-weight:800;text-transform:uppercase;">Trạng thái</div>
              <div id="vStatus" style="margin-top:4px;"></div>
            </div>
          </div>

          <!-- Info Details Grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;margin-bottom:18px;">
            <div class="detail-item">
              <div class="detail-label">Mã định danh (UID)</div>
              <div style="display:flex;align-items:center;gap:6px;">
                <div id="vUid" class="detail-value mono" style="font-size:11px;"></div>
                <button id="btnCopyUid" class="btn btn-icon" style="width:22px;height:22px;padding:0;display:inline-flex;align-items:center;justify-content:center;" data-tooltip="Sao chép UID">
                  <i data-lucide="copy" style="width:12px;height:12px;"></i>
                </button>
              </div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Số điện thoại</div>
              <div id="vPhone" class="detail-value"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Ngày khởi tạo</div>
              <div id="vCreated" class="detail-value"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Đồng bộ Hệ thống</div>
              <div style="font-size:12px;color:var(--green);font-weight:600;display:flex;align-items:center;gap:4px;">
                <i data-lucide="check-circle" style="width:13px;height:13px;"></i> Auth & Mongo Active
              </div>
            </div>
          </div>

          <!-- Activity & Tickets -->
          <div style="border-top:1px solid var(--border);padding-top:14px;">
            <div class="detail-label" style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
              <span>Địa điểm Check-in & Vé du lịch</span>
              <span style="font-size:10px;color:var(--accent-light);font-weight:600;">Vivu360 Activity</span>
            </div>
            <div id="vTickets" style="display:flex;flex-direction:column;gap:6px;"></div>
          </div>
        </div>

        <!-- Footer Action Buttons -->
        <div style="padding:16px 28px;border-top:1px solid var(--border);background:rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:space-between;">
          <form id="toggleUserStatusForm" method="POST" action="" style="display:inline;">
            <button id="btnToggleStatusModal" type="submit" class="btn btn-secondary" style="font-size:12px;">
              <i data-lucide="lock" style="width:14px;height:14px"></i> <span id="vToggleStatusText">Khóa tài khoản</span>
            </button>
          </form>
          <div style="display:flex;gap:8px;">
            <form id="resetPwdForm" method="POST" action="" style="display:inline;">
              <button type="submit" class="btn btn-warning" style="font-size:12px;">
                <i data-lucide="key-round" style="width:14px;height:14px"></i> Reset mật khẩu
              </button>
            </form>
            <button class="btn btn-secondary modal-close" data-modal="viewModal">Đóng</button>
          </div>
        </div>
      </div>
    </div>



     

    <style>
      .modal-overlay { position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px; }
      .modal-box { background:var(--bg-card);border:1px solid var(--border-hover);border-radius:var(--radius-lg);width:100%;box-shadow:0 32px 80px rgba(0,0,0,0.6);animation:fadeIn 0.2s ease-out;overflow:hidden; }
      .modal-header { padding:20px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between; }
      .form-label { font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px; }
      .form-input { width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none; }
      .form-input:focus { border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow); }
      .detail-item { display:flex;flex-direction:column;gap:4px; }
      .detail-label { font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px; }
      .detail-value { font-size:13px;font-weight:600;color:var(--text-secondary); }
      .mono { font-family:monospace;font-size:12px; }
      .alert-bar { display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:20px;font-size:13px;font-weight:600; }
      .alert-bar.green { background:var(--green-bg);border:1px solid rgba(34,197,94,0.2);color:var(--green); }
      .alert-bar.red { background:var(--red-bg);border:1px solid rgba(239,68,68,0.2);color:var(--red); }
    </style>

    <script>
      // ── Live user filters ──
      (function() {
        const nameInput = document.getElementById('userNameFilter');
        const statusSelect = document.getElementById('userStatusFilter');
        const rankSelect = document.getElementById('userRankFilter');
        const tbody = document.querySelector('#usersTable tbody');
        if (!nameInput || !statusSelect || !rankSelect || !tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr[data-user-name]'));
        const resultCount = document.querySelector('.page-title p strong');
        const searchHint = document.getElementById('searchHint');
        const normalize = value => (value || '').normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').trim();

        function applyUserFilters() {
          const query = normalize(nameInput.value);
          const selectedStatus = statusSelect.value;
          const selectedRank = normalize(rankSelect.value);
          let visible = 0;

          rows.forEach(row => {
            const name = normalize(decodeURIComponent(row.dataset.userName || ''));
            const rowStatus = row.dataset.userStatus || '';
            const rowRank = normalize(decodeURIComponent(row.dataset.userRank || ''));
            const matches = (!query || name.includes(query)) &&
              (!selectedStatus || rowStatus === selectedStatus) &&
              (!selectedRank || rowRank === selectedRank);
            row.style.display = matches ? '' : 'none';
            if (matches) visible++;
          });

          if (resultCount) resultCount.textContent = visible;
          if (searchHint) searchHint.textContent = query ? '· ' + visible + ' tên phù hợp' : '';
          const pagination = document.getElementById('paginationBar');
          if (pagination) pagination.style.display = (query || selectedStatus || selectedRank) ? 'none' : '';
        }

        nameInput.addEventListener('input', applyUserFilters);
        statusSelect.addEventListener('change', applyUserFilters);
        rankSelect.addEventListener('change', applyUserFilters);
      })();

      // ── Client-side Pagination ──
      (function() {
        const PER_PAGE = 20;
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        const allRows = Array.from(tbody.querySelectorAll('tr'));
        if (allRows.length <= PER_PAGE) {
          document.getElementById('paginationBar').style.display = 'none';
          return;
        }
        let currentPage = 1;
        const totalPages = Math.ceil(allRows.length / PER_PAGE);

        function renderPage(page) {
          currentPage = page;
          allRows.forEach((row, i) => {
            row.style.display = (i >= (page-1)*PER_PAGE && i < page*PER_PAGE) ? '' : 'none';
          });
          const from = (page-1)*PER_PAGE+1, to = Math.min(page*PER_PAGE, allRows.length);
          document.getElementById('pageInfo').textContent = \`Hiển thị \${from}–\${to} trong \${allRows.length} người dùng\`;
          renderButtons();
        }

        function renderButtons() {
          const bar = document.getElementById('pageButtons');
          bar.innerHTML = '';
          const btnStyle = (active) => \`padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;border:1px solid \${active?'rgba(99,102,241,0.4)':'var(--border)'};background:\${active?'rgba(99,102,241,0.15)':'rgba(255,255,255,0.03)'};color:\${active?'var(--accent-light)':'var(--text-muted)'};cursor:\${active?'default':'pointer'};font-family:Inter,sans-serif;transition:all 0.18s;\`;
          
          // Prev
          const prev = document.createElement('button');
          prev.innerHTML = '←'; prev.style.cssText = btnStyle(false) + (currentPage===1?'opacity:0.3;pointer-events:none;':'');
          prev.addEventListener('click', () => renderPage(currentPage - 1));
          bar.appendChild(prev);

          // Pages
          for (let p = 1; p <= totalPages; p++) {
            if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
              if (p === 2 || p === totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '…'; dots.style.cssText = 'padding:5px 4px;color:var(--text-dim);font-size:11px;';
                bar.appendChild(dots);
              }
              continue;
            }
            const btn = document.createElement('button');
            btn.textContent = p; btn.style.cssText = btnStyle(p === currentPage);
            if (p !== currentPage) {
              btn.addEventListener('mouseover', () => btn.style.borderColor = 'rgba(99,102,241,0.3)');
              btn.addEventListener('mouseout',  () => btn.style.borderColor = 'var(--border)');
              btn.addEventListener('click',     () => renderPage(p));
            }
            bar.appendChild(btn);
          }

          // Next
          const next = document.createElement('button');
          next.innerHTML = '→'; next.style.cssText = btnStyle(false) + (currentPage===totalPages?'opacity:0.3;pointer-events:none;':'');
          next.addEventListener('click', () => renderPage(currentPage + 1));
          bar.appendChild(next);
        }

        renderPage(1);
      })();

      // ── Generic modal close ──
      document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById(btn.dataset.modal).style.display = 'none');
      });
      ['viewModal'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
      });

      // ── View user ──
      document.querySelectorAll('[data-action="view-user"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const d = btn.dataset;
          document.getElementById('vAvatar').src               = d.avatar || '/images/default-avatar.png';
          document.getElementById('vName').textContent         = d.name || 'Người dùng';
          document.getElementById('vEmail').textContent        = d.email || 'Chưa cập nhật email';
          document.getElementById('vUid').textContent          = d.uid;
          document.getElementById('vPhone').textContent        = d.phone || 'Chưa cung cấp';
          document.getElementById('vPoints').textContent       = Number(d.points || 0).toLocaleString('vi-VN') + ' điểm';
          document.getElementById('vStatus').innerHTML        = '<span class="badge-status ' + d.status + '">' + (d.status === 'active' ? 'Hoạt động' : 'Đã khóa') + '</span>';
          document.getElementById('vCreated').textContent      = d.created || '—';
          document.getElementById('resetPwdForm').action       = '/users/' + d.uid + '/reset-password';
          
          // Form khóa/mở khóa
          const toggleForm = document.getElementById('toggleUserStatusForm');
          if (toggleForm) {
            toggleForm.action = '/users/' + d.uid + '/toggle-status';
            const toggleText = document.getElementById('vToggleStatusText');
            if (toggleText) toggleText.textContent = d.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản';
          }

          // Sample Activity & Check-ins
          const sampleTickets = [
            { title: 'Vịnh Hạ Long 360° VR Tour', date: '2026-08-01', status: 'Đã check-in', color: 'var(--green)' },
            { title: 'Sun World Bà Nà Hills Ticket', date: '2026-07-28', status: 'Hoàn thành', color: 'var(--accent-light)' }
          ];

          document.getElementById('vTickets').innerHTML = sampleTickets.map(t =>
            '<div style="background:var(--bg-input);padding:8px 12px;border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:12px;">' +
              '<div>' +
                '<div style="font-weight:700;color:var(--text-primary);">' + t.title + '</div>' +
                '<div style="font-size:10px;color:var(--text-dim);">' + t.date + '</div>' +
              '</div>' +
              '<span style="font-size:10px;font-weight:800;color:' + t.color + ';background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:100px;">' + t.status + '</span>' +
            '</div>'
          ).join('');

          // Copy UID Handler
          const btnCopy = document.getElementById('btnCopyUid');
          if (btnCopy) {
            btnCopy.onclick = () => {
              navigator.clipboard.writeText(d.uid);
              btnCopy.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;color:var(--green)"></i>';
              if (typeof lucide !== 'undefined') lucide.createIcons();
              setTimeout(() => {
                btnCopy.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px"></i>';
                if (typeof lucide !== 'undefined') lucide.createIcons();
              }, 1500);
            };
          }

          document.getElementById('viewModal').style.display = 'flex';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });
      });


    </script>
  `;

  res.render('layouts/main', { title: 'Người dùng', body });
});

// ── GET /users/export.xlsx ──────────────────────────────────
router.get('/export.xlsx', async (req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Admin Vivu360';
  const ws = wb.addWorksheet('Người dùng');

  ws.columns = [
    { header: 'UID',         key: 'uid',       width: 10 },
    { header: 'Họ tên',      key: 'name',      width: 22 },
    { header: 'Email',       key: 'email',     width: 28 },
    { header: 'Điện thoại',  key: 'phone',     width: 16 },
    { header: 'Điểm',        key: 'points',    width: 10 },
    { header: 'Trạng thái',  key: 'status',    width: 14 },
    { header: 'Ngày tạo',    key: 'createdAt', width: 14 },
  ];

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 22;

  const users = await getUsers();

  users.forEach(u => {
    ws.addRow({ uid: u.uid, name: u.name, email: u.email, phone: u.phone,
                points: u.points, status: u.status === 'active' ? 'Hoạt động' : 'Đã khóa',
                createdAt: u.createdAt });
  });

  ws.eachRow((row, i) => {
    if (i > 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FF0f172a' : 'FF111827' } };
    }
    row.border = { bottom: { style: 'thin', color: { argb: 'FF1e293b' } } };
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
  await wb.xlsx.write(res);
  res.end();
});

// ── POST /users/:uid/reset-password ────────────────────────
router.post('/:uid/reset-password', requirePermission('users.reset'), async (req, res) => {
  await resetUserPassword(req.params.uid);
  res.redirect('/users?msg=updated');
});

module.exports = router;
