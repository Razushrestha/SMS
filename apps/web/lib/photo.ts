const types = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function readPhoto(file: File) {
  if (!types.includes(file.type)) return Promise.reject(new Error("Photo must be a JPG, PNG, GIF, or WEBP"));
  if (file.size > 100 * 1024) return Promise.reject(new Error("Photo must be 100 KB or smaller"));
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the photo"));
    reader.readAsDataURL(file);
  });
}
