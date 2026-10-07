"""Generate Liquid Glass extension icons (pure stdlib, supersampled)."""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")

# Gradient endpoints (sky -> violet), a glassy liquid look.
C1 = (125, 211, 252)   # #7dd3fc
C2 = (167, 139, 250)   # #a78bfa
C3 = (56, 189, 248)    # deeper cyan for bottom edge


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def make_pixels(size, ss=4):
    """Render at size*ss then box-downsample for smooth antialiasing."""
    big = size * ss
    radius = big * 0.26
    rows = []
    for y in range(big):
        row = []
        for x in range(big):
            # rounded-rect signed distance
            qx = max(radius - x, x - (big - 1 - radius), 0)
            qy = max(radius - y, y - (big - 1 - radius), 0)
            dist = (qx * qx + qy * qy) ** 0.5 - radius
            if dist > 1:
                row.append((0, 0, 0, 0))
                continue
            alpha = 255 if dist <= 0 else int(255 * max(0.0, -dist + 1))

            t = (x / big) * 0.55 + (y / big) * 0.45
            col = lerp(C1, C2, t)
            # deeper glow along the bottom
            if y / big > 0.72:
                col = lerp(col, C3, (y / big - 0.72) / 0.28 * 0.5)

            # diagonal glass highlight band (top-left)
            d = x * 0.62 + y * 0.38
            if d < big * 0.46:
                k = (1 - d / (big * 0.46)) * 120
                col = lerp(col, (255, 255, 255), k / 255)

            # subtle inner rim light at the very edge
            if -8 < dist <= 0:
                col = lerp(col, (255, 255, 255), 0.35)

            # liquid droplet (center)
            cx, cy = big * 0.5, big * 0.52
            dd = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dd < big * 0.17:
                k = 0.35 * (1 - dd / (big * 0.17))
                col = lerp(col, (255, 255, 255), k)
            row.append((col[0], col[1], col[2], alpha))
        rows.append(row)

    # downsample
    out = []
    for y in range(size):
        orow = []
        for x in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    pr, pg, pb, pa = rows[y * ss + sy][x * ss + sx]
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            if a == 0:
                orow.append((0, 0, 0, 0))
            else:
                orow.append((r // a, g // a, b // a, a // (ss * ss)))
        out.append(orow)
    return out


def write_png(path, pixels):
    h = len(pixels)
    w = len(pixels[0])
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("4B", *px) for px in row) for row in pixels
    )

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print(f"wrote {path} ({w}x{h}, {len(png)} bytes)")


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (16, 48, 128):
        write_png(os.path.join(OUT, f"icon{size}.png"), make_pixels(size))


if __name__ == "__main__":
    main()
