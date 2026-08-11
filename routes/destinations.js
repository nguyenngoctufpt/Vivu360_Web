const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbac');
const { mockDestinations, getFirestoreDestinations } = require('../config/firebase');
const {
  getAllMongoDestinations,
  createMongoDestination,
  updateMongoDestination,
  deleteMongoDestination,
} = require('../config/mongodbApi');

// Lưu ảnh 360° theo id (in-memory)
const tour360Images = {};
mockDestinations.forEach(d => {
  tour360Images[d.id] = d.hasTour360
    ? ['https://pannellum.org/images/cerro-toco-0.jpg']
    : [];
});

async function getActiveDestinations() {
  try {
    const mongoList = await getAllMongoDestinations();

    if (mongoList && mongoList.length > 0) {
      return mongoList.map(d => ({
        ...d,

        // Chuẩn hóa dữ liệu API DiaDiem về cấu trúc giao diện cũ
        id: String(d._id || d.id || ''),

        title: d.ten || d.name || 'Chưa có tên',

        region:
          d.viTri ||
          d.address ||
          d.city ||
          'Chưa cập nhật',

        type: d.category || 'destination',

        rating: Number(
          d.danhGia !== undefined
            ? d.danhGia
            : d.rating || 0
        ),

        price:
          Number(d.ticketPrice || 0) > 0
            ? Number(d.ticketPrice).toLocaleString('vi-VN') + 'đ'
            : 'Miễn phí',

        image:
          d.hinhAnh ||
          (Array.isArray(d.images) && d.images.length > 0
            ? d.images[0]
            : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80'),

        status: 'active',
      }));
    }
  } catch (error) {
    console.error('Lỗi lấy địa điểm:', error);
  }

  return [];
}

router.get('/', async (req, res) => {
  const { type = '', msg = null } = req.query;

  const destinationsList = await getActiveDestinations();
  const filtered = destinationsList.filter(d => !type || d.type === type);

  const rows = filtered.map(d => {
    const images360 = tour360Images[d.id] || [];
    const has360 = images360.length > 0;
    return `
    <tr id="dest-row-${d.id}">
      <td>
        <div class="dest-cell">
          <img src="${d.image}" alt="${d.title}" loading="lazy">
          <div>
            <div class="dest-cell-title">${d.title}</div>
            <div class="dest-cell-region">${d.region}</div>
          </div>
        </div>
      </td>
      <td><span class="badge-type ${d.type}">${d.type}</span></td>
      <td style="color: var(--yellow);">★ ${d.rating}</td>
      <td style="font-weight: 700; color: var(--green);">${d.price}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          ${has360
            ? `<span class="tour360-badge" id="badge360-${d.id}">
                <i data-lucide="rotate-3d" style="width:10px;height:10px;"></i>
                ${images360.length} ảnh
              </span>`
            : `<span style="color:var(--text-dim);font-size:12px;" id="badge360-${d.id}">Chưa có</span>`
          }
          <button class="btn btn-icon" style="width:26px;height:26px;"
            data-action="open-360-modal"
            data-id="${d.id}"
            data-title="${d.title}"
            data-images='${JSON.stringify(images360)}'
            data-tooltip="Quản lý ảnh 360°">
            <i data-lucide="plus-circle" style="width:13px;height:13px;color:var(--accent);"></i>
          </button>
          ${has360 ? `
            <button class="btn btn-icon" style="width:26px;height:26px;"
              data-action="preview-360"
              data-id="${d.id}"
              data-title="${d.title}"
              data-image="${images360[0]}"
              data-tooltip="Xem thử 360°">
              <i data-lucide="eye" style="width:13px;height:13px;color:var(--purple);"></i>
            </button>
          ` : ''}
        </div>
      </td>
      <td>
        <span class="badge-status ${d.status}">
          ${d.status === 'active' ? 'Hoạt động' : 'Tạm ẩn'}
        </span>
      </td>
      <td>
        <div class="action-btns">

  <!-- Nút sửa -->
  <button class="btn btn-icon" data-tooltip="Chỉnh sửa"
    data-action="edit-destination"
    data-id="${d.id}"
    data-title="${d.title}"
    data-region="${d.region}"
    data-price="${d.price}"
    data-type="${d.type}"
    data-rating="${d.rating}"
    data-status="${d.status}">
    <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
  </button>

  <!-- Nút xóa -->
  <form
    method="POST"
    action="/destinations/${d.id}/delete"
    style="display:inline;margin:0;"
    onsubmit="return confirm('Anh có chắc muốn xóa địa điểm: ${d.title}?');"
  >
    <button
      type="submit"
      class="btn btn-icon"
      data-tooltip="Xóa địa điểm"
    >
      <i
        data-lucide="trash-2"
        style="width:14px;height:14px;color:var(--red);"
      ></i>
    </button>
  </form>

</div>
      </td>
    </tr>
  `;
  }).join('');

  const body = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
    <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>

    ${msg === 'saved' ? `
  <div style="
    display:flex;
    align-items:center;
    gap:8px;
    padding:12px 16px;
    background:var(--green-bg);
    border:1px solid rgba(34,197,94,0.2);
    border-radius:var(--radius-sm);
    margin-bottom:20px;
    color:var(--green);
    font-size:13px;
    font-weight:600;
  ">
    <i data-lucide="check-circle" style="width:16px;height:16px;"></i>
    Thao tác thành công!
  </div>
` : ''}

${msg === 'deleted' ? `
  <div style="
    display:flex;
    align-items:center;
    gap:8px;
    padding:12px 16px;
    background:var(--green-bg);
    border:1px solid rgba(34,197,94,0.2);
    border-radius:var(--radius-sm);
    margin-bottom:20px;
    color:var(--green);
    font-size:13px;
    font-weight:600;
  ">
    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
    Đã xóa địa điểm thành công!
  </div>
` : ''}

${msg === 'error' ? `
  <div style="
    display:flex;
    align-items:center;
    gap:8px;
    padding:12px 16px;
    border:1px solid rgba(239,68,68,0.3);
    border-radius:var(--radius-sm);
    margin-bottom:20px;
    color:var(--red);
    font-size:13px;
    font-weight:600;
  ">
    <i data-lucide="alert-circle" style="width:16px;height:16px;"></i>
    Có lỗi xảy ra. Vui lòng thử lại!
  </div>
` : ''}

    <div class="page-title-row">
      <div class="page-title">
        <h1>Quản lý địa điểm du lịch</h1>
        <p>Quản lý ${filtered.length}/${destinationsList.length} địa điểm du lịch</p>
      </div>
      <div style="display:flex;gap:12px;align-items:center;">
        <div class="filter-bar">
          <select class="filter-select" data-filter="type" style="padding:9px 14px;">
            <option value="" ${type===''?'selected':''}>Tất cả loại</option>
            <option value="destination" ${type==='destination'?'selected':''}>Điểm đến</option>
            <option value="hotel" ${type==='hotel'?'selected':''}>Khách sạn</option>
            <option value="tour" ${type==='tour'?'selected':''}>Tour</option>
            <option value="ticket" ${type==='ticket'?'selected':''}>Vé tham quan</option>
            <option value="car" ${type==='car'?'selected':''}>Thuê xe</option>
          </select>
        </div>
        <button class="btn btn-primary" id="openAddDestBtn">
          <i data-lucide="plus" style="width:14px;height:14px"></i> Thêm mới
        </button>
      </div>
    </div>

    <div class="data-card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Loại</th>
            <th>Đánh giá</th>
            <th>Giá</th>
            <th>Tour 360°</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- ══════════ MODAL QUẢN LÝ ẢNH 360° ══════════ -->
    <div id="modal360" style="
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.7); backdrop-filter:blur(8px);
      align-items:center; justify-content:center; padding:20px;
    ">
      <div style="
        background:var(--bg-card); border:1px solid var(--border-hover);
        border-radius:var(--radius-lg); width:100%; max-width:560px;
        box-shadow:0 32px 80px rgba(0,0,0,0.6);
        animation:fadeIn 0.2s ease-out;
      ">
        <!-- Header -->
        <div style="padding:24px 28px 0; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text-primary);">
              <i data-lucide="rotate-3d" style="width:18px;height:18px;color:var(--accent);vertical-align:middle;margin-right:8px;"></i>
              Quản lý ảnh Tour 360°
            </div>
            <div id="modal360Title" style="font-size:12px;color:var(--text-muted);margin-top:4px;"></div>
          </div>
          <button id="close360Modal" class="btn btn-icon" style="flex-shrink:0;">
            <i data-lucide="x" style="width:16px;height:16px;"></i>
          </button>
        </div>

        <!-- Body -->
        <div style="padding:24px 28px;">
          <!-- Danh sách ảnh hiện có -->
          <div style="font-size:11px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
            Ảnh 360° hiện có
          </div>
          <div id="imageList360" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;min-height:40px;"></div>

          <!-- Thêm ảnh mới -->
          <div style="font-size:11px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
            Thêm ảnh mới
          </div>
          <div style="display:flex;gap:8px;align-items:stretch;">
            <input id="newImageUrl" type="url" placeholder="Nhập URL ảnh panorama 360° (equirectangular)..."
              style="flex:1;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border);
                border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;
                font-family:Inter,sans-serif;outline:none;">
            <button id="addImageBtn" class="btn btn-primary" style="white-space:nowrap;">
              <i data-lucide="plus" style="width:14px;height:14px;"></i>
              Thêm
            </button>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--text-dim);">
            💡 Ảnh cần định dạng equirectangular (2:1). Thử với:
            <a href="#" id="sampleUrl" style="color:var(--accent);font-size:11px;">dùng ảnh mẫu</a>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:16px 28px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
          <button id="cancel360" class="btn btn-secondary">Hủy</button>
          <form id="save360Form" method="POST" action="" style="margin:0;">
            <input type="hidden" name="images" id="imagesHidden">
            <button type="submit" class="btn btn-primary">
              <i data-lucide="save" style="width:14px;height:14px;"></i>
              Lưu thay đổi
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- ══════════ MODAL XEM TRƯỚC 360° ══════════ -->
    <div id="previewModal" style="
      display:none; position:fixed; inset:0; z-index:10000;
      background:rgba(0,0,0,0.92); backdrop-filter:blur(10px);
      flex-direction:column; align-items:stretch;
    ">
      <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="tour360-badge"><i data-lucide="rotate-3d" style="width:12px;height:12px;"></i> Tour 360°</span>
          <span id="previewTitle" style="font-size:14px;font-weight:700;color:var(--text-primary);"></span>
        </div>
        <button id="closePreview" class="btn btn-secondary" style="padding:6px 14px;font-size:12px;">
          <i data-lucide="x" style="width:14px;height:14px;"></i>
          Đóng
        </button>
      </div>
      <div id="panoramaViewer" style="flex:1;min-height:0;"></div>
    </div>

    <!-- ══════════ MODAL CHỈNH SỬA ĐIỂM ĐẾN ══════════ -->
    <div id="editDestModal" style="
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.7); backdrop-filter:blur(8px);
      align-items:center; justify-content:center; padding:20px;
    ">
      <div style="
        background:var(--bg-card); border:1px solid var(--border-hover);
        border-radius:var(--radius-lg); width:100%; max-width:480px;
        box-shadow:0 32px 80px rgba(0,0,0,0.6);
        animation:fadeIn 0.2s ease-out; overflow:hidden;
      ">
        <div style="padding:20px 28px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
          <div style="font-size:16px;font-weight:800;color:var(--text-primary);">
            <i data-lucide="edit-3" style="width:18px;height:18px;color:var(--accent);vertical-align:middle;margin-right:8px;"></i>
            Chỉnh sửa điểm đến
          </div>
          <button id="closeEditDestModal" class="btn btn-icon"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
        </div>
        <form id="editDestForm" method="POST" action="" style="padding:20px 28px; display:flex; flex-direction:column; gap:14px;">
          <div>
            <label class="form-label">Tên điểm đến / Tour</label>
            <input name="title" id="edTitle" required class="form-input">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label class="form-label">Khu vực / Tỉnh thành</label>
              <input name="region" id="edRegion" required class="form-input">
            </div>
            <div>
              <label class="form-label">Loại hình</label>
              <select name="type" id="edType" class="form-input">
                <option value="destination">Điểm đến</option>
                <option value="hotel">Khách sạn</option>
                <option value="tour">Tour</option>
                <option value="ticket">Vé tham quan</option>
                <option value="car">Thuê xe</option>
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label class="form-label">Giá</label>
              <input name="price" id="edPrice" required class="form-input">
            </div>
            <div>
              <label class="form-label">Đánh giá (sao)</label>
              <input name="rating" id="edRating" type="number" min="1" max="5" step="0.1" required class="form-input">
            </div>
          </div>
          <div>
            <label class="form-label">Trạng thái hoạt động</label>
            <select name="status" id="edStatus" class="form-input">
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm ẩn</option>
            </select>
          </div>
          <div style="padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" id="cancelEditDest" class="btn btn-secondary">Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ══════════ MODAL THÊM MỚI ĐIỂM ĐẾN ══════════ -->
    <div id="addDestModal" style="
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.7); backdrop-filter:blur(8px);
      align-items:center; justify-content:center; padding:20px;
    ">
      <div style="
        background:var(--bg-card); border:1px solid var(--border-hover);
        border-radius:var(--radius-lg); width:100%; max-width:480px;
        box-shadow:0 32px 80px rgba(0,0,0,0.6);
        animation:fadeIn 0.2s ease-out; overflow:hidden;
      ">
        <div style="padding:20px 28px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
          <div style="font-size:16px;font-weight:800;color:var(--text-primary);">
            <i data-lucide="plus-circle" style="width:18px;height:18px;color:var(--accent);vertical-align:middle;margin-right:8px;"></i>
            Thêm điểm đến mới
          </div>
          <button id="closeAddDestModal" class="btn btn-icon"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
        </div>
        <form id="addDestForm" method="POST" action="/destinations/create" style="padding:20px 28px; display:flex; flex-direction:column; gap:14px;">
          <div>
            <label class="form-label">Tên điểm đến / Tour</label>
            <input name="title" required class="form-input" placeholder="Ví dụ: Vịnh Hạ Long">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label class="form-label">Khu vực / Tỉnh thành</label>
              <input name="region" required class="form-input" placeholder="Ví dụ: Quảng Ninh">
            </div>
            <div>
              <label class="form-label">Loại hình</label>
              <select name="type" class="form-input">
                <option value="destination">Điểm đến</option>
                <option value="hotel">Khách sạn</option>
                <option value="tour">Tour</option>
                <option value="ticket">Vé tham quan</option>
                <option value="car">Thuê xe</option>
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label class="form-label">Giá</label>
              <input name="price" required class="form-input" placeholder="Ví dụ: 2.500.000đ">
            </div>
            <div>
              <label class="form-label">Đánh giá ban đầu</label>
              <input name="rating" type="number" min="1" max="5" step="0.1" value="5.0" required class="form-input">
            </div>
          </div>
          <div>
            <label class="form-label">Đường dẫn ảnh đại diện (URL)</label>
            <input name="image" type="url" required class="form-input" placeholder="https://images.unsplash.com/...">
          </div>
          <div style="padding-top:12px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" id="cancelAddDest" class="btn btn-secondary">Hủy</button>
            <button type="submit" class="btn btn-primary">Thêm mới</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      // ─── State ───
      let currentDestId = null;
      let currentImages = [];
      const SAMPLE_URL = 'https://pannellum.org/images/cerro-toco-0.jpg';

      // ─── Helpers ───
      function renderImageList() {
        const list = document.getElementById('imageList360');
        if (!currentImages.length) {
          list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:8px 0;">Chưa có ảnh nào.</div>';
          return;
        }
        list.innerHTML = currentImages.map((url, idx) => \`
          <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
            background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);">
            <img src="\${url}" style="width:52px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;">
            <div style="flex:1;min-width:0;font-size:11px;color:var(--text-muted);
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${url}</div>
            <button onclick="removeImage(\${idx})" class="btn btn-icon" style="width:26px;height:26px;flex-shrink:0;"
              data-tooltip="Xóa ảnh">
              <i data-lucide="trash-2" style="width:12px;height:12px;color:var(--red);"></i>
            </button>
          </div>
        \`).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }

      function removeImage(idx) {
        currentImages.splice(idx, 1);
        renderImageList();
      }

      // ─── Open 360 Modal ───
      document.querySelectorAll('[data-action="open-360-modal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentDestId = btn.dataset.id;
          currentImages = JSON.parse(btn.dataset.images || '[]');
          document.getElementById('modal360Title').textContent = btn.dataset.title;
          document.getElementById('save360Form').action = '/destinations/' + currentDestId + '/save360';
          document.getElementById('newImageUrl').value = '';
          renderImageList();
          document.getElementById('modal360').style.display = 'flex';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });
      });

      // ─── Add image ───
      document.getElementById('addImageBtn').addEventListener('click', () => {
        const url = document.getElementById('newImageUrl').value.trim();
        if (!url) return;
        currentImages.push(url);
        document.getElementById('newImageUrl').value = '';
        renderImageList();
      });

      // ─── Sample URL ───
      document.getElementById('sampleUrl').addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('newImageUrl').value = SAMPLE_URL;
      });

      // ─── Save form ───
      document.getElementById('save360Form').addEventListener('submit', function() {
        document.getElementById('imagesHidden').value = JSON.stringify(currentImages);
      });

      // ─── Close modal ───
      ['close360Modal','cancel360'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
          document.getElementById('modal360').style.display = 'none';
        });
      });
      document.getElementById('modal360').addEventListener('click', e => {
        if (e.target === document.getElementById('modal360'))
          document.getElementById('modal360').style.display = 'none';
      });

      // ─── Preview 360 ───
      let viewer = null;
      document.querySelectorAll('[data-action="preview-360"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const imageUrl = btn.dataset.image;
          const title    = btn.dataset.title;
          document.getElementById('previewTitle').textContent = title;
          document.getElementById('previewModal').style.display = 'flex';
          // Destroy previous viewer
          if (viewer) { try { viewer.destroy(); } catch(e){} viewer = null; }
          setTimeout(() => {
            viewer = pannellum.viewer('panoramaViewer', {
              type: 'equirectangular',
              panorama: imageUrl,
              autoLoad: true,
              autoRotate: -2,
              compass: false,
              showControls: true,
              hfov: 100,
              strings: {
                loadButtonLabel: 'Nhấn để tải ảnh 360°',
                loadingLabel: 'Đang tải...',
              }
            });
          }, 100);
        });
      });

      document.getElementById('closePreview').addEventListener('click', () => {
        document.getElementById('previewModal').style.display = 'none';
        if (viewer) { try { viewer.destroy(); } catch(e){} viewer = null; }
      });

      // ─── Edit Destination Modal ───
      const editDestModal = document.getElementById('editDestModal');
      const editDestForm = document.getElementById('editDestForm');

      document.querySelectorAll('[data-action="edit-destination"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const d = btn.dataset;
          document.getElementById('edTitle').value = d.title;
          document.getElementById('edRegion').value = d.region;
          document.getElementById('edType').value = d.type;
          document.getElementById('edPrice').value = d.price;
          document.getElementById('edRating').value = d.rating;
          document.getElementById('edStatus').value = d.status;
          editDestForm.action = '/destinations/' + d.id + '/update';
          editDestModal.style.display = 'flex';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });
      });

      ['closeEditDestModal', 'cancelEditDest'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
          editDestModal.style.display = 'none';
        });
      });
      editDestModal.addEventListener('click', e => {
        if (e.target === editDestModal) editDestModal.style.display = 'none';
      });

      // ─── Add Destination Modal ───
      const addDestModal = document.getElementById('addDestModal');
      document.getElementById('openAddDestBtn').addEventListener('click', () => {
        addDestModal.style.display = 'flex';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });

      ['closeAddDestModal', 'cancelAddDest'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
          addDestModal.style.display = 'none';
        });
      });
      addDestModal.addEventListener('click', e => {
        if (e.target === addDestModal) addDestModal.style.display = 'none';
      });

      // ─── Filter Redirect ───
      document.querySelector('.filter-select').addEventListener('change', function() {
        window.location.href = '/destinations?type=' + this.value;
      });
    </script>
  `;

  res.render('layouts/main', {
  title: 'Quản lý địa điểm du lịch',
  body
});
});

