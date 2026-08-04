let activeApiUrl = process.env.VIVU360_API_URL || 'http://localhost:3000/api';
let isBackendOffline = false;
let lastOfflineCheck = 0;
let hasLoggedSuccess = false;

const CANDIDATE_URLS = [
  process.env.VIVU360_API_URL,
  'http://localhost:3000/api',
  'http://localhost:5000/api',
  'http://localhost:8000/api',
  'http://localhost:3001/api',
  'http://localhost:8080/api',
].filter(Boolean);

async function discoverActiveApiUrl() {
  if (!isBackendOffline && hasLoggedSuccess) return activeApiUrl;

  for (const candidate of CANDIDATE_URLS) {
    try {
      const cleanCandidate = candidate.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600);
      const res = await fetch(`${cleanCandidate}/health`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);
      if (res && res.ok) {
        activeApiUrl = cleanCandidate;
        isBackendOffline = false;
        if (!hasLoggedSuccess) {
          console.log(`🟢 Đã tự động kết nối Backend MongoDB API tại: ${activeApiUrl}`);
          hasLoggedSuccess = true;
        }
        return activeApiUrl;
      }
    } catch (e) {}
  }
  return activeApiUrl;
}

// Helper: Safely extract array from diverse backend API JSON structures
function extractList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.users)) return response.users;
  if (Array.isArray(response.posts)) return response.posts;
  if (Array.isArray(response.groups)) return response.groups;
  if (Array.isArray(response.destinations)) return response.destinations;
  if (Array.isArray(response.items)) return response.items;
  if (response.data && Array.isArray(response.data.items)) return response.data.items;
  if (response.data && Array.isArray(response.data.users)) return response.data.users;
  if (response.data && Array.isArray(response.data.posts)) return response.data.posts;
  return [];
}

async function request(path, options = {}) {
  // If backend was marked offline within 15s, return null to keep UI responsive
  if (isBackendOffline && (Date.now() - lastOfflineCheck < 15000)) {
    return null;
  }

  const currentApiUrl = await discoverActiveApiUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800);
  try {
    const fullUrl = path.startsWith('http') ? path : `${currentApiUrl}${path}`;
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
    });
    clearTimeout(timeoutId);
    if (!response.ok && response.status !== 204) {
      throw new Error(`Vivu360 API ${response.status}`);
    }
    isBackendOffline = false;
    if (response.status === 204) return null;
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (!isBackendOffline) {
      isBackendOffline = true;
      hasLoggedSuccess = false;
      lastOfflineCheck = Date.now();
      console.log(`ℹ️ Backend API (${activeApiUrl}) chưa phản hồi. Web Admin đang nạp dữ liệu từ Firebase / Demo.`);
    }
    return null;
  }
}

function toMongoUser(user) {
  return {
    firebaseUid: user.uid,
    email: user.email,
    name: user.name || user.displayName || user.email?.split('@')[0] || 'Người dùng',
    phone: user.phone || user.phoneNumber || '',
    avatar: user.avatar || user.photoURL || '',
    points: Number(user.points) || 0,
    level: user.level || 'Cấp 1',
    rank: user.rank || 'Đồng',
    checkedIn: user.checkedIn || [],
  };
}

async function syncUsersToMongo(users) {
  if (isBackendOffline && (Date.now() - lastOfflineCheck < 15000)) {
    return { synced: 0, failed: 0, offline: true };
  }
  const validUsers = users.filter(user => user.uid && user.email);
  const results = await Promise.allSettled(validUsers.map(user => request('/users/sync', {
    method: 'POST', body: JSON.stringify(toMongoUser(user)),
  })));
  const synced = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  const failed = validUsers.length - synced;
  return { synced, failed, offline: isBackendOffline };
}

async function getMongoUsers() {
  const response = await request('/users?limit=100');
  return extractList(response);
}

async function updateMongoAccess(uid, status) {
  return request(`/users/${encodeURIComponent(uid)}/access`, {
    method: 'PATCH',
    body: JSON.stringify({ status: status === 'locked' ? 'blocked' : 'active' }),
  });
}

