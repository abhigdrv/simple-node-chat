// Utility functions
export function generateColorHash(name) {
  let hashCode = 0;
  for (let i = 0; i < name.length; i++) {
    hashCode = name.charCodeAt(i) + ((hashCode << 5) - hashCode);
  }
  const hue = Math.abs(hashCode % 360);
  return `hsl(${hue}, 65%, 45%)`;
}