const fs = require('fs');
const path = require('path');

function getDirectoryTree(dirPath, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return '';
  let result = '';
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  
  // Sort directories first, then files
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const item of items) {
    if (item.name === 'node_modules' || item.name === '.git' || item.name === '.next' || item.name === 'dist') continue;
    
    const prefix = '  '.repeat(depth) + (item.isDirectory() ? '📂 ' : '📄 ');
    result += `${prefix}${item.name}\n`;
    
    if (item.isDirectory()) {
      result += getDirectoryTree(path.join(dirPath, item.name), depth + 1, maxDepth);
    }
  }
  return result;
}

try {
  console.log("=== PROJECT STRUCTURE ===");
  console.log("\n[React App]");
  console.log(getDirectoryTree('d:/TFB/react-app/src', 0, 2));
  
  console.log("\n[Fullstack App]");
  console.log(getDirectoryTree('d:/TFB/fullstack-app/src', 0, 2));

  console.log("\n=== DATABASE MIGRATIONS ===");
  const migrationsPath = 'd:/TFB/fullstack-app/supabase/migrations';
  if (fs.existsSync(migrationsPath)) {
    const files = fs.readdirSync(migrationsPath);
    files.forEach(f => console.log(f));
  }

  console.log("\n=== EDGE FUNCTIONS ===");
  const functionsPath = 'd:/TFB/fullstack-app/supabase/functions';
  if (fs.existsSync(functionsPath)) {
    const dirs = fs.readdirSync(functionsPath, { withFileTypes: true }).filter(d => d.isDirectory());
    dirs.forEach(d => console.log(d.name));
  }

  console.log("\n=== DEPENDENCIES ===");
  const reactPkg = JSON.parse(fs.readFileSync('d:/TFB/react-app/package.json', 'utf8'));
  console.log("React App Core:", Object.keys(reactPkg.dependencies).join(', '));
  
  const fsPkg = JSON.parse(fs.readFileSync('d:/TFB/fullstack-app/package.json', 'utf8'));
  console.log("Fullstack App Core:", Object.keys(fsPkg.dependencies).join(', '));

} catch (err) {
  console.error("Error analyzing:", err.message);
}
