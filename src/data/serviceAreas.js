export const serviceAreas = [
  {
    slug: "bakersfield",
    name: "Bakersfield",
    region: "California",
    title: "Tree Service in Bakersfield, CA",
    description:
      "Request tree trimming, tree removal, stump grinding, or urgent tree-service help for a Bakersfield property.",
    neighborhoods:
      "Service availability depends on the job location, access, and requested work. Send the address and photos so CutPro can confirm coverage.",
  },
];

export function getServiceArea(slug) {
  return serviceAreas.find((area) => area.slug === slug);
}

