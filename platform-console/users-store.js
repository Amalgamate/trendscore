'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function createUsersStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const filename = path.join(dataDir, 'console-users.store.json');
  let users = [];
  try {
    const stored = JSON.parse(fs.readFileSync(filename, 'utf8'));
    users = Array.isArray(stored) ? stored : [];
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const now = () => new Date().toISOString();
  const persist = () => {
    const temp = `${filename}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(users, null, 2), { mode: 0o600 });
    fs.renameSync(temp, filename);
  };
  const safeCopy = user => user ? { ...user } : null;
  const listUsers = () => users.map(safeCopy).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const getUser = id => safeCopy(users.find(user => user.id === String(id)));
  const getUserByEmail = email => safeCopy(users.find(user => user.email === String(email || '').trim().toLowerCase()));
  function createUser({ email, name = '', role, active = true, passwordHash }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !passwordHash) throw new Error('Email and password hash are required.');
    if (users.some(user => user.email === normalizedEmail)) throw new Error('An account with that email already exists.');
    const timestamp = now();
    const user = { id: crypto.randomUUID(), email: normalizedEmail, name: String(name || ''), role, active: Boolean(active), passwordHash, sessionVersion: 0, createdAt: timestamp, updatedAt: timestamp, lastLoginAt: '' };
    users.push(user); persist(); return safeCopy(user);
  }
  function updateUser(id, patch = {}) {
    const user = users.find(item => item.id === String(id));
    if (!user) throw new Error('User not found.');
    if (patch.name !== undefined) user.name = String(patch.name || '');
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.active !== undefined) user.active = Boolean(patch.active);
    user.updatedAt = now(); persist(); return safeCopy(user);
  }
  function setPassword(id, passwordHash) {
    const user = users.find(item => item.id === String(id));
    if (!user) throw new Error('User not found.');
    user.passwordHash = passwordHash; user.sessionVersion = Number(user.sessionVersion || 0) + 1; user.updatedAt = now(); persist(); return safeCopy(user);
  }
  function recordLogin(id) {
    const user = users.find(item => item.id === String(id));
    if (!user) return;
    user.lastLoginAt = now(); persist();
  }
  const countActiveByRole = role => users.filter(user => user.role === role && user.active).length;
  return { listUsers, getUser, getUserByEmail, createUser, updateUser, setPassword, recordLogin, countActiveByRole };
}

module.exports = { createUsersStore };
