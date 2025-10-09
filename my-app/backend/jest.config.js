/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  // ถ้าใช้ path แปลก ๆ ค่อยเพิ่ม moduleNameMapper ทีหลังได้
};
