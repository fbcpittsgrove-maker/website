/**
 * The church's fixed facts — one place to correct them. Everything here
 * renders on the public site.
 *
 * Sourced 2026-10-26 from a church directory listing and search results, NOT
 * yet confirmed by the church. Confirm before the site goes live.
 */

/** `outreach` marks time the church spends out in the community rather than
 *  gathered at the building — listed, but never the hero's "Next gathering". */
export type ServiceTime = { time: string; label: string; outreach?: boolean };
export type ServiceDay = { day: string; services: ServiceTime[] };
export type Leader = { name: string; title: string; bio: string; image?: string; imageAlt?: string };
export type MinistryClass = { name: string; who?: string; teacher?: string };
export type Worker = { name: string; role: string; image: string; imageAlt: string };
export type Ministry = { name: string; when?: string; blurb: string; classes?: MinistryClass[]; image?: string; imageAlt?: string };

export const CHURCH = {
  name: "Faith Baptist Church",
  place: "of Pittsgrove",
  fullName: "Faith Baptist Church of Pittsgrove",
  tagline: "An independent Baptist church in Pittsgrove, New Jersey",
  address: {
    street: "465 Greenville Rd",
    city: "Pittsgrove",
    state: "NJ",
    zip: "08318",
  },
  facebook: "https://www.facebook.com/profile.php?id=61595428580525",
  phone: "(856) 362-4851" as string | null,
  email: null as string | null,
  bible: "King James Bible",
  schedule: [
    {
      day: "Sunday",
      services: [
        { time: "9:45 AM", label: "Sunday School" },
        { time: "11:00 AM", label: "Morning Service" },
        { time: "6:00 PM", label: "Evening Service" },
      ],
    },
    {
      day: "Wednesday",
      services: [{ time: "6:30 PM", label: "Bible Study & Prayer" }],
    },
    {
      day: "Saturday",
      services: [
        { time: "11:00 AM", label: "Visitation", outreach: true },
        { time: "4:30 PM", label: "Prayer Meeting" },
      ],
    },
  ] satisfies ServiceDay[],
  leaders: [
    {
      name: "Glen D. Bradbury",
      title: "Pastor",
      bio: "",
      image: "/images/camp-meeting-preaching.jpg",
      imageAlt: "Pastor Glen D. Bradbury preaching under the camp meeting tent",
    },
    {
      name: "Steven Bradbury",
      title: "Assistant Pastor",
      bio: "Steven, his wife Kristen and their children came to Faith Baptist from First Baptist Church in Hammond, Indiana, where Steven served in the bus ministry and junior church.",
      image: "/images/steven-kristen-bradbury.jpg",
      imageAlt: "Assistant Pastor Steven Bradbury and his wife Kristen, smiling outdoors",
    },
  ] satisfies Leader[],
  /** Teachers and workers shown under the pastors on the About page. */
  workers: [
    {
      name: "Sarah Reichelt",
      role: "Junior Sunday School teacher",
      image: "/images/sarah-reichelt.jpg",
      imageAlt: "Sarah Reichelt, junior Sunday School teacher, in front of the church's white paneled doors",
    },
    {
      name: "Jerry Reichelt",
      role: "Junior Church preacher",
      image: "/images/jerry-reichelt.jpg",
      imageAlt: "Jerry Reichelt, Junior Church preacher, in front of the church's white paneled doors",
    },
  ] satisfies Worker[],
  ministries: [
    {
      name: "Sunday School",
      when: "Sundays at 9:45 AM",
      blurb: "Bible classes for every age before the morning service.",
      classes: [
        { name: "Primary", who: "Kindergarten–3rd grade" },
        { name: "Junior", who: "4th–5th grade", teacher: "Sarah Reichelt" },
        { name: "Teen", who: "6th–12th grade" },
        { name: "Adult Ladies" },
        { name: "Adult Men" },
      ],
    },
    {
      name: "Junior Church",
      blurb: "Bible preaching just for children, led by Jerry Reichelt.",
    },
    {
      name: "Bible Study & Prayer",
      when: "Wednesdays at 6:30 PM",
      blurb: "Midweek Bible study and prayer for the whole church.",
    },
    {
      name: "Bus Ministry",
      blurb: "The church bus helps bring neighbors to church.",
      image: "/images/church-bus.jpeg",
      imageAlt: "The yellow Faith Baptist Church bus, lettered Pittsgrove, NJ",
    },
    {
      name: "Camp Meetings",
      blurb: "Preaching and special music under the big red-and-white tent on the church grounds.",
      image: "/images/camp-meeting-preaching.jpg",
      imageAlt: "Pastor Glen D. Bradbury preaching under the camp meeting tent",
    },
    {
      name: "Ladies’ Ministry",
      blurb: "The ladies of the church serving together and enjoying fellowship.",
      image: "/images/ladies-ministry.jpg",
      imageAlt: "The ladies of the church in matching FAITH shirts in the fellowship hall",
    },
    {
      name: "Fellowship & Hymn Sings",
      blurb: "Outdoor hymn sings and fellowship days with the whole church family.",
      image: "/images/hymn-sing.jpg",
      imageAlt: "Church members singing hymns outdoors on a sunny autumn day",
    },
    {
      name: "Discipleship",
      blurb: "A discipleship course for growing in the faith, finished with a certificate of completion.",
      image: "/images/discipleship.jpeg",
      imageAlt: "A church member receiving a discipleship certificate in the sanctuary",
    },
  ] satisfies Ministry[],
  /** Hero photos under /public — `wide` for tablets and up, `tall` for
   *  phones — or null for the plain hero. */
  heroImage: { wide: "/images/sanctuary-wide.jpg", tall: "/images/sanctuary-tall.jpg" } as { wide: string; tall: string } | null,
  exteriorImage: "/images/church-exterior.jpeg",
  /** Church-life strip on the homepage — adults and crowds only until
   *  parents have cleared photos that show children. */
  gallery: [
    { src: "/images/camp-meeting-singing.jpg", caption: "Camp meeting", alt: "Singers and a pianist leading music at the camp meeting tent" },
    { src: "/images/hymn-sing-music.jpg", caption: "Hymn sing", alt: "Two church members with a flute and sheet music at an outdoor hymn sing" },
    { src: "/images/ladies-ministry.jpg", caption: "Ladies' ministry", alt: "The ladies of the church in matching FAITH shirts" },
    { src: "/images/fellowship-day.jpg", caption: "Fellowship day", alt: "A good sport in the pie-throwing target at a fellowship day" },
  ],
} as const;

export function addressLine(): string {
  const { street, city, state, zip } = CHURCH.address;
  return `${street}, ${city}, ${state} ${zip}`;
}

/** `tel:` or `sms:` link for the church phone — US numbers, so +1. */
export function phoneHref(scheme: "tel" | "sms"): string {
  if (!CHURCH.phone) throw new Error("CHURCH.phone is not set");
  return `${scheme}:+1${CHURCH.phone.replace(/\D/g, "")}`;
}

export function directionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${CHURCH.fullName}, ${addressLine()}`)}`;
}
