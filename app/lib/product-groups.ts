export interface ProductGroupMemberConfig {
  slug: string;
  selectionValue: string;
}

export interface ProductGroupConfig {
  slug: string;
  name: string;
  selectionLabel: string;
  members: readonly ProductGroupMemberConfig[];
}

export interface ProductGroupMemberMatch {
  group: ProductGroupConfig;
  member: ProductGroupMemberConfig;
}

export const PRODUCT_GROUPS = [
  {
    slug: "11-21",
    name: "11-21",
    selectionLabel: "Pattern",
    members: [
      { slug: "11-21-infrared", selectionValue: "Infrared" },
      { slug: "11-21-blue", selectionValue: "Blue" },
      { slug: "11-21-green", selectionValue: "Green" },
    ],
  },
] satisfies readonly ProductGroupConfig[];

export function createProductGroupId(slug: string): string {
  return `group:${slug}`;
}

export function findProductGroupMember(
  productSlug: string,
): ProductGroupMemberMatch | undefined {
  for (const group of PRODUCT_GROUPS) {
    const member = group.members.find(
      (candidate) => candidate.slug === productSlug,
    );
    if (member) {
      return { group, member };
    }
  }

  return undefined;
}
