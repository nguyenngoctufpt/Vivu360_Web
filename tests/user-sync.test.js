const assert = require('assert');
const { normalizeUserForAdmin, getUsers } = require('../config/firebase');

const sample = {
  uid: 'u999',
  email: 'user@example.com',
  displayName: 'Người dùng mới',
  phoneNumber: '+84123456789',
  photoURL: 'https://example.com/avatar.png',
  createdAt: 1710000000000,
};

const normalized = normalizeUserForAdmin(sample);
assert.strictEqual(normalized.email, 'user@example.com');
assert.strictEqual(normalized.name, 'Người dùng mới');
assert.strictEqual(normalized.status, 'active');
assert.strictEqual(normalized.rank, 'Đồng');
assert.strictEqual(normalized.points, 0);

(async () => {
  const users = await getUsers();
  assert.ok(Array.isArray(users), 'getUsers should return an array');
  console.log('user-sync test passed');
})();
