const express = require('express');
const router = express.Router();
const { ROLES } = require('../middleware/rbac');

// In-memory admin accounts list (mirrors auth.js)
const adminAccounts = [
  { id:'a1', email:'admin@vivu360.vn',   name:'Nguyễn Root',       role:'super_admin',    status:'active',  createdAt:'2024-01-01', lastLogin:'2026-07-01 23:00' },
  { id:'a2', email:'dev@vivu360.vn',     name:'Trần Thanh Dev',    role:'developer',      status:'active',  createdAt:'2024-03-15', lastLogin:'2026-07-01 18:30' },
  { id:'a3', email:'appmgr@vivu360.vn',  name:'Lê App Manager',    role:'app_manager',    status:'active',  createdAt:'2024-06-01', lastLogin:'2026-06-30 10:00' },
  { id:'a4', email:'content@vivu360.vn', name:'Phạm Content',      role:'content_manager',status:'active',  createdAt:'2024-06-01', lastLogin:'2026-07-01 14:22' },
  { id:'a5', email:'cs@vivu360.vn',      name:'Võ Helpdesk',       role:'helpdesk',       status:'active',  createdAt:'2025-01-10', lastLogin:'2026-07-01 22:00' },
  { id:'a6', email:'mod@vivu360.vn',     name:'Đặng Moderator',    role:'moderator',      status:'active',  createdAt:'2025-03-20', lastLogin:'2026-06-29 09:15' },
  { id:'a7', email:'mkt@vivu360.vn',     name:'Hoàng Marketing',   role:'marketing',      status:'active',  createdAt:'2025-06-01', lastLogin:'2026-07-01 11:00' },
  { id:'a8', email:'analyst@vivu360.vn', name:'Lý Data Analyst',   role:'analyst',        status:'inactive',createdAt:'2025-08-15', lastLogin:'2026-06-20 16:45' },
];

const GROUPS = {
  'System & Tech':         { color:'#22d3ee', icon:'cpu' },
  'Operations & Content':  { color:'#10b981', icon:'layers' },
  'User Support':          { color:'#6366f1', icon:'headphones' },
  'Marketing & Growth':    { color:'#ec4899', icon:'trending-up' },
};

