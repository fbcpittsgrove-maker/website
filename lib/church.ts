/**
 * The church's fixed facts — one place to correct them. Everything here
 * renders on the public site.
 *
 * Sourced 2026-10-26 from a church directory listing and search results, NOT
 * yet confirmed by the church. Confirm before the site goes live.
 */

export type ServiceTime = { time: string; label: string };
export type ServiceDay = { day: string; services: ServiceTime[] };
export type Leader = { name: string; title: string; bio: string; image?: string; imageAlt?: string };
export type Ministry = { name: string; when?: string; blurb: string; image?: string; imageAlt?: string };

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
  phone: null as string | null,
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
      services: [{ time: "6:30 PM", label: "Evening Service" }],
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
    },
  ] satisfies Leader[],
  ministries: [
    {
      name: "Sunday School",
      when: "Sundays at 9:45 AM",
      blurb: "Bible classes before the morning service.",
    },
    {
      name: "Midweek Service",
      when: "Wednesdays at 6:30 PM",
      blurb: "Our midweek gathering for the whole church.",
    },
    {
      name: "Bus Ministry",
      blurb: "The church bus helps bring neighbours to church.",
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
  /** Public path of the hero photo under /public, or null for the plain hero. */
  heroImage: "/images/sanctuary.jpeg" as string | null,
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

export function directionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${CHURCH.fullName}, ${addressLine()}`)}`;
}
