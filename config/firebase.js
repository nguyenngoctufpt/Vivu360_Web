const fs = require('fs');
const path = require('path');
const { getMongoUsers, syncUsersToMongo, updateMongoUser, updateMongoAccess, deleteMongoUser, getAllMongoGroups, getAllMongoPosts } = require('./mongodbApi');

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
      return { ...defaultConfig, ...doc.data() };
    } else {
      await db.collection('system_config').doc('app_settings').set(defaultConfig);
      return defaultConfig;
    }
  } catch (e) {
    console.error('⚠️ Lỗi đọc cấu hình từ Firestore:', e.message);
    return defaultConfig;
  }
}

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
          lastSignInTime: userRecord.metadata?.lastSignInTime || null,
        });
      });
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    if (authUsers.length === 0) {
      const mongoUsers = await getMongoUsers();
      if (mongoUsers && mongoUsers.length > 0) {
        return mongoUsers.map(u => normalizeUserForAdmin(u));
      }
      return [];
    }

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
    let users = authUsers.map(authUser => {
      const fsData = firestoreMap[authUser.uid] || {};
      return normalizeUserForAdmin({ ...authUser, ...fsData, uid: authUser.uid });
    });

    const mongoSync = await syncUsersToMongo(users);
    if (!mongoSync.offline) {
      console.log(`MongoDB user sync: ${mongoSync.synced} thành công, ${mongoSync.failed} lỗi.`);
    }

    const mongoUsers = await getMongoUsers();
    const mongoMap = Object.fromEntries(mongoUsers.map(user => [user.firebaseUid, user]));
    users = users.map(user => {
      const mongoUser = mongoMap[user.uid] || {};
      return normalizeUserForAdmin({
        ...user,
        phoneNumber: mongoUser.phone || user.phoneNumber,
        photoURL: mongoUser.avatar || user.photoURL,
        points: mongoUser.points ?? user.points,
        rank: mongoUser.rank || user.rank,
      });
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
    await updateMongoUser(uid, sanitized)
      .catch(error => console.warn('MongoDB update user:', error.message));
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
    await deleteMongoUser(uid).catch(error => console.warn('MongoDB delete user:', error.message));
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
      await updateMongoAccess(uid, newStatus)
        .catch(error => console.warn('MongoDB update status:', error.message));
      
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
// MOCK DATA & STATS
// ========================

const mockUsers = [
  { uid: 'u001', name: 'Nguyễn Minh', email: 'minh.nguyen@vivu360.vn', phone: '0987654321', points: 8250, rank: 'Vàng', status: 'active', avatar: 'https://i.pravatar.cc/150?img=68', createdAt: '2025-12-10' },
  { uid: 'u002', name: 'Trần Thị Lan', email: 'lan.tran@gmail.com', phone: '0912345678', points: 15200, rank: 'Bạch Kim', status: 'active', avatar: 'https://i.pravatar.cc/150?img=47', createdAt: '2025-11-05' },
  { uid: 'u003', name: 'Lê Hoàng Nam', email: 'nam.le@yahoo.com', phone: '0901122334', points: 3100, rank: 'Bạc', status: 'active', avatar: 'https://i.pravatar.cc/150?img=12', createdAt: '2026-01-15' },
  { uid: 'u004', name: 'Phạm Thùy Dung', email: 'dung.pham@outlook.com', phone: '0938765432', points: 950, rank: 'Đồng', status: 'locked', avatar: 'https://i.pravatar.cc/150?img=32', createdAt: '2026-03-20' },
  { uid: 'u005', name: 'Hoàng Văn Tùng', email: 'tung.hoang@vivu360.vn', phone: '0977889900', points: 22500, rank: 'Kim Cương', status: 'active', avatar: 'https://i.pravatar.cc/150?img=53', createdAt: '2025-09-01' },
];

const mockDestinations = [
  { id: 'd001', title: 'Vịnh Hạ Long', region: 'Quảng Ninh', zone: 'Miền Bắc', lat: 20.9101, lng: 107.1839, rating: 4.9, reviews: 12450, checkins: 8520, price: '2.500.000đ', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd002', title: 'Sa Pa & Đỉnh Fansipan', region: 'Lào Cai', zone: 'Miền Bắc', lat: 22.3364, lng: 103.8438, rating: 4.8, reviews: 9800, checkins: 6310, price: '1.800.000đ', image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'tour', hasTour360: true },
  { id: 'd003', title: 'Quần thể Tràng An - Bái Đính', region: 'Ninh Bình', zone: 'Miền Bắc', lat: 20.2506, lng: 105.9745, rating: 4.85, reviews: 7600, checkins: 5120, price: '650.000đ', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd004', title: 'Phố cổ Hà Nội & Hồ Hoàn Kiếm', region: 'Hà Nội', zone: 'Miền Bắc', lat: 21.0285, lng: 105.8542, rating: 4.75, reviews: 18200, checkins: 14500, price: 'Miễn phí', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd005', title: 'Cố đô Huế & Sông Hương', region: 'Thừa Thiên Huế', zone: 'Miền Trung', lat: 16.4637, lng: 107.5909, rating: 4.7, reviews: 8900, checkins: 4890, price: '450.000đ', image: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd006', title: 'Bà Nà Hills & Cầu Vàng', region: 'Đà Nẵng', zone: 'Miền Trung', lat: 15.9967, lng: 107.9868, rating: 4.92, reviews: 21500, checkins: 16800, price: '950.000đ', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'ticket', hasTour360: true },
  { id: 'd007', title: 'Phố cổ Hội An', region: 'Quảng Nam', zone: 'Miền Trung', lat: 15.8801, lng: 108.3380, rating: 4.88, reviews: 16400, checkins: 12900, price: '120.000đ', image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd008', title: 'Bãi biển Nha Trang & VinWonders', region: 'Khánh Hòa', zone: 'Miền Trung', lat: 12.2388, lng: 109.1967, rating: 4.8, reviews: 13200, checkins: 9400, price: '880.000đ', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'hotel', hasTour360: true },
  { id: 'd009', title: 'Thành phố sương mù Đà Lạt', region: 'Lâm Đồng', zone: 'Miền Trung', lat: 11.9404, lng: 108.4583, rating: 4.86, reviews: 19800, checkins: 15100, price: '1.200.000đ', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'hotel', hasTour360: true },
  { id: 'd010', title: 'Phong Nha - Kẻ Bàng', region: 'Quảng Bình', zone: 'Miền Trung', lat: 17.5903, lng: 106.2833, rating: 4.95, reviews: 6200, checkins: 3800, price: '1.500.000đ', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'tour', hasTour360: true },
  { id: 'd011', title: 'Phố đi bộ Nguyễn Huệ & Chợ Bến Thành', region: 'TP. Hồ Chí Minh', zone: 'Miền Nam', lat: 10.7769, lng: 106.7009, rating: 4.7, reviews: 24500, checkins: 21000, price: 'Miễn phí', image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
  { id: 'd012', title: 'Chợ nổi Cái Răng', region: 'Cần Thơ', zone: 'Miền Nam', lat: 10.0062, lng: 105.7469, rating: 4.65, reviews: 5400, checkins: 3200, price: '350.000đ', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'tour', hasTour360: true },
  { id: 'd013', title: 'Đảo ngọc Phú Quốc', region: 'Kiên Giang', zone: 'Miền Nam', lat: 10.2899, lng: 103.9840, rating: 4.91, reviews: 28900, checkins: 22400, price: '3.200.000đ', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'hotel', hasTour360: true },
  { id: 'd014', title: 'Mũi Né - Đồi Cát Bay', region: 'Bình Thuận', zone: 'Miền Nam', lat: 10.9333, lng: 108.2833, rating: 4.68, reviews: 7100, checkins: 4900, price: '500.000đ', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: false },
  { id: 'd015', title: 'Quần đảo Côn Đảo', region: 'Bà Rịa - Vũng Tàu', zone: 'Miền Nam', lat: 8.6833, lng: 106.6000, rating: 4.89, reviews: 4300, checkins: 2900, price: '2.800.000đ', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', status: 'active', type: 'destination', hasTour360: true },
];

const mockTickets = [
  { code: 'VV360-HL4829', userId: 'u001', userName: 'Nguyễn Minh', destination: 'Vịnh Hạ Long', region: 'Quảng Ninh', date: '2026-06-18', guests: 2, price: '2.500.000đ', status: 'confirmed', createdAt: '2026-06-10' },
  { code: 'VV360-BN9921', userId: 'u002', userName: 'Trần Thị Lan', destination: 'Bà Nà Hills & Cầu Vàng', region: 'Đà Nẵng', date: '2026-07-02', guests: 4, price: '3.800.000đ', status: 'confirmed', createdAt: '2026-06-25' },
  { code: 'VV360-PQ1104', userId: 'u005', userName: 'Hoàng Văn Tùng', destination: 'Đảo ngọc Phú Quốc', region: 'Kiên Giang', date: '2026-07-15', guests: 2, price: '6.400.000đ', status: 'confirmed', createdAt: '2026-07-01' },
];

const mockPosts = [];
const mockChatGroups = [];

async function getDashboardStats() {
  const users = await getUsers();
  const totalUsers = users.length;

  // --- Posts: Firestore → MongoDB API → fallback 0
  let totalPosts = 0;
  let allPostsList = [];
  try {
    if (isFirebaseConnected) {
      const fsP = await getFirestorePosts();
      if (fsP.length > 0) { allPostsList = fsP; }
    }
  } catch(e) {}
  if (allPostsList.length === 0) {
    try {
      const mp = await getAllMongoPosts();
      if (Array.isArray(mp)) allPostsList = mp;
    } catch(e) {}
  }
  totalPosts = allPostsList.length;

  // --- Groups: Firestore → MongoDB API → fallback 0
  let totalGroups = 0;
  try {
    if (isFirebaseConnected) {
      const fsG = await getFirestoreGroups();
      if (fsG.length > 0) { totalGroups = fsG.length; }
    }
  } catch(e) {}
  if (totalGroups === 0) {
    try {
      const mg = await getAllMongoGroups();
      if (Array.isArray(mg)) totalGroups = mg.length;
    } catch(e) {}
  }

  // --- Destinations: MongoDB API → Firestore → mock
  let destinationsList = [];
  try {
    const { getAllMongoDestinations } = require('./mongodbApi');
    const mongoD = await getAllMongoDestinations();
    if (mongoD && mongoD.length > 0) destinationsList = mongoD;
  } catch(e) {}
  if (destinationsList.length === 0 && isFirebaseConnected) {
    try {
      const fsD = await getFirestoreDestinations();
      if (fsD.length > 0) destinationsList = fsD;
    } catch(e) {}
  }
  if (destinationsList.length === 0) destinationsList = mockDestinations;
  const totalObjects = destinationsList.length;

  // --- Tickets: Firestore / API → mock
  const ticketsList = await getTickets();
  const totalTickets = ticketsList.length;
  const confirmedTickets = ticketsList.filter(t => t.status === 'confirmed').length;
  const pendingTickets   = ticketsList.filter(t => t.status === 'pending').length;
  const cancelledTickets = ticketsList.filter(t => t.status === 'cancelled').length;

  const parsePrice = (pStr) => {
    if (!pStr) return 0;
    const num = parseInt(String(pStr).replace(/[^0-9]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };
  const confirmedTicketsArray = ticketsList.filter(t => t.status === 'confirmed');
  const revenueVal = confirmedTicketsArray.reduce((sum, t) => sum + parsePrice(t.price) * (t.guests || 1), 0);
  const totalRevenue = revenueVal.toLocaleString('vi-VN') + 'đ';

  const monthlyBookings = [12, 18, 25, 22, 30, 28, 35, 42, 38, 45, 50, 48];
  const monthlyRevenue = [
    6800000, 9500000, 14200000, 11800000, 18000000, 15500000,
    22000000, 25800000, 21200000, 24500000, 29000000, revenueVal
  ];

  const regionCounts = {};
  ticketsList.forEach(t => {
    const key = t.region || 'Khác';
    regionCounts[key] = (regionCounts[key] || 0) + (t.guests || 1);
  });
  const topRegions = Object.entries(regionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const recentActivities = [
    { type: 'user', message: 'Hệ thống Admin đang hoạt động đồng bộ MongoDB & Firebase', time: 'Vừa xong', icon: 'check-circle' }
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
    monthlyBookings,
    monthlyRevenue,
    topRegions,
    recentActivities,
    recentUsers,
  };
}

async function getFirestorePosts() {
  if (!isFirebaseConnected) return [];
  try {
    const collections = ['posts', 'community_posts', 'feeds'];
    for (const colName of collections) {
      const snap = await db.collection(colName).limit(200).get();
      if (!snap.empty) {
        const posts = [];
        snap.forEach(doc => {
          const data = doc.data();
          posts.push({
            id: doc.id,
            _id: doc.id,
            ...data,
            createdAt: safeDate(data.createdAt || data.timestamp || new Date()),
          });
        });
        console.log(`🔥 Đã tải ${posts.length} bài viết thực tế từ Firestore collection '${colName}'`);
        return posts;
      }
    }
  } catch (e) {
    console.warn('⚠️ Lỗi đọc Firestore posts:', e.message);
  }
  return [];
}

async function getFirestoreGroups() {
  if (!isFirebaseConnected) return [];
  try {
    const collections = ['groups', 'chat_groups', 'rooms'];
    for (const colName of collections) {
      const snap = await db.collection(colName).limit(100).get();
      if (!snap.empty) {
        const groups = [];
        snap.forEach(doc => {
          const data = doc.data();
          groups.push({
            id: doc.id,
            _id: doc.id,
            ...data,
            createdAt: safeDate(data.createdAt || data.timestamp || new Date()),
          });
        });
        console.log(`🔥 Đã tải ${groups.length} nhóm chat thực tế từ Firestore collection '${colName}'`);
        return groups;
      }
    }
  } catch (e) {
    console.warn('⚠️ Lỗi đọc Firestore groups:', e.message);
  }
  return [];
}

async function getFirestoreDestinations() {
  if (!isFirebaseConnected) return [];
  try {
    const collections = ['destinations', 'tours', 'locations', 'places'];
    for (const colName of collections) {
      const snap = await db.collection(colName).limit(100).get();
      if (!snap.empty) {
        const destinations = [];
        snap.forEach(doc => {
          const data = doc.data();
          destinations.push({
            id: doc.id,
            _id: doc.id,
            ...data,
          });
        });
        console.log(`🔥 Đã tải ${destinations.length} điểm đến thực tế từ Firestore collection '${colName}'`);
        return destinations;
      }
    }
  } catch (e) {
    console.warn('⚠️ Lỗi đọc Firestore destinations:', e.message);
  }
  return [];
}

async function getFirestoreTickets() {
  if (!isFirebaseConnected) return [];
  try {
    const collections = ['tickets', 'bookings', 'orders', 'reservations'];
    for (const colName of collections) {
      const snap = await db.collection(colName).limit(100).get();
      if (!snap.empty) {
        const tickets = [];
        snap.forEach(doc => {
          const data = doc.data();
          tickets.push({
            code: doc.id,
            id: doc.id,
            ...data,
          });
        });
        console.log(`🔥 Đã tải ${tickets.length} vé du lịch thực tế từ Firestore collection '${colName}'`);
        return tickets;
      }
    }
  } catch (e) {
    console.warn('⚠️ Lỗi đọc Firestore tickets:', e.message);
  }
  return [];
}

async function getTickets() {
  try {
    const { getMongoTickets } = require('./mongodbApi');
    const apiTickets = await getMongoTickets();
    if (apiTickets && apiTickets.length > 0) return apiTickets;
  } catch(e) {}
  if (isFirebaseConnected) {
    const fsTickets = await getFirestoreTickets();
    if (fsTickets.length > 0) return fsTickets;
  }
  return mockTickets;
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
  getTickets,
  getFirestorePosts,
  getFirestoreGroups,
  getFirestoreDestinations,
  getFirestoreTickets,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
};
// Trigger nodemon reload
