import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      adminUser?: { username: string };
    }>();

    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : undefined;

    try {
      req.adminUser = this.auth.verifyToken(token);
      return true;
    } catch (e: unknown) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException("Invalid admin token");
    }
  }
}
