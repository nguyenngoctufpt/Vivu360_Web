const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbac');
const { mockChatGroups } = require('../config/firebase');

const chatEmoji = ['💬', '🏮', '🏖️', '⛰️', '🔒'];

// In-memory messages store for chat groups moderation
const mockMessages = {
  g001: [
    { id: 'm1', sender: 'Nguyễn Minh', text: 'Ai đi Hạ Long tháng 7 ghép nhóm không?', time: '2026-07-01 22:30' },
    { id: 'm2', sender: 'Võ Ngọc Hà', text: 'Mình cũng đang tìm nhóm đi tuần thứ 2 của tháng 7 nè.', time: '2026-07-01 22:35' },
    { id: 'm3', sender: 'Trần Thị Lan', text: 'Có ai đặt du thuyền chưa, cho mình xin review với.', time: '2026-07-01 22:40' },
  ],
  g002: [
    { id: 'm4', sender: 'Trần Thị Lan', text: 'Quán cơm gà nào ngon nhất Hội An vậy mọi người?', time: '2026-07-01 21:15' },
    { id: 'm5', sender: 'Nguyễn Minh', text: 'Bạn ghé thử cơm gà Bà Buội ở Phan Chu Trinh nhé, ngon nhức nách!', time: '2026-07-01 21:20' },
  ],
  g003: [
    { id: 'm6', sender: 'Hoàng Văn Tùng', text: 'Review resort vừa ở xong nè, đẹp lắm!', time: '2026-07-01 20:45' },
    { id: 'm7', sender: 'Lê Hoàng Nam', text: 'Resort tên gì vậy bạn ơi, giá phòng thế nào?', time: '2026-07-01 20:50' },
  ],
  g004: [
    { id: 'm8', sender: 'Lê Hoàng Nam', text: 'Mùa này đi trek Fansipan được không?', time: '2026-06-30 18:00' },
    { id: 'm9', sender: 'Võ Ngọc Hà', text: 'Mưa nhiều lắm, đi nguy hiểm đấy bạn, nên hoãn lại.', time: '2026-06-30 18:15' },
  ],
  g005: [
    { id: 'm10', sender: 'user_test', text: 'abc', time: '2026-06-25 10:00' },
    { id: 'm11', sender: 'spammer', text: 'Mua bán coin, cam kết x10 tài khoản link tại đây...', time: '2026-06-25 10:02' },
  ],
};

