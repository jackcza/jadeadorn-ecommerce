import type { ArtShape } from "./catalog";

const round = (n: number) => Math.round(n * 100) / 100;

// Placeholder jewelry illustrations adapted from the JadeAdorn prototype. No real photos.
export function artSvg(shape: ArtShape, tone: string, label: string): string {
  const common = `fill="none" stroke="${tone}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  let art = "";
  switch (shape) {
    case "bracelet":
      art = `<ellipse cx="105" cy="88" rx="48" ry="34" ${common}/><ellipse cx="105" cy="94" rx="40" ry="27" fill="none" stroke="#829b78" stroke-width="3"/><path d="M91 54l14-7 14 7-14 8z" fill="#e8d8b4" stroke="${tone}" stroke-width="2"/>`;
      break;
    case "beads":
    case "beadbracelet":
    case "jadebeads":
    case "blackbeads": {
      const palette =
        shape === "jadebeads"
          ? ["#b4c8a3", "#829b78", "#d8dfc7"]
          : shape === "blackbeads"
            ? ["#292b29", "#50514d", "#171817"]
            : shape === "beadbracelet"
              ? ["#bd8d59", "#8c572f", "#d6ac72"]
              : [tone];
      art = Array.from({ length: 15 }, (_, i) => {
        const a = (i / 15) * Math.PI * 2;
        return `<circle cx="${round(105 + 53 * Math.cos(a))}" cy="${round(84 + 39 * Math.sin(a))}" r="9" fill="${palette[i % palette.length]}" stroke="${tone}" stroke-width="1.3"/>`;
      }).join("");
      break;
    }
    case "mala":
    case "mala2":
    case "mala3": {
      const r = shape === "mala3" ? 7.5 : 8.2;
      const beads = Array.from({ length: 27 }, (_, i) => {
        const a = (i / 26) * Math.PI * 1.72 + Math.PI * 0.64;
        return `<circle cx="${round(105 + 58 * Math.cos(a))}" cy="${round(78 + 50 * Math.sin(a))}" r="${r}" fill="${tone}" stroke="#6f4c35" stroke-width="1.2"/>`;
      }).join("");
      art =
        beads +
        `<path d="M105 126v17" ${common}/><path d="M99 143l6 9 6-9" fill="${tone}" stroke="#6f4c35" stroke-width="1.5"/>` +
        (shape === "mala2"
          ? `<circle cx="105" cy="78" r="10" fill="#d2b58d" stroke="#6f4c35" stroke-width="2"/>`
          : "");
      break;
    }
  }
  const safeLabel = label.replace(/[&<>"]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 170" role="img" aria-label="${safeLabel}"><title>${safeLabel}</title>${art}</svg>\n`;
}
