const express = require('express');
const router = express.Router();
const { hasPermission, requirePermission } = require('../middleware/rbac');
const { getConfigFromFirebase, saveConfigToFirebase } = require('../config/firebase');

// Config state (in-memory)
const config = {
  features: {
    chat_groups:    { label: 'Chat nhóm',          enabled: true  },
    tour_360:       { label: 'Tour 360°',           enabled: true  },
    points_system:  { label: 'Hệ thống điểm',       enabled: true  },
    flash_sale:     { label: 'Flash Sale',           enabled: false },
    ai_recommend:   { label: 'Gợi ý AI',            enabled: true  },
    dark_mode:      { label: 'Dark Mode (App)',      enabled: true  },
  },
  remoteConfig: {
    forceUpdate:       false,
    minVersion:        '2.0.0',
    maintenanceMode:   false,
    maintenanceMsg:    'Hệ thống đang bảo trì, vui lòng thử lại sau.',
    appStoreUrl:       'https://apps.apple.com/app/vivu360',
    playStoreUrl:      'https://play.google.com/store/apps/details?id=vn.vivu360',
  },
  aiConfig: {
    model:         'gemini-2.0-flash',
    temperature:   0.7,
    maxTokens:     1024,
    systemPrompt:  'Bạn là trợ lý du lịch thông minh của Vivu360. Hãy gợi ý địa điểm du lịch, lộ trình, và các mẹo hữu ích cho người dùng Việt Nam.',
  },
  apiKeys: {
    firebaseKey:   'AIzaSy********************mock',
    mapboxKey:     'pk.eyJ1Ijoidml2dTM2MCJ9.**mock',
    geminiKey:     'AIzaSy********************mock',
  },
};

