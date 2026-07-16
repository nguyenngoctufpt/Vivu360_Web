/**
 * Admin Vivu360 — Client-side JavaScript v2
 * Tính năng: sidebar toggle, search, toast, confirm dialog, keyboard shortcuts,
 *            notification dropdown, loading state, refresh
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────────────────────
  // 1. Lucide Icons
  // ─────────────────────────────────────────────────────────────
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // ─────────────────────────────────────────────────────────────
  // 2. Sidebar Toggle (Mobile + Desktop collapse)
  // ─────────────────────────────────────────────────────────────
  const sidebar        = document.querySelector('.sidebar');
  const sidebarOverlay = document.querySelector('.sidebar-overlay');
  const toggleBtn      = document.getElementById('sidebarToggleBtn');

  function openSidebar()  { sidebar?.classList.add('open');    sidebarOverlay?.classList.add('active'); }
  function closeSidebar() { sidebar?.classList.remove('open'); sidebarOverlay?.classList.remove('active'); }

  toggleBtn?.addEventListener('click', () => sidebar?.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay?.addEventListener('click', closeSidebar);

  // ─────────────────────────────────────────────────────────────
  // 3. Refresh button
  // ─────────────────────────────────────────────────────────────
  const refreshBtn = document.getElementById('refreshPageBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('i');
      icon?.setAttribute('style', 'width:15px;height:15px;animation:spin 0.7s linear infinite;');
      setTimeout(() => location.reload(), 200);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Notification Dropdown
  // ─────────────────────────────────────────────────────────────
  const bellBtn       = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');

  if (bellBtn && notifDropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = notifDropdown.style.display !== 'none';
      notifDropdown.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        // Hide dot on open
        document.getElementById('notifDot')?.remove();
      }
    });
    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && e.target !== bellBtn) {
        notifDropdown.style.display = 'none';
      }
    });

    // Row hover effect for notifications
    document.querySelectorAll('.notif-item-row').forEach(row => {
      row.addEventListener('mouseover', () => row.style.background = 'rgba(99,102,241,0.055)');
      row.addEventListener('mouseout',  () => row.style.background = 'transparent');
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Global Quick Search (header search → filters table rows)
  // ─────────────────────────────────────────────────────────────
  const searchInput = document.getElementById('tableSearch');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase().trim();
        const rows  = document.querySelectorAll('.data-table tbody tr');
        let visible = 0;
        rows.forEach(row => {
          const match = row.textContent.toLowerCase().includes(query);
          row.style.display = match ? '' : 'none';
          if (match) visible++;
        });
        // Show result count hint
        const hint = document.getElementById('searchHint');
        if (hint) hint.textContent = query ? `${visible} kết quả` : '';
      }, 150);
    });

    // Esc clears search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.blur();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Toast Notification System (premium style)
  // ─────────────────────────────────────────────────────────────
  window.showToast = function(message, type = 'success', duration = 3500) {
    // Remove existing
    document.querySelectorAll('.vv-toast').forEach(t => t.remove());

    const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    const colors = {
      success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', text: '#10b981' },
      error:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.28)',  text: '#f43f5e' },
      warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', text: '#f59e0b' },
      info:    { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.28)', text: '#818cf8' },
    };
    const c = colors[type] || colors.success;

    const toast = document.createElement('div');
    toast.className = 'vv-toast';
    toast.style.cssText = `
      position:fixed; bottom:24px; right:24px;
      padding:12px 18px;
      background:${c.bg};
      border:1px solid ${c.border};
      backdrop-filter:blur(16px);
      -webkit-backdrop-filter:blur(16px);
      color:${c.text};
      font-size:13px; font-weight:700; font-family:'Inter',sans-serif;
      border-radius:12px;
      box-shadow:0 16px 48px rgba(0,0,0,0.5);
      z-index:99999;
      display:flex; align-items:center; gap:9px;
      min-width:220px; max-width:360px;
      animation:toastSlideIn 0.32s cubic-bezier(0.34,1.56,0.64,1);
      cursor:pointer;
    `;
    toast.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="${c.text}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        ${type === 'success' ? '<polyline points="20 6 9 17 4 12"></polyline>'
          : type === 'error' ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
          : type === 'warning' ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
          : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
        }
      </svg>
      <span style="flex:1;">${message}</span>
    `;
    toast.addEventListener('click', () => dismissToast(toast));
    document.body.appendChild(toast);

    function dismissToast(el) {
      el.style.animation = 'toastSlideOut 0.25s ease-in forwards';
      setTimeout(() => el.remove(), 250);
    }
    setTimeout(() => dismissToast(toast), duration);
    return toast;
  };

  // ─────────────────────────────────────────────────────────────
  // 7. Confirm Dialog (replaces window.confirm)
  // ─────────────────────────────────────────────────────────────
  window.showConfirm = function({ title = 'Xác nhận', message = '', confirmText = 'Xác nhận', danger = false } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:99998;
        background:rgba(0,0,0,0.72);
        backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
        display:flex;align-items:center;justify-content:center;padding:20px;
      `;
      overlay.innerHTML = `
        <div style="
          background:linear-gradient(150deg,rgba(10,10,24,0.99),rgba(7,7,18,0.97));
          border:1px solid rgba(99,102,241,0.2);
          border-radius:20px; max-width:400px; width:100%;
          box-shadow:0 32px 80px rgba(0,0,0,0.65);
          animation:scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1);
          overflow:hidden;
        ">
          <div style="padding:22px 26px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;border-radius:11px;
                background:${danger ? 'rgba(244,63,94,0.12)' : 'rgba(99,102,241,0.12)'};
                display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="${danger ? '#f43f5e' : '#818cf8'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  ${danger
                    ? '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>'
                    : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
                  }
                </svg>
              </div>
              <div>
                <div style="font-size:15px;font-weight:800;color:#eef0ff;">${title}</div>
                <div style="font-size:12px;color:#8892b8;margin-top:2px;">${message}</div>
              </div>
            </div>
          </div>
          <div style="padding:16px 26px;display:flex;justify-content:flex-end;gap:10px;">
            <button id="confirmCancelBtn" style="
              padding:9px 18px;border-radius:10px;font-size:12px;font-weight:700;
              background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);
              color:#8892b8;cursor:pointer;font-family:Inter,sans-serif;transition:all 0.2s;">
              Hủy bỏ
            </button>
            <button id="confirmOkBtn" style="
              padding:9px 18px;border-radius:10px;font-size:12px;font-weight:700;
              background:${danger ? 'linear-gradient(135deg,#f43f5e,#e11d48)' : 'linear-gradient(135deg,#6366f1,#4f46e5)'};
              border:none;color:white;cursor:pointer;font-family:Inter,sans-serif;
              box-shadow:0 4px 16px ${danger ? 'rgba(244,63,94,0.35)' : 'rgba(99,102,241,0.35)'};
              transition:all 0.2s;">
              ${confirmText}
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#confirmCancelBtn').addEventListener('click', () => { overlay.remove(); resolve(false); });
      overlay.querySelector('#confirmOkBtn').addEventListener('click',    () => { overlay.remove(); resolve(true); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  };

  // ─────────────────────────────────────────────────────────────
  // 8. Toggle status (lock/unlock user)
  // ─────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.id;
      const currentStatus = btn.dataset.currentStatus;
      const action = currentStatus === 'active' ? 'khóa' : 'mở khóa';

      const confirmed = await showConfirm({
        title: `${currentStatus === 'active' ? 'Khóa' : 'Mở khóa'} tài khoản`,
        message: `Bạn có chắc muốn ${action} tài khoản này?`,
        confirmText: currentStatus === 'active' ? 'Khóa tài khoản' : 'Mở khóa',
        danger: currentStatus === 'active',
      });
      if (!confirmed) return;

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/users/${uid}/toggle-status`;
      document.body.appendChild(form);
      form.submit();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Toggle post visibility
  // ─────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-action="toggle-post"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/posts/${id}/toggle`;
      document.body.appendChild(form);
      form.submit();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10. Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // '/' → focus search
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      searchInput?.focus();
    }
    // 'g u' → go to users (two-key chord)
    if (e.altKey && e.key === 'u') { window.location.href = '/users'; }
    if (e.altKey && e.key === 'p') { window.location.href = '/posts'; }
    if (e.altKey && e.key === 'd') { window.location.href = '/dashboard'; }
    // Ctrl/Cmd + R → refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { /* browser default is fine */ }
  });

  // ─────────────────────────────────────────────────────────────
  // 11. Auto-hide success/alert-bar after 4s
  // ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.alert-bar').forEach(bar => {
    setTimeout(() => {
      bar.style.transition = 'opacity 0.5s ease, max-height 0.5s ease, margin 0.5s ease';
      bar.style.opacity = '0';
      bar.style.maxHeight = '0';
      bar.style.marginBottom = '0';
      bar.style.overflow = 'hidden';
      setTimeout(() => bar.remove(), 500);
    }, 4000);
  });

  // ─────────────────────────────────────────────────────────────
  // 12. Row Click → open detail (UX improvement)
  // ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.data-table tbody tr').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', (e) => {
      // Only trigger if not clicking a button/link
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('form')) return;
      const viewBtn = row.querySelector('[data-action="view-user"]');
      if (viewBtn) viewBtn.click();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 13. Toast & animation CSS injection
  // ─────────────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes toastSlideIn {
      from { opacity:0; transform:translateX(20px) scale(0.92); }
      to   { opacity:1; transform:translateX(0)    scale(1);    }
    }
    @keyframes toastSlideOut {
      from { opacity:1; transform:translateX(0)    scale(1);    }
      to   { opacity:0; transform:translateX(20px) scale(0.88); }
    }
    @keyframes scaleIn {
      from { opacity:0; transform:scale(0.92) translateY(12px); }
      to   { opacity:1; transform:scale(1)    translateY(0);    }
    }
    @keyframes spin {
      from { transform:rotate(0deg); }
      to   { transform:rotate(360deg); }
    }
    .data-table tbody tr { cursor:pointer; }
    .data-table tbody tr:hover td { color:var(--text-primary); }
    .notif-item-row:hover { background:rgba(99,102,241,0.055)!important; }
    .header-search input { transition:width 0.22s cubic-bezier(0.4,0,0.2,1), border-color 0.2s, box-shadow 0.2s, background 0.2s; }
    [data-tooltip]::after { font-family:'Inter',sans-serif; }
  `;
  document.head.appendChild(styleEl);

  // ─────────────────────────────────────────────────────────────
  // 14. Dynamic icons
  // ─────────────────────────────────────────────────────────────
  // Không theo dõi toàn bộ DOM ở đây. createIcons() thay <i> bằng <svg>, và
  // thay đổi đó lại kích hoạt MutationObserver, gây vòng lặp render 100% CPU.
  // Các thành phần động hiện dùng SVG trực tiếp hoặc tự gọi createIcons().

  // ─────────────────────────────────────────────────────────────
  // 15. Show keyboard shortcut hint on first visit
  // ─────────────────────────────────────────────────────────────
  if (!sessionStorage.getItem('shortcutHintShown')) {
    sessionStorage.setItem('shortcutHintShown', '1');
    setTimeout(() => {
      showToast('Nhấn <kbd style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:4px;font-family:monospace;">/</kbd> để tìm kiếm nhanh', 'info', 5000);
    }, 1200);
  }
});
