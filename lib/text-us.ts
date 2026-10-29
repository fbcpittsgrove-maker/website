import { phoneHref } from "@/lib/church";

/** Ready-made texts to the church phone. Each one opens the visitor's
 *  messages app with the text started; they fill in the blanks and send. */
export const TEXT_MESSAGES = {
  pastor: { label: "Talk with a pastor", body: "Hi, I'd like to talk with a pastor. My name is " },
  bus: {
    label: "Ride the church bus",
    body: "Hi, I'd like a ride on the church bus. My name is ___, my address is ___, and ___ people need a ride.",
  },
  prayer: { label: "Send a prayer request", body: "Hi, I have a prayer request: " },
  visit: { label: "Plan a visit", body: "Hi, I'm planning to visit Faith Baptist this Sunday. My name is " },
  saved: {
    label: "Text a pastor",
    body: "Hi, I just prayed to receive Christ after reading The Bible Way to Heaven on your website. My name is ",
  },
} as const;

export type TextKind = keyof typeof TEXT_MESSAGES;

/** `?&body=` is read by both iPhone (`&body`) and Android (`?body`). */
export function textHref(kind: TextKind): string {
  return `${phoneHref("sms")}?&body=${encodeURIComponent(TEXT_MESSAGES[kind].body)}`;
}
