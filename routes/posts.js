const express = require('express');
const router = express.Router();

const { requirePermission } = require('../middleware/rbac');
const { getFirestorePosts } = require('../config/firebase');
const {
  getAllMongoPosts,
  deleteMongoPost,
} = require('../config/mongodbApi');
const {
  postReports,
  getPendingReports,
  addReport,
  resolveReport,
  detectViolatingWords,
  autoCheckAndFlagPost,
  prohibitedWordCategories,
} = require('../config/postReports');

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
    return 'Không xác định';
  }

  return date.toLocaleString('vi-VN');
}

function renderImages(images, postId) {
  if (!Array.isArray(images) || images.length === 0) return '';

  const displayedImages = images.slice(0, 4);

  return `
    <div style="
      display:grid;
      grid-template-columns:${displayedImages.length === 1 ? '1fr' : 'repeat(2, 1fr)'};
      gap:6px;
      margin-top:12px;
      max-width:420px;
    ">
      ${displayedImages.map((image, index) => `
        <div style="position:relative;">
          <img
            src="${escapeHtml(image)}"
            alt="Ảnh bài viết"
            loading="lazy"
            style="
              width:100%;
              height:${displayedImages.length === 1 ? '210px' : '130px'};
              object-fit:cover;
              border-radius:10px;
              border:1px solid var(--border);
            "
            onerror="this.parentElement.style.display='none';"
          >

          ${
            index === 3 && images.length > 4
              ? `
                <div style="
                  position:absolute;
                  inset:0;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  background:rgba(0,0,0,.55);
                  color:#fff;
                  border-radius:10px;
                  font-size:24px;
                  font-weight:900;
                ">
                  +${images.length - 4}
                </div>
              `
              : ''
          }
        </div>
      `).join('')}
    </div>
  `;
}