// POST /destinations/:id/save360
router.post('/:id/save360', requirePermission('destinations.write'), (req, res) => {
  const id = req.params.id;
  let images = [];
  try { images = JSON.parse(req.body.images || '[]'); } catch(e) {}
  tour360Images[id] = images.filter(u => typeof u === 'string' && u.trim());

  // Cập nhật hasTour360 trong mockDestinations
  const dest = mockDestinations.find(d => d.id === id);
  if (dest) dest.hasTour360 = tour360Images[id].length > 0;

  res.redirect('/destinations?msg=saved');
});

// POST /destinations/:id/update
router.post(
  '/:id/update',
  requirePermission('destinations.write'),
  async (req, res) => {
    try {
      const id = req.params.id;

      const numericPrice =
  Number(
    String(req.body.price || '')
      .replace(/\./g, '')
      .replace(/,/g, '')
      .replace(/[^\d]/g, '')
  ) || 0;

const data = {
  ten: req.body.title,
  name: req.body.title,

  viTri: req.body.region,
  address: req.body.region,

  category: req.body.type || 'destination',

  danhGia: Number(req.body.rating) || 0,
  rating: Number(req.body.rating) || 0,

  ticketPrice: numericPrice,
};

      await updateMongoDestination(id, data);

      res.redirect('/destinations?msg=saved');
    } catch (error) {
      console.error('Lỗi cập nhật địa điểm:', error);
      res.redirect('/destinations?msg=error');
    }
  }
);

