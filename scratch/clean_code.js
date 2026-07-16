const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const targetDir = path.join(process.cwd(), 'backend', 'src');

walk(targetDir, (filePath) => {
  if (filePath.endsWith('.js')) {
    console.log('Cleaning:', filePath);
    let content = fs.readFileSync(filePath, 'utf8');
    // Eliminar caracteres especiales comunes de dibujo de cajas y corruptos
    content = content.replace(/[â”─┐└┘┬┴┼]/g, '');
    fs.writeFileSync(filePath, content, 'utf8');
  }
});

console.log('¡Limpieza completada con éxito!');
