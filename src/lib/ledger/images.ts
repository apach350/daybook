async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that photo"));
    reader.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

async function drawJpeg(file: File, maxEdge: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that photo");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => (next ? resolve(next) : reject(new Error("Could not read that photo"))),
      "image/jpeg",
      quality,
    );
  });
  return blob;
}

export async function fileToJpeg(file: File): Promise<{ blob: Blob; base64: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose photos only");
  let blob = await drawJpeg(file, 1280, 0.72);
  let base64 = await blobToBase64(blob);
  if (base64.length > 1_500_000) {
    blob = await drawJpeg(file, 960, 0.55);
    base64 = await blobToBase64(blob);
  }
  return { blob, base64 };
}
