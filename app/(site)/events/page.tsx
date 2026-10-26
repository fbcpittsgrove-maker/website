import { EventList } from "@/components/site/event-list";
import { JsonLd } from "@/components/site/json-ld";
import { PageBanner } from "@/components/site/section";
import { publicEvents } from "@/lib/content-server";
import { eventsGraph, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/events");

export default async function EventsPage() {
  const events = await publicEvents();
  return (
    <>
      {events.length > 0 && <JsonLd data={eventsGraph(events)} />}
      <PageBanner eyebrow="Calendar" title="Upcoming Events" intro="Special services, gatherings and events at the church. Times are Eastern." />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <EventList events={events} empty="No upcoming events are listed right now — check back soon." />
      </section>
    </>
  );
}
