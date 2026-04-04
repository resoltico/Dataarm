#!/usr/bin/env python3
import json, sys

def main():
    args = sys.argv[1:]
    target_id = "unknown-target"
    if "--target" in args:
        i = args.index("--target")
        if i + 1 < len(args):
            target_id = args[i+1]
    mapping = {
        "homepage-price-watch": "EUR 199.99",
        "homepage-availability": "In stock",
    }
    text = mapping.get(target_id, f"fixture-text-for:{target_id}")
    payload = {"ok": True, "targetId": target_id, "text": text}
    print(json.dumps(payload))

if __name__ == "__main__":
    main()
