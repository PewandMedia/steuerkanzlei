const IMAGE_EXT = ["jpg", "jpeg", "png", "webp"];
const IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isImageFile(nameOrMime: string): boolean {
  const v = nameOrMime.toLowerCase();
  if (v.startsWith("image/")) return IMAGE_MIME.includes(v);
  return IMAGE_EXT.includes(getExtension(v));
}

export function isPdfFile(nameOrMime: string): boolean {
  const v = nameOrMime.toLowerCase();
  if (v === "application/pdf") return true;
  return getExtension(v) === "pdf";
}

export function isHeicFile(nameOrMime: string): boolean {
  const v = nameOrMime.toLowerCase();
  if (v === "image/heic" || v === "image/heif") return true;
  const ext = getExtension(v);
  return ext === "heic" || ext === "heif";
}

export function getMimeFromName(name: string): string {
  const ext = getExtension(name);
  switch (ext) {
    case "pdf": return "application/pdf";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

export const ACCEPTED_BELEG_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf";

export function validateBelegFile(file: File, maxSize: number): string | null {
  if (isHeicFile(file.type) || isHeicFile(file.name)) {
    return `${file.name}: HEIC wird nicht unterstützt. Bitte als JPG oder PNG senden.`;
  }
  if (!isPdfFile(file.type) && !isPdfFile(file.name) && !isImageFile(file.type) && !isImageFile(file.name)) {
    return `${file.name}: Nur PDF, JPG, PNG oder WEBP erlaubt.`;
  }
  if (file.size > maxSize) {
    return `${file.name}: Zu groß (max. ${Math.round(maxSize / 1024 / 1024)} MB).`;
  }
  return null;
}