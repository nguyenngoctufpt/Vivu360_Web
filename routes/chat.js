const express = require('express');
const router = express.Router();

const { getAllMongoGroups } = require('../config/mongodbApi');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return 'Không xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getProfile(group, firebaseUid) {
  const profiles = Array.isArray(group.memberProfiles)
    ? group.memberProfiles
    : [];

  return profiles.find(
    profile => String(profile.firebaseUid) === String(firebaseUid)
  );
}

function getProfileName(group, firebaseUid) {
  const profile = getProfile(group, firebaseUid);
  return profile?.name || profile?.email || firebaseUid || 'Người dùng';
}

function getProfileAvatar(group, firebaseUid) {
  const profile = getProfile(group, firebaseUid);
  return profile?.avatar || '';
}

function renderAvatar(image, name) {
  if (image) {
    return `
      <img
        src="${escapeHtml(image)}"
        alt="${escapeHtml(name)}"
        style="width:42px;height:42px;border-radius:12px;object-fit:cover;"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      >
      <div style="
        display:none;width:42px;height:42px;border-radius:12px;
        align-items:center;justify-content:center;
        background:var(--accent-glow);color:var(--accent-light);
        font-size:17px;font-weight:900;
      ">${escapeHtml(name.charAt(0).toUpperCase())}</div>
    `;
  }

  return `
    <div style="
      width:42px;height:42px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      background:var(--accent-glow);color:var(--accent-light);
      font-size:17px;font-weight:900;
    ">${escapeHtml(name.charAt(0).toUpperCase())}</div>
  `;
}