router.get('/', (req, res) => {
  const chatRows = mockChatGroups.map((g, i) => `
    <div class="chat-row">
      <div class="chat-avatar">${chatEmoji[i] || '💬'}</div>
      <div class="chat-info">
        <div class="chat-name">
          ${g.name}
          ${g.status === 'locked' ? '<span class="badge-status locked" style="margin-left: 8px; font-size: 9px;">Đã khóa</span>' : ''}
        </div>
        <div class="chat-last-msg"><strong>${g.lastSender}:</strong> ${g.lastMessage}</div>
      </div>
      <div class="chat-meta">
        <div class="chat-time">${g.lastTime}</div>
        <div class="chat-members">${g.members} thành viên</div>
      </div>
      <div class="action-btns" style="margin-left: 12px;">
        <button class="btn btn-icon" data-action="view-chat" data-id="${g.id}" data-name="${g.name}" data-tooltip="Xem nhóm">
          <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
        </button>
        <button class="btn btn-icon" data-action="toggle-status" data-id="${g.id}" data-current-status="${g.status}" data-tooltip="${g.status === 'active' ? 'Khóa nhóm' : 'Mở khóa'}">
          <i data-lucide="${g.status === 'active' ? 'lock' : 'unlock'}" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    </div>
  `).join('');

  const body = `
    <div class="page-title-row">
      <div class="page-title">
        <h1>Quản lý nhóm chat</h1>
        <p>Danh sách ${mockChatGroups.length} nhóm chat cộng đồng</p>
      </div>
    </div>

    <div class="data-card">
      ${chatRows}
    </div>

    <!-- ══════════ MODAL CHI TIẾT TIN NHẮN NHÓM CHAT ══════════ -->
    <div id="chatMessagesModal" style="
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.7); backdrop-filter:blur(8px);
      align-items:center; justify-content:center; padding:20px;
    ">
      <div style="
        background:var(--bg-card); border:1px solid var(--border-hover);
        border-radius:var(--radius-lg); width:100%; max-width:540px;
        box-shadow:0 32px 80px rgba(0,0,0,0.6);
        animation:fadeIn 0.2s ease-out; overflow:hidden;
      ">
        <div style="padding:20px 28px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text-primary);">
              <i data-lucide="message-square" style="width:18px;height:18px;color:var(--accent);vertical-align:middle;margin-right:8px;"></i>
              Kiểm duyệt tin nhắn nhóm
            </div>
            <div id="modalChatGroupName" style="font-size:12px;color:var(--text-muted);margin-top:4px;"></div>
          </div>
          <button id="closeChatModal" class="btn btn-icon"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
        </div>
        <div style="padding:20px 28px; max-height:360px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;" id="chatMessagesList">
        </div>
        <div style="padding:16px 28px; border-top:1px solid var(--border); display:flex; justify-content:flex-end;">
          <button id="closeChatModalBtn" class="btn btn-secondary">Đóng</button>
        </div>
      </div>
    </div>

    <script>
      // Toggle group status
      document.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = \`/chat/\${id}/toggle\`;
          document.body.appendChild(form);
          form.submit();
        });
      });

      // Render group messages in modal
      const messagesData = ${JSON.stringify(mockMessages)};
      const chatModal = document.getElementById('chatMessagesModal');
      const msgList = document.getElementById('chatMessagesList');

      document.querySelectorAll('[data-action="view-chat"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const name = btn.dataset.name;
          document.getElementById('modalChatGroupName').textContent = name;
          const msgs = messagesData[id] || [];
          
          if (msgs.length === 0) {
            msgList.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px 0;">Không có tin nhắn nào.</div>';
          } else {
            msgList.innerHTML = msgs.map(m => \`
              <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);gap:12px;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:700;color:var(--text-primary);font-size:12px;">\${m.sender}</span>
                    <span style="color:var(--text-dim);font-size:10px;">\${m.time}</span>
                  </div>
                  <div style="color:var(--text-secondary);font-size:13px;margin-top:4px;word-break:break-word;">\${m.text}</div>
                </div>
                <form method="POST" action="/chat/\${id}/message/\${m.id}/delete" style="margin:0;">
                  <button type="submit" class="btn btn-icon" style="color:var(--red);width:28px;height:28px;" data-tooltip="Xóa tin nhắn">
                    <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
                  </button>
                </form>
              </div>
            \`).join('');
          }
          chatModal.style.display = 'flex';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        });
      });

      ['closeChatModal', 'closeChatModalBtn'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => {
          chatModal.style.display = 'none';
        });
      });
      chatModal.addEventListener('click', e => {
        if (e.target === chatModal) chatModal.style.display = 'none';
      });
    </script>
  `;

  res.render('layouts/main', { title: 'Nhóm chat', body });
});

router.post('/:id/toggle', requirePermission('chat.write'), (req, res) => {
  const group = mockChatGroups.find(g => g.id === req.params.id);
  if (group) {
    group.status = group.status === 'active' ? 'locked' : 'active';
  }
  res.redirect('/chat');
});

router.post('/:groupId/message/:messageId/delete', requirePermission('chat.write'), (req, res) => {
  const { groupId, messageId } = req.params;
  if (mockMessages[groupId]) {
    const idx = mockMessages[groupId].findIndex(m => m.id === messageId);
    if (idx !== -1) {
      mockMessages[groupId].splice(idx, 1);
      // Update last message preview in chat group list
      const group = mockChatGroups.find(g => g.id === groupId);
      if (group) {
        if (mockMessages[groupId].length > 0) {
          const last = mockMessages[groupId][mockMessages[groupId].length - 1];
          group.lastSender = last.sender;
          group.lastMessage = last.text;
          group.lastTime = last.time;
        } else {
          group.lastSender = 'Hệ thống';
          group.lastMessage = 'Chưa có tin nhắn nào';
          group.lastTime = '';
        }
      }
    }
  }
  res.redirect('/chat');
});

module.exports = router;

