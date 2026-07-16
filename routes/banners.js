const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbac');

const banners = [
  { id: 'b1', title: 'Khuyến mãi Hè 2026', subtitle: 'Giảm 30% tất cả tour', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', link: '/promotions/summer2026', position: 'home_top', status: 'active', order: 1, createdAt: '2026-06-01' },
  { id: 'b2', title: 'Điểm đến mới: Côn Đảo', subtitle: 'Khám phá thiên đường biển', image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=800&q=80', link: '/destinations/con-dao', position: 'home_mid', status: 'active', order: 2, createdAt: '2026-06-15' },
  { id: 'b3', title: 'Flash Sale 48h', subtitle: 'Chỉ hôm nay và ngày mai', image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=800&q=80', link: '/flash-sale', position: 'home_top', status: 'inactive', order: 3, createdAt: '2026-07-01' },
];

router.get('/', (req, res) => {
  const { msg = '' } = req.query;

  const bannerCards = banners.map(b => `
    <div class="data-card" style="margin-bottom:0;overflow:hidden;">
      <div style="position:relative;height:140px;overflow:hidden;">
        <img src="${b.image}" alt="${b.title}" style="width:100%;height:100%;object-fit:cover;">
        <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.7) 0%,transparent 60%);"></div>
        <div style="position:absolute;bottom:12px;left:14px;">
          <div style="font-size:14px;font-weight:800;color:white">${b.title}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.7)">${b.subtitle}</div>
        </div>
        <div style="position:absolute;top:10px;right:10px;">
          <span class="badge-status ${b.status === 'active' ? 'active' : 'inactive'}" style="font-size:10px;">
            ${b.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      <div style="padding:12px 14px;border-top:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:11px;color:var(--text-dim);">
            <i data-lucide="map-pin" style="width:11px;height:11px;vertical-align:middle"></i>
            ${b.position === 'home_top' ? 'Home — Đầu trang' : 'Home — Giữa trang'}
          </div>
          <div style="font-size:10px;color:var(--text-dim)">Thứ tự: ${b.order}</div>
        </div>
        <div style="font-size:11px;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:10px;">${b.link}</div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-secondary btn-sm" style="flex:1"
            data-action="edit-banner" data-id="${b.id}" data-title="${b.title}"
            data-subtitle="${b.subtitle}" data-image="${b.image}"
            data-link="${b.link}" data-position="${b.position}" data-order="${b.order}">
            <i data-lucide="edit-3" style="width:12px;height:12px"></i> Sửa
          </button>
          <form method="POST" action="/banners/${b.id}/toggle" style="margin:0;flex:1">
            <button type="submit" class="btn ${b.status === 'active' ? 'btn-warning' : 'btn-success'} btn-sm" style="width:100%">
              <i data-lucide="${b.status === 'active' ? 'eye-off' : 'eye'}" style="width:12px;height:12px"></i>
              ${b.status === 'active' ? 'Ẩn' : 'Hiện'}
            </button>
          </form>
          <form method="POST" action="/banners/${b.id}/delete" style="margin:0">
            <button type="submit" class="btn btn-danger btn-sm">
              <i data-lucide="trash-2" style="width:12px;height:12px"></i>
            </button>
          </form>
        </div>
      </div>
    </div>`).join('');

  const body = `
    ${msg === 'saved' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã lưu thay đổi banner!</div>` : ''}

    <div class="page-title-row">
      <div class="page-title"><h1>Quản lý Banner / Popup</h1><p>Điều chỉnh banner hiển thị trên màn hình chính của app</p></div>
      <button class="btn btn-primary" id="openAddBanner">
        <i data-lucide="plus" style="width:14px;height:14px"></i> Thêm banner
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px;">
      ${bannerCards}
    </div>

    <!-- Modal thêm/sửa banner -->
    <div id="bannerModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px;">
      <div style="background:var(--bg-card);border:1px solid var(--border-hover);border-radius:var(--radius-lg);width:100%;max-width:500px;box-shadow:0 32px 80px rgba(0,0,0,.6);animation:fadeIn .2s ease-out;overflow:hidden;">
        <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <div id="bannerModalTitle" style="font-size:16px;font-weight:800;color:var(--text-primary)">Thêm Banner mới</div>
          <button id="closeBannerModal" class="btn btn-icon"><i data-lucide="x" style="width:16px;height:16px"></i></button>
        </div>
        <form id="bannerForm" method="POST" action="/banners/create" style="padding:20px 28px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Tiêu đề</label>
            <input name="title" id="bTitle" required placeholder="Tiêu đề banner..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Phụ đề</label>
            <input name="subtitle" id="bSubtitle" placeholder="Mô tả ngắn..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">URL Ảnh banner</label>
            <input name="image" id="bImage" type="url" required placeholder="https://..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
            <div id="bPreview" style="margin-top:8px;border-radius:8px;overflow:hidden;display:none;">
              <img id="bPreviewImg" style="width:100%;height:100px;object-fit:cover;">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Link điều hướng</label>
              <input name="link" id="bLink" placeholder="/path/to/page"
                style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
            </div>
            <div>
              <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Vị trí hiển thị</label>
              <select name="position" id="bPosition" style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
                <option value="home_top">Home — Đầu trang</option>
                <option value="home_mid">Home — Giữa trang</option>
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:4px;border-top:1px solid var(--border);margin-top:4px;">
            <button type="button" id="cancelBanner" class="btn btn-secondary">Hủy</button>
            <button type="submit" class="btn btn-primary"><i data-lucide="save" style="width:14px;height:14px"></i> Lưu banner</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      const bannerModal = document.getElementById('bannerModal');
      const bannerForm = document.getElementById('bannerForm');

      document.getElementById('openAddBanner').addEventListener('click', () => {
        document.getElementById('bannerModalTitle').textContent = 'Thêm Banner mới';
        bannerForm.action = '/banners/create';
        ['bTitle','bSubtitle','bImage','bLink'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('bPosition').value = 'home_top';
        document.getElementById('bPreview').style.display = 'none';
        bannerModal.style.display = 'flex';
        if(typeof lucide!=='undefined') lucide.createIcons();
      });

      document.querySelectorAll('[data-action="edit-banner"]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('bannerModalTitle').textContent = 'Chỉnh sửa Banner';
          bannerForm.action = '/banners/' + btn.dataset.id + '/update';
          document.getElementById('bTitle').value    = btn.dataset.title;
          document.getElementById('bSubtitle').value = btn.dataset.subtitle;
          document.getElementById('bImage').value    = btn.dataset.image;
          document.getElementById('bLink').value     = btn.dataset.link;
          document.getElementById('bPosition').value = btn.dataset.position;
          if (btn.dataset.image) {
            document.getElementById('bPreviewImg').src = btn.dataset.image;
            document.getElementById('bPreview').style.display = 'block';
          }
          bannerModal.style.display = 'flex';
          if(typeof lucide!=='undefined') lucide.createIcons();
        });
      });

      document.getElementById('bImage').addEventListener('input', function() {
        const preview = document.getElementById('bPreview');
        const img = document.getElementById('bPreviewImg');
        if (this.value) { img.src = this.value; preview.style.display = 'block'; }
        else preview.style.display = 'none';
      });

      ['closeBannerModal','cancelBanner'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => bannerModal.style.display = 'none');
      });
      bannerModal.addEventListener('click', e => { if(e.target===bannerModal) bannerModal.style.display='none'; });
    </script>
  `;
  res.render('layouts/main', { title: 'Banner / Popup', body });
});

router.post('/create', requirePermission('banners.write'), (req, res) => {
  const { title, subtitle, image, link, position } = req.body;
  banners.push({ id: 'b'+Date.now(), title, subtitle, image, link, position, status:'active', order: banners.length+1, createdAt: new Date().toISOString().slice(0,10) });
  res.redirect('/banners?msg=saved');
});
router.post('/:id/update', requirePermission('banners.write'), (req, res) => {
  const b = banners.find(b => b.id === req.params.id);
  if (b) Object.assign(b, req.body);
  res.redirect('/banners?msg=saved');
});
router.post('/:id/toggle', requirePermission('banners.write'), (req, res) => {
  const b = banners.find(b => b.id === req.params.id);
  if (b) b.status = b.status === 'active' ? 'inactive' : 'active';
  res.redirect('/banners?msg=saved');
});
router.post('/:id/delete', requirePermission('banners.write'), (req, res) => {
  const idx = banners.findIndex(b => b.id === req.params.id);
  if (idx !== -1) banners.splice(idx, 1);
  res.redirect('/banners?msg=saved');
});

module.exports = router;
