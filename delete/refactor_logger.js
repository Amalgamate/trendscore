const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  let hasChanges = false;
  
  if (newContent.includes('console.log(') || newContent.includes('console.error(') || newContent.includes('console.warn(')) {
    hasChanges = true;
    
    // Add import if not exists
    if (!newContent.includes("import logger from '../utils/logger'") && !newContent.includes('import logger from "../utils/logger"')) {
      // Find the last import
      const importRegex = /^import\s+.*?;?\s*$/gm;
      let lastImportIndex = 0;
      let match;
      while ((match = importRegex.exec(newContent)) !== null) {
        lastImportIndex = match.index + match[0].length;
      }
      
      const importStatement = `\nimport logger from '../utils/logger';`;
      if (lastImportIndex > 0) {
        newContent = newContent.slice(0, lastImportIndex) + importStatement + newContent.slice(lastImportIndex);
      } else {
        newContent = importStatement.trim() + '\n\n' + newContent;
      }
    }

    newContent = newContent.replace(/console\.log\(/g, 'logger.info(');
    newContent = newContent.replace(/console\.error\(/g, 'logger.error(');
    newContent = newContent.replace(/console\.warn\(/g, 'logger.warn(');
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(controllersDir);
