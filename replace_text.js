import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('c:/Users/PC/Desktop/netlify/PharmIQ/src');
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    let newContent = content;

    // Placeholders & Labels
    newContent = newContent.replace(/you@restaurant\.ng/gi, 'you@pharmacy.ng');
    newContent = newContent.replace(/you@business\.ng/gi, 'you@pharmacy.ng');
    newContent = newContent.replace(/Mama Cass Kitchen/gi, 'MedPlus Pharmacy');
    newContent = newContent.replace(/Restaurant \/ Eatery/gi, 'Pharmacy / Retail Store');
    newContent = newContent.replace(/e\.g\. Mama Cass/gi, 'e.g. MedPlus Pharmacy');
    newContent = newContent.replace(/Restaurant Name/gi, 'Pharmacy Name');
    
    // AuthShell subtitles
    newContent = newContent.replace(/Start taking orders from QR codes today/gi, 'Start managing your pharmacy sales & inventory today');
    newContent = newContent.replace(/Start taking orders today/gi, 'Start managing your pharmacy today');
    
    // Other common visible UI text (careful not to break code)
    newContent = newContent.replace(/Your restaurant/g, 'Your pharmacy');
    newContent = newContent.replace(/your restaurant/g, 'your pharmacy');
    newContent = newContent.replace(/>Restaurant</g, '>Pharmacy<');
    newContent = newContent.replace(/>Restaurants</g, '>Pharmacies<');
    newContent = newContent.replace(/>restaurant</g, '>pharmacy<');
    newContent = newContent.replace(/"Restaurant"/g, '"Pharmacy"');
    newContent = newContent.replace(/restaurant software/gi, 'pharmacy software');
    newContent = newContent.replace(/restaurant operations/gi, 'pharmacy operations');
    newContent = newContent.replace(/Restaurant operations/g, 'Pharmacy operations');
    
    // Specific elements like pricing page strings
    newContent = newContent.replace(/QR restaurant ordering/gi, 'pharmacy POS');
    newContent = newContent.replace(/Nigerian restaurants/gi, 'Nigerian pharmacies');
    newContent = newContent.replace(/restaurant QR/gi, 'pharmacy POS');
    
    // Contact & About specific
    newContent = newContent.replace(/SmartTable/g, 'PharmIQ');
    newContent = newContent.replace(/getsmarttable\.com/g, 'getpharmiq.com');
    
    if (newContent !== content) {
        fs.writeFileSync(file, newContent);
        changedFiles++;
    }
});
console.log('Modified ' + changedFiles + ' files.');
