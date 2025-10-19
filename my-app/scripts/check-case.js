// scripts/check-case.js
const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const { join, dirname, resolve } = require('path');

// รันสคริปต์จากรูทโปรเจกต์ (โฟลเดอร์ที่มี my-app)
// ในเครื่องคุณกำลังอยู่ที่ my-app/ แล้ว ดังนั้นเราจะอ้างพาธจากที่นี่
const BACKEND_ROOT = resolve(process.cwd(), 'backend');

// ดึงรายการไฟล์จาก git แล้วกรอง .js ในโค้ด (ไม่ใช้ findstr)
function listFiles() {
  const out = execSync('git ls-files', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
  const files = out
    .split(/\r?\n/)
    .map(s => s.trim().replace(/\\/g, '/'))
    .filter(p => p.startsWith('backend/') && p.endsWith('.js'));
  return new Set(files);
}

function caseKey(p) {
  return p.replace(/\\/g, '/');
}

function scanRequires(absPath) {
  const src = readFileSync(absPath, 'utf8');
  // จับ require('./...') / require('../...') แบบพื้นฐาน
  const re = /require\((['"])(\.{1,2}\/[^'"]+)\1\)/g;
  const found = [];
  let m;
  while ((m = re.exec(src))) found.push(m[2]);
  return found;
}

function resolveModulePath(fromRepoPath, reqPath) {
  // fromRepoPath เช่น 'backend/routes/xxx.js'
  const baseRepoDir = dirname(fromRepoPath);
  const cand = [
    join(baseRepoDir, reqPath),
    join(baseRepoDir, reqPath + '.js'),
    join(baseRepoDir, reqPath, 'index.js'),
  ];
  return cand.map(c => c.replace(/\\/g, '/'));
}

(function main() {
  const all = listFiles(); // Set ของพาธไฟล์ตาม git (เคสจริง)
  const files = Array.from(all).filter(p => p.startsWith('backend/'));
  const problems = [];

  for (const repoPath of files) {
    const abs = resolve(process.cwd(), repoPath);
    let reqs = [];
    try {
      reqs = scanRequires(abs);
    } catch {
      continue;
    }
    for (const r of reqs) {
      if (!r.startsWith('./') && !r.startsWith('../')) continue; // ข้าม external modules
      const candidates = resolveModulePath(repoPath, r);

      // มีไฟล์ตรงพาธไหนบ้าง (แบบ normalize)
      const matched = candidates.find(c => all.has(caseKey(c)));
      if (!matched) {
        problems.push({ file: repoPath, requirePath: r, candidates, note: 'Not found' });
      } else {
        // ตรวจว่า "เคส" ตรงเป๊ะกับ entry ใน git หรือไม่
        const hasExact = Array.from(all).some(x => x === matched);
        if (!hasExact) {
          problems.push({ file: repoPath, requirePath: r, candidates, note: 'Case mismatch (exists but different case)' });
        }
      }
    }
  }

  if (problems.length === 0) {
    console.log('✅ No case/path problems detected.');
  } else {
    console.log('❌ Potential problems:\n');
    for (const p of problems) {
      console.log(`- In ${p.file} → require("${p.requirePath}")`);
      console.log(`  Tried:`);
      p.candidates.forEach(c => console.log(`    - ${c}  ${all.has(caseKey(c)) ? '(exists, check exact case)' : '(not found)'}`));
      if (p.note) console.log(`  Note: ${p.note}`);
      console.log('');
    }
    process.exitCode = 1;
  }
})();
