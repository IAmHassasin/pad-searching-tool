import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  NotFoundException,
} from "@nestjs/common";
import { join } from "node:path";
import { isApiPath } from "./web-paths";

type HttpResponse = {
  status: (code: number) => HttpResponse;
  json: (body: unknown) => void;
  sendFile: (path: string) => void;
};

@Catch(NotFoundException)
export class SpaNotFoundFilter implements ExceptionFilter {
  constructor(private readonly publicRoot: string) {}

  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<{ method: string; path: string }>();
    const res = ctx.getResponse<HttpResponse>();

    if (
      (req.method === "GET" || req.method === "HEAD") &&
      !isApiPath(req.path)
    ) {
      res.sendFile(join(this.publicRoot, "index.html"));
      return;
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    res
      .status(status)
      .json(
        typeof body === "string"
          ? { statusCode: status, message: body, error: "Not Found" }
          : body
      );
  }
}