// GET /admins
router.get('/', (req, res) => {
  const { msg = '' } = req.query;

  // Group accounts by group
  const grouped = {};
  adminAccounts.forEach(acc => {
    const roleDef = ROLES[acc.role] || {};
    const group = roleDef.group || 'Other';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push({ ...acc, roleDef });
  });

  const groupHtml = Object.entries(grouped).map(([groupName, accs]) => {
    const gDef = GROUPS[groupName] || { color:'#64748b', icon:'users' };
    const rows = accs.map(acc => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:8px;
              background:${acc.roleDef.bgColor||'rgba(100,116,139,0.1)'};
              display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i data-lucide="${acc.roleDef.icon||'user'}" style="width:14px;height:14px;color:${acc.roleDef.color||'#64748b'}"></i>
            </div>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${acc.name}</div>
              <div style="font-size:11px;color:var(--text-muted)">${acc.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:10.5px;font-weight:700;background:${acc.roleDef.bgColor};color:${acc.roleDef.color};border:1px solid ${acc.roleDef.color}33">
            <i data-lucide="${acc.roleDef.icon||'user'}" style="width:10px;height:10px"></i>
            ${acc.roleDef.label||acc.role}
          </span>
        </td>
        <td>
          <div style="display:flex;flex-wrap:wrap;gap:4px;max-width:280px;">
            ${(acc.roleDef.permissions||[]).slice(0,5).map(p => `
              <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:100px;background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid var(--border);font-family:'JetBrains Mono',monospace">${p==='*'?'⭐ Toàn quyền':p}</span>
            `).join('')}
            ${acc.roleDef.permissions?.length>5?`<span style="font-size:9px;color:var(--text-dim)">+${acc.roleDef.permissions.length-5} more</span>`:''}
          </div>
        </td>
        <td>
          <span class="badge-status ${acc.status==='active'?'active':'inactive'}">
            ${acc.status==='active'?'Hoạt động':'Tạm dừng'}
          </span>
        </td>
        <td style="font-size:11px;color:var(--text-muted);font-family:'JetBrains Mono',monospace">${acc.lastLogin}</td>
        <td>
          <div class="action-btns">
            ${acc.role!=='super_admin'?`
              <form method="POST" action="/admins/${acc.id}/toggle" style="margin:0">
                <button type="submit" class="btn btn-icon" data-tooltip="${acc.status==='active'?'Tạm dừng':'Kích hoạt'}">
                  <i data-lucide="${acc.status==='active'?'pause-circle':'play-circle'}" style="width:14px;height:14px;color:${acc.status==='active'?'var(--yellow)':'var(--green)'}"></i>
                </button>
              </form>
              <button class="btn btn-icon" data-tooltip="Đổi role" onclick="openChangeRole('${acc.id}','${acc.role}','${acc.name}')">
                <i data-lucide="user-cog" style="width:14px;height:14px;color:var(--accent-light)"></i>
              </button>
              <form method="POST" action="/admins/${acc.id}/delete" style="margin:0"
                onsubmit="return confirm('Xóa tài khoản ${acc.name}?')">
                <button type="submit" class="btn btn-icon" data-tooltip="Xóa tài khoản">
                  <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--red)"></i>
                </button>
              </form>
            `:`<span style="font-size:11px;color:var(--text-dim);padding:4px 8px">Bảo vệ</span>`}
          </div>
        </td>
      </tr>`).join('');

    return `
      <div class="data-card" style="margin-bottom:20px;">
          <div class="data-card-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:9px;background:${gDef.color}18;
              display:flex;align-items:center;justify-content:center;">
              <i data-lucide="${gDef.icon}" style="width:15px;height:15px;color:${gDef.color}"></i>
            </div>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${groupName}</div>
              <div style="font-size:11px;color:var(--text-muted)">${accs.length} tài khoản</div>
            </div>
          </div>
        </div>
        <table class="data-table">
          <thead><tr>
            <th>Tài khoản</th><th>Role</th><th>Quyền hạn</th>
            <th>Trạng thái</th><th>Đăng nhập cuối</th><th>Hành động</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  // Permission matrix card
  const matrixHtml = `
    <div class="data-card" style="padding:24px;margin-bottom:20px;">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:18px;display:flex;align-items:center;gap:8px;">
        <i data-lucide="grid" style="width:16px;height:16px;color:var(--accent-light)"></i>
        Permission Matrix
        <span style="font-size:11px;color:var(--text-muted);font-weight:500">✅ Có quyền · ❌ Không có · 👁 Chỉ đọc</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="border-collapse:collapse;width:100%;font-size:11px;">
          <thead>
            <tr>
              <th style="padding:8px 12px;text-align:left;font-size:9.5px;font-weight:900;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);white-space:nowrap;">Tính năng</th>
              ${Object.entries(ROLES).map(([k,r])=>`
                <th style="padding:8px 10px;text-align:center;font-size:9px;font-weight:800;color:${r.color};text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid var(--border);white-space:nowrap;min-width:80px;">
                  <div>${r.label}</div>
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${[
              { feature:'Dashboard',        perm:'dashboard' },
              { feature:'Quản lý User',     perm:'users.read' },
              { feature:'Ban/Reset User',   perm:'users.ban' },
              { feature:'Xóa User',         perm:'*' },
              { feature:'Điểm đến & Tours', perm:'destinations' },
              { feature:'Bài viết',         perm:'posts' },
              { feature:'Vé đặt',           perm:'tickets.read' },
              { feature:'Nhóm Chat',        perm:'*' },
              { feature:'Push Notification',perm:'notifications' },
              { feature:'Banner / Popup',   perm:'banners' },
              { feature:'Error Logs',       perm:'logs' },
              { feature:'Feedback & Ticket',perm:'feedback' },
              { feature:'Feature Flags',    perm:'feature_flags' },
              { feature:'Remote Config',    perm:'config.remote' },
              { feature:'AI Config',        perm:'config.ai' },
              { feature:'API Keys',         perm:'*' },
              { feature:'Quản lý Admins',   perm:'*' },
            ].map((row,i) => `
              <tr style="background:${i%2===0?'transparent':'rgba(255,255,255,0.012)'}">
                <td style="padding:7px 12px;font-size:12px;font-weight:600;color:var(--text-secondary);border-bottom:1px solid var(--border);white-space:nowrap">${row.feature}</td>
                ${Object.entries(ROLES).map(([roleKey,roleDef]) => {
                  const hasPerm = roleDef.permissions.includes('*') ||
                    roleDef.permissions.some(p => p===row.perm || row.perm.startsWith(p+'.') || p.startsWith(row.perm+'.'));
                  return `<td style="padding:7px 10px;text-align:center;border-bottom:1px solid var(--border);font-size:13px;">
                    ${hasPerm ? '✅' : '❌'}
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const body = `
    ${msg==='saved'?`<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:10px;margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã lưu thay đổi!</div>`:''}

    <div class="page-title-row">
      <div class="page-title">
        <h1>Quản lý Admin & Phân quyền</h1>
        <p>Quản lý tài khoản Admin, vai trò vận hành và phân quyền bảo mật hệ thống Vivu360</p>
      </div>
      <button onclick="document.getElementById('createAdminModal').style.display='flex'" class="btn btn-primary" style="font-weight:700;">
        <i data-lucide="user-plus" style="width:14px;height:14px"></i> Tạo Admin mới
      </button>
    </div>

    <!-- Stats row -->
    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card blue" style="margin:0;"><div class="stat-card-value">${adminAccounts.length}</div><div class="stat-card-label">Tổng Admin</div></div>
      <div class="stat-card green" style="margin:0;"><div class="stat-card-value">${adminAccounts.filter(a=>a.status==='active').length}</div><div class="stat-card-label">Đang hoạt động</div></div>
      <div class="stat-card yellow" style="margin:0;"><div class="stat-card-value">${adminAccounts.filter(a=>a.status==='inactive').length}</div><div class="stat-card-label">Tạm dừng</div></div>
      <div class="stat-card purple" style="margin:0;"><div class="stat-card-value">${Object.keys(ROLES).length}</div><div class="stat-card-label">Vai trò RBAC</div></div>
    </div>

    ${groupHtml}
    ${matrixHtml}

    <script>
      function openChangeRole(id, role, name) {
        document.getElementById('changeRoleName').textContent = 'Tài khoản: ' + name;
        document.getElementById('changeRoleForm').action = '/admins/' + id + '/change-role';
        document.getElementById('changeRoleModal').style.display = 'flex';
        const sel = document.querySelector('[name="newRole"]');
        for (let opt of sel.options) if(opt.value===role) opt.selected=true;
      }
    </script>

    <!-- Create Admin Modal -->
    <div id="createAdminModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);align-items:center;justify-content:center;">
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-header">
          <div style="font-size:15px;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <i data-lucide="user-plus" style="width:16px;height:16px;color:var(--accent-light);"></i>
            Tạo tài khoản Admin mới
          </div>
          <button onclick="document.getElementById('createAdminModal').style.display='none'" class="btn btn-icon"><i data-lucide="x" style="width:14px;height:14px"></i></button>
        </div>
        <form method="POST" action="/admins/create" style="padding:24px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Họ và tên</label>
            <input name="name" required placeholder="Nguyễn Văn A" style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none;">
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Email công việc</label>
            <input name="email" type="email" required placeholder="admin@vivu360.vn" style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none;">
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Chọn Vai trò (Role)</label>
            <select name="role" required style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none;">
              ${Object.entries(ROLES).filter(([k])=>k!=='super_admin').map(([k,r])=>`
                <option value="${k}">${r.group} — ${r.label}</option>
              `).join('')}
            </select>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
            <button type="button" onclick="document.getElementById('createAdminModal').style.display='none'" class="btn btn-secondary btn-sm">Hủy</button>
            <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="check" style="width:13px;height:13px"></i> Tạo tài khoản</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Change Role Modal -->
    <div id="changeRoleModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);align-items:center;justify-content:center;">
      <div class="modal-box" style="max-width:440px;">
        <div class="modal-header">
          <div style="font-size:15px;font-weight:800;color:var(--text-primary)">Đổi Role Admin</div>
          <button onclick="document.getElementById('changeRoleModal').style.display='none'" class="btn btn-icon"><i data-lucide="x" style="width:14px;height:14px"></i></button>
        </div>
        <form id="changeRoleForm" method="POST" style="padding:24px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <div id="changeRoleName" style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px;"></div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:8px">Chọn Role mới</label>
            <select name="newRole" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
              ${Object.entries(ROLES).filter(([k])=>k!=='super_admin').map(([k,r])=>`
                <option value="${k}">${r.group} — ${r.label}</option>
              `).join('')}
            </select>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" onclick="document.getElementById('changeRoleModal').style.display='none'" class="btn btn-secondary btn-sm">Hủy</button>
            <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="save" style="width:12px;height:12px"></i> Lưu</button>
          </div>
        </form>
      </div>
    </div>

  `;

  res.render('layouts/main', { title: 'Quản lý Admin', body });
});

router.post('/create', (req, res) => {
  const { name, email, role } = req.body;
  if (email && name && role) {
    adminAccounts.push({
      id: 'a' + (adminAccounts.length + 1) + '_' + Date.now().toString(36),
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: role,
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
      lastLogin: 'Chưa đăng nhập',
    });
  }
  res.redirect('/admins?msg=saved');
});

router.post('/:id/toggle', (req, res) => {
  const acc = adminAccounts.find(a => a.id === req.params.id);
  if (acc && acc.role !== 'super_admin') acc.status = acc.status === 'active' ? 'inactive' : 'active';
  res.redirect('/admins?msg=saved');
});

router.post('/:id/change-role', (req, res) => {
  const acc = adminAccounts.find(a => a.id === req.params.id);
  if (acc && acc.role !== 'super_admin') acc.role = req.body.newRole;
  res.redirect('/admins?msg=saved');
});

router.post('/:id/delete', (req, res) => {
  const idx = adminAccounts.findIndex(a => a.id === req.params.id && a.role !== 'super_admin');
  if (idx !== -1) adminAccounts.splice(idx, 1);
  res.redirect('/admins?msg=saved');
});

module.exports = router;
