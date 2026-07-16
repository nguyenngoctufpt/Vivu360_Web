const fs = require('fs');
const path = require('path');

let admin = null;
let db = null;
let auth = null;
let isFirebaseConnected = false;

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

function safeDate(value) {
  if (!value) return new Date().toISOString();
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
}

function normalizeUserForAdmin(user = {}) {
  // Firebase Auth fields
  const uid = user.uid || user.id || user.userId || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = (user.email || user.emailAddress || '').toLowerCase().trim();
  const displayName = user.displayName || user.name || user.fullName || (email ? email.split('@')[0] : 'Người dùng');
  const phoneNumber = (user.phoneNumber || user.phone || '').trim();
  const photoURL = user.photoURL || user.avatar || `https://i.pravatar.cc/150?img=${(uid.length % 20) + 1}`;
  const emailVerified = user.emailVerified ?? false;
  const disabled = user.disabled ?? false;
  
  // Admin custom fields
  const status = disabled || user.status === 'locked' || user.status === 'inactive' ? 'locked' : 'active';
  const points = Number(user.points ?? user.point ?? 0);
  const rank = user.rank || 'Đồng';
  const lastSignInTime = safeDate(user.lastSignInTime || user.lastLoginAt || null);
  const createdAt = safeDate(user.createdAt || user.created_at || user.created || new Date());
  
  return {
    // Firebase Auth standard fields
    uid,
    email,
    displayName,
    phoneNumber,
    photoURL,
    emailVerified,
    disabled,
    createdAt,
    lastSignInTime,
    
    // Admin display fields (mapped from Firebase fields)
    name: displayName,
    phone: phoneNumber,
    avatar: photoURL,
    
    // Admin custom fields
    points: Number.isFinite(points) ? points : 0,
    rank,
    status,
  };
}

function buildUserFromAuth(user = {}) {
  return normalizeUserForAdmin(user);
}

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require('./serviceAccountKey.json');
    
    if (serviceAccount.private_key && serviceAccount.private_key.includes('REPLACE_ME')) {
      console.log('ℹ️ Phát hiện file serviceAccountKey.json mẫu (chưa cấu hình private key). Đang chạy ở chế độ giả lập (Demo Mode).');
    } else {
      admin = require('firebase-admin');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'vivu360',
      });
      
      db = admin.firestore();
      auth = admin.auth();
      isFirebaseConnected = true;
      console.log('🔥 Đã kết nối Firebase Admin SDK thực tế thành công!');
    }
  } catch (error) {
    console.error('❌ Lỗi khởi tạo Firebase Admin SDK:', error.message);
  }
} else {
  console.log('ℹ️ Không tìm thấy config/serviceAccountKey.json. Đang chạy ở chế độ giả lập (Demo Mode).');
}

async function upsertUser(userData = {}) {
  let enrichedData = { ...userData };

  // Nếu không có email trong payload, fetch từ Firebase Auth
  if (!enrichedData.email && enrichedData.uid && isFirebaseConnected) {
    try {
      const authUser = await auth.getUser(enrichedData.uid);
      enrichedData.email = authUser.email;
      enrichedData.displayName = enrichedData.displayName || authUser.displayName;
      enrichedData.phoneNumber = enrichedData.phoneNumber || authUser.phoneNumber;
      enrichedData.photoURL = enrichedData.photoURL || authUser.photoURL;
    } catch (e) {
      console.warn(`⚠️ Không lấy được thông tin từ Firebase Auth cho UID ${enrichedData.uid}`);
    }
  }

  const normalized = normalizeUserForAdmin(enrichedData);

  if (!isFirebaseConnected) {
    const index = mockUsers.findIndex(u => u.uid === normalized.uid || u.email === normalized.email);
    if (index >= 0) {
      mockUsers[index] = { ...mockUsers[index], ...normalized };
    } else {
      mockUsers.push(normalized);
    }
    return normalized;
  }

  try {
    await db.collection('users').doc(normalized.uid).set(normalized, { merge: true });
    return normalized;
  } catch (error) {
    console.error('❌ Lỗi đồng bộ user vào Firestore:', error.message);
    return normalized;
  }
}

