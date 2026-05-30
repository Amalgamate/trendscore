const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            if (/\.(jsx|js|tsx|ts)$/.test(dirPath)) {
                callback(dirPath);
            }
        }
    });
}

let modifiedCount = 0;

walkDir(targetDir, (filePath) => {
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    
    let newContent = originalContent
        // Downgrade extreme heavy weights
        .replace(/\bfont-black\b/g, 'font-semibold')
        .replace(/\bfont-extrabold\b/g, 'font-semibold')
        // Downgrade standard bold to medium
        .replace(/\bfont-bold\b/g, 'font-medium')
        // Clean up explicit font families
        .replace(/\bfont-\['Poppins'\]\s?/g, '')
        .replace(/\bfont-\["Poppins"\]\s?/g, '')
        .replace(/\bfont-\['Raleway'\]\s?/g, '')
        .replace(/\bfont-\["Raleway"\]\s?/g, '');

    if (originalContent !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        modifiedCount++;
        console.log(`Updated typography in: ${path.relative(__dirname, filePath)}`);
    }
});

console.log(`\nTypography sweep complete. Modified ${modifiedCount} files.`);
