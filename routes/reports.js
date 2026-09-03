const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbac');
const { getReports, updateReportStatus, deleteReportedPost } = require('../config/reportsApi');

function escapeHtml(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Không xác định' : date.toLocaleString('vi-VN'); }
function postImages(images) {
  if (!Array.isArray(images) || !images.length) return '';
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">${images.slice(0, 4).map(url => `<img src="${escapeHtml(url)}" alt="Ảnh bài viết" style="width:92px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);" onerror="this.style.display='none'">`).join('')}</div>`;
}

router.get('/', requirePermission('posts'), async (req, res) => {
  const status = String(req.query.status || 'pending');
  try {
    const [reports, pendingReports, allReports] = await Promise.all([getReports(status), getReports('pending'), getReports('all')]);
    const cards = reports.map(report => {
      const post = report.post || null;
      const reporter = report.reporter || null;
      const author = report.author || null;
      const reasons = Array.isArray(report.reasons) ? report.reasons.join(', ') : 'Không nêu lý do';
      return `<article class="data-card" style="padding:20px;margin-bottom:14px;border-left:4px solid ${report.status === 'pending' ? 'var(--red)' : 'var(--border)'};">
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;"><div><div style="font-size:12px;font-weight:800;color:var(--red);margin-bottom:6px;">🚩 ${escapeHtml(reasons)}</div><div style="font-size:12px;color:var(--text-muted);">Báo cáo lúc ${escapeHtml(formatDate(report.createdAt))}</div></div><span class="badge-status ${report.status === 'pending' ? 'pending' : 'visible'}">${report.status === 'pending' ? 'Chờ xử lý' : escapeHtml(report.status)}</span></div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,0.45fr);gap:20px;margin-top:16px;">
          <div><div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Bài viết bị báo cáo</div>${post ? `<div style="font-weight:800;">${escapeHtml(author?.name || post.authorId || 'Người dùng')}</div><div style="white-space:pre-wrap;line-height:1.6;margin-top:7px;">${escapeHtml(post.content || '(Bài viết không có nội dung)')}</div>${postImages(post.images)}<a class="btn btn-secondary btn-sm" href="/posts?q=${encodeURIComponent(report.postId)}" style="margin-top:12px;display:inline-flex;">Mở trong quản lý bài viết</a>` : `<div style="color:var(--text-muted);">Bài viết này không còn tồn tại.</div>`}</div>
          <div style="border-left:1px solid var(--border);padding-left:20px;"><div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Người báo cáo</div><div style="font-weight:800;">${escapeHtml(reporter?.name || report.reporterId || 'Không rõ')}</div><div style="font-size:11px;color:var(--text-muted);margin-top:3px;">${escapeHtml(report.reporterId || '')}</div><div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin:16px 0 6px;">Mô tả thêm</div><div style="font-size:13px;line-height:1.5;">${escapeHtml(report.description || 'Không có')}</div></div>
        </div>
        ${report.status === 'pending' ? `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border);"><form method="POST" action="/reports/${encodeURIComponent(report._id)}/rejected"><button class="btn btn-secondary" type="submit">Bỏ qua báo cáo</button></form>${post ? `<form method="POST" action="/reports/${encodeURIComponent(report._id)}/delete-post" onsubmit="return confirm('Xóa vĩnh viễn bài viết này? Thao tác không thể hoàn tác.');"><button class="btn btn-danger" type="submit">Xóa bài viết</button></form>` : ''}</div>` : ''}
      </article>`;
    }).join('');
    const body = `<div class="page-header"><div><div class="page-title-row"><h1>Kiểm duyệt báo cáo bài viết</h1><span class="badge-status pending">${pendingReports.length} chờ xử lý</span></div><p>Xem bài viết, người báo cáo và lựa chọn bỏ qua hoặc xóa bài.</p></div></div><div class="stats-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:20px;"><div class="stat-card"><div class="stat-card-label">Tổng báo cáo</div><div class="stat-card-value">${allReports.length}</div></div><div class="stat-card"><div class="stat-card-label">Chờ xử lý</div><div class="stat-card-value" style="color:var(--red);">${pendingReports.length}</div></div><div class="stat-card"><div class="stat-card-label">Đã hoàn tất</div><div class="stat-card-value" style="color:var(--green);">${allReports.filter(r => r.status !== 'pending').length}</div></div></div><div style="display:flex;justify-content:flex-end;margin-bottom:14px;"><form method="GET"><select class="form-select" name="status" onchange="this.form.submit()"><option value="pending" ${status === 'pending' ? 'selected' : ''}>Chờ xử lý</option><option value="all" ${status === 'all' ? 'selected' : ''}>Tất cả</option><option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Đã bỏ qua</option><option value="resolved" ${status === 'resolved' ? 'selected' : ''}>Đã xử lý</option></select></form></div>${cards || '<div class="data-card" style="padding:32px;text-align:center;color:var(--text-muted);">Không có báo cáo phù hợp.</div>'}`;
    res.render('layouts/main', { title: 'Báo cáo bài viết', body });
  } catch (error) { res.status(503).render('layouts/main', { title: 'Báo cáo bài viết', body: `<div class="data-card" style="padding:24px;">Không thể tải báo cáo từ API: ${escapeHtml(error.message)}</div>` }); }
});

router.post('/:id/rejected', requirePermission('posts.write'), async (req, res) => { try { await updateReportStatus(req.params.id, 'rejected'); res.redirect('/reports'); } catch { res.redirect('/reports'); } });
router.post('/:id/delete-post', requirePermission('posts.write'), async (req, res) => { try { await deleteReportedPost(req.params.id); res.redirect('/reports'); } catch { res.redirect('/reports'); } });

module.exports = router;
