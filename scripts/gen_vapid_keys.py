#!/usr/bin/env python3
"""Generate a new Web Push (VAPID) key pair. Only needed if VAPID_PRIVATE_KEY leaks or is lost.

Needs the `cryptography` package, so run it in a throwaway venv (it isn't used anywhere else):
    python3 -m venv /tmp/v && /tmp/v/bin/pip install cryptography
    /tmp/v/bin/python scripts/gen_vapid_keys.py

Prints both halves as base64url without padding: the public key goes in VAPID_PUBLIC in index.html,
the private key in the VAPID_PRIVATE_KEY Actions secret (never in a file). See context/secrets.md.
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


key = ec.generate_private_key(ec.SECP256R1())
public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print("VAPID_PUBLIC (index.html):    ", b64url(public))
print("VAPID_PRIVATE_KEY (secret):   ", b64url(key.private_numbers().private_value.to_bytes(32, "big")))
