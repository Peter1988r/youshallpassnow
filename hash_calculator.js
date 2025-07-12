const crypto = require('crypto');

// Script 2: Force dark mode script (lines 514-519)
const script2 = `        // Force dark mode permanently
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode');
        localStorage.removeItem('theme');`;

function calculateHash(script) {
    return crypto.createHash('sha256').update(script).digest('base64');
}

console.log('Script 2 hash:', calculateHash(script2));
console.log('Target hash: Tts/1SPznKqC6oT6QmVCB48rzh7RBtfnDiZSTnWjVeQ=');

// Let's also try variations with different whitespace
const script2_variation1 = `// Force dark mode permanently
document.documentElement.setAttribute('data-theme', 'dark');
document.body.classList.add('dark-mode');
localStorage.removeItem('theme');`;

console.log('Script 2 variation 1 hash:', calculateHash(script2_variation1));

const script2_variation2 = `// Force dark mode permanently
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode');
        localStorage.removeItem('theme');`;

console.log('Script 2 variation 2 hash:', calculateHash(script2_variation2));
