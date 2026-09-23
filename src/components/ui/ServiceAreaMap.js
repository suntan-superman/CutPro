import Image from "next/image";

export default function ServiceAreaMap() {
  return (
    <figure className="service-area-map">
      <div className="service-area-map-image">
        <Image
          src="/maps/bakersfield.webp"
          alt="Map of Bakersfield, California, and nearby neighborhoods, showing local roads, highways, and the Kern River."
          width={1200}
          height={866}
          sizes="(max-width: 760px) 100vw, 50vw"
        />
        <a className="service-area-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
      </div>
      <figcaption>
        <strong>Bakersfield &amp; surrounding areas</strong>
        <span>Map shows the local area, not a service boundary. Send your address to confirm availability.</span>
        <a href="https://www.openstreetmap.org/#map=12/35.365/-119.03" target="_blank" rel="noopener noreferrer">View larger map <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
      </figcaption>
    </figure>
  );
}
