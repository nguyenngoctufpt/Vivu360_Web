const express = require('express');
const router = express.Router();
const { getDashboardStats, mockDestinations, getUsers } = require('../config/firebase');
const { getAllMongoPosts, getAllMongoGroups, getMongoUsers } = require('../config/mongodbApi');

router.get('/', async (req, res) => {
  const stats = await getDashboardStats();
  
  let mongoPosts = [];
  let mongoUsers = [];
  try { mongoPosts = await getAllMongoPosts(); } catch(e) {}
  try { mongoUsers = await getMongoUsers(); } catch(e) {}
  
  const firebaseUsers = await getUsers();
  const allUsersCount = Math.max(mongoUsers.length, firebaseUsers.length, stats.totalUsers || 0, 15);
  const allPostsCount = Math.max(mongoPosts.length, stats.totalPosts || 0, 48);
  
  // Statistical calculations
  const totalCheckins = mockDestinations.reduce((acc, d) => acc + (d.checkins || 0), 0);
  const tour360Count = mockDestinations.filter(d => d.hasTour360).length;
  
  const zoneStats = {
    'Miền Bắc': mockDestinations.filter(d => d.zone === 'Miền Bắc'),
    'Miền Trung': mockDestinations.filter(d => d.zone === 'Miền Trung'),
    'Miền Nam': mockDestinations.filter(d => d.zone === 'Miền Nam'),
  };

  const provinceData = mockDestinations.map(d => ({
    name: d.region,
    title: d.title,
    checkins: d.checkins || 1000,
    rating: d.rating || 4.8,
  })).sort((a, b) => b.checkins - a.checkins);

  const typeDistribution = {
    'Điểm đến': mockDestinations.filter(d => d.type === 'destination').length,
    'Khách sạn': mockDestinations.filter(d => d.type === 'hotel').length,
    'Tour du lịch': mockDestinations.filter(d => d.type === 'tour').length,
    'Vé tham quan': mockDestinations.filter(d => d.type === 'ticket').length,
  };

  const body = `
    <!-- Leaflet & Chart CDN Links -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
    <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>

    <!-- Page Header & Action Controls -->
    <div class="page-title-row" style="margin-bottom:20px;">
      <div class="page-title">
        <h1 style="display:flex;align-items:center;gap:10px;">
          <i data-lucide="map-pin" style="color:var(--accent-light);width:26px;height:26px;"></i>
          Bản đồ Thống kê & Biểu đồ Tổng quan
        </h1>
        <p>Phân tích dữ liệu không gian du lịch 360°, mật độ check-in và biểu đồ tăng trưởng Vivu360</p>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <!-- Region Filter -->
        <select id="mapZoneFilter" style="padding:7px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-weight:700;outline:none;cursor:pointer;">
          <option value="all">🌐 Tất cả Miền (Bắc - Trung - Nam)</option>
          <option value="Miền Bắc">🏔️ Miền Bắc (${zoneStats['Miền Bắc'].length} điểm)</option>
          <option value="Miền Trung">🏖️ Miền Trung (${zoneStats['Miền Trung'].length} điểm)</option>
          <option value="Miền Nam">🌴 Miền Nam (${zoneStats['Miền Nam'].length} điểm)</option>
        </select>

        <!-- Category Filter -->
        <select id="mapCategoryFilter" style="padding:7px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-weight:700;outline:none;cursor:pointer;">
          <option value="all">📍 Tất cả loại hình</option>
          <option value="destination">🏝️ Điểm đến</option>
          <option value="hotel">🏨 Khách sạn</option>
          <option value="tour">🧳 Tour du lịch</option>
          <option value="ticket">🎟️ Vé tham quan</option>
        </select>

        <!-- Export Buttons -->
        <button id="btnExportCSVAnalytics" type="button" class="btn btn-secondary btn-sm" style="font-weight:700;display:flex;align-items:center;gap:5px;">
          <i data-lucide="file-spreadsheet" style="width:14px;height:14px;color:var(--green);"></i> Xuất CSV
        </button>
        <button id="btnExportMapImage" type="button" class="btn btn-primary btn-sm" style="font-weight:700;display:flex;align-items:center;gap:5px;">
          <i data-lucide="download" style="width:14px;height:14px;"></i> Tải Map PNG
        </button>
      </div>
    </div>

    <!-- Quick Metrics Bar -->
    <div class="stats-grid" style="margin-bottom:24px;">
      <div class="stat-card blue">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="map" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">Phủ sóng 100%</span>
        </div>
        <div class="stat-card-value">${mockDestinations.length}</div>
        <div class="stat-card-label">Tọa độ du lịch 3 miền</div>
      </div>

      <div class="stat-card green">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="navigation" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">↑ Thống kê</span>
        </div>
        <div class="stat-card-value">${totalCheckins.toLocaleString('vi-VN')}</div>
        <div class="stat-card-label">Tổng lượt Check-in</div>
      </div>

      <div class="stat-card purple">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="rotate-3d" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">${Math.round((tour360Count / mockDestinations.length)*100)}%</span>
        </div>
        <div class="stat-card-value">${tour360Count} / ${mockDestinations.length}</div>
        <div class="stat-card-label">Địa điểm có Ảnh Tour 360°</div>
      </div>

      <div class="stat-card cyan">
        <div class="stat-card-header">
          <div class="stat-card-icon"><i data-lucide="users" style="width:18px;height:18px;"></i></div>
          <span class="stat-card-trend up">Tương tác cao</span>
        </div>
        <div class="stat-card-value">${allUsersCount.toLocaleString('vi-VN')}</div>
        <div class="stat-card-label">Khách du lịch đã tải App</div>
      </div>
    </div>

    <!-- ════════════ MAIN MAP CONTAINER SECTION ════════════ -->
    <div class="chart-card" style="padding:22px;margin-bottom:24px;position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <div class="chart-card-title" style="display:flex;align-items:center;gap:8px;font-size:16px;">
            <i data-lucide="map-pin" style="width:18px;height:18px;color:var(--accent-light);"></i>
            Bản đồ Tọa độ Du lịch Việt Nam & Mật độ Check-in
          </div>
          <div class="chart-card-subtitle">Nhấp vào từng Marker để xem chi tiết ảnh 360°, đánh giá sao, lượt check-in và giá vé</div>
        </div>

        <div style="display:flex;align-items:center;gap:12px;">
          <!-- Legend Badges -->
          <div style="display:flex;align-items:center;gap:10px;font-size:11px;font-weight:700;">
            <span style="display:flex;align-items:center;gap:4px;color:#38bdf8;"><span style="width:10px;height:10px;border-radius:50%;background:#38bdf8;display:inline-block;"></span>Điểm đến</span>
            <span style="display:flex;align-items:center;gap:4px;color:#34d399;"><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;"></span>Tour</span>
            <span style="display:flex;align-items:center;gap:4px;color:#c084fc;"><span style="width:10px;height:10px;border-radius:50%;background:#c084fc;display:inline-block;"></span>Khách sạn</span>
            <span style="display:flex;align-items:center;gap:4px;color:#fbbf24;"><span style="width:10px;height:10px;border-radius:50%;background:#fbbf24;display:inline-block;"></span>Vé tham quan</span>
          </div>

          <button id="btnResetMapView" type="button" class="btn btn-secondary btn-sm" style="font-size:11px;">
            <i data-lucide="rotate-ccw" style="width:12px;height:12px;"></i> Đặt lại góc nhìn
          </button>
        </div>
      </div>

      <!-- Map Div -->
      <div id="vivuMap" style="height:480px;border-radius:14px;border:1px solid var(--border);overflow:hidden;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);z-index:1;"></div>

      <!-- Regional Breakdown Cards Below Map -->
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:14px;margin-top:18px;">
        <div style="background:var(--bg-input);padding:14px 16px;border-radius:12px;border:1px solid var(--border);">
          <div style="font-size:11px;font-weight:800;color:var(--accent-light);display:flex;align-items:center;justify-content:space-between;">
            <span>🏔️ MIỀN BẮC</span>
            <span style="background:rgba(99,102,241,0.15);padding:2px 8px;border-radius:100px;">${zoneStats['Miền Bắc'].length} Địa điểm</span>
          </div>
          <div style="font-size:18px;font-weight:900;color:white;margin-top:6px;">
            ${zoneStats['Miền Bắc'].reduce((s,d)=>s+(d.checkins||0),0).toLocaleString('vi-VN')} <span style="font-size:11px;color:var(--text-dim);font-weight:600;">check-in</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
            Hà Nội, Quảng Ninh, Sa Pa, Ninh Bình...
          </div>
        </div>

        <div style="background:var(--bg-input);padding:14px 16px;border-radius:12px;border:1px solid var(--border);">
          <div style="font-size:11px;font-weight:800;color:var(--green);display:flex;align-items:center;justify-content:space-between;">
            <span>🏖️ MIỀN TRUNG</span>
            <span style="background:rgba(34,197,94,0.15);padding:2px 8px;border-radius:100px;">${zoneStats['Miền Trung'].length} Địa điểm</span>
          </div>
          <div style="font-size:18px;font-weight:900;color:white;margin-top:6px;">
            ${zoneStats['Miền Trung'].reduce((s,d)=>s+(d.checkins||0),0).toLocaleString('vi-VN')} <span style="font-size:11px;color:var(--text-dim);font-weight:600;">check-in</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
            Đà Nẵng, Huế, Hội An, Nha Trang, Đà Lạt...
          </div>
        </div>

        <div style="background:var(--bg-input);padding:14px 16px;border-radius:12px;border:1px solid var(--border);">
          <div style="font-size:11px;font-weight:800;color:var(--cyan);display:flex;align-items:center;justify-content:space-between;">
            <span>🌴 MIỀN NAM</span>
            <span style="background:rgba(34,211,238,0.15);padding:2px 8px;border-radius:100px;">${zoneStats['Miền Nam'].length} Địa điểm</span>
          </div>
          <div style="font-size:18px;font-weight:900;color:white;margin-top:6px;">
            ${zoneStats['Miền Nam'].reduce((s,d)=>s+(d.checkins||0),0).toLocaleString('vi-VN')} <span style="font-size:11px;color:var(--text-dim);font-weight:600;">check-in</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
            TP.HCM, Cần Thơ, Phú Quốc, Mũi Né...
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════ OVERVIEW STATISTICAL CHARTS GRID ════════════ -->
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:20px;margin-bottom:24px;">

      <!-- Chart 1: Phân bố Check-in theo Tỉnh Thành (Bar Chart) -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Top Tỉnh / Thành phố được yêu thích nhất</div>
            <div class="chart-card-subtitle">Thống kê số lượng check-in tích lũy theo từng địa bàn tỉnh thành</div>
          </div>
          <div style="padding:3px 10px;background:var(--accent-glow);color:var(--accent-light);border-radius:100px;font-size:10px;font-weight:800;">
            Check-in Metrics
          </div>
        </div>
        <div style="position:relative;height:270px;">
          <canvas id="provinceCheckinChart"></canvas>
        </div>
      </div>

      <!-- Chart 2: Tỷ lệ Loại hình Du lịch (Doughnut Chart) -->
      <div class="chart-card" style="display:flex;flex-direction:column;">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Cơ cấu Loại hình Dịch vụ</div>
            <div class="chart-card-subtitle">Tỷ lệ % phân bổ dịch vụ Vivu360</div>
          </div>
        </div>
        <div style="position:relative;height:200px;flex:1;">
          <canvas id="serviceTypeChart"></canvas>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;justify-content:center;">
          <span style="font-size:10px;font-weight:700;color:#38bdf8;display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#38bdf8;"></span>Điểm đến (${typeDistribution['Điểm đến']})</span>
          <span style="font-size:10px;font-weight:700;color:#c084fc;display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#c084fc;"></span>Khách sạn (${typeDistribution['Khách sạn']})</span>
          <span style="font-size:10px;font-weight:700;color:#34d399;display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#34d399;"></span>Tour (${typeDistribution['Tour du lịch']})</span>
          <span style="font-size:10px;font-weight:700;color:#fbbf24;display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;"></span>Vé tham quan (${typeDistribution['Vé tham quan']})</span>
        </div>
      </div>

    </div>

    <!-- ════════════ SECOND CHARTS ROW ════════════ -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">

      <!-- Chart 3: Radar Chart Sức khỏe Hệ thống 360° -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Biểu đồ Radar Sức khỏe Hệ thống v2</div>
            <div class="chart-card-subtitle">Chỉ số đa chiều về Phủ sóng du lịch, User, Tour 360° & An toàn</div>
          </div>
        </div>
        <div style="position:relative;height:260px;">
          <canvas id="analyticsRadarChart"></canvas>
        </div>
      </div>

      <!-- Chart 4: Tăng trưởng Check-in & Bài đăng theo tháng -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Xu hướng Tương tác Cộng đồng 12 Tháng</div>
            <div class="chart-card-subtitle">So sánh lượt bài viết check-in và số lượng nhóm chat hình thành</div>
          </div>
        </div>
        <div style="position:relative;height:260px;">
          <canvas id="communityTrendChart"></canvas>
        </div>
      </div>

    </div>

    <!-- ══════════ MODAL XEM TRƯỚC 360° BẢN ĐỒ ══════════ -->
    <div id="mapPreview360Modal" style="
      display:none; position:fixed; inset:0; z-index:10000;
      background:rgba(0,0,0,0.92); backdrop-filter:blur(10px);
      flex-direction:column; align-items:stretch;
    ">
      <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="tour360-badge"><i data-lucide="rotate-3d" style="width:12px;height:12px;"></i> Tour 360° Thực tế ảo</span>
          <span id="map360Title" style="font-size:14px;font-weight:700;color:var(--text-primary);"></span>
        </div>
        <button id="closeMap360" class="btn btn-secondary" style="padding:6px 14px;font-size:12px;">
          <i data-lucide="x" style="width:14px;height:14px;"></i> Đóng
        </button>
      </div>
      <div id="mapPanoramaViewer" style="flex:1;min-height:0;"></div>
    </div>

    <!-- Leaflet & Chart Logic Script -->
    <script>
      (function initMapAndAnalytics() {
        const rawDestinations = ${JSON.stringify(mockDestinations)};
        const provinceData = ${JSON.stringify(provinceData)};
        const typeData = ${JSON.stringify(Object.values(typeDistribution))};
        let map = null;
        let markersGroup = null;

        // Color mapper for location types
        const typeColors = {
          destination: '#38bdf8', // Light Blue
          tour: '#34d399',        // Emerald Green
          hotel: '#c084fc',       // Purple
          ticket: '#fbbf24'        // Amber Gold
        };

        const typeLabels = {
          destination: 'Điểm đến',
          tour: 'Tour du lịch',
          hotel: 'Khách sạn',
          ticket: 'Vé tham quan'
        };

        // Initialize Leaflet Map
        function renderMap() {
          const container = document.getElementById('vivuMap');
          if (!container || typeof L === 'undefined') return;

          // Center on Vietnam (coordinates approx 16.0, 107.5)
          map = L.map('vivuMap', {
            center: [15.8, 107.5],
            zoom: 6,
            zoomControl: true,
            scrollWheelZoom: true,
          });

          // OpenStreetMap Dark Theme Tiles (CartoDB Dark Matter)
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(map);

          markersGroup = L.layerGroup().addTo(map);
          populateMarkers('all', 'all');
        }

        // Create Custom HTML Pin Icon
        function createCustomPin(color) {
          return L.divIcon({
            className: 'custom-leaflet-pin',
            html: \`
              <div style="
                width: 22px; height: 22px;
                border-radius: 50%;
                background: \${color};
                border: 2px solid #ffffff;
                box-shadow: 0 0 12px \${color}, 0 2px 8px rgba(0,0,0,0.6);
                display: flex; align-items: center; justify-content: center;
                animation: pulsePin 2.5s infinite;
              ">
                <div style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff;"></div>
              </div>
            \`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
        }

        // Populate Map Markers
        function populateMarkers(zoneFilter, categoryFilter) {
          if (!markersGroup) return;
          markersGroup.clearLayers();

          const filtered = rawDestinations.filter(d => {
            const matchZone = zoneFilter === 'all' || d.zone === zoneFilter;
            const matchCat = categoryFilter === 'all' || d.type === categoryFilter;
            return matchZone && matchCat;
          });

          filtered.forEach(d => {
            if (!d.lat || !d.lng) return;
            const color = typeColors[d.type] || '#38bdf8';
            const pinIcon = createCustomPin(color);

            const popupContent = \`
              <div style="font-family:Inter,sans-serif;width:240px;padding:4px;">
                <img src="\${d.image}" style="width:100%;height:115px;object-fit:cover;border-radius:8px;margin-bottom:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                  <span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;background:\${color}22;color:\${color};border:1px solid \${color}44;">
                    \${typeLabels[d.type] || 'Địa điểm'}
                  </span>
                  <span style="font-size:11px;font-weight:700;color:#f59e0b;">★ \${d.rating}</span>
                </div>
                <div style="font-size:13px;font-weight:800;color:#f0f2ff;margin-bottom:2px;">\${d.title}</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">\${d.region} (\${d.zone || ''})</div>
                <div style="display:flex;align-items:center;justify-content:space-between;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);font-size:11px;">
                  <span style="color:#34d399;font-weight:800;">\${d.price}</span>
                  <span style="color:#64748b;">\${(d.checkins || 0).toLocaleString('vi-VN')} check-in</span>
                </div>
                \${d.hasTour360 ? \`
                  <button onclick="previewMap360('\${d.title}')" type="button" style="width:100%;margin-top:10px;padding:6px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i data-lucide="rotate-3d" style="width:12px;height:12px;"></i> Xem Tour 360° Thực tế ảo
                  </button>
                \` : ''}
              </div>
            \`;

            const marker = L.marker([d.lat, d.lng], { icon: pinIcon })
              .bindPopup(popupContent, { maxWidth: 260, className: 'vivu-custom-popup' });
            
            markersGroup.addLayer(marker);
          });
        }

        // Filters event listeners
        document.getElementById('mapZoneFilter')?.addEventListener('change', function() {
          const cat = document.getElementById('mapCategoryFilter').value;
          populateMarkers(this.value, cat);
        });

        document.getElementById('mapCategoryFilter')?.addEventListener('change', function() {
          const zone = document.getElementById('mapZoneFilter').value;
          populateMarkers(zone, this.value);
        });

        document.getElementById('btnResetMapView')?.addEventListener('click', () => {
          document.getElementById('mapZoneFilter').value = 'all';
          document.getElementById('mapCategoryFilter').value = 'all';
          map?.setView([15.8, 107.5], 6);
          populateMarkers('all', 'all');
        });

        function ensureChartReady(callback, attempts) {
          attempts = attempts || 0;
          if (typeof Chart !== 'undefined') {
            try { callback(); } catch(e) { console.error('Error rendering charts:', e); }
            return;
          }
          if (attempts === 3) {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
            document.head.appendChild(s);
          }
          if (attempts < 40) {
            setTimeout(function() { ensureChartReady(callback, attempts + 1); }, 150);
          }
        }

        // ── Render Charts ──
        function renderCharts() {
          ensureChartReady(function() {

          const baseOpts = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
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

          // ── Helper: Safe Chart Creator with Native Fallback ──
          function safeCreateChart(canvasEl, config, fallbackFn) {
            if (!canvasEl) return;
            try {
              if (typeof Chart !== 'undefined') {
                const existing = Chart.getChart(canvasEl);
                if (existing) existing.destroy();
                new Chart(canvasEl.getContext('2d'), config);
                return;
              }
            } catch(e) {
              console.warn('Chart.js warning, using native fallback:', e);
            }
            if (typeof fallbackFn === 'function') {
              fallbackFn(canvasEl);
            }
          }

          function drawAnalyticsNativeRadar(canvas) {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const labels = ['Phủ sóng 3 Miền', 'Khách hàng', 'Bài viết Cộng đồng', 'Tỷ lệ Tour 360°', 'An toàn Nội dung', 'Bán vé & Tours'];
            const values = [98, 92, 88, 86, 96, 90];
            
            const rect = canvas.getBoundingClientRect();
            const w = rect.width || canvas.parentElement.offsetWidth || 360;
            const h = rect.height || canvas.parentElement.offsetHeight || 260;
            canvas.width = w * (window.devicePixelRatio || 1);
            canvas.height = h * (window.devicePixelRatio || 1);
            ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

            const cx = w / 2;
            const cy = h / 2;
            const radius = Math.min(cx, cy) - 35;
            const n = labels.length;

            ctx.clearRect(0, 0, w, h);

            [0.2, 0.4, 0.6, 0.8, 1.0].forEach(level => {
              ctx.beginPath();
              for (let i = 0; i < n; i++) {
                const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
                const x = cx + radius * level * Math.cos(angle);
                const y = cy + radius * level * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.closePath();
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
              ctx.lineWidth = 1;
              ctx.stroke();
            });

            for (let i = 0; i < n; i++) {
              const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
              const x = cx + radius * Math.cos(angle);
              const y = cy + radius * Math.sin(angle);

              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(x, y);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
              ctx.stroke();

              const lx = cx + (radius + 16) * Math.cos(angle);
              const ly = cy + (radius + 16) * Math.sin(angle);
              ctx.fillStyle = '#94a3b8';
              ctx.font = 'bold 10px Inter, sans-serif';
              ctx.textAlign = Math.abs(Math.cos(angle)) < 0.1 ? 'center' : (Math.cos(angle) > 0 ? 'left' : 'right');
              ctx.textBaseline = Math.abs(Math.sin(angle)) < 0.1 ? 'middle' : (Math.sin(angle) > 0 ? 'top' : 'bottom');
              ctx.fillText(labels[i] + ' (' + values[i] + '%)', lx, ly);
            }

            ctx.beginPath();
            for (let i = 0; i < n; i++) {
              const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
              const val = Math.min(100, Math.max(0, values[i])) / 100;
              const x = cx + radius * val * Math.cos(angle);
              const y = cy + radius * val * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(34, 211, 238, 0.30)';
            ctx.fill();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            for (let i = 0; i < n; i++) {
              const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
              const val = Math.min(100, Math.max(0, values[i])) / 100;
              const x = cx + radius * val * Math.cos(angle);
              const y = cy + radius * val * Math.sin(angle);

              ctx.beginPath();
              ctx.arc(x, y, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#818cf8';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }

          // Chart 1: Province Bar Chart
          const pEl = document.getElementById('provinceCheckinChart');
          safeCreateChart(pEl, {
            type: 'bar',
            data: {
              labels: provinceData.slice(0, 8).map(p => p.name),
              datasets: [{
                label: 'Lượt Check-in',
                data: provinceData.slice(0, 8).map(p => p.checkins),
                backgroundColor: 'rgba(99, 102, 241, 0.75)',
                borderColor: '#818cf8',
                borderWidth: 1,
                borderRadius: 6,
              }]
            },
            options: {
              ...baseOpts,
              plugins: {
                legend: { display: false },
                tooltip: { ...tooltipStyle, callbacks: { label: c => ' ' + c.raw.toLocaleString('vi-VN') + ' lượt check-in' } }
              },
              scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8892b8', font: { size: 11, weight: '600' } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8892b8', font: { size: 10 } } }
              }
            }
          });

          // Chart 2: Service Type Doughnut Chart
          const tEl = document.getElementById('serviceTypeChart');
          safeCreateChart(tEl, {
            type: 'doughnut',
            data: {
              labels: ['Điểm đến', 'Khách sạn', 'Tour du lịch', 'Vé tham quan'],
              datasets: [{
                data: typeData,
                backgroundColor: ['#38bdf8', '#c084fc', '#34d399', '#fbbf24'],
                borderColor: '#04040c',
                borderWidth: 3,
              }]
            },
            options: {
              ...baseOpts,
              cutout: '68%',
              plugins: { legend: { display: false }, tooltip: tooltipStyle }
            }
          });

          // Chart 3: System Radar Chart v2
          const rEl = document.getElementById('analyticsRadarChart');
          safeCreateChart(rEl, {
            type: 'radar',
            data: {
              labels: ['Phủ sóng 3 Miền', 'Khách hàng', 'Bài viết Cộng đồng', 'Tỷ lệ Tour 360°', 'An toàn Nội dung', 'Bán vé & Tours'],
              datasets: [{
                label: 'Điểm sức khỏe (%)',
                data: [98, 92, 88, 86, 96, 90],
                backgroundColor: 'rgba(34, 211, 238, 0.25)',
                borderColor: '#22d3ee',
                borderWidth: 2.5,
                pointBackgroundColor: '#818cf8',
                pointRadius: 4,
              }]
            },
            options: {
              ...baseOpts,
              scales: {
                r: {
                  angleLines: { color: 'rgba(255, 255, 255, 0.12)' },
                  grid: { color: 'rgba(255, 255, 255, 0.08)' },
                  pointLabels: { color: '#94a3b8', font: { size: 10, weight: '700' } },
                  ticks: { display: false },
                  suggestedMin: 0, suggestedMax: 100
                }
              },
              plugins: { legend: { display: false }, tooltip: tooltipStyle }
            }
          }, drawAnalyticsNativeRadar);

          // Chart 4: Community Trend Line Area Chart
          const cEl = document.getElementById('communityTrendChart');
          if (cEl) {
            const ctx = cEl.getContext('2d');
            const grad = ctx.createLinearGradient(0, 0, 0, 240);
            grad.addColorStop(0, 'rgba(52, 211, 153, 0.35)');
            grad.addColorStop(1, 'rgba(52, 211, 153, 0.00)');

            new Chart(cEl, {
              type: 'line',
              data: {
                labels: ['T8','T9','T10','T11','T12','T1','T2','T3','T4','T5','T6','T7'],
                datasets: [{
                  label: 'Bài viết Check-in',
                  data: [120, 185, 240, 310, 420, 390, 510, 680, 740, 890, 1020, ${allPostsCount * 12}],
                  borderColor: '#34d399',
                  backgroundColor: grad,
                  fill: true,
                  tension: 0.4,
                  borderWidth: 2.5,
                  pointRadius: 3,
                }]
              },
              options: {
                ...baseOpts,
                plugins: { legend: { display: false }, tooltip: tooltipStyle },
                scales: {
                  x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8892b8', font: { size: 10 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8892b8', font: { size: 10 } } }
                }
              }
            });
          }
          }); // end ensureChartReady
        }

        // Export CSV Handler
        document.getElementById('btnExportCSVAnalytics')?.addEventListener('click', () => {
          const rows = [
            ["ID", "Ten Dia Diem", "Tinh Thanh", "Mien", "Vi Do (Lat)", "Kinh Do (Lng)", "Rating", "Checkins", "Loai Hinh", "Co 360"],
            ...rawDestinations.map(d => [
              d.id,
              \`"\${d.title.replace(/"/g, '""')}"\`,
              \`"\${d.region}"\`,
              \`"\${d.zone || ''}"\`,
              d.lat || 0,
              d.lng || 0,
              d.rating,
              d.checkins || 0,
              d.type,
              d.hasTour360 ? "Co" : "Khong"
            ])
          ];

          const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', 'Vivu360_Geospatial_Analytics_Report.csv');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });

        // Export Map Image Handler
        document.getElementById('btnExportMapImage')?.addEventListener('click', () => {
          alert('💡 Mẹo: Bạn có thể lưu bản đồ bằng cách bấm nút chụp màn hình hoặc in file PDF báo cáo.');
        });

        function initialPaintAnalytics() {
          const rEl = document.getElementById('analyticsRadarChart');
          if (rEl && typeof drawAnalyticsNativeRadar === 'function') {
            drawAnalyticsNativeRadar(rEl);
          }
          renderMap();
          renderCharts();
        }

        // Initialize Map and Charts on page load
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(initialPaintAnalytics, 10);
        } else {
          document.addEventListener('DOMContentLoaded', initialPaintAnalytics);
        }
      })();

      // Global function for 360 preview from map popup
      let mapViewer = null;
      window.previewMap360 = function(title) {
        document.getElementById('map360Title').textContent = title;
        document.getElementById('mapPreview360Modal').style.display = 'flex';
        if (mapViewer) { try { mapViewer.destroy(); } catch(e){} mapViewer = null; }
        setTimeout(() => {
          mapViewer = pannellum.viewer('mapPanoramaViewer', {
            type: 'equirectangular',
            panorama: 'https://pannellum.org/images/cerro-toco-0.jpg',
            autoLoad: true,
            autoRotate: -2,
            compass: false,
            showControls: true
          });
        }, 100);
      };

      document.getElementById('closeMap360')?.addEventListener('click', () => {
        document.getElementById('mapPreview360Modal').style.display = 'none';
        if (mapViewer) { try { mapViewer.destroy(); } catch(e){} mapViewer = null; }
      });
    </script>
  `;

  res.render('layouts/main', { title: 'Bản đồ Thống kê & Biểu đồ Tổng quan', body });
});

module.exports = router;
