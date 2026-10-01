export const services = [
  {
    slug: "tree-trimming",
    name: "Tree Trimming",
    eyebrow: "Shape. Clearance. Care.",
    shortDescription:
      "Practical trimming for overgrown limbs, property clearance, and a cleaner-looking landscape.",
    description:
      "Every tree and property is different. CutPro starts by understanding the clearance, appearance, or maintenance concern, then discusses an approach for the specific site.",
    reasons: [
      "Branches are crowding roofs, walkways, or outdoor areas",
      "Overgrowth is affecting the look or use of the property",
      "A tree needs selective maintenance after weather or seasonal growth",
    ],
    approach: [
      "Walk through the goal and the parts of the tree causing concern",
      "Review access, nearby structures, and the work area",
      "Explain the proposed scope before work is scheduled",
    ],
    accent: "lime",
  },
  {
    slug: "tree-removal",
    name: "Tree Removal",
    eyebrow: "A clear plan for difficult trees.",
    shortDescription:
      "Removal planning for unwanted, damaged, fallen, or problem trees on residential and commercial properties.",
    description:
      "Tree removal begins with the site—not a one-size-fits-all answer. CutPro reviews the tree, access, nearby property, and your goals before defining the job.",
    reasons: [
      "A dead, damaged, or fallen tree needs attention",
      "A tree conflicts with a planned property improvement",
      "Roots, lean, location, or ongoing debris are creating concerns",
    ],
    approach: [
      "Review the tree and surrounding work area",
      "Discuss access, removal sequence, and requested cleanup",
      "Provide an estimate based on the actual site conditions",
    ],
    accent: "orange",
  },
  {
    slug: "stump-grinding",
    name: "Stump Grinding",
    eyebrow: "Reclaim usable ground.",
    shortDescription:
      "Reduce unwanted stumps that interfere with landscaping, access, or plans for the space.",
    description:
      "Stump work varies with diameter, species, access, nearby utilities, and the future use of the area. Photos help CutPro understand the job before follow-up.",
    reasons: [
      "An old stump occupies usable yard or project space",
      "The stump is difficult to mow or maintain around",
      "A recent removal left a stump that needs a separate plan",
    ],
    approach: [
      "Confirm stump count, approximate size, and site access",
      "Discuss the desired finished depth and use of the area",
      "Clarify handling of grindings and surface cleanup in the estimate",
    ],
    accent: "sand",
  },
  {
    slug: "emergency-tree-service",
    name: "Emergency Tree Service",
    eyebrow: "Start with a direct call.",
    shortDescription:
      "Urgent help for fallen trees, storm damage, and time-sensitive tree concerns, subject to availability.",
    description:
      "If a tree situation is urgent, call CutPro and describe what happened. Availability and the right next step depend on the conditions at the property.",
    reasons: [
      "A tree or large limb has fallen",
      "Recent weather caused visible damage",
      "A tree concern is blocking normal use of the property",
    ],
    approach: [
      "Call first and explain what is happening",
      "Keep people away from the affected area",
      "For contact with utility lines, contact the utility or emergency services first",
    ],
    accent: "red",
  },
  {
    slug: "trash-hauling",
    name: "Trash Hauling",
    eyebrow: "Clear the clutter. Reclaim the space.",
    shortDescription:
      "Convenient hauling for yard debris, bulky items, and property cleanouts that need a clear next step.",
    description:
      "Trash hauling starts with understanding what needs to go, where it is located, and what access the property allows. CutPro can review the volume and material mix before discussing the right hauling plan.",
    reasons: [
      "Yard debris or bulky items are taking up useful space",
      "A cleanout or property project has created more material than you can handle",
      "You need help loading and hauling unwanted items away",
    ],
    approach: [
      "Describe the materials, approximate volume, and where they are located",
      "Review driveway, gate, stair, and other access considerations",
      "Confirm the requested scope and cleanup expectations before scheduling",
    ],
    accent: "lime",
    defaultPhoto: {
      public_url: "/service-images/trash-hauling.jpg",
      alt_text: "CutPro crew loading bulky items into a hauling truck",
      caption: "Trash hauling",
    },
  },
  {
    slug: "fence-building",
    name: "Fence Building",
    eyebrow: "Define the property. Build it right.",
    shortDescription:
      "Fence building and repair for privacy, property boundaries, access, and a more finished outdoor space.",
    description:
      "A useful fence plan depends on the property line, layout, materials, gates, existing posts, and the way you need the space to work. CutPro starts with the site and the result you want before defining the project.",
    reasons: [
      "A damaged or leaning fence needs repair or replacement",
      "You want more privacy, security, or a clearer property boundary",
      "A new gate or enclosure would make the property easier to use",
    ],
    approach: [
      "Review the fence line, access, terrain, and existing structures",
      "Discuss the desired height, material, gate layout, and finish",
      "Confirm the scope and site details before an estimate is prepared",
    ],
    accent: "orange",
    defaultPhoto: {
      public_url: "/service-images/fence-building.jpg",
      alt_text: "Finished wood fence along a Bakersfield property",
      caption: "Fence building",
    },
  },
];

export function getService(slug) {
  return services.find((service) => service.slug === slug);
}

export const estimateServiceOptions = [
  ...services.map(({ slug, name }) => ({ value: slug, label: name })),
  { value: "other", label: "Other" },
];