// Hàm đọc cấu hình từ Firestore (nếu có kết nối)
async function getConfigFromFirebase(defaultConfig) {
  if (!isFirebaseConnected) return defaultConfig;
  try {
    const doc = await db.collection('system_config').doc('app_settings').get();
    if (doc.exists) {
      // Trả về cấu hình merge với default để phòng trường hợp thiếu key
      return { ...defaultConfig, ...doc.data() };
    } else {
      // Tạo mới cấu hình mặc định trên Firestore
      await db.collection('system_config').doc('app_settings').set(defaultConfig);
      return defaultConfig;
    }
  } catch (e) {
    console.error('⚠️ Lỗi đọc cấu hình từ Firestore:', e.message);
    return defaultConfig;
  }
}

// Hàm ghi cấu hình lên Firestore (nếu có kết nối)
async function saveConfigToFirebase(newConfig) {
  if (!isFirebaseConnected) return false;
  try {
    await db.collection('system_config').doc('app_settings').set(newConfig, { merge: true });
    return true;
  } catch (e) {
    console.error('❌ Lỗi ghi cấu hình lên Firestore:', e.message);
    return false;
  }
}

// Dynamic User Data Access (Firebase Auth + Firestore merge)
async function getUsers() {
  if (!isFirebaseConnected) {
    return mockUsers;
  }
  try {
    // Bước 1: Lấy toàn bộ user từ Firebase Authentication
    const authUsers = [];
    let nextPageToken;
    do {
      const listResult = await auth.listUsers(1000, nextPageToken);
      listResult.users.forEach(userRecord => {
        authUsers.push({
          uid: userRecord.uid,
          email: userRecord.email || '',
          displayName: userRecord.displayName || '',
          phoneNumber: userRecord.phoneNumber || '',
          photoURL: userRecord.photoURL || '',
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled,
          createdAt: userRecord.metadata?.creationTime || new Date().toISOString(),
          lastSignInTime: userRecord.metadata?.lastSignInTime || null,
        });
      });
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    if (authUsers.length === 0) {
      console.log('ℹ️ Firebase Auth không có user nào. Trả về mockUsers.');
      return mockUsers;
    }

    // Bước 2: Lấy dữ liệu mở rộng từ Firestore (points, rank, status...)
    const firestoreMap = {};
    try {
      const snapshot = await db.collection('users').get();
      snapshot.forEach(doc => {
        firestoreMap[doc.id] = doc.data();
      });
    } catch (fsErr) {
      console.warn('⚠️ Không lấy được Firestore users:', fsErr.message);
    }

    // Bước 3: Merge Auth + Firestore
    const users = authUsers.map(authUser => {
      const fsData = firestoreMap[authUser.uid] || {};
      return normalizeUserForAdmin({ ...authUser, ...fsData, uid: authUser.uid });
    });

    console.log(`✅ Đã tải ${users.length} user từ Firebase Auth.`);
    return users;
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách users từ Firebase Auth:', error.message);
    return mockUsers;
  }
}

async function updateUser(uid, updatedData) {
  const sanitized = { ...updatedData };
  
  // Map admin fields to Firebase fields if needed
  if (sanitized.name && !sanitized.displayName) sanitized.displayName = sanitized.name;
  if (sanitized.phone && !sanitized.phoneNumber) sanitized.phoneNumber = sanitized.phone;
  if (sanitized.avatar && !sanitized.photoURL) sanitized.photoURL = sanitized.avatar;
  
  // Type conversions
  if (sanitized.points !== undefined) sanitized.points = Number(sanitized.points) || 0;
  if (sanitized.status !== undefined) sanitized.disabled = sanitized.status === 'locked';
  
  if (!isFirebaseConnected) {
    const user = mockUsers.find(u => u.uid === uid);
    if (user) {
      const normalized = normalizeUserForAdmin({ ...user, ...sanitized });
      Object.assign(user, normalized);
    }
    return sanitized;
  }
  try {
    const updatePayload = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };
    await db.collection('users').doc(uid).set(updatePayload, { merge: true });
    return sanitized;
  } catch (error) {
    console.error(`❌ Lỗi cập nhật user ${uid} trên Firestore:`, error.message);
    return sanitized;
  }
}

