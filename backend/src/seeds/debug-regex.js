const code = `<div style="background-color: #87CEEB; color: white; display: flex; justify-content: center; align-items: center; height: 100vh;">
  <h1>Bienvenidos</h1>
</div>`;

const styleRegex = new RegExp('<div\\b[^>]*style\\s*=\\s*"([^"]*)"', 'i');
const match = code.match(styleRegex);
console.log('Match:', match);

if (match) {
  const propRegex = new RegExp('color\\s*:\\s*([^;]+)', 'i');
  const propMatch = match[1].match(propRegex);
  console.log('Prop match:', propMatch);
  if (propMatch) {
    console.log('Includes white:', propMatch[1].toLowerCase().includes('white'));
  }
}
