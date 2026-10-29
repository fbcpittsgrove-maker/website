import { Bus, CalendarCheck, HandHeart, MessageCircle, type LucideIcon } from "lucide-react";
import { CHURCH } from "@/lib/church";
import { TEXT_MESSAGES, textHref, type TextKind } from "@/lib/text-us";

const ICONS: Record<TextKind, LucideIcon> = {
  pastor: MessageCircle,
  bus: Bus,
  prayer: HandHeart,
  visit: CalendarCheck,
  saved: MessageCircle,
};

/** Buttons that open a pre-written text to the church phone. The first is
 *  the main action; a computer can't send texts, so it gets the number. */
export function TextUs({ kinds }: { kinds: TextKind[] }) {
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {kinds.map((kind, i) => {
          const Icon = ICONS[kind];
          return (
            <a
              key={kind}
              href={textHref(kind)}
              className={
                i === 0
                  ? "inline-flex items-center gap-2 rounded-full bg-action px-5 py-3 text-sm font-semibold text-on-brand transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  : "inline-flex items-center gap-2 rounded-full border border-border-strong px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              }
            >
              <Icon aria-hidden className="size-4" />
              {TEXT_MESSAGES[kind].label}
            </a>
          );
        })}
      </div>
      <p className="mt-3 hidden text-sm text-muted lg:block">On a computer? Text {CHURCH.phone} from your phone.</p>
    </div>
  );
}
