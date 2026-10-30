import hashlib
import io
import random
import zipfile
from pathlib import Path

FIXED_ZIP_TIME = (2026, 1, 1, 0, 0, 0)


def rng(*parts) -> random.Random:
    """Deterministic RNG keyed by the build seed and any identifying parts."""
    return random.Random("|".join(str(p) for p in parts))


def fmt_value(value, unit):
    if value is None:
        return None
    if unit == "USD":
        return f"${int(value):,}"
    if unit == "percent":
        return f"{value}%"
    if unit is None:
        return value
    n = int(value) if str(value).isdigit() else value
    if isinstance(n, int) and n == 1 and unit.endswith("s"):
        unit = unit[:-1]
    if isinstance(n, int) and n >= 1000:
        n = f"{n:,}"
    return f"{n} {unit}"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_zip(path: Path, rewrite=None):
    """Rewrite a zip (ODT/DOCX) with fixed entry timestamps so output is byte-stable.

    `rewrite(name, data) -> data` may scrub volatile XML such as creation dates.
    The `mimetype` entry stays first and stored, as ODF requires.
    """
    src = zipfile.ZipFile(path)
    entries = [(i, src.read(i.filename)) for i in src.infolist()]
    src.close()
    entries.sort(key=lambda e: (e[0].filename != "mimetype", e[0].filename))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as out:
        for info, data in entries:
            if rewrite:
                data = rewrite(info.filename, data)
            zi = zipfile.ZipInfo(info.filename, FIXED_ZIP_TIME)
            zi.compress_type = zipfile.ZIP_STORED if info.filename == "mimetype" else zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            out.writestr(zi, data)
    path.write_bytes(buf.getvalue())
