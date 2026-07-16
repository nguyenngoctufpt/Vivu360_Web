const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbac');
const { mockPosts } = require('../config/firebase');

let nextId = mockPosts.length + 1;

router.get('/', (req, res) => {
  const { q = '', status = '', msg = '' } = req.query;
  const activeFilters = [q, status].filter(Boolean).length;

  const filtered = mockPosts.filter(p => {
    const matchQ = !q || p.content.toLowerCase().includes(q.toLowerCase()) || p.userName.toLowerCase().includes(q.toLowerCase());
    const matchS = !status || p.status === status;
    return matchQ && matchS;
  });

  const postCards = filtered.map(p => `
    <div class="post-card" id="post-card-${p.id}">
      <img class="post-avatar" src="${p.avatar}" alt="${p.userName}" loading="lazy">
      <div class="post-body">
        <div class="post-header">
          <span class="post-author">${p.userName}</span>
          <span class="post-date">${p.createdAt}</span>
          <span class="badge-status ${p.status}" id="post-status-${p.id}" style="margin-left:auto">
            ${p.status === 'visible' ? 'Hiển thị' : 'Đã ẩn'}
          </span>
        </div>
        <div class="post-content">${p.content}</div>
        ${p.image ? `<img class="post-image" src="${p.image}" alt="Post" loading="lazy">` : ''}
        <div class="post-stats">
          <span><i data-lucide="heart" style="width:13px;height:13px"></i> ${p.likes}</span>
          <span><i data-lucide="message-circle" style="width:13px;height:13px"></i> ${p.comments}</span>
          <div style="margin-left:auto;display:flex;gap:6px;">
            <button class="btn btn-icon" data-action="toggle-post"
              data-id="${p.id}" data-current-status="${p.status}"
              title="${p.status === 'visible' ? 'Ẩn bài' : 'Hiện bài'}">
              <i data-lucide="${p.status === 'visible' ? 'eye-off' : 'eye'}" style="width:14px;height:14px"></i>
            </button>
            <button class="btn btn-icon" style="color:var(--red)"
              data-action="delete-post" data-id="${p.id}" data-name="${p.userName}"
              title="Xóa bài viết">
              <i data-lucide="trash-2" style="width:14px;height:14px"></i>
            </button>
          </div>
        </div>
      </div>
    </div>`).join('');

  const body = `
    ${msg === 'created' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã thêm bài viết mới!</div>` : ''}
    ${msg === 'deleted' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--red-bg);border:1px solid rgba(239,68,68,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--red);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã xóa bài viết.</div>` : ''}
    ${msg === 'updated' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Đã cập nhật trạng thái bài viết!</div>` : ''}

    <div class="page-title-row">
      <div class="page-title">
        <h1>Quản lý bài viết</h1>
        <p>Hiển thị ${filtered.length}/${mockPosts.length} bài viết${activeFilters ? ` · <span style="color:var(--accent);font-weight:700">${activeFilters} bộ lọc</span>` : ''}</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" id="openAddPostBtn">
          <i data-lucide="plus" style="width:14px;height:14px"></i> Thêm bài viết
        </button>
      </div>
    </div>

    <!-- Filter -->
    <div class="data-card" style="margin-bottom:16px;padding:16px 20px;">
      <form method="GET" action="/posts" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="flex:1;min-width:200px;">
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Tìm kiếm</label>
          <input name="q" value="${q}" placeholder="Tên tác giả, nội dung..."
            style="width:100%;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
        </div>
        <div>
          <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Trạng thái</label>
          <select name="status" style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
            <option value="">Tất cả</option>
            <option value="visible" ${status==='visible'?'selected':''}>Hiển thị</option>
            <option value="hidden" ${status==='hidden'?'selected':''}>Đã ẩn</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary"><i data-lucide="filter" style="width:13px;height:13px"></i> Lọc</button>
        ${activeFilters ? `<a href="/posts" class="btn btn-secondary"><i data-lucide="x" style="width:13px;height:13px"></i> Xóa lọc</a>` : ''}
      </form>
    </div>

    <div class="data-card">${postCards || '<div style="padding:48px;text-align:center;color:var(--text-dim)">Không tìm thấy bài viết nào</div>'}</div>

    <!-- Modal thêm bài viết -->
    <div id="addPostModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px;">
      <div style="background:var(--bg-card);border:1px solid var(--border-hover);border-radius:var(--radius-lg);width:100%;max-width:520px;box-shadow:0 32px 80px rgba(0,0,0,.6);animation:fadeIn .2s ease-out;overflow:hidden;">
        <div style="padding:20px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">
            <i data-lucide="file-plus" style="width:16px;height:16px;color:var(--purple);vertical-align:middle;margin-right:6px"></i>Thêm bài viết mới
          </div>
          <button id="closeAddPost" class="btn btn-icon"><i data-lucide="x" style="width:16px;height:16px"></i></button>
        </div>
        <form method="POST" action="/posts/create" style="padding:20px 28px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Tên tác giả</label>
            <input name="userName" class="form-input" required placeholder="Tên người dùng..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Nội dung bài viết</label>
            <textarea name="content" rows="4" required placeholder="Nhập nội dung bài viết..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;resize:vertical;"></textarea>
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">URL ảnh (tùy chọn)</label>
            <input name="image" class="form-input" type="url" placeholder="https://..."
              style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:4px;border-top:1px solid var(--border);margin-top:4px;">
            <button type="button" id="cancelAddPost" class="btn btn-secondary">Hủy</button>
            <button type="submit" class="btn btn-primary">
              <i data-lucide="plus" style="width:14px;height:14px"></i> Đăng bài
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal xóa -->
    <div id="deletePostModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px;">
      <div style="background:var(--bg-card);border:1px solid var(--border-hover);border-radius:var(--radius-lg);width:100%;max-width:380px;box-shadow:0 32px 80px rgba(0,0,0,.6);animation:fadeIn .2s ease-out;overflow:hidden;">
        <div style="padding:20px 28px;border-bottom:1px solid var(--border);">
          <div style="font-size:15px;font-weight:800;color:var(--text-primary)">Xóa bài viết</div>
        </div>
        <div style="padding:16px 28px 20px;">
          <p style="font-size:13px;color:var(--text-secondary)">Bạn có chắc muốn xóa bài viết của <strong id="dPostName" style="color:var(--text-primary)"></strong>?</p>
        </div>
        <div style="padding:14px 28px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
          <button id="cancelDeletePost" class="btn btn-secondary">Hủy</button>
          <form id="deletePostForm" method="POST" action="" style="margin:0">
            <button type="submit" class="btn btn-danger">
              <i data-lucide="trash-2" style="width:14px;height:14px"></i> Xóa
            </button>
          </form>
        </div>
      </div>
    </div>

    <script>
      const addPostModal = document.getElementById('addPostModal');
      document.getElementById('openAddPostBtn').addEventListener('click', () => { addPostModal.style.display='flex'; if(typeof lucide!=='undefined')lucide.createIcons(); });
      document.getElementById('closeAddPost').addEventListener('click', () => addPostModal.style.display='none');
      document.getElementById('cancelAddPost').addEventListener('click', () => addPostModal.style.display='none');
      addPostModal.addEventListener('click', e => { if(e.target===addPostModal) addPostModal.style.display='none'; });

      const deletePostModal = document.getElementById('deletePostModal');
      document.querySelectorAll('[data-action="delete-post"]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('dPostName').textContent = btn.dataset.name;
          document.getElementById('deletePostForm').action = '/posts/' + btn.dataset.id + '/delete';
          deletePostModal.style.display = 'flex';
          if(typeof lucide!=='undefined')lucide.createIcons();
        });
      });
      document.getElementById('cancelDeletePost').addEventListener('click', () => deletePostModal.style.display='none');
      deletePostModal.addEventListener('click', e => { if(e.target===deletePostModal) deletePostModal.style.display='none'; });

      // Toggle post status (visible/hidden)
      document.querySelectorAll('[data-action="toggle-post"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = '/posts/' + id + '/toggle';
          document.body.appendChild(form);
          form.submit();
        });
      });
    </script>
  `;
  res.render('layouts/main', { title: 'Bài viết', body });
});

// POST /posts/create
router.post('/create', requirePermission('posts.write'), (req, res) => {
  const { userName, content, image } = req.body;
  const newPost = {
    id: 'p' + (Date.now()),
    userId: 'admin',
    userName: userName || 'Admin',
    avatar: 'https://i.pravatar.cc/150?img=1',
    content: content || '',
    likes: 0,
    comments: 0,
    image: image || '',
    status: 'visible',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  mockPosts.unshift(newPost);
  res.redirect('/posts?msg=created');
});

// POST /posts/:id/delete
router.post('/:id/delete', requirePermission('posts.write'), (req, res) => {
  const idx = mockPosts.findIndex(p => p.id === req.params.id);
  if (idx !== -1) mockPosts.splice(idx, 1);
  res.redirect('/posts?msg=deleted');
});

// POST /posts/:id/toggle
router.post('/:id/toggle', requirePermission('posts.write'), (req, res) => {
  const post = mockPosts.find(p => p.id === req.params.id);
  if (post) {
    post.status = post.status === 'visible' ? 'hidden' : 'visible';
  }
  res.redirect('/posts?msg=updated');
});

module.exports = router;
