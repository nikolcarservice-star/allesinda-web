#!/usr/bin/env python3
"""
Generate VAPID keys for Web Push. Add the output to your backend .env.

Run from backend folder:
  pip install py-vapid
  python scripts/generate_vapid_keys.py

Alternative (with Node.js): npx web-push generate-vapid-keys
"""
import sys


def main():
    try:
        from py_vapid import Vapid01
    except ImportError:
        print("Install the py-vapid package: pip install py-vapid", file=sys.stderr)
        print("Then run again: python scripts/generate_vapid_keys.py", file=sys.stderr)
        print("", file=sys.stderr)
        print("Alternative (with Node.js): npx web-push generate-vapid-keys", file=sys.stderr)
        sys.exit(1)

    v = Vapid01()
    v.generate_keys()
    public_key = v.public_key.decode("ascii") if isinstance(v.public_key, bytes) else v.public_key
    private_key = v.private_key.decode("ascii") if isinstance(v.private_key, bytes) else v.private_key

    print("Add these to your backend .env file:")
    print("")
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print(f"VAPID_PRIVATE_KEY={private_key}")
    print("")


if __name__ == "__main__":
    main()
