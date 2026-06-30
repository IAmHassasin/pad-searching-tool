import {
  AFTER_ACTIVATION_SPLIT_RE,
  isAfterActivationMarker,
} from "../lib/format-active-skill-desc";

type Props = {
  text: string;
  className?: string;
};

export function ActiveSkillDescText({ text, className }: Props) {
  const parts = text.split(AFTER_ACTIVATION_SPLIT_RE);
  const hasMarker = parts.some(isAfterActivationMarker);

  if (!hasMarker) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p className={className}>
      {parts.map((part, i) =>
        isAfterActivationMarker(part) ? (
          <strong key={i} className="font-bold text-[#f5e6c8]">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
