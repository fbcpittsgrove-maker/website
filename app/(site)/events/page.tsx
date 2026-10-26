import { EventList } from "@/components/site/event-list";
import { PageBanner } from "@/components/site/section";
import { publicEvents } from "@/lib/content-server";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const events = await publicEvents();
  return (
    <>
      <PageBanner eyebrow="Calendar" title="Upcoming Events" intro="Special services, gatherings and events at the church. Times are Eastern." />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <EventList events={events} empty="No upcoming events are listed right now — check back soon." />
      </section>
    </>
  );
}