async function updateMongoUser(uid, data) {
  return request(`/users/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: data.name || data.displayName,
      phone: data.phone || data.phoneNumber,
      avatar: data.avatar || data.photoURL,
      points: data.points,
      level: data.level,
      rank: data.rank,
    }),
  });
}

async function deleteMongoUser(uid) {
  return request(`/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
}

async function getGroupsByMember(memberId) {
  const response = await request(`/chat/groups?memberId=${encodeURIComponent(memberId)}`);
  return extractList(response);
}

const fallbackGroups = [
  {
    id: 'grp_001',
    _id: 'grp_001',
    name: 'Hội Du Lịch Bụi & Phượt Việt Nam 360°',
    avatar: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=100',
    ownerId: 'user_001',
    admins: ['user_001', 'user_002'],
    members: ['user_001', 'user_002', 'user_003', 'user_004', 'user_005', 'user_006', 'user_007', 'user_008'],
    memberProfiles: [
      { firebaseUid: 'user_001', name: 'Nguyễn Văn An', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
      { firebaseUid: 'user_002', name: 'Trần Thị Mai', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    ],
    lastMessage: { text: 'Chào mừng các bạn đến với nhóm phượt Vivu360! Hãy cập nhật lịch trình tour 360.' },
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'grp_002',
    _id: 'grp_002',
    name: 'CLB Săn Mây & Check-in Sa Pa - Fansipan',
    avatar: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100',
    ownerId: 'user_002',
    admins: ['user_002', 'user_003'],
    members: ['user_002', 'user_003', 'user_004', 'user_005', 'user_009'],
    memberProfiles: [
      { firebaseUid: 'user_002', name: 'Trần Thị Mai', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
      { firebaseUid: 'user_003', name: 'Lê Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100' },
    ],
    lastMessage: { text: 'Cuối tuần này có chuyến săn mây Fansipan 3.143m nhé mọi người!' },
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'grp_003',
    _id: 'grp_003',
    name: 'Cộng Đồng Ẩm Thực Phố Cổ Hội An & Đà Nẵng',
    avatar: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=100',
    ownerId: 'user_003',
    admins: ['user_003'],
    members: ['user_003', 'user_004', 'user_005', 'user_010', 'user_011', 'user_012'],
    memberProfiles: [
      { firebaseUid: 'user_003', name: 'Lê Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100' },
    ],
    lastMessage: { text: 'Top 10 quán Cao Lầu & Mì Quảng ngon nhất Hội An vừa được cập nhật.' },
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  }
];

async function getAllMongoGroups() {
  // 1. Thử lấy từ endpoint trực tiếp /chat/groups hoặc /groups
  const directResponse = await request('/chat/groups');
  let directList = extractList(directResponse);
  
  if (!directList || directList.length === 0) {
    const altResponse = await request('/groups');
    directList = extractList(altResponse);
  }

  if (directList && directList.length > 0) {
    return directList;
  }

  // 2. Thử truy vấn danh sách nhóm theo từng người dùng MongoDB thực tế
  const users = await getMongoUsers();
  const results = await Promise.allSettled(
    users
      .filter(user => user.firebaseUid || user._id)
      .map(user => getGroupsByMember(user.firebaseUid || user._id))
  );

  const groupMap = new Map();
  results.forEach(result => {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) return;
    result.value.forEach(group => {
      const groupId = String(group._id || group.id || '');
      if (groupId && !groupMap.has(groupId)) {
        groupMap.set(groupId, group);
      }
    });
  });

  return Array.from(groupMap.values()).sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });
}

async function getPostsByUser(firebaseUid) {
  const response = await request(
    `/posts/user/${encodeURIComponent(firebaseUid)}`,
    { headers: { 'x-user-id': firebaseUid } }
  );
  return extractList(response);
}

const fallbackPosts = [
  {
    id: 'post_001',
    _id: 'post_001',
    authorId: 'user_001',
    author: { name: 'Nguyễn Văn An', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
    content: 'Trải nghiệm ngắm bình minh trên du thuyền Vịnh Hạ Long thật tuyệt vời! Không khí trong lành, khung cảnh núi đá vôi bạt ngàn 360° vô cùng hùng vĩ.',
    location: 'Vịnh Hạ Long, Quảng Ninh',
    category: 'Kinh nghiệm du lịch',
    likesCount: 28,
    commentsCount: 7,
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80'
    ],
    comments: [
      { userName: 'Trần Thị Mai', text: 'Cảnh đẹp quá anh ơi, tour 360 xem trước rất chân thực!' },
      { userName: 'Lê Hoàng Nam', text: 'Cho em hỏi xin chi phí đi tour Hạ Long 2 ngày 1 đêm với ạ.' }
    ],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'post_002',
    _id: 'post_002',
    authorId: 'user_002',
    author: { name: 'Trần Thị Mai', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
    content: 'Chinh phục đỉnh Fansipan 3.143m thành công! Thời tiết Sa Pa hôm nay lộng gió, biển mây tuyệt đẹp không góc chết.',
    location: 'Sa Pa, Lào Cai',
    category: 'Check-in',
    likesCount: 45,
    commentsCount: 12,
    images: [
      'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80'
    ],
    comments: [
      { userName: 'Nguyễn Văn An', text: 'Chúc mừng chị! Đỉnh Fansipan mùa này săn mây đỉnh nhất.' }
    ],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'post_003',
    _id: 'post_003',
    authorId: 'user_003',
    author: { name: 'Lê Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100' },
    content: 'Đêm Phố cổ Hội An lung linh sắc màu đèn lồng. Đừng quên thử món Cao Lầu và Nước Mốt nổi tiếng nhé cả nhà!',
    location: 'Phố cổ Hội An, Quảng Nam',
    category: 'Ẩm thực & Văn hóa',
    likesCount: 62,
    commentsCount: 19,
    images: [
      'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=600&q=80'
    ],
    comments: [],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'post_004',
    _id: 'post_004',
    authorId: 'user_004',
    author: { name: 'Phạm Thu Thảo', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
    content: 'Hoàng hôn trên Bãi Dài Phú Quốc đẹp như tranh vẽ. Nước biển trong xanh nhìn thấy đáy, rất đáng trải nghiệm!',
    location: 'Phú Quốc, Kiên Giang',
    category: 'Nghỉ dưỡng',
    likesCount: 89,
    commentsCount: 24,
    images: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80'
    ],
    comments: [],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'post_005',
    _id: 'post_005',
    authorId: 'user_005',
    author: { name: 'Đỗ Đức Mạnh', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    content: 'Check-in Cầu Vàng nổi tiếng thế giới tại Bà Nà Hills. Trải nghiệm xem bản đồ 360° trước khi đi giúp lên lịch trình di chuyển chuẩn xác 100%.',
    location: 'Bà Nà Hills, Đà Nẵng',
    category: 'Review Tour',
    likesCount: 53,
    commentsCount: 15,
    images: [
      'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=600&q=80'
    ],
    comments: [],
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  }
];

function normalizeMongoPost(p = {}) {
  const id = String(p._id || p.id || `post_${Date.now()}`);
  const authorName = p.author?.name || p.authorName || p.userName || p.user?.name || p.authorId || 'Người dùng MongoDB';
  const authorAvatar = p.author?.avatar || p.authorAvatar || p.userAvatar || p.user?.avatar || '';
  const content = p.content || p.text || p.body || p.caption || '';
  const location = p.location || p.address || p.place || '';
  const category = p.category || p.tag || 'Cộng đồng';
  const likesCount = Number(p.likesCount ?? p.likes?.length ?? p.likeCount ?? 0);
  const commentsCount = Number(p.commentsCount ?? p.comments?.length ?? p.commentCount ?? 0);
  const images = Array.isArray(p.images) ? p.images : (Array.isArray(p.photos) ? p.photos : (p.image ? [p.image] : []));
  const createdAt = p.createdAt || p.created_at || p.timestamp || new Date().toISOString();

  return {
    id,
    _id: id,
    authorId: p.authorId || p.userId || p.author?.firebaseUid || '',
    author: { name: authorName, avatar: authorAvatar },
    content,
    location,
    category,
    likesCount,
    commentsCount,
    images,
    comments: Array.isArray(p.comments) ? p.comments : [],
    createdAt,
  };
}

async function getAllMongoPosts() {
  // Direct endpoint try first
  const directResponse = await request('/posts?limit=200');
  const directPosts = extractList(directResponse);
  if (directPosts.length > 0) {
    console.log(`🟢 Đã lấy thành công ${directPosts.length} bài viết trực tiếp từ MongoDB API!`);
    return directPosts.map(normalizeMongoPost);
  }

  const users = await getMongoUsers();
  const results = await Promise.allSettled(
    users
      .filter(user => user.firebaseUid && user.status === 'active')
      .map(async user => {
        const posts = await getPostsByUser(user.firebaseUid);
        return posts.map(post => ({
          ...post,
          author: post.author || {
            firebaseUid: user.firebaseUid,
            name: user.name,
            avatar: user.avatar,
            level: user.level,
          },
        }));
      })
  );

  const postMap = new Map();
  results.forEach(result => {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value)) return;
    result.value.forEach(post => {
      const postId = String(post._id || post.id || '');
      if (postId && !postMap.has(postId)) {
        postMap.set(postId, normalizeMongoPost(post));
      }
    });
  });

  const list = Array.from(postMap.values()).sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  return list.length > 0 ? list : fallbackPosts.map(normalizeMongoPost);
}

async function deleteMongoPost(postId, authorId) {
  return request(`/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    headers: { 'x-user-id': authorId },
  });
}

async function getAllMongoDestinations() {
  const endpoints = ['/destinations?limit=100', '/tours?limit=100', '/locations?limit=100', '/places?limit=100'];
  for (const endpoint of endpoints) {
    const res = await request(endpoint);
    const list = extractList(res);
    if (list && list.length > 0) {
      console.log(`🟢 Đã lấy thành công ${list.length} điểm đến thực tế từ MongoDB API (${endpoint})!`);
      return list;
    }
  }
  return [];
}

function getActiveApiUrl() {
  return activeApiUrl;
}

function getBackendStatus() {
  return {
    apiUrl: activeApiUrl,
    isOnline: !isBackendOffline,
  };
}

module.exports = {
  API_URL: activeApiUrl,
  getActiveApiUrl,
  getBackendStatus,
  request,
  extractList,
  getMongoUsers,
  syncUsersToMongo,
  updateMongoUser,
  updateMongoAccess,
  deleteMongoUser,
  getGroupsByMember,
  getAllMongoGroups,
  getPostsByUser,
  getAllMongoPosts,
  deleteMongoPost,
  getAllMongoDestinations,
};
