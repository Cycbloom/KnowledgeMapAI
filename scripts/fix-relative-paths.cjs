const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "dist", "index.html");

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf-8");
  
  html = html.replace(
    /(src|href)=["']\/(assets|registerSW\.js|manifest\.webmanifest|manifest\.json|sw\.js|icons|favicon\.svg)/g,
    '$1="./$2'
  );
  
  html = html.replace(
    /(from|import\(|import\s+["'])\//g,
    '$1./'
  );
  
  const distDir = path.join(__dirname, "..", "dist");
  const jsFiles = findFilesByExtension(distDir, ".js");
  
  jsFiles.forEach((jsFile) => {
    let jsContent = fs.readFileSync(jsFile, "utf-8");
    jsContent = jsContent.replace(
      /(["'])\/(assets|registerSW\.js|manifest\.webmanifest|manifest\.json|sw\.js|icons|favicon\.svg)/g,
      '$1./$2'
    );
    fs.writeFileSync(jsFile, jsContent, "utf-8");
  });
  
  const cssFiles = findFilesByExtension(distDir, ".css");
  
  cssFiles.forEach((cssFile) => {
    let cssContent = fs.readFileSync(cssFile, "utf-8");
    cssContent = cssContent.replace(
      /(url\(["']?)\/(assets|icons)/g,
      '$1./$2'
    );
    fs.writeFileSync(cssFile, cssContent, "utf-8");
  });
  
  fs.writeFileSync(indexPath, html, "utf-8");
  console.log("✓ 已将 dist 目录中的所有资源路径修改为相对路径");
} else {
  console.error("✗ 未找到 dist/index.html 文件");
  process.exit(1);
}

function findFilesByExtension(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(findFilesByExtension(filePath, ext));
    } else if (file.endsWith(ext)) {
      results.push(filePath);
    }
  });
  
  return results;
}
