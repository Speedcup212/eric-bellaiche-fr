const fs = require('fs');
const p = 'src/patrimony-dark.css';
let s = fs.readFileSync(p, 'utf8');
const marker = '/* Regulatory question cards — reinforced separators */';
if (!s.includes(marker)) {
  s += `\n\n${marker}\n.recueil-regulatory > fieldset,\n.recueil-regulatory > label,\n.recueil-regulatory > div.text-sm.font-semibold {\n  border-color: rgba(59, 130, 246, 0.78) !important;\n  background: linear-gradient(180deg, rgba(59, 130, 246, 0.09), rgba(255, 255, 255, 0.025)) !important;\n  box-shadow: inset 3px 0 0 #3b82f6, 0 10px 24px -20px rgba(37, 99, 235, 0.85) !important;\n}\n\n.recueil-regulatory > fieldset:hover,\n.recueil-regulatory > label:hover,\n.recueil-regulatory > div.text-sm.font-semibold:hover {\n  border-color: #60a5fa !important;\n}\n`;
  fs.writeFileSync(p, s);
}
console.log('Regulatory question borders reinforced');