// POST /destinations/create
router.post(
  '/create',
  requirePermission('destinations.write'),
  async (req, res) => {
    try {
      const {
        title,
        region,
        type,
        price,
        rating,
        image,
      } = req.body;

      const numericPrice =
        Number(
          String(price || '')
            .replace(/\./g, '')
            .replace(/,/g, '')
            .replace(/[^\d]/g, '')
        ) || 0;

      const data = {
        ten: title,
        viTri: region,

        name: title,

        address: region,

        category: type || 'destination',

        danhGia: Number(rating) || 0,

        rating: Number(rating) || 0,

        ticketPrice: numericPrice,

        hinhAnh: image || '',

        images: image ? [image] : [],
      };

      await createMongoDestination(data);

      res.redirect('/destinations?msg=saved');
    } catch (error) {
      console.error('Lỗi thêm địa điểm:', error);
      res.redirect('/destinations?msg=error');
    }
  }
);

// POST /destinations/:id/delete
router.post(
  '/:id/delete',
  requirePermission('destinations.write'),
  async (req, res) => {
    try {
      const id = req.params.id;

      await deleteMongoDestination(id);

      res.redirect('/destinations?msg=deleted');
    } catch (error) {
      console.error('Lỗi xóa địa điểm:', error);
      res.redirect('/destinations?msg=error');
    }
  }
);
module.exports = router;
