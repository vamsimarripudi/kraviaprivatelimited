"""Fail CI when a self-hosted email icon has corrupted PNG chunks or pixels."""

from pathlib import Path
import struct
import zlib

ASSET_DIRECTORY = Path(__file__).resolve().parents[2] / "Frontend" / "public" / "brand" / "email"
SOCIAL_ICONS = (
    "linkedin.png",
    "linkedin-v2.png",
    "x.png",
    "instagram.png",
    "instagram-v2.png",
    "facebook.png",
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def verify_png(path: Path) -> None:
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError(f"{path.name}: invalid PNG signature")
    offset = len(PNG_SIGNATURE)
    chunks = []
    image_data = bytearray()
    size = None
    while offset < len(data):
        if len(data) - offset < 12:
            raise ValueError(f"{path.name}: truncated chunk header")
        length = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError(f"{path.name}: truncated chunk payload")
        tag = data[offset + 4: offset + 8]
        payload = data[offset + 8:end - 4]
        expected_crc = struct.unpack_from(">I", data, end - 4)[0]
        actual_crc = zlib.crc32(data[offset + 4:end - 4]) & 0xFFFFFFFF
        if expected_crc != actual_crc:
            raise ValueError(f"{path.name}: {tag.decode('ascii', 'replace')} CRC mismatch")
        chunks.append(tag)
        if tag == b"IHDR":
            if len(payload) != 13:
                raise ValueError(f"{path.name}: bad IHDR")
            width, height, depth, color, compression, fltr, interlace = struct.unpack(">IIBBBBB", payload)
            if (width, height, depth, color, compression, fltr, interlace) != (108, 108, 8, 3, 0, 0, 0):
                raise ValueError(f"{path.name}: unexpected image dimensions or mode")
            size = width, height
        if tag == b"IDAT":
            image_data.extend(payload)
        offset = end
        if tag == b"IEND":
            break
    if not chunks or chunks[0] != b"IHDR" or chunks[-1] != b"IEND" or b"PLTE" not in chunks or not image_data or offset != len(data):
        raise ValueError(f"{path.name}: malformed image structure or trailing bytes")
    decoded = zlib.decompress(image_data)
    if size is None or len(decoded) != size[1] * (1 + size[0]):
        raise ValueError(f"{path.name}: truncated or malformed pixel data")
    print(f"VALID PNG: {path.name} ({size[0]}x{size[1]})")


def main() -> None:
    for filename in SOCIAL_ICONS:
        verify_png(ASSET_DIRECTORY / filename)


if __name__ == "__main__":
    main()
