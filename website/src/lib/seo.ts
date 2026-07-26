import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

interface BuildMetadataArgs {
  title?: string;
  description?: string;
  path?: string;
  keywords?: string[];
}

/** Build consistent, SEO-complete metadata for any page (doc 09). */
export function buildMetadata({
  title,
  description = siteConfig.description,
  path = "/",
  keywords,
}: BuildMetadataArgs = {}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const fullTitle = title
    ? `${title} · ${siteConfig.name}`
    : `${siteConfig.name} — Enterprise Software Company`;

  return {
    title: fullTitle,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName: siteConfig.name,
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}

/** Organization JSON-LD (doc 09 — schema.org). */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    sameAs: Object.values(siteConfig.social),
  };
}

/** SoftwareApplication JSON-LD for the platform. */
export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Orkiestri One",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", category: "SaaS" },
    publisher: { "@type": "Organization", name: siteConfig.name },
  };
}
