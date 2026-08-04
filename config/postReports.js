const postReports = [
  {
    id: 'rep_101',
    postId: 'post_001',
    postTitle: 'Bài viết chứa thông tin quảng cáo & cờ bạc',
    authorName: 'Phạm Thùy Dung',
    reporterName: 'Hệ thống Quét AI Tự động',
    reason: 'Spam / Lừa đảo / Quảng cáo cờ bạc',
    matchedWords: ['tài xỉu', 'nhà cái'],
    severity: 'high',
    status: 'pending',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 'rep_102',
    postId: 'post_002',
    postTitle: 'Bài viết sử dụng ngôn từ xúc phạm thành viên khác',
    authorName: 'user_spam_99',
    reporterName: 'Hệ thống Quét AI Tự động',
    reason: 'Ngôn từ xúc phạm / Bạo lực',
    matchedWords: ['xúc phạm', 'thô tục'],
    severity: 'medium',
    status: 'pending',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  }
];

// Danh mục từ ngữ vi phạm tiêu chuẩn cộng đồng Vivu360
const prohibitedWordCategories = [
  {
    category: 'Cờ bạc & Lừa đảo',
    severity: 'critical',
    words: [
      'cờ bạc', 'lừa đảo', 'nhà cái', 'tài xỉu', 'kèo bóng', 'cho vay nặng lãi',
      'bóng đá cá cược', 'game bài đổi thưởng', 'hack xu', 'rút tiền nhanh',
      'nạp thẻ chiết khấu', 'kiếm tiền online 100%', 'đầu tư bao lời', 'lô đề'
    ]
  },
  {
    category: 'Ngôn từ Xúc phạm & Thô tục',
    severity: 'high',
    words: [
      'chửi thề', 'đồ ngu', 'vô học', 'xúc phạm', 'thô tục', 'phản cảm',
      'lăng mạ', 'mất dạy', 'ngu ngốc', 'vô văn hóa', 'xúc phạm danh dự'
    ]
  },
  {
    category: 'Bạo lực & Chất cấm',
    severity: 'critical',
    words: [
      'bạo lực', 'vũ khí', 'ma túy', 'chất cấm', 'kích động', 'thù hằn',
      'đe dọa', 'đánh nhau', 'dao kiếm', 'súng đạn'
    ]
  },
  {
    category: 'Spam & Thông tin sai sự thật',
    severity: 'medium',
    words: [
      'tin giả', 'lừa gạt', 'spam link', 'spam quảng cáo', 'mua bán nick',
      'tăng follow giả', 'hack tài khoản', 'share link độc'
    ]
  }
];

// Tất cả các từ vi phạm dưới dạng phẳng
const allProhibitedWords = prohibitedWordCategories.flatMap(c => 
  c.words.map(w => ({ word: w, category: c.category, severity: c.severity }))
);

/**
 * Kiểm tra tự động văn bản bài viết xem có chứa từ ngữ vi phạm hay không
 */
function detectViolatingWords(content = '') {
  if (!content || typeof content !== 'string') {
    return {
      isViolating: false,
      matchedWords: [],
      categories: [],
      severity: 'safe',
      censoredContent: content,
    };
  }

  const lowerContent = content.toLowerCase();
  const matched = [];
  const foundCategories = new Set();
  let maxSeverityIndex = -1;
  const severityLevels = ['safe', 'low', 'medium', 'high', 'critical'];

  let censoredContent = content;

  allProhibitedWords.forEach(({ word, category, severity }) => {
    if (lowerContent.includes(word.toLowerCase())) {
      matched.push(word);
      foundCategories.add(category);
      
      const sIdx = severityLevels.indexOf(severity);
      if (sIdx > maxSeverityIndex) maxSeverityIndex = sIdx;

      // Thay thế từ vi phạm bằng dấu ***
      const reg = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      censoredContent = censoredContent.replace(reg, '*'.repeat(word.length));
    }
  });

  return {
    isViolating: matched.length > 0,
    matchedWords: [...new Set(matched)],
    categories: Array.from(foundCategories),
    severity: maxSeverityIndex >= 0 ? severityLevels[maxSeverityIndex] : 'safe',
    censoredContent,
  };
}

/**
 * Quét bài viết và tự động tạo báo cáo vi phạm nếu phát hiện từ cấm
 */
function autoCheckAndFlagPost(post) {
  if (!post || !post.content) return null;
  
  const result = detectViolatingWords(post.content);
  if (!result.isViolating) return null;

  const postId = String(post._id || post.id || '');
  const existingReport = postReports.find(r => r.postId === postId && r.status === 'pending');
  if (existingReport) return existingReport;

  const newReport = {
    id: 'rep_auto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    postId,
    postTitle: (post.content.slice(0, 60) + '...'),
    authorName: post.author?.name || post.authorId || 'Người dùng',
    reporterName: '🤖 AI Scanner (Kiểm duyệt Tự động)',
    reason: `Phát hiện từ ngữ vi phạm: ${result.matchedWords.join(', ')} (${result.categories.join(', ')})`,
    matchedWords: result.matchedWords,
    severity: result.severity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  postReports.unshift(newReport);
  return newReport;
}

function getPendingReports() {
  return postReports.filter(r => r.status === 'pending');
}

function addReport(reportData) {
  const newReport = {
    id: 'rep_' + Date.now(),
    postId: reportData.postId,
    postTitle: reportData.postTitle || 'Bài viết cộng đồng',
    authorName: reportData.authorName || 'Người dùng',
    reporterName: reportData.reporterName || 'Thành viên cộng đồng',
    reason: reportData.reason || 'Nội dung vi phạm tiêu chuẩn cộng đồng',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  postReports.unshift(newReport);
  return newReport;
}

function resolveReport(reportId, action = 'resolved') {
  const rep = postReports.find(r => r.id === reportId || r.postId === reportId);
  if (rep) {
    rep.status = action;
  }
  return rep;
}

module.exports = {
  postReports,
  prohibitedWordCategories,
  allProhibitedWords,
  detectViolatingWords,
  autoCheckAndFlagPost,
  getPendingReports,
  addReport,
  resolveReport,
};
