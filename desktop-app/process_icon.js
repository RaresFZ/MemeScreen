const { Jimp, rgbaToInt } = require('jimp');

async function processIcon() {
  try {
    const imagePath = 'C:\\Users\\bulan\\.gemini\\antigravity-ide\\brain\\c02deea0-1bb9-45d1-b353-f81e782dfe22\\merged_ms_logo_1782863889863.png';
    const image = await Jimp.read(imagePath);
    
    image.resize({ w: 256, h: 256 });
    
    for(let y = 0; y < image.bitmap.height; y++) {
      for(let x = 0; x < image.bitmap.width; x++) {
        const color = image.getPixelColor(x, y);
        const r = (color >> 24) & 255;
        const g = (color >> 16) & 255;
        const b = (color >> 8) & 255;
        
        const brightness = Math.max(r, g, b);
        
        if (brightness < 15) {
           image.setPixelColor(0x00000000, x, y);
        } else {
           const newColor = rgbaToInt(234, 179, 8, brightness);
           image.setPixelColor(newColor, x, y);
        }
      }
    }
    
    await image.write('icon.png');
    console.log('Processed icon generated successfully');
  } catch (error) {
    console.error(error);
  }
}

processIcon();
