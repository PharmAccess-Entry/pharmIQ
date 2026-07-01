const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (content.includes('₦')) {
        // Skip format.ts and countryDetect.ts
        if (fullPath.includes('format.ts') || fullPath.includes('countryDetect.ts')) continue;
        
        let original = content;

        // Add import if not present
        if (!content.includes('getCurrencySymbol')) {
            const lastImportIndex = content.lastIndexOf('import ');
            if (lastImportIndex !== -1) {
                const endOfLastImport = content.indexOf('\n', lastImportIndex);
                content = content.slice(0, endOfLastImport + 1) + 'import { getCurrencySymbol } from "@/lib/format";\n' + content.slice(endOfLastImport + 1);
            } else {
                content = 'import { getCurrencySymbol } from "@/lib/format";\n' + content;
            }
        }
        
        // Replace in JSX text: (₦) -> ({getCurrencySymbol()})
        content = content.replace(/\(₦\)/g, '({getCurrencySymbol()})');
        
        // Replace in template strings: ₦${ -> ${getCurrencySymbol()}${
        content = content.replace(/₦\$\{/g, '${getCurrencySymbol()}${');
        
        // Replace in JSX: >₦{ -> >{getCurrencySymbol()}{
        content = content.replace(/>₦\{/g, '>{getCurrencySymbol()}{');
        
        // Replace ₦0 -> ${getCurrencySymbol()}0 or {getCurrencySymbol()}0 depending on context
        // In JSX text (like <span>₦0</span>)
        content = content.replace(/>₦0</g, '>{getCurrencySymbol()}0<');
        // In template strings (like `Total Cost Loss: ₦0`)
        content = content.replace(/₦0/g, '${getCurrencySymbol()}0');
        // Fix double replacement if >₦0< became >${getCurrencySymbol()}0<
        content = content.replace(/>\$\{getCurrencySymbol\(\)\}0</g, '>{getCurrencySymbol()}0<');

        // Note: we purposefully don't replace standalone ₦ in strings like placeholder="e.g. ₦, $, £" 
        // to avoid breaking literal examples.

        if (original !== content) {
          fs.writeFileSync(fullPath, content);
          console.log('Updated', fullPath);
        }
      }
    }
  }
}

processDir(path.join(process.cwd(), 'src/pages'));
