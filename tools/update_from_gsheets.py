import os
import sys
import json
import urllib.request
import subprocess
from pathlib import Path

# Paths
TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_DIR = TOOLS_DIR.parent
EXCEL_PATH = PROJECT_DIR / "localization" / "names_vi.xlsx"
URL_CONFIG_PATH = TOOLS_DIR / "gsheets_url.txt"

def get_args():
    args = sys.argv[1:]
    file_only = "--file-only" in args or "--download-only" in args
    local_only = "--local-only" in args
    
    # Filter out flags to find sheet URL if passed as positional arg
    urls = [a for a in args if not a.startswith("--")]
    url = urls[0] if urls else None
    
    if not url and URL_CONFIG_PATH.exists():
        u = URL_CONFIG_PATH.read_text(encoding="utf-8").strip()
        if u:
            url = u
            
    return url, file_only, local_only

def extract_export_url(url_or_id):
    if not url_or_id:
        return None
    # If full URL like https://docs.google.com/spreadsheets/d/1ABC.../edit...
    if "spreadsheets/d/" in url_or_id:
        sheet_id = url_or_id.split("spreadsheets/d/")[1].split("/")[0]
    else:
        sheet_id = url_or_id.strip()
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"

def run_step(cmd, cwd=PROJECT_DIR):
    print(f"\n[RUNNING] {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if res.returncode != 0:
        print(f"[ERROR] Step failed: {cmd}")
        sys.exit(1)

def main():
    url_input, file_only, local_only = get_args()
    if not url_input:
        print("=== AUTOMATIC GOOGLE SHEETS LOCALIZATION SYNC ===")
        print("Vui long cung cap Link hoac ID cua Google Sheets!")
        print("Vi du:")
        print("  python tools/update_from_gsheets.py https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit")
        print("  python tools/update_from_gsheets.py --file-only   (Chỉ tải về file names_vi.xlsx)")
        print("  python tools/update_from_gsheets.py --local-only  (Tải về file & build JSON local, không deploy)")
        print("\nHoac luu Link vao file tools/gsheets_url.txt")
        sys.exit(1)

    export_url = extract_export_url(url_input)
    print(f"=== DOWNLOADING LOCALIZATION FROM GOOGLE SHEETS ===")
    print(f"Export URL: {export_url}")
    
    EXCEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    req = urllib.request.Request(
        export_url, 
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )
    
    try:
        with urllib.request.urlopen(req) as resp, open(EXCEL_PATH, "wb") as f:
            f.write(resp.read())
        print(f"[OK] Da tai & dong bo Google Sheets thanh file local: {EXCEL_PATH}")
    except Exception as e:
        print(f"[ERROR] Lỗi tải từ Google Sheets: {e}")
        print("Dam bao bang tinh Google Sheets da bat che do: 'Bat ky ai co lien ket deu co the xem' (Anyone with link can view).")
        sys.exit(1)

    if file_only:
        print("\n[SUCCESS] Che do --file-only: Da cap nhat xong file names_vi.xlsx!")
        return

    # Step 1: Build web data JSON
    run_step(f"{sys.executable} tools/build_web_data.py")

    # Step 2: Validate data
    run_step(f"{sys.executable} tools/validate_data.py")

    if local_only:
        print("\n[SUCCESS] Che do --local-only: Da cap nhat file names_vi.xlsx va build public/data.json thanh cong!")
        return

    # Step 3: Run npm build
    run_step("npm run build")

    # Step 4: Commit to Git & Push
    run_step('git add .')
    run_step('git commit -m "chore: sync localization from Google Sheets"')
    run_step('git push origin main')

    # Step 5: Deploy to Vercel
    run_step('npx vercel --prod --yes')

    print("\n[SUCCESS] HOAN TAT! Du lieu Google Sheets da duoc sync & deploy len Vercel Production!")

if __name__ == "__main__":
    main()
