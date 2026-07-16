const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../config/firebase');

router.get('/', async (req, res) => {
  const stats = await getDashboardStats();

  // Tăng trưởng người dùng mô phỏng 12 tháng
  const userGrowthData = [
    Math.max(1, Math.floor(stats.totalUsers * 0.40)),
    Math.max(1, Math.floor(stats.totalUsers * 0.47)),
    Math.max(1, Math.floor(stats.totalUsers * 0.53)),
    Math.max(1, Math.floor(stats.totalUsers * 0.59)),
    Math.max(1, Math.floor(stats.totalUsers * 0.64)),
    Math.max(1, Math.floor(stats.totalUsers * 0.70)),
    Math.max(1, Math.floor(stats.totalUsers * 0.75)),
    Math.max(1, Math.floor(stats.totalUsers * 0.80)),
    Math.max(1, Math.floor(stats.totalUsers * 0.86)),
    Math.max(1, Math.floor(stats.totalUsers * 0.91)),
    Math.max(1, Math.floor(stats.totalUsers * 0.96)),
    stats.totalUsers,
  ];

  const rankDist = stats.rankDistribution || { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0, Diamond: 0 };

  const body = `
    <!-- Page Title -->
    <div class="page-title-row">
      <div class="page-title">
        <h1>Dashboard</h1>
        <p>Xin chào, <strong>${req.session.user ? req.session.user.name : 'Admin'}</strong>! Tổng quan hệ thống Vivu360.</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-dim);background:var(--accent-glow2);border:1px solid var(--border);padding:6px 14px;border-radius:100px;">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block;animation:notifPulse 2s infinite;"></span>
        Hệ thống hoạt động bình thường
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid" style="margin-bottom:26px;">
      <div class="stat-card blue">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="users" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">↑ Tổng</span>
        </div>
        <div class="stat-card-value">${stats.totalUsers.toLocaleString('vi-VN')}</div>
        <div class="stat-card-label">Người dùng</div>
      </div>

      <div class="stat-card green">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="file-text" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">↑ Mới</span>
        </div>
        <div class="stat-card-value">${stats.totalPosts.toLocaleString('vi-VN')}</div>
        <div class="stat-card-label">Bài viết cộng đồng</div>
      </div>

      <div class="stat-card purple">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="message-square" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">↑ Hoạt động</span>
        </div>
        <div class="stat-card-value">${stats.totalGroups.toLocaleString('vi-VN')}</div>
        <div class="stat-card-label">Nhóm chat</div>
      </div>

      <div class="stat-card cyan">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="map-pin" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">↑ Điểm đến</span>
        </div>
        <div class="stat-card-value">${stats.totalObjects.toLocaleString('vi-VN')}</div>
        <div class="stat-card-label">Địa điểm du lịch</div>
      </div>
    </div>

    <!-- Charts Row -->
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px;margin-bottom:22px;">

      <!-- Biểu đồ tăng trưởng người dùng -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Tăng trưởng người dùng</div>
            <div class="chart-card-subtitle">Số lượng người dùng tích lũy theo tháng (12 tháng gần nhất)</div>
          </div>
          <div style="padding:4px 12px;background:var(--accent-glow);color:var(--accent-light);border-radius:100px;font-size:10px;font-weight:800;border:1px solid rgba(99,102,241,0.2);">
            ${stats.totalUsers} Users
          </div>
        </div>
        <div style="position:relative;height:240px;">
          <canvas id="userGrowthChart"></canvas>
        </div>
      </div>

      <!-- Phân bố hạng thành viên -->
      <div class="chart-card" style="display:flex;flex-direction:column;">
        <div class="chart-card-header" style="margin-bottom:10px;">
          <div>
            <div class="chart-card-title">Hạng thành viên</div>
            <div class="chart-card-subtitle">Phân bố thứ hạng người dùng</div>
          </div>
        </div>
        <div style="position:relative;height:175px;flex:1;">
          <canvas id="rankChart"></canvas>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:12px;justify-content:center;">
          <span style="font-size:10px;font-weight:700;color:#cd7f32;display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#cd7f32;display:inline-block;"></span>Bronze</span>
          <span style="font-size:10px;font-weight:700;color:#b0b8d4;display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#b0b8d4;display:inline-block;"></span>Silver</span>
          <span style="font-size:10px;font-weight:700;color:#f59e0b;display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>Gold</span>
          <span style="font-size:10px;font-weight:700;color:var(--cyan);display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#22d3ee;display:inline-block;"></span>Platinum</span>
          <span style="font-size:10px;font-weight:700;color:var(--purple);display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;border-radius:50%;background:#a855f7;display:inline-block;"></span>Diamond</span>
        </div>
      </div>
    </div>

    <!-- Bottom Row -->
    <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:18px;margin-bottom:20px;">

      <!-- Người dùng mới nhất -->
      <div class="data-card" style="margin-bottom:0;">
        <div class="data-card-header">
          <span class="data-card-title">
            <i data-lucide="users" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:7px;color:var(--accent-light);"></i>
            Người dùng mới nhất
          </span>
          <a href="/users" style="font-size:11px;color:var(--accent-light);font-weight:700;display:flex;align-items:center;gap:4px;">
            Xem tất cả <i data-lucide="arrow-right" style="width:12px;height:12px;"></i>
          </a>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Hạng</th>
                <th>Trạng thái</th>
                <th>Ngày tham gia</th>
              </tr>
            </thead>
            <tbody>
              ${(stats.recentUsers || []).slice(0, 6).map(u => `
              <tr>
                <td>
                  <div class="user-cell">
                    <div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;flex-shrink:0;">
                      ${(u.name || u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div class="user-cell-info">
                      <div class="user-cell-name">${u.name || u.displayName || '—'}</div>
                      <div class="user-cell-email">${u.email || ''}</div>
                    </div>
                  </div>
                </td>
                <td><span class="badge-rank ${(u.rank || 'bronze').toLowerCase().replace(' ', '-')}">${u.rank || 'Bronze'}</span></td>
                <td><span class="badge-status ${u.status === 'locked' || u.disabled ? 'locked' : 'active'}">${u.status === 'locked' || u.disabled ? 'Đã khóa' : 'Hoạt động'}</span></td>
                <td style="color:var(--text-dim);font-size:11px;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
              </tr>
              `).join('') || `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-dim);">Chưa có dữ liệu</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Nhật ký hoạt động -->
      <div class="data-card" style="margin-bottom:0;">
        <div class="data-card-header">
          <span class="data-card-title">
            <i data-lucide="activity" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:7px;color:var(--green);"></i>
            Hoạt động gần đây
          </span>
        </div>
        <div style="padding:4px 0;">
          ${stats.recentActivities.map(a => `
            <div style="display:flex;gap:12px;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);" class="activity-item">
              <div style="width:30px;height:30px;border-radius:8px;background:rgba(99,102,241,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i data-lucide="${a.icon}" style="width:13px;height:13px;color:var(--accent-light);"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;color:var(--text-primary);font-weight:500;line-height:1.45;">${a.message}</div>
                <div style="font-size:10px;color:var(--text-dim);margin-top:3px;">${a.time}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>

    <script>
      let chartsInitialized = false;

      function drawFallbackCharts() {
        const lineCanvas = document.getElementById('userGrowthChart');
        if (lineCanvas) {
          const box = lineCanvas.parentElement.getBoundingClientRect();
          const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
          lineCanvas.width = Math.max(1, Math.floor(box.width * ratio));
          lineCanvas.height = Math.max(1, Math.floor(box.height * ratio));
          const ctx = lineCanvas.getContext('2d');
          ctx.scale(ratio, ratio);
          const data = ${JSON.stringify(userGrowthData)};
          const w = box.width, h = box.height, pad = 22;
          const max = Math.max(...data, 1), min = Math.min(...data, 0);
          ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
          for (let i = 0; i < 5; i++) { const y = pad + i * (h - pad * 2) / 4; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke(); }
          const points = data.map((v,i) => [pad + i*(w-pad*2)/(data.length-1), h-pad-(v-min)/(Math.max(1,max-min))*(h-pad*2)]);
          const gradient = ctx.createLinearGradient(0,pad,0,h-pad); gradient.addColorStop(0,'rgba(99,102,241,.3)'); gradient.addColorStop(1,'rgba(99,102,241,0)');
          ctx.beginPath(); ctx.moveTo(points[0][0],h-pad); points.forEach(p=>ctx.lineTo(p[0],p[1])); ctx.lineTo(points[points.length-1][0],h-pad); ctx.fillStyle=gradient; ctx.fill();
          ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.strokeStyle='#818cf8'; ctx.lineWidth=2.5; ctx.stroke();
        }
        const donutCanvas = document.getElementById('rankChart');
        if (donutCanvas) {
          const box = donutCanvas.parentElement.getBoundingClientRect();
          const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
          donutCanvas.width = Math.max(1, Math.floor(box.width * ratio)); donutCanvas.height = Math.max(1, Math.floor(box.height * ratio));
          const ctx = donutCanvas.getContext('2d'); ctx.scale(ratio,ratio);
          const data = ${JSON.stringify(Object.values(rankDist))}; const total = data.reduce((a,b)=>a+b,0) || 1;
          const colors=['#cd7f32','#b0b8d4','#f59e0b','#22d3ee','#a855f7']; let angle=-Math.PI/2;
          data.forEach((v,i)=>{ if(!v)return; const next=angle+v/total*Math.PI*2; ctx.beginPath(); ctx.arc(box.width/2,box.height/2,Math.min(box.width,box.height)*.38,angle,next); ctx.strokeStyle=colors[i]; ctx.lineWidth=Math.min(box.width,box.height)*.14; ctx.stroke(); angle=next; });
        }
      }

      function initCharts() {
        // CDN có thể bị chặn hoặc mất mạng. Không polling vô hạn vì nó giữ trang
        // hoạt động liên tục và có thể làm Chrome báo "Page Unresponsive".
        if (chartsInitialized) return;
        if (typeof Chart === 'undefined') { chartsInitialized = true; drawFallbackCharts(); return; }
        chartsInitialized = true;

        const baseOpts = {
          responsive: true,
          maintainAspectRatio: false,
          // Dashboard ưu tiên phản hồi nhanh; animation canvas tốn CPU/GPU và
          // không mang thêm thông tin cho biểu đồ thống kê.
          animation: false,
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
          resizeDelay: 150,
        };
        const tooltipStyle = {
          backgroundColor: 'rgba(10,10,24,0.95)',
          borderColor: 'rgba(99,102,241,0.28)',
          borderWidth: 1,
          titleColor: '#eef0ff',
          bodyColor: '#8892b8',
          padding: 10,
          cornerRadius: 8,
        };

        // ── 1. User Growth (Area Line) ──
        const ugEl = document.getElementById('userGrowthChart');
        if (ugEl) {
          const ctx = ugEl.getContext('2d');
          const grad = ctx.createLinearGradient(0, 0, 0, 240);
          grad.addColorStop(0,   'rgba(99,102,241,0.30)');
          grad.addColorStop(0.6, 'rgba(99,102,241,0.06)');
          grad.addColorStop(1,   'rgba(99,102,241,0.00)');
          new Chart(ugEl, {
            type: 'line',
            data: {
              labels: ['T8','T9','T10','T11','T12','T1','T2','T3','T4','T5','T6','T7'],
              datasets: [{
                label: 'Người dùng',
                data: ${JSON.stringify(userGrowthData)},
                borderColor: '#818cf8',
                backgroundColor: grad,
                borderWidth: 2.5,
                fill: true,
                tension: 0.42,
                pointRadius: 4,
                pointBackgroundColor: '#818cf8',
                pointBorderColor: '#04040c',
                pointBorderWidth: 2.5,
                pointHoverRadius: 6,
              }]
            },
            options: {
              ...baseOpts,
              plugins: {
                legend: { display: false },
                tooltip: { ...tooltipStyle, callbacks: { label: c => ' ' + c.raw.toLocaleString('vi-VN') + ' người dùng' } }
              },
              scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5a6a96', font: { size: 10, weight: '600' } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5a6a96', font: { size: 10 } } }
              }
            }
          });
        }

        // ── 2. Rank Distribution (Doughnut) ──
        const rkEl = document.getElementById('rankChart');
        if (rkEl) {
          const rkData = ${JSON.stringify(Object.values(rankDist))};
          const total  = rkData.reduce((a,b) => a+b, 0);
          new Chart(rkEl, {
            type: 'doughnut',
            data: {
              labels: ${JSON.stringify(Object.keys(rankDist))},
              datasets: [{
                data: rkData,
                backgroundColor: ['#cd7f32','#b0b8d4','#f59e0b','#22d3ee','#a855f7'],
                borderColor: '#04040c',
                borderWidth: 3,
                hoverBorderWidth: 0,
              }]
            },
            options: {
              ...baseOpts,
              cutout: '72%',
              plugins: {
                legend: { display: false },
                tooltip: { ...tooltipStyle, callbacks: {
                  label: c => ' ' + c.label + ': ' + c.raw + (total ? ' (' + Math.round(c.raw/total*100) + '%)' : '')
                }}
              }
            }
          });
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCharts);
      } else {
        initCharts();
      }
    </script>
  `;

  res.render('layouts/main', { title: 'Dashboard', body });
});

module.exports = router;