router.get('/', async (req, res) => {
  const {
    q = '',
    category = '',
    sort = 'newest',
    msg = '',
  } = req.query;

  try {
    const posts = await getAllMongoPosts();
    
    // Tự động quét từ ngữ vi phạm và tạo cảnh báo nếu có từ cấm
    posts.forEach(p => autoCheckAndFlagPost(p));

    const keyword = String(q).trim().toLowerCase();

    let filtered = posts.filter(post => {
      const authorName =
        post.author?.name ||
        post.authorId ||
        'Không xác định';

      const matchKeyword =
        !keyword ||
        String(post.content || '').toLowerCase().includes(keyword) ||
        String(authorName).toLowerCase().includes(keyword) ||
        String(post.location || '').toLowerCase().includes(keyword);

      const matchCategory =
        !category ||
        String(post.category || '') === String(category);

      return matchKeyword && matchCategory;
    });

    if (sort === 'oldest') {
      filtered.sort(
        (a, b) =>
          new Date(a.createdAt || 0) -
          new Date(b.createdAt || 0)
      );
    }

    if (sort === 'likes') {
      filtered.sort(
        (a, b) =>
          Number(b.likesCount ?? b.likes?.length ?? 0) -
          Number(a.likesCount ?? a.likes?.length ?? 0)
      );
    }

    if (sort === 'comments') {
      filtered.sort(
        (a, b) =>
          Number(b.commentsCount ?? b.comments?.length ?? 0) -
          Number(a.commentsCount ?? a.comments?.length ?? 0)
      );
    }

    const totalLikes = posts.reduce(
      (total, post) =>
        total +
        Number(post.likesCount ?? post.likes?.length ?? 0),
      0
    );

    const totalComments = posts.reduce(
      (total, post) =>
        total +
        Number(post.commentsCount ?? post.comments?.length ?? 0),
      0
    );

    const today = new Date();
    const todayString = today.toISOString().slice(0, 10);

    const postsToday = posts.filter(post => {
      if (!post.createdAt) return false;

      const date = new Date(post.createdAt);

      if (Number.isNaN(date.getTime())) return false;

      return date.toISOString().slice(0, 10) === todayString;
    }).length;

    const totalPostsCount = posts.length || 1;
    const postsWithImages = posts.filter(p => Array.isArray(p.images) && p.images.length > 0).length;
    const postsWithLocation = posts.filter(p => p.location && String(p.location).trim() !== '').length;
    const reportedCount = postReports.filter(r => r.status === 'pending').length;
    
    const scoreInteraction = Math.min(100, Math.max(15, Math.round((totalLikes / (totalPostsCount * 3)) * 100)));
    const scoreDiscussion = Math.min(100, Math.max(15, Math.round((totalComments / (totalPostsCount * 2)) * 100)));
    const scoreMedia = Math.round((postsWithImages / totalPostsCount) * 100);
    const scoreSafety = Math.max(0, Math.round(((totalPostsCount - reportedCount) / totalPostsCount) * 100));
    const scoreGeo = Math.round((postsWithLocation / totalPostsCount) * 100);
    const scoreActivity = Math.min(100, Math.max(20, Math.round((postsToday / Math.max(1, totalPostsCount * 0.15)) * 100)));

    const categories = [
      ...new Set(
        posts
          .map(post => String(post.category || '').trim())
          .filter(Boolean)
      ),
    ].sort();

    const postCards = filtered.map(post => {
      const postId = String(post._id || post.id || '');
      const authorId = String(post.authorId || '');
      const activeReport = postReports.find(r => r.postId === postId && r.status === 'pending');
      const authorName =
        post.author?.name ||
        authorId ||
        'Người dùng';

      const authorAvatar = post.author?.avatar || '';
      const likesCount =
        Number(post.likesCount ?? post.likes?.length ?? 0);

      const commentsCount =
        Number(post.commentsCount ?? post.comments?.length ?? 0);

      const comments = Array.isArray(post.comments)
        ? post.comments
        : [];

      return `
        <div class="post-card" style="${activeReport ? 'border:1px solid rgba(239,68,68,0.4);' : ''}">
          ${
            authorAvatar
              ? `
                <img
                  class="post-avatar"
                  src="${escapeHtml(authorAvatar)}"
                  alt="${escapeHtml(authorName)}"
                  loading="lazy"
                  onerror="this.style.display='none';"
                >
              `
              : `
                <div class="post-avatar" style="
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  background:var(--accent-glow);
                  color:var(--accent-light);
                  font-size:16px;
                  font-weight:900;
                ">
                  ${escapeHtml(authorName.charAt(0).toUpperCase())}
                </div>
              `
          }

          <div class="post-body">
            <div class="post-header">
              <span class="post-author">
                ${escapeHtml(authorName)}
              </span>

              <span class="post-date">
                ${escapeHtml(formatDate(post.createdAt))}
              </span>

              ${
                activeReport
                  ? `
                    <span class="badge-status pending" style="margin-left:auto;background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.3);font-weight:800;">
                      🚨 CẦN XỬ LÝ VI PHẠM
                    </span>
                  `
                  : post.category
                  ? `
                    <span class="badge-status visible" style="margin-left:auto;">
                      ${escapeHtml(post.category)}
                    </span>
                  `
                  : ''
              }
            </div>

            ${
              post.location
                ? `
                  <div style="
                    display:flex;
                    align-items:center;
                    gap:5px;
                    font-size:11px;
                    color:var(--text-muted);
                    margin-top:2px;
                  ">
                    <i
                      data-lucide="map-pin"
                      style="width:11px;height:11px;"
                    ></i>

                    ${escapeHtml(post.location)}
                  </div>
                `
                : ''
            }

            <div class="post-content" style="white-space:pre-wrap;">
              ${escapeHtml(post.content || '')}
            </div>

            ${renderImages(post.images, postId)}

            ${
              activeReport
                ? `
                  <div style="
                    background:var(--red-bg);
                    border:1px solid rgba(239,68,68,0.3);
                    color:var(--red);
                    padding:10px 14px;
                    border-radius:10px;
                    font-size:11px;
                    font-weight:700;
                    margin-top:12px;
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                  ">
                    <div>
                      🚨 <strong>BÁO CÁO VI PHẠM:</strong> ${escapeHtml(activeReport.reason)}
                      <div style="font-weight:400;color:var(--text-muted);margin-top:2px;">Báo cáo bởi: <strong>${escapeHtml(activeReport.reporterName)}</strong></div>
                    </div>
                    <form method="POST" action="/posts/${escapeHtml(postId)}/dismiss-report" style="margin:0;">
                      <button type="submit" class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;background:var(--bg-card);white-space:nowrap;">
                        Bỏ qua báo cáo
                      </button>
                    </form>
                  </div>
                `
                : ''
            }

            <div class="post-stats">
              <span>
                <i
                  data-lucide="heart"
                  style="width:16px;height:16px;"
                ></i>
                ${likesCount}
              </span>

              <span>
                <i
                  data-lucide="message-circle"
                  style="width:16px;height:16px;"
                ></i>
                ${commentsCount}
              </span>

              <span style="
                font-size:9px;
                color:var(--text-dim);
                font-family:monospace;
              ">
                ${escapeHtml(postId)}
              </span>

              <div style="
                margin-left:auto;
                display:flex;
                gap:6px;
              ">
                <button
                  type="button"
                  class="btn btn-icon"
                  data-action="view-post"
                  data-post-id="${escapeHtml(postId)}"
                  data-author="${escapeHtml(authorName)}"
                  data-content="${escapeHtml(post.content || '')}"
                  data-location="${escapeHtml(post.location || '')}"
                  data-category="${escapeHtml(post.category || '')}"
                  data-created="${escapeHtml(formatDate(post.createdAt))}"
                  data-likes="${likesCount}"
                  data-comments="${commentsCount}"
                  data-comment-list="${escapeHtml(JSON.stringify(comments))}"
                  title="Xem chi tiết"
                >
                  <i
                    data-lucide="eye"
                    style="width:17px;height:17px;"
                  ></i>
                </button>

                <button
                  type="button"
                  class="btn btn-icon"
                  style="color:var(--red);"
                  data-action="delete-post"
                  data-id="${escapeHtml(postId)}"
                  data-author-id="${escapeHtml(authorId)}"
                  data-name="${escapeHtml(authorName)}"
                  title="Xóa bài vi phạm"
                >
                  <i
                    data-lucide="trash-2"
                    style="width:14px;height:14px;"
                  ></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const postRows = filtered.map(post => {
      const postId = String(post._id || post.id || '');
      const authorId = String(post.authorId || '');
      const activeReport = postReports.find(r => r.postId === postId && r.status === 'pending');
      const authorName = post.author?.name || authorId || 'Người dùng';
      const likesCount = Number(post.likesCount ?? post.likes?.length ?? 0);
      const commentsCount = Number(post.commentsCount ?? post.comments?.length ?? 0);
      const comments = Array.isArray(post.comments) ? post.comments : [];
      const imagesCount = Array.isArray(post.images) ? post.images.length : 0;
      const shortContent = post.content ? (post.content.length > 75 ? post.content.slice(0, 75) + '...' : post.content) : '—';

      return `
        <tr style="${activeReport ? 'background:rgba(239,68,68,0.06);' : ''}">
          <td style="font-family:monospace;font-size:10px;color:var(--text-dim);">${escapeHtml(postId.slice(-6))}</td>
          <td>
            <div style="font-weight:800;color:var(--text-primary);font-size:12px;">${escapeHtml(authorName)}</div>
            <div style="font-size:10px;color:var(--text-dim);">${escapeHtml(post.location || 'Chưa định vị')}</div>
          </td>
          <td>
            <div style="font-size:12px;color:var(--text-secondary);max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(shortContent)}
            </div>
            ${activeReport ? `<div style="font-size:10px;font-weight:700;color:var(--red);margin-top:2px;">🚨 ${escapeHtml(activeReport.reason)}</div>` : ''}
          </td>
          <td>
            ${
              activeReport
                ? `<span class="badge-status pending" style="font-size:10px;background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.3);font-weight:800;">🚨 Vi phạm</span>`
                : `<span class="badge-status visible" style="font-size:10px;">${escapeHtml(post.category || 'Tổng hợp')}</span>`
            }
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;">
              <span style="color:var(--red);"><i data-lucide="heart" style="width:14px;height:14px;"></i> ${likesCount}</span>
              <span style="color:var(--accent-light);"><i data-lucide="message-circle" style="width:14px;height:14px;"></i> ${commentsCount}</span>
              ${imagesCount ? `<span style="color:var(--green);"><i data-lucide="image" style="width:14px;height:14px;"></i> ${imagesCount}</span>` : ''}
            </div>
          </td>
          <td style="font-size:11px;color:var(--text-dim);">${escapeHtml(formatDate(post.createdAt))}</td>
          <td style="text-align:right;">
            <div class="action-btns" style="justify-content:flex-end;">
              <button type="button" class="btn btn-icon" data-action="view-post"
                data-post-id="${escapeHtml(postId)}" data-author="${escapeHtml(authorName)}"
                data-content="${escapeHtml(post.content || '')}" data-location="${escapeHtml(post.location || '')}"
                data-category="${escapeHtml(post.category || '')}" data-created="${escapeHtml(formatDate(post.createdAt))}"
                data-likes="${likesCount}" data-comments="${commentsCount}"
                data-comment-list="${escapeHtml(JSON.stringify(comments))}" title="Xem chi tiết">
                <i data-lucide="eye" style="width:14px;height:14px;"></i>
              </button>
              <button type="button" class="btn btn-icon" style="color:var(--red);" data-action="delete-post"
                data-id="${escapeHtml(postId)}" data-author-id="${escapeHtml(authorId)}" data-name="${escapeHtml(authorName)}"
                title="Xóa bài vi phạm">
                <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const body = `
      ${
        msg === 'deleted'
          ? `
            <div class="alert-bar green">
              <i
                data-lucide="check-circle"
                style="width:16px;height:16px;"
              ></i>
              Đã xóa bài viết vi phạm.
            </div>
          `
          : ''
      }

      ${
        msg === 'delete-error'
          ? `
            <div class="alert-bar red">
              Không thể xóa bài viết. Vui lòng kiểm tra lại API.
            </div>
          `
          : ''
      }

      <div class="page-title-row">
        <div class="page-title">
          <h1>Quản lý bài viết</h1>

          <p>
            Hiển thị
            <strong>${filtered.length}</strong>/${posts.length}
            bài viết thật từ hệ thống
          </p>
        </div>

        <div style="display:flex;gap:8px;align-items:center;">
          <button id="btnViewFeed" type="button" class="btn btn-primary btn-sm" style="font-weight:700;display:flex;align-items:center;gap:5px;">
            <i data-lucide="layout-grid" style="width:14px;height:14px;"></i> Dạng Thẻ
          </button>
          <button id="btnViewTable" type="button" class="btn btn-secondary btn-sm" style="font-weight:700;display:flex;align-items:center;gap:5px;">
            <i data-lucide="table" style="width:14px;height:14px;"></i> Dạng Bảng
          </button>
        </div>
      </div>

      <!-- ── CÔNG CỤ AI KIỂM TRA TỪ NGỮ VI PHẠM TỰ ĐỘNG ── -->
      <div class="data-card" style="margin-bottom:18px;padding:20px;background:linear-gradient(135deg,rgba(99,102,241,0.06),rgba(239,68,68,0.04));border:1px solid rgba(99,102,241,0.2);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
              <i data-lucide="shield-alert" style="width:18px;height:18px;color:var(--red);"></i>
              Công cụ Kiểm tra Từ ngữ Vi phạm (AI Profanity Moderation)
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Tự động nhận diện từ cấm, lừa đảo, cờ bạc, ngôn từ thô tục và làm sạch nội dung bài đăng Vivu360</div>
          </div>
          <span class="badge-status pending" style="background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.3);font-size:11px;padding:4px 12px;font-weight:800;">
            🚨 ${reportedCount} bài viết cần xử lý
          </span>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input id="inputCheckText" placeholder="Nhập thử đoạn văn bản bài viết để kiểm tra từ ngữ vi phạm..."
            style="flex:1;min-width:280px;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;outline:none;">
          <button id="btnCheckProfanity" type="button" class="btn btn-primary" style="white-space:nowrap;font-weight:700;">
            <i data-lucide="search-check" style="width:14px;height:14px;"></i> Kiểm tra ngay
          </button>
        </div>

        <div id="checkResultBox" style="display:none;margin-top:14px;padding:12px 16px;background:var(--bg-card);border-radius:10px;border:1px solid var(--border);"></div>
      </div>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:12px;
        margin-bottom:18px;
      ">
        <div class="data-card" style="padding:18px;">
          <div style="
            font-size:25px;
            font-weight:900;
            color:var(--text-primary);
          ">
            ${posts.length}
          </div>

          <div style="font-size:11px;color:var(--text-muted);">
            Tổng bài viết
          </div>
        </div>

        <div class="data-card" style="padding:18px;">
          <div style="
            font-size:25px;
            font-weight:900;
            color:var(--accent-light);
          ">
            ${postsToday}
          </div>

          <div style="font-size:11px;color:var(--text-muted);">
            Bài viết hôm nay
          </div>
        </div>

        <div class="data-card" style="padding:18px;">
          <div style="
            font-size:25px;
            font-weight:900;
            color:var(--red);
          ">
            ${totalLikes}
          </div>

          <div style="font-size:11px;color:var(--text-muted);">
            Tổng lượt thích
          </div>
        </div>

        <div class="data-card" style="padding:18px;">
          <div style="
            font-size:25px;
            font-weight:900;
            color:var(--green);
          ">
            ${totalComments}
          </div>

          <div style="font-size:11px;color:var(--text-muted);">
            Tổng bình luận
          </div>
        </div>
      </div>

      <!-- ── BIỂU ĐỒ RADAR THỐNG KÊ CHẤT LƯỢNG BÀI VIẾT ── -->
      <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:16px;margin-bottom:18px;" class="radar-analytics-grid">
        <!-- Radar Chart Card -->
        <div class="data-card" style="padding:20px;position:relative;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div>
              <div style="font-size:14px;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
                <i data-lucide="radar" style="width:16px;height:16px;color:var(--accent-light);"></i>
                Biểu đồ Radar Thống kê Chất lượng Cộng đồng
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Đánh giá đa chiều 6 chỉ số bài viết hệ thống Vivu360</div>
            </div>
            <span class="badge-status visible" style="font-size:10px;padding:3px 10px;background:var(--accent-glow);color:var(--accent-light);">Radar 360°</span>
          </div>

          <div style="height:250px;position:relative;width:100%;">
            <canvas id="postsRadarChart"></canvas>
          </div>
        </div>

        <!-- Radar Stats Card -->
        <div class="data-card" style="padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
              <i data-lucide="bar-chart-3" style="width:16px;height:16px;color:var(--green);"></i>
              Phân tích 6 Dữ liệu Chỉ số Radar
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
              <div style="background:var(--bg-input);padding:10px 12px;border-radius:10px;border:1px solid var(--border);">
                <div style="font-size:10px;color:var(--text-dim);font-weight:800;">❤️ TƯƠNG TÁC LIKE</div>
                <div style="font-size:18px;font-weight:900;color:var(--red);margin-top:2px;">${scoreInteraction}%</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Like/Bài viết</div>
              </div>
              <div style="background:var(--bg-input);padding:10px 12px;border-radius:10px;border:1px solid var(--border);">
                <div style="font-size:10px;color:var(--text-dim);font-weight:800;">💬 THẢO LUẬN COMMENT</div>
                <div style="font-size:18px;font-weight:900;color:var(--accent-light);margin-top:2px;">${scoreDiscussion}%</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Comment/Bài viết</div>
              </div>
              <div style="background:var(--bg-input);padding:10px 12px;border-radius:10px;border:1px solid var(--border);">
                <div style="font-size:10px;color:var(--text-dim);font-weight:800;">🖼️ PHONG PHÚ HÌNH ẢNH</div>
                <div style="font-size:18px;font-weight:900;color:var(--green);margin-top:2px;">${scoreMedia}%</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Bài đăng kèm hình</div>
              </div>
              <div style="background:var(--bg-input);padding:10px 12px;border-radius:10px;border:1px solid var(--border);">
                <div style="font-size:10px;color:var(--text-dim);font-weight:800;">🛡️ ĐỘ AN TOÀN NỘI DUNG</div>
                <div style="font-size:18px;font-weight:900;color:${scoreSafety < 85 ? 'var(--red)' : 'var(--green)'};margin-top:2px;">${scoreSafety}%</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Bài viết sạch</div>
              </div>
              <div style="background:var(--bg-input);padding:10px 12px;border-radius:10px;border:1px solid var(--border);">
                <div style="font-size:10px;color:var(--text-dim);font-weight:800;">📍 GẮN THẺ VỊ TRÍ</div>
                <div style="font-size:18px;font-weight:900;color:var(--purple);margin-top:2px;">${scoreGeo}%</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Bài check-in vị trí</div>
              </div>
              <div style="background:var(--bg-input);padding:10px 12px;border-radius:10px;border:1px solid var(--border);">
                <div style="font-size:10px;color:var(--text-dim);font-weight:800;">⚡ HOẠT ĐỘNG 24H</div>
                <div style="font-size:18px;font-weight:900;color:var(--cyan);margin-top:2px;">${scoreActivity}%</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Tốc độ bài đăng mới</div>
              </div>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:12px;padding-top:10px;border-top:1px dashed var(--border);display:flex;align-items:center;gap:6px;">
            <i data-lucide="info" style="width:13px;height:13px;"></i> Biểu đồ Ra-đa hỗ trợ Admin nhận biết tổng thể sức khỏe bài viết của cộng đồng.
          </div>
        </div>
      </div>

      <div class="data-card" style="
        margin-bottom:16px;
        padding:16px 20px;
      ">
        <form
          method="GET"
          action="/posts"
          style="
            display:flex;
            gap:10px;
            flex-wrap:wrap;
            align-items:flex-end;
          "
        >
          <div style="flex:1;min-width:220px;">
            <label style="
              font-size:10px;
              font-weight:800;
              color:var(--text-dim);
              text-transform:uppercase;
              letter-spacing:1px;
              display:block;
              margin-bottom:6px;
            ">
              Tìm kiếm
            </label>

            <input
              name="q"
              value="${escapeHtml(q)}"
              placeholder="Nội dung, tác giả hoặc địa điểm..."
              style="
                width:100%;
                padding:8px 12px;
                background:var(--bg-input);
                border:1px solid var(--border);
                border-radius:var(--radius-sm);
                color:var(--text-primary);
                font-size:12px;
                outline:none;
              "
            >
          </div>

          <div>
            <label style="
              font-size:10px;
              font-weight:800;
              color:var(--text-dim);
              text-transform:uppercase;
              letter-spacing:1px;
              display:block;
              margin-bottom:6px;
            ">
              Danh mục
            </label>

            <select
              name="category"
              style="
                padding:8px 12px;
                background:var(--bg-input);
                border:1px solid var(--border);
                border-radius:var(--radius-sm);
                color:var(--text-primary);
                font-size:12px;
                outline:none;
              "
            >
              <option value="">Tất cả</option>

              ${categories.map(item => `
                <option
                  value="${escapeHtml(item)}"
                  ${category === item ? 'selected' : ''}
                >
                  ${escapeHtml(item)}
                </option>
              `).join('')}
            </select>
          </div>

          <div>
            <label style="
              font-size:10px;
              font-weight:800;
              color:var(--text-dim);
              text-transform:uppercase;
              letter-spacing:1px;
              display:block;
              margin-bottom:6px;
            ">
              Sắp xếp
            </label>

            <select
              name="sort"
              style="
                padding:8px 12px;
                background:var(--bg-input);
                border:1px solid var(--border);
                border-radius:var(--radius-sm);
                color:var(--text-primary);
                font-size:12px;
                outline:none;
              "
            >
              <option
                value="newest"
                ${sort === 'newest' ? 'selected' : ''}
              >
                Mới nhất
              </option>

              <option
                value="oldest"
                ${sort === 'oldest' ? 'selected' : ''}
              >
                Cũ nhất
              </option>

              <option
                value="likes"
                ${sort === 'likes' ? 'selected' : ''}
              >
                Nhiều lượt thích
              </option>

              <option
                value="comments"
                ${sort === 'comments' ? 'selected' : ''}
              >
                Nhiều bình luận
              </option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary">
            <i
              data-lucide="filter"
              style="width:13px;height:13px;"
            ></i>
            Lọc
          </button>

          ${
            q || category || sort !== 'newest'
              ? `
                <a href="/posts" class="btn btn-secondary">
                  Xóa lọc
                </a>
              `
              : ''
          }
        </form>
      </div>

      <!-- ── Dạng Thẻ Bài Viết (Card Feed View) ── -->
      <div id="postsFeedView" class="data-card">
        ${
          postCards ||
          `
            <div style="padding:48px;text-align:center;color:var(--text-dim);">
              Không tìm thấy bài viết nào.
            </div>
          `
        }
      </div>

      <!-- ── Dạng Bảng Quản Lý (Table View) ── -->
      <div id="postsTableView" class="data-card" style="display:none;overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:70px;">ID</th>
              <th>Tác giả / Vị trí</th>
              <th>Nội dung trích dẫn</th>
              <th>Danh mục</th>
              <th>Tương tác</th>
              <th>Ngày đăng</th>
              <th style="text-align:right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${
              postRows ||
              `
                <tr>
                  <td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">
                    Không có dữ liệu bài viết.
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>

      <div
        id="postDetailModal"
        class="modal-overlay"
        style="display:none;"
      >
        <div class="modal-box" style="max-width:660px;">
          <div class="modal-header">
            <div>
              <div style="
                font-size:16px;
                font-weight:900;
                color:var(--text-primary);
              ">
                Chi tiết bài viết
              </div>

              <div
                id="detailPostId"
                style="
                  font-size:9px;
                  color:var(--text-dim);
                  font-family:monospace;
                  margin-top:4px;
                "
              ></div>
            </div>

            <button
              type="button"
              id="closePostDetail"
              class="btn btn-icon"
            >
              <i
                data-lucide="x"
                style="width:16px;height:16px;"
              ></i>
            </button>
          </div>

          <div style="
            padding:22px 28px;
            max-height:70vh;
            overflow:auto;
          ">
            <div class="detail-item">
              <div class="detail-label">Tác giả</div>
              <div
                id="detailPostAuthor"
                class="detail-value"
              ></div>
            </div>

            <div style="
              display:grid;
              grid-template-columns:1fr 1fr;
              gap:12px;
              margin-top:14px;
            ">
              <div class="detail-item">
                <div class="detail-label">Danh mục</div>
                <div
                  id="detailPostCategory"
                  class="detail-value"
                ></div>
              </div>

              <div class="detail-item">
                <div class="detail-label">Địa điểm</div>
                <div
                  id="detailPostLocation"
                  class="detail-value"
                ></div>
              </div>

              <div class="detail-item">
                <div class="detail-label">Ngày đăng</div>
                <div
                  id="detailPostCreated"
                  class="detail-value"
                ></div>
              </div>

              <div class="detail-item">
                <div class="detail-label">Tương tác</div>
                <div
                  id="detailPostStats"
                  class="detail-value"
                ></div>
              </div>
            </div>

            <div class="detail-item" style="margin-top:14px;">
              <div class="detail-label">Nội dung</div>

              <div
                id="detailPostContent"
                class="detail-value"
                style="
                  white-space:pre-wrap;
                  line-height:1.7;
                "
              ></div>
            </div>

            <div style="
              font-size:12px;
              font-weight:900;
              color:var(--text-primary);
              margin-top:20px;
              margin-bottom:10px;
            ">
              Bình luận
            </div>

            <div
              id="detailCommentList"
              style="
                display:flex;
                flex-direction:column;
                gap:8px;
              "
            ></div>
          </div>
        </div>
      </div>

      <div
        id="deletePostModal"
        class="modal-overlay"
        style="display:none;"
      >
        <div class="modal-box" style="max-width:400px;">
          <div class="modal-header">
            <div style="
              font-size:15px;
              font-weight:900;
              color:var(--text-primary);
            ">
              Xóa bài viết vi phạm
            </div>
          </div>

          <div style="padding:18px 28px;">
            <p style="
              font-size:13px;
              color:var(--text-secondary);
              line-height:1.6;
            ">
              Anh có chắc muốn xóa bài viết của
              <strong
                id="deletePostAuthorName"
                style="color:var(--text-primary);"
              ></strong>?
            </p>

            <p style="
              font-size:11px;
              color:var(--red);
              margin-top:8px;
            ">
              Bài viết sẽ bị xóa vĩnh viễn khỏi MongoDB.
            </p>
          </div>

          <div style="
            padding:14px 28px;
            border-top:1px solid var(--border);
            display:flex;
            justify-content:flex-end;
            gap:10px;
          ">
            <button
              type="button"
              id="cancelDeletePost"
              class="btn btn-secondary"
            >
              Hủy
            </button>

            <form
              id="deletePostForm"
              method="POST"
              action=""
              style="margin:0;"
            >
              <input
                type="hidden"
                name="authorId"
                id="deletePostAuthorId"
              >

              <button type="submit" class="btn btn-danger">
                <i
                  data-lucide="trash-2"
                  style="width:14px;height:14px;"
                ></i>
                Xóa bài
              </button>
            </form>
          </div>
        </div>
      </div>

      <script>
        const postDetailModal =
          document.getElementById('postDetailModal');

        document
          .querySelectorAll('[data-action="view-post"]')
          .forEach(button => {
            button.addEventListener('click', () => {
              let comments = [];

              try {
                comments = JSON.parse(
                  button.dataset.commentList || '[]'
                );
              } catch (error) {
                comments = [];
              }

              document.getElementById('detailPostId').textContent =
                button.dataset.postId || '';

              document.getElementById('detailPostAuthor').textContent =
                button.dataset.author || 'Không xác định';

              document.getElementById('detailPostCategory').textContent =
                button.dataset.category || 'Không có';

              document.getElementById('detailPostLocation').textContent =
                button.dataset.location || 'Không có';

              document.getElementById('detailPostCreated').textContent =
                button.dataset.created || 'Không xác định';

              document.getElementById('detailPostStats').textContent =
                (button.dataset.likes || '0') +
                ' lượt thích · ' +
                (button.dataset.comments || '0') +
                ' bình luận';

              document.getElementById('detailPostContent').textContent =
                button.dataset.content || '';

              const list =
                document.getElementById('detailCommentList');

              list.innerHTML = '';

              if (!comments.length) {
                const empty = document.createElement('div');
                empty.style.padding = '18px';
                empty.style.textAlign = 'center';
                empty.style.color = 'var(--text-dim)';
                empty.textContent = 'Bài viết chưa có bình luận.';
                list.appendChild(empty);
              } else {
                comments.forEach(comment => {
                  const item = document.createElement('div');
                  item.className = 'data-card';
                  item.style.padding = '11px';

                  const name = document.createElement('div');
                  name.style.fontSize = '11px';
                  name.style.fontWeight = '800';
                  name.style.color = 'var(--text-primary)';
                  name.textContent =
                    comment.author?.name ||
                    comment.authorId ||
                    'Người dùng';

                  const text = document.createElement('div');
                  text.style.fontSize = '11px';
                  text.style.color = 'var(--text-secondary)';
                  text.style.marginTop = '4px';
                  text.style.whiteSpace = 'pre-wrap';
                  text.textContent = comment.text || '';

                  const date = document.createElement('div');
                  date.style.fontSize = '9px';
                  date.style.color = 'var(--text-dim)';
                  date.style.marginTop = '5px';

                  const created = new Date(comment.createdAt);

                  date.textContent = Number.isNaN(created.getTime())
                    ? 'Không xác định'
                    : created.toLocaleString('vi-VN');

                  item.appendChild(name);
                  item.appendChild(text);
                  item.appendChild(date);
                  list.appendChild(item);
                });
              }

              postDetailModal.style.display = 'flex';
            });
          });

        document
          .getElementById('closePostDetail')
          .addEventListener('click', () => {
            postDetailModal.style.display = 'none';
          });

        postDetailModal.addEventListener('click', event => {
          if (event.target === postDetailModal) {
            postDetailModal.style.display = 'none';
          }
        });

        const deletePostModal =
          document.getElementById('deletePostModal');

        document
          .querySelectorAll('[data-action="delete-post"]')
          .forEach(button => {
            button.addEventListener('click', () => {
              document
                .getElementById('deletePostAuthorName')
                .textContent =
                  button.dataset.name || 'Người dùng';

              document
                .getElementById('deletePostAuthorId')
                .value =
                  button.dataset.authorId || '';

              document
                .getElementById('deletePostForm')
                .action =
                  '/posts/' +
                  encodeURIComponent(button.dataset.id) +
                  '/delete';

              deletePostModal.style.display = 'flex';
            });
          });

        document
          .getElementById('cancelDeletePost')
          .addEventListener('click', () => {
            deletePostModal.style.display = 'none';
          });

        // ── View Switcher (Feed Card vs Table) ──
        const btnFeed = document.getElementById('btnViewFeed');
        const btnTable = document.getElementById('btnViewTable');
        const feedView = document.getElementById('postsFeedView');
        const tableView = document.getElementById('postsTableView');

        function setPostsViewMode(mode) {
          if (mode === 'table') {
            if (feedView) feedView.style.display = 'none';
            if (tableView) tableView.style.display = 'block';
            if (btnTable) { btnTable.className = 'btn btn-primary btn-sm'; }
            if (btnFeed) { btnFeed.className = 'btn btn-secondary btn-sm'; }
          } else {
            if (feedView) feedView.style.display = 'block';
            if (tableView) tableView.style.display = 'none';
            if (btnFeed) { btnFeed.className = 'btn btn-primary btn-sm'; }
            if (btnTable) { btnTable.className = 'btn btn-secondary btn-sm'; }
          }
          localStorage.setItem('vivu360_posts_view_mode', mode);
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        btnFeed?.addEventListener('click', () => setPostsViewMode('feed'));
        btnTable?.addEventListener('click', () => setPostsViewMode('table'));

        const savedPostsViewMode = localStorage.getItem('vivu360_posts_view_mode') || 'feed';
        setPostsViewMode(savedPostsViewMode);
      </script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        (function renderRadarChart() {
          function drawChartJS() {
            const canvas = document.getElementById('postsRadarChart');
            if (!canvas || typeof Chart === 'undefined') return;
            const radarLabels = ['Tương tác (Like)', 'Thảo luận (Cmt)', 'Có hình ảnh', 'Độ An toàn', 'Gắn Vị trí', 'Mới 24h'];
            const radarScores = [${scoreInteraction}, ${scoreDiscussion}, ${scoreMedia}, ${scoreSafety}, ${scoreGeo}, ${scoreActivity}];
            new Chart(canvas.getContext('2d'), {
              type: 'radar',
              data: {
                labels: radarLabels,
                datasets: [{
                  label: 'Điểm chỉ số (%)',
                  data: radarScores,
                  backgroundColor: 'rgba(99, 102, 241, 0.22)',
                  borderColor: '#818cf8',
                  borderWidth: 2.5,
                  pointBackgroundColor: '#38bdf8',
                  pointBorderColor: '#ffffff',
                  pointRadius: 4,
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.12)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: {
                      color: '#94a3b8',
                      font: { size: 10, weight: '700', family: 'Inter' }
                    },
                    ticks: { display: false, stepSize: 20 },
                    suggestedMin: 0,
                    suggestedMax: 100,
                  }
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => ' ' + ctx.label + ': ' + ctx.raw + '%'
                    }
                  }
                }
              }
            });
          }

          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(drawChartJS, 50);
          } else {
            document.addEventListener('DOMContentLoaded', drawChartJS);
          }
        // Interactive Profanity Tester Logic
        const btnCheckProfanity = document.getElementById('btnCheckProfanity');
        const inputCheckText = document.getElementById('inputCheckText');
        const checkResultBox = document.getElementById('checkResultBox');

        if (btnCheckProfanity && inputCheckText && checkResultBox) {
          btnCheckProfanity.addEventListener('click', function() {
            const val = inputCheckText.value.trim();
            if (!val) {
              alert('Vui lòng nhập đoạn văn bản bài viết để kiểm tra!');
              return;
            }

            const prohibitedWords = [
              'cờ bạc', 'lừa đảo', 'nhà cái', 'tài xỉu', 'kèo bóng', 'cho vay nặng lãi',
              'chửi thề', 'đồ ngu', 'vô học', 'xúc phạm', 'thô tục', 'phản cảm',
              'bạo lực', 'vũ khí', 'ma túy', 'chất cấm', 'kích động', 'thù hằn',
              'tin giả', 'spam link', 'spam quảng cáo', 'lừa gạt'
            ];

            const lower = val.toLowerCase();
            const matched = prohibitedWords.filter(function(w) { return lower.includes(w); });

            checkResultBox.style.display = 'block';
            if (matched.length === 0) {
              checkResultBox.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--green);font-weight:700;font-size:12px;"><i data-lucide="check-circle" style="width:16px;height:16px;"></i> Nội dung an toàn! Không phát hiện từ ngữ vi phạm tiêu chuẩn cộng đồng Vivu360.</div>';
            } else {
              let censored = val;
              matched.forEach(function(w) {
                const reg = new RegExp(w, 'gi');
                censored = censored.replace(reg, '*'.repeat(w.length));
              });

              const badges = matched.map(function(w) {
                return '<span style="padding:2px 8px;border-radius:6px;background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.3);font-size:10px;font-weight:800;">🚨 ' + w + '</span>';
              }).join(' ');

              checkResultBox.innerHTML = '<div style="color:var(--red);font-weight:800;font-size:12px;display:flex;align-items:center;gap:6px;margin-bottom:6px;"><i data-lucide="alert-triangle" style="width:16px;height:16px;"></i> Phát hiện ' + matched.length + ' từ ngữ vi phạm tiêu chuẩn cộng đồng!</div><div style="margin-bottom:8px;display:flex;gap:4px;flex-wrap:wrap;">' + badges + '</div><div style="font-size:11px;color:var(--text-muted);margin-top:6px;"><strong>Nội dung sau khi làm sạch:</strong><div style="margin-top:3px;padding:8px 10px;background:var(--bg-input);border-radius:6px;font-family:monospace;color:var(--text-primary);">' + censored + '</div></div>';
            }
            if (window.lucide) lucide.createIcons();
          });
        }
      })();
    </script>
    `; // Refreshed for nodemon

    res.render('layouts/main', {
      title: 'Quản lý bài viết',
      body,
    });
  } catch (error) {
    console.error('Lỗi lấy bài viết thật:', error);

    res.status(500).render('layouts/main', {
      title: 'Quản lý bài viết',
      body: `
        <div class="page-title">
          <h1>Quản lý bài viết</h1>
        </div>

        <div class="alert-bar red">
          Không thể lấy bài viết từ API.
          Hãy kiểm tra API Vivu360 đang chạy.
        </div>

        <div class="data-card" style="
          margin-top:16px;
          padding:18px;
          color:var(--text-muted);
        ">
          ${escapeHtml(error.message)}
        </div>
      `,
    });
  }
});

router.post(
  '/:id/delete',
  requirePermission('posts.write'),
  async (req, res) => {
    try {
      const authorId = String(req.body.authorId || '').trim();

      if (!authorId) {
        return res.redirect('/posts?msg=delete-error');
      }

      await deleteMongoPost(req.params.id, authorId);
      resolveReport(req.params.id, 'resolved');

      res.redirect('/posts?msg=deleted');
    } catch (error) {
      console.error('Lỗi xóa bài viết:', error);
      res.redirect('/posts?msg=delete-error');
    }
  }
);

// Admin bỏ qua báo cáo bài viết
router.post('/:id/dismiss-report', requirePermission('posts.write'), (req, res) => {
  resolveReport(req.params.id, 'dismissed');
  res.redirect('/posts?msg=report-dismissed');
});

// API nhận Báo cáo Bài viết từ người dùng / mobile app
router.post('/:id/report', (req, res) => {
  const { reason, reporterName, authorName, postTitle } = req.body;
  const report = addReport({
    postId: req.params.id,
    reason,
    reporterName,
    authorName,
    postTitle,
  });
  console.log(`🚨 Báo cáo vi phạm mới cho bài viết ${req.params.id}:`, report);
  res.json({ success: true, message: 'Đã gửi báo cáo vi phạm tới Admin!', report });
});

module.exports = router;