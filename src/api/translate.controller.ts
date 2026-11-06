import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { NameTranslationService } from "./name-translation.service";
import { RequestRateLimit } from "./request-rate-limit";
import { CORPUS_MAX_QUERY_LENGTH, substituteNumbers, type SkillCorpusKind } from "./skill-corpus";
import { SkillCorpusService } from "./skill-corpus.service";

const MAX_LABELS = 10;
const MAX_LABEL_LENGTH = 300;
/** Per client address, per 10 minutes; the upstream translation service is a free, unofficial endpoint. */
const LABEL_LIMIT = new RequestRateLimit(60, 10 * 60 * 1000);
/** The corpus lookup scans the whole in-memory index per request. */
const CORPUS_LIMIT = new RequestRateLimit(120, 10 * 60 * 1000);

/** The parts of the Express request used for rate limiting (no `@types/express` in this repo). */
type ClientRequest = {
  ip?: string;
};

/**
 * Client address as Express resolves it: the socket address, or the forwarded address when
 * `TRUST_PROXY_HOPS` is configured (see `main.ts`). The raw `x-forwarded-for` header is not
 * read here because a client can set it to anything.
 */
function clientKey(req: ClientRequest): string {
  return (req.ip || "unknown").slice(0, 64);
}

function parseLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new BadRequestException("texts must be an array of strings.");
  if (raw.length > MAX_LABELS) throw new BadRequestException(`Too many texts (max ${MAX_LABELS}).`);
  return raw.map((item) => {
    if (typeof item !== "string") throw new BadRequestException("texts must be strings.");
    if (item.length > MAX_LABEL_LENGTH) {
      throw new BadRequestException(`Text too long (max ${MAX_LABEL_LENGTH} characters).`);
    }
    return item;
  });
}

/** Free-text helpers for the screenshot translate page (under /api so the /translate page route stays free). */
@Controller("api/translate")
export class TranslateController {
  constructor(
    private readonly names: NameTranslationService,
    private readonly corpus: SkillCorpusService
  ) {}

  /** Japanese → English for short labels (names, skill names, skill text) via the shared translation path. */
  @Post("labels")
  async translateLabels(
    @Body() body: { texts?: unknown; titleCase?: unknown },
    @Req() req: ClientRequest
  ) {
    const texts = parseLabels(body?.texts);
    if (!LABEL_LIMIT.allow(clientKey(req))) {
      throw new HttpException("Too many translation requests; try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
    const titleCase = body?.titleCase !== false;
    const translated = await this.names.translateLabels(texts, titleCase);
    return { texts: translated };
  }

  /** Closest catalog skill texts (JP/EN pairs) for an OCR'd Japanese description. */
  @Get("corpus-match")
  async corpusMatch(@Query("q") q?: string, @Query("kind") kindRaw?: string, @Req() req?: ClientRequest) {
    const query = (q ?? "").trim();
    if (!query) throw new BadRequestException("q is required.");
    if (!CORPUS_LIMIT.allow(clientKey(req ?? {}))) {
      throw new HttpException("Too many lookup requests; try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (query.length > CORPUS_MAX_QUERY_LENGTH) {
      throw new BadRequestException(`q is too long (max ${CORPUS_MAX_QUERY_LENGTH} characters).`);
    }
    let kind: SkillCorpusKind | undefined;
    if (kindRaw === "active" || kindRaw === "leader") kind = kindRaw;
    else if (kindRaw) throw new BadRequestException("kind must be active or leader.");
    const matches = await this.corpus.match(query, kind, 3);
    return {
      matches: matches.map((m) => {
        const carried = substituteNumbers(query, m.entry.ja, m.entry.en);
        return {
          kind: m.entry.kind,
          id: m.entry.id,
          ja: m.entry.ja,
          en: m.entry.en,
          /** Catalog English with the query's numbers carried over where that was unambiguous. */
          enWithQueryNumbers: carried.en,
          numbersComplete: carried.complete,
          score: Number(m.score.toFixed(4)),
        };
      }),
    };
  }
}
