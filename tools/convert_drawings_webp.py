import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image

DRAWINGS_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "drawings"

def convert_single_file(png_path):
    webp_path = png_path.with_suffix(".webp")
    try:
        with Image.open(png_path) as img:
            orig_size = img.size
            if img.mode in ("RGBA", "LA") or "transparency" in img.info:
                save_img = img.convert("RGBA")
            else:
                save_img = img

            save_img.save(webp_path, "WEBP", quality=88, method=4, exact=True)
            
            with Image.open(webp_path) as check_img:
                if check_img.size != orig_size:
                    return png_path.name, False, f"Dimension mismatch: {orig_size} vs {check_img.size}"
                return png_path.name, True, None
    except Exception as err:
        return png_path.name, False, str(err)

def run_conversion():
    if not DRAWINGS_DIR.exists():
        print(f"Error: Directory {DRAWINGS_DIR} does not exist.")
        sys.exit(1)

    png_files = sorted(list(DRAWINGS_DIR.glob("*.png")))
    initial_count = len(png_files)
    initial_bytes = sum(f.stat().st_size for f in png_files)

    print("==========================================")
    print("STAGE 1: RECORDING BASELINE METRICS")
    print("==========================================")
    print(f"Target Directory : {DRAWINGS_DIR}")
    print(f"Initial PNG Count: {initial_count}")
    print(f"Total PNG Size   : {initial_bytes / 1024 / 1024:.2f} MB ({initial_bytes:,} bytes)\n")

    print("==========================================")
    print("STAGE 2: PARALLEL CONVERTING PNG TO WEBP (QUALITY 88)")
    print("==========================================")

    converted_count = 0
    failed_conversions = []

    workers = min(32, (os.cpu_count() or 4) * 2)
    print(f"Executing conversion with {workers} parallel threads...")

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(convert_single_file, p): p for p in png_files}
        completed = 0
        for future in as_completed(futures):
            completed += 1
            fname, success, err = future.result()
            if success:
                converted_count += 1
            else:
                failed_conversions.append((fname, err))

            if completed % 50 == 0 or completed == initial_count:
                print(f"Progress: {completed}/{initial_count} files processed...")

    print("\n==========================================")
    print("STAGE 3: VERIFICATION METRICS")
    print("==========================================")
    webp_files = sorted(list(DRAWINGS_DIR.glob("*.webp")))
    final_webp_count = len(webp_files)
    final_webp_bytes = sum(f.stat().st_size for f in webp_files)
    bytes_saved = initial_bytes - final_webp_bytes
    pct_saved = (bytes_saved / initial_bytes * 100) if initial_bytes > 0 else 0.0

    print(f"Source PNG Count    : {initial_count}")
    print(f"Generated WebP Count: {final_webp_count}")
    print(f"Failed Conversions  : {len(failed_conversions)}")
    if failed_conversions:
        for fname, reason in failed_conversions:
            print(f"  - Failed: {fname} -> {reason}")

    print(f"Total PNG Size      : {initial_bytes / 1024 / 1024:.2f} MB ({initial_bytes:,} bytes)")
    print(f"Total WebP Size     : {final_webp_bytes / 1024 / 1024:.2f} MB ({final_webp_bytes:,} bytes)")
    print(f"Net Space Saved     : {bytes_saved / 1024 / 1024:.2f} MB ({bytes_saved:,} bytes)")
    print(f"Percentage Reduced  : {pct_saved:.2f}%\n")

    if webp_files:
        sample = webp_files[0]
        with Image.open(sample) as sample_img:
            print("Sample WebP Inspection:")
            print(f"  - Filename   : {sample.name}")
            print(f"  - Dimensions : {sample_img.size[0]}x{sample_img.size[1]} px")
            print(f"  - Color Mode : {sample_img.mode}")
            print(f"  - Transparency Has Alpha: {'Yes' if 'A' in sample_img.mode else 'No'}\n")

    if len(failed_conversions) > 0 or final_webp_count != initial_count:
        print("CRITICAL WARNING: Conversion anomalies detected! Aborting stage.")
        sys.exit(1)

if __name__ == "__main__":
    run_conversion()