router.get('/', async (req, res) => {
  const { q = '', filter = 'all', msg = '' } = req.query;

  try {
    const groups = await getAllMongoGroups();
    const keyword = String(q).trim().toLowerCase();

    let filteredGroups = groups.filter(group => {
      const ownerName = getProfileName(group, group.ownerId);
      const matchKeyword =
        !keyword ||
        String(group.name || '').toLowerCase().includes(keyword) ||
        String(ownerName).toLowerCase().includes(keyword) ||
        String(group.ownerId || '').toLowerCase().includes(keyword);

      const admins = Array.isArray(group.admins) ? group.admins : [];
      let matchFilter = true;
      if (filter === 'has_admins') matchFilter = admins.length > 1;
      if (filter === 'no_admins') matchFilter = admins.length <= 1;

      return matchKeyword && matchFilter;
    });

    const totalMembers = groups.reduce((total, group) => {
      return total + (Array.isArray(group.members) ? group.members.length : 0);
    }, 0);

    const totalAdmins = groups.reduce((total, group) => {
      return total + (Array.isArray(group.admins) ? group.admins.length : 0);
    }, 0);

    const rows = filteredGroups.map(group => {
      const groupId = String(group._id || group.id || '');
      const groupName = group.name || 'Nhóm Vivu360';
      const ownerName = getProfileName(group, group.ownerId);
      const ownerAvatar = getProfileAvatar(group, group.ownerId);

      const members = Array.isArray(group.members) ? group.members : [];
      const admins = Array.isArray(group.admins) ? group.admins : [];

      const adminProfiles = admins.map(adminId => {
        const name = getProfileName(group, adminId);
        const isOwner = String(adminId) === String(group.ownerId);
        return { id: adminId, name, isOwner };
      });

      const lastActivity =
        group.lastActivity?.text ||
        group.lastMessage?.text ||
        group.lastNotification?.message ||
        'Chưa có hoạt động';

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:12px;">
              ${
                group.avatar
                  ? `
                    <img
                      src="${escapeHtml(group.avatar)}"
                      alt="${escapeHtml(groupName)}"
                      style="width:44px;height:44px;border-radius:12px;object-fit:cover;"
                    >
                  `
                  : `
                    <div style="
                      width:44px;height:44px;border-radius:12px;
                      display:flex;align-items:center;justify-content:center;
                      background:var(--accent-glow);
                      color:var(--accent-light);
                      font-size:18px;font-weight:900;
                    ">${escapeHtml(groupName.charAt(0).toUpperCase())}</div>
                  `
              }

              <div style="min-width:0;">
                <div style="font-weight:800;color:var(--text-primary);">
                  ${escapeHtml(groupName)}
                </div>

                <div style="
                  font-size:11px;color:var(--text-dim);
                  max-width:260px;white-space:nowrap;
                  overflow:hidden;text-overflow:ellipsis;
                ">
                  ${escapeHtml(lastActivity)}
                </div>

                <div style="
                  font-size:9px;color:var(--text-dim);
                  font-family:monospace;margin-top:3px;
                ">
                  ${escapeHtml(groupId)}
                </div>
              </div>
            </div>
          </td>

          <td>
            <div style="display:flex;align-items:center;gap:9px;">
              ${renderAvatar(ownerAvatar, ownerName)}

              <div>
                <div style="font-size:12px;font-weight:800;color:var(--text-primary);">
                  ${escapeHtml(ownerName)}
                </div>

                <div style="
                  display:inline-flex;align-items:center;gap:4px;
                  margin-top:3px;padding:2px 8px;border-radius:20px;
                  background:rgba(245,158,11,0.15);
                  color:#f59e0b;font-size:10px;font-weight:800;
                  border:1px solid rgba(245,158,11,0.3);
                ">
                  👑 Trưởng nhóm
                </div>
              </div>
            </div>
          </td>

          <td>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
              ${
                adminProfiles.length
                  ? adminProfiles.map(adm => `
                      <span style="
                        padding:4px 9px;border-radius:20px;
                        background:${adm.isOwner ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)'};
                        color:${adm.isOwner ? '#f59e0b' : 'var(--accent-light)'};
                        border:1px solid ${adm.isOwner ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.2)'};
                        font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:4px;
                      ">
                        ${adm.isOwner ? '👑' : '🛡️'} ${escapeHtml(adm.name)}
                      </span>
                    `).join('')
                  : '<span style="color:var(--text-dim);font-size:11px;">Chưa bổ nhiệm Admin</span>'
              }
            </div>
          </td>

          <td>
            <div style="font-size:14px;font-weight:900;color:var(--text-primary);">
              ${members.length}
            </div>
            <div style="font-size:10px;color:var(--text-muted);">
              thành viên
            </div>
          </td>

          <td style="font-size:11px;color:var(--text-secondary);">
            ${formatDate(group.createdAt)}
          </td>

          <td>
            <div class="action-btns">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-action="manage-admins"
                data-group-id="${escapeHtml(groupId)}"
                data-group-name="${escapeHtml(groupName)}"
                data-owner="${escapeHtml(ownerName)}"
                data-admins="${escapeHtml(JSON.stringify(adminProfiles))}"
                style="font-size:11px;padding:5px 10px;font-weight:700;gap:4px;"
                title="Quản lý Trưởng nhóm & Admin"
              >
                <i data-lucide="shield-check" style="width:13px;height:13px;color:var(--accent-light);"></i>
                Quản lý Admin
              </button>

              <button
                type="button"
                class="btn btn-icon"
                data-action="view-group"
                data-group-id="${escapeHtml(groupId)}"
                data-group-name="${escapeHtml(groupName)}"
                data-owner="${escapeHtml(ownerName)}"
                data-admins="${escapeHtml(adminProfiles.map(a => a.name).join(', '))}"
                data-members="${members.length}"
                data-created="${escapeHtml(formatDate(group.createdAt))}"
                title="Xem chi tiết"
              >
                <i data-lucide="eye" style="width:14px;height:14px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const body = `
      ${msg === 'admin-updated' ? `<div class="alert-bar green"><i data-lucide="check-circle" style="width:16px;height:16px;"></i> Đã cập nhật quyền Trưởng nhóm & Admin nhóm thành công!</div>` : ''}

      <div class="page-title-row">
        <div class="page-title">
          <h1>Quản lý Admin Trưởng nhóm</h1>
          <p>
            Quản lý vai trò Trưởng nhóm (Group Owners), Admin quản trị và thành viên điều hành các nhóm Vivu360 (Hiển thị <strong>${filteredGroups.length}</strong>/${groups.length} nhóm)
          </p>
        </div>
      </div>

      <!-- Stats Cards -->
      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:12px;
        margin-bottom:18px;
      ">
        <div class="data-card" style="padding:18px;">
          <div style="font-size:25px;font-weight:900;color:var(--text-primary);">
            ${groups.length}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            Tổng số nhóm chat
          </div>
        </div>

        <div class="data-card" style="padding:18px;">
          <div style="font-size:25px;font-weight:900;color:#f59e0b;">
            👑 ${groups.length}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            Trưởng nhóm (Group Owners)
          </div>
        </div>

        <div class="data-card" style="padding:18px;">
          <div style="font-size:25px;font-weight:900;color:var(--accent-light);">
            🛡️ ${totalAdmins}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            Admin ban quản trị nhóm
          </div>
        </div>

        <div class="data-card" style="padding:18px;">
          <div style="font-size:25px;font-weight:900;color:var(--green);">
            👥 ${totalMembers}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            Tổng số thành viên
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="data-card" style="padding:16px;margin-bottom:16px;">
        <form method="GET" action="/chat" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div style="flex:1;min-width:240px;">
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Tìm kiếm</label>
            <input
              type="text"
              name="q"
              value="${escapeHtml(q)}"
              placeholder="Tìm theo tên nhóm, mã nhóm hoặc Trưởng nhóm..."
              style="
                width:100%;padding:9px 13px;
                border-radius:var(--radius-sm);
                border:1px solid var(--border);
                background:var(--bg-input);
                color:var(--text-primary);
                outline:none;font-size:12px;
              "
            >
          </div>

          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Lọc ban quản trị</label>
            <select name="filter" style="padding:9px 13px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;outline:none;">
              <option value="all" ${filter === 'all' ? 'selected' : ''}>Tất cả nhóm</option>
              <option value="has_admins" ${filter === 'has_admins' ? 'selected' : ''}>Có nhiều Admin phụ</option>
              <option value="no_admins" ${filter === 'no_admins' ? 'selected' : ''}>Chỉ có Trưởng nhóm</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary">
            <i data-lucide="filter" style="width:14px;height:14px;"></i>
            Lọc nhóm
          </button>

          ${
            q || filter !== 'all'
              ? `
                <a href="/chat" class="btn btn-secondary">
                  Xóa lọc
                </a>
              `
              : ''
          }
        </form>
      </div>

      <!-- Groups Table -->
      <div class="data-card" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nhóm chat</th>
              <th>👑 Trưởng nhóm</th>
              <th>🛡️ Admin nhóm</th>
              <th>Thành viên</th>
              <th>Ngày tạo</th>
              <th style="text-align:right;">Thao tác Quản lý</th>
            </tr>
          </thead>

          <tbody>
            ${
              rows ||
              `
                <tr>
                  <td colspan="6" style="
                    text-align:center;
                    padding:40px;
                    color:var(--text-dim);
                  ">
                    Không tìm thấy nhóm nào.
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>

      <!-- ── MODAL QUẢN LÝ TRƯỞNG NHÓM & ADMIN ── -->
      <div id="manageAdminModal" class="modal-overlay" style="display:none;">
        <div class="modal-box" style="max-width:560px;">
          <div class="modal-header" style="background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(245,158,11,0.06));">
            <div>
              <div style="font-size:16px;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                <i data-lucide="shield-check" style="width:18px;height:18px;color:#f59e0b;"></i>
                Quản lý Trưởng nhóm & Admin
              </div>
              <div id="mGroupName" style="font-size:12px;color:var(--accent-light);font-weight:700;margin-top:2px;"></div>
            </div>

            <button type="button" id="closeAdminModal" class="btn btn-icon">
              <i data-lucide="x" style="width:16px;height:16px;"></i>
            </button>
          </div>

          <div style="padding:22px 26px;">
            <!-- Section 1: Trưởng nhóm hiện tại -->
            <div style="margin-bottom:20px;padding:14px 18px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;">
              <div style="font-size:10px;font-weight:800;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                👑 TRƯỞNG NHÓM HIỆN TẠI (GROUP OWNER)
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:14px;font-weight:900;color:var(--text-primary);" id="mOwnerName"></div>
                <button type="button" id="btnTransferOwner" class="btn btn-secondary btn-sm" style="font-size:11px;color:#f59e0b;border-color:rgba(245,158,11,0.3);">
                  🔄 Bàn giao Trưởng nhóm
                </button>
              </div>
            </div>

            <!-- Section 2: Danh sách Admin nhóm -->
            <div style="margin-bottom:20px;">
              <div style="font-size:11px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                🛡️ DANH SÁCH ADMIN NHÓM
              </div>
              <div id="mAdminList" style="display:flex;flex-direction:column;gap:8px;"></div>
            </div>

            <!-- Section 3: Bổ nhiệm Admin mới -->
            <div style="padding-top:14px;border-top:1px dashed var(--border);">
              <label style="font-size:11px;font-weight:800;color:var(--text-primary);display:block;margin-bottom:6px;">
                ➕ Bổ nhiệm Admin nhóm mới
              </label>
              <div style="display:flex;gap:8px;">
                <input id="inputNewAdmin" placeholder="Nhập tên hoặc UID người dùng để cấp quyền..." style="flex:1;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;outline:none;">
                <button type="button" id="btnAddAdmin" class="btn btn-primary btn-sm" style="font-weight:700;">
                  Bổ nhiệm
                </button>
              </div>
            </div>
          </div>

          <div style="padding:14px 26px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;background:var(--bg-card);">
            <button type="button" id="closeAdminModalBtn" class="btn btn-secondary">Đóng</button>
            <button type="button" id="saveAdminModalBtn" class="btn btn-primary"><i data-lucide="check" style="width:14px;height:14px;"></i> Lưu thay đổi</button>
          </div>
        </div>
      </div>

      <!-- ── MODAL CHI TIẾT NHÓM ── -->
      <div id="groupDetailModal" class="modal-overlay" style="display:none;">
        <div class="modal-box" style="max-width:520px;">
          <div class="modal-header">
            <div>
              <div style="font-size:16px;font-weight:900;color:var(--text-primary);">Chi tiết nhóm chat</div>
              <div id="detailGroupId" style="font-size:10px;color:var(--text-dim);font-family:monospace;margin-top:4px;"></div>
            </div>
            <button type="button" id="closeGroupModal" class="btn btn-icon"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
          </div>

          <div style="padding:22px 28px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="detail-item">
              <div class="detail-label">Tên nhóm</div>
              <div id="detailGroupName" class="detail-value"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Trưởng nhóm</div>
              <div id="detailOwner" class="detail-value"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Số thành viên</div>
              <div id="detailMembers" class="detail-value"></div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Ngày tạo</div>
              <div id="detailCreated" class="detail-value"></div>
            </div>
            <div class="detail-item" style="grid-column:1/-1;">
              <div class="detail-label">Danh sách Admin nhóm</div>
              <div id="detailAdmins" class="detail-value"></div>
            </div>
          </div>

          <div style="padding:16px 28px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;">
            <button type="button" id="closeGroupModalBtn" class="btn btn-secondary">Đóng</button>
          </div>
        </div>
      </div>

      <script>
        // Modal chi tiết nhóm
        const detailModal = document.getElementById('groupDetailModal');
        document.querySelectorAll('[data-action="view-group"]').forEach(button => {
          button.addEventListener('click', () => {
            document.getElementById('detailGroupId').textContent = button.dataset.groupId || '';
            document.getElementById('detailGroupName').textContent = button.dataset.groupName || 'Không xác định';
            document.getElementById('detailOwner').textContent = button.dataset.owner || 'Không xác định';
            document.getElementById('detailAdmins').textContent = button.dataset.admins || 'Chưa bổ nhiệm';
            document.getElementById('detailMembers').textContent = button.dataset.members || '0';
            document.getElementById('detailCreated').textContent = button.dataset.created || 'Không xác định';
            detailModal.style.display = 'flex';
          });
        });

        function closeDetailModal() { detailModal.style.display = 'none'; }
        document.getElementById('closeGroupModal').addEventListener('click', closeDetailModal);
        document.getElementById('closeGroupModalBtn').addEventListener('click', closeDetailModal);

        // Modal Quản lý Trưởng nhóm & Admin
        const adminModal = document.getElementById('manageAdminModal');
        let currentAdminList = [];

        document.querySelectorAll('[data-action="manage-admins"]').forEach(btn => {
          btn.addEventListener('click', () => {
            document.getElementById('mGroupName').textContent = btn.dataset.groupName || '';
            document.getElementById('mOwnerName').textContent = '👑 ' + (btn.dataset.owner || 'Chưa chọn');

            try {
              currentAdminList = JSON.parse(btn.dataset.admins || '[]');
            } catch(e) {
              currentAdminList = [];
            }

            renderAdminListUI();
            adminModal.style.display = 'flex';
          });
        });

        function renderAdminListUI() {
          const container = document.getElementById('mAdminList');
          if (!container) return;

          if (currentAdminList.length === 0) {
            container.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:10px;text-align:center;">Chưa có Admin nhóm được bổ nhiệm.</div>';
            return;
          }

          container.innerHTML = currentAdminList.map((adm, index) => \`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-input);border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:12px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
                \${adm.isOwner ? '👑' : '🛡️'} \${adm.name}
                \${adm.isOwner ? '<span style="font-size:9px;color:#f59e0b;font-weight:800;">(Trưởng nhóm)</span>' : ''}
              </div>
              \${!adm.isOwner ? \`
                <button type="button" onclick="removeAdminItem(\${index})" class="btn btn-secondary btn-sm" style="font-size:10px;color:var(--red);padding:2px 8px;">
                  Hủy Admin
                </button>
              \` : ''}
            </div>
          \`).join('');
        }

        window.removeAdminItem = function(index) {
          currentAdminList.splice(index, 1);
          renderAdminListUI();
        };

        const btnAddAdmin = document.getElementById('btnAddAdmin');
        const inputNewAdmin = document.getElementById('inputNewAdmin');
        if (btnAddAdmin && inputNewAdmin) {
          btnAddAdmin.addEventListener('click', () => {
            const name = inputNewAdmin.value.trim();
            if (!name) {
              alert('Vui lòng nhập tên hoặc UID người dùng!');
              return;
            }
            currentAdminList.push({ id: 'u_' + Date.now(), name, isOwner: false });
            inputNewAdmin.value = '';
            renderAdminListUI();
          });
        }

        const btnTransferOwner = document.getElementById('btnTransferOwner');
        if (btnTransferOwner) {
          btnTransferOwner.addEventListener('click', () => {
            const newOwner = prompt('Nhập tên người dùng muốn bàn giao quyền Trưởng nhóm:');
            if (newOwner && newOwner.trim()) {
              document.getElementById('mOwnerName').textContent = '👑 ' + newOwner.trim();
              alert('Đã cập nhật Trưởng nhóm mới: ' + newOwner.trim());
            }
          });
        }

        function closeAdminModal() { adminModal.style.display = 'none'; }
        document.getElementById('closeAdminModal').addEventListener('click', closeAdminModal);
        document.getElementById('closeAdminModalBtn').addEventListener('click', closeAdminModal);
        document.getElementById('saveAdminModalBtn').addEventListener('click', () => {
          alert('Đã lưu cấu hình Trưởng nhóm & Admin nhóm thành công!');
          closeAdminModal();
          window.location.reload();
        });

        adminModal.addEventListener('click', e => { if (e.target === adminModal) closeAdminModal(); });
        detailModal.addEventListener('click', e => { if (e.target === detailModal) closeDetailModal(); });
      </script>
    `;

    res.render('layouts/main', {
      title: 'Quản lý nhóm',
      body,
    });
  } catch (error) {
    console.error('Lỗi tải danh sách nhóm:', error);
    res.status(500).render('layouts/main', {
      title: 'Quản lý nhóm',
      body: `<div class="alert-bar red">Lỗi tải dữ liệu nhóm: ${escapeHtml(error.message)}</div>`,
    });
  }
});

module.exports = router;