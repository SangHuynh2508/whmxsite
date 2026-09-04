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

def get_sheet_url():
    if len(sys.argv) > 1:
        return sys.argv[1]
    if URL_CONFIG_PATH.exists():
        url = URL_CONFIG_PATH.read_text(encoding="utf-8").strip()
        if url:
            return url
    return None

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
    url_input = get_sheet_url()
    if not url_input:
        print("=== AUTOMATIC GOOGLE SHEETS LOCALIZATION SYNC ===")
        print("Vui long cung cap Link hoac ID cua Google Sheets!")
        print("Vi du:")
        print("  python tools/update_from_gsheets.py https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit")
        print("\nHoac luu Link vao file tools/gsheets_url.txt")
        sys.exit(1)

    export_url = extract_export_url(url_input)
    print(f"=== DOWNLOADING LOCALIZATION FROM GOOGLE SHEETS ===")
    print(f"Export URL: {export_url}")
    
    EXCEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    req = urllib.request.Request(
        export_url, 
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 100.0; Win64; x64)"}
    )
    
    try:
        with urllib.request.urlopen(req) as resp, open(EXCEL_PATH, "wb") as f:
            f.write(resp.read())
        print(f"✅ Downloaded updated Excel to {EXCEL_PATH}")
    except Exception as e:
        print(f"❌ Error downloading from Google Sheets: {e}")
        print("Dam bao bang tinh Google Sheets da bat che do: 'Bat ky ai co lien ket deu co the xem' (Anyone with link can view).")
        sys.exit(1)

    # Step 1: Build web data JSON
    run_step(f"{sys.executable} tools/build_web_data.py")

    # Step 2: Validate data
    run_step(f"{sys.executable} tools/validate_data.py")

    # Step 3: Run npm build
    run_step("npm run build")

    # Step 4: Commit to Git & Push
    run_step('git add .')
    run_step('git commit -m "chore: sync localization from Google Sheets"')
    run_step('git push origin main')

    # Step 5: Deploy to Vercel
    run_step('npx vercel --prod --yes')

    print("\n🎉 HOAN TAT! DDL Google Sheets da duoc sync & deploy len Vercel Production!")

if __name__ == "__main__":
    main()
