/**
 * A2.3 — export the current map view as a PNG. SVGs rasterized through an
 * <img> cannot fetch external resources, so every visible <image> href is
 * inlined as a data URL first (off-screen hexes are dropped to keep the
 * payload small).
 */
export async function exportMapPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;

  clone.querySelectorAll('foreignObject').forEach((n) => n.remove());

  const toDataUrl = async (href: string) => {
    const blob = await (await fetch(href)).blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  };

  await Promise.all(
    [...clone.querySelectorAll('image')].map(async (img) => {
      const x = parseFloat(img.getAttribute('x') ?? '0');
      const y = parseFloat(img.getAttribute('y') ?? '0');
      const w = parseFloat(img.getAttribute('width') ?? '0');
      const h = parseFloat(img.getAttribute('height') ?? '0');
      const visible =
        x + w >= vb.x && x <= vb.x + vb.width && y + h >= vb.y && y <= vb.y + vb.height;
      if (!visible) {
        img.remove();
        return;
      }
      const href = img.getAttribute('href');
      if (href && !href.startsWith('data:')) {
        try {
          img.setAttribute('href', await toDataUrl(href));
        } catch {
          img.remove();
        }
      }
    }),
  );

  const rect = svg.getBoundingClientRect();
  const scale = 2; // crisp on hi-dpi Discord embeds
  clone.setAttribute('width', String(rect.width * scale));
  clone.setAttribute('height', String(rect.height * scale));

  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
  );
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
