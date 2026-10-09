import os
import shutil

def prepare_static():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dist_dir = os.path.join(base_dir, "dist")
    static_dir = os.path.join(base_dir, "static")

    if not os.path.exists(dist_dir):
        print("dist directory not found! Run npm run build first.")
        return

    os.makedirs(static_dir, exist_ok=True)
    shutil.copytree(dist_dir, static_dir, dirs_exist_ok=True)
    print(f"Successfully synced {dist_dir} -> {static_dir}")

if __name__ == "__main__":
    prepare_static()