router.get('/', async (req, res) => {
  const { msg = '' } = req.query;
  const userRole = req.session.user.role;

  // Load configuration from Firebase if connected
  const currentConfig = await getConfigFromFirebase(config);
  Object.assign(config, currentConfig);

  const canFeatureFlags = hasPermission(userRole, 'feature_flags');
  const canRemoteConfig = hasPermission(userRole, 'config.remote');
  const canAiConfig = hasPermission(userRole, 'config.ai');
  const isSuperAdmin = userRole === 'super_admin';

  let featureFlagsHtml = '';
  if (canFeatureFlags) {
    const featureToggles = Object.entries(config.features).map(([key, f]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${f.label}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Khoá: <code style="font-size:10px">${key}</code></div>
        </div>
        <form method="POST" action="/config/feature/${key}/toggle" style="margin:0;">
          <button type="submit" style="
            width:44px;height:24px;border-radius:100px;border:none;cursor:pointer;
            background:${f.enabled ? 'var(--green)' : 'var(--bg-input)'};
            border:1px solid ${f.enabled ? 'transparent' : 'var(--border)'};
            position:relative;transition:all .25s;
          ">
            <span style="
              display:block;width:16px;height:16px;border-radius:50%;background:white;
              position:absolute;top:3px;transition:left .25s;
              left:${f.enabled ? 'calc(100% - 20px)' : '3px'};
              box-shadow:0 1px 4px rgba(0,0,0,.3);
            "></span>
          </button>
        </form>
      </div>`).join('');

    featureFlagsHtml = `
      <!-- Feature Flags -->
      <div class="data-card" style="padding:20px 24px;">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:6px;display:flex;align-items:center;gap:8px;">
          <i data-lucide="toggle-right" style="width:16px;height:16px;color:var(--accent)"></i> Feature Flags
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">Bật/tắt tính năng trên app mà không cần deploy lại</div>
        ${featureToggles}
      </div>
    `;
  }

  let remoteConfigHtml = '';
  if (canRemoteConfig) {
    remoteConfigHtml = `
      <!-- Remote Config -->
      <div class="data-card" style="padding:20px 24px;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i data-lucide="settings-2" style="width:16px;height:16px;color:var(--yellow)"></i> Remote Config
        </div>
        <form method="POST" action="/config/remote/save" style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-input);border-radius:var(--radius-sm);">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--text-primary)">Force Update</div>
              <div style="font-size:11px;color:var(--text-dim)">Bắt buộc người dùng cập nhật app</div>
            </div>
            <label style="cursor:pointer;">
              <input type="checkbox" name="forceUpdate" ${config.remoteConfig.forceUpdate?'checked':''} style="width:16px;height:16px;accent-color:var(--accent);">
            </label>
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px">Phiên bản tối thiểu</label>
            <input name="minVersion" value="${config.remoteConfig.minVersion}" style="width:100%;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-input);border-radius:var(--radius-sm);">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--text-primary)">Maintenance Mode</div>
              <div style="font-size:11px;color:var(--text-dim)">Hiển thị màn hình bảo trì toàn app</div>
            </div>
            <label style="cursor:pointer;">
              <input type="checkbox" name="maintenanceMode" ${config.remoteConfig.maintenanceMode?'checked':''} style="width:16px;height:16px;accent-color:var(--red);">
            </label>
          </div>
          <div>
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px">Thông báo bảo trì</label>
            <input name="maintenanceMsg" value="${config.remoteConfig.maintenanceMsg}" style="width:100%;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
          </div>
          <button type="submit" class="btn btn-primary btn-sm" style="align-self:flex-end;">
            <i data-lucide="save" style="width:13px;height:13px"></i> Lưu cấu hình
          </button>
        </form>
      </div>
    `;
  }

  let aiConfigHtml = '';
  if (canAiConfig) {
    aiConfigHtml = `
      <!-- AI Config -->
      <div class="data-card" style="padding:20px 24px;margin-bottom:20px;">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i data-lucide="brain" style="width:16px;height:16px;color:var(--purple)"></i> Cấu hình AI
          <span style="font-size:10px;color:var(--text-dim);font-weight:500">Tinh chỉnh model AI trong app</span>
        </div>
        <form method="POST" action="/config/ai/save">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;">
            <div>
              <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px">Model AI</label>
              <select name="model" style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;font-family:Inter,sans-serif;outline:none;">
                <option value="gemini-2.0-flash" ${config.aiConfig.model==='gemini-2.0-flash'?'selected':''}>Gemini 2.0 Flash</option>
                <option value="gemini-2.5-pro" ${config.aiConfig.model==='gemini-2.5-pro'?'selected':''}>Gemini 2.5 Pro</option>
                <option value="gpt-4o" ${config.aiConfig.model==='gpt-4o'?'selected':''}>GPT-4o</option>
              </select>
            </div>
            <div>
              <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px">Temperature (0–2)</label>
              <input name="temperature" type="number" min="0" max="2" step="0.1" value="${config.aiConfig.temperature}"
                style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
            </div>
            <div>
              <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px">Max Tokens</label>
              <input name="maxTokens" type="number" min="256" max="8192" value="${config.aiConfig.maxTokens}"
                style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;">
            </div>
          </div>
          <div style="margin-bottom:14px;">
            <label style="font-size:10px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:5px">System Prompt</label>
            <textarea name="systemPrompt" rows="4" style="width:100%;padding:9px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:Inter,sans-serif;outline:none;resize:vertical;">${config.aiConfig.systemPrompt}</textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;">
            <button type="submit" class="btn btn-primary btn-sm"><i data-lucide="save" style="width:13px;height:13px"></i> Lưu cấu hình AI</button>
          </div>
        </form>
      </div>
    `;
  }

  let apiKeysHtml = '';
  if (isSuperAdmin) {
    apiKeysHtml = `
      <!-- API Keys -->
      <div class="data-card" style="padding:20px 24px;">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i data-lucide="key-round" style="width:16px;height:16px;color:var(--orange)"></i> API Keys
          <span style="font-size:11px;color:var(--text-dim);font-weight:500">Chỉ đọc — liên hệ Super Admin để thay đổi</span>
        </div>
        ${Object.entries(config.apiKeys).map(([k, v]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="min-width:130px;font-size:12px;font-weight:700;color:var(--text-secondary)">${k}</div>
            <code id="key-${k}" style="flex:1;font-size:11px;color:var(--text-muted);background:var(--bg-input);padding:5px 10px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</code>
            <button class="btn btn-icon" style="width:28px;height:28px" onclick="navigator.clipboard.writeText('${v}');this.innerHTML='<i data-lucide=\\"check\\" style=\\"width:12px;height:12px;color:var(--green)\\"></i>';setTimeout(()=>{this.innerHTML='<i data-lucide=\\"copy\\" style=\\"width:12px;height:12px\\"></i>';if(typeof lucide!==\\'undefined\\')lucide.createIcons();},2000);if(typeof lucide!=='undefined')lucide.createIcons();" data-tooltip="Copy">
              <i data-lucide="copy" style="width:12px;height:12px"></i>
            </button>
          </div>`).join('')}
      </div>
    `;
  }

  // Build layout structure based on permissions
  let mainGridContent = '';
  if (canFeatureFlags && canRemoteConfig) {
    mainGridContent = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
        ${featureFlagsHtml}
        <div>${remoteConfigHtml}</div>
      </div>
    `;
  } else {
    mainGridContent = `
      <div style="display:grid;grid-template-columns:1fr;gap:20px;margin-bottom:20px;">
        ${featureFlagsHtml}
        ${remoteConfigHtml}
      </div>
    `;
  }

  const body = `
    ${msg === 'saved' ? `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--green-bg);border:1px solid rgba(34,197,94,.2);border-radius:var(--radius-sm);margin-bottom:20px;color:var(--green);font-size:13px;font-weight:600;"><i data-lucide="check-circle" style="width:16px;height:16px"></i> Cấu hình đã được lưu!</div>` : ''}

    <div class="page-title-row">
      <div class="page-title"><h1>Cấu hình Hệ thống</h1><p>Remote Config, Feature Flags & Tích hợp API</p></div>
    </div>

    ${mainGridContent}
    ${aiConfigHtml}
    ${apiKeysHtml}
  `;

  res.render('layouts/main', { title: 'System Config', body });
});

router.post('/feature/:key/toggle', requirePermission('feature_flags'), async (req, res) => {
  const key = req.params.key;
  if (config.features[key]) {
    config.features[key].enabled = !config.features[key].enabled;
    await saveConfigToFirebase(config);
  }
  res.redirect('/config?msg=saved');
});

router.post('/remote/save', requirePermission('config.remote'), async (req, res) => {
  config.remoteConfig.forceUpdate     = !!req.body.forceUpdate;
  config.remoteConfig.minVersion      = req.body.minVersion || config.remoteConfig.minVersion;
  config.remoteConfig.maintenanceMode = !!req.body.maintenanceMode;
  config.remoteConfig.maintenanceMsg  = req.body.maintenanceMsg || config.remoteConfig.maintenanceMsg;
  await saveConfigToFirebase(config);
  res.redirect('/config?msg=saved');
});

router.post('/ai/save', requirePermission('config.ai'), async (req, res) => {
  config.aiConfig.model        = req.body.model        || config.aiConfig.model;
  config.aiConfig.temperature  = parseFloat(req.body.temperature) || config.aiConfig.temperature;
  config.aiConfig.maxTokens    = parseInt(req.body.maxTokens)     || config.aiConfig.maxTokens;
  config.aiConfig.systemPrompt = req.body.systemPrompt || config.aiConfig.systemPrompt;
  await saveConfigToFirebase(config);
  res.redirect('/config?msg=saved');
});

module.exports = router;

