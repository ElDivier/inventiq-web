export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = error => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    img.src = url;
  });
}

export async function optimizeImageFile(file, options = {}) {
  const maxWidth = options.maxWidth || 1200;
  const maxHeight = options.maxHeight || 1200;
  const quality = options.quality || 0.82;
  const outputType = options.outputType || 'image/jpeg';
  const outputName = `${String(file.name || 'imagen').replace(/\.[^.]+$/, '')}.jpg`;

  const image = await loadImageFromFile(file);
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(Math.round(image.width * ratio), 1);
  const height = Math.max(Math.round(image.height * ratio), 1);

  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, quality));

  if (!blob) return file;

  return new File([blob], outputName, {
    type: outputType,
    lastModified: Date.now(),
  });
}