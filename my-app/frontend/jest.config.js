/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
  moduleNameMapper: {
    // ถ้าใช้ import ไฟล์ css/svg ในคอมโพเนนต์:
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
  },
};