async function deleteUser(uid) {
  if (!isFirebaseConnected) {
    const idx = mockUsers.findIndex(u => u.uid === uid);
    if (idx !== -1) mockUsers.splice(idx, 1);
    return true;
  }
  try {
    await db.collection('users').doc(uid).delete();
    try {
      await auth.deleteUser(uid);
    } catch (authErr) {
      console.log(`ℹ️ Không tìm thấy hoặc không thể xóa Auth user cho ${uid}:`, authErr.message);
    }
    return true;
  } catch (error) {
    console.error(`❌ Lỗi xóa user ${uid} trên Firestore:`, error.message);
    return false;
  }
}

async function toggleUserStatus(uid) {
  if (!isFirebaseConnected) {
    const user = mockUsers.find(u => u.uid === uid);
    if (user) {
      user.status = user.status === 'active' ? 'locked' : 'active';
      user.disabled = user.status === 'locked';
    }
    return true;
  }
  try {
    const docRef = db.collection('users').doc(uid);
    const doc = await docRef.get();
    if (doc.exists) {
      const currentStatus = doc.data().status || 'active';
      const newStatus = currentStatus === 'active' ? 'locked' : 'active';
      const isDisabled = newStatus === 'locked';
      
      // Update Firestore user doc
      await docRef.set({
        status: newStatus,
        disabled: isDisabled,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      // Sync to Firebase Auth
      try {
        await auth.updateUser(uid, { disabled: isDisabled });
      } catch (authErr) {
        console.log(`ℹ️ Không thể cập nhật trạng thái Auth cho ${uid}:`, authErr.message);
      }
    }
    return true;
  } catch (error) {
    console.error(`❌ Lỗi đổi trạng thái user ${uid} trên Firestore:`, error.message);
    return false;
  }
}

async function resetUserPassword(uid) {
  if (!isFirebaseConnected) return;
  try {
    const userRecord = await auth.getUser(uid);
    if (userRecord.email) {
      const link = await auth.generatePasswordResetLink(userRecord.email);
      console.log(`🔗 Link reset mật khẩu cho ${userRecord.email}: ${link}`);
    }
  } catch (error) {
    console.error(`❌ Lỗi reset password cho ${uid}:`, error.message);
  }
}

// ========================
// MOCK DATA (Demo Mode)
// ========================

const mockUsers = [
  { uid: 'u001', name: 'Nguyễn Minh', email: 'minh.nguyen@vivu360.vn', phone: '0987654321', points: 8250, rank: 'Vàng', status: 'active', avatar: 'https://i.pravatar.cc/150?img=68', createdAt: '2025-12-10' },
  { uid: 'u002', name: 'Trần Thị Lan', email: 'lan.tran@gmail.com', phone: '0912345678', points: 15200, rank: 'Bạch Kim', status: 'active', avatar: 'https://i.pravatar.cc/150?img=47', createdAt: '2025-11-05' },
  { uid: 'u003', name: 'Lê Hoàng Nam', email: 'nam.le@yahoo.com', phone: '0901122334', points: 3100, rank: 'Bạc', status: 'active', avatar: 'https://i.pravatar.cc/150?img=12', createdAt: '2026-01-15' },
  { uid: 'u004', name: 'Phạm Thùy Dung', email: 'dung.pham@outlook.com', phone: '0938765432', points: 950, rank: 'Đồng', status: 'locked', avatar: 'https://i.pravatar.cc/150?img=32', createdAt: '2026-03-20' },
  { uid: 'u005', name: 'Hoàng Văn Tùng', email: 'tung.hoang@vivu360.vn', phone: '0977889900', points: 22500, rank: 'Kim Cương', status: 'active', avatar: 'https://i.pravatar.cc/150?img=53', createdAt: '2025-09-01' },
  { uid: 'u006', name: 'Võ Ngọc Hà', email: 'ha.vo@gmail.com', phone: '0965432100', points: 6800, rank: 'Vàng', status: 'active', avatar: 'https://i.pravatar.cc/150?img=25', createdAt: '2026-02-14' },
  { uid: 'u007', name: 'Đặng Quốc Bảo', email: 'bao.dang@hotmail.com', phone: '0923456789', points: 1200, rank: 'Đồng', status: 'active', avatar: 'https://i.pravatar.cc/150?img=59', createdAt: '2026-05-08' },
  { uid: 'u008', name: 'Bùi Thanh Hương', email: 'huong.bui@vivu360.vn', phone: '0891234567', points: 4500, rank: 'Bạc', status: 'active', avatar: 'https://i.pravatar.cc/150?img=41', createdAt: '2026-04-22' },
];

const mockDestinations = [
  { id: 'd001', title: 'Vịnh Hạ Long', region: 'Quảng Ninh', rating: 4.9, reviews: 12000, price: '2.500.000đ', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd002', title: 'Phố Cổ Hội An', region: 'Quảng Nam', rating: 4.8, reviews: 34000, price: '1.200.000đ', image: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd003', title: 'Đảo Phú Quốc', region: 'Kiên Giang', rating: 5.0, reviews: 8500, price: '4.800.000đ', image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd004', title: 'Sa Pa', region: 'Lào Cai', rating: 4.7, reviews: 21000, price: '1.950.000đ', image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: false },
  { id: 'd005', title: 'Khách Sạn InterContinental', region: 'Phú Quốc', rating: 4.9, price: '3.800.000đ/đêm', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'hotel', hasTour360: false },
  { id: 'd006', title: 'Tour Ngắm Hoàng Hôn Phú Quốc', region: 'Phú Quốc', rating: 4.8, price: '850.000đ/người', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'tour', hasTour360: false },
  { id: 'd007', title: 'VinWonders & Safari', region: 'Phú Quốc', rating: 4.7, price: '1.350.000đ/vé', image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'ticket', hasTour360: false },
  { id: 'd008', title: 'Thuê Xe Hyundai Accent', region: 'Phú Quốc', rating: 4.6, price: '700.000đ/ngày', image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80', status: 'inactive', type: 'car', hasTour360: false },
];

const mockTickets = [
  { code: 'VV360-HL4829', userId: 'u001', userName: 'Nguyễn Minh', destination: 'Vịnh Hạ Long', region: 'Quảng Ninh', date: '2026-06-18', guests: 2, price: '2.500.000đ', status: 'confirmed', createdAt: '2026-06-10' },
  { code: 'VV360-HA1023', userId: 'u002', userName: 'Trần Thị Lan', destination: 'Phố Cổ Hội An', region: 'Quảng Nam', date: '2026-07-05', guests: 3, price: '1.200.000đ', status: 'confirmed', createdAt: '2026-06-28' },
  { code: 'VV360-PQ8812', userId: 'u005', userName: 'Hoàng Văn Tùng', destination: 'Đảo Phú Quốc', region: 'Kiên Giang', date: '2026-07-15', guests: 4, price: '4.800.000đ', status: 'pending', createdAt: '2026-07-01' },
  { code: 'VV360-SP3344', userId: 'u003', userName: 'Lê Hoàng Nam', destination: 'Sa Pa', region: 'Lào Cai', date: '2026-06-20', guests: 1, price: '1.950.000đ', status: 'cancelled', createdAt: '2026-06-12' },
  { code: 'VV360-IC5567', userId: 'u006', userName: 'Võ Ngọc Hà', destination: 'InterContinental Resort', region: 'Phú Quốc', date: '2026-08-01', guests: 2, price: '3.800.000đ', status: 'confirmed', createdAt: '2026-06-30' },
  { code: 'VV360-TH7788', userId: 'u002', userName: 'Trần Thị Lan', destination: 'Tour Hoàng Hôn', region: 'Phú Quốc', date: '2026-07-06', guests: 3, price: '850.000đ', status: 'pending', createdAt: '2026-06-29' },
  { code: 'VV360-VW9901', userId: 'u008', userName: 'Bùi Thanh Hương', destination: 'VinWonders & Safari', region: 'Phú Quốc', date: '2026-07-20', guests: 5, price: '1.350.000đ', status: 'confirmed', createdAt: '2026-07-01' },
];

const mockPosts = [
  { id: 'p001', userId: 'u001', userName: 'Nguyễn Minh', avatar: 'https://i.pravatar.cc/150?img=68', content: 'Hạ Long đẹp quá trời! Vịnh nhìn từ trên flycam 360 thực sự choáng ngợp 🌊🏔️', likes: 128, comments: 23, image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80', status: 'visible', createdAt: '2026-06-28' },
  { id: 'p002', userId: 'u002', userName: 'Trần Thị Lan', avatar: 'https://i.pravatar.cc/150?img=47', content: 'Review chi tiết Hội An 3 ngày 2 đêm cho ai cần tham khảo nhé! Phố cổ về đêm lung linh đèn lồng tuyệt vời ❤️🏮', likes: 256, comments: 45, image: 'https://images.unsplash.com/photo-1555921015-5532091f6026?auto=format&fit=crop&w=600&q=80', status: 'visible', createdAt: '2026-06-25' },
  { id: 'p003', userId: 'u005', userName: 'Hoàng Văn Tùng', avatar: 'https://i.pravatar.cc/150?img=53', content: 'Phú Quốc mùa này nước biển xanh trong vắt, cát trắng mịn. Chill thật sự! 🏖️☀️', likes: 89, comments: 12, image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=600&q=80', status: 'visible', createdAt: '2026-06-30' },
  { id: 'p004', userId: 'u003', userName: 'Lê Hoàng Nam', avatar: 'https://i.pravatar.cc/150?img=12', content: 'Săn mây Sa Pa lúc 5h sáng. Lạnh cóng nhưng mà xứng đáng! View đỉnh vãi 🌤️⛰️', likes: 342, comments: 67, image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=600&q=80', status: 'visible', createdAt: '2026-06-22' },
  { id: 'p005', userId: 'u004', userName: 'Phạm Thùy Dung', avatar: 'https://i.pravatar.cc/150?img=32', content: 'Bài viết spam quảng cáo không liên quan du lịch...', likes: 2, comments: 0, image: '', status: 'hidden', createdAt: '2026-06-29' },
  { id: 'p006', userId: 'u006', userName: 'Võ Ngọc Hà', avatar: 'https://i.pravatar.cc/150?img=25', content: 'Tắm khoáng nóng Mù Cang Chải, ngắm ruộng bậc thang mùa lúa chín vàng. Đẹp như tranh 🎨🌾', likes: 178, comments: 34, image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=600&q=80', status: 'visible', createdAt: '2026-06-20' },
];

const mockChatGroups = [
  { id: 'g001', name: 'Du lịch Hạ Long', members: 156, lastMessage: 'Ai đi Hạ Long tháng 7 ghép nhóm không?', lastSender: 'Nguyễn Minh', lastTime: '2026-07-01 22:30', status: 'active' },
  { id: 'g002', name: 'Hội An Lovers 🏮', members: 234, lastMessage: 'Quán cơm gà nào ngon nhất Hội An vậy mọi người?', lastSender: 'Trần Thị Lan', lastTime: '2026-07-01 21:15', status: 'active' },
  { id: 'g003', name: 'Phú Quốc Backpackers', members: 89, lastMessage: 'Review resort vừa ở xong nè, đẹp lắm!', lastSender: 'Hoàng Văn Tùng', lastTime: '2026-07-01 20:45', status: 'active' },
  { id: 'g004', name: 'Sa Pa Trekking Club ⛰️', members: 67, lastMessage: 'Mùa này đi trek Fansipan được không?', lastSender: 'Lê Hoàng Nam', lastTime: '2026-06-30 18:00', status: 'active' },
  { id: 'g005', name: 'Nhóm test (spam)', members: 3, lastMessage: 'abc', lastSender: 'user_test', lastTime: '2026-06-25 10:00', status: 'locked' },
];

// Dashboard statistics
async function getDashboardStats() {
  const users = await getUsers();
  const totalUsers = users.length;
  
  let totalGroups = mockChatGroups.length;
  if (isFirebaseConnected) {
    try {
      const snap = await db.collection('chat_groups').get();
      if (!snap.empty) totalGroups = snap.size;
    } catch(e) {}
  }

  let totalObjects = mockDestinations.length;
  if (isFirebaseConnected) {
    try {
      const snap = await db.collection('destinations').get();
      if (!snap.empty) totalObjects = snap.size;
    } catch(e) {}
  }

  const totalTickets = mockTickets.length;
  const confirmedTickets = mockTickets.filter(t => t.status === 'confirmed').length;
  const pendingTickets = mockTickets.filter(t => t.status === 'pending').length;
  const cancelledTickets = mockTickets.filter(t => t.status === 'cancelled').length;
  const totalPosts = mockPosts.filter(p => p.status === 'visible').length;

  // Helper parse price
  const parsePrice = (pStr) => {
    if (!pStr) return 0;
    const num = parseInt(pStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };

  // Calculate dynamic revenue
  const confirmedTicketsArray = mockTickets.filter(t => t.status === 'confirmed');
  const revenueVal = confirmedTicketsArray.reduce((sum, t) => {
    return sum + parsePrice(t.price) * (t.guests || 1);
  }, 0);
  const totalRevenue = revenueVal.toLocaleString('vi-VN') + 'đ';
  
  const rankDistribution = {
    'Đồng': users.filter(u => u.rank === 'Đồng').length,
    'Bạc': users.filter(u => u.rank === 'Bạc').length,
    'Vàng': users.filter(u => u.rank === 'Vàng').length,
    'Bạch Kim': users.filter(u => u.rank === 'Bạch Kim').length,
    'Kim Cương': users.filter(u => u.rank === 'Kim Cương').length,
  };

  const monthlyBookings = [12, 18, 25, 22, 30, 28, 35, 42, 38, 45, 50, 48];
  
  // Proportional monthly revenue with the last month being the calculated revenueVal
  const monthlyRevenue = [
    6800000, 9500000, 14200000, 11800000, 18000000, 15500000, 
    22000000, 25800000, 21200000, 24500000, 29000000, revenueVal
  ];

  // Group bookings by region for Top Destination Regions chart
  const regionCounts = {};
  mockTickets.forEach(t => {
    const key = t.region || 'Khác';
    regionCounts[key] = (regionCounts[key] || 0) + (t.guests || 1);
  });
  const topRegions = Object.entries(regionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const recentActivities = [
    { type: 'booking', message: 'Bùi Thanh Hương đặt vé VinWonders & Safari', time: '5 phút trước', icon: 'ticket' },
    { type: 'user', message: 'Đặng Quốc Bảo đăng ký tài khoản mới', time: '15 phút trước', icon: 'user-plus' },
    { type: 'post', message: 'Hoàng Văn Tùng đăng bài viết mới về Phú Quốc', time: '30 phút trước', icon: 'file-text' },
    { type: 'booking', message: 'Trần Thị Lan đặt Tour Hoàng Hôn Phú Quốc', time: '1 giờ trước', icon: 'ticket' },
    { type: 'booking', message: 'Hoàng Văn Tùng đặt vé Đảo Phú Quốc', time: '2 giờ trước', icon: 'ticket' },
    { type: 'review', message: 'Nguyễn Minh đánh giá 5 sao cho Hạ Long', time: '3 giờ trước', icon: 'star' },
  ];

  const recentUsers = users
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  return {
    totalUsers,
    totalGroups,
    totalObjects,
    totalTickets,
    confirmedTickets,
    pendingTickets,
    cancelledTickets,
    totalPosts,
    totalRevenue,
    rankDistribution,
    monthlyBookings,
    monthlyRevenue,
    topRegions,
    recentActivities,
    recentUsers,
  };
}

module.exports = {
  admin,
  db,
  auth,
  isFirebaseConnected,
  getConfigFromFirebase,
  saveConfigToFirebase,
  normalizeUserForAdmin,
  buildUserFromAuth,
  upsertUser,
  mockUsers,
  mockDestinations,
  mockTickets,
  mockPosts,
  mockChatGroups,
  getDashboardStats,
  getUsers,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
};
