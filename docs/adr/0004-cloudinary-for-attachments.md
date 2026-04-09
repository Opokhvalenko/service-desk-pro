# ADR 0004: Cloudinary for File Attachments

**Status:** Accepted
**Date:** 2026-04-09
**Deciders:** Oksana Pokhvalenko

---

## Context

Tickets need file attachments (screenshots, logs, PDFs). Requirements:
- Free tier sufficient for a portfolio project.
- Direct CDN delivery without proxying through the API.
- Server-side validation (size, MIME, magic bytes) so the API stays the gatekeeper.
- Easy to delete on attachment removal.

## Decision

Use **Cloudinary** as the object storage + CDN. The backend uploads to Cloudinary via the official SDK, stores `publicId` + `secureUrl` + `bytes` + `mimeType` in the `Attachment` table, and serves the `secureUrl` directly to the frontend.

## Alternatives Considered

### S3 (or any S3-compatible store)
- ✅ Industry standard
- ✅ Cheapest at scale
- ❌ Need a separate CDN (CloudFront) for delivery — extra setup
- ❌ More moving parts for a portfolio project

### Local disk on the API server
- ✅ Zero infra
- ❌ Render's filesystem is ephemeral — files vanish on restart
- ❌ Doesn't survive horizontal scaling

### Cloudinary (chosen)
- ✅ Free tier covers the project comfortably
- ✅ Upload API + CDN + on-the-fly transforms in one product
- ✅ Built-in image optimization
- ❌ Vendor lock-in on the URL format
- ❌ Less common than S3 in enterprise stacks

## Consequences

- Uploads stream through the API for validation (size limit, MIME allowlist, magic-bytes sniff) — we never give the client a presigned URL.
- Deletions go through `cloudinary.uploader.destroy()` and are wrapped in a transaction with the DB row.
- Migration to S3 later means rewriting `CloudinaryService` and a backfill script — the rest of the code only sees `Attachment` rows.
