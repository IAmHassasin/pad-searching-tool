import { useQuery } from "@tanstack/react-query";
import { fetchEnglishTranslations, type EnglishGlossary } from "./api";

export function useEnglishGlossary() {
  return useQuery({
    queryKey: ["dungeon-details", "translations", "en"],
    queryFn: fetchEnglishTranslations,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export type { EnglishGlossary };
