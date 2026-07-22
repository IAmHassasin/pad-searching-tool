import { MonsterPortrait } from "../components/MonsterPortrait";
import type { MonsterRecord } from "../types";

type Props = {
  title: string;
  coverMonsters: MonsterRecord[];
};

/**
 * Steam-style event banner: simple BG, title, all cover arts stacked/cropped on the right.
 */
export function EventHero({ title, coverMonsters }: Props) {
  const count = coverMonsters.length;
  // Spread characters across the right half; overlap more when many.
  const step = count <= 3 ? 18 : count <= 6 ? 12 : 9;

  return (
    <section className="relative overflow-hidden border-b-2 border-[#a8842f] bg-[radial-gradient(ellipse_at_30%_20%,#3a2c1a_0%,#0d0a06_55%)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 75% 40%, rgba(255,213,79,0.1), transparent 45%), linear-gradient(90deg, rgba(13,10,6,0.85) 0%, rgba(13,10,6,0.35) 45%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[200px] w-full max-w-6xl items-stretch sm:min-h-[260px] md:min-h-[300px]">
        {/* Title — left safe area */}
        <div className="relative z-20 flex w-[42%] max-w-md flex-col justify-center px-4 py-8 sm:px-8 sm:py-10">
          <h1
            className="bg-[linear-gradient(180deg,#fff6d8_0%,#ffd54f_45%,#b8860b_100%)] bg-clip-text text-2xl font-black uppercase leading-tight text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] sm:text-4xl md:text-5xl"
            style={{ letterSpacing: "0.04em" }}
          >
            {title}
          </h1>
        </div>

        {/* Characters — right, Steam-like crop */}
        {count > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[68%] sm:w-[62%]"
            aria-hidden
          >
            <div className="relative h-full w-full">
              {coverMonsters.map((row, i) => {
                const fromRight = (count - 1 - i) * step;
                const z = i + 1;
                // Slight vertical stagger so the stack reads as a group, not a flat row.
                const lift = (i % 2) * 4;
                return (
                  <MonsterPortrait
                    key={row.monster_id ?? i}
                    monsterId={row.monster_id ?? 0}
                    alt=""
                    variant="portrait"
                    className="absolute bottom-0 h-[115%] max-w-none object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
                    style={{
                      right: `${fromRight}%`,
                      zIndex: z,
                      transform: `translateY(${lift}%)`,
                      width: count <= 2 ? "55%" : count <= 4 ? "42%" : "34%",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
