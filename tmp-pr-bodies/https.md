Addresses finding #1 from the skin-api communication audit.

`SKIN_API_URL` is validated only with `z.string().url()`, which accepts `http://`. The `return_to` allowlist enforces https, but this server-to-server base URL does not. A misconfiguration to `http://` would transmit the Bearer API key and SSO identity payload in cleartext.

This adds an https check inside the existing production `superRefine`: in a real production deployment (NODE_ENV=production and not a dev/loopback hostname), `SKIN_API_URL` must use `https:`. Loopback targets (127.0.0.1, localhost, ::1) stay exempt, and dev/local deployments are unaffected via the existing early returns. The default (`http://127.0.0.1:8787`) remains valid.

Refs #1000
