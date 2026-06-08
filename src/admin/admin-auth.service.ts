import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_PREFIX = "padadmin";

@Injectable()
export class AdminAuthService {
  private credentialsConfigured(): boolean {
    return Boolean(
      process.env.ADMIN_USERNAME?.trim() &&
        process.env.ADMIN_PASSWORD?.trim() &&
        process.env.ADMIN_JWT_SECRET?.trim()
    );
  }

  assertAdminConfigured(): void {
    if (!this.credentialsConfigured()) {
      throw new ServiceUnavailableException(
        "Admin API is disabled. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_JWT_SECRET in environment secrets."
      );
    }
  }

  login(username: string, password: string): { token: string; expiresAt: string } {
    this.assertAdminConfigured();

    const expectedUser = process.env.ADMIN_USERNAME!.trim();
    const expectedPass = process.env.ADMIN_PASSWORD!.trim();

    const userOk = this.safeEqual(username.trim(), expectedUser);
    const passOk = this.safeEqual(password, expectedPass);
    if (!userOk || !passOk) {
      throw new UnauthorizedException("Invalid admin credentials");
    }

    const ttlHours = Math.max(
      Number(process.env.ADMIN_TOKEN_TTL_HOURS ?? "12") || 12,
      1
    );
    const expiresAtMs = Date.now() + ttlHours * 60 * 60 * 1000;
    const nonce = randomBytes(8).toString("hex");
    const payload = `${TOKEN_PREFIX}:${expectedUser}:${expiresAtMs}:${nonce}`;
    const sig = createHmac("sha256", process.env.ADMIN_JWT_SECRET!.trim())
      .update(payload)
      .digest("hex");
    const token = Buffer.from(`${payload}:${sig}`).toString("base64url");

    return {
      token,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  verifyToken(token: string | undefined): { username: string } {
    this.assertAdminConfigured();
    if (!token?.trim()) {
      throw new UnauthorizedException("Missing admin token");
    }

    let decoded: string;
    try {
      decoded = Buffer.from(token.trim(), "base64url").toString("utf8");
    } catch {
      throw new UnauthorizedException("Invalid admin token");
    }

    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) {
      throw new UnauthorizedException("Invalid admin token");
    }

    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expectedSig = createHmac("sha256", process.env.ADMIN_JWT_SECRET!.trim())
      .update(payload)
      .digest("hex");

    if (!this.safeEqual(sig, expectedSig)) {
      throw new UnauthorizedException("Invalid admin token");
    }

    const parts = payload.split(":");
    if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) {
      throw new UnauthorizedException("Invalid admin token");
    }

    const username = parts[1]!;
    const expiresAtMs = Number(parts[2]);
    if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
      throw new UnauthorizedException("Admin token expired");
    }

    if (!this.safeEqual(username, process.env.ADMIN_USERNAME!.trim())) {
      throw new UnauthorizedException("Invalid admin token");
    }

    return { username };
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
